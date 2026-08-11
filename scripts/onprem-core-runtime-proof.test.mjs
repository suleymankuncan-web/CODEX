import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { checkServerIdentity } from 'node:tls'

import {
  assertNoSecretLeak,
  assertSecretSourceMetadata,
  command,
  classifyTlsProbeResult,
  egressRejectCounters,
  migrationTreeDigestFromOutput,
  parseMigrationIdentity,
  parseSequencePrivilegeMatrix,
  redact,
  sanitizeTlsErrorCode,
  buildRedisProbeComposeArgs,
  buildTlsProbeDockerArgs,
  serviceFailureDiagnostic,
  TLS_WRONG_CA_CODES,
  verifyCaddyRuntimeInvariants,
  EXPECTED_PUBLIC_SECRET_NAMES,
  isConfidentialRuntimeSecretName,
  EXPECTED_SECRET_UIDS,
  validateCoreCleanupContainerIdentities,
} from './onprem-core-runtime-proof.mjs'
import {
  assertGracefulStopState,
  KEYCLOAK_GRACEFUL_STOP_MAX_ATTEMPTS,
  KEYCLOAK_GRACEFUL_STOP_WAIT_MS,
  observeKeycloakGracefulStop,
} from './onprem-graceful-stop-contract.mjs'
import { CADDY_CMDLINE, TLS_SAFE_ERROR_CODES } from './onprem-caddy-runtime-proof.mjs'
import {
  assertProbeOutput,
  buildStoppedAofInventoryScript,
  buildStoppedAofSemanticInspectorScript,
  classifyQueueFailureReason,
  classifyStoppedAofCommandSequence,
  classifyRedisPersistenceLogs,
  collectStoppedAofInventoryEvidence,
  collectRedisRestartLogDelta,
  parseStoppedAofInventory,
  readBoundedAofFiles,
  resolveStoppedAofManifest,
  sanitizeQueuePersistenceCheckpoint,
} from './onprem-redis-persistence-diagnostic.mjs'

const respCommand = (...args) => Buffer.from(
  `*${args.length}\r\n${args.map((arg) => `$${Buffer.byteLength(String(arg))}\r\n${arg}\r\n`).join('')}`,
)

const respStream = (...commands) => Buffer.concat(commands.map((args) => respCommand(...args)))

const subnets = ['172.30.0.0/24', '172.30.10.0/24', '172.30.20.0/24', '172.30.30.0/24']

const cleanupOptions = { project: 'hr-axis-onprem-core', releaseId: 'synthetic-release-v1' }
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

test('core cleanup rejects duplicate service, non-1 index, and one-off identities', () => {
  const container = (service, overrides) => ({ id: `${service}-id`, Config: { Labels: cleanupLabels(service, overrides) } })
  assert.throws(
    () => validateCoreCleanupContainerIdentities([container('postgres'), container('postgres')], cleanupOptions),
    /duplicate Compose service identity/i,
  )
  assert.throws(
    () => validateCoreCleanupContainerIdentities([container('postgres', { 'com.docker.compose.container-number': '2' })], cleanupOptions),
    /container-number/i,
  )
  assert.throws(
    () => validateCoreCleanupContainerIdentities([container('postgres', { 'com.docker.compose.oneoff': 'True' })], cleanupOptions),
    /one-off/i,
  )
})

test('runtime secret ownership map covers every Compose file-backed secret', () => {
  const compose = readFileSync('infra/onprem/core/compose.yaml', 'utf8')
  const secretSection = compose.split(/\nsecrets:\r?\n/, 2)[1]?.split(/\n\S/, 1)[0] ?? ''
  const names = [...secretSection.matchAll(/^  ([a-z0-9_]+):\r?$/gm)].map((match) => match[1]).sort()
  const covered = new Set([...EXPECTED_PUBLIC_SECRET_NAMES, ...Object.keys(EXPECTED_SECRET_UIDS)])
  assert.deepEqual(names, [...covered].sort())
})

test('runtime secret value scan exempts only the fixed Keycloak database role identity', () => {
  assert.equal(isConfidentialRuntimeSecretName('keycloak_database_username'), false)
  for (const name of ['keycloak_database_password', 'keycloak_bootstrap_username', 'keycloak_smtp_auth_user', 'api_database_url']) {
    assert.equal(isConfidentialRuntimeSecretName(name), true, `${name} must remain value-scanned`)
  }
})

test('core command scans a failed partial log capture before a fixed retrieval error', () => {
  const canary = 'synthetic-partial-log-password-canary'
  let scanned = false
  assert.throws(
    () => command(process.execPath, ['-e', `process.stdout.write(${JSON.stringify(canary)}); process.exit(23)`], {
      label: 'stopped Keycloak logs',
      suppressOutput: true,
      inspectOutput: (capture) => {
        scanned = true
        assertNoSecretLeak(new Map([['stopped_keycloak_password', canary]]), { 'partial stopped logs': capture.stdout })
      },
    }),
    error => scanned && error.message === 'stopped Keycloak logs failed' && !error.message.includes(canary),
  )
})

test('Keycloak SIGTERM is graceful only with a clean exit state and official shutdown marker', () => {
  const state = { Status: 'exited', Running: false, Paused: false, Restarting: false, OOMKilled: false, Dead: false, Error: '', ExitCode: 143 }
  const logs = 'INFO [io.quarkus] (Shutdown thread) Keycloak stopped in 0.123s'
  assert.deepEqual(assertGracefulStopState({ service: 'keycloak', state, logs }), { exitCode: 143, markerObserved: true })
  assert.deepEqual(assertGracefulStopState({ service: 'keycloak', state: { ...state, ExitCode: 0 }, logs }), { exitCode: 0, markerObserved: true })
  assert.throws(() => assertGracefulStopState({ service: 'keycloak', state, logs: '' }), /graceful shutdown marker missing/)
  assert.throws(() => assertGracefulStopState({ service: 'keycloak', state, logs: 'INFO [wrong.logger] (Shutdown thread) Keycloak stopped in 0.123s' }), /marker missing/)
  assert.throws(() => assertGracefulStopState({ service: 'keycloak', state, logs: 'INFO [io.quarkus] (main) Keycloak stopped in 0.123s' }), /marker missing/)
  assert.throws(() => assertGracefulStopState({ service: 'keycloak', state: { ...state, ExitCode: 137 }, logs }), /did not stop gracefully/)
  assert.throws(() => assertGracefulStopState({ service: 'keycloak', state: { ...state, OOMKilled: true }, logs }), /did not stop gracefully/)
  assert.throws(() => assertGracefulStopState({ service: 'keycloak', state: { ...state, Running: true }, logs }), /"running":true/)
  assert.throws(() => assertGracefulStopState({ service: 'keycloak', state: { ...state, Paused: true }, logs }), /did not stop gracefully/)
  assert.throws(() => assertGracefulStopState({ service: 'keycloak', state: { ...state, Restarting: true }, logs }), /"restarting":true/)
  assert.throws(() => assertGracefulStopState({ service: 'keycloak', state: { ...state, Dead: true }, logs }), /"dead":true/)
  assert.throws(() => assertGracefulStopState({ service: 'keycloak', state: { ...state, Error: 'sensitive runtime detail' }, logs }), /"errorPresent":true/)
  assert.throws(
    () => assertGracefulStopState({ service: 'keycloak', state: { ...state, Error: 'sensitive runtime detail' }, logs }),
    error => !error.message.includes('sensitive runtime detail'),
  )
})

test('graceful-stop log evidence remains secret-safe and other services stay zero-exit only', () => {
  const state = { Status: 'exited', Running: false, Paused: false, Restarting: false, OOMKilled: false, Dead: false, Error: '', ExitCode: 143 }
  const secretValues = new Map([['keycloak_database_password', 'synthetic-password-canary']])
  assert.throws(() => assertGracefulStopState({ service: 'keycloak', state, logs: 'Keycloak stopped in 0.1s synthetic-password-canary', secretValues }), /secret value leaked/)
  assert.throws(() => assertGracefulStopState({ service: 'keycloak', state, logs: 'INFO [io.quarkus] (Shutdown thread) Keycloak stopped in 0.1s set-secret-canary', secretValues: new Set(['set-secret-canary']) }), /secret value leaked/)
  assert.throws(() => assertGracefulStopState({ service: 'api', state, logs: '' }), /did not stop gracefully/)
  assert.doesNotThrow(() => assertGracefulStopState({ service: 'api', state: { ...state, ExitCode: 0 }, logs: '' }))
})

test('Keycloak graceful-stop observation accepts a marker that appears on a later fresh-log poll', () => {
  const state = { Status: 'exited', Running: false, Paused: false, Restarting: false, OOMKilled: false, Dead: false, Error: '', ExitCode: 143 }
  const since = '2026-08-11T06:00:00.000Z'
  const reads = []
  const waits = []
  const result = observeKeycloakGracefulStop({
    state,
    since,
    readLogs: ({ since: readSince, timestamps, attempt }) => {
      reads.push({ since: readSince, timestamps, attempt })
      return attempt === 1 ? '2026-08-11T06:00:00.250Z INFO [io.quarkus] (Shutdown thread) Keycloak stopped in 0.123s' : ''
    },
    wait: (delayMs) => waits.push(delayMs),
  })
  assert.deepEqual(result, { exitCode: 143, markerObserved: true, attempts: 2 })
  assert.deepEqual(reads, [
    { since, timestamps: true, attempt: 0 },
    { since, timestamps: true, attempt: 1 },
  ])
  assert.deepEqual(waits, [KEYCLOAK_GRACEFUL_STOP_WAIT_MS])
})

test('Keycloak graceful-stop observation exhausts its bounded polls for missing or lookalike markers', () => {
  const state = { Status: 'exited', Running: false, Paused: false, Restarting: false, OOMKilled: false, Dead: false, Error: '', ExitCode: 0 }
  let reads = 0
  let waits = 0
  assert.throws(
    () => observeKeycloakGracefulStop({
      state,
      since: '2026-08-11T06:00:00.000Z',
      readLogs: () => {
        reads += 1
        return 'INFO [io.quarkus] (main) Keycloak stopped in 0.123s'
      },
      wait: () => { waits += 1 },
    }),
    /graceful shutdown marker missing/,
  )
  assert.equal(reads, KEYCLOAK_GRACEFUL_STOP_MAX_ATTEMPTS)
  assert.equal(waits, KEYCLOAK_GRACEFUL_STOP_MAX_ATTEMPTS - 1)
})

test('Keycloak graceful-stop observation validates clean state before reading logs', () => {
  let reads = 0
  assert.throws(
    () => observeKeycloakGracefulStop({
      state: { Status: 'running', Running: true, Paused: false, Restarting: false, OOMKilled: false, Dead: false, Error: '', ExitCode: 0 },
      since: '2026-08-11T06:00:00.000Z',
      readLogs: () => { reads += 1; return 'stale marker' },
    }),
    /did not stop gracefully/,
  )
  assert.equal(reads, 0)
})

test('Keycloak graceful-stop observation fails immediately on reader errors without exposing reader output', () => {
  let reads = 0
  assert.throws(
    () => observeKeycloakGracefulStop({
      state: { Status: 'exited', Running: false, Paused: false, Restarting: false, OOMKilled: false, Dead: false, Error: '', ExitCode: 143 },
      since: '2026-08-11T06:00:00.000Z',
      readLogs: () => { reads += 1; throw new Error('raw log secret=should-not-escape') },
    }),
    error => error.message === 'keycloak graceful shutdown log retrieval failed' && !error.message.includes('should-not-escape'),
  )
  assert.equal(reads, 1)
})

test('Keycloak graceful-stop observation secret-scans every sample before marker evaluation', () => {
  const state = { Status: 'exited', Running: false, Paused: false, Restarting: false, OOMKilled: false, Dead: false, Error: '', ExitCode: 0 }
  const secretValues = new Map([['keycloak_database_password', 'synthetic-stop-secret']])
  for (const sample of [
    'INFO [io.quarkus] (Shutdown thread) waiting synthetic-stop-secret',
    'INFO [io.quarkus] (Shutdown thread) Keycloak stopped in 0.123s synthetic-stop-secret',
  ]) {
    assert.throws(
      () => observeKeycloakGracefulStop({
        state,
        since: '2026-08-11T06:00:00.000Z',
        secretValues,
        readLogs: () => sample,
      }),
      /secret value leaked/,
    )
  }
})

test('runtime proof stops edge/application, Keycloak, then PostgreSQL/Redis in deterministic stages', () => {
  const source = readFileSync(new URL('./onprem-core-runtime-proof.mjs', import.meta.url), 'utf8')
  const edgeStop = source.indexOf("compose(['stop', 'caddy', 'frontend', 'api', 'worker'], ['runtime'])")
  const edgeVerify = source.indexOf("assertStoppedServiceState(service, ['runtime'], 'edge/application')", edgeStop)
  const postgresHealthyBeforeKeycloak = source.indexOf("waitHealthy('postgres')", edgeVerify)
  const keycloakStop = source.indexOf("compose(['stop', 'keycloak'], ['runtime'])", postgresHealthyBeforeKeycloak)
  const keycloakVerify = source.indexOf("assertStoppedServiceState('keycloak', ['runtime'], 'Keycloak', keycloakStopTimestamp)", keycloakStop)
  const postgresHealthyAfterKeycloak = source.indexOf("waitHealthy('postgres')", keycloakVerify)
  const dataStop = source.indexOf("compose(['stop', 'postgres', 'redis'], ['infra'])", postgresHealthyAfterKeycloak)
  const dataVerify = source.indexOf("assertStoppedServiceState(service, ['infra'], 'postgres/redis')", dataStop)
  const restart = source.indexOf("compose(['up', '--detach', 'postgres', 'redis'], ['infra'])", dataVerify)

  assert.ok(edgeStop > 0 && edgeStop < edgeVerify)
  assert.ok(edgeVerify < postgresHealthyBeforeKeycloak)
  assert.ok(postgresHealthyBeforeKeycloak < keycloakStop && keycloakStop < keycloakVerify)
  assert.ok(keycloakVerify < postgresHealthyAfterKeycloak)
  assert.ok(postgresHealthyAfterKeycloak < dataStop && dataStop < dataVerify)
  assert.ok(dataVerify < restart)

  assert.match(source, /const assertStoppedServiceState = \(service, profiles, phase, stopTimestamp = null\) => \{[\s\S]*command\('docker', \['inspect', containerId\]/)
  assert.match(source, /observeKeycloakGracefulStop\([\s\S]*readLogs: \(\{ since, timestamps \}\)/)
  assert.match(source, /\['logs', '--since', since, '--timestamps', containerId\]/)
  assert.match(source, /label: 'stopped Keycloak logs', suppressOutput: true/)
  assert.match(source, /inspectOutput: \(capture\) => assertNoSecretLeak\(secretValues, \{ 'stopped Keycloak logs': `\$\{capture\.stderr \?\? ''\}\\n\$\{capture\.stdout \?\? ''\}` \}\)/)
  assert.doesNotMatch(source, /command\('docker', \['logs', containerId\]/)
  const keycloakStopTimestamp = source.indexOf('const keycloakStopTimestamp = new Date().toISOString()')
  const freshKeycloakStop = source.indexOf("compose(['stop', 'keycloak']", keycloakStopTimestamp)
  const keycloakStopAssertion = source.indexOf("assertStoppedServiceState('keycloak', ['runtime'], 'Keycloak', keycloakStopTimestamp)", freshKeycloakStop)
  const stoppedState = source.indexOf('const state = JSON.parse(inspectResult.stdout)[0]?.State')
  const observation = source.indexOf('observeKeycloakGracefulStop({', stoppedState)
  const keycloakLogPoll = source.indexOf("['logs', '--since', since, '--timestamps', containerId]", observation)
  assert.ok(keycloakStopTimestamp > 0 && keycloakStopTimestamp < freshKeycloakStop && freshKeycloakStop < keycloakStopAssertion)
  assert.ok(stoppedState > 0 && stoppedState < observation && observation < keycloakLogPoll)
  assert.doesNotMatch(source, /compose\(\['stop',\s*\.\.\.LONG_LIVED\]/)
  assert.doesNotMatch(source, /compose\(\['stop',\s*\.\.\.[^\]]*keycloak/i)
})

test('Caddy runtime identity and TLS classification inputs are immutable', () => {
  assert.equal(Object.isFrozen(CADDY_CMDLINE), true)
  assert.equal(Object.isFrozen(TLS_SAFE_ERROR_CODES), true)
  assert.throws(() => CADDY_CMDLINE.push('version'), TypeError)
  assert.throws(() => TLS_SAFE_ERROR_CODES.push('ECONNREFUSED'), TypeError)
})

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

  const enqueued = {
    stderr: '',
    stdout: '{"event":"onprem.synthetic_queue_probe.completed","durability":"local-aof-fsynced","mode":"enqueue","queuedCount":1,"state":"delayed","status":"queued"}\n',
  }
  assert.doesNotThrow(() => assertProbeOutput(enqueued, { durability: 'local-aof-fsynced', mode: 'enqueue', queuedCount: 1, state: 'delayed', status: 'queued' }))
  assert.throws(
    () => assertProbeOutput({ ...enqueued, stdout: enqueued.stdout.replace('delayed', 'waiting') }, { durability: 'local-aof-fsynced', mode: 'enqueue', queuedCount: 1, state: 'delayed', status: 'queued' }),
    /result mismatch for state/i,
  )
  assert.throws(
    () => assertProbeOutput({ ...enqueued, stdout: enqueued.stdout.replace('local-aof-fsynced', 'unproven') }, { durability: 'local-aof-fsynced', mode: 'enqueue', queuedCount: 1, state: 'delayed', status: 'queued' }),
    /result mismatch for durability/i,
  )
})

test('runtime proof rebuilds queue persistence checkpoints from the exact allowlist', () => {
  const raw = {
    event: 'onprem.synthetic_queue_probe.completed',
    mode: 'snapshot',
    jobHashExists: 1,
    delayedMembershipExists: 1,
    enqueueSentinelExists: 1,
    processedMarkerExists: 0,
    dbSize: 12,
    persistence: {
      aofEnabled: 1,
      aofRewriteInProgress: 0,
      aofRewriteScheduled: 0,
      aofCurrentSize: 2048,
      aofBaseSize: 512,
      aofPendingBioFsync: 0,
      aofDelayedFsync: 0,
      aofLastWriteStatus: 'ok',
      aofLastBgrewriteStatus: 'ok',
      unsafe: 'redis://user:secret@host',
    },
    unsafe: 'redis://user:secret@host',
  }
  const checkpoint = sanitizeQueuePersistenceCheckpoint(
    { stdout: `${JSON.stringify(raw)}\n`, stderr: '' },
    'pre_stop',
  )

  assert.deepEqual(checkpoint, {
    checkpoint: 'pre_stop',
    jobHashExists: 1,
    delayedMembershipExists: 1,
    enqueueSentinelExists: 1,
    processedMarkerExists: 0,
    dbSize: 12,
    persistence: {
      aofEnabled: 1,
      aofRewriteInProgress: 0,
      aofRewriteScheduled: 0,
      aofCurrentSize: 2048,
      aofBaseSize: 512,
      aofPendingBioFsync: 0,
      aofDelayedFsync: 0,
      aofLastWriteStatus: 'ok',
      aofLastBgrewriteStatus: 'ok',
    },
  })
  assert.doesNotMatch(JSON.stringify(checkpoint), /redis:\/\/|secret|unsafe/)
  assert.throws(
    () => sanitizeQueuePersistenceCheckpoint(
      { stdout: `${JSON.stringify({ ...raw, jobHashExists: 2 })}\n`, stderr: '' },
      'pre_stop',
    ),
    /closed existence flag/i,
  )
})

test('runtime proof accepts only bounded multipart AOF inventory metadata', () => {
  const digest = 'a'.repeat(64)
  assert.deepEqual(
    parseStoppedAofInventory([
      'manifest|1',
      `file|appendonly.aof.manifest|88|${digest}|0|0`,
      `file|appendonly.aof.1.base.rdb|120|${digest}|0|0`,
      `file|appendonly.aof.1.incr.aof|512|${digest}|1|1`,
    ].join('\n')),
    {
      manifestPresent: true,
      files: [
        { fileName: 'appendonly.aof.manifest', sizeBytes: 88, sha256: digest, containsExpectedJobToken: false, containsExpectedSentinelToken: false },
        { fileName: 'appendonly.aof.1.base.rdb', sizeBytes: 120, sha256: digest, containsExpectedJobToken: false, containsExpectedSentinelToken: false },
        { fileName: 'appendonly.aof.1.incr.aof', sizeBytes: 512, sha256: digest, containsExpectedJobToken: true, containsExpectedSentinelToken: true },
      ],
    },
  )
  for (const unsafe of [
    `manifest|1\nfile|../../secret|10|${digest}|0|0`,
    `manifest|1\nfile|appendonly.aof.1.incr.aof|10|redis://secret|0|0`,
    `manifest|1\nfile|appendonly.aof.1.incr.aof|10|${digest}|2|0`,
  ]) assert.throws(() => parseStoppedAofInventory(unsafe), /unsafe or malformed/i)
  const semantic = JSON.stringify({
    analysisStatus: 'ok',
    reason: 'none',
    commandCount: 6,
    completeTransactionCount: 1,
    lastJobHashEffect: 'present',
    lastJobHashEffectIndex: 3,
    lastDelayedEffect: 'present',
    lastDelayedEffectIndex: 4,
    lastSentinelEffect: 'present',
    lastSentinelEffectIndex: 6,
  })
  assert.equal(
    parseStoppedAofInventory(`manifest|1\nsemantic|${semantic}`).commandSequence.lastDelayedEffect,
    'present',
  )
  assert.throws(
    () => parseStoppedAofInventory('manifest|1\nsemantic|{"analysisStatus":"ok","reason":"none","unsafe":"secret"}'),
    /semantic evidence was malformed/i,
  )
  assert.match(buildStoppedAofInventoryScript(), /redis-check-aof/)
  assert.doesNotMatch(buildStoppedAofInventoryScript(), /--fix/)
})

test('runtime proof classifies only committed final AOF effects for the synthetic queue keys', () => {
  const creation = respStream(
    ['SELECT', '0'],
    ['MULTI'],
    ['HMSET', 'bull:hr-axis-onprem-synthetic-recovery-v1:synthetic-recovery-v1', 'name', 'synthetic-recovery'],
    ['ZADD', 'bull:hr-axis-onprem-synthetic-recovery-v1:delayed', '1723200000000', 'synthetic-recovery-v1'],
    ['EXEC'],
    ['SET', 'hr-axis:onprem:synthetic-recovery-v1:enqueued', '1'],
  )
  assert.deepEqual(classifyStoppedAofCommandSequence(creation), {
    commandCount: 6,
    completeTransactionCount: 1,
    lastJobHashEffect: 'present',
    lastJobHashEffectIndex: 3,
    lastDelayedEffect: 'present',
    lastDelayedEffectIndex: 4,
    lastSentinelEffect: 'present',
    lastSentinelEffectIndex: 6,
  })

  const laterCleanup = Buffer.concat([
    creation,
    respStream(
      ['ZREM', 'bull:hr-axis-onprem-synthetic-recovery-v1:delayed', 'synthetic-recovery-v1'],
      ['DEL', 'bull:hr-axis-onprem-synthetic-recovery-v1:synthetic-recovery-v1'],
    ),
  ])
  assert.deepEqual(classifyStoppedAofCommandSequence(laterCleanup), {
    commandCount: 8,
    completeTransactionCount: 1,
    lastJobHashEffect: 'absent',
    lastJobHashEffectIndex: 8,
    lastDelayedEffect: 'absent',
    lastDelayedEffectIndex: 7,
    lastSentinelEffect: 'present',
    lastSentinelEffectIndex: 6,
  })
})

test('runtime proof rejects incomplete, malformed, oversized, and token-only AOF evidence', () => {
  const incomplete = respStream(
    ['MULTI'],
    ['HMSET', 'bull:hr-axis-onprem-synthetic-recovery-v1:synthetic-recovery-v1', 'payload', 'synthetic-recovery-v1'],
  )
  assert.throws(() => classifyStoppedAofCommandSequence(incomplete), /incomplete transaction/i)
  assert.throws(() => classifyStoppedAofCommandSequence(Buffer.from('*2\r\n$3\r\nSET\r\n$10\r\nshort\r\n')), /malformed RESP/i)
  assert.throws(() => classifyStoppedAofCommandSequence(Buffer.alloc(1024 * 1024 + 1)), /bounded size/i)
  assert.throws(
    () => classifyStoppedAofCommandSequence(respStream(['XADD', 'bull:unrelated:events', '*', 'payload', 'bull:hr-axis-onprem-synthetic-recovery-v1:synthetic-recovery-v1'])),
    /expected creation missing/i,
  )
})

test('runtime proof accepts only exact manifest-referenced multipart AOF files', () => {
  const manifest = [
    'file appendonly.aof.1.base.rdb seq 1 type b',
    'file appendonly.aof.1.incr.aof seq 1 type i',
  ].join('\n')
  const actual = ['appendonly.aof.1.base.rdb', 'appendonly.aof.1.incr.aof']
  assert.deepEqual(resolveStoppedAofManifest(manifest, actual), ['appendonly.aof.1.incr.aof'])
  assert.throws(
    () => resolveStoppedAofManifest(manifest, [...actual, 'appendonly.aof.2.incr.aof']),
    /orphan entry/i,
  )
  assert.throws(
    () => resolveStoppedAofManifest(`${manifest}\nfile ..\\secret seq 2 type i`, actual),
    /unsafe/i,
  )
  assert.throws(
    () => resolveStoppedAofManifest('file appendonly.aof.1.base.rdb seq 1 type b', ['appendonly.aof.1.base.rdb']),
    /omitted incremental/i,
  )
})

test('runtime proof rejects oversized AOF files before reading any payload bytes', () => {
  let reads = 0
  assert.throws(
    () => readBoundedAofFiles(['appendonly.aof.1.incr.aof'], {
      stat: () => ({ size: 1024 * 1024 + 1 }),
      read: () => { reads += 1; return Buffer.alloc(0) },
    }),
    /bounded size/i,
  )
  assert.equal(reads, 0)

  const buffers = readBoundedAofFiles(['appendonly.aof.1.incr.aof'], {
    stat: () => ({ size: 4 }),
    read: () => { reads += 1; return Buffer.from('safe') },
  })
  assert.equal(reads, 1)
  assert.equal(buffers[0].toString(), 'safe')
})

test('runtime proof classifies whole-key and range cleanup without exposing AOF payloads', () => {
  const fixture = respStream(
    ['HSET', 'bull:hr-axis-onprem-synthetic-recovery-v1:synthetic-recovery-v1', 'payload', 'redis://user:secret@host'],
    ['ZADD', 'bull:hr-axis-onprem-synthetic-recovery-v1:delayed', '100', 'synthetic-recovery-v1'],
    ['SET', 'hr-axis:onprem:synthetic-recovery-v1:enqueued', 'secret-value'],
    ['ZREMRANGEBYSCORE', 'bull:hr-axis-onprem-synthetic-recovery-v1:delayed', '99', '101'],
    ['UNLINK', 'bull:hr-axis-onprem-synthetic-recovery-v1:synthetic-recovery-v1'],
  )
  const result = classifyStoppedAofCommandSequence(fixture)
  assert.equal(result.lastJobHashEffect, 'absent')
  assert.equal(result.lastDelayedEffect, 'absent')
  assert.equal(result.lastSentinelEffect, 'present')
  assert.doesNotMatch(JSON.stringify(result), /redis:\/\/|secret|payload|bull:/)

  const wholeKey = classifyStoppedAofCommandSequence(respStream(
    ['HSET', 'bull:hr-axis-onprem-synthetic-recovery-v1:synthetic-recovery-v1', 'name', 'x'],
    ['ZADD', 'bull:hr-axis-onprem-synthetic-recovery-v1:delayed', '100', 'synthetic-recovery-v1'],
    ['SET', 'hr-axis:onprem:synthetic-recovery-v1:enqueued', '1'],
    ['DEL', 'bull:hr-axis-onprem-synthetic-recovery-v1:delayed'],
  ))
  assert.equal(wholeKey.lastDelayedEffect, 'absent')
  assert.match(buildStoppedAofSemanticInspectorScript(), /appendonly\.aof\.manifest/)
  assert.doesNotMatch(buildStoppedAofSemanticInspectorScript(), /--fix/)
})

test('stopped AOF inspection preserves read-only source and emits typed container failures', () => {
  const base = {
    assertNoSecretLeak: () => {},
    redisImage: 'redis@sha256:' + 'a'.repeat(64),
    secretValues: ['synthetic-secret'],
    volumeName: 'synthetic-redis-volume',
    workerImage: 'worker@sha256:' + 'b'.repeat(64),
  }
  const validationCalls = []
  let validationError
  try {
    collectStoppedAofInventoryEvidence({
      ...base,
      command: (_binary, args) => {
        validationCalls.push(args)
        return { status: 43, stderr: 'closed validation failure', stdout: '' }
      },
    })
  } catch (error) {
    validationError = error
  }
  assert.equal(classifyQueueFailureReason(validationError), 'aof_readonly_validation_failed')
  assert.ok(validationCalls[0].includes('synthetic-redis-volume:/data:ro'))
  assert.ok(validationCalls[0].includes('/aof-check:rw,noexec,nosuid,nodev,size=2m,mode=0700,uid=999,gid=1000'))

  let invocation = 0
  let semanticError
  try {
    collectStoppedAofInventoryEvidence({
      ...base,
      command: () => {
        invocation += 1
        return invocation === 1
          ? { status: 0, stderr: '', stdout: 'manifest|1\n' }
          : { status: 17, stderr: 'closed semantic failure', stdout: '' }
      },
    })
  } catch (error) {
    semanticError = error
  }
  assert.equal(classifyQueueFailureReason(semanticError), 'aof_semantic_inspection_failed')
})

test('runtime proof reduces Redis persistence logs to closed booleans', () => {
  const result = classifyRedisPersistenceLogs([
    'Reading RDB base file on AOF loading',
    'Creating AOF incr file appendonly.aof.1.incr.aof',
    'AOF tail was truncated because aof-load-truncated is enabled',
    'redis://user:secret@host',
  ].join('\n'))
  assert.deepEqual(result, {
    aofLoadObserved: true,
    aofTruncationWarning: true,
    aofCorruptionWarning: false,
    newAofBaseCreated: false,
    incrementalAofOpened: true,
    shutdownFsyncError: false,
  })
  assert.doesNotMatch(JSON.stringify(result), /redis:\/\/|secret|appendonly/)
})

test('runtime proof excludes initial-startup Redis log markers before the pre-stop boundary', () => {
  const boundary = '2026-08-09T10:00:00.000Z'
  const result = classifyRedisPersistenceLogs([
    '2026-08-09T09:59:59.000Z Creating AOF base file initial-startup-only',
    '2026-08-09T10:00:00.001Z Reading RDB base file on AOF loading',
    '2026-08-09T10:00:00.002Z Creating AOF incr file appendonly.aof.1.incr.aof',
  ].join('\n'), boundary)
  assert.deepEqual(result, {
    aofLoadObserved: true,
    aofTruncationWarning: false,
    aofCorruptionWarning: false,
    newAofBaseCreated: false,
    incrementalAofOpened: true,
    shutdownFsyncError: false,
  })
})

test('runtime proof injects the bounded Docker log collector contract', () => {
  const calls = []
  const leakChecks = []
  const result = collectRedisRestartLogDelta({
    command: (executable, args, options) => {
      calls.push({ executable, args, options })
      return { status: 0, stdout: 'restart stdout', stderr: 'restart stderr' }
    },
    assertNoSecretLeak: (secretValues, surfaces) => leakChecks.push({ secretValues, surfaces }),
    secretValues: new Map([['redis', 'redacted-test-secret']]),
    containerId: 'synthetic-redis-container',
    since: '2026-08-09T10:00:00.000Z',
  })

  assert.equal(result, 'restart stdout\nrestart stderr')
  assert.deepEqual(calls, [{
    executable: 'docker',
    args: ['logs', '--since', '2026-08-09T10:00:00.000Z', '--timestamps', 'synthetic-redis-container'],
    options: { allowFailure: true, label: 'bounded Redis restart log delta' },
  }])
  assert.equal(leakChecks.length, 1)
  assert.equal(leakChecks[0].surfaces['Redis restart log delta stdout'], 'restart stdout')
  assert.equal(leakChecks[0].surfaces['Redis restart log delta stderr'], 'restart stderr')
})

test('runtime proof captures Redis persistence checkpoints before and after reconnect', () => {
  const source = readFileSync(new URL('./onprem-core-runtime-proof.mjs', import.meta.url), 'utf8')
  const diagnosticSource = readFileSync(new URL('./onprem-redis-persistence-diagnostic.mjs', import.meta.url), 'utf8')
  const preStop = source.indexOf("captureQueueCheckpoint('pre_stop')")
  const stop = source.indexOf("compose(['stop', 'redis']")
  const pause = source.indexOf('pauseRuntimeService(target)', stop)
  const start = source.indexOf("compose(['start', 'redis']", pause)
  const postLoad = source.indexOf("captureQueueCheckpoint('post_redis_load')")
  const unpause = source.indexOf('unpauseRuntimeService(target)', postLoad)
  const apiHealth = source.indexOf("waitHealthy('api')", postLoad)
  const postReconnect = source.indexOf("captureQueueCheckpoint('post_runtime_reconnect')")
  const process = source.indexOf("synthetic-queue-probe.js', 'process'", postReconnect)
  assert.ok(preStop > 0 && preStop < stop)
  assert.ok(stop < pause && pause < start && start < postLoad && postLoad < unpause)
  assert.ok(unpause < apiHealth)
  assert.ok(apiHealth < postReconnect && postReconnect < process)
  assert.match(source, /finally \{[\s\S]*unpauseRuntimeService\(target\)/)
  assert.match(source, /collectRedisRestartLogDelta\(\{[\s\S]*command,[\s\S]*assertNoSecretLeak,[\s\S]*containerId: redisIdAfter,[\s\S]*since: redisRestartLogSince/)
  assert.match(diagnosticSource, /docker', \['logs', '--since', since, '--timestamps'/)
  assert.match(diagnosticSource, /--network', 'none'/)
  assert.match(diagnosticSource, /--read-only', '--cap-drop', 'ALL'/)
  assert.match(diagnosticSource, /--security-opt', 'no-new-privileges', '--user', '999:1000'/)
  assert.match(diagnosticSource, /--memory', '128m', '--pids-limit', '32'/)
  assert.match(diagnosticSource, /--tmpfs', '\/aof-check:rw,noexec,nosuid,nodev,size=2m,mode=0700,uid=999,gid=1000'/)
  assert.doesNotMatch(diagnosticSource, /--user', '0:0'/)
  assert.doesNotMatch(diagnosticSource, /--cap-add/)
  assert.match(diagnosticSource, /:\/data:ro/)
  assert.match(diagnosticSource, /\[ ! -r "\$dir" \] \|\| \[ ! -x "\$dir" \]/)
  assert.match(diagnosticSource, /"\$total" -gt 1048576/)
  assert.match(diagnosticSource, /"\$count" -gt 17/)
  assert.match(diagnosticSource, /cp "\$path" "\$work\/\$name"/)
  assert.match(diagnosticSource, /for hidden in "\$dir"\/\.\[!\.\]\* "\$dir"\/\.\.\?\*/)
  const symlinkGuard = diagnosticSource.indexOf('[ ! -L "$path" ] || exit 41')
  const missingGlobGuard = diagnosticSource.indexOf('[ -e "$path" ] || continue')
  assert.ok(symlinkGuard > 0 && symlinkGuard < missingGlobGuard)
  assert.match(source, /collectStoppedAofInventoryEvidence\(\{/)
  assert.match(source, /workerImage: config\.services\.worker\.image/)
  assert.match(diagnosticSource, /buildStoppedAofSemanticInspectorScript\(\)/)
  assert.match(diagnosticSource, /workerImage, '-e'/)
  assert.match(diagnosticSource, /aof_contains_later_cleanup/)
  assert.match(diagnosticSource, /aof_committed_state_replay_mismatch/)
  assert.match(diagnosticSource, /redis-check-aof "\$work\/appendonly\.aof\.manifest"/)
  assert.doesNotMatch(diagnosticSource, /redis-check-aof[^\n]*--fix/)
  assert.match(diagnosticSource, /aof_readonly_validation_failed/)
  assert.match(diagnosticSource, /aof_semantic_inspection_failed/)
  assert.doesNotMatch(source, /console\.log\([^\n]*(?:redisLogs|redisMountBefore\.Source)/)
})

test('runtime proof has no timing-based AOF durability sleep', () => {
  const source = readFileSync(new URL('./onprem-core-runtime-proof.mjs', import.meta.url), 'utf8')
  assert.doesNotMatch(source, /AOF everysec wait|setTimeout\(\(\)=>\{\},2000\)/)
  assert.match(source, /durability: 'local-aof-fsynced'/)
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

test('runtime proof accepts only the exact runtime sequence privilege matrix', () => {
  assert.deepEqual(parseSequencePrivilegeMatrix('t|t|f|t|t|f'), {
    api: { select: true, update: false, usage: true },
    worker: { select: true, update: false, usage: true },
  })

  for (const invalid of [
    'true|true|false|true|true|false',
    't|t|t|t|t|f',
    'f|t|f|t|t|f',
    't|f|f|t|t|f',
    't|t|f|t|t|t',
    't|t|f|f|t|f',
    't|t|f|t|f|f',
    't|t|f|t|t',
    't|t|f|t|t|false',
  ]) {
    assert.throws(() => parseSequencePrivilegeMatrix(invalid), /runtime sequence least-privilege contract mismatch/i)
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

test('runtime proof emits bounded terminal EPERM diagnostics without waiting for all health attempts', () => {
  const diagnostic = serviceFailureDiagnostic({
    service: 'caddy',
    state: {
      Status: 'exited',
      ExitCode: 126,
      OOMKilled: false,
      Error: 'failed to create task: exec /usr/bin/caddy: operation not permitted',
      Health: { Status: 'starting', Log: [] },
    },
    logs: 'exec /usr/bin/caddy: operation not permitted\n',
  })

  assert.match(diagnostic, /caddy.*exited.*126.*operation not permitted/i)
  assert.ok(diagnostic.length <= 4096)
})

test('runtime proof retains only recent repeated health failures and redacts every diagnostic surface', () => {
  const canary = 'synthetic-diagnostic-secret'
  const diagnostic = serviceFailureDiagnostic({
    service: 'caddy',
    secretValues: new Map([['caddy_tls_private_key', canary]]),
    state: {
      Status: 'running',
      ExitCode: 0,
      OOMKilled: false,
      Error: `state ${canary}`,
      Health: {
        Status: 'unhealthy',
        Log: Array.from({ length: 8 }, (_, index) => ({
          ExitCode: index,
          Output: `health-${index} ${canary}`,
        })),
      },
    },
    logs: `first\nsecond ${canary}\nthird`,
  })

  assert.doesNotMatch(diagnostic, new RegExp(canary))
  assert.doesNotMatch(diagnostic, /health-[0-4]/)
  assert.match(diagnostic, /health-5/)
  assert.match(diagnostic, /health-7/)
  assert.match(diagnostic, /\[redacted\]/)
})

test('runtime proof redacts a long secret before bounding diagnostic text', () => {
  const secret = `long-secret-canary-${'x'.repeat(1000)}`
  const diagnostic = serviceFailureDiagnostic({
    service: 'caddy',
    secretValues: new Map([['long_secret', secret]]),
    state: { Status: 'exited', ExitCode: 1, Error: secret },
  })

  assert.doesNotMatch(diagnostic, /long-secret-canary/)
  assert.match(diagnostic, /\[redacted\]/)
})

test('runtime proof accepts only the exact capability-free Caddy tmpfs execution boundary', () => {
  const valid = {
    caddyPid: 7,
    cmdline: ['/run/caddy-bin/caddy', 'run', '--config', '/etc/caddy/Caddyfile', '--adapter', 'caddyfile'],
    copyCapabilities: '',
    copyDigest: 'a'.repeat(64),
    copyInode: '0:12345',
    exeInode: '0:12345',
    exeTarget: '/run/caddy-bin/caddy',
    liveExeDigest: 'a'.repeat(64),
    memoryPeakBytes: 120 * 1024 * 1024,
    mountInfo: '402 300 0:80 / /run/caddy-bin rw,nosuid,nodev,relatime - tmpfs tmpfs rw,size=65536k,uid=10001,gid=10001,mode=700',
    oomKilled: false,
    processCount: 1,
    procStatus: 'Uid:\t10001\t10001\t10001\t10001\nGid:\t10001\t10001\t10001\t10001\nCapInh:\t0000000000000000\nCapPrm:\t0000000000000000\nCapEff:\t0000000000000000\nCapBnd:\t0000000000000000\nCapAmb:\t0000000000000000\nNoNewPrivs:\t1\n',
    sourceDigest: 'a'.repeat(64),
    tmpfsConfig: 'rw,nosuid,nodev,exec,size=64m,uid=10001,gid=10001,mode=0700',
  }

  assert.deepEqual(verifyCaddyRuntimeInvariants(valid), {
    caddyPid: 7,
    capabilitiesEmpty: true,
    copyCapabilityFree: true,
    executableDigest: 'a'.repeat(64),
    executableInode: '0:12345',
    intendedProcessCount: 1,
    liveExecutableUnchanged: true,
    memoryPeakBytes: 120 * 1024 * 1024,
    noNewPrivileges: true,
    sourceCopyDigestEqual: true,
    tamperedPathRejected: false,
    tmpfsVerified: true,
    uidGid: '10001:10001',
  })
  for (const invalid of [
    { caddyPid: 1 },
    { cmdline: ['/run/caddy-bin/caddy', 'version'] },
    { copyCapabilities: '/run/caddy-bin/caddy cap_net_bind_service=ep' },
    { copyDigest: 'b'.repeat(64) },
    { copyInode: '0:99999' },
    { exeTarget: '/usr/bin/caddy' },
    { liveExeDigest: 'b'.repeat(64) },
    { memoryPeakBytes: 128 * 1024 * 1024 + 1 },
    { mountInfo: valid.mountInfo.replace(',nodev', '') },
    { mountInfo: valid.mountInfo.replace(',relatime', ',noexec,relatime') },
    { oomKilled: true },
    { processCount: 2 },
    { procStatus: valid.procStatus.replace('CapEff:\t0000000000000000', 'CapEff:\t0000000000000400') },
    { procStatus: valid.procStatus.replace('NoNewPrivs:\t1', 'NoNewPrivs:\t0') },
    { procStatus: valid.procStatus.replaceAll('10001', '0') },
    { tmpfsConfig: valid.tmpfsConfig.replace('size=64m', 'size=32m') },
    { tmpfsConfig: valid.tmpfsConfig.replace(',exec', '') },
  ]) assert.throws(() => verifyCaddyRuntimeInvariants({ ...valid, ...invalid }), /Caddy/i)
})

test('runtime proof proves pathname tamper does not change the already-running Caddy executable', () => {
  const digest = 'a'.repeat(64)
  const result = verifyCaddyRuntimeInvariants({
    caddyPid: 7,
    cmdline: ['/run/caddy-bin/caddy', 'run', '--config', '/etc/caddy/Caddyfile', '--adapter', 'caddyfile'],
    copyCapabilities: '',
    copyDigest: 'b'.repeat(64),
    copyInode: '0:22222',
    exeInode: '0:11111',
    exeTarget: '/run/caddy-bin/caddy (deleted)',
    liveExeDigest: digest,
    memoryPeakBytes: 120 * 1024 * 1024,
    mountInfo: '402 300 0:80 / /run/caddy-bin rw,nosuid,nodev,relatime - tmpfs tmpfs rw,size=65536k,uid=10001,gid=10001,mode=700',
    oomKilled: false,
    pathState: 'tampered',
    processCount: 1,
    procStatus: 'Uid:\t10001\t10001\t10001\t10001\nGid:\t10001\t10001\t10001\t10001\nCapInh:\t0000000000000000\nCapPrm:\t0000000000000000\nCapEff:\t0000000000000000\nCapBnd:\t0000000000000000\nCapAmb:\t0000000000000000\nNoNewPrivs:\t1\n',
    sourceDigest: digest,
    tmpfsConfig: 'rw,nosuid,nodev,exec,size=64m,uid=10001,gid=10001,mode=0700',
  })

  assert.equal(result.liveExecutableUnchanged, true)
  assert.equal(result.tamperedPathRejected, true)
  assert.equal(result.executableDigest, digest)
})

test('wrong-CA TLS proof explicitly mounts and selects an unrelated CA while wrong-host stays distinct', () => {
  const common = {
    caddyProxyIp: '172.30.10.8',
    image: 'sha256:' + 'a'.repeat(64),
    network: 'hr-axis-onprem-core_proxy',
  }
  const wrongCa = buildTlsProbeDockerArgs({
    ...common,
    caPath: '/tmp/unrelated-ca/ca.crt',
    host: 'onprem-proof.example.invalid',
    verifyHost: 'onprem-proof.example.invalid',
  })
  const wrongHost = buildTlsProbeDockerArgs({
    ...common,
    caPath: '/approved/ca.crt',
    host: 'onprem-proof.example.invalid',
    verifyHost: 'wrong-host.example.invalid',
  })

  assert.ok(wrongCa.includes('/tmp/unrelated-ca/ca.crt:/run/proof/ca.crt:ro'))
  assert.ok(wrongCa.includes('PROOF_CA=/run/proof/ca.crt'))
  assert.ok(wrongCa.includes('PROOF_HOST=onprem-proof.example.invalid'))
  assert.ok(wrongCa.includes('PROOF_VERIFY_HOST=onprem-proof.example.invalid'))
  assert.ok(wrongHost.includes('/approved/ca.crt:/run/proof/ca.crt:ro'))
  assert.ok(wrongHost.includes('PROOF_HOST=onprem-proof.example.invalid'))
  assert.ok(wrongHost.includes('PROOF_VERIFY_HOST=wrong-host.example.invalid'))
  const source = readFileSync(new URL('./onprem-core-runtime-proof.mjs', import.meta.url), 'utf8')
  assert.match(source, /require\('node:tls'\)/)
  assert.match(source, /const ca=fs\.readFileSync\(process\.env\.PROOF_CA\)/)
  assert.match(source, /headers:\{host:process\.env\.PROOF_HOST\}/)
  assert.match(source, /servername:process\.env\.PROOF_HOST/)
  assert.match(source, /tls\.checkServerIdentity\(process\.env\.PROOF_VERIFY_HOST,cert\)/)
  assert.doesNotMatch(source, /process\.env\.PROOF_CA\?fs\.readFileSync/)
  assert.match(source, /unrelated-ca\.crt/)
  assert.match(source, /command\('openssl'/)
  assert.match(source, /runTlsProbe\(\{ caPath: wrongCaPath, host: publicHost, label: 'wrong-CA TLS rejection proof', verifyHost: publicHost \}\)/)
})

test('Node hostname verification deterministically classifies the synthetic wrong-host certificate', () => {
  const error = checkServerIdentity('wrong-host.example.invalid', {
    subjectaltname: 'DNS:onprem-proof.example.invalid',
  })
  assert.equal(error?.code, 'ERR_TLS_CERT_ALTNAME_INVALID')
})

test('TLS probe preserves only bounded safe error codes for rejected diagnostics', () => {
  assert.equal(sanitizeTlsErrorCode('EPROTO'), 'EPROTO')
  assert.equal(sanitizeTlsErrorCode('ERR_TLS_CERT_ALTNAME_INVALID'), 'ERR_TLS_CERT_ALTNAME_INVALID')
  assert.equal(sanitizeTlsErrorCode('lowercase'), 'UNKNOWN_TLS_ERROR')
  assert.equal(sanitizeTlsErrorCode('A'.repeat(65)), 'UNKNOWN_TLS_ERROR')
  assert.equal(sanitizeTlsErrorCode('EPROTO\nsecret=value'), 'UNKNOWN_TLS_ERROR')

  const source = readFileSync(new URL('./onprem-core-runtime-proof.mjs', import.meta.url), 'utf8')
  assert.match(source, /sanitizeTlsErrorCode\.toString\(\)/)
  assert.match(source, /sanitizeTlsErrorCode\(error\?\.code\)/)
  assert.doesNotMatch(source, /safeCodes\.has\(candidate\)/)
})

test('Redis ACL probes override the Compose entrypoint without duplicating the Node binary', () => {
  const script = "process.stdout.write('ok')"
  for (const service of ['api', 'worker']) {
    const args = buildRedisProbeComposeArgs(service, script)
    assert.deepEqual(args, [
      'run', '--rm', '--no-deps', '--entrypoint', '/nodejs/bin/node', service, '-e', script,
    ])
    assert.equal(args.slice(args.indexOf(service) + 1).includes('/nodejs/bin/node'), false)
  }
  assert.throws(() => buildRedisProbeComposeArgs('migrator', script), /runtime service/i)
  assert.throws(() => buildRedisProbeComposeArgs('api', ''), /probe script/i)
})

test('TLS probe classifier requires the exact success marker and HTTP 200', () => {
  assert.deepEqual(classifyTlsProbeResult({
    status: 0,
    stderr: '',
    stdout: '{"marker":"hr-axis-onprem-tls-proof-v1","result":"success","statusCode":200}\n',
  }, 'success'), { code: null, result: 'success', statusCode: 200 })

  for (const result of [
    { status: 0, stderr: '', stdout: '' },
    { status: 0, stderr: '', stdout: '{"marker":"wrong","result":"success","statusCode":200}\n' },
    { status: 0, stderr: '', stdout: '{"marker":"hr-axis-onprem-tls-proof-v1","result":"success","statusCode":503}\n' },
    { status: 21, stderr: '', stdout: '{"marker":"hr-axis-onprem-tls-proof-v1","result":"http_error","statusCode":503}\n' },
    { status: 125, stderr: 'container failed', stdout: '' },
    { status: 1, stderr: '', stdout: '' },
    { status: 0, stderr: '', stdout: 'not-json' },
  ]) assert.throws(() => classifyTlsProbeResult(result, 'success'), /TLS proof/i)
})

test('TLS probe classifier accepts only the exact wrong-host certificate code', () => {
  const marker = (code, status = 20) => ({
    status,
    stderr: '',
    stdout: `${JSON.stringify({ marker: 'hr-axis-onprem-tls-proof-v1', result: 'tls_error', code })}\n`,
  })
  assert.deepEqual(classifyTlsProbeResult(marker('ERR_TLS_CERT_ALTNAME_INVALID'), 'wrong-host'), {
    code: 'ERR_TLS_CERT_ALTNAME_INVALID',
    result: 'tls_error',
    statusCode: null,
  })
  for (const result of [
    marker('ECONNREFUSED'),
    marker('UNABLE_TO_VERIFY_LEAF_SIGNATURE'),
    marker('ERR_TLS_CERT_ALTNAME_INVALID', 1),
    { status: 22, stderr: '', stdout: '{"marker":"hr-axis-onprem-tls-proof-v1","result":"timeout"}\n' },
  ]) assert.throws(() => classifyTlsProbeResult(result, 'wrong-host'), /TLS proof/i)

  assert.throws(
    () => classifyTlsProbeResult(marker('EPROTO'), 'wrong-host'),
    /observed=EPROTO/,
  )
})

test('TLS probe classifier accepts only narrow unrelated-CA trust-chain codes', () => {
  assert.deepEqual(TLS_WRONG_CA_CODES, [
    'SELF_SIGNED_CERT_IN_CHAIN',
    'UNABLE_TO_GET_ISSUER_CERT_LOCALLY',
    'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
  ])
  for (const code of TLS_WRONG_CA_CODES) {
    assert.equal(classifyTlsProbeResult({
      status: 20,
      stderr: '',
      stdout: `${JSON.stringify({ marker: 'hr-axis-onprem-tls-proof-v1', result: 'tls_error', code })}\n`,
    }, 'wrong-ca').code, code)
  }
  for (const result of [
    { status: 20, stderr: '', stdout: '{"marker":"hr-axis-onprem-tls-proof-v1","result":"tls_error","code":"ECONNREFUSED"}\n' },
    { status: 20, stderr: '', stdout: '{"marker":"hr-axis-onprem-tls-proof-v1","result":"tls_error","code":"UNKNOWN_TLS_ERROR"}\n' },
    { status: 22, stderr: '', stdout: '{"marker":"hr-axis-onprem-tls-proof-v1","result":"timeout"}\n' },
    { status: 20, stderr: '', stdout: '{"marker":"hr-axis-onprem-tls-proof-v1","result":"tls_error"}\n' },
    { status: 20, stderr: 'mount failed', stdout: '{"marker":"hr-axis-onprem-tls-proof-v1","result":"tls_error","code":"UNABLE_TO_VERIFY_LEAF_SIGNATURE"}\n' },
    { status: 20, stderr: '', stdout: '{"marker":"hr-axis-onprem-tls-proof-v1","result":"tls_error","code":"UNABLE_TO_VERIFY_LEAF_SIGNATURE"}\nextra' },
  ]) assert.throws(() => classifyTlsProbeResult(result, 'wrong-ca'), /TLS proof/i)
})

test('runtime proof does not treat Docker init PID 1 as the Caddy process', () => {
  const source = readFileSync(new URL('./onprem-core-runtime-proof.mjs', import.meta.url), 'utf8')
  assert.doesNotMatch(source, /\/proc\/1\/status/)
  assert.match(source, /\/proc\/\$\{?caddyPid\}?\/exe/)
  assert.ok(source.includes("tr \\'\\\\0\\' \\'\\\\n\\'"))
  assert.equal(source.includes("tr \\'\\\\000\\'"), false)
})
