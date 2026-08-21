import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs'
import { test } from 'node:test'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'

import {
  STORAGE_IMAGE,
  STORAGE_PROJECT,
  buildSyntheticProofReceipt,
  buildAuthorization,
  buildComposeArgs,
  buildPresignedGet,
  command,
  exactObjectStorageVolumeName,
  validateRestoreContainer,
  validateRequestedProofPortBinding,
  validateProofPortBinding,
  redact,
  signingKey,
  validateCleanupIdentity,
  validateCleanupVolumeIdentity,
  validateFreshExecutionInventory,
  waitForProofPortReady,
  waitForBucketConfiguration,
  waitForExactVersion,
} from './onprem-photo-storage-runtime-proof.mjs'

test('runtime command timeout fails closed with sanitized output', () => {
  assert.throws(
    () => command(process.execPath, ['-e', "process.stdout.write('synthetic-secret'); setTimeout(() => {}, 1000)"], {
      timeout: 50,
      label: 'bounded inspect',
      secrets: ['synthetic-secret'],
    }),
    (error) => {
      assert.match(error.message, /bounded inspect failed/)
      assert.doesNotMatch(error.message, /synthetic-secret/)
      return true
    },
  )
})

test('synthetic runtime inputs use userns-readable secret files inside a private proof root', async () => {
  const runtime = await import('./onprem-photo-storage-runtime-proof.mjs')
  const root = mkdtempSync(join(tmpdir(), 'hr-axis-photo-storage-input-test-'))
  try {
    assert.equal(typeof runtime.writeRuntimeInputs, 'function')
    const input = runtime.writeRuntimeInputs({ releaseId: 'onprem-photo-storage-test-v1' }, root)
    const expectedFiles = {
      'primary-access-key-id': input.primaryKey,
      'primary-secret-access-key': input.primarySecret,
      'recovery-access-key-id': input.recoveryKey,
      'recovery-secret-access-key': input.recoverySecret,
    }
    if (process.platform !== 'win32') {
      assert.equal(statSync(root).mode & 0o777, 0o700)
      assert.equal(statSync(input.env).mode & 0o777, 0o600)
    }
    assert.equal(runtime.SYNTHETIC_PROOF_INPUT_ROOT_MODE, 0o700)
    assert.equal(runtime.SYNTHETIC_PROOF_SECRET_FILE_MODE, 0o644)
    assert.equal(runtime.SYNTHETIC_PROOF_ENV_FILE_MODE, 0o600)
    for (const [name, expected] of Object.entries(expectedFiles)) {
      const path = join(root, name)
      if (process.platform !== 'win32') assert.equal(statSync(path).mode & 0o777, 0o644)
      assert.equal(readFileSync(path, 'utf8'), `${expected}\n`)
      assert.ok(expected.length > 0)
    }
    const envLines = readFileSync(input.env, 'utf8').split(/\r?\n/)
    assert.deepEqual(
      envLines.filter((line) => line.startsWith('REDIS_IMAGE=')),
      ['REDIS_IMAGE=redis:7.4.10-alpine@sha256:e7723ff73d963f5cc6d9c4643ea3d989527a402a319239054e9472a7fb9219a2'],
    )
    assert.ok(envLines.join('\n').length > 0)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('runtime proof requires an exact requested loopback port binding', () => {
  assert.equal(validateRequestedProofPortBinding({ '8333/tcp': [{ HostIp: '127.0.0.1', HostPort: '18333' }] }), true)
  for (const bindings of [
    null,
    [],
    {},
    { '8333/tcp': null },
    { '8333/tcp': [{ HostIp: '0.0.0.0', HostPort: '18333' }] },
    { '8333/tcp': [{ HostIp: '127.0.0.1', HostPort: '18334' }] },
    { '8333/tcp': [{ HostIp: '127.0.0.1', HostPort: '18333' }, { HostIp: '127.0.0.1', HostPort: '18334' }] },
    { '8333/tcp': [{ HostIp: '127.0.0.1', HostPort: '18333', Extra: 'unexpected' }] },
    { '8333/tcp': [{ HostIp: '127.0.0.1', HostPort: '18333' }], '9000/tcp': [] },
  ]) assert.throws(() => validateRequestedProofPortBinding(bindings), /requested loopback port binding/)
})

test('runtime proof requires an exact loopback S3 port binding', () => {
  assert.equal(validateProofPortBinding({ '8333/tcp': [{ HostIp: '127.0.0.1', HostPort: '18333' }] }), true)
  assert.throws(() => validateProofPortBinding({ '8333/tcp': [] }), /loopback port binding/)
  assert.throws(() => validateProofPortBinding({ '8333/tcp': [{ HostIp: '0.0.0.0', HostPort: '18333' }] }), /loopback port binding/)
})

test('runtime proof accepts the Docker inspect shape with null unpublished ports', () => {
  assert.equal(validateProofPortBinding({
    '18080/tcp': null,
    '18888/tcp': null,
    '19333/tcp': null,
    '7333/tcp': null,
    '8080/tcp': null,
    '8333/tcp': [{ HostIp: '127.0.0.1', HostPort: '18333' }],
    '8888/tcp': null,
    '9333/tcp': null,
  }), true)
})

test('runtime proof rejects an additive public binding', () => {
  assert.throws(() => validateProofPortBinding({
    '8333/tcp': [
      { HostIp: '127.0.0.1', HostPort: '18333' },
      { HostIp: '0.0.0.0', HostPort: '18334' },
    ],
  }), /loopback port binding/)
})

test('runtime proof rejects extra port keys and malformed port inventories', () => {
  for (const ports of [
    {
      '8333/tcp': [{ HostIp: '127.0.0.1', HostPort: '18333' }],
      '9000/tcp': [{ HostIp: '127.0.0.1', HostPort: '19000' }],
    },
    null,
    [],
    { '8333/tcp': [{ HostIp: '127.0.0.1', HostPort: '18333', Extra: 'unexpected' }] },
  ]) {
    assert.throws(() => validateProofPortBinding(ports), /loopback port binding/)
  }
  assert.equal(validateProofPortBinding({ '8333/tcp': null }), false)
})

test('runtime proof captures the exact object volume before startup image and port validation', () => {
  const source = readFileSync(resolve('scripts/onprem-photo-storage-runtime-proof.mjs'), 'utf8')
  const volumeCapture = source.indexOf("objectVolume = command('docker', ['inspect', '-f'")
  const imageValidation = source.indexOf('if (inspect.Config?.Image')
  const portValidation = source.indexOf('validateRequestedProofPortBinding(inspect.HostConfig?.PortBindings)')
  assert.ok(volumeCapture >= 0)
  assert.ok(volumeCapture < imageValidation)
  assert.ok(volumeCapture < portValidation)
  assert.ok(source.includes("const inspectContainer = (id, label = 'inspect object-storage', timeoutMs = 1_000)"))
  assert.ok(source.includes("inspect: ({ timeoutMs }) => inspectContainer(containerId, 'inspect object-storage', timeoutMs)"))
  assert.ok(source.includes("inspect: ({ timeoutMs }) => inspectContainer(restoreId, 'inspect restored storage', timeoutMs)"))
})

test('runtime proof distinguishes exact and pending effective port state', () => {
  const exact = { '8333/tcp': [{ HostIp: '127.0.0.1', HostPort: '18333' }], '8080/tcp': null }
  assert.equal(validateProofPortBinding(exact), true)
  assert.equal(validateProofPortBinding({}), false)
  assert.equal(validateProofPortBinding({ '8080/tcp': null }), false)
  assert.equal(validateProofPortBinding({ '8333/tcp': null, '8080/tcp': null }), false)
  assert.throws(() => validateProofPortBinding({ ...exact, '9000/tcp': [{ HostIp: '0.0.0.0', HostPort: '19000' }] }), /contradictory/)
  assert.throws(() => validateProofPortBinding({ '8333/tcp': [{ HostIp: '0.0.0.0', HostPort: '18333' }] }), /contradictory/)
})

test('runtime proof readiness accepts exact and pending effective states once loopback responds', async () => {
  const requested = { '8333/tcp': [{ HostIp: '127.0.0.1', HostPort: '18333' }] }
  const exact = await waitForProofPortReady({
    endpoint: 'http://127.0.0.1:18333',
    inspect: async () => ({ HostConfig: { PortBindings: requested }, NetworkSettings: { Ports: { '8333/tcp': requested['8333/tcp'] } }, State: { Status: 'running', Running: true, Restarting: false }, RestartCount: 0 }),
    request: async (url) => { assert.equal(url, 'http://127.0.0.1:18333/'); return { status: 403 } },
    sleep: async () => {},
  })
  assert.deepEqual(exact, { status: 403, effective: 'exact' })

  const pending = await waitForProofPortReady({
    endpoint: 'http://127.0.0.1:18333',
    inspect: async () => ({ HostConfig: { PortBindings: requested }, NetworkSettings: { Ports: { '8080/tcp': null } }, State: { Status: 'running', Running: true, Restarting: false }, RestartCount: 0 }),
    request: async () => ({ status: 200 }),
    sleep: async () => {},
  })
  assert.deepEqual(pending, { status: 200, effective: 'pending' })
})

test('runtime proof readiness retries pending transport and reports sanitized deadline diagnostics', async () => {
  let monotonic = 0
  await assert.rejects(
    waitForProofPortReady({
      endpoint: 'http://127.0.0.1:18333',
      timeoutMs: 20,
      requestTimeoutMs: 5,
      inspect: async () => ({ HostConfig: { PortBindings: { '8333/tcp': [{ HostIp: '127.0.0.1', HostPort: '18333' }] } }, NetworkSettings: { Ports: {} }, State: { Status: 'running', Running: true, Restarting: false }, RestartCount: 4 }),
      request: async () => { throw Object.assign(new Error('ECONNREFUSED synthetic-key'), { name: 'TypeError' }) },
      sleep: async () => { monotonic += 10 },
      now: () => monotonic,
    }),
    (error) => {
      assert.match(error.message, /proof port readiness timed out .*status=running.*restartCount=4.*effective=pending/)
      assert.doesNotMatch(error.message, /synthetic-key|8333|18333/)
      return true
    },
  )
})

test('runtime proof readiness bounds inspect retries to positive integer deadline budgets', async () => {
  let monotonic = 0
  let inspections = 0
  const budgets = []
  await assert.rejects(
    waitForProofPortReady({
      endpoint: 'http://127.0.0.1:18333',
      timeoutMs: 20.75,
      requestTimeoutMs: 5,
      inspect: async ({ timeoutMs }) => {
        budgets.push(timeoutMs)
        inspections += 1
        monotonic += inspections === 1 ? 3.5 : 2.25
        throw new Error(`inspect synthetic-secret-${inspections}`)
      },
      request: async () => { throw Object.assign(new Error('ECONNREFUSED synthetic-key'), { name: 'TypeError' }) },
      sleep: async () => { monotonic += 1.25 },
      now: () => monotonic,
    }),
    (error) => {
      assert.match(error.message, /proof port readiness timed out/)
      assert.doesNotMatch(error.message, /inspect synthetic-secret|synthetic-key|18333/)
      assert.ok(budgets.length >= 2)
      assert.ok(budgets.every((budget) => Number.isInteger(budget) && budget >= 1))
      assert.ok(budgets.some((budget, index) => index > 0 && budget < budgets[0]))
      return true
    },
  )
})

test('runtime proof readiness rejects contradictory effective bindings and unexpected deterministic status', async () => {
  const requested = { '8333/tcp': [{ HostIp: '127.0.0.1', HostPort: '18333' }] }
  await assert.rejects(
    waitForProofPortReady({
      endpoint: 'http://127.0.0.1:18333',
      inspect: async () => ({ HostConfig: { PortBindings: requested }, NetworkSettings: { Ports: { '8333/tcp': requested['8333/tcp'], '9000/tcp': [{ HostIp: '0.0.0.0', HostPort: '19000' }] } } }),
      request: async () => ({ status: 200 }),
      sleep: async () => {},
    }),
    /contradictory/,
  )
  await assert.rejects(
    waitForProofPortReady({
      endpoint: 'http://127.0.0.1:18333',
      inspect: async () => ({ HostConfig: { PortBindings: requested }, NetworkSettings: { Ports: {} } }),
      request: async () => ({ status: 401 }),
      sleep: async () => {},
    }),
    /unexpected HTTP status/,
  )
})

test('runtime proof readiness rejects an exited container even when loopback responds', async () => {
  await assert.rejects(
    waitForProofPortReady({
      endpoint: 'http://127.0.0.1:18333',
      inspect: async () => ({
        HostConfig: { PortBindings: { '8333/tcp': [{ HostIp: '127.0.0.1', HostPort: '18333' }] } },
        NetworkSettings: { Ports: {} },
        State: { Status: 'exited', Running: false, Restarting: false },
        RestartCount: 2,
      }),
      request: async () => ({ status: 200 }),
      sleep: async () => {},
    }),
    /container not running/,
  )
})

test('runtime proof readiness retries a restarting container before accepting a running response', async () => {
  const requested = { '8333/tcp': [{ HostIp: '127.0.0.1', HostPort: '18333' }] }
  let inspections = 0
  let requests = 0
  const result = await waitForProofPortReady({
    endpoint: 'http://127.0.0.1:18333',
    inspect: async () => {
      inspections += 1
      if (inspections === 1) {
        return { HostConfig: { PortBindings: requested }, NetworkSettings: { Ports: {} }, State: { Status: 'restarting', Running: false, Restarting: true }, RestartCount: 1 }
      }
      return { HostConfig: { PortBindings: requested }, NetworkSettings: { Ports: { '8333/tcp': requested['8333/tcp'] } }, State: { Status: 'running', Running: true, Restarting: false }, RestartCount: 1 }
    },
    request: async () => { requests += 1; return { status: 200 } },
    sleep: async () => {},
  })
  assert.deepEqual(result, { status: 200, effective: 'exact' })
  assert.equal(inspections, 2)
  assert.equal(requests, 2)
})

test('runtime restore validation requires the requested image, volume, state, and 18334 loopback binding', () => {
  const restoreVolume = 'restore-volume'
  const inspect = {
    Config: { Image: STORAGE_IMAGE },
    HostConfig: { PortBindings: { '8333/tcp': [{ HostIp: '127.0.0.1', HostPort: '18334' }] } },
    Mounts: [{ Destination: '/data', Name: restoreVolume }],
    State: { Running: true },
  }
  assert.equal(validateRestoreContainer(inspect, restoreVolume), true)
  assert.throws(() => validateRestoreContainer({ ...inspect, HostConfig: { PortBindings: { '8333/tcp': [{ HostIp: '127.0.0.1', HostPort: '18333' }] } } }, restoreVolume), /requested loopback/)
  assert.throws(() => validateRestoreContainer({ ...inspect, Mounts: [] }, restoreVolume), /volume identity/)
  assert.throws(() => validateRestoreContainer({ ...inspect, State: { Running: false } }, restoreVolume), /not running/)
})

test('exact-version readiness retries restart transients before accepting the exact hash', async () => {
  const body = Buffer.from('fixture')
  const expectedSha256 = createHash('sha256').update(body).digest('hex')
  const responses = [
    Object.assign(new Error('terminated'), { name: 'TypeError' }),
    { status: 404, headers: new Headers(), body: Buffer.alloc(0) },
    { status: 503, headers: new Headers(), body: Buffer.alloc(0) },
    { status: 200, headers: new Headers(), body },
  ]
  const calls = []
  const result = await waitForExactVersion({
    endpoint: 'http://127.0.0.1:18333',
    bucket: 'primary',
    key: 'locked/fixture.webp',
    versionId: 'version-1',
    accessKey: 'synthetic-key',
    secretKey: 'synthetic-secret',
    expectedSha256,
    request: async (request) => {
      calls.push(request)
      const next = responses.shift()
      if (next instanceof Error) throw next
      return next
    },
    sleep: async () => {},
  })

  assert.equal(result.status, 200)
  assert.equal(calls.length, 4)
  for (const request of calls) {
    assert.equal(request.endpoint, 'http://127.0.0.1:18333')
    assert.equal(request.bucket, 'primary')
    assert.equal(request.key, 'locked/fixture.webp')
    assert.deepEqual(request.query, { versionId: 'version-1' })
    assert.equal(request.accessKey, 'synthetic-key')
    assert.equal(request.secretKey, 'synthetic-secret')
    assert.ok(request.signal)
  }
})

test('bucket configuration readiness retries transient readback failures before accepting exact state', async () => {
  const responses = [
    { status: 500, headers: new Headers(), body: Buffer.from('transient') },
    { status: 200, headers: new Headers(), body: Buffer.from('<VersioningConfiguration><Status>Enabled</Status></VersioningConfiguration>') },
  ]
  const calls = []
  const result = await waitForBucketConfiguration({
    endpoint: 'http://127.0.0.1:18333',
    bucket: 'primary',
    query: { versioning: '' },
    accessKey: 'synthetic-key',
    secretKey: 'synthetic-secret',
    expected: (body) => /<Status>Enabled<\/Status>/.test(body.toString('utf8')),
    request: async (request) => {
      calls.push(request)
      return responses.shift()
    },
    sleep: async () => {},
  })

  assert.equal(result.status, 200)
  assert.equal(calls.length, 2)
  assert.deepEqual(calls[0].query, { versioning: '' })
  assert.equal(calls[0].accessKey, 'synthetic-key')
  assert.equal(calls[0].secretKey, 'synthetic-secret')
  assert.ok(calls.every((call) => call.signal))
})

test('bucket configuration readiness fails immediately on deterministic auth/status responses', async () => {
  let attempts = 0
  await assert.rejects(
    waitForBucketConfiguration({
      endpoint: 'http://127.0.0.1:18333',
      bucket: 'primary',
      query: { 'object-lock': '' },
      accessKey: 'synthetic-key',
      secretKey: 'synthetic-secret',
      expected: () => true,
      request: async () => {
        attempts += 1
        return { status: 403, headers: new Headers(), body: Buffer.alloc(0) }
      },
      sleep: async () => {},
    }),
    /bucket configuration GET failed/,
  )
  assert.equal(attempts, 1)
})

test('exact-version readiness retries request timeout errors', async () => {
  const body = Buffer.from('fixture')
  let attempts = 0
  const result = await waitForExactVersion({
    endpoint: 'http://127.0.0.1:18333',
    bucket: 'primary',
    key: 'locked/fixture.webp',
    versionId: 'version-1',
    accessKey: 'synthetic-key',
    secretKey: 'synthetic-secret',
    expectedSha256: createHash('sha256').update(body).digest('hex'),
    request: async () => {
      attempts += 1
      if (attempts === 1) throw Object.assign(new Error('request timed out'), { name: 'TimeoutError' })
      return { status: 200, headers: new Headers(), body }
    },
    sleep: async () => {},
  })
  assert.equal(result.status, 200)
  assert.equal(attempts, 2)
})

test('exact-version readiness fails at the monotonic deadline on perpetual transient responses', async () => {
  let monotonic = 0
  let attempts = 0
  await assert.rejects(
    waitForExactVersion({
      endpoint: 'http://127.0.0.1:18333',
      bucket: 'primary',
      key: 'locked/fixture.webp',
      versionId: 'version-1',
      accessKey: 'synthetic-key',
      secretKey: 'synthetic-secret',
      expectedSha256: 'a'.repeat(64),
      timeoutMs: 25,
      requestTimeoutMs: 5,
      request: async () => {
        attempts += 1
        monotonic += 10
        return { status: 503, headers: new Headers(), body: Buffer.alloc(0) }
      },
      sleep: async () => { monotonic += 10 },
      now: () => monotonic,
    }),
    (error) => {
      assert.match(error.message, /exact-version GET timed out \(attempts=\d+, lastStatus=503\)/)
      assert.doesNotMatch(error.message, /fixture|version-1|synthetic/)
      return true
    },
  )
  assert.equal(attempts, 2)
})

test('exact-version readiness converts a fractional remaining deadline to an integer request timeout', async () => {
  const body = Buffer.from('fixture')
  const expectedSha256 = createHash('sha256').update(body).digest('hex')
  const times = [0, 24.5]
  const result = await waitForExactVersion({
    endpoint: 'http://127.0.0.1:18333',
    bucket: 'primary',
    key: 'locked/fixture.webp',
    versionId: 'version-1',
    accessKey: 'synthetic-key',
    secretKey: 'synthetic-secret',
    expectedSha256,
    timeoutMs: 25,
    requestTimeoutMs: 1000,
    request: async ({ signal }) => {
      assert.ok(signal)
      return { status: 200, headers: new Headers(), body }
    },
    now: () => times.shift() ?? 24.5,
  })

  assert.equal(result.status, 200)
})

test('exact-version readiness fails immediately on deterministic auth/status or hash errors', async () => {
  const expectedSha256 = createHash('sha256').update(Buffer.from('fixture')).digest('hex')
  for (const response of [
    { status: 401, headers: new Headers(), body: Buffer.alloc(0) },
    { status: 403, headers: new Headers(), body: Buffer.alloc(0) },
    { status: 400, headers: new Headers(), body: Buffer.alloc(0) },
    { status: 200, headers: new Headers(), body: Buffer.from('wrong') },
  ]) {
    let attempts = 0
    await assert.rejects(
      waitForExactVersion({
        endpoint: 'http://127.0.0.1:18333',
        bucket: 'primary',
        key: 'locked/fixture.webp',
        versionId: 'version-1',
        accessKey: 'synthetic-key',
        secretKey: 'synthetic-secret',
        expectedSha256,
        request: async () => {
          attempts += 1
          return response
        },
        sleep: async () => {},
      }),
      (error) => {
        assert.match(error.message, /exact-version GET (failed|returned an unexpected hash)/)
        assert.doesNotMatch(error.message, /fixture|version-1|synthetic/)
        return true
      },
    )
    assert.equal(attempts, 1)
  }
})

test('runtime proof pins exact image/project and composes base, storage, and proof overlays', () => {
  const args = buildComposeArgs({
    project: STORAGE_PROJECT,
    envFile: 'proof.env',
    coreCompose: 'infra/onprem/core/compose.yaml',
    compose: 'infra/onprem/photo-storage/compose.yaml',
    proofCompose: 'infra/onprem/photo-storage/compose.proof.yaml',
  }, ['--profile', 'proof', 'up', '-d', 'object-storage'])
  assert.deepEqual(args.slice(0, 11), [
    'compose', '--project-name', STORAGE_PROJECT, '--env-file', resolve('proof.env'),
    '--file', resolve('infra/onprem/core/compose.yaml'),
    '--file', resolve('infra/onprem/photo-storage/compose.yaml'),
    '--file', resolve('infra/onprem/photo-storage/compose.proof.yaml'),
  ])
  assert.equal(args.at(-1), 'object-storage')
  assert.match(STORAGE_IMAGE, /^chrislusf\/seaweedfs:4\.41@sha256:[0-9a-f]{64}$/)
})

test('runtime proof CLI executes on Windows paths and rejects missing execution mode', () => {
  const result = spawnSync(process.execPath, [
    resolve('scripts/onprem-photo-storage-runtime-proof.mjs'),
    '--release-id', 'onprem-photo-storage-test-v1',
  ], { encoding: 'utf8' })

  assert.equal(result.status, 1)
  assert.match(result.stderr, /explicit --execute or --cleanup is required/)
})

test('runtime proof SigV4 authorization is deterministic and signs exact payload', () => {
  const now = new Date('2026-08-12T10:20:30.000Z')
  const auth = buildAuthorization({
    method: 'PUT',
    url: 'http://object-storage:8333/hr-axis-media-primary/synthetic%2Fphoto.bin',
    accessKey: 'synthetic-primary',
    secretKey: 'synthetic-secret',
    body: 'fixture',
    headers: { 'content-type': 'application/octet-stream' },
    now,
  })
  assert.equal(auth.host, 'object-storage:8333')
  assert.equal(auth['x-amz-date'], '20260812T102030Z')
  assert.match(auth.authorization, /^AWS4-HMAC-SHA256 Credential=synthetic-primary\/20260812\/us-east-1\/s3\/aws4_request/)
  assert.match(auth.authorization, /SignedHeaders=content-type;host;x-amz-content-sha256/)
  assert.equal(signingKey('synthetic-secret', '20260812').length, 32)
})

test('runtime proof presign includes expiry and signature but no secret key', () => {
  const signed = buildPresignedGet({
    endpoint: 'http://127.0.0.1:18333', bucket: 'primary', key: 'fixture.bin',
    accessKey: 'synthetic-key', secretKey: 'synthetic-secret', expires: 60,
    now: new Date('2026-08-12T10:20:30.000Z'),
  })
  const parsed = new URL(signed)
  assert.equal(parsed.searchParams.get('X-Amz-Expires'), '60')
  assert.equal(parsed.searchParams.get('X-Amz-Algorithm'), 'AWS4-HMAC-SHA256')
  assert.equal(parsed.searchParams.has('secretKey'), false)
  assert.match(parsed.searchParams.get('X-Amz-Signature'), /^[0-9a-f]{64}$/)
})

test('runtime proof redacts credentials from command and receipt surfaces', () => {
  assert.equal(redact('accessKey=synthetic-key secretKey=synthetic-secret', ['synthetic-key', 'synthetic-secret']), 'accessKey=[redacted] secretKey=[redacted]')
  assert.equal(redact('raw synthetic-secret', ['synthetic-secret']), 'raw [redacted]')
})

test('successful photo-storage proof receipt binds the exact sanitized project and release identity', () => {
  const source = readFileSync(resolve('scripts/onprem-photo-storage-runtime-proof.mjs'), 'utf8')
  assert.match(source, /return buildSyntheticProofReceipt\(options, \{/)
  const options = { project: STORAGE_PROJECT, releaseId: 'onprem-photo-storage-test-v1' }
  const claims = { image: STORAGE_IMAGE, fixtureSha256: 'a'.repeat(64), restorePreserved: true }
  const receipt = buildSyntheticProofReceipt(options, claims)
  assert.deepEqual(
    Object.fromEntries(Object.entries(receipt).filter(([key]) => ['schemaVersion', 'dataClass', 'status', 'project', 'releaseId'].includes(key))),
    { schemaVersion: 1, dataClass: 'synthetic', status: 'passed', project: options.project, releaseId: options.releaseId },
  )
  assert.equal(receipt.image, STORAGE_IMAGE)
  assert.equal(receipt.fixtureSha256, claims.fixtureSha256)
  assert.equal(receipt.restorePreserved, true)
  assert.equal(buildSyntheticProofReceipt(options, { ...claims, project: 'wrong-project', releaseId: 'wrong-release' }).project, options.project)
  assert.equal(buildSyntheticProofReceipt(options, { ...claims, project: 'wrong-project', releaseId: 'wrong-release' }).releaseId, options.releaseId)
})

test('photo-storage proof receipt cannot be fabricated with missing or wrong identity inputs', () => {
  const claims = { image: STORAGE_IMAGE, fixtureSha256: 'a'.repeat(64) }
  for (const options of [
    undefined,
    {},
    { releaseId: 'onprem-photo-storage-test-v1' },
    { project: 'wrong-project', releaseId: 'onprem-photo-storage-test-v1' },
    { project: STORAGE_PROJECT },
    { project: STORAGE_PROJECT, releaseId: '../wrong-release' },
  ]) {
    assert.throws(() => buildSyntheticProofReceipt(options, claims), /photo-storage proof receipt identity is invalid/)
  }
})

test('runtime cleanup accepts only exact labelled storage identities', () => {
  const options = { project: STORAGE_PROJECT, releaseId: 'onprem-photo-storage-test-v1' }
  const labels = {
    'com.docker.compose.project': STORAGE_PROJECT,
    'com.docker.compose.service': 'object-storage',
    'com.docker.compose.oneoff': 'False',
    'com.hr-axis.project': 'hr-axis-onprem-core',
    'com.hr-axis.data-class': 'synthetic',
    'com.hr-axis.release-id': options.releaseId,
  }
  assert.equal(validateCleanupIdentity(labels, options), true)
  for (const mutate of [
    { ...labels, 'com.docker.compose.project': 'other' },
    { ...labels, 'com.docker.compose.service': 'postgres' },
    { ...labels, 'com.hr-axis.data-class': 'company' },
    { ...labels, 'com.docker.compose.oneoff': 'True' },
  ]) assert.throws(() => validateCleanupIdentity(mutate, options), /refused/)
})

test('runtime cleanup validates exact synthetic volume classes before deletion', () => {
  const options = { project: STORAGE_PROJECT, releaseId: 'onprem-photo-storage-test-v1' }
  const labels = {
    'com.docker.compose.project': STORAGE_PROJECT,
    'com.hr-axis.project': 'hr-axis-onprem-core',
    'com.hr-axis.data-class': 'synthetic',
    'com.hr-axis.release-id': options.releaseId,
    'com.hr-axis.volume-class': 'photo-object-storage',
  }
  assert.equal(validateCleanupVolumeIdentity(labels, options, 'photo-object-storage'), true)
  assert.throws(() => validateCleanupVolumeIdentity({ ...labels, 'com.hr-axis.volume-class': 'postgres' }, options, 'photo-object-storage'), /mismatched volume/)
})

test('runtime fallback photo volume uses the exact project name and refuses mismatched labels', () => {
  const options = { project: STORAGE_PROJECT, releaseId: 'onprem-photo-storage-test-v1' }
  assert.equal(exactObjectStorageVolumeName(options), `${STORAGE_PROJECT}_object_storage_data`)
  assert.throws(() => validateCleanupVolumeIdentity({
    'com.docker.compose.project': STORAGE_PROJECT,
    'com.hr-axis.project': 'hr-axis-onprem-core',
    'com.hr-axis.data-class': 'synthetic',
    'com.hr-axis.release-id': options.releaseId,
    'com.hr-axis.volume-class': 'postgres',
  }, options, 'photo-object-storage'), /mismatched volume/)
})

test('runtime execution refuses stale project resources before mutation', () => {
  assert.equal(validateFreshExecutionInventory({ containers: [], volumes: [], networks: [] }), true)
  assert.throws(() => validateFreshExecutionInventory({ containers: ['stale'], volumes: [], networks: [] }), /fresh project/)
  assert.throws(() => validateFreshExecutionInventory({ containers: [], volumes: ['stale'], networks: [] }), /fresh project/)
  assert.throws(() => validateFreshExecutionInventory({ containers: [], volumes: [], networks: ['stale'] }), /fresh project/)
})
