import {
  chmodSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  realpathSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  REQUIRED_BUNDLE_PATHS,
  copyStable,
  readAndHashStable,
  validateBundleMetadata,
} from './onprem-offline-bundle.mjs'
import { inspectDockerSaveArchive } from './onprem-offline-archive.mjs'

const MAX_SOURCE_BYTES = 32 * 1024 * 1024
const HEX = /^[0-9a-f]{64}$/i
const PATH = /^[A-Za-z0-9._-]+(?:\/[A-Za-z0-9._-]+)*$/
const PHOTO_COMPOSE_BIND_SOURCE = Buffer.from('      - ../photo-storage/bootstrap.sh:/opt/hr-axis/photo-storage/bootstrap.sh:ro')
const PHOTO_COMPOSE_BIND_STAGED = Buffer.from('      - ./photo-storage/bootstrap.sh:/opt/hr-axis/photo-storage/bootstrap.sh:ro')
const PHOTO_COMPOSE_BIND_TARGET = Buffer.from(':/opt/hr-axis/photo-storage/bootstrap.sh:')
const STAGE_FILES = Object.freeze([
  ['deployment/compose.yaml', 'infra/onprem/core/compose.yaml'],
  ['deployment/compose.photo-proof.yaml', 'infra/onprem/core/compose.photo-proof.yaml'],
  ['deployment/photo-compose.yaml', 'infra/onprem/photo-storage/compose.yaml'],
  ['deployment/proof.compose.yaml', 'infra/onprem/offline/proof.compose.yaml'],
  ['deployment/restore.compose.yaml', 'infra/onprem/offline/restore.compose.yaml'],
  ['deployment/templates/core.env.template', 'infra/onprem/core/env.template'],
  ['deployment/templates/photo.env.template', 'infra/onprem/photo-storage/env.template'],
  ['deployment/caddy/Caddyfile', 'infra/onprem/core/caddy/Caddyfile'],
  ['deployment/keycloak/bootstrap.sh', 'infra/onprem/core/keycloak/bootstrap.sh'],
  ['deployment/keycloak/realm-config.json', 'infra/onprem/core/keycloak/realm-config.json'],
  ['deployment/postgres/entrypoint-tls.sh', 'infra/onprem/core/postgres/entrypoint-tls.sh'],
  ['deployment/postgres/010-bootstrap-roles.sh', 'infra/onprem/core/postgres/010-bootstrap-roles.sh'],
  ['deployment/redis/redis.conf', 'infra/onprem/core/redis/redis.conf'],
  ['deployment/photo-storage/bootstrap.sh', 'infra/onprem/photo-storage/bootstrap.sh'],
  ['deployment/photo-storage/LICENSE', 'infra/onprem/photo-storage/LICENSE'],
])
const OPERATION_SHELLS = Object.freeze(['preflight.sh', 'install.sh', 'migrate.sh', 'activate.sh', 'smoke.sh', 'backup.sh', 'restore.sh', 'upgrade.sh', 'rollback.sh'])
const OPERATION_RUNTIME = Object.freeze([
  ['onprem-offline-bundle.mjs', 'scripts/onprem-offline-bundle-verify.mjs'],
  ['onprem-offline-archive.mjs', 'scripts/onprem-offline-archive.mjs'],
  ['onprem-offline-content-guard-index.mjs', 'scripts/onprem-offline-content-guard-index-verify.mjs'],
  ['onprem-release-manifest.mjs', 'scripts/onprem-release-manifest-verify.mjs'],
  ['onprem-keycloak-auth-proof.mjs', 'scripts/onprem-keycloak-auth-proof.mjs'],
  ['onprem-photo-auth-proof.mjs', 'scripts/onprem-photo-auth-proof.mjs'],
  ['onprem-offline-target-proof.mjs', 'scripts/onprem-offline-target-proof.mjs'],
  ['onprem-postgres-vulnerability-exception.mjs', 'scripts/onprem-postgres-vulnerability-exception.mjs'],
])
const DOC_FILES = Object.freeze([
  ['docs/runbooks/onprem-offline-install-v1.md', 'docs/runbooks/onprem-offline-install-v1.md'],
  ['docs/runbooks/onprem-offline-backup-restore-v1.md', 'docs/runbooks/onprem-offline-backup-restore-v1.md'],
  ['docs/licenses/seaweedfs-LICENSE.txt', 'infra/onprem/photo-storage/LICENSE'],
  ['docs/security/postgres-gosu.trivyignore.yaml', 'infra/onprem/offline/postgres-gosu.trivyignore.yaml'],
])
const PROOF_LICENSE_FILES = Object.freeze([
  ['docs/licenses/backend-THIRD_PARTY_NOTICES.txt', 'backend-image-THIRD_PARTY_NOTICES.txt'],
  ['docs/licenses/frontend-THIRD_PARTY_NOTICES.txt', 'frontend-image-THIRD_PARTY_NOTICES.txt'],
  ['docs/licenses/keycloak-LICENSE.txt', 'keycloak-LICENSE.txt'],
])
const IMAGE_NAMES = Object.freeze([...Object.keys(REQUIRED_BUNDLE_PATHS.imageArchives)])
const EVIDENCE_NAMES = Object.freeze([...REQUIRED_BUNDLE_PATHS.evidence.map((value) => value.slice('evidence/'.length))])
const EXECUTABLES = new Set([
  'deployment/keycloak/bootstrap.sh', 'deployment/postgres/entrypoint-tls.sh',
  'deployment/postgres/010-bootstrap-roles.sh', 'deployment/photo-storage/bootstrap.sh',
  ...OPERATION_SHELLS.map((name) => `operations/${name}`),
])
const SOURCE_ROOT_ALLOWLIST = new Set([
  'infra/onprem/core/compose.yaml', 'infra/onprem/core/compose.photo-proof.yaml', 'infra/onprem/core/env.template', 'infra/onprem/core/README.md',
  'infra/onprem/core/caddy/Caddyfile', 'infra/onprem/core/keycloak/bootstrap.sh',
  'infra/onprem/core/keycloak/README.md', 'infra/onprem/core/keycloak/realm-config.json',
  'infra/onprem/core/postgres/entrypoint-tls.sh', 'infra/onprem/core/postgres/010-bootstrap-roles.sh',
  'infra/onprem/core/redis/redis.conf',
  'infra/onprem/photo-storage/bootstrap.sh', 'infra/onprem/photo-storage/compose.proof.yaml',
  'infra/onprem/photo-storage/compose.yaml', 'infra/onprem/photo-storage/env.template',
  'infra/onprem/photo-storage/LICENSE', 'infra/onprem/photo-storage/README.md',
  'infra/onprem/offline/proof.compose.yaml', 'infra/onprem/offline/restore.compose.yaml',
  'infra/onprem/offline/postgres-gosu.trivyignore.yaml',
  ...OPERATION_SHELLS.map((name) => `infra/onprem/offline/operations/${name}`),
])

export class OfflineStageError extends Error {}
function fail(message) { throw new OfflineStageError(message) }
function object(value) { return value !== null && typeof value === 'object' && !Array.isArray(value) }
function portable(value, label) {
  if (typeof value !== 'string' || !value || value.includes('\\') || value.includes('\0') || value.startsWith('/') || /^[A-Za-z]:/.test(value) || !PATH.test(value) || value.split('/').some((part) => part === '.' || part === '..')) fail(`${label} must be a portable relative path`)
  return value
}
function contained(base, candidate) {
  const child = relative(base, candidate)
  return child === '' || (child !== '..' && !child.startsWith(`..${sep}`) && !isAbsolute(child))
}
function rootPath(value, label) {
  if (typeof value !== 'string' || !value) fail(`${label} is required`)
  let resolved
  try { resolved = realpathSync(value) } catch { fail(`${label} cannot be resolved`) }
  let stats
  try { stats = lstatSync(resolved) } catch { fail(`${label} cannot be read`) }
  if (!stats.isDirectory() || stats.isSymbolicLink()) fail(`${label} must be a regular directory`)
  return resolved
}
function outputPath(value, repoRoot, proofRoot) {
  if (typeof value !== 'string' || !value || !isAbsolute(value)) fail('output-dir must be an absolute path')
  const target = resolve(value)
  if (existsSync(target)) fail('output-dir must be absent')
  let parent
  try { parent = realpathSync(dirname(target)) } catch { fail('output-dir parent cannot be resolved') }
  const canonical = join(parent, target.split(sep).at(-1))
  if (contained(repoRoot, canonical) || contained(proofRoot, canonical)) fail('output-dir must be outside repo-root and proof-dir')
  return { target, parent }
}
function sourcePath(repoRoot, relativePath, label) {
  const safe = portable(relativePath, label)
  const pathname = join(repoRoot, ...safe.split('/'))
  if (!contained(repoRoot, pathname)) fail(`${label} escapes repo-root`)
  return pathname
}
function proofPath(proofRoot, relativePath, label) {
  const safe = portable(relativePath, label)
  const pathname = join(proofRoot, ...safe.split('/'))
  if (!contained(proofRoot, pathname)) fail(`${label} escapes proof-dir`)
  return pathname
}
function candidate(proofRoot, names, label) {
  for (const name of names) {
    const pathname = proofPath(proofRoot, name, label)
    if (existsSync(pathname)) return pathname
  }
  fail(`${label} is missing from proof-dir`)
}
function metadataValue(metadata, name) {
  if (metadata?.[name] !== undefined) return metadata[name]
  if (metadata?.bundle?.[name] !== undefined) return metadata.bundle[name]
  return undefined
}
function parseMetadata(value) {
  let metadata
  try { metadata = typeof value === 'string' ? JSON.parse(readFileSync(value, 'utf8')) : value } catch { fail('metadata must be valid JSON') }
  if (!object(metadata)) fail('metadata object is required')
  const candidateMetadata = object(metadata.bundle) && metadata.schemaVersion === undefined ? metadata.bundle : metadata
  try { return validateBundleMetadata(candidateMetadata) } catch (error) { fail(error?.message ?? 'metadata is invalid') }
}
function imageProofCandidates(name) {
  return [`images/${name}.tar`, `${name}.tar`, `${name}-image.tar`, `${name}-component-image.tar`]
}
function evidenceProofCandidates(name) {
  return [`evidence/${name}`, name]
}
function stageOne(source, destination, mode, label, scanAssignments = true) {
  const observed = readAndHashStable(source, MAX_SOURCE_BYTES, label, { scan: true, scanAssignments, relativePath: label })
  mkdirSync(dirname(destination), { recursive: true })
  copyStable(source, destination, observed.bytes, observed.sha256, mode, observed.identity)
  return { path: label, bytes: observed.bytes, sha256: observed.sha256 }
}
function countBytes(value, needle) {
  let count = 0
  let offset = 0
  while ((offset = value.indexOf(needle, offset)) !== -1) {
    count += 1
    offset += needle.length
  }
  return count
}
function stagePhotoCompose(source, destination, label) {
  stageOne(source, destination, 0o644, label)
  const original = readFileSync(destination)
  if (countBytes(original, PHOTO_COMPOSE_BIND_TARGET) !== 1 || countBytes(original, PHOTO_COMPOSE_BIND_SOURCE) !== 1 || countBytes(original, PHOTO_COMPOSE_BIND_STAGED) !== 0) {
    fail(`${label} must contain exactly one canonical photo-storage bootstrap bind`)
  }
  const offset = original.indexOf(PHOTO_COMPOSE_BIND_SOURCE)
  const transformed = Buffer.concat([
    original.subarray(0, offset),
    PHOTO_COMPOSE_BIND_STAGED,
    original.subarray(offset + PHOTO_COMPOSE_BIND_SOURCE.length),
  ])
  writeFileSync(destination, transformed)
  if (countBytes(transformed, PHOTO_COMPOSE_BIND_TARGET) !== 1 || countBytes(transformed, PHOTO_COMPOSE_BIND_SOURCE) !== 0 || countBytes(transformed, PHOTO_COMPOSE_BIND_STAGED) !== 1) {
    fail(`${label} staged photo-storage bootstrap bind is invalid`)
  }
  const copied = readAndHashStable(destination, MAX_SOURCE_BYTES, label, { scan: true, relativePath: label })
  return { path: label, bytes: copied.bytes, sha256: copied.sha256 }
}
function stageImage(source, destination, expected, label) {
  let archive
  try { archive = inspectDockerSaveArchive(source, { imageId: expected?.configImageId }) } catch (error) { fail(`${label} is not a valid Docker image archive: ${error?.message ?? 'invalid archive'}`) }
  if (!expected || archive.repoTag !== expected.repoTag || archive.imageId !== expected.configImageId || archive.archiveSha256 !== expected.archiveSha256) fail(`${label} archive identity does not match metadata`)
  mkdirSync(dirname(destination), { recursive: true })
  copyStable(source, destination, archive.archiveIdentity.size, archive.archiveSha256, 0o644, archive.archiveIdentity, { skipDestinationVerify: true })
  return { path: label, bytes: archive.archiveIdentity.size, sha256: archive.archiveSha256 }
}
function validateNoSecretPath(pathname, label) {
  const folded = pathname.toLowerCase()
  if (folded.includes('secret') || folded.includes('credential') || folded.includes('private-key') || folded.includes('id_rsa')) fail(`${label} cannot stage secret material`)
}
function inspectSourceTree(repoRoot, sourceRoot) {
  const root = sourcePath(repoRoot, sourceRoot, sourceRoot)
  const walk = (directory, prefix) => {
    let entries
    try { entries = readdirSync(directory, { withFileTypes: true }) } catch { fail(`source tree ${sourceRoot} cannot be read`) }
    for (const entry of entries) {
      const relativePath = `${prefix}/${entry.name}`
      const absolute = join(repoRoot, ...relativePath.split('/'))
      let stats
      try { stats = lstatSync(absolute) } catch { fail(`source tree entry is missing: ${relativePath}`) }
      if (stats.isSymbolicLink() || stats.isBlockDevice() || stats.isCharacterDevice() || stats.isFIFO() || stats.isSocket() || (!entry.isDirectory() && stats.nlink !== 1)) fail(`source tree entry is unsafe: ${relativePath}`)
      if (entry.isDirectory()) walk(absolute, relativePath)
      else if (!SOURCE_ROOT_ALLOWLIST.has(relativePath)) fail(`source tree contains an unapproved extra: ${relativePath}`)
    }
  }
  walk(root, sourceRoot)
}

/** Build an exact source-free staging directory. The output is intentionally not a bundle. */
export function stageOffline(options = {}) {
  const repoRoot = rootPath(options.repoRoot, 'repo-root')
  const proofRoot = rootPath(options.proofDir, 'proof-dir')
  if (contained(repoRoot, proofRoot) || contained(proofRoot, repoRoot)) fail('repo-root and proof-dir must be separate')
  const output = outputPath(options.outputDir, repoRoot, proofRoot)
  const metadata = parseMetadata(options.metadata)
  inspectSourceTree(repoRoot, 'infra/onprem/core')
  inspectSourceTree(repoRoot, 'infra/onprem/photo-storage')
  inspectSourceTree(repoRoot, 'infra/onprem/offline')
  const staged = []
  const temp = mkdtempSync(join(output.parent, `.${output.target.split(sep).at(-1)}.tmp-`))
  try {
    for (const [destination, sourceRelative] of STAGE_FILES) {
      const source = sourcePath(repoRoot, sourceRelative, destination)
      validateNoSecretPath(sourceRelative, destination)
      const destinationPath = join(temp, ...destination.split('/'))
      staged.push(destination === 'deployment/photo-compose.yaml'
        ? stagePhotoCompose(source, destinationPath, destination)
        : stageOne(source, destinationPath, EXECUTABLES.has(destination) ? 0o755 : 0o644, destination))
    }
    for (const name of OPERATION_SHELLS) {
      const destination = `operations/${name}`
      const source = sourcePath(repoRoot, `infra/onprem/offline/operations/${name}`, destination)
      staged.push(stageOne(source, join(temp, ...destination.split('/')), 0o755, destination))
    }
    for (const [name, sourceRelative] of OPERATION_RUNTIME) {
      const destination = `operations/${name}`
      const source = sourcePath(repoRoot, sourceRelative, destination)
      staged.push(stageOne(source, join(temp, ...destination.split('/')), 0o755, destination))
    }
    for (const [destination, sourceRelative] of DOC_FILES) {
      const source = sourcePath(repoRoot, sourceRelative, destination)
      staged.push(stageOne(source, join(temp, ...destination.split('/')), 0o644, destination))
    }
    for (const [destination, proofRelative] of PROOF_LICENSE_FILES) {
      const source = candidate(proofRoot, [proofRelative], destination)
      staged.push(stageOne(source, join(temp, ...destination.split('/')), 0o644, destination))
    }
    for (const name of IMAGE_NAMES) {
      const destination = REQUIRED_BUNDLE_PATHS.imageArchives[name]
      const source = candidate(proofRoot, imageProofCandidates(name), destination)
      staged.push(stageImage(source, join(temp, ...destination.split('/')), metadata.images[name], destination))
    }
    for (const name of EVIDENCE_NAMES) {
      const destination = `evidence/${name}`
      const source = candidate(proofRoot, evidenceProofCandidates(name), destination)
      staged.push(stageOne(source, join(temp, ...destination.split('/')), 0o644, destination))
    }
    const expected = new Set([
      ...Object.values(REQUIRED_BUNDLE_PATHS.imageArchives), ...REQUIRED_BUNDLE_PATHS.deployment,
      ...REQUIRED_BUNDLE_PATHS.operations, ...REQUIRED_BUNDLE_PATHS.evidence, ...REQUIRED_BUNDLE_PATHS.docs,
    ])
    if (staged.length !== expected.size || staged.some((entry) => !expected.has(entry.path))) fail('staging closure does not match the approved allowlist')
    chmodSync(temp, 0o755)
    if (existsSync(output.target)) fail('output-dir appeared during staging')
    renameSync(temp, output.target)
    return { outputDir: output.target, releaseId: metadata.releaseId, sourceRevision: metadata.sourceRevision, files: staged.sort((a, b) => a.path.localeCompare(b.path)) }
  } catch (error) {
    try { rmSync(temp, { recursive: true, force: true }) } catch { /* preserve safe error */ }
    if (error instanceof OfflineStageError) throw error
    throw new OfflineStageError(error?.message ?? 'offline staging failed')
  }
}

function cli(argv) {
  const options = {}
  const names = { '--repo-root': 'repoRoot', '--proof-dir': 'proofDir', '--output-dir': 'outputDir', '--metadata': 'metadata' }
  while (argv.length) {
    const flag = argv.shift(); const key = names[flag]
    if (!key || !argv.length) fail('unknown or incomplete CLI argument')
    options[key] = argv.shift()
  }
  for (const key of ['repoRoot', 'proofDir', 'outputDir', 'metadata']) if (!options[key]) fail(`--${key.replace(/[A-Z]/g, (value) => `-${value.toLowerCase()}`)} is required`)
  const result = stageOffline(options)
  console.log(`offline staging: ${result.outputDir}`)
}
function safeError(error) { return error instanceof OfflineStageError ? error.message : 'offline staging failed' }
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try { cli(process.argv.slice(2)) } catch (error) { console.error(`offline staging: ${safeError(error)}`); process.exitCode = 1 }
}
