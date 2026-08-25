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
  statSync,
  symlinkSync,
  utimesSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

import { createReleaseManifest } from './onprem-release-manifest.mjs'
import { createContentGuardIndex } from './onprem-offline-content-guard-index.mjs'
import { REQUIRED_BUNDLE_PATHS, copyStable, createOfflineBundle, inventory, validateBundleMetadata, validateOfflineJsonContent, validateOfflineTextContent, validateVendorEvidenceClosure, verifyOfflineBundle } from './onprem-offline-bundle.mjs'
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
  assert.ok(REQUIRED_BUNDLE_PATHS.evidence.includes('evidence/postgres-trivy-vuln.json'))
  for (const name of ['caddy', 'postgres', 'redis', 'seaweedfs']) {
    for (const suffix of ['sbom.spdx.json', 'trivy-vuln.json', 'trivy-secret.json', 'trivy.json', 'license-inventory.json']) {
      assert.ok(REQUIRED_BUNDLE_PATHS.evidence.includes(`evidence/${name}-${suffix}`), `${name}-${suffix} must be delivered in the signed closure`)
    }
  }
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
  'operations/onprem-postgres-vulnerability-exception.mjs',
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
  const vendorRecords = {}
  for (const name of ['caddy', 'postgres', 'redis', 'seaweedfs']) {
    const rawEvidence = {
      sbom: [`evidence/${name}-sbom.spdx.json`, { spdxVersion: 'SPDX-2.3', name: `registry.example/${name}`, packages: [{ name: '@aws-sdk/credential-provider-node' }] }],
      vulnerabilityScan: [`evidence/${name}-trivy-vuln.json`, { ArtifactID: `sha256:${'c'.repeat(64)}`, ArtifactName: `/out/${name}-image.tar`, ArtifactType: 'container_image', Metadata: { ImageID: images[name].configImageId, RepoTags: [images[name].repoTag] }, Results: [] }],
      sensitiveDataScan: [`evidence/${name}-trivy-secret.json`, { ArtifactID: `sha256:${'c'.repeat(64)}`, ArtifactName: `/out/${name}-image.tar`, ArtifactType: 'container_image', Metadata: { ImageID: images[name].configImageId, RepoTags: [images[name].repoTag] }, Results: [] }],
      licenseInventory: [`evidence/${name}-license-inventory.json`, { schemaVersion: 1, dataClass: 'synthetic', image: `${images[name].repoTag}@${images[name].registryManifestDigest}`, imageId: images[name].configImageId, sbom: `${name}-sbom.spdx.json`, vulnerabilityReport: `${name}-trivy.json`, secretReport: `${name}-trivy-secret.json`, licenseSource: 'SPDX package license assertions' }],
    }
    rawEvidence.vulnerabilityReport = [`evidence/${name}-trivy.json`, { schemaVersion: 1, image: name, scans: { vulnerability: structuredClone(rawEvidence.vulnerabilityScan[1]), secret: structuredClone(rawEvidence.sensitiveDataScan[1]) } }]
    const artifacts = {}
    for (const [key, [path, value]] of Object.entries(rawEvidence)) {
      writeFile(stagingDir, path, JSON.stringify(value))
      artifacts[key] = { path, sha256: createHash('sha256').update(readFileSync(join(stagingDir, ...path.split('/')))).digest('hex') }
    }
    if (name === 'postgres') {
      for (const [key, path] of [
        ['vulnerabilityExceptionReceipt', 'evidence/postgres-vulnerability-exception-receipt.json'],
        ['vulnerabilityExceptionSymbolProof', 'evidence/postgres-gosu-symbol-proof.json'],
      ]) artifacts[key] = { path, sha256: createHash('sha256').update(readFileSync(join(stagingDir, ...path.split('/')))).digest('hex') }
    }
    vendorRecords[name] = { configImageId: images[name].configImageId, archive: images[name].archive, registryReference: `${images[name].repoTag}@${images[name].registryManifestDigest}`, registryManifestDigest: images[name].registryManifestDigest, artifacts }
  }
  writeFile(stagingDir, 'evidence/sbom.json', JSON.stringify({ schemaVersion: 1, dataClass: 'synthetic', components: vendorRecords }))
  writeFile(stagingDir, 'evidence/license-inventory.json', JSON.stringify({ schemaVersion: 1, dataClass: 'synthetic', inventories: vendorRecords }))
  writeFile(stagingDir, 'evidence/vulnerability-report.json', JSON.stringify({ schemaVersion: 1, dataClass: 'synthetic', reports: vendorRecords }))

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
    const selfContained = spawnSync(process.execPath, [
      join(process.cwd(), 'scripts/onprem-offline-bundle-verify.mjs'), 'verify',
      '--bundle-dir', value.outputDir,
      '--public-key', value.publicKeyPath,
      '--trusted-fingerprint', value.trustedKeyFingerprintSha256,
    ], { encoding: 'utf8' })
    assert.equal(selfContained.status, 0, `${selfContained.stdout}\n${selfContained.stderr}`)
  } finally { cleanup(value) }
})

test('bundle generation normalizes generated metadata modes under a restrictive process umask', (t) => {
  if (process.platform === 'win32') return t.skip('create is Linux/WSL-only')
  const value = fixture()
  const priorUmask = process.umask(0o077)
  try {
    writeFileSync(value.upstreamManifestPath, `${JSON.stringify(value.upstreamManifest, null, 2)}\n`)
    createOfflineBundle(options(value))
    for (const name of ['bundle-manifest.json', 'bundle-signature.json']) {
      assert.equal(statSync(join(value.outputDir, name)).mode & 0o777, 0o644, `${name} must retain the bootstrap verifier mode`)
    }
  } finally {
    process.umask(priorUmask)
    cleanup(value)
  }
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

test('scanner accepts schema-owned SBOM and Trivy prose but rejects actual secret evidence', () => {
  const sbom = JSON.stringify({
    spdxVersion: 'SPDX-2.3',
    packages: [
      { name: '@aws-sdk/credential-provider-node', externalRefs: [{ referenceLocator: 'cpe:2.3:a:smallrye-private-key:provider:1.0:*:*:*:*:*:*:*' }] },
      { name: 'wildfly-elytron-password', comment: "advisory example: secret='LEAKED' and unexpected token:" },
    ],
  })
  const emptySecretScan = { ArtifactName: 'caddy:synthetic', ArtifactType: 'container_image', Results: [{ Target: 'caddy', Secrets: [] }] }
  const vulnerabilityScan = { ArtifactName: 'caddy:synthetic', ArtifactType: 'container_image', Results: [{ Vulnerabilities: [{ Description: "PoC uses secret='LEAKED' and reports unexpected token:" }] }] }
  const combined = JSON.stringify({ schemaVersion: 1, image: 'caddy', scans: { vulnerability: vulnerabilityScan, secret: emptySecretScan } })

  assert.doesNotThrow(() => validateOfflineJsonContent(sbom, 'evidence/caddy-sbom.spdx.json'))
  assert.doesNotThrow(() => validateOfflineJsonContent(JSON.stringify(vulnerabilityScan), 'evidence/caddy-trivy-vuln.json'))
  assert.doesNotThrow(() => validateOfflineJsonContent(JSON.stringify(emptySecretScan), 'evidence/caddy-trivy-secret.json'))
  assert.doesNotThrow(() => validateOfflineJsonContent(combined, 'evidence/caddy-trivy.json'))
  assert.throws(
    () => validateOfflineJsonContent(JSON.stringify({ ...emptySecretScan, Results: [{ Secrets: [{ RuleID: 'aws-access-key', Match: 'real-secret' }] }] }), 'evidence/caddy-trivy-secret.json'),
    /secret finding|sensitive|secret material/i,
  )
  assert.throws(() => validateOfflineJsonContent(JSON.stringify({ spdxVersion: 'SPDX-2.3', password: 'real-secret' }), 'evidence/caddy-sbom.spdx.json'), /sensitive/i)
  assert.throws(() => validateOfflineJsonContent(JSON.stringify({ spdxVersion: 'SPDX-2.3', comment: '-----BEGIN PRIVATE KEY-----' }), 'evidence/caddy-sbom.spdx.json'), /secret material/i)
})

test('vendor aggregate evidence resolves every advertised digest to a signed raw file', () => {
  const vendors = ['caddy', 'postgres', 'redis', 'seaweedfs']
  const suffixes = {
    sbom: 'sbom.spdx.json',
    vulnerabilityReport: 'trivy.json',
    vulnerabilityScan: 'trivy-vuln.json',
    sensitiveDataScan: 'trivy-secret.json',
    licenseInventory: 'license-inventory.json',
  }
  const files = []
  const images = {}
  const records = {}
  vendors.forEach((name, vendorIndex) => {
    images[name] = { archive: `images/${name}.tar`, repoTag: `registry.example/${name}:synthetic`, configImageId: `sha256:${String(vendorIndex + 1).repeat(64)}`, registryManifestDigest: `sha256:${String(vendorIndex + 5).repeat(64)}` }
    const artifacts = {}
    Object.entries(suffixes).forEach(([key, suffix], artifactIndex) => {
      const path = `evidence/${name}-${suffix}`
      const sha256 = String((vendorIndex + artifactIndex + 1) % 10).repeat(64)
      let value
      if (key === 'sbom') value = { spdxVersion: 'SPDX-2.3', name: `registry.example/${name}`, packages: [] }
      else if (key === 'vulnerabilityScan' || key === 'sensitiveDataScan') value = { ArtifactID: `sha256:${String(vendorIndex + 1).repeat(64)}`, ArtifactName: `/out/${name}-image.tar`, ArtifactType: 'container_image', Metadata: { ImageID: images[name].configImageId, RepoTags: [images[name].repoTag] }, Results: [] }
      else if (key === 'licenseInventory') value = { schemaVersion: 1, dataClass: 'synthetic', image: `${images[name].repoTag}@${images[name].registryManifestDigest}`, imageId: images[name].configImageId, sbom: `${name}-sbom.spdx.json`, vulnerabilityReport: `${name}-trivy.json`, secretReport: `${name}-trivy-secret.json`, licenseSource: 'SPDX package license assertions' }
      files.push({ path, sha256, content: value })
      artifacts[key] = { path, sha256 }
    })
    if (name === 'postgres') {
      for (const [key, path, digit] of [
        ['vulnerabilityExceptionReceipt', 'evidence/postgres-vulnerability-exception-receipt.json', '7'],
        ['vulnerabilityExceptionSymbolProof', 'evidence/postgres-gosu-symbol-proof.json', '8'],
      ]) {
        const sha256 = digit.repeat(64)
        files.push({ path, sha256 })
        artifacts[key] = { path, sha256 }
      }
    }
    records[name] = { configImageId: images[name].configImageId, archive: images[name].archive, registryReference: `${images[name].repoTag}@${images[name].registryManifestDigest}`, registryManifestDigest: images[name].registryManifestDigest, artifacts }
  })
  for (const name of vendors) {
    const vuln = files.find((file) => file.path === `evidence/${name}-trivy-vuln.json`).content
    const secret = files.find((file) => file.path === `evidence/${name}-trivy-secret.json`).content
    files.find((file) => file.path === `evidence/${name}-trivy.json`).content = { schemaVersion: 1, image: name, scans: { vulnerability: structuredClone(vuln), secret: structuredClone(secret) } }
  }
  const aggregates = {
    sbom: { schemaVersion: 1, dataClass: 'synthetic', components: structuredClone(records) },
    license: { schemaVersion: 1, dataClass: 'synthetic', inventories: structuredClone(records) },
    vulnerability: { schemaVersion: 1, dataClass: 'synthetic', reports: structuredClone(records) },
  }
  assert.equal(validateVendorEvidenceClosure({ images }, aggregates, files), true)
  aggregates.vulnerability.reports.caddy.artifacts.sbom.sha256 = 'f'.repeat(64)
  assert.throws(() => validateVendorEvidenceClosure({ images }, aggregates, files), /vendor evidence|digest|hash/i)
})

test('vendor evidence closure rejects misattributed and internally divergent raw reports', () => {
  const value = fixture()
  try {
    const options = { bundleDir: value.stagingDir }
    const load = (path) => JSON.parse(readFileSync(join(value.stagingDir, ...path.split('/')), 'utf8'))
    const files = ALL_REQUIRED.map((path) => ({ path, sha256: createHash('sha256').update(readFileSync(join(value.stagingDir, ...path.split('/')))).digest('hex') }))
    const aggregates = {
      sbom: load('evidence/sbom.json'),
      license: load('evidence/license-inventory.json'),
      vulnerability: load('evidence/vulnerability-report.json'),
    }
    assert.equal(validateVendorEvidenceClosure(value.input, aggregates, files, load), true)

    const caddyVulnPath = 'evidence/caddy-trivy-vuln.json'
    const original = load(caddyVulnPath)
    const mutations = [
      { ...original, Metadata: { ...original.Metadata, ImageID: value.images.redis.configImageId } },
      { ...original, Metadata: { ...original.Metadata, RepoTags: [value.images.redis.repoTag] } },
      { ...original, ArtifactName: '/out/redis-image.tar' },
    ]
    for (const mutation of mutations) {
      assert.throws(() => validateVendorEvidenceClosure(value.input, aggregates, files, (path) => path === caddyVulnPath ? mutation : load(path)), /vendor evidence|identity|trivy/i)
    }
    assert.throws(() => validateVendorEvidenceClosure(value.input, aggregates, files, (path) => path === 'evidence/caddy-trivy.json' ? { ...load(path), scans: { ...load(path).scans, vulnerability: { ...original, ReportID: 'diverged' } } } : load(path)), /combined|agree|diverg/i)
    assert.throws(() => validateVendorEvidenceClosure(value.input, aggregates, files, (path) => path === 'evidence/caddy-sbom.spdx.json' ? { spdxVersion: 'SPDX-2.3', name: 'redis', packages: [] } : load(path)), /sbom|identity/i)
    assert.throws(() => validateVendorEvidenceClosure(value.input, aggregates, files, (path) => path === 'evidence/caddy-license-inventory.json' ? { ...load(path), imageId: value.images.redis.configImageId } : load(path)), /license|identity/i)
  } finally { rmSync(value.root, { recursive: true, force: true }) }
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
