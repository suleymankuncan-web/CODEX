import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

import { validateOnpremCoreContract } from './onprem-core-contract.mjs'

const read = (path) => readFileSync(path, 'utf8')

function contractInput() {
  return {
    backendDockerfile: read('infra/onprem/images/backend.Dockerfile'),
    bootstrap: read('infra/onprem/core/postgres/010-bootstrap-roles.sh'),
    caddy: read('infra/onprem/core/caddy/Caddyfile'),
    compose: read('infra/onprem/core/compose.yaml'),
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

test('ONP-2 private core contract accepts the committed fail-closed stack', () => {
  const result = validateOnpremCoreContract(contractInput())

  assert.equal(result.ok, true, result.errors.join('\n'))
  assert.deepEqual(result.services.sort(), [
    'api',
    'caddy',
    'frontend',
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
  assert.match(input.workflow, /proof:\s*\n\s+runs-on: ubuntu-latest/)
  assert.doesNotMatch(input.workflow, /^\s{2}core-runtime-proof:/m)
  assert.doesNotMatch(input.workflow, /hr-axis-onprem-(?:frontend|backend):core-proof/)
  assert.match(input.runtimeProof, /42501/)
  assert.match(input.runtimeProof, /synthetic-queue-probe\.js/)
  assert.match(input.runtimeProof, /conntrack/)
  assert.match(input.runtimeProof, /egressRejectPacketDelta/)
  assert.match(input.runtimeProof, /onprem_sequence_privilege_probe/)
  assert.match(input.runtimeProof, /setval/)
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

test('ONP-2 contract rejects an optional or unproven runtime CI gate', () => {
  const input = contractInput()
  input.workflow = input.workflow
    .replace('proof:\n    runs-on: ubuntu-latest', 'proof:\n    if: ${{ false }}\n    runs-on: [self-hosted, linux]')
    .replace('          trap cleanup EXIT', '          # cleanup trap removed')

  const result = validateOnpremCoreContract(input)

  assert.equal(result.ok, false)
  assert.ok(result.errors.some((error) => /GitHub-hosted Linux proof job/i.test(error)))
  assert.ok(result.errors.some((error) => /must not be optional/i.test(error)))
  assert.ok(result.errors.some((error) => /cleanup trap/i.test(error)))
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
