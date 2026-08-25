import fs from 'node:fs'
import { spawnSync } from 'node:child_process'
import { posix as path } from 'node:path'

import {
  expectedNativeDockerHostMarker,
  hostContract,
  inspectDedicatedNativeDockerHost,
  isExactDockerDataSelfBind,
  validateCanonicalDestructiveTarget,
} from './onprem-native-docker-host.mjs'

/*
 * This is deliberately a small, explicit provisioner for one disposable
 * Ubuntu host.  It is not a hosted-runner proof and it never discovers a
 * Docker endpoint from the caller's environment.
 */
export const PROVISIONER_CONTRACT = 'native-docker-host-provision-v1'
export const SAFE_ENVIRONMENT = Object.freeze({
  LANG: 'C',
  LC_ALL: 'C',
  PATH: '/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin',
})
export const SAFE_BINARIES = Object.freeze({
  cat: '/usr/bin/cat',
  chmod: '/usr/bin/chmod',
  chown: '/usr/bin/chown',
  containerd: '/usr/bin/containerd',
  docker: '/usr/bin/docker',
  dockerd: '/usr/bin/dockerd',
  find: '/usr/bin/find',
  findmnt: '/usr/bin/findmnt',
  id: '/usr/bin/id',
  install: '/usr/bin/install',
  kill: '/usr/bin/kill',
  mkdir: '/usr/bin/mkdir',
  ps: '/usr/bin/ps',
  readlink: '/usr/bin/readlink',
  rm: '/usr/bin/rm',
  sleep: '/usr/bin/sleep',
  stat: '/usr/bin/stat',
  sudo: '/usr/bin/sudo',
  systemctl: '/usr/bin/systemctl',
  tee: '/usr/bin/tee',
  test: '/usr/bin/test',
  umount: '/usr/bin/umount',
  uname: '/usr/bin/uname',
  true: '/usr/bin/true',
})
const ROOT = '/var/lib/hr-axis-onprem-rehearsal'
export const PROVISION_STAGING_DIRECTORY = `${ROOT}/.native-docker-host-provisioning`
const SYSTEMD_DIRECTORY = '/etc/systemd/system'
const RECEIPT_SCHEMA = 'hr-axis-onprem-native-docker-host-provision-v1'
const RECEIPT_VERSION = 1
const DOCKER_UNITS = Object.freeze(['docker.service', 'docker.socket'])
const PROTECTED_CONTAINERD_UNIT = 'containerd.service'
const UNIT_PATHS = Object.freeze({
  containerd: `${SYSTEMD_DIRECTORY}/${hostContract.containerdUnit}`,
  dockerd: `${SYSTEMD_DIRECTORY}/${hostContract.dockerdUnit}`,
})
const STAGING_FILES = Object.freeze({
  marker: `${PROVISION_STAGING_DIRECTORY}/marker.json`,
  containerd: `${PROVISION_STAGING_DIRECTORY}/${hostContract.containerdUnit}`,
  dockerd: `${PROVISION_STAGING_DIRECTORY}/${hostContract.dockerdUnit}`,
})
const REQUIRED_ROOTS = Object.freeze([
  ['dockerDataRoot', hostContract.dockerDataRoot],
  ['dockerExecRoot', hostContract.dockerExecRoot],
  ['containerdRoot', hostContract.containerdRoot],
  ['containerdState', hostContract.containerdState],
])
const LEGACY_COMMON_FLAGS = Object.freeze({
  '--host': `unix://${hostContract.socket}`,
  '--data-root': hostContract.dockerDataRoot,
  '--exec-root': hostContract.dockerExecRoot,
  '--pidfile': hostContract.dockerPidfile,
  '--iptables': 'true',
  '--ip6tables': 'true',
})
// These are the only two old manual launch shapes that may be stopped.  The
// first is the observed historical command (dockerd selected its normal
// containerd socket); the second is the reviewed private-containerd variant.
const LEGACY_SHAPES = Object.freeze([
  LEGACY_COMMON_FLAGS,
  Object.freeze({ ...LEGACY_COMMON_FLAGS, '--containerd': hostContract.containerdSocket }),
  // Exact observed historical launch: the old runtime used a sibling
  // pidfile under /var/run rather than the newer nested pidfile path.
  Object.freeze({ ...LEGACY_COMMON_FLAGS, '--pidfile': '/var/run/hr-axis-onprem-rehearsal-docker.pid' }),
])
const MOUNT_FAILURE_CLASSIFICATIONS = Object.freeze([
  'target-not-fixed',
  'duplicate-direct-mount',
  'descendant-mount',
  'bind-source-notation-mismatch',
  'filesystem-type-mismatch',
  'overlay-filesystem',
  'fsroot-mismatch',
  'mount-state-unreadable',
  'unmount-failed',
  'self-bind-remains-mounted',
])
const POST_START_READINESS_CAP_MS = 5_000
const POST_START_READINESS_MAX_ATTEMPTS = 32
const POST_START_READINESS_INITIAL_DELAY_MS = 25
const POST_START_READINESS_MAX_DELAY_MS = 250
const POST_START_READINESS_CODE = 'NATIVE_DOCKER_POST_START_NOT_READY'
const POST_START_READINESS_DEADLINE_CODE = 'NATIVE_DOCKER_POST_START_READINESS_DEADLINE'
class PostStartReadinessDeadlineError extends Error {
  constructor() {
    super('native Docker host post-start readiness was not proved before deadline')
    this.code = POST_START_READINESS_DEADLINE_CODE
  }
}

function fail(message) {
  throw new Error(message)
}
function failMount(classification, message) {
  const error = new Error(message)
  error.mountClassification = MOUNT_FAILURE_CLASSIFICATIONS.includes(classification) ? classification : 'mount-state-unreadable'
  throw error
}
function object(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}
function resultOf(result) {
  if (!result || typeof result !== 'object') return { status: -1, stdout: '', stderr: '' }
  return {
    status: Number.isInteger(result.status) ? result.status : -1,
    stdout: typeof result.stdout === 'string' ? result.stdout : '',
    stderr: typeof result.stderr === 'string' ? result.stderr : '',
  }
}
function approved(file) {
  const executable = SAFE_BINARIES[file]
  if (!executable) fail(`unapproved executable: ${file}`)
  return executable
}
export function defaultCommandRunner(file, args, options = {}) {
  const executable = SAFE_BINARIES[file]
  if (!executable || !Array.isArray(args) || args.some((arg) => typeof arg !== 'string')) {
    return { status: -1, stdout: '', stderr: '' }
  }
  const child = spawnSync(executable, args, {
    encoding: 'utf8',
    env: { ...SAFE_ENVIRONMENT },
    input: options.input,
    timeout: options.timeout ?? 120_000,
    windowsHide: true,
    shell: false,
  })
  return resultOf(child)
}

function command(commandRunner, file, args, options = {}, label = file) {
  let result
  try {
    result = resultOf(commandRunner(file, args, options))
  } catch {
    fail(`${label} command failed`)
  }
  return result
}
function requireCommand(commandRunner, file, args, options = {}, label = file, accepted = [0]) {
  const result = command(commandRunner, file, args, options, label)
  if (!accepted.includes(result.status)) fail(`${label} command failed`)
  return result
}
function privileged(commandRunner, file, args, options = {}, label = file, accepted = [0]) {
  return requireCommand(commandRunner, 'sudo', ['-n', approved(file), ...args], options, label, accepted)
}
function parseKeyValueFile(text) {
  const values = {}
  for (const line of String(text).split(/\r?\n/)) {
    const match = line.match(/^([A-Z][A-Z0-9_]*)=(.*)$/)
    if (!match) continue
    let value = match[2]
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1).replaceAll('\\"', '"')
    values[match[1]] = value
  }
  return values
}
export function parseUbuntuRelease(text) {
  const values = parseKeyValueFile(text)
  return {
    id: values.ID ?? '',
    versionId: values.VERSION_ID ?? '',
    prettyName: values.PRETTY_NAME ?? '',
  }
}
function readIdentity(commandRunner, fsApi, options) {
  const platform = options.platform ?? process.platform
  const arch = options.arch ?? process.arch
  const uid = Number.isSafeInteger(options.uid)
    ? options.uid
    : (typeof process.getuid === 'function' ? process.getuid() : undefined)
  if (platform !== 'linux') fail('provisioner requires Linux')
  if (uid === undefined || uid === 0) fail('provisioner requires a non-root caller')

  const uname = options.uname ?? requireCommand(commandRunner, 'uname', ['-s'], {}, 'kernel identity').stdout.trim()
  if (uname !== 'Linux') fail('provisioner requires a Linux kernel')
  const releaseText = options.osRelease ?? requireCommand(commandRunner, 'cat', ['/etc/os-release'], {}, 'Ubuntu release identity').stdout
  const release = typeof releaseText === 'string' ? parseUbuntuRelease(releaseText) : releaseText
  if (release.id !== 'ubuntu' || release.versionId !== '24.04') fail('provisioner requires Ubuntu 24.04')
  const gid = Number.isSafeInteger(options.callerGid)
    ? options.callerGid
    : Number(requireCommand(commandRunner, 'id', ['-g'], {}, 'caller primary group').stdout.trim())
  if (!Number.isSafeInteger(gid) || gid < 0) fail('caller primary group is invalid')
  // Keep the fs dependency in the identity path so injection-driven tests can
  // explicitly prove that no host-specific raw output is needed here.
  if (!fsApi || typeof fsApi.lstatSync !== 'function') fail('filesystem adapter is invalid')
  return Object.freeze({ platform: 'linux', arch, uid, gid, release })
}
function assertDockerEnvironment(env) {
  const source = env ?? {}
  for (const key of ['DOCKER_HOST', 'DOCKER_CONTEXT', 'DOCKER_CONFIG']) {
    if (Object.prototype.hasOwnProperty.call(source, key)) fail(`${key} override is not allowed`)
  }
}
function assertFreshReceiptPath(fsApi, receiptPath) {
  if (typeof receiptPath !== 'string' || !path.isAbsolute(receiptPath) || path.normalize(receiptPath) !== receiptPath || receiptPath === path.parse(receiptPath).root) {
    fail('receipt path must be a fresh absolute path')
  }
  if (receiptPath === ROOT || receiptPath.startsWith(`${ROOT}/`) || receiptPath === SYSTEMD_DIRECTORY || receiptPath.startsWith(`${SYSTEMD_DIRECTORY}/`)) {
    fail('receipt path must be external to the native host contract')
  }
  try {
    const existing = fsApi.lstatSync(receiptPath)
    if (existing) fail('receipt path must be fresh')
  } catch (error) {
    if (error?.message === 'receipt path must be fresh') throw error
  }
  let cursor = path.dirname(receiptPath)
  while (true) {
    let stats
    try { stats = fsApi.lstatSync(cursor) } catch { stats = null }
    if (stats) {
      if (stats.isSymbolicLink?.() || stats.isSymbolicLink === true) fail('receipt path has a symlink ancestor')
      break
    }
    const parent = path.dirname(cursor)
    if (parent === cursor) break
    cursor = parent
  }
}
function unitState(commandRunner, unit) {
  const active = command(commandRunner, 'sudo', ['-n', approved('systemctl'), 'is-active', '--quiet', unit], {}, `systemd ${unit} active state`)
  const enabled = command(commandRunner, 'sudo', ['-n', approved('systemctl'), 'is-enabled', '--quiet', unit], {}, `systemd ${unit} enabled state`)
  if (![0, 1, 3, 4].includes(active.status) || ![0, 1, 3, 4].includes(enabled.status)) fail(`systemd ${unit} state cannot be proved`)
  return Object.freeze({ active: active.status === 0, inactive: active.status === 3, enabled: enabled.status === 0, disabled: enabled.status === 1 })
}
function captureUnitStates(commandRunner) {
  const units = [...DOCKER_UNITS, PROTECTED_CONTAINERD_UNIT, hostContract.containerdUnit, hostContract.dockerdUnit]
  return Object.fromEntries(units.map((unit) => [unit, unitState(commandRunner, unit)]))
}

function stopAndDisableDockerUnits(commandRunner) {
  for (const unit of DOCKER_UNITS) {
    privileged(commandRunner, 'systemctl', ['stop', unit], {}, `stop ${unit}`, [0, 1, 3, 4])
    privileged(commandRunner, 'systemctl', ['disable', unit], {}, `disable ${unit}`, [0, 1, 3, 4])
  }
  const finalStates = Object.fromEntries(DOCKER_UNITS.map((unit) => [unit, unitState(commandRunner, unit)]))
  for (const unit of DOCKER_UNITS) {
    const state = finalStates[unit]
    if (!state.inactive || state.enabled || !state.disabled) {
      const error = new Error(`default Docker unit remains active or enabled: ${unit}`)
      error.defaultUnits = finalStates
      throw error
    }
  }
  return finalStates
}

function commandTokens(line) {
  return String(line).match(/(?:(?:"(?:[^"\\]|\\.)*")|(?:'(?:[^'\\]|\\.)*')|[^\s])+/g)?.map((token) => token.replace(/^['"]|['"]$/g, '')) ?? []
}

function normalizeLegacyPath(value) {
  if (value.startsWith('/var/run/')) return `/run/${value.slice('/var/run/'.length)}`
  return value
}

function normalizeLegacyFlag(name, value) {
  if (name === '--host') {
    const socket = value.replace(/^unix:\/\//, '')
    return `unix://${normalizeLegacyPath(socket)}`
  }
  if (name === '--exec-root' || name === '--pidfile' || name === '--containerd') return normalizeLegacyPath(value)
  return value
}

export function exactLegacyDockerdCommand(line) {
  const tokens = commandTokens(line)
  if (tokens.length === 0 || path.basename(tokens[0]) !== 'dockerd') return false
  return LEGACY_SHAPES.some((shape) => {
    if (tokens.length !== 1 + Object.keys(shape).length) return false
    for (const [name, expectedValue] of Object.entries(shape)) {
      const token = tokens.find((candidate) => candidate.startsWith(`${name}=`))
      if (!token || tokens.filter((candidate) => candidate.startsWith(`${name}=`)).length !== 1) return false
      const actual = normalizeLegacyFlag(name, token.slice(name.length + 1))
      if (actual !== normalizeLegacyFlag(name, expectedValue)) return false
    }
    return true
  })
}

function listDockerd(commandRunner) {
  const result = privileged(commandRunner, 'ps', ['-ww', '-e', '-o', 'pid=,args='], {}, 'dockerd process inventory')
  const entries = []
  for (const line of result.stdout.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed) continue
    const match = trimmed.match(/^(\d+)\s+(.+)$/)
    if (!match) {
      if (commandTokens(trimmed).some((token) => path.basename(token) === 'dockerd')) fail('dockerd process inventory is invalid')
      continue
    }
    const pid = Number(match[1])
    const argv = match[2].trim()
    const isDockerd = commandTokens(argv).some((token) => path.basename(token) === 'dockerd')
    // Validate PID safety only for rows that are actually dockerd
    // candidates.  Ordinary system rows (including PID 1) are irrelevant.
    if (!isDockerd) continue
    if (!Number.isSafeInteger(pid) || pid <= 1) fail('dockerd process inventory is invalid')
    entries.push({ pid, argv })
  }
  return entries
}

function processStartTime(commandRunner, pid) {
  const result = privileged(commandRunner, 'cat', [`/proc/${pid}/stat`], {}, 'legacy dockerd start identity')
  const close = result.stdout.lastIndexOf(')')
  const fields = close >= 0 ? result.stdout.slice(close + 1).trim().split(/\s+/) : []
  const startTime = Number(fields[19])
  if (!Number.isSafeInteger(startTime) || startTime <= 0) fail('legacy dockerd start identity is invalid')
  return startTime
}

function verifyLegacyEntry(commandRunner, entry) {
  const executable = privileged(commandRunner, 'readlink', ['-e', `/proc/${entry.pid}/exe`], {}, 'legacy dockerd executable identity').stdout.trim()
  if (executable !== SAFE_BINARIES.dockerd || !exactLegacyDockerdCommand(entry.argv)) return null
  const startTime = processStartTime(commandRunner, entry.pid)
  const confirmed = privileged(commandRunner, 'ps', ['-ww', '-p', String(entry.pid), '-o', 'args='], {}, 'legacy dockerd command identity').stdout.trim().split(/\r?\n/, 1)[0].trim()
  if (!exactLegacyDockerdCommand(confirmed)) return null
  const secondStartTime = processStartTime(commandRunner, entry.pid)
  if (secondStartTime !== startTime) return null
  return Object.freeze({ pid: entry.pid, startTime, argv: confirmed, executable })
}

export function detectLegacyDockerd(commandRunner = defaultCommandRunner) {
  const candidates = listDockerd(commandRunner)
  const verified = []
  for (const candidate of candidates) {
    const entry = verifyLegacyEntry(commandRunner, candidate)
    if (!entry) fail('unknown or ambiguous dockerd process')
    verified.push(entry)
  }
  if (verified.length > 1) fail('multiple legacy dockerd processes are ambiguous')
  return verified[0] ?? null
}

function waitForGone(commandRunner, pid, attempts = 20) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const result = command(commandRunner, 'sudo', ['-n', approved('kill'), '-0', String(pid)], {}, 'legacy dockerd stop verification')
    if (result.status === 1) return true
    if (result.status !== 0) fail('legacy dockerd stop state cannot be proved')
    command(commandRunner, 'sleep', ['0.05'], {}, 'legacy dockerd stop wait')
  }
  fail('verified legacy dockerd did not stop')
}

function stopLegacyDockerd(commandRunner, legacy) {
  if (!legacy) return false
  const startTime = processStartTime(commandRunner, legacy.pid)
  if (startTime !== legacy.startTime) fail('legacy dockerd changed before stop')
  const argv = privileged(commandRunner, 'ps', ['-ww', '-p', String(legacy.pid), '-o', 'args='], {}, 'legacy dockerd command identity').stdout.trim().split(/\r?\n/, 1)[0].trim()
  if (!exactLegacyDockerdCommand(argv)) fail('legacy dockerd changed before stop')
  privileged(commandRunner, 'kill', ['-TERM', String(legacy.pid)], {}, 'stop verified legacy dockerd')
  waitForGone(commandRunner, legacy.pid)
  return true
}

function parseFindmnt(text) {
  let parsed
  try { parsed = JSON.parse(text) } catch { fail('mount state cannot be proved') }
  const mounts = []
  const visit = (value) => {
    if (Array.isArray(value)) return value.forEach(visit)
    if (!object(value)) return
    if (typeof value.target === 'string') mounts.push({
      target: value.target,
      source: value.source ?? '',
      fstype: value.fstype ?? value['fs-type'] ?? '',
      fsroot: value.fsroot ?? value['fs-root'] ?? '',
    })
    Object.values(value).forEach((child) => { if (child && typeof child === 'object') visit(child) })
  }
  visit(parsed)
  return mounts
}

function findMounts(commandRunner, target, submounts = false) {
  const args = ['--json', '--output', 'TARGET,SOURCE,FSTYPE,FSROOT']
  if (submounts) args.push('--submounts')
  if (submounts && target === '/') args.push('/')
  else args.push('--mountpoint', target)
  const result = command(commandRunner, 'sudo', ['-n', approved('findmnt'), ...args], {}, 'mount state')
  if (result.status === 1 && !result.stdout.trim()) return []
  if (result.status !== 0 || result.stderr.trim()) fail('mount state cannot be proved')
  return parseFindmnt(result.stdout)
}

function mountIdentity(commandRunner, target) {
  const mounts = findMounts(commandRunner, target, true)
  return mounts.find((mount) => mount.target === target) ?? null
}

function sameMountFields(left, right) {
  return ['target', 'source', 'fstype', 'fsroot'].every((field) => left?.[field] === right?.[field])
}

function requirePostUnmountClear(commandRunner, target) {
  let targetView
  let tree
  try {
    targetView = mountIdentity(commandRunner, target)
    tree = findMounts(commandRunner, '/', true)
  } catch (error) {
    if (MOUNT_FAILURE_CLASSIFICATIONS.includes(error?.mountClassification)) throw error
    failMount('mount-state-unreadable', 'fixed target mount state cannot be proved after unmount')
  }
  const directMatches = tree.filter((mount) => mount.target === target)
  const descendants = tree.filter((mount) => mount.target !== target && mount.target.startsWith(`${target}/`))
  if (!targetView && directMatches.length !== 0) failMount('mount-state-unreadable', 'fixed target mount state cannot be proved after unmount')
  if (targetView && (directMatches.length !== 1 || !sameMountFields(targetView, directMatches[0]))) {
    failMount('mount-state-unreadable', 'fixed target mount state cannot be proved after unmount')
  }
  if (descendants.length > 0) {
    failMount('descendant-mount', 'fixed target has an unapproved nested mount after unmount')
  }
  if (targetView) failMount('self-bind-remains-mounted', 'fixed target self-bind remains mounted')
  return true
}

export function proveAndUnmountDirectSelfBind(commandRunner, target = hostContract.dockerDataRoot) {
  if (target !== hostContract.dockerDataRoot) failMount('target-not-fixed', 'mount target is not the fixed Docker data root')
  let targetMount
  let all
  try {
    targetMount = mountIdentity(commandRunner, target)
    all = findMounts(commandRunner, '/', true)
  } catch (error) {
    if (MOUNT_FAILURE_CLASSIFICATIONS.includes(error?.mountClassification)) throw error
    failMount('mount-state-unreadable', 'fixed target mount state cannot be proved')
  }
  const directMatches = all.filter((mount) => mount.target === target)
  const direct = directMatches[0] ?? targetMount
  const descendants = all.filter((mount) => mount.target === target || mount.target.startsWith(`${target}/`))
  const targetAndTreeDisagree = (targetMount && directMatches.length === 0) || (!targetMount && directMatches.length > 0) || (targetMount && directMatches.length > 0 && ['target', 'source', 'fstype', 'fsroot'].some((field) => targetMount[field] !== directMatches[0][field]))
  if (targetAndTreeDisagree) failMount('mount-state-unreadable', 'fixed target mount state cannot be proved consistently')
  if (directMatches.length > 1) failMount('duplicate-direct-mount', 'fixed target has duplicate direct mounts')
  if (!direct) {
    if (descendants.length > 0) failMount('descendant-mount', 'fixed target has an unapproved nested mount')
    return false
  }
  if (directMatches.length !== 1 || descendants.some((mount) => mount.target !== target)) failMount('descendant-mount', 'fixed target has an unapproved nested mount')
  const root = all.find((mount) => mount.target === '/')
  if (direct.fsroot !== target || root?.fsroot !== '/') failMount('fsroot-mismatch', 'fixed target mount is not the exact direct self-bind')
  if (root?.fstype?.toLowerCase?.().includes('overlay') || direct.fstype?.toLowerCase?.().includes('overlay')) failMount('overlay-filesystem', 'fixed target mount is not the exact direct self-bind')
  if (root?.fstype !== 'ext4' || direct.fstype !== root?.fstype) failMount('filesystem-type-mismatch', 'fixed target mount is not the exact direct self-bind')
  if (!isExactDockerDataSelfBind(root, direct)) failMount('bind-source-notation-mismatch', 'fixed target mount is not the exact direct self-bind')
  try {
    privileged(commandRunner, 'umount', ['--', target], {}, 'unmount direct self-bind')
  } catch (error) {
    if (MOUNT_FAILURE_CLASSIFICATIONS.includes(error?.mountClassification)) throw error
    failMount('unmount-failed', 'fixed target self-bind unmount failed')
  }
  return requirePostUnmountClear(commandRunner, target)
}

function fixedUnit(kind) {
  if (kind === 'containerd') return `[Unit]\nDescription=HR Axis disposable private containerd\nAfter=network.target\n\n[Service]\nType=simple\nExecStart=/usr/bin/containerd --root=${hostContract.containerdRoot} --state=${hostContract.containerdState} --address=${hostContract.containerdSocket}\nKillMode=control-group\nDelegate=yes\nRuntimeDirectory=hr-axis-onprem-rehearsal-containerd\nRuntimeDirectoryMode=0700\nRuntimeDirectoryPreserve=yes\nRestart=no\n\n[Install]\nWantedBy=multi-user.target\n`
  if (kind === 'dockerd') return `[Unit]\nDescription=HR Axis disposable native dockerd\nRequires=${hostContract.containerdUnit}\nAfter=${hostContract.containerdUnit}\n\n[Service]\nType=simple\nExecStart=/usr/bin/dockerd --host=unix://${hostContract.socket} --data-root=${hostContract.dockerDataRoot} --exec-root=${hostContract.dockerExecRoot} --pidfile=${hostContract.dockerPidfile} --containerd=${hostContract.containerdSocket} --iptables=true --ip6tables=true\nKillMode=control-group\nDelegate=yes\nRuntimeDirectory=hr-axis-onprem-rehearsal-docker\nRuntimeDirectoryPreserve=yes\nRestart=no\n\n[Install]\nWantedBy=multi-user.target\n`
  fail('unknown native unit')
}

export function expectedNativeDockerUnit(kind) {
  return fixedUnit(kind)
}

function ensureParentDirectory(commandRunner, target, owner, group, mode, label) {
  privileged(commandRunner, 'install', ['-d', '-o', owner, '-g', group, '-m', mode, '--', target], {}, label)
}

function validateProvisionStagingDirectory(commandRunner) {
  privileged(commandRunner, 'test', ['!', '-L', PROVISION_STAGING_DIRECTORY], {}, 'native host staging symlink check')
  const stat = privileged(commandRunner, 'stat', ['-Lc', '%F %u %g %a', PROVISION_STAGING_DIRECTORY], {}, 'native host staging identity').stdout.trim()
  if (!/^directory\s+0\s+0\s+700$/i.test(stat)) fail('native host staging directory ownership or mode is unsafe')
}

function cleanProvisionStaging(commandRunner) {
  for (const pathname of Object.values(STAGING_FILES)) {
    privileged(commandRunner, 'rm', ['--force', '--', pathname], {}, 'clean native host staging file')
  }
  const allowed = new Set(Object.values(STAGING_FILES).map((pathname) => path.basename(pathname)))
  const findArgs = ['--', PROVISION_STAGING_DIRECTORY, '-mindepth', '1', '-maxdepth', '1']
  for (const name of allowed) findArgs.push('!', '-name', name)
  findArgs.push('-print')
  const unknown = privileged(commandRunner, 'find', findArgs, {}, 'native host staging inventory')
  if (unknown.stdout.trim()) fail('native host staging directory contains unexpected entries')
}

function validateProvisionStagingFile(commandRunner, pathname, label) {
  privileged(commandRunner, 'test', ['!', '-L', pathname], {}, `${label} symlink check`)
  const stat = privileged(commandRunner, 'stat', ['-Lc', '%F %u %g %a', pathname], {}, `${label} identity`).stdout.trim()
  if (!/^regular file\s+0\s+0\s+600$/i.test(stat)) fail(`${label} ownership or mode is unsafe`)
}

function stageTextFile(commandRunner, stagePath, destination, text, label) {
  if (!Object.values(STAGING_FILES).includes(stagePath)) fail('native host staging path is not fixed')
  try {
    privileged(commandRunner, 'tee', ['--', stagePath], { input: text }, `stage ${label}`)
    privileged(commandRunner, 'chmod', ['0600', '--', stagePath], `protect ${label} staging file`)
    privileged(commandRunner, 'chown', ['root:root', '--', stagePath], `own ${label} staging file`)
    validateProvisionStagingFile(commandRunner, stagePath, `${label} staging file`)
    privileged(commandRunner, 'install', ['-o', 'root', '-g', 'root', '-m', '0644', '--', stagePath, destination], {}, label)
  } finally {
    privileged(commandRunner, 'rm', ['--force', '--', stagePath], {}, `clean ${label} staging file`)
  }
}

function validateRoots(fsApi, platform, commandRunner) {
  for (const [kind, target] of REQUIRED_ROOTS) {
    validateCanonicalDestructiveTarget(target, kind, { fsApi, platform, commandRunner })
  }
}

function optionalLstat(fsApi, target, label) {
  try {
    return fsApi.lstatSync(target)
  } catch (error) {
    if (error?.code === 'ENOENT') return null
    fail(`${label} state cannot be proved`)
  }
}

function validateExistingDirectoryChain(fsApi, target, platform, label) {
  let cursor = target
  while (true) {
    const stats = optionalLstat(fsApi, cursor, label)
    if (!stats) fail(`${label} ancestor is missing`)
    if (!(stats.isDirectory?.() || stats.isDirectory === true) || stats.isSymbolicLink?.() || stats.isSymbolicLink === true) {
      fail(`${label} ancestor must be a non-symlink directory`)
    }
    if (platform === 'linux') {
      if (stats.uid !== 0 || stats.gid !== 0) fail(`${label} ancestor must be root-owned`)
      if (!Number.isInteger(stats.mode) || (stats.mode & 0o022) !== 0) fail(`${label} ancestor must not be group/world writable`)
    }
    let resolved
    try { resolved = fsApi.realpathSync(cursor) } catch { fail(`${label} ancestor cannot be canonicalized`) }
    if (resolved !== cursor) fail(`${label} ancestor is not canonical`)
    if (cursor === path.parse(cursor).root) break
    cursor = path.dirname(cursor)
  }
}

function missingFixedPathSegments(fsApi, target, platform, label) {
  const missing = []
  let cursor = target
  while (true) {
    const stats = optionalLstat(fsApi, cursor, label)
    if (stats) {
      validateExistingDirectoryChain(fsApi, cursor, platform, label)
      return missing.reverse()
    }
    missing.push(cursor)
    const parent = path.dirname(cursor)
    if (parent === cursor) fail(`${label} has no safe existing ancestor`)
    cursor = parent
  }
}

function ensureFixedRootPresent(commandRunner, fsApi, platform, kind, target) {
  const label = `${kind} target`
  const existing = optionalLstat(fsApi, target, label)
  if (existing) {
    validateCanonicalDestructiveTarget(target, kind, { fsApi, platform, commandRunner })
    return
  }
  const missing = missingFixedPathSegments(fsApi, target, platform, label)
  for (const pathname of missing) {
    const parent = path.dirname(pathname)
    validateExistingDirectoryChain(fsApi, parent, platform, label)
    privileged(commandRunner, 'install', ['-d', '-o', 'root', '-g', 'root', '-m', '0700', '--', pathname], {}, `create ${kind} path`)
    validateExistingDirectoryChain(fsApi, pathname, platform, label)
  }
  validateCanonicalDestructiveTarget(target, kind, { fsApi, platform, commandRunner })
}

function cleanRoots(commandRunner, fsApi, platform) {
  // Materialize only absent fixed roots after validating their nearest
  // existing ancestor.  No recursive removal is possible until every target
  // (existing or newly created) has passed the canonical/mount checks.
  for (const [kind, target] of REQUIRED_ROOTS) ensureFixedRootPresent(commandRunner, fsApi, platform, kind, target)
  validateRoots(fsApi, platform, commandRunner)
  for (const [kind, target] of REQUIRED_ROOTS) {
    validateCanonicalDestructiveTarget(target, kind, { fsApi, platform, commandRunner })
    privileged(commandRunner, 'rm', ['--recursive', '--force', '--', target], {}, `clean ${kind}`)
    privileged(commandRunner, 'install', ['-d', '-o', 'root', '-g', 'root', '-m', '0700', '--', target], {}, `recreate ${kind}`)
  }
}

function prepareContractDirectories(commandRunner, callerGid) {
  ensureParentDirectory(commandRunner, ROOT, 'root', 'root', '0755', 'prepare native host parent')
  ensureParentDirectory(commandRunner, hostContract.lockDirectory, 'root', String(callerGid), '01770', 'prepare native host lock directory')
}

function prepareProvisionStaging(commandRunner) {
  const symlink = command(commandRunner, 'sudo', ['-n', approved('test'), '-L', PROVISION_STAGING_DIRECTORY], {}, 'native host staging symlink preflight')
  if (symlink.status === 0) fail('native host staging directory must not be a symlink')
  if (symlink.status !== 1) fail('native host staging symlink state cannot be proved')
  const exists = command(commandRunner, 'sudo', ['-n', approved('test'), '-e', PROVISION_STAGING_DIRECTORY], {}, 'native host staging existence')
  if (![0, 1].includes(exists.status)) fail('native host staging existence cannot be proved')
  if (exists.status === 0) validateProvisionStagingDirectory(commandRunner)
  ensureParentDirectory(commandRunner, PROVISION_STAGING_DIRECTORY, 'root', 'root', '0700', 'prepare native host staging directory')
  validateProvisionStagingDirectory(commandRunner)
  cleanProvisionStaging(commandRunner)
}

function markerText() {
  return `${JSON.stringify(expectedNativeDockerHostMarker())}\n`
}

function rootIds(fsApi) {
  const ids = {}
  for (const [kind, target] of REQUIRED_ROOTS) {
    try {
      const stats = fsApi.lstatSync(target)
      ids[kind] = {
        device: Number.isSafeInteger(stats.dev) ? stats.dev : null,
        inode: Number.isSafeInteger(stats.ino) ? stats.ino : null,
      }
    } catch { ids[kind] = { device: null, inode: null } }
  }
  return ids
}

function socketId(fsApi) {
  try {
    const stats = fsApi.lstatSync(hostContract.socket)
    return { device: Number.isSafeInteger(stats.dev) ? stats.dev : null, inode: Number.isSafeInteger(stats.ino) ? stats.ino : null }
  } catch { return { device: null, inode: null } }
}

function dockerEngineIdentity(commandRunner) {
  const result = privileged(commandRunner, 'docker', ['--host', `unix://${hostContract.socket}`, 'info', '--format', '{{json .}}'], {}, 'Docker identity')
  let parsed
  try { parsed = JSON.parse(result.stdout) } catch { fail('Docker identity is invalid') }
  if (!object(parsed) || parsed.DockerRootDir !== hostContract.dockerDataRoot) fail('Docker root identity is not exact')
  const engineId = typeof parsed.ID === 'string' && /^[A-Za-z0-9:_-]{8,256}$/.test(parsed.ID) ? parsed.ID : null
  return { engineId, dockerRootDir: hostContract.dockerDataRoot }
}

function buildReceipt({ status, identity, initialUnits, finalUnits, actions, cleanup, inspect, fsApi, failureStage = null, failureClassification = null }) {
  const receipt = {
    schema: RECEIPT_SCHEMA,
    version: RECEIPT_VERSION,
    status,
    evidence: 'local-native-host-provisioning',
    contract: hostContract.version,
    marker: expectedNativeDockerHostMarker(),
    host: {
      platform: identity.platform,
      distribution: identity.release.id,
      version: identity.release.versionId,
      architecture: identity.arch,
      engineId: inspect?.engineId ?? null,
    },
    units: {
      containerd: hostContract.containerdUnit,
      dockerd: hostContract.dockerdUnit,
      defaults: {
        dockerService: finalUnits?.['docker.service'] ?? { active: false, inactive: false, enabled: false, disabled: false },
        dockerSocket: finalUnits?.['docker.socket'] ?? { active: false, inactive: false, enabled: false, disabled: false },
      },
      systemContainerd: initialUnits?.[PROTECTED_CONTAINERD_UNIT] ?? null,
      finalSystemContainerd: finalUnits?.[PROTECTED_CONTAINERD_UNIT] ?? null,
    },
    socket: { path: hostContract.socket, id: socketId(fsApi) },
    roots: {
      paths: Object.fromEntries(REQUIRED_ROOTS.map(([kind, target]) => [kind, target])),
      ids: rootIds(fsApi),
    },
    actions: {
      legacyDockerdStopped: actions.legacyDockerdStopped === true,
      directSelfBindUnmounted: actions.directSelfBindUnmounted === true,
    },
    cleanup: {
      rootsRecreated: cleanup.rootsRecreated === true,
      markerInstalled: cleanup.markerInstalled === true,
      unitsInstalled: cleanup.unitsInstalled === true,
      normalDockerDisabled: cleanup.normalDockerDisabled === true,
    },
    failureStage,
    failureClassification: MOUNT_FAILURE_CLASSIFICATIONS.includes(failureClassification) ? failureClassification : null,
  }
  if (status === 'passed') receipt.inspect = { passed: true, inventory: inspect?.inventory ?? null }
  return receipt
}

function writeReceipt(fsApi, receiptPath, value) {
  const body = `${JSON.stringify(value, null, 2)}\n`
  fsApi.writeFileSync(receiptPath, body, { encoding: 'utf8', flag: 'wx', mode: 0o600 })
  try { fsApi.chmodSync?.(receiptPath, 0o600) } catch { /* the fresh write is still authoritative */ }
}

function controllerRunner(commandRunner) {
  return (file, args, options = {}) => {
    if (file === 'sudo') return commandRunner(file, args, options)
    if (!SAFE_BINARIES[file]) return { status: -1, stdout: '', stderr: '' }
    return commandRunner('sudo', ['-n', SAFE_BINARIES[file], ...args], options)
  }
}

function postStartReadinessCommandRunner(commandRunner, readinessDeadlineAt) {
  return (file, args, options = {}) => {
    const remaining = readinessDeadlineAt - Date.now()
    if (!Number.isFinite(remaining) || remaining < 1) throw new PostStartReadinessDeadlineError()
    const inherited = Number.isFinite(options.timeout) && options.timeout > 0 ? options.timeout : Number.POSITIVE_INFINITY
    const timeout = Math.max(1, Math.min(Math.floor(remaining), inherited))
    let result
    try {
      result = commandRunner(file, args, { ...options, timeout })
    } catch (error) {
      if (error?.code === POST_START_READINESS_DEADLINE_CODE) throw error
      throw error
    }
    if (Date.now() >= readinessDeadlineAt) throw new PostStartReadinessDeadlineError()
    return result
  }
}

function inspectWithPostStartReadiness({ inspect, commandRunner, fsApi, platform, env }) {
  const readinessDeadlineAt = Date.now() + POST_START_READINESS_CAP_MS
  const boundedRunner = postStartReadinessCommandRunner(commandRunner, readinessDeadlineAt)
  const inspectionOptions = {
    commandRunner: controllerRunner(boundedRunner),
    fsApi,
    platform,
    env,
    allowStartupReadiness: true,
  }
  let delayMs = POST_START_READINESS_INITIAL_DELAY_MS
  for (let attempt = 0; attempt < POST_START_READINESS_MAX_ATTEMPTS; attempt += 1) {
    if (Date.now() >= readinessDeadlineAt) throw new PostStartReadinessDeadlineError()
    try {
      const inspection = inspect(inspectionOptions)
      if (Date.now() >= readinessDeadlineAt) throw new PostStartReadinessDeadlineError()
      return inspection
    } catch (error) {
      if (error?.code !== POST_START_READINESS_CODE) throw error
      const remaining = readinessDeadlineAt - Date.now()
      if (!Number.isFinite(remaining) || remaining < 1 || attempt === POST_START_READINESS_MAX_ATTEMPTS - 1) throw new PostStartReadinessDeadlineError()
      const delay = Math.min(delayMs, POST_START_READINESS_MAX_DELAY_MS, remaining)
      let slept
      try {
        slept = resultOf(boundedRunner('sleep', [String(delay / 1_000)]))
      } catch (sleepError) {
        if (sleepError?.code === POST_START_READINESS_DEADLINE_CODE) throw sleepError
        throw sleepError
      }
      if (slept.status !== 0 || slept.stdout !== '' || slept.stderr !== '') fail('post-start readiness backoff cannot be proved')
      delayMs = Math.min(delayMs * 2, POST_START_READINESS_MAX_DELAY_MS)
    }
  }
  throw new PostStartReadinessDeadlineError()
}

function assertInitialContainerdUnchanged(initial, final) {
  if (!initial || !final || JSON.stringify(initial[PROTECTED_CONTAINERD_UNIT]) !== JSON.stringify(final[PROTECTED_CONTAINERD_UNIT])) {
    fail('system containerd state changed')
  }
}

export function provisionNativeDockerHost(options = {}) {
  const commandRunner = options.commandRunner ?? defaultCommandRunner
  const fsApi = options.fsApi ?? fs
  const env = options.env ?? process.env
  const receiptPath = options.receiptPath ?? options.receipt
  const confirm = options.confirmDisposableNativeHost === true || options.confirm === true
  if (!confirm) fail('explicit disposable native host confirmation is required')
  assertDockerEnvironment(env)
  assertFreshReceiptPath(fsApi, receiptPath)

  let identity
  let initialUnits
  let finalUnitsForReceipt = null
  let stagingPrepared = false
  const actions = { legacyDockerdStopped: false, directSelfBindUnmounted: false }
  const cleanup = { rootsRecreated: false, markerInstalled: false, unitsInstalled: false, normalDockerDisabled: false }
  let stage = 'preflight'
  try {
    identity = readIdentity(commandRunner, fsApi, options)
    requireCommand(commandRunner, 'sudo', ['-n', approved('true')], {}, 'passwordless sudo check')
    initialUnits = captureUnitStates(commandRunner)
    stage = 'disable-default-docker'
    finalUnitsForReceipt = { ...(finalUnitsForReceipt ?? {}), ...stopAndDisableDockerUnits(commandRunner) }
    cleanup.normalDockerDisabled = true

    stage = 'legacy-dockerd'
    actions.legacyDockerdStopped = stopLegacyDockerd(commandRunner, detectLegacyDockerd(commandRunner))
    stage = 'mount-preflight'
    actions.directSelfBindUnmounted = proveAndUnmountDirectSelfBind(commandRunner)

    stage = 'clean-roots'
    cleanRoots(commandRunner, fsApi, identity.platform)
    cleanup.rootsRecreated = true
    stage = 'directories'
    prepareContractDirectories(commandRunner, identity.gid)
    prepareProvisionStaging(commandRunner)
    stagingPrepared = true

    stage = 'marker'
    stageTextFile(commandRunner, STAGING_FILES.marker, hostContract.marker, markerText(), 'native host marker')
    cleanup.markerInstalled = true
    stage = 'units'
    stageTextFile(commandRunner, STAGING_FILES.containerd, UNIT_PATHS.containerd, fixedUnit('containerd'), 'private containerd unit')
    stageTextFile(commandRunner, STAGING_FILES.dockerd, UNIT_PATHS.dockerd, fixedUnit('dockerd'), 'custom dockerd unit')
    cleanup.unitsInstalled = true

    stage = 'start-services'
    privileged(commandRunner, 'systemctl', ['daemon-reload'], {}, 'systemd daemon reload')
    privileged(commandRunner, 'systemctl', ['start', hostContract.containerdUnit], {}, 'start private containerd')
    privileged(commandRunner, 'systemctl', ['start', hostContract.dockerdUnit], {}, 'start custom dockerd')
    const finalUnitsBeforeInspect = captureUnitStates(commandRunner)
    finalUnitsForReceipt = finalUnitsBeforeInspect
    assertInitialContainerdUnchanged(initialUnits, finalUnitsBeforeInspect)
    if (finalUnitsBeforeInspect[hostContract.containerdUnit]?.active !== true || finalUnitsBeforeInspect[hostContract.dockerdUnit]?.active !== true) fail('custom native units are not active')
    if (DOCKER_UNITS.some((unit) => !finalUnitsBeforeInspect[unit]?.inactive || finalUnitsBeforeInspect[unit]?.enabled || !finalUnitsBeforeInspect[unit]?.disabled)) fail('default Docker unit remains active or enabled')

    stage = 'controller-inspect'
    const inspection = inspectWithPostStartReadiness({
      inspect: options.inspect ?? inspectDedicatedNativeDockerHost,
      commandRunner,
      fsApi,
      platform: identity.platform,
      env,
    })
    const engine = typeof options.engineIdentity === 'function'
      ? options.engineIdentity({ commandRunner, socket: hostContract.socket, dockerRootDir: hostContract.dockerDataRoot })
      : (options.engineIdentity ?? (options.inspect ? { engineId: null } : dockerEngineIdentity(commandRunner)))
    cleanProvisionStaging(commandRunner)
    const finalUnitsAfterInspect = captureUnitStates(commandRunner)
    finalUnitsForReceipt = finalUnitsAfterInspect
    assertInitialContainerdUnchanged(initialUnits, finalUnitsAfterInspect)
    if (DOCKER_UNITS.some((unit) => !finalUnitsAfterInspect[unit]?.inactive || finalUnitsAfterInspect[unit]?.enabled || !finalUnitsAfterInspect[unit]?.disabled)) fail('default Docker unit remains active or enabled')
    stage = 'receipt'
    const receipt = buildReceipt({ status: 'passed', identity, initialUnits, finalUnits: finalUnitsAfterInspect, actions, cleanup, inspect: { ...inspection, ...engine }, fsApi })
    writeReceipt(fsApi, receiptPath, receipt)
    return Object.freeze({ receiptPath, receipt, inspection })
  } catch (error) {
    if (stagingPrepared) {
      try { cleanProvisionStaging(commandRunner) } catch { /* preserve the original failure without exposing command output */ }
    }
    const failureClassification = stage === 'mount-preflight' && MOUNT_FAILURE_CLASSIFICATIONS.includes(error?.mountClassification)
      ? error.mountClassification
      : null
    const failure = buildReceipt({ status: 'failed', identity: identity ?? { platform: options.platform ?? process.platform, arch: options.arch ?? process.arch, release: { id: '', versionId: '' } }, initialUnits, finalUnits: finalUnitsForReceipt ?? error?.defaultUnits ?? null, actions, cleanup, inspect: null, fsApi, failureStage: stage, failureClassification })
    try { writeReceipt(fsApi, receiptPath, failure) } catch { /* receipt path may be unavailable; never expose command output */ }
    throw error
  }
}
export function parseProvisionArguments(argv) {
  const args = [...argv]
  let confirm = false
  let receiptPath = null
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]
    if (arg === '--confirm-disposable-native-host') { confirm = true; continue }
    if (arg === '--receipt') {
      receiptPath = args[++index]
      continue
    }
    if (arg.startsWith('--receipt=')) { receiptPath = arg.slice('--receipt='.length); continue }
    fail(`unknown provisioner argument: ${arg}`)
  }
  if (!confirm || !receiptPath) fail('usage: --confirm-disposable-native-host --receipt ABSOLUTE_PATH')
  return Object.freeze({ confirmDisposableNativeHost: true, receiptPath })
}

if (import.meta.url === `file://${process.argv[1]?.replaceAll('\\', '/')}`) {
  try {
    const options = parseProvisionArguments(process.argv.slice(2))
    provisionNativeDockerHost(options)
    process.stdout.write(`${JSON.stringify({ status: 'passed', receiptPath: options.receiptPath })}\n`)
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : 'provisioner failed'}\n`)
    process.exitCode = 2
  }
}
