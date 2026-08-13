import { createHash, createPublicKey, verify as verifySignatureValue } from 'node:crypto'
import { existsSync, readFileSync, realpathSync, statSync } from 'node:fs'
import { isAbsolute, join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const DIGEST = /^sha256:[0-9a-f]{64}$/i
const DIGEST_HEX = /^[0-9a-f]{64}$/i
const PINNED_IMAGE = /^\S+@sha256:[0-9a-f]{64}$/i
const SOURCE_REVISION = /^[0-9a-f]{40}$/i
const SAFE_VERSION = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/
const TOP_LEVEL_MANIFEST_FIELDS = new Set(['dataClass', 'sourceRevision', 'version', 'buildTimestamp', 'configSchemaVersion', 'baseImages', 'artifacts', 'imageIds', 'signature'])
const BASE_IMAGE_FIELDS = new Set(['build', 'backendRuntime', 'frontendRuntime', 'keycloakBase', 'trivy', 'syft'])
const IMAGE_ID_FIELDS = new Set(['backend', 'frontend', 'keycloak'])
const ARTIFACT_FIELDS = new Set([
  'backendImage', 'frontendImage', 'keycloakImage', 'backendSbom', 'frontendSbom', 'keycloakSbom',
  'backendVulnerabilityReport', 'frontendVulnerabilityReport', 'keycloakVulnerabilityReport',
  'backendLicenseInventory', 'frontendLicenseInventory', 'keycloakLicenseInventory', 'keycloakLicenseText',
  'keycloakLicensePaths', 'keycloakLicenseReconciliation', 'keycloakLicenseBundle', 'backendNotices',
  'frontendNotices', 'keycloakImageManifest', 'keycloakContentGuard', 'backendImageLicenseReconciliation',
  'frontendImageLicenseReconciliation', 'backendImageNotices', 'frontendImageNotices', 'baseLicenseEvidenceBundle',
])
const ARTIFACT_MANIFEST_FIELDS = new Set(['path', 'sha256', 'bytes'])
const SIGNATURE_FIELDS = new Set(['algorithm', 'encoding', 'keyFingerprintSha256', 'value'])
const SENSITIVE_FIELD_PARTS = ['secret', 'token', 'password', 'credential', 'private' + '.?' + 'key', 'host', 'url', 'uuid', 'business', 'payload', 'customer', 'company', 'email', 'phone', 'person']
const FORBIDDEN_FIELD = new RegExp(`(?:${SENSITIVE_FIELD_PARTS.join('|')})`, 'i')

function sortObject(value) {
  if (Array.isArray(value)) return value.map(sortObject)
  if (!value || typeof value !== 'object') return value
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, sortObject(value[key])]))
}
export function canonicalize(value) { return JSON.stringify(sortObject(value)) }
export function sha256File(pathname) {
  if (!existsSync(pathname) || !statSync(pathname).isFile()) throw new Error(`missing artifact: ${pathname}`)
  return createHash('sha256').update(readFileSync(pathname)).digest('hex')
}
function normalizePath(value) { return String(value).split(sep).join('/') }
function assertSafeRelativePath(value, label = 'path') {
  const normalized = normalizePath(value)
  if (!normalized || normalized.startsWith('/') || /^[A-Za-z]:\//.test(normalized)) throw new Error(`${label} must be relative`)
  const segments = normalized.split('/')
  if (segments.some((segment) => segment === '..' || segment === '.')) throw new Error(`${label} path contains traversal`)
  return normalized
}
function assertDigest(value, label) { if (typeof value !== 'string' || !DIGEST.test(value)) throw new Error(`${label} must be a sha256:<64 hex> digest`) }
function assertPinnedImage(value, label) { if (typeof value !== 'string' || !PINNED_IMAGE.test(value)) throw new Error(`${label} must include an immutable @sha256:<64 hex> digest`) }
function assertExactKeys(value, expected, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} object is required`)
  const actual = Object.keys(value); const unknown = actual.filter((key) => !expected.has(key)); const missing = [...expected].filter((key) => !actual.includes(key))
  if (unknown.length > 0) throw new Error(`unknown field in ${label}: ${unknown.sort().join(', ')}`)
  if (missing.length > 0) throw new Error(`missing required field in ${label}: ${missing.sort().join(', ')}`)
}
function assertBuildIdentity(input) {
  if (typeof input.sourceRevision !== 'string' || !SOURCE_REVISION.test(input.sourceRevision)) throw new Error('sourceRevision must be a 40-character Git SHA')
  if (typeof input.version !== 'string' || !SAFE_VERSION.test(input.version)) throw new Error('version must be a safe release identifier')
  if (typeof input.buildTimestamp !== 'string') throw new Error('buildTimestamp is required')
  const parsedTimestamp = new Date(input.buildTimestamp)
  if (Number.isNaN(parsedTimestamp.valueOf()) || parsedTimestamp.toISOString() !== input.buildTimestamp) throw new Error('buildTimestamp must be an exact UTC ISO-8601 timestamp')
  if (input.configSchemaVersion !== 1) throw new Error('configSchemaVersion must equal 1')
}
function inspectFields(value, path = '') {
  if (Array.isArray(value)) { value.forEach((entry, index) => inspectFields(entry, `${path}[${index}]`)); return }
  if (!value || typeof value !== 'object') return
  for (const [key, child] of Object.entries(value)) {
    const location = path ? `${path}.${key}` : key
    if (FORBIDDEN_FIELD.test(key)) throw new Error(`forbidden sensitive field: ${location}`)
    inspectFields(child, location)
  }
}
function collectImageIds(imageIds = {}) {
  assertExactKeys(imageIds, IMAGE_ID_FIELDS, 'imageIds'); const normalized = {}
  for (const [name, value] of Object.entries(imageIds).sort(([a], [b]) => a.localeCompare(b))) { assertDigest(value, `imageIds.${name}`); normalized[name] = value.toLowerCase() }
  return normalized
}
function publicKeyFingerprint(keyObject) { return createHash('sha256').update(keyObject.export({ type: 'spki', format: 'der' })).digest('hex') }
function trustedPublicKey(options) {
  if (typeof options.publicKeyPath !== 'string' || !options.publicKeyPath) throw new Error('public key is required for verification')
  try { return createPublicKey(readFileSync(options.publicKeyPath)) } catch { throw new Error('public key is invalid') }
}

export function verifyReleaseManifest(manifest, options = {}) {
  if (!manifest || typeof manifest !== 'object') throw new Error('manifest is required')
  assertExactKeys(manifest, TOP_LEVEL_MANIFEST_FIELDS, 'release manifest')
  inspectFields(manifest)
  if (manifest.dataClass !== 'synthetic') throw new Error('dataClass must be synthetic')
  assertBuildIdentity(manifest)
  assertExactKeys(manifest.baseImages, BASE_IMAGE_FIELDS, 'baseImages')
  for (const [name, digest] of Object.entries(manifest.baseImages)) assertPinnedImage(digest, `baseImages.${name}`)
  assertExactKeys(manifest.artifacts, ARTIFACT_FIELDS, 'artifacts')
  collectImageIds(manifest.imageIds)
  assertExactKeys(manifest.signature, SIGNATURE_FIELDS, 'signature')
  if (manifest.signature.algorithm !== 'Ed25519' || manifest.signature.encoding !== 'base64url') throw new Error('invalid Ed25519 signature envelope')
  if (!DIGEST_HEX.test(manifest.signature.keyFingerprintSha256)) throw new Error('invalid public key fingerprint')
  if (!/^[A-Za-z0-9_-]+$/.test(manifest.signature.value)) throw new Error('malformed signature')
  const publicKey = trustedPublicKey(options)
  if (publicKey.asymmetricKeyType !== 'ed25519') throw new Error('manifest verification key must be Ed25519')
  if (publicKeyFingerprint(publicKey) !== manifest.signature.keyFingerprintSha256.toLowerCase()) throw new Error('public key fingerprint mismatch')
  const { signature, ...unsigned } = manifest
  if (!verifySignatureValue(null, Buffer.from(canonicalize(unsigned)), publicKey, Buffer.from(signature.value, 'base64url'))) throw new Error('signature mismatch')
  const baseDir = realpathSync(options.baseDir ?? process.cwd())
  for (const [key, artifact] of Object.entries(manifest.artifacts)) {
    assertExactKeys(artifact, ARTIFACT_MANIFEST_FIELDS, `artifact ${key}`)
    const relativePath = assertSafeRelativePath(artifact.path, `artifact ${key}`); const absolute = join(baseDir, relativePath); const resolvedRelative = normalizePath(relative(baseDir, absolute))
    if (resolvedRelative !== relativePath || resolvedRelative.startsWith('../') || resolvedRelative === '..') throw new Error(`artifact path contains traversal: ${key}`)
    const realArtifact = realpathSync(absolute); const realRelative = normalizePath(relative(baseDir, realArtifact))
    if (realRelative.startsWith('../') || realRelative === '..' || isAbsolute(realRelative)) throw new Error(`artifact path escapes base directory: ${key}`)
    const digest = sha256File(realArtifact)
    if (digest !== String(artifact.sha256).toLowerCase()) throw new Error(`artifact digest mismatch: ${key}`)
    if (typeof artifact.bytes !== 'number' || artifact.bytes !== statSync(realArtifact).size) throw new Error(`artifact size mismatch: ${key}`)
  }
  return true
}

function cli(argv) {
  if (argv.shift() !== 'verify') throw new Error('mode must be verify')
  const options = {}
  while (argv.length) {
    const flag = argv.shift(); if (!argv.length) throw new Error('unknown or incomplete CLI argument')
    if (flag === '--input') options.inputPath = argv.shift()
    else if (flag === '--public-key') options.publicKeyPath = argv.shift()
    else if (flag === '--base-dir') options.baseDir = argv.shift()
    else throw new Error(`unknown argument: ${flag}`)
  }
  if (!options.inputPath || !options.publicKeyPath) throw new Error('verify requires input and public key')
  verifyReleaseManifest(JSON.parse(readFileSync(options.inputPath, 'utf8')), options)
  console.log('release manifest: verified')
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try { cli(process.argv.slice(2)) } catch (error) { console.error(`release manifest: ${error.message}`); process.exitCode = 1 }
}
