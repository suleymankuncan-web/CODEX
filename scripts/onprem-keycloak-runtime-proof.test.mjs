import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

import {
  assertFirewallCounterDelta,
  classifyKeycloakBootstrapDiagnostic,
  collectSecretValues,
  runKeycloakRuntimeProof,
  validateComposeContainerIdentities,
} from './onprem-keycloak-runtime-proof.mjs'

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
      { category, exitCode: 1, signal: null },
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
  assert.deepEqual(diagnostic, { category: 'generic-failed-closed', exitCode: 1, signal: null })
  assert.doesNotMatch(JSON.stringify(diagnostic), new RegExp(secret))
  assert.deepEqual(
    classifyKeycloakBootstrapDiagnostic({ status: 1, signal: null, stdout: 'not an approved marker', stderr: '' }),
    { category: 'generic-failed-closed', exitCode: 1, signal: null },
  )
  assert.deepEqual(
    classifyKeycloakBootstrapDiagnostic({
      status: 1,
      signal: null,
      stdout: 'keycloak bootstrap: failed closed (realm settings reconciliation failed) trailing',
      stderr: '',
    }),
    { category: 'generic-failed-closed', exitCode: 1, signal: null },
  )
  assert.deepEqual(
    classifyKeycloakBootstrapDiagnostic({
      status: 1,
      signal: null,
      stdout: 'keycloak bootstrap: failed closed (realm settings reconciliation failed)',
      stderr: 'keycloak bootstrap: failed closed (required database secret is empty)',
    }),
    { category: 'generic-failed-closed', exitCode: 1, signal: null },
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

test('Keycloak stop is inspected and secret-scanned before bootstrap retry', () => {
  const source = readFileSync('scripts/onprem-keycloak-runtime-proof.mjs', 'utf8')
  const stop = source.indexOf("'stop', 'keycloak'")
  const inspect = source.indexOf("'stopped Keycloak state'", stop)
  const logs = source.indexOf("'stopped Keycloak graceful-shutdown logs'", inspect)
  const assertion = source.indexOf('assertGracefulStopState(', logs)
  const retry = source.indexOf('Keycloak bootstrap idempotency retry', assertion)
  assert.ok(stop > 0 && stop < inspect && inspect < logs && logs < assertion && assertion < retry)
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
