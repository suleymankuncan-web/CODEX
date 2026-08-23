import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { DISPOSABLE_DAEMON_ROOTS } from './onprem-image-local-proof-recovery.mjs'
import { runNativeSession } from './onprem-native-session-proof.mjs'
import { assertDockerEnvironmentSafe, runLocalPackage } from './onprem-offline-local-package.mjs'
import { parseCliArguments as parseRehearsalArguments, runLocalRehearsal } from './onprem-offline-local-rehearsal.mjs'

const SCRIPT_ROOT = path.dirname(fileURLToPath(import.meta.url))
const CHECKOUT_ROOT = fs.realpathSync(path.resolve(SCRIPT_ROOT, '..'))
const SHA1 = /^[a-f0-9]{40}$/
const SHA256 = /^[a-f0-9]{64}$/
const POSITIVE = /^[1-9][0-9]*$/
const SAFE_RELEASE_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,200}$/
const MAX_NATIVE_DEADLINE_MINUTES = 60
const MIN_PACKAGE_DEADLINE_MINUTES = 10
const MAX_PACKAGE_DEADLINE_MINUTES = 60
const DEFAULT_NATIVE_DEADLINE_MINUTES = 60
const DEFAULT_PACKAGE_DEADLINE_MINUTES = 60
const DAEMON_ROOTS = Object.freeze([...DISPOSABLE_DAEMON_ROOTS, '/var/lib/hr-axis-onprem-rehearsal'])

const fail = (message) => { throw new Error(message) }
const object = (value) => value !== null && typeof value === 'object' && !Array.isArray(value)

function assertString(value, label) {
  if (typeof value !== 'string' || value.length === 0 || /[\0\r\n]/.test(value)) fail(`${label} is invalid`)
  return value
}

function assertHash(value, label, expression) {
  assertString(value, label)
  if (!expression.test(value)) fail(`${label} is invalid`)
  return value
}

function assertPositive(value, label) {
  assertString(value, label)
  if (!POSITIVE.test(value)) fail(`${label} is invalid`)
  return value
}

function isWithin(candidate, root) {
  const relative = path.relative(path.resolve(root), path.resolve(candidate))
  return relative === '' || (relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative))
}

function assertNoSymlinkAncestors(fsApi, target, label) {
  let cursor = path.resolve(target)
  const root = path.parse(cursor).root
  while (true) {
    let stats
    try { stats = fsApi.lstatSync(cursor) } catch { fail(`${label} cannot be checked safely`) }
    if (stats.isSymbolicLink()) fail(`${label} has a symlink ancestor`)
    if (cursor === root) return
    cursor = path.dirname(cursor)
  }
}

function privateEmptyDirectory(fsApi, target, label, platform, uid) {
  assertString(target, label)
  if (!path.isAbsolute(target)) fail(`${label} must be absolute`)
  const absolute = path.resolve(target)
  assertNoSymlinkAncestors(fsApi, absolute, label)
  let stats
  try { stats = fsApi.lstatSync(absolute) } catch { fail(`${label} is unavailable`) }
  if (!stats.isDirectory() || stats.isSymbolicLink()) fail(`${label} must be a non-symlink directory`)
  if (platform === 'linux' && Number.isInteger(stats.mode) && (stats.mode & 0o077) !== 0) fail(`${label} must be private`)
  if (platform === 'linux' && Number.isInteger(stats.uid) && stats.uid !== 0 && stats.uid !== uid) fail(`${label} is not root- or caller-owned`)
  let entries
  try { entries = fsApi.readdirSync(absolute) } catch { fail(`${label} cannot be read`) }
  if (entries.length !== 0) fail(`${label} must be empty and fresh`)
  let canonical
  try { canonical = fsApi.realpathSync(absolute) } catch { fail(`${label} cannot be canonicalized`) }
  if (canonical !== absolute) fail(`${label} must be canonical`)
  return canonical
}

function boundedInteger(value, label, minimum, maximum, fallback) {
  if (value === undefined) return fallback
  assertString(value, label)
  if (!POSITIVE.test(value)) fail(`${label} is invalid`)
  const parsed = Number(value)
  if (!Number.isSafeInteger(parsed) || parsed < minimum || parsed > maximum) fail(`${label} is outside the bounded range`)
  return parsed
}

function derivePaths(sessionRoot) {
  const paths = {
    imageRunRoot: path.join(sessionRoot, 'image-run'),
    imageProofRoot: path.join(sessionRoot, 'image-proof'),
    provisionReceipt: path.join(sessionRoot, 'native-provision.json'),
    imageReceipt: path.join(sessionRoot, 'image-proof.json'),
    nativeSessionReceipt: path.join(sessionRoot, 'native-session.json'),
    bundleRoot: path.join(sessionRoot, 'offline-bundle'),
    trustRoot: path.join(sessionRoot, 'offline-trust'),
    packageReceipt: path.join(sessionRoot, 'offline-package.json'),
    rehearsalRunRoot: path.join(sessionRoot, 'offline-rehearsal-run'),
    rehearsalReceipt: path.join(sessionRoot, 'offline-rehearsal.json'),
  }
  const values = Object.values(paths)
  if (new Set(values).size !== values.length) fail('derived single-session paths overlap')
  return Object.freeze(paths)
}

function assertFreshDerivedPaths(fsApi, paths) {
  for (const [label, target] of Object.entries(paths)) {
    try {
      fsApi.lstatSync(target)
      fail(`${label} must be fresh`)
    } catch (error) {
      if (error?.message?.includes('must be fresh')) throw error
      if (error?.code !== 'ENOENT') fail(`${label} cannot be checked safely`)
    }
  }
}

export function parseSingleSessionArguments(argv) {
  if (!Array.isArray(argv)) fail('CLI arguments are required')
  if (argv.length === 1 && argv[0] === '--help') return Object.freeze({ help: true })
  const values = {}
  const options = new Map([
    ['--source-sha', 'sourceSha'], ['--tree-sha', 'treeSha'], ['--run-number', 'runNumber'], ['--run-id', 'runId'], ['--run-attempt', 'runAttempt'],
    ['--node', 'node'], ['--node-sha256', 'nodeSha256'], ['--session-root', 'sessionRoot'], ['--workspace-root', 'workspaceRoot'],
    ['--native-deadline-minutes', 'nativeDeadlineMinutes'], ['--package-deadline-minutes', 'packageDeadlineMinutes'],
  ])
  const flags = new Map([
    ['--confirm-disposable-native-host', 'confirmDisposableNativeHost'],
    ['--allow-disposable-daemon-reset', 'allowDisposableDaemonReset'],
  ])
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index]
    if (flags.has(token)) {
      const key = flags.get(token)
      if (Object.hasOwn(values, key)) fail(`duplicate option: ${token}`)
      values[key] = true
      continue
    }
    if (!options.has(token)) fail(`unknown or positional argument: ${token}`)
    const key = options.get(token)
    if (Object.hasOwn(values, key)) fail(`duplicate option: ${token}`)
    const value = argv[index + 1]
    if (!value || value.startsWith('--')) fail(`missing value for ${token}`)
    values[key] = value
    index += 1
  }
  for (const key of ['confirmDisposableNativeHost', 'allowDisposableDaemonReset', 'sourceSha', 'treeSha', 'runNumber', 'runId', 'runAttempt', 'node', 'nodeSha256', 'sessionRoot']) {
    if (!Object.hasOwn(values, key)) fail(`missing required option: ${key}`)
  }
  return Object.freeze(values)
}

export function validateSingleSessionOptions(raw, dependencies = {}) {
  if (!object(raw)) fail('single-session options are required')
  for (const key of ['confirmDisposableNativeHost', 'allowDisposableDaemonReset', 'sourceSha', 'treeSha', 'runNumber', 'runId', 'runAttempt', 'node', 'nodeSha256', 'sessionRoot']) {
    if (!Object.hasOwn(raw, key)) fail(`missing required option: ${key}`)
  }
  if (raw.confirmDisposableNativeHost !== true || raw.allowDisposableDaemonReset !== true) fail('both explicit disposable-host confirmations are required')
  const platform = dependencies.platform ?? process.platform
  const uid = dependencies.uid ?? (typeof process.getuid === 'function' ? process.getuid() : undefined)
  const arch = dependencies.arch ?? process.arch
  if (platform !== 'linux') fail('single-session offline rehearsal requires Linux')
  if (!Number.isInteger(uid) || uid <= 0) fail('single-session offline rehearsal requires a non-root caller')
  if (arch !== 'x64' && arch !== 'amd64') fail('single-session offline rehearsal requires Linux amd64')
  assertDockerEnvironmentSafe(dependencies.env ?? process.env)
  const fsApi = dependencies.fsApi ?? fs
  const workspaceInput = raw.workspaceRoot ?? CHECKOUT_ROOT
  let workspaceRoot
  try { workspaceRoot = fsApi.realpathSync(workspaceInput) } catch { fail('workspace root cannot be canonicalized') }
  if (workspaceRoot !== CHECKOUT_ROOT) fail('workspace root must resolve to this checkout')
  const sessionRoot = privateEmptyDirectory(fsApi, raw.sessionRoot, 'session root', platform, uid)
  if (isWithin(sessionRoot, workspaceRoot)) fail('session root may not be inside the checkout')
  if (DAEMON_ROOTS.some((root) => isWithin(sessionRoot, root))) fail('session root may not be inside disposable daemon roots')
  const paths = derivePaths(sessionRoot)
  assertFreshDerivedPaths(fsApi, paths)
  if (!path.isAbsolute(raw.node)) fail('pinned Node must be absolute')
  return Object.freeze({
    sourceSha: assertHash(raw.sourceSha, 'source SHA', SHA1),
    treeSha: assertHash(raw.treeSha, 'tree SHA', SHA1),
    runNumber: assertPositive(String(raw.runNumber), 'run number'),
    runId: assertPositive(String(raw.runId), 'run ID'),
    runAttempt: assertPositive(String(raw.runAttempt), 'run attempt'),
    node: path.resolve(raw.node),
    nodeSha256: assertHash(raw.nodeSha256, 'Node SHA-256', SHA256),
    workspaceRoot,
    sessionRoot,
    paths,
    nativeDeadlineMinutes: boundedInteger(raw.nativeDeadlineMinutes, 'native deadline minutes', 1, MAX_NATIVE_DEADLINE_MINUTES, DEFAULT_NATIVE_DEADLINE_MINUTES),
    packageDeadlineMinutes: boundedInteger(raw.packageDeadlineMinutes, 'package deadline minutes', MIN_PACKAGE_DEADLINE_MINUTES, MAX_PACKAGE_DEADLINE_MINUTES, DEFAULT_PACKAGE_DEADLINE_MINUTES),
    confirmDisposableNativeHost: true,
    allowDisposableDaemonReset: true,
  })
}

function requireNativeSuccess(result) {
  if (!object(result) || !object(result.receipt) || result.receipt.status !== 'passed') fail('native session did not return a passed receipt')
  return result
}

function requirePackageHandoff(result, options) {
  if (!object(result) || result.status !== 'passed' || result.receipt !== options.paths.packageReceipt || result.outputRoot !== options.paths.bundleRoot || result.trustRoot !== options.paths.trustRoot) fail('offline package did not return the expected handoff')
  if (!object(result.bundle) || !object(result.trust)) fail('offline package handoff is incomplete')
  const releaseId = result.bundle.releaseId
  const manifestSha256 = result.bundle.manifestSha256
  const trustedFingerprint = result.bundle.keyFingerprint
  const bootstrapSha256 = result.bundle.bootstrapSha256
  if (typeof releaseId !== 'string' || !SAFE_RELEASE_ID.test(releaseId)) fail('offline package release identity is invalid')
  if (!SHA256.test(manifestSha256 ?? '') || !SHA256.test(trustedFingerprint ?? '') || !SHA256.test(bootstrapSha256 ?? '')) fail('offline package handoff digest is invalid')
  if (result.trust.releaseId !== releaseId || result.trust.keyFingerprint !== trustedFingerprint || result.trust.bootstrapSha256 !== bootstrapSha256) fail('offline package trust handoff does not match the bundle')
  return Object.freeze({ releaseId, manifestSha256, trustedFingerprint, bootstrapSha256 })
}

function rehearsalArguments(options, handoff) {
  return [
    '--allow-disposable-daemon-reset',
    '--bundle-root', options.paths.bundleRoot,
    '--trust-root', options.paths.trustRoot,
    '--manifest-sha256', handoff.manifestSha256,
    '--release-id', handoff.releaseId,
    '--trusted-fingerprint', handoff.trustedFingerprint,
    '--bootstrap-sha256', handoff.bootstrapSha256,
    '--node', options.node,
    '--node-sha256', options.nodeSha256,
    '--source-sha', options.sourceSha,
    '--tree-sha', options.treeSha,
    '--run-id', options.runId,
    '--run-attempt', options.runAttempt,
    '--receipt', options.paths.rehearsalReceipt,
    '--workspace-root', options.workspaceRoot,
    '--run-root', options.paths.rehearsalRunRoot,
  ]
}

function requireRehearsalSuccess(result) {
  if (!object(result) || !object(result.receipt) || result.receipt.status !== 'passed') fail('offline rehearsal did not return a passed receipt')
  return result
}

function stageFailure(stage) {
  fail(`single-session ${stage} failed; inspect the stage receipt`)
}

export async function runSingleSession(rawOptions, dependencies = {}) {
  const options = validateSingleSessionOptions(rawOptions, dependencies)
  const native = dependencies.runNativeSession ?? runNativeSession
  const packageBuilder = dependencies.runLocalPackage ?? runLocalPackage
  const parseRehearsal = dependencies.parseRehearsalArguments ?? parseRehearsalArguments
  const rehearsal = dependencies.runLocalRehearsal ?? runLocalRehearsal
  let nativeResult
  try {
    nativeResult = requireNativeSuccess(await native({
      confirmDisposableNativeHost: true,
      allowDisposableDaemonReset: true,
      sourceSha: options.sourceSha,
      treeSha: options.treeSha,
      runNumber: options.runNumber,
      node: options.node,
      nodeSha256: options.nodeSha256,
      runRoot: options.paths.imageRunRoot,
      proofOutput: options.paths.imageProofRoot,
      provisionReceipt: options.paths.provisionReceipt,
      imageReceipt: options.paths.imageReceipt,
      sessionReceipt: options.paths.nativeSessionReceipt,
      deadlineMinutes: String(options.nativeDeadlineMinutes),
      workspaceRoot: options.workspaceRoot,
    }, dependencies.nativeDependencies ?? {}))
  } catch { stageFailure('native session') }
  let packageResult
  try {
    packageResult = packageBuilder({
      confirmDisposableNativeHost: true,
      allowDisposableDaemonReset: true,
      imageProofRoot: options.paths.imageProofRoot,
      imageReceipt: options.paths.imageReceipt,
      outputRoot: options.paths.bundleRoot,
      trustRoot: options.paths.trustRoot,
      receipt: options.paths.packageReceipt,
      sourceSha: options.sourceSha,
      treeSha: options.treeSha,
      node: options.node,
      nodeSha256: options.nodeSha256,
      runId: options.runId,
      runAttempt: options.runAttempt,
      deadlineMinutes: String(options.packageDeadlineMinutes),
      workspaceRoot: options.workspaceRoot,
    }, dependencies.packageDependencies ?? {})
  } catch { stageFailure('offline package') }
  let handoff
  try { handoff = requirePackageHandoff(packageResult, options) } catch { stageFailure('offline package handoff') }
  let rehearsalResult
  try {
    const parsed = parseRehearsal(rehearsalArguments(options, handoff))
    rehearsalResult = requireRehearsalSuccess(rehearsal(parsed, dependencies.rehearsalDependencies ?? {}))
  } catch { stageFailure('offline rehearsal') }
  return Object.freeze({
    status: 'passed',
    sessionRoot: options.sessionRoot,
    receipts: Object.freeze({
      nativeSession: options.paths.nativeSessionReceipt,
      offlinePackage: options.paths.packageReceipt,
      offlineRehearsal: options.paths.rehearsalReceipt,
    }),
    handoff,
    native: nativeResult.receipt,
    rehearsal: rehearsalResult.receipt,
  })
}

export function helpText() {
  return `Usage: PINNED_NODE scripts/onprem-native-full-offline-rehearsal.mjs --confirm-disposable-native-host --allow-disposable-daemon-reset --source-sha SHA1 --tree-sha SHA1 --run-number N --run-id N --run-attempt N --node ABS --node-sha256 SHA256 --session-root EMPTY_PRIVATE_ABS [--workspace-root ABS] [--native-deadline-minutes 1-60] [--package-deadline-minutes 10-60]\n\nLinux-only single-process proof. Launch this once, in the foreground, inside the dedicated native Linux/WSL host with the supplied pinned Node. It calls the existing native image session, signed offline package, and source-free rehearsal in order; it never starts Docker, changes firewall rules, or performs extra cleanup itself.\n`
}

async function main() {
  try {
    const parsed = parseSingleSessionArguments(process.argv.slice(2))
    if (parsed.help) { process.stdout.write(helpText()); return }
    const result = await runSingleSession(parsed)
    process.stdout.write(`native full offline rehearsal ${result.status}: ${result.receipts.offlineRehearsal}\n`)
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : 'native full offline rehearsal failed'}\n`)
    process.exitCode = 1
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) await main()
