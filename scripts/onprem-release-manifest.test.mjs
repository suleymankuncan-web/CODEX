import assert from 'node:assert/strict'
import { generateKeyPairSync } from 'node:crypto'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

import {
  createReleaseManifest,
  verifyReleaseManifest,
} from './onprem-release-manifest.mjs'

function artifactFixture() {
  const root = mkdtempSync(join(tmpdir(), 'onprem-manifest-'))
  const files = {}
  for (const name of [
    'frontendImage',
    'keycloakImage',
    'backendImage',
    'frontendSbom',
    'keycloakSbom',
    'backendSbom',
    'frontendVulnerabilityReport',
    'keycloakVulnerabilityReport',
    'backendVulnerabilityReport',
    'frontendLicenseInventory',
    'keycloakLicenseInventory',
    'keycloakLicenseText',
    'keycloakLicensePaths',
    'keycloakLicenseReconciliation',
    'keycloakLicenseBundle',
    'backendLicenseInventory',
    'frontendNotices',
    'keycloakImageManifest',
    'keycloakContentGuard',
    'backendNotices',
    'frontendImageLicenseReconciliation',
    'backendImageLicenseReconciliation',
    'frontendImageNotices',
    'backendImageNotices',
    'baseLicenseEvidenceBundle',
  ]) {
    files[name] = join(root, `${name}.json`)
    writeFileSync(files[name], `${name}:synthetic\n`)
  }
  const keys = generateKeyPairSync('ed25519')
  const privateKeyPath = join(root, 'ephemeral-private.pem')
  const publicKeyPath = join(root, 'ephemeral-public.pem')
  writeFileSync(privateKeyPath, keys.privateKey.export({ type: 'pkcs8', format: 'pem' }))
  writeFileSync(publicKeyPath, keys.publicKey.export({ type: 'spki', format: 'pem' }))
  return { root, files, privateKeyPath, publicKeyPath }
}

function input(fixture) {
  return {
    dataClass: 'synthetic',
    sourceRevision: '0123456789abcdef0123456789abcdef01234567',
    version: 'onprem-1.0.0',
    buildTimestamp: '2026-08-08T12:00:00.000Z',
    configSchemaVersion: 1,
    baseImages: {
      build: 'node:24-trixie-slim@sha256:0711b541c1c33a8a530ac4f0d391baa9a15b3d804695b1b24a47daa5fb60e74d',
      frontendRuntime: 'nginxinc/nginx-unprivileged:1.30.4-alpine-slim@sha256:e88d990b349df8cf4aa82f16642d7a23375016638c9ace4e5c6ca25028e62e65',
      backendRuntime: 'gcr.io/distroless/nodejs24-debian13:nonroot@sha256:fbbdda866ea71aef98c4abece17e3d61fbf820cc2ef3961522caa2478716171a',
      keycloakBase: 'quay.io/keycloak/keycloak:26.7.2@sha256:9d1f1b2b7261ff53c66cb1092dfcdc34a5fb77e81f9e6a6e75b8b6a795de8067',
      trivy: 'aquasec/trivy:0.72.0@sha256:cffe3f5161a47a6823fbd23d985795b3ed72a4c806da4c4df16266c02accdd6f',
      syft: 'anchore/syft:v1.50.0@sha256:1288ea4c8b38767b4e620c1e312c8cb26b6e887a99b4f07ab6cd19fc6f225026',
    },
    artifacts: fixture.files,
    imageIds: {
      frontend: `sha256:${'1'.repeat(64)}`,
      backend: `sha256:${'2'.repeat(64)}`,
      keycloak: `sha256:${'3'.repeat(64)}`,
    },
  }
}

test('release manifest is deterministic, signed, and verifies artifact digests', () => {
  const fixture = artifactFixture()
  try {
    const manifestA = createReleaseManifest(input(fixture), { privateKeyPath: fixture.privateKeyPath })
    const manifestB = createReleaseManifest(input(fixture), { privateKeyPath: fixture.privateKeyPath })
    assert.deepEqual(manifestA, manifestB)
    assert.equal(verifyReleaseManifest(manifestA, { baseDir: fixture.root, publicKeyPath: fixture.publicKeyPath }), true)
    writeFileSync(fixture.files.frontendSbom, 'tampered\n')
    assert.throws(() => verifyReleaseManifest(manifestA, { baseDir: fixture.root, publicKeyPath: fixture.publicKeyPath }), /digest/i)
  } finally {
    rmSync(fixture.root, { recursive: true, force: true })
  }
})

test('release manifest rejects real-data fields, malformed digests, missing artifacts, and traversal', () => {
  const fixture = artifactFixture()
  try {
    assert.throws(() => createReleaseManifest({ ...input(fixture), host: 'prod.example.test' }, { privateKeyPath: fixture.privateKeyPath }), /host|secret|URL/i)
    assert.throws(() => createReleaseManifest({ ...input(fixture), baseImages: { ...input(fixture).baseImages, build: 'node@sha256:not-a-digest' } }, { privateKeyPath: fixture.privateKeyPath }), /digest/i)
    assert.throws(() => createReleaseManifest({ ...input(fixture), artifacts: { ...fixture.files, notices: join(fixture.root, '..', 'notices') } }, { privateKeyPath: fixture.privateKeyPath }), /artifact|path/i)
    const manifest = createReleaseManifest(input(fixture), { privateKeyPath: fixture.privateKeyPath })
    manifest.artifacts.frontendSbom.path = '../outside.json'
    assert.throws(() => verifyReleaseManifest(manifest, { baseDir: fixture.root, publicKeyPath: fixture.publicKeyPath }), /signature|path/i)
  } finally {
    rmSync(fixture.root, { recursive: true, force: true })
  }
})

test('release manifest fails closed without owner-controlled signing and verification keys', () => {
  const fixture = artifactFixture()
  try {
    assert.throws(() => createReleaseManifest(input(fixture)), /private key is required/i)
    const manifest = createReleaseManifest(input(fixture), { privateKeyPath: fixture.privateKeyPath })
    assert.throws(() => verifyReleaseManifest(manifest, { baseDir: fixture.root }), /public key is required/i)

    const attackerKeys = generateKeyPairSync('ed25519')
    const attackerPublicKeyPath = join(fixture.root, 'attacker-public.pem')
    writeFileSync(attackerPublicKeyPath, attackerKeys.publicKey.export({ type: 'spki', format: 'pem' }))
    assert.throws(
      () => verifyReleaseManifest(manifest, { baseDir: fixture.root, publicKeyPath: attackerPublicKeyPath }),
      /fingerprint|signature/i,
    )
  } finally {
    rmSync(fixture.root, { recursive: true, force: true })
  }
})

test('release manifest requires exact image identities, timestamp, schema version, and known fields', () => {
  const fixture = artifactFixture()
  try {
    const options = { privateKeyPath: fixture.privateKeyPath }
    assert.throws(() => createReleaseManifest({ ...input(fixture), imageIds: {} }, options), /imageIds/i)
    assert.throws(() => createReleaseManifest({ ...input(fixture), buildTimestamp: undefined }, options), /buildTimestamp/i)
    assert.throws(() => createReleaseManifest({ ...input(fixture), configSchemaVersion: undefined }, options), /configSchemaVersion/i)
    assert.throws(() => createReleaseManifest({ ...input(fixture), unexpected: 'synthetic' }, options), /unknown field/i)
  } finally {
    rmSync(fixture.root, { recursive: true, force: true })
  }
})
