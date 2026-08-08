import { createHash, createPrivateKey, createPublicKey, sign, verify } from 'node:crypto'
import { existsSync, readFileSync, realpathSync, statSync } from 'node:fs'
import { basename, isAbsolute, join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const DIGEST = /^sha256:[0-9a-f]{64}$/i
const DIGEST_HEX = /^[0-9a-f]{64}$/i
const PINNED_IMAGE = /^\S+@sha256:[0-9a-f]{64}$/i
const FORBIDDEN_FIELD = /(?:secret|token|password|credential|private.?key|host|url|uuid|business|payload|customer|company|email|phone|person)/i
const SOURCE_REVISION = /^[0-9a-f]{40}$/i
const SAFE_VERSION = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/
const TOP_LEVEL_INPUT_FIELDS = new Set(['dataClass', 'sourceRevision', 'version', 'buildTimestamp', 'configSchemaVersion', 'baseImages', 'artifacts', 'imageIds'])
const TOP_LEVEL_MANIFEST_FIELDS = new Set([...TOP_LEVEL_INPUT_FIELDS, 'signature'])
const BASE_IMAGE_FIELDS = new Set(['build', 'backendRuntime', 'frontendRuntime', 'trivy', 'syft'])
const IMAGE_ID_FIELDS = new Set(['backend', 'frontend'])
const ARTIFACT_FIELDS = new Set([
  'backendImage',
  'frontendImage',
  'backendSbom',
  'frontendSbom',
  'backendVulnerabilityReport',
  'frontendVulnerabilityReport',
  'backendLicenseInventory',
  'frontendLicenseInventory',
  'backendNotices',
  'frontendNotices',
  'backendImageLicenseReconciliation',
  'frontendImageLicenseReconciliation',
  'backendImageNotices',
  'frontendImageNotices',
  'baseLicenseEvidenceBundle',
])
const ARTIFACT_MANIFEST_FIELDS = new Set(['path', 'sha256', 'bytes'])
const SIGNATURE_FIELDS = new Set(['algorithm', 'encoding', 'keyFingerprintSha256', 'value'])

function sortObject(value) {
  if (Array.isArray(value)) return value.map(sortObject)
  if (!value || typeof value !== 'object') return value
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, sortObject(value[key])]))
}

export function canonicalize(value) {
  return JSON.stringify(sortObject(value))
}

export function sha256File(pathname) {
  if (!existsSync(pathname) || !statSync(pathname).isFile()) throw new Error(`missing artifact: ${pathname}`)
  return createHash('sha256').update(readFileSync(pathname)).digest('hex')
}

function normalizePath(value) {
  return String(value).split(sep).join('/')
}

function assertSafeRelativePath(value, label = 'path') {
  const normalized = normalizePath(value)
  if (!normalized || normalized.startsWith('/') || /^[A-Za-z]:\//.test(normalized)) throw new Error(`${label} must be relative`)
  const segments = normalized.split('/')
  if (segments.some((segment) => segment === '..' || segment === '.')) throw new Error(`${label} path contains traversal`)
  return normalized
}

function assertDigest(value, label) {
  if (typeof value !== 'string' || !DIGEST.test(value)) throw new Error(`${label} must be a sha256:<64 hex> digest`)
}

function assertPinnedImage(value, label) {
  if (typeof value !== 'string' || !PINNED_IMAGE.test(value)) throw new Error(`${label} must include an immutable @sha256:<64 hex> digest`)
}

function assertExactKeys(value, expected, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} object is required`)
  const actual = Object.keys(value)
  const unknown = actual.filter((key) => !expected.has(key))
  const missing = [...expected].filter((key) => !actual.includes(key))
  if (unknown.length > 0) throw new Error(`unknown field in ${label}: ${unknown.sort().join(', ')}`)
  if (missing.length > 0) throw new Error(`missing required field in ${label}: ${missing.sort().join(', ')}`)
}

function assertBuildIdentity(input) {
  if (typeof input.sourceRevision !== 'string' || !SOURCE_REVISION.test(input.sourceRevision)) {
    throw new Error('sourceRevision must be a 40-character Git SHA')
  }
  if (typeof input.version !== 'string' || !SAFE_VERSION.test(input.version)) {
    throw new Error('version must be a safe release identifier')
  }
  if (typeof input.buildTimestamp !== 'string') throw new Error('buildTimestamp is required')
  const parsedTimestamp = new Date(input.buildTimestamp)
  if (Number.isNaN(parsedTimestamp.valueOf()) || parsedTimestamp.toISOString() !== input.buildTimestamp) {
    throw new Error('buildTimestamp must be an exact UTC ISO-8601 timestamp')
  }
  if (input.configSchemaVersion !== 1) throw new Error('configSchemaVersion must equal 1')
}

function inspectFields(value, path = '', options = {}) {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => inspectFields(entry, `${path}[${index}]`, options))
    return
  }
  if (!value || typeof value !== 'object') return
  for (const [key, child] of Object.entries(value)) {
    const location = path ? `${path}.${key}` : key
    if (FORBIDDEN_FIELD.test(key) && !options.allowedField?.(path, key)) throw new Error(`forbidden sensitive field: ${location}`)
    inspectFields(child, location, options)
  }
}

function artifactInputPath(value) {
  if (typeof value === 'string') return value
  if (value && typeof value === 'object' && typeof value.path === 'string') return value.path
  throw new Error('artifact entries must be file paths')
}

function artifactRelativeName(key, inputPath) {
  const normalized = normalizePath(inputPath)
  if (normalized.split('/').includes('..')) throw new Error(`artifact path contains traversal: ${key}`)
  const name = basename(normalized)
  if (!name || name === '.' || name === '..') throw new Error(`artifact path is invalid: ${key}`)
  return assertSafeRelativePath(name, `artifact ${key}`)
}

function collectArtifactEntries(artifacts) {
  assertExactKeys(artifacts, ARTIFACT_FIELDS, 'artifacts')
  const entries = Object.entries(artifacts).sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => {
    const inputPath = artifactInputPath(value)
    if (!isAbsolute(inputPath) && inputPath.split(/[\\/]/).includes('..')) throw new Error(`artifact path contains traversal: ${key}`)
    return {
      key,
      path: artifactRelativeName(key, inputPath),
      sha256: sha256File(inputPath),
      bytes: statSync(inputPath).size,
    }
  })
  const paths = entries.map((entry) => entry.path)
  if (new Set(paths).size !== paths.length) throw new Error('artifact paths must be unique')
  return entries
}

function collectImageIds(imageIds = {}) {
  assertExactKeys(imageIds, IMAGE_ID_FIELDS, 'imageIds')
  const normalized = {}
  for (const [name, value] of Object.entries(imageIds).sort(([a], [b]) => a.localeCompare(b))) {
    assertDigest(value, `imageIds.${name}`)
    normalized[name] = value.toLowerCase()
  }
  return normalized
}

function publicKeyFingerprint(keyObject) {
  const der = keyObject.export({ type: 'spki', format: 'der' })
  return createHash('sha256').update(der).digest('hex')
}

function trustedPublicKey(options) {
  if (options.publicKeyPath) return createPublicKey(readFileSync(options.publicKeyPath))
  if (options.publicKey) return createPublicKey(options.publicKey)
  throw new Error('public key is required for verification')
}

export function createReleaseManifest(input, options = {}) {
  if (!input || typeof input !== 'object') throw new Error('manifest input is required')
  assertExactKeys(input, TOP_LEVEL_INPUT_FIELDS, 'manifest input')
  inspectFields(input, '', {
    allowedField: (path, key) =>
      ['baseImages', 'artifacts', 'imageIds'].includes(path) && !FORBIDDEN_FIELD.test(key),
  })
  if (input.dataClass !== 'synthetic') throw new Error('dataClass must be synthetic')
  assertBuildIdentity(input)
  assertExactKeys(input.baseImages, BASE_IMAGE_FIELDS, 'baseImages')
  const baseImages = {}
  for (const [name, digest] of Object.entries(input.baseImages).sort(([a], [b]) => a.localeCompare(b))) {
    assertPinnedImage(digest, `baseImages.${name}`)
    baseImages[name] = digest.replace(/sha256:[0-9a-f]{64}$/i, (value) => value.toLowerCase())
  }
  const artifactEntries = collectArtifactEntries(input.artifacts)
  const imageIds = collectImageIds(input.imageIds)

  let privateKey
  let publicKey
  if (options.privateKeyPath) {
    privateKey = createPrivateKey(readFileSync(options.privateKeyPath))
    publicKey = createPublicKey(privateKey)
  } else if (options.privateKey) {
    privateKey = createPrivateKey(options.privateKey)
    publicKey = createPublicKey(privateKey)
  } else {
    throw new Error('private key is required for manifest signing')
  }
  if (privateKey.asymmetricKeyType !== 'ed25519' || publicKey.asymmetricKeyType !== 'ed25519') {
    throw new Error('manifest signing key must be Ed25519')
  }

  const unsigned = {
    dataClass: 'synthetic',
    sourceRevision: input.sourceRevision.toLowerCase(),
    version: input.version,
    buildTimestamp: input.buildTimestamp,
    configSchemaVersion: 1,
    baseImages,
    artifacts: Object.fromEntries(artifactEntries.map((entry) => [entry.key, { path: entry.path, sha256: entry.sha256, bytes: entry.bytes }])),
    imageIds,
  }
  const signature = sign(null, Buffer.from(canonicalize(unsigned)), privateKey).toString('base64url')
  return {
    ...unsigned,
    signature: {
      algorithm: 'Ed25519',
      encoding: 'base64url',
      keyFingerprintSha256: publicKeyFingerprint(publicKey),
      value: signature,
    },
  }
}

export function verifyReleaseManifest(manifest, options = {}) {
  if (!manifest || typeof manifest !== 'object') throw new Error('manifest is required')
  assertExactKeys(manifest, TOP_LEVEL_MANIFEST_FIELDS, 'release manifest')
  inspectFields(manifest, '', {
    allowedField: (path, key) =>
      ['baseImages', 'artifacts', 'imageIds', 'signature'].includes(path) && !FORBIDDEN_FIELD.test(key),
  })
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
  if (!verify(null, Buffer.from(canonicalize(unsigned)), publicKey, Buffer.from(signature.value, 'base64url'))) throw new Error('signature mismatch')

  const artifactEntries = Object.entries(manifest.artifacts)
  const baseDir = realpathSync(options.baseDir ?? process.cwd())
  for (const [key, artifact] of artifactEntries) {
    assertExactKeys(artifact, ARTIFACT_MANIFEST_FIELDS, `artifact ${key}`)
    const relativePath = assertSafeRelativePath(artifact.path, `artifact ${key}`)
    const absolute = join(baseDir, relativePath)
    const resolvedRelative = normalizePath(relative(baseDir, absolute))
    if (resolvedRelative !== relativePath || resolvedRelative.startsWith('../') || resolvedRelative === '..') throw new Error(`artifact path contains traversal: ${key}`)
    const realArtifact = realpathSync(absolute)
    const realRelative = normalizePath(relative(baseDir, realArtifact))
    if (realRelative.startsWith('../') || realRelative === '..' || isAbsolute(realRelative)) throw new Error(`artifact path escapes base directory: ${key}`)
    const digest = sha256File(realArtifact)
    if (digest !== String(artifact.sha256).toLowerCase()) throw new Error(`artifact digest mismatch: ${key}`)
    if (typeof artifact.bytes !== 'number' || artifact.bytes !== statSync(realArtifact).size) throw new Error(`artifact size mismatch: ${key}`)
  }
  return true
}

function parseArgs(argv) {
  const options = { mode: argv[0] }
  for (let index = 1; index < argv.length; index += 1) {
    const argument = argv[index]
    if (argument === '--input') options.inputPath = argv[++index]
    else if (argument === '--output') options.outputPath = argv[++index]
    else if (argument === '--private-key') options.privateKeyPath = argv[++index]
    else if (argument === '--public-key') options.publicKeyPath = argv[++index]
    else if (argument === '--base-dir') options.baseDir = argv[++index]
    else throw new Error(`Unknown argument: ${argument}`)
  }
  if (!['generate', 'verify'].includes(options.mode)) throw new Error('mode must be generate or verify')
  if (!options.inputPath) throw new Error('--input is required')
  if (options.mode === 'generate' && !options.outputPath) throw new Error('--output is required for generate')
  return options
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    const options = parseArgs(process.argv.slice(2))
    const input = JSON.parse(readFileSync(options.inputPath, 'utf8'))
    if (options.mode === 'generate') {
      const manifest = createReleaseManifest(input, options)
      const { writeFileSync } = await import('node:fs')
      writeFileSync(options.outputPath, `${JSON.stringify(manifest, null, 2)}\n`)
      console.log('release manifest: generated')
    } else {
      verifyReleaseManifest(input, options)
      console.log('release manifest: verified')
    }
  } catch (error) {
    console.error(`release manifest: ${error.message}`)
    process.exitCode = 1
  }
}
