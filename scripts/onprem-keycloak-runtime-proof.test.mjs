import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

import {
  assertFirewallCounterDelta,
  assertSecretSafeLogsWithValues,
  classifyKeycloakBootstrapDiagnostic,
  collectSecretValues,
  runDockerCapture,
  runKeycloakRuntimeProof,
  validateComposeContainerIdentities,
} from './onprem-keycloak-runtime-proof.mjs'

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

test('Keycloak stop is inspected and secret-scanned before bootstrap retry', () => {
  const source = readFileSync('scripts/onprem-keycloak-runtime-proof.mjs', 'utf8')
  const timestamp = source.indexOf('const keycloakStopTimestamp = new Date().toISOString()')
  const stop = source.indexOf("'stop', 'keycloak'")
  const inspect = source.indexOf("'stopped Keycloak state'", stop)
  const observation = source.indexOf('observeKeycloakGracefulStop({', inspect)
  const logs = source.indexOf("['logs', '--since', since, '--timestamps', stoppedKeycloakId]", observation)
  const retry = source.indexOf('Keycloak bootstrap idempotency retry', observation)
  assert.ok(timestamp > 0 && timestamp < stop && stop < inspect && inspect < observation && observation < logs && logs < retry)
  assert.match(source, /runDockerCapture\([\s\S]*\['logs', '--since', since, '--timestamps', stoppedKeycloakId\][\s\S]*\(capture\) => scanCapture\(capture, 'stopped Keycloak graceful-shutdown logs'\)/)
  assert.match(source, /\['logs', '--since', since, '--timestamps', stoppedKeycloakId\]/)
  assert.doesNotMatch(source, /runDockerCapture\(\['logs', stoppedKeycloakId\]/)
  assert.equal((source.match(/scanCapture\(capture, 'stopped Keycloak graceful-shutdown logs'\)/g) ?? []).length, 1)
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
