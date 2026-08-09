import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

import {
  assertFirewallCounterDelta,
  runKeycloakRuntimeProof,
  validateComposeContainerIdentities,
} from './onprem-keycloak-runtime-proof.mjs'

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
    '[99:900] -A DOCKER-USER -s 10.0.0.0/8 -j REJECT',
    'COMMIT',
  ].join('\n'))
  assert.deepEqual(counters, { packets: 3, bytes: 120, ruleCount: 1 })
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
