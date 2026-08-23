import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { EventEmitter } from 'node:events'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { test } from 'node:test'

import {
  collectUploadArtifacts,
  captureFirewallSnapshot,
  containProcessGroup,
  dockerIdentityFromOutput,
  executeProofBodies,
  executeShellPhase,
  extractFullProofPlan,
  renderWorkflowExpressions,
  assertFreshWorkspaceOutputs,
  inspectPostflight,
  runLocalProof,
  sanitizeFirewallDiagnostic,
  validateDockerRootContext,
  validateCliOptions,
} from './onprem-image-local-proof.mjs'

const workflowPath = resolve('.github/workflows/onprem-image-proof.yml')
const workflow = readFileSync(workflowPath, 'utf8')
const sourceSha = 'a'.repeat(40)
const treeSha = 'b'.repeat(40)

function hashFile(pathname) {
  return createHash('sha256').update(readFileSync(pathname)).digest('hex')
}

function hashBytesForTest(bytes) {
  return createHash('sha256').update(bytes).digest('hex')
}

test('local runner extracts exactly the full proof run bodies in declared order', () => {
  const plan = extractFullProofPlan(workflow)
  assert.equal(plan.steps.length, 22)
  assert.equal(plan.steps[0].name, 'Validate full proof inputs and exact checkout')
  assert.equal(plan.steps.at(-1).name, 'Emit fresh full proof identity and receipt')
  assert.equal(plan.uploads.length, 4)
  assert.throws(() => extractFullProofPlan(workflow.replace(
    'Generate signed complete content-guard index',
    'Generate signed complete content-guard index (drift)',
  )), /order or membership changed/)
  assert.throws(() => extractFullProofPlan(workflow.replace(
    '      - name: Generate SPDX SBOMs with pinned Syft',
    '      - name: Generate SPDX SBOMs with pinned Syft\n      - name: Generate SPDX SBOMs with pinned Syft',
  )), /duplicate workflow step|order or membership changed/)
  assert.notEqual(plan.steps[1].body, workflow)
  assert.match(plan.steps[1].body, /docker pull/) // extracted, never copied into runner source
})

test('full proof upload contract rejects action name and ordered path drift', () => {
  assert.throws(() => extractFullProofPlan(workflow.replace(
    'name: onprem-core-runtime-proof-${{ github.sha }}',
    'name: onprem-core-runtime-proof-drift-${{ github.sha }}',
  )), /upload contract changed/)
  assert.throws(() => extractFullProofPlan(workflow.replace(
    '            proof/*-trivy.json',
    '            proof/*-trivy.json\n            proof/unapproved-extra.json',
  )), /upload contract changed/)
})

test('CLI requires fresh absolute paths and this canonical checkout', () => {
  const root = mkdtempSync(join(tmpdir(), 'onprem-local-contract-'))
  try {
    const runRoot = join(root, 'run')
    const proofOutput = join(root, 'proof-output')
    const receipt = join(root, 'receipt.json')
    const nodeSha256 = hashFile(process.execPath)
    assert.throws(() => validateCliOptions({
      'source-sha': sourceSha, 'tree-sha': treeSha, 'run-number': '7', node: process.execPath,
      'node-sha256': nodeSha256, 'run-root': runRoot, 'proof-output': proofOutput, receipt,
      'workspace-root': resolve('.'), 'deadline-minutes': '1',
    }), /allow-disposable-daemon-reset/)
    const options = validateCliOptions({
      'source-sha': sourceSha,
      'tree-sha': treeSha,
      'run-number': '7',
      node: process.execPath,
      'node-sha256': nodeSha256,
      'run-root': runRoot,
      'proof-output': proofOutput,
      receipt,
      'workspace-root': resolve('.'),
      'deadline-minutes': '1',
      'allow-disposable-daemon-reset': true,
    })
    assert.equal(options.runNumber, 7)
    assert.throws(() => validateCliOptions({
      'source-sha': sourceSha, 'tree-sha': treeSha, 'run-number': '1', node: process.execPath,
      'node-sha256': nodeSha256, 'run-root': runRoot, 'proof-output': proofOutput, receipt,
      'workspace-root': root,
      'allow-disposable-daemon-reset': true,
    }), /workspace root is not this checkout/)
    mkdirSync(runRoot)
    assert.throws(() => validateCliOptions({
      'source-sha': sourceSha, 'tree-sha': treeSha, 'run-number': '1', node: process.execPath,
      'node-sha256': nodeSha256, 'run-root': runRoot, 'proof-output': proofOutput, receipt,
      'allow-disposable-daemon-reset': true,
    }), /run root must be fresh/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('runner rejects a different executing Node before mutating host outputs', async () => {
  const root = mkdtempSync(join(tmpdir(), 'onprem-node-identity-contract-'))
  try {
    const runRoot = join(root, 'run')
    const proofOutput = join(root, 'proof-output')
    const receipt = join(root, 'receipt.json')
    const suppliedNode = resolve('./scripts/onprem-image-local-proof-contract.test.mjs')
    await assert.rejects(() => runLocalProof({
      'source-sha': sourceSha,
      'tree-sha': treeSha,
      'run-number': '1',
      node: suppliedNode,
      'node-sha256': hashFile(suppliedNode),
      'run-root': runRoot,
      'proof-output': proofOutput,
      receipt,
      'workspace-root': resolve('.'),
      'deadline-minutes': '1',
      'allow-disposable-daemon-reset': true,
    }), /executing Node/)
    assert.equal(existsSync(runRoot), false)
    assert.equal(existsSync(receipt), false)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('expression renderer and GITHUB_ENV persistence are fail-closed and allowlisted', async () => {
  const context = { expectedSha: sourceSha, proofMode: 'full', imageScope: 'both', runNumber: 9, githubSha: sourceSha }
  assert.equal(renderWorkflowExpressions('onprem-${{ github.run_number }}-${{ inputs.expected_sha }}', context), `onprem-9-${sourceSha}`)
  assert.throws(() => renderWorkflowExpressions('${{ secrets.TOKEN }}', context), /unsupported GitHub expression/)
  const root = mkdtempSync(join(tmpdir(), 'onprem-env-contract-'))
  try {
    const envPath = join(root, 'github-env')
    writeFileSync(envPath, '')
    const seen = []
    const result = await executeProofBodies({
      steps: [
        { name: 'first', body: 'true', env: {} },
        { name: 'second', body: 'true', env: { EXPECTED_SHA: '${{ inputs.expected_sha }}' } },
      ],
      context,
      baseEnv: { RUNNER_TEMP: root, GITHUB_ENV: envPath },
      cwd: resolve('.'),
      githubEnvPath: envPath,
      deadlineAt: Date.now() + 10_000,
      executor: async ({ step, env }) => {
        seen.push({ name: step.name, keycloak: env.KEYCLOAK_IMAGE_ID ?? null, expected: env.EXPECTED_SHA ?? null })
        if (step.name === 'first') writeFileSync(envPath, 'KEYCLOAK_IMAGE_ID=sha256:synthetic\n')
        return { status: 'passed', exitCode: 0 }
      },
    })
    assert.equal(result.failureReason, null)
    assert.deepEqual(seen, [
      { name: 'first', keycloak: null, expected: null },
      { name: 'second', keycloak: 'sha256:synthetic', expected: sourceSha },
    ])
    writeFileSync(envPath, 'UNSUPPORTED=secret\n')
    await assert.rejects(async () => {
      // A third phase forces the persisted state parser to inspect the bad key.
      await executeProofBodies({
        steps: [{ name: 'third', body: 'true', env: {} }], context,
        baseEnv: { RUNNER_TEMP: root, GITHUB_ENV: envPath }, cwd: resolve('.'), githubEnvPath: envPath,
        deadlineAt: Date.now() + 10_000, executor: async () => ({ status: 'passed', exitCode: 0 }),
      })
    }, /unsupported GITHUB_ENV key/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('mock lifecycle executes sequentially with one bounded deadline', async () => {
  const order = []
  const root = mkdtempSync(join(tmpdir(), 'onprem-lifecycle-contract-'))
  try {
    const result = await executeProofBodies({
      steps: [{ name: 'a', body: 'true', env: {} }, { name: 'b', body: 'true', env: {} }, { name: 'c', body: 'true', env: {} }],
      context: { expectedSha: sourceSha, proofMode: 'full', imageScope: 'both', runNumber: 1, githubSha: sourceSha },
      baseEnv: { RUNNER_TEMP: root }, cwd: resolve('.'), githubEnvPath: join(root, 'env'), deadlineAt: Date.now() + 10_000,
      executor: async ({ step, timeoutMs }) => { order.push([step.name, timeoutMs > 0]); return { status: 'passed', exitCode: 0 } },
    })
    assert.deepEqual(order.map(([name]) => name), ['a', 'b', 'c'])
    assert.ok(order.every(([, bounded]) => bounded))
    assert.ok(result.phases.every((phase) => phase.status === 'passed'))
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('shell phase fails closed when a leader exits with a surviving descendant', async () => {
  const calls = []
  let groupAlive = true
  const processApi = {
    kill(pid, signal) {
      calls.push([pid, signal])
      if (signal === 0) {
        if (groupAlive) return
        const error = new Error('group absent')
        error.code = 'ESRCH'
        throw error
      }
      if (signal === 'SIGKILL') groupAlive = false
    },
  }
  const child = new EventEmitter()
  child.pid = 4242
  const phase = await executeShellPhase({
    body: 'true', cwd: resolve('.'), env: {}, timeoutMs: 100,
    spawnProcess: () => {
      queueMicrotask(() => child.emit('close', 0, null))
      return child
    },
    processApi,
    termGraceMs: 2,
    killGraceMs: 10,
    pollMs: 1,
  })
  assert.equal(phase.status, 'failed')
  assert.equal(phase.containment.ok, true)
  assert.equal(phase.containment.hadGroup, true)
  assert.equal(phase.containment.killSent, true)
  assert.ok(calls.some(([, signal]) => signal === 'SIGTERM'))
  assert.ok(calls.some(([, signal]) => signal === 'SIGKILL'))
  assert.ok(calls.every(([pid]) => pid === -4242), 'all signals and kill-0 probes target the retained process group')
})

test('shell phase rejects failure to prove process-group absence after KILL escalation', async () => {
  const calls = []
  const processApi = {
    kill(pid, signal) {
      calls.push([pid, signal])
      // The simulated descendant ignores both TERM and KILL.  Every probe is
      // therefore still present and the bounded containment grace expires.
    },
  }
  const child = new EventEmitter()
  child.pid = 4343
  const phase = await executeShellPhase({
    body: 'true', cwd: resolve('.'), env: {}, timeoutMs: 100,
    spawnProcess: () => {
      queueMicrotask(() => child.emit('close', 0, null))
      return child
    },
    processApi,
    termGraceMs: 2,
    killGraceMs: 2,
    pollMs: 1,
  })
  assert.equal(phase.status, 'failed')
  assert.equal(phase.containment.ok, false)
  assert.equal(phase.containment.groupAbsent, false)
  assert.equal(phase.containment.killSent, true)
  assert.ok(calls.some(([, signal]) => signal === 'SIGKILL'))
})

test('timed-out shell phase also contains its process group before returning', async () => {
  let groupAlive = true
  const processApi = {
    kill(_pid, signal) {
      if (signal === 0) {
        if (groupAlive) return
        const error = new Error('group absent')
        error.code = 'ESRCH'
        throw error
      }
      if (signal === 'SIGTERM') groupAlive = false
    },
  }
  const child = new EventEmitter()
  child.pid = 4444
  const phase = await executeShellPhase({
    body: 'sleep 1', cwd: resolve('.'), env: {}, timeoutMs: 2,
    spawnProcess: () => child,
    processApi,
    termGraceMs: 10,
    killGraceMs: 10,
    pollMs: 1,
  })
  assert.equal(phase.status, 'timed-out')
  assert.equal(phase.timedOut, true)
  assert.equal(phase.containment.ok, true)
  assert.equal(phase.containment.groupAbsent, true)
})

test('firewall snapshots are read-only raw bytes and fail closed on drift', () => {
  const firewallText = 'iptables-save-synthetic\n'
  const commandRunner = (_file, args) => {
    if (args.some((arg) => arg.endsWith('/iptables-save'))) return { status: 0, stdout: firewallText, stderr: '' }
    if (args.includes('-S')) return { status: 1, stdout: '', stderr: '' }
    return { status: 0, stdout: '', stderr: '' }
  }
  const baseline = captureFirewallSnapshot({ commandRunner, cwd: resolve('.'), env: {}, deadlineAt: Date.now() + 10_000 })
  const equal = inspectPostflight({ commandRunner, cwd: resolve('.'), env: {}, deadlineAt: Date.now() + 10_000, firewallBaseline: baseline, firewallAfter: baseline })
  assert.equal(equal.clean, true)
  assert.equal(equal.firewall.preSha256, baseline.sha256)
  assert.equal(equal.firewall.postSha256, baseline.sha256)
  assert.equal(equal.firewall.equal, true)
  assert.equal(equal.firewall.byteEqual, true)
  assert.equal(equal.firewall.equivalent, true)
  const drift = inspectPostflight({ commandRunner, cwd: resolve('.'), env: {}, deadlineAt: Date.now() + 10_000, firewallBaseline: baseline, firewallAfter: { sha256: 'f'.repeat(64) } })
  assert.equal(drift.clean, false)
  assert.equal(drift.firewall.equal, false)
  assert.deepEqual(dockerIdentityFromOutput(JSON.stringify({ ID: 'docker-id', ServerVersion: '29.0.0', OSType: 'linux', Architecture: 'x86_64' })), { id: 'docker-id', serverVersion: '29.0.0', operatingSystem: 'linux', architecture: 'amd64' })
})

test('image firewall capture and restore retain invalid bytes without UTF-8 collapse', () => {
  const raw = Buffer.from([0xff, 0x00, 0x80, 0x0a])
  let restoreInput = null
  const commandRunner = (_file, args, options = {}) => {
    if (args.some((arg) => arg.endsWith('/iptables-save'))) return { status: 0, stdout: raw, stderr: '' }
    if (args.some((arg) => arg.endsWith('/iptables-restore'))) { restoreInput = options.input; return { status: 0, stdout: '', stderr: '' } }
    return { status: 0, stdout: '', stderr: '' }
  }
  const snapshot = captureFirewallSnapshot({ commandRunner, cwd: resolve('.'), env: {}, deadlineAt: Date.now() + 10_000 })
  assert.ok(Buffer.isBuffer(snapshot.bytes))
  assert.deepEqual(snapshot.bytes, raw)
  assert.deepEqual(snapshot.bytes, Buffer.from([0xff, 0x00, 0x80, 0x0a]))
  // The read-only capture path itself never restores; this check guards the
  // explicit raw snapshot contract used by the recovery caller.
  commandRunner('/usr/bin/sudo', ['/usr/sbin/iptables-restore', '--counters'], { input: snapshot.bytes })
  assert.deepEqual(restoreInput, raw)
})

test('receipt firewall diagnostics keep only the allowlisted sanitized shape', () => {
  const valid = {
    preByteLength: 12,
    postByteLength: 14,
    preSha256: 'a'.repeat(64),
    postSha256: 'b'.repeat(64),
    firstDifferingByteOffset: 11,
    preLines: [{ sha256: 'c'.repeat(64), byteLength: 8 }],
    postLines: [{ sha256: 'd'.repeat(64), byteLength: 10 }],
    counterOnly: true,
    lineDigestTruncated: false,
    byteEqual: false,
    timestampOnlyEquivalent: false,
    equivalent: false,
  }
  const untrusted = Object.assign(Object.create({ inheritedRuleText: '*filter\n-A INPUT -j ACCEPT' }), valid, {
    rawRules: '*filter\n-A INPUT -j ACCEPT\nCOMMIT',
    preLines: [{ ...valid.preLines[0], rawRule: ':INPUT ACCEPT [1:2]' }],
    postLines: [{ ...valid.postLines[0], bytes: Buffer.from('raw firewall bytes') }],
  })
  const sanitized = sanitizeFirewallDiagnostic(untrusted)
  assert.deepEqual(sanitized, valid)
  assert.equal(Object.hasOwn(sanitized, 'rawRules'), false)
  assert.equal(Object.hasOwn(sanitized.preLines[0], 'rawRule'), false)
  assert.equal(Object.hasOwn(sanitized.postLines[0], 'bytes'), false)
  assert.doesNotMatch(JSON.stringify(sanitized), /filter|INPUT|COMMIT|raw firewall bytes/)
  assert.equal(sanitizeFirewallDiagnostic(Object.create(valid)), null)
  assert.equal(sanitizeFirewallDiagnostic({ ...valid, preSha256: '*filter\n-A INPUT -j ACCEPT' }), null)
  assert.equal(sanitizeFirewallDiagnostic({ ...valid, firstDifferingByteOffset: 13 }), null)
  assert.equal(sanitizeFirewallDiagnostic({ ...valid, preLines: new Array(16_385).fill(valid.preLines[0]) }), null)
  assert.equal(sanitizeFirewallDiagnostic({ ...valid, lineDigestTruncated: true }).lineDigestTruncated, true)
  assert.equal(sanitizeFirewallDiagnostic({ ...valid, lineDigestTruncated: 'true' }), null)
  const inheritedTruncation = { ...valid }
  delete inheritedTruncation.lineDigestTruncated
  Object.setPrototypeOf(inheritedTruncation, { lineDigestTruncated: true })
  assert.equal(sanitizeFirewallDiagnostic(inheritedTruncation), null)
})

test('counter-only firewall mismatch remains failed through recovery and both receipt boundaries', async () => {
  const root = mkdtempSync(join(tmpdir(), 'onprem-receipt-firewall-diagnostic-'))
  try {
    const runRoot = join(root, 'run')
    const output = join(root, 'output')
    const receipt = join(root, 'receipt.json')
    const sameSha = hashFile(process.execPath)
    const beforeIpv4 = '*filter\n:INPUT ACCEPT [1:2]\nCOMMIT\n'
    const afterIpv4 = '*filter\n:INPUT ACCEPT [11:22]\nCOMMIT\n'
    const makeSnapshot = (text) => { const bytes = Buffer.from(text); return { status: 0, bytes, byteLength: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') } }
    const snapshots = { ipv4: makeSnapshot(beforeIpv4), ipv6: makeSnapshot('v6-rules\n') }
    const inspection = { contract: 'native-docker-host-v1', marker: { schema: 'mock', version: 1 }, units: { containerd: 'mock-containerd', dockerd: 'mock-dockerd' }, pids: { containerd: 11, dockerd: 12 }, socket: '/var/run/docker.sock', dockerRootDir: '/var/lib/hr-axis-onprem-rehearsal/docker', inventory: { containers: 0, networks: 0, volumes: 0, images: 0 } }
    const controller = {
      acquireHostLock: () => ({ version: 1, pid: 42, uid: 1000, nonce: 'a'.repeat(48), path: '/mock/lock' }),
      inspectDedicatedNativeDockerHost: () => inspection,
      resetDedicatedNativeDockerHost: () => ({ dockerDaemonReset: true, before: inspection, after: inspection }),
      releaseHostLock: () => true,
    }
    const commandRunner = (_file, args) => {
      if (args.some((arg) => arg.endsWith('/iptables-save'))) return { status: 0, stdout: afterIpv4, stderr: '' }
      if (args.some((arg) => arg.endsWith('/ip6tables-save'))) return { status: 0, stdout: snapshots.ipv6.bytes, stderr: '' }
      if (args.some((arg) => arg.endsWith('/iptables-restore')) || args.some((arg) => arg.endsWith('/ip6tables-restore'))) return { status: 0, stdout: '', stderr: '' }
      if (args[0] === 'rev-parse' && args[1] === 'HEAD') return { status: 0, stdout: `${sourceSha}\n`, stderr: '' }
      if (args[0] === 'rev-parse' && args[1] === 'HEAD^{tree}') return { status: 0, stdout: `${treeSha}\n`, stderr: '' }
      return { status: 0, stdout: '', stderr: '' }
    }
    await assert.rejects(() => runLocalProof({
      'source-sha': sourceSha, 'tree-sha': treeSha, 'run-number': '5', node: process.execPath,
      'node-sha256': sameSha, 'run-root': runRoot, 'proof-output': output, receipt, 'workspace-root': resolve('.'), 'deadline-minutes': '1', 'allow-disposable-daemon-reset': true,
    }, {
      hostController: controller,
      commandRunner,
      rootContextCheck: () => ({}),
      preflight: () => ({ node: { version: 'v24.19.0', sha256: sameSha }, docker: { id: 'docker-id', serverVersion: '29.0.0', operatingSystem: 'linux', architecture: 'amd64' }, firewallSnapshots: snapshots }),
      executor: async () => ({ status: 'timed-out', timedOut: true, exitCode: null }),
      postflight: () => ({ clean: true, resources: {}, firewallChains: {} }),
    }), /proof phase timed out/)
    const localReceipt = JSON.parse(readFileSync(receipt, 'utf8'))
    assert.equal(localReceipt.status, 'failed')
    assert.equal(localReceipt.firewall.equal, false)
    assert.equal(localReceipt.postflight.clean, false)
    assert.equal(localReceipt.firewall.ipv4.diagnostic.counterOnly, true)
    assert.equal(localReceipt.firewall.ipv4.diagnostic.lineDigestTruncated, false)
    assert.deepEqual(localReceipt.postflight.firewall.ipv4.diagnostic, localReceipt.firewall.ipv4.diagnostic)
    assert.equal(localReceipt.firewall.ipv6.diagnostic, null)
    assert.ok(localReceipt.phases.some((phase) => phase.name === 'recovery' && phase.status === 'failed'))
    assert.match(localReceipt.failureReason, /proof phase timed out/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('image postflight accepts timestamp-only firewall equivalence without turning raw flags true', () => {
  const document = (family, timestamp) => Buffer.from([
    `# Generated by ${family} v1.8.9 (nf_tables) on ${timestamp}`,
    '*filter', ':INPUT ACCEPT [0:0]', '-A INPUT -j ACCEPT', 'COMMIT', `# Completed on ${timestamp}`,
  ].join('\n') + '\n', 'ascii')
  const before = document('iptables-save', 'Mon Jun 10 09:18:34 2024')
  const after = document('iptables-save', 'Tue Jun 11 10:19:35 2024')
  const commandRunner = (_file, args) => {
    if (args.includes('-S')) return { status: 1, stdout: '', stderr: '' }
    return { status: 0, stdout: '', stderr: '' }
  }
  const result = inspectPostflight({
    commandRunner,
    cwd: resolve('.'),
    env: {},
    deadlineAt: Date.now() + 10_000,
    firewallBaseline: { bytes: before, sha256: hashBytesForTest(before) },
    firewallAfter: { bytes: after, sha256: hashBytesForTest(after) },
  })
  assert.equal(result.clean, true)
  assert.equal(result.firewall.equal, false)
  assert.equal(result.firewall.byteEqual, false)
  assert.equal(result.firewall.timestampOnlyEquivalent, true)
  assert.equal(result.firewall.equivalent, true)
})

test('bare sudo Docker context is fixed and rejects a root-context escape', () => {
  const calls = []
  const runner = (file, args, options) => {
    calls.push({ file, args, options })
    if (args.includes('context') && args.includes('show')) return { status: 0, stdout: 'default\n', stderr: '' }
    if (args.includes('context') && args.includes('inspect')) return { status: 0, stdout: '"unix:///var/run/docker.sock"\n', stderr: '' }
    if (args.includes('info')) return { status: 0, stdout: JSON.stringify({ DockerRootDir: '/var/lib/hr-axis-onprem-rehearsal/docker' }), stderr: '' }
    return { status: 1, stdout: '', stderr: 'unexpected root docker command' }
  }
  assert.deepEqual(validateDockerRootContext({ commandRunner: runner, cwd: resolve('.'), env: {}, deadlineAt: Date.now() + 10_000 }), {
    context: 'default', endpoint: 'unix:///var/run/docker.sock', dockerRootDir: '/var/lib/hr-axis-onprem-rehearsal/docker',
  })
  assert.deepEqual(calls.map(({ file, args }) => [file, ...args]), [
    ['sudo', '-n', 'docker', 'context', 'show'],
    ['sudo', '-n', 'docker', 'context', 'inspect', 'default', '--format', '{{json .Endpoints.docker.Host}}'],
    ['sudo', '-n', 'docker', 'info', '--format', '{{json .}}'],
  ])
  assert.throws(() => validateDockerRootContext({ commandRunner: (file, args) => args.includes('show') ? { status: 0, stdout: 'remote\n', stderr: '' } : { status: 1, stdout: '', stderr: '' }, cwd: resolve('.'), env: {}, deadlineAt: Date.now() + 10_000 }), /context must be default/)
  assert.throws(() => validateDockerRootContext({ commandRunner: runner, cwd: resolve('.'), env: { DOCKER_CONTEXT: 'remote' }, deadlineAt: Date.now() + 10_000 }), /DOCKER_CONTEXT override/)
})

test('fresh workspace outputs and postflight remain enforced when GITHUB_OUTPUT is invalid', async () => {
  const root = mkdtempSync(join(tmpdir(), 'onprem-postflight-order-'))
  try {
    assert.doesNotThrow(() => assertFreshWorkspaceOutputs(resolve('.')))
    mkdirSync(join(root, 'proof'))
    assert.throws(() => assertFreshWorkspaceOutputs(root), /proof/)
    rmSync(join(root, 'proof'), { recursive: true, force: true })
    const runRoot = join(root, 'run')
    const output = join(root, 'output')
    const receipt = join(root, 'receipt.json')
    const sameSha = hashFile(process.execPath)
    const firewallSha = createHash('sha256').update('same\n').digest('hex')
    let postflightCalled = false
    await assert.rejects(() => runLocalProof({
      'source-sha': sourceSha, 'tree-sha': treeSha, 'run-number': '3', node: process.execPath,
      'node-sha256': sameSha, 'run-root': runRoot, 'proof-output': output, receipt, 'workspace-root': resolve('.'), 'deadline-minutes': '1', 'allow-disposable-daemon-reset': true,
    }, {
      preflight: () => ({ node: { version: 'v24.19.0', sha256: sameSha }, docker: { id: 'docker-id', serverVersion: '29.0.0', operatingSystem: 'linux', architecture: 'amd64' }, firewallBaseline: { sha256: firewallSha } }),
      hostController: {
        acquireHostLock: () => ({ version: 1, pid: 42, uid: 1000, nonce: 'a'.repeat(48), path: '/mock/lock' }),
        inspectDedicatedNativeDockerHost: () => ({ contract: 'native-docker-host-v1', marker: { schema: 'mock', version: 1 }, units: { containerd: 'mock-containerd', dockerd: 'mock-dockerd' }, pids: { containerd: 11, dockerd: 12 }, socket: '/var/run/docker.sock', dockerRootDir: '/mock/docker', inventory: { containers: 0, networks: 0, volumes: 0, images: 0 } }),
        resetDedicatedNativeDockerHost: () => ({ dockerDaemonReset: true }),
        releaseHostLock: () => true,
      },
      commandRunner: (_file, args) => {
        if (args.includes('context') && args.includes('show')) return { status: 0, stdout: 'default\n', stderr: '' }
        if (args.includes('context') && args.includes('inspect')) return { status: 0, stdout: '"unix:///var/run/docker.sock"\n', stderr: '' }
        if (args.includes('info') && args.includes('--format')) return { status: 0, stdout: JSON.stringify({ DockerRootDir: '/var/lib/hr-axis-onprem-rehearsal/docker' }), stderr: '' }
        if (args.some((arg) => arg.endsWith('/iptables-save')) || args.some((arg) => arg.endsWith('/ip6tables-save'))) return { status: 0, stdout: 'same\n', stderr: '' }
        if (args[0] === 'rev-parse' && args[1] === 'HEAD') return { status: 0, stdout: `${sourceSha}\n`, stderr: '' }
        if (args[0] === 'rev-parse' && args[1] === 'HEAD^{tree}') return { status: 0, stdout: `${treeSha}\n`, stderr: '' }
        return { status: 0, stdout: '', stderr: '' }
      },
      executor: async () => ({ status: 'passed', exitCode: 0 }),
      postflight: ({ firewallBaseline, firewallAfter }) => {
        postflightCalled = true
        return { clean: Boolean(firewallBaseline && firewallAfter), resources: {}, firewallChains: {} }
      },
    }), /GITHUB_OUTPUT identity is invalid/)
    assert.equal(postflightCalled, true)
    const localReceipt = JSON.parse(readFileSync(receipt, 'utf8'))
    assert.equal(localReceipt.postflight.firewall.equal, true)
    assert.equal(localReceipt.cleanup.proofOutput, 'absent')
    assert.match(localReceipt.failureReason, /GITHUB_OUTPUT/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('timed-out body receives an independent recovery budget and restores both firewall families', async () => {
  const root = mkdtempSync(join(tmpdir(), 'onprem-recovery-budget-'))
  try {
    const runRoot = join(root, 'run')
    const output = join(root, 'output')
    const receipt = join(root, 'receipt.json')
    const sameSha = hashFile(process.execPath)
    const makeSnapshot = (text) => { const bytes = Buffer.from(text); return { status: 0, bytes, byteLength: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') } }
    const snapshots = { ipv4: makeSnapshot('v4-rules\n'), ipv6: makeSnapshot('v6-rules\n') }
    const inspection = { contract: 'native-docker-host-v1', marker: { schema: 'mock', version: 1 }, units: { containerd: 'mock-containerd', dockerd: 'mock-dockerd' }, pids: { containerd: 11, dockerd: 12 }, socket: '/var/run/docker.sock', dockerRootDir: '/var/lib/hr-axis-onprem-rehearsal/docker', inventory: { containers: 0, networks: 0, volumes: 0, images: 0 } }
    const events = []
    const restoreTimeouts = []
    const cleanupTimeouts = []
    const controller = {
      acquireHostLock: () => ({ version: 1, pid: 42, uid: 1000, nonce: 'a'.repeat(48), path: '/mock/lock' }),
      inspectDedicatedNativeDockerHost: () => inspection,
      resetDedicatedNativeDockerHost: () => { events.push('reset'); return { dockerDaemonReset: true, before: inspection, after: inspection } },
      releaseHostLock: () => {
        events.push('release')
        assert.equal(JSON.parse(readFileSync(receipt, 'utf8')).status, 'failed')
        throw new Error('release failed')
      },
    }
    const commandRunner = (_file, args, options = {}) => {
      if (args.includes('context') && args.includes('show')) return { status: 0, stdout: 'default\n', stderr: '' }
      if (args.includes('context') && args.includes('inspect')) return { status: 0, stdout: '"unix:///var/run/docker.sock"\n', stderr: '' }
      if (args.includes('info') && args.includes('--format')) return { status: 0, stdout: JSON.stringify({ DockerRootDir: '/var/lib/hr-axis-onprem-rehearsal/docker' }), stderr: '' }
      if (args.some((arg) => arg.endsWith('/iptables-save'))) return { status: 0, stdout: snapshots.ipv4.bytes, stderr: '' }
      if (args.some((arg) => arg.endsWith('/ip6tables-save'))) return { status: 0, stdout: snapshots.ipv6.bytes, stderr: '' }
      if (args.some((arg) => arg.endsWith('/iptables-restore'))) { events.push('restore-ipv4'); restoreTimeouts.push(options.timeoutMs); return { status: 0, stdout: '', stderr: '' } }
      if (args.some((arg) => arg.endsWith('/ip6tables-restore'))) { events.push('restore-ipv6'); restoreTimeouts.push(options.timeoutMs); return { status: 0, stdout: '', stderr: '' } }
      if (args[0] === 'rev-parse' && args[1] === 'HEAD') { cleanupTimeouts.push(options.timeoutMs); return { status: 0, stdout: `${sourceSha}\n`, stderr: '' } }
      if (args[0] === 'rev-parse' && args[1] === 'HEAD^{tree}') { cleanupTimeouts.push(options.timeoutMs); return { status: 0, stdout: `${treeSha}\n`, stderr: '' } }
      if (args[0] === 'status') { cleanupTimeouts.push(options.timeoutMs); return { status: 0, stdout: '', stderr: '' } }
      return { status: 0, stdout: '', stderr: '' }
    }
    await assert.rejects(() => runLocalProof({
      'source-sha': sourceSha, 'tree-sha': treeSha, 'run-number': '4', node: process.execPath,
      'node-sha256': sameSha, 'run-root': runRoot, 'proof-output': output, receipt, 'workspace-root': resolve('.'), 'deadline-minutes': '1', 'allow-disposable-daemon-reset': true,
    }, {
      hostController: controller,
      commandRunner,
      preflight: () => ({ node: { version: 'v24.19.0', sha256: sameSha }, docker: { id: 'docker-id', serverVersion: '29.0.0', operatingSystem: 'linux', architecture: 'amd64', rootContext: { context: 'default', endpoint: 'unix:///var/run/docker.sock', dockerRootDir: '/var/lib/hr-axis-onprem-rehearsal/docker' } }, firewallSnapshots: snapshots }),
      executor: async () => ({ status: 'timed-out', timedOut: true, exitCode: null }),
      postflight: () => ({ clean: true, resources: {}, firewallChains: {} }),
    }), /proof phase timed out/)
    const localReceipt = JSON.parse(readFileSync(receipt, 'utf8'))
    assert.equal(localReceipt.status, 'failed')
    assert.equal(localReceipt.recovery.dockerDaemonReset, true)
    assert.equal(localReceipt.firewall.equal, true)
    assert.deepEqual(events.slice(0, 3), ['reset', 'restore-ipv4', 'restore-ipv6'])
    assert.equal(restoreTimeouts.length, 2)
    assert.ok(restoreTimeouts.every((timeout) => timeout > 1_000))
    assert.ok(cleanupTimeouts.length >= 3)
    assert.ok(cleanupTimeouts.every((timeout) => timeout > 1_000))
    assert.equal(events.at(-1), 'release')
    assert.ok(localReceipt.phases.some((phase) => phase.name === 'host-lock-release' && phase.status === 'failed'))
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

function createUploadFixture(root, plan) {
  const proof = join(root, 'proof')
  const runTemp = join(root, 'runner-temp')
  mkdirSync(proof, { recursive: true })
  mkdirSync(runTemp, { recursive: true })
  const names = [
    'backend-content-guard.json', 'frontend-content-guard.json', 'keycloak-content-guard.json',
    'backend-sbom.spdx.json', 'frontend-sbom.spdx.json', 'keycloak-sbom.spdx.json',
    'backend-trivy.json', 'frontend-trivy.json', 'keycloak-trivy.json',
    'backend-license-inventory.json', 'frontend-license-inventory.json', 'keycloak-license-inventory.json',
    'backend-image-license-reconciliation.json', 'frontend-image-license-reconciliation.json',
    'backend-THIRD_PARTY_NOTICES.txt', 'frontend-THIRD_PARTY_NOTICES.txt',
    'keycloak-image-manifest.json', 'keycloak-LICENSE.txt', 'keycloak-license-paths.txt',
    'keycloak-license-reconciliation.json', 'keycloak-license-evidence.tar',
    'backend-image.tar', 'frontend-image.tar', 'keycloak-image.tar', 'base-license-evidence.tar',
    'release-manifest.json', 'onprem-proof-receipt.json', 'content-guard-index.json',
    'content-guard-index-public.pem', 'ephemeral-public.pem',
  ]
  for (const name of names) writeFileSync(join(proof, name), name === 'release-manifest.json'
    ? JSON.stringify({ dataClass: 'synthetic', sourceRevision: sourceSha, imageIds: { backend: `sha256:${'1'.repeat(64)}`, frontend: `sha256:${'2'.repeat(64)}`, keycloak: `sha256:${'3'.repeat(64)}` } })
    : name === 'content-guard-index-public.pem' || name === 'ephemeral-public.pem' ? '-----BEGIN PUBLIC KEY-----\n-----END PUBLIC KEY-----\n' : '{}\n')
  mkdirSync(join(proof, 'base-license-evidence'))
  writeFileSync(join(proof, 'base-license-evidence', 'evidence.txt'), 'evidence\n')
  const releaseHash = hashFile(join(proof, 'release-manifest.json'))
  writeFileSync(join(proof, 'onprem-proof-receipt.json'), JSON.stringify({ proofMode: 'full', imageScope: 'both', expectedSha: sourceSha, evidenceSha: releaseHash, dataClass: 'synthetic' }))
  for (const [path, content] of [
    ['onprem-core-runtime-receipt.json', '{}'], ['onprem-keycloak-runtime-receipt.json', '{}'],
    ['onprem-photo-storage-runtime-receipt.json', '{}'],
  ]) writeFileSync(join(runTemp, path), content)
  for (const [path, content] of [
    ['photo-storage-sbom.spdx.json', '{}'], ['photo-storage-trivy.json', '{}'],
    ['photo-storage-license-receipt.json', '{}'],
  ]) writeFileSync(join(proof, path), content)
  return { workspaceRoot: root, runTemp, uploads: plan.uploads }
}

test('artifact collector copies only the four exact groups and rejects unsafe selections', () => {
  const root = mkdtempSync(join(tmpdir(), 'onprem-artifact-contract-'))
  try {
    const plan = extractFullProofPlan(workflow)
    const fixture = createUploadFixture(root, plan)
    const output = join(root, 'output')
    const collected = collectUploadArtifacts({ ...fixture, outputRoot: output, expectedSha: sourceSha })
    assert.ok(existsSync(join(output, 'onprem-image-proof', 'release-manifest.json')))
    assert.ok(existsSync(join(output, 'onprem-core-runtime-proof', 'onprem-core-runtime-receipt.json')))
    assert.ok(existsSync(collected.manifestPath))
    const unsafe = { ...fixture, uploads: fixture.uploads.map((upload) => ({ ...upload, paths: [...upload.paths] })) }
    unsafe.uploads.at(-1).paths = ['proof/secret.txt']
    writeFileSync(join(root, 'proof', 'secret.txt'), 'secret')
    assert.throws(() => collectUploadArtifacts({ ...unsafe, outputRoot: join(root, 'unsafe-output'), expectedSha: sourceSha }), /upload contract changed/)
    const symlink = join(root, 'proof', 'frontend-content-guard.json')
    try {
      rmSync(symlink)
      symlinkSync(join(root, 'proof', 'backend-content-guard.json'), symlink)
      assert.throws(() => collectUploadArtifacts({ ...fixture, outputRoot: join(root, 'symlink-output'), expectedSha: sourceSha }), /symlink/)
    } catch (error) {
      if (!String(error?.code ?? '').includes('EPERM')) throw error
    }
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('artifact collector rejects sensitive selected paths while allowing public-key evidence', () => {
  const root = mkdtempSync(join(tmpdir(), 'onprem-sensitive-artifact-contract-'))
  try {
    const plan = extractFullProofPlan(workflow)
    const fixture = createUploadFixture(root, plan)
    const baseline = collectUploadArtifacts({ ...fixture, outputRoot: join(root, 'baseline-output'), expectedSha: sourceSha })
    assert.ok(baseline.manifest.artifacts.some((artifact) => artifact.path.endsWith('content-guard-index-public.pem')))
    writeFileSync(join(root, 'proof', 'backend-token-content-guard.json'), '{}\n')
    assert.throws(() => collectUploadArtifacts({ ...fixture, outputRoot: join(root, 'sensitive-output'), expectedSha: sourceSha }), /unsafe path/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('artifact collector permits the known photo-storage cross-group selections', () => {
  const root = mkdtempSync(join(tmpdir(), 'onprem-cross-group-artifact-contract-'))
  try {
    const plan = extractFullProofPlan(workflow)
    const fixture = createUploadFixture(root, plan)
    const collected = collectUploadArtifacts({ ...fixture, outputRoot: join(root, 'output'), expectedSha: sourceSha })
    const imageGroup = collected.groups.find((group) => group.name === `onprem-image-proof-${sourceSha}`)
    const photoGroup = collected.groups.find((group) => group.name === `onprem-photo-storage-proof-${sourceSha}`)
    assert.ok(imageGroup.files > 0)
    assert.equal(photoGroup.files, 4)
    assert.ok(existsSync(join(root, 'output', 'onprem-image-proof', 'photo-storage-sbom.spdx.json')))
    assert.ok(existsSync(join(root, 'output', 'onprem-photo-storage-proof', 'photo-storage-sbom.spdx.json')))
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('runner source has no duplicated Docker/firewall operator mutations', () => {
  const source = readFileSync('./scripts/onprem-image-local-proof.mjs', 'utf8')
  assert.doesNotMatch(source, /docker\s+(?:run|build|pull|rm|compose\s+(?:up|down))/)
  assert.doesNotMatch(source, /iptables(?:6)?\s+-[FAI]\b/)
  assert.match(source, /docker', \['info'/)
  assert.match(source, /spawn\('bash'/)
  assert.match(source, /detached:\s*true/)
  assert.doesNotMatch(source, /setsid\s+--wait/)
  assert.match(source, /processApi\.kill\(-pgid/)
  assert.match(source, /SIGKILL/)
  assert.match(source, /waitForProcessGroupAbsence/)
})
