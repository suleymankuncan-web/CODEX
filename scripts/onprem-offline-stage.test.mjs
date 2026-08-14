import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, renameSync, rmSync, statSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

import { REQUIRED_BUNDLE_PATHS } from './onprem-offline-bundle.mjs'
import { stageOffline } from './onprem-offline-stage.mjs'

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const REVISION = '0123456789abcdef0123456789abcdef01234567'
const CREATED_AT = '2026-08-13T12:00:00.000Z'

function header(name, size, type = '0') {
  const value = Buffer.alloc(512)
  value.write(name, 0, 100, 'ascii'); value.write('0000644\0', 100, 8, 'ascii'); value.write('0000000\0', 108, 8, 'ascii'); value.write('0000000\0', 116, 8, 'ascii')
  value.write(`${size.toString(8).padStart(11, '0')}\0`, 124, 12, 'ascii'); value.write('00000000000\0', 136, 12, 'ascii'); value.write('        ', 148, 8, 'ascii'); value.write(type, 156, 1, 'ascii'); value.write('ustar\0', 257, 6, 'ascii'); value.write('00', 263, 2, 'ascii')
  let checksum = 0; for (const byte of value) checksum += byte
  value.write(`${checksum.toString(8).padStart(6, '0')}\0 `, 148, 8, 'ascii')
  return value
}
function imageArchive(name) {
  const config = Buffer.from(JSON.stringify({ architecture: 'amd64', os: 'linux', synthetic: name }))
  const id = createHash('sha256').update(config).digest('hex')
  const configName = `${id}.json`; const manifest = Buffer.from(JSON.stringify([{ Config: configName, RepoTags: [`registry.example/${name}:synthetic`], Layers: [] }]))
  const blocks = []
  for (const [entry, body] of [['manifest.json', manifest], [configName, config]]) blocks.push(header(entry, body.length), body, Buffer.alloc((512 - (body.length % 512)) % 512))
  blocks.push(Buffer.alloc(1024)); return { bytes: Buffer.concat(blocks), imageId: `sha256:${id}` }
}
function write(root, relativePath, content, mode = 0o644) {
  const pathname = join(root, ...relativePath.split('/')); mkdirSync(dirname(pathname), { recursive: true }); writeFileSync(pathname, content); if (process.platform !== 'win32') chmodSync(pathname, mode); return pathname
}
function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'onprem-offline-stage-')); const repo = join(root, 'repo'); const proof = join(root, 'proof'); const output = join(root, 'staged'); mkdirSync(repo); mkdirSync(proof)
  for (const [destination, source] of [
    ['deployment/compose.yaml', 'infra/onprem/core/compose.yaml'], ['deployment/compose.photo-proof.yaml', 'infra/onprem/core/compose.photo-proof.yaml'], ['deployment/photo-compose.yaml', 'infra/onprem/photo-storage/compose.yaml'], ['deployment/proof.compose.yaml', 'infra/onprem/offline/proof.compose.yaml'], ['deployment/restore.compose.yaml', 'infra/onprem/offline/restore.compose.yaml'],
    ['deployment/templates/core.env.template', 'infra/onprem/core/env.template'], ['deployment/templates/photo.env.template', 'infra/onprem/photo-storage/env.template'], ['deployment/caddy/Caddyfile', 'infra/onprem/core/caddy/Caddyfile'], ['deployment/keycloak/bootstrap.sh', 'infra/onprem/core/keycloak/bootstrap.sh'], ['deployment/keycloak/realm-config.json', 'infra/onprem/core/keycloak/realm-config.json'], ['deployment/postgres/entrypoint-tls.sh', 'infra/onprem/core/postgres/entrypoint-tls.sh'], ['deployment/postgres/010-bootstrap-roles.sh', 'infra/onprem/core/postgres/010-bootstrap-roles.sh'], ['deployment/redis/redis.conf', 'infra/onprem/core/redis/redis.conf'], ['deployment/photo-storage/bootstrap.sh', 'infra/onprem/photo-storage/bootstrap.sh'], ['deployment/photo-storage/LICENSE', 'infra/onprem/photo-storage/LICENSE'],
  ]) write(repo, source, readFileSync(join(REPO, source)), destination.endsWith('.sh') ? 0o755 : 0o644)
  write(repo, 'infra/onprem/offline/postgres-gosu.trivyignore.yaml', readFileSync(join(REPO, 'infra/onprem/offline/postgres-gosu.trivyignore.yaml')))
  for (const name of ['preflight.sh', 'install.sh', 'migrate.sh', 'activate.sh', 'smoke.sh', 'backup.sh', 'restore.sh', 'upgrade.sh', 'rollback.sh']) write(repo, `infra/onprem/offline/operations/${name}`, '#!/bin/sh\nset -eu\n', 0o755)
  for (const [name, source] of [
    ['onprem-offline-bundle.mjs', 'onprem-offline-bundle-verify.mjs'],
    ['onprem-offline-archive.mjs', 'onprem-offline-archive.mjs'],
    ['onprem-offline-content-guard-index.mjs', 'onprem-offline-content-guard-index-verify.mjs'],
    ['onprem-release-manifest.mjs', 'onprem-release-manifest-verify.mjs'],
    ['onprem-keycloak-auth-proof.mjs', 'onprem-keycloak-auth-proof.mjs'],
    ['onprem-photo-auth-proof.mjs', 'onprem-photo-auth-proof.mjs'],
    ['onprem-offline-target-proof.mjs', 'onprem-offline-target-proof.mjs'],
    ['onprem-postgres-vulnerability-exception.mjs', 'onprem-postgres-vulnerability-exception.mjs'],
  ]) write(repo, `scripts/${source}`, readFileSync(join(REPO, 'scripts', source)), 0o644)
  write(repo, 'docs/runbooks/onprem-offline-install-v1.md', 'synthetic install runbook\n'); write(repo, 'docs/runbooks/onprem-offline-backup-restore-v1.md', 'synthetic backup restore runbook\n')
  write(proof, 'backend-image-THIRD_PARTY_NOTICES.txt', 'backend notices\n')
  write(proof, 'frontend-image-THIRD_PARTY_NOTICES.txt', 'frontend notices\n')
  write(proof, 'keycloak-LICENSE.txt', 'Keycloak license\n')
  const images = {}
  for (const name of Object.keys(REQUIRED_BUNDLE_PATHS.imageArchives)) { const archive = imageArchive(name); write(proof, `images/${name}.tar`, archive.bytes); images[name] = { name, archive: `images/${name}.tar`, repoTag: `registry.example/${name}:synthetic`, configImageId: archive.imageId, archiveSha256: createHash('sha256').update(archive.bytes).digest('hex'), registryDigestAttestedByOwner: true, registryManifestDigest: `sha256:${'b'.repeat(64)}` } }
  const evidence = REQUIRED_BUNDLE_PATHS.evidence.map((pathname) => pathname.slice('evidence/'.length))
  for (const name of evidence) {
    let content = { ok: true, releaseId: 'stage-test', sha256: 'a'.repeat(64) }
    if (name === 'migration-compatibility.json') content = { schemaVersion: 1, releaseId: 'stage-test', migrationTreeDigest: 'a'.repeat(64), compatibleFrom: [], upgradeCompatible: true, rollbackCompatible: true }
    else if (name.endsWith('content-guard.json')) content = { ok: true, violations: [] }
    else if (name.endsWith('-sbom.spdx.json')) content = { spdxVersion: 'SPDX-2.3', packages: [{ name: '@aws-sdk/credential-provider-node' }] }
    else if (name.endsWith('-trivy-secret.json')) content = { ArtifactName: 'synthetic', ArtifactType: 'container_image', Results: [] }
    else if (name.endsWith('-trivy-vuln.json')) content = { ArtifactName: 'synthetic', ArtifactType: 'container_image', Results: [{ Vulnerabilities: [] }] }
    else if (name.endsWith('-trivy.json')) content = { schemaVersion: 1, image: name.split('-')[0], scans: { vulnerability: { Results: [] }, secret: { Results: [] } } }
    write(proof, `evidence/${name}`, JSON.stringify(content))
  }
  const metadata = { schemaVersion: 1, configSchemaVersion: 1, dataClass: 'synthetic', releaseId: 'stage-test', sourceRevision: REVISION, createdAt: CREATED_AT, images }
  const metadataPath = join(root, 'metadata.json'); writeFileSync(metadataPath, JSON.stringify(metadata))
  return { root, repo, proof, output, metadataPath, metadata }
}
function cleanup(value) { rmSync(value.root, { recursive: true, force: true }) }

test('stages the exact source-free closure with verifier and auth proof runtime files', () => {
  const value = fixture()
  try {
    const result = stageOffline({ repoRoot: value.repo, proofDir: value.proof, outputDir: value.output, metadata: value.metadataPath })
    const expected = new Set([...Object.values(REQUIRED_BUNDLE_PATHS.imageArchives), ...REQUIRED_BUNDLE_PATHS.deployment, ...REQUIRED_BUNDLE_PATHS.operations, ...REQUIRED_BUNDLE_PATHS.evidence, ...REQUIRED_BUNDLE_PATHS.docs])
    const files = []
    const visit = (current, prefix = '') => { for (const entry of readdirSync(current, { withFileTypes: true })) { const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name; if (entry.isDirectory()) visit(join(current, entry.name), relativePath); else files.push(relativePath) } }
    visit(value.output)
    assert.deepEqual(new Set(files), expected)
    assert.equal(result.releaseId, value.metadata.releaseId)
    assert.equal(readFileSync(join(value.output, 'deployment/compose.photo-proof.yaml'), 'utf8'), readFileSync(join(value.repo, 'infra/onprem/core/compose.photo-proof.yaml'), 'utf8'))
    assert.equal(readFileSync(join(value.output, 'deployment/proof.compose.yaml'), 'utf8'), readFileSync(join(value.repo, 'infra/onprem/offline/proof.compose.yaml'), 'utf8'))
    assert.equal(readFileSync(join(value.output, 'operations/onprem-offline-bundle.mjs'), 'utf8'), readFileSync(join(value.repo, 'scripts/onprem-offline-bundle-verify.mjs'), 'utf8'))
    if (process.platform !== 'win32') {
      assert.equal(statSync(join(value.output, 'operations/install.sh')).mode & 0o777, 0o755)
      assert.equal(statSync(join(value.output, 'operations/onprem-postgres-vulnerability-exception.mjs')).mode & 0o777, 0o755)
    }
    assert.equal(existsSync(join(value.output, 'secret-files')), false)
  } finally { cleanup(value) }
})

test('rejects a proof root nested under the source repository before creating output', () => {
  const value = fixture()
  try {
    const nestedProof = join(value.repo, 'proof')
    renameSync(value.proof, nestedProof)
    assert.throws(
      () => stageOffline({ repoRoot: value.repo, proofDir: nestedProof, outputDir: value.output, metadata: value.metadataPath }),
      /repo-root and proof-dir must be separate/,
    )
    assert.equal(existsSync(value.output), false)
  } finally { cleanup(value) }
})

test('rejects a canonical symlink alias to a nested proof root before creating output', (context) => {
  if (process.platform === 'win32') {
    context.skip('directory symlink semantics require a Linux host')
    return
  }
  const value = fixture()
  try {
    const nestedProof = join(value.repo, 'proof')
    const proofAlias = join(value.root, 'proof-alias')
    renameSync(value.proof, nestedProof)
    symlinkSync(nestedProof, proofAlias, 'dir')
    assert.throws(
      () => stageOffline({ repoRoot: value.repo, proofDir: proofAlias, outputDir: value.output, metadata: value.metadataPath }),
      /repo-root and proof-dir must be separate/,
    )
    assert.equal(existsSync(value.output), false)
  } finally { cleanup(value) }
})

test('license and notice closure is fixed, signed, and mandatory', () => {
  assert.deepEqual(
    REQUIRED_BUNDLE_PATHS.docs.filter((pathname) => pathname.startsWith('docs/licenses/')),
    [
      'docs/licenses/backend-THIRD_PARTY_NOTICES.txt',
      'docs/licenses/frontend-THIRD_PARTY_NOTICES.txt',
      'docs/licenses/keycloak-LICENSE.txt',
      'docs/licenses/seaweedfs-LICENSE.txt',
    ],
  )
  const value = fixture()
  try {
    for (const missing of ['backend-image-THIRD_PARTY_NOTICES.txt', 'frontend-image-THIRD_PARTY_NOTICES.txt', 'keycloak-LICENSE.txt']) {
      rmSync(join(value.proof, missing))
      assert.throws(
        () => stageOffline({ repoRoot: value.repo, proofDir: value.proof, outputDir: value.output, metadata: value.metadataPath }),
        /missing|notice|license/i,
        missing,
      )
      assert.equal(existsSync(value.output), false)
      write(value.proof, missing, `${missing}\n`)
    }
    rmSync(join(value.repo, 'infra/onprem/photo-storage/LICENSE'))
    assert.throws(
      () => stageOffline({ repoRoot: value.repo, proofDir: value.proof, outputDir: value.output, metadata: value.metadataPath }),
      /missing|license|cannot/i,
    )
    assert.equal(existsSync(value.output), false)
  } finally { cleanup(value) }
})

test('fails closed for missing closure members, source extras, and unsafe output placement', () => {
  const value = fixture()
  try {
    rmSync(join(value.repo, 'scripts/onprem-keycloak-auth-proof.mjs'))
    assert.throws(() => stageOffline({ repoRoot: value.repo, proofDir: value.proof, outputDir: value.output, metadata: value.metadataPath }), /auth|keycloak|missing|cannot/i)
    assert.equal(existsSync(value.output), false)
  write(value.repo, 'scripts/onprem-keycloak-auth-proof.mjs', readFileSync(join(REPO, 'scripts/onprem-keycloak-auth-proof.mjs')))
  write(value.repo, 'scripts/onprem-photo-auth-proof.mjs', readFileSync(join(REPO, 'scripts/onprem-photo-auth-proof.mjs')))
    write(value.repo, 'infra/onprem/core/secret-files/password', 'not staged\n')
    assert.throws(() => stageOffline({ repoRoot: value.repo, proofDir: value.proof, outputDir: value.output, metadata: value.metadataPath }), /extra|secret/i)
    rmSync(join(value.repo, 'infra/onprem/core/secret-files'), { recursive: true, force: true })
    assert.doesNotThrow(() => stageOffline({ repoRoot: value.repo, proofDir: value.proof, outputDir: value.output, metadata: value.metadataPath }))
    assert.equal(existsSync(join(value.output, 'secret-files')), false)
    assert.throws(() => stageOffline({ repoRoot: value.repo, proofDir: value.proof, outputDir: join(value.repo, 'nested'), metadata: value.metadataPath }), /outside/i)
  } finally { cleanup(value) }
})

test('rejects literal secrets injected into an audited runtime tool before creating output', () => {
  const value = fixture()
  try {
    const runtime = join(value.repo, 'scripts/onprem-offline-bundle-verify.mjs')
    writeFileSync(runtime, `${readFileSync(runtime, 'utf8')}\nconst clientSecret = "real-secret-value"\n`)
    assert.throws(
      () => stageOffline({ repoRoot: value.repo, proofDir: value.proof, outputDir: value.output, metadata: value.metadataPath }),
      /secret|credential|sensitive/i,
    )
    assert.equal(existsSync(value.output), false)
  } finally { cleanup(value) }
})
