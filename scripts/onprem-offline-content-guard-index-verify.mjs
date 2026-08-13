import {
  closeSync,
  constants,
  fstatSync,
  lstatSync,
  openSync,
  readSync,
  readdirSync,
  readFileSync,
  realpathSync,
} from 'node:fs'
import { createHash, createPublicKey, verify as verifySignatureValue } from 'node:crypto'
import { isAbsolute, join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

import { inspectDockerSaveArchive } from './onprem-offline-archive.mjs'

export const CONTENT_GUARD_IMAGE_NAMES = Object.freeze(['backend', 'frontend', 'keycloak'])
export const CONTENT_GUARD_INDEX_SCHEMA_VERSION = 1
export const CONTENT_GUARD_INDEX_MAX_BYTES = 1024 * 1024
export const CONTENT_GUARD_RECEIPT_MAX_BYTES = 16 * 1024 * 1024

const SHA = /^[0-9a-f]{64}$/i
const DIGEST = /^sha256:[0-9a-f]{64}$/i
const B64URL = /^[A-Za-z0-9_-]+$/
const PATH_SEGMENT = /^[A-Za-z0-9._-]+$/

export class ContentGuardIndexVerifyError extends Error {}
function fail(message) { throw new ContentGuardIndexVerifyError(message) }
function object(value) { return value !== null && typeof value === 'object' && !Array.isArray(value) }
function exact(value, keys, label) {
  if (!object(value)) fail(`${label} object is required`)
  const actual = Object.keys(value)
  if (actual.some((key) => !keys.has(key)) || [...keys].some((key) => !actual.includes(key))) fail(`${label} has an invalid field set`)
}
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical)
  if (!value || typeof value !== 'object') return value
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]))
}
export function canonicalize(value) { return JSON.stringify(canonical(value)) }
function sha(value, label) { if (typeof value !== 'string' || !SHA.test(value)) fail(`${label} must be a SHA-256 hex digest`); return value.toLowerCase() }
function digest(value, label) { if (typeof value !== 'string' || !DIGEST.test(value)) fail(`${label} must be sha256:<64 hex>`); return value.toLowerCase() }
function fingerprint(key) { return createHash('sha256').update(key.export({ type: 'spki', format: 'der' })).digest('hex') }
function identity(stats) { return { dev: stats.dev, ino: stats.ino, mode: stats.mode, nlink: stats.nlink, size: stats.size, mtimeMs: stats.mtimeMs, ctimeMs: stats.ctimeMs } }
function sameIdentity(before, after) { return before.dev === after.dev && before.ino === after.ino && before.mode === after.mode && before.nlink === after.nlink && before.size === after.size && before.mtimeMs === after.mtimeMs && before.ctimeMs === after.ctimeMs }
function regular(pathname, label) {
  let stats
  try { stats = lstatSync(pathname) } catch { fail(`${label} is missing`) }
  if (!stats.isFile() || stats.isSymbolicLink() || stats.isBlockDevice() || stats.isCharacterDevice() || stats.isFIFO() || stats.isSocket()) fail(`${label} must be a regular file`)
  if (stats.nlink !== 1) fail(`${label} hardlinks are not allowed`)
  return stats
}
function safeRelativePath(value, label = 'path') {
  if (typeof value !== 'string' || !value || value.includes('\\') || value.includes('\0') || value.startsWith('/') || /^[A-Za-z]:/.test(value)) fail(`${label} must be a portable relative path`)
  const parts = value.split('/')
  if (parts.some((part) => !PATH_SEGMENT.test(part) || part === '.' || part === '..') || parts.length > 8 || Buffer.byteLength(value) > 240) fail(`${label} must be a portable relative path`)
  return value
}
function contained(base, candidate) {
  const rel = relative(base, candidate)
  return rel === '' || (rel !== '..' && !rel.startsWith(`..${sep}`) && !isAbsolute(rel))
}
function resolveContained(base, relativePath, label) {
  const normalized = safeRelativePath(relativePath, label); const absolute = join(base, ...normalized.split('/')); let resolved
  try { resolved = realpathSync(absolute) } catch { fail(`${label} cannot be resolved`) }
  if (!contained(base, resolved)) fail(`${label} escapes its allowed directory`)
  return { path: normalized, absolute: resolved }
}
function readStable(pathname, cap, label) {
  const before = regular(pathname, label); if (before.size > cap) fail(`${label} exceeds size limit`)
  const flags = process.platform === 'win32' ? 'r' : constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0); let fd
  try {
    fd = openSync(pathname, flags); const opened = fstatSync(fd); if (!sameIdentity(before, opened)) fail(`${label} changed before read`)
    const hash = createHash('sha256'); const content = Buffer.alloc(opened.size); let offset = 0
    while (offset < content.length) { const count = readSync(fd, content, offset, content.length - offset, null); if (count === 0) fail(`${label} changed during read`); hash.update(content.subarray(offset, offset + count)); offset += count }
    const closed = fstatSync(fd); if (!sameIdentity(opened, closed) || offset !== before.size) fail(`${label} changed during read`)
    return { bytes: content.length, sha256: hash.digest('hex'), identity: identity(closed), content: content.toString('utf8') }
  } catch (error) { if (error instanceof ContentGuardIndexVerifyError) throw error; fail(`${label} cannot be read safely`) }
  finally { if (fd !== undefined) try { closeSync(fd) } catch { /* preserve original failure */ } }
}
function parseReceipt(content, pathname, label) {
  let receipt
  try { receipt = JSON.parse(content) } catch { fail(`${label} must contain valid JSON`) }
  if (!object(receipt) || receipt.ok !== true) fail(`${label} must attest ok=true`)
  if (receipt.violations !== undefined && (!Array.isArray(receipt.violations) || receipt.violations.length !== 0)) fail(`${label} contains content guard violations`)
  if (receipt.image !== undefined && receipt.image !== pathname) fail(`${label} image binding is invalid`)
  return receipt
}
function publicKey(options) {
  if (typeof options.publicKeyPath !== 'string' || !options.publicKeyPath) fail('public key is required')
  let key
  try { key = createPublicKey(readFileSync(options.publicKeyPath)) } catch { fail('public key is invalid') }
  if (key.asymmetricKeyType !== 'ed25519') fail('content guard key must be Ed25519')
  const pinned = sha(options.trustedKeyFingerprintSha256, 'content guard trusted key fingerprint')
  if (fingerprint(key) !== pinned) fail('content guard trusted key fingerprint mismatch')
  return { key, fingerprint: pinned }
}
function expectedArchivePath(name, options = {}) { return options.archivePaths?.[name] ?? `${name}-image.tar` }
function expectedReceiptPath(name, options = {}) { return options.finalRootfsPaths?.[name] ?? `${name}-content-guard.json` }
function layerPattern(name) { return new RegExp(`^(?:proof/)?${name}-layer-(\\d+)-content-guard\\.json$`) }
function allowedArchivePath(name, value, options = {}) { const expected = expectedArchivePath(name, options); return value === expected || value === `proof/${expected}` }
function allowedReceiptPath(name, value, options = {}) { const expected = expectedReceiptPath(name, options); return value === expected || value === `proof/${expected}` }
function discoverLayerReceiptPaths(baseDir, name) {
  const names = []
  for (const [directory, prefix] of [[baseDir, ''], [join(baseDir, 'proof'), 'proof/']]) {
    try { names.push(...readdirSync(directory).filter((entry) => entry.startsWith(`${name}-layer-`) && entry.endsWith('-content-guard.json')).map((entry) => `${prefix}${entry}`)) } catch { /* no layers is a valid image shape */ }
  }
  const seen = new Set()
  for (const pathname of names) { if (!layerPattern(name).test(pathname) || seen.has(pathname)) fail(`content guard ${name} layer receipt path is invalid`); seen.add(pathname) }
  return names
}
function validateIndexShape(index) {
  exact(index, new Set(['schemaVersion', 'dataClass', 'artifacts', 'signature']), 'content guard index')
  if (index.schemaVersion !== CONTENT_GUARD_INDEX_SCHEMA_VERSION || index.dataClass !== 'synthetic') fail('content guard index schema is invalid')
  exact(index.artifacts, new Set(CONTENT_GUARD_IMAGE_NAMES), 'content guard artifacts')
  exact(index.signature, new Set(['algorithm', 'encoding', 'keyFingerprintSha256', 'value']), 'content guard signature')
  if (index.signature.algorithm !== 'Ed25519' || index.signature.encoding !== 'base64url' || !SHA.test(index.signature.keyFingerprintSha256) || typeof index.signature.value !== 'string' || !B64URL.test(index.signature.value)) fail('content guard signature envelope is invalid')
}
function validateArtifact(baseDir, name, artifact, options = {}) {
  exact(artifact, new Set(['imageId', 'archive', 'finalRootfs', 'layers', 'layerCount']), `content guard artifact ${name}`)
  const imageId = digest(artifact.imageId, `content guard artifact ${name} imageId`); const expected = options.expectedImages?.[name]
  if (expected && digest(expected.imageId, `expected content guard image ${name} imageId`) !== imageId) fail(`content guard artifact ${name} image ID mismatch`)
  exact(artifact.archive, new Set(['path', 'sha256']), `content guard artifact ${name} archive`)
  const archivePath = safeRelativePath(artifact.archive.path, `content guard artifact ${name} archive path`)
  if (!allowedArchivePath(name, archivePath, options)) fail(`content guard artifact ${name} archive path is not allowed`)
  const archiveRef = resolveContained(baseDir, archivePath, `content guard artifact ${name} archive`); const archive = inspectDockerSaveArchive(archiveRef.absolute, { imageId })
  if (archive.archiveSha256 !== sha(artifact.archive.sha256, `content guard artifact ${name} archive digest`)) fail(`content guard artifact ${name} archive digest mismatch`)
  exact(artifact.finalRootfs, new Set(['path', 'sha256', 'ok']), `content guard artifact ${name} final rootfs`)
  if (artifact.finalRootfs.ok !== true || !allowedReceiptPath(name, artifact.finalRootfs.path, options)) fail(`content guard artifact ${name} final rootfs receipt binding is invalid`)
  const finalRef = resolveContained(baseDir, artifact.finalRootfs.path, `content guard artifact ${name} final rootfs receipt`); const final = readStable(finalRef.absolute, CONTENT_GUARD_RECEIPT_MAX_BYTES, `content guard artifact ${name} final rootfs receipt`)
  if (final.sha256 !== sha(artifact.finalRootfs.sha256, `content guard artifact ${name} final rootfs digest`)) fail(`content guard artifact ${name} final rootfs digest mismatch`); parseReceipt(final.content, name, `content guard artifact ${name} final rootfs receipt`)
  if (!Array.isArray(artifact.layers) || !Number.isSafeInteger(artifact.layerCount) || artifact.layerCount < 0 || artifact.layers.length !== artifact.layerCount || artifact.layerCount !== archive.layerCount) fail(`content guard artifact ${name} layer count is invalid`)
  const discovered = discoverLayerReceiptPaths(baseDir, name); const indexedPaths = artifact.layers.map((layer) => layer.path)
  if (new Set(indexedPaths).size !== indexedPaths.length || discovered.length !== indexedPaths.length || discovered.some((pathname) => !indexedPaths.includes(pathname))) fail(`content guard artifact ${name} layer receipt set is incomplete`)
  for (const [expectedIndex, layer] of artifact.layers.entries()) {
    exact(layer, new Set(['index', 'manifestLayerPath', 'path', 'sha256', 'ok']), `content guard artifact ${name} layer`)
    if (layer.index !== expectedIndex || layer.manifestLayerPath !== archive.layers[expectedIndex] || layer.ok !== true || !layerPattern(name).test(layer.path)) fail(`content guard artifact ${name} layer receipts are not complete and ordered`)
    const layerRef = resolveContained(baseDir, layer.path, `content guard artifact ${name} layer receipt`); const value = readStable(layerRef.absolute, CONTENT_GUARD_RECEIPT_MAX_BYTES, `content guard artifact ${name} layer receipt`)
    if (value.sha256 !== sha(layer.sha256, `content guard artifact ${name} layer digest`)) fail(`content guard artifact ${name} layer digest mismatch`); parseReceipt(value.content, name, `content guard artifact ${name} layer receipt ${expectedIndex}`)
  }
  return { imageId, archiveSha256: archive.archiveSha256, finalRootfsSha256: final.sha256, layers: archive.layers, layerCount: artifact.layerCount }
}
export function verifyContentGuardIndex(index, options = {}) {
  validateIndexShape(index); const trusted = publicKey(options)
  if (index.signature.keyFingerprintSha256.toLowerCase() !== trusted.fingerprint || !verifySignatureValue(null, Buffer.from(canonicalize({ schemaVersion: index.schemaVersion, dataClass: index.dataClass, artifacts: index.artifacts })), trusted.key, Buffer.from(index.signature.value, 'base64url'))) fail('content guard index signature mismatch')
  let baseDir
  try { baseDir = realpathSync(options.baseDir ?? process.cwd()) } catch { fail('content guard base directory cannot be resolved') }
  return Object.fromEntries(CONTENT_GUARD_IMAGE_NAMES.map((name) => [name, validateArtifact(baseDir, name, index.artifacts[name], options)]))
}

function cli(argv) {
  if (argv.shift() !== 'verify') fail('mode must be verify')
  const options = {}
  while (argv.length) {
    const flag = argv.shift(); if (!argv.length) fail('unknown or incomplete CLI argument')
    if (flag === '--base-dir') options.baseDir = argv.shift()
    else if (flag === '--input') options.inputPath = argv.shift()
    else if (flag === '--public-key') options.publicKeyPath = argv.shift()
    else if (flag === '--trusted-fingerprint') options.trustedKeyFingerprintSha256 = argv.shift()
    else fail(`unknown argument: ${flag}`)
  }
  if (!options.baseDir || !options.publicKeyPath || !options.inputPath || typeof options.trustedKeyFingerprintSha256 !== 'string' || !SHA.test(options.trustedKeyFingerprintSha256)) fail('verify requires base directory, input, public key, and trusted fingerprint')
  verifyContentGuardIndex(JSON.parse(readFileSync(options.inputPath, 'utf8')), options)
  console.log('content guard index: verified')
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try { cli(process.argv.slice(2)) } catch (error) { console.error(`content guard index: ${error instanceof ContentGuardIndexVerifyError ? error.message : 'verification failed'}`); process.exitCode = 1 }
}
