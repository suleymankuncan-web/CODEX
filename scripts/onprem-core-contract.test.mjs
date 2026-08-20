import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { test } from 'node:test'

import { validateOnpremCoreContract } from './onprem-core-contract.mjs'

const read = (path) => readFileSync(path, 'utf8').replaceAll('\r\n', '\n')

function workflowEnvValues(source, name) {
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const assignment = new RegExp(`^\\s+${escapedName}:\\s*(.+)$`)
  return String(source)
    .split(/\r?\n/)
    .map((line) => line.match(assignment)?.[1]?.trim())
    .filter((value) => value !== undefined)
}

function workflowStepActiveLines(source, name) {
  const lines = String(source).split(/\r?\n/)
  const start = lines.findIndex((line) => line === `      - name: ${name}`)
  if (start < 0) return []
  const endOffset = lines.slice(start + 1).findIndex((line) => /^      - name: /.test(line))
  const end = endOffset < 0 ? lines.length : start + 1 + endOffset
  const runOffset = lines.slice(start, end).findIndex((line) => line === '        run: |')
  if (runOffset < 0) return []
  return lines
    .slice(start + runOffset + 1, end)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'))
}

function contractInput() {
  return {
    backendDockerfile: read('infra/onprem/images/backend.Dockerfile'),
    bootstrap: read('infra/onprem/core/postgres/010-bootstrap-roles.sh'),
    caddy: read('infra/onprem/core/caddy/Caddyfile'),
    compose: read('infra/onprem/core/compose.yaml'),
    photoProofCompose: read('infra/onprem/core/compose.photo-proof.yaml'),
    envTemplate: read('infra/onprem/core/env.template'),
    frontendDockerfile: read('infra/onprem/images/frontend.Dockerfile'),
    gitignore: read('.gitignore'),
    redis: read('infra/onprem/core/redis/redis.conf'),
    rollbackDown: read('scripts/onprem-core-down.mjs'),
    runtimeProof: read('scripts/onprem-core-runtime-proof.mjs'),
    volumeDelete: read('scripts/onprem-core-delete-synthetic-volumes.mjs'),
    workflow: read('.github/workflows/onprem-image-proof.yml'),
  }
}

test('ONP-2 contract requires a capability-free tmpfs Caddy bootstrap and loopback health endpoint', () => {
  const input = contractInput()
  const result = validateOnpremCoreContract(input)

  assert.equal(result.ok, true, result.errors.join('\n'))
  assert.match(input.compose, /cp "\$\$\{source\}" "\$\$\{temporary\}"/)
  assert.match(input.compose, /copy_capabilities="\$\$\(\/usr\/sbin\/getcap/)
  assert.match(input.caddy, /http:\/\/127\.0\.0\.1:8081/)
  assert.match(input.compose, /CADDY_IMAGE:-caddy:2\.11\.4-alpine@sha256:/)
  assert.match(input.compose, /\/run\/caddy-bin:rw,nosuid,nodev,exec,size=64m,uid=10001,gid=10001,mode=0700/)
})

test('ONP-5 base Compose keeps the photo-proof contract disabled and credential-free', () => {
  const input = contractInput()

  assert.match(
    input.compose,
    /KEYCLOAK_SYNTHETIC_PHOTO_PROOF_ENABLED: \$\{KEYCLOAK_SYNTHETIC_PHOTO_PROOF_ENABLED:-false\}/,
  )
  assert.match(
    input.compose,
    /identity-binder:[\s\S]*?KEYCLOAK_SYNTHETIC_ACCOUNTS_ENABLED: \$\{KEYCLOAK_SYNTHETIC_ACCOUNTS_ENABLED:-false\}/,
  )
  assert.doesNotMatch(input.compose, /KEYCLOAK_SYNTHETIC_PHOTO_PROOF_ACCOUNT_FILE/)
  assert.doesNotMatch(input.compose, /KEYCLOAK_PHOTO_PROOF_SUBJECT_MANIFEST_FILE/)
  assert.doesNotMatch(input.compose, /keycloak_synthetic_photo_proof_account/)
})

test('ONP-5 photo-proof Compose overlay is an explicit opt-in with exact enabled mounts', () => {
  const overlayPath = 'infra/onprem/core/compose.photo-proof.yaml'
  assert.equal(existsSync(overlayPath), true, 'photo-proof overlay must be present')
  const overlay = readFileSync(overlayPath, 'utf8').replaceAll('\r\n', '\n')

  assert.match(overlay, /KEYCLOAK_SYNTHETIC_PHOTO_PROOF_ENABLED: "true"/)
  assert.match(overlay, /KEYCLOAK_SYNTHETIC_PHOTO_PROOF_ACCOUNT_FILE: \/run\/secrets\/keycloak_synthetic_photo_proof_account/)
  assert.match(overlay, /KEYCLOAK_PHOTO_PROOF_SUBJECT_MANIFEST_FILE: \/var\/lib\/keycloak-bootstrap\/photo-proof-subject\.v1\.json/)
  assert.match(overlay, /source: keycloak_synthetic_photo_proof_account[\s\S]*?target: keycloak_synthetic_photo_proof_account/)
  assert.match(overlay, /keycloak_synthetic_photo_proof_account:[\s\S]*?file: \$\{HR_AXIS_SECRET_ROOT:-\.\/secret-files\}\/keycloak\/photo-proof-account/)
})

test('ONP-2 contract rejects failed sha256sum, cmp, and getcap bootstrap verifiers in Compose and CI', () => {
  const mutations = [
    {
      compose: ['source_sha256_output="$$(sha256sum "$${source}")"', 'source_sha256_output="$$(false; printf \'a%.0s\' $$(seq 1 64))"'],
      workflow: ['source_sha256_output="$(sha256sum "${source}")"', 'source_sha256_output="$(false; printf \'a%.0s\' $(seq 1 64))"'],
    },
    {
      compose: ['cmp -s "$${source}" "$${temporary}"', 'false # cmp -s "$${source}" "$${temporary}"'],
      workflow: ['cmp -s "${source}" "${temporary}"', 'false # cmp -s "${source}" "${temporary}"'],
    },
    {
      compose: ['copy_capabilities="$$(/usr/sbin/getcap "$${temporary}")"', 'copy_capabilities="$$(false)" # /usr/sbin/getcap "$${temporary}"'],
      workflow: ['copy_capabilities="$(/usr/sbin/getcap "${temporary}")"', 'copy_capabilities="$(false)" # /usr/sbin/getcap "${temporary}"'],
    },
  ]

  for (const mutation of mutations) {
    for (const surface of ['compose', 'workflow']) {
      const input = contractInput()
      input[surface] = input[surface].replace(mutation[surface][0], () => mutation[surface][1])
      assert.equal(input[surface].includes(mutation[surface][1]), true, `${surface} mutation fixture must apply`)
      assert.equal(validateOnpremCoreContract(input).ok, false, `${surface} verifier failure must fail closed`)
    }
  }

  const missingNegativeProof = contractInput()
  missingNegativeProof.workflow = missingNegativeProof.workflow.replace(
    'for verifier in sha256sum cmp getcap; do',
    'for verifier in sha256sum cmp; do',
  )
  assert.equal(validateOnpremCoreContract(missingNegativeProof).ok, false)
})

test('ONP-2 workflow verifier proof requires active commands rather than comments or strings', () => {
  for (const [active, inert] of [
    [
      'for verifier in sha256sum cmp getcap; do',
      '# for verifier in sha256sum cmp getcap; do',
    ],
    [
      'test "$verifier_status" -eq 42',
      'description=\'test "$verifier_status" -eq 42\'',
    ],
    [
      'grep -Fqx "verifier-failed-$verifier" <<< "$verifier_output"',
      'printf \'%s\\n\' \'grep -Fqx "verifier-failed-$verifier" <<< "$verifier_output"\'',
    ],
  ]) {
    const input = contractInput()
    input.workflow = input.workflow.replace(active, () => inert)
    assert.equal(input.workflow.includes(inert), true, 'workflow inert-text fixture must apply')
    assert.equal(validateOnpremCoreContract(input).ok, false)
  }
})

test('ONP-2 workflow makes the mounted verifier directory traversable by the non-root Caddy user', () => {
  const input = contractInput()
  input.workflow = input.workflow.replace(
    'chmod 0755 "$verifier_failure_root"',
    '# chmod 0755 "$verifier_failure_root"',
  )
  assert.equal(validateOnpremCoreContract(input).ok, false)
})

test('ONP-2 contract validates active bootstrap commands instead of comments, strings, or alternate exec text', () => {
  const mutations = [
    ['cmp -s "$${source}" "$${temporary}"', '# cmp -s "$${source}" "$${temporary}"'],
    ['cp "$${source}" "$${temporary}"', 'description=\'cp "$${source}" "$${temporary}"\''],
    ['exec "$${destination}" run --config /etc/caddy/Caddyfile --adapter caddyfile', 'printf \'%s\\n\' \'exec "$${destination}" run --config /etc/caddy/Caddyfile --adapter caddyfile\''],
  ]

  for (const mutation of mutations) {
    const input = contractInput()
    input.compose = input.compose.replace(mutation[0], () => mutation[1])
    assert.equal(input.compose.includes(mutation[1]), true, 'Compose bypass fixture must apply')
    assert.equal(validateOnpremCoreContract(input).ok, false)
  }
})

test('ONP-2 contract rejects Caddy capability, direct source execution, incomplete bootstrap, and unsupported wget regressions', () => {
  const input = contractInput()
  input.compose = input.compose
    .replace('cap_drop: [ALL]', 'cap_drop: [ALL]\n    cap_add: [NET_BIND_SERVICE]')
    .replace('test -z "$${copy_capabilities}"', '# getcap proof removed')
    .replace('exec "$${destination}" run', 'exec /usr/bin/caddy run')
    .replace('/run/caddy-bin:rw,nosuid,nodev,exec,', '/run/caddy-bin:rw,nosuid,nodev,noexec,')
    .replace('wget -q -O /dev/null http://127.0.0.1:8081/healthz', 'wget -q --no-check-certificate -O /dev/null https://0.0.0.0:8443/healthz')
  const result = validateOnpremCoreContract(input)

  assert.equal(result.ok, false)
  assert.ok(result.errors.some((error) => /cap_add/i.test(error)))
  assert.ok(result.errors.some((error) => /exact active fail-closed/i.test(error)))
  assert.ok(result.errors.some((error) => /never execute.*upstream path/i.test(error)))
  assert.ok(result.errors.some((error) => /executable tmpfs|must not include noexec/i.test(error)))
  assert.ok(result.errors.some((error) => /unsupported wget/i.test(error)))
})

test('ONP-2 contract rejects broader executable tmpfs mounts or loss of nosuid/nodev', () => {
  for (const replacement of [
    '/run/caddy-bin:rw,nodev,exec,size=64m,uid=10001,gid=10001,mode=0700',
    '/run/caddy-bin:rw,nosuid,exec,size=64m,uid=10001,gid=10001,mode=0700',
    '/run/caddy-bin:rw,nosuid,nodev,size=64m,uid=10001,gid=10001,mode=0700',
  ]) {
    const input = contractInput()
    input.compose = input.compose.replace(
      '/run/caddy-bin:rw,nosuid,nodev,exec,size=64m,uid=10001,gid=10001,mode=0700',
      replacement,
    )
    assert.equal(validateOnpremCoreContract(input).ok, false)
  }
  const broadened = contractInput()
  broadened.compose = broadened.compose.replace(
    '/tmp:rw,noexec,nosuid,size=16m,uid=10001,gid=10001',
    '/tmp:rw,exec,nosuid,size=16m,uid=10001,gid=10001',
  )
  assert.ok(validateOnpremCoreContract(broadened).errors.some((error) => /broaden executable tmpfs/i.test(error)))
})

test('ONP-5 deterministic seed provides an active retention policy for synthetic photo uploads', () => {
  const seed = read('db/seeds/001_reference_seed.sql')
  assert.match(seed, /INSERT INTO ops\.evidence_retention_policy\s*\([\s\S]*?\)\s*VALUES\s*\([\s\S]*?'72000000-0000-4000-8000-000000000001'[\s\S]*?'00000000-0000-0000-0000-000000000001'[\s\S]*?\b1,\s*365,\s*365,\s*30,\s*NOW\(\)[\s\S]*?'80000000-0000-0000-0000-000000000001'[\s\S]*?\)\s*ON CONFLICT \(company_id, version_no\) DO NOTHING;/i)
})

test('ONP-2 workflow binds the Caddy bootstrap proof to an exact immutable image reference', () => {
  const input = contractInput()
  const pinned = /^  CADDY_IMAGE: caddy:2\.11\.4-alpine@sha256:5f5c8640aae01df9654968d946d8f1a56c497f1dd5c5cda4cf95ab7c14d58648\r?$/m
  assert.match(input.workflow, pinned)

  input.workflow = input.workflow.replace(pinned, '  CADDY_IMAGE: caddy:latest')
  const result = validateOnpremCoreContract(input)
  assert.equal(result.ok, false)
  assert.ok(result.errors.some((error) => /workflow.*exact pinned Caddy image/i.test(error)))
})

test('ONP-2 shipping and proof paths share only the approved Caddy 2.11.4 identity', () => {
  const approved = 'caddy:2.11.4-alpine@sha256:5f5c8640aae01df9654968d946d8f1a56c497f1dd5c5cda4cf95ab7c14d58648'
  const retiredDigest = '4c6e91c6ed0e2fa03efd5b44747b625fec79bc9cd06ac5235a779726618e530d'
  const pinnedPaths = [
    '.github/workflows/onprem-image-proof.yml',
    '.github/workflows/onprem-offline-proof.yml',
    'infra/onprem/core/compose.yaml',
    'infra/onprem/core/env.template',
    'scripts/onprem-caddy-runtime-proof.mjs',
    'scripts/onprem-core-contract.mjs',
    'scripts/onprem-photo-storage-runtime-proof.mjs',
  ]

  for (const path of pinnedPaths) {
    const source = read(path)
    const normalizedSource = path === 'scripts/onprem-core-contract.mjs' ? source.replaceAll('\\', '') : source
    assert.ok(normalizedSource.includes(approved), `${path} must use the approved Caddy image identity`)
    assert.ok(!source.includes(retiredDigest), `${path} must not retain the retired Caddy image digest`)
  }
})

test('ONP-2 shipping and proof paths share only the approved PostgreSQL 16.15 identity', () => {
  const approved = 'postgres:16.15-alpine@sha256:44c4ee9810eff91f7eab4d822642e01115b1a9eccce4bcbdde7604752d68eac6'
  const retiredDigest = '029660641a0cfc575b14f336ba448fb8a75fd595d42e1fa316b9fb4378742297'
  const pinnedPaths = [
    '.github/workflows/onprem-offline-proof.yml',
    'infra/onprem/core/compose.yaml',
    'infra/onprem/core/env.template',
    'scripts/onprem-photo-storage-runtime-proof.mjs',
  ]

  for (const path of pinnedPaths) {
    const source = read(path)
    assert.ok(source.includes(approved), `${path} must use the approved PostgreSQL image identity`)
    assert.ok(!source.includes(retiredDigest), `${path} must not retain the retired PostgreSQL image digest`)
  }
})

test('ONP-2 shipping and proof paths share only the approved Redis 7.4.10 identity', () => {
  const approved = 'redis:7.4.10-alpine@sha256:e7723ff73d963f5cc6d9c4643ea3d989527a402a319239054e9472a7fb9219a2'
  const retiredDigest = '3b73847e72874be07e6657b129a94761662b79bc0f679273757d4218573b2a98'
  const pinnedPaths = [
    'infra/onprem/core/compose.yaml',
    'infra/onprem/core/env.template',
    'scripts/onprem-core-contract.mjs',
  ]

  for (const path of pinnedPaths) {
    const source = read(path)
    const normalizedSource = path === 'scripts/onprem-core-contract.mjs' ? source.replaceAll('\\', '') : source
    assert.ok(normalizedSource.includes(approved), `${path} must use the approved Redis image identity`)
    assert.ok(!source.includes(retiredDigest), `${path} must not retain the retired Redis image digest`)
  }

  const offlineWorkflow = read('.github/workflows/onprem-offline-proof.yml')
  assert.deepEqual(workflowEnvValues(offlineWorkflow, 'REDIS_IMAGE'), [approved])
  const vendorLines = workflowStepActiveLines(offlineWorkflow, 'Pull pinned vendor images and save immutable archives')
  const metadataLines = workflowStepActiveLines(offlineWorkflow, 'Generate complete offline metadata and migration compatibility evidence')
  const runtimePin = `test "$REDIS_IMAGE" = '${approved}'`
  const runtimeReadonly = 'readonly CADDY_IMAGE CADDY_CONFIG_IMAGE_ID POSTGRES_IMAGE POSTGRES_CONFIG_IMAGE_ID REDIS_IMAGE REDIS_CONFIG_IMAGE_ID SEAWEEDFS_IMAGE SEAWEEDFS_CONFIG_IMAGE_ID'
  const redisVendorArm = 'redis) ref="$REDIS_IMAGE"; image_id="$REDIS_CONFIG_IMAGE_ID" ;;'
  const metadataGuard = "if (expectedVendorConfigImageIds[name] && imageIds[name] !== expectedVendorConfigImageIds[name]) throw new Error('vendor config image ID mismatch')"
  assert.equal(vendorLines.filter((line) => line === runtimePin).length, 1)
  assert.equal(vendorLines.filter((line) => line === runtimeReadonly).length, 1)
  assert.equal(vendorLines.filter((line) => line === redisVendorArm).length, 1)
  assert.ok(vendorLines.indexOf(runtimeReadonly) > vendorLines.indexOf(runtimePin))
  assert.ok(vendorLines.indexOf(runtimeReadonly) < vendorLines.indexOf(redisVendorArm))
  assert.ok(vendorLines.indexOf(redisVendorArm) < vendorLines.indexOf('docker pull "$ref"'))
  assert.equal(metadataLines.filter((line) => line.startsWith('const vendorRefs = Object.freeze({')).length, 1)
  assert.ok(metadataLines.some((line) => line.includes(`redis: '${approved}'`)))
  assert.ok(metadataLines.some((line) => line.includes("redis: 'sha256:2a51817f79255c8b69f86a974459c2e0359aff81417d80158f2b9e541e6f4b33'")))
  assert.ok(metadataLines.every((line) => !line.includes('redis: process.env.REDIS_IMAGE')))
  assert.equal(metadataLines.filter((line) => line === metadataGuard).length, 1)
  assert.ok(metadataLines.indexOf(metadataGuard) > metadataLines.indexOf('for (const name of imageNames) {'))
  assert.ok(metadataLines.indexOf(metadataGuard) < metadataLines.findIndex((line) => line.startsWith('const archive = inspectDockerSaveArchive(')))
  assert.ok(!offlineWorkflow.includes(retiredDigest), 'offline workflow must not retain the retired Redis image digest')

  const runtimeProof = read('scripts/onprem-photo-storage-runtime-proof.mjs')
  assert.ok(!runtimeProof.includes(retiredDigest), 'photo runtime proof must not retain the retired Redis image digest')
})

test('ONP-2 offline workflow Redis pin check rejects comments and narrower-scope overrides', () => {
  const approved = 'redis:7.4.10-alpine@sha256:e7723ff73d963f5cc6d9c4643ea3d989527a402a319239054e9472a7fb9219a2'
  const wrong = `redis:7.4.10-alpine@sha256:${'f'.repeat(64)}`
  const runtimeReadonly = 'readonly CADDY_IMAGE CADDY_CONFIG_IMAGE_ID POSTGRES_IMAGE POSTGRES_CONFIG_IMAGE_ID REDIS_IMAGE REDIS_CONFIG_IMAGE_ID SEAWEEDFS_IMAGE SEAWEEDFS_CONFIG_IMAGE_ID'
  const metadataGuard = "if (expectedVendorConfigImageIds[name] && imageIds[name] !== expectedVendorConfigImageIds[name]) throw new Error('vendor config image ID mismatch')"
  const source = read('.github/workflows/onprem-offline-proof.yml')
  const mutations = [
    source.replace(
      `  REDIS_IMAGE: ${approved}`,
      `  # REDIS_IMAGE: ${approved}\n  REDIS_IMAGE: ${wrong}`,
    ),
    source.replace(
      '  build_bundle:\n',
      `  build_bundle:\n    env:\n      REDIS_IMAGE: ${wrong}\n`,
    ),
    source.replace(
      '      - name: Pull pinned vendor images and save immutable archives\n',
      `      - name: Pull pinned vendor images and save immutable archives\n        env:\n          REDIS_IMAGE: ${wrong}\n`,
    ),
  ]

  for (const workflow of mutations) {
    assert.notDeepEqual(workflowEnvValues(workflow, 'REDIS_IMAGE'), [approved])
  }

  const missingRuntimeGate = source.replace(
    `          test "$REDIS_IMAGE" = '${approved}'`,
    `          # test "$REDIS_IMAGE" = '${approved}'`,
  )
  assert.equal(
    workflowStepActiveLines(missingRuntimeGate, 'Pull pinned vendor images and save immutable archives')
      .includes(`test "$REDIS_IMAGE" = '${approved}'`),
    false,
  )

  const mutableAfterCheck = source.replace(
    `          ${runtimeReadonly}`,
    `          # ${runtimeReadonly}`,
  )
  assert.equal(
    workflowStepActiveLines(mutableAfterCheck, 'Pull pinned vendor images and save immutable archives')
      .includes(runtimeReadonly),
    false,
  )

  const mutableMetadata = source.replace(
    `redis: '${approved}'`,
    `redis: '${wrong}'`,
  )
  assert.equal(
    workflowStepActiveLines(mutableMetadata, 'Generate complete offline metadata and migration compatibility evidence')
      .some((line) => line.includes(`redis: '${approved}'`)),
    false,
  )

  const missingMetadataGuard = source.replace(
    `          ${metadataGuard}`,
    `          // ${metadataGuard}`,
  )
  assert.equal(
    workflowStepActiveLines(missingMetadataGuard, 'Generate complete offline metadata and migration compatibility evidence')
      .includes(metadataGuard),
    false,
  )

  for (const wrongArm of [
    'redis) ref="$SEAWEEDFS_IMAGE"; image_id="$REDIS_CONFIG_IMAGE_ID" ;;',
    `redis) ref="${wrong}"; image_id="$REDIS_CONFIG_IMAGE_ID" ;;`,
  ]) {
    const wrongRedisConsumer = source.replace('redis) ref="$REDIS_IMAGE"; image_id="$REDIS_CONFIG_IMAGE_ID" ;;', wrongArm)
    assert.equal(
      workflowStepActiveLines(wrongRedisConsumer, 'Pull pinned vendor images and save immutable archives')
        .includes('redis) ref="$REDIS_IMAGE"; image_id="$REDIS_CONFIG_IMAGE_ID" ;;'),
      false,
    )
  }
})

test('ONP-2 contract rejects any Redis image identity other than the approved security pin', () => {
  const input = contractInput()
  input.compose = input.compose.replace(
    'redis:7.4.10-alpine@sha256:e7723ff73d963f5cc6d9c4643ea3d989527a402a319239054e9472a7fb9219a2',
    'redis:7.4.10-alpine@sha256:' + 'f'.repeat(64),
  )

  const result = validateOnpremCoreContract(input)
  assert.equal(result.ok, false)
  assert.ok(result.errors.some((error) => /exactly one active pinned upstream Redis image identity/i.test(error)))
})

test('ONP-2 contract rejects Redis image comment decoys and duplicate active image keys', () => {
  const approvedLine = '    image: ${REDIS_IMAGE:-redis:7.4.10-alpine@sha256:e7723ff73d963f5cc6d9c4643ea3d989527a402a319239054e9472a7fb9219a2}'
  const wrongLine = '    image: redis:7.4.10-alpine@sha256:' + 'f'.repeat(64)

  for (const replacement of [
    `    # ${approvedLine.trim()}\n${wrongLine}`,
    `${approvedLine}\n${wrongLine}`,
  ]) {
    const input = contractInput()
    input.compose = input.compose.replace(approvedLine, replacement)
    assert.equal(input.compose.includes(replacement), true, 'Redis image bypass fixture must apply')

    const result = validateOnpremCoreContract(input)
    assert.equal(result.ok, false)
    assert.ok(result.errors.some((error) => /exactly one active pinned upstream Redis image identity/i.test(error)))
  }
})

test('ONP-2 contract rejects every Compose-supported duplicate Redis env assignment form', () => {
  const wrong = `redis:7.4.10-alpine@sha256:${'f'.repeat(64)}`
  for (const assignment of [
    `REDIS_IMAGE=${wrong}`,
    `REDIS_IMAGE = ${wrong}`,
    `REDIS_IMAGE: ${wrong}`,
    `export REDIS_IMAGE=${wrong}`,
  ]) {
    const input = contractInput()
    input.envTemplate += `\n${assignment}\n`

    const result = validateOnpremCoreContract(input)
    assert.equal(result.ok, false, `${assignment} must be counted as an active Redis assignment`)
    assert.ok(result.errors.some((error) => /exactly one active pinned upstream Redis image identity/i.test(error)))
  }
})

test('ONP-2 private core contract accepts the committed fail-closed stack', () => {
  const result = validateOnpremCoreContract(contractInput())

  assert.equal(result.ok, true, result.errors.join('\n'))
  assert.deepEqual(result.services.sort(), [
    'api',
    'caddy',
    'frontend',
    'identity-binder',
    'keycloak',
    'keycloak-bootstrap',
    'migrator',
    'postgres',
    'redis',
    'synthetic-seed',
    'worker',
  ])
})

test('ONP-2 contract rejects a private service host-port bypass', () => {
  const input = contractInput()
  input.compose = input.compose.replace(
    '    expose:\n      - "5432"',
    '    ports:\n      - "5432:5432"',
  )

  const result = validateOnpremCoreContract(input)

  assert.equal(result.ok, false)
  assert.ok(result.errors.some((error) => /only caddy may publish host ports/i.test(error)))
})

test('ONP-2 contract rejects plaintext sensitive environment values', () => {
  const input = contractInput()
  input.compose = input.compose.replace(
    '      DATABASE_URL_FILE: /run/secrets/api_database_url',
    '      DATABASE_URL: postgres://runtime:plaintext@postgres:5432/hr_axis',
  )

  const result = validateOnpremCoreContract(input)

  assert.equal(result.ok, false)
  assert.ok(result.errors.some((error) => /sensitive environment variable must use a _FILE boundary/i.test(error)))
})

test('ONP-2 contract rejects tag-only application images and build directives', () => {
  const input = contractInput()
  input.compose = input.compose.replace(
    'image: ${HR_AXIS_BACKEND_IMAGE:?set an immutable backend image reference}',
    'image: registry.example.invalid/hr-axis/backend:latest\n    build: ../..',
  )
  input.envTemplate = input.envTemplate.replace(/@sha256:[0-9a-f]{64}/, ':latest')

  const result = validateOnpremCoreContract(input)

  assert.equal(result.ok, false)
  assert.ok(result.errors.some((error) => /compose must never build images/i.test(error)))
  assert.ok(result.errors.some((error) => /immutable application image/i.test(error)))
})

test('ONP-2 contract rejects loss of internal network isolation and runtime migration coupling', () => {
  const input = contractInput()
  input.compose = input.compose
    .replace('  data:\n    internal: true', '  data:\n    internal: false')
    .replace(
      '      redis:\n        condition: service_healthy',
      '      redis:\n        condition: service_healthy\n      migrator:\n        condition: service_completed_successfully',
    )

  const result = validateOnpremCoreContract(input)

  assert.equal(result.ok, false)
  assert.ok(result.errors.some((error) => /proxy, app, and data networks must be internal/i.test(error)))
  assert.ok(result.errors.some((error) => /runtime services must not auto-run or depend on migrations/i.test(error)))
})

test('ONP-2 contract rejects Caddy OCSP egress and incomplete restart identity proof', () => {
  const input = contractInput()
  input.caddy = input.caddy.replace('  ocsp_stapling off\n', '')
  input.runtimeProof = input.runtimeProof.replace(
    "    assertPersistenceIdentity('full project restart')\n",
    '',
  )

  const result = validateOnpremCoreContract(input)

  assert.equal(result.ok, false)
  assert.ok(result.errors.some((error) => /disable external OCSP/i.test(error)))
  assert.ok(result.errors.some((error) => /complete seed aggregate and migration ledger/i.test(error)))
})

test('ONP-2 contract pins database least privilege, Redis durability, and exact steady ceilings', () => {
  const input = contractInput()
  const result = validateOnpremCoreContract(input)

  assert.equal(result.ok, true, result.errors.join('\n'))
  assert.match(input.bootstrap, /NOINHERIT NOCREATEDB NOCREATEROLE/)
  assert.match(input.bootstrap, /REVOKE CREATE ON SCHEMA public FROM PUBLIC/)
  assert.match(input.bootstrap, /ALTER DEFAULT PRIVILEGES FOR ROLE hr_axis_migrator/)
  assert.match(input.redis, /appendonly yes/)
  assert.match(input.redis, /appendfsync everysec/)
  assert.match(input.redis, /maxmemory-policy noeviction/)
  assert.match(input.workflow, /onprem-core-runtime-proof\.mjs/)
  assert.match(input.workflow, /  proof:\r?\n    needs: source-preflight\r?\n    runs-on: ubuntu-latest/)
  assert.doesNotMatch(input.workflow, /^\s{2}core-runtime-proof:/m)
  assert.doesNotMatch(input.workflow, /hr-axis-onprem-(?:frontend|backend):core-proof/)
  assert.match(input.runtimeProof, /42501/)
  assert.match(input.runtimeProof, /synthetic-queue-probe\.js/)
  assert.match(input.runtimeProof, /conntrack/)
  assert.match(input.runtimeProof, /egressRejectPacketDelta/)
  assert.match(input.runtimeProof, /onprem_sequence_privilege_probe/)
  assert.match(input.runtimeProof, /setval/)
})

test('ONP-3B fresh-Linux Keycloak bootstrap rehearsal uses the corrected one-shot ceiling', () => {
  const input = contractInput()
  assert.match(input.compose, /keycloak-bootstrap:[\s\S]*?cpus: 1\.5\n    mem_limit: 1g\n    pids_limit: 128/)
  assert.equal(validateOnpremCoreContract(input).ok, true)

  const underprovisioned = {
    ...input,
    compose: input.compose.replace(
      '    cpus: 1.5\n    mem_limit: 1g\n    pids_limit: 128',
      '    cpus: 0.5\n    mem_limit: 512m\n    pids_limit: 128',
    ),
  }
  const result = validateOnpremCoreContract(underprovisioned)
  assert.equal(result.ok, false)
  assert.ok(result.errors.some((error) => /keycloak-bootstrap.*CPU|keycloak-bootstrap.*memory/i.test(error)))
})

test('ONP-2 contract keeps the Redis default user disabled while permitting internal AOF replay', () => {
  const accepted = contractInput()
  assert.match(accepted.workflow, /user default off resetpass ~\* &\* \+@all\\nuser health on/)
  assert.equal(validateOnpremCoreContract(accepted).ok, true)

  for (const declaration of [
    'user default off resetpass ~* &*',
    'user default on resetpass ~* &* +@all',
    'user default off nopass ~* &* +@all',
    'user default off resetpass &* +@all',
    'user default off resetpass ~* +@all',
  ]) {
    const input = contractInput()
    input.workflow = input.workflow.replace(
      'user default off resetpass ~* &* +@all',
      declaration,
    )
    assert.equal(validateOnpremCoreContract(input).ok, false, `${declaration} must fail closed`)
    assert.ok(input.workflow.includes(declaration), 'ACL mutation fixture must apply')
  }

  const alternateWriter = contractInput()
  alternateWriter.workflow = alternateWriter.workflow.replace(
    '"$redis_health_password" "$redis_api_password" "$redis_worker_password" > "$secret_root/redis/users.acl"',
    '"$redis_health_password" "$redis_api_password" "$redis_worker_password" > /dev/null\n          cp "$RUNNER_TEMP/unsafe-users.acl" "$secret_root/redis/users.acl"',
  )
  assert.ok(alternateWriter.workflow.includes('unsafe-users.acl'), 'alternate writer fixture must apply')
  assert.equal(validateOnpremCoreContract(alternateWriter).ok, false, 'approved inert ACL text plus an alternate writer must fail closed')
})

test('ONP-2 contract rejects an injected init shim for privilege-dropping data services', () => {
  for (const service of ['postgres', 'redis']) {
    const input = contractInput()
    input.compose = input.compose.replace(
      `  ${service}:\n    image:`,
      `  ${service}:\n    init: true\n    image:`,
    )
    const result = validateOnpremCoreContract(input)

    assert.equal(result.ok, false)
    assert.ok(result.errors.some((error) => new RegExp(`${service} must receive stop signals directly`, 'i').test(error)))
  }
})

test('ONP-2 contract rejects runtime sequence mutation capability', () => {
  const input = contractInput()
  input.bootstrap = input.bootstrap.replace(
    'GRANT SELECT, USAGE ON SEQUENCES',
    'GRANT SELECT, USAGE, UPDATE ON SEQUENCES',
  )

  const result = validateOnpremCoreContract(input)

  assert.equal(result.ok, false)
  assert.ok(result.errors.some((error) => /sequence mutation/i.test(error)))
})

test('ONP-2 contract rejects boolean concatenation in the sequence privilege probe', () => {
  const input = contractInput()
  input.runtimeProof = input.runtimeProof.replace(
    "), has_sequence_privilege('hr_axis_api'",
    ") || '|' || has_sequence_privilege('hr_axis_api'",
  )

  const result = validateOnpremCoreContract(input)

  assert.equal(result.ok, false)
  assert.ok(result.errors.some((error) => /separate boolean columns/i.test(error)))
})

test('ONP-2 contract rejects ambiguous PostgreSQL boolean migration identity serialization', () => {
  const input = contractInput()
  input.runtimeProof = input.runtimeProof.replace(
    "CASE WHEN bool_and(status = 'succeeded') THEN 't' ELSE 'f' END",
    "bool_and(status = 'succeeded')",
  )

  const result = validateOnpremCoreContract(input)

  assert.equal(result.ok, false)
  assert.ok(result.errors.some((error) => /canonical t\/f migration identity/i.test(error)))
})

test('ONP-2 contract rejects an optional or unproven runtime CI gate', () => {
  const input = contractInput()
  input.workflow = input.workflow
    .replace('  proof:\n    needs: source-preflight\n    runs-on: ubuntu-latest', '  proof:\n    needs: source-preflight\n    if: ${{ false }}\n    runs-on: [self-hosted, linux]')
    .replace('          trap cleanup EXIT', '          # cleanup trap removed')

  const result = validateOnpremCoreContract(input)

  assert.equal(result.ok, false)
  assert.ok(result.errors.some((error) => /GitHub-hosted Linux proof job/i.test(error)))
  assert.ok(result.errors.some((error) => /must not be optional/i.test(error)))
  assert.ok(result.errors.some((error) => /cleanup trap/i.test(error)))
})

test('ONP-2 contract requires conntrack provisioning and read-only preflight before firewall mutation', () => {
  for (const activeLine of [
    'sudo apt-get update',
    'sudo env DEBIAN_FRONTEND=noninteractive apt-get install --yes --no-install-recommends conntrack',
    'sudo conntrack -L -o extended >/dev/null',
  ]) {
    const input = contractInput()
    input.workflow = input.workflow.replace(activeLine, `# ${activeLine}`)
    assert.ok(input.workflow.includes(`# ${activeLine}`), 'conntrack mutation fixture must apply')
    assert.equal(validateOnpremCoreContract(input).ok, false, `${activeLine} must remain active`)
  }

  const lateProvisioning = contractInput()
  lateProvisioning.workflow = lateProvisioning.workflow.replace(
    'sudo conntrack -L -o extended >/dev/null\n          firewall_snapshot="$RUNNER_TEMP/onprem-core-iptables.before"',
    'firewall_snapshot="$RUNNER_TEMP/onprem-core-iptables.before"\n          sudo conntrack -L -o extended >/dev/null',
  )
  assert.equal(validateOnpremCoreContract(lateProvisioning).ok, false, 'conntrack preflight after firewall mutation must fail closed')
})

test('ONP-2 contract keeps wrong-host verification distinct from the valid TLS SNI', () => {
  const input = contractInput()
  const active = "const wrongHostname = runTlsProbe({ caPath: approvedCaPath, host: publicHost, label: 'wrong-hostname TLS rejection proof', verifyHost: 'wrong-host.example.invalid' })"
  assert.equal(input.runtimeProof.includes(active), true, 'wrong-host fixture must use the production SNI with a distinct verify hostname')
  input.runtimeProof = input.runtimeProof.replace(
    active,
    "const wrongHostname = runTlsProbe({ caPath: approvedCaPath, host: publicHost, label: 'wrong-hostname TLS rejection proof', verifyHost: publicHost })",
  )
  assert.equal(validateOnpremCoreContract(input).ok, false)
})

test('ONP-2 contract preserves bounded unexpected TLS codes for rejected diagnostics', () => {
  const input = contractInput()
  const active = "request.on('error',error=>{emit({result:'tls_error',code:sanitizeTlsErrorCode(error?.code)},20)})"
  assert.equal(input.runtimeProof.includes(active), true, 'runtime probe must use the shared bounded sanitizer')
  input.runtimeProof = input.runtimeProof.replace(
    active,
    "request.on('error',error=>{emit({result:'tls_error',code:'UNKNOWN_TLS_ERROR'},20)})",
  )
  assert.equal(validateOnpremCoreContract(input).ok, false)
})

test('ONP-2 contract rejects a duplicated Node binary in Redis ACL probes', () => {
  const input = contractInput()
  const active = "compose(buildRedisProbeComposeArgs(service, script), ['runtime'], `${service} Redis destructive-command denial probe`)"
  assert.equal(input.runtimeProof.includes(active), true, 'Redis probe must use the entrypoint-safe argument builder')
  input.runtimeProof = input.runtimeProof.replace(
    active,
    "compose(['run', '--rm', '--no-deps', service, '/nodejs/bin/node', '-e', script], ['runtime'])",
  )
  assert.equal(validateOnpremCoreContract(input).ok, false)
})

test('ONP-2 contract rejects invented auth keys and disabled-provider credential surfaces', () => {
  const input = contractInput()
  input.compose = input.compose
    .replace('AUTH_PROVIDER_KEY: oidc', 'AUTH_PROVIDER_KEY: onprem')
    .replace('      ERROR_TRACKING_ENABLED: "false"', '      ERROR_TRACKING_ENABLED: "false"\n      SENTRY_DSN: disabled-but-present')

  const result = validateOnpremCoreContract(input)

  assert.equal(result.ok, false)
  assert.ok(result.errors.some((error) => /auth provider key must remain oidc/i.test(error)))
  assert.ok(result.errors.some((error) => /disabled providers must omit/i.test(error)))
})
