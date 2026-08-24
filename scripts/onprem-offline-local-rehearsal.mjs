import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createHash, createPublicKey } from 'node:crypto'
import { execFileSync, spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { buildWorkflowSupervisor } from './onprem-local-workflow-supervisor.mjs'
import {
  acquireHostLock,
  expectedNativeDockerHostMarker,
  hostContract,
  inspectDedicatedNativeDockerHost,
  releaseHostLock,
  resetDedicatedNativeDockerHost,
} from './onprem-native-docker-host.mjs'
import { analyzeFirewallMismatch, compareFirewallSnapshots, FIREWALL_COMMAND_CAP_MS } from './onprem-image-local-proof-recovery.mjs'
import { createRecoveryFixedCommands } from './onprem-recovery-command-allowlist.mjs'

const SCRIPT_ROOT = path.dirname(fileURLToPath(import.meta.url))
const REPOSITORY_ROOT = path.resolve(SCRIPT_ROOT, '..')
const WORKFLOW_PATH = path.join(REPOSITORY_ROOT, '.github', 'workflows', 'onprem-offline-proof.yml')

export const WORKFLOW_STEPS = Object.freeze([
  'Disable egress before any bundle verification or Docker mutation',
  'Verify bundle before docker load and run bundled operations',
  'Quiesce exact rehearsal runtimes before restoring egress',
  'Restore runner egress only after runtime quiescence',
  'Materialize sanitized failure receipt when rehearsal stops early',
  'Clean exact rehearsal targets',
])

export const LIFECYCLE_ORDER = Object.freeze([
  'disable-egress',
  'verify-rehearse',
  'quiesce',
  'restore-egress',
  'failure-receipt',
  'materialize-receipt',
  'cleanup',
])

const BUNDLE_FILES = Object.freeze(['SHA256SUMS', 'current.tar', 'next-transition.tar', 'previous-transition.tar'])
const TRUST_FILES = Object.freeze(['public-key.pem', 'fingerprint.txt', 'receipt.json', 'onprem-offline-bootstrap-verify.mjs'])
const IMAGE_NAMES = Object.freeze(['backend', 'frontend', 'keycloak', 'caddy', 'postgres', 'redis', 'seaweedfs'])
const PROJECT_NAMES = Object.freeze(['hr-axis-onprem-core', 'hr-axis-onprem-restore', 'hr-axis-onprem-upgrade', 'hr-axis-onprem-rollback'])
const SAFE_ID = /^[a-z0-9][a-z0-9._-]{0,127}$/
const SHA1 = /^[a-f0-9]{40}$/
const SHA256 = /^[a-f0-9]{64}$/
const RUN_NUMBER = /^[1-9][0-9]*$/
const ALLOWED_PHASES = new Set(['preflight', 'install', 'migrate', 'activate', 'smoke', 'photo-prebackup', 'backup', 'restore', 'upgrade', 'rollback'])
const SENSITIVE_ENV = /(?:TOKEN|PASSWORD|SECRET|PRIVATE|CREDENTIAL|AUTH|DOCKER_TLS|DOCKER_CERT|DOCKER_HOST|DOCKER_CONTEXT)/i
export const REQUIRED_HOST_TOOLS = Object.freeze(['bash', 'sudo', 'setsid', 'timeout', 'iptables-save', 'ip6tables-save', 'iptables-restore', 'ip6tables-restore', 'iptables', 'ip6tables', 'nft', 'ip', 'tar', 'sha256sum', 'openssl', 'base64', 'awk', 'stat', 'find', 'git', 'uname', 'docker'])
export const RECOVERY_POLICY = Object.freeze({
  budgetMs: 15 * 60 * 1000,
  firewallFamilyReserveMs: 2 * 60 * 1000,
})
const RECOVERY_BINARIES = Object.freeze({
  sudo: '/usr/bin/sudo',
  ipv4Probe: '/usr/sbin/iptables',
  ipv4Save: '/usr/sbin/iptables-save',
  ipv4Restore: '/usr/sbin/iptables-restore',
  ipv6Probe: '/usr/sbin/ip6tables',
  ipv6Save: '/usr/sbin/ip6tables-save',
  ipv6Restore: '/usr/sbin/ip6tables-restore',
})
const RECOVERY_ENV = Object.freeze({
  LANG: 'C',
  LC_ALL: 'C',
  PATH: '/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin',
})
const RECOVERY_DEADLINE_CODE = 'OFFLINE_RECOVERY_DEADLINE'
const NATIVE_RECOVERY_DEADLINE_CODE = 'NATIVE_DOCKER_RECOVERY_DEADLINE'
const RECOVERY_COMMAND_CODE = 'OFFLINE_RECOVERY_COMMAND'
const RECOVERY_FIXED_COMMANDS = createRecoveryFixedCommands(RECOVERY_BINARIES)
const RECOVERY_FIXED_PATHS = new Set([
  ...RECOVERY_FIXED_COMMANDS.values(),
  RECOVERY_BINARIES.ipv4Probe,
  RECOVERY_BINARIES.ipv6Probe,
  '/usr/bin/cat', '/usr/bin/containerd', '/usr/bin/docker', '/usr/bin/dockerd', '/usr/bin/find', '/usr/bin/findmnt',
  '/usr/bin/id', '/usr/bin/install', '/usr/bin/kill', '/usr/bin/readlink', '/usr/bin/rm', '/usr/bin/ps', '/usr/bin/ss',
  '/usr/bin/stat', '/usr/bin/systemctl', '/usr/bin/test',
])
const FIREWALLS = Object.freeze([
  Object.freeze({ key: 'ipv4', probe: RECOVERY_BINARIES.ipv4Probe, save: RECOVERY_BINARIES.ipv4Save, restore: RECOVERY_BINARIES.ipv4Restore, expectedFamily: 'iptables-save' }),
  Object.freeze({ key: 'ipv6', probe: RECOVERY_BINARIES.ipv6Probe, save: RECOVERY_BINARIES.ipv6Save, restore: RECOVERY_BINARIES.ipv6Restore, expectedFamily: 'ip6tables-save' }),
])

function fail(message) {
  throw new Error(message)
}

function canonicalPath(target, label) {
  try { return fs.realpathSync(target) } catch { fail(`${label} cannot be resolved`) }
}

export function assertCanonicalWorkspaceRoot(workspaceRoot) {
  const canonicalWorkspaceRoot = canonicalPath(workspaceRoot, 'workspace root')
  const canonicalRepositoryRoot = canonicalPath(REPOSITORY_ROOT, 'harness checkout repository root')
  if (canonicalWorkspaceRoot !== canonicalRepositoryRoot) fail('workspace root must resolve to the harness checkout repository root')
  return canonicalRepositoryRoot
}

function hashBytes(value) {
  return createHash('sha256').update(value).digest('hex')
}

function hashFile(filePath) {
  return hashBytes(fs.readFileSync(filePath))
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue)
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stableValue(value[key])]))
  return value
}

export function stableJson(value) {
  return JSON.stringify(stableValue(value))
}

function assertHex(value, label, length) {
  const expression = length === 40 ? SHA1 : SHA256
  if (typeof value !== 'string' || !expression.test(value)) fail(`${label} must be lowercase hexadecimal SHA-${length * 4}`)
  return value
}

function assertSafeId(value, label) {
  if (typeof value !== 'string' || !SAFE_ID.test(value)) fail(`${label} is unsafe`)
  return value
}

function assertRunNumber(value, label) {
  if (typeof value !== 'string' || !RUN_NUMBER.test(value)) fail(`${label} must be a positive decimal number`)
  return value
}

function assertAbsolutePath(value, label) {
  if (typeof value !== 'string' || !path.isAbsolute(value)) fail(`${label} must be an absolute path`)
  return path.resolve(value)
}

function lstatOrFail(target, label) {
  let stats
  try {
    stats = fs.lstatSync(target)
  } catch {
    fail(`${label} is missing`)
  }
  return stats
}

function assertNoSymlinkAncestors(target, label) {
  let cursor = path.resolve(target)
  const root = path.parse(cursor).root
  while (true) {
    let stats
    try {
      stats = fs.lstatSync(cursor)
    } catch {
      cursor = path.dirname(cursor)
      if (cursor === path.dirname(cursor)) break
      continue
    }
    if (stats.isSymbolicLink()) fail(`${label} has a symlink ancestor`)
    if (cursor === root) break
    cursor = path.dirname(cursor)
  }
}

function assertRegularFile(target, label) {
  assertNoSymlinkAncestors(target, label)
  const stats = lstatOrFail(target, label)
  if (!stats.isFile() || stats.isSymbolicLink()) fail(`${label} must be a regular non-symlink file`)
  if (stats.nlink !== undefined && stats.nlink !== 1) fail(`${label} hardlinks are not allowed`)
  return stats
}

function assertDirectory(target, label) {
  assertNoSymlinkAncestors(target, label)
  const stats = lstatOrFail(target, label)
  if (!stats.isDirectory() || stats.isSymbolicLink()) fail(`${label} must be a regular non-symlink directory`)
  return stats
}

function assertDirectoryPrivate(target, label) {
  const stats = assertDirectory(target, label)
  if (process.platform === 'linux') {
    if (stats.uid !== 0 || stats.gid !== 0) fail(`${label} must be owned by root`)
    if ((stats.mode & 0o022) !== 0) fail(`${label} must not be group/world writable`)
  }
  return stats
}

function mode0600(target) {
  try { fs.chmodSync(target, 0o600) } catch { /* Windows has no POSIX mode contract. */ }
}

function mode0700(target) {
  try { fs.chmodSync(target, 0o700) } catch { /* Windows has no POSIX mode contract. */ }
}

function parseLineChecksums(contents) {
  const entries = []
  for (const line of contents.split(/\r?\n/)) {
    if (line === '') continue
    const match = /^(?<digest>[a-f0-9]{64})  (?<name>[A-Za-z0-9._-]+)$/.exec(line)
    if (!match) fail('SHA256SUMS contains a malformed line')
    entries.push({ name: match.groups.name, digest: match.groups.digest })
  }
  return entries
}

export function validateChecksumManifest(manifestPath, expectedDigest, requiredFiles = BUNDLE_FILES.slice(1)) {
  assertRegularFile(manifestPath, 'bundle SHA256SUMS')
  const digest = hashFile(manifestPath)
  assertHex(expectedDigest, 'bundle archive manifest SHA256', 64)
  if (digest !== expectedDigest) fail('bundle archive manifest SHA256 mismatch')
  const entries = parseLineChecksums(fs.readFileSync(manifestPath, 'utf8'))
  if (entries.length !== requiredFiles.length || new Set(entries.map((entry) => entry.name)).size !== entries.length) fail('SHA256SUMS must contain exactly one entry per archive')
  for (const name of requiredFiles) {
    const matches = entries.filter((entry) => entry.name === name)
    if (matches.length !== 1) fail(`SHA256SUMS is missing ${name}`)
  }
  return Object.fromEntries(entries.map((entry) => [entry.name, entry.digest]))
}

function copyImmutableFile(source, destination, label) {
  const before = assertRegularFile(source, label)
  if (before.size < 0) fail(`${label} has an invalid size`)
  fs.copyFileSync(source, destination)
  const after = assertRegularFile(source, label)
  if (before.dev !== after.dev || before.ino !== after.ino || before.size !== after.size || before.mtimeMs !== after.mtimeMs || before.ctimeMs !== after.ctimeMs) fail(`${label} changed while being copied`)
  mode0600(destination)
}

function strictDirectoryNames(source, allowed, label) {
  assertDirectory(source, label)
  const names = fs.readdirSync(source, { withFileTypes: true }).map((entry) => entry.name).sort()
  const allowedSet = new Set(allowed)
  if (names.length !== allowed.length || names.some((name) => !allowedSet.has(name))) fail(`${label} contains unexpected or missing files`)
  return names
}

export function strictCopyImmutableInputs(bundleRoot, trustRoot, destinationRoot) {
  assertAbsolutePath(bundleRoot, 'bundle root')
  assertAbsolutePath(trustRoot, 'trust root')
  assertAbsolutePath(destinationRoot, 'offline incoming root')
  strictDirectoryNames(bundleRoot, BUNDLE_FILES, 'bundle root')
  strictDirectoryNames(trustRoot, TRUST_FILES, 'trust root')
  if (fs.existsSync(destinationRoot)) fail('offline incoming root must be fresh')
  fs.mkdirSync(destinationRoot, { recursive: true, mode: 0o700 })
  mode0700(destinationRoot)
  for (const name of BUNDLE_FILES) copyImmutableFile(path.join(bundleRoot, name), path.join(destinationRoot, name), `bundle ${name}`)
  const destinationTrust = path.join(destinationRoot, 'trust')
  fs.mkdirSync(destinationTrust, { mode: 0o700 })
  mode0700(destinationTrust)
  for (const name of TRUST_FILES) copyImmutableFile(path.join(trustRoot, name), path.join(destinationTrust, name), `trust ${name}`)
  return { bundleRoot: destinationRoot, trustRoot: destinationTrust }
}

function readJsonFile(filePath, label) {
  assertRegularFile(filePath, label)
  try { return JSON.parse(fs.readFileSync(filePath, 'utf8')) } catch { fail(`${label} is invalid JSON`) }
}

function readCurrentManifest(archivePath) {
  assertRegularFile(archivePath, 'current bundle archive')
  let bytes
  try {
    bytes = execFileSync('tar', ['-xOf', archivePath, 'current/bundle-manifest.json'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 4 * 1024 * 1024 })
  } catch {
    fail('current bundle archive does not expose current/bundle-manifest.json')
  }
  try { return JSON.parse(bytes) } catch { fail('current bundle manifest is invalid JSON') }
}

export function validateArchiveMemberPath(member, label = 'archive') {
  if (typeof member !== 'string' || member.includes('\\') || member.startsWith('/') || member.includes('\0')) fail(`${label} contains an unsafe member path`)
  const directory = member.endsWith('/')
  const normalized = directory ? member.slice(0, -1) : member
  const parts = normalized.split('/')
  if (!normalized || parts.some((part) => !part || part === '.' || part === '..')) fail(`${label} contains an unsafe member path`)
  return { normalized, directory }
}

export function validateArchiveEnvelope(archivePath, label) {
  let listing
  let verbose
  try {
    listing = execFileSync('tar', ['-tf', archivePath], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 16 * 1024 * 1024 })
    verbose = execFileSync('tar', ['-tvf', archivePath], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 16 * 1024 * 1024 })
  } catch { fail(`${label} cannot be inspected safely`) }
  const members = listing.split(/\r?\n/).filter(Boolean)
  if (members.length === 0) fail(`${label} is empty`)
  const folded = new Set()
  for (const member of members) {
    const { normalized } = validateArchiveMemberPath(member, label)
    const key = normalized.toLowerCase()
    if (folded.has(key)) fail(`${label} contains duplicate or ambiguous members`)
    folded.add(key)
  }
  for (const line of verbose.split(/\r?\n/).filter(Boolean)) {
    const mode = line.match(/^([d-][rwxStTs-]{9})(?:\s|$)/)?.[1]
    if (!mode) fail(`${label} contains an invalid member mode`)
    if (!['-', 'd'].includes(mode[0])) fail(`${label} contains a non-file/non-directory member`)
    if (mode[5] === 'w' || mode[8] === 'w') fail(`${label} contains a group/world-writable member`)
  }
  if (!members.some((member) => member.endsWith('/bundle-manifest.json'))) fail(`${label} has no bundle manifest`)
  return { members: members.length }
}

function validateImageManifest(manifest) {
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) fail('bundle manifest must be an object')
  if (manifest.schemaVersion !== 1 || manifest.configSchemaVersion !== 1 || manifest.dataClass !== 'synthetic') fail('bundle manifest schema/data class is invalid')
  if (!SAFE_ID.test(manifest.releaseId) || !SHA1.test(manifest.sourceRevision)) fail('bundle manifest release/source identity is invalid')
  if (!manifest.images || typeof manifest.images !== 'object' || Array.isArray(manifest.images)) fail('bundle manifest image map is invalid')
  const names = Object.keys(manifest.images).sort()
  if (names.length !== IMAGE_NAMES.length || names.some((name, index) => name !== [...IMAGE_NAMES].sort()[index])) fail('bundle manifest image map is incomplete')
  for (const name of IMAGE_NAMES) {
    const image = manifest.images[name]
    if (!image || typeof image !== 'object' || typeof image.configImageId !== 'string' || !/^sha256:[a-f0-9]{64}$/.test(image.configImageId)) fail(`bundle manifest image identity is invalid: ${name}`)
  }
  return manifest
}

export function validateImmutableInputs(options, roots) {
  const incoming = roots ?? strictCopyImmutableInputs(options.bundleRoot, options.trustRoot, options.runnerTemp && path.join(options.runnerTemp, 'offline-incoming'))
  const manifestPath = path.join(incoming.bundleRoot, 'SHA256SUMS')
  const archiveDigests = validateChecksumManifest(manifestPath, options.manifestSha256)
  const archiveIdentities = {}
  for (const name of ['current.tar', 'next-transition.tar', 'previous-transition.tar']) {
    const archivePath = path.join(incoming.bundleRoot, name)
    assertRegularFile(archivePath, `bundle ${name}`)
    const digest = hashFile(archivePath)
    if (digest !== archiveDigests[name]) fail(`bundle ${name} SHA256 mismatch`)
    validateArchiveEnvelope(archivePath, `bundle ${name}`)
    archiveIdentities[name] = { sha256: digest, bytes: fs.statSync(archivePath).size }
  }
  const manifest = validateImageManifest(readCurrentManifest(path.join(incoming.bundleRoot, 'current.tar')))
  if (manifest.releaseId !== options.releaseId) fail('bundle releaseId does not match expected release')
  if (manifest.sourceRevision.toLowerCase() !== options.sourceSha) fail('bundle sourceRevision does not match expected source SHA')
  const fingerprintPath = path.join(incoming.trustRoot, 'fingerprint.txt')
  const fingerprint = fs.readFileSync(fingerprintPath, 'utf8').trim()
  assertHex(fingerprint, 'trusted fingerprint', 64)
  if (fingerprint !== options.trustedFingerprint) fail('trusted fingerprint input does not match expected fingerprint')
  const publicKeyPath = path.join(incoming.trustRoot, 'public-key.pem')
  assertRegularFile(publicKeyPath, 'trusted public key')
  let publicKey
  try { publicKey = createPublicKey(fs.readFileSync(publicKeyPath)) } catch { fail('trusted public key is invalid') }
  if (publicKey.asymmetricKeyType !== 'ed25519') fail('trusted public key must be Ed25519')
  const publicKeySha256 = hashBytes(publicKey.export({ type: 'spki', format: 'der' }))
  if (publicKeySha256 !== fingerprint) fail('trusted public key fingerprint mismatch')
  const bootstrapPath = path.join(incoming.trustRoot, 'onprem-offline-bootstrap-verify.mjs')
  assertRegularFile(bootstrapPath, 'trusted bootstrap verifier')
  const bootstrapSha256 = hashFile(bootstrapPath)
  if (bootstrapSha256 !== options.bootstrapSha256) fail('trusted bootstrap SHA256 mismatch')
  const trustReceipt = readJsonFile(path.join(incoming.trustRoot, 'receipt.json'), 'trusted receipt')
  if (trustReceipt.schemaVersion !== 1 || trustReceipt.dataClass !== 'synthetic' || trustReceipt.releaseId !== options.releaseId || trustReceipt.sourceRevision !== options.sourceSha || trustReceipt.keyFingerprintSha256 !== fingerprint) fail('trusted receipt identity is invalid')
  return {
    archiveManifestSha256: options.manifestSha256,
    archiveDigests,
    archiveIdentities,
    manifest: {
      releaseId: manifest.releaseId,
      sourceRevision: manifest.sourceRevision,
      imageIdentities: Object.fromEntries(IMAGE_NAMES.map((name) => [name, manifest.images[name].configImageId])),
    },
    trust: { fingerprint, publicKeySha256, bootstrapSha256 },
  }
}

function lineIndent(line) {
  const match = /^( *)/.exec(line)
  return match ? match[1].length : 0
}

function isStepLine(line, marker) {
  return line.trim() === `- name: ${marker}`
}

/** Extract one GitHub Actions run body without reimplementing its shell operations. */
export function extractWorkflowBlocks(workflowPath = WORKFLOW_PATH) {
  assertRegularFile(workflowPath, 'offline workflow')
  const lines = fs.readFileSync(workflowPath, 'utf8').replace(/\r\n/g, '\n').split('\n')
  const blocks = {}
  for (const marker of WORKFLOW_STEPS) {
    const markerLines = lines.map((line, index) => ({ line, index })).filter(({ line }) => isStepLine(line, marker))
    if (markerLines.length !== 1) fail(`offline workflow marker is missing or duplicated: ${marker}`)
    const markerIndex = markerLines[0].index
    const stepIndent = lineIndent(lines[markerIndex])
    let nextStep = lines.length
    for (let index = markerIndex + 1; index < lines.length; index += 1) {
      if (lineIndent(lines[index]) === stepIndent && lines[index].trim().startsWith('- name: ')) { nextStep = index; break }
    }
    const runLines = []
    for (let index = markerIndex + 1; index < nextStep; index += 1) {
      if (lines[index].trim() === 'run: |') runLines.push(index)
    }
    if (runLines.length !== 1) fail(`offline workflow run block is missing or duplicated: ${marker}`)
    const runIndex = runLines[0]
    const bodyIndent = lineIndent(lines[runIndex]) + 2
    const bodyLines = []
    for (let index = runIndex + 1; index < nextStep; index += 1) {
      const line = lines[index]
      if (line.trim() !== '' && lineIndent(line) < bodyIndent) fail(`offline workflow run body is malformed: ${marker}`)
      bodyLines.push(line === '' ? '' : line.slice(bodyIndent))
    }
    while (bodyLines.length > 0 && bodyLines.at(-1) === '') bodyLines.pop()
    if (bodyLines.length === 0 || !bodyLines.some((line) => line.trim() !== '')) fail(`offline workflow run body is empty: ${marker}`)
    const body = `${bodyLines.join('\n')}\n`
    if (!/^set -euo pipefail\s*$/m.test(body)) fail(`offline workflow run body must be fail-closed: ${marker}`)
    if (/\$\{\{|\b(?:git\s+(?:clone|fetch|pull|checkout)|npm\s+(?:install|ci|run)|docker\s+(?:pull|build)|\b(?:curl|wget)\b)/i.test(body)) fail(`offline workflow run body contains an unsupported source/network operation: ${marker}`)
    blocks[marker] = { marker, body, bodySha256: hashBytes(`${marker}\n${body}`) }
  }
  return blocks
}

export function workflowBodyDigest(blocks) {
  const source = WORKFLOW_STEPS.map((marker) => `${marker}\n${blocks[marker]?.body ?? ''}`).join('\n')
  return hashBytes(source)
}

function resultOf(result) {
  if (!result || typeof result !== 'object') return { status: -1, stdout: '', stderr: '' }
  return {
    status: Number.isInteger(result.status) ? result.status : -1,
    stdout: typeof result.stdout === 'string' ? result.stdout : Buffer.isBuffer(result.stdout) ? result.stdout.toString('utf8') : '',
    stderr: typeof result.stderr === 'string' ? result.stderr : Buffer.isBuffer(result.stderr) ? result.stderr.toString('utf8') : '',
  }
}

function commandOutput(command, args, options = {}) {
  if (options.commandRunner) {
    let result
    try { result = resultOf(options.commandRunner(command, args, options)) } catch (error) { if (isRecoveryDeadlineError(error)) throw error; fail(`${options.label ?? command} failed`) }
    if (result.status !== 0) fail(`${options.label ?? command} failed (exit ${result.status})`)
    return result.stdout.trim()
  }
  try {
    return execFileSync(command, args, {
      encoding: 'utf8',
      stdio: options.input === undefined ? ['ignore', 'pipe', 'pipe'] : ['pipe', 'pipe', 'pipe'],
      input: options.input,
      env: options.env,
      timeout: options.timeout,
      maxBuffer: options.maxBuffer ?? 4 * 1024 * 1024,
    }).trim()
  } catch (error) {
    const detail = error?.status === undefined ? 'not available' : `exit ${error.status}`
    fail(`${options.label ?? command} failed (${detail})`)
  }
}

function commandBytes(command, args, options = {}) {
  if (options.commandRunner) {
    let raw
    try { raw = options.commandRunner(command, args, options) } catch (error) { if (isRecoveryDeadlineError(error)) throw error; fail(`${options.label ?? command} failed`) }
    const result = resultOf(raw)
    if (result.status !== 0) fail(`${options.label ?? command} failed (exit ${result.status})`)
    if (Buffer.isBuffer(raw?.stdout)) return Buffer.from(raw.stdout)
    if (raw?.stdout instanceof Uint8Array) return Buffer.from(raw.stdout)
    return Buffer.from(typeof raw?.stdout === 'string' ? raw.stdout : result.stdout, 'utf8')
  }
  try {
    return execFileSync(command, args, {
      encoding: null,
      stdio: ['pipe', 'pipe', 'pipe'],
      input: options.input,
      env: options.env,
      timeout: options.timeout,
      maxBuffer: options.maxBuffer ?? 16 * 1024 * 1024,
    })
  } catch (error) {
    const detail = error?.status === undefined ? 'not available' : `exit ${error.status}`
    fail(`${options.label ?? command} failed (${detail})`)
  }
}

class RecoveryDeadlineError extends Error {
  constructor(stage, deadlineAt) {
    super(`offline recovery deadline exhausted during ${stage}`)
    this.code = RECOVERY_DEADLINE_CODE
    this.stage = stage
    this.deadlineAt = deadlineAt
  }
}

class RecoveryCommandError extends Error {
  constructor(command) {
    super(`offline recovery command is not approved: ${command}`)
    this.code = RECOVERY_COMMAND_CODE
    this.command = command
  }
}

function isRecoveryDeadlineError(error) {
  return error?.code === RECOVERY_DEADLINE_CODE || error?.code === NATIVE_RECOVERY_DEADLINE_CODE
}

function defaultRecoveryCommandRunner(file, args, options = {}) {
  const result = spawnSync(file, args, {
    encoding: 'utf8',
    windowsHide: true,
    timeout: options.timeout,
    env: { ...RECOVERY_ENV },
    input: options.input,
  })
  return {
    status: Number.isInteger(result.status) ? result.status : -1,
    stdout: typeof result.stdout === 'string' ? result.stdout : '',
    stderr: typeof result.stderr === 'string' ? result.stderr : '',
    timedOut: result.error?.code === 'ETIMEDOUT',
  }
}

function fixedRecoveryCommand(file) {
  if (RECOVERY_FIXED_COMMANDS.has(file)) return RECOVERY_FIXED_COMMANDS.get(file)
  if (RECOVERY_FIXED_PATHS.has(file)) return file
  throw new RecoveryCommandError(file)
}

function boundedRecoveryCommandRunner(commandRunner, deadlineAt, now, stage) {
  const baseRunner = commandRunner ?? defaultRecoveryCommandRunner
  return (file, args, options = {}) => {
    const remaining = deadlineAt - now()
    if (!Number.isFinite(remaining) || remaining < 1) throw new RecoveryDeadlineError(stage, deadlineAt)
    const inheritedTimeout = Number.isFinite(options.timeout) && options.timeout > 0 ? options.timeout : Number.POSITIVE_INFINITY
    const timeout = Math.max(1, Math.min(Math.floor(remaining), inheritedTimeout))
    const approvedFile = fixedRecoveryCommand(file)
    let result
    try {
      result = baseRunner(approvedFile, args, { ...options, timeout, env: RECOVERY_ENV })
    } catch (error) {
      if (isRecoveryDeadlineError(error)) throw error
      throw new Error(`offline recovery command failed during ${stage}`)
    }
    if (result?.timedOut === true || result?.error?.code === 'ETIMEDOUT') throw new RecoveryDeadlineError(stage, deadlineAt)
    if (now() >= deadlineAt) throw new RecoveryDeadlineError(stage, deadlineAt)
    return result
  }
}

function sudoOutput(args, label, options = {}) {
  return commandOutput('sudo', ['-n', ...args], { ...options, label: label ?? `sudo ${args[0]}` })
}

function executableAvailable(name, commandRunner) {
  try {
    const output = commandOutput('bash', ['-lc', `command -v -- ${JSON.stringify(name)}`], { commandRunner, label: `required tool ${name}` })
    if (!output || output.includes('\n')) fail(`required tool ${name} has an ambiguous path`)
  } catch {
    fail(`required tool is unavailable: ${name}`)
  }
}

function validateNodeRuntime(nodePath, expectedDigest, commandRunner) {
  assertAbsolutePath(nodePath, 'pinned Node path')
  assertRegularFile(nodePath, 'pinned Node runtime')
  const version = commandOutput(nodePath, ['--version'], { commandRunner, label: 'pinned Node runtime' })
  if (version !== 'v24.19.0') fail('pinned Node runtime must be v24.19.0')
  const sha256 = hashFile(nodePath)
  if (sha256 !== expectedDigest) fail('pinned Node runtime SHA256 mismatch')
  return { path: nodePath, version, sha256 }
}

function parseDockerJson(value, label) {
  try { return JSON.parse(value) } catch { fail(`${label} returned invalid JSON`) }
}

export function assertDockerEnvironmentSafe(env = process.env) {
  for (const name of ['DOCKER_HOST', 'DOCKER_CONTEXT', 'DOCKER_CONFIG']) {
    if (Object.prototype.hasOwnProperty.call(env ?? {}, name)) fail(`${name} override is not allowed`)
  }
}

function dockerCliArgs(...args) {
  return ['docker', '--host', `unix://${hostContract.socket}`, ...args]
}

function validateDockerRuntime(commandRunner, dockerEnv) {
  assertDockerEnvironmentSafe(process.env)
  const options = { commandRunner, env: dockerEnv }
  const server = parseDockerJson(sudoOutput(dockerCliArgs('version', '--format', '{{json .Server}}'), 'docker server version', options), 'docker server identity')
  const info = parseDockerJson(sudoOutput(dockerCliArgs('info', '--format', '{{json .}}'), 'docker info', options), 'docker info')
  const compose = sudoOutput(dockerCliArgs('compose', 'version', '--short'), 'docker compose version', options)
  const context = 'default'
  const endpoint = `unix://${hostContract.socket}`
  const osName = String(server.Os ?? info.OSType ?? '').toLowerCase()
  const architecture = String(server.Arch ?? info.Architecture ?? '').toLowerCase()
  if (osName !== 'linux' || !['amd64', 'x86_64'].includes(architecture)) fail('Docker daemon must be native Linux amd64')
  const identity = { serverVersion: String(server.Version ?? info.ServerVersion ?? ''), os: osName, architecture, composeVersion: compose, context, endpoint }
  if (!identity.serverVersion) fail('Docker server version identity is missing')
  identity.sha256 = hashBytes(stableJson(identity))
  return identity
}

/**
 * `sudo` commonly applies env_reset, so bare workflow `sudo docker` calls
 * cannot rely on the child DOCKER_* variables.  Prove the root client's
 * selected context and endpoint before any body is allowed to run.
 */
export function validateDockerRootContext(commandRunner) {
  const context = sudoOutput(['docker', 'context', 'show'], 'root Docker context', { commandRunner })
  if (context !== 'default') fail('root Docker context must be default')
  const endpointValue = sudoOutput(['docker', 'context', 'inspect', 'default', '--format', '{{json .Endpoints.docker.Host}}'], 'root Docker context endpoint', { commandRunner })
  let endpoint
  try { endpoint = JSON.parse(endpointValue) } catch { fail('root Docker context endpoint is invalid') }
  if (endpoint !== `unix://${hostContract.socket}`) fail('root Docker context endpoint is not the fixed Docker socket')
  const info = parseDockerJson(sudoOutput(['docker', 'info', '--format', '{{json .}}'], 'root Docker info', { commandRunner }), 'root Docker info')
  if (info.DockerRootDir !== hostContract.dockerDataRoot) fail('root Docker info data-root is not fixed')
  return Object.freeze({ context, endpoint, dockerRootDir: info.DockerRootDir })
}

function validateDockerTargets(commandRunner, dockerEnv) {
  for (const project of PROJECT_NAMES) {
    for (const resource of ['container', 'volume', 'network']) {
      const command = resource === 'container' ? ['ps', '-aq'] : [resource, 'ls', '-q']
      const output = sudoOutput([...dockerCliArgs(...command), '--filter', `label=com.docker.compose.project=${project}`, '--filter', `label=com.hr-axis.project=${project}`], `docker ${resource} preflight`, { commandRunner, env: dockerEnv })
      if (output) fail(`dedicated offline ${resource} already exists for ${project}`)
    }
  }
}

function validateFirewallTargets(commandRunner) {
  const chains = ['HR_AXIS_OFF_DOCKER_EGRESS', 'HR_AXIS_OFFLINE_HOST_EGRESS', 'HR_AXIS_OFFLINE_HOST6_EGRESS']
  for (const chain of chains) {
    const command = chain.endsWith('HOST6_EGRESS') ? 'ip6tables' : 'iptables'
    try {
      sudoOutput([command, '-S', chain], `${command} ${chain}`, { commandRunner })
      fail(`dedicated firewall chain already exists: ${chain}`)
    } catch (error) {
      if (!(error instanceof Error) || !String(error.message).includes('failed')) throw error
    }
  }
  for (const hook of ['DOCKER-USER', 'FORWARD', 'OUTPUT']) sudoOutput(['iptables', '-S', hook], `iptables ${hook}`, { commandRunner })
  sudoOutput(['ip6tables', '-S', 'OUTPUT'], 'ip6tables OUTPUT', { commandRunner })
  try { sudoOutput(['ip', 'link', 'show', 'HRAXIS_OFFLINE6'], 'offline IPv6 probe interface', { commandRunner }); fail('offline IPv6 probe interface already exists') } catch (error) { if (!(error instanceof Error) || !String(error.message).includes('failed')) throw error }
}

function validateHostFilesystem(runId, attempt) {
  for (const target of ['/var', '/var/lib']) assertDirectoryPrivate(target, `host ${target}`)
  const sealedParent = '/var/lib/hr-axis-onprem-offline-proof'
  let sealedParentStats
  try { sealedParentStats = fs.lstatSync(sealedParent) } catch { sealedParentStats = null }
  if (sealedParentStats) assertDirectoryPrivate(sealedParent, 'offline sealed parent')
  const sealedRoot = path.join(sealedParent, `${runId}-${attempt}`)
  let sealedRootStats
  try { sealedRootStats = fs.lstatSync(sealedRoot) } catch { sealedRootStats = null }
  if (sealedRootStats) fail('offline sealed run root already exists')
  return sealedRoot
}

function readGitState(workspaceRoot, commandRunner) {
  assertDirectory(workspaceRoot, 'workspace root')
  const status = commandOutput('git', ['-C', workspaceRoot, 'status', '--porcelain=v1', '--untracked-files=all', '--ignore-submodules=none'], { commandRunner, label: 'git clean-tree preflight' })
  if (status) fail('workspace tree is not clean')
  const head = commandOutput('git', ['-C', workspaceRoot, 'rev-parse', 'HEAD'], { commandRunner, label: 'git HEAD preflight' })
  const tree = commandOutput('git', ['-C', workspaceRoot, 'rev-parse', 'HEAD^{tree}'], { commandRunner, label: 'git tree preflight' })
  assertHex(head, 'git HEAD', 40)
  if (!/^[a-f0-9]{40}$/.test(tree)) fail('git tree identity is invalid')
  return { head, tree }
}

function currentKernelEnvironment(commandRunner) {
  const kernel = commandOutput('uname', ['-srvo'], { commandRunner, label: 'kernel identity' })
  const isWsl = /microsoft|wsl/i.test(kernel) || Boolean(process.env.WSL_INTEROP)
  return { kernel, platform: process.platform, architecture: process.arch, isWsl }
}

export function validatePreflight(options, { workflowBlocks, roots, commandRunner, dockerEnv, platform = process.platform, uid = typeof process.getuid === 'function' ? process.getuid() : null } = {}) {
  if (options.inputError) fail('immutable input validation failed before host mutation')
  const workspaceRoot = assertCanonicalWorkspaceRoot(options.workspaceRoot)
  if (platform !== 'linux') fail('local offline rehearsal is Linux-only; run it inside native Linux or WSL with a native Linux Docker socket')
  if (!Number.isInteger(uid) || uid <= 0) fail('local offline rehearsal must run as a non-root user')
  assertDockerEnvironmentSafe(process.env)
  commandOutput('sudo', ['-n', 'true'], { commandRunner, label: 'non-interactive sudo preflight' })
  for (const tool of REQUIRED_HOST_TOOLS) executableAvailable(tool, commandRunner)
  const environment = currentKernelEnvironment(commandRunner)
  const node = validateNodeRuntime(options.nodePath, options.nodeSha256, commandRunner)
  validateDockerRootContext(commandRunner)
  const docker = validateDockerRuntime(commandRunner, dockerEnv)
  validateDockerTargets(commandRunner, dockerEnv)
  validateFirewallTargets(commandRunner)
  const sealedRoot = validateHostFilesystem(options.runId, options.runAttempt)
  const git = readGitState(workspaceRoot, commandRunner)
  if (git.head !== options.sourceSha) fail('current git HEAD does not match expected source SHA')
  if (git.tree !== options.treeSha) fail('current git tree does not match expected tree SHA')
  const inputIdentity = validateImmutableInputs(options, roots)
  const blocks = workflowBlocks ?? extractWorkflowBlocks()
  return { environment, node, docker, git, sealedRoot, inputIdentity, workflowSha256: hashFile(WORKFLOW_PATH), workflowBodySha256: workflowBodyDigest(blocks), workflowBlocks: blocks }
}

function makeRunRoot(requested) {
  if (requested) {
    assertAbsolutePath(requested, 'run root')
    if (fs.existsSync(requested)) fail('run root must be fresh and absent')
    fs.mkdirSync(requested, { recursive: true, mode: 0o700 })
  } else {
    requested = fs.mkdtempSync(path.join(os.tmpdir(), 'hr-axis-offline-local-'))
  }
  mode0700(requested)
  return path.resolve(requested)
}

function sanitizeChildEnvironment(context) {
  assertDockerEnvironmentSafe(process.env)
  const inherited = {}
  for (const name of ['PATH', 'LANG', 'LC_ALL', 'HOME', 'USER', 'LOGNAME', 'SHELL', 'TERM']) {
    if (process.env[name] && !SENSITIVE_ENV.test(name)) inherited[name] = process.env[name]
  }
  const env = {
    ...inherited,
    HOME: context.dockerHome,
    GITHUB_WORKSPACE: context.workspace,
    RUNNER_TEMP: context.runnerTemp,
    GITHUB_RUN_ID: context.options.runId,
    GITHUB_RUN_ATTEMPT: context.options.runAttempt,
    GITHUB_SHA: context.options.sourceSha,
    EXPECTED_SHA: context.options.sourceSha,
    RELEASE_ID: context.options.releaseId,
    TRUSTED_FINGERPRINT: context.options.trustedFingerprint,
    TRUSTED_BOOTSTRAP_SHA256: context.options.bootstrapSha256,
    BUNDLE_ARCHIVE_MANIFEST_SHA256: context.options.manifestSha256,
    PINNED_NODE_SOURCE: context.options.nodePath,
  }
  for (const name of Object.keys(env)) if (SENSITIVE_ENV.test(name) && !['TRUSTED_FINGERPRINT', 'TRUSTED_BOOTSTRAP_SHA256'].includes(name)) delete env[name]
  // The workflow bodies contain bare `sudo docker` calls.  Keep their
  // unprivileged Docker client configuration fixed after the sensitive-env
  // scrub so an inherited context/socket/config can never reappear.
  Object.assign(env, {
    PATH: RECOVERY_ENV.PATH,
    HOME: context.dockerHome,
    DOCKER_CONFIG: context.dockerConfig,
    DOCKER_CONTEXT: 'default',
    DOCKER_HOST: `unix://${hostContract.socket}`,
  })
  return env
}

export function executeWorkflowBody(body, context, { timeoutMs = 60 * 60 * 1000 } = {}) {
  const identityCheck = context.dockerIdentityCheck ?? (() => inspectDedicatedNativeDockerHost({ env: {}, allowMutableInventory: true }))
  identityCheck()
  const rootContextCheck = context.dockerContextCheck ?? (() => validateDockerRootContext())
  rootContextCheck()
  const timeoutSeconds = Math.max(1, Math.ceil(timeoutMs / 1000))
  const timeoutMarker = path.join(context.runnerTemp, `.workflow-timeout-${process.pid}`)
  const leaderMarker = path.join(context.runnerTemp, `.workflow-leader-${process.pid}`)
  const containmentMarker = path.join(context.runnerTemp, `.workflow-contained-${process.pid}`)
  const supervisor = buildWorkflowSupervisor({ bashPath: 'bash', setsidPath: 'setsid' })
  // The outer shell captures the exact inner setsid leader PID, sends TERM
  // then bounded KILL to the negative process-group ID, and waits/reaps it
  // before returning to the caller's recovery supervisor.
  const result = spawnSync('bash', ['--noprofile', '--norc', '-e', '-u', '-o', 'pipefail', '-c', supervisor, 'offline-workflow-supervisor', timeoutMarker, leaderMarker, containmentMarker, body, String(timeoutSeconds)], {
    cwd: context.workspace,
    env: sanitizeChildEnvironment(context),
    stdio: ['ignore', 'inherit', 'inherit'],
    windowsHide: true,
  })
  let timedOut = false
  let containmentComplete = false
  try {
    timedOut = fs.existsSync(timeoutMarker)
    containmentComplete = fs.existsSync(containmentMarker) && fs.readFileSync(containmentMarker, 'utf8').trim() === '1'
  } finally {
    for (const marker of [timeoutMarker, leaderMarker, containmentMarker]) {
      try { fs.rmSync(marker, { force: true }) } catch { /* cleanup is represented by the outer receipt */ }
    }
  }
  if (result.error) return { status: 'failed', exitCode: result.error.code ?? null, signal: result.error.signal ?? null, timedOut, containmentComplete }
  return { status: result.status === 0 && containmentComplete ? 'passed' : 'failed', exitCode: result.status, signal: result.signal ?? null, timedOut, containmentComplete }
}

function phaseNow() { return new Date().toISOString() }

function runPhase(name, marker, context, phases, execute) {
  const startedAt = phaseNow()
  let outcome
  try { outcome = execute(context.workflowBlocks[marker].body, context) } catch { outcome = { status: 'failed', exitCode: null, signal: null, threw: true, containmentComplete: false } }
  const completedAt = phaseNow()
  const phase = { name, marker, startedAt, completedAt, status: outcome?.status === 'passed' ? 'passed' : 'failed', exitCode: Number.isInteger(outcome?.exitCode) ? outcome.exitCode : null, signal: outcome?.signal ?? null, timedOut: outcome?.timedOut === true, containmentComplete: outcome?.containmentComplete === true }
  phases.push(phase)
  return phase
}

function localPhase(name, phases, callback) {
  const startedAt = phaseNow()
  let status = 'passed'
  try { callback() } catch { status = 'failed' }
  const phase = { name, marker: null, startedAt, completedAt: phaseNow(), status, exitCode: null, signal: null, timedOut: false }
  phases.push(phase)
  return phase
}

export function lifecyclePlan() {
  return [...LIFECYCLE_ORDER]
}

function digestReceiptFiles(directory) {
  const files = {}
  if (!fs.existsSync(directory)) return files
  for (const name of fs.readdirSync(directory).sort()) {
    if (!/^[a-z0-9-]+\.json$/.test(name)) continue
    const target = path.join(directory, name)
    assertRegularFile(target, `internal receipt ${name}`)
    files[name] = hashFile(target)
  }
  return files
}

function sanitizeInternalReceipt(directory, options, phases) {
  const files = digestReceiptFiles(directory)
  const aggregatePath = path.join(directory, 'rehearsal.json')
  const failurePath = path.join(directory, 'rehearsal-failure.json')
  const candidate = fs.existsSync(aggregatePath) ? aggregatePath : (fs.existsSync(failurePath) ? failurePath : null)
  let raw = null
  if (candidate) raw = readJsonFile(candidate, path.basename(candidate))
  const allowedPhase = fs.existsSync(path.join(options.runnerTemp, 'offline-phase')) ? fs.readFileSync(path.join(options.runnerTemp, 'offline-phase'), 'utf8').trim() : 'unknown'
  const lastPhase = ALLOWED_PHASES.has(allowedPhase) ? allowedPhase : 'unknown'
  const egressPhase = phases.find((phase) => phase.name === 'restore-egress')
  const quiescePhase = phases.find((phase) => phase.name === 'quiesce')
  const passed = raw?.status === 'passed' && raw?.sanitized === true && phases.find((phase) => phase.name === 'verify-rehearse')?.status === 'passed'
  const safeAggregate = raw && typeof raw === 'object' ? {
    operation: typeof raw.operation === 'string' ? raw.operation : null,
    status: raw.status === 'passed' ? 'passed' : 'failed',
    releaseId: typeof raw.releaseId === 'string' ? raw.releaseId : null,
    sanitized: raw.sanitized === true,
    aggregateSha256: hashBytes(stableJson(raw)),
    receiptFiles: files,
    egress: raw.egress && typeof raw.egress === 'object' ? {
      receiptSha256: typeof raw.egress.receiptSha256 === 'string' && SHA256.test(raw.egress.receiptSha256) ? raw.egress.receiptSha256 : null,
      dockerIpv4CounterDelta: Number.isInteger(raw.egress.dockerIpv4CounterDelta) ? raw.egress.dockerIpv4CounterDelta : null,
      hostIpv4CounterDelta: Number.isInteger(raw.egress.hostIpv4CounterDelta) ? raw.egress.hostIpv4CounterDelta : null,
      hostIpv6CounterDelta: Number.isInteger(raw.egress.hostIpv6CounterDelta) ? raw.egress.hostIpv6CounterDelta : null,
      hostProbeUid: Number.isInteger(raw.egress.hostProbeUid) ? raw.egress.hostProbeUid : null,
      dockerIpv6Disabled: raw.egress.dockerIpv6Disabled === true,
      rejectRulesVerified: raw.egress.rejectRulesVerified === true,
    } : null,
  } : null
  return { passed, lastPhase, files, safeAggregate, quiesced: quiescePhase?.status === 'passed', restored: egressPhase?.status === 'passed' }
}

function safeReceiptErrorCode(error) {
  const code = error && typeof error.code === 'string' ? error.code : ''
  return /^[A-Za-z0-9._-]{1,80}$/.test(code) ? code : 'LOCK_RELEASE_FAILED'
}

function receiptWithLockReleaseState(value, state) {
  const lockStatus = state.status === 'pending' || state.status === 'released' || state.status === 'failed' ? state.status : 'failed'
  const receipt = {
    ...value,
    status: lockStatus === 'pending' || lockStatus === 'failed' ? 'failed' : value.status,
    lockRelease: {
      status: lockStatus,
      attempted: lockStatus !== 'pending',
      ownerHeld: lockStatus === 'pending' ? true : lockStatus === 'released' ? false : null,
      errorCode: lockStatus === 'failed' ? safeReceiptErrorCode(state.error) : null,
    },
  }
  if (lockStatus === 'pending') receipt.status = 'pending'
  if (lockStatus === 'failed') {
    receipt.failure = {
      ...(value.failure && typeof value.failure === 'object' ? value.failure : {}),
      phase: 'lock-release',
      reason: 'host-lock-release-failed',
      errorCode: receipt.lockRelease.errorCode,
    }
  }
  return receipt
}

function writeExternalReceipt(receiptPath, value, { replaceExisting = false } = {}) {
  assertAbsolutePath(receiptPath, 'external receipt path')
  assertNoSymlinkAncestors(receiptPath, 'external receipt path')
  if (fs.existsSync(receiptPath)) {
    if (!replaceExisting) fail('external receipt path must be fresh and absent')
    assertRegularFile(receiptPath, 'external receipt')
  }
  const parent = path.dirname(receiptPath)
  if (fs.existsSync(parent)) {
    const parentStats = assertDirectory(parent, 'external receipt parent')
    if (process.platform === 'linux' && (parentStats.mode & 0o022) !== 0) fail('external receipt parent must not be group/world writable')
  } else {
    fs.mkdirSync(parent, { recursive: true, mode: 0o700 })
    mode0700(parent)
    assertDirectory(parent, 'external receipt parent')
  }
  const payload = { ...value }
  delete payload.receiptSha256
  payload.receiptSha256 = hashBytes(stableJson(payload))
  const temporary = `${receiptPath}.tmp-${process.pid}`
  fs.writeFileSync(temporary, `${stableJson(payload)}\n`, { mode: 0o600, flag: 'wx' })
  mode0600(temporary)
  try {
    // A rename is atomic on the native Linux filesystem used by this harness.
    // If the target already exists on a platform that refuses replacement,
    // fail closed rather than unlinking it and creating a visibility window.
    fs.renameSync(temporary, receiptPath)
  } catch (error) {
    try { fs.rmSync(temporary, { force: true }) } catch { /* preserve the original failure */ }
    throw error
  }
  return payload.receiptSha256
}

function recoveryCommandOptions(commandRunner, label, input) {
  const options = { commandRunner, env: RECOVERY_ENV, label, timeout: FIREWALL_COMMAND_CAP_MS }
  if (input !== undefined) options.input = input
  return options
}

function captureFirewallSnapshot(firewall, commandRunner) {
  commandOutput(RECOVERY_BINARIES.sudo, ['-n', firewall.probe, '-t', 'raw', '-L'], recoveryCommandOptions(commandRunner, `${firewall.key} firewall raw-table probe`))
  const bytes = commandBytes(RECOVERY_BINARIES.sudo, ['-n', firewall.save, '--counters'], recoveryCommandOptions(commandRunner, `${firewall.key} firewall snapshot`))
  return Object.freeze({ bytes, byteLength: bytes.length, sha256: hashBytes(bytes) })
}

export function captureFirewallSnapshots({ commandRunner } = {}) {
  return Object.freeze(Object.fromEntries(FIREWALLS.map((firewall) => [firewall.key, captureFirewallSnapshot(firewall, commandRunner)])))
}

function restoreFirewallSnapshot(firewall, snapshot, commandRunner) {
  commandOutput(RECOVERY_BINARIES.sudo, ['-n', firewall.restore, '--counters'], recoveryCommandOptions(commandRunner, `${firewall.key} firewall restore`, Buffer.from(snapshot.bytes)))
  const restored = captureFirewallSnapshot(firewall, commandRunner)
  const comparison = compareFirewallSnapshots(snapshot.bytes, restored.bytes, firewall.expectedFamily)
  return Object.freeze({
    byteEqual: comparison.byteEqual,
    timestampOnlyEquivalent: comparison.timestampOnlyEquivalent,
    emptyAutoRawTableEquivalent: comparison.emptyAutoRawTableEquivalent,
    equivalent: comparison.equivalent,
    sha256: restored.sha256,
    byteLength: restored.byteLength,
    diagnostic: comparison.equivalent ? null : analyzeFirewallMismatch(snapshot.bytes, restored.bytes, firewall.expectedFamily),
  })
}

function inventorySummary(value) {
  const inventory = value?.inventory
  if (!inventory || typeof inventory !== 'object') return null
  return Object.freeze({
    containers: Number.isInteger(inventory.containers) ? inventory.containers : null,
    networks: Number.isInteger(inventory.networks) ? inventory.networks : null,
    volumes: Number.isInteger(inventory.volumes) ? inventory.volumes : null,
    images: Number.isInteger(inventory.images) ? inventory.images : null,
  })
}

function fixedControllerIdentity() {
  const marker = expectedNativeDockerHostMarker()
  return Object.freeze({
    contractVersion: hostContract.version,
    markerSchema: marker.schema,
    markerVersion: marker.version,
    socket: hostContract.socket,
    dockerDataRoot: hostContract.dockerDataRoot,
    dockerExecRoot: hostContract.dockerExecRoot,
    containerdRoot: hostContract.containerdRoot,
    containerdState: hostContract.containerdState,
    containerdSocket: hostContract.containerdSocket,
    containerdUnit: hostContract.containerdUnit,
    dockerdUnit: hostContract.dockerdUnit,
  })
}

function generatedCleanupState(context, fsApi = fs) {
  const exists = typeof fsApi.existsSync === 'function' ? (target) => fsApi.existsSync(target) : (target) => fs.existsSync(target)
  return Object.freeze({ runRootAbsent: !exists(context.runRoot), runnerTempAbsent: !exists(context.runnerTemp), clean: !exists(context.runRoot) && !exists(context.runnerTemp) })
}

function controllerArgs(commandRunner, fsApi, platform, uid, callerGid, recoveryDeadlineAt) {
  return { commandRunner, fsApi, platform, uid, callerGid, recoveryDeadlineAt, env: RECOVERY_ENV }
}

export function recoverAfterLifecycle({ context, preflight, lock, beforeHost, snapshots, commandRunner, fsApi, platform = 'linux', uid, callerGid, controller = {}, finalGit, phases = [], now = Date.now, recoveryBudgetMs = RECOVERY_POLICY.budgetMs, firewallFamilyReserveMs = RECOVERY_POLICY.firewallFamilyReserveMs } = {}) {
  const faults = []
  const activeController = { resetDedicatedNativeDockerHost, inspectDedicatedNativeDockerHost, ...controller }
  if (!Number.isSafeInteger(recoveryBudgetMs) || recoveryBudgetMs <= 0) fail('offline recovery budget is invalid')
  if (!Number.isSafeInteger(firewallFamilyReserveMs) || firewallFamilyReserveMs <= 0) fail('offline firewall restore reserve is invalid')
  if (recoveryBudgetMs <= firewallFamilyReserveMs * 2) fail('offline recovery budget cannot reserve both firewall families')
  const startedAtMs = now()
  const deadlineAtMs = startedAtMs + recoveryBudgetMs
  const resetDeadlineAt = deadlineAtMs - (firewallFamilyReserveMs * 2)
  const ipv4DeadlineAt = deadlineAtMs - firewallFamilyReserveMs
  const recoveryCommandRunner = boundedRecoveryCommandRunner(commandRunner, deadlineAtMs, now, 'recovery')
  const resetCommandRunner = boundedRecoveryCommandRunner(commandRunner, resetDeadlineAt, now, 'reset')
  const ipv4CommandRunner = boundedRecoveryCommandRunner(commandRunner, ipv4DeadlineAt, now, 'ipv4-restore')
  const ipv6CommandRunner = boundedRecoveryCommandRunner(commandRunner, deadlineAtMs, now, 'ipv6-restore')
  const controllerOptions = controllerArgs(resetCommandRunner, fsApi, platform, uid, callerGid, resetDeadlineAt)
  let resetAttempted = false
  let resetVerified = false
  let afterHost = null
  let ipv4 = null
  let ipv6 = null
  const recoveryTimeouts = []
  const noteRecoveryError = (stage, error) => {
    if (isRecoveryDeadlineError(error)) recoveryTimeouts.push({ stage, reason: error.message, deadlineAt: error.deadlineAt ?? deadlineAtMs })
  }
  const containmentComplete = phases.filter((phase) => phase?.marker).every((phase) => phase.containmentComplete === true)
  if (!containmentComplete) faults.push('workflow-containment')
  resetAttempted = true
  try {
    const reset = activeController.resetDedicatedNativeDockerHost({ ...controllerOptions, lock, recoveryDeadlineAt: resetDeadlineAt })
    if (reset?.dockerDaemonReset !== true) faults.push('reset-unverified')
    else resetVerified = true
  } catch (error) {
    noteRecoveryError('reset', error)
    faults.push('reset')
  }
  try { ipv4 = restoreFirewallSnapshot(FIREWALLS[0], snapshots.ipv4, ipv4CommandRunner); if (!ipv4.equivalent) faults.push('ipv4-byte-mismatch') } catch (error) { noteRecoveryError('ipv4-restore', error); faults.push('ipv4-restore') }
  try { ipv6 = restoreFirewallSnapshot(FIREWALLS[1], snapshots.ipv6, ipv6CommandRunner); if (!ipv6.equivalent) faults.push('ipv6-byte-mismatch') } catch (error) { noteRecoveryError('ipv6-restore', error); faults.push('ipv6-restore') }
  const postControllerOptions = controllerArgs(recoveryCommandRunner, fsApi, platform, uid, callerGid, deadlineAtMs)
  try {
    afterHost = activeController.inspectDedicatedNativeDockerHost({ ...postControllerOptions, allowMutableInventory: false, recoveryDeadlineAt: deadlineAtMs })
    if (afterHost?.inventory && Object.values(afterHost.inventory).some((value) => value !== 0)) faults.push('postreset-inventory')
  } catch (error) { noteRecoveryError('post-inspection', error); faults.push('post-inspection') }
  let finalSource = null
  try {
    finalSource = finalGit ?? readGitState(context.options.workspaceRoot, recoveryCommandRunner)
    if (finalSource.head !== context.options.sourceSha || finalSource.tree !== context.options.treeSha) faults.push('final-git')
  } catch (error) { noteRecoveryError('final-git', error); faults.push('final-git') }
  const generatedCleanup = generatedCleanupState(context, fsApi)
  if (!generatedCleanup.clean) faults.push('generated-cleanup')
  if (recoveryTimeouts.length > 0) faults.push('recovery-deadline')
  const completedAtMs = now()
  const recovery = Object.freeze({
    ok: faults.length === 0,
    faultCount: faults.length,
    faults: Object.freeze([...faults]),
    contractVersion: fixedControllerIdentity().contractVersion,
    markerVersion: fixedControllerIdentity().markerVersion,
    fixedIdentity: fixedControllerIdentity(),
    lockHeld: lock !== undefined && lock !== null,
    startedAt: new Date(startedAtMs).toISOString(),
    deadlineAt: new Date(deadlineAtMs).toISOString(),
    completedAt: new Date(completedAtMs).toISOString(),
    budgetMs: recoveryBudgetMs,
    resetDeadlineAt: new Date(resetDeadlineAt).toISOString(),
    firewallReserveMs: firewallFamilyReserveMs,
    timeoutReason: recoveryTimeouts[0]?.reason ?? null,
    timeoutReasons: Object.freeze(recoveryTimeouts.map((entry) => Object.freeze({ ...entry }))),
    resetAttempted,
    resetVerified,
    containmentComplete,
    beforeInventory: inventorySummary(beforeHost),
    afterInventory: inventorySummary(afterHost),
    firewall: Object.freeze({
      equal: ipv4?.byteEqual === true && ipv6?.byteEqual === true,
      byteEqual: ipv4?.byteEqual === true && ipv6?.byteEqual === true,
      timestampOnlyEquivalent: ipv4?.equivalent === true && ipv6?.equivalent === true && (ipv4?.timestampOnlyEquivalent === true || ipv6?.timestampOnlyEquivalent === true) && ipv4?.emptyAutoRawTableEquivalent !== true && ipv6?.emptyAutoRawTableEquivalent !== true,
      emptyAutoRawTableEquivalent: ipv4?.equivalent === true && ipv6?.equivalent === true && (ipv4?.emptyAutoRawTableEquivalent === true || ipv6?.emptyAutoRawTableEquivalent === true),
      equivalent: ipv4?.equivalent === true && ipv6?.equivalent === true,
      ipv4: Object.freeze({ attempted: true, sha256: snapshots.ipv4.sha256, byteLength: snapshots.ipv4.byteLength, restoredSha256: ipv4?.sha256 ?? null, byteEqual: ipv4?.byteEqual === true, timestampOnlyEquivalent: ipv4?.timestampOnlyEquivalent === true, emptyAutoRawTableEquivalent: ipv4?.emptyAutoRawTableEquivalent === true, equivalent: ipv4?.equivalent === true, diagnostic: ipv4?.diagnostic ?? null }),
      ipv6: Object.freeze({ attempted: true, sha256: snapshots.ipv6.sha256, byteLength: snapshots.ipv6.byteLength, restoredSha256: ipv6?.sha256 ?? null, byteEqual: ipv6?.byteEqual === true, timestampOnlyEquivalent: ipv6?.timestampOnlyEquivalent === true, emptyAutoRawTableEquivalent: ipv6?.emptyAutoRawTableEquivalent === true, equivalent: ipv6?.equivalent === true, diagnostic: ipv6?.diagnostic ?? null }),
    }),
    generatedCleanup,
    finalSource: finalSource ? Object.freeze({ head: finalSource.head, tree: finalSource.tree, exactMatch: finalSource.head === context.options.sourceSha && finalSource.tree === context.options.treeSha }) : null,
  })
  return recovery
}

function buildReceipt(context, preflight, phases, internal, cleanup, recovery = null) {
  const verifyPhase = phases.find((phase) => phase.name === 'verify-rehearse')
  const restorePhase = phases.find((phase) => phase.name === 'restore-egress')
  const failurePhase = phases.find((phase) => phase.name === 'failure-receipt')
  const materializePhase = phases.find((phase) => phase.name === 'materialize-receipt')
  const lifecyclePassed = preflight ? (internal.passed && verifyPhase?.status === 'passed' && restorePhase?.status === 'passed' && materializePhase?.status === 'passed' && cleanup.status === 'passed') : false
  const status = lifecyclePassed && (recovery === null || recovery.ok === true)
  return {
    schemaVersion: 2,
    operation: 'onprem-offline-local-rehearsal',
    status: status ? 'passed' : 'failed',
    dataClass: 'synthetic',
    source: { headSha: context.options.sourceSha, treeSha: context.options.treeSha, bundleSourceRevision: preflight?.inputIdentity?.manifest?.sourceRevision ?? context.options.sourceSha, exactMatch: preflight ? preflight.git.head === context.options.sourceSha && preflight.git.tree === context.options.treeSha && preflight.inputIdentity?.manifest?.sourceRevision === context.options.sourceSha : false },
    bundle: { releaseId: context.options.releaseId, archiveManifestSha256: context.options.manifestSha256, archives: preflight?.inputIdentity?.archiveIdentities ?? {}, archiveDigests: preflight?.inputIdentity?.archiveDigests ?? {}, images: preflight?.inputIdentity?.manifest?.imageIdentities ?? {} },
    trust: { fingerprintSha256: context.options.trustedFingerprint, bootstrapSha256: context.options.bootstrapSha256, publicKeySha256: preflight?.inputIdentity?.trust?.publicKeySha256 ?? null, nodeSha256: context.options.nodeSha256 },
    runner: { platform: preflight?.environment?.platform ?? process.platform, architecture: preflight?.environment?.architecture ?? process.arch, kernel: preflight?.environment?.kernel ?? null, isWsl: preflight?.environment?.isWsl ?? null, node: preflight?.node ? { path: preflight.node.path, version: preflight.node.version, sha256: preflight.node.sha256 } : { path: context.options.nodePath, version: null, sha256: context.options.nodeSha256 }, docker: preflight?.docker ?? null, runId: context.options.runId, runAttempt: context.options.runAttempt },
    workflow: { path: '.github/workflows/onprem-offline-proof.yml', sha256: preflight?.workflowSha256 ?? hashFile(WORKFLOW_PATH), bodySha256: preflight?.workflowBodySha256 ?? workflowBodyDigest(context.workflowBlocks), bodies: Object.fromEntries(WORKFLOW_STEPS.map((marker) => [marker, context.workflowBlocks[marker].bodySha256])) },
    phases,
    egress: { attempted: phases.some((phase) => phase.name === 'disable-egress'), quiesced: internal.quiesced, restored: internal.restored, restoreStatus: restorePhase?.status ?? 'not-attempted', failureReceiptAfterRestore: !failurePhase || (restorePhase && failurePhase.startedAt >= restorePhase.completedAt), receiptFiles: internal.files, aggregate: internal.safeAggregate },
    recovery,
    cleanup,
    lastPhase: internal.lastPhase,
    sanitized: true,
  }
}

function isWithinPath(parent, candidate) {
  const root = path.resolve(parent)
  const target = path.resolve(candidate)
  return target === root || target.startsWith(`${root}${path.sep}`)
}

function createContext(options, workflowBlocks) {
  const runRoot = makeRunRoot(options.runRoot)
  const runnerTemp = path.join(runRoot, 'runner-temp')
  const workspace = path.join(runRoot, 'workspace')
  const dockerHome = path.join(runnerTemp, 'docker-home')
  const dockerConfig = path.join(runnerTemp, 'docker-config')
  fs.mkdirSync(runnerTemp, { mode: 0o700 })
  fs.mkdirSync(workspace, { mode: 0o700 })
  fs.mkdirSync(dockerHome, { mode: 0o700 })
  fs.mkdirSync(dockerConfig, { mode: 0o700 })
  mode0700(runnerTemp); mode0700(workspace); mode0700(dockerHome); mode0700(dockerConfig)
  const incoming = path.join(runnerTemp, 'offline-incoming')
  let inputError = null
  try { strictCopyImmutableInputs(options.bundleRoot, options.trustRoot, incoming) } catch (error) { inputError = error }
  return { options: { ...options, runnerTemp, inputError }, runRoot, runnerTemp, workspace, dockerHome, dockerConfig, workflowBlocks }
}

export function runLifecycle(context, preflight, { execute = executeWorkflowBody } = {}) {
  const phases = []
  let mutationAttempted = false
  let internal = { passed: false, lastPhase: 'unknown', files: {}, safeAggregate: null, quiesced: false, restored: false }
  let cleanup = { status: 'not-attempted', runRootRemoved: false }
  if (!preflight) {
    cleanup = { status: 'preflight-failed', runRootRemoved: false }
    try { fs.rmSync(context.runRoot, { recursive: true, force: true }); cleanup.runRootRemoved = true } catch { cleanup.status = 'failed' }
    return { phases, internal, cleanup, receipt: buildReceipt(context, null, phases, internal, cleanup) }
  }
  mutationAttempted = true
  const disable = runPhase('disable-egress', WORKFLOW_STEPS[0], context, phases, execute)
  if (disable.status === 'passed') runPhase('verify-rehearse', WORKFLOW_STEPS[1], context, phases, execute)
  runPhase('quiesce', WORKFLOW_STEPS[2], context, phases, execute)
  runPhase('restore-egress', WORKFLOW_STEPS[3], context, phases, execute)
  runPhase('failure-receipt', WORKFLOW_STEPS[4], context, phases, execute)
  let materializeError = null
  try { internal = sanitizeInternalReceipt(path.join(context.runnerTemp, 'offline-receipts'), context.options, phases) } catch (error) {
    materializeError = error
    internal = { passed: false, lastPhase: 'unknown', files: {}, safeAggregate: null, quiesced: phases.find((phase) => phase.name === 'quiesce')?.status === 'passed', restored: phases.find((phase) => phase.name === 'restore-egress')?.status === 'passed' }
  }
  localPhase('materialize-receipt', phases, () => { if (materializeError) throw materializeError })
  const cleanupPhase = runPhase('cleanup', WORKFLOW_STEPS[5], context, phases, execute)
  cleanup = { status: cleanupPhase.status, runRootRemoved: false, runtimeQuiesced: internal.quiesced }
  try {
    fs.rmSync(context.runRoot, { recursive: true, force: true })
    cleanup.runRootRemoved = true
  } catch { cleanup.status = 'failed' }
  const receipt = buildReceipt(context, preflight, phases, internal, cleanup)
  return { phases, internal, cleanup, receipt, mutationAttempted }
}

export function runSupervisedLifecycle(context, preflight, options = {}) {
  if (!preflight) return runLifecycle(context, null, options)
  const snapshots = options.snapshots ?? captureFirewallSnapshots({ commandRunner: options.commandRunner })
  let lifecycle
  try {
    lifecycle = runLifecycle(context, preflight, { execute: options.execute ?? executeWorkflowBody })
  } catch {
    lifecycle = {
      phases: [],
      internal: { passed: false, lastPhase: 'unknown', files: {}, safeAggregate: null, quiesced: false, restored: false },
      cleanup: { status: 'failed', runRootRemoved: false },
      receipt: buildReceipt(context, preflight, [], { passed: false, lastPhase: 'unknown', files: {}, safeAggregate: null, quiesced: false, restored: false }, { status: 'failed', runRootRemoved: false }),
      mutationAttempted: true,
    }
  }
  const recovery = recoverAfterLifecycle({
    context,
    preflight,
    lock: options.lock,
    beforeHost: options.beforeHost,
    snapshots,
    commandRunner: options.commandRunner,
    fsApi: options.fsApi,
    platform: options.platform ?? 'linux',
    uid: options.uid,
    callerGid: options.callerGid,
    controller: options.controller,
    finalGit: options.finalGit,
    phases: lifecycle.phases,
    now: options.now ?? Date.now,
    recoveryBudgetMs: options.recoveryBudgetMs ?? RECOVERY_POLICY.budgetMs,
    firewallFamilyReserveMs: options.firewallFamilyReserveMs ?? RECOVERY_POLICY.firewallFamilyReserveMs,
  })
  lifecycle.recovery = recovery
  lifecycle.receipt = buildReceipt(context, preflight, lifecycle.phases, lifecycle.internal, lifecycle.cleanup, recovery)
  return lifecycle
}

function parseArguments(argv) {
  if (argv.includes('--help')) {
    if (argv.length !== 1) fail('--help cannot be combined with other options')
    return { help: true }
  }
  const names = {
    '--bundle-root': 'bundleRoot', '--trust-root': 'trustRoot', '--manifest-sha256': 'manifestSha256', '--release-id': 'releaseId', '--trusted-fingerprint': 'trustedFingerprint', '--bootstrap-sha256': 'bootstrapSha256', '--node': 'nodePath', '--node-sha256': 'nodeSha256', '--source-sha': 'sourceSha', '--tree-sha': 'treeSha', '--run-id': 'runId', '--run-attempt': 'runAttempt', '--receipt': 'receiptPath', '--workspace-root': 'workspaceRoot', '--run-root': 'runRoot',
  }
  const parsed = {}
  for (let index = 0; index < argv.length; index += 1) {
    const option = argv[index]
    if (option === '--allow-disposable-daemon-reset') {
      if (parsed.allowDisposableDaemonReset) fail(`duplicate option: ${option}`)
      parsed.allowDisposableDaemonReset = true
      continue
    }
    if (!Object.hasOwn(names, option)) fail(`unknown option: ${option}`)
    const key = names[option]
    if (Object.hasOwn(parsed, key)) fail(`duplicate option: ${option}`)
    const value = argv[index + 1]
    if (!value || value.startsWith('--')) fail(`missing value for ${option}`)
    parsed[key] = value
    index += 1
  }
  if (parsed.allowDisposableDaemonReset !== true) fail('missing required option: --allow-disposable-daemon-reset')
  const required = ['bundleRoot', 'trustRoot', 'manifestSha256', 'releaseId', 'trustedFingerprint', 'bootstrapSha256', 'nodePath', 'nodeSha256', 'sourceSha', 'treeSha', 'runId', 'runAttempt', 'receiptPath']
  for (const key of required) if (!parsed[key]) fail(`missing required option: ${key}`)
  parsed.bundleRoot = assertAbsolutePath(parsed.bundleRoot, '--bundle-root')
  parsed.trustRoot = assertAbsolutePath(parsed.trustRoot, '--trust-root')
  parsed.nodePath = assertAbsolutePath(parsed.nodePath, '--node')
  parsed.receiptPath = assertAbsolutePath(parsed.receiptPath, '--receipt')
  if (parsed.workspaceRoot) parsed.workspaceRoot = assertAbsolutePath(parsed.workspaceRoot, '--workspace-root')
  else parsed.workspaceRoot = REPOSITORY_ROOT
  parsed.workspaceRoot = assertCanonicalWorkspaceRoot(parsed.workspaceRoot)
  if (parsed.runRoot) parsed.runRoot = assertAbsolutePath(parsed.runRoot, '--run-root')
  if (parsed.runRoot && isWithinPath(parsed.runRoot, parsed.receiptPath)) fail('--receipt must remain external to --run-root')
  parsed.manifestSha256 = assertHex(parsed.manifestSha256, '--manifest-sha256', 64)
  parsed.trustedFingerprint = assertHex(parsed.trustedFingerprint, '--trusted-fingerprint', 64)
  parsed.bootstrapSha256 = assertHex(parsed.bootstrapSha256, '--bootstrap-sha256', 64)
  parsed.nodeSha256 = assertHex(parsed.nodeSha256, '--node-sha256', 64)
  parsed.sourceSha = assertHex(parsed.sourceSha, '--source-sha', 40)
  parsed.treeSha = assertHex(parsed.treeSha, '--tree-sha', 40)
  parsed.releaseId = assertSafeId(parsed.releaseId, '--release-id')
  parsed.runId = assertRunNumber(parsed.runId, '--run-id')
  parsed.runAttempt = assertRunNumber(parsed.runAttempt, '--run-attempt')
  return parsed
}

export const parseCliArguments = parseArguments

export function helpText() {
  return `Usage: npm run check:onprem:offline:local -- --allow-disposable-daemon-reset --bundle-root ABS --trust-root ABS --manifest-sha256 SHA256 --release-id ID --trusted-fingerprint SHA256 --bootstrap-sha256 SHA256 --node ABS --node-sha256 SHA256 --source-sha SHA1 --tree-sha SHA1 --run-id N --run-attempt N --receipt ABS [--workspace-root ABS] [--run-root ABS]\n\nLinux-only, source-free, disposable rehearsal. The explicit reset opt-in is required before mutable work. Inputs are immutable and copied into a fresh 0700 runner temp. The runner extracts and executes the six exact workflow run bodies in order; it never fetches, builds, pulls, or edits the workflow. A sanitized external receipt is written only after controller recovery.\n`
}

export function runLocalRehearsal(options, dependencies = {}) {
  if (!options || options.allowDisposableDaemonReset !== true) fail('explicit disposable daemon reset opt-in is required')
  const commandRunner = dependencies.commandRunner
  const fsApi = dependencies.fsApi ?? fs
  const platform = dependencies.platform ?? process.platform
  const uid = dependencies.uid ?? (typeof process.getuid === 'function' ? process.getuid() : null)
  const controller = { acquireHostLock, inspectDedicatedNativeDockerHost, releaseHostLock, ...dependencies.controller }
  const writeReceipt = dependencies.writeReceipt ?? writeExternalReceipt
  assertDockerEnvironmentSafe(dependencies.env ?? process.env)
  if (platform !== 'linux') fail('local offline rehearsal is Linux-only; run it inside native Linux or WSL with a native Linux Docker socket')
  if (!Number.isInteger(uid) || uid <= 0) fail('local offline rehearsal must run as a non-root user')
  let lock = null
  let context = null
  let preflight = null
  let receiptBase = null
  let receiptMaterialized = false
  let releaseAttempted = false
  let releaseState = { status: 'pending', error: null }
  let terminalReceipt = null
  const materializeReceipt = (receipt) => {
    receiptBase = receipt
    const pending = receiptWithLockReleaseState(receiptBase, releaseState)
    writeReceipt(options.receiptPath, pending)
    receiptMaterialized = true
    terminalReceipt = pending
    return pending
  }
  const finalizeReceipt = () => {
    if (!receiptMaterialized || !receiptBase) return null
    const terminal = receiptWithLockReleaseState(receiptBase, releaseState)
    writeReceipt(options.receiptPath, terminal, { replaceExisting: true })
    terminalReceipt = terminal
    return terminal
  }
  const releaseHeldLock = () => {
    if (releaseAttempted) return releaseState.status === 'released'
    releaseAttempted = true
    try {
      controller.releaseHostLock(lock, controllerArgs(commandRunner, fsApi, platform, uid, dependencies.callerGid))
      releaseState = { status: 'released', error: null }
      lock = null
      return true
    } catch (error) {
      // The controller's ownership is unknown after a failed release.  Do not
      // retry it from finally, and do not claim the host is safely released.
      releaseState = { status: 'failed', error }
      lock = null
      throw error
    }
  }
  const lockReleaseError = () => new Error(`offline host lock release failed (${safeReceiptErrorCode(releaseState.error)})`)
  try {
    lock = controller.acquireHostLock(controllerArgs(commandRunner, fsApi, platform, uid, dependencies.callerGid))
    const beforeHost = controller.inspectDedicatedNativeDockerHost({ ...controllerArgs(commandRunner, fsApi, platform, uid, dependencies.callerGid), allowMutableInventory: false })
    if (!beforeHost?.inventory || Object.values(beforeHost.inventory).some((value) => value !== 0)) fail('dedicated Docker host inventory is not empty')
    commandOutput('sudo', ['-n', 'true'], { commandRunner, label: 'non-interactive sudo preflight' })
    const blocks = dependencies.workflowBlocks ?? extractWorkflowBlocks()
    context = dependencies.context ?? createContext(options, blocks)
    if (!context.dockerIdentityCheck) {
      context.dockerIdentityCheck = () => controller.inspectDedicatedNativeDockerHost({ ...controllerArgs(commandRunner, fsApi, platform, uid, dependencies.callerGid), allowMutableInventory: true })
    }
    if (!context.dockerContextCheck) context.dockerContextCheck = () => validateDockerRootContext(commandRunner)
    try {
      preflight = dependencies.preflight ?? validatePreflight(context.options, {
        workflowBlocks: blocks,
        roots: { bundleRoot: path.join(context.runnerTemp, 'offline-incoming'), trustRoot: path.join(context.runnerTemp, 'offline-incoming', 'trust') },
        commandRunner,
        dockerEnv: { HOME: context.dockerHome, DOCKER_CONFIG: context.dockerConfig, DOCKER_CONTEXT: 'default' },
        platform,
        uid,
      })
    } catch (error) {
      const failed = runLifecycle(context, null, { execute: () => ({ status: 'failed', exitCode: null }) })
      const receipt = { ...failed.receipt, failure: { phase: 'preflight', reason: 'validation-failed-before-egress-mutation' } }
      materializeReceipt(receipt)
      throw error
    }
    let snapshots
    try {
      snapshots = dependencies.snapshots ?? captureFirewallSnapshots({ commandRunner })
    } catch (error) {
      // Firewall capture is before the mutable lifecycle.  Still leave a
      // sanitized failed receipt behind so callers can distinguish this
      // pre-mutation stop from a lock/recovery failure.
      const failed = runLifecycle(context, null, { execute: () => ({ status: 'failed', exitCode: null, containmentComplete: true }) })
      const receipt = { ...failed.receipt, failure: { phase: 'firewall-snapshot', reason: 'snapshot-capture-failed-before-egress-mutation' } }
      materializeReceipt(receipt)
      throw error
    }
    const result = runSupervisedLifecycle(context, preflight, {
      lock,
      beforeHost,
      commandRunner,
      fsApi,
      platform,
      uid,
      callerGid: dependencies.callerGid,
      controller,
      execute: dependencies.execute,
      snapshots,
      finalGit: dependencies.finalGit,
      now: dependencies.now,
      recoveryBudgetMs: dependencies.recoveryBudgetMs,
      firewallFamilyReserveMs: dependencies.firewallFamilyReserveMs,
    })
    materializeReceipt(result.receipt)
    let releaseError = null
    try {
      releaseHeldLock()
    } catch (error) {
      releaseError = error
    }
    let finalReceipt
    try {
      finalReceipt = finalizeReceipt()
    } catch (error) {
      if (releaseError) throw new Error('offline host lock release failed; failed receipt rewrite unavailable')
      throw error
    }
    result.receipt = finalReceipt
    if (releaseError) throw lockReleaseError()
    if (result.receipt.status !== 'passed') fail('offline local rehearsal failed; inspect the sanitized receipt')
    return result
  } finally {
    if (lock && !releaseAttempted) {
      let releaseError = null
      try {
        releaseHeldLock()
      } catch (error) {
        releaseError = error
      }
      try {
        finalizeReceipt()
      } catch (error) {
        if (releaseError) throw new Error('offline host lock release failed; failed receipt rewrite unavailable')
        throw error
      }
      if (releaseError) throw lockReleaseError()
    }
  }
}

function main() {
  try {
    const options = parseArguments(process.argv.slice(2))
    if (options.help) { process.stdout.write(helpText()); return }
    const result = runLocalRehearsal(options)
    process.stdout.write(`offline local rehearsal ${result.receipt.status}: ${options.receiptPath}\n`)
  } catch (error) {
    process.stderr.write(`offline local rehearsal stopped: ${error.message}\n`)
    process.exitCode = 1
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) main()
