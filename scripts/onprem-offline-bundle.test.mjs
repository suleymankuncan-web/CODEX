import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { createHash, generateKeyPairSync } from 'node:crypto'
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  renameSync,
  readFileSync,
  rmSync,
  symlinkSync,
  utimesSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

import { createReleaseManifest } from './onprem-release-manifest.mjs'
import { createContentGuardIndex } from './onprem-offline-content-guard-index.mjs'
import { REQUIRED_BUNDLE_PATHS, copyStable, createOfflineBundle, inventory, validateBundleMetadata, validateOfflineJsonContent, validateOfflineTextContent, verifyOfflineBundle } from './onprem-offline-bundle.mjs'
import { REQUIRED_BUNDLE_PATHS as VERIFY_REQUIRED_BUNDLE_PATHS } from './onprem-offline-bundle-verify.mjs'

const REVISION = '0123456789abcdef0123456789abcdef01234567'
const CREATED_AT = '2026-08-13T12:00:00.000Z'
const ALL_REQUIRED = [
  ...Object.values(REQUIRED_BUNDLE_PATHS.imageArchives), ...REQUIRED_BUNDLE_PATHS.deployment,
  ...REQUIRED_BUNDLE_PATHS.operations, ...REQUIRED_BUNDLE_PATHS.evidence, ...REQUIRED_BUNDLE_PATHS.docs,
]

test('bundle closure reserves the exact PR-B photo-proof deployment overlay', () => {
  assert.ok(REQUIRED_BUNDLE_PATHS.deployment.includes('deployment/compose.photo-proof.yaml'))
  assert.ok(REQUIRED_BUNDLE_PATHS.deployment.includes('deployment/proof.compose.yaml'))
})

test('producer and self-contained verifier use the exact same signed closure', () => {
  assert.deepEqual(VERIFY_REQUIRED_BUNDLE_PATHS, REQUIRED_BUNDLE_PATHS)
  assert.deepEqual(
    REQUIRED_BUNDLE_PATHS.docs.filter((pathname) => pathname.startsWith('docs/licenses/')),
    [
      'docs/licenses/backend-THIRD_PARTY_NOTICES.txt',
      'docs/licenses/frontend-THIRD_PARTY_NOTICES.txt',
      'docs/licenses/keycloak-LICENSE.txt',
      'docs/licenses/seaweedfs-LICENSE.txt',
    ],
  )
})

test('proof overlay removes host-published ports without changing topology', async () => {
  const { readFile } = await import('node:fs/promises')
  const overlay = await readFile(new URL('../infra/onprem/offline/proof.compose.yaml', import.meta.url), 'utf8')
  assert.match(overlay, /caddy:\s*[\s\S]*ports:\s*!override\s*\[\]/)
  assert.match(overlay, /object-storage:\s*[\s\S]*ports:\s*!override\s*\[\]/)
  assert.doesNotMatch(overlay, /^\s*(?:volumes|networks):/m)
})
const EXECUTABLES = new Set([
  'operations/preflight.sh', 'operations/install.sh', 'operations/migrate.sh', 'operations/activate.sh', 'operations/smoke.sh',
  'operations/backup.sh', 'operations/restore.sh', 'operations/upgrade.sh', 'operations/rollback.sh',
  'operations/onprem-offline-bundle.mjs', 'operations/onprem-offline-archive.mjs',
  'operations/onprem-offline-content-guard-index.mjs', 'operations/onprem-release-manifest.mjs',
  'operations/onprem-keycloak-auth-proof.mjs', 'operations/onprem-photo-auth-proof.mjs', 'operations/onprem-offline-target-proof.mjs',
  'deployment/keycloak/bootstrap.sh', 'deployment/postgres/entrypoint-tls.sh',
  'deployment/postgres/010-bootstrap-roles.sh', 'deployment/photo-storage/bootstrap.sh',
])

function tarHeader(name, size, mode = 0o644, type = '0') {
  const header = Buffer.alloc(512)
  header.write(name, 0, 100, 'ascii')
  header.write(`${mode.toString(8).padStart(7, '0')}\0`, 100, 8, 'ascii')
  header.write('0000000\0', 108, 8, 'ascii'); header.write('0000000\0', 116, 8, 'ascii')
  header.write(`${size.toString(8).padStart(11, '0')}\0`, 124, 12, 'ascii'); header.write('00000000000\0', 136, 12, 'ascii')
  header.write('        ', 148, 8, 'ascii'); header.write(type, 156, 1, 'ascii'); header.write('ustar\0', 257, 6, 'ascii'); header.write('00', 263, 2, 'ascii')
  let checksum = 0; for (const byte of header) checksum += byte
  header.write(`${checksum.toString(8).padStart(6, '0')}\0 `, 148, 8, 'ascii')
  return header
}

function dockerSaveArchive(configBytes, repository) {
  const imageId = createHash('sha256').update(configBytes).digest('hex')
  const configName = `${imageId}.json`
  const manifestBytes = Buffer.from(JSON.stringify([{ Config: configName, RepoTags: [`${repository}:synthetic`], Layers: [] }]))
  const blocks = []
  for (const [name, payload] of [['manifest.json', manifestBytes], [configName, configBytes]]) {
    blocks.push(tarHeader(name, payload.length), payload, Buffer.alloc((512 - (payload.length % 512)) % 512))
  }
  blocks.push(Buffer.alloc(1024))
  return { bytes: Buffer.concat(blocks), imageId: `sha256:${imageId}` }
}

function writeFile(root, relativePath, content, mode = 0o644) {
  const pathname = join(root, ...relativePath.split('/'))
  mkdirSync(join(pathname, '..'), { recursive: true })
  writeFileSync(pathname, content, { mode })
  if (process.platform !== 'win32') chmodSync(pathname, mode)
  return pathname
}

function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'onprem-offline-v2-'))
  const releaseId = 'onprem-2026.08.13'
  const stagingDir = join(root, 'staging'); mkdirSync(stagingDir)
  const keys = generateKeyPairSync('ed25519'); const wrong = generateKeyPairSync('ed25519')
  const privateKeyPath = join(root, 'owner-private.pem'); const publicKeyPath = join(root, 'owner-public.pem'); const wrongPublicKeyPath = join(root, 'wrong-public.pem')
  writeFileSync(privateKeyPath, keys.privateKey.export({ type: 'pkcs8', format: 'pem' })); writeFileSync(publicKeyPath, keys.publicKey.export({ type: 'spki', format: 'pem' })); writeFileSync(wrongPublicKeyPath, wrong.publicKey.export({ type: 'spki', format: 'pem' }))
  const images = {}
  for (const [name, archive] of Object.entries(REQUIRED_BUNDLE_PATHS.imageArchives)) {
    const configBytes = Buffer.from(JSON.stringify({ architecture: 'amd64', os: 'linux', synthetic: name }))
    const archiveValue = dockerSaveArchive(configBytes, `registry.example/${name}`)
    writeFile(stagingDir, archive, archiveValue.bytes)
    images[name] = { name, archive, repoTag: `registry.example/${name}:synthetic`, configImageId: archiveValue.imageId, archiveSha256: createHash('sha256').update(archiveValue.bytes).digest('hex'), registryDigestAttestedByOwner: true, registryManifestDigest: `sha256:${'b'.repeat(64)}` }
  }
  for (const path of [...REQUIRED_BUNDLE_PATHS.deployment, ...REQUIRED_BUNDLE_PATHS.operations, ...REQUIRED_BUNDLE_PATHS.evidence, ...REQUIRED_BUNDLE_PATHS.docs]) {
    const mode = EXECUTABLES.has(path) ? 0o755 : 0o644
    const guard = /content-guard\.json$/.test(path)
    const content = path === 'evidence/migration-compatibility.json'
      ? JSON.stringify({ schemaVersion: 1, releaseId, migrationTreeDigest: 'a'.repeat(64), compatibleFrom: [], upgradeCompatible: true, rollbackCompatible: true })
      : guard
      ? JSON.stringify({ ok: true, violations: [] })
      : (path === 'evidence/release-manifest.json' ? '{}' : (/\.json$/i.test(path) ? JSON.stringify({ synthetic: path }) : `synthetic:${path}\n`))
    writeFile(stagingDir, path, content, mode)
  }

  const upstreamBaseDir = join(root, 'upstream'); mkdirSync(upstreamBaseDir)
  const upstreamKeys = generateKeyPairSync('ed25519'); const upstreamPrivatePath = join(root, 'upstream-private.pem'); const upstreamPublicPath = join(root, 'upstream-public.pem')
  writeFileSync(upstreamPrivatePath, upstreamKeys.privateKey.export({ type: 'pkcs8', format: 'pem' })); writeFileSync(upstreamPublicPath, upstreamKeys.publicKey.export({ type: 'spki', format: 'pem' }))
  const artifactNames = ['backendImage', 'frontendImage', 'keycloakImage', 'backendSbom', 'frontendSbom', 'keycloakSbom', 'backendVulnerabilityReport', 'frontendVulnerabilityReport', 'keycloakVulnerabilityReport', 'backendLicenseInventory', 'frontendLicenseInventory', 'keycloakLicenseInventory', 'keycloakLicenseText', 'keycloakLicensePaths', 'keycloakLicenseReconciliation', 'keycloakLicenseBundle', 'backendNotices', 'frontendNotices', 'keycloakImageManifest', 'keycloakContentGuard', 'backendImageLicenseReconciliation', 'frontendImageLicenseReconciliation', 'backendImageNotices', 'frontendImageNotices', 'baseLicenseEvidenceBundle']
  const artifactPaths = {}
  for (const name of artifactNames) {
    const imageName = name.replace(/Image$/, '')
    artifactPaths[name] = join(upstreamBaseDir, ['backend', 'frontend', 'keycloak'].includes(imageName) && name.endsWith('Image') ? `${imageName}-image.tar` : `${name}.json`)
    writeFileSync(artifactPaths[name], `${name}:synthetic\n`)
  }
  for (const name of ['backendImage', 'frontendImage', 'keycloakImage']) { const imageName = name.replace(/Image$/, ''); writeFileSync(artifactPaths[name], readFileSync(join(stagingDir, ...images[imageName].archive.split('/')))) }
  const upstreamInput = {
    dataClass: 'synthetic', sourceRevision: REVISION, version: 'upstream-1.0.0', buildTimestamp: CREATED_AT, configSchemaVersion: 1,
    baseImages: { build: 'node:24@sha256:' + '1'.repeat(64), backendRuntime: 'node:24@sha256:' + '2'.repeat(64), frontendRuntime: 'nginx:1@sha256:' + '3'.repeat(64), keycloakBase: 'keycloak:1@sha256:' + '4'.repeat(64), trivy: 'trivy:1@sha256:' + '5'.repeat(64), syft: 'syft:1@sha256:' + '6'.repeat(64) },
    artifacts: artifactPaths, imageIds: { backend: images.backend.configImageId, frontend: images.frontend.configImageId, keycloak: images.keycloak.configImageId },
  }
  const upstreamManifest = createReleaseManifest(upstreamInput, { privateKeyPath: upstreamPrivatePath })
  writeFile(stagingDir, 'evidence/release-manifest.json', `${JSON.stringify(upstreamManifest, null, 2)}\n`)
  const guardKeys = generateKeyPairSync('ed25519'); const guardPrivatePath = join(root, 'content-guard-private.pem'); const guardPublicPath = join(root, 'content-guard-public.pem')
  writeFileSync(guardPrivatePath, guardKeys.privateKey.export({ type: 'pkcs8', format: 'pem' })); writeFileSync(guardPublicPath, guardKeys.publicKey.export({ type: 'spki', format: 'pem' }))
  const guardArtifacts = {}
  for (const name of ['backend', 'frontend', 'keycloak']) {
    const artifactPath = join(upstreamBaseDir, `${name}-content-guard.json`)
    writeFileSync(artifactPath, JSON.stringify({ ok: true, violations: [] }))
  }
  const guardIndex = createContentGuardIndex({ baseDir: upstreamBaseDir, images: Object.fromEntries(['backend', 'frontend', 'keycloak'].map((name) => [name, { imageId: images[name].configImageId, archivePath: `${name}-image.tar`, finalRootfsPath: `${name}-content-guard.json` }])), privateKeyPath: guardPrivatePath })
  const contentGuardIndexPath = join(root, 'content-guard-index.json'); writeFileSync(contentGuardIndexPath, `${JSON.stringify(guardIndex, null, 2)}\n`)
  writeFile(stagingDir, 'evidence/content-guard-index.json', `${JSON.stringify(guardIndex, null, 2)}\n`)
  const input = { schemaVersion: 1, configSchemaVersion: 1, dataClass: 'synthetic', releaseId, sourceRevision: REVISION, createdAt: CREATED_AT, images }
  const trustedKeyFingerprintSha256 = createHash('sha256').update(keys.publicKey.export({ type: 'spki', format: 'der' })).digest('hex')
  const upstreamTrustedKeyFingerprintSha256 = createHash('sha256').update(upstreamKeys.publicKey.export({ type: 'spki', format: 'der' })).digest('hex')
  const contentGuardTrustedKeyFingerprintSha256 = guardArtifacts && guardIndex.signature.keyFingerprintSha256
  return { root, stagingDir, outputDir: join(root, 'bundle'), privateKeyPath, publicKeyPath, wrongPublicKeyPath, trustedKeyFingerprintSha256, upstreamTrustedKeyFingerprintSha256, upstreamManifestPath: join(root, 'upstream-release-manifest.json'), upstreamPublicPath, upstreamBaseDir, contentGuardIndexPath, contentGuardPublicPath: guardPublicPath, contentGuardTrustedKeyFingerprintSha256, input, images, upstreamManifest }
}

function options(value, outputDir = value.outputDir) {
  return { input: value.input, stagingDir: value.stagingDir, outputDir, privateKeyPath: value.privateKeyPath, trustedPublicKeyPath: value.publicKeyPath, trustedKeyFingerprintSha256: value.trustedKeyFingerprintSha256, upstreamReleaseManifestPath: value.upstreamManifestPath, upstreamReleasePublicKeyPath: value.upstreamPublicPath, upstreamTrustedKeyFingerprintSha256: value.upstreamTrustedKeyFingerprintSha256, upstreamReleaseBaseDir: value.upstreamBaseDir, contentGuardIndexPath: value.contentGuardIndexPath, contentGuardPublicKeyPath: value.contentGuardPublicPath, contentGuardTrustedKeyFingerprintSha256: value.contentGuardTrustedKeyFingerprintSha256 }
}
function cleanup(value) { rmSync(value.root, { recursive: true, force: true }) }

test('creates deterministic signed source-free bundle and verifies with external trust anchor', (t) => {
  if (process.platform === 'win32') return t.skip('create is Linux/WSL-only')
  const value = fixture()
  try {
    writeFileSync(value.upstreamManifestPath, `${JSON.stringify(value.upstreamManifest, null, 2)}\n`)
    const first = createOfflineBundle(options(value)); const firstManifest = readFileSync(join(value.outputDir, 'bundle-manifest.json'), 'utf8')
    rmSync(value.outputDir, { recursive: true, force: true }); const second = createOfflineBundle(options(value))
    assert.deepEqual(first, second); assert.equal(firstManifest, readFileSync(join(value.outputDir, 'bundle-manifest.json'), 'utf8'))
    assert.equal(verifyOfflineBundle({ bundleDir: value.outputDir, publicKeyPath: value.publicKeyPath, trustedKeyFingerprintSha256: value.trustedKeyFingerprintSha256 }), true)
  } finally { cleanup(value) }
})

test('wrong trust key, tampered manifest/archive, and extra file fail closed', (t) => {
  if (process.platform === 'win32') return t.skip('create is Linux/WSL-only')
  const value = fixture()
  try {
    writeFileSync(value.upstreamManifestPath, JSON.stringify(value.upstreamManifest)); createOfflineBundle(options(value))
    assert.throws(() => verifyOfflineBundle({ bundleDir: value.outputDir, publicKeyPath: value.wrongPublicKeyPath, trustedKeyFingerprintSha256: value.trustedKeyFingerprintSha256 }), /fingerprint|key/i)
    writeFileSync(join(value.outputDir, 'docs', 'extra.md'), 'extra\n')
    assert.throws(() => verifyOfflineBundle({ bundleDir: value.outputDir, publicKeyPath: value.publicKeyPath, trustedKeyFingerprintSha256: value.trustedKeyFingerprintSha256 }), /unexpected|extra|unmanifested/i)
  } finally { cleanup(value) }
})

test('rejects source/secret/staging extras, malformed identities, symlinks, and non-empty output without mutation', (t) => {
  if (process.platform === 'win32') return t.skip('create is Linux/WSL-only')
  const value = fixture()
  try {
    writeFileSync(value.upstreamManifestPath, JSON.stringify(value.upstreamManifest))
    writeFile(value.stagingDir, 'operations/source.ts', 'export const secret = 1\n', 0o755)
    assert.throws(() => createOfflineBundle(options(value)), /unexpected|source|staging/i); rmSync(join(value.stagingDir, 'operations', 'source.ts'))
    writeFile(value.stagingDir, 'deployment/templates/core.env.template', 'DATABASE_PASSWORD=real-secret\n')
    assert.throws(() => createOfflineBundle(options(value)), /secret|credential/i)
    writeFile(value.stagingDir, 'deployment/templates/core.env.template', 'synthetic config\n')
    writeFile(value.stagingDir, 'deployment/templates/core.env.template', '{"password": "real-secret"}\n')
    assert.throws(() => createOfflineBundle(options(value)), /secret|credential/i)
    writeFile(value.stagingDir, 'deployment/templates/core.env.template', 'token: "real-token"\n')
    assert.throws(() => createOfflineBundle(options(value)), /secret|credential/i)
    writeFile(value.stagingDir, 'deployment/templates/core.env.template', 'synthetic config\n')
    const badInput = { ...value.input, images: { ...value.input.images, backend: { ...value.input.images.backend, configImageId: 'sha256:not-a-digest' } } }
    assert.throws(() => createOfflineBundle({ ...options(value), input: badInput }), /sha256|digest|identity/i)
    const nonEmpty = join(value.root, 'non-empty'); mkdirSync(nonEmpty); writeFileSync(join(nonEmpty, 'sentinel'), 'keep\n')
    assert.throws(() => createOfflineBundle(options(value, nonEmpty)), /absent|output/i); assert.equal(readFileSync(join(nonEmpty, 'sentinel'), 'utf8'), 'keep\n')
    const link = join(value.stagingDir, 'docs', 'link.md')
    try { symlinkSync(join(value.stagingDir, ...REQUIRED_BUNDLE_PATHS.docs[0].split('/')), link) } catch (error) { if (error?.code === 'EPERM' || error?.code === 'EACCES') return t.skip('symlink privilege unavailable'); throw error }
    assert.throws(() => createOfflineBundle(options(value)), /symlink|special/i)
  } finally { cleanup(value) }
})

test('requires owner private key, external public pin, upstream evidence, and rejects empty output', (t) => {
  if (process.platform === 'win32') return t.skip('create is Linux/WSL-only')
  const value = fixture()
  try {
    writeFileSync(value.upstreamManifestPath, JSON.stringify(value.upstreamManifest))
    assert.throws(() => createOfflineBundle({ ...options(value), privateKeyPath: undefined }), /key/i)
    assert.throws(() => createOfflineBundle({ ...options(value), trustedPublicKeyPath: undefined }), /key/i)
    assert.throws(() => createOfflineBundle({ ...options(value), upstreamReleaseManifestPath: undefined }), /upstream/i)
    mkdirSync(value.outputDir); assert.throws(() => createOfflineBundle(options(value)), /absent|output/i)
  } finally { cleanup(value) }
})

test('scanner rejects structured sensitive fields and quoted assignments on every platform', () => {
  assert.throws(() => validateOfflineJsonContent('{"nested":{"password":"real-secret"}}', 'evidence/receipt.json'), /sensitive|secret/i)
  assert.throws(() => validateOfflineJsonContent('{"token":"real-token"}', 'evidence/receipt.json'), /sensitive|secret/i)
  assert.doesNotThrow(() => validateOfflineJsonContent('{"token":"synthetic","nested":{"password":"placeholder"}}', 'evidence/receipt.json'))
  assert.throws(() => validateOfflineTextContent('DATABASE_PASSWORD=real-secret\n', 'deployment/config/config.example'), /secret/i)
  assert.throws(() => validateOfflineTextContent('TOKEN: "real-token"\n', 'deployment/config/config.example'), /secret/i)
  assert.throws(() => validateOfflineTextContent('apiKey = `real-key`\n', 'deployment/config/config.example'), /secret/i)
  assert.throws(() => validateOfflineTextContent('clientSecret =\n  "real-secret"\n', 'operations/runtime.mjs'), /secret/i)
  assert.throws(() => validateOfflineTextContent('clientSecret = "/tmp/real-secret"\n', 'operations/runtime.mjs'), /secret/i)
  assert.doesNotThrow(() => validateOfflineTextContent('token: "synthetic"\n', 'deployment/config/config.example'))
  assert.doesNotThrow(() => validateOfflineTextContent('clientSecret = process.env.CLIENT_SECRET\npassword: "$(cat /run/secrets/password)"\n', 'operations/runtime.mjs'))
  assert.doesNotThrow(() => validateOfflineTextContent('endpoint: "http://object-storage:8333"\npassword: migrator_password\n', 'operations/runtime.mjs'))
  assert.doesNotThrow(() => validateOfflineTextContent('BACKUP_PRIVATE_KEY=$2;\n', 'operations/backup.sh'))
})

test('verify-only runtime entrypoints reject producer modes, private-key flags, and producer exports', async () => {
  const runtimeFiles = [
    'scripts/onprem-offline-bundle-verify.mjs',
    'scripts/onprem-offline-content-guard-index-verify.mjs',
    'scripts/onprem-release-manifest-verify.mjs',
  ]
  const forbidden = /generateKeyPair|createPrivateKey|createBundle|--private-key|\bsign\s*\(/i
  for (const pathname of runtimeFiles) assert.doesNotMatch(readFileSync(pathname, 'utf8'), forbidden, pathname)

  const bundleVerifier = join(process.cwd(), 'scripts/onprem-offline-bundle-verify.mjs')
  for (const args of [['create'], ['verify', '--private-key', 'not-accepted']]) {
    const result = spawnSync(process.execPath, [bundleVerifier, ...args], { encoding: 'utf8' })
    assert.notEqual(result.status, 0, `${args.join(' ')} must be rejected`)
  }
  const module = await import('./onprem-offline-bundle-verify.mjs')
  assert.equal('createBundle' in module, false)
  assert.equal('createOfflineBundle' in module, false)
})

test('image metadata binds exact archive SHA, config image ID, and RepoTag with scoped registry attestation', () => {
  const value = fixture()
  try {
    assert.doesNotThrow(() => validateBundleMetadata(value.input))
    const custom = structuredClone(value.input)
    custom.images.backend.registryDigestAttestedByOwner = false
    delete custom.images.backend.registryManifestDigest
    assert.doesNotThrow(() => validateBundleMetadata(custom))
    const vendor = structuredClone(value.input)
    vendor.images.postgres.registryDigestAttestedByOwner = false
    delete vendor.images.postgres.registryManifestDigest
    assert.throws(() => validateBundleMetadata(vendor), /vendor|attest/i)
    const legacy = structuredClone(value.input)
    legacy.images.backend = { archive: legacy.images.backend.archive, identity: `${legacy.images.backend.repoTag}@${legacy.images.backend.configImageId}`, imageId: legacy.images.backend.configImageId, registryDigestAttestedByOwner: true }
    assert.throws(() => validateBundleMetadata(legacy), /field|configImageId|repoTag/i)
  } finally { cleanup(value) }
})

test('bundle scanner rejects a literal secret injected into an audited runtime tool without output mutation', (t) => {
  if (process.platform === 'win32') return t.skip('bundle creation is Linux/WSL-only')
  const value = fixture()
  try {
    writeFile(value.stagingDir, 'operations/onprem-offline-bundle.mjs', 'const clientSecret = "real-secret-value"\n', 0o755)
    writeFileSync(value.upstreamManifestPath, JSON.stringify(value.upstreamManifest))
    assert.throws(() => createOfflineBundle(options(value)), /secret|credential|sensitive/i)
    assert.equal(existsSync(value.outputDir), false)
  } finally { cleanup(value) }
})

test('stable inventory and copy reject same-size path swaps and mtime/ctime changes', (t) => {
  if (process.platform === 'win32') return t.skip('descriptor identity race proof is Linux/WSL-only')
  const value = fixture()
    const target = join(value.stagingDir, 'deployment', 'templates', 'core.env.template')
  const backup = `${target}.identity-backup`
  try {
    const original = readFileSync(target)
    assert.throws(() => inventory(value.stagingDir, {
      expectedImages: value.images,
      hooks: { files: { beforeOpen: ({ pathname }) => { if (pathname === target) { renameSync(pathname, backup); writeFileSync(pathname, original) } } } },
    }), /changed|hashing|read/i)
    rmSync(target, { force: true }); renameSync(backup, target)

    const staged = inventory(value.stagingDir, { expectedImages: value.images })
    const file = staged.files.find((entry) => entry.path === 'deployment/templates/core.env.template')
    assert.ok(file)
    assert.throws(() => copyStable(file.absolute, join(value.root, 'copied-config.example'), file.bytes, file.sha256, file.mode, file.identity, {
      beforeOpen: ({ source }) => { renameSync(source, backup); writeFileSync(source, original) },
    }), /changed|copy/i)
    rmSync(target, { force: true }); renameSync(backup, target)

    assert.throws(() => inventory(value.stagingDir, {
      expectedImages: value.images,
      hooks: { files: { afterOpen: ({ pathname }) => { if (pathname === target) utimesSync(pathname, new Date(), new Date(Date.now() + 5000)) } } },
    }), /changed|hashing/i)
  } finally {
    if (existsSync(backup)) { rmSync(target, { force: true }); renameSync(backup, target) }
    cleanup(value)
  }
})

test('inventory snapshot rejects a path swap injected after external validation', (t) => {
  if (process.platform === 'win32') return t.skip('create is Linux/WSL-only')
  const value = fixture()
  const target = join(value.stagingDir, 'deployment', 'templates', 'core.env.template')
  const backup = `${target}.external-validation-backup`
  try {
    writeFileSync(value.upstreamManifestPath, JSON.stringify(value.upstreamManifest))
    const original = readFileSync(target)
    assert.throws(() => createOfflineBundle({
      ...options(value),
      testHooks: {
        external: {
          afterValidation: () => { renameSync(target, backup); writeFileSync(target, original) },
        },
      },
    }), /changed|inventory|copy/i)
  } finally {
    if (existsSync(backup)) { rmSync(target, { force: true }); renameSync(backup, target) }
    cleanup(value)
  }
})
