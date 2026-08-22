import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { expectedNativeDockerHostMarker, hostContract } from './onprem-native-docker-host.mjs'
import { provisionNativeDockerHost } from './onprem-native-docker-host-provision.mjs'
import { runLocalProof } from './onprem-image-local-proof.mjs'
import { DISPOSABLE_DAEMON_ROOTS } from './onprem-image-local-proof-recovery.mjs'

const SCRIPT_ROOT = path.dirname(fileURLToPath(import.meta.url))
const CHECKOUT_ROOT = fs.realpathSync(path.resolve(SCRIPT_ROOT, '..'))
const SOURCE_SHA = /^[a-f0-9]{40}$/
const SHA256 = /^[a-f0-9]{64}$/
const POSITIVE_INTEGER = /^[1-9][0-9]*$/
const NODE_VERSION = 'v24.19.0'
const DEFAULT_DEADLINE_MINUTES = 60
const MAX_DEADLINE_MINUTES = 60
const MAX_RECEIPT_BYTES = 4 * 1024 * 1024
const PROVISION_RECEIPT_SCHEMA = 'hr-axis-onprem-native-docker-host-provision-v1'
const PROVISION_RECEIPT_VERSION = 1
const PROVISION_EVIDENCE = 'local-native-host-provisioning'
const ZERO_INVENTORY = Object.freeze({ containers: 0, networks: 0, volumes: 0, images: 0 })
const DOCKER_ENDPOINT = `unix://${hostContract.socket}`
const OUTPUT_NAMES = Object.freeze(['runRoot', 'proofOutput', 'provisionReceipt', 'imageReceipt', 'sessionReceipt'])
const ROOTS = Object.freeze([...DISPOSABLE_DAEMON_ROOTS, '/var/lib/hr-axis-onprem-rehearsal'])

const fail = (message) => { throw new Error(message) }
const object = (value) => value !== null && typeof value === 'object' && !Array.isArray(value)

function assertString(value, label) {
  if (typeof value !== 'string' || value.length === 0 || /[\0\r\n]/.test(value)) fail(`${label} is invalid`)
  return value
}

function assertHash(value, label, pattern = SHA256) {
  assertString(value, label)
  if (!pattern.test(value)) fail(`${label} is invalid`)
  return value
}

function portableAbsolute(value) {
  return path.isAbsolute(value) || /^[A-Za-z]:[\\/]/.test(value)
}

function inside(candidate, root) {
  const relative = path.relative(path.resolve(root), path.resolve(candidate))
  return relative === '' || (relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative))
}

function lstat(fsApi, target, label) {
  try { return fsApi.lstatSync(target) } catch { fail(`${label} parent is unavailable`) }
}

function assertSafeParent(fsApi, parent, label, platform, uid) {
  const stats = lstat(fsApi, parent, `${label} parent`)
  if (!stats.isDirectory() || stats.isSymbolicLink()) fail(`${label} parent must be a non-symlink directory`)
  if (platform === 'linux' && process.platform === 'linux' && Number.isInteger(stats.mode) && (stats.mode & 0o022) !== 0) {
    fail(`${label} parent is writable by group or other users`)
  }
  if (platform === 'linux' && process.platform === 'linux' && Number.isInteger(stats.uid) && Number.isInteger(uid) && stats.uid !== 0 && stats.uid !== uid) fail(`${label} parent is not root- or caller-owned`)
  return stats
}

function assertNoSymlinkAncestors(fsApi, target, label) {
  let cursor = path.resolve(target)
  const root = path.parse(cursor).root
  while (true) {
    let stats
    try { stats = fsApi.lstatSync(cursor) } catch { stats = null }
    if (stats?.isSymbolicLink?.() === true) fail(`${label} has a symlink ancestor`)
    if (cursor === root) break
    cursor = path.dirname(cursor)
  }
}

function safeFreshPath(value, label, { fsApi, platform, uid }) {
  assertString(value, label)
  if (!portableAbsolute(value)) fail(`${label} must be absolute`)
  const absolute = path.resolve(value)
  assertNoSymlinkAncestors(fsApi, absolute, label)
  try {
    fsApi.lstatSync(absolute)
    fail(`${label} must be fresh`)
  } catch (error) {
    if (error?.message?.includes('must be fresh')) throw error
    if (error?.code !== 'ENOENT') fail(`${label} cannot be checked safely`)
  }
  const parent = path.dirname(absolute)
  assertSafeParent(fsApi, parent, label, platform, uid)
  let canonicalParent
  try { canonicalParent = fsApi.realpathSync(parent) } catch { fail(`${label} parent cannot be canonicalized`) }
  if (canonicalParent !== path.resolve(parent)) fail(`${label} parent is not canonical`)
  return path.join(canonicalParent, path.basename(absolute))
}

function sha256File(fsApi, pathname) {
  return createHash('sha256').update(fsApi.readFileSync(pathname)).digest('hex')
}

function exactRecord(value, expected, label) {
  if (!object(value)) fail(`${label} is invalid`)
  const actualKeys = Object.keys(value).sort()
  const expectedKeys = Object.keys(expected).sort()
  if (actualKeys.length !== expectedKeys.length || actualKeys.some((key, index) => key !== expectedKeys[index])) fail(`${label} is invalid`)
  for (const key of expectedKeys) if (value[key] !== expected[key]) fail(`${label} is invalid`)
  return value
}

function receiptStatIdentity(stats, label) {
  if (!stats || typeof stats !== 'object') fail(`${label} identity is unavailable`)
  const fields = ['dev', 'ino', 'size', 'mtimeMs', 'ctimeMs', 'nlink', 'mode', 'uid']
  const identity = {}
  for (const field of fields) {
    if (stats[field] === undefined) fail(`${label} identity is incomplete`)
    identity[field] = stats[field]
  }
  return identity
}

function assertReceiptStat(stats, label, { uid, strictPermissions }) {
  const regular = stats.isFile?.() === true || stats.isFile === true
  const symlink = stats.isSymbolicLink?.() === true || stats.isSymbolicLink === true
  if (!regular || symlink) fail(`${label} must be a regular non-symlink file`)
  if (stats.nlink !== 1) fail(`${label} hardlinks are not allowed`)
  if (strictPermissions) {
    if (!Number.isSafeInteger(stats.uid) || (stats.uid !== 0 && stats.uid !== uid)) fail(`${label} owner is not root or caller`)
    if (!Number.isInteger(stats.mode) || (stats.mode & 0o077) !== 0 || (stats.mode & 0o400) === 0) fail(`${label} permissions are not private`)
  }
}

function sameReceiptStat(before, after, label) {
  for (const field of ['dev', 'ino', 'size', 'mtimeMs', 'ctimeMs', 'nlink', 'mode', 'uid']) {
    if (!Object.is(before[field], after[field])) fail(`${label} changed while being read`)
  }
}

export function readImmutableReceiptSnapshot(fsApi, pathname, label, { uid, platform = process.platform, strictPermissions = platform === 'linux' && process.platform === 'linux' } = {}) {
  let before
  try { before = fsApi.lstatSync(pathname) } catch { fail(`${label} is unavailable`) }
  assertReceiptStat(before, label, { uid, strictPermissions })
  const beforeIdentity = receiptStatIdentity(before, label)
  if (!Number.isSafeInteger(beforeIdentity.size) || beforeIdentity.size < 0 || beforeIdentity.size > MAX_RECEIPT_BYTES) fail(`${label} is too large`)
  let bytes
  try { bytes = fsApi.readFileSync(pathname) } catch { fail(`${label} cannot be read`) }
  if (typeof bytes === 'string') bytes = Buffer.from(bytes, 'utf8')
  else if (!Buffer.isBuffer(bytes)) bytes = Buffer.from(bytes)
  if (bytes.length !== beforeIdentity.size) fail(`${label} changed while being read`)
  let after
  try { after = fsApi.lstatSync(pathname) } catch { fail(`${label} changed while being read`) }
  assertReceiptStat(after, label, { uid, strictPermissions })
  const afterIdentity = receiptStatIdentity(after, label)
  sameReceiptStat(beforeIdentity, afterIdentity, label)
  let value
  try { value = JSON.parse(bytes.toString('utf8')) } catch { fail(`${label} is invalid JSON`) }
  if (!object(value)) fail(`${label} must be an object`)
  return Object.freeze({ value, sha256: createHash('sha256').update(bytes).digest('hex'), bytes: bytes.length })
}

function assertDockerEnvironmentSafe(env) {
  for (const name of ['DOCKER_HOST', 'DOCKER_CONTEXT', 'DOCKER_CONFIG']) {
    if (Object.prototype.hasOwnProperty.call(env ?? {}, name)) fail(`${name} override is not allowed`)
  }
}

function readGitState(workspaceRoot, dependencies) {
  if (dependencies.gitState) return dependencies.gitState
  const gitEnvironment = {
    PATH: '/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin',
    LANG: 'C',
    LC_ALL: 'C',
    GIT_CONFIG_NOSYSTEM: '1',
    GIT_CONFIG_SYSTEM: '/dev/null',
    GIT_CONFIG_GLOBAL: '/dev/null',
    GIT_TERMINAL_PROMPT: '0',
  }
  const runGit = dependencies.gitExecFileSync ?? execFileSync
  const run = (args) => runGit('git', ['-C', workspaceRoot, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], env: gitEnvironment }).trim()
  return { head: run(['rev-parse', 'HEAD']), tree: run(['rev-parse', 'HEAD^{tree}']), clean: run(['status', '--porcelain=v1', '--untracked-files=all', '--ignore-submodules=none']) === '' }
}

function assertNodeIdentity(options, dependencies) {
  const execPath = dependencies.execPath ?? process.execPath
  const nodeVersion = dependencies.nodeVersion ?? process.version
  let canonicalExecuting
  try { canonicalExecuting = (dependencies.fsApi ?? fs).realpathSync(execPath) } catch { fail('executing Node path cannot be canonicalized') }
  if (canonicalExecuting !== options.node) fail('executing Node is not the supplied pinned Node')
  if (nodeVersion !== NODE_VERSION) fail(`executing Node must be ${NODE_VERSION}`)
  let digest
  try { digest = sha256File(dependencies.fsApi ?? fs, execPath) } catch { fail('executing Node SHA-256 cannot be read') }
  if (digest !== options.nodeSha256) fail('executing Node SHA-256 does not match supplied pinned Node')
  return { path: options.node, version: nodeVersion, sha256: digest }
}

function validateOutputPaths(options, dependencies) {
  const fsApi = dependencies.fsApi ?? fs
  const platform = dependencies.platform ?? process.platform
  const uid = dependencies.uid ?? (typeof process.getuid === 'function' ? process.getuid() : undefined)
  const paths = {}
  for (const name of OUTPUT_NAMES) paths[name] = safeFreshPath(options[name], name, { fsApi, platform, uid })
  for (const [name, candidate] of Object.entries(paths)) {
    if (inside(candidate, options.workspaceRoot)) fail(`${name} may not be inside the checkout`)
    if (ROOTS.some((root) => inside(candidate, root))) fail(`${name} may not be inside disposable daemon roots`)
  }
  for (let left = 0; left < OUTPUT_NAMES.length; left += 1) {
    for (let right = left + 1; right < OUTPUT_NAMES.length; right += 1) {
      const a = paths[OUTPUT_NAMES[left]]; const b = paths[OUTPUT_NAMES[right]]
      if (inside(a, b) || inside(b, a)) fail('session output paths may not overlap')
    }
  }
  return paths
}

export function parseSessionArguments(argv) {
  if (!Array.isArray(argv)) fail('CLI arguments are required')
  const values = {}
  const valueOptions = new Map([
    ['--source-sha', 'sourceSha'], ['--tree-sha', 'treeSha'], ['--run-number', 'runNumber'], ['--node', 'node'], ['--node-sha256', 'nodeSha256'],
    ['--run-root', 'runRoot'], ['--proof-output', 'proofOutput'], ['--provision-receipt', 'provisionReceipt'], ['--image-receipt', 'imageReceipt'], ['--session-receipt', 'sessionReceipt'],
    ['--deadline-minutes', 'deadlineMinutes'], ['--workspace-root', 'workspaceRoot'],
  ])
  const flags = new Map([['--confirm-disposable-native-host', 'confirmDisposableNativeHost'], ['--allow-disposable-daemon-reset', 'allowDisposableDaemonReset']])
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index]
    if (flags.has(token)) {
      const key = flags.get(token)
      if (Object.hasOwn(values, key)) fail(`duplicate option: ${token}`)
      values[key] = true
      continue
    }
    if (!valueOptions.has(token)) fail(`unknown or positional argument: ${token}`)
    const key = valueOptions.get(token)
    if (Object.hasOwn(values, key)) fail(`duplicate option: ${token}`)
    const value = argv[index + 1]
    if (!value || value.startsWith('--')) fail(`missing value for ${token}`)
    values[key] = value
    index += 1
  }
  return Object.freeze(values)
}

export function validateSessionOptions(raw, dependencies = {}) {
  if (!object(raw)) fail('session options are required')
  for (const key of ['confirmDisposableNativeHost', 'allowDisposableDaemonReset', 'sourceSha', 'treeSha', 'runNumber', 'node', 'nodeSha256', 'runRoot', 'proofOutput', 'provisionReceipt', 'imageReceipt', 'sessionReceipt']) {
    if (!Object.hasOwn(raw, key)) fail(`missing required option: ${key}`)
  }
  if (raw.confirmDisposableNativeHost !== true || raw.allowDisposableDaemonReset !== true) fail('both explicit disposable-host confirmations are required')
  const sourceSha = assertHash(raw.sourceSha, 'source SHA', SOURCE_SHA)
  const treeSha = assertHash(raw.treeSha, 'tree SHA', SOURCE_SHA)
  if (!POSITIVE_INTEGER.test(String(raw.runNumber))) fail('run number is invalid')
  const nodeSha256 = assertHash(raw.nodeSha256, 'Node SHA-256')
  const platform = dependencies.platform ?? process.platform
  const uid = dependencies.uid ?? (typeof process.getuid === 'function' ? process.getuid() : undefined)
  const arch = dependencies.arch ?? process.arch
  if (platform !== 'linux') fail('native session proof requires Linux')
  if (!Number.isInteger(uid) || uid <= 0) fail('native session proof requires a non-root caller')
  if (arch !== 'x64') fail('native session proof requires amd64')
  const fsApi = dependencies.fsApi ?? fs
  assertDockerEnvironmentSafe(dependencies.env ?? process.env)
  const checkoutRoot = fsApi.realpathSync(dependencies.checkoutRoot ?? CHECKOUT_ROOT)
  const workspaceInput = raw.workspaceRoot ?? checkoutRoot
  const workspaceRoot = fsApi.realpathSync(workspaceInput)
  if (workspaceRoot !== checkoutRoot) fail('workspace root must resolve to this checkout')
  if (!portableAbsolute(raw.node)) fail('pinned Node path must be absolute')
  const nodeInput = path.resolve(raw.node)
  assertNoSymlinkAncestors(fsApi, nodeInput, 'pinned Node')
  let node
  try { node = fsApi.realpathSync(nodeInput) } catch { fail('pinned Node cannot be canonicalized') }
  if (node !== nodeInput) fail('pinned Node path must be canonical')
  const nodeStats = lstat(fsApi, node, 'pinned Node')
  if (!nodeStats.isFile() || nodeStats.isSymbolicLink()) fail('pinned Node must be a regular non-symlink file')
  const options = { sourceSha, treeSha, runNumber: String(raw.runNumber), node, nodeSha256, workspaceRoot, confirmDisposableNativeHost: true, allowDisposableDaemonReset: true }
  const outputInput = { runRoot: raw.runRoot, proofOutput: raw.proofOutput, provisionReceipt: raw.provisionReceipt, imageReceipt: raw.imageReceipt, sessionReceipt: raw.sessionReceipt, workspaceRoot }
  Object.assign(options, validateOutputPaths(outputInput, dependencies))
  const deadlineMinutes = raw.deadlineMinutes === undefined ? DEFAULT_DEADLINE_MINUTES : Number(raw.deadlineMinutes)
  if (!Number.isInteger(deadlineMinutes) || deadlineMinutes < 1 || deadlineMinutes > MAX_DEADLINE_MINUTES) fail('deadline-minutes is outside the bounded range')
  options.deadlineMinutes = deadlineMinutes
  const nodeIdentity = assertNodeIdentity(options, dependencies)
  const git = readGitState(workspaceRoot, dependencies)
  if (git.clean !== true || git.head !== sourceSha || git.tree !== treeSha) fail('checkout is not the exact clean requested source identity')
  return Object.freeze({ ...options, nodeIdentity, git })
}

function sanitizePhase(value) {
  if (!object(value) || typeof value.name !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9 ._:-]{0,200}$/.test(value.name) || !['passed', 'failed'].includes(value.status)) fail('image receipt phase is invalid')
  return {
    name: value.name,
    status: value.status,
    exitCode: Number.isInteger(value.exitCode) ? value.exitCode : null,
    signal: typeof value.signal === 'string' ? value.signal : null,
    timedOut: value.timedOut === true,
    durationMs: Number.isFinite(value.durationMs) && value.durationMs >= 0 ? value.durationMs : null,
  }
}

function provisionDefaultUnitState(value, label) {
  exactRecord(value, { active: false, inactive: true, enabled: false, disabled: true }, label)
  return { active: false, inactive: true, enabled: false, disabled: true }
}

export function parsePassedProvisionReceipt(value) {
  if (!object(value) || value.schema !== PROVISION_RECEIPT_SCHEMA || value.version !== PROVISION_RECEIPT_VERSION || value.status !== 'passed' || value.evidence !== PROVISION_EVIDENCE || value.contract !== hostContract.version) fail('provision receipt identity is not passed')
  exactRecord(value.marker, expectedNativeDockerHostMarker(), 'provision receipt marker')
  if (!object(value.host) || value.host.platform !== 'linux' || !['x64', 'amd64'].includes(value.host.architecture)) fail('provision receipt host identity is not Linux amd64')
  if (!object(value.units) || value.units.containerd !== hostContract.containerdUnit || value.units.dockerd !== hostContract.dockerdUnit || !object(value.units.defaults)) fail('provision receipt unit identity is not fixed')
  const dockerService = provisionDefaultUnitState(value.units.defaults.dockerService, 'provision receipt docker.service state')
  const dockerSocket = provisionDefaultUnitState(value.units.defaults.dockerSocket, 'provision receipt docker.socket state')
  const expectedRoots = {
    dockerDataRoot: hostContract.dockerDataRoot,
    dockerExecRoot: hostContract.dockerExecRoot,
    containerdRoot: hostContract.containerdRoot,
    containerdState: hostContract.containerdState,
  }
  if (!object(value.socket) || value.socket.path !== hostContract.socket) fail('provision receipt socket identity is not fixed')
  if (!object(value.roots)) fail('provision receipt roots are invalid')
  exactRecord(value.roots.paths, expectedRoots, 'provision receipt roots')
  if (!object(value.cleanup) || value.cleanup.rootsRecreated !== true || value.cleanup.markerInstalled !== true || value.cleanup.unitsInstalled !== true || value.cleanup.normalDockerDisabled !== true) fail('provision receipt cleanup is not verified')
  if (!object(value.inspect) || value.inspect.passed !== true) fail('provision receipt inspect is not passed')
  exactRecord(value.inspect.inventory, ZERO_INVENTORY, 'provision receipt inventory')
  if (value.failureStage !== null) fail('provision receipt failure stage is not clear')
  return Object.freeze({
    status: 'passed',
    schema: PROVISION_RECEIPT_SCHEMA,
    version: PROVISION_RECEIPT_VERSION,
    evidence: PROVISION_EVIDENCE,
    contract: hostContract.version,
    marker: Object.freeze({ schema: expectedNativeDockerHostMarker().schema, version: expectedNativeDockerHostMarker().version }),
    host: Object.freeze({ platform: 'linux', architecture: value.host.architecture }),
    units: Object.freeze({ containerd: hostContract.containerdUnit, dockerd: hostContract.dockerdUnit, defaults: Object.freeze({ dockerService, dockerSocket }) }),
    socket: hostContract.socket,
    roots: Object.freeze({ ...expectedRoots }),
    inventory: Object.freeze({ ...ZERO_INVENTORY }),
  })
}

function parseVerifiedHostAfter(value) {
  if (!object(value) || value.contract !== hostContract.version) fail('image receipt verified host contract is not fixed')
  const expectedMarker = expectedNativeDockerHostMarker()
  exactRecord(value.marker, { schema: expectedMarker.schema, version: expectedMarker.version }, 'image receipt verified host marker')
  if (!object(value.units) || value.units.containerd !== hostContract.containerdUnit || value.units.dockerd !== hostContract.dockerdUnit) fail('image receipt verified host units are not fixed')
  if (!object(value.pids) || !Number.isSafeInteger(value.pids.containerd) || value.pids.containerd <= 0 || !Number.isSafeInteger(value.pids.dockerd) || value.pids.dockerd <= 0) fail('image receipt verified host PIDs are invalid')
  const expectedProcesses = {
    containerd: { executable: '/usr/bin/containerd', cgroup: `/system.slice/${hostContract.containerdUnit}` },
    dockerd: { executable: '/usr/bin/dockerd', cgroup: `/system.slice/${hostContract.dockerdUnit}` },
  }
  if (!object(value.processes)) fail('image receipt verified host processes are invalid')
  for (const [name, expected] of Object.entries(expectedProcesses)) {
    const process = value.processes[name]
    if (!object(process) || !Number.isSafeInteger(process.startTime) || process.startTime <= 0 || process.executable !== expected.executable || process.cgroup !== expected.cgroup) fail(`image receipt verified host ${name} identity is invalid`)
  }
  if (value.socket !== hostContract.socket || value.dockerRootDir !== hostContract.dockerDataRoot) fail('image receipt verified host paths are not fixed')
  exactRecord(value.inventory, ZERO_INVENTORY, 'image receipt verified host inventory')
  return Object.freeze({
    contract: hostContract.version,
    marker: Object.freeze({ schema: expectedMarker.schema, version: expectedMarker.version }),
    units: Object.freeze({ containerd: hostContract.containerdUnit, dockerd: hostContract.dockerdUnit }),
    pids: Object.freeze({ containerd: value.pids.containerd, dockerd: value.pids.dockerd }),
    processes: Object.freeze({
      containerd: Object.freeze({ startTime: value.processes.containerd.startTime, executable: expectedProcesses.containerd.executable, cgroup: expectedProcesses.containerd.cgroup }),
      dockerd: Object.freeze({ startTime: value.processes.dockerd.startTime, executable: expectedProcesses.dockerd.executable, cgroup: expectedProcesses.dockerd.cgroup }),
    }),
    socket: hostContract.socket,
    dockerRootDir: hostContract.dockerDataRoot,
    inventory: Object.freeze({ ...ZERO_INVENTORY }),
  })
}

export function parsePassedImageReceipt(value, expected) {
  if (!object(value) || value.status !== 'passed' || value.hostedEvidence !== false || value.dataClass !== 'synthetic' || value.proofMode !== 'full' || value.imageScope !== 'both') fail('image receipt is not passed')
  if (value.sourceSha !== expected.sourceSha || value.treeSha !== expected.treeSha) fail('image receipt source identity does not match')
  if (!object(value.node) || value.node.sha256 !== expected.nodeSha256 || value.node.version !== NODE_VERSION) fail('image receipt Node identity does not match')
  if (value.dockerDaemonReset !== true || value.recovery?.dockerDaemonReset !== true) fail('image receipt daemon reset is not verified')
  if (!object(value.verifiedHost) || !object(value.verifiedHost.after)) fail('image receipt verified host recovery is missing')
  const verifiedHost = parseVerifiedHostAfter(value.verifiedHost.after)
  if (!object(value.docker) || typeof value.docker.id !== 'string' || !/^[A-Za-z0-9:_-]{1,128}$/.test(value.docker.id) || value.docker.operatingSystem !== 'linux' || value.docker.architecture !== 'amd64' || !object(value.docker.rootContext) || value.docker.rootContext.context !== 'default' || value.docker.rootContext.endpoint !== DOCKER_ENDPOINT || value.docker.rootContext.dockerRootDir !== hostContract.dockerDataRoot) fail('image receipt Docker identity is not fixed')
  const firewall = value.firewall
  if (!object(firewall) || firewall.status !== 'passed' || firewall.equal !== true || firewall.ipv4?.status !== 'passed' || firewall.ipv4?.byteEqual !== true || firewall.ipv6?.status !== 'passed' || firewall.ipv6?.byteEqual !== true) fail('image receipt IPv4/IPv6 firewall restoration is not verified')
  if (!object(value.postflight) || value.postflight.clean !== true) fail('image receipt postflight is not clean')
  if (!object(value.cleanup) || value.cleanup.status !== 'passed' || value.cleanup.runRoot !== 'removed' || value.cleanup.proofOutput !== 'preserved') fail('image receipt workspace cleanup is not verified')
  if (!Array.isArray(value.phases) || value.phases.length === 0) fail('image receipt phases are missing')
  const phases = value.phases.map(sanitizePhase)
  if (phases.some((phase) => phase.status !== 'passed')) fail('passed image receipt contains a failed phase')
  return Object.freeze({
    sourceSha: value.sourceSha,
    treeSha: value.treeSha,
    node: { version: value.node.version, sha256: value.node.sha256 },
    hostedEvidence: false,
    docker: object(value.docker) ? {
      id: typeof value.docker.id === 'string' && /^[A-Za-z0-9:_-]{1,128}$/.test(value.docker.id) ? value.docker.id : null,
      serverVersion: typeof value.docker.serverVersion === 'string' && /^[\x20-\x7e]{1,80}$/.test(value.docker.serverVersion) ? value.docker.serverVersion : null,
      operatingSystem: value.docker.operatingSystem === 'linux' ? 'linux' : null,
      architecture: value.docker.architecture === 'amd64' ? 'amd64' : null,
      digest: typeof value.docker.digest === 'string' && /^sha256:[a-f0-9]{64}$/.test(value.docker.digest) ? value.docker.digest : null,
      rootContext: object(value.docker.rootContext) ? { context: value.docker.rootContext.context === 'default' ? 'default' : null, endpoint: value.docker.rootContext.endpoint === DOCKER_ENDPOINT ? value.docker.rootContext.endpoint : null, dockerRootDir: value.docker.rootContext.dockerRootDir === hostContract.dockerDataRoot ? value.docker.rootContext.dockerRootDir : null } : null,
    } : null,
    phases: Object.freeze(phases),
    verifiedHost,
    cleanup: Object.freeze({ status: value.cleanup.status, runRoot: value.cleanup.runRoot, proofOutput: value.cleanup.proofOutput }),
    postflight: Object.freeze({ clean: true, status: value.postflight.status ?? null }),
    firewall: Object.freeze({ status: firewall.status, equal: true, ipv4: Object.freeze({ status: firewall.ipv4.status, byteEqual: true }), ipv6: Object.freeze({ status: firewall.ipv6.status, byteEqual: true }) }),
  })
}

function materializeReceipt(fsApi, pathname, payload) {
  const body = { ...payload }
  body.receiptSha256 = createHash('sha256').update(JSON.stringify(body)).digest('hex')
  fsApi.writeFileSync(pathname, `${JSON.stringify(body)}\n`, { encoding: 'utf8', flag: 'wx', mode: 0o600 })
  try { fsApi.chmodSync?.(pathname, 0o600) } catch { /* receipt mode is best effort on non-POSIX test hosts */ }
  return Object.freeze(body)
}

function recheckFreshPath(fsApi, pathname, label, dependencies) {
  const checked = safeFreshPath(pathname, label, {
    fsApi,
    platform: dependencies.platform ?? process.platform,
    uid: dependencies.uid ?? (typeof process.getuid === 'function' ? process.getuid() : undefined),
  })
  if (checked !== pathname) fail(`${label} path changed during recovery`)
}

export async function runNativeSession(raw, dependencies = {}) {
  const options = validateSessionOptions(raw, dependencies)
  const fsApi = dependencies.fsApi ?? fs
  const provision = dependencies.provisionNativeDockerHost ?? provisionNativeDockerHost
  const proof = dependencies.runLocalProof ?? runLocalProof
  const provisionResult = provision({
    confirmDisposableNativeHost: options.confirmDisposableNativeHost,
    receiptPath: options.provisionReceipt,
    platform: dependencies.platform ?? process.platform,
    arch: dependencies.arch ?? process.arch,
    uid: dependencies.uid ?? (typeof process.getuid === 'function' ? process.getuid() : undefined),
    env: dependencies.env ?? process.env,
  })
  if (provisionResult?.status !== undefined && provisionResult.status !== 'passed') fail('native host provision did not pass')
  if (provisionResult?.receipt !== undefined && (!object(provisionResult.receipt) || provisionResult.receipt.status !== 'passed')) fail('native host provision did not pass')
  if (provisionResult?.receiptPath !== undefined && provisionResult.receiptPath !== options.provisionReceipt) fail('native host provision receipt path did not match')
  const provisionSnapshot = readImmutableReceiptSnapshot(fsApi, options.provisionReceipt, 'provision receipt', {
    uid: dependencies.uid ?? (typeof process.getuid === 'function' ? process.getuid() : undefined),
    platform: dependencies.platform ?? process.platform,
    strictPermissions: dependencies.strictReceiptPermissions,
  })
  const provisionFacts = parsePassedProvisionReceipt(provisionSnapshot.value)
  const proofOptions = {
    'source-sha': options.sourceSha,
    'tree-sha': options.treeSha,
    'run-number': options.runNumber,
    node: options.node,
    'node-sha256': options.nodeSha256,
    'run-root': options.runRoot,
    'proof-output': options.proofOutput,
    receipt: options.imageReceipt,
    'workspace-root': options.workspaceRoot,
    'deadline-minutes': String(options.deadlineMinutes),
    'allow-disposable-daemon-reset': true,
  }
  const proofResult = await proof(proofOptions)
  if (proofResult?.status !== undefined && proofResult.status !== 'passed') fail('local image proof did not pass')
  if (proofResult?.receipt !== undefined && proofResult.receipt !== options.imageReceipt) fail('local image proof did not pass')
  const imageSnapshot = readImmutableReceiptSnapshot(fsApi, options.imageReceipt, 'image receipt', {
    uid: dependencies.uid ?? (typeof process.getuid === 'function' ? process.getuid() : undefined),
    platform: dependencies.platform ?? process.platform,
    strictPermissions: dependencies.strictReceiptPermissions,
  })
  const parsedImage = parsePassedImageReceipt(imageSnapshot.value, options)
  recheckFreshPath(fsApi, options.sessionReceipt, 'session receipt', dependencies)
  const sessionReceipt = materializeReceipt(fsApi, options.sessionReceipt, {
    schemaVersion: 1,
    operation: 'local-native-session',
    status: 'passed',
    hostedEvidence: false,
    evidence: 'local-native-session',
    dataClass: 'synthetic',
    source: { sourceSha: options.sourceSha, treeSha: options.treeSha },
    runner: options.nodeIdentity,
    engine: parsedImage.docker,
    provision: { status: 'passed', receiptSha256: provisionSnapshot.sha256, contract: provisionFacts.contract, marker: provisionFacts.marker, host: provisionFacts.host, units: provisionFacts.units, socket: provisionFacts.socket, roots: provisionFacts.roots, inventory: provisionFacts.inventory },
    image: { status: 'passed', hostedEvidence: false, receiptSha256: imageSnapshot.sha256, phases: parsedImage.phases },
    cleanup: { postflightClean: parsedImage.postflight.clean, workspace: parsedImage.cleanup },
    recovery: { dockerDaemonReset: true, firewall: parsedImage.firewall, verifiedHost: parsedImage.verifiedHost },
  })
  return Object.freeze({ receipt: sessionReceipt, provision: provisionResult, proof: proofResult })
}

function usage() {
  return 'Usage: node scripts/onprem-native-session-proof.mjs --confirm-disposable-native-host --allow-disposable-daemon-reset --source-sha SHA1 --tree-sha SHA1 --run-number N --node ABS --node-sha256 SHA256 --run-root ABS --proof-output ABS --provision-receipt ABS --image-receipt ABS --session-receipt ABS [--deadline-minutes 1-60] [--workspace-root ABS]'
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  try {
    await runNativeSession(parseSessionArguments(process.argv.slice(2)))
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : 'native session proof failed'}\n${usage()}\n`)
    process.exitCode = 1
  }
}
