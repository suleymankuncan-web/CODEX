import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

import {
  countCsvItems,
  KEYCLOAK_IMAGE,
  isStrictHttpsOrigin,
  isValidSmtpSender,
  selectCsvFirstFields,
  selectCsvFirstFieldsByExactSecond,
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
    photoProofCompose: read('infra/onprem/core/compose.photo-proof.yaml'),
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

test('ONP-5 photo-proof identity stays separate from the exact five-persona contract', () => {
  const baseline = input()
  assert.doesNotMatch(baseline.compose, /keycloak_synthetic_photo_proof_account/)
  assert.doesNotMatch(baseline.compose, /KEYCLOAK_PHOTO_PROOF_SUBJECT_MANIFEST_FILE/)
  assert.match(baseline.photoProofCompose, /keycloak_synthetic_photo_proof_account/)
  assert.match(baseline.photoProofCompose, /KEYCLOAK_PHOTO_PROOF_SUBJECT_MANIFEST_FILE: \/var\/lib\/keycloak-bootstrap\/photo-proof-subject\.v1\.json/)
  assert.match(baseline.bootstrapScript, /onprem-keycloak-photo-proof-subject-v1/)
  assert.match(baseline.bootstrapScript, /photo_proof_roles.*SUPER_ADMIN/)
  assert.match(baseline.bootstrapScript, /synthetic photo proof account secret is forbidden while photo proof is disabled/)
  assert.match(baseline.bootstrapScript, /case "\$photo_proof_enabled" in\s+true\|false\)/)

  for (const bootstrapScript of [
    baseline.bootstrapScript.replace('onprem-keycloak-photo-proof-subject-v1', 'onprem-keycloak-subjects-v1'),
    baseline.bootstrapScript.replace('photo-proof-subject.v1.json', 'subjects.v1.json'),
    baseline.bootstrapScript.replaceAll('if [ "$photo_proof_enabled" = true ]; then', 'if [ "$photo_proof_enabled" = false ]; then'),
    baseline.bootstrapScript.replace('case "$photo_proof_enabled" in\n    true|false)', 'case "$photo_proof_enabled" in\n    true)'),
    baseline.bootstrapScript.replace('photo_proof_roles" = \'SUPER_ADMIN\'', 'photo_proof_roles" = \'REPORT_VIEWER\''),
    baseline.bootstrapScript.replace('photo_proof_company_ids" = \'company-001\'', 'photo_proof_company_ids" = \'company-002\''),
    baseline.bootstrapScript.replace('photo_proof_assigned_store_ids" = \'store-100\'', 'photo_proof_assigned_store_ids" = \'store-999\''),
  ]) {
    const result = validateOnpremKeycloakContract({ ...baseline, bootstrapScript })
    assert.equal(result.ok, false)
    assert.ok(result.errors.some((error) => /photo-proof|photo proof|strict-local|separate/i.test(error)))
  }
})

test('ONP-5 synthetic account input remains exactly five personas and rejects a sixth row', () => {
  const baseline = input()
  const personaRows = baseline.workflow.match(/done <<'PERSONAS'([\s\S]*?)\n\s*PERSONAS/)?.[1]
    ?.split(/\r?\n/)
    .map((row) => row.trim())
    .filter(Boolean) ?? []
  assert.equal(personaRows.length, 5)
  assert.doesNotMatch(personaRows.join('\n'), /onprem\.photo-proof-admin/)

  const sixthPersona = '          onprem.extra-persona|onprem.extra-persona|REPORT_VIEWER|synthetic-employee-extra|company-001|||company-001|||'
  const mutated = {
    ...baseline,
    workflow: baseline.workflow.replace('          PERSONAS\n', `${sixthPersona}\n          PERSONAS\n`),
  }
  const result = validateOnpremKeycloakContract(mutated)
  assert.equal(result.ok, false)
  assert.ok(result.errors.some((error) => /exactly five|five synthetic persona/i.test(error)))
})

test('ONP-5 bootstrap parser must retain an explicit exact-five row count guard', () => {
  const baseline = input()
  assert.match(baseline.bootstrapScript, /synthetic_account_count=0/)
  assert.match(baseline.bootstrapScript, /synthetic_account_count=\$\(\(synthetic_account_count \+ 1\)\)/)
  assert.match(baseline.bootstrapScript, /\[ "\$synthetic_account_count" -eq 5 \]/)

  const mutated = {
    ...baseline,
    bootstrapScript: baseline.bootstrapScript.replace(/\[ "\$synthetic_account_count" -eq 5 \] \|\| die[^\n]+\n/, ''),
  }
  const result = validateOnpremKeycloakContract(mutated)
  assert.equal(result.ok, false)
  assert.ok(result.errors.some((error) => /exactly five|five synthetic persona/i.test(error)))
})

test('ONP-5 persona seed rejects fixed-identity collisions before any mutation', () => {
  const seed = input().personaSeed
  const firstMutation = seed.search(/^\s*(?:INSERT|UPDATE|DELETE)\b/m)
  const preflight = seed.match(/DO \$\$[\s\S]*?\$\$;/)?.[0] ?? ''

  assert.ok(firstMutation > 0, 'persona seed must contain a DML mutation')
  assert.ok(preflight.length > 0, 'persona seed must have an executable preflight block')
  assert.ok(seed.indexOf(preflight) < firstMutation, 'persona seed preflight must precede every mutation')
  assert.match(preflight, /username\s*=\s*'onprem\.photo-proof-admin'[\s\S]*?user_id[\s\S]*?80000000-0000-0000-0000-000000000016/)
  assert.match(preflight, /user_id\s*=\s*'80000000-0000-0000-0000-000000000016'::uuid[\s\S]*?username[\s\S]*?onprem\.photo-proof-admin/)
  assert.match(preflight, /user_role_assignment_id\s*=\s*'90000000-0000-0000-0000-000000000016'::uuid[\s\S]*?user_id[\s\S]*?80000000-0000-0000-0000-000000000016/)
  assert.match(preflight, /user_action_store_assignment_id\s*=\s*'91000000-0000-0000-0000-000000000015'::uuid[\s\S]*?user_id[\s\S]*?80000000-0000-0000-0000-000000000016/)
  assert.match(preflight, /RAISE EXCEPTION[\s\S]*?photo-proof-admin/)
})

test('ONP-5 collision preflight is the first statement in an executable transaction fixture', () => {
  const seed = input().personaSeed.trim()
  const executableSeed = seed.slice(seed.indexOf('DO $$'))
  const transactionFixture = `BEGIN;\n${executableSeed}\nROLLBACK;`

  assert.match(transactionFixture, /^BEGIN;\nDO \$\$/)
  assert.match(transactionFixture, /\$\$;\n\nINSERT INTO ops\.user_account/)
  assert.match(transactionFixture, /\nROLLBACK;$/)
  assert.doesNotMatch(transactionFixture.slice(0, transactionFixture.indexOf('INSERT INTO ops.user_account')), /\b(?:INSERT|UPDATE|DELETE)\b/)
})

test('ONP-3B Keycloak runtime remains PID 1 for reliable graceful shutdown', () => {
  const baseline = input()
  assert.match(
    baseline.compose,
    /  keycloak:\r?\n[\s\S]*?^    init: false\s*$/m,
    'the committed Keycloak service must explicitly disable Docker init',
  )

  for (const mutate of [
    (compose) => compose.replace(/^    init: false\s*$/m, '    init: true'),
    (compose) => compose.replace(/^    init: false\s*\r?\n/m, ''),
    (compose) => compose.replace(/^    init: false\s*$/m, '    init: false\n    init: true'),
    (compose) => compose.replace(
      /(  keycloak:\r?\n[\s\S]*?)^    entrypoint: \["\/bin\/sh", "-ec"\]\s*$/m,
      '$1    # entrypoint: ["/bin/sh", "-ec"]',
    ),
    (compose) => compose.replace('        exec /opt/keycloak/bin/kc.sh start --optimized', '        /opt/keycloak/bin/kc.sh start --optimized'),
    (compose) => compose.replace('        exec /opt/keycloak/bin/kc.sh start --optimized', '        exec /opt/keycloak/bin/kc.sh start --auto-build'),
  ]) {
    const mutated = input()
    mutated.compose = mutate(mutated.compose)
    const result = validateOnpremKeycloakContract(mutated)

    assert.equal(result.ok, false)
    assert.ok(result.errors.some((error) => /PID 1|graceful shutdown/i.test(error)))
  }
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

test('ONP-3B contract requires suffix kcadm config paths and rejects unsupported KCADM_CONFIG reliance', () => {
  const baseline = input()
  const wrapperInvocation = 'kcadm_timeout "$@" --config "$config_file"'
  const credentialInvocation = 'KC_CLI_CLIENT_SECRET="$(tr -d \'\\r\\n\' < "$bootstrap_password_file")" kcadm_timeout config credentials'
  assert.ok(baseline.bootstrapScript.includes(wrapperInvocation))
  assert.ok(baseline.bootstrapScript.includes(credentialInvocation))
  assert.doesNotMatch(baseline.bootstrapScript, /\bKCADM_CONFIG\b/)

  const missingWrapperConfig = {
    ...baseline,
    bootstrapScript: baseline.bootstrapScript.replace(wrapperInvocation, 'kcadm_timeout "$@"'),
  }
  const missingWrapperResult = validateOnpremKeycloakContract(missingWrapperConfig)
  assert.equal(missingWrapperResult.ok, false)
  assert.ok(missingWrapperResult.errors.some((error) => /wrapper.*config|kcadm.*config/i.test(error)))

  const wrongWrapperConfig = {
    ...baseline,
    bootstrapScript: baseline.bootstrapScript.replace(wrapperInvocation, 'kcadm_timeout "$@" --config "$tmp_dir/other.config"'),
  }
  const wrongWrapperResult = validateOnpremKeycloakContract(wrongWrapperConfig)
  assert.equal(wrongWrapperResult.ok, false)
  assert.ok(wrongWrapperResult.errors.some((error) => /wrapper.*config|kcadm.*config/i.test(error)))

  const prefixWrapperConfig = {
    ...baseline,
    bootstrapScript: baseline.bootstrapScript.replace(wrapperInvocation, 'kcadm_timeout --config "$config_file" "$@"'),
  }
  const prefixWrapperResult = validateOnpremKeycloakContract(prefixWrapperConfig)
  assert.equal(prefixWrapperResult.ok, false)
  assert.ok(prefixWrapperResult.errors.some((error) => /suffix|ordering|wrapper.*config|kcadm.*config/i.test(error)))

  const duplicateWrapperConfig = {
    ...baseline,
    bootstrapScript: baseline.bootstrapScript.replace(wrapperInvocation, `${wrapperInvocation} --config "$config_file"`),
  }
  const duplicateWrapperResult = validateOnpremKeycloakContract(duplicateWrapperConfig)
  assert.equal(duplicateWrapperResult.ok, false)
  assert.ok(duplicateWrapperResult.errors.some((error) => /exactly one|wrapper.*config|kcadm.*config/i.test(error)))

  const missingDirectConfig = {
    ...baseline,
    bootstrapScript: baseline.bootstrapScript.replace(
      '      --server "$server" --realm master --client "$bootstrap_user" --config "$config_file"',
      '      --server "$server" --realm master --client "$bootstrap_user"',
    ),
  }
  const missingDirectResult = validateOnpremKeycloakContract(missingDirectConfig)
  assert.equal(missingDirectResult.ok, false)
  assert.ok(missingDirectResult.errors.some((error) => /direct.*config|auth.*config|kcadm.*config/i.test(error)))

  const wrongDirectConfig = {
    ...baseline,
    bootstrapScript: baseline.bootstrapScript.replace(
      '      --server "$server" --realm master --client "$bootstrap_user" --config "$config_file"',
      '      --server "$server" --realm master --client "$bootstrap_user" --config "$tmp_dir/other.config"',
    ),
  }
  const wrongDirectResult = validateOnpremKeycloakContract(wrongDirectConfig)
  assert.equal(wrongDirectResult.ok, false)
  assert.ok(wrongDirectResult.errors.some((error) => /direct.*config|auth.*config|kcadm.*config/i.test(error)))

  const prefixDirectConfig = {
    ...baseline,
    bootstrapScript: baseline.bootstrapScript.replace(
      ' kcadm_timeout config credentials \\\n      --server "$server" --realm master --client "$bootstrap_user" --config "$config_file"',
      ' kcadm_timeout --config "$config_file" config credentials \\\n      --server "$server" --realm master --client "$bootstrap_user"',
    ),
  }
  const prefixDirectResult = validateOnpremKeycloakContract(prefixDirectConfig)
  assert.equal(prefixDirectResult.ok, false)
  assert.ok(prefixDirectResult.errors.some((error) => /suffix|ordering|direct.*config|auth.*config|kcadm.*config/i.test(error)))

  const duplicateDirectConfig = {
    ...baseline,
    bootstrapScript: baseline.bootstrapScript.replace(
      '      --server "$server" --realm master --client "$bootstrap_user" --config "$config_file"',
      '      --server "$server" --realm master --client "$bootstrap_user" --config "$config_file" --config "$config_file"',
    ),
  }
  const duplicateDirectResult = validateOnpremKeycloakContract(duplicateDirectConfig)
  assert.equal(duplicateDirectResult.ok, false)
  assert.ok(duplicateDirectResult.errors.some((error) => /exactly one|direct.*config|auth.*config|kcadm.*config/i.test(error)))

  const envReliance = {
    ...baseline,
    bootstrapScript: baseline.bootstrapScript.replace('credentials_ready=false', 'export KCADM_CONFIG="$config_file"\ncredentials_ready=false'),
  }
  const envRelianceResult = validateOnpremKeycloakContract(envReliance)
  assert.equal(envRelianceResult.ok, false)
  assert.ok(envRelianceResult.errors.some((error) => /KCADM_CONFIG|unsupported.*config/i.test(error)))
})

test('ONP-3B Keycloak bootstrap bounds every kcadm request and the whole reconciliation before the offline rehearsal timeout', () => {
  const baseline = input()
  assert.match(baseline.bootstrapScript, /readonly KCADM_TIMEOUT_SECONDS=90/)
  assert.match(baseline.bootstrapScript, /readonly BOOTSTRAP_AUTH_ATTEMPTS=8/)
  assert.match(baseline.bootstrapScript, /readonly BOOTSTRAP_TIMEOUT_SECONDS=1800/)
  assert.match(baseline.bootstrapScript, /start_bootstrap_watchdog\(\)[\s\S]*?sleep "\$BOOTSTRAP_TIMEOUT_SECONDS"[\s\S]*?kill -TERM "\$\$"/)
  assert.match(baseline.bootstrapScript, /handle_termination\(\)[\s\S]*?bootstrap watchdog timeout/)
  assert.match(baseline.bootstrapScript, /trap cleanup EXIT[\s\S]*?trap 'handle_termination TERM' TERM[\s\S]*?trap 'handle_termination INT' INT[\s\S]*?trap 'handle_termination HUP' HUP/)
  assert.match(baseline.bootstrapScript, /timeout --signal=TERM --kill-after=5s "[^"]*KCADM_TIMEOUT_SECONDS}s" \/opt\/keycloak\/bin\/kcadm\.sh/)
  assert.match(baseline.bootstrapScript, /kcadm_timeout\(\) \{[\s\S]*?timeout --signal=TERM --kill-after=5s "[^"]*KCADM_TIMEOUT_SECONDS}s"/)
  assert.match(baseline.bootstrapScript, /timeout --signal=TERM --kill-after=5s "\$\{KCADM_TIMEOUT_SECONDS\}s" \/opt\/keycloak\/bin\/kc\.sh bootstrap-admin service/)
  assert.match(baseline.bootstrapScript, /while \[ "\$attempt" -lt "\$BOOTSTRAP_AUTH_ATTEMPTS" \]; do/)
  const unboundedWrapper = {
    ...baseline,
    bootstrapScript: baseline.bootstrapScript.replace(
      'timeout --signal=TERM --kill-after=5s',
      'timeout-disabled --signal=TERM --kill-after=5s',
    ),
  }
  const wrapperResult = validateOnpremKeycloakContract(unboundedWrapper)
  assert.equal(wrapperResult.ok, false)
  assert.ok(wrapperResult.errors.some((error) => /bounded.*kcadm|kcadm.*timeout/i.test(error)))

  const unboundedBootstrap = {
    ...baseline,
    bootstrapScript: baseline.bootstrapScript.replace(
      'timeout --signal=TERM --kill-after=5s "${KCADM_TIMEOUT_SECONDS}s" /opt/keycloak/bin/kc.sh bootstrap-admin service',
      '/opt/keycloak/bin/kc.sh bootstrap-admin service',
    ),
  }
  const bootstrapResult = validateOnpremKeycloakContract(unboundedBootstrap)
  assert.equal(bootstrapResult.ok, false)
  assert.ok(bootstrapResult.errors.some((error) => /bootstrap-admin|bounded|timeout/i.test(error)))

  const missingWatchdog = {
    ...baseline,
    bootstrapScript: baseline.bootstrapScript.replace('start_bootstrap_watchdog\n', '# watchdog removed\n'),
  }
  const watchdogResult = validateOnpremKeycloakContract(missingWatchdog)
  assert.equal(watchdogResult.ok, false)
  assert.ok(watchdogResult.errors.some((error) => /watchdog|wall.clock|bootstrap.*timeout/i.test(error)))

  const unboundedDirectAuth = {
    ...baseline,
    bootstrapScript: baseline.bootstrapScript.replace(
      'kcadm_timeout config credentials',
      '/opt/keycloak/bin/kcadm.sh config credentials',
    ),
  }
  const directResult = validateOnpremKeycloakContract(unboundedDirectAuth)
  assert.equal(directResult.ok, false)
  assert.ok(directResult.errors.some((error) => /bounded.*kcadm|kcadm.*timeout|kcadm.*config/i.test(error)))
})

test('ONP-3B contract requires command-local kcadm auth secrets and rejects unsafe mutations', () => {
  const baseline = input()
  const credentialInvocation = 'KC_CLI_CLIENT_SECRET="$(tr -d \'\\r\\n\' < "$bootstrap_password_file")" kcadm_timeout config credentials'
  assert.ok(baseline.bootstrapScript.includes(credentialInvocation))
  assert.doesNotMatch(baseline.bootstrapScript, /export\s+KC_CLI_CLIENT_SECRET=/)

  const unnormalizedSecret = baseline.bootstrapScript.replace(
    credentialInvocation,
    'KC_CLI_CLIENT_SECRET="$(cat "$bootstrap_password_file")" kcadm_timeout config credentials',
  )
  const unnormalizedResult = validateOnpremKeycloakContract({ ...baseline, bootstrapScript: unnormalizedSecret })
  assert.equal(unnormalizedResult.ok, false)
  assert.ok(unnormalizedResult.errors.some((error) => /normalize|command-local/i.test(error)))

  const stdinSecret = baseline.bootstrapScript.replace(
    credentialInvocation,
    'cat "$bootstrap_password_file" | kcadm_timeout config credentials',
  )
  const stdinResult = validateOnpremKeycloakContract({ ...baseline, bootstrapScript: stdinSecret })
  assert.equal(stdinResult.ok, false)
  assert.ok(stdinResult.errors.some((error) => /stdin|command-local/i.test(error)))

  const secretArg = baseline.bootstrapScript.replace(
    credentialInvocation,
    'kcadm_timeout config credentials --secret "$bootstrap_password"',
  )
  const secretResult = validateOnpremKeycloakContract({ ...baseline, bootstrapScript: secretArg })
  assert.equal(secretResult.ok, false)
  assert.ok(secretResult.errors.some((error) => /argv|stdin|secret/i.test(error)))

  const exportedSecret = baseline.bootstrapScript.replace(
    credentialInvocation,
    'export KC_CLI_CLIENT_SECRET="$(cat "$bootstrap_password_file")"\n  kcadm_timeout config credentials',
  )
  const exportedResult = validateOnpremKeycloakContract({ ...baseline, bootstrapScript: exportedSecret })
  assert.equal(exportedResult.ok, false)
  assert.ok(exportedResult.errors.some((error) => /export|command-local/i.test(error)))

  const rawSecret = baseline.bootstrapScript.replace(
    credentialInvocation,
    'KC_CLI_CLIENT_SECRET="$bootstrap_password" kcadm_timeout config credentials',
  )
  const rawResult = validateOnpremKeycloakContract({ ...baseline, bootstrapScript: rawSecret })
  assert.equal(rawResult.ok, false)
  assert.ok(rawResult.errors.some((error) => /command-local|raw|secret/i.test(error)))

  const missingLoop = baseline.bootstrapScript.replace('while [ "$attempt" -lt "$BOOTSTRAP_AUTH_ATTEMPTS" ]; do', 'if true; then')
  const loopResult = validateOnpremKeycloakContract({ ...baseline, bootstrapScript: missingLoop })
  assert.equal(loopResult.ok, false)
  assert.ok(loopResult.errors.some((error) => /retry|authentication/i.test(error)))

  const missingServerCheck = baseline.bootstrapScript.replace(
    '  kill -0 "$server_pid" >/dev/null 2>&1 || die \'temporary Keycloak server exited before authentication\'\n',
    '',
  )
  const serverResult = validateOnpremKeycloakContract({ ...baseline, bootstrapScript: missingServerCheck })
  assert.equal(serverResult.ok, false)
  assert.ok(serverResult.errors.some((error) => /server-liveness|authentication/i.test(error)))

  const passwordArg = baseline.bootstrapScript.replace(
    'update "users/$user_uuid/reset-password" -r "$realm" -f "$password_file" -n',
    'set-password -r "$realm" --userid "$user_uuid" --new-password "$password"',
  )
  const passwordResult = validateOnpremKeycloakContract({ ...baseline, bootstrapScript: passwordArg })
  assert.equal(passwordResult.ok, false)
  assert.ok(passwordResult.errors.some((error) => /password|reset/i.test(error)))
})

test('ONP-3B bootstrap uses only bounded POSIX CSV helpers available in the pinned image', () => {
  const baseline = input()
  assert.doesNotMatch(baseline.bootstrapScript, /\bawk\b/)
  assert.deepEqual(
    selectCsvFirstFieldsByExactSecond('uuid-1,roles\nuuid-2,roles-extra\nuuid-3,roles\nuuid-4,xroles', 'roles'),
    ['uuid-1', 'uuid-3'],
  )
  assert.deepEqual(selectCsvFirstFieldsByExactSecond('uuid-1,roles,', 'roles'), [])
  assert.deepEqual(selectCsvFirstFieldsByExactSecond(',roles\nuuid-2,', 'roles'), [])
  assert.deepEqual(selectCsvFirstFields('web-origins\nprofile\nroles\nemail'), ['web-origins', 'profile', 'roles', 'email'])
  assert.deepEqual(selectCsvFirstFields('profile,unexpected'), [])
  assert.deepEqual(selectCsvFirstFields('profile,'), [])
  assert.equal(countCsvItems(''), 0)
  assert.equal(countCsvItems('company-001'), 1)
  assert.equal(countCsvItems('store-100,store-101,store-999'), 3)
  assert.equal(countCsvItems('store-100,,store-101'), null)

  const result = validateOnpremKeycloakContract({
    ...baseline,
    bootstrapScript: baseline.bootstrapScript.replace(
      'csv_first_fields_matching_second "$mapper_name"',
      'awk -F\',\' -v target="$mapper_name" \'$2 == target {print $1}\'',
    ),
  })
  assert.equal(result.ok, false)
  assert.ok(result.errors.some((error) => /awk|POSIX CSV|approved POSIX/i.test(error)))
})

test('ONP-3B POSIX CSV helpers reject malformed delimiter shapes in the actual shell', (t) => {
  const shellProbe = spawnSync('sh', ['-c', 'exit 0'], { encoding: 'utf8', windowsHide: true })
  if (shellProbe.error || shellProbe.status !== 0) {
    t.skip('POSIX sh is unavailable; the pinned-image workflow runs this contract on Linux')
    return
  }

  const bootstrapScript = input().bootstrapScript
  const exactHelper = bootstrapScript.match(/csv_first_fields_matching_second\(\) \{[\s\S]*?\n\}/)?.[0] ?? ''
  const firstHelper = bootstrapScript.match(/csv_first_fields\(\) \{[\s\S]*?\n\}/)?.[0] ?? ''
  const run = (body) => spawnSync('sh', ['-eu', '-c', `die() { exit 97; }\n${exactHelper}\n${firstHelper}\n${body}`], {
    encoding: 'utf8',
    windowsHide: true,
  })

  const validExact = run("printf 'uuid-1,roles\\nuuid-2,other\\n' | csv_first_fields_matching_second roles")
  assert.equal(validExact.status, 0)
  assert.equal(validExact.stdout.trim(), 'uuid-1')
  for (const malformed of ['uuid,roles,', ',roles', 'uuid,', 'uuid,roles,extra']) {
    assert.equal(run(`printf '%s\\n' '${malformed}' | csv_first_fields_matching_second roles`).status, 97)
  }

  const validFirst = run("printf 'profile\\nemail\\n' | csv_first_fields")
  assert.equal(validFirst.status, 0)
  assert.equal(validFirst.stdout.trim(), 'profile\nemail')
  for (const malformed of ['profile,', ',profile', 'profile,extra']) {
    assert.equal(run(`printf '%s\\n' '${malformed}' | csv_first_fields`).status, 97)
  }
})

test('ONP-3B image proof preflights every bootstrap executable before expensive runtime work', () => {
  const baseline = input()
  const inventory = 'required_bootstrap_commands="cat chmod grep mkdir mktemp mv rm sed sleep tr wc"'
  const identityCheck = 'test "$(docker image inspect "$KEYCLOAK_IMAGE" --format \'{{.Config.Entrypoint}}\')" = \'[/opt/keycloak/bin/kc.sh]\''
  const preflightStart = 'docker run --rm --volume "$PWD/infra/onprem/core/keycloak/bootstrap.sh:/opt/keycloak/bootstrap.sh:ro"'
  assert.ok(baseline.workflow.includes(inventory))
  assert.match(baseline.workflow, /\/bin\/sh -n \/opt\/keycloak\/bootstrap\.sh/)

  for (const workflow of [
    baseline.workflow.replace('--volume "$PWD/infra/onprem/core/keycloak/bootstrap.sh:/opt/keycloak/bootstrap.sh:ro"', ''),
    baseline.workflow.replace('--entrypoint /bin/sh "$KEYCLOAK_IMAGE" -ec', '--entrypoint /bin/sh alpine:latest -ec'),
    baseline.workflow.replace(inventory, inventory.replace(' grep', '')),
    baseline.workflow.replace('command -v "$required_command" >/dev/null', ':'),
    baseline.workflow.replace('/bin/sh -n /opt/keycloak/bootstrap.sh', ':'),
    baseline.workflow.replace(identityCheck, `${preflightStart}\n          ${identityCheck}`),
  ]) {
    const result = validateOnpremKeycloakContract({ ...baseline, workflow })
    assert.equal(result.ok, false)
    assert.ok(result.errors.some((error) => /preflight.*bootstrap|bootstrap executable|POSIX-parse/i.test(error)))
  }
})

test('ONP-3B existing mapper updates include the validated mapper id in a private body', () => {
  const baseline = input()
  const idBody = 'printf \'{"id":"%s",%s\\n\' "$mapper_uuid" "${mapper_json#\\{}" > "$mapper_update_file"'
  assert.ok(baseline.bootstrapScript.includes(idBody))

  for (const bootstrapScript of [
    baseline.bootstrapScript.replace(idBody, 'printf \'%s\\n\' "$mapper_json" > "$mapper_update_file"'),
    baseline.bootstrapScript.replace('-f "$mapper_update_file" || die \'claim mapper update failed\'', '-f "$mapper_file" || die \'claim mapper update failed\''),
    baseline.bootstrapScript.replace('*[!A-Fa-f0-9-]*) die \'claim mapper id contains unsupported characters\' ;;', '*) ;;'),
  ]) {
    const result = validateOnpremKeycloakContract({ ...baseline, bootstrapScript })
    assert.equal(result.ok, false)
    assert.ok(result.errors.some((error) => /mapper.*id|idempotency|private JSON/i.test(error)))
  }
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

test('ONP-3B synthetic personas receive a complete non-personal Keycloak profile', () => {
  const baseline = input()
  assert.equal(validateOnpremKeycloakContract(baseline).ok, true)
  for (const bootstrapScript of [
    baseline.bootstrapScript.replace('profile_email="$username@example.invalid"', 'profile_email=""'),
    baseline.bootstrapScript.replace(',"email":"%s"', ''),
    baseline.bootstrapScript.replace(',"firstName":"Synthetic"', ''),
    baseline.bootstrapScript.replace(',"lastName":"Persona"', ''),
  ]) {
    const result = validateOnpremKeycloakContract({ ...baseline, bootstrapScript })
    assert.equal(result.ok, false)
    assert.ok(result.errors.some((error) => /synthetic persona profile/i.test(error)))
  }
})

test('ONP-3B synthetic role assignments retain the complete active scope ancestry', () => {
  const baseline = input()
  const expectedRows = [
    "'onprem.store-manager', 'STORE_MANAGER', 'store', '00000000-0000-0000-0000-000000000001'::uuid, '00000000-0000-0000-0000-000000000010'::uuid, '00000000-0000-0000-0000-000000000100'::uuid",
    "'onprem.region-manager', 'REGION_MANAGER', 'region', '00000000-0000-0000-0000-000000000001'::uuid, '00000000-0000-0000-0000-000000000010'::uuid, NULL::uuid",
    "'onprem.report-viewer', 'REPORT_VIEWER', 'company', '00000000-0000-0000-0000-000000000001'::uuid, NULL::uuid, NULL::uuid",
    "'onprem.store-personnel', 'STORE_PERSONNEL', 'store', '00000000-0000-0000-0000-000000000001'::uuid, '00000000-0000-0000-0000-000000000010'::uuid, '00000000-0000-0000-0000-000000000100'::uuid",
    "'onprem.visual-merchandiser', 'VISUAL_MERCHANDISER', 'store', '00000000-0000-0000-0000-000000000001'::uuid, '00000000-0000-0000-0000-000000000010'::uuid, '00000000-0000-0000-0000-000000000100'::uuid",
  ]
  for (const row of expectedRows) assert.ok(baseline.personaSeed.includes(row), row)

  for (const row of expectedRows) {
    const mutated = { ...baseline, personaSeed: baseline.personaSeed.replace(row, row.replace("'00000000-0000-0000-0000-000000000001'::uuid", 'NULL::uuid')) }
    const result = validateOnpremKeycloakContract(mutated)
    assert.equal(result.ok, false)
    assert.ok(result.errors.some((error) => /scope ancestry|authorization hierarchy/i.test(error)))
  }
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

test('ONP-3B browser client receives the OIDC subject from the exact canonical default scopes', () => {
  const baseline = input()
  const subMapper = 'create_or_update_mapper sub \'{"name":"sub","protocol":"openid-connect","protocolMapper":"oidc-sub-mapper","consentRequired":false,"config":{"access.token.claim":"true","introspection.token.claim":"true"}}\''
  const scopeResolver = 'scope_uuid="$(resolve_client_scope_uuid "$expected_scope")"'
  const scopeAttach = 'kcadm_quiet update "clients/$client_uuid/default-client-scopes/$scope_uuid" -r "$realm" -n || die \'browser client default scope attachment failed\''

  for (const mutated of [
    { ...baseline, bootstrapScript: baseline.bootstrapScript.replace('"defaultClientScopes":["web-origins","profile","roles","email","basic"]', '"defaultClientScopes":["web-origins","profile","roles","email"]') },
    { ...baseline, bootstrapScript: baseline.bootstrapScript.replace('[ "$default_scope_count" -eq 5 ]', '[ "$default_scope_count" -eq 4 ]') },
    { ...baseline, bootstrapScript: baseline.bootstrapScript.replace('for expected_scope in web-origins profile roles email basic; do', 'for expected_scope in web-origins profile roles email; do') },
    { ...baseline, realmConfig: baseline.realmConfig.replace('"defaultClientScopes": ["web-origins", "profile", "roles", "email", "basic"]', '"defaultClientScopes": ["web-origins", "profile", "roles", "email"]') },
    { ...baseline, bootstrapScript: baseline.bootstrapScript.replace("create_or_update_mapper roles '", `${subMapper}\ncreate_or_update_mapper roles '` ) },
    { ...baseline, bootstrapScript: baseline.bootstrapScript.replace(scopeResolver, 'scope_uuid=""') },
    { ...baseline, bootstrapScript: baseline.bootstrapScript.replace(scopeAttach, ':') },
  ]) {
    const result = validateOnpremKeycloakContract(mutated)
    assert.equal(result.ok, false)
    assert.ok(result.errors.some((error) => /subject|basic|default scope|client.*sub mapper/i.test(error)))
  }
})
