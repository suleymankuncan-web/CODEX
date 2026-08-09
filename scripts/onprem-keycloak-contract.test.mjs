import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

import { KEYCLOAK_IMAGE, isStrictHttpsOrigin, validateOnpremKeycloakContract } from './onprem-keycloak-contract.mjs'

const read = (path) => readFileSync(path, 'utf8')

function input() {
  return {
    backendDockerfile: read('infra/onprem/images/backend.Dockerfile'),
    keycloakDockerfile: read('infra/onprem/images/keycloak.Dockerfile'),
    bootstrapScript: read('infra/onprem/core/keycloak/bootstrap.sh'),
    bootstrapSql: read('infra/onprem/core/postgres/010-bootstrap-roles.sh'),
    caddy: read('infra/onprem/core/caddy/Caddyfile'),
    compose: read('infra/onprem/core/compose.yaml'),
    envTemplate: read('infra/onprem/core/env.template'),
    realmConfig: read('infra/onprem/core/keycloak/realm-config.json'),
    personaSeed: read('db/seeds/002_onprem_keycloak_personas.sql'),
    workflow: read('.github/workflows/onprem-image-proof.yml'),
  }
}

test('ONP-3B Keycloak contract accepts the committed optimized runtime shape', () => {
  const baseline = input()
  const result = validateOnpremKeycloakContract(baseline)
  assert.equal(result.ok, true, result.errors.join('; '))
  assert.equal(result.errors.length, 0)
})

test('ONP-3B contract rejects tag-only or wrong Keycloak image identities', () => {
  const mutated = input()
  mutated.compose = mutated.compose.replace('${KEYCLOAK_IMAGE:?set an immutable built Keycloak image reference}', 'quay.io/keycloak/keycloak:latest')
  mutated.envTemplate = mutated.envTemplate.replace(KEYCLOAK_IMAGE, 'quay.io/keycloak/keycloak:latest')
  const result = validateOnpremKeycloakContract(mutated)
  assert.equal(result.ok, false)
  assert.ok(result.errors.some((error) => /pinned.*Keycloak|exact pinned|immutable built/i.test(error)))
})

test('ONP-3B contract rejects start-dev and public Keycloak admin paths', () => {
  const mutated = input()
  mutated.compose = mutated.compose.replace('start --optimized', 'start-dev')
  mutated.caddy = mutated.caddy.replace('respond @authAdmin `{"error":"not_found"}` 404', 'reverse_proxy @authAdmin keycloak:8080')
  const result = validateOnpremKeycloakContract(mutated)
  assert.equal(result.ok, false)
  assert.ok(result.errors.some((error) => /start-dev/i.test(error)))
  assert.ok(result.errors.some((error) => /admin/i.test(error)))
})

test('ONP-3B contract rejects steady CPU and memory overcommit', () => {
  const mutated = input()
  mutated.compose = mutated.compose.replace('    cpus: 0.5\n    mem_limit: 2048m\n    pids_limit: 256', '    cpus: 1.5\n    mem_limit: 3072m\n    pids_limit: 256')
  const result = validateOnpremKeycloakContract(mutated)
  assert.equal(result.ok, false)
  assert.ok(result.errors.some((error) => /CPU|memory/i.test(error)))
})

test('ONP-3B contract rejects plaintext bootstrap credentials and realm users', () => {
  const mutated = input()
  mutated.realmConfig = `${mutated.realmConfig}\n  "users": [{"username":"synthetic","credentials":[{"value":"not-a-secret"}]}]`
  mutated.compose = mutated.compose.replace('KEYCLOAK_DATABASE_PASSWORD_FILE: /run/secrets/keycloak_database_password', 'KEYCLOAK_DATABASE_PASSWORD: plaintext-password')
  const result = validateOnpremKeycloakContract(mutated)
  assert.equal(result.ok, false)
  assert.ok(result.errors.some((error) => /realm.*users|secret-file|secret/i.test(error)))
})

test('ONP-3B contract requires the temporary-principal deletion and private subject manifest', () => {
  const mutated = input()
  const deletionMarker = 'kcadm_quiet delete "clients/$bootstrap_client_uuid" -r master'
  assert.ok(mutated.bootstrapScript.includes(deletionMarker))
  mutated.bootstrapScript = mutated.bootstrapScript.replace(deletionMarker, '# deletion removed')
  const result = validateOnpremKeycloakContract(mutated)
  assert.equal(result.ok, false)
  assert.ok(result.errors.some((error) => /temporary (?:principal|master service client)/i.test(error)))
})

test('ONP-3B contract rejects secret-bearing kcadm argv and weak password reset forms', () => {
  const baseline = input()
  const secretArg = baseline.bootstrapScript.replace(
    'cat "$bootstrap_password_file" | KCADM_CONFIG="$config_file" /opt/keycloak/bin/kcadm.sh config credentials',
    'KCADM_CONFIG="$config_file" /opt/keycloak/bin/kcadm.sh config credentials --secret "$bootstrap_password"',
  )
  const secretResult = validateOnpremKeycloakContract({ ...baseline, bootstrapScript: secretArg })
  assert.equal(secretResult.ok, false)
  assert.ok(secretResult.errors.some((error) => /argv|stdin|secret/i.test(error)))
  const passwordArg = baseline.bootstrapScript.replace(
    'update "users/$user_uuid/reset-password" -r "$realm" -f "$password_file" -n',
    'set-password -r "$realm" --userid "$user_uuid" --new-password "$password"',
  )
  const passwordResult = validateOnpremKeycloakContract({ ...baseline, bootstrapScript: passwordArg })
  assert.equal(passwordResult.ok, false)
  assert.ok(passwordResult.errors.some((error) => /password|reset/i.test(error)))
})

test('ONP-3B strict public origin contract rejects userinfo, port, path, query, fragment, and malformed labels', () => {
  assert.equal(isStrictHttpsOrigin('https://hr-axis.example.invalid'), true)
  for (const origin of [
    'http://hr-axis.example.invalid',
    'https://user:pass@hr-axis.example.invalid',
    'https://hr-axis.example.invalid:443',
    'https://hr-axis.example.invalid/path',
    'https://hr-axis.example.invalid?x=1',
    'https://hr-axis.example.invalid#fragment',
    'https://.hr-axis.example.invalid',
    'https://hr-axis.example.invalid.',
    'https://hr..axis.example.invalid',
    'https://hr_axis.example.invalid',
    'https://-hr-axis.example.invalid',
  ]) assert.equal(isStrictHttpsOrigin(origin), false, origin)
})

test('ONP-3B contract requires the provider-signed overbroad scope rehearsal row', () => {
  const baseline = input()
  const overbroadRow = 'onprem.store-manager|onprem.store-manager|STORE_MANAGER|synthetic-employee-store-manager|company-001|region-001|store-100|company-001|region-001|store-100,store-999|store-100'
  assert.ok(baseline.workflow.includes(overbroadRow))
  const mutated = { ...baseline, workflow: baseline.workflow.replace(overbroadRow, overbroadRow.replace('store-100,store-999', 'store-100')) }
  const result = validateOnpremKeycloakContract(mutated)
  assert.equal(result.ok, false)
  assert.ok(result.errors.some((error) => /overbroad|provider-signed|assigned store/i.test(error)))
})

test('ONP-3B image proof isolates every Keycloak layer without permission-sensitive reuse', () => {
  const workflow = input().workflow
  const loop = workflow.match(/keycloak_layer_index=0[\s\S]*?done < <\(jq -r '\.\[0\]\.Layers\[\]' proof\/keycloak-saved-image\/manifest\.json\)/)?.[0]

  assert.ok(loop, 'Keycloak layer proof loop must remain present')
  assert.match(loop, /keycloak_layer_root="proof\/keycloak-layer-\$\{keycloak_layer_index\}-rootfs"/)
  assert.doesNotMatch(loop, /rm -rf|proof\/keycloak-layer-rootfs/)
  assert.match(loop, /mkdir "\$keycloak_layer_root"/)
  assert.match(loop, /tar -xf "proof\/keycloak-saved-image\/\$layer" -C "\$keycloak_layer_root"/)
  assert.match(loop, /--rootfs "\$keycloak_layer_root" --kind keycloak --application-root \/opt\/keycloak/)
})

test('ONP-3B contract rejects mapper semantic drift in the parity fixture', () => {
  const mutated = input()
  mutated.realmConfig = mutated.realmConfig.replace(
    '"included.client.audience": "store-ops-api",\n          "id.token.claim": "false"',
    '"included.client.audience": "store-ops-api",\n          "id.token.claim": "true"',
  )
  const result = validateOnpremKeycloakContract(mutated)
  assert.equal(result.ok, false)
  assert.ok(result.errors.some((error) => /audience|mapper/i.test(error)))
})
