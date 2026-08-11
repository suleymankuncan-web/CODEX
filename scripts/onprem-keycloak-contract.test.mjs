import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

import {
  KEYCLOAK_IMAGE,
  isStrictHttpsOrigin,
  isValidSmtpSender,
  validateOnpremKeycloakContract,
} from './onprem-keycloak-contract.mjs'

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

test('ONP-3B SMTP sender accepts the committed address and bypasses generic read_config', () => {
  const baseline = input()
  const committedSender = baseline.envTemplate.match(/^KEYCLOAK_SMTP_FROM=(.*)$/m)?.[1]

  assert.equal(committedSender, 'hr-axis@example.invalid')
  assert.equal(isValidSmtpSender(committedSender), true)
  assert.match(baseline.bootstrapScript, /read_config \"\$\{KEYCLOAK_SMTP_HOST:-\}\" KEYCLOAK_SMTP_HOST\)/)
  assert.match(baseline.bootstrapScript, /smtp_from=\"\$\(read_smtp_sender \"\$\{KEYCLOAK_SMTP_FROM:-\}\"\)\"/)
  assert.doesNotMatch(baseline.bootstrapScript, /smtp_from=\"\$\(read_config /)
})

test('ONP-3B SMTP sender validator fails closed for malformed or unsafe mutations', () => {
  const invalidSenders = [
    '',
    'hr-axis @example.invalid',
    'hr-axis\texample.invalid',
    'hr-axis\u0000@example.invalid',
    'hr"axis@example.invalid',
    'hr\\axis@example.invalid',
    'hr/axis@example.invalid',
    'hr:axis@example.invalid',
    'hr-axis.example.invalid',
    'hr-axis@example@invalid',
    '@example.invalid',
    'hr-axis@',
    'hr-axis@example',
    'hr_axis@example.invalid',
    'hr-axis@exa_mple.invalid',
    'hr-axis@-example.invalid',
    'hr-axis@example-.invalid',
    'hr-axis@example..invalid',
    `hr-axis@${'a'.repeat(64)}.invalid`,
    `${'a'.repeat(65)}@example.invalid`,
    `${'a'.repeat(245)}@example.invalid`,
  ]

  for (const sender of invalidSenders) assert.equal(isValidSmtpSender(sender), false, sender)
})

test('ONP-3B contract rejects representative invalid committed SMTP sender mutations', () => {
  const baseline = input()
  const senderLine = /^KEYCLOAK_SMTP_FROM=.*$/m
  for (const sender of ['', 'hr-axis@example', 'hr_axis@example.invalid', 'hr-axis@-example.invalid', 'hr-axis@example-.invalid', 'hr-axis@example.invalid@other.invalid']) {
    const mutated = {
      ...baseline,
      envTemplate: baseline.envTemplate.replace(senderLine, `KEYCLOAK_SMTP_FROM=${sender}`),
    }
    const result = validateOnpremKeycloakContract(mutated)
    assert.equal(result.ok, false, sender)
    assert.ok(result.errors.some((error) => /SMTP sender/i.test(error)), sender)
  }
})

test('ONP-3B contract keeps the database-secret ampersand allowlist POSIX-parseable', () => {
  const baseline = input()
  const escapedPattern = '*[!A-Za-z0-9._:/?\\&=%+-]*'
  const unescapedPattern = '*[!A-Za-z0-9._:/?&=%+-]*'
  assert.ok(baseline.bootstrapScript.includes(escapedPattern))

  const mutated = {
    ...baseline,
    bootstrapScript: baseline.bootstrapScript.replace(escapedPattern, unescapedPattern),
  }
  const result = validateOnpremKeycloakContract(mutated)
  assert.equal(result.ok, false)
  assert.ok(result.errors.some((error) => /database secret.*ampersand|POSIX shell/i.test(error)))
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

test('ONP-3B bootstrap secret-log scan excludes only the fixed database role identity and emits bounded phases', () => {
  const baseline = input()
  const scan = baseline.bootstrapScript.match(/scan_server_log\(\) \{[\s\S]*?\n\}\ncleanup\(\)/)?.[0] ?? ''
  const candidateLine = scan.match(/for candidate in ([^\n]+); do/)?.[1] ?? ''
  assert.doesNotMatch(candidateLine, /database_username/)
  assert.match(candidateLine, /bootstrap_candidate/)
  assert.match(candidateLine, /database_password/)
  assert.match(candidateLine, /database_url/)
  assert.match(scan, /account_password/)
  assert.match(baseline.bootstrapScript, /phase_marker\(\) \{[\s\S]*?phase=\$phase/)
  for (const phase of ['secret-input', 'server-start', 'bootstrap-authentication', 'realm-reconciliation', 'synthetic-account-reconciliation', 'subject-manifest', 'server-log-scan']) {
    assert.match(baseline.bootstrapScript, new RegExp(`phase_marker ${phase}(?:\\s|$)`))
  }

  const removedPhase = {
    ...baseline,
    bootstrapScript: baseline.bootstrapScript.replace('phase_marker realm-reconciliation\n', '# phase marker removed\n'),
  }
  const result = validateOnpremKeycloakContract(removedPhase)
  assert.equal(result.ok, false)
  assert.ok(result.errors.some((error) => /realm-reconciliation phase marker/i.test(error)))
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

test('ONP-3B image proof binds the exact embedded Angus JAR license evidence', () => {
  const workflow = input().workflow
  const jarMarker = 'opt/keycloak/lib/lib/main/org.eclipse.angus.angus-mail-2.0.5.jar'
  const jarIndex = workflow.indexOf(jarMarker)
  const bundleIndex = workflow.indexOf('-cf proof/keycloak-license-evidence.tar')
  const reconciliationIndex = workflow.indexOf('onprem-keycloak-license-reconciliation.mjs')

  assert.ok(jarIndex >= 0 && jarIndex < bundleIndex && bundleIndex < reconciliationIndex)
  assert.match(workflow, /b4d8c30d35f455def6c7a05fe595a1e62ea2b80cac3efec1e9ccf4118b23168a/)
  assert.match(workflow, /names\.count\(entry\) != 1/)
  assert.match(workflow, /entries = \('META-INF\/LICENSE\.md', 'META-INF\/NOTICE\.md'\)/)
  assert.match(workflow, /a8f94fd9e41984cfadc6d26821c21ed047e3bdf48c5af899d735287e7cddd997/)
  assert.match(workflow, /bba43e29c8098aaa07c2130d979f6d44a62f9ad51f8061c96bf6889ff5926819/)
  assert.match(workflow, /--angus-source-jar "\$angus_jar" --angus-license "\$angus_license" --angus-notice "\$angus_notice"/)
  assert.match(workflow, /keycloak_image_id="\$\(docker image inspect "\$KEYCLOAK_IMAGE" --format '\{\{\.Id\}\}'\)"/)
  assert.match(workflow, /test "\$\(docker image inspect "\$KEYCLOAK_IMAGE" --format '\{\{\.Id\}\}'\)" = "\$KEYCLOAK_IMAGE_ID"/)
  assert.match(workflow, /keycloak_image_id="\$\(docker image inspect "\$KEYCLOAK_IMAGE" --format '\{\{\.Id\}\}'\)"[\s\S]*?test "\$keycloak_image_id" = "\$KEYCLOAK_IMAGE_ID"/)
  assert.match(workflow, /receipt\.packageCount !== 552 \|\| receipt\.maxUnresolvedCount !== 452/)
  assert.match(workflow, /receipt\.resolvedCount \+ receipt\.unresolvedCount !== receipt\.packageCount/)
  assert.match(workflow, /component\.license !== null \|\| component\.evidence !== null/)
})

test('ONP-3B contract rejects Keycloak tag drift gaps around SBOM and reconciliation', () => {
  const beforeSbom = input()
  beforeSbom.workflow = beforeSbom.workflow.replace(
    '          test "$(docker image inspect "$KEYCLOAK_IMAGE" --format \'{{.Id}}\')" = "$KEYCLOAK_IMAGE_ID"\n',
    '',
  )
  const beforeSbomResult = validateOnpremKeycloakContract(beforeSbom)
  assert.equal(beforeSbomResult.ok, false)
  assert.ok(beforeSbomResult.errors.some((error) => /Syft proof.*tag drift.*before/i.test(error)))

  const reorderedSbom = input()
  reorderedSbom.workflow = reorderedSbom.workflow.replace(
    '          test "$(docker image inspect "$KEYCLOAK_IMAGE" --format \'{{.Id}}\')" = "$KEYCLOAK_IMAGE_ID"\n',
    '',
  ).replace(
    '            "$KEYCLOAK_IMAGE" -o spdx-json=/out/keycloak-sbom.spdx.json\n',
    '            "$KEYCLOAK_IMAGE" -o spdx-json=/out/keycloak-sbom.spdx.json\n          test "$(docker image inspect "$KEYCLOAK_IMAGE" --format \'{{.Id}}\')" = "$KEYCLOAK_IMAGE_ID"\n',
  )
  const reorderedSbomResult = validateOnpremKeycloakContract(reorderedSbom)
  assert.equal(reorderedSbomResult.ok, false)
  assert.ok(reorderedSbomResult.errors.some((error) => /Syft proof.*tag drift.*before/i.test(error)))

  const beforeReconciliation = input()
  beforeReconciliation.workflow = beforeReconciliation.workflow.replace(
    '          test "$keycloak_image_id" = "$KEYCLOAK_IMAGE_ID"\n',
    '',
  )
  const beforeReconciliationResult = validateOnpremKeycloakContract(beforeReconciliation)
  assert.equal(beforeReconciliationResult.ok, false)
  assert.ok(beforeReconciliationResult.errors.some((error) => /license reconciliation.*tag drift.*before/i.test(error)))

  const reorderedReconciliation = input()
  reorderedReconciliation.workflow = reorderedReconciliation.workflow.replace(
    '          test "$keycloak_image_id" = "$KEYCLOAK_IMAGE_ID"\n',
    '',
  ).replace(
    '            --output proof/keycloak-license-reconciliation.json\n',
    '            --output proof/keycloak-license-reconciliation.json\n          test "$keycloak_image_id" = "$KEYCLOAK_IMAGE_ID"\n',
  )
  const reorderedReconciliationResult = validateOnpremKeycloakContract(reorderedReconciliation)
  assert.equal(reorderedReconciliationResult.ok, false)
  assert.ok(reorderedReconciliationResult.errors.some((error) => /license reconciliation.*tag drift.*before/i.test(error)))
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
