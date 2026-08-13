import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

import {
  SEAWEEDFS_IMAGE,
  validateOnpremPhotoStorageContract,
} from './onprem-photo-storage-contract.mjs'

const read = (path) => readFileSync(path, 'utf8').replaceAll('\r\n', '\n')

function input() {
  return {
    compose: read('infra/onprem/photo-storage/compose.yaml'),
    proofCompose: read('infra/onprem/photo-storage/compose.proof.yaml'),
    bootstrap: read('infra/onprem/photo-storage/bootstrap.sh'),
    envTemplate: read('infra/onprem/photo-storage/env.template'),
    license: read('infra/onprem/photo-storage/LICENSE'),
    coreCompose: read('infra/onprem/core/compose.yaml'),
    runtimeProof: read('scripts/onprem-photo-storage-runtime-proof.mjs'),
    workflow: read('.github/workflows/onprem-image-proof.yml'),
    gitignore: read('.gitignore'),
  }
}

test('photo storage contract accepts the private, file-backed SeaweedFS overlay', () => {
  const result = validateOnpremPhotoStorageContract(input())
  assert.equal(result.ok, true, result.errors.join('\n'))
  assert.equal(result.image, SEAWEEDFS_IMAGE)
})

test('photo storage contract rejects a mutable or wrong SeaweedFS image', () => {
  for (const replacement of [
    ['SEAWEEDFS_IMAGE=chrislusf/seaweedfs:4.41@sha256:', 'SEAWEEDFS_IMAGE=chrislusf/seaweedfs:latest'],
    ['SEAWEEDFS_IMAGE=chrislusf/seaweedfs:4.41@sha256:', 'SEAWEEDFS_IMAGE=chrislusf/seaweedfs:4.41@sha256:' + '0'.repeat(64)],
  ]) {
    const mutated = input()
    mutated.envTemplate = mutated.envTemplate.replace(replacement[0], replacement[1])
    assert.equal(validateOnpremPhotoStorageContract(mutated).ok, false)
  }
})

test('photo storage contract rejects public ports, anonymous access, shared credentials, and unsafe hardening', () => {
  const mutations = [
    ['networks: [data]', 'ports:\n      - "8333:8333"\n    networks: [data]'],
    ['"identities": [', '"identities": [{"name":"anonymous","actions":["Read"]},'],
    ['cap_drop: [ALL]', 'cap_drop: []'],
    ['read_only: true', 'read_only: false'],
    ['-master.telemetry=false', '-master.telemetry=true'],
    ['-s3.iam=false', '-s3.iam=true'],
  ]
  for (const [needle, replacement] of mutations) {
    const mutated = input()
    const source = needle.includes('cap_drop') || needle.includes('read_only') || needle.includes('networks')
      ? 'compose'
      : 'bootstrap'
    assert.match(mutated[source], new RegExp(needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
    mutated[source] = mutated[source].replace(needle, replacement)
    assert.equal(validateOnpremPhotoStorageContract(mutated).ok, false, `mutation must fail: ${needle}`)
  }
  const shared = input()
  shared.bootstrap = shared.bootstrap.replace('PHOTO_MEDIA_RECOVERY_ACCESS_KEY_ID_FILE', 'PHOTO_MEDIA_PRIMARY_ACCESS_KEY_ID_FILE')
  assert.notEqual(shared.bootstrap, input().bootstrap)
  assert.equal(validateOnpremPhotoStorageContract(shared).ok, false)
})

test('photo storage contract rejects same bucket, real-photo activation, and missing restore/delete proofs', () => {
  const sameBucket = input()
  sameBucket.envTemplate = sameBucket.envTemplate.replace(
    'PHOTO_MEDIA_RECOVERY_BUCKET=hr-axis-media-recovery',
    'PHOTO_MEDIA_RECOVERY_BUCKET=hr-axis-media-primary',
  )
  assert.equal(validateOnpremPhotoStorageContract(sameBucket).ok, false)

  const realPhoto = input()
  realPhoto.compose = realPhoto.compose.replace('PHOTO_MEDIA_REAL_VM_PILOT_ENABLED: "false"', 'PHOTO_MEDIA_REAL_VM_PILOT_ENABLED: "true"')
  assert.equal(validateOnpremPhotoStorageContract(realPhoto).ok, false)

  for (const marker of [
    'const signed = buildPresignedGet(',
    "'locked DeleteBucket denial'",
    "'stopped-volume snapshot'",
    "'restore into fresh labeled volume'",
    "'--hostname', 'object-storage'",
  ]) {
    const missing = input()
    assert.match(missing.runtimeProof, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
    missing.runtimeProof = missing.runtimeProof.replaceAll(marker, 'PROOF_MARKER_REMOVED')
    assert.equal(validateOnpremPhotoStorageContract(missing).ok, false, marker)
  }
})

test('photo storage contract requires a proof-only loopback mapping and excludes production ports', () => {
  const production = input()
  production.compose = production.compose.replace('    expose:\n      - "8333"', '    ports:\n      - "127.0.0.1:18333:8333"')
  assert.equal(validateOnpremPhotoStorageContract(production).ok, false)

  const proof = input()
  assert.match(proof.proofCompose, /127\.0\.0\.1:\$\{PHOTO_STORAGE_PROOF_PORT:-18333\}:8333/)
})

test('photo storage proof uses isolated network pools so it can run beside the core proof', () => {
  const production = input()
  production.proofCompose = production.proofCompose.replace(/!override/g, '')
  const result = validateOnpremPhotoStorageContract(production)
  assert.equal(result.ok, false)
  assert.match(result.errors.join('\n'), /isolated network pools/)
})

test('photo storage proof overrides inherited object-storage networks to one proof bridge', () => {
  const proof = input()
  const result = validateOnpremPhotoStorageContract(proof)
  assert.equal(result.ok, true, result.errors.join('\n'))
})

test('photo storage contract rejects a non-internal core data network', () => {
  const mutated = input()
  mutated.coreCompose = mutated.coreCompose.replace(
    '  data:\n    internal: true',
    '  data:\n    internal: false',
  )
  assert.notEqual(mutated.coreCompose, input().coreCompose)
  assert.equal(validateOnpremPhotoStorageContract(mutated).ok, false)
})

test('photo storage proof adds a non-internal bridge only for the loopback test port', () => {
  const proof = input()
  proof.proofCompose = proof.proofCompose.replace('internal: false', 'internal: true')
  const result = validateOnpremPhotoStorageContract(proof)
  assert.equal(result.ok, false)
  assert.match(result.errors.join('\n'), /non-internal proof bridge/)
})

test('photo storage proof attaches object-storage to exactly one overridden network', () => {
  const proof = input()
  assert.match(proof.proofCompose, /networks: !override\n      - photo-storage-proof/)

  for (const mutation of [
    proof.proofCompose.replace('    networks: !override', '    networks:'),
    proof.proofCompose.replace('      - photo-storage-proof', '      - data\n      - photo-storage-proof'),
    proof.proofCompose.replace('      - photo-storage-proof', '      - data'),
  ]) {
    assert.equal(validateOnpremPhotoStorageContract({ ...proof, proofCompose: mutation }).ok, false)
  }
})

test('photo storage proof rejects an additive object-storage data network', () => {
  const proof = input()
  proof.proofCompose = proof.proofCompose.replace(
    '      - photo-storage-proof',
    '      - photo-storage-proof\n      - data',
  )
  assert.notEqual(proof.proofCompose, input().proofCompose)
  assert.equal(validateOnpremPhotoStorageContract(proof).ok, false)
})

test('photo storage proof rejects duplicate or decoy top-level bridge blocks', () => {
  const duplicate = input()
  duplicate.proofCompose += [
    '  photo-storage-proof:',
    '    internal: true',
    '    driver: bridge',
    '    ipam:',
    '      config:',
    '        - subnet: 172.31.81.0/24',
  ].join('\n')

  const decoy = input()
  decoy.proofCompose += [
    'networks:',
    '  photo-storage-proof:',
    '    internal: false',
    '    driver: bridge',
    '    ipam:',
    '      config:',
    '        - subnet: 172.31.80.0/24',
  ].join('\n')

  for (const proof of [duplicate, decoy]) {
    assert.equal(validateOnpremPhotoStorageContract(proof).ok, false)
  }
})

test('photo storage proof rejects internal bridges and broadened host mappings', () => {
  const proof = input()
  for (const mutation of [
    proof.proofCompose.replace('internal: false', 'internal: true'),
    proof.proofCompose.replace('127.0.0.1:${PHOTO_STORAGE_PROOF_PORT:-18333}:8333', '0.0.0.0:${PHOTO_STORAGE_PROOF_PORT:-18333}:8333'),
    proof.proofCompose.replace('127.0.0.1:${PHOTO_STORAGE_PROOF_PORT:-18333}:8333', '127.0.0.1:${PHOTO_STORAGE_PROOF_PORT:-18333}:80'),
    proof.proofCompose.replace('127.0.0.1:${PHOTO_STORAGE_PROOF_PORT:-18333}:8333', '127.0.0.1:${PHOTO_STORAGE_PROOF_PORT:-18334}:8333'),
  ]) {
    assert.equal(validateOnpremPhotoStorageContract({ ...proof, proofCompose: mutation }).ok, false)
  }
})

test('photo storage proof rejects an additive public port', () => {
  const proof = input()
  proof.proofCompose = proof.proofCompose.replace(
    '      - "127.0.0.1:${PHOTO_STORAGE_PROOF_PORT:-18333}:8333"',
    '      - "127.0.0.1:${PHOTO_STORAGE_PROOF_PORT:-18333}:8333"\n      - "0.0.0.0:18334:8333"',
  )
  assert.notEqual(proof.proofCompose, input().proofCompose)
  assert.equal(validateOnpremPhotoStorageContract(proof).ok, false)
})

test('photo storage proof locks only locked-prefix objects in both buckets', () => {
  const proof = input()
  for (const marker of [
    "'x-amz-object-lock-mode': 'COMPLIANCE'",
    "const lockedKey = 'locked/companies/synthetic/media/fixture/canonical.webp'",
    "const transientKey = 'transient/companies/synthetic/media/fixture/raw'",
    "const derivedKey = 'derived/companies/synthetic/media/fixture/thumbnail.webp'",
    "'primary locked DeleteObject denial'",
    "'recovery locked DeleteObject denial'",
  ]) assert.match(proof.runtimeProof, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
  assert.doesNotMatch(proof.runtimeProof, /ObjectLockConfiguration/)
})
