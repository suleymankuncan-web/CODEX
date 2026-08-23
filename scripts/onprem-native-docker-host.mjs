import crypto from 'node:crypto'
import fs from 'node:fs'
import { spawnSync } from 'node:child_process'
import { posix as path } from 'node:path'

// This module deliberately has no provisioning path.  The disposable host is
// provisioned by a separately reviewed workflow; this controller only proves,
// locks, and resets the already-declared native daemon.
const CONTRACT_VERSION = 'native-docker-host-v1'
const markerSchema = 'hr-axis-onprem-rehearsal-native-docker-host-v1'
const SAFE_BINARIES = Object.freeze({
  cat: '/usr/bin/cat',
  containerd: '/usr/bin/containerd',
  docker: '/usr/bin/docker',
  dockerd: '/usr/bin/dockerd',
  find: '/usr/bin/find',
  findmnt: '/usr/bin/findmnt',
  id: '/usr/bin/id',
  install: '/usr/bin/install',
  kill: '/usr/bin/kill',
  readlink: '/usr/bin/readlink',
  rm: '/usr/bin/rm',
  ps: '/usr/bin/ps',
  sleep: '/usr/bin/sleep',
  ss: '/usr/bin/ss',
  stat: '/usr/bin/stat',
  sudo: '/usr/bin/sudo',
  systemctl: '/usr/bin/systemctl',
  test: '/usr/bin/test',
  umount: '/usr/bin/umount',
})
const SAFE_ENVIRONMENT = Object.freeze({
  LANG: 'C',
  LC_ALL: 'C',
  PATH: '/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin',
})

const fixedContract = {
  version: CONTRACT_VERSION,
  socket: '/var/run/docker.sock',
  dockerDataRoot: '/var/lib/hr-axis-onprem-rehearsal/docker',
  dockerExecRoot: '/run/hr-axis-onprem-rehearsal-docker',
  containerdRoot: '/var/lib/hr-axis-onprem-rehearsal/containerd',
  containerdState: '/run/hr-axis-onprem-rehearsal-containerd',
  containerdSocket: '/run/hr-axis-onprem-rehearsal-containerd/containerd.sock',
  dockerPidfile: '/run/hr-axis-onprem-rehearsal-docker/dockerd.pid',
  marker: '/var/lib/hr-axis-onprem-rehearsal/.native-docker-host-v1.json',
  lockDirectory: '/var/lib/hr-axis-onprem-rehearsal/locks',
  lockFile: '/var/lib/hr-axis-onprem-rehearsal/locks/native-docker-host-v1.lock',
  containerdUnit: 'hr-axis-onprem-rehearsal-containerd.service',
  dockerdUnit: 'hr-axis-onprem-rehearsal-dockerd.service',
}

function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value)
    Object.values(value).forEach(deepFreeze)
  }
  return value
}

export const hostContract = deepFreeze({ ...fixedContract })
export const HOST_CONTRACT = hostContract

const destructiveTargets = deepFreeze({
  dockerDataRoot: hostContract.dockerDataRoot,
  dockerExecRoot: hostContract.dockerExecRoot,
  containerdRoot: hostContract.containerdRoot,
  containerdState: hostContract.containerdState,
})

const markerValues = deepFreeze({
  schema: markerSchema,
  version: 1,
  socket: hostContract.socket,
  dockerDataRoot: hostContract.dockerDataRoot,
  dockerExecRoot: hostContract.dockerExecRoot,
  containerdRoot: hostContract.containerdRoot,
  containerdState: hostContract.containerdState,
  containerdSocket: hostContract.containerdSocket,
  dockerPidfile: hostContract.dockerPidfile,
  containerdUnit: hostContract.containerdUnit,
  dockerdUnit: hostContract.dockerdUnit,
})
const markerKeys = Object.freeze(Object.keys(markerValues))

export function expectedNativeDockerHostMarker() {
  return { ...markerValues }
}

function fail(message) {
  throw new Error(message)
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

function defaultCommandRunner(file, args, options = {}) {
  const executable = SAFE_BINARIES[file]
  if (!executable) return { status: -1, stdout: '', stderr: '' }
  const result = spawnSync(executable, args, {
    encoding: 'utf8',
    windowsHide: true,
    timeout: options.timeout ?? 120_000,
    env: { ...SAFE_ENVIRONMENT },
    input: options.input,
  })
  return resultOf(result)
}

function normalizeRecoveryDeadline(value) {
  if (value === undefined) return undefined
  if (!Number.isSafeInteger(value) || value <= 0) fail('native Docker host recovery deadline is invalid')
  return value
}

class RecoveryDeadlineError extends Error {
  constructor(phase) {
    super('native Docker host recovery deadline exceeded')
    this.code = 'NATIVE_DOCKER_RECOVERY_DEADLINE'
    this.phase = phase
  }
}

class QuiescenceDeadlineError extends Error {
  constructor() {
    super('post-stop runtime quiescence was not proved before deadline')
    this.code = 'NATIVE_DOCKER_QUIESCENCE_DEADLINE'
  }
}

function assertRecoveryDeadline(deadlineAt) {
  if (deadlineAt !== undefined && Date.now() >= deadlineAt) fail('native Docker host recovery deadline exceeded')
}

function deadlineCommandRunner(commandRunner, deadlineAt) {
  if (deadlineAt === undefined) return commandRunner
  return (file, args, options = {}) => {
    const remaining = deadlineAt - Date.now()
    if (!Number.isFinite(remaining) || remaining < 1) throw new RecoveryDeadlineError('before')
    const inherited = Number.isFinite(options.timeout) && options.timeout > 0 ? options.timeout : Number.POSITIVE_INFINITY
    const timeout = Math.max(1, Math.min(Math.floor(remaining), inherited))
    let result
    try {
      result = commandRunner(file, args, { ...options, timeout })
    } catch {
      return { status: -1, stdout: '', stderr: 'recovery command failed' }
    }
    // A dependency-injected runner may ignore timeout.  Treat a command that
    // returns at/after the absolute deadline as failed before any next action.
    if (Date.now() >= deadlineAt) throw new RecoveryDeadlineError('after')
    return result
  }
}

function commandResult(commandRunner, file, args, options = {}, label = file) {
  try {
    return resultOf(commandRunner(file, args, options))
  } catch (error) {
    if (error?.code === 'NATIVE_DOCKER_RECOVERY_DEADLINE' || error?.code === 'NATIVE_DOCKER_QUIESCENCE_DEADLINE') throw error
    fail(`${label} command failed`)
  }
}

function requireStatus(commandRunner, file, args, label = file) {
  const result = commandResult(commandRunner, file, args, {}, label)
  if (result.status !== 0) fail(`${label} command failed`)
  return result
}

function safeExecutable(file, label = file) {
  const executable = SAFE_BINARIES[file]
  if (!executable) fail(`${label} executable is not approved`)
  return executable
}

function exactPath(target, expected, label) {
  if (typeof target !== 'string' || target !== expected || !path.isAbsolute(target)) {
    fail(`${label} must be the fixed absolute path`)
  }
  if (target === path.parse(target).root || path.normalize(target) !== target) {
    fail(`${label} cannot be a root or normalized parent path`)
  }
  return target
}

function lstat(fsApi, target, label) {
  try {
    return fsApi.lstatSync(target)
  } catch {
    fail(`${label} is missing`)
  }
}

function assertKnownVarRunCompatibility(fsApi, label) {
  const stats = lstat(fsApi, '/var/run', label)
  if (!(stats.isSymbolicLink?.() || stats.isSymbolicLink === true)) fail(`${label} has an unapproved /var/run binding`)
  let resolved
  try { resolved = fsApi.realpathSync('/var/run') } catch { fail(`${label} /var/run binding cannot be canonicalized`) }
  if (resolved !== '/run') fail(`${label} has an unapproved /var/run binding`)
}

function assertNoSymlinkAncestors(fsApi, target, label, { allowVarRunCompatibility = false } = {}) {
  let cursor = target
  while (true) {
    const stats = lstat(fsApi, cursor, label)
    if (stats.isSymbolicLink?.() || stats.isSymbolicLink === true) {
      if (allowVarRunCompatibility && cursor === '/var/run') {
        assertKnownVarRunCompatibility(fsApi, label)
        // Continue checking the real path's parent as well as `/var`; the
        // only compatibility exception is this exact `/var/run -> /run`
        // binding itself.
        cursor = '/var'
      } else {
        fail(`${label} has a symlink ancestor`)
      }
    }
    if (cursor === path.parse(cursor).root) break
    cursor = cursor === '/run' ? path.parse(cursor).root : path.dirname(cursor)
  }
}

function assertRootPrivate(stats, label, platform) {
  if (platform === 'linux') {
    if (stats.uid !== 0 || stats.gid !== 0) fail(`${label} must be root-owned`)
    if (!Number.isInteger(stats.mode) || (stats.mode & 0o022) !== 0) fail(`${label} must not be group/world writable`)
  }
}

function assertDirectory(fsApi, target, label, platform) {
  let cursor = target
  while (true) {
    const stats = lstat(fsApi, cursor, label)
    if (!(stats.isDirectory?.() || stats.isDirectory === true) || stats.isSymbolicLink?.() || stats.isSymbolicLink === true) fail(`${label} must be a non-symlink directory`)
    assertRootPrivate(stats, `${label} ancestor`, platform)
    assertCanonicalRealpath(fsApi, cursor, `${label} ancestor`)
    if (cursor === path.parse(cursor).root) break
    cursor = path.dirname(cursor)
  }
  return lstat(fsApi, target, label)
}

function assertCanonicalRealpath(fsApi, target, label, { allowVarRunCompatibility = false } = {}) {
  let resolved
  try {
    resolved = fsApi.realpathSync(target)
  } catch {
    fail(`${label} cannot be canonicalized`)
  }
  if (allowVarRunCompatibility && target.startsWith('/var/run/')) {
    assertKnownVarRunCompatibility(fsApi, label)
    const expected = `/run/${target.slice('/var/run/'.length)}`
    if (resolved !== expected) fail(`${label} is not the approved /var/run compatibility path`)
    return resolved
  }
  if (resolved !== target) fail(`${label} is not canonical`)
  return resolved
}

function assertNotMountpoint(target, { commandRunner, mountpointChecker } = {}) {
  if (mountpointChecker) {
    let mounted
    try { mounted = mountpointChecker(target) } catch { fail('mountpoint state cannot be proved') }
    if (mounted !== false) fail('fixed destructive target must not be a mountpoint')
    return
  }
  // --target reports the containing mount (usually `/`) and therefore cannot
  // prove that the target itself is a mountpoint.  --mountpoint is exact.
  const result = commandResult(commandRunner ?? defaultCommandRunner, 'findmnt', ['--noheadings', '--output', 'TARGET', '--mountpoint', target], {}, 'findmnt')
  if (result.stderr.trim()) fail('mountpoint state cannot be proved')
  if (result.status === 0 && result.stdout.trim() === target) fail('fixed destructive target must not be a mountpoint')
  if (result.status === 0 && result.stdout.trim() !== target) fail('mountpoint state cannot be proved')
  if (result.status !== 1) fail('mountpoint state cannot be proved')
}

function assertNoSubmounts(target, { commandRunner, mountpointSubtreeChecker } = {}) {
  if (mountpointSubtreeChecker) {
    let mounted
    try { mounted = mountpointSubtreeChecker(target) } catch { fail('submount state cannot be proved') }
    if (mounted !== false) fail('fixed destructive target has a nested mountpoint')
    return
  }
  // Query the complete mount tree rooted at `/`.  `findmnt --submounts
  // <target>` returns status 1 when <target> is not itself a mountpoint and
  // can therefore miss a child mount (for example `/tmp/.X11-unix`).  The
  // full JSON tree is deterministic and lets us reject the target or any
  // descendant regardless of whether the target is mounted itself.
  const result = commandResult(commandRunner ?? defaultCommandRunner, 'findmnt', ['--json', '--output', 'TARGET', '--submounts', '/'], {}, 'nested mount inspection')
  if (result.status !== 0 || result.stderr.trim()) fail('nested mount state cannot be proved')
  let tree
  try { tree = JSON.parse(result.stdout) } catch { fail('nested mount state cannot be proved') }
  const prefix = `${target}/`
  const targets = []
  const visit = (value) => {
    if (Array.isArray(value)) {
      for (const entry of value) visit(entry)
      return
    }
    if (!object(value)) return
    for (const [key, child] of Object.entries(value)) {
      if (key === 'target') {
        if (typeof child !== 'string' || !path.isAbsolute(child) || path.normalize(child) !== child) fail('nested mount state cannot be proved')
        targets.push(child)
      } else {
        visit(child)
      }
    }
  }
  visit(tree)
  if (targets.length === 0 || !targets.includes('/')) fail('nested mount state cannot be proved')
  for (const mounted of targets) {
    if (mounted === target || mounted.startsWith(prefix)) fail('fixed destructive target has a nested mountpoint')
  }
}

function resetMountFailure(kind, target, classification) {
  fail(`reset mount topology rejected for ${kind} ${target}: ${classification}`)
}

// The disposable data directory may be presented by findmnt as a bind mount
// whose SOURCE names the backing device followed by the exact source subtree.
// Keep this check pure and intentionally literal: no trimming, normalization,
// case folding, or SOURCE parsing is permitted.  The caller separately proves
// that this is the sole direct match and that no descendants exist.
const NATIVE_DEVICE_SOURCE = /^\/dev\/[A-Za-z0-9][A-Za-z0-9._+-]*(?:\/[A-Za-z0-9][A-Za-z0-9._+-]*)*$/

export function isExactDockerDataSelfBind(rootMount, directMount) {
  if (!object(rootMount) || !object(directMount)) return false
  const target = hostContract.dockerDataRoot
  if (rootMount.target !== '/' || rootMount.fsroot !== '/' || rootMount.fstype !== 'ext4') return false
  if (typeof rootMount.source !== 'string' || !NATIVE_DEVICE_SOURCE.test(rootMount.source)) return false
  if (directMount.target !== target) return false
  if (directMount.source !== `${rootMount.source}[${target}]`) return false
  if (directMount.fstype !== rootMount.fstype || directMount.fsroot !== target) return false
  return true
}

function parseResetMountTopology(text) {
  let parsed
  try { parsed = JSON.parse(text) } catch { fail('reset mount topology cannot be proved') }
  const mounts = []
  const visit = (value) => {
    if (Array.isArray(value)) {
      for (const entry of value) visit(entry)
      return
    }
    if (!object(value)) return
    if (Object.prototype.hasOwnProperty.call(value, 'target')) {
      const target = value.target
      if (typeof target !== 'string' || !path.isAbsolute(target) || path.normalize(target) !== target) fail('reset mount topology cannot be proved')
      const source = value.source ?? ''
      const fstype = value.fstype ?? value['fs-type'] ?? ''
      const fsroot = value.fsroot ?? value['fs-root'] ?? ''
      if (typeof source !== 'string' || typeof fstype !== 'string' || typeof fsroot !== 'string') fail('reset mount topology cannot be proved')
      mounts.push({ target, source, fstype, fsroot })
    }
    for (const child of Object.values(value)) if (child && typeof child === 'object') visit(child)
  }
  visit(parsed)
  if (!mounts.some((mount) => mount.target === '/')) fail('reset mount topology cannot be proved')
  return mounts
}

function readResetMountTopology(commandRunner) {
  try {
    const result = privileged(commandRunner, 'findmnt', ['--json', '--output', 'TARGET,SOURCE,FSTYPE,FSROOT', '--submounts', '/'], 'reset mount topology')
    if (result.stderr.trim()) fail('reset mount topology cannot be proved')
    return parseResetMountTopology(result.stdout)
  } catch (error) {
    if (error?.code === 'NATIVE_DOCKER_RECOVERY_DEADLINE') throw error
    fail('reset mount topology cannot be proved')
  }
}

function classifyResetMounts(commandRunner) {
  let mounts
  try {
    mounts = readResetMountTopology(commandRunner)
  } catch (error) {
    if (error?.code === 'NATIVE_DOCKER_RECOVERY_DEADLINE') throw error
    resetMountFailure('dockerDataRoot', hostContract.dockerDataRoot, 'unreadable')
  }
  const root = mounts.find((mount) => mount.target === '/')
  const states = []
  for (const [kind, target] of Object.entries(destructiveTargets)) {
    const matches = mounts.filter((mount) => mount.target === target || mount.target.startsWith(`${target}/`))
    const directMatches = matches.filter((mount) => mount.target === target)
    const direct = directMatches[0]
    if (matches.length === 0) {
      states.push(Object.freeze({ kind, path: target, classification: 'absent', mounted: false, descendants: 0 }))
      continue
    }
    if (kind !== 'dockerDataRoot') {
      states.push(Object.freeze({ kind, path: target, classification: direct ? 'unexpected-direct-mount' : 'unexpected-descendant-mount', mounted: true, descendants: Math.max(0, matches.length - (direct ? 1 : 0)) }))
      continue
    }
    let classification = 'allowed-direct-self-bind'
    if (directMatches.length > 1) classification = 'duplicate-direct-mount'
    else if (!direct) classification = 'descendant-only-mount'
    else if (matches.length !== 1) classification = 'descendant-mount'
    else if (direct.fsroot !== target || root?.fsroot !== '/') classification = 'fsroot-mismatch'
    else if (root?.fstype?.toLowerCase?.().includes('overlay') || direct.fstype?.toLowerCase?.().includes('overlay')) classification = 'overlay-filesystem'
    else if (root?.fstype !== 'ext4' || direct.fstype !== root?.fstype) classification = 'filesystem-type-mismatch'
    else if (!isExactDockerDataSelfBind(root, direct)) classification = 'bind-source-notation-mismatch'
    states.push(Object.freeze({ kind, path: target, classification, mounted: true, descendants: Math.max(0, matches.length - (direct ? 1 : 0)) }))
  }
  return states
}

function assertResetMountsAllowed(states) {
  for (const state of states) {
    if (state.classification === 'absent' || state.classification === 'allowed-direct-self-bind') continue
    resetMountFailure(state.kind, state.path, state.classification)
  }
  return states
}

function reconcileResetMounts(commandRunner) {
  let states = assertResetMountsAllowed(classifyResetMounts(commandRunner))
  const dataRoot = states.find((state) => state.kind === 'dockerDataRoot')
  if (dataRoot?.classification === 'allowed-direct-self-bind') {
    try {
      privileged(commandRunner, 'umount', ['--', hostContract.dockerDataRoot], 'unmount docker data self-bind')
    } catch (error) {
      if (error?.code === 'NATIVE_DOCKER_RECOVERY_DEADLINE') throw error
      resetMountFailure(dataRoot.kind, dataRoot.path, 'unmount-failed')
    }
    states = classifyResetMounts(commandRunner)
    const afterDataRoot = states.find((state) => state.kind === 'dockerDataRoot')
    if (afterDataRoot?.classification !== 'absent') resetMountFailure(afterDataRoot.kind, afterDataRoot.path, 'self-bind-remains-mounted')
    assertResetMountsAllowed(states)
  }
  return states
}

/** Validate one of the four fixed roots immediately before a destructive operation. */
export function validateCanonicalDestructiveTarget(target, kind, options = {}) {
  const expected = destructiveTargets[kind]
  if (!expected) fail('destructive target kind is not allowed')
  exactPath(target, expected, `${kind} target`)
  const fsApi = options.fsApi ?? fs
  // The contract is for an Ubuntu host.  Keeping Linux as the default also
  // makes Windows static tests exercise the ownership/mode guard instead of
  // silently weakening it.
  const platform = options.platform ?? 'linux'
  assertDirectory(fsApi, target, `${kind} target`, platform)
  assertCanonicalRealpath(fsApi, target, `${kind} target`)
  assertNotMountpoint(target, options)
  assertNoSubmounts(target, options)
  return Object.freeze({ kind, path: expected })
}

export const assertCanonicalFixedDirectory = validateCanonicalDestructiveTarget

// Reset may encounter the one explicitly approved docker-data self-bind.  Its
// mount topology is validated separately, but the fixed directory identity
// (exact path, root-private canonical directory and trusted ancestors) must
// still be proved before either private service is stopped.
function validateResetDestructiveDirectory(target, kind, options = {}) {
  const expected = destructiveTargets[kind]
  if (!expected) fail('destructive target kind is not allowed')
  exactPath(target, expected, `${kind} target`)
  const fsApi = options.fsApi ?? fs
  const platform = options.platform ?? 'linux'
  assertDirectory(fsApi, target, `${kind} target`, platform)
  assertCanonicalRealpath(fsApi, target, `${kind} target`)
}

function validateFixedPrivateFile(target, expected, label, { fsApi = fs, platform = 'linux', allowRead = false, ownerUid } = {}) {
  exactPath(target, expected, label)
  assertNoSymlinkAncestors(fsApi, target, label)
  const stats = lstat(fsApi, target, label)
  if (!(stats.isFile?.() || stats.isFile === true) || stats.isSymbolicLink?.() || stats.isSymbolicLink === true) fail(`${label} must be a regular non-symlink file`)
  if (stats.nlink !== undefined && stats.nlink !== 1) fail(`${label} hardlinks are not allowed`)
  assertRootPrivate(stats, label, platform)
  if (platform === 'linux' && (!Number.isInteger(stats.mode) || (stats.mode & (allowRead ? 0o022 : 0o077)) !== 0)) fail(`${label} must be private`)
  if (ownerUid !== undefined && stats.uid !== ownerUid) fail(`${label} owner is not the caller`)
  assertCanonicalRealpath(fsApi, target, label)
  return stats
}

function readMarker(options = {}) {
  const fsApi = options.fsApi ?? fs
  validateFixedPrivateFile(hostContract.marker, hostContract.marker, 'native Docker host marker', { ...options, allowRead: true })
  let parsed
  try {
    parsed = JSON.parse(fsApi.readFileSync(hostContract.marker, 'utf8'))
  } catch {
    fail('native Docker host marker is invalid')
  }
  if (!object(parsed) || JSON.stringify(Object.keys(parsed).sort()) !== JSON.stringify([...markerKeys].sort())) {
    fail('native Docker host marker identity is invalid')
  }
  for (const key of markerKeys) if (parsed[key] !== markerValues[key]) fail('native Docker host marker identity is invalid')
  return { schema: markerSchema, version: markerValues.version }
}

function unitActive(commandRunner, unit, expected = true) {
  const result = commandResult(commandRunner, 'systemctl', ['is-active', '--quiet', unit], {}, `systemd ${unit}`)
  if (expected && result.status !== 0) fail(`required systemd unit is not active: ${unit}`)
  if (!expected && result.status === 0) fail(`forbidden systemd unit is active: ${unit}`)
  if (!expected && ![1, 3, 4].includes(result.status)) fail(`systemd ${unit} state cannot be proved`)
  if (!expected && (result.stdout !== '' || result.stderr !== '')) fail(`systemd ${unit} state cannot be proved`)
  return expected ? 'active' : 'inactive'
}

function unitDisabled(commandRunner, unit) {
  // A disabled unit reports status 1 and the literal `disabled` state.  Static,
  // masked, indirect, unknown, or otherwise ambiguous states are rejected so
  // an inactive socket/service cannot later be reactivated by systemd.
  const result = commandResult(commandRunner, 'systemctl', ['is-enabled', '--no-pager', unit], {}, `systemd ${unit} enablement`)
  if (result.status !== 1 || result.stdout.trim() !== 'disabled' || result.stderr.trim()) fail(`forbidden systemd unit enablement cannot be proved: ${unit}`)
  return 'disabled'
}

function unitPid(commandRunner, unit) {
  const result = requireStatus(commandRunner, 'systemctl', ['show', '--property=MainPID', '--value', unit], `systemd ${unit} MainPID`)
  const pid = Number(result.stdout.trim())
  if (!Number.isSafeInteger(pid) || pid <= 1) fail(`systemd ${unit} has no verified process`)
  return pid
}

function processStartTime(commandRunner, pid, label) {
  const result = requireStatus(commandRunner, 'sudo', ['-n', safeExecutable('cat'), `/proc/${pid}/stat`], `${label} start identity`)
  const close = result.stdout.lastIndexOf(')')
  if (close < 0) fail(`${label} start identity is invalid`)
  const fields = result.stdout.slice(close + 1).trim().split(/\s+/)
  const startTime = Number(fields[19])
  if (!Number.isSafeInteger(startTime) || startTime <= 0) fail(`${label} start identity is invalid`)
  return startTime
}

function processCgroup(commandRunner, pid, label) {
  const result = requireStatus(commandRunner, 'sudo', ['-n', safeExecutable('cat'), `/proc/${pid}/cgroup`], `${label} cgroup identity`)
  const line = result.stdout.split(/\r?\n/).map((value) => value.trim()).find((value) => /^\d+::\//.test(value))
  const cgroup = line?.slice(line.indexOf('::') + 2)
  if (!cgroup || !/^\/[A-Za-z0-9_.@/-]+$/.test(cgroup) || cgroup.includes('..')) fail(`${label} cgroup identity is invalid`)
  return cgroup
}

function unitControlGroup(commandRunner, unit, label) {
  const result = requireStatus(commandRunner, 'systemctl', ['show', '--property=ControlGroup', '--value', unit], `${label} control group`)
  const cgroup = result.stdout.trim()
  if (cgroup !== `/system.slice/${unit}`) fail(`${label} control group is not exact`)
  return cgroup
}

function processExecutable(commandRunner, pid, binary, label) {
  const expected = SAFE_BINARIES[binary]
  if (!expected) fail(`${label} executable is not approved`)
  const resolved = requireStatus(commandRunner, 'sudo', ['-n', safeExecutable('readlink'), '-e', `/proc/${pid}/exe`], `${label} executable identity`).stdout.trim()
  if (resolved !== expected) fail(`${label} executable path is not exact`)
  const stat = requireStatus(commandRunner, 'sudo', ['-n', safeExecutable('stat'), '-Lc', '%F %u %a', expected], `${label} executable stat`).stdout.trim().match(/^regular file\s+(\d+)\s+(\d+)$/i)
  if (!stat || Number(stat[1]) !== 0 || (Number.parseInt(stat[2], 8) & 0o022) !== 0) fail(`${label} executable ownership or mode is unsafe`)
  return expected
}

function processCommandLine(commandRunner, pid, label) {
  const result = requireStatus(commandRunner, 'sudo', ['-n', safeExecutable('ps'), '-ww', '-p', String(pid), '-o', 'args='], `${label} command line`)
  const line = result.stdout.trim().split(/\r?\n/, 1)[0].trim()
  if (!line || /[\0\r\n]/.test(line)) fail(`${label} command line is invalid`)
  return line
}

function commandTokens(line) {
  return line.match(/(?:"[^"\\]*(?:\\.[^"\\]*)*"|'[^'\\]*(?:\\.[^'\\]*)*'|[^\s])+/g)?.map((token) => token.replace(/^['"]|['"]$/g, '')) ?? []
}

function assertExactProcess(line, binary, requiredFlags, label, { exactExecutablePath = false } = {}) {
  const tokens = commandTokens(line)
  const expectedExecutable = SAFE_BINARIES[binary]
  if (tokens.length === 0 || (exactExecutablePath ? tokens[0] !== expectedExecutable : path.basename(tokens[0]) !== binary)) fail(`${label} executable is not exact`)
  if (tokens.length !== 1 + Object.keys(requiredFlags).length) fail(`${label} has unapproved arguments`)
  for (const [name, value] of Object.entries(requiredFlags)) {
    const expected = `${name}=${value}`
    if (tokens.filter((token) => token === expected).length !== 1) fail(`${label} arguments are not exact`)
    if (tokens.some((token) => token.startsWith(`${name}=`) && token !== expected)) fail(`${label} arguments are not exact`)
  }
  for (const forbidden of ['--host', '-H', '--data-root', '--exec-root', '--pidfile', '--containerd', '--root', '--state', '--address', '--iptables', '--ip6tables']) {
    if (tokens.some((token) => token === forbidden || (forbidden === '-H' && token.startsWith('-H=')))) fail(`${label} arguments are not exact`)
  }
  return Object.freeze({ binary, flags: { ...requiredFlags } })
}

function assertUnitExecStart(commandRunner, unit, binary, requiredFlags, label) {
  const result = requireStatus(commandRunner, 'systemctl', ['show', '--property=ExecStart', '--value', unit], `${label} ExecStart`)
  const text = result.stdout.trim()
  if (!text) fail(`${label} ExecStart is missing`)
  const expectedPath = SAFE_BINARIES[binary]
  const pathMatch = text.match(/(?:^|\s)path=([^;\s]+)/)
  const argvMatch = text.match(/(?:^|\s)argv\[\]=(.+?)(?:\s*;\s*(?:ignore_errors|start_time|stop_time|pid|code|status)=|}\s*$)/)
  const line = argvMatch ? argvMatch[1].trim() : text
  if (pathMatch && pathMatch[1] !== expectedPath) fail(`${label} ExecStart path is not exact`)
  assertExactProcess(line, binary, requiredFlags, label, { exactExecutablePath: true })
  return line
}

function validateUnixSocket(fsApi, socket, label, platform = 'linux') {
  exactPath(socket, socket, label)
  assertNoSymlinkAncestors(fsApi, socket, label, { allowVarRunCompatibility: socket === hostContract.socket })
  const stats = lstat(fsApi, socket, label)
  if (!(stats.isSocket?.() || stats.isSocket === true) || stats.isSymbolicLink?.() || stats.isSymbolicLink === true) fail(`${label} must be an exact Unix socket`)
  if (platform === 'linux') {
    if (stats.uid !== 0) fail(`${label} must be root-owned`)
    if (!Number.isInteger(stats.mode) || (stats.mode & 0o007) !== 0) fail(`${label} must not be world-writable`)
  }
  const resolved = assertCanonicalRealpath(fsApi, socket, label, { allowVarRunCompatibility: socket === hostContract.socket })
  if (socket === hostContract.socket) {
    const alias = '/run/docker.sock'
    assertNoSymlinkAncestors(fsApi, alias, 'Docker socket alias')
    const aliasStats = lstat(fsApi, alias, 'Docker socket alias')
    if (!(aliasStats.isSocket?.() || aliasStats.isSocket === true) || aliasStats.isSymbolicLink?.() || aliasStats.isSymbolicLink === true) fail('Docker socket alias is not the same Unix socket')
    assertCanonicalRealpath(fsApi, alias, 'Docker socket alias')
    if (resolved !== alias) fail('Docker socket compatibility path is not exact')
    if (Number.isInteger(stats.dev) && Number.isInteger(stats.ino) && Number.isInteger(aliasStats.dev) && Number.isInteger(aliasStats.ino)) {
      if (stats.dev !== aliasStats.dev || stats.ino !== aliasStats.ino) fail('Docker socket aliases do not identify the same socket')
    } else if (stats.uid !== aliasStats.uid || stats.gid !== aliasStats.gid || stats.mode !== aliasStats.mode) {
      fail('Docker socket aliases do not identify the same socket')
    }
  }
}

function socketIsOwnedByPid(commandRunner, fsApi, socket, pid, platform, label = 'Docker socket', aliases = []) {
  validateUnixSocket(fsApi, socket, label, platform)
  const stat = requireStatus(commandRunner, 'sudo', ['-n', safeExecutable('stat'), '-Lc', '%F %u %g %a %d %i', socket], `${label} stat`)
  const statFields = stat.stdout.trim().match(/^socket\s+(\d+)\s+(\d+)\s+(\d+)(?:\s+(\d+)\s+(\d+))?\s*$/i)
  if (!statFields || Number(statFields[1]) !== 0 || (Number.parseInt(statFields[3], 8) & 0o007) !== 0) fail(`${label} is not a private Unix socket`)
  const socketStats = fsApi.lstatSync(socket)
  if (statFields[4] !== undefined && Number.isInteger(socketStats.dev) && Number(statFields[4]) !== socketStats.dev) fail('Docker socket identity changed')
  if (statFields[5] !== undefined && Number.isInteger(socketStats.ino) && Number(statFields[5]) !== socketStats.ino) fail('Docker socket identity changed')
  const listeners = requireStatus(commandRunner, 'sudo', ['-n', safeExecutable('ss'), '-xlpn'], `${label} listener`)
  const paths = [socket, ...aliases].map((value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  const line = listeners.stdout.split(/\r?\n/).find((entry) => paths.some((alias) => new RegExp(alias).test(entry)))
  if (!line || !new RegExp(`pid=${pid}(?:[,)]|$)`).test(line)) fail(`${label} is not owned by the verified process`)
}

function cleanDockerEnvironment(env) {
  const clean = { ...(env ?? process.env) }
  delete clean.DOCKER_HOST
  if (Object.prototype.hasOwnProperty.call(env ?? {}, 'DOCKER_HOST')) fail('DOCKER_HOST override is not allowed')
  return clean
}

function dockerArgs(...args) {
  return ['--host', `unix://${hostContract.socket}`, ...args]
}

function dockerCommand(commandRunner, args, env, label) {
  return commandResult(commandRunner, 'docker', dockerArgs(...args), { env: cleanDockerEnvironment(env) }, label)
}

function inspectDocker(commandRunner, env, { allowMutableInventory = false } = {}) {
  const info = dockerCommand(commandRunner, ['info', '--format', '{{json .}}'], env, 'Docker info')
  let parsed
  try { parsed = JSON.parse(info.stdout) } catch { fail('Docker info identity is invalid') }
  if (!object(parsed) || parsed.DockerRootDir !== hostContract.dockerDataRoot) fail('Docker data-root identity is not exact')
  const queries = [
    ['containers', ['ps', '-aq']],
    ['networks', ['network', 'ls', '--filter', 'type=custom', '-q']],
    ['volumes', ['volume', 'ls', '-q']],
    ['images', ['images', '-aq']],
  ]
  const inventory = {}
  for (const [kind, args] of queries) {
    const result = dockerCommand(commandRunner, args, env, `Docker ${kind} inventory`)
    if (result.status !== 0) fail(`Docker ${kind} inventory cannot be proved`)
    const entries = result.stdout.split(/\r?\n/).map((value) => value.trim()).filter(Boolean)
    if (entries.length !== 0 && !allowMutableInventory) fail(`Docker ${kind} inventory is not empty`)
    inventory[kind] = entries.length
  }
  return Object.freeze({ dockerRootDir: hostContract.dockerDataRoot, inventory })
}

function verifiedUnitProcess(commandRunner, unit, binary, flags, label) {
  const pid = unitPid(commandRunner, unit)
  const startTime = processStartTime(commandRunner, pid, label)
  const cgroup = processCgroup(commandRunner, pid, label)
  const controlGroup = unitControlGroup(commandRunner, unit, label)
  if (cgroup !== controlGroup) fail(`${label} is outside its systemd control group`)
  const executable = processExecutable(commandRunner, pid, binary, label)
  const line = processCommandLine(commandRunner, pid, label)
  const process = assertExactProcess(line, binary, flags, label)
  const execStart = assertUnitExecStart(commandRunner, unit, binary, flags, label)
  return { pid, startTime, cgroup, executable, execStart, process }
}

function verifyProcessIdentityStill(commandRunner, unit, binary, flags, expected, label) {
  const pid = unitPid(commandRunner, unit)
  if (pid !== expected.pid) fail(`${label} PID changed before lifecycle action`)
  const startTime = processStartTime(commandRunner, pid, label)
  if (startTime !== expected.startTime) fail(`${label} start identity changed before lifecycle action`)
  const cgroup = processCgroup(commandRunner, pid, label)
  if (cgroup !== expected.cgroup || cgroup !== unitControlGroup(commandRunner, unit, label)) fail(`${label} cgroup changed before lifecycle action`)
  if (processExecutable(commandRunner, pid, binary, label) !== expected.executable) fail(`${label} executable changed before lifecycle action`)
  assertExactProcess(processCommandLine(commandRunner, pid, label), binary, flags, label)
  assertUnitExecStart(commandRunner, unit, binary, flags, label)
}

export function inspectDedicatedNativeDockerHost(options = {}) {
  const commandRunner = options.commandRunner ?? defaultCommandRunner
  const marker = readMarker(options)
  const env = options.env ?? process.env
  if (Object.prototype.hasOwnProperty.call(env ?? {}, 'DOCKER_HOST')) fail('DOCKER_HOST override is not allowed')

  unitActive(commandRunner, hostContract.containerdUnit, true)
  unitActive(commandRunner, hostContract.dockerdUnit, true)
  const systemDockerUnits = {}
  for (const [key, unit] of [['service', 'docker.service'], ['socket', 'docker.socket']]) {
    const active = unitActive(commandRunner, unit, false)
    const enabled = unitDisabled(commandRunner, unit)
    systemDockerUnits[key] = Object.freeze({ unit, active, enabled })
  }

  const containerd = verifiedUnitProcess(commandRunner, hostContract.containerdUnit, 'containerd', {
    '--root': hostContract.containerdRoot,
    '--state': hostContract.containerdState,
    '--address': hostContract.containerdSocket,
  }, 'private containerd')
  const dockerd = verifiedUnitProcess(commandRunner, hostContract.dockerdUnit, 'dockerd', {
    '--host': `unix://${hostContract.socket}`,
    '--data-root': hostContract.dockerDataRoot,
    '--exec-root': hostContract.dockerExecRoot,
    '--pidfile': hostContract.dockerPidfile,
    '--containerd': hostContract.containerdSocket,
    '--iptables': 'true',
    '--ip6tables': 'true',
  }, 'custom dockerd')
  socketIsOwnedByPid(commandRunner, options.fsApi ?? fs, hostContract.containerdSocket, containerd.pid, options.platform ?? 'linux', 'private containerd socket', [])
  socketIsOwnedByPid(commandRunner, options.fsApi ?? fs, hostContract.socket, dockerd.pid, options.platform ?? 'linux', 'Docker socket', ['/run/docker.sock'])
  const docker = inspectDocker(commandRunner, env, { allowMutableInventory: options.allowMutableInventory === true })

  return Object.freeze({
    contract: CONTRACT_VERSION,
    marker,
    units: Object.freeze({ containerd: hostContract.containerdUnit, dockerd: hostContract.dockerdUnit }),
    systemUnits: Object.freeze({ dockerService: systemDockerUnits.service, dockerSocket: systemDockerUnits.socket }),
    pids: Object.freeze({ containerd: containerd.pid, dockerd: dockerd.pid }),
    processes: Object.freeze({
      containerd: Object.freeze({ startTime: containerd.startTime, executable: containerd.executable, cgroup: containerd.cgroup }),
      dockerd: Object.freeze({ startTime: dockerd.startTime, executable: dockerd.executable, cgroup: dockerd.cgroup }),
    }),
    socket: hostContract.socket,
    dockerRootDir: docker.dockerRootDir,
    inventory: docker.inventory,
  })
}

function callerPrimaryGroup(options = {}) {
  if (Number.isSafeInteger(options.callerGid) && options.callerGid >= 0) return options.callerGid
  const result = requireStatus(options.commandRunner ?? defaultCommandRunner, 'id', ['-g'], 'caller primary group')
  const gid = Number(result.stdout.trim())
  if (!Number.isSafeInteger(gid) || gid < 0) fail('caller primary group is invalid')
  return gid
}

function validateLockDirectory(options = {}) {
  const fsApi = options.fsApi ?? fs
  const platform = options.platform ?? 'linux'
  exactPath(hostContract.lockDirectory, hostContract.lockDirectory, 'native Docker host lock directory')
  assertNoSymlinkAncestors(fsApi, hostContract.lockDirectory, 'native Docker host lock directory')
  const stats = lstat(fsApi, hostContract.lockDirectory, 'native Docker host lock directory')
  if (!(stats.isDirectory?.() || stats.isDirectory === true) || stats.isSymbolicLink?.() || stats.isSymbolicLink === true) fail('native Docker host lock directory must be a non-symlink directory')
  if (platform === 'linux') {
    const gid = callerPrimaryGroup(options)
    if (stats.uid !== 0 || stats.gid !== gid) fail('native Docker host lock directory ownership is invalid')
    if (!Number.isInteger(stats.mode) || (stats.mode & 0o1777) !== 0o1770) fail('native Docker host lock directory must be root-owned, caller-group-writable, and sticky')
    let ancestor = path.dirname(hostContract.lockDirectory)
    while (true) {
      const ancestorStats = lstat(fsApi, ancestor, 'native Docker host lock directory ancestor')
      if (!(ancestorStats.isDirectory?.() || ancestorStats.isDirectory === true) || ancestorStats.isSymbolicLink?.() || ancestorStats.isSymbolicLink === true) fail('native Docker host lock directory ancestor is unsafe')
      assertRootPrivate(ancestorStats, 'native Docker host lock directory ancestor', platform)
      assertCanonicalRealpath(fsApi, ancestor, 'native Docker host lock directory ancestor')
      if (ancestor === path.parse(ancestor).root) break
      ancestor = path.dirname(ancestor)
    }
  }
  assertCanonicalRealpath(fsApi, hostContract.lockDirectory, 'native Docker host lock directory')
}

function lockNonce(randomBytes = crypto.randomBytes) {
  return randomBytes(24).toString('hex')
}

function callerUid(options = {}) {
  const uid = Number.isSafeInteger(options.uid) ? options.uid : (typeof process.getuid === 'function' ? process.getuid() : 0)
  if (!Number.isSafeInteger(uid) || uid < 0) fail('caller UID is invalid')
  return uid
}

function validateCallerLockFile(lock, options = {}) {
  const fsApi = options.fsApi ?? fs
  const platform = options.platform ?? 'linux'
  exactPath(hostContract.lockFile, hostContract.lockFile, 'native Docker host lock')
  assertNoSymlinkAncestors(fsApi, hostContract.lockFile, 'native Docker host lock')
  const stats = lstat(fsApi, hostContract.lockFile, 'native Docker host lock')
  if (!(stats.isFile?.() || stats.isFile === true) || stats.isSymbolicLink?.() || stats.isSymbolicLink === true) fail('native Docker host lock must be a regular file')
  if (stats.nlink !== undefined && stats.nlink !== 1) fail('native Docker host lock hardlinks are not allowed')
  if (platform === 'linux') {
    if (stats.uid !== lock.uid) fail('native Docker host lock owner mismatch')
    if (!Number.isInteger(stats.mode) || (stats.mode & 0o077) !== 0) fail('native Docker host lock must be private')
  }
  assertCanonicalRealpath(fsApi, hostContract.lockFile, 'native Docker host lock')
}

function verifyHostLock(lock, options = {}) {
  if (!object(lock) || lock.path !== hostContract.lockFile || lock.version !== 1 || !Number.isSafeInteger(lock.pid) || lock.pid <= 1 || !Number.isSafeInteger(lock.uid) || lock.uid < 0 || typeof lock.nonce !== 'string' || !/^[a-f0-9]{48}$/.test(lock.nonce)) {
    fail('native Docker host lock token is invalid')
  }
  try { validateCallerLockFile(lock, options) } catch { fail('native Docker host lock ownership cannot be proved') }
  let stored
  try { stored = JSON.parse((options.fsApi ?? fs).readFileSync(hostContract.lockFile, 'utf8')) } catch { fail('native Docker host lock ownership cannot be proved') }
  if (!object(stored) || stored.version !== 1 || stored.pid !== lock.pid || stored.uid !== lock.uid || stored.nonce !== lock.nonce) fail('native Docker host lock ownership mismatch')
  return lock
}

export function acquireHostLock(options = {}) {
  const fsApi = options.fsApi ?? fs
  validateLockDirectory(options)
  const pid = Number.isSafeInteger(options.pid) ? options.pid : process.pid
  if (pid <= 1) fail('lock owner PID is invalid')
  const uid = callerUid(options)
  const nonce = lockNonce(options.randomBytes)
  const contents = JSON.stringify({ version: 1, pid, uid, nonce })
  let descriptor
  try {
    descriptor = fsApi.openSync(hostContract.lockFile, 'wx', 0o600)
    fsApi.writeFileSync?.(descriptor, contents, { encoding: 'utf8' })
    if (!fsApi.writeFileSync) fsApi.writeSync(descriptor, contents, 0, 'utf8')
    fsApi.closeSync(descriptor)
    fsApi.chmodSync?.(hostContract.lockFile, 0o600)
    const lock = Object.freeze({ version: 1, pid, uid, nonce, path: hostContract.lockFile })
    validateCallerLockFile(lock, options)
    return lock
  } catch {
    try { if (descriptor !== undefined) fsApi.closeSync(descriptor) } catch { /* best effort */ }
    fail('native Docker host lock already exists or cannot be created')
  }
}

export function releaseHostLock(lock, options = {}) {
  const fsApi = options.fsApi ?? fs
  verifyHostLock(lock, options)
  try { fsApi.unlinkSync(hostContract.lockFile) } catch { fail('native Docker host lock cannot be released') }
  return true
}

function privileged(commandRunner, file, args, label) {
  return requireStatus(commandRunner, 'sudo', ['-n', safeExecutable(file, label), ...args], label)
}

function parseSafeObservationPath(value, root) {
  if (typeof value !== 'string' || !value || value.includes('..') || /[\0\r\n\t ]/.test(value)) return false
  if (!path.isAbsolute(value) || path.normalize(value) !== value) return false
  const prefix = `${root}/`
  if (!value.startsWith(prefix)) return false
  const suffix = value.slice(prefix.length)
  return /^[A-Za-z0-9._~+@,-]+(?:\/[A-Za-z0-9._~+@,-]+)*$/.test(suffix)
}

function strictObservationLines(text, label) {
  const lines = text.split(/\r?\n/)
  if (lines.at(-1) === '') lines.pop()
  if (lines.some((line) => line.length === 0)) fail(`${label} output is invalid`)
  return lines
}

function runtimeResidue(commandRunner, root, label) {
  const result = commandResult(commandRunner, 'sudo', ['-n', safeExecutable('find'), root, '-mindepth', '1', '(', '-type', 's', '-o', '-type', 'p', ')', '-print'], {}, `${label} runtime state`)
  if (result.status !== 0 || result.stderr.trim()) fail(`${label} runtime state cannot be proved`)
  const lines = strictObservationLines(result.stdout, label)
  for (const line of lines) if (!parseSafeObservationPath(line, root)) fail(`${label} runtime state is invalid`)
  return lines.length !== 0
}

function controlGroupResidue(commandRunner, cgroup, label) {
  if (typeof cgroup !== 'string' || !/^\/system\.slice\/[A-Za-z0-9_.@/-]+\.service$/.test(cgroup) || cgroup.includes('..')) fail(`${label} control group is invalid`)
  const root = `/sys/fs/cgroup${cgroup}`
  // systemd may remove an empty service cgroup after stop.  Accept only an
  // explicit root-verified absence of this exact, previously verified path;
  // any other status is ambiguous and must fail closed.
  const absent = commandResult(commandRunner, 'sudo', ['-n', safeExecutable('test'), '!', '-e', root], {}, `${label} control group state`)
  if (absent.status === 0) {
    if (absent.stdout !== '' || absent.stderr !== '') fail(`${label} control group state cannot be proved`)
    return false
  }
  if (absent.status !== 1 || absent.stdout !== '' || absent.stderr !== '') fail(`${label} control group state cannot be proved`)
  const processes = commandResult(commandRunner, 'sudo', ['-n', safeExecutable('find'), root, '-type', 'f', '-name', 'cgroup.procs', '-exec', safeExecutable('cat'), '{}', '+'], {}, `${label} process members`)
  if (processes.status !== 0 || processes.stderr.trim()) fail(`${label} process members cannot be proved`)
  const processLines = strictObservationLines(processes.stdout, `${label} process members`)
  for (const member of processLines) if (!/^\d+$/.test(member) || !Number.isSafeInteger(Number(member)) || Number(member) <= 1) fail(`${label} control group process state is invalid`)
  const children = commandResult(commandRunner, 'sudo', ['-n', safeExecutable('find'), root, '-mindepth', '1', '-type', 'd', '-print'], {}, `${label} child cgroups`)
  if (children.status !== 0 || children.stderr.trim()) fail(`${label} child cgroups cannot be proved`)
  const childLines = strictObservationLines(children.stdout, `${label} child cgroups`)
  for (const child of childLines) {
    if (!parseSafeObservationPath(child, root)) fail(`${label} child cgroup state is invalid`)
  }
  return processLines.length !== 0 || childLines.length !== 0
}

function proveStoppedAttempt(commandRunner, before) {
  // Every component is checked during every attempt. A retryable observation
  // never short-circuits the remaining invariant, so a different residue
  // cannot be missed on the attempt that eventually appears clean.
  let retryable = false
  unitActive(commandRunner, hostContract.dockerdUnit, false)
  unitActive(commandRunner, hostContract.containerdUnit, false)
  for (const [label, pid] of [['dockerd', before.pids.dockerd], ['containerd', before.pids.containerd]]) {
    const result = commandResult(commandRunner, 'sudo', ['-n', safeExecutable('kill'), '-0', String(pid)], {}, `${label} process state`)
    if (result.status === 0) fail(`${label} process did not stop`)
    if (result.status !== 1 || result.stdout !== '' || result.stderr !== '') fail(`${label} process state cannot be proved`)
  }

  const dockerSocket = commandResult(commandRunner, 'sudo', ['-n', safeExecutable('test'), '!', '-S', hostContract.socket], {}, 'Docker socket state')
  if (dockerSocket.status === 1) fail('stopped daemon socket remains present')
  if (dockerSocket.status !== 0 || dockerSocket.stdout !== '' || dockerSocket.stderr !== '') fail('Docker socket state cannot be proved')
  const containerdSocket = commandResult(commandRunner, 'sudo', ['-n', safeExecutable('test'), '!', '-S', hostContract.containerdSocket], {}, 'private containerd socket state')
  if (containerdSocket.status === 1) {
    if (containerdSocket.stdout !== '' || containerdSocket.stderr !== '') fail('private containerd socket state is invalid')
    retryable = true
  }
  else if (containerdSocket.status !== 0 || containerdSocket.stdout !== '' || containerdSocket.stderr !== '') fail('private containerd socket state cannot be proved')

  if (runtimeResidue(commandRunner, hostContract.dockerExecRoot, 'Docker exec root')) retryable = true
  if (runtimeResidue(commandRunner, hostContract.containerdState, 'private containerd state')) retryable = true
  if (controlGroupResidue(commandRunner, before.processes.dockerd.cgroup, 'custom dockerd')) retryable = true
  if (controlGroupResidue(commandRunner, before.processes.containerd.cgroup, 'private containerd')) retryable = true
  return retryable
}

function quiescenceCommandRunner(commandRunner, deadlineAt) {
  return (file, args, options = {}) => {
    const remaining = deadlineAt - Date.now()
    if (!Number.isFinite(remaining) || remaining < 1) throw new QuiescenceDeadlineError()
    const inherited = Number.isFinite(options.timeout) && options.timeout > 0 ? options.timeout : Number.POSITIVE_INFINITY
    const timeout = Math.max(1, Math.min(Math.floor(remaining), inherited))
    let result
    try {
      result = commandRunner(file, args, { ...options, timeout })
    } catch (error) {
      if (error?.code === 'NATIVE_DOCKER_RECOVERY_DEADLINE') throw new QuiescenceDeadlineError()
      throw error
    }
    if (Date.now() >= deadlineAt) throw new QuiescenceDeadlineError()
    return result
  }
}

function proveStopped(commandRunner, before, { recoveryDeadlineAt } = {}) {
  const started = Date.now()
  const quiescenceDeadline = Math.min(recoveryDeadlineAt ?? Number.POSITIVE_INFINITY, started + 5_000)
  const boundedRunner = quiescenceCommandRunner(commandRunner, quiescenceDeadline)
  let delayMs = 25
  while (true) {
    if (Date.now() >= quiescenceDeadline) throw new QuiescenceDeadlineError()
    let retryable
    try {
      retryable = proveStoppedAttempt(boundedRunner, before)
    } catch (error) {
      if (error?.code === 'NATIVE_DOCKER_RECOVERY_DEADLINE') throw new QuiescenceDeadlineError()
      throw error
    }
    if (!retryable) return
    if (Date.now() >= quiescenceDeadline) throw new QuiescenceDeadlineError()
    const delay = Math.min(delayMs, 250)
    const slept = commandResult(boundedRunner, 'sleep', [String(delay / 1_000)], {}, 'post-stop quiescence backoff')
    if (slept.status !== 0 || slept.stdout !== '' || slept.stderr !== '') fail('post-stop quiescence backoff cannot be proved')
    delayMs = Math.min(delayMs * 2, 250)
  }
}

export function resetDedicatedNativeDockerHost(options = {}) {
  const recoveryDeadlineAt = normalizeRecoveryDeadline(options.recoveryDeadlineAt)
  assertRecoveryDeadline(recoveryDeadlineAt)
  const commandRunner = deadlineCommandRunner(options.commandRunner ?? defaultCommandRunner, recoveryDeadlineAt)
  const operationOptions = { ...options, commandRunner }
  const callerHeldLock = options.lock !== undefined
  const lock = callerHeldLock ? verifyHostLock(options.lock, operationOptions) : acquireHostLock(operationOptions)
  let stopBegan = false
  try {
    const before = inspectDedicatedNativeDockerHost({ ...operationOptions, allowMutableInventory: true })
    // Prove every destructive root while both verified services are still
    // running.  A known mount/ownership failure must not leave the daemon
    // stopped merely because reset was attempted.
    for (const [kind, target] of Object.entries(destructiveTargets)) {
      validateResetDestructiveDirectory(target, kind, operationOptions)
    }
    assertResetMountsAllowed(classifyResetMounts(commandRunner))
    verifyProcessIdentityStill(commandRunner, hostContract.dockerdUnit, 'dockerd', {
      '--host': `unix://${hostContract.socket}`,
      '--data-root': hostContract.dockerDataRoot,
      '--exec-root': hostContract.dockerExecRoot,
      '--pidfile': hostContract.dockerPidfile,
      '--containerd': hostContract.containerdSocket,
      '--iptables': 'true',
      '--ip6tables': 'true',
    }, { pid: before.pids.dockerd, ...before.processes.dockerd }, 'custom dockerd')
    assertRecoveryDeadline(recoveryDeadlineAt)
    stopBegan = true
    try {
      privileged(commandRunner, 'systemctl', ['stop', hostContract.dockerdUnit], 'stop custom dockerd')
    } catch (error) {
      // A deadline refusal before the runner invocation means no stop began;
      // do not start compensation services for a lifecycle action that never
      // ran.  Any post-invocation timeout keeps stopBegan true and recovers.
      if (error?.code === 'NATIVE_DOCKER_RECOVERY_DEADLINE' && error.phase === 'before') stopBegan = false
      throw error
    }
    verifyProcessIdentityStill(commandRunner, hostContract.containerdUnit, 'containerd', {
      '--root': hostContract.containerdRoot,
      '--state': hostContract.containerdState,
      '--address': hostContract.containerdSocket,
    }, { pid: before.pids.containerd, ...before.processes.containerd }, 'private containerd')
    privileged(commandRunner, 'systemctl', ['stop', hostContract.containerdUnit], 'stop private containerd')
    proveStopped(commandRunner, before, { recoveryDeadlineAt })
    reconcileResetMounts(commandRunner)
    for (const [kind, target] of Object.entries(destructiveTargets)) {
      validateCanonicalDestructiveTarget(target, kind, operationOptions)
      privileged(commandRunner, 'rm', ['--recursive', '--force', '--', target], `delete ${kind}`)
      privileged(commandRunner, 'install', ['-d', '-o', 'root', '-g', 'root', '-m', '0700', '--', target], `recreate ${kind}`)
    }
    privileged(commandRunner, 'systemctl', ['start', hostContract.containerdUnit], 'start private containerd')
    privileged(commandRunner, 'systemctl', ['start', hostContract.dockerdUnit], 'start custom dockerd')
    const after = inspectDedicatedNativeDockerHost({ ...operationOptions, allowMutableInventory: false })
    assertRecoveryDeadline(recoveryDeadlineAt)
    return Object.freeze({ before, after, dockerDaemonReset: true })
  } catch (error) {
    if (stopBegan) {
      let compensationSucceeded = false
      try {
        // Once a stop has begun, restore only the two declared custom units.
        // Starting containerd before dockerd preserves their dependency order;
        // if either start or the recovery identity check is ambiguous, report
        // compensation failure and never claim a successful reset.
        privileged(commandRunner, 'systemctl', ['start', hostContract.containerdUnit], 'compensate private containerd')
        privileged(commandRunner, 'systemctl', ['start', hostContract.dockerdUnit], 'compensate custom dockerd')
        inspectDedicatedNativeDockerHost({ ...operationOptions, allowMutableInventory: true })
        compensationSucceeded = true
      } catch {
        compensationSucceeded = false
      }
      if (!compensationSucceeded) fail('native Docker host reset compensation failed')
    }
    throw error
  } finally {
    if (!callerHeldLock) releaseHostLock(lock, operationOptions)
  }
}

if (import.meta.url === `file://${process.argv[1]?.replaceAll('\\', '/')}`) {
  process.stderr.write('native Docker host controller is library-only; use an approved caller\n')
  process.exitCode = 2
}
