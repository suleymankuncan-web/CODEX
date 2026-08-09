import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { checkServerIdentity } from 'node:tls'

import {
  assertNoSecretLeak,
  assertProbeOutput,
  assertSecretSourceMetadata,
  classifyTlsProbeResult,
  egressRejectCounters,
  migrationTreeDigestFromOutput,
  parseMigrationIdentity,
  parseSequencePrivilegeMatrix,
  redact,
  sanitizeTlsErrorCode,
  buildTlsProbeDockerArgs,
  serviceFailureDiagnostic,
  TLS_WRONG_CA_CODES,
  verifyCaddyRuntimeInvariants,
} from './onprem-core-runtime-proof.mjs'
import { CADDY_CMDLINE, TLS_SAFE_ERROR_CODES } from './onprem-caddy-runtime-proof.mjs'

const subnets = ['172.30.0.0/24', '172.30.10.0/24', '172.30.20.0/24', '172.30.30.0/24']

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
