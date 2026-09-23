import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import {
  chmodSync,
  closeSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  openSync,
  readFileSync,
  realpathSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { dirname, isAbsolute, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  buildReleaseProofIdentity,
  receiptCanBeReused,
  receiptDigest,
  sha256,
  stableJson,
  validateReleaseManifest,
} from './release-stage-proof.mjs'
import {
  PINNED_NODE_IMAGE,
  buildLinuxProofDockerArgs,
  collectDockerIdentityWithRunner,
} from './onprem-proof-docker.mjs'

export { PINNED_NODE_IMAGE, buildLinuxProofDockerArgs }

export const EXPECTED_REPOSITORY_OWNER = 'suleymankuncan-web'
export const LOCAL_STATUS_CONTEXT = 'local/onprem-proof-gate/v1'
export const LOCAL_STATUS_DESCRIPTION_PREFIX = 'hr-axis-local-proof-v1 receipt='
export const LOCAL_PROOF_RECEIPT_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  'tmp',
  'onprem-proof-dispatch',
  'receipt.json',
)

const REPOSITORY_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const RECEIPT_MAX_AGE_MS = 24 * 60 * 60 * 1000
const SHA_RE = /^[a-f0-9]{40}$/u
const DIGEST_RE = /^[a-f0-9]{64}$/u
const BRANCH_RE = /^[A-Za-z0-9._/-]+$/u
const SAFE_REPOSITORY_RE = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/u
const PROOF_STRIPPED_ENVIRONMENT_KEYS = [
  'GITHUB_TOKEN',
  'GH_TOKEN',
  'DOCKER_HOST',
  'DOCKER_CONTEXT',
  'DOCKER_TLS_VERIFY',
  'DOCKER_CERT_PATH',
]
const GITHUB_API_BASE = 'https://api.github.com'

export function isPrivateModeAcceptable(mode, { platform = process.platform, directory = false } = {}) {
  if (platform === 'win32') return true
  const forbidden = directory ? 0o077 : 0o022
  return (mode & forbidden) === 0
}

function pathIsContained(root, candidate) {
  const relativePath = relative(resolve(root), resolve(candidate))
  return relativePath.length > 0 && !relativePath.startsWith('..') && !isAbsolute(relativePath)
}

export function pathsAreDisjoint(left, right) {
  const leftPath = resolve(left)
  const rightPath = resolve(right)
  return leftPath !== rightPath && !pathIsContained(leftPath, rightPath) && !pathIsContained(rightPath, leftPath)
}

export function validateSafePath(path, { root, kind = 'any', platform = process.platform } = {}) {
  if (typeof path !== 'string' || typeof root !== 'string' || !pathIsContained(root, path)) {
    fail('path escapes the validated root')
  }
  const rootPath = resolve(root)
  const candidatePath = resolve(path)
  const rootReal = realpathSync(rootPath)
  const candidateReal = realpathSync(candidatePath)
  if (!pathIsContained(rootReal, candidateReal)) fail('resolved path escapes the validated root')
  let cursor = candidatePath
  while (true) {
    const stat = lstatSync(cursor)
    if (stat.isSymbolicLink()) fail('symlink or reparse path is not allowed')
    if (cursor === rootPath) break
    const parent = dirname(cursor)
    if (parent === cursor) fail('validated root is not an ancestor')
    cursor = parent
  }
  const candidateStat = lstatSync(candidatePath)
  if ((kind === 'file' && !candidateStat.isFile()) || (kind === 'directory' && !candidateStat.isDirectory())) {
    fail(`validated path is not a regular ${kind}`)
  }
  if (!isPrivateModeAcceptable(candidateStat.mode, { platform, directory: kind === 'directory' })) {
    fail('validated path has unsafe group/world permissions')
  }
  return true
}

export function sanitizeProofEnvironment(environment = process.env) {
  const sanitized = { ...environment }
  for (const name of PROOF_STRIPPED_ENVIRONMENT_KEYS) delete sanitized[name]
  return sanitized
}

function withSanitizedProofEnvironment(callback) {
  const saved = {}
  for (const name of PROOF_STRIPPED_ENVIRONMENT_KEYS) {
    saved[name] = process.env[name]
    delete process.env[name]
  }
  try {
    return callback()
  } finally {
    for (const name of PROOF_STRIPPED_ENVIRONMENT_KEYS) {
      if (saved[name] === undefined) delete process.env[name]
      else process.env[name] = saved[name]
    }
  }
}

export function buildStreamingCommandOptions({ cwd, env, timeout }) {
  return { cwd, env, timeout, stdio: 'inherit' }
}

export function buildCanonicalProofInvocation({
  nodeExecutable = process.execPath,
  workspaceRoot = REPOSITORY_ROOT,
  env = proofCommandEnvironment(),
  timeout = 3 * 60 * 60 * 1000,
} = {}) {
  return {
    command: nodeExecutable,
    args: ['scripts/check-release.mjs'],
    options: buildStreamingCommandOptions({ cwd: workspaceRoot, env, timeout }),
  }
}

function fail(message) {
  throw new Error(message)
}

function assertSha(value, name = 'SHA') {
  if (typeof value !== 'string' || !SHA_RE.test(value)) fail(`${name} must be a 40-character lowercase commit SHA`)
  return value
}

function assertDigest(value, name = 'digest') {
  if (typeof value !== 'string' || !DIGEST_RE.test(value)) fail(`${name} must be a 64-character lowercase SHA-256 digest`)
  return value
}

function assertExactObjectKeys(value, allowed, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(`${name} must be an object`)
  const expected = new Set(allowed)
  const actual = Object.keys(value)
  if (actual.length !== expected.size || actual.some((key) => !expected.has(key))) fail(`${name} contains unsanitized fields`)
  return value
}

function parseIso(value, name) {
  if (typeof value !== 'string') fail(`${name} must be an ISO timestamp`)
  const time = Date.parse(value)
  if (!Number.isFinite(time)) fail(`${name} must be an ISO timestamp`)
  return time
}

function assertAge(time, now, name, maxAgeMs = RECEIPT_MAX_AGE_MS) {
  if (time > now + 5 * 60 * 1000) fail(`${name} is in the future`)
  if (now - time > maxAgeMs) fail(`${name} is stale`)
}

export function validateCleanGitOutput(output) {
  if (typeof output !== 'string') fail('git status output is unavailable')
  if (output.trim().length > 0) fail('workspace must be clean (tracked, index, and untracked changes are not allowed)')
  return true
}

function omitReceiptHash(value) {
  const { receiptSha256: ignored, ...payload } = value ?? {}
  return payload
}

export function buildReceipt(fields) {
  if (!fields || typeof fields !== 'object') fail('receipt fields are required')
  const supplied = omitReceiptHash(fields)
  const payload = {
    schemaVersion: 1,
    operation: 'onprem-local-proof',
    status: 'passed',
    ...supplied,
  }
  const receipt = { ...payload, receiptSha256: sha256(stableJson(payload)) }
  return receipt
}

function validateStageReceiptShape(receipt, stage, identityDigest, upstreamReceiptDigests) {
  if (
    !receiptCanBeReused({
      receipt,
      // A fresh local proof validates every receipt, including the manifest's
      // volatile audit stage. Freshness is supplied by the caller's run.
      stage: { ...stage, volatile: false },
      proofIdentityDigest: identityDigest,
      upstreamReceiptDigests,
    })
  ) {
    fail(`release receipt for ${stage.id} does not close over the current proof identity`)
  }
  parseIso(receipt.startedAt, `${stage.id}.startedAt`)
  parseIso(receipt.completedAt, `${stage.id}.completedAt`)
  assertDigest(receipt.proofIdentityDigest, `${stage.id}.proofIdentityDigest`)
  assertDigest(receipt.commandDigest, `${stage.id}.commandDigest`)
}

function readReleaseReceipts({ workspaceRoot = REPOSITORY_ROOT, identityDigest, startedAt }) {
  const manifestPath = join(workspaceRoot, 'scripts', 'release-stage-manifest.json')
  const manifest = validateReleaseManifest(JSON.parse(readFileSync(manifestPath, 'utf8')))
  const receiptRoot = join(workspaceRoot, 'tmp', 'release-gate')
  const receipts = new Map()
  const stageDigests = {}
  const runStarted = Date.parse(startedAt)
  for (const stage of manifest.stages) {
    const path = join(receiptRoot, `${stage.id}.json`)
    let receipt
    try {
      receipt = JSON.parse(readFileSync(path, 'utf8'))
    } catch {
      fail(`missing release receipt for ${stage.id}`)
    }
    const upstreamReceiptDigests = Object.fromEntries(
      stage.dependsOn.map((dependency) => [dependency, receiptDigest(receipts.get(dependency))]),
    )
    validateStageReceiptShape(receipt, stage, identityDigest, upstreamReceiptDigests)
    if (Date.parse(receipt.startedAt) < runStarted) fail(`release receipt for ${stage.id} predates fresh proof`)
    receipts.set(stage.id, receipt)
    stageDigests[stage.id] = receiptDigest(receipt)
  }
  return {
    manifestDigest: sha256(readFileSync(manifestPath)),
    stageReceipts: stageDigests,
  }
}

export function validateLocalProofReceipt(receipt, { now = Date.now(), maxAgeMs = RECEIPT_MAX_AGE_MS } = {}) {
  if (!receipt || typeof receipt !== 'object') fail('local proof receipt is missing')
  const allowedKeys = new Set([
    'schemaVersion',
    'operation',
    'status',
    'headSha',
    'treeSha',
    'branch',
    'proofIdentityDigest',
    'workspaceDigest',
    'manifestDigest',
    'stageReceipts',
    'archiveSha256',
    'nodeImage',
    'docker',
    'suites',
    'startedAt',
    'completedAt',
    'receiptSha256',
  ])
  if (Object.keys(receipt).some((key) => !allowedKeys.has(key))) fail('local proof receipt contains unsanitized fields')
  if (receipt.schemaVersion !== 1 || receipt.operation !== 'onprem-local-proof' || receipt.status !== 'passed') {
    fail('local proof receipt schema/status is invalid')
  }
  assertSha(receipt.headSha, 'receipt head SHA')
  assertSha(receipt.treeSha, 'receipt tree SHA')
  if (typeof receipt.branch !== 'string' || !BRANCH_RE.test(receipt.branch) || receipt.branch.includes('..')) {
    fail('receipt branch is invalid')
  }
  for (const key of ['proofIdentityDigest', 'workspaceDigest', 'manifestDigest', 'archiveSha256']) {
    assertDigest(receipt[key], `receipt ${key}`)
  }
  if (!receipt.stageReceipts || typeof receipt.stageReceipts !== 'object' || Array.isArray(receipt.stageReceipts)) {
    fail('receipt stage digests are invalid')
  }
  for (const [stageId, digest] of Object.entries(receipt.stageReceipts)) {
    if (!/^[a-z][a-z0-9-]*$/u.test(stageId)) fail('receipt stage id is invalid')
    assertDigest(digest, 'receipt stage digest')
  }
  assertExactObjectKeys(receipt.nodeImage, ['reference', 'configImageId'], 'receipt node image')
  if (typeof receipt.nodeImage.reference !== 'string' || typeof receipt.nodeImage.configImageId !== 'string') {
    fail('receipt node image fields are invalid')
  }
  const pinnedConfigImageId = `sha256:${PINNED_NODE_IMAGE.slice(PINNED_NODE_IMAGE.indexOf('@sha256:') + 8)}`
  if (receipt.nodeImage?.reference !== PINNED_NODE_IMAGE || receipt.nodeImage?.configImageId !== pinnedConfigImageId) {
    fail('receipt pinned image identity is invalid')
  }
  assertExactObjectKeys(receipt.docker, ['identityDigest', 'serverVersion', 'serverOs', 'serverArch', 'composeVersion'], 'receipt Docker identity')
  if (
    receipt.docker?.serverOs !== 'linux' ||
    !['amd64', 'x86_64'].includes(receipt.docker?.serverArch) ||
    !DIGEST_RE.test(receipt.docker?.identityDigest ?? '') ||
    typeof receipt.docker.serverVersion !== 'string' ||
    typeof receipt.docker.composeVersion !== 'string'
  ) {
    fail('receipt Docker identity is invalid')
  }
  assertExactObjectKeys(receipt.suites, ['onprem', 'offline', 'network'], 'receipt suites')
  if (
    receipt.suites?.onprem !== 'passed' ||
    receipt.suites?.offline !== 'passed' ||
    receipt.suites?.network !== 'none'
  ) {
    fail('receipt suite result is invalid')
  }
  const startedAt = parseIso(receipt.startedAt, 'receipt.startedAt')
  const completedAt = parseIso(receipt.completedAt, 'receipt.completedAt')
  if (completedAt < startedAt) fail('receipt completion precedes start')
  assertAge(completedAt, now, 'receipt completion', maxAgeMs)
  if (!DIGEST_RE.test(receipt.receiptSha256 ?? '')) fail('receipt hash is invalid')
  if (sha256(stableJson(omitReceiptHash(receipt))) !== receipt.receiptSha256) fail('receipt hash does not match payload')
  return receipt
}

function statusTime(status) {
  const value = status?.updated_at ?? status?.created_at
  const parsed = Date.parse(value ?? '')
  return Number.isFinite(parsed) ? parsed : null
}

export function evaluateStatusList(
  statuses,
  {
    expectedSha,
    now = Date.now(),
    owner = EXPECTED_REPOSITORY_OWNER,
    maxAgeMs = RECEIPT_MAX_AGE_MS,
  } = {},
) {
  assertSha(expectedSha, 'expected SHA')
  if (!Array.isArray(statuses)) fail('GitHub statuses response is invalid')
  const matching = statuses.filter((status) => status?.context === LOCAL_STATUS_CONTEXT)
  if (matching.length === 0) return { state: 'pending' }
  if (matching.some((status) => statusTime(status) === null)) {
    return { state: 'failure', status: matching[0] }
  }
  matching.sort((left, right) => {
    const byTime = (statusTime(right) ?? -Infinity) - (statusTime(left) ?? -Infinity)
    if (byTime !== 0) return byTime
    return Number(right?.id ?? -Infinity) - Number(left?.id ?? -Infinity)
  })
  const latest = matching[0]
  const updatedAt = statusTime(latest)
  if (!updatedAt) return { state: 'failure', status: latest }
  try {
    assertAge(updatedAt, now, 'local proof status', maxAgeMs)
  } catch {
    return { state: 'failure', status: latest }
  }
  const description = latest?.description
  const digest = typeof description === 'string' && description.startsWith(LOCAL_STATUS_DESCRIPTION_PREFIX)
    ? description.slice(LOCAL_STATUS_DESCRIPTION_PREFIX.length)
    : ''
  if (
    latest?.state !== 'success' ||
    latest?.creator?.type !== 'User' ||
    typeof latest.creator.login !== 'string' ||
    latest.creator.login.toLowerCase() !== owner.toLowerCase() ||
    !DIGEST_RE.test(digest)
  ) {
    return { state: latest?.state === 'pending' ? 'pending' : 'failure', status: latest }
  }
  return { state: 'success', receiptSha256: digest, status: latest }
}

export function buildDispatchInputs(kind, { headSha, proofMode = 'full', imageScope = 'both', proofRunId } = {}) {
  assertSha(headSha, 'head SHA')
  if (kind === 'image') {
    if (!['full', 'component'].includes(proofMode)) fail('image proof mode is invalid')
    if (
      (proofMode === 'full' && imageScope !== 'both') ||
      (proofMode === 'component' && !['frontend', 'backend', 'both'].includes(imageScope))
    ) fail('image proof mode and scope are incompatible')
    return { expected_sha: headSha, proof_mode: proofMode, image_scope: imageScope }
  }
  if (kind === 'offline') {
    if (typeof proofRunId !== 'string' || !/^\d+$/u.test(proofRunId)) fail('offline proof run id must be numeric')
    return {
      expected_sha: headSha,
      proof_artifact_name: `onprem-image-proof-${headSha}`,
      proof_run_id: proofRunId,
    }
  }
  fail(`unsupported proof kind: ${kind}`)
}

function runCommand(
  command,
  args,
  {
    cwd = REPOSITORY_ROOT,
    input,
    timeout = 120_000,
    env = process.env,
    stdio = 'pipe',
    maxBuffer,
  } = {},
) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    input,
    timeout,
    env,
    stdio,
    windowsHide: true,
    ...((maxBuffer ?? (stdio === 'inherit' ? undefined : 8 * 1024 * 1024)) === undefined
      ? {}
      : { maxBuffer: maxBuffer ?? 8 * 1024 * 1024 }),
  })
  if (result.error) fail(`command failed: ${command}`)
  return {
    status: result.status,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
  }
}

function runChecked(command, args, options = {}) {
  const { commandRunner = runCommand, ...runnerOptions } = options
  const result = commandRunner(command, args, runnerOptions)
  if (result.status !== 0) fail(`command failed: ${command}`)
  return result.stdout
}

function git(workspaceRoot, args, options = {}) {
  return runChecked('git', args, { ...options, cwd: workspaceRoot })
}

export function currentGitState(
  workspaceRoot = REPOSITORY_ROOT,
  { commandRunner = runCommand, env = proofCommandEnvironment() } = {},
) {
  const runOptions = { commandRunner, env }
  validateCleanGitOutput(git(workspaceRoot, ['status', '--porcelain=v1', '--untracked-files=all', '--ignore-submodules=none'], runOptions))
  const headSha = assertSha(git(workspaceRoot, ['rev-parse', 'HEAD'], runOptions).trim(), 'HEAD')
  const treeSha = assertSha(git(workspaceRoot, ['rev-parse', 'HEAD^{tree}'], runOptions).trim(), 'tree')
  const branch = git(workspaceRoot, ['symbolic-ref', '--quiet', '--short', 'HEAD'], runOptions).trim()
  if (!branch || !BRANCH_RE.test(branch) || branch.includes('..')) fail('proof requires a named branch')
  return { headSha, treeSha, branch }
}

function buildIdentity(workspaceRoot = REPOSITORY_ROOT) {
  return withSanitizedProofEnvironment(() => buildReleaseProofIdentity({
    workspaceRoot,
    manifestPath: join(workspaceRoot, 'scripts', 'release-stage-manifest.json'),
  }))
}

export function buildSanitizedProofIdentity(workspaceRoot = REPOSITORY_ROOT) {
  return buildIdentity(workspaceRoot)
}

function capturedCredentialTransport(environment = process.env) {
  return {
    GITHUB_TOKEN: environment.GITHUB_TOKEN,
    GH_TOKEN: environment.GH_TOKEN,
  }
}

function proofCommandEnvironment(environment = process.env) {
  return sanitizeProofEnvironment(environment)
}

function ensurePrivateTempRoot(workspaceRoot) {
  const base = realpathSync(osTmpDir())
  const root = mkdtempSync(join(base, 'onprem-proof-dispatch-'))
  if (process.platform !== 'win32') chmodSync(root, 0o700)
  const resolved = realpathSync(root)
  if (!pathsAreDisjoint(realpathSync(workspaceRoot), resolved)) {
    rmSync(resolved, { recursive: true, force: true })
    fail('proof archive temporary root overlaps workspace')
  }
  validateSafePath(resolved, { root: base, kind: 'directory' })
  return resolved
}

// Kept as tiny wrappers so tests can stub command/time boundaries without ever
// invoking a canonical proof or Docker in contract tests.
function osTmpDir() {
  return process.env.TMPDIR || process.env.TEMP || process.env.TMP || (process.platform === 'win32' ? 'C:\\Windows\\Temp' : '/tmp')
}

export function archiveWorkspace(
  workspaceRoot,
  temporaryRoot,
  { commandRunner = runCommand, env = proofCommandEnvironment() } = {},
) {
  const archivePath = join(temporaryRoot, 'source.tar')
  runChecked('git', ['archive', '--format=tar', '--output', archivePath, 'HEAD'], { cwd: workspaceRoot, commandRunner, env })
  const archiveStat = lstatSync(archivePath)
  if (!archiveStat.isFile() || archiveStat.isSymbolicLink()) fail('proof archive is not a regular file')
  if (process.platform !== 'win32') chmodSync(archivePath, 0o600)
  validateSafePath(archivePath, { root: temporaryRoot, kind: 'file' })
  return { archivePath, archiveSha256: sha256(readFileSync(archivePath)) }
}

export function collectDockerIdentity(
  workspaceRoot = REPOSITORY_ROOT,
  { commandRunner = runCommand, env = proofCommandEnvironment() } = {},
) {
  return collectDockerIdentityWithRunner(workspaceRoot, { commandRunner, env })
}

function writeReceiptAtomic(path, value) {
  const directory = dirname(path)
  mkdirSync(directory, { recursive: true, mode: 0o700 })
  validateSafePath(directory, { root: REPOSITORY_ROOT, kind: 'directory' })
  if (process.platform !== 'win32') chmodSync(directory, 0o700)
  const temporaryPath = `${path}.${process.pid}.${Date.now()}.tmp`
  let destination = null
  try {
    destination = lstatSync(path)
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error
  }
  if (destination) {
    if (!destination.isFile() || destination.isSymbolicLink() || !isPrivateModeAcceptable(destination.mode)) {
      fail('existing local proof receipt is not a private regular file')
    }
  }
  const descriptor = openSync(temporaryPath, 'wx', 0o600)
  try {
    writeFileSync(descriptor, `${JSON.stringify(value)}\n`, { encoding: 'utf8' })
    closeSync(descriptor)
    if (process.platform !== 'win32') chmodSync(temporaryPath, 0o600)
    validateSafePath(temporaryPath, { root: REPOSITORY_ROOT, kind: 'file' })
    try {
      renameSync(temporaryPath, path)
    } catch (error) {
      if (!['EEXIST', 'EPERM'].includes(error?.code)) throw error
      rmSync(path, { force: true })
      renameSync(temporaryPath, path)
    }
  } finally {
    try { rmSync(temporaryPath, { force: true }) } catch { /* best effort cleanup */ }
  }
}

function loadReceipt(path = LOCAL_PROOF_RECEIPT_PATH) {
  let stat
  try {
    stat = lstatSync(path)
  } catch {
    fail('local proof receipt is missing')
  }
  validateSafePath(path, { root: REPOSITORY_ROOT, kind: 'file' })
  try {
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch {
    fail('local proof receipt is not valid JSON')
  }
}

export function parseGitHubRepositoryRemote(remote) {
  if (typeof remote !== 'string') fail('origin must be a GitHub repository URL')
  const patterns = [
    /^https:\/\/github\.com\/([A-Za-z0-9-]+)\/([A-Za-z0-9_.-]+)(?:\.git)?$/u,
    /^git@github\.com:([A-Za-z0-9-]+)\/([A-Za-z0-9_.-]+)(?:\.git)?$/u,
    /^ssh:\/\/git@github\.com\/([A-Za-z0-9-]+)\/([A-Za-z0-9_.-]+)(?:\.git)?$/u,
  ]
  const match = patterns.map((pattern) => remote.match(pattern)).find(Boolean)
  if (!match) fail('origin must be a GitHub repository URL')
  const repository = `${match[1]}/${match[2].replace(/\.git$/u, '')}`
  if (!SAFE_REPOSITORY_RE.test(repository) || match[1].toLowerCase() !== EXPECTED_REPOSITORY_OWNER.toLowerCase()) {
    fail('origin repository owner is not the approved user repository')
  }
  return repository
}

function remoteRepository(
  workspaceRoot = REPOSITORY_ROOT,
  { commandRunner = runCommand, env = proofCommandEnvironment() } = {},
) {
  return parseGitHubRepositoryRemote(git(workspaceRoot, ['remote', 'get-url', 'origin'], { commandRunner, env }).trim())
}

function assertToken(token) {
  if (typeof token !== 'string' || token.length < 8 || /[\r\n]/u.test(token)) fail('GitHub token is required')
  return token
}

export function normalizeGitHubApiUrl(apiUrl = process.env.GITHUB_API_URL || GITHUB_API_BASE) {
  if (apiUrl === GITHUB_API_BASE || apiUrl === `${GITHUB_API_BASE}/`) return GITHUB_API_BASE
  fail('GitHub API host is not the approved api.github.com endpoint')
}

export async function githubRequest({ apiUrl = process.env.GITHUB_API_URL || GITHUB_API_BASE, path, token, method = 'GET', body, fetchImpl = globalThis.fetch }) {
  const endpoint = normalizeGitHubApiUrl(apiUrl)
  assertToken(token)
  if (typeof fetchImpl !== 'function') fail('GitHub fetch is unavailable')
  const response = await fetchImpl(`${endpoint}${path}`, {
    method,
    redirect: 'error',
    headers: {
      accept: 'application/vnd.github+json',
      authorization: `Bearer ${token}`,
      'x-github-api-version': '2022-11-28',
      ...(body ? { 'content-type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
  let value = null
  try { value = await response.json() } catch { /* sanitized error below */ }
  if (!response.ok) fail(`GitHub API request failed (${response.status})`)
  return value
}

function branchRemoteSha(
  workspaceRoot,
  branch,
  { commandRunner = runCommand, env = proofCommandEnvironment() } = {},
) {
  if (!BRANCH_RE.test(branch) || branch.includes('..')) fail('branch name is invalid')
  const result = git(workspaceRoot, ['ls-remote', '--heads', 'origin', `refs/heads/${branch}`], { commandRunner, env }).trim()
  const [sha, ref] = result.split(/\s+/u)
  if (ref !== `refs/heads/${branch}`) fail('remote branch is missing')
  return assertSha(sha, 'remote branch SHA')
}

function validateCurrentProof({
  receipt,
  workspaceRoot = REPOSITORY_ROOT,
  requireRemote = false,
  commandRunner = runCommand,
  env = proofCommandEnvironment(),
}) {
  validateLocalProofReceipt(receipt)
  const state = currentGitState(workspaceRoot, { commandRunner, env })
  if (state.headSha !== receipt.headSha || state.treeSha !== receipt.treeSha || state.branch !== receipt.branch) {
    fail('local proof receipt does not match the clean current HEAD/tree/branch')
  }
  const identity = buildIdentity(workspaceRoot)
  if (identity.proofIdentityDigest !== receipt.proofIdentityDigest || identity.workspaceDigest !== receipt.workspaceDigest) {
    fail('local proof receipt does not match the current proof identity')
  }
  const docker = collectDockerIdentity(workspaceRoot, { commandRunner, env })
  if (docker.identityDigest !== receipt.docker.identityDigest) fail('Docker identity changed since local proof')
  const canonical = readReleaseReceipts({ workspaceRoot, identityDigest: identity.proofIdentityDigest, startedAt: receipt.startedAt })
  if (canonical.manifestDigest !== receipt.manifestDigest || stableJson(canonical.stageReceipts) !== stableJson(receipt.stageReceipts)) {
    fail('release receipt closure changed since local proof')
  }
  if (requireRemote && branchRemoteSha(workspaceRoot, state.branch, { commandRunner, env }) !== state.headSha) fail('remote branch does not point to current HEAD')
  return { state, identity, docker, canonical }
}

export async function publishProof({
  workspaceRoot = REPOSITORY_ROOT,
  token = process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN,
  fetchImpl = globalThis.fetch,
  receiptPath = LOCAL_PROOF_RECEIPT_PATH,
  commandRunner = runCommand,
} = {}) {
  const capturedCredentials = capturedCredentialTransport()
  const sanitizedEnvironment = proofCommandEnvironment()
  const receipt = loadReceipt(receiptPath)
  const validated = withSanitizedProofEnvironment(() => validateCurrentProof({
    receipt,
    workspaceRoot,
    requireRemote: true,
    commandRunner,
    env: sanitizedEnvironment,
  }))
  const apiToken = token ?? capturedCredentials.GITHUB_TOKEN ?? capturedCredentials.GH_TOKEN
  const repository = remoteRepository(workspaceRoot, { commandRunner, env: sanitizedEnvironment })
  const repo = await githubRequest({ path: `/repos/${repository}`, token: apiToken, fetchImpl })
  if (
    repo?.full_name?.toLowerCase() !== repository.toLowerCase() ||
    repo?.owner?.type !== 'User' ||
    repo?.owner?.login?.toLowerCase() !== EXPECTED_REPOSITORY_OWNER.toLowerCase()
  ) fail('GitHub repository owner is not the approved user account')
  const actor = await githubRequest({ path: '/user', token: apiToken, fetchImpl })
  if (actor?.type !== 'User' || actor?.login?.toLowerCase() !== EXPECTED_REPOSITORY_OWNER.toLowerCase()) {
    fail('authenticated GitHub actor is not the repository owner')
  }
  const description = `${LOCAL_STATUS_DESCRIPTION_PREFIX}${receipt.receiptSha256}`
  await githubRequest({
    method: 'POST',
    path: `/repos/${repository}/statuses/${validated.state.headSha}`,
    token: apiToken,
    fetchImpl,
    body: { state: 'success', context: LOCAL_STATUS_CONTEXT, description },
  })
  if (branchRemoteSha(workspaceRoot, validated.state.branch, { commandRunner, env: sanitizedEnvironment }) !== validated.state.headSha) {
    fail('remote branch moved after local proof status publication')
  }
  return { repository, headSha: validated.state.headSha, branch: validated.state.branch, receiptSha256: receipt.receiptSha256 }
}

export async function verifyStatus({
  expectedSha,
  executionSha,
  eventName,
  repository,
  token = process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN,
  fetchImpl = globalThis.fetch,
  sleep = (milliseconds) => new Promise((resolvePromise) => setTimeout(resolvePromise, milliseconds)),
  now = () => Date.now(),
  attempts = 3,
  intervalMs = 30_000,
} = {}) {
  assertSha(expectedSha, 'expected SHA')
  assertSha(executionSha, 'execution SHA')
  if (!['workflow_dispatch', 'pull_request'].includes(eventName)) fail('unsupported or missing GitHub event name')
  if (eventName === 'workflow_dispatch' && executionSha !== expectedSha) {
    fail('workflow dispatch execution SHA does not match expected SHA')
  }
  if (typeof repository !== 'string' || !SAFE_REPOSITORY_RE.test(repository)) fail('repository is invalid')
  if (repository.split('/')[0].toLowerCase() !== EXPECTED_REPOSITORY_OWNER.toLowerCase()) fail('repository owner is not approved')
  const repo = await githubRequest({ path: `/repos/${repository}`, token, fetchImpl })
  if (
    repo?.full_name?.toLowerCase() !== repository.toLowerCase() ||
    repo?.owner?.type !== 'User' ||
    repo?.owner?.login?.toLowerCase() !== EXPECTED_REPOSITORY_OWNER.toLowerCase()
  ) {
    fail('GitHub repository owner is not the approved user account')
  }
  let last = { state: 'pending' }
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const statuses = await githubRequest({ path: `/repos/${repository}/commits/${expectedSha}/statuses?per_page=100`, token, fetchImpl })
    last = evaluateStatusList(statuses, { expectedSha, now: now() })
    if (last.state === 'success') return last
    if (last.state === 'failure') fail('latest local proof status is not a fresh owner success')
    if (attempt + 1 < attempts) await sleep(intervalMs)
  }
  fail(last.state === 'pending'
    ? 'owner local proof status did not become a fresh success'
    : 'latest local proof status is not a fresh owner success')
}

async function dispatchProof(kind, options = {}) {
  const published = await publishProof(options)
  const inputs = buildDispatchInputs(kind, {
    headSha: published.headSha,
    proofMode: options.proofMode,
    imageScope: options.imageScope,
    proofRunId: options.proofRunId,
  })
  const workflow = kind === 'image' ? 'onprem-image-proof.yml' : 'onprem-offline-proof.yml'
  await githubRequest({
    method: 'POST',
    path: `/repos/${published.repository}/actions/workflows/${workflow}/dispatches`,
    token: options.token ?? process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN,
    fetchImpl: options.fetchImpl ?? globalThis.fetch,
    body: { ref: published.branch, inputs },
  })
  return { workflow, repository: published.repository, ref: published.branch, inputs }
}

export async function prove({ workspaceRoot = REPOSITORY_ROOT, commandRunner = runCommand } = {}) {
  const sanitizedEnvironment = proofCommandEnvironment()
  const start = new Date()
  const before = currentGitState(workspaceRoot, { commandRunner, env: sanitizedEnvironment })
  const beforeIdentity = buildIdentity(workspaceRoot)
  const canonicalInvocation = buildCanonicalProofInvocation({ workspaceRoot, env: sanitizedEnvironment })
  const result = commandRunner(canonicalInvocation.command, canonicalInvocation.args, canonicalInvocation.options)
  if (result.status !== 0) fail('fresh canonical release proof failed')
  const afterCanonical = currentGitState(workspaceRoot, { commandRunner, env: sanitizedEnvironment })
  const identity = buildIdentity(workspaceRoot)
  if (stableJson(before) !== stableJson(afterCanonical) || beforeIdentity.proofIdentityDigest !== identity.proofIdentityDigest) {
    fail('workspace changed during canonical release proof')
  }
  const canonical = readReleaseReceipts({ workspaceRoot, identityDigest: identity.proofIdentityDigest, startedAt: start.toISOString() })
  const docker = collectDockerIdentity(workspaceRoot, { commandRunner, env: sanitizedEnvironment })
  const temporaryRoot = ensurePrivateTempRoot(workspaceRoot)
  let archive
  try {
    archive = archiveWorkspace(workspaceRoot, temporaryRoot, { commandRunner, env: sanitizedEnvironment })
    const dockerResult = commandRunner('docker', buildLinuxProofDockerArgs(archive.archivePath, archive.archiveSha256), buildStreamingCommandOptions({
      cwd: workspaceRoot,
      env: sanitizedEnvironment,
      timeout: 3 * 60 * 60 * 1000,
    }))
    if (dockerResult.status !== 0) fail('isolated Linux on-prem proof suites failed')
  } finally {
    rmSync(temporaryRoot, { recursive: true, force: true })
  }
  const finalState = currentGitState(workspaceRoot, { commandRunner, env: sanitizedEnvironment })
  const finalIdentity = buildIdentity(workspaceRoot)
  if (stableJson(before) !== stableJson(finalState) || finalIdentity.proofIdentityDigest !== identity.proofIdentityDigest) {
    fail('workspace changed during isolated on-prem proof')
  }
  const completedAt = new Date()
  const receipt = buildReceipt({
    schemaVersion: 1,
    operation: 'onprem-local-proof',
    status: 'passed',
    headSha: finalState.headSha,
    treeSha: finalState.treeSha,
    branch: finalState.branch,
    proofIdentityDigest: finalIdentity.proofIdentityDigest,
    workspaceDigest: finalIdentity.workspaceDigest,
    manifestDigest: canonical.manifestDigest,
    stageReceipts: canonical.stageReceipts,
    archiveSha256: archive.archiveSha256,
    nodeImage: docker.nodeImage,
    docker: {
      identityDigest: docker.identityDigest,
      serverVersion: docker.serverVersion,
      serverOs: docker.serverOs,
      serverArch: docker.serverArch,
      composeVersion: docker.composeVersion,
    },
    suites: { onprem: 'passed', offline: 'passed', network: 'none' },
    startedAt: start.toISOString(),
    completedAt: completedAt.toISOString(),
  })
  validateLocalProofReceipt(receipt, { now: completedAt.getTime() })
  writeReceiptAtomic(LOCAL_PROOF_RECEIPT_PATH, receipt)
  return { receiptSha256: receipt.receiptSha256, path: LOCAL_PROOF_RECEIPT_PATH }
}

export function parseCli(argv) {
  const command = argv[0]
  const dispatch = command === 'dispatch'
  const kind = dispatch ? argv[1] : undefined
  const start = dispatch ? 2 : 1
  const rest = argv.slice(start)
  const values = {}
  for (let index = 0; index < rest.length; index += 1) {
    const argument = rest[index]
    if (!argument.startsWith('--')) fail('unsupported command argument')
    const key = argument.slice(2).replaceAll('-', '_')
    const value = rest[++index]
    if (!value || value.startsWith('--')) fail('command argument requires a value')
    values[key] = value
  }
  return { command, kind, values }
}

export async function main(argv = process.argv.slice(2)) {
  const { command, kind, values } = parseCli(argv)
  const allowed = command === 'verify-status'
    ? new Set(['expected_sha', 'repository'])
    : command === 'dispatch'
      ? new Set(['proof_mode', 'image_scope', 'proof_run_id'])
      : new Set()
  if (Object.keys(values).some((key) => !allowed.has(key))) fail('unsupported command argument')
  if (command === 'prove') return prove()
  if (command === 'publish') return publishProof()
  if (command === 'verify-status') {
    return verifyStatus({
      expectedSha: values.expected_sha ?? process.env.EXPECTED_SHA,
      executionSha: process.env.GITHUB_EXECUTION_SHA,
      eventName: process.env.GITHUB_EVENT_NAME,
      repository: values.repository ?? process.env.GITHUB_REPOSITORY,
    })
  }
  if (command === 'dispatch' && (kind === 'image' || kind === 'offline')) {
    return dispatchProof(kind, {
      proofMode: values.proof_mode ?? 'full',
      imageScope: values.image_scope ?? 'both',
      proofRunId: values.proof_run_id,
      fetchImpl: globalThis.fetch,
    })
  }
  fail('usage: prove | publish | dispatch image|offline | verify-status')
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const result = await main()
    if (result?.receiptSha256) console.log(`local proof receipt=${result.receiptSha256}`)
  } catch (error) {
    console.error(`on-prem local proof gate failed: ${error instanceof Error ? error.message : 'sanitized failure'}`)
    process.exitCode = 1
  }
}
