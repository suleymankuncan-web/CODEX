import { execFileSync } from 'node:child_process'
import { createHash, createPublicKey } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { parsePassedImageReceipt } from './onprem-native-session-proof.mjs'

const SHA256 = /^[a-f0-9]{64}$/
const JSON_INPUT_LIMIT_BYTES = 8 * 1024 * 1024
const COPY_CHUNK_BYTES = 64 * 1024
export const BUNDLE_FILES = Object.freeze(['SHA256SUMS', 'current.tar', 'next-transition.tar', 'previous-transition.tar'])
export const TRUST_FILES = Object.freeze(['public-key.pem', 'fingerprint.txt', 'receipt.json', 'onprem-offline-bootstrap-verify.mjs'])
export const FIXED_LINUX_TOOLS = Object.freeze({ git: '/usr/bin/git', tar: '/usr/bin/tar', bash: '/usr/bin/bash', setsid: '/usr/bin/setsid' })
const PROOF_RECEIPT_PATH = 'onprem-image-proof/onprem-proof-receipt.json'
const PROOF_RECEIPT_GROUP = 'onprem-image-proof'

function fail(message) { throw new Error(message) }
function object(value) { return value !== null && typeof value === 'object' && !Array.isArray(value) }
export function hashBytes(value) { return createHash('sha256').update(value).digest('hex') }
export function assertAbsolute(value, label) {
  if (typeof value !== 'string' || !path.isAbsolute(value) || path.normalize(value) !== value) fail(`${label} must be an absolute normalized path`)
  return path.resolve(value)
}
export function isWithin(candidate, root) {
  const relative = path.relative(path.resolve(root), path.resolve(candidate))
  return relative === '' || (relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative))
}
export function noSymlinkAncestors(target, label) {
  let cursor = path.resolve(target)
  const root = path.parse(cursor).root
  while (true) {
    let stats
    try { stats = fs.lstatSync(cursor) } catch { cursor = path.dirname(cursor); if (cursor === path.dirname(cursor)) break; continue }
    if (stats.isSymbolicLink()) fail(`${label} has a symlink ancestor`)
    if (cursor === root) break
    cursor = path.dirname(cursor)
  }
}
function assertPrivateOwnerMode(stats, label, platform, uid, directoryTarget = false, privateMode = true) {
  if (platform !== 'linux' || process.platform !== 'linux') return
  if (Number.isInteger(uid) && Number.isInteger(stats.uid) && stats.uid !== uid) fail(`${label} owner is not the caller`)
  if (privateMode && (stats.mode & 0o077) !== 0) fail(`${label} must be private`)
  if (directoryTarget && (stats.mode & 0o700) !== 0o700) fail(`${label} must be caller-accessible`)
}
function statSnapshot(target, stats, sha256, bytes = stats.size) {
  return Object.freeze({
    path: path.resolve(target), sha256, bytes, mode: stats.mode,
    uid: Number.isInteger(stats.uid) ? stats.uid : null,
    gid: Number.isInteger(stats.gid) ? stats.gid : null,
    nlink: stats.nlink, dev: Number.isInteger(stats.dev) ? stats.dev : null,
    ino: Number.isInteger(stats.ino) ? stats.ino : null, mtimeMs: stats.mtimeMs, ctimeMs: stats.ctimeMs,
  })
}
function sameFileIdentity(before, after) {
  // Pathname replacement can update Linux ctime without changing descriptor bytes; receipt snapshots still retain ctime.
  return ['dev', 'ino', 'mode', 'uid', 'gid', 'nlink', 'size', 'mtimeMs'].every((key) => before[key] === after[key])
}
function descriptorStats(fd, label, { platform = process.platform, uid, privateMode = true } = {}) {
  const stats = fs.fstatSync(fd)
  if (!stats.isFile() || stats.isSymbolicLink()) fail(`${label} must be a regular non-symlink file`)
  if (stats.nlink !== undefined && stats.nlink !== 1) fail(`${label} hardlinks are not allowed`)
  assertPrivateOwnerMode(stats, label, platform, uid, false, privateMode)
  return stats
}
function descriptorFlags() {
  const flags = fs.constants.O_RDONLY
  if (process.platform === 'linux' && Number.isInteger(fs.constants.O_NOFOLLOW)) return flags | fs.constants.O_NOFOLLOW
  return flags
}
function withStableDescriptor(target, label, options = {}, callback) {
  const { platform = process.platform, uid, privateMode = true, beforeRead, afterRead, maxBytes = Number.POSITIVE_INFINITY } = options
  noSymlinkAncestors(target, label)
  let fd
  try { fd = fs.openSync(target, descriptorFlags()) } catch { fail(`${label} cannot be opened as a stable descriptor`) }
  try {
    const before = descriptorStats(fd, label, { platform, uid, privateMode })
    if (before.size > maxBytes) fail(`${label} exceeds the bounded capture size`)
    beforeRead?.(Object.freeze({ ...before }))
    const result = callback(fd, before)
    afterRead?.(Object.freeze({ ...before }), result)
    const after = descriptorStats(fd, label, { platform, uid, privateMode })
    if (!sameFileIdentity(before, after)) fail(`${label} changed during descriptor read`)
    return Object.freeze({ result, snapshot: statSnapshot(target, after, result.sha256 ?? null, result.bytes ?? after.size), bytes: result.bytes, sha256: result.sha256 })
  } finally {
    try { fs.closeSync(fd) } catch { /* descriptor identity check is authoritative */ }
  }
}
function readDescriptorBytes(fd, size, label) {
  const output = Buffer.allocUnsafe(size)
  let offset = 0
  while (offset < size) {
    const count = fs.readSync(fd, output, offset, size - offset, null)
    if (!count) fail(`${label} ended before its captured size`)
    offset += count
  }
  return output
}
export function readStableJsonFile(target, label, options = {}) {
  const captured = withStableDescriptor(target, label, { ...options, maxBytes: options.maxBytes ?? JSON_INPUT_LIMIT_BYTES }, (fd, before) => {
    const bytes = readDescriptorBytes(fd, before.size, label)
    let value
    try { value = JSON.parse(bytes.toString('utf8')) } catch { fail(`${label} is invalid JSON`) }
    return { value, bytes: bytes.length, sha256: hashBytes(bytes) }
  })
  return Object.freeze({ value: captured.result.value, bytes: captured.result.bytes, sha256: captured.result.sha256, snapshot: captured.snapshot })
}
function readStableTextFile(target, label, options = {}) {
  const captured = withStableDescriptor(target, label, { ...options, maxBytes: options.maxBytes ?? JSON_INPUT_LIMIT_BYTES }, (fd, before) => {
    const bytes = readDescriptorBytes(fd, before.size, label)
    return { value: bytes.toString('utf8'), bytes: bytes.length, sha256: hashBytes(bytes) }
  })
  return Object.freeze({ value: captured.result.value, bytes: captured.result.bytes, sha256: captured.result.sha256, snapshot: captured.snapshot })
}
function streamDescriptor(fd, sink) {
  const digest = createHash('sha256')
  const chunk = Buffer.allocUnsafe(COPY_CHUNK_BYTES)
  let bytes = 0
  while (true) {
    const count = fs.readSync(fd, chunk, 0, chunk.length, null)
    if (!count) break
    const piece = chunk.subarray(0, count)
    digest.update(piece)
    sink?.(piece)
    bytes += count
  }
  return { bytes, sha256: digest.digest('hex') }
}
export function stableFileSnapshot(target, label, options = {}) {
  return withStableDescriptor(target, label, options, (fd) => streamDescriptor(fd)).snapshot
}
export function immutableFileSnapshot(target, label, options = {}) { return stableFileSnapshot(target, label, options) }
export function copyStableFile(source, destination, label, options = {}) {
  noSymlinkAncestors(path.dirname(destination), `${label} destination parent`)
  let destinationFd
  const copied = withStableDescriptor(source, label, options.sourceOptions ?? {}, (sourceFd) => {
    try {
      destinationFd = fs.openSync(destination, fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL, 0o600)
      return streamDescriptor(sourceFd, (piece) => {
        let offset = 0
        while (offset < piece.length) offset += fs.writeSync(destinationFd, piece, offset, piece.length - offset, null)
      })
    } finally {
      try { if (destinationFd !== undefined) fs.fsyncSync(destinationFd) } catch { /* destination digest below is authoritative */ }
      try { if (destinationFd !== undefined) fs.closeSync(destinationFd) } catch { /* destination digest below is authoritative */ }
    }
  })
  try { fs.chmodSync(destination, 0o600) } catch { /* best effort on non-POSIX hosts */ }
  options.afterCopy?.(destination)
  const destinationSnapshot = stableFileSnapshot(destination, `${label} destination`, options.destinationOptions ?? {})
  if (destinationSnapshot.sha256 !== copied.sha256 || destinationSnapshot.bytes !== copied.bytes) fail(`${label} destination verification failed`)
  return Object.freeze({ bytes: copied.bytes, sha256: copied.sha256, source: copied.snapshot, destination: destinationSnapshot })
}
export function regularFile(target, label, { mustExist = true } = {}) {
  noSymlinkAncestors(target, label)
  let stats
  try { stats = fs.lstatSync(target) } catch { if (mustExist) fail(`${label} is missing`); return null }
  if (!stats.isFile() || stats.isSymbolicLink()) fail(`${label} must be a regular non-symlink file`)
  if (stats.nlink !== undefined && stats.nlink !== 1) fail(`${label} hardlinks are not allowed`)
  return stats
}
export function directory(target, label, { mustExist = true } = {}) {
  noSymlinkAncestors(target, label)
  let stats
  try { stats = fs.lstatSync(target) } catch { if (mustExist) fail(`${label} is missing`); return null }
  if (!stats.isDirectory() || stats.isSymbolicLink()) fail(`${label} must be a non-symlink directory`)
  return stats
}
export function freshPath(target, label) {
  const candidate = assertAbsolute(target, label)
  noSymlinkAncestors(path.dirname(candidate), `${label} parent`)
  if (fs.existsSync(candidate)) fail(`${label} must be fresh and absent`)
  if (!fs.existsSync(path.dirname(candidate))) fail(`${label} parent must exist`)
  return candidate
}
export function privateDirectory(target, label) {
  fs.mkdirSync(target, { recursive: true, mode: 0o700 })
  try { fs.chmodSync(target, 0o700) } catch { /* Windows has no POSIX mode */ }
  directory(target, label)
}
export function immutableDirectorySnapshot(target, label, { platform = process.platform, uid } = {}) {
  noSymlinkAncestors(target, label)
  const stats = directory(target, label)
  assertPrivateOwnerMode(stats, label, platform, uid, true)
  let canonical
  try { canonical = fs.realpathSync(target) } catch { fail(`${label} cannot be canonicalized`) }
  if (canonical !== path.resolve(target)) fail(`${label} must not be a symlink alias`)
  return Object.freeze({ path: canonical, mode: stats.mode, uid: Number.isInteger(stats.uid) ? stats.uid : null, gid: Number.isInteger(stats.gid) ? stats.gid : null, nlink: stats.nlink })
}
function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue)
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stableValue(value[key])]))
  return value
}
export function sameSnapshot(before, after) { return JSON.stringify(stableValue(before)) === JSON.stringify(stableValue(after)) }

export function fixedToolEnvironment(home = '/nonexistent') {
  return {
    PATH: '/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin', LANG: 'C', LC_ALL: 'C', HOME: home,
    GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_SYSTEM: '/dev/null', GIT_TERMINAL_PROMPT: '0',
    GIT_OPTIONAL_LOCKS: '0', GIT_ALLOW_PROTOCOL: 'file', GIT_SSH_COMMAND: '/usr/bin/false',
  }
}
export function fixedToolPath(name) {
  const candidate = FIXED_LINUX_TOOLS[name]
  if (!candidate || process.platform !== 'linux') fail(`fixed Linux tool is unavailable: ${name}`)
  noSymlinkAncestors(candidate, `fixed ${name}`)
  const stats = fs.lstatSync(candidate)
  if (!stats.isFile() || stats.isSymbolicLink() || stats.nlink !== 1 || (stats.mode & 0o111) === 0) fail(`fixed ${name} is not a regular executable`)
  if (fs.realpathSync(candidate) !== candidate) fail(`fixed ${name} is not canonical`)
  return candidate
}

export function validateProofArtifactManifest(imageProofRoot, expected = {}, dependencies = {}) {
  const platform = expected.platform ?? process.platform
  const uid = expected.uid
  const rootInput = assertAbsolute(imageProofRoot, 'image proof root')
  const rootSnapshot = immutableDirectorySnapshot(rootInput, 'image proof root', { platform, uid })
  let root
  try { root = fs.realpathSync(rootInput) } catch { fail('image proof root cannot be canonicalized') }
  const manifestPath = path.join(root, 'artifact-manifest.json')
  const manifestCaptured = readStableJsonFile(manifestPath, 'proof artifact manifest', { platform, uid, beforeRead: dependencies.manifestBeforeRead, afterRead: dependencies.manifestAfterRead })
  const manifest = manifestCaptured.value
  if (!object(manifest) || manifest.schemaVersion !== 1 || manifest.dataClass !== 'synthetic' || manifest.proofMode !== 'full' || manifest.imageScope !== 'both') fail('proof artifact manifest identity is invalid')
  if (expected.sourceSha && manifest.expectedSha !== expected.sourceSha) fail('proof artifact manifest source identity does not match')
  if (!SHA256.test(manifest.receiptSha256 ?? '')) fail('proof artifact manifest receipt binding is invalid')
  if (!Array.isArray(manifest.artifacts) || manifest.artifacts.length === 0) fail('proof artifact manifest artifacts are missing')
  const seen = new Set(); const files = []
  for (const artifact of manifest.artifacts) {
    if (!object(artifact) || typeof artifact.path !== 'string' || artifact.path.startsWith('/') || artifact.path.includes('\\') || artifact.path.split('/').some((part) => !part || part === '.' || part === '..')) fail('proof artifact manifest path is unsafe')
    if (seen.has(artifact.path)) fail('proof artifact manifest contains a duplicate path')
    seen.add(artifact.path)
    if (!Number.isSafeInteger(artifact.bytes) || artifact.bytes < 0 || !SHA256.test(artifact.sha256)) fail('proof artifact manifest file declaration is invalid')
    const source = path.resolve(root, ...artifact.path.split('/'))
    if (!isWithin(source, root) || source === root) fail('proof artifact manifest path escapes input root')
    const snapshot = stableFileSnapshot(source, `proof artifact ${artifact.path}`, { platform, uid, privateMode: false })
    if (snapshot.bytes !== artifact.bytes) fail(`proof artifact size mismatch: ${artifact.path}`)
    if (snapshot.sha256 !== artifact.sha256.toLowerCase()) fail(`proof artifact SHA-256 mismatch: ${artifact.path}`)
    files.push({ ...artifact, path: artifact.path, source, bytes: snapshot.bytes, sha256: snapshot.sha256, snapshot })
  }
  const proofReceipts = files.filter((file) => file.path === PROOF_RECEIPT_PATH)
  if (proofReceipts.length !== 1) fail('proof artifact manifest must declare exactly one producer proof receipt')
  const proofReceipt = proofReceipts[0]
  if (proofReceipt.group !== PROOF_RECEIPT_GROUP) fail('proof artifact manifest proof receipt group is invalid')
  if (proofReceipt.sha256 !== manifest.receiptSha256) fail('proof artifact manifest receiptSha256 does not match producer proof receipt')
  return Object.freeze({ manifestPath, manifest, manifestSha256: manifestCaptured.sha256, manifestSnapshot: manifestCaptured.snapshot, rootSnapshot, proofReceiptSha256: proofReceipt.sha256, files })
}
export function validateImageProofInput(options, manifestFacts = validateProofArtifactManifest(options.imageProofRoot, options), dependencies = {}) {
  const captured = readStableJsonFile(options.imageReceipt, 'image receipt', { platform: options.platform ?? dependencies.platform ?? process.platform, uid: options.uid ?? dependencies.uid, beforeRead: dependencies.receiptBeforeRead, afterRead: dependencies.receiptAfterRead })
  const value = captured.value
  let parsed
  const parser = dependencies.parsePassedImageReceipt ?? parsePassedImageReceipt
  try { parsed = parser(value, { sourceSha: options.sourceSha, treeSha: options.treeSha, nodeSha256: options.nodeSha256 }) } catch (error) { fail(error instanceof Error ? error.message : 'image receipt is not passed') }
  if (value.artifact?.manifestSha256 !== manifestFacts.manifestSha256) fail('image receipt artifact manifest hash does not match')
  if (value.artifact?.evidenceSha !== manifestFacts.manifest.evidenceSha) fail('image receipt evidence hash does not match artifact manifest')
  if (manifestFacts.proofReceiptSha256 !== manifestFacts.manifest.receiptSha256) fail('artifact manifest producer proof receipt binding is invalid')
  return Object.freeze({ value, parsed, imageReceiptSha256: captured.sha256, proofReceiptSha256: manifestFacts.proofReceiptSha256, imageReceiptSnapshot: captured.snapshot, artifactManifestSha256: manifestFacts.manifestSha256, manifest: manifestFacts.manifest, files: manifestFacts.files })
}

function verifyChecksumManifest(root) {
  const captured = readStableTextFile(path.join(root, 'SHA256SUMS'), 'bundle SHA256SUMS', { maxBytes: 4096, privateMode: false })
  const lines = captured.value.split(/\r?\n/).filter(Boolean)
  if (lines.length !== 3) fail('bundle SHA256SUMS must list exactly three archives')
  const expected = {}; const archiveFiles = { SHA256SUMS: captured.snapshot }
  for (const line of lines) {
    const match = line.match(/^([a-f0-9]{64})  (current\.tar|next-transition\.tar|previous-transition\.tar)$/)
    if (!match || expected[match[2]]) fail('bundle SHA256SUMS is malformed')
    expected[match[2]] = match[1]
  }
  for (const name of BUNDLE_FILES.slice(1)) {
    const snapshot = stableFileSnapshot(path.join(root, name), `bundle ${name}`, { privateMode: false })
    if (snapshot.sha256 !== expected[name]) fail(`bundle ${name} SHA-256 mismatch`)
    archiveFiles[name] = snapshot
  }
  return { manifestSha256: captured.sha256, archiveDigests: expected, archiveFiles: Object.freeze(archiveFiles) }
}
function tarCurrentManifest(archive) {
  try {
    return JSON.parse(execFileSync(fixedToolPath('tar'), ['-xOf', archive, 'current/bundle-manifest.json'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], env: fixedToolEnvironment(), maxBuffer: 1024 * 1024 }))
  } catch { fail('current bundle manifest is unavailable') }
}
export function validateBundleHandoff(archivesRoot, trustSourceRoot, expected) {
  directory(archivesRoot, 'bundle archive root'); directory(trustSourceRoot, 'trust root')
  if (fs.readdirSync(archivesRoot).sort().join(',') !== [...BUNDLE_FILES].sort().join(',')) fail('bundle archive handoff contains unsupported files')
  if (fs.readdirSync(trustSourceRoot).sort().join(',') !== [...TRUST_FILES].sort().join(',')) fail('trust handoff contains unsupported files')
  const checksums = verifyChecksumManifest(archivesRoot)
  const current = tarCurrentManifest(path.join(archivesRoot, 'current.tar'))
  if (!object(current) || current.sourceRevision !== expected.sourceSha || current.releaseId !== expected.releaseId) fail('current bundle identity does not match package output')
  const fingerprintCaptured = readStableTextFile(path.join(trustSourceRoot, 'fingerprint.txt'), 'trust fingerprint', { maxBytes: 1024, privateMode: false })
  const fingerprint = fingerprintCaptured.value.trim()
  if (fingerprint !== expected.keyFingerprint || !SHA256.test(fingerprint)) fail('trust fingerprint does not match package output')
  const publicKeyCaptured = readStableTextFile(path.join(trustSourceRoot, 'public-key.pem'), 'trust public key', { maxBytes: 64 * 1024, privateMode: false })
  const publicKey = createPublicKey(publicKeyCaptured.value)
  if (publicKey.asymmetricKeyType !== 'ed25519' || hashBytes(publicKey.export({ type: 'spki', format: 'der' })) !== fingerprint) fail('trust public key fingerprint mismatch')
  const receiptCaptured = readStableJsonFile(path.join(trustSourceRoot, 'receipt.json'), 'trust receipt', { privateMode: false })
  if (receiptCaptured.value.releaseId !== expected.releaseId || receiptCaptured.value.sourceRevision !== expected.sourceSha || receiptCaptured.value.keyFingerprintSha256 !== fingerprint) fail('trust receipt identity is invalid')
  const bootstrap = stableFileSnapshot(path.join(trustSourceRoot, 'onprem-offline-bootstrap-verify.mjs'), 'trust bootstrap', { privateMode: false })
  if (bootstrap.sha256 !== expected.bootstrapSha256) fail('trust bootstrap identity is invalid')
  const trustFiles = Object.freeze({ 'fingerprint.txt': fingerprintCaptured.snapshot, 'public-key.pem': publicKeyCaptured.snapshot, 'receipt.json': receiptCaptured.snapshot, 'onprem-offline-bootstrap-verify.mjs': bootstrap })
  return Object.freeze({ ...checksums, trustFiles, releaseId: current.releaseId, sourceSha: current.sourceRevision, keyFingerprint: fingerprint, bootstrapSha256: bootstrap.sha256 })
}
export function copyHandoff(source, destination, names, expectedFiles) {
  privateDirectory(destination, 'handoff destination')
  for (const name of names) {
    const expected = expectedFiles?.[name]
    if (!expected || !SHA256.test(expected.sha256 ?? '') || !Number.isSafeInteger(expected.bytes)) fail(`handoff ${name} validation snapshot is missing`)
    const copied = copyStableFile(path.join(source, name), path.join(destination, name), `handoff ${name}`, { sourceOptions: { privateMode: false }, destinationOptions: { privateMode: false } })
    if (copied.sha256 !== expected.sha256 || copied.bytes !== expected.bytes) fail(`handoff ${name} source changed after validation`)
  }
  if (fs.readdirSync(destination).sort().join(',') !== [...names].sort().join(',')) fail('handoff destination contains unsupported files')
}
