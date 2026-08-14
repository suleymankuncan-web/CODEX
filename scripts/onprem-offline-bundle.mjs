import {
  chmodSync,
  closeSync,
  constants,
  existsSync,
  fstatSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  openSync,
  readSync,
  readdirSync,
  readFileSync,
  realpathSync,
  renameSync,
  rmSync,
  writeSync,
  writeFileSync,
} from 'node:fs'
import { createHash, createPrivateKey, createPublicKey, sign, verify } from 'node:crypto'
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

import { inspectDockerSaveArchive } from './onprem-offline-archive.mjs'
import { verifyContentGuardIndex } from './onprem-offline-content-guard-index.mjs'
import { verifyReleaseManifest } from './onprem-release-manifest.mjs'

export const IMAGE_NAMES = Object.freeze(['backend', 'frontend', 'keycloak', 'caddy', 'postgres', 'redis', 'seaweedfs'])
export const REQUIRED_BUNDLE_PATHS = Object.freeze({
  imageArchives: Object.freeze(Object.fromEntries(IMAGE_NAMES.map((name) => [name, `images/${name}.tar`]))),
  deployment: Object.freeze([
    'deployment/compose.yaml', 'deployment/compose.photo-proof.yaml', 'deployment/photo-compose.yaml', 'deployment/proof.compose.yaml', 'deployment/restore.compose.yaml',
    'deployment/templates/core.env.template', 'deployment/templates/photo.env.template',
    'deployment/caddy/Caddyfile', 'deployment/keycloak/bootstrap.sh', 'deployment/keycloak/realm-config.json',
    'deployment/postgres/entrypoint-tls.sh', 'deployment/postgres/010-bootstrap-roles.sh',
    'deployment/redis/redis.conf', 'deployment/photo-storage/bootstrap.sh', 'deployment/photo-storage/LICENSE',
  ]),
  operations: Object.freeze([
    'operations/preflight.sh', 'operations/install.sh', 'operations/migrate.sh', 'operations/activate.sh', 'operations/smoke.sh',
    'operations/backup.sh', 'operations/restore.sh', 'operations/upgrade.sh', 'operations/rollback.sh',
    'operations/onprem-offline-bundle.mjs', 'operations/onprem-offline-archive.mjs',
    'operations/onprem-offline-content-guard-index.mjs', 'operations/onprem-release-manifest.mjs',
    'operations/onprem-keycloak-auth-proof.mjs', 'operations/onprem-offline-target-proof.mjs',
    'operations/onprem-photo-auth-proof.mjs',
    'operations/onprem-postgres-vulnerability-exception.mjs',
  ]),
  evidence: Object.freeze([
    'evidence/sbom.json', 'evidence/license-inventory.json', 'evidence/vulnerability-report.json',
    'evidence/release-receipt.json', 'evidence/runtime-receipt.json', 'evidence/backend-content-guard.json',
    'evidence/frontend-content-guard.json', 'evidence/keycloak-content-guard.json', 'evidence/release-manifest.json',
    'evidence/migration-compatibility.json', 'evidence/content-guard-index.json',
    'evidence/postgres-vulnerability-exception-receipt.json', 'evidence/postgres-gosu-symbol-proof.json',
    'evidence/postgres-trivy-vuln.json',
  ]),
  docs: Object.freeze([
    'docs/runbooks/onprem-offline-install-v1.md', 'docs/runbooks/onprem-offline-backup-restore-v1.md',
    'docs/licenses/backend-THIRD_PARTY_NOTICES.txt', 'docs/licenses/frontend-THIRD_PARTY_NOTICES.txt',
    'docs/licenses/keycloak-LICENSE.txt', 'docs/licenses/seaweedfs-LICENSE.txt',
    'docs/security/postgres-gosu.trivyignore.yaml',
  ]),
})

export const LIMITS = Object.freeze({
  manifestBytes: 1024 * 1024, signatureBytes: 1024 * 1024, files: 256, depth: 8, pathBytes: 240,
  entries: 512, nonImageBytes: 16 * 1024 * 1024, totalBytes: 100 * 1024 * 1024 * 1024, imageBytes: 20 * 1024 * 1024 * 1024,
})

const TOP_LEVEL_DIRS = new Set(['images', 'deployment', 'operations', 'evidence', 'docs'])
const GENERATED_FILES = new Set(['bundle-manifest.json', 'bundle-signature.json'])
const REQUIRED_FILES = new Set([
  ...Object.values(REQUIRED_BUNDLE_PATHS.imageArchives), ...REQUIRED_BUNDLE_PATHS.deployment,
  ...REQUIRED_BUNDLE_PATHS.operations, ...REQUIRED_BUNDLE_PATHS.evidence, ...REQUIRED_BUNDLE_PATHS.docs,
])
const IMAGE_PATHS = new Set(Object.values(REQUIRED_BUNDLE_PATHS.imageArchives))
const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/
const SHA = /^[0-9a-f]{64}$/
const DIGEST = /^sha256:[0-9a-f]{64}$/
const SOURCE_REVISION = /^[0-9a-f]{40}$/i
const UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/
const B64URL = /^[A-Za-z0-9_-]+$/
const SEGMENT = /^[A-Za-z0-9._-]+$/
const SOURCE_EXTENSIONS = new Set(['.c', '.cc', '.cpp', '.cjs', '.go', '.h', '.hpp', '.java', '.js', '.jsx', '.mjs', '.php', '.py', '.rb', '.rs', '.ts', '.tsx', '.vue', '.map'])
const SECRET_PATH = /(?:^|[._-])(?:secret|secrets|credential|credentials|password|passwd|token|private[._-]?key|id_rsa)(?:$|[._-])/i
const SENSITIVE_ASSIGNMENT_NAME = String.raw`\b[A-Za-z0-9_.-]*(?:password|passwd|secret|token|api[_-]?key|access[_-]?key|private[_-]?key|client[_-]?secret|database[_-]?url|credential|endpoint)`
const SECRET_ASSIGNMENT = new RegExp(`${SENSITIVE_ASSIGNMENT_NAME}[\\t ]*["']?[\\t ]*[:=][\\t ]*(?:"([^"]*)"|'([^']*)'|` + '`([^`]*)`' + `|([^\\s#,}]+))`, 'gim')
const MULTILINE_SECRET_ASSIGNMENT = new RegExp(`${SENSITIVE_ASSIGNMENT_NAME}[\\t ]*["']?[\\t ]*[:=][\\t ]*\\r?\\n[\\t ]*(?:"([^"]*)"|'([^']*)'|` + '`([^`]*)`' + `)`, 'gim')
const PRIVATE_KEY = /-----BEGIN(?: [A-Z]+)* PRIVATE KEY-----/i
const SENSITIVE_JSON_KEYS = new Set(['password', 'passwd', 'secret', 'token', 'apikey', 'accesskey', 'privatekey', 'clientsecret', 'databaseurl'])
const CUSTOM_IMAGE_NAMES = new Set(['backend', 'frontend', 'keycloak'])
const IMAGE_REPOSITORY = /^[A-Za-z0-9][A-Za-z0-9._/-]*$/
const IMAGE_TAG = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/

export class OfflineBundleError extends Error {}
function fail(message) { throw new OfflineBundleError(message) }
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
function normalizedPath(value, label = 'path') {
  if (typeof value !== 'string' || value.includes('\\') || value.includes('\0')) fail(`${label} must be a portable relative path`)
  if (value.startsWith('/') || /^[A-Za-z]:/.test(value)) fail(`${label} must be a portable relative path`)
  const parts = value.split('/')
  if (!value || parts.length > LIMITS.depth || parts.some((part) => !SEGMENT.test(part) || part === '.' || part === '..') || Buffer.byteLength(value) > LIMITS.pathBytes) fail(`${label} must be a portable relative path`)
  return value
}
function contained(base, candidate) {
  const rel = relative(base, candidate)
  return rel === '' || (rel !== '..' && !rel.startsWith(`..${sep}`) && !isAbsolute(rel))
}
function assertContained(base, candidate, label) { if (!contained(base, candidate)) fail(`${label} escapes its allowed directory`) }
function realRoot(pathname, label) { try { return realpathSync(pathname) } catch { fail(`${label} cannot be resolved`) } }
function digest(value, label) { if (typeof value !== 'string' || !DIGEST.test(value)) fail(`${label} must be sha256:<64 hex>`); return value.toLowerCase() }
function sha(value, label) { if (typeof value !== 'string' || !SHA.test(value)) fail(`${label} must be a SHA-256 hex digest`); return value.toLowerCase() }
function timestamp(value) { if (typeof value !== 'string' || !UTC.test(value) || new Date(value).toISOString() !== value) fail('createdAt must be exact UTC ISO-8601') }
const EXECUTABLE_PATHS = new Set([
  'operations/preflight.sh', 'operations/install.sh', 'operations/migrate.sh', 'operations/activate.sh', 'operations/smoke.sh',
  'operations/backup.sh', 'operations/restore.sh', 'operations/upgrade.sh', 'operations/rollback.sh',
  'operations/onprem-offline-bundle.mjs', 'operations/onprem-offline-archive.mjs',
  'operations/onprem-offline-content-guard-index.mjs', 'operations/onprem-release-manifest.mjs',
  'operations/onprem-keycloak-auth-proof.mjs', 'operations/onprem-offline-target-proof.mjs',
  'operations/onprem-photo-auth-proof.mjs',
  'operations/onprem-postgres-vulnerability-exception.mjs',
  'deployment/keycloak/bootstrap.sh', 'deployment/postgres/entrypoint-tls.sh',
  'deployment/postgres/010-bootstrap-roles.sh', 'deployment/photo-storage/bootstrap.sh',
])
function expectedMode(pathname) { return EXECUTABLE_PATHS.has(pathname) ? 0o755 : 0o644 }
function posixMode(stats, expected, pathname = 'file') {
  if (process.platform !== 'win32' && (stats.mode & 0o777) !== expected) fail(`staged file mode does not match the bundle contract: ${pathname}`)
}
function assertKeyPathOutside(pathValue, roots, label = 'trusted key') {
  if (typeof pathValue !== 'string' || !pathValue) fail(`${label} path is required`)
  let resolved
  try { resolved = realpathSync(pathValue) } catch { fail(`${label} path is invalid`) }
  for (const root of roots.filter(Boolean)) if (contained(root, resolved)) fail(`${label} path must be outside bundle directories`)
  return resolved
}
function keyFrom(pathValue, kind) {
  try { return kind === 'private' ? createPrivateKey(readFileSync(pathValue)) : createPublicKey(readFileSync(pathValue)) } catch { fail(`${kind} key is invalid`) }
}
function fingerprint(key) { return createHash('sha256').update(key.export({ type: 'spki', format: 'der' })).digest('hex') }
function trustedKey(options, kind, roots) {
  const pathValue = options[`${kind}KeyPath`]
  const keyPath = assertKeyPathOutside(pathValue, roots)
  const key = keyFrom(keyPath, kind)
  if (key.asymmetricKeyType !== 'ed25519') fail(`${kind} key must be Ed25519`)
  const pinned = options.trustedKeyFingerprintSha256
  if (typeof pinned !== 'string' || !SHA.test(pinned) || pinned !== fingerprint(kind === 'private' ? createPublicKey(key) : key)) fail('trusted key fingerprint mismatch')
  return { key, path: keyPath, fingerprint: pinned }
}
function lstatRegular(pathname, label, { directory = false } = {}) {
  let stats
  try { stats = lstatSync(pathname) } catch { fail(`${label} is missing`) }
  if (stats.isSymbolicLink() || stats.isBlockDevice() || stats.isCharacterDevice() || stats.isFIFO() || stats.isSocket()) fail(`${label} must not be a symlink or special file`)
  if (directory ? !stats.isDirectory() : !stats.isFile()) fail(`${label} has an invalid type`)
  if (!directory && stats.nlink !== 1) fail(`${label} hardlinks are not allowed`)
  return stats
}
function sameFileIdentity(before, after) {
  return before.dev === after.dev && before.ino === after.ino && before.mode === after.mode && before.nlink === after.nlink && before.size === after.size && before.mtimeMs === after.mtimeMs && before.ctimeMs === after.ctimeMs
}
function fileIdentity(stats) {
  return { dev: stats.dev, ino: stats.ino, mode: stats.mode, nlink: stats.nlink, size: stats.size, mtimeMs: stats.mtimeMs, ctimeMs: stats.ctimeMs }
}
export function readAndHashStable(pathname, maxBytes, label, { scan = false, scanAssignments = true, relativePath = label, hooks = {} } = {}) {
  const stats = lstatRegular(pathname, label)
  if (stats.size > maxBytes) fail(`${label} exceeds size limit`)
  let fd
  try {
    hooks.beforeOpen?.({ pathname, identity: fileIdentity(stats) })
    const flags = process.platform === 'win32' ? 'r' : constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0)
    fd = openSync(pathname, flags)
    const opened = fstatSync(fd)
    if (!sameFileIdentity(stats, opened) || !opened.isFile()) fail('file changed during hashing')
    hooks.afterOpen?.({ pathname, fd, identity: fileIdentity(opened) })
    const hash = createHash('sha256')
    const content = Buffer.alloc(opened.size)
    let bytes = 0
    let count
    while (bytes < content.length && (count = readSync(fd, content, bytes, content.length - bytes, null)) > 0) {
      hash.update(content.subarray(bytes, bytes + count))
      bytes += count
      if (bytes > maxBytes) fail('file exceeds the bundle size limit')
    }
    const closed = fstatSync(fd)
    if (!sameFileIdentity(opened, closed) || bytes !== stats.size) fail('file changed during hashing')
    const digestValue = hash.digest('hex')
    const value = { sha256: digestValue, bytes, identity: fileIdentity(closed), content: content.toString('utf8') }
    if (scan) {
      if (/\.json$/i.test(relativePath)) validateOfflineJsonContent(value.content, relativePath)
      else validateOfflineTextContent(value.content, relativePath, { checkAssignments: scanAssignments })
    }
    hooks.afterRead?.({ pathname, identity: value.identity, sha256: value.sha256 })
    return value
  } catch (error) {
    if (error instanceof OfflineBundleError) throw error
    fail('file cannot be read safely')
  } finally {
    if (fd !== undefined) {
      try { closeSync(fd) } catch { /* preserve original failure */ }
    }
  }
}
function hashFile(pathname, maxBytes = LIMITS.totalBytes) { return readAndHashStable(pathname, maxBytes, 'file').sha256 }
function isPlaceholder(value) { return /^(?:synthetic|example|sample|placeholder|changeme|change[-_ ]?me|none|null|undefined|public|test|testing|dummy|fake|<[^>]+>)$/i.test(value.trim()) }
function isSafeAssignmentValue(value, { quoted = false, quote = '' } = {}) {
  const trimmed = value.trim()
  if (!trimmed || isPlaceholder(trimmed)) return true
  if (/^(?:-|env=|\$\{[^}]+\}|\$[A-Za-z_][A-Za-z0-9_]*|\$[0-9]+|\$\$?\(|\/run\/secrets\/|\.\/|https?:\/\/\$\{)/.test(trimmed)) return true
  if (trimmed === 'http://object-storage:8333') return true
  if (quoted) return quote === '`' && /\$\{[^}]+\}/.test(trimmed)
    || /^[A-Za-z_$][A-Za-z0-9_$]*(?:Path|File|Name)$/.test(trimmed)
    || /^(?:migrator|api|worker|keycloak)_password$/.test(trimmed)
  if (trimmed.startsWith('/run/secrets/')) return true
  if (trimmed.startsWith('/-----BEGIN')) return true
  return /^(?:fields\[[^\]]+\]|[A-Za-z_$][A-Za-z0-9_$]*(?:\.[A-Za-z0-9_$-]+|\[[^\]]+\])*(?:\([^;\n]*\))?|[A-Za-z_$][A-Za-z0-9_$]*_(?:password|secret|token|url)|[A-Za-z_$][A-Za-z0-9_$]*\([^;\n]*)$/.test(trimmed)
}
export function validateOfflineTextContent(content, relativePath = 'text', { checkAssignments = true } = {}) {
  if (typeof content !== 'string') fail(`required text content is invalid: ${relativePath}`)
  if (PRIVATE_KEY.test(content)) fail(`secret material is not allowed in ${relativePath}`)
  if (checkAssignments) {
    for (const pattern of [SECRET_ASSIGNMENT, MULTILINE_SECRET_ASSIGNMENT]) {
      pattern.lastIndex = 0
      for (const match of content.matchAll(pattern)) {
        const captures = match.slice(1)
        const captureIndex = captures.findIndex(Boolean)
        const value = captureIndex >= 0 ? captures[captureIndex] : ''
        const quote = captureIndex === 0 ? '"' : captureIndex === 1 ? "'" : captureIndex === 2 ? '`' : ''
        if (value && !isSafeAssignmentValue(value, { quoted: captureIndex >= 0 && captureIndex < 3, quote })) fail(`secret material is not allowed in ${relativePath}`)
      }
    }
  }
  return true
}
export function validateOfflineJsonContent(content, relativePath = 'json') {
  let value
  try { value = JSON.parse(content) } catch { fail(`${relativePath} must contain valid JSON`) }
  const visit = (node, location) => {
    if (Array.isArray(node)) { node.forEach((child, index) => visit(child, `${location}[${index}]`)); return }
    if (!object(node)) return
    for (const [key, child] of Object.entries(node)) {
      if (SENSITIVE_JSON_KEYS.has(key.toLowerCase()) && (typeof child !== 'string' || !isPlaceholder(child))) fail(`sensitive JSON field is not allowed in ${relativePath}`)
      visit(child, `${location}.${key}`)
    }
  }
  visit(value, '$')
  validateOfflineTextContent(content, relativePath)
  return true
}
function readStable(pathname, cap, label) {
  return readAndHashStable(pathname, cap, label).content
}
function isImage(pathname) { return IMAGE_PATHS.has(pathname) }
const IMAGE_NAME_BY_PATH = new Map(Object.entries(REQUIRED_BUNDLE_PATHS.imageArchives).map(([name, pathname]) => [pathname, name]))
export function inventory(rootPath, { hash = hashFile, generated = false, scan = true, expectedImages = {}, hooks = {}, retainContentPaths = new Set() } = {}) {
  lstatRegular(rootPath, 'bundle root', { directory: true })
  const root = realRoot(rootPath, 'bundle root')
  const files = []
  const seenFolded = new Set()
  const stack = [{ absolute: rootPath, relative: '' }]
  let total = 0
  let entryCount = 0
  while (stack.length) {
    const current = stack.pop()
    let entries
    try { entries = readdirSync(current.absolute, { withFileTypes: true }).sort((a, b) => a.name.codePointAt(0) - b.name.codePointAt(0) || a.name.localeCompare(b.name)) } catch { fail('bundle directory cannot be read safely') }
    for (let index = entries.length - 1; index >= 0; index -= 1) {
      const entry = entries[index]
      const rel = normalizedPath(current.relative ? `${current.relative}/${entry.name}` : entry.name)
      const absolute = join(current.absolute, entry.name)
      entryCount += 1
      if (entryCount > LIMITS.entries) fail('bundle contains too many filesystem entries')
      const stats = lstatRegular(absolute, 'bundle entry', { directory: entry.isDirectory() })
      const fold = rel.toLowerCase()
      if (seenFolded.has(fold)) fail('bundle paths must be unique case-insensitively')
      seenFolded.add(fold)
      if (entry.isDirectory()) {
        if (!current.relative && !TOP_LEVEL_DIRS.has(entry.name)) fail('bundle contains a disallowed top-level directory')
        stack.push({ absolute, relative: rel })
        continue
      }
      if (files.length >= LIMITS.files) fail('bundle contains too many files')
      const allowedGenerated = generated && GENERATED_FILES.has(rel)
      if (!allowedGenerated && !REQUIRED_FILES.has(rel)) fail('bundle contains an unexpected file')
      if (!generated && !REQUIRED_FILES.has(rel)) fail('staging contains an unexpected file')
      if (allowedGenerated && current.relative) fail('generated files must be at bundle root')
      const expected = expectedMode(rel)
      if (!allowedGenerated) posixMode(stats, expected, rel)
      total += stats.size
      if (total > LIMITS.totalBytes) fail('bundle exceeds total size limit')
      let observed = null
      if (!allowedGenerated && isImage(rel)) {
        const imageName = IMAGE_NAME_BY_PATH.get(rel)
        try {
          const expected = expectedImages[imageName]
          observed = inspectDockerSaveArchive(absolute, { imageId: expected?.configImageId }, { hooks: hooks.archive })
          assertImageArchive(expected, observed, imageName)
        } catch (error) {
          if (error instanceof OfflineBundleError) throw error
          fail(error?.message ?? 'image archive structural validation failed')
        }
      } else if (!allowedGenerated) {
        observed = readAndHashStable(absolute, LIMITS.nonImageBytes, 'required text file', { scan, relativePath: rel, hooks: hooks.files })
      }
      files.push({ path: rel, bytes: stats.size, sha256: allowedGenerated ? '' : (observed.archiveSha256 ?? observed.sha256), mode: allowedGenerated ? 0o644 : expected, absolute, identity: allowedGenerated ? fileIdentity(stats) : observed.identity, archiveSha256: observed?.archiveSha256, archiveLayers: observed?.layers, archiveLayerCount: observed?.layerCount, content: observed?.content && retainContentPaths.has(rel) ? observed.content : undefined })
    }
  }
  return { root, files: files.sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0) }
}
function requiredPresent(files) { const paths = new Set(files.map((file) => file.path)); if ([...REQUIRED_FILES].some((pathname) => !paths.has(pathname))) fail('bundle is missing required release material') }
function imageTag(value, label) {
  if (typeof value !== 'string') fail(`${label} repoTag is required`)
  const separator = value.lastIndexOf(':')
  if (separator <= value.lastIndexOf('/') || separator < 1) fail(`${label} repoTag is malformed`)
  const repository = value.slice(0, separator); const tag = value.slice(separator + 1)
  if (!IMAGE_REPOSITORY.test(repository) || !IMAGE_TAG.test(tag)) fail(`${label} repoTag is malformed`)
  return { repository, tag }
}
function assertImageArchive(expected, observed, name) {
  if (!expected || observed.repoTag !== expected.repoTag) fail(`image ${name} archive RepoTag does not match metadata`)
  if (observed.imageId !== expected.configImageId) fail(`image ${name} archive config image ID does not match metadata`)
  if (observed.archiveSha256 !== expected.archiveSha256) fail(`image ${name} archive SHA-256 does not match metadata`)
}
function validateMetadata(input) {
  exact(input, new Set(['schemaVersion', 'configSchemaVersion', 'dataClass', 'releaseId', 'sourceRevision', 'createdAt', 'images']), 'bundle metadata')
  if (input.schemaVersion !== 1 || input.configSchemaVersion !== 1) fail('schemaVersion and configSchemaVersion must equal 1')
  if (input.dataClass !== 'synthetic') fail('dataClass must be synthetic')
  if (typeof input.releaseId !== 'string' || !SAFE_ID.test(input.releaseId)) fail('releaseId is unsafe')
  if (typeof input.sourceRevision !== 'string' || !SOURCE_REVISION.test(input.sourceRevision)) fail('sourceRevision must be a 40-character Git SHA')
  timestamp(input.createdAt)
  exact(input.images, new Set(IMAGE_NAMES), 'images')
  const images = {}
  const imageIds = new Set(); const archiveDigests = new Set(); const repoTags = new Set()
  for (const name of IMAGE_NAMES) {
    const item = input.images[name]
    if (!object(item)) fail(`image ${name} object is required`)
    const keys = new Set(Object.keys(item)); const allowed = new Set(['name', 'archive', 'repoTag', 'configImageId', 'archiveSha256', 'registryDigestAttestedByOwner', 'registryManifestDigest'])
    if ([...keys].some((key) => !allowed.has(key)) || !['name', 'archive', 'repoTag', 'configImageId', 'archiveSha256', 'registryDigestAttestedByOwner'].every((key) => keys.has(key))) fail(`image ${name} has an invalid field set`)
    if (item.name !== name) fail(`image ${name} name does not match its metadata key`)
    if (normalizedPath(item.archive) !== REQUIRED_BUNDLE_PATHS.imageArchives[name]) fail(`image ${name} archive path is not allowed`)
    const tag = imageTag(item.repoTag, `image ${name}`)
    const configImageId = digest(item.configImageId, `image ${name} configImageId`)
    const archiveSha256 = sha(item.archiveSha256, `image ${name} archiveSha256`)
    if (imageIds.has(configImageId) || archiveDigests.has(archiveSha256) || repoTags.has(item.repoTag.toLowerCase())) fail('image config IDs, archive digests, and RepoTags must be unique')
    imageIds.add(configImageId); archiveDigests.add(archiveSha256); repoTags.add(item.repoTag.toLowerCase())
    if (typeof item.registryDigestAttestedByOwner !== 'boolean') fail(`image ${name} registry attestation flag is invalid`)
    if (item.registryDigestAttestedByOwner) {
      if (typeof item.registryManifestDigest !== 'string' || !DIGEST.test(item.registryManifestDigest)) fail(`image ${name} owner-attested registry manifest digest is required`)
      if (!tag.repository) fail(`image ${name} owner-attested repoTag repository is invalid`)
    } else if (item.registryManifestDigest !== undefined) fail(`image ${name} registry manifest digest requires owner attestation`)
    if (!CUSTOM_IMAGE_NAMES.has(name) && !item.registryDigestAttestedByOwner) fail(`vendor image ${name} must be owner-attested`)
    images[name] = {
      name, archive: item.archive, repoTag: item.repoTag, configImageId,
      archiveSha256, registryDigestAttestedByOwner: item.registryDigestAttestedByOwner,
      ...(item.registryManifestDigest === undefined ? {} : { registryManifestDigest: item.registryManifestDigest.toLowerCase() }),
    }
  }
  return { schemaVersion: 1, configSchemaVersion: 1, dataClass: 'synthetic', releaseId: input.releaseId, sourceRevision: input.sourceRevision.toLowerCase(), createdAt: input.createdAt, images }
}
export function validateBundleMetadata(input) { return validateMetadata(input) }
function parseJsonFile(pathname, cap, label) {
  try { return JSON.parse(readStable(pathname, cap, label)) } catch (error) {
    if (error instanceof OfflineBundleError) throw error
    fail(`${label} is invalid JSON`)
  }
}
function stagedSnapshot(staged, pathname, label = pathname) {
  const entry = staged.files.find((file) => file.path === pathname)
  if (!entry || typeof entry.content !== 'string') fail(`${label} is missing from the inventory snapshot`)
  return entry
}
function parseSnapshotJson(staged, pathname, label = pathname) {
  const entry = stagedSnapshot(staged, pathname, label)
  try { return JSON.parse(entry.content) } catch { fail(`${label} is invalid JSON`) }
}
function validateGuardIndex(options, roots, baseDir, stagingDir, metadata, upstream, staged) {
  const indexPath = assertKeyPathOutside(options.contentGuardIndexPath, roots, 'content guard index')
  const publicPath = assertKeyPathOutside(options.contentGuardPublicKeyPath, roots, 'content guard public key')
  const pinned = options.contentGuardTrustedKeyFingerprintSha256
  if (typeof pinned !== 'string' || !SHA.test(pinned)) fail('content guard trusted key fingerprint is required')
  const indexSnapshot = readAndHashStable(indexPath, LIMITS.manifestBytes, 'content guard index', { scan: true, relativePath: 'content-guard-index.json' })
  let index
  try { index = JSON.parse(indexSnapshot.content) } catch { fail('content guard index is invalid JSON') }
  let verified
  try {
    verified = verifyContentGuardIndex(index, {
      baseDir,
      publicKeyPath: publicPath,
      trustedKeyFingerprintSha256: pinned,
      expectedImages: Object.fromEntries(Object.entries(metadata.images).map(([name, image]) => [name, { imageId: image.configImageId }])),
    })
  } catch (error) {
    fail(error?.message?.startsWith('content guard') ? error.message : 'content guard index verification failed')
  }
  const stagedIndex = stagedSnapshot(staged, 'evidence/content-guard-index.json', 'staged content guard index')
  if (stagedIndex.sha256 !== indexSnapshot.sha256 || stagedIndex.bytes !== indexSnapshot.bytes) fail('staged content guard index does not match the externally verified index')
  const artifactKey = { backend: 'backendImage', frontend: 'frontendImage', keycloak: 'keycloakImage' }
  for (const name of ['backend', 'frontend', 'keycloak']) {
    const artifact = index.artifacts[name]
    const upstreamArtifact = upstream?.artifacts?.[artifactKey[name]]
    const stagedArchive = staged.files.find((file) => file.path === metadata.images[name].archive)
    const stagedReceipt = stagedSnapshot(staged, `evidence/${name}-content-guard.json`, `staged ${name} content guard`)
    if (!upstreamArtifact || String(upstreamArtifact.path) !== artifact.archive.path || String(upstreamArtifact.sha256).toLowerCase() !== artifact.archive.sha256.toLowerCase()) fail(`content guard artifact ${name} archive is not bound to upstream release evidence`)
    if (!stagedArchive || stagedArchive.archiveSha256 !== artifact.archive.sha256 || stagedArchive.sha256 !== artifact.archive.sha256) fail(`staged ${name} archive is not bound to the content guard index`)
    if (stagedReceipt.sha256 !== artifact.finalRootfs.sha256) fail(`staged ${name} content guard evidence is not owner-signed`)
    const stagedReceiptValue = parseSnapshotJson(staged, stagedReceipt.path, `staged ${name} content guard`)
    if (!object(stagedReceiptValue) || stagedReceiptValue.ok !== true) fail(`staged ${name} content guard evidence failed`)
    if (verified[name].layerCount !== artifact.layerCount || verified[name].layers.some((pathValue, index) => pathValue !== artifact.layers[index].manifestLayerPath) || stagedArchive.archiveLayerCount !== artifact.layerCount || stagedArchive.archiveLayers?.some((pathValue, index) => pathValue !== artifact.layers[index].manifestLayerPath)) fail(`content guard artifact ${name} layer count or order mismatch`)
  }
}
function externalUpstream(options, roots, stagingDir, metadata, staged) {
  const manifestPath = assertKeyPathOutside(options.upstreamReleaseManifestPath, roots, 'upstream release manifest')
  const publicPath = assertKeyPathOutside(options.upstreamReleasePublicKeyPath, roots, 'upstream release public key')
  const upstreamTrustedFingerprint = options.upstreamTrustedKeyFingerprintSha256
  if (typeof upstreamTrustedFingerprint !== 'string' || !SHA.test(upstreamTrustedFingerprint)) fail('upstream trusted key fingerprint is required')
  if (!options.upstreamReleaseBaseDir) fail('upstream release base directory is required')
  let baseDir
  try { baseDir = realpathSync(options.upstreamReleaseBaseDir) } catch { fail('upstream release base directory is invalid') }
  for (const root of roots) if (contained(root, baseDir)) fail('upstream release base directory must be outside bundle directories')
  const upstream = parseJsonFile(manifestPath, LIMITS.manifestBytes, 'upstream release manifest')
  const upstreamPublicKey = keyFrom(publicPath, 'public')
  if (upstreamPublicKey.asymmetricKeyType !== 'ed25519' || fingerprint(upstreamPublicKey) !== upstreamTrustedFingerprint.toLowerCase()) fail('upstream trusted key fingerprint mismatch')
  try { verifyReleaseManifest(upstream, { baseDir, publicKeyPath: publicPath }) } catch { fail('upstream release manifest verification failed') }
  const stagedManifest = parseSnapshotJson(staged, 'evidence/release-manifest.json', 'bundled release manifest')
  if (canonicalize(stagedManifest) !== canonicalize(upstream)) fail('bundled release manifest does not match verified upstream evidence')
  const expectedIds = upstream.imageIds ?? {}
  for (const name of ['backend', 'frontend', 'keycloak']) if (metadata.images[name].configImageId !== String(expectedIds[name] ?? '').toLowerCase()) fail('upstream image config identity mismatch')
  const artifactKey = { backend: 'backendImage', frontend: 'frontendImage', keycloak: 'keycloakImage' }
  for (const name of ['backend', 'frontend', 'keycloak']) {
    const artifact = upstream.artifacts?.[artifactKey[name]]
    const stagedArchive = staged.files.find((file) => file.path === metadata.images[name].archive)
    let upstreamArchiveProof
    let stagedArchiveProof
    try {
      upstreamArchiveProof = inspectDockerSaveArchive(join(baseDir, artifact?.path ?? ''), { imageId: metadata.images[name].configImageId })
      assertImageArchive(metadata.images[name], upstreamArchiveProof, name)
      stagedArchiveProof = stagedArchive
    } catch { fail('upstream image archive structural validation failed') }
    if (!artifact || typeof artifact.path !== 'string' || !stagedArchive || upstreamArchiveProof.archiveSha256 !== String(artifact.sha256).toLowerCase() || stagedArchiveProof.archiveSha256 !== String(artifact.sha256).toLowerCase()) fail('upstream image archive digest mismatch')
  }
  if (upstream.sourceRevision?.toLowerCase() !== metadata.sourceRevision || upstream.configSchemaVersion !== metadata.configSchemaVersion) fail('upstream release identity does not match bundle metadata')
  validateGuardIndex(options, roots, baseDir, stagingDir, metadata, upstream, staged)
  options.testHooks?.external?.afterValidation?.({ staged })
}
function ensureDistinct(staging, output) {
  const stagingRoot = realRoot(staging, 'staging directory')
  const outputResolved = resolve(output)
  const outputCanonical = join(realRoot(dirname(outputResolved), 'output parent'), basename(outputResolved))
  if (contained(stagingRoot, outputCanonical) || contained(outputCanonical, stagingRoot)) fail('staging and output directories must be separate')
  return { stagingRoot, outputResolved, outputCanonical, parent: realpathSync(dirname(outputResolved)) }
}
function outputAbsent(output) { if (existsSync(output)) fail('output directory must be absent') }
export function copyStable(source, destination, expectedBytes, expectedHash, mode = 0o644, expectedIdentity, hooks = {}) {
  const before = lstatRegular(source, 'staged file')
  if (before.size !== expectedBytes || (expectedIdentity && !sameFileIdentity(expectedIdentity, before))) fail('staged file changed during inventory')
  let sourceFd
  let destinationFd
  try {
    hooks.beforeOpen?.({ source, destination, identity: fileIdentity(before) })
    const sourceFlags = process.platform === 'win32' ? 'r' : constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0)
    sourceFd = openSync(source, sourceFlags)
    const opened = fstatSync(sourceFd)
    if (!sameFileIdentity(before, opened) || (expectedIdentity && !sameFileIdentity(expectedIdentity, opened)) || !opened.isFile() || opened.size !== expectedBytes) fail('staged file changed during copy')
    hooks.afterOpen?.({ source, destination, identity: fileIdentity(opened) })
    destinationFd = openSync(destination, 'wx', mode)
    const hash = createHash('sha256')
    const buffer = Buffer.allocUnsafe(1024 * 1024)
    let bytes = 0
    let count
    while ((count = readSync(sourceFd, buffer, 0, buffer.length, null)) > 0) {
      writeSync(destinationFd, buffer, 0, count)
      hash.update(buffer.subarray(0, count))
      bytes += count
    }
    const closed = fstatSync(sourceFd)
    if (!sameFileIdentity(opened, closed) || (expectedIdentity && !sameFileIdentity(expectedIdentity, closed)) || bytes !== expectedBytes || hash.digest('hex') !== expectedHash) fail('staged file changed during copy')
    hooks.afterRead?.({ source, destination, identity: fileIdentity(closed), sha256: expectedHash })
  } catch (error) {
    if (error instanceof OfflineBundleError) throw error
    fail('staged file could not be copied safely')
  } finally {
    if (sourceFd !== undefined) try { closeSync(sourceFd) } catch { /* preserve original error */ }
    if (destinationFd !== undefined) try { closeSync(destinationFd) } catch { /* preserve original error */ }
  }
  if (hooks.skipDestinationVerify) return { sha256: expectedHash, bytes: expectedBytes, identity: lstatRegular(destination, 'copied file') }
  const copied = readAndHashStable(destination, expectedBytes, 'copied file')
  if (copied.sha256 !== expectedHash || copied.bytes !== expectedBytes) fail('copied file digest mismatch')
  return copied
}
function loadManifestAndSignature(bundleDir) {
  lstatRegular(bundleDir, 'bundle root', { directory: true })
  const root = realRoot(bundleDir, 'bundle root')
  const entries = readdirSync(bundleDir, { withFileTypes: true })
  const rootNames = new Set(entries.map((entry) => entry.name))
  for (const required of GENERATED_FILES) if (!rootNames.has(required)) fail('bundle manifest and signature are required at bundle root')
  for (const entry of entries.filter((item) => GENERATED_FILES.has(item.name))) if (!entry.isFile() || entry.isSymbolicLink()) fail('generated bundle files must be regular files')
  const manifestPath = join(bundleDir, 'bundle-manifest.json'); const signaturePath = join(bundleDir, 'bundle-signature.json')
  const manifest = parseJsonFile(manifestPath, LIMITS.manifestBytes, 'bundle manifest')
  const signature = parseJsonFile(signaturePath, LIMITS.signatureBytes, 'bundle signature')
  return { root, manifest, signature }
}
function validateManifest(manifest) {
  exact(manifest, new Set(['schemaVersion', 'configSchemaVersion', 'dataClass', 'releaseId', 'sourceRevision', 'createdAt', 'archiveConfigImageIdDerived', 'files', 'images']), 'bundle manifest')
  const metadata = validateMetadata({ schemaVersion: manifest.schemaVersion, configSchemaVersion: manifest.configSchemaVersion, dataClass: manifest.dataClass, releaseId: manifest.releaseId, sourceRevision: manifest.sourceRevision, createdAt: manifest.createdAt, images: manifest.images })
  if (manifest.archiveConfigImageIdDerived !== true) fail('bundle archive image identity flag is required')
  if (!Array.isArray(manifest.files) || manifest.files.length > LIMITS.files) fail('bundle manifest files are invalid')
  const files = []; const folded = new Set(); let previous = ''
  for (const item of manifest.files) {
    exact(item, new Set(['path', 'bytes', 'sha256', 'mode']), 'bundle manifest file')
    const pathValue = normalizedPath(item.path)
    if (pathValue <= previous) fail('bundle manifest files must use code-point sort order')
    previous = pathValue
    const fold = pathValue.toLowerCase(); if (folded.has(fold)) fail('bundle manifest paths are not unique'); folded.add(fold)
    if (!REQUIRED_FILES.has(pathValue)) fail('bundle manifest contains an unexpected file')
    if (!Number.isSafeInteger(item.bytes) || item.bytes < 0) fail('bundle manifest file size is invalid')
    sha(item.sha256, 'bundle manifest file digest')
    if (item.mode !== expectedMode(pathValue)) fail('bundle manifest file mode is invalid')
    files.push({ path: pathValue, bytes: item.bytes, sha256: item.sha256.toLowerCase(), mode: item.mode })
  }
  requiredPresent(files)
  return { ...metadata, archiveConfigImageIdDerived: true, files }
}
function validateContentGuardEvidence(staged) {
  for (const pathname of ['evidence/backend-content-guard.json', 'evidence/frontend-content-guard.json', 'evidence/keycloak-content-guard.json']) {
    const evidence = parseSnapshotJson(staged, pathname, pathname)
    if (!object(evidence) || evidence.ok !== true || !Array.isArray(evidence.violations) || evidence.violations.length !== 0) fail('content guard evidence must attest a passing source-free image')
  }
}
function validateMigrationCompatibility(staged, metadata) {
  const pathname = 'evidence/migration-compatibility.json'
  const value = parseSnapshotJson(staged, pathname, pathname)
  exact(value, new Set(['schemaVersion', 'releaseId', 'migrationTreeDigest', 'compatibleFrom', 'upgradeCompatible', 'rollbackCompatible']), 'migration compatibility')
  if (value.schemaVersion !== 1 || value.releaseId !== metadata.releaseId) fail('migration compatibility release binding is invalid')
  sha(value.migrationTreeDigest, 'migration compatibility migrationTreeDigest')
  if (!Array.isArray(value.compatibleFrom)) fail('migration compatibility compatibleFrom must be an array')
  const seen = new Set()
  for (const entry of value.compatibleFrom) {
    exact(entry, new Set(['sourceReleaseId', 'sourceMigrationTreeDigest']), 'migration compatibility source')
    if (typeof entry.sourceReleaseId !== 'string' || !SAFE_ID.test(entry.sourceReleaseId) || seen.has(entry.sourceReleaseId)) fail('migration compatibility source release IDs must be unique and safe')
    seen.add(entry.sourceReleaseId)
    sha(entry.sourceMigrationTreeDigest, 'migration compatibility source migrationTreeDigest')
  }
  if (typeof value.upgradeCompatible !== 'boolean' || typeof value.rollbackCompatible !== 'boolean') fail('migration compatibility flags must be boolean')
  return true
}
function validateSignature(signature) {
  exact(signature, new Set(['algorithm', 'encoding', 'keyFingerprintSha256', 'value']), 'bundle signature')
  if (signature.algorithm !== 'Ed25519' || signature.encoding !== 'base64url' || typeof signature.keyFingerprintSha256 !== 'string' || !SHA.test(signature.keyFingerprintSha256) || typeof signature.value !== 'string' || !B64URL.test(signature.value)) fail('bundle signature envelope is invalid')
  return signature
}
function verifySignature(manifest, signature, options, roots) {
  const trusted = trustedKey(options, 'public', roots)
  if (trusted.fingerprint !== signature.keyFingerprintSha256) fail('bundle signature fingerprint mismatch')
  if (!verify(null, Buffer.from(canonicalize(manifest)), trusted.key, Buffer.from(signature.value, 'base64url'))) fail('bundle signature mismatch')
}
function verifyFiles(bundleDir, manifest, options) {
  const entries = inventory(bundleDir, { generated: true, scan: false, expectedImages: manifest.images, hooks: options.testHooks })
  const actual = new Map(entries.files.filter((file) => !GENERATED_FILES.has(file.path)).map((file) => [file.path, file]))
  const expected = new Map(manifest.files.map((file) => [file.path, file]))
  if (actual.size !== expected.size || [...actual.keys()].some((pathValue) => !expected.has(pathValue))) fail('bundle contains an unmanifested extra file')
  for (const item of manifest.files) {
    const file = actual.get(item.path); if (!file || file.bytes !== item.bytes || file.sha256 !== item.sha256) fail('bundle file digest or size mismatch')
    if (file.mode !== item.mode) fail('bundle file mode mismatch')
  }
  for (const [name, item] of Object.entries(manifest.images)) {
    const archive = actual.get(item.archive)
    if (!archive) fail(`image ${name} archive is missing`)
    if (archive.archiveSha256 !== archive.sha256) fail(`image ${name} archive digest mismatch`)
  }
  return true
}
export function createOfflineBundle(inputOrOptions, maybeOptions) {
  if (process.platform === 'win32') fail('create requires Linux or WSL')
  const options = maybeOptions ? maybeOptions : inputOrOptions
  const input = maybeOptions ? inputOrOptions : options?.input
  const metadata = validateMetadata(input)
  if (!options?.stagingDir || !options?.outputDir) fail('staging and output directories are required')
  lstatRegular(options.stagingDir, 'staging directory', { directory: true })
  const staging = realRoot(options.stagingDir, 'staging directory'); const output = resolve(options.outputDir)
  const distinct = ensureDistinct(staging, output)
  const roots = [staging, distinct.outputCanonical]
  const trusted = trustedKey(options, 'private', roots)
  const publicPath = assertKeyPathOutside(options.trustedPublicKeyPath, roots)
  const publicKey = keyFrom(publicPath, 'public'); if (publicKey.asymmetricKeyType !== 'ed25519' || fingerprint(publicKey) !== options.trustedKeyFingerprintSha256 || fingerprint(publicKey) !== trusted.fingerprint) fail('trusted public key does not match signing key')
  outputAbsent(output)
  const staged = inventory(staging, {
    generated: false,
    expectedImages: metadata.images,
    hooks: options.testHooks,
    retainContentPaths: new Set([
      'evidence/release-manifest.json',
      'evidence/backend-content-guard.json',
      'evidence/frontend-content-guard.json',
      'evidence/keycloak-content-guard.json',
      'evidence/migration-compatibility.json',
      'evidence/content-guard-index.json',
    ]),
  }); requiredPresent(staged.files)
  validateContentGuardEvidence(staged)
  validateMigrationCompatibility(staged, metadata)
  externalUpstream(options, roots, staging, metadata, staged)
  const manifest = {
    schemaVersion: 1, configSchemaVersion: 1, dataClass: 'synthetic', releaseId: metadata.releaseId, sourceRevision: metadata.sourceRevision, createdAt: metadata.createdAt,
    archiveConfigImageIdDerived: true,
    files: staged.files.map(({ path, bytes, sha256, mode }) => ({ path, bytes, sha256, mode })), images: metadata.images,
  }
  const signature = { algorithm: 'Ed25519', encoding: 'base64url', keyFingerprintSha256: trusted.fingerprint, value: sign(null, Buffer.from(canonicalize(manifest)), trusted.key).toString('base64url') }
  let temp
  try { temp = mkdtempSync(join(dirname(output), `.${output.split(sep).at(-1)}.tmp-`)); chmodSync(temp, 0o700) } catch { fail('offline bundle temporary directory could not be created') }
  try {
    for (const file of staged.files) { const destination = join(temp, ...file.path.split('/')); mkdirSync(dirname(destination), { recursive: true }); copyStable(file.absolute, destination, file.bytes, file.sha256, file.mode, file.identity, options.testHooks?.copy) }
    const copied = inventory(temp, { generated: true, scan: true, expectedImages: metadata.images, hooks: options.testHooks })
    const copiedByPath = new Map(copied.files.map((file) => [file.path, file]))
    for (const file of staged.files) {
      const observed = copiedByPath.get(file.path)
      if (!observed || observed.bytes !== file.bytes || observed.sha256 !== file.sha256 || observed.mode !== file.mode) fail(`private copied file rescan mismatch: ${file.path}`)
    }
    writeFileSync(join(temp, 'bundle-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o644 })
    writeFileSync(join(temp, 'bundle-signature.json'), `${JSON.stringify(signature, null, 2)}\n`, { mode: 0o644 })
    verifyOfflineBundle({ bundleDir: temp, publicKeyPath: publicPath, trustedKeyFingerprintSha256: options.trustedKeyFingerprintSha256 })
    if (existsSync(output)) fail('output directory appeared during bundle creation')
    renameSync(temp, output)
    return manifest
  } catch (error) {
    try { rmSync(temp, { recursive: true, force: true }) } catch { /* preserve original sanitized error */ }
    if (error instanceof OfflineBundleError) throw error
    fail('offline bundle creation failed')
  }
}
export function verifyOfflineBundle(bundleOrOptions, maybeOptions) {
  const options = typeof bundleOrOptions === 'string' ? { ...(maybeOptions ?? {}), bundleDir: bundleOrOptions } : bundleOrOptions
  if (!options?.bundleDir) fail('bundle directory is required')
  const { root, manifest: rawManifest, signature: rawSignature } = loadManifestAndSignature(options.bundleDir)
  const manifest = validateManifest(rawManifest); const signature = validateSignature(rawSignature)
  verifySignature(manifest, signature, options, [root])
  verifyFiles(options.bundleDir, manifest, options)
  return true
}
export const createBundle = createOfflineBundle
export const verifyBundle = verifyOfflineBundle

function cli(argv) {
  const mode = argv.shift(); if (!['create', 'verify'].includes(mode)) fail('mode must be create or verify')
  const options = {}
  const names = { '--input': 'inputPath', '--staging-dir': 'stagingDir', '--output-dir': 'outputDir', '--private-key': 'privateKeyPath', '--trusted-public-key': 'trustedPublicKeyPath', '--trusted-fingerprint': 'trustedKeyFingerprintSha256', '--bundle-dir': 'bundleDir', '--public-key': 'publicKeyPath', '--upstream-manifest': 'upstreamReleaseManifestPath', '--upstream-public-key': 'upstreamReleasePublicKeyPath', '--upstream-trusted-fingerprint': 'upstreamTrustedKeyFingerprintSha256', '--upstream-base-dir': 'upstreamReleaseBaseDir', '--content-guard-index': 'contentGuardIndexPath', '--content-guard-public-key': 'contentGuardPublicKeyPath', '--content-guard-trusted-fingerprint': 'contentGuardTrustedKeyFingerprintSha256' }
  while (argv.length) { const flag = argv.shift(); const key = names[flag]; if (!key || !argv.length) fail('unknown or incomplete CLI argument'); options[key] = argv.shift() }
  if (mode === 'create') { if (!options.inputPath || !options.stagingDir || !options.outputDir || !options.privateKeyPath || !options.trustedPublicKeyPath || !options.trustedKeyFingerprintSha256 || !options.upstreamReleaseManifestPath || !options.upstreamReleasePublicKeyPath || !options.upstreamTrustedKeyFingerprintSha256 || !options.upstreamReleaseBaseDir || !options.contentGuardIndexPath || !options.contentGuardPublicKeyPath || !options.contentGuardTrustedKeyFingerprintSha256) fail('create requires metadata, directories, trust, upstream release, and content guard evidence'); options.input = parseJsonFile(options.inputPath, LIMITS.manifestBytes, 'bundle metadata'); createOfflineBundle(options); console.log('offline bundle: created') }
  else { if (!options.bundleDir || !options.publicKeyPath || !options.trustedKeyFingerprintSha256) fail('verify requires bundle, public key, and trusted fingerprint'); verifyOfflineBundle(options); console.log('offline bundle: verified') }
}
function safeError(error) { return error instanceof OfflineBundleError ? error.message : 'offline bundle operation failed' }
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) { try { cli(process.argv.slice(2)) } catch (error) { console.error(`offline bundle: ${safeError(error)}`); process.exitCode = 1 } }
