import { closeSync, constants, fstatSync, lstatSync, openSync, readSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { basename } from 'node:path'

export const MAX_IMAGE_ARCHIVE_BYTES = 20 * 1024 * 1024 * 1024
export const MAX_ARCHIVE_ENTRIES = 4096
export const MAX_ARCHIVE_PATH_BYTES = 240
export const MAX_ARCHIVE_DEPTH = 8
export const MAX_ARCHIVE_JSON_BYTES = 16 * 1024 * 1024

const HEX64 = /^[0-9a-f]{64}$/i
const SAFE_TAG = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/
const SAFE_REPOSITORY = /^[A-Za-z0-9][A-Za-z0-9._/-]{0,200}$/

function fail(message) {
  throw new Error(message)
}

function readAt(fd, offset, length, hash) {
  const output = Buffer.alloc(length)
  let cursor = 0
  while (cursor < length) {
    const count = readSync(fd, output, cursor, length - cursor, offset + cursor)
    if (count === 0) fail('image archive is truncated')
    cursor += count
  }
  hash?.update(output)
  return output
}

function readDiscard(fd, offset, length, hash) {
  const chunkSize = 1024 * 1024
  let cursor = 0
  while (cursor < length) {
    const chunk = readAt(fd, offset + cursor, Math.min(chunkSize, length - cursor), hash)
    cursor += chunk.length
  }
}

function field(header, start, length) {
  const end = header.indexOf(0, start)
  return header.subarray(start, end >= start && end < start + length ? end : start + length).toString('utf8')
}

function octal(header, start, length) {
  const raw = field(header, start, length).replace(/\0/g, '').trim()
  if (!/^[0-7]+$/.test(raw)) fail('image archive has an invalid tar size')
  return Number.parseInt(raw, 8)
}

function safeArchivePath(value) {
  if (value.includes('\\')) fail('image archive contains an unsafe path')
  const directoryPath = value.endsWith('/')
  const normalized = directoryPath ? value.slice(0, -1) : value
  if (!normalized || normalized.startsWith('/') || normalized.includes('\0')) fail('image archive contains an unsafe path')
  const segments = normalized.split('/')
  if (Buffer.byteLength(normalized, 'utf8') > MAX_ARCHIVE_PATH_BYTES || segments.length > MAX_ARCHIVE_DEPTH || segments.some((segment) => !segment || segment === '.' || segment === '..' || !/^[A-Za-z0-9._-]+$/.test(segment))) {
    fail('image archive contains an unsafe path')
  }
  return directoryPath ? `${normalized}/` : normalized
}

function parseJson(buffer, label) {
  if (buffer.length > MAX_ARCHIVE_JSON_BYTES) fail(`image archive ${label} is too large`)
  try {
    return JSON.parse(buffer.toString('utf8'))
  } catch {
    fail(`image archive ${label} is invalid JSON`)
  }
}

function identityRepository(identity) {
  const repositoryWithTag = identity.slice(0, identity.lastIndexOf('@sha256:'))
  const separator = repositoryWithTag.lastIndexOf(':')
  const repository = separator > repositoryWithTag.lastIndexOf('/') ? repositoryWithTag.slice(0, separator) : repositoryWithTag
  if (!SAFE_REPOSITORY.test(repository)) fail('image identity repository is unsafe')
  return repository
}

function expectedTagMatches(tag, identity) {
  if (typeof tag !== 'string') return false
  const separator = tag.lastIndexOf(':')
  if (separator <= tag.lastIndexOf('/') || separator < 1) return false
  const repository = tag.slice(0, separator)
  const version = tag.slice(separator + 1)
  if (!SAFE_REPOSITORY.test(repository) || !SAFE_TAG.test(version)) return false
  const at = identity.lastIndexOf('@sha256:')
  const expectedTag = at > 0 ? identity.slice(0, at) : ''
  return tag === expectedTag && repository === identityRepository(identity)
}

function parseOctalField(header, start, length, label) {
  const raw = field(header, start, length).replace(/\0/g, '').trim()
  if (!/^[0-7]+$/.test(raw)) fail(`image archive has an invalid tar ${label}`)
  return Number.parseInt(raw, 8)
}

function assertHeaderChecksum(header) {
  const expected = parseOctalField(header, 148, 8, 'checksum')
  const checksumBytes = Buffer.from(header)
  checksumBytes.fill(0x20, 148, 156)
  let actual = 0
  for (const byte of checksumBytes) actual += byte
  if (actual !== expected) fail('image archive tar header checksum mismatch')
}

function parseHeader(header) {
  if (header.every((byte) => byte === 0)) return null
  assertHeaderChecksum(header)
  const magic = header.subarray(257, 263).toString('ascii')
  if (!(magic === 'ustar\0' || magic === 'ustar ')) fail('image archive is not a ustar tar')
  const name = field(header, 0, 100)
  const prefix = field(header, 345, 155)
  const path = safeArchivePath(prefix ? `${prefix}/${name}` : name)
  const size = octal(header, 124, 12)
  const type = String.fromCharCode(header[156] || 0)
  if (!['\0', '0', '5'].includes(type)) fail('image archive contains a link or device entry')
  return { path, size, type }
}

function isRegular(entry) { return entry.type === '\0' || entry.type === '0' }

function fileIdentity(stats) {
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

function sameFileIdentity(before, after) {
  return before.dev === after.dev && before.ino === after.ino && before.mode === after.mode && before.nlink === after.nlink && before.size === after.size && before.mtimeMs === after.mtimeMs && before.ctimeMs === after.ctimeMs
}

function assertZeroTail(fd, offset, size, hash) {
  const chunkSize = 1024 * 1024
  let cursor = offset
  while (cursor < size) {
    const chunk = readAt(fd, cursor, Math.min(chunkSize, size - cursor), hash)
    if (chunk.some((byte) => byte !== 0)) fail('image archive has non-zero trailing data')
    cursor += chunk.length
  }
}

/** Parse a Docker `save` tar stream without shelling out or extracting files. */
export function inspectDockerSaveArchive(archivePath, expected = {}, options = {}) {
  let stats
  try {
    stats = lstatSync(archivePath)
  } catch {
    fail('image archive is missing')
  }
  if (!stats.isFile() || stats.isSymbolicLink()) fail('image archive must be a regular file')
  if (stats.nlink !== 1) fail('image archive hardlinks are not allowed')
  if (stats.size > MAX_IMAGE_ARCHIVE_BYTES) fail('image archive exceeds the size limit')
  if (stats.size % 512 !== 0) fail('image archive is not block aligned')

  const flags = process.platform === 'win32' ? 'r' : constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0)
  const fd = openSync(archivePath, flags)
  const opened = fstatSync(fd)
  if (!sameFileIdentity(stats, opened) || !opened.isFile()) fail('image archive changed before parsing')
  const entries = new Map()
  const archiveHash = createHash('sha256')
  let offset = 0
  let totalPayload = 0
  let sawEnd = false
  try {
    for (let count = 0; count < MAX_ARCHIVE_ENTRIES; count += 1) {
      const header = readAt(fd, offset, 512, archiveHash)
      offset += 512
      const parsed = parseHeader(header)
      if (!parsed) {
        if (stats.size - offset < 512) fail('image archive has an incomplete end marker')
        const secondEnd = readAt(fd, offset, 512, archiveHash)
        if (secondEnd.some((byte) => byte !== 0)) fail('image archive has an incomplete end marker')
        offset += 512
        sawEnd = true
        break
      }
      const path = parsed.path
      if (entries.has(path)) fail('image archive contains duplicate entries')
      const foldedPath = path.toLowerCase()
      if ([...entries.keys()].some((entry) => entry.toLowerCase() === foldedPath)) fail('image archive contains ambiguous paths')
      if (parsed.size > MAX_IMAGE_ARCHIVE_BYTES || totalPayload + parsed.size > MAX_IMAGE_ARCHIVE_BYTES) fail('image archive payload exceeds the size limit')
      const dataOffset = offset
      const blocks = Math.ceil(parsed.size / 512)
      // The OCI layout uses the same blobs/sha256 namespace for the small JSON
      // config and potentially very large layer blobs. The manifest is the only
      // trusted way to identify which blob is the config, so retain only the
      // manifest during the sequential archive hash pass and read the selected
      // config from its stable descriptor afterward.
      const retainBody = parsed.path === 'manifest.json'
      if (retainBody && parsed.size > MAX_ARCHIVE_JSON_BYTES) fail('image archive manifest.json is too large')
      const body = retainBody ? readAt(fd, dataOffset, parsed.size, archiveHash) : (readDiscard(fd, dataOffset, parsed.size, archiveHash), undefined)
      const padding = blocks * 512 - parsed.size
      if (padding > 0) readDiscard(fd, dataOffset + parsed.size, padding, archiveHash)
      offset += blocks * 512
      totalPayload += parsed.size
      entries.set(path, { ...parsed, path, dataOffset, body })
    }
    if (!sawEnd) fail('image archive has too many entries')
    if (offset < stats.size) assertZeroTail(fd, offset, stats.size, archiveHash)
    if (entries.size === 0 || !entries.has('manifest.json') || !isRegular(entries.get('manifest.json'))) fail('image archive manifest.json is required and must be regular')
    const manifestEntry = entries.get('manifest.json')
    const manifest = parseJson(manifestEntry.body, 'manifest.json')
    if (!Array.isArray(manifest) || manifest.length !== 1 || !manifest[0] || typeof manifest[0] !== 'object') fail('image archive manifest must contain one image')
    const image = manifest[0]
    if (typeof image.Config !== 'string') fail('image archive config identity is invalid')
    const configPath = safeArchivePath(image.Config)
    const legacyConfig = /^[0-9a-f]{64}\.json$/i.test(configPath)
    const modernConfig = /^blobs\/sha256\/[0-9a-f]{64}$/i.test(configPath)
    if (!legacyConfig && !modernConfig) fail('image archive config identity is invalid')
    if (!Array.isArray(image.RepoTags) || image.RepoTags.length !== 1 || (expected.identity !== undefined && !expectedTagMatches(image.RepoTags[0], expected.identity))) fail('image archive RepoTags do not match the owner identity')
    if (!entries.has(configPath) || !isRegular(entries.get(configPath))) fail('image archive config file is missing or not regular')
    const configEntry = entries.get(configPath)
    if (configEntry.size > MAX_ARCHIVE_JSON_BYTES) fail('image archive config file is too large')
    const configBytes = configEntry.body ?? readAt(fd, configEntry.dataOffset, configEntry.size)
    const config = parseJson(configBytes, 'config')
    if (!config || typeof config !== 'object' || Array.isArray(config)) fail('image archive config must be a JSON object')
    const configDigest = createHash('sha256').update(configBytes).digest('hex')
    const expectedImageId = expected.imageId === undefined
      ? undefined
      : String(expected.imageId).replace(/^sha256:/i, '').toLowerCase()
    const configBasename = configPath.split('/').at(-1).replace(/\.json$/i, '')
    if (configBasename.toLowerCase() !== configDigest || (expectedImageId !== undefined && (!HEX64.test(expectedImageId) || configDigest !== expectedImageId))) fail('image archive config digest does not match image identity')
    if (!Array.isArray(image.Layers)) fail('image archive layer membership is invalid')
    const layers = image.Layers.map((layer) => {
      if (typeof layer !== 'string') fail('image archive layer membership is invalid')
      return safeArchivePath(layer)
    })
    const foldedLayers = new Set()
    for (const layerPath of layers) {
      const folded = layerPath.toLowerCase()
      if (foldedLayers.has(folded) || !entries.has(layerPath) || !isRegular(entries.get(layerPath))) fail('image archive layer membership is invalid')
      foldedLayers.add(folded)
    }
    options.hooks?.beforeFinalStat?.({ archivePath, fd, identity: fileIdentity(opened) })
    const closed = fstatSync(fd)
    if (!sameFileIdentity(opened, closed)) fail('image archive changed during parsing')
    options.hooks?.afterParse?.({ archivePath, fd, identity: fileIdentity(closed) })
    return {
      imageId: `sha256:${configDigest}`,
      archiveSha256: archiveHash.digest('hex'),
      archiveIdentity: fileIdentity(closed),
      config: configPath,
      repoTag: image.RepoTags[0],
      entries: [...entries.keys()].sort(),
      layers,
      layerCount: layers.length,
      archiveConfigImageIdDerived: true,
    }
  } finally {
    closeSync(fd)
  }
}

export const inspectDockerSave = inspectDockerSaveArchive
export const inspectImageArchive = inspectDockerSaveArchive
