import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'

export const SEAWEEDFS_IMAGE = 'chrislusf/seaweedfs:4.41@sha256:43b768cd62b00d132439cda881b93fd1adebf1b315e996e794087743821d771d'

const REQUIRED_FLAGS = [
  '-volume.max=32',
  '-master.telemetry=false',
  '-filer.exposeDirectoryData=false',
  '-filer.ui.deleteDir=false',
  '-s3',
  '-s3.config=/run/seaweed/s3-config.json',
  '-s3.iam=false',
  '-s3.allowDeleteBucketNotEmpty=false',
]

function envValue(text, name) {
  return String(text).match(new RegExp(`^${name}=([^\\r\\n]+)$`, 'm'))?.[1]?.trim() ?? ''
}

function serviceBlock(compose, name) {
  const lines = String(compose).split(/\r?\n/)
  const start = lines.findIndex((line) => line === `  ${name}:`)
  if (start < 0) return ''
  const end = lines.slice(start + 1).findIndex((line) => /^  [a-z0-9-]+:$/.test(line) || /^[a-z0-9_-]+:$/.test(line))
  return lines.slice(start, end < 0 ? lines.length : start + 1 + end).join('\n')
}

function serviceKeyBlock(service, name) {
  const lines = String(service).split(/\r?\n/)
  const start = lines.findIndex((line) => line === `    ${name}:` || line.startsWith(`    ${name}: `))
  if (start < 0) return ''
  const end = lines.slice(start + 1).findIndex((line) => /^    [a-z0-9-]+:/.test(line))
  return lines.slice(start, end < 0 ? lines.length : start + 1 + end).join('\n')
}

function topLevelSectionBlocks(compose, name) {
  const lines = String(compose).split(/\r?\n/)
  const starts = lines.flatMap((line, index) => (line === `${name}:` ? [index] : []))
  return starts.map((start, position) => {
    const nextStart = starts[position + 1]
    const nextTopLevel = lines.slice(start + 1, nextStart).findIndex((line) => line !== '' && !/^\s/.test(line))
    const end = nextStart ?? (nextTopLevel < 0 ? lines.length : start + 1 + nextTopLevel)
    return lines.slice(start, end).join('\n')
  })
}

function namedTopLevelBlocks(section, name) {
  const lines = String(section).split(/\r?\n/)
  const starts = lines.flatMap((line, index) => (line === `  ${name}:` ? [index] : []))
  return starts.map((start) => {
    const nextNamed = lines.slice(start + 1).findIndex((line) => /^  [a-z0-9-]+:$/.test(line))
    const end = nextNamed < 0 ? lines.length : start + 1 + nextNamed
    return lines.slice(start, end).join('\n')
  })
}

function deindentTopLevelBlock(block) {
  return String(block).split('\n').map((line) => line.startsWith('  ') ? line.slice(2) : line).join('\n').trim()
}

function failIf(errors, condition, message) {
  if (!condition) errors.push(message)
}

export function validateOnpremPhotoStorageContract(input) {
  const errors = []
  const compose = String(input.compose).replaceAll('\r\n', '\n')
  const proofCompose = String(input.proofCompose).replaceAll('\r\n', '\n')
  const bootstrap = String(input.bootstrap).replaceAll('\r\n', '\n')
  const envTemplate = String(input.envTemplate).replaceAll('\r\n', '\n')
  const runtimeProof = String(input.runtimeProof).replaceAll('\r\n', '\n')
  const license = String(input.license ?? '')
  const objectStorage = serviceBlock(compose, 'object-storage')
  const proofObjectStorage = serviceBlock(proofCompose, 'object-storage')
  const api = serviceBlock(compose, 'api')
  const worker = serviceBlock(compose, 'worker')
  const proofPorts = serviceKeyBlock(proofObjectStorage, 'ports').trimEnd()
  const proofNetworks = serviceKeyBlock(proofObjectStorage, 'networks').trimEnd()
  const proofNetworkSections = topLevelSectionBlocks(proofCompose, 'networks')
  const proofNetworkBlocks = proofNetworkSections.length === 1
    ? namedTopLevelBlocks(proofNetworkSections[0], 'photo-storage-proof')
    : []
  const expectedProofNetworkBlock = [
    'photo-storage-proof:',
    '  internal: false',
    '  driver: bridge',
    '  ipam:',
    '    config:',
    '      - subnet: 172.31.80.0/24',
  ].join('\n')

  failIf(errors, Boolean(objectStorage), 'photo overlay must define object-storage')
  failIf(errors, envValue(envTemplate, 'SEAWEEDFS_IMAGE') === SEAWEEDFS_IMAGE, 'SeaweedFS image must be the exact 4.41 digest')
  failIf(errors, !/^    ports:/m.test(objectStorage), 'production object-storage must not publish a host port')
  failIf(errors, /networks: \[data\]/.test(objectStorage), 'object-storage must be private on the internal data network')
  failIf(errors, /read_only: true/.test(objectStorage), 'object-storage must be read-only')
  failIf(errors, /cap_drop: \[ALL\]/.test(objectStorage), 'object-storage must drop all capabilities')
  failIf(errors, /cap_add: \[CHOWN, SETGID, SETUID\]/.test(objectStorage), 'object-storage may add only CHOWN, SETGID, and SETUID')
  failIf(errors, /security_opt: \[no-new-privileges:true\]/.test(objectStorage), 'object-storage must enable no-new-privileges')
  failIf(errors, /cpus: 0\.5/.test(objectStorage) && /mem_limit: 1024m/.test(objectStorage), 'object-storage resource ceilings must remain bounded')
  failIf(errors, /logging:[\s\S]*max-size: 10m[\s\S]*max-file: "5"/.test(objectStorage), 'object-storage logs must be bounded')
  failIf(errors, /com\.hr-axis\.volume-class: photo-object-storage/.test(compose), 'object storage volume must carry its synthetic cleanup label')
  failIf(errors, REQUIRED_FLAGS.every((flag) => bootstrap.includes(flag)), 'SeaweedFS startup must disable telemetry, anonymous IAM, directory UI, recursive bucket delete, and bound volumes')
  failIf(errors, /entrypoint\.sh server/.test(bootstrap), 'official SeaweedFS entrypoint must remain in the startup chain')
  failIf(errors, /entrypoint: \["\/bin\/sh", "\/opt\/hr-axis\/photo-storage\/bootstrap\.sh"\]/.test(objectStorage), 'photo storage bootstrap must run through /bin/sh with deterministic file mode')
  failIf(errors, !bootstrap.includes('anonymous'), 'anonymous S3 identity must not be configured')
  failIf(errors, /Admin:\$primary_bucket/.test(bootstrap) && /Admin:\$recovery_bucket/.test(bootstrap), 'primary and recovery identities must be bucket-scoped')
  failIf(errors, /primary_key=\$\(read_secret/.test(bootstrap) && /recovery_key=\$\(read_secret/.test(bootstrap), 'credentials must be read from file-backed Docker secrets')
  failIf(errors, bootstrap.includes('PHOTO_MEDIA_PRIMARY_ACCESS_KEY_ID_FILE') && bootstrap.includes('PHOTO_MEDIA_RECOVERY_ACCESS_KEY_ID_FILE'), 'primary and recovery credentials must use distinct secret file paths')
  failIf(errors, /unset primary_key primary_secret recovery_key recovery_secret/.test(bootstrap), 'credential variables must be cleared after config generation')
  failIf(errors, /case "\$value" in[\s\S]*unsupported characters/.test(bootstrap), 'credential validation must reject unsafe JSON characters')
  failIf(errors, /chown 1000:1000 "\$\(dirname "\$config"\)"/.test(bootstrap) && /chmod 0700 "\$\(dirname "\$config"\)"/.test(bootstrap), 'generated S3 config directory must be UID-bound and private')
  failIf(errors, /chown 1000:1000 "\$config"/.test(bootstrap), 'generated S3 config must be readable by the SeaweedFS UID')

  const primaryBucket = envValue(envTemplate, 'PHOTO_MEDIA_PRIMARY_BUCKET')
  const recoveryBucket = envValue(envTemplate, 'PHOTO_MEDIA_RECOVERY_BUCKET')
  failIf(errors, Boolean(primaryBucket) && Boolean(recoveryBucket) && primaryBucket !== recoveryBucket, 'primary and recovery buckets must be distinct')
  failIf(errors, /PHOTO_MEDIA_STORAGE_ENABLED: "true"/.test(api) && /PHOTO_MEDIA_STORAGE_ENABLED: "true"/.test(worker), 'api and worker must enable only the synthetic storage overlay')
  for (const service of [api, worker]) {
    failIf(errors, /PHOTO_MEDIA_PROVIDER: seaweedfs/.test(service), 'api/worker must select SeaweedFS only')
    failIf(errors, /PHOTO_MEDIA_PRIMARY_ENDPOINT: http:\/\/object-storage:8333/.test(service) && /PHOTO_MEDIA_RECOVERY_ENDPOINT: http:\/\/object-storage:8333/.test(service), 'api/worker endpoints must remain exact internal addresses')
    failIf(errors, /PHOTO_MEDIA_PRIMARY_ACCESS_KEY_ID_FILE: \/run\/secrets\/photo_primary_access_key_id/.test(service), 'primary access key must be file-backed')
    failIf(errors, /PHOTO_MEDIA_RECOVERY_ACCESS_KEY_ID_FILE: \/run\/secrets\/photo_recovery_access_key_id/.test(service), 'recovery access key must be file-backed')
    failIf(errors, !/PHOTO_MEDIA_PRIMARY_ACCESS_KEY_ID:\s+[^\n]+/.test(service), 'api/worker must not contain plaintext primary credentials')
    failIf(errors, !/PHOTO_MEDIA_RECOVERY_ACCESS_KEY_ID:\s+[^\n]+/.test(service), 'api/worker must not contain plaintext recovery credentials')
    failIf(errors, /PHOTO_MEDIA_REAL_VM_PILOT_ENABLED: "false"/.test(service), 'real photo VM pilot must remain disabled')
    failIf(errors, /VISUAL_COMPARISON_WORKER_ENABLED: "false"/.test(service), 'visual AI worker must remain disabled')
  }
  failIf(errors, /PHOTO_MEDIA_PRIMARY_SECRET_ACCESS_KEY:\s*[^_]/.test(api + worker) === false, 'primary secret must not be plaintext')
  failIf(errors, /PHOTO_MEDIA_RECOVERY_SECRET_ACCESS_KEY:\s*[^_]/.test(api + worker) === false, 'recovery secret must not be plaintext')
  failIf(errors, /secrets:[\s\S]*photo_primary_access_key_id/.test(compose), 'photo credentials must be declared as Compose secrets')
  failIf(errors, /photo_recovery_secret_access_key/.test(compose), 'recovery secret must be declared as a Compose secret')
  failIf(errors, /ports:\n\s+- "127\.0\.0\.1:/.test(compose) === false, 'production overlay must not contain a loopback proof mapping')
  failIf(errors,
    proofPorts === '    ports:\n      - "127.0.0.1:${PHOTO_STORAGE_PROOF_PORT:-18333}:8333"',
    'proof overlay must map only the exact loopback port 127.0.0.1:18333 to 8333',
  )
  failIf(errors, (proofCompose.match(/config: !override/g) ?? []).length === 4 && ['172.31.40.0/24', '172.31.50.0/24', '172.31.60.0/24', '172.31.70.0/24'].every((subnet) => proofCompose.includes(`subnet: ${subnet}`)), 'proof overlay must use isolated network pools')
  failIf(errors,
    proofNetworks === '    networks: !override\n      - photo-storage-proof',
    'proof overlay must override inherited networks and attach object-storage only to the non-internal proof bridge',
  )
  failIf(errors,
    proofNetworkSections.length === 1 &&
      proofNetworkBlocks.length === 1 &&
      deindentTopLevelBlock(proofNetworkBlocks[0]) === expectedProofNetworkBlock,
    'proof overlay must define exactly one non-internal proof bridge (photo-storage-proof) with only the approved subnet',
  )
  failIf(errors,
    /^  data:\n    internal: true$/m.test(String(input.coreCompose)),
    'core data network must remain internal',
  )
  failIf(errors, /PHOTO_MEDIA_STORAGE_ENABLED: "false"/.test(String(input.coreCompose)), 'base core must remain storage-disabled without the overlay')
  failIf(errors, /infra\/onprem\/photo-storage\/secret-files\//.test(String(input.gitignore)), 'photo-storage secret files must be ignored')
  for (const marker of ['const signed = buildPresignedGet(', "'locked DeleteBucket denial'", "'stopped-volume snapshot'", "'restore into fresh labeled volume'", "'--hostname', 'object-storage'"]) {
    failIf(errors, runtimeProof.includes(marker), `runtime proof must cover ${marker}`)
  }
  failIf(errors, /assertNoSecretLeak|secret redaction|redact/i.test(runtimeProof), 'runtime proof must sanitize secret-bearing output')
  failIf(errors, /onprem-photo-storage-runtime-proof\.mjs/.test(String(input.workflow)), 'CI must invoke the storage runtime proof')
  failIf(errors, /photo-storage.*sbom|storage.*sbom/i.test(String(input.workflow)), 'CI must upload storage SBOM evidence')
  failIf(errors, /photo-storage\/LICENSE/.test(String(input.workflow)) && /d789d433cc11da163273d1e39be2e8fa67642f9a58ef220d3f258fa9c14ef613/.test(String(input.workflow)), 'CI must reconcile the pinned SeaweedFS Apache-2.0 license source')
  failIf(errors, license.includes('Apache License') && createHash('sha256').update(license).digest('hex') === 'd789d433cc11da163273d1e39be2e8fa67642f9a58ef220d3f258fa9c14ef613', 'vendored SeaweedFS 4.41 LICENSE must match the authoritative source hash')

  return { ok: errors.length === 0, errors, image: envValue(envTemplate, 'SEAWEEDFS_IMAGE') }
}

export function readPhotoStorageContractFiles(root) {
  const read = (path) => readFileSync(path, 'utf8')
  return {
    compose: read(`${root}/infra/onprem/photo-storage/compose.yaml`),
    proofCompose: read(`${root}/infra/onprem/photo-storage/compose.proof.yaml`),
    bootstrap: read(`${root}/infra/onprem/photo-storage/bootstrap.sh`),
    envTemplate: read(`${root}/infra/onprem/photo-storage/env.template`),
    license: read(`${root}/infra/onprem/photo-storage/LICENSE`),
    coreCompose: read(`${root}/infra/onprem/core/compose.yaml`),
    runtimeProof: read(`${root}/scripts/onprem-photo-storage-runtime-proof.mjs`),
    workflow: read(`${root}/.github/workflows/onprem-image-proof.yml`),
    gitignore: read(`${root}/.gitignore`),
  }
}
