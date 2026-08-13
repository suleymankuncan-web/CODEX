import {
  closeSync,
  constants,
  fstatSync,
  lstatSync,
  openSync,
  readSync,
  readdirSync,
  realpathSync,
} from 'node:fs'
import { createHash, createPublicKey, verify as verifySignature } from 'node:crypto'
import { isAbsolute, join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

// This verifier is deliberately standalone. It is copied to the install host
// before any bundle-provided code is trusted, so it must not import a local
// producer or consume a private signing key.
const SHA = /^[a-f0-9]{64}$/
const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/
const SOURCE_REVISION = /^[a-f0-9]{40}$/i
const UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/
const B64URL = /^[A-Za-z0-9_-]+$/
const SEGMENT = /^[A-Za-z0-9._-]+$/
const TOP = new Set(['images', 'deployment', 'operations', 'evidence', 'docs'])
const GENERATED = new Set(['bundle-manifest.json', 'bundle-signature.json'])
const MAX_FILES = 256
const MAX_ENTRIES = 512
const MAX_DEPTH = 8
const MAX_PATH_BYTES = 240
const MAX_TEXT_BYTES = 1024 * 1024
const MAX_TOTAL_BYTES = 100 * 1024 * 1024 * 1024

class BootstrapError extends Error {}

function fail(message) {
  throw new BootstrapError(message)
}

function object(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function exact(value, keys, label) {
  if (!object(value)) fail(`${label} object is required`)
  const actual = Object.keys(value)
  if (actual.length !== keys.size || actual.some((key) => !keys.has(key))) fail(`${label} field set is invalid`)
}

// The producer signs this exact recursive, UTF-16 code-unit key ordering.
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical)
  if (!object(value)) return value
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]))
}

function safePath(value, { generated = false, directory = false } = {}) {
  if (typeof value !== 'string' || value.length < 1 || value.includes('\\') || value.includes('\0')) fail('manifest path is invalid')
  if (value.startsWith('/') || /^[A-Za-z]:/.test(value)) fail('manifest path is invalid')
  if (Buffer.byteLength(value, 'utf8') > MAX_PATH_BYTES) fail('manifest path is invalid')
  const parts = value.split('/')
  if (
    (!directory && parts.length < 2)
    || parts.length > MAX_DEPTH
    || parts.some((part) => !SEGMENT.test(part) || part === '.' || part === '..')
    || !TOP.has(parts[0])
    || (!generated && GENERATED.has(parts.at(-1)))
  ) fail('manifest path is invalid')
  return value
}

function identity(stats) {
  return [stats.dev, stats.ino, stats.mode, stats.nlink, stats.size, stats.mtimeMs, stats.ctimeMs].join(':')
}

function regular(pathname, label, directory = false) {
  let stats
  try {
    stats = lstatSync(pathname)
  } catch {
    fail(`${label} is missing`)
  }
  if (stats.isSymbolicLink() || stats.isBlockDevice() || stats.isCharacterDevice() || stats.isFIFO() || stats.isSocket()) fail(`${label} is a link or special file`)
  if (directory ? !stats.isDirectory() : !stats.isFile()) fail(`${label} type is invalid`)
  if (!directory && stats.nlink !== 1) fail(`${label} must not be hard linked`)
  return stats
}

function trustedAncestors(pathname, label, includeLeaf = true) {
  if (process.platform === 'win32') return
  let current = includeLeaf ? pathname : join(pathname, '..')
  while (true) {
    const stats = regular(current, label, true)
    if (stats.uid !== 0 || (stats.mode & 0o022) !== 0) fail(`${label} ancestor is not root-owned and private`)
    const parent = join(current, '..')
    if (parent === current) break
    current = parent
  }
}

function safeMode(stats, expected, label) {
  if (process.platform !== 'win32' && (stats.mode & 0o777) !== expected) fail(`${label} mode is invalid`)
}

function readStable(pathname, cap, label, { text = false } = {}) {
  const before = regular(pathname, label)
  if (before.size > cap) fail(`${label} exceeds its size limit`)
  const flags = process.platform === 'win32' ? 'r' : constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0)
  let fd
  try {
    fd = openSync(pathname, flags)
    const opened = fstatSync(fd)
    if (!opened.isFile() || opened.nlink !== 1 || identity(before) !== identity(opened)) fail(`${label} changed before read`)
    const hash = createHash('sha256')
    const chunks = text ? [] : null
    const buffer = Buffer.alloc(Math.min(64 * 1024, Math.max(1, opened.size)))
    let bytes = 0
    while (bytes < opened.size) {
      const count = readSync(fd, buffer, 0, Math.min(buffer.length, opened.size - bytes), null)
      if (!count) fail(`${label} changed during read`)
      const chunk = buffer.subarray(0, count)
      hash.update(chunk)
      if (chunks) chunks.push(Buffer.from(chunk))
      bytes += count
    }
    const closed = fstatSync(fd)
    let after
    try {
      after = lstatSync(pathname)
    } catch {
      fail(`${label} changed during read`)
    }
    if (
      !after.isFile()
      || after.nlink !== 1
      || identity(opened) !== identity(closed)
      || identity(opened) !== identity(after)
      || bytes !== opened.size
    ) fail(`${label} changed during read`)
    return {
      bytes,
      sha256: hash.digest('hex'),
      mode: opened.mode & 0o777,
      text: chunks ? Buffer.concat(chunks).toString('utf8') : undefined,
    }
  } catch (error) {
    if (error instanceof BootstrapError) throw error
    fail(`${label} cannot be read safely`)
  } finally {
    if (fd !== undefined) {
      try { closeSync(fd) } catch { /* preserve the original failure */ }
    }
  }
}

function parseJson(pathname, label) {
  try {
    return JSON.parse(readStable(pathname, MAX_TEXT_BYTES, label, { text: true }).text)
  } catch (error) {
    if (error instanceof BootstrapError) throw error
    fail(`${label} is invalid JSON`)
  }
}

function contained(parent, child) {
  const rel = relative(parent, child)
  return rel === '' || (!rel.startsWith(`..${sep}`) && rel !== '..' && !isAbsolute(rel))
}

function trustedKey(pathname, bundleRoot, fingerprint) {
  if (!isAbsolute(pathname) || !SHA.test(fingerprint)) fail('external trust inputs are invalid')
  // The trust anchor is an operator input, not a bundle-controlled symlink.
  regular(pathname, 'external public key')
  let resolved
  try {
    resolved = realpathSync(pathname)
  } catch {
    fail('external public key is invalid')
  }
  if (process.platform !== 'win32' && resolved !== pathname) fail('external public key path is not canonical')
  if (contained(bundleRoot, resolved)) fail('external public key must be outside the bundle')
  trustedAncestors(resolved, 'external public key', false)
  let keyText
  try {
    keyText = readStable(resolved, MAX_TEXT_BYTES, 'external public key', { text: true }).text
    if (!/-----BEGIN PUBLIC KEY-----/.test(keyText) || /-----BEGIN [A-Z ]*PRIVATE KEY-----/.test(keyText)) fail('external public key is invalid')
  } catch (error) {
    if (error instanceof BootstrapError) throw error
    fail('external public key is invalid')
  }
  let key
  try {
    key = createPublicKey(keyText)
  } catch {
    fail('external public key is invalid')
  }
  if (key.asymmetricKeyType !== 'ed25519') fail('external public key must be Ed25519')
  const actual = createHash('sha256').update(key.export({ type: 'spki', format: 'der' })).digest('hex')
  if (actual !== fingerprint) fail('external public key fingerprint mismatch')
  return key
}

function validateManifest(value, releaseId) {
  exact(value, new Set(['schemaVersion', 'configSchemaVersion', 'dataClass', 'releaseId', 'sourceRevision', 'createdAt', 'archiveConfigImageIdDerived', 'files', 'images']), 'bundle manifest')
  if (
    value.schemaVersion !== 1
    || value.configSchemaVersion !== 1
    || value.dataClass !== 'synthetic'
    || value.releaseId !== releaseId
    || !SAFE_ID.test(value.releaseId)
    || typeof value.sourceRevision !== 'string'
    || !SOURCE_REVISION.test(value.sourceRevision)
    || typeof value.createdAt !== 'string'
    || !UTC.test(value.createdAt)
    || new Date(value.createdAt).toISOString() !== value.createdAt
    || value.archiveConfigImageIdDerived !== true
    || !Array.isArray(value.files)
    || value.files.length < 1
    || value.files.length > MAX_FILES
    || !object(value.images)
  ) fail('bundle manifest identity mismatch')
  const files = new Map()
  const folded = new Set()
  let previous = ''
  let total = 0
  for (const item of value.files) {
    exact(item, new Set(['path', 'bytes', 'sha256', 'mode']), 'bundle manifest file')
    const pathname = safePath(item.path)
    if (pathname <= previous || folded.has(pathname.toLowerCase())) fail('bundle manifest paths are not uniquely sorted')
    previous = pathname
    folded.add(pathname.toLowerCase())
    if (!Number.isSafeInteger(item.bytes) || item.bytes < 0 || item.bytes > MAX_TOTAL_BYTES || !SHA.test(item.sha256) || ![0o644, 0o755].includes(item.mode)) fail('bundle manifest file identity is invalid')
    total += item.bytes
    if (total > MAX_TOTAL_BYTES) fail('bundle manifest exceeds total size limit')
    files.set(pathname, item)
  }
  return files
}

function inventory(root) {
  regular(root, 'bundle root', true)
  trustedAncestors(root, 'bundle root')
  const files = new Map()
  const directories = new Set([''])
  const folded = new Set()
  const stack = [[root, '']]
  let entries = 0
  let total = 0
  while (stack.length) {
    const [directory, prefix] = stack.pop()
    let children
    try {
      children = readdirSync(directory, { withFileTypes: true })
    } catch {
      fail('bundle directory cannot be inventoried')
    }
    for (const child of children) {
      if (++entries > MAX_ENTRIES) fail('bundle has too many entries')
      const rel = prefix ? `${prefix}/${child.name}` : child.name
      const generated = !prefix && GENERATED.has(child.name)
      const directoryEntry = child.isDirectory()
      if (!generated) safePath(rel, { directory: directoryEntry })
      const foldedPath = rel.toLowerCase()
      if (folded.has(foldedPath)) fail('bundle paths are not unique')
      folded.add(foldedPath)
      const absolute = join(directory, child.name)
      if (directoryEntry) {
        regular(absolute, 'bundle directory', true)
        directories.add(rel)
        stack.push([absolute, rel])
        continue
      }
      const stats = regular(absolute, 'bundle file')
      if (generated) safeMode(stats, 0o644, 'generated bundle file')
      total += stats.size
      if (total > MAX_TOTAL_BYTES) fail('bundle exceeds total size limit')
      files.set(rel, { absolute, stats })
    }
  }
  return { files, directories }
}

function verifyClosure(manifestFiles, observed) {
  const expectedPaths = new Set([...manifestFiles.keys(), ...GENERATED])
  if (observed.files.size !== expectedPaths.size || [...observed.files.keys()].some((pathname) => !expectedPaths.has(pathname))) fail('bundle closure is incomplete or contains extras')
  const expectedDirectories = new Set([''])
  for (const pathname of manifestFiles.keys()) {
    const parts = pathname.split('/')
    for (let index = 1; index < parts.length; index += 1) expectedDirectories.add(parts.slice(0, index).join('/'))
  }
  if ([...observed.directories].some((pathname) => !expectedDirectories.has(pathname))) fail('bundle closure contains an unmanifested directory')
  for (const [pathname, item] of manifestFiles) {
    const file = observed.files.get(pathname)
    if (!file) fail('bundle is missing a signed file')
    const actual = readStable(file.absolute, MAX_TOTAL_BYTES, 'signed bundle file', { text: false })
    if (actual.bytes !== item.bytes || actual.sha256 !== item.sha256 || (process.platform !== 'win32' && actual.mode !== item.mode)) fail('signed bundle file identity mismatch')
  }
}

export function verifyBootstrap(options) {
  if (
    !options
    || typeof options.bundleDir !== 'string'
    || typeof options.releaseId !== 'string'
    || typeof options.publicKey !== 'string'
    || typeof options.trustedFingerprint !== 'string'
    || !isAbsolute(options.bundleDir)
    || !SAFE_ID.test(options.releaseId)
    || !isAbsolute(options.publicKey)
    || !SHA.test(options.trustedFingerprint)
  ) fail('bundle, release, and trust identity are required')
  regular(options.bundleDir, 'bundle root', true)
  let root
  try {
    root = realpathSync(options.bundleDir)
  } catch {
    fail('bundle root is invalid')
  }
  if (process.platform !== 'win32' && root !== options.bundleDir) fail('bundle root path is not canonical')
  regular(root, 'bundle root', true)
  const manifest = parseJson(join(root, 'bundle-manifest.json'), 'bundle manifest')
  const signature = parseJson(join(root, 'bundle-signature.json'), 'bundle signature')
  exact(signature, new Set(['algorithm', 'encoding', 'keyFingerprintSha256', 'value']), 'bundle signature')
  if (
    signature.algorithm !== 'Ed25519'
    || signature.encoding !== 'base64url'
    || signature.keyFingerprintSha256 !== options.trustedFingerprint
    || !B64URL.test(signature.value ?? '')
  ) fail('bundle signature envelope is invalid')
  const key = trustedKey(options.publicKey, root, options.trustedFingerprint)
  const canonicalManifest = Buffer.from(JSON.stringify(canonical(manifest)))
  if (!verifySignature(null, canonicalManifest, key, Buffer.from(signature.value, 'base64url'))) fail('bundle signature mismatch')
  const expected = validateManifest(manifest, options.releaseId)
  const observed = inventory(root)
  verifyClosure(expected, observed)
  return true
}

function cli(argv) {
  if (argv.shift() !== 'verify') fail('mode must be verify')
  const options = {}
  const seen = new Set()
  const flags = new Map([
    ['--bundle-dir', 'bundleDir'],
    ['--release-id', 'releaseId'],
    ['--public-key', 'publicKey'],
    ['--trusted-fingerprint', 'trustedFingerprint'],
  ])
  while (argv.length) {
    const flag = argv.shift()
    const key = flags.get(flag)
    if (!key || seen.has(flag) || argv.length === 0 || argv[0].startsWith('--')) fail('unknown, duplicate, or incomplete CLI argument')
    seen.add(flag)
    options[key] = argv.shift()
  }
  verifyBootstrap(options)
  console.log('offline bootstrap: verified')
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    cli(process.argv.slice(2))
  } catch (error) {
    console.error(`offline bootstrap: ${error instanceof BootstrapError ? error.message : 'verification failed'}`)
    process.exitCode = 1
  }
}
