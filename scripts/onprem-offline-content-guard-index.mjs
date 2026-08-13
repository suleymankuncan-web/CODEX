import {
  closeSync,
  copyFileSync,
  constants,
  fstatSync,
  lstatSync,
  mkdirSync,
  openSync,
  readSync,
  readFileSync,
  readdirSync,
  realpathSync,
  writeFileSync,
} from 'node:fs'
import { createHash, createPrivateKey, createPublicKey, sign, verify } from 'node:crypto'
import { dirname, isAbsolute, join, relative, sep } from 'node:path'
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

export class ContentGuardIndexError extends Error {}
function fail(message) { throw new ContentGuardIndexError(message) }
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

function identity(stats) {
  return {
    dev: stats.dev,
    ino: stats.ino,
    mode: stats.mode,
    nlink: stats.nlink,
    size: stats.size,
    mtimeMs: stats.mtimeMs,
    ctimeMs: stats.ctimeMs,
  }
}
function sameIdentity(before, after) {
  return before.dev === after.dev && before.ino === after.ino && before.mode === after.mode && before.nlink === after.nlink && before.size === after.size && before.mtimeMs === after.mtimeMs && before.ctimeMs === after.ctimeMs
}
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
  const normalized = safeRelativePath(relativePath, label)
  const absolute = join(base, ...normalized.split('/'))
  let resolved
  try { resolved = realpathSync(absolute) } catch { fail(`${label} cannot be resolved`) }
  if (!contained(base, resolved)) fail(`${label} escapes its allowed directory`)
  return { path: normalized, absolute: resolved }
}
function readStable(pathname, cap, label) {
  const before = regular(pathname, label)
  if (before.size > cap) fail(`${label} exceeds size limit`)
  const flags = process.platform === 'win32' ? 'r' : constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0)
  let fd
  try {
    fd = openSync(pathname, flags)
    const opened = fstatSync(fd)
    if (!sameIdentity(before, opened)) fail(`${label} changed before read`)
    const hash = createHash('sha256')
    const content = Buffer.alloc(opened.size)
    let offset = 0
    while (offset < content.length) {
      const count = readSync(fd, content, offset, content.length - offset, null)
      if (count === 0) fail(`${label} changed during read`)
      hash.update(content.subarray(offset, offset + count))
      offset += count
    }
    const closed = fstatSync(fd)
    if (!sameIdentity(opened, closed) || offset !== before.size) fail(`${label} changed during read`)
    return { bytes: content.length, sha256: hash.digest('hex'), identity: identity(closed), content: content.toString('utf8') }
  } catch (error) {
    if (error instanceof ContentGuardIndexError) throw error
    fail(`${label} cannot be read safely`)
  } finally {
    if (fd !== undefined) try { closeSync(fd) } catch { /* preserve original failure */ }
  }
}
function parseReceipt(content, pathname, label) {
  let receipt
  try { receipt = JSON.parse(content) } catch { fail(`${label} must contain valid JSON`) }
  if (!object(receipt) || receipt.ok !== true) fail(`${label} must attest ok=true`)
  if (receipt.violations !== undefined && (!Array.isArray(receipt.violations) || receipt.violations.length !== 0)) fail(`${label} contains content guard violations`)
  if (receipt.image !== undefined && receipt.image !== pathname) fail(`${label} image binding is invalid`)
  return receipt
}
function keyFrom(value, kind) {
  try { return kind === 'private' ? createPrivateKey(value) : createPublicKey(value) } catch { fail(`${kind} key is invalid`) }
}
function loadKey(options, kind) {
  const value = options[`${kind}Key`]
  const pathValue = options[`${kind}KeyPath`]
  if (!value && !pathValue) fail(`${kind} key is required`)
  if (pathValue) {
    try { return keyFrom(requireRead(pathValue), kind) } catch (error) {
      if (error instanceof ContentGuardIndexError) throw error
      fail(`${kind} key is invalid`)
    }
  }
  return keyFrom(value, kind)
}
function requireRead(pathname) {
  try {
    const stats = regular(pathname, 'content guard key')
    if (stats.size > 64 * 1024) fail('content guard key exceeds size limit')
    return readFileSync(pathname)
  } catch (error) {
    if (error instanceof ContentGuardIndexError) throw error
    fail('content guard key cannot be read')
  }
}
function trustedPublicKey(options) {
  const publicKey = loadKey(options, 'public')
  if (publicKey.asymmetricKeyType !== 'ed25519') fail('content guard key must be Ed25519')
  const pinned = sha(options.trustedKeyFingerprintSha256, 'content guard trusted key fingerprint')
  if (fingerprint(publicKey) !== pinned) fail('content guard trusted key fingerprint mismatch')
  return { key: publicKey, fingerprint: pinned }
}
function expectedArchivePath(name, options = {}) { return options.archivePaths?.[name] ?? `${name}-image.tar` }
function expectedReceiptPath(name, options = {}) { return options.finalRootfsPaths?.[name] ?? `${name}-content-guard.json` }
function layerPattern(name) { return new RegExp(`^(?:proof/)?${name}-layer-(\\d+)-content-guard\\.json$`) }
function allowedArchivePath(name, value, options = {}) {
  const expected = expectedArchivePath(name, options)
  return value === expected || value === `proof/${expected}`
}
function allowedReceiptPath(name, value, options = {}) {
  const expected = expectedReceiptPath(name, options)
  return value === expected || value === `proof/${expected}`
}
function discoverLayerReceiptPaths(baseDir, name) {
  const names = []
  for (const [directory, prefix] of [[baseDir, ''], [join(baseDir, 'proof'), 'proof/']]) {
    try {
      names.push(...readdirSync(directory).filter((entry) => entry.startsWith(`${name}-layer-`) && entry.endsWith('-content-guard.json')).map((entry) => `${prefix}${entry}`))
    } catch { /* no layers is a valid image shape */ }
  }
  const seen = new Set()
  for (const pathValue of names) {
    if (!layerPattern(name).test(pathValue) || seen.has(pathValue)) fail(`content guard ${name} layer receipt path is invalid`)
    seen.add(pathValue)
  }
  return names
}

export function copyContentGuardLayerReceipts(sourceRoot, outputDirectory) {
  let source
  let output
  try {
    source = realpathSync(sourceRoot)
    output = realpathSync(outputDirectory)
  } catch { fail('content guard layer receipt copy roots cannot be resolved') }
  const receipts = new Map()
  const receiptPattern = /^(?:backend|frontend|keycloak)-layer-(?:0|[1-9]\d*)-content-guard\.json$/
  const visit = (directory) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const pathname = join(directory, entry.name)
      if (entry.isSymbolicLink()) fail('content guard proof download contains a symbolic link')
      if (entry.isDirectory()) {
        visit(pathname)
        continue
      }
      if (!entry.isFile() || !receiptPattern.test(entry.name)) continue
      if (receipts.has(entry.name)) fail(`content guard proof download contains duplicate ${entry.name}`)
      receipts.set(entry.name, pathname)
    }
  }
  visit(source)
  const names = [...receipts.keys()].sort()
  for (const name of names) {
    try { copyFileSync(receipts.get(name), join(output, name), constants.COPYFILE_EXCL) }
    catch { fail(`content guard layer receipt ${name} could not be copied exclusively`) }
  }
  return names
}
function normalizeImageInput(images) {
  exact(images, new Set(CONTENT_GUARD_IMAGE_NAMES), 'content guard images')
  const normalized = {}
  for (const name of CONTENT_GUARD_IMAGE_NAMES) {
    const image = images[name]
    if (!object(image)) fail(`content guard image ${name} object is required`)
    if (Object.keys(image).some((key) => !new Set(['imageId', 'archivePath', 'finalRootfsPath']).has(key))) fail(`content guard image ${name} has an invalid field set`)
    normalized[name] = {
      imageId: digest(image.imageId, `content guard image ${name} imageId`),
      archivePath: image.archivePath,
      finalRootfsPath: image.finalRootfsPath,
    }
  }
  return normalized
}
function collectArtifact(baseDir, name, image, options = {}) {
  const archiveRef = resolveContained(baseDir, image.archivePath ?? expectedArchivePath(name, options), `content guard ${name} archive`)
  const archive = inspectDockerSaveArchive(archiveRef.absolute, { imageId: image.imageId })
  const finalPath = image.finalRootfsPath ?? expectedReceiptPath(name, options)
  const finalRef = resolveContained(baseDir, finalPath, `content guard ${name} final rootfs receipt`)
  const final = readStable(finalRef.absolute, CONTENT_GUARD_RECEIPT_MAX_BYTES, `content guard ${name} final rootfs receipt`)
  parseReceipt(final.content, name, `content guard ${name} final rootfs receipt`)

  const layers = []
  const names = discoverLayerReceiptPaths(baseDir, name)
  const indexed = names.map((pathValue) => ({ pathValue, index: Number(layerPattern(name).exec(pathValue)[1]) })).sort((a, b) => a.index - b.index)
  indexed.forEach((entry, expected) => { if (entry.index !== expected) fail(`content guard ${name} layer receipts must be complete and ordered`) })
  if (indexed.length !== archive.layerCount) fail(`content guard ${name} layer receipt count does not match image archive manifest`)
  for (const { pathValue, index } of indexed) {
    const layerRef = resolveContained(baseDir, pathValue, `content guard ${name} layer receipt`)
    const layer = readStable(layerRef.absolute, CONTENT_GUARD_RECEIPT_MAX_BYTES, `content guard ${name} layer receipt`)
    parseReceipt(layer.content, name, `content guard ${name} layer receipt ${index}`)
    const manifestLayerPath = archive.layers[index]
    if (!manifestLayerPath) fail(`content guard ${name} layer receipt is missing manifest layer binding`)
    layers.push({ index, manifestLayerPath, path: pathValue, sha256: layer.sha256, ok: true })
  }
  return {
    imageId: image.imageId,
    archive: { path: archiveRef.path, sha256: archive.archiveSha256 },
    finalRootfs: { path: finalRef.path, sha256: final.sha256, ok: true },
    layers,
    layerCount: layers.length,
  }
}
function unsignedIndex(artifacts) { return { schemaVersion: CONTENT_GUARD_INDEX_SCHEMA_VERSION, dataClass: 'synthetic', artifacts } }

export function createContentGuardIndex(input, options = {}) {
  if (!object(input)) fail('content guard index input is required')
  const baseDir = realpathSync(input.baseDir ?? options.baseDir ?? process.cwd())
  const images = normalizeImageInput(input.images ?? options.images)
  const artifacts = Object.fromEntries(CONTENT_GUARD_IMAGE_NAMES.map((name) => [name, collectArtifact(baseDir, name, images[name], options)]))
  const privateKey = loadKey({ ...options, privateKey: options.privateKey ?? input.privateKey, privateKeyPath: options.privateKeyPath ?? input.privateKeyPath }, 'private')
  if (privateKey.asymmetricKeyType !== 'ed25519') fail('content guard signing key must be Ed25519')
  const publicKey = createPublicKey(privateKey)
  const unsigned = unsignedIndex(artifacts)
  const index = {
    ...unsigned,
    signature: {
      algorithm: 'Ed25519', encoding: 'base64url', keyFingerprintSha256: fingerprint(publicKey),
      value: sign(null, Buffer.from(canonicalize(unsigned)), privateKey).toString('base64url'),
    },
  }
  if (input.outputPath ?? options.outputPath) {
    const outputPath = input.outputPath ?? options.outputPath
    mkdirSync(dirname(outputPath), { recursive: true })
    writeFileSync(outputPath, `${JSON.stringify(index, null, 2)}\n`, { mode: 0o644 })
  }
  return index
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
  const imageId = digest(artifact.imageId, `content guard artifact ${name} imageId`)
  const expected = options.expectedImages?.[name]
  if (expected && digest(expected.imageId, `expected content guard image ${name} imageId`) !== imageId) fail(`content guard artifact ${name} image ID mismatch`)
  exact(artifact.archive, new Set(['path', 'sha256']), `content guard artifact ${name} archive`)
  const archivePath = safeRelativePath(artifact.archive.path, `content guard artifact ${name} archive path`)
  if (!allowedArchivePath(name, archivePath, options)) fail(`content guard artifact ${name} archive path is not allowed`)
  const archiveRef = resolveContained(baseDir, archivePath, `content guard artifact ${name} archive`)
  const archive = inspectDockerSaveArchive(archiveRef.absolute, { imageId })
  if (archive.archiveSha256 !== sha(artifact.archive.sha256, `content guard artifact ${name} archive digest`)) fail(`content guard artifact ${name} archive digest mismatch`)

  exact(artifact.finalRootfs, new Set(['path', 'sha256', 'ok']), `content guard artifact ${name} final rootfs`)
  if (artifact.finalRootfs.ok !== true || !allowedReceiptPath(name, artifact.finalRootfs.path, options)) fail(`content guard artifact ${name} final rootfs receipt binding is invalid`)
  const finalRef = resolveContained(baseDir, artifact.finalRootfs.path, `content guard artifact ${name} final rootfs receipt`)
  const final = readStable(finalRef.absolute, CONTENT_GUARD_RECEIPT_MAX_BYTES, `content guard artifact ${name} final rootfs receipt`)
  if (final.sha256 !== sha(artifact.finalRootfs.sha256, `content guard artifact ${name} final rootfs digest`)) fail(`content guard artifact ${name} final rootfs digest mismatch`)
  parseReceipt(final.content, name, `content guard artifact ${name} final rootfs receipt`)

  if (!Array.isArray(artifact.layers) || !Number.isSafeInteger(artifact.layerCount) || artifact.layerCount < 0 || artifact.layers.length !== artifact.layerCount || artifact.layerCount !== archive.layerCount) fail(`content guard artifact ${name} layer count is invalid`)
  const discovered = discoverLayerReceiptPaths(baseDir, name)
  const indexedPaths = artifact.layers.map((layer) => layer.path)
  if (new Set(indexedPaths).size !== indexedPaths.length || discovered.length !== indexedPaths.length || discovered.some((pathValue) => !indexedPaths.includes(pathValue))) fail(`content guard artifact ${name} layer receipt set is incomplete`)
  for (const [expectedIndex, layer] of artifact.layers.entries()) {
    exact(layer, new Set(['index', 'manifestLayerPath', 'path', 'sha256', 'ok']), `content guard artifact ${name} layer`)
    if (layer.index !== expectedIndex || layer.manifestLayerPath !== archive.layers[expectedIndex] || layer.ok !== true || !layerPattern(name).test(layer.path)) fail(`content guard artifact ${name} layer receipts are not complete and ordered`)
    const layerRef = resolveContained(baseDir, layer.path, `content guard artifact ${name} layer receipt`)
    const value = readStable(layerRef.absolute, CONTENT_GUARD_RECEIPT_MAX_BYTES, `content guard artifact ${name} layer receipt`)
    if (value.sha256 !== sha(layer.sha256, `content guard artifact ${name} layer digest`)) fail(`content guard artifact ${name} layer digest mismatch`)
    parseReceipt(value.content, name, `content guard artifact ${name} layer receipt ${expectedIndex}`)
  }
  return { imageId, archiveSha256: archive.archiveSha256, finalRootfsSha256: final.sha256, layers: archive.layers, layerCount: artifact.layerCount }
}

export function verifyContentGuardIndex(index, options = {}) {
  validateIndexShape(index)
  const trusted = trustedPublicKey(options)
  if (index.signature.keyFingerprintSha256.toLowerCase() !== trusted.fingerprint || !verify(null, Buffer.from(canonicalize({ schemaVersion: index.schemaVersion, dataClass: index.dataClass, artifacts: index.artifacts })), trusted.key, Buffer.from(index.signature.value, 'base64url'))) fail('content guard index signature mismatch')
  const baseDir = realpathSync(options.baseDir ?? process.cwd())
  return Object.fromEntries(CONTENT_GUARD_IMAGE_NAMES.map((name) => [name, validateArtifact(baseDir, name, index.artifacts[name], options)]))
}

function parseArgs(argv) {
  const mode = argv.shift()
  if (!['generate', 'verify'].includes(mode)) fail('mode must be generate or verify')
  const options = { mode }
  while (argv.length) {
    const flag = argv.shift()
    if (flag === '--base-dir') options.baseDir = argv.shift()
    else if (flag === '--input') options.inputPath = argv.shift()
    else if (flag === '--output') options.outputPath = argv.shift()
    else if (flag === '--private-key') options.privateKeyPath = argv.shift()
    else if (flag === '--public-key') options.publicKeyPath = argv.shift()
    else if (flag === '--trusted-fingerprint') options.trustedKeyFingerprintSha256 = argv.shift()
    else if (flag === '--images') options.imagesPath = argv.shift()
    else fail(`unknown argument: ${flag}`)
  }
  if (!options.baseDir || !options.privateKeyPath && mode === 'generate' || !options.publicKeyPath && mode === 'verify' || !options.trustedKeyFingerprintSha256 || !options.inputPath && mode === 'verify' || !options.outputPath && mode === 'generate' || !options.imagesPath && mode === 'generate') fail(`${mode} requires base directory, key, images, and input/output arguments`)
  return options
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    const options = parseArgs(process.argv.slice(2))
    if (options.mode === 'generate') {
      const images = JSON.parse(readFileSync(options.imagesPath, 'utf8'))
      const index = createContentGuardIndex({ baseDir: options.baseDir, images }, options)
      writeFileSync(options.outputPath, `${JSON.stringify(index, null, 2)}\n`)
      console.log('content guard index: generated')
    } else {
      const index = JSON.parse(readFileSync(options.inputPath, 'utf8'))
      verifyContentGuardIndex(index, options)
      console.log('content guard index: verified')
    }
  } catch (error) {
    console.error(`content guard index: ${error instanceof ContentGuardIndexError ? error.message : 'operation failed'}`)
    process.exitCode = 1
  }
}
