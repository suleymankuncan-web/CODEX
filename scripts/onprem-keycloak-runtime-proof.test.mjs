import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { isAbsolute, join, resolve } from 'node:path'
import { test } from 'node:test'

import {
  assertFirewallCounterDelta,
  assertKeycloakAuthProofReceipt,
  assertSecretSafeLogsWithValues,
  classifyKeycloakBootstrapDiagnostic,
  collectSecretValues,
  resolveAuthProofMounts,
  resolveAuthProofNetwork,
  runDockerCapture,
  runKeycloakRuntimeProof,
  validateComposeContainerIdentities,
} from './onprem-keycloak-runtime-proof.mjs'

test('Keycloak authorization success is derived only from the full validated auth receipt', () => {
  const valid = {
    schemaVersion: 1,
    dataClass: 'synthetic',
    discovery: { status: 200, issuerMatches: true, authorizationEndpointMatches: true, tokenEndpointMatches: true, logoutEndpointMatches: true, jwksEndpointMatches: true },
    jwks: { status: 200, keyCount: 1, unknownKeyStatus: 401 },
    publicAdminDenials: { paths: ['/admin', '/admin/', '/admin/master/console/', '/auth/admin', '/auth/admin/realms/master/console/'], allDenied: true },
    jwtRejections: { 'unknown-key': 401, 'wrong-issuer': 401, 'wrong-audience': 401, 'wrong-role-scope': 403 },
    personas: {
      count: 5,
      sessionsVerified: 5,
      csrfMissingDenied: 5,
      csrfRecoverySucceeded: 5,
      crossScopeDenied: 5,
      authorizedMutationCount: 1,
      deniedMutationCount: 5,
      realmLogoutCount: 5,
      unallowlistedLogoutRejectedCount: 5,
      reauthorizeCredentialCount: 5,
      secureHttpOnlySameSiteHostOnlyCookieCount: 5,
      clearingCookieContractCount: 5,
    },
    csrf: { missingHeaderStatus: 403, recoveryStatus: 200 },
    logout: { invalidated: true, realmEndSession: true, reauthorizeRequiresCredentials: true },
    scopeAuthorization: { crossScopeDenied: true, validCsrfMutationObserved: true, deniedActionWriteDelta: 0 },
    forgedClaimDefense: { deniedActionWriteDelta: 0 },
    providerSignedOverbroadClaims: { tested: true, claimStoreIds: ['store-100', 'store-999'], dbAuthorizationRemainedSubordinate: true },
    noRawCredentials: true,
  }
  assert.deepEqual(assertKeycloakAuthProofReceipt(valid), valid)
  const mutations = [
    receipt => { receipt.schemaVersion = 2 },
    receipt => { receipt.discovery.authorizationEndpointMatches = false },
    receipt => { receipt.jwks.keyCount = 0 },
    receipt => { receipt.publicAdminDenials.allDenied = false },
    receipt => { receipt.jwtRejections['wrong-audience'] = 200 },
    receipt => { receipt.personas.sessionsVerified = 4 },
    receipt => { receipt.personas.csrfMissingDenied = 4 },
    receipt => { receipt.personas.authorizedMutationCount = 0 },
    receipt => { receipt.personas.deniedMutationCount = 4 },
    receipt => { receipt.personas.clearingCookieContractCount = 4 },
    receipt => { receipt.csrf.recoveryStatus = 403 },
    receipt => { receipt.logout.realmEndSession = false },
    receipt => { receipt.scopeAuthorization.deniedActionWriteDelta = 1 },
    receipt => { receipt.forgedClaimDefense.deniedActionWriteDelta = 1 },
    receipt => { receipt.providerSignedOverbroadClaims.dbAuthorizationRemainedSubordinate = false },
    receipt => { receipt.noRawCredentials = false },
  ]
  for (const mutate of mutations) {
    const receipt = structuredClone(valid)
    mutate(receipt)
    assert.throws(() => assertKeycloakAuthProofReceipt(receipt), /auth proof receipt/i)
  }

  const source = readFileSync('scripts/onprem-keycloak-runtime-proof.mjs', 'utf8')
  assert.doesNotMatch(source, /code_challenge=synthetic|hr-axis\.example\.invalid|grep -q '200' <&3 \|\| grep -q '302'/)
  const helper = source.indexOf('const executePersonaAuthProof')
  const parse = source.indexOf('JSON.parse(scanCapture(capture, label))', helper)
  const validate = source.indexOf('assertKeycloakAuthProofReceipt(parsed)', parse)
  const initial = source.indexOf("executePersonaAuthProof('initial Keycloak persona auth proof')", validate)
  const retry = source.indexOf("'Keycloak bootstrap idempotency retry'", initial)
  const postReconcile = source.indexOf("executePersonaAuthProof('post-reconcile Keycloak persona auth proof')", retry)
  const accepted = source.indexOf('receipt.keycloak.authorizationEndpoint = true', postReconcile)
  assert.ok(helper > 0 && helper < parse && parse < validate && validate < initial && initial < retry && retry < postReconcile && postReconcile < accepted)
})

test('Keycloak auth proof bind sources are absolute for Docker', () => {
  const mounts = resolveAuthProofMounts({
    accountsFile: 'infra/onprem/core/secret-files/keycloak/synthetic-accounts',
    caFile: 'infra/onprem/core/secret-files/postgres/ca.crt',
    cwd: 'synthetic-workspace',
  })
  assert.equal(mounts.accountsFile, resolve('synthetic-workspace', 'infra/onprem/core/secret-files/keycloak/synthetic-accounts'))
  assert.equal(mounts.caFile, resolve('synthetic-workspace', 'infra/onprem/core/secret-files/postgres/ca.crt'))
  assert.equal(isAbsolute(mounts.accountsFile), true)
  assert.equal(isAbsolute(mounts.caFile), true)
  assert.throws(() => resolveAuthProofMounts({ accountsFile: '', caFile: 'ca.crt', cwd: '/workspace' }), /mount/i)

  const source = readFileSync('scripts/onprem-keycloak-runtime-proof.mjs', 'utf8')
  const authContainer = source.slice(source.indexOf('const executePersonaAuthProof'), source.indexOf('const parsed = JSON.parse', source.indexOf('const executePersonaAuthProof')))
  assert.match(authContainer, /'--user', '1000:1000'/)
  assert.doesNotMatch(authContainer, /'--network', 'host'/)
  assert.match(authContainer, /'--network', authProofNetwork/)
  assert.match(authContainer, /'--connect-host', 'caddy', '--connect-port', '8443'/)
  assert.match(authContainer, /'node', '\/opt\/onprem-keycloak-auth-proof\.mjs'/)
})

test('Keycloak auth proof joins only the release-bound private edge network', () => {
  const options = { project: 'hr-axis-onprem-keycloak', releaseId: 'synthetic-release' }
  const config = {
    services: {
      caddy: {
        labels: {
          'com.hr-axis.project': 'hr-axis-onprem-core',
          'com.hr-axis.data-class': 'synthetic',
          'com.hr-axis.release-id': options.releaseId,
        },
        networks: { edge: null, proxy: null },
      },
    },
    networks: {
      edge: {
        name: 'hr-axis-onprem-keycloak_edge',
        labels: {
          'com.hr-axis.project': 'hr-axis-onprem-core',
          'com.hr-axis.data-class': 'synthetic',
          'com.hr-axis.network-class': 'edge',
          'com.hr-axis.release-id': options.releaseId,
        },
      },
    },
  }
  assert.equal(resolveAuthProofNetwork(config, options), 'hr-axis-onprem-keycloak_edge')
  for (const mutate of [
    value => { value.networks.edge.name = 'other_edge' },
    value => { value.networks.edge.labels['com.hr-axis.project'] = 'other' },
    value => { value.networks.edge.labels['com.hr-axis.data-class'] = 'production' },
    value => { value.networks.edge.labels['com.hr-axis.network-class'] = 'data' },
    value => { value.networks.edge.labels['com.hr-axis.release-id'] = 'other-release' },
    value => { delete value.services.caddy.networks.edge },
    value => { value.services.caddy.labels['com.hr-axis.release-id'] = 'other-release' },
  ]) {
    const invalid = structuredClone(config)
    mutate(invalid)
    assert.throws(() => resolveAuthProofNetwork(invalid, options), /edge network identity/i)
  }
})

test('Keycloak Docker capture scans failed partial output before a sanitized retrieval error', () => {
  const canary = 'synthetic-partial-keycloak-password-canary'
  let scanned = false
  assert.throws(
    () => runDockerCapture([], 'stopped Keycloak graceful-shutdown logs', (capture) => {
      scanned = true
      assertSecretSafeLogsWithValues(capture.stderr, 'partial stopped Keycloak logs', new Set([canary]))
    }, () => ({ status: 23, signal: null, error: null, stdout: '', stderr: `partial password=${canary}` })),
    error => scanned && /stopped Keycloak graceful-shutdown logs failed/.test(error.message) && !error.message.includes(canary),
  )
})

test('Keycloak bootstrap diagnostics classify only allowlisted safe markers', () => {
  const cases = [
    ['temporary Keycloak server exited before authentication', 'server-exited-before-authentication'],
    ['temporary bootstrap principal authentication failed', 'bootstrap-auth-timeout'],
    ['required database secret is empty', 'database-or-tls-contract'],
    ['realm settings reconciliation failed', 'realm-reconciliation'],
    ['secret value contains unsupported characters', 'secret-contract'],
    ['configuration contains unsupported characters: KEYCLOAK_SMTP_FROM', 'secret-contract'],
  ]
  for (const [marker, category] of cases) {
    assert.deepEqual(
      classifyKeycloakBootstrapDiagnostic({
        status: 1,
        signal: null,
        stdout: 'keycloak-bootstrap-1  | lifecycle output that is not a diagnostic marker',
        stderr: `keycloak bootstrap: failed closed (${marker})\nkeycloak bootstrap: server log scan passed (bounded bytes=128)`,
      }),
      { category, phase: null, exitCode: 1, signal: null },
    )
  }
})

test('Keycloak bootstrap diagnostics report the last exact phase with its primary category', () => {
  assert.deepEqual(
    classifyKeycloakBootstrapDiagnostic({
      status: 1,
      signal: null,
      stdout: 'keycloak-bootstrap-1  | unrelated lifecycle noise\nkeycloak bootstrap: phase=secret-input',
      stderr: 'keycloak bootstrap: phase=realm-reconciliation\nkeycloak bootstrap: failed closed (realm settings reconciliation failed)',
    }),
    { category: 'realm-reconciliation', phase: 'realm-reconciliation', exitCode: 1, signal: null },
  )
})

test('Keycloak bootstrap diagnostics fail closed for malformed phase markers and phase/category ambiguity', () => {
  for (const stderr of [
    'keycloak bootstrap: phase=unknown-phase\nkeycloak bootstrap: failed closed (realm settings reconciliation failed)',
    'keycloak bootstrap: phase=realm-reconciliation trailing\nkeycloak bootstrap: failed closed (realm settings reconciliation failed)',
    'keycloak bootstrap: phase=realm-reconciliation\nkeycloak bootstrap: failed closed (realm settings reconciliation failed)\nkeycloak bootstrap: failed closed (required database secret is empty)',
    'keycloak bootstrap: phase=realm-reconciliation\nkeycloak bootstrap: failed closed (realm settings reconciliation failed) password=synthetic-diagnostic-secret',
  ]) {
    assert.deepEqual(
      classifyKeycloakBootstrapDiagnostic({ status: 1, signal: null, stdout: '', stderr }),
      { category: 'generic-failed-closed', phase: null, exitCode: 1, signal: null },
    )
  }
})

test('Keycloak bootstrap diagnostics fail closed for malformed or secret-bearing text', () => {
  const secret = 'synthetic-diagnostic-secret'
  const diagnostic = classifyKeycloakBootstrapDiagnostic({
    status: 1,
    signal: null,
    stdout: `keycloak bootstrap: failed closed (realm settings reconciliation failed) password=${secret}`,
    stderr: '',
  })
  assert.deepEqual(diagnostic, { category: 'generic-failed-closed', phase: null, exitCode: 1, signal: null })
  assert.doesNotMatch(JSON.stringify(diagnostic), new RegExp(secret))
  assert.deepEqual(
    classifyKeycloakBootstrapDiagnostic({ status: 1, signal: null, stdout: 'not an approved marker', stderr: '' }),
    { category: 'generic-failed-closed', phase: null, exitCode: 1, signal: null },
  )
  assert.deepEqual(
    classifyKeycloakBootstrapDiagnostic({
      status: 1,
      signal: null,
      stdout: 'keycloak bootstrap: failed closed (realm settings reconciliation failed) trailing',
      stderr: '',
    }),
    { category: 'generic-failed-closed', phase: null, exitCode: 1, signal: null },
  )
  assert.deepEqual(
    classifyKeycloakBootstrapDiagnostic({
      status: 1,
      signal: null,
      stdout: 'keycloak bootstrap: failed closed (realm settings reconciliation failed)',
      stderr: 'keycloak bootstrap: failed closed (required database secret is empty)',
    }),
    { category: 'generic-failed-closed', phase: null, exitCode: 1, signal: null },
  )
})

test('Keycloak bootstrap diagnostics classify SIGKILL and exit 137 as external termination without OOM claims', () => {
  for (const input of [
    { status: 137, signal: null },
    { status: null, signal: 'SIGKILL' },
  ]) {
    const diagnostic = classifyKeycloakBootstrapDiagnostic({
      ...input,
      stdout: 'keycloak bootstrap: failed closed (realm settings reconciliation failed)',
      stderr: '',
    })
    assert.deepEqual(diagnostic, {
      category: 'resource-or-external-termination',
      phase: null,
      exitCode: input.status,
      signal: input.signal === 'SIGKILL' ? 'SIGKILL' : null,
    })
    assert.doesNotMatch(JSON.stringify(diagnostic), /oom/i)
  }
})

test('Keycloak bootstrap failure diagnostics scan child output before classification', () => {
  const source = readFileSync('scripts/onprem-keycloak-runtime-proof.mjs', 'utf8')
  const scan = source.indexOf('inspectOutput?.(output)')
  const classify = source.indexOf('classifyKeycloakBootstrapDiagnostic', scan)
  const failure = source.indexOf('throw new Error(`${label} failed', classify)
  assert.ok(scan > 0 && scan < classify && classify < failure)
})

test('Keycloak bootstrap cleanup preserves the primary failure phase before scanning logs', () => {
  const source = readFileSync('infra/onprem/core/keycloak/bootstrap.sh', 'utf8')
  const cleanup = source.match(/cleanup\(\) \{[\s\S]*?\n\}\ntrap cleanup/)?.[0] ?? ''
  assert.match(cleanup, /if \[ "\$status" -eq 0 \]; then\s+phase_marker server-log-scan\s+fi\s+scan_server_log/)
})

test('Keycloak runtime scan keeps credentials but excludes the fixed database role identity', () => {
  const directory = mkdtempSync(join(tmpdir(), 'onprem-keycloak-secret-scan-'))
  try {
    const compose = join(directory, 'compose.yaml')
    writeFileSync(join(directory, 'database-username'), 'keycloak')
    writeFileSync(join(directory, 'database-password'), 'synthetic-password-canary')
    writeFileSync(compose, `secrets:\n  keycloak_database_username:\n    file: ./database-username\n  keycloak_database_password:\n    file: ./database-password\n`)
    const values = collectSecretValues({ compose })
    assert.equal(values.has('keycloak'), false)
    assert.equal(values.has('synthetic-password-canary'), true)
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})

test('Keycloak inner server-log scan ignores org.keycloak noise but catches a credential canary', () => {
  const source = readFileSync('infra/onprem/core/keycloak/bootstrap.sh', 'utf8')
  const scanFunction = source.match(/scan_server_log\(\) \{[\s\S]*?\n\}\ncleanup\(\)/)?.[0]?.replace(/\ncleanup\(\)$/, '')
  assert.ok(scanFunction, 'bootstrap server-log scan function must remain statically bounded')
  const candidateLine = scanFunction.match(/for candidate in ([^\n]+); do/)?.[1] ?? ''
  assert.doesNotMatch(candidateLine, /database_username/)
  assert.match(candidateLine, /database_password/)
  assert.match(scanFunction, /account_password/)

  const shellProbe = spawnSync('sh', ['-c', 'exit 0'], { encoding: 'utf8', windowsHide: true })
  if (shellProbe.error) return

  const directory = mkdtempSync(join(tmpdir(), 'onprem-keycloak-inner-scan-'))
  try {
    const serverLog = join(directory, 'server.log')
    const bootstrapPassword = join(directory, 'bootstrap-password')
    const accountsFile = join(directory, 'accounts')
    writeFileSync(bootstrapPassword, 'bootstrap-password-canary')
    writeFileSync(accountsFile, 'onprem.store-manager|synthetic-user|synthetic-account-password-canary|STORE_MANAGER\n')
    const runScan = (text) => {
      writeFileSync(serverLog, text)
      const script = `set -eu
server_log="$1"
bootstrap_password_file="$2"
accounts_file="$3"
bootstrap_password='bootstrap-password-canary'
smtp_password='smtp-password-canary'
smtp_auth_user='smtp-user-canary'
database_username='keycloak'
database_password='database-password-canary'
database_url='jdbc:postgresql://postgres:5432/keycloak?sslmode=verify-full'
${scanFunction}
scan_server_log
`
      return spawnSync('sh', ['-eu', '-c', script, 'scan-test', serverLog, bootstrapPassword, accountsFile], {
        encoding: 'utf8',
        windowsHide: true,
      })
    }

    assert.equal(runScan('org.keycloak.SomeLogger: server started').status, 0)
    for (const canary of [
      'bootstrap-password-canary',
      'smtp-password-canary',
      'smtp-user-canary',
      'database-password-canary',
      'jdbc:postgresql://postgres:5432/keycloak?sslmode=verify-full',
      'synthetic-account-password-canary',
    ]) {
      assert.notEqual(runScan(`WARN leaked ${canary}`).status, 0, canary)
    }
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})

test('Keycloak runtime proof is explicitly synthetic and receipt-safe', () => {
  assert.throws(
    () => runKeycloakRuntimeProof({ execute: true }),
    /PostgreSQL dependency startup|project|failed/i,
  )
})

test('Keycloak runtime cleanup only deletes volumes behind the exact identity guard', () => {
  const source = readFileSync('scripts/onprem-keycloak-runtime-proof.mjs', 'utf8')
  assert.match(source, /com\.docker\.compose\.project/)
  assert.match(source, /com\.hr-axis\.project.*hr-axis-onprem-core/)
  assert.match(source, /com\.hr-axis\.data-class.*synthetic/)
  assert.match(source, /com\.hr-axis\.release-id.*options\.releaseId/)
  assert.match(source, /KEYCLOAK_VOLUME_CLASSES/)
  assert.match(source, /assertComposeIdentity/)
  assert.match(source, /logsSecretScanned/)
  assert.match(source, /gracefulStopVerified/)
  assert.match(source, /noRawCredentials/)
  assert.match(source, /if \(receipt\.keycloak\.hostPortPublished\)/)
  assert.match(source, /if \(!receipt\.keycloak\.imagePinned\)/)
  assert.match(source, /assertGuardedContainers/)
  assert.match(source, /com\.docker\.compose\.service/)
  assert.match(source, /ALLOWED_SERVICES/)
  assert.match(source, /downArgs.*--remove-orphans/)
  assert.match(source, /fresh-volume cleanup.*removeVolumes: true/)
  assert.match(source, /Keycloak runtime cleanup.*removeVolumes: false/)
  assert.match(source, /--cleanup/)
  assert.match(source, /collectFirewallEvidence/)
  assert.match(source, /firewallRejectCounters/)
  assert.match(source, /publicAdminDenials/)
  assert.match(source, /providerSignedOverbroadClaims/)
  assert.match(source, /jwksRotation/)
})

const cleanupOptions = { project: 'hr-axis-onprem-keycloak', releaseId: 'synthetic-release-v1' }
const cleanupLabels = (service, overrides = {}) => ({
  'com.docker.compose.project': cleanupOptions.project,
  'com.docker.compose.service': service,
  'com.docker.compose.container-number': '1',
  'com.docker.compose.oneoff': 'False',
  'com.hr-axis.project': 'hr-axis-onprem-core',
  'com.hr-axis.data-class': 'synthetic',
  'com.hr-axis.release-id': cleanupOptions.releaseId,
  ...overrides,
})

test('Keycloak cleanup rejects duplicate service, non-1 index, and one-off identities', () => {
  const container = (service, overrides) => ({ id: `${service}-id`, Config: { Labels: cleanupLabels(service, overrides) } })
  assert.throws(
    () => validateComposeContainerIdentities([container('postgres'), container('postgres')], cleanupOptions),
    /duplicate Compose service identity/i,
  )
  assert.throws(
    () => validateComposeContainerIdentities([container('postgres', { 'com.docker.compose.container-number': '2' })], cleanupOptions),
    /container-number/i,
  )
  assert.throws(
    () => validateComposeContainerIdentities([container('postgres', { 'com.docker.compose.oneoff': 'True' })], cleanupOptions),
    /one-off/i,
  )
})

test('Keycloak runtime counter parser scopes only project egress reject rules', async () => {
  const { parseRejectCounters } = await import('./onprem-keycloak-runtime-proof.mjs')
  const counters = parseRejectCounters([
    '*filter',
    ':DOCKER-USER - [0:0]',
    '[3:120] -A DOCKER-USER -s 172.30.0.0/24 -j REJECT',
    '[4:80] -A DOCKER-USER -s 172.30.10.0/24 -j REJECT',
    '[0:0] -A DOCKER-USER -s 172.30.20.0/24 -j REJECT',
    '[1:30] -A DOCKER-USER -s 172.30.30.0/24 -j REJECT',
    '[99:900] -A DOCKER-USER -s 10.0.0.0/8 -j REJECT',
    'COMMIT',
  ].join('\n'))
  assert.deepEqual(counters, { packets: 8, bytes: 230, ruleCount: 4 })
})

test('Keycloak final firewall checkpoint covers the complete retry and restart phase', () => {
  const source = readFileSync('scripts/onprem-keycloak-runtime-proof.mjs', 'utf8')
  const retry = source.indexOf('Keycloak bootstrap idempotency retry')
  const restart = source.indexOf('Keycloak restart after retry')
  const health = source.indexOf('Keycloak health after retry')
  const metadata = source.indexOf('Keycloak metadata after retry')
  const retryLogs = source.indexOf('Keycloak retry project secret-log scan')
  const firewallAfter = source.indexOf("const firewallAfter = collectScopedFirewallCounters('Keycloak post-auth')")
  const firewallAssertion = source.indexOf('const firewallDelta = assertFirewallCounterDelta(', firewallAfter)
  assert.ok(retry > 0 && retry < restart && restart < health && health < metadata && metadata < retryLogs)
  assert.ok(retryLogs < firewallAfter && firewallAfter < firewallAssertion)
})

test('Keycloak retry restart waits within the bounded healthcheck budget before direct probes', () => {
  const source = readFileSync('scripts/onprem-keycloak-runtime-proof.mjs', 'utf8')
  const restart = source.indexOf("[...base, 'up', '-d', '--wait', '--wait-timeout', '180', 'keycloak']")
  const health = source.indexOf('Keycloak health after retry')
  assert.ok(restart > 0 && restart < health)
  assert.doesNotMatch(source, /\[\.\.\.base, 'up', '-d', 'keycloak'\], 'Keycloak restart after retry'/)
})

test('Keycloak stop uses the validated identity, explicit SIGTERM/60s, and one optional-marker read', () => {
  const source = readFileSync('scripts/onprem-keycloak-runtime-proof.mjs', 'utf8')
  const stop = source.indexOf("buildKeycloakStopArgs(keycloakBeforeIdentity.containerId)")
  const inspect = source.indexOf("'post-stop Keycloak state'", stop)
  const controlled = source.indexOf('assertControlledKeycloakStop({', inspect)
  const observation = source.indexOf('observeKeycloakGracefulStop({', controlled)
  const logs = source.indexOf("['logs', '--since', since, '--timestamps', keycloakBeforeIdentity.containerId]", observation)
  const retry = source.indexOf('Keycloak bootstrap idempotency retry', observation)
  const restartInspect = source.indexOf("'post-restart Keycloak state'", retry)
  const restartIdentity = source.indexOf('assertKeycloakContainerIdentity({ containerId: keycloakBeforeIdentity.containerId', restartInspect)
  assert.ok(stop > 0 && stop < inspect && inspect < controlled && controlled < observation && observation < logs && logs < retry && retry < restartInspect && restartInspect < restartIdentity)
  assert.match(source, /runDockerCapture\(\s*buildKeycloakStopArgs\(keycloakBeforeIdentity\.containerId\),\s*'explicit Keycloak SIGTERM stop'/)
  assert.match(source, /runDockerCapture\([\s\S]*\['logs', '--since', since, '--timestamps', keycloakBeforeIdentity\.containerId\][\s\S]*\(value\) => scanCapture\(value, 'stopped Keycloak graceful-shutdown logs'\)/)
  assert.match(source, /const stoppedKeycloakId = runDocker\(\[\.\.\.base, 'ps', '--all', '--quiet', '--no-trunc', 'keycloak'\]/)
  assert.match(source, /assertKeycloakPreStopState\(\{ containerId: stoppedKeycloakId, inspect: keycloakBeforeInspect \}\)/)
  assert.match(source, /receipt\.keycloak\.gracefulStopLifecycleVerified = keycloakStopProof\.lifecycleVerified/)
  assert.match(source, /receipt\.keycloak\.gracefulStopMarkerObserved = keycloakLogObservation\.markerObserved/)
  assert.match(source, /receipt\.keycloak\.restartIdentityVerified = true/)
  assert.match(source, /receipt\.keycloak\.restartCountStable = true/)
  assert.doesNotMatch(source, /waitForGracefulStop|KEYCLOAK_GRACEFUL_STOP_WAIT|KEYCLOAK_GRACEFUL_STOP_MAX_ATTEMPTS/)
  assert.doesNotMatch(source, /runDocker\(\[\.\.\.base, 'stop', 'keycloak'/)
  assert.doesNotMatch(source, /keycloakStopTimestamp|new Date\(\)\.toISOString\(\).*Keycloak/)
  assert.equal((source.match(/scanCapture\((?:capture|value), 'stopped Keycloak graceful-shutdown logs'\)/g) ?? []).length, 1)
})

test('Keycloak Compose lifecycle keeps init false, direct exec, default SIGTERM, and 60s grace', () => {
  const compose = readFileSync('infra/onprem/core/compose.yaml', 'utf8')
  const start = compose.search(/\r?\n  keycloak:\r?\n/)
  const end = compose.search(/\r?\n  keycloak-bootstrap:\r?\n/)
  const keycloak = compose.slice(start, end)
  assert.match(keycloak, /\n    init: false\r?\n/)
  assert.match(keycloak, /exec \/opt\/keycloak\/bin\/kc\.sh start --optimized/)
  assert.match(keycloak, /\n    stop_grace_period: 60s\r?\n/)
  assert.doesNotMatch(keycloak, /\n    stop_signal:/)
})

test('Keycloak firewall proof rejects a reset reject counter', () => {
  assert.throws(
    () => assertFirewallCounterDelta({ packets: 4, bytes: 256 }, { packets: 3, bytes: 256 }),
    /counter reset/i,
  )
})

test('Keycloak firewall proof rejects any positive blocked packet or byte delta', () => {
  assert.throws(
    () => assertFirewallCounterDelta({ packets: 4, bytes: 256 }, { packets: 5, bytes: 256 }),
    /blocked outbound traffic.*packets=1.*bytes=0/i,
  )
  assert.throws(
    () => assertFirewallCounterDelta({ packets: 4, bytes: 256 }, { packets: 4, bytes: 257 }),
    /blocked outbound traffic.*packets=0.*bytes=1/i,
  )
})
