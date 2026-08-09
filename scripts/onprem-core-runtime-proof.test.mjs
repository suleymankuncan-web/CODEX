import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  assertNoSecretLeak,
  assertProbeOutput,
  assertSecretSourceMetadata,
  egressRejectCounters,
  migrationTreeDigestFromOutput,
  parseMigrationIdentity,
  redact,
} from './onprem-core-runtime-proof.mjs'

const subnets = ['172.30.0.0/24', '172.30.10.0/24', '172.30.20.0/24', '172.30.30.0/24']

test('runtime proof reads packet counters from iptables-save -c output', () => {
  const suffixCounters = subnets
    .map((subnet, index) => `-A DOCKER-USER -s ${subnet} -m conntrack --ctstate NEW -c ${index} ${index * 64} -j REJECT`)
    .join('\n')
  const counters = egressRejectCounters(suffixCounters)

  assert.deepEqual(counters.get('172.30.20.0/24'), { bytes: 128, packets: 2 })

  const prefixCounters = subnets
    .map((subnet, index) => `[${index}:${index * 128}] -A DOCKER-USER -s ${subnet} -m conntrack --ctstate NEW -j REJECT`)
    .join('\n')
  assert.deepEqual(egressRejectCounters(prefixCounters).get('172.30.30.0/24'), { bytes: 384, packets: 3 })
})

test('runtime proof fails closed when a reject rule has no packet counter', () => {
  const rules = subnets
    .map((subnet) => `-A DOCKER-USER -s ${subnet} -m conntrack --ctstate NEW -j REJECT`)
    .join('\n')

  assert.throws(() => egressRejectCounters(rules), /omitted counters/i)
})

test('runtime proof validates the sanitized synthetic queue result contract', () => {
  const output = {
    stderr: '',
    stdout: '{"event":"onprem.synthetic_queue_probe.completed","mode":"process","processedCount":1,"duplicateCount":0,"status":"completed"}\n',
  }

  assert.doesNotThrow(() => assertProbeOutput(output, { duplicateCount: 0, mode: 'process', processedCount: 1, status: 'completed' }))
  assert.throws(() => assertProbeOutput(output, { markerCount: 1, mode: 'status', state: 'completed' }), /status omitted the completion event|result mismatch/i)
})

test('runtime proof binds the sanitized receipt to the resolved migration tree digest', () => {
  const digest = 'a'.repeat(64)
  assert.equal(
    migrationTreeDigestFromOutput({
      stdout: `prefix {"event":"onprem.migration.completed","migrationTreeDigest":"${digest}"} suffix`,
    }),
    digest,
  )
  assert.throws(
    () => migrationTreeDigestFromOutput({ stdout: '{"appliedCount":1}' }),
    /omitted its resolved tree digest/i,
  )
})

test('runtime proof accepts only the canonical successful migration ledger identity', () => {
  const digest = 'a'.repeat(64)

  assert.deepEqual(parseMigrationIdentity(`67|t|${digest}`), { identity: digest, succeededCount: 67 })
  for (const invalid of [`67|true|${digest}`, `67|f|${digest}`, `67|t|${'a'.repeat(63)}`, `count|t|${digest}`]) {
    assert.throws(() => parseMigrationIdentity(invalid), /migration idempotency\/checksum proof mismatch/i)
  }
})

test('runtime proof rejects symlink secret sources before reading them', () => {
  assert.throws(
    () => assertSecretSourceMetadata('postgres_tls_private_key', {
      isFile: () => true,
      isSymbolicLink: () => true,
    }),
    /regular non-symlink file/i,
  )
})

test('runtime proof reports only secret name and surface and redacts active URL credentials', () => {
  const secretValues = new Map([['api_database_url', 'synthetic-canary-value']])
  assert.throws(
    () => assertNoSecretLeak(secretValues, { 'docker inspect api': 'prefix synthetic-canary-value suffix' }),
    (error) => {
      assert.match(error.message, /docker inspect api: api_database_url/)
      assert.doesNotMatch(error.message, /synthetic-canary-value/)
      return true
    },
  )
  assert.doesNotMatch(
    redact('postgres://runtime:credential@example.invalid/db password=credential'),
    /runtime:credential|password=credential/,
  )
})
