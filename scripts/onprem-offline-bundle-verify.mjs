import {
  closeSync,
  constants,
  fstatSync,
  existsSync,
  lstatSync,
  openSync,
  readSync,
  readFileSync,
  readdirSync,
  realpathSync,
} from 'node:fs'
import { createHash, createPublicKey, verify as verifySignatureValue } from 'node:crypto'
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

import { inspectDockerSaveArchive } from './onprem-offline-archive.mjs'

export const IMAGE_NAMES = Object.freeze(['backend', 'frontend', 'keycloak', 'caddy', 'postgres', 'redis', 'seaweedfs'])
const VENDOR_NAMES = Object.freeze(['caddy', 'postgres', 'redis', 'seaweedfs'])
const VENDOR_EVIDENCE_SUFFIXES = Object.freeze({ sbom: 'sbom.spdx.json', vulnerabilityReport: 'trivy.json', vulnerabilityScan: 'trivy-vuln.json', sensitiveDataScan: 'trivy-secret.json', licenseInventory: 'license-inventory.json' })
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
    ...VENDOR_NAMES.flatMap((name) => [
      `evidence/${name}-sbom.spdx.json`, `evidence/${name}-trivy-vuln.json`,
      `evidence/${name}-trivy-secret.json`, `evidence/${name}-trivy.json`,
      `evidence/${name}-license-inventory.json`,
    ]),
  ]),
  docs: Object.freeze([
    'docs/runbooks/onprem-offline-install-v1.md', 'docs/runbooks/onprem-offline-backup-restore-v1.md',
    'docs/licenses/backend-THIRD_PARTY_NOTICES.txt', 'docs/licenses/frontend-THIRD_PARTY_NOTICES.txt',
    'docs/licenses/keycloak-LICENSE.txt', 'docs/licenses/seaweedfs-LICENSE.txt',
    'docs/security/postgres-gosu.trivyignore.yaml',
  ]),
})

export const LIMITS = Object.freeze({
  manifestBytes: 1024 * 1024,
  signatureBytes: 1024 * 1024,
  files: 256,
  depth: 8,
  pathBytes: 240,
  entries: 512,
  totalBytes: 100 * 1024 * 1024 * 1024,
})

const TOP_LEVEL_DIRS = new Set(['images', 'deployment', 'operations', 'evidence', 'docs'])
const GENERATED_FILES = new Set(['bundle-manifest.json', 'bundle-signature.json'])
const REQUIRED_FILES = new Set([
  ...Object.values(REQUIRED_BUNDLE_PATHS.imageArchives), ...REQUIRED_BUNDLE_PATHS.deployment,
  ...REQUIRED_BUNDLE_PATHS.operations, ...REQUIRED_BUNDLE_PATHS.evidence, ...REQUIRED_BUNDLE_PATHS.docs,
])
const IMAGE_PATHS = new Set(Object.values(REQUIRED_BUNDLE_PATHS.imageArchives))
const IMAGE_NAME_BY_PATH = new Map(Object.entries(REQUIRED_BUNDLE_PATHS.imageArchives).map(([name, pathname]) => [pathname, name]))
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
const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/
const SHA = /^[0-9a-f]{64}$/i
const DIGEST = /^sha256:[0-9a-f]{64}$/i
const SOURCE_REVISION = /^[0-9a-f]{40}$/i
const UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/
const B64URL = /^[A-Za-z0-9_-]+$/
const SEGMENT = /^[A-Za-z0-9._-]+$/
const IMAGE_REPOSITORY = /^[A-Za-z0-9][A-Za-z0-9._/-]*$/
const IMAGE_TAG = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/

export class OfflineBundleVerifyError extends Error {}
function fail(message) { throw new OfflineBundleVerifyError(message) }
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
function realRoot(pathname, label) { try { return realpathSync(pathname) } catch { fail(`${label} cannot be resolved`) } }
function digest(value, label) { if (typeof value !== 'string' || !DIGEST.test(value)) fail(`${label} must be sha256:<64 hex>`); return value.toLowerCase() }
function sha(value, label) { if (typeof value !== 'string' || !SHA.test(value)) fail(`${label} must be a SHA-256 hex digest`); return value.toLowerCase() }
function timestamp(value) { if (typeof value !== 'string' || !UTC.test(value) || new Date(value).toISOString() !== value) fail('createdAt must be exact UTC ISO-8601') }
function expectedMode(pathname) { return EXECUTABLE_PATHS.has(pathname) ? 0o755 : 0o644 }
function posixMode(stats, expected, pathname) {
  if (process.platform !== 'win32' && (stats.mode & 0o777) !== expected) fail(`bundle file mode is invalid: ${pathname}`)
}
function regular(pathname, label, { directory = false } = {}) {
  let stats
  try { stats = lstatSync(pathname) } catch { fail(`${label} is missing`) }
  if (stats.isSymbolicLink() || stats.isBlockDevice() || stats.isCharacterDevice() || stats.isFIFO() || stats.isSocket()) fail(`${label} must not be a symlink or special file`)
  if (directory ? !stats.isDirectory() : !stats.isFile()) fail(`${label} has an invalid type`)
  if (!directory && stats.nlink !== 1) fail(`${label} hardlinks are not allowed`)
  return stats
}
function identity(stats) { return { dev: stats.dev, ino: stats.ino, mode: stats.mode, nlink: stats.nlink, size: stats.size, mtimeMs: stats.mtimeMs, ctimeMs: stats.ctimeMs } }
function sameIdentity(before, after) { return before.dev === after.dev && before.ino === after.ino && before.mode === after.mode && before.nlink === after.nlink && before.size === after.size && before.mtimeMs === after.mtimeMs && before.ctimeMs === after.ctimeMs }
function readStable(pathname, cap, label) {
  const before = regular(pathname, label)
  if (before.size > cap) fail(`${label} exceeds size limit`)
  const flags = process.platform === 'win32' ? 'r' : constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0)
  let fd
  try {
    fd = openSync(pathname, flags)
    const opened = fstatSync(fd)
    if (!sameIdentity(before, opened)) fail(`${label} changed before read`)
    const hash = createHash('sha256'); const content = Buffer.alloc(opened.size); let offset = 0
    while (offset < content.length) {
      const count = readSync(fd, content, offset, content.length - offset, null)
      if (count === 0) fail(`${label} changed during read`)
      hash.update(content.subarray(offset, offset + count)); offset += count
    }
    const closed = fstatSync(fd)
    if (!sameIdentity(opened, closed) || offset !== before.size) fail(`${label} changed during read`)
    return { bytes: content.length, sha256: hash.digest('hex'), identity: identity(closed), content: content.toString('utf8') }
  } catch (error) {
    if (error instanceof OfflineBundleVerifyError) throw error
    fail(`${label} cannot be read safely`)
  } finally { if (fd !== undefined) try { closeSync(fd) } catch { /* preserve original failure */ } }
}
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
  const images = {}; const imageIds = new Set(); const archiveDigests = new Set(); const repoTags = new Set()
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
    if (!new Set(['backend', 'frontend', 'keycloak']).has(name) && !item.registryDigestAttestedByOwner) fail(`vendor image ${name} must be owner-attested`)
    images[name] = { name, archive: item.archive, repoTag: item.repoTag, configImageId, archiveSha256, registryDigestAttestedByOwner: item.registryDigestAttestedByOwner, ...(item.registryManifestDigest === undefined ? {} : { registryManifestDigest: item.registryManifestDigest.toLowerCase() }) }
  }
  return { schemaVersion: 1, configSchemaVersion: 1, dataClass: 'synthetic', releaseId: input.releaseId, sourceRevision: input.sourceRevision.toLowerCase(), createdAt: input.createdAt, images }
}
export function validateBundleMetadata(input) { return validateMetadata(input) }
function assertNoTrivySecretFindings(report, path) {
  if (!object(report) || !Array.isArray(report.Results)) fail(`vendor evidence ${path} secret scan is invalid`)
  for (const result of report.Results) {
    if (!object(result) || (result.Secrets !== undefined && !Array.isArray(result.Secrets)) || (result.Secrets ?? []).length !== 0) fail(`vendor evidence ${path} contains a secret finding`)
  }
}
function validateTrivyVendorScan(scan, image, name, label) {
  if (!object(scan) || scan.ArtifactType !== 'container_image' || scan.ArtifactName !== `/out/${name}-image.tar` || !DIGEST.test(scan.ArtifactID ?? '') || !object(scan.Metadata) || scan.Metadata.ImageID !== image.configImageId || !Array.isArray(scan.Metadata.RepoTags) || scan.Metadata.RepoTags.length !== 1 || scan.Metadata.RepoTags[0] !== image.repoTag || !Array.isArray(scan.Results)) fail(`vendor evidence ${name} ${label} Trivy identity is invalid`)
  return scan
}
function validateVendorRawEvidence(image, name, paths, loadJson) {
  const sbom = loadJson(paths.sbom)
  const vulnerability = validateTrivyVendorScan(loadJson(paths.vulnerabilityScan), image, name, 'vulnerability')
  const secret = validateTrivyVendorScan(loadJson(paths.sensitiveDataScan), image, name, 'secret')
  const combined = loadJson(paths.vulnerabilityReport)
  const license = loadJson(paths.licenseInventory)
  const expectedRepository = imageTag(image.repoTag, `vendor evidence ${name}`).repository
  if (!object(sbom) || sbom.spdxVersion !== 'SPDX-2.3' || sbom.name !== expectedRepository || !Array.isArray(sbom.packages)) fail(`vendor evidence ${name} SBOM identity is invalid`)
  if (!object(combined) || combined.schemaVersion !== 1 || combined.image !== name || !object(combined.scans) || canonicalize(combined.scans.vulnerability) !== canonicalize(vulnerability) || canonicalize(combined.scans.secret) !== canonicalize(secret)) fail(`vendor evidence ${name} combined Trivy report does not agree with raw scans`)
  if (vulnerability.ArtifactID !== secret.ArtifactID || vulnerability.ArtifactName !== secret.ArtifactName) fail(`vendor evidence ${name} Trivy scans do not agree`)
  assertNoTrivySecretFindings(secret, paths.sensitiveDataScan)
  const expectedLicense = { schemaVersion: 1, dataClass: 'synthetic', image: `${image.repoTag}@${image.registryManifestDigest}`, imageId: image.configImageId, sbom: `${name}-sbom.spdx.json`, vulnerabilityReport: `${name}-trivy.json`, secretReport: `${name}-trivy-secret.json`, licenseSource: 'SPDX package license assertions' }
  if (canonicalize(license) !== canonicalize(expectedLicense)) fail(`vendor evidence ${name} license identity is invalid`)
}
function validateVendorEvidenceClosure(metadata, aggregates, files, loadJson) {
  if (!object(metadata) || !object(metadata.images) || !object(aggregates)) fail('vendor evidence metadata is invalid')
  const fileMap = new Map(files.map((entry) => [entry?.path, entry]))
  let referenceRecords
  for (const [aggregateName, recordsKey] of [['sbom', 'components'], ['license', 'inventories'], ['vulnerability', 'reports']]) {
    const aggregate = aggregates[aggregateName]
    if (!object(aggregate) || aggregate.schemaVersion !== 1 || aggregate.dataClass !== 'synthetic' || !object(aggregate[recordsKey])) fail('vendor evidence aggregate is invalid')
    const records = Object.fromEntries(VENDOR_NAMES.map((name) => [name, aggregate[recordsKey][name]]))
    if (Object.values(records).some((record) => !object(record))) fail('vendor evidence record is missing')
    if (referenceRecords && canonicalize(records) !== canonicalize(referenceRecords)) fail('vendor evidence aggregates do not agree')
    referenceRecords = records
  }
  for (const name of VENDOR_NAMES) {
    const image = metadata.images[name]
    const record = referenceRecords[name]
    exact(record, new Set(['configImageId', 'archive', 'registryReference', 'registryManifestDigest', 'artifacts']), `vendor evidence ${name}`)
    if (!object(image) || record.configImageId !== image.configImageId || record.archive !== image.archive || record.registryManifestDigest !== image.registryManifestDigest || record.registryReference !== `${image.repoTag}@${image.registryManifestDigest}`) fail(`vendor evidence ${name} image identity mismatch`)
    const expectedArtifacts = Object.fromEntries(Object.entries(VENDOR_EVIDENCE_SUFFIXES).map(([key, suffix]) => [key, `evidence/${name}-${suffix}`]))
    if (name === 'postgres') {
      expectedArtifacts.vulnerabilityExceptionReceipt = 'evidence/postgres-vulnerability-exception-receipt.json'
      expectedArtifacts.vulnerabilityExceptionSymbolProof = 'evidence/postgres-gosu-symbol-proof.json'
    }
    exact(record.artifacts, new Set(Object.keys(expectedArtifacts)), `vendor evidence ${name} artifacts`)
    for (const [key, expectedPath] of Object.entries(expectedArtifacts)) {
      const artifact = record.artifacts[key]
      exact(artifact, new Set(['path', 'sha256']), `vendor evidence ${name} ${key}`)
      const file = fileMap.get(expectedPath)
      if (artifact.path !== expectedPath || !file || artifact.sha256 !== file.sha256) fail(`vendor evidence ${name} ${key} digest mismatch`)
    }
    validateVendorRawEvidence(image, name, expectedArtifacts, loadJson)
  }
  return true
}
function parseJson(pathname, cap, label) { try { return JSON.parse(readStable(pathname, cap, label).content) } catch (error) { if (error instanceof OfflineBundleVerifyError) throw error; fail(`${label} is invalid JSON`) } }
function inventory(rootPath, expectedImages) {
  regular(rootPath, 'bundle root', { directory: true }); const root = realRoot(rootPath, 'bundle root'); const files = []; const seenFolded = new Set(); const stack = [{ absolute: rootPath, relative: '' }]; let total = 0; let entriesSeen = 0
  while (stack.length) {
    const current = stack.pop(); let entries
    try { entries = readdirSync(current.absolute, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name)) } catch { fail('bundle directory cannot be read safely') }
    for (let index = entries.length - 1; index >= 0; index -= 1) {
      const entry = entries[index]; const rel = normalizedPath(current.relative ? `${current.relative}/${entry.name}` : entry.name); const absolute = join(current.absolute, entry.name); entriesSeen += 1
      if (entriesSeen > LIMITS.entries) fail('bundle contains too many filesystem entries')
      const stats = regular(absolute, 'bundle entry', { directory: entry.isDirectory() }); const folded = rel.toLowerCase()
      if (seenFolded.has(folded)) fail('bundle paths must be unique case-insensitively'); seenFolded.add(folded)
      if (entry.isDirectory()) { if (!current.relative && !TOP_LEVEL_DIRS.has(entry.name)) fail('bundle contains a disallowed top-level directory'); stack.push({ absolute, relative: rel }); continue }
      if (files.length >= LIMITS.files) fail('bundle contains too many files')
      const generated = GENERATED_FILES.has(rel)
      if (!generated && !REQUIRED_FILES.has(rel)) fail('bundle contains an unexpected file')
      if (generated && current.relative) fail('generated files must be at bundle root')
      const expectedModeValue = expectedMode(rel); if (!generated) posixMode(stats, expectedModeValue, rel)
      total += stats.size; if (total > LIMITS.totalBytes) fail('bundle exceeds total size limit')
      let observed = null
      if (!generated && IMAGE_PATHS.has(rel)) {
        const name = IMAGE_NAME_BY_PATH.get(rel)
        try { observed = inspectDockerSaveArchive(absolute, { imageId: expectedImages[name]?.configImageId }); assertImageArchive(expectedImages[name], observed, name) } catch (error) { fail(error?.message ?? 'image archive structural validation failed') }
      } else if (!generated) observed = readStable(absolute, LIMITS.totalBytes, 'required bundle file')
      files.push({ path: rel, bytes: stats.size, sha256: generated ? '' : (observed.archiveSha256 ?? observed.sha256), mode: generated ? 0o644 : expectedModeValue, archiveSha256: observed?.archiveSha256, archiveLayers: observed?.layers, archiveLayerCount: observed?.layerCount })
    }
  }
  return { root, files: files.sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0) }
}
function requiredPresent(files) { const paths = new Set(files.map((file) => file.path)); if ([...REQUIRED_FILES].some((pathname) => !paths.has(pathname))) fail('bundle is missing required release material') }
function loadManifestAndSignature(bundleDir) {
  regular(bundleDir, 'bundle root', { directory: true }); const root = realRoot(bundleDir, 'bundle root'); const entries = readdirSync(bundleDir, { withFileTypes: true }); const names = new Set(entries.map((entry) => entry.name))
  for (const required of GENERATED_FILES) if (!names.has(required)) fail('bundle manifest and signature are required at bundle root')
  for (const entry of entries.filter((item) => GENERATED_FILES.has(item.name))) if (!entry.isFile() || entry.isSymbolicLink()) fail('generated bundle files must be regular files')
  return { root, manifest: parseJson(join(bundleDir, 'bundle-manifest.json'), LIMITS.manifestBytes, 'bundle manifest'), signature: parseJson(join(bundleDir, 'bundle-signature.json'), LIMITS.signatureBytes, 'bundle signature') }
}
function validateManifest(manifest) {
  exact(manifest, new Set(['schemaVersion', 'configSchemaVersion', 'dataClass', 'releaseId', 'sourceRevision', 'createdAt', 'archiveConfigImageIdDerived', 'files', 'images']), 'bundle manifest')
  const metadata = validateMetadata({ schemaVersion: manifest.schemaVersion, configSchemaVersion: manifest.configSchemaVersion, dataClass: manifest.dataClass, releaseId: manifest.releaseId, sourceRevision: manifest.sourceRevision, createdAt: manifest.createdAt, images: manifest.images })
  if (manifest.archiveConfigImageIdDerived !== true) fail('bundle archive image identity flag is required')
  if (!Array.isArray(manifest.files) || manifest.files.length > LIMITS.files) fail('bundle manifest files are invalid')
  const files = []; const folded = new Set(); let previous = ''
  for (const item of manifest.files) {
    exact(item, new Set(['path', 'bytes', 'sha256', 'mode']), 'bundle manifest file'); const pathValue = normalizedPath(item.path)
    if (pathValue <= previous) fail('bundle manifest files must use code-point sort order'); previous = pathValue
    const fold = pathValue.toLowerCase(); if (folded.has(fold)) fail('bundle manifest paths are not unique'); folded.add(fold)
    if (!REQUIRED_FILES.has(pathValue)) fail('bundle manifest contains an unexpected file')
    if (!Number.isSafeInteger(item.bytes) || item.bytes < 0) fail('bundle manifest file size is invalid')
    sha(item.sha256, 'bundle manifest file digest'); if (item.mode !== expectedMode(pathValue)) fail('bundle manifest file mode is invalid')
    files.push({ path: pathValue, bytes: item.bytes, sha256: item.sha256.toLowerCase(), mode: item.mode })
  }
  requiredPresent(files); return { ...metadata, archiveConfigImageIdDerived: true, files }
}
function validateSignatureEnvelope(signature) {
  exact(signature, new Set(['algorithm', 'encoding', 'keyFingerprintSha256', 'value']), 'bundle signature')
  if (signature.algorithm !== 'Ed25519' || signature.encoding !== 'base64url' || typeof signature.keyFingerprintSha256 !== 'string' || !SHA.test(signature.keyFingerprintSha256) || typeof signature.value !== 'string' || !B64URL.test(signature.value)) fail('bundle signature envelope is invalid')
  return signature
}
function trustedPublicKey(pathname, bundleRoot) {
  if (typeof pathname !== 'string' || !pathname) fail('public key path is required')
  let resolved
  try { resolved = realpathSync(pathname) } catch { fail('public key path is invalid') }
  if (contained(bundleRoot, resolved)) fail('public key path must be outside bundle directories')
  let key
  try { key = createPublicKey(readFileSync(resolved)) } catch { fail('public key is invalid') }
  if (key.asymmetricKeyType !== 'ed25519') fail('public key must be Ed25519')
  const fingerprint = createHash('sha256').update(key.export({ type: 'spki', format: 'der' })).digest('hex')
  return { key, fingerprint }
}
function verifyFiles(bundleDir, manifest) {
  const entries = inventory(bundleDir, manifest.images); const actual = new Map(entries.files.filter((file) => !GENERATED_FILES.has(file.path)).map((file) => [file.path, file])); const expected = new Map(manifest.files.map((file) => [file.path, file]))
  if (actual.size !== expected.size || [...actual.keys()].some((pathname) => !expected.has(pathname))) fail('bundle contains an unmanifested extra file')
  for (const item of manifest.files) { const file = actual.get(item.path); if (!file || file.bytes !== item.bytes || file.sha256 !== item.sha256 || file.mode !== item.mode) fail('bundle file digest, size, or mode mismatch') }
  for (const [name, item] of Object.entries(manifest.images)) { const archive = actual.get(item.archive); if (!archive || archive.archiveSha256 !== archive.sha256) fail(`image ${name} archive digest mismatch`) }
  return entries.files.filter((file) => !GENERATED_FILES.has(file.path))
}
export function verifyOfflineBundle(options = {}) {
  if (typeof options === 'string') options = { bundleDir: options }
  if (!options?.bundleDir) fail('bundle directory is required')
  const { root, manifest: rawManifest, signature: rawSignature } = loadManifestAndSignature(options.bundleDir)
  const manifest = validateManifest(rawManifest); const signature = validateSignatureEnvelope(rawSignature); const trusted = trustedPublicKey(options.publicKeyPath, root)
  if (typeof options.trustedFingerprint !== 'string' || !SHA.test(options.trustedFingerprint) || trusted.fingerprint !== options.trustedFingerprint.toLowerCase()) fail('trusted fingerprint mismatch')
  if (trusted.fingerprint !== signature.keyFingerprintSha256.toLowerCase()) fail('bundle signature fingerprint mismatch')
  if (!verifySignatureValue(null, Buffer.from(canonicalize(manifest)), trusted.key, Buffer.from(signature.value, 'base64url'))) fail('bundle signature mismatch')
  const files = verifyFiles(options.bundleDir, manifest)
  validateVendorEvidenceClosure(manifest, {
    sbom: parseJson(join(options.bundleDir, 'evidence', 'sbom.json'), LIMITS.totalBytes, 'vendor SBOM aggregate'),
    license: parseJson(join(options.bundleDir, 'evidence', 'license-inventory.json'), LIMITS.totalBytes, 'vendor license aggregate'),
    vulnerability: parseJson(join(options.bundleDir, 'evidence', 'vulnerability-report.json'), LIMITS.totalBytes, 'vendor vulnerability aggregate'),
  }, files, (path) => parseJson(join(options.bundleDir, ...path.split('/')), LIMITS.totalBytes, path))
  return true
}

function cli(argv) {
  if (argv.shift() !== 'verify') fail('mode must be verify')
  const options = {}
  while (argv.length) {
    const flag = argv.shift(); if (!argv.length) fail('unknown or incomplete CLI argument')
    if (flag === '--bundle-dir') options.bundleDir = argv.shift()
    else if (flag === '--public-key') options.publicKeyPath = argv.shift()
    else if (flag === '--trusted-fingerprint') options.trustedFingerprint = argv.shift()
    else fail(`unknown argument: ${flag}`)
  }
  if (!options.bundleDir || !options.publicKeyPath || typeof options.trustedFingerprint !== 'string' || !SHA.test(options.trustedFingerprint)) fail('verify requires bundle, public key, and trusted fingerprint')
  if (options.trustedFingerprint.toLowerCase() !== options.trustedFingerprint) fail('trusted fingerprint must be lowercase')
  verifyOfflineBundle(options)
  console.log('offline bundle: verified')
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try { cli(process.argv.slice(2)) } catch (error) { console.error(`offline bundle: ${error instanceof OfflineBundleVerifyError ? error.message : 'verification failed'}`); process.exitCode = 1 }
}
