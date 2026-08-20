import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

import {
  assertQueueProbeOutput,
  assertPhotoProofOutput,
  assertTargetComposeConfig,
  assertNoPublishedPorts,
  buildComposeArgs,
  buildPhotoAuthDockerArgs,
  buildQueueProbeArgs,
  enforceCompleteGate,
  parseArgs,
  runQueueProof,
  sanitizeReceipt,
  waitForHealthy,
  writeSanitizedReceipt,
  validateRedisIdentity,
  runPhotoProof,
} from './onprem-offline-target-proof.mjs'

const project = 'hr-axis-onprem-restore-v1'
const releaseId = 'synthetic-release-v1'
const compose = [
  'compose', '--project-name', project, '--env-file', 'C:/safe/core.env',
  '--file', 'C:/safe/core.yaml', '--file', 'C:/safe/photo.yaml', '--file', 'C:/safe/restore.yaml',
]

test('compose arguments preserve explicit project, env, file order and no host ports', () => {
  assert.deepEqual(buildComposeArgs({ project, envFile: 'C:/safe/core.env', compose: ['C:/safe/core.yaml', 'C:/safe/photo.yaml'] }), [
    'compose', '--project-name', project, '--env-file', 'C:/safe/core.env',
    '--file', 'C:/safe/core.yaml', '--file', 'C:/safe/photo.yaml',
  ])
  assert.deepEqual(buildComposeArgs({ project, envFile: 'C:/safe/core.env', profiles: ['*'], compose: ['C:/safe/core.yaml'] }), [
    'compose', '--profile', '*', '--project-name', project, '--env-file', 'C:/safe/core.env', '--file', 'C:/safe/core.yaml',
  ])
  const config = {
    services: {
      redis: { networks: [`${project}_data`], ports: [], labels: {
        'com.docker.compose.project': project,
        'com.hr-axis.project': project,
        'com.hr-axis.data-class': 'synthetic',
        'com.hr-axis.release-id': releaseId,
      } },
      worker: { networks: [`${project}_app`, `${project}_data`], ports: [], labels: {
        'com.docker.compose.project': project,
        'com.hr-axis.project': project,
        'com.hr-axis.data-class': 'synthetic',
        'com.hr-axis.release-id': releaseId,
      } },
      api: { networks: [`${project}_proxy`, `${project}_app`, `${project}_data`], ports: [], labels: {
        'com.docker.compose.project': project,
        'com.hr-axis.project': project,
        'com.hr-axis.data-class': 'synthetic',
        'com.hr-axis.release-id': releaseId,
      } },
    },
  }
  assert.deepEqual(assertTargetComposeConfig(config, { project, releaseId, services: ['redis', 'worker', 'api'] }), { network: `${project}_data`, noHostPorts: true, releaseClaimVerified: true })
  assert.throws(() => assertTargetComposeConfig({ ...config, services: { ...config.services, api: { ...config.services.api, ports: ['8443:8443'] } } }, { project, releaseId, services: ['api'] }), /host port/i)
  const renderedWithoutAutoLabels = { services: Object.fromEntries(Object.entries(config.services).map(([name, service]) => [name, { ...service, labels: Object.fromEntries(Object.entries(service.labels).filter(([key]) => key !== 'com.docker.compose.project')) }])) }
  assert.equal(assertTargetComposeConfig(renderedWithoutAutoLabels, { project, releaseId, services: ['redis', 'worker', 'api'] }).releaseClaimVerified, true)
  const mismatchedAutoLabel = { ...renderedWithoutAutoLabels, services: { ...renderedWithoutAutoLabels.services, api: { ...renderedWithoutAutoLabels.services.api, labels: { ...renderedWithoutAutoLabels.services.api.labels, 'com.docker.compose.project': 'wrong-project' } } } }
  assert.throws(() => assertTargetComposeConfig(mismatchedAutoLabel, { project, releaseId, services: ['api'] }), /project label/i)
})

test('target proof renders every Compose profile only for read-only config inspection', () => {
  const configLabels = { 'com.docker.compose.project': project, 'com.hr-axis.project': project, 'com.hr-axis.data-class': 'synthetic', 'com.hr-axis.release-id': releaseId }
  const redisImage = `sha256:${'a'.repeat(64)}`
  const workerImage = `sha256:${'b'.repeat(64)}`
  const config = {
    services: {
      redis: { image: redisImage, networks: [`${project}_data`], ports: [], labels: configLabels },
      worker: { image: workerImage, networks: [`${project}_app`, `${project}_data`], ports: [], labels: configLabels },
    },
  }
  const redisLabels = { ...configLabels, 'com.docker.compose.service': 'redis', 'com.docker.compose.container-number': '1', 'com.docker.compose.oneoff': 'False' }
  const workerLabels = { ...configLabels, 'com.docker.compose.service': 'worker', 'com.docker.compose.container-number': '1', 'com.docker.compose.oneoff': 'False' }
  let redisRunning = true
  let workerRunning = true
  const calls = []
  const composeCommand = (actualOptions, args, label) => {
    calls.push({ profiles: actualOptions.profiles ?? [], args: [...args], label })
    if (args[0] === 'config') return { status: 0, stdout: `${JSON.stringify(config, null, 2)}\n`, stderr: '' }
    if (args[0] === 'stop' && args[1] === 'worker') workerRunning = false
    if (args[0] === 'stop' && args[1] === 'redis') redisRunning = false
    if (args[0] === 'start' && args[1] === 'redis') redisRunning = true
    if (args[0] === 'start' && args[1] === 'worker') workerRunning = true
    if (args[0] === 'run') {
      const mode = args.at(-1)
      const output = mode === 'enqueue'
        ? { event: 'onprem.synthetic_queue_probe.completed', durability: 'local-aof-fsynced', mode, queuedCount: 1, state: 'delayed', status: 'queued' }
        : mode === 'process'
          ? { event: 'onprem.synthetic_queue_probe.completed', mode, processedCount: 1, duplicateCount: 0, status: 'completed' }
          : { event: 'onprem.synthetic_queue_probe.completed', markerCount: 1, mode, state: 'completed' }
      return { status: 0, stdout: `${JSON.stringify(output)}\n`, stderr: '' }
    }
    return { status: 0, stdout: '', stderr: '' }
  }
  const inspect = (id) => id === 'redis-id'
    ? { Id: id, Config: { Image: redisImage, Labels: redisLabels }, State: { Running: redisRunning, Restarting: false, OOMKilled: false, Dead: false, Error: '', Health: { Status: 'healthy' } }, Mounts: [{ Destination: '/data', Type: 'volume', Name: 'redis-data', Source: '/var/lib/redis-data' }] }
    : { Id: id, Config: { Image: workerImage, Labels: workerLabels }, State: { Running: workerRunning, Restarting: false, OOMKilled: false, Dead: false, Error: '', Health: { Status: 'healthy' } } }
  runQueueProof({ project, releaseId, envFile: 'C:/safe/core.env', compose: ['C:/safe/core.yaml'], timeoutMs: 1000, healthAttempts: 1, intervalMs: 1 }, {
    composeCommand,
    inspect,
    redisContainerId: 'redis-id',
    workerContainerId: 'worker-id',
    skipNetwork: true,
  })
  const configCall = calls.find(({ args }) => args[0] === 'config')
  assert.deepEqual(configCall?.profiles, ['*'])
  assert.ok(calls.filter(({ args }) => args[0] !== 'config').every(({ profiles }) => profiles.length === 0), 'wildcard profiles must not widen queue mutations')
})

test('target proof rejects host bindings reported by actual service containers', () => {
  assert.doesNotThrow(() => assertNoPublishedPorts({
    HostConfig: { PortBindings: {} },
    NetworkSettings: { Ports: {} },
  }, 'api'))
  assert.throws(() => assertNoPublishedPorts({
    HostConfig: { PortBindings: { '8443/tcp': [{ HostPort: '8443' }] } },
    NetworkSettings: { Ports: {} },
  }, 'api'), /host port/i)
  assert.throws(() => assertNoPublishedPorts({
    HostConfig: { PortBindings: {} },
    NetworkSettings: { Ports: { '443/tcp': [{ HostPort: '443' }] } },
  }, 'caddy'), /host port/i)
})

test('target proof runtime fixture rejects a published binding before queue mutation', () => {
  const labels = { 'com.docker.compose.project': project, 'com.hr-axis.project': project, 'com.hr-axis.data-class': 'synthetic', 'com.hr-axis.release-id': releaseId }
  const config = { services: {
    redis: { networks: [`${project}_data`], ports: [], labels },
    worker: { networks: [`${project}_app`, `${project}_data`], ports: [], labels },
  } }
  const calls = []
  assert.throws(() => runQueueProof({ project, releaseId, envFile: 'core.env', compose: ['core.yaml'], timeoutMs: 1000 }, {
    config,
    skipRuntimePortCheck: false,
    composeCommand: (_options, args, label) => {
      calls.push(label)
      if (args[0] === 'ps') return { status: 0, stdout: `container-${args.at(-1)}\n`, stderr: '' }
      return { status: 0, stdout: '', stderr: '' }
    },
    inspect: () => ({ HostConfig: { PortBindings: { '8443/tcp': [{ HostPort: '8443' }] } }, NetworkSettings: { Ports: {} } }),
  }), /host port/i)
  assert.ok(calls.some((label) => /container inventory/.test(label)))
})

test('target proof accepts a non-core disposable project only when both project labels match it', () => {
  const disposable = 'hr-axis-onprem-disposable-v1'
  const labels = { 'com.docker.compose.project': disposable, 'com.hr-axis.project': disposable, 'com.hr-axis.data-class': 'synthetic', 'com.hr-axis.release-id': releaseId }
  const config = { services: {
    redis: { networks: ['data'], ports: [], labels },
    worker: { networks: ['app', 'data'], ports: [], labels },
  } }
  assert.equal(assertTargetComposeConfig(config, { project: disposable, releaseId, services: ['redis', 'worker'] }).releaseClaimVerified, true)
  assert.throws(() => assertTargetComposeConfig(config, { project, releaseId, services: ['redis', 'worker'] }), /label claim/i)
})

test('queue command is source-free and bounded', () => {
  assert.deepEqual(buildQueueProbeArgs(), ['run', '--pull', 'never', '--rm', '--no-deps', 'worker', 'dist/src/onprem/synthetic-queue-probe.js', 'enqueue'])
})

test('photo command is source-free, exact, and bounded to the protected HTTP proof', () => {
  assert.deepEqual(assertPhotoProofOutput({ photoAdminAuthenticated: true, nonSuperAdminDenied: true, deniedWriteDelta: 0, exactWebpRead: true, repeatReadExact: true, canonicalIdentityVerified: true, contentSha256: 'b'.repeat(64), contentLength: 123 }, { expectedSha256: 'b'.repeat(64), expectedLength: 123 }), {
    photoAdminAuthenticated: true, nonSuperAdminDenied: true, deniedWriteDelta: 0, exactWebpRead: true, repeatReadExact: true, canonicalIdentityVerified: true, contentSha256: 'b'.repeat(64), contentLength: 123,
  })
  assert.doesNotMatch(readFileSync('scripts/onprem-offline-target-proof.mjs', 'utf8'), /synthetic-photo-media-probe/)
})

test('photo auth proof runs only inside the exact private target network with the immutable backend image', () => {
  const image = 'sha256:' + 'a'.repeat(64)
  const args = buildPhotoAuthDockerArgs({ project, image, host: 'offline.synthetic.invalid', accountsFile: 'C:/proof/accounts', photoAccountFile: 'C:/proof/photo-account', caFile: 'C:/proof/ca.crt', fixturePath: 'C:/proof/fixture.webp', sha256: 'b'.repeat(64), scriptPath: 'C:/proof/onprem-photo-auth-proof.mjs' })
  assert.deepEqual(args.slice(0, 8), ['run', '--pull=never', '--rm', '--network', `${project}_proxy`, '--volume', 'C:/proof/onprem-photo-auth-proof.mjs:/run/hr-axis/onprem-photo-auth-proof.mjs:ro', '--volume'])
  const imageIndex = args.indexOf(image)
  assert.deepEqual(args.slice(imageIndex - 2, imageIndex + 2), ['--entrypoint', '/nodejs/bin/node', image, '/run/hr-axis/onprem-photo-auth-proof.mjs'])
  assert.equal(args.includes('node'), false, 'distroless backend auth proof must not pass a node token through the image entrypoint')
  assert.equal(args.includes('127.0.0.1'), false)
  assert.deepEqual(args.slice(-4), ['--connect-host', 'caddy', '--connect-port', '8443'])
  assert.throws(() => buildPhotoAuthDockerArgs({ project, image: 'backend:latest', host: 'offline.synthetic.invalid', accountsFile: 'C:/proof/accounts', photoAccountFile: 'C:/proof/photo-account', caFile: 'C:/proof/ca.crt', fixturePath: 'C:/proof/fixture.webp', sha256: 'b'.repeat(64) }), /immutable digest/i)
})

test('photo proof command has explicit prepare/recover modes and mounts the recovery handle read-only', () => {
  const prepare = buildPhotoAuthDockerArgs({ project, image: 'sha256:' + 'a'.repeat(64), host: 'offline.synthetic.invalid', accountsFile: 'C:/proof/accounts', photoAccountFile: 'C:/proof/photo-account', caFile: 'C:/proof/ca.crt', fixturePath: 'C:/proof/fixture.webp', sha256: 'b'.repeat(64), mode: 'prepare', recoveryHandleFile: 'C:/proof/recovery.json', scriptPath: 'C:/proof/onprem-photo-auth-proof.mjs' })
  assert.ok(prepare.includes('--internal'))
  assert.ok(!prepare.some((value) => String(value).includes('recovery.json:')), 'prepare must not bind-mount the absent handle destination')
  const args = buildPhotoAuthDockerArgs({ project, image: 'sha256:' + 'a'.repeat(64), host: 'offline.synthetic.invalid', accountsFile: 'C:/proof/accounts', photoAccountFile: 'C:/proof/photo-account', caFile: 'C:/proof/ca.crt', fixturePath: 'C:/proof/fixture.webp', sha256: 'b'.repeat(64), mode: 'recover', recoveryHandleFile: 'C:/proof/recovery.json', scriptPath: 'C:/proof/onprem-photo-auth-proof.mjs' })
  assert.ok(args.includes('--mode') && args.includes('recover'))
  assert.ok(args.includes('--recovery-handle-file') && args.includes('/run/hr-axis/photo-recovery.json'))
  assert.ok(args.includes('C:/proof/recovery.json:/run/hr-axis/photo-recovery.json:ro'))
})

test('photo proof invokes the protected HTTP auth proof with exact fixture and returns only sanitized flags/hash/bytes', () => {
  const root = mkdtempSync(join(tmpdir(), 'onprem-photo-target-proof-'))
  const fixturePath = join(root, 'fixture.bin')
  const fixture = Buffer.concat([Buffer.from('RIFF'), Buffer.from([0x18, 0, 0, 0]), Buffer.from('WEBP'), Buffer.from('VP8 '), Buffer.from('synthetic-photo-fixture')])
  const sha256 = createHash('sha256').update(fixture).digest('hex')
  const calls = []
  writeFileSync(fixturePath, fixture)
  try {
    const result = runPhotoProof({
      project, releaseId, envFile: 'core.env', compose: ['core.yaml'], timeoutMs: 1000,
      photoFixture: fixturePath, photoSha256: sha256, host: 'offline.synthetic.invalid', accountsFile: 'C:/proof/accounts', photoAccountFile: 'C:/proof/photo-account', caFile: 'C:/proof/ca.crt', photoAuthImage: 'sha256:' + 'a'.repeat(64), connectHost: 'caddy', connectPort: 8443,
    }, {
      config: { services: { api: { image: 'sha256:' + 'a'.repeat(64) } } },
      imageInspect: (image) => ({ status: 0, stdout: `${image}\n`, stderr: '' }),
      photoAuthCommand: (args, label) => {
        calls.push({ args, label })
        return { status: 0, stdout: JSON.stringify({
          photoAdminAuthenticated: true, nonSuperAdminDenied: true, deniedWriteDelta: 0, exactWebpRead: true, repeatReadExact: true, canonicalIdentityVerified: true, contentSha256: 'c'.repeat(64), contentLength: fixture.byteLength + 9,
        }), stderr: '' }
      },
    })
    assert.deepEqual(result, { photoAdminAuthenticated: true, nonSuperAdminDenied: true, deniedWriteDelta: 0, exactWebpRead: true, repeatReadExact: true, canonicalIdentityVerified: true, contentSha256: 'c'.repeat(64), contentLength: fixture.byteLength + 9 })
    assert.equal(calls.length, 1)
    assert.equal(calls[0].label, 'protected HTTP photo auth proof')
    assert.equal(calls[0].args.includes('127.0.0.1'), false)
    assert.equal(calls[0].args.includes('caddy'), true)
    assert.equal(calls[0].args.includes('synthetic-photo-media-probe.js'), false)
    assert.equal(JSON.stringify(result).includes(fixturePath), false)
  } finally { rmSync(root, { recursive: true, force: true }) }
})

test('photo proof rejects a valid-looking image that differs from the signed rendered API image before Docker execution', () => {
  const root = mkdtempSync(join(tmpdir(), 'onprem-photo-image-mismatch-'))
  const fixturePath = join(root, 'fixture.webp')
  const fixture = Buffer.from('synthetic-photo-fixture')
  const sha256 = createHash('sha256').update(fixture).digest('hex')
  writeFileSync(fixturePath, fixture)
  let imageInspects = 0
  let photoCalls = 0
  try {
    assert.throws(() => runPhotoProof({
      project, releaseId, envFile: 'core.env', compose: ['core.yaml'], timeoutMs: 1000,
      photoFixture: fixturePath, photoSha256: sha256, host: 'offline.synthetic.invalid', accountsFile: 'C:/proof/accounts', photoAccountFile: 'C:/proof/photo-account', caFile: 'C:/proof/ca.crt', photoAuthImage: 'sha256:' + 'a'.repeat(64), connectHost: 'caddy', connectPort: 8443,
    }, {
      config: { services: { api: { image: 'sha256:' + 'b'.repeat(64) } } },
      imageInspect: () => { imageInspects += 1; return { status: 0, stdout: '', stderr: '' } },
      photoAuthCommand: () => { photoCalls += 1; return { status: 0, stdout: '', stderr: '' } },
    }), /does not match the signed rendered API image/)
    assert.equal(imageInspects, 0)
    assert.equal(photoCalls, 0)
  } finally { rmSync(root, { recursive: true, force: true }) }
})

test('queue probe output contract rejects identity, URL, and secret fields', () => {
  assert.deepEqual(assertQueueProbeOutput('queue', { event: 'onprem.synthetic_queue_probe.completed', durability: 'local-aof-fsynced', mode: 'enqueue', queuedCount: 1, state: 'delayed', status: 'queued' }), { mode: 'enqueue', accepted: true })
  assert.deepEqual(assertQueueProbeOutput('process', { event: 'onprem.synthetic_queue_probe.completed', mode: 'process', processedCount: 1, duplicateCount: 0, status: 'completed' }), { mode: 'process', accepted: true })
  assert.deepEqual(assertQueueProbeOutput('status', { event: 'onprem.synthetic_queue_probe.completed', mode: 'status', markerCount: 1, state: 'completed' }), { mode: 'status', accepted: true })
  assert.throws(() => assertQueueProbeOutput('process', { event: 'onprem.synthetic_queue_probe.completed', mode: 'process', processedCount: 1, duplicateCount: 0, status: 'completed', containerId: 'raw-id' }), /field set/i)
})

test('redis identity requires exact synthetic target labels and same /data volume', () => {
  const labels = {
    'com.docker.compose.project': project,
    'com.docker.compose.service': 'redis',
    'com.docker.compose.container-number': '1',
    'com.docker.compose.oneoff': 'False',
    'com.hr-axis.project': project,
    'com.hr-axis.data-class': 'synthetic',
    'com.hr-axis.release-id': releaseId,
  }
  const inspect = { Id: 'sha256:container', Config: { Labels: labels, Image: 'redis@sha256:' + 'a'.repeat(64) }, Mounts: [{ Destination: '/data', Type: 'volume', Name: `${project}_redis_data`, Source: '/var/lib/docker/volumes/redis' }], State: { Status: 'running', Running: true, Restarting: false, OOMKilled: false, Dead: false, Error: '' } }
  assert.deepEqual(validateRedisIdentity(inspect, { project, releaseId, expectedImage: inspect.Config.Image }), { containerId: 'sha256:container', volumeName: `${project}_redis_data`, volumeSource: '/var/lib/docker/volumes/redis' })
  assert.throws(() => validateRedisIdentity({ ...inspect, Config: { Labels: { ...labels, 'com.hr-axis.data-class': 'real' } } }, { project, releaseId }), /synthetic/i)
  assert.throws(() => validateRedisIdentity({ ...inspect, Config: { Labels: Object.fromEntries(Object.entries(labels).filter(([key]) => key !== 'com.docker.compose.project')) } }, { project, releaseId }), /identity/i)
})

test('CLI args require explicit queue-only or complete mode and target release identity', () => {
  assert.throws(() => parseArgs(['--queue-only', '--compose', 'core.yaml', '--env-file', 'core.env', '--project', project, '--release-id', releaseId]), /execute/i)
  const options = parseArgs(['--execute', '--queue-only', '--health-attempts', '5', '--health-interval-ms', '250', '--compose', 'core.yaml', '--compose', 'restore.yaml', '--env-file', 'core.env', '--project', project, '--release-id', releaseId])
  assert.equal(options.queueOnly, true)
  assert.equal(options.requireComplete, false)
  assert.equal(options.healthAttempts, 5)
  assert.equal(options.intervalMs, 250)
  assert.deepEqual(options.compose, ['core.yaml', 'restore.yaml'])
  const authArgs = ['--host', 'offline.synthetic.invalid', '--accounts-file', 'C:/safe/accounts', '--photo-account-file', 'C:/safe/photo-account', '--ca-file', 'C:/safe/ca.crt']
  assert.equal(parseArgs(['--execute', '--require-complete', ...authArgs, '--compose', 'core.yaml', '--env-file', 'core.env', '--project', project, '--release-id', releaseId]).requireComplete, true)
  const withPhoto = parseArgs(['--execute', '--require-complete', ...authArgs, '--photo-fixture', 'C:/safe/fixture.jpg', '--photo-sha256', 'a'.repeat(64), '--compose', 'core.yaml', '--env-file', 'core.env', '--project', project, '--release-id', releaseId])
  assert.equal(withPhoto.photoFixture, 'C:/safe/fixture.jpg')
  assert.equal(withPhoto.photoSha256, 'a'.repeat(64))
  assert.throws(() => parseArgs(['--execute', '--require-complete', ...authArgs, '--photo-fixture', 'C:/safe/fixture.jpg', '--compose', 'core.yaml', '--env-file', 'core.env', '--project', project, '--release-id', releaseId]), /provided together/i)
})

test('receipt sanitizer explicitly records the photo gate without IDs or URLs', () => {
  const receipt = sanitizeReceipt({ queue: { enqueued: true, redisRestarted: true, processed: true, statusCompleted: true, containerIdentityPreserved: true, volumeIdentityPreserved: true }, releaseClaimVerified: true })
  assert.deepEqual(receipt, { schemaVersion: 1, dataClass: 'synthetic', releaseClaimVerified: true, queue: { enqueued: true, redisRestarted: true, processed: true, statusCompleted: true, containerIdentityPreserved: true, volumeIdentityPreserved: true }, photo: { proved: false, gate: 'protected_http_photo_auth_required' } })
  assert.doesNotMatch(JSON.stringify(receipt), /https?:\/\/|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i)
})

test('complete photo receipt distinguishes pre-backup preparation from recovery', () => {
  const queue = { enqueued: true, redisRestarted: true, processed: true, statusCompleted: true, containerIdentityPreserved: true, volumeIdentityPreserved: true }
  assert.equal(sanitizeReceipt({ queue, photoMode: 'prepare' }).recoveredPreBackupPhoto, false)
  assert.equal(sanitizeReceipt({ queue, photoMode: 'recover', photo: { photoAdminAuthenticated: true, nonSuperAdminDenied: true, deniedWriteDelta: 0, exactWebpRead: true, repeatReadExact: true, canonicalIdentityVerified: true, contentSha256: 'd'.repeat(64), contentLength: 88 } }).recoveredPreBackupPhoto, true)
})

test('sanitized complete receipt records only photo proof hash and byte count', () => {
  const receipt = sanitizeReceipt({
    queue: { enqueued: true, redisRestarted: true, processed: true, statusCompleted: true, containerIdentityPreserved: true, volumeIdentityPreserved: true },
    photo: { photoAdminAuthenticated: true, nonSuperAdminDenied: true, deniedWriteDelta: 0, exactWebpRead: true, repeatReadExact: true, canonicalIdentityVerified: true, contentSha256: 'd'.repeat(64), contentLength: 88 },
    releaseClaimVerified: true,
  })
  assert.deepEqual(receipt.photo, { photoAdminAuthenticated: true, nonSuperAdminDenied: true, deniedWriteDelta: 0, exactWebpRead: true, repeatReadExact: true, canonicalIdentityVerified: true, contentSha256: 'd'.repeat(64), contentLength: 88 })
  assert.equal(enforceCompleteGate({ options: { requireComplete: true, queueOnly: false }, receipt }), receipt)
  assert.doesNotMatch(JSON.stringify(receipt), /https?:\/\/|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|object.?key|version.?id/i)
})

test('complete gate writes a sanitized no-go receipt before failing, and refuses overwrite', () => {
  const root = mkdtempSync(join(tmpdir(), 'onprem-target-proof-gate-'))
  const path = join(root, 'receipt.json')
  const receipt = sanitizeReceipt({ queue: { enqueued: true, redisRestarted: true, processed: true, statusCompleted: true, containerIdentityPreserved: true, volumeIdentityPreserved: true } })
  try {
    assert.throws(() => enforceCompleteGate({ options: { requireComplete: true, queueOnly: false, receipt: path }, receipt }), /protected HTTP photo authentication/i)
    assert.deepEqual(JSON.parse(readFileSync(path, 'utf8')), receipt)
    assert.throws(() => writeSanitizedReceipt(path, receipt), /exist/i)
    assert.equal(enforceCompleteGate({ options: { requireComplete: false, queueOnly: true }, receipt }), receipt)
  } finally { rmSync(root, { recursive: true, force: true }) }
})

test('health retries are bounded and do not expose runtime state', () => {
  let attempts = 0
  const healthy = waitForHealthy(() => ({ State: { Running: ++attempts > 1, Restarting: false, OOMKilled: false, Dead: false, Error: '', Health: { Status: attempts > 1 ? 'healthy' : 'starting' } } }), 'worker', { attempts: 3, intervalMs: 1 })
  assert.equal(healthy.State.Health.Status, 'healthy')
  assert.equal(attempts, 2)
  assert.throws(() => waitForHealthy(() => ({ State: { Running: true, Health: { Status: 'starting' } } }), 'worker', { attempts: 1, intervalMs: 1 }), /bounded retries/i)
})

test('queue proof performs enqueue, exact Redis stop/start, process, and status in order', () => {
  const labels = {
    'com.docker.compose.project': project, 'com.docker.compose.service': 'redis',
    'com.docker.compose.container-number': '1', 'com.docker.compose.oneoff': 'False',
    'com.hr-axis.project': project, 'com.hr-axis.data-class': 'synthetic', 'com.hr-axis.release-id': releaseId,
  }
  const workerLabels = { ...labels, 'com.docker.compose.service': 'worker' }
  const makeInspect = (id, running) => ({ Id: id, Config: { Labels: id === 'container-1' ? labels : workerLabels, Image: id === 'container-1' ? 'redis:synthetic' : 'backend:synthetic' }, Mounts: id === 'container-1' ? [{ Destination: '/data', Type: 'volume', Name: `${project}_redis_data`, Source: '/var/lib/docker/volumes/redis' }] : [], State: { Running: running, Restarting: false, OOMKilled: false, Dead: false, Error: '', Health: { Status: 'healthy' } } })
  const config = { services: Object.fromEntries(['redis', 'worker'].map((name) => [name, {
    image: name === 'redis' ? 'redis:synthetic' : 'backend:synthetic', networks: name === 'redis' ? [`${project}_data`] : [`${project}_app`, `${project}_data`], ports: [], labels: { 'com.docker.compose.project': project, 'com.hr-axis.project': project, 'com.hr-axis.data-class': 'synthetic', 'com.hr-axis.release-id': releaseId },
  }])) }
  const outputs = new Map([
    ['enqueue', JSON.stringify({ event: 'onprem.synthetic_queue_probe.completed', durability: 'local-aof-fsynced', mode: 'enqueue', queuedCount: 1, state: 'delayed', status: 'queued' })],
    ['process', JSON.stringify({ event: 'onprem.synthetic_queue_probe.completed', mode: 'process', processedCount: 1, duplicateCount: 0, status: 'completed' })],
    ['status', JSON.stringify({ event: 'onprem.synthetic_queue_probe.completed', mode: 'status', markerCount: 1, state: 'completed' })],
  ])
  const calls = []
  let workerRunning = true
  let redisRunning = true
  const result = runQueueProof({ project, releaseId, envFile: 'core.env', compose: ['core.yaml'], timeoutMs: 1000 }, {
    config,
    skipNetwork: true,
    redisContainerId: 'container-1', workerContainerId: 'worker-1',
    inspect: (id) => makeInspect(id, id === 'worker-1' ? workerRunning : redisRunning),
    composeCommand: (_options, args, label) => {
      calls.push(label)
      if (label === 'worker stop') workerRunning = false
      if (label === 'worker start') workerRunning = true
      if (label === 'Redis stop') redisRunning = false
      if (label === 'Redis start') redisRunning = true
      if (args.at(-1) === 'enqueue' || args.at(-1) === 'process' || args.at(-1) === 'status') return { status: 0, stdout: outputs.get(args.at(-1)), stderr: '' }
      return { status: 0, stdout: '', stderr: '' }
    },
  })
  assert.equal(result.redisRestarted, true)
  assert.deepEqual(calls, ['worker stop', 'synthetic queue enqueue', 'Redis stop', 'Redis start', 'synthetic queue process', 'synthetic queue status', 'worker start'])
})

test('queue proof restores the exact worker after a process failure', () => {
  const labels = {
    'com.docker.compose.project': project, 'com.docker.compose.service': 'redis', 'com.docker.compose.container-number': '1', 'com.docker.compose.oneoff': 'False',
    'com.hr-axis.project': project, 'com.hr-axis.data-class': 'synthetic', 'com.hr-axis.release-id': releaseId,
  }
  const workerLabels = { ...labels, 'com.docker.compose.service': 'worker' }
  const inspect = (id, running) => ({ Id: id, Config: { Labels: id === 'redis-1' ? labels : workerLabels, Image: id === 'redis-1' ? 'redis:synthetic' : 'backend:synthetic' }, Mounts: id === 'redis-1' ? [{ Destination: '/data', Type: 'volume', Name: `${project}_redis_data`, Source: '/var/lib/docker/volumes/redis' }] : [], State: { Running: running, Restarting: false, OOMKilled: false, Dead: false, Error: '', Health: { Status: 'healthy' } } })
  const config = { services: {
    redis: { image: 'redis:synthetic', networks: [`${project}_data`], ports: [], labels: { 'com.hr-axis.project': project, 'com.hr-axis.data-class': 'synthetic', 'com.hr-axis.release-id': releaseId } },
    worker: { image: 'backend:synthetic', networks: [`${project}_app`, `${project}_data`], ports: [], labels: { 'com.hr-axis.project': project, 'com.hr-axis.data-class': 'synthetic', 'com.hr-axis.release-id': releaseId } },
  } }
  let workerRunning = true
  let redisRunning = true
  const calls = []
  assert.throws(() => runQueueProof({ project, releaseId, envFile: 'core.env', compose: ['core.yaml'], timeoutMs: 1000 }, {
    config, skipNetwork: true, redisContainerId: 'redis-1', workerContainerId: 'worker-1',
    inspect: (id) => inspect(id, id === 'worker-1' ? workerRunning : redisRunning),
    composeCommand: (_options, args, label) => {
      calls.push(label)
      if (label === 'worker stop') workerRunning = false
      if (label === 'worker start') workerRunning = true
      if (label === 'Redis stop') redisRunning = false
      if (label === 'Redis start') redisRunning = true
      if (label === 'synthetic queue enqueue') return { status: 0, stdout: JSON.stringify({ event: 'onprem.synthetic_queue_probe.completed', durability: 'local-aof-fsynced', mode: 'enqueue', queuedCount: 1, state: 'delayed', status: 'queued' }), stderr: '' }
      if (label === 'synthetic queue process') throw new Error('process failed')
      return { status: 0, stdout: '', stderr: '' }
    },
  }), /process failed/)
  assert.equal(workerRunning, true)
  assert.equal(calls.at(-1), 'worker start')
})
