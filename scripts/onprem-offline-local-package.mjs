import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { buildWorkflowSupervisor } from './onprem-local-workflow-supervisor.mjs'
import {
  acquireHostLock,
  inspectDedicatedNativeDockerHost,
  releaseHostLock,
  resetDedicatedNativeDockerHost,
  hostContract,
} from './onprem-native-docker-host.mjs'
import {
  BUNDLE_FILES,
  TRUST_FILES,
  FIXED_LINUX_TOOLS,
  assertAbsolute,
  copyHandoff,
  copyStableFile,
  directory,
  fixedToolEnvironment,
  fixedToolPath,
  freshPath,
  immutableDirectorySnapshot,
  immutableFileSnapshot,
  isWithin,
  noSymlinkAncestors,
  privateDirectory,
  readStableJsonFile,
  regularFile,
  sameSnapshot,
  stableFileSnapshot,
  validateBundleHandoff,
  validateImageProofInput,
  validateProofArtifactManifest,
} from './onprem-offline-local-package-artifacts.mjs'
export {
  FIXED_LINUX_TOOLS,
  copyStableFile,
  readStableJsonFile,
  validateBundleHandoff,
  validateImageProofInput,
  validateProofArtifactManifest,
} from './onprem-offline-local-package-artifacts.mjs'

const SCRIPT_ROOT = path.dirname(fileURLToPath(import.meta.url))
const REPOSITORY_ROOT = path.resolve(SCRIPT_ROOT, '..')
export const WORKFLOW_PATH = path.join(REPOSITORY_ROOT, '.github', 'workflows', 'onprem-offline-proof.yml')
export const PACKAGE_WORKFLOW_STEPS = Object.freeze([
  'Establish external proof root',
  'Validate proof identity and assemble complete evidence',
  'Pull pinned vendor images and save immutable archives',
  'Generate complete offline metadata and migration compatibility evidence',
  'Stage source-free release closure',
  'Create and verify signed offline bundle',
  'Emit trust receipt and bundle identity',
  'Archive verified offline bundles for mode-preserving handoff',
])
export const WORKFLOW_STEPS = PACKAGE_WORKFLOW_STEPS

const SHA1 = /^[a-f0-9]{40}$/
const SHA256 = /^[a-f0-9]{64}$/
const POSITIVE = /^[1-9][0-9]*$/
const NODE_VERSION = 'v24.19.0'
const MAX_DEADLINE_MINUTES = 60
// A package build owns a mutable Docker daemon.  Reserve enough time for the
// supervisor's TERM/KILL/reap proof and the native reset before allowing a
// workflow body to start.  Two minutes could leave neither window viable.
const MIN_DEADLINE_MINUTES = 10
const RESET_RESERVE_MINUTES = 5
const SUPERVISOR_RESERVE_MS = 30_000
const MIN_RESET_RECOVERY_MS = 60_000
const HARDENED_GIT_CONFIG = Object.freeze([
  '-c', 'core.fsmonitor=false',
  '-c', 'core.hooksPath=/dev/null',
  '-c', 'core.useBuiltinFSMonitor=false',
])
const SENSITIVE_ENV = /(?:TOKEN|PASSWORD|SECRET|PRIVATE|CREDENTIAL|AUTH|DOCKER_TLS|DOCKER_CERT|DOCKER_HOST|DOCKER_CONTEXT|DOCKER_CONFIG)/i
const REQUIRED_ENV = Object.freeze([
  'CADDY_IMAGE', 'CADDY_CONFIG_IMAGE_ID', 'POSTGRES_IMAGE', 'POSTGRES_CONFIG_IMAGE_ID',
  'POSTGRES_INSPECT_IMAGE', 'REDIS_IMAGE', 'REDIS_CONFIG_IMAGE_ID', 'SEAWEEDFS_IMAGE',
  'SEAWEEDFS_CONFIG_IMAGE_ID', 'TRIVY_IMAGE', 'SYFT_IMAGE', 'KEYCLOAK_SYNTHETIC_ACCOUNTS_ENABLED',
  'KEYCLOAK_SYNTHETIC_PHOTO_PROOF_ENABLED',
])
const BODY_REQUIREMENTS = Object.freeze({
  [PACKAGE_WORKFLOW_STEPS[0]]: /PROOF_ROOT|RUNNER_TEMP/,
  [PACKAGE_WORKFLOW_STEPS[1]]: /release-manifest\.mjs\s+verify|content-guard-index\.mjs\s+verify/,
  [PACKAGE_WORKFLOW_STEPS[2]]: /docker\s+pull[\s\S]*docker\s+save/,
  [PACKAGE_WORKFLOW_STEPS[3]]: /generateKeyPairSync\(['"]ed25519['"]\)|offline-metadata\.json/,
  [PACKAGE_WORKFLOW_STEPS[4]]: /onprem-offline-stage\.mjs/,
  [PACKAGE_WORKFLOW_STEPS[5]]: /onprem-offline-bundle\.mjs\s+create[\s\S]*onprem-offline-bundle\.mjs\s+verify/,
  [PACKAGE_WORKFLOW_STEPS[6]]: /GITHUB_OUTPUT|onprem-trust/,
  [PACKAGE_WORKFLOW_STEPS[7]]: /SHA256SUMS|sha256sum\s+--check/,
})

function fail(message) { throw new Error(message) }
function object(value) { return value !== null && typeof value === 'object' && !Array.isArray(value) }
function hashBytes(value) { return createHash('sha256').update(value).digest('hex') }
function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue)
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stableValue(value[key])]))
  return value
}
export function stableJson(value) { return JSON.stringify(stableValue(value)) }
export function receiptSelfHash(value) {
  const copy = object(value) ? { ...value } : value
  if (object(copy)) delete copy.receiptSha256
  return hashBytes(stableJson(copy))
}
export function materializeReceipt(value) {
  const payload = { ...value }
  delete payload.receiptSha256
  payload.receiptSha256 = receiptSelfHash(payload)
  return payload
}

function assertHash(value, label, expression) {
  if (typeof value !== 'string' || !expression.test(value)) fail(`${label} is invalid`)
  return value
}
function commandResult(commandRunner, file, args, options = {}) {
  if (commandRunner) {
    const result = commandRunner(file, args, options)
    return { status: Number.isInteger(result?.status) ? result.status : -1, stdout: String(result?.stdout ?? ''), stderr: String(result?.stderr ?? ''), timedOut: result?.timedOut === true }
  }
  const result = spawnSync(file, args, { cwd: options.cwd, env: options.env, encoding: 'utf8', timeout: options.timeout, windowsHide: true })
  return { status: Number.isInteger(result.status) ? result.status : -1, stdout: String(result.stdout ?? ''), stderr: String(result.stderr ?? ''), timedOut: result.error?.code === 'ETIMEDOUT' }
}
function commandOutput(file, args, options = {}) {
  const result = commandResult(options.commandRunner, file, args, options)
  if (result.status !== 0) fail(`${options.label ?? file} failed`)
  return result.stdout.trim()
}

export function assertDockerEnvironmentSafe(env = process.env) {
  for (const name of Object.keys(env ?? {})) if (/^DOCKER_/i.test(name)) fail(`${name} override is not allowed`)
}

function parseWorkflowScalar(value) {
  const trimmed = value.trim()
  if ((trimmed.startsWith("'") && trimmed.endsWith("'")) || (trimmed.startsWith('"') && trimmed.endsWith('"'))) return trimmed.slice(1, -1)
  return trimmed
}
export function parseWorkflowEnv(workflowPath = WORKFLOW_PATH) {
  regularFile(workflowPath, 'offline workflow')
  const source = fs.readFileSync(workflowPath, 'utf8').replace(/\r\n/g, '\n')
  const end = source.indexOf('\njobs:')
  if (end < 0) fail('offline workflow top-level jobs section is missing')
  const envSection = source.slice(0, end)
  const envStart = envSection.indexOf('\nenv:\n')
  if (envStart < 0) fail('offline workflow top-level env section is missing')
  const values = {}
  for (const line of envSection.slice(envStart + 6).split('\n')) {
    const match = line.match(/^  ([A-Z][A-Z0-9_]*):\s*(.*?)\s*$/)
    if (!match) continue
    const value = parseWorkflowScalar(match[2])
    if (!value || value.includes('${{')) fail(`offline workflow env value is unsupported: ${match[1]}`)
    values[match[1]] = value
  }
  for (const key of REQUIRED_ENV) if (!Object.hasOwn(values, key)) fail(`offline workflow pinned env is missing: ${key}`)
  for (const key of Object.keys(values)) if (/^DOCKER_/i.test(key)) fail(`offline workflow Docker override is not allowed: ${key}`)
  return Object.freeze(values)
}

function indentOf(line) { return (line.match(/^ */) ?? [''])[0].length }
function stepLine(line, marker) { return line.trim() === `- name: ${marker}` }
export function extractPackageWorkflowBlocks(workflowPath = WORKFLOW_PATH) {
  regularFile(workflowPath, 'offline workflow')
  const lines = fs.readFileSync(workflowPath, 'utf8').replace(/\r\n/g, '\n').split('\n')
  let previous = -1
  const blocks = {}
  for (const marker of PACKAGE_WORKFLOW_STEPS) {
    const matches = lines.map((line, index) => ({ line, index })).filter(({ line }) => stepLine(line, marker))
    if (matches.length !== 1) fail(`offline workflow marker is missing or duplicated: ${marker}`)
    const index = matches[0].index
    if (index <= previous) fail(`offline workflow markers are out of order: ${marker}`)
    previous = index
    const stepIndent = indentOf(lines[index])
    let next = lines.length
    for (let cursor = index + 1; cursor < lines.length; cursor += 1) {
      if (indentOf(lines[cursor]) === stepIndent && lines[cursor].trim().startsWith('- name: ')) { next = cursor; break }
    }
    const runs = []
    for (let cursor = index + 1; cursor < next; cursor += 1) if (lines[cursor].trim() === 'run: |') runs.push(cursor)
    if (runs.length !== 1) fail(`offline workflow run block is missing or duplicated: ${marker}`)
    const bodyIndent = indentOf(lines[runs[0]]) + 2
    const bodyLines = []
    for (let cursor = runs[0] + 1; cursor < next; cursor += 1) {
      if (lines[cursor].trim() !== '' && indentOf(lines[cursor]) < bodyIndent) fail(`offline workflow run body is malformed: ${marker}`)
      bodyLines.push(lines[cursor] === '' ? '' : lines[cursor].slice(bodyIndent))
    }
    while (bodyLines.at(-1) === '') bodyLines.pop()
    const body = `${bodyLines.join('\n')}\n`
    if (!/^set -euo pipefail\s*$/m.test(body)) fail(`offline workflow run body must be fail-closed: ${marker}`)
    if (/\$\{\{|\b(?:git\s+(?:clone|fetch|pull|checkout)|npm\s+(?:install|ci|run)|\b(?:curl|wget)\b|docker\s+build)\b/i.test(body)) fail(`offline workflow run body contains an unsupported source operation: ${marker}`)
    if (!BODY_REQUIREMENTS[marker].test(body)) fail(`offline workflow run body contract changed: ${marker}`)
    blocks[marker] = Object.freeze({ marker, body, bodySha256: hashBytes(`${marker}\n${body}`) })
  }
  return Object.freeze(blocks)
}
export const extractWorkflowBlocks = extractPackageWorkflowBlocks
export function workflowBodyDigest(blocks) {
  return hashBytes(PACKAGE_WORKFLOW_STEPS.map((marker) => `${marker}\n${blocks?.[marker]?.body ?? ''}`).join('\n'))
}
function validateWorkflowBlocks(blocks) {
  if (!object(blocks) || Object.keys(blocks).join('\u0000') !== PACKAGE_WORKFLOW_STEPS.join('\u0000')) fail('offline workflow package body set is invalid')
  for (const marker of PACKAGE_WORKFLOW_STEPS) {
    const block = blocks[marker]
    if (!object(block) || typeof block.body !== 'string' || !SHA256.test(block.bodySha256 ?? '') || block.bodySha256 !== hashBytes(`${marker}\n${block.body}`)) fail(`offline workflow package body hash is invalid: ${marker}`)
  }
  return blocks
}

export function parsePackageArguments(argv) {
  if (!Array.isArray(argv)) fail('CLI arguments are required')
  if (argv.length === 1 && argv[0] === '--help') return Object.freeze({ help: true })
  const values = {}
  const options = new Map([
    ['--image-proof-root', 'imageProofRoot'], ['--image-receipt', 'imageReceipt'], ['--output-root', 'outputRoot'], ['--trust-root', 'trustRoot'], ['--receipt', 'receipt'],
    ['--source-sha', 'sourceSha'], ['--tree-sha', 'treeSha'], ['--node', 'node'], ['--node-sha256', 'nodeSha256'], ['--run-id', 'runId'], ['--run-attempt', 'runAttempt'],
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
    if (!options.has(token)) fail(`unknown or positional argument: ${token}`)
    const key = options.get(token)
    if (Object.hasOwn(values, key)) fail(`duplicate option: ${token}`)
    const value = argv[index + 1]
    if (!value || value.startsWith('--')) fail(`missing value for ${token}`)
    values[key] = value
    index += 1
  }
  for (const key of ['confirmDisposableNativeHost', 'allowDisposableDaemonReset', 'imageProofRoot', 'imageReceipt', 'outputRoot', 'trustRoot', 'receipt', 'sourceSha', 'treeSha', 'node', 'nodeSha256', 'runId', 'runAttempt']) {
    if (!Object.hasOwn(values, key)) fail(`missing required option: ${key}`)
  }
  if (values.confirmDisposableNativeHost !== true || values.allowDisposableDaemonReset !== true) fail('both explicit disposable-host confirmations are required')
  assertHash(values.sourceSha, 'source SHA', SHA1)
  assertHash(values.treeSha, 'tree SHA', SHA1)
  assertHash(values.nodeSha256, 'Node SHA-256', SHA256)
  if (!POSITIVE.test(String(values.runId)) || !POSITIVE.test(String(values.runAttempt))) fail('run ID and run attempt must be positive decimal numbers')
  return Object.freeze(values)
}
export const parseCliArguments = parsePackageArguments

function assertPrivateParent(target, label, platform) {
  const parent = path.dirname(target)
  directory(parent, `${label} parent`)
  if (platform === 'linux' && process.platform === 'linux') {
    const stats = fs.lstatSync(parent)
    if ((stats.mode & 0o022) !== 0) fail(`${label} parent must not be group/world writable`)
  }
}
function canonicalCheckout(checkoutRoot) {
  try { return fs.realpathSync(checkoutRoot) } catch { fail('workspace root cannot be canonicalized') }
}
export function validatePackageOptions(raw, dependencies = {}) {
  if (!object(raw)) fail('package options are required')
  const required = ['confirmDisposableNativeHost', 'allowDisposableDaemonReset', 'imageProofRoot', 'imageReceipt', 'outputRoot', 'trustRoot', 'receipt', 'sourceSha', 'treeSha', 'node', 'nodeSha256', 'runId', 'runAttempt']
  for (const key of required) if (!Object.hasOwn(raw, key)) fail(`missing required option: ${key}`)
  if (raw.confirmDisposableNativeHost !== true || raw.allowDisposableDaemonReset !== true) fail('both explicit disposable-host confirmations are required')
  const platform = dependencies.platform ?? process.platform
  const uid = dependencies.uid ?? (typeof process.getuid === 'function' ? process.getuid() : undefined)
  const arch = dependencies.arch ?? process.arch
  if (platform !== 'linux') fail('local offline package builder is Linux-only')
  if (!Number.isInteger(uid) || uid <= 0) fail('local offline package builder must run as a non-root user')
  if (arch !== 'x64' && arch !== 'amd64') fail('local offline package builder requires Linux amd64')
  assertDockerEnvironmentSafe(dependencies.env ?? process.env)
  const sourceSha = assertHash(raw.sourceSha, 'source SHA', SHA1)
  const treeSha = assertHash(raw.treeSha, 'tree SHA', SHA1)
  const nodeSha256 = assertHash(raw.nodeSha256, 'Node SHA-256', SHA256)
  if (!POSITIVE.test(String(raw.runId)) || !POSITIVE.test(String(raw.runAttempt))) fail('run ID and run attempt must be positive decimal numbers')
  const deadlineMinutes = raw.deadlineMinutes === undefined ? 60 : Number(raw.deadlineMinutes)
  if (!Number.isInteger(deadlineMinutes) || deadlineMinutes < MIN_DEADLINE_MINUTES || deadlineMinutes > MAX_DEADLINE_MINUTES) fail(`deadline-minutes must be between ${MIN_DEADLINE_MINUTES} and ${MAX_DEADLINE_MINUTES}`)
  const checkout = canonicalCheckout(dependencies.checkoutRoot ?? REPOSITORY_ROOT)
  const workspaceRoot = canonicalCheckout(raw.workspaceRoot ?? checkout)
  if (workspaceRoot !== checkout) fail('workspace root must resolve to this checkout')
  const imageProofRootInput = assertAbsolute(raw.imageProofRoot, 'image proof root')
  immutableDirectorySnapshot(imageProofRootInput, 'image proof root', { platform, uid })
  const imageProofRoot = canonicalCheckout(imageProofRootInput)
  const imageProofRootSnapshot = immutableDirectorySnapshot(imageProofRoot, 'image proof root', { platform, uid })
  const imageReceipt = assertAbsolute(raw.imageReceipt, 'image receipt')
  const imageReceiptSnapshot = immutableFileSnapshot(imageReceipt, 'image receipt', { platform, uid })
  const node = assertAbsolute(raw.node, 'pinned Node')
  const nodeSnapshot = immutableFileSnapshot(node, 'pinned Node', { platform, uid: undefined, privateMode: false })
  const outputRoot = freshPath(raw.outputRoot, 'output root')
  const trustRoot = freshPath(raw.trustRoot, 'trust root')
  const receipt = freshPath(raw.receipt, 'receipt')
  for (const [candidate, label] of [[imageProofRoot, 'image proof root'], [imageReceipt, 'image receipt'], [outputRoot, 'output root'], [trustRoot, 'trust root'], [receipt, 'receipt']]) {
    if (isWithin(candidate, workspaceRoot)) fail(`${label} may not be inside the checkout`)
  }
  for (const [candidate, label] of [[outputRoot, 'output root'], [trustRoot, 'trust root'], [receipt, 'receipt']]) {
    if (isWithin(candidate, imageProofRoot)) fail(`${label} may not be inside image proof input`)
    assertPrivateParent(candidate, label, platform)
  }
  const paths = { imageProofRoot, imageReceipt, outputRoot, trustRoot, receipt }
  const names = Object.keys(paths)
  for (let left = 0; left < names.length; left += 1) for (let right = left + 1; right < names.length; right += 1) {
    const a = paths[names[left]]; const b = paths[names[right]]
    if (isWithin(a, b) || isWithin(b, a)) fail('package input/output paths may not overlap')
  }
  if (nodeSnapshot.sha256 !== nodeSha256) fail('pinned Node SHA-256 mismatch')
  return Object.freeze({ sourceSha, treeSha, node, nodeSha256, nodeSnapshot, workspaceRoot, imageProofRoot, imageProofRootSnapshot, imageReceipt, imageReceiptSnapshot, outputRoot, trustRoot, receipt, runId: String(raw.runId), runAttempt: String(raw.runAttempt), deadlineMinutes, confirmDisposableNativeHost: true, allowDisposableDaemonReset: true, platform, uid })
}
export const validateCliOptions = validatePackageOptions

function readGitIdentity(workspaceRoot, commandRunner, runnerTemp) {
  fixedToolPath('git')
  const statusInvocation = buildHardenedGitInvocation(['-C', workspaceRoot, 'status', '--porcelain=v1', '--untracked-files=all', '--ignore-submodules=none'], runnerTemp)
  const status = commandOutput(statusInvocation.file, statusInvocation.args, { commandRunner, env: statusInvocation.env, label: 'clean checkout preflight' })
  if (status) fail('checkout tree is not clean')
  const headInvocation = buildHardenedGitInvocation(['-C', workspaceRoot, 'rev-parse', 'HEAD'], runnerTemp)
  const treeInvocation = buildHardenedGitInvocation(['-C', workspaceRoot, 'rev-parse', 'HEAD^{tree}'], runnerTemp)
  const head = commandOutput(headInvocation.file, headInvocation.args, { commandRunner, env: headInvocation.env, label: 'checkout source SHA' })
  const tree = commandOutput(treeInvocation.file, treeInvocation.args, { commandRunner, env: treeInvocation.env, label: 'checkout tree SHA' })
  return { head, tree }
}
function scrubbedGitEnvironment(runnerTemp) {
  const emptyConfig = path.join(runnerTemp, 'empty-git-config')
  if (!fs.existsSync(emptyConfig)) fs.writeFileSync(emptyConfig, '', { mode: 0o600 })
  return { ...fixedToolEnvironment(path.join(runnerTemp, 'git-home')), GIT_CONFIG_GLOBAL: emptyConfig, GIT_CONFIG_SYSTEM: emptyConfig }
}
export function buildHardenedGitInvocation(args, runnerTemp) {
  if (!Array.isArray(args) || typeof runnerTemp !== 'string' || !path.isAbsolute(runnerTemp)) fail('hardened Git invocation is invalid')
  const emptyConfig = path.join(runnerTemp, 'empty-git-config')
  return Object.freeze({
    file: FIXED_LINUX_TOOLS.git,
    args: Object.freeze([...HARDENED_GIT_CONFIG, ...args]),
    env: Object.freeze({ ...fixedToolEnvironment(path.join(runnerTemp, 'git-home')), GIT_CONFIG_GLOBAL: emptyConfig, GIT_CONFIG_SYSTEM: emptyConfig }),
  })
}
export function createDetachedCheckout(options, runnerTemp, dependencies = {}) {
  const snapshot = path.join(runnerTemp, 'execution-checkout')
  if (fs.existsSync(snapshot)) fail('execution checkout must be fresh and absent')
  privateDirectory(path.join(runnerTemp, 'git-home'), 'execution checkout Git home')
  const env = scrubbedGitEnvironment(runnerTemp)
  fixedToolPath('git')
  const cloneInvocation = buildHardenedGitInvocation(['clone', '--no-local', '--no-hardlinks', '--no-checkout', '--', options.workspaceRoot, snapshot], runnerTemp)
  const result = spawnSync(cloneInvocation.file, cloneInvocation.args, {
    cwd: runnerTemp,
    env,
    stdio: ['ignore', 'inherit', 'inherit'],
    windowsHide: true,
  })
  if (result.status !== 0) fail('detached execution checkout clone failed')
  try { fs.chmodSync(snapshot, 0o700) } catch { /* Linux caller mode is enforced by the surrounding private root. */ }
  const checkoutInvocation = buildHardenedGitInvocation(['-C', snapshot, 'checkout', '--detach', options.sourceSha], runnerTemp)
  const checkout = spawnSync(checkoutInvocation.file, checkoutInvocation.args, {
    cwd: runnerTemp,
    env,
    stdio: ['ignore', 'inherit', 'inherit'],
    windowsHide: true,
  })
  if (checkout.status !== 0) fail('detached execution checkout SHA selection failed')
  const gitRunner = (file, args, runnerOptions = {}) => spawnSync(file, args, { cwd: runnerTemp, env, encoding: 'utf8', windowsHide: true, ...runnerOptions })
  const identity = readGitIdentity(snapshot, gitRunner, runnerTemp)
  if (identity.head !== options.sourceSha || identity.tree !== options.treeSha) fail('detached execution checkout identity mismatch')
  // --no-local/--no-hardlinks keeps the clone independent from caller inode
  // identity; recheck the materialized tree before any workflow body runs.
  const stack = [snapshot]
  while (stack.length > 0) {
    const current = stack.pop()
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const target = path.join(current, entry.name)
      if (entry.isSymbolicLink()) fail('detached execution checkout contains a symlink')
      if (entry.isDirectory()) stack.push(target)
      else if (entry.isFile()) {
        const stats = fs.lstatSync(target)
        if (stats.nlink !== undefined && stats.nlink !== 1) fail('detached execution checkout contains a hardlink')
      }
    }
  }
  return Object.freeze({ root: snapshot, git: identity, env })
}
function callerGitPreflight(workspaceRoot, commandRunner) {
  const preflightRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'onprem-package-git-preflight-'))
  try {
    fs.chmodSync(preflightRoot, 0o700)
    privateDirectory(path.join(preflightRoot, 'git-home'), 'caller Git preflight home')
    scrubbedGitEnvironment(preflightRoot)
    return readGitIdentity(workspaceRoot, commandRunner, preflightRoot)
  } finally {
    try { fs.rmSync(preflightRoot, { recursive: true, force: true }) } catch { /* preflight contains no secret or host mutation */ }
  }
}
export function stagePinnedNode(options, runnerTemp, dependencies = {}) {
  const binDir = path.join(runnerTemp, 'pinned-node-bin')
  privateDirectory(binDir, 'private pinned Node bin')
  const staged = path.join(binDir, 'node')
  noSymlinkAncestors(staged, 'private pinned Node copy')
  const copied = copyStableFile(options.node, staged, 'pinned Node', {
    sourceOptions: { platform: process.platform, uid: undefined, privateMode: false, beforeRead: dependencies.beforeRead },
    destinationOptions: { platform: process.platform, uid: undefined, privateMode: true },
  })
  if (copied.sha256 !== options.nodeSha256) fail('private pinned Node copy SHA-256 mismatch')
  try { fs.chmodSync(staged, 0o700) } catch { /* Linux mode is set at creation */ }
  const stagedSnapshot = stableFileSnapshot(staged, 'private pinned Node copy', { platform: process.platform, uid: undefined, privateMode: true })
  if (stagedSnapshot.sha256 !== options.nodeSha256) fail('private pinned Node copy changed after staging')
  return Object.freeze({ binDir, path: staged, snapshot: stagedSnapshot, sha256: stagedSnapshot.sha256 })
}
export function validateNodeRuntime(options, commandRunner, staged) {
  if (!object(staged) || staged.path !== path.join(staged.binDir ?? '', 'node') || !path.isAbsolute(staged.path)) fail('staged pinned Node identity is invalid')
  const env = { ...fixedToolEnvironment('/nonexistent'), PATH: `${staged.binDir}:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin` }
  const probe = [
    "const { createHash } = require('node:crypto')",
    "const { createReadStream, realpathSync } = require('node:fs')",
    "const digest = createHash('sha256')",
    "const stream = createReadStream(process.execPath)",
    "stream.on('data', (chunk) => digest.update(chunk))",
    "stream.on('error', () => process.exit(91))",
    "stream.on('end', () => process.stdout.write(JSON.stringify({ version: process.version, execPath: process.execPath, realPath: realpathSync(process.execPath), sha256: digest.digest('hex') })))",
  ].join(';')
  const output = commandOutput('node', ['-e', probe], { commandRunner, label: 'bare pinned Node runtime', env })
  let identity
  try { identity = JSON.parse(output) } catch { fail('bare pinned Node runtime identity is invalid') }
  if (identity.version !== NODE_VERSION) fail(`pinned Node runtime must be ${NODE_VERSION}`)
  if (identity.execPath !== staged.path || identity.realPath !== staged.path) fail('bare pinned Node did not resolve to the private staged path')
  if (identity.sha256 !== options.nodeSha256 || staged.sha256 !== options.nodeSha256) fail('bare pinned Node SHA-256 mismatch')
  return { path: staged.path, binDir: staged.binDir, version: identity.version, sha256: identity.sha256, bareResolutionProved: true }
}
function emptyInventory(value) {
  const inventory = value?.inventory
  if (!object(inventory)) return false
  return ['containers', 'networks', 'volumes', 'images'].every((key) => Array.isArray(inventory[key]) ? inventory[key].length === 0 : inventory[key] === 0 || inventory[key] === null)
}
function sanitizeHost(value) {
  if (!object(value)) return null
  return { contract: value.contract ?? null, socket: value.socket ?? null, dockerRootDir: value.dockerRootDir ?? null, inventory: object(value.inventory) ? { containers: value.inventory.containers ?? null, networks: value.inventory.networks ?? null, volumes: value.inventory.volumes ?? null, images: value.inventory.images ?? null } : null }
}
function sanitizeError(error) {
  const code = typeof error?.code === 'string' && /^[A-Z0-9_.:-]{1,80}$/.test(error.code) ? error.code : 'PACKAGE_FAILURE'
  return { code }
}
function bestEffortFailureReceipt(raw, error, options = null) {
  const candidate = options?.receipt ?? (typeof raw?.receipt === 'string' && path.isAbsolute(raw.receipt) ? path.resolve(raw.receipt) : null)
  if (!candidate || fs.existsSync(candidate)) return false
  try {
    const parent = path.dirname(candidate)
    if (!fs.existsSync(parent) || !fs.statSync(parent).isDirectory()) return false
    noSymlinkAncestors(parent, 'failure receipt parent')
    if (isWithin(candidate, REPOSITORY_ROOT)) return false
    if (typeof raw?.imageProofRoot === 'string' && path.isAbsolute(raw.imageProofRoot) && isWithin(candidate, path.resolve(raw.imageProofRoot))) return false
    const fallback = options ?? {
      sourceSha: SHA1.test(String(raw?.sourceSha ?? '')) ? raw.sourceSha : null,
      treeSha: SHA1.test(String(raw?.treeSha ?? '')) ? raw.treeSha : null,
    }
    const receipt = buildPackageReceipt(fallback, { status: 'failed', failure: sanitizeError(error), cleanup: { runnerTemp: 'not-started', privateKeyPreserved: false } })
    fs.writeFileSync(candidate, `${JSON.stringify(receipt)}\n`, { flag: 'wx', mode: 0o600 })
    try { fs.chmodSync(candidate, 0o600) } catch {}
    return true
  } catch { return false }
}

function copyProofDownload(manifestFacts, target) {
  privateDirectory(target, 'PROOF_DOWNLOAD')
  for (const file of manifestFacts.files) {
    const destination = path.resolve(target, ...file.path.split('/'))
    if (!isWithin(destination, target)) fail('proof artifact destination escaped PROOF_DOWNLOAD')
    fs.mkdirSync(path.dirname(destination), { recursive: true, mode: 0o700 })
    noSymlinkAncestors(destination, `PROOF_DOWNLOAD/${file.path}`)
    const copied = copyStableFile(file.source, destination, `proof artifact ${file.path}`, {
      sourceOptions: { platform: process.platform, uid: typeof process.getuid === 'function' ? process.getuid() : undefined, privateMode: false },
      destinationOptions: { platform: process.platform, uid: typeof process.getuid === 'function' ? process.getuid() : undefined, privateMode: true },
    })
    if (copied.sha256 !== file.sha256 || copied.bytes !== file.bytes) fail(`copied proof artifact verification failed: ${file.path}`)
  }
}
function verifyImmutableInputSnapshots(manifestFacts, imageFacts, options) {
  const rootAfter = immutableDirectorySnapshot(options.imageProofRoot, 'image proof root', { platform: options.platform ?? process.platform, uid: options.uid })
  if (!sameSnapshot(options.imageProofRootSnapshot, rootAfter) || !sameSnapshot(manifestFacts.rootSnapshot, rootAfter)) fail('image proof root changed before workflow validation')
  const platform = options.platform ?? process.platform
  const uid = options.uid
  const manifestAfter = stableFileSnapshot(manifestFacts.manifestPath, 'proof artifact manifest', { platform, uid })
  if (!sameSnapshot(manifestFacts.manifestSnapshot, manifestAfter)) fail('proof artifact manifest changed before workflow validation')
  const receiptAfter = stableFileSnapshot(options.imageReceipt, 'image receipt', { platform, uid })
  if (!sameSnapshot(options.imageReceiptSnapshot, receiptAfter) || !sameSnapshot(imageFacts.imageReceiptSnapshot, receiptAfter)) fail('image receipt changed before workflow validation')
  for (const file of manifestFacts.files) {
    const after = stableFileSnapshot(file.source, `proof artifact ${file.path}`, { platform, uid, privateMode: false })
    if (!sameSnapshot(file.snapshot, after)) fail(`proof artifact changed before workflow validation: ${file.path}`)
  }
  return true
}
function controllerEnvironment(options, runnerTemp) {
  const env = {
    PATH: '/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin',
    LANG: 'C',
    LC_ALL: 'C',
    HOME: path.join(runnerTemp, 'controller-home'),
    GITHUB_RUN_ID: options.runId,
    GITHUB_RUN_ATTEMPT: options.runAttempt,
  }
  fs.mkdirSync(env.HOME, { recursive: true, mode: 0o700 })
  return env
}
function workflowEnvironment(options, pinned, runnerTemp, proofRoot, proofDownload, githubOutput, githubEnv, executionRoot, nodePath) {
  const inherited = {}
  for (const name of ['LANG', 'LC_ALL', 'USER', 'LOGNAME', 'SHELL', 'TERM']) if (process.env[name] && !SENSITIVE_ENV.test(name)) inherited[name] = process.env[name]
  const nodeDirectory = path.dirname(nodePath)
  const env = {
    ...inherited,
    PATH: `${nodeDirectory}:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin`,
    HOME: path.join(runnerTemp, 'home'),
    GITHUB_WORKSPACE: executionRoot,
    RUNNER_TEMP: runnerTemp,
    GITHUB_OUTPUT: githubOutput,
    GITHUB_ENV: githubEnv,
    GITHUB_RUN_ID: options.runId,
    GITHUB_RUN_ATTEMPT: options.runAttempt,
    GITHUB_SHA: options.sourceSha,
    EXPECTED_SHA: options.sourceSha,
    EXECUTION_SHA: options.sourceSha,
    PROOF_ARTIFACT_NAME: `onprem-image-proof-${options.sourceSha}`,
    PROOF_ROOT: proofRoot,
    PROOF_DOWNLOAD: proofDownload,
    PINNED_NODE_SOURCE: nodePath,
    BUILD_TIMESTAMP: new Date().toISOString(),
    DOCKER_CONTEXT: 'default',
    DOCKER_HOST: `unix://${hostContract.socket}`,
    DOCKER_CONFIG: path.join(runnerTemp, 'docker-config'),
    ...pinned,
  }
  fs.mkdirSync(env.HOME, { recursive: true, mode: 0o700 })
  fs.mkdirSync(env.DOCKER_CONFIG, { recursive: true, mode: 0o700 })
  return env
}
export function runWorkflowBody(body, options) {
  const startedAt = Date.now()
  const timeoutSeconds = Math.max(1, Math.ceil(options.timeoutMs / 1000))
  const runnerTemp = options.runnerTemp ?? options.env?.RUNNER_TEMP
  if (typeof runnerTemp !== 'string' || !path.isAbsolute(runnerTemp)) return { status: 'failed', exitCode: null, signal: null, timedOut: false, containmentComplete: false, durationMs: Date.now() - startedAt }
  const supervisorRunner = options.supervisorRunner
  const bashPath = supervisorRunner ? (options.bashPath ?? 'bash') : fixedToolPath('bash')
  const setsidPath = supervisorRunner ? (options.setsidPath ?? 'setsid') : fixedToolPath('setsid')
  const suffix = `${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}`
  const timeoutMarker = path.join(runnerTemp, `.workflow-timeout-${suffix}`)
  const leaderMarker = path.join(runnerTemp, `.workflow-leader-${suffix}`)
  const containmentMarker = path.join(runnerTemp, `.workflow-contained-${suffix}`)
  const supervisor = buildWorkflowSupervisor({ bashPath, setsidPath })
  const invoke = supervisorRunner ?? ((file, args, spawnOptions) => spawnSync(file, args, spawnOptions))
  let result
  try {
    result = invoke(bashPath, ['--noprofile', '--norc', '-e', '-u', '-o', 'pipefail', '-c', supervisor, 'offline-workflow-supervisor', timeoutMarker, leaderMarker, containmentMarker, body, String(timeoutSeconds)], {
      cwd: options.workspaceRoot,
      env: options.env,
      stdio: ['ignore', 'inherit', 'inherit'],
      timeout: options.timeoutMs + SUPERVISOR_RESERVE_MS,
      killSignal: 'SIGTERM',
      windowsHide: true,
    })
  } catch (error) {
    // The caller receives a bounded failure record and can retain the lock and
    // runner evidence; raw supervisor errors never enter the package receipt.
    result = {
      error: { code: typeof error?.code === 'string' ? error.code : 'SUPERVISOR_FAILED', timedOut: error?.code === 'ETIMEDOUT' },
      status: Number.isInteger(error?.status) ? error.status : null,
      signal: typeof error?.signal === 'string' ? error.signal : null,
    }
  }
  let timedOut = false
  let containmentComplete = false
  const outerSupervisorTimedOut = result?.error?.timedOut === true || result?.error?.code === 'ETIMEDOUT'
  try {
    timedOut = outerSupervisorTimedOut || fs.existsSync(timeoutMarker)
    containmentComplete = !outerSupervisorTimedOut && fs.existsSync(containmentMarker) && fs.readFileSync(containmentMarker, 'utf8').trim() === '1'
  } finally {
    // Marker contents are bounded numeric/empty evidence only. Preserve them
    // with the retained runner temp when containment is unproved so the leader
    // process group remains available for manual recovery.
    if (containmentComplete) {
      for (const marker of [timeoutMarker, leaderMarker, containmentMarker]) {
        try { fs.rmSync(marker, { force: true }) } catch { /* receipt records containment failure */ }
      }
    }
  }
  const durationMs = Date.now() - startedAt
  const exitCode = Number.isInteger(result?.status) ? result.status : null
  const signal = result?.signal ?? result?.error?.signal ?? null
  if (result?.error) return { status: 'failed', exitCode, signal, timedOut, containmentComplete, durationMs }
  return { status: result?.status === 0 && !timedOut && containmentComplete ? 'passed' : 'failed', exitCode, signal, timedOut, containmentComplete, durationMs }
}

function parseGithubOutput(filePath) {
  regularFile(filePath, 'GITHUB_OUTPUT')
  const entries = {}
  for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/).filter(Boolean)) {
    const index = line.indexOf('=')
    if (index <= 0) fail('GITHUB_OUTPUT is malformed')
    const key = line.slice(0, index); const value = line.slice(index + 1)
    if (!['release_id', 'key_fingerprint', 'bootstrap_sha256', 'bundle_archive_manifest_sha256'].includes(key) || Object.hasOwn(entries, key)) fail('GITHUB_OUTPUT contains unsupported package state')
    entries[key] = value
  }
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(entries.release_id ?? '') || !SHA256.test(entries.key_fingerprint ?? '') || !SHA256.test(entries.bootstrap_sha256 ?? '') || !SHA256.test(entries.bundle_archive_manifest_sha256 ?? '')) fail('GITHUB_OUTPUT package identity is invalid')
  return entries
}
export const parsePackageOutput = parseGithubOutput
export const validateHandoff = validateBundleHandoff
function initialHostEmpty(host) { if (!emptyInventory(host)) fail('dedicated native Docker host is not initially empty') }

export function buildPackageReceipt(options, facts = {}) {
  return materializeReceipt({
    schemaVersion: 1,
    tool: 'onprem-offline-local-package',
    status: facts.status ?? 'failed',
    hostedEvidence: false,
    dataClass: 'synthetic',
    source: { sourceSha: options.sourceSha, treeSha: options.treeSha },
    // Bind a reusable package checkpoint to the exact local invocation.  A
    // resume may reuse only this completed package, never an arbitrary log
    // line or an unbound output directory.
    execution: { runNumber: options.runNumber === undefined ? null : String(options.runNumber), runId: options.runId === undefined ? null : String(options.runId), runAttempt: options.runAttempt === undefined ? null : String(options.runAttempt) },
    runner: facts.runner ?? null,
    workflow: facts.workflow ?? null,
    imageProof: facts.imageProof ?? null,
    phases: Array.isArray(facts.phases) ? facts.phases : [],
    bundle: facts.bundle ?? null,
    trust: facts.trust ?? null,
    reset: facts.reset ?? { attempted: false, status: 'not-attempted', initialEmpty: false, afterEmpty: false },
    cleanup: facts.cleanup ?? { runnerTemp: 'not-run', privateKeyPreserved: false },
    failure: facts.failure ?? null,
  })
}

function observePrivateKeyPreservation(runnerTemp, runnerCleanup, dependencies) {
  if (runnerCleanup === 'removed') return false
  if (runnerCleanup === 'cleanup-unverified') return null
  try {
    const parent = (dependencies.lstatRunnerTemp ?? fs.lstatSync)(runnerTemp)
    if (typeof parent?.isDirectory !== 'function' || typeof parent?.isSymbolicLink !== 'function' || !Number.isInteger(parent?.mode) || !parent.isDirectory() || parent.isSymbolicLink() || (parent.mode & 0o077) !== 0) return null
    try {
      const key = (dependencies.lstatPrivateKey ?? fs.lstatSync)(path.join(runnerTemp, 'onprem-offline-private.pem'))
      return typeof key?.isFile === 'function' && typeof key?.isSymbolicLink === 'function' && key.isFile() && !key.isSymbolicLink() ? true : null
    } catch (error) { return error?.code === 'ENOENT' ? false : null }
  } catch { return null }
}

export function runLocalPackage(rawOptions, dependencies = {}) {
  let options
  try { options = validatePackageOptions(rawOptions, dependencies) } catch (error) { bestEffortFailureReceipt(rawOptions, error); throw error }
  const commandRunner = dependencies.commandRunner
  let nodeIdentity; let git; let manifestFacts; let imageFacts
  try {
    git = dependencies.gitIdentity ?? callerGitPreflight(options.workspaceRoot, commandRunner)
    if (git.head !== options.sourceSha || git.tree !== options.treeSha) fail('checkout is not the exact clean requested source identity')
    const validateManifest = dependencies.validateProofArtifactManifest ?? validateProofArtifactManifest
    const validateImage = dependencies.validateImageProofInput ?? validateImageProofInput
    manifestFacts = validateManifest(options.imageProofRoot, options)
    imageFacts = validateImage(options, manifestFacts, dependencies)
  } catch (error) {
    bestEffortFailureReceipt(rawOptions, error, options)
    throw error
  }
  const outputRoot = options.outputRoot; const trustRoot = options.trustRoot
  try { privateDirectory(outputRoot, 'output root'); privateDirectory(trustRoot, 'trust root') } catch (error) { bestEffortFailureReceipt(rawOptions, error, options); throw error }
  // Keep the disposable workflow root beside (rather than inside) the caller's
  // final output root so the handoff directory can be checked for an exact
  // four-file inventory after the workflow finishes.
  const runnerTemp = fs.mkdtempSync(path.join(path.dirname(outputRoot), '.onprem-offline-package-'))
  try { fs.chmodSync(runnerTemp, 0o700) } catch {}
  const proofRoot = path.join(runnerTemp, 'onprem-proof'); const proofDownload = path.join(proofRoot, 'download')
  const githubOutput = path.join(runnerTemp, 'github-output'); const githubEnv = path.join(runnerTemp, 'github-env')
  let executionRoot; let workflowPath; let workflowSha256; let blocks; let pinned; let env; let controllerEnv
  try {
    fs.writeFileSync(githubOutput, '', { mode: 0o600 }); fs.writeFileSync(githubEnv, '', { mode: 0o600 })
    const createCheckout = dependencies.createDetachedCheckout ?? createDetachedCheckout
    const execution = createCheckout(options, runnerTemp, dependencies)
    executionRoot = execution?.root ?? execution
    if (typeof executionRoot !== 'string' || !path.isAbsolute(executionRoot)) fail('detached execution checkout is invalid')
    executionRoot = canonicalCheckout(executionRoot)
    const executionGit = execution?.git ?? readGitIdentity(executionRoot, dependencies.executionCommandRunner ?? commandRunner, runnerTemp)
    if (executionGit.head !== options.sourceSha || executionGit.tree !== options.treeSha) fail('detached execution checkout is not the exact requested identity')
    workflowPath = path.join(executionRoot, '.github', 'workflows', 'onprem-offline-proof.yml')
    if (dependencies.workflowBlocks) blocks = validateWorkflowBlocks(dependencies.workflowBlocks)
    else blocks = extractPackageWorkflowBlocks(workflowPath)
    if (dependencies.workflowEnv) pinned = dependencies.workflowEnv
    else pinned = parseWorkflowEnv(workflowPath)
    workflowSha256 = stableFileSnapshot(workflowPath, 'offline workflow snapshot', { platform: process.platform, uid: undefined, privateMode: false }).sha256
    const stageNode = dependencies.stagePinnedNode ?? stagePinnedNode
    const stagedNode = stageNode(options, runnerTemp)
    const validateNode = dependencies.validateNodeRuntime ?? validateNodeRuntime
    const validatedNode = validateNode(options, commandRunner, stagedNode)
    nodeIdentity = { ...validatedNode, path: stagedNode.path, sha256: stagedNode.sha256, execution: 'private-verified-copy' }
    env = workflowEnvironment(options, pinned, runnerTemp, proofRoot, proofDownload, githubOutput, githubEnv, executionRoot, nodeIdentity.path)
    controllerEnv = controllerEnvironment(options, runnerTemp)
  } catch (error) {
    try { fs.rmSync(runnerTemp, { recursive: true, force: true }) } catch {}
    bestEffortFailureReceipt(rawOptions, error, options)
    throw error
  }
  const totalBudgetMs = options.deadlineMinutes * 60_000
  // Keep an independent recovery window out of the workflow body's budget. A
  // mutation may never start once that window begins, so reset can still be
  // called with a viable deadline and prove an empty host after recovery.
  const resetReserveMs = Math.max(RESET_RESERVE_MINUTES * 60_000, Math.min(10 * 60_000, Math.floor(totalBudgetMs * 0.4)))
  const startedAtMs = Date.now()
  const workflowDeadlineAt = startedAtMs + totalBudgetMs - resetReserveMs - SUPERVISOR_RESERVE_MS
  const resetDeadlineAt = startedAtMs + totalBudgetMs
  const phases = []
  let lock = null; let mutationAttempted = false; let initialHost = null; let afterHost = null; let reset = { attempted: false, status: 'not-attempted', initialEmpty: false, afterEmpty: false }
  // A body is allowed to advance only after its supervisor has proved that the
  // child process group was reaped.  Once proof is missing, retain the lock and
  // disposable checkout so an operator can inspect/recover the host safely.
  let containmentComplete = true
  let runnerCleanup = 'not-run'
  let lockCleanup = 'not-run'
  let recoveryDeadlineViable = false
  const executeBody = dependencies.executeBody ?? runWorkflowBody
  const controller = { acquireHostLock, inspectDedicatedNativeDockerHost, resetDedicatedNativeDockerHost, releaseHostLock, ...(dependencies.controller ?? {}) }
  const controllerOptions = { platform: 'linux', uid: dependencies.uid ?? process.getuid?.(), env: controllerEnv, commandRunner: dependencies.hostCommandRunner, fsApi: dependencies.fsApi }
  let failure = null; let bundleFacts = null; let trustFacts = null; let identity = null
  const validateHandoff = dependencies.validateBundleHandoff ?? validateBundleHandoff
  const copyFinalHandoff = dependencies.copyHandoff ?? copyHandoff
  const proveRecovery = () => {
    if (!mutationAttempted) return
    if (reset.attempted) {
      if (reset.status !== 'passed') fail('native Docker host reset was not proved')
      return
    }
    reset.attempted = true
    try {
      const remainingRecoveryMs = resetDeadlineAt - Date.now()
      if (remainingRecoveryMs < MIN_RESET_RECOVERY_MS) fail('native Docker host reset recovery window is unavailable after supervisor reserve')
      recoveryDeadlineViable = true
      const resetResult = controller.resetDedicatedNativeDockerHost({ ...controllerOptions, lock, recoveryDeadlineAt: resetDeadlineAt })
      if (resetResult?.dockerDaemonReset !== true) fail('native Docker host reset result is unverified')
      afterHost = controller.inspectDedicatedNativeDockerHost({ ...controllerOptions, lock, allowMutableInventory: false })
      initialHostEmpty(afterHost)
      reset.afterEmpty = true
      reset.status = 'passed'
    } catch (error) {
      reset.status = 'failed'
      throw error
    }
  }
  try {
    lock = controller.acquireHostLock(controllerOptions)
    initialHost = controller.inspectDedicatedNativeDockerHost({ ...controllerOptions, lock, allowMutableInventory: false })
    initialHostEmpty(initialHost); reset.initialEmpty = true
    for (const marker of PACKAGE_WORKFLOW_STEPS) {
      if (marker === PACKAGE_WORKFLOW_STEPS[1]) {
        const inputStartedAt = Date.now()
        verifyImmutableInputSnapshots(manifestFacts, imageFacts, options)
        copyProofDownload(manifestFacts, proofDownload)
        verifyImmutableInputSnapshots(manifestFacts, imageFacts, options)
        phases.push({ name: 'validate-and-copy-proof-input', marker: null, status: 'passed', exitCode: 0, signal: null, timedOut: false, durationMs: Date.now() - inputStartedAt })
      }
      if (marker === PACKAGE_WORKFLOW_STEPS[2]) mutationAttempted = true
      const phase = { name: marker, marker, bodySha256: blocks[marker].bodySha256, startedAt: new Date().toISOString() }
      const remainingMs = workflowDeadlineAt - Date.now()
      // Mark the proof incomplete before invoking the body.  A thrown runner,
      // timeout, or malformed result must not reach reset/cleanup as if its
      // process group had been contained.
      containmentComplete = false
      const result = remainingMs > 0
        ? executeBody(blocks[marker].body, { workspaceRoot: executionRoot, cwd: executionRoot, runnerTemp, env, timeoutMs: remainingMs, supervisorReserveMs: SUPERVISOR_RESERVE_MS, marker, bodySha256: blocks[marker].bodySha256 })
        : { status: 'failed', exitCode: null, signal: null, timedOut: true, containmentComplete: false, durationMs: 0 }
      Object.assign(phase, { completedAt: new Date().toISOString(), status: result.timedOut === true ? 'failed' : result.status, exitCode: result.exitCode, signal: result.signal, timedOut: result.timedOut, containmentComplete: result.containmentComplete === true, durationMs: result.durationMs }); phases.push(phase)
      if (result.containmentComplete !== true) {
        const containmentError = new Error(`workflow process-group containment failed: ${marker}`)
        containmentError.code = 'WORKFLOW_CONTAINMENT_FAILED'
        throw containmentError
      }
      containmentComplete = true
      if (result.timedOut === true) fail(`workflow body timed out: ${marker}`)
      if (result.status !== 'passed') fail(`workflow body failed: ${marker}`)
    }
    // The daemon recovery boundary is deliberately the first action after the
    // last contained workflow body.  No output parsing, archive validation, or
    // handoff is permitted until reset and empty inventory are both proved.
    proveRecovery()
    identity = parseGithubOutput(githubOutput)
    bundleFacts = validateHandoff(path.join(runnerTemp, 'onprem-bundle-archives'), path.join(runnerTemp, 'onprem-trust'), { sourceSha: options.sourceSha, releaseId: identity.release_id, keyFingerprint: identity.key_fingerprint, bootstrapSha256: identity.bootstrap_sha256 })
    if (bundleFacts.manifestSha256 !== identity.bundle_archive_manifest_sha256) fail('bundle archive manifest identity does not match GITHUB_OUTPUT')
    copyFinalHandoff(path.join(runnerTemp, 'onprem-bundle-archives'), outputRoot, BUNDLE_FILES, bundleFacts.archiveFiles)
    copyFinalHandoff(path.join(runnerTemp, 'onprem-trust'), trustRoot, TRUST_FILES, bundleFacts.trustFiles)
    phases.push({ name: 'verify-and-copy-handoff', marker: null, status: 'passed', exitCode: 0, signal: null, timedOut: false, durationMs: 0 })
    trustFacts = { releaseId: bundleFacts.releaseId, keyFingerprint: bundleFacts.keyFingerprint, bootstrapSha256: bundleFacts.bootstrapSha256 }
  } catch (error) {
    failure = sanitizeError(error)
  } finally {
    if (!containmentComplete) {
      // Never reset a host or tear down evidence while a body process group is
      // unproven.  The lock intentionally remains held as an interlock for
      // manual remediation; the external receipt below remains the only write
      // performed after this failure.
      reset = { ...reset, attempted: false, status: 'blocked-containment', containmentComplete: false }
      runnerCleanup = 'retained-containment-failure'
      lockCleanup = lock ? 'retained-containment-failure' : 'not-acquired'
      failure ??= { code: 'WORKFLOW_CONTAINMENT_FAILED' }
    } else {
      if (mutationAttempted && reset.status !== 'passed' && !reset.attempted) {
        try { proveRecovery() } catch (error) { failure ??= sanitizeError(error) }
      }
      const recoveryFailed = mutationAttempted && (reset.status !== 'passed' || reset.afterEmpty !== true)
      if (recoveryFailed) {
        runnerCleanup = 'retained-reset-failure'
        lockCleanup = lock ? 'retained-reset-failure' : 'not-acquired'
        failure ??= { code: 'NATIVE_DOCKER_RESET_UNPROVEN' }
      } else {
        try {
          if (stableFileSnapshot(workflowPath, 'offline workflow snapshot', { platform: process.platform, uid: undefined, privateMode: false }).sha256 !== workflowSha256) failure ??= { code: 'WORKFLOW_SNAPSHOT_CHANGED' }
        } catch { failure ??= { code: 'WORKFLOW_SNAPSHOT_UNAVAILABLE' } }
        const removeRunnerTemp = dependencies.removeRunnerTemp ?? ((target) => fs.rmSync(target, { recursive: true, force: true }))
        let cleanupFailed = false; let runnerTempState = 'present'
        try { removeRunnerTemp(runnerTemp) } catch { cleanupFailed = true }
        try { (dependencies.lstatRunnerTemp ?? fs.lstatSync)(runnerTemp) } catch (error) { runnerTempState = error?.code === 'ENOENT' ? 'absent' : 'unknown' }
        if (cleanupFailed || runnerTempState !== 'absent') {
          runnerCleanup = runnerTempState === 'present' ? 'retained-cleanup-failure' : runnerTempState === 'unknown' ? 'cleanup-unverified' : 'cleanup-failed-absent'
          lockCleanup = lock ? 'retained-cleanup-failure' : 'not-acquired'
          failure ??= { code: runnerTempState === 'unknown' ? 'RUNNER_TEMP_CLEANUP_UNVERIFIED' : 'RUNNER_TEMP_CLEANUP_FAILED' }
        } else {
          runnerCleanup = 'removed'
          if (lock) {
            try { controller.releaseHostLock(lock, controllerOptions); lockCleanup = 'released' } catch (error) { failure ??= sanitizeError(error); lockCleanup = 'release-failed' }
          } else lockCleanup = 'not-acquired'
        }
      }
    }
  }
  const privateKeyPreserved = observePrivateKeyPreservation(runnerTemp, runnerCleanup, dependencies)
  reset = { ...reset, initialHost: sanitizeHost(initialHost), afterHost: sanitizeHost(afterHost) }
  const workflow = { path: '.github/workflows/onprem-offline-proof.yml', sha256: workflowSha256, bodySha256: workflowBodyDigest(blocks), bodies: Object.fromEntries(PACKAGE_WORKFLOW_STEPS.map((marker) => [marker, blocks[marker].bodySha256])) }
  const receipt = buildPackageReceipt(options, { status: failure ? 'failed' : 'passed', runner: { platform: 'linux', architecture: process.arch === 'amd64' ? 'amd64' : process.arch, node: { version: nodeIdentity.version, sha256: nodeIdentity.sha256, execution: 'private-verified-copy' }, executionCheckout: 'detached-disposable' }, workflow, imageProof: { imageReceiptSha256: imageFacts.imageReceiptSha256, proofReceiptSha256: imageFacts.proofReceiptSha256, artifactManifestSha256: imageFacts.artifactManifestSha256 }, phases, bundle: bundleFacts ? { releaseId: bundleFacts.releaseId, archiveManifestSha256: bundleFacts.manifestSha256, archives: bundleFacts.archiveDigests } : null, trust: trustFacts, reset: { ...reset, workflowBudgetMs: totalBudgetMs - resetReserveMs - SUPERVISOR_RESERVE_MS, supervisorReserveMs: SUPERVISOR_RESERVE_MS, supervisorTerminationAccountedFor: true, resetReserveMs, minimumResetRecoveryMs: MIN_RESET_RECOVERY_MS, resetRecoveryBudgetMs: resetReserveMs, recoveryDeadlineViable }, cleanup: { runnerTemp: runnerCleanup, hostLock: lockCleanup, privateKeyPreserved }, failure })
  try { fs.writeFileSync(options.receipt, `${JSON.stringify(receipt)}\n`, { flag: 'wx', mode: 0o600 }); try { fs.chmodSync(options.receipt, 0o600) } catch {} } catch (error) { failure ??= sanitizeError(error) }
  if (failure) throw new Error(`local offline package failed (${failure.code})`)
  return Object.freeze({ status: 'passed', receipt: options.receipt, outputRoot, trustRoot, bundle: bundleFacts, trust: trustFacts, phases })
}
export const runOfflinePackage = runLocalPackage

function usage() {
  return `Usage: node scripts/onprem-offline-local-package.mjs --confirm-disposable-native-host --allow-disposable-daemon-reset --image-proof-root ABS --image-receipt ABS --output-root ABS --trust-root ABS --receipt ABS --source-sha SHA1 --tree-sha SHA1 --node ABS --node-sha256 SHA256 --run-id N --run-attempt N [--deadline-minutes ${MIN_DEADLINE_MINUTES}-${MAX_DEADLINE_MINUTES}] [--workspace-root ABS]`
}
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  try {
    const parsed = parsePackageArguments(process.argv.slice(2))
    if (parsed.help) process.stdout.write(`${usage()}\n`)
    else runLocalPackage(parsed)
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : 'local offline package failed'}\n${usage()}\n`)
    process.exitCode = 1
  }
}
