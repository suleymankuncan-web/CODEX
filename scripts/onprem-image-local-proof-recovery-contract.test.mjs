import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { test } from 'node:test'

import {
  analyzeFirewallMismatch,
  acquireVerifiedHost,
  captureFirewallSnapshots,
  cleanupFreshWorkspace,
  FIREWALL_COMMAND_CAP_MS,
  FIREWALL_DIAGNOSTIC_LINE_CAP,
  FIREWALL_RECOVERY_RESERVE_MS,
  recoverDedicatedHost,
  RECOVERY_COMMAND_BINARIES,
  RECOVERY_COMMAND_ENV,
  removePartialProofOutput,
  restoreFirewallSnapshots,
} from './onprem-image-local-proof-recovery.mjs'
import { runLocalProof } from './onprem-image-local-proof.mjs'

const sourceSha = 'a'.repeat(40)
const treeSha = 'b'.repeat(40)

function snapshot(text) {
  return { status: 0, text, sha256: createHash('sha256').update(text).digest('hex') }
}

function hostFixture(events, { resetError = null, seen = null } = {}) {
  const inspection = {
    contract: 'native-docker-host-v1',
    marker: { schema: 'mock-native-host', version: 1 },
    units: { containerd: 'containerd.service', dockerd: 'dockerd.service' },
    pids: { containerd: 11, dockerd: 12 },
    socket: '/var/run/docker.sock',
    dockerRootDir: '/var/lib/hr-axis-onprem-rehearsal/docker',
    inventory: { containers: 0, networks: 0, volumes: 0, images: 0 },
  }
  return {
    acquireHostLock: () => { events.push('lock-acquire'); return { version: 1, pid: 42, uid: 1000, nonce: 'a'.repeat(48), path: '/mock/lock' } },
    inspectDedicatedNativeDockerHost: () => { events.push('host-inspect'); return inspection },
    resetDedicatedNativeDockerHost: (options = {}) => { if (seen) seen.resetOptions = options; events.push('daemon-reset'); if (resetError) throw new Error(resetError); return { dockerDaemonReset: true, before: inspection, after: inspection } },
    releaseHostLock: () => { events.push('lock-release'); return true },
  }
}

function firewallRunner(events, { ipv4 = 'v4-rules\n', ipv6 = 'v6-rules\n', postIpv4 = ipv4, postIpv6 = ipv6, restoreStatus = 0 } = {}) {
  const restored = { ipv4: false, ipv6: false }
  return (_file, args, options = {}) => {
    if (args.includes('context') && args.includes('show')) return { status: 0, stdout: 'default\n', stderr: '' }
    if (args.includes('context') && args.includes('inspect')) return { status: 0, stdout: '"unix:///var/run/docker.sock"\n', stderr: '' }
    if (args.includes('info') && args.includes('--format')) return { status: 0, stdout: JSON.stringify({ DockerRootDir: '/var/lib/hr-axis-onprem-rehearsal/docker' }), stderr: '' }
    if (args.some((arg) => arg.endsWith('/iptables-save'))) { events.push('save-ipv4'); assert.equal(_file, '/usr/bin/sudo'); assert.deepEqual(options.env, { LANG: 'C', LC_ALL: 'C', PATH: '/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin' }); return { status: 0, stdout: restored.ipv4 ? postIpv4 : ipv4, stderr: '' } }
    if (args.some((arg) => arg.endsWith('/ip6tables-save'))) { events.push('save-ipv6'); assert.equal(_file, '/usr/bin/sudo'); assert.deepEqual(options.env, { LANG: 'C', LC_ALL: 'C', PATH: '/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin' }); return { status: 0, stdout: restored.ipv6 ? postIpv6 : ipv6, stderr: '' } }
    if (args.some((arg) => arg.endsWith('/iptables-restore'))) { events.push('restore-ipv4'); restored.ipv4 = true; assert.equal(_file, '/usr/bin/sudo'); assert.equal(options.input, ipv4); assert.ok(args.includes('--counters')); assert.ok(options.timeoutMs <= FIREWALL_COMMAND_CAP_MS); assert.deepEqual(options.env, { LANG: 'C', LC_ALL: 'C', PATH: '/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin' }); return { status: restoreStatus, stdout: '', stderr: '' } }
    if (args.some((arg) => arg.endsWith('/ip6tables-restore'))) { events.push('restore-ipv6'); restored.ipv6 = true; assert.equal(_file, '/usr/bin/sudo'); assert.equal(options.input, ipv6); assert.ok(args.includes('--counters')); assert.deepEqual(options.env, { LANG: 'C', LC_ALL: 'C', PATH: '/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin' }); return { status: restoreStatus, stdout: '', stderr: '' } }
    return { status: 0, stdout: '', stderr: '' }
  }
}

test('firewall lifecycle captures and restores complete IPv4/IPv6 bytes in order', () => {
  assert.deepEqual(RECOVERY_COMMAND_BINARIES, { sudo: '/usr/bin/sudo', rm: '/usr/bin/rm' })
  assert.deepEqual(RECOVERY_COMMAND_ENV, { LANG: 'C', LC_ALL: 'C', PATH: '/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin' })
  const events = []
  const commandRunner = firewallRunner(events)
  const snapshots = captureFirewallSnapshots({ commandRunner, cwd: resolve('.'), env: {}, deadlineAt: Date.now() + 10_000 })
  const restored = restoreFirewallSnapshots({ snapshots, commandRunner, cwd: resolve('.'), env: {}, deadlineAt: Date.now() + 10_000 })
  assert.deepEqual(events, ['save-ipv4', 'save-ipv6', 'restore-ipv4', 'restore-ipv6', 'save-ipv4', 'save-ipv6'])
  assert.equal(restored.outcome.equal, true)
  assert.equal(restored.outcome.ipv4.byteEqual, true)
  assert.equal(restored.outcome.ipv6.byteEqual, true)
  assert.equal(restored.outcome.ipv4.diagnostic, null)
  assert.equal(restored.outcome.ipv6.diagnostic, null)
})

test('raw mismatch diagnostics stay sanitized and classify only counter-token drift', () => {
  const before = '*table\n:CHAIN ACCEPT [1:2]\n-A CHAIN -c 3 4 -j ACCEPT\nCOMMIT\n'
  const after = '*table\n:CHAIN ACCEPT [11:22]\n-A CHAIN -c 33 44 -j ACCEPT\nCOMMIT\n'
  const events = []
  const commandRunner = firewallRunner(events, { ipv4: before, postIpv4: after })
  const snapshots = captureFirewallSnapshots({ commandRunner, cwd: resolve('.'), deadlineAt: Date.now() + 10_000 })
  const restored = restoreFirewallSnapshots({ snapshots, commandRunner, cwd: resolve('.'), deadlineAt: Date.now() + 10_000 })
  const diagnostic = restored.outcome.ipv4.diagnostic

  assert.equal(restored.outcome.equal, false)
  assert.equal(restored.outcome.ipv4.byteEqual, false)
  assert.equal(restored.outcome.ipv4.preSha256, snapshots.ipv4.sha256)
  assert.notEqual(restored.outcome.ipv4.postSha256, snapshots.ipv4.sha256)
  assert.equal(diagnostic.counterOnly, true)
  assert.equal(diagnostic.lineDigestTruncated, false)
  assert.equal(diagnostic.preByteLength, Buffer.byteLength(before))
  assert.equal(diagnostic.postByteLength, Buffer.byteLength(after))
  assert.equal(diagnostic.preSha256, createHash('sha256').update(before).digest('hex'))
  assert.equal(diagnostic.postSha256, createHash('sha256').update(after).digest('hex'))
  assert.equal(typeof diagnostic.firstDifferingByteOffset, 'number')
  assert.equal(diagnostic.preLines.length, 5)
  assert.equal(diagnostic.postLines.length, 5)
  assert.equal(diagnostic.preLines[1].byteLength, Buffer.byteLength(':CHAIN ACCEPT [1:2]'))
  assert.equal(Object.isFrozen(diagnostic), true)
  assert.equal(Object.isFrozen(diagnostic.preLines), true)
  const diagnosticText = JSON.stringify(diagnostic)
  for (const raw of ['*table', ':CHAIN ACCEPT [1:2]', '-A CHAIN -c 3 4 -j ACCEPT', 'COMMIT']) assert.equal(diagnosticText.includes(raw), false)
})

test('firewall mismatch diagnostics preserve Buffer bytes and fail closed for non-text output', () => {
  const before = Buffer.from('*table\n:CHAIN ACCEPT [1:2]\n-A CHAIN -c 3 4 -j ACCEPT\nCOMMIT\n', 'ascii')
  const after = Buffer.from('*table\n:CHAIN ACCEPT [11:22]\n-A CHAIN -c 33 44 -j ACCEPT\nCOMMIT\n', 'ascii')
  const diagnostic = analyzeFirewallMismatch(before, after)

  assert.equal(diagnostic.counterOnly, true)
  assert.equal(diagnostic.preSha256, createHash('sha256').update(before).digest('hex'))
  assert.equal(diagnostic.postSha256, createHash('sha256').update(after).digest('hex'))
  assert.equal(diagnostic.firstDifferingByteOffset, before.findIndex((value, index) => value !== after[index]))

  const nonText = analyzeFirewallMismatch(Buffer.from([0xff, 0x0a]), Buffer.from([0xfe, 0x0a]))
  assert.equal(nonText.counterOnly, false)
  assert.equal(nonText.lineDigestTruncated, false)
  assert.equal(nonText.preSha256, createHash('sha256').update(Buffer.from([0xff, 0x0a])).digest('hex'))
  assert.equal(nonText.firstDifferingByteOffset, 0)
})

test('firewall mismatch digest evidence stops at the fixed cap and fails closed for overflow', () => {
  const lineCount = FIREWALL_DIAGNOSTIC_LINE_CAP + 1
  const before = Array.from({ length: lineCount }, (_, index) => `:CHAIN ACCEPT [${index}:${index}]`).join('\n')
  const after = Array.from({ length: lineCount }, (_, index) => `:CHAIN ACCEPT [${index + 1}:${index + 1}]`).join('\n')
  const diagnostic = analyzeFirewallMismatch(before, after)

  assert.equal(diagnostic.preLines.length, FIREWALL_DIAGNOSTIC_LINE_CAP)
  assert.equal(diagnostic.postLines.length, FIREWALL_DIAGNOSTIC_LINE_CAP)
  assert.equal(diagnostic.lineDigestTruncated, true)
  assert.equal(diagnostic.counterOnly, false)
  assert.equal(diagnostic.preSha256, createHash('sha256').update(before).digest('hex'))
  assert.equal(diagnostic.postSha256, createHash('sha256').update(after).digest('hex'))
  assert.equal(diagnostic.firstDifferingByteOffset, before.indexOf('0:0'))
  assert.doesNotMatch(JSON.stringify(diagnostic), /CHAIN|ACCEPT|\[[0-9]+:[0-9]+\]/)
})

test('counter-only classifier fails closed for non-counter, ordering, line-count, and malformed drift', () => {
  const before = '*table\n:CHAIN ACCEPT [1:2]\n-A CHAIN -c 3 4 -j ACCEPT\n-A CHAIN -c 5 6 -j DROP\nCOMMIT\n'
  const cases = [
    ['rule target', before.replace('-j ACCEPT', '-j REJECT')],
    ['policy', before.replace(':CHAIN ACCEPT [1:2]', ':CHAIN DROP [11:22]')],
    ['order', before.replace('-A CHAIN -c 3 4 -j ACCEPT\n-A CHAIN -c 5 6 -j DROP', '-A CHAIN -c 5 6 -j DROP\n-A CHAIN -c 3 4 -j ACCEPT')],
    ['timestamp', before.replace('*table', '# generated-at=synthetic-a').replace('# generated-at=synthetic-a', '# generated-at=synthetic-b')],
    ['malformed counter', before.replace('-c 3 4', '-c malformed 4')],
    ['extra line', `${before}# extra-synthetic-line\n`],
    ['whitespace', before.replace('-c 3 4', '  -c 33 44')],
  ]

  for (const [label, after] of cases) {
    const events = []
    const commandRunner = firewallRunner(events, { ipv4: before, postIpv4: after })
    const snapshots = captureFirewallSnapshots({ commandRunner, cwd: resolve('.'), deadlineAt: Date.now() + 10_000 })
    const restored = restoreFirewallSnapshots({ snapshots, commandRunner, cwd: resolve('.'), deadlineAt: Date.now() + 10_000 })
    assert.equal(restored.outcome.equal, false, label)
    assert.equal(restored.outcome.ipv4.byteEqual, false, label)
    assert.equal(restored.outcome.ipv4.diagnostic.counterOnly, false, label)
  }
})

test('daemon reset is attempted before both firewall restores even when reset fails', () => {
  const events = []
  const commandRunner = firewallRunner(events)
  const snapshots = captureFirewallSnapshots({ commandRunner, cwd: resolve('.'), env: {}, deadlineAt: Date.now() + 10_000 })
  events.length = 0
  const seen = {}
  const recoveryStarted = Date.now()
  const recoveryDeadlineAt = recoveryStarted + 300_000
  const recovery = recoverDedicatedHost({
    lock: { path: '/mock/lock', version: 1, pid: 42, uid: 1000, nonce: 'a'.repeat(48) },
    inspectionBefore: hostFixture([], {}).inspectDedicatedNativeDockerHost(),
    hostController: hostFixture(events, { resetError: 'password=supersecret /tmp/reset-path', seen }),
    commandRunner,
    hostOptions: {},
    cwd: resolve('.'),
    env: {},
    snapshots,
    deadlineAt: Date.now() + 10_000,
    recoveryDeadlineAt,
    allowDisposableDaemonReset: true,
  })
  assert.deepEqual(events, ['daemon-reset', 'restore-ipv4', 'restore-ipv6', 'save-ipv4', 'save-ipv6', 'host-inspect'])
  assert.equal(recovery.dockerDaemonReset, false)
  assert.equal(recovery.firewall.equal, true)
  assert.ok(recovery.failures.length > 0)
  assert.ok(!JSON.stringify(recovery).includes('supersecret'))
  assert.ok(!JSON.stringify(recovery).includes('/tmp/reset-path'))
  assert.ok(seen.resetOptions.recoveryDeadlineAt <= recoveryDeadlineAt - FIREWALL_RECOVERY_RESERVE_MS)
  assert.ok(seen.resetOptions.recoveryDeadlineAt >= recoveryStarted)
  assert.equal(recovery.firewallBudgetMs, FIREWALL_RECOVERY_RESERVE_MS)
  assert.ok(recovery.resetBudgetMs <= recoveryDeadlineAt - recoveryStarted - FIREWALL_RECOVERY_RESERVE_MS)
  assert.ok(recovery.resetBudgetMs > recoveryDeadlineAt - recoveryStarted - FIREWALL_RECOVERY_RESERVE_MS - 1_000)
})

test('successful daemon reset does not relax raw firewall equality after counter-only drift', () => {
  const before = '*table\n:CHAIN ACCEPT [1:2]\n-A CHAIN -c 3 4 -j ACCEPT\nCOMMIT\n'
  const after = '*table\n:CHAIN ACCEPT [11:22]\n-A CHAIN -c 33 44 -j ACCEPT\nCOMMIT\n'
  const events = []
  const commandRunner = firewallRunner(events, { ipv4: before, postIpv4: after })
  const snapshots = captureFirewallSnapshots({ commandRunner, cwd: resolve('.'), deadlineAt: Date.now() + 10_000 })
  events.length = 0
  const recovery = recoverDedicatedHost({
    lock: { path: '/mock/lock', version: 1, pid: 42, uid: 1000, nonce: 'a'.repeat(48) },
    inspectionBefore: hostFixture([], {}).inspectDedicatedNativeDockerHost(),
    hostController: hostFixture(events),
    commandRunner,
    cwd: resolve('.'),
    env: {},
    snapshots,
    deadlineAt: Date.now() + 10_000,
    recoveryDeadlineAt: Date.now() + 300_000,
    allowDisposableDaemonReset: true,
  })

  assert.equal(recovery.dockerDaemonReset, true)
  assert.ok(recovery.hostAfter)
  assert.equal(recovery.firewall.equal, false)
  assert.equal(recovery.firewall.ipv4.byteEqual, false)
  assert.equal(recovery.firewall.ipv4.diagnostic.counterOnly, true)
  assert.ok(recovery.failures.includes('ipv4 firewall bytes differ after restore'))
  assert.deepEqual(events, ['daemon-reset', 'restore-ipv4', 'restore-ipv6', 'save-ipv4', 'save-ipv6', 'host-inspect'])
})

test('recovery refuses daemon reset without the explicit disposable reset opt-in', () => {
  const events = []
  const commandRunner = firewallRunner(events)
  const snapshots = captureFirewallSnapshots({ commandRunner, cwd: resolve('.'), env: {}, deadlineAt: Date.now() + 10_000 })
  events.length = 0
  const recovery = recoverDedicatedHost({
    lock: { path: '/mock/lock', version: 1, pid: 42, uid: 1000, nonce: 'a'.repeat(48) },
    inspectionBefore: hostFixture([], {}).inspectDedicatedNativeDockerHost(),
    hostController: hostFixture(events),
    commandRunner,
    cwd: resolve('.'),
    env: {},
    snapshots,
    deadlineAt: Date.now() + 10_000,
    allowDisposableDaemonReset: false,
  })
  assert.equal(events.includes('daemon-reset'), false)
  assert.equal(recovery.dockerDaemonReset, false)
  assert.match(recovery.failures.join(' '), /opt-in/)
  assert.equal(recovery.firewall.equal, true)
})

test('verified host lock remains held until caller release and rejects non-empty preflight inventory', () => {
  const events = []
  const controller = hostFixture(events)
  const held = acquireVerifiedHost({ hostController: controller, commandRunner: () => ({ status: 0, stdout: '', stderr: '' }), hostOptions: {} })
  assert.deepEqual(events, ['lock-acquire', 'host-inspect'])
  held.controller.releaseHostLock(held.lock, {})
  assert.deepEqual(events, ['lock-acquire', 'host-inspect', 'lock-release'])
  const nonEmpty = { ...controller, inspectDedicatedNativeDockerHost: () => ({ inventory: { containers: 1, networks: 0, volumes: 0, images: 0 } }) }
  assert.throws(() => acquireVerifiedHost({ hostController: nonEmpty, commandRunner: () => ({ status: 0, stdout: '', stderr: '' }), hostOptions: {} }), /inventory is not empty/)
})

test('native host controller receives no generic runner by default and only receives an explicit injected runner', () => {
  const inspection = hostFixture([], {}).inspectDedicatedNativeDockerHost()
  const lock = { path: '/mock/lock', version: 1, pid: 42, uid: 1000, nonce: 'a'.repeat(48) }
  const seen = { acquire: [], inspect: [], reset: [], release: [] }
  const controller = {
    acquireHostLock: (options) => { seen.acquire.push(options); return lock },
    inspectDedicatedNativeDockerHost: (options) => { seen.inspect.push(options); return inspection },
    resetDedicatedNativeDockerHost: (options) => { seen.reset.push(options); return { dockerDaemonReset: true, before: inspection, after: inspection } },
    releaseHostLock: (_token, options) => { seen.release.push(options); return true },
  }
  const defaultHeld = acquireVerifiedHost({ hostController: controller, hostOptions: { marker: 'default' } })
  assert.equal('commandRunner' in seen.acquire[0], false)
  assert.equal('commandRunner' in seen.inspect[0], false)
  defaultHeld.controller.releaseHostLock(defaultHeld.lock, { marker: 'default' })
  assert.equal('commandRunner' in seen.release[0], false)

  const injected = () => ({ status: 0, stdout: '', stderr: '' })
  const injectedHeld = acquireVerifiedHost({ hostController: controller, commandRunner: injected, hostOptions: { marker: 'injected' } })
  assert.equal(seen.acquire.at(-1).commandRunner, injected)
  assert.equal(seen.inspect.at(-1).commandRunner, injected)
  const snapshots = { ipv4: snapshot('v4-rules\n'), ipv6: snapshot('v6-rules\n') }
  const recovery = recoverDedicatedHost({
    lock: injectedHeld.lock,
    inspectionBefore: injectedHeld.inspection,
    hostController: controller,
    hostCommandRunner: injected,
    commandRunner: firewallRunner([]),
    cwd: resolve('.'),
    env: {},
    snapshots,
    deadlineAt: Date.now() + 10_000,
    allowDisposableDaemonReset: true,
  })
  assert.equal(recovery.dockerDaemonReset, true)
  assert.equal(seen.reset.at(-1).commandRunner, injected)
  assert.equal(seen.inspect.at(-1).commandRunner, injected)
})

test('cleanup removes a safe nonempty proof tree with child directories', () => {
  const root = mkdtempSync(join(tmpdir(), 'onprem-recovery-proof-tree-'))
  try {
    const workspace = join(root, 'workspace')
    const runRoot = join(root, 'run')
    const proof = join(workspace, 'proof')
    mkdirSync(join(proof, 'nested', 'child'), { recursive: true })
    writeFileSync(join(proof, 'nested', 'child', 'evidence.txt'), 'synthetic evidence\n')
    mkdirSync(runRoot, { recursive: true })
    const cleaned = cleanupFreshWorkspace({
      workspaceRoot: workspace,
      runRoot,
      sourceSha,
      treeSha,
      commandRunner: () => ({ status: 0, stdout: '', stderr: '' }),
      env: {},
      deadlineAt: Date.now() + 10_000,
      includeWorkspaceGenerated: true,
      reproveGit: false,
    })
    assert.equal(cleaned.status, 'passed')
    assert.equal(cleaned.generated.proof, 'removed')
    assert.equal(existsSync(proof), false)
    assert.equal(existsSync(runRoot), false)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('cleanup fails closed on unsafe generated roots and removes only an external partial output', () => {
  const root = mkdtempSync(join(tmpdir(), 'onprem-recovery-cleanup-'))
  try {
    const runRoot = join(root, 'run')
    mkdirSync(runRoot, { recursive: true })
    const workspace = join(root, 'workspace')
    mkdirSync(join(workspace, 'infra/onprem/core'), { recursive: true })
    const outside = join(root, 'outside')
    mkdirSync(outside)
    const unsafeProof = join(workspace, 'proof')
    try { symlinkSync(outside, unsafeProof) } catch (error) {
      if (error?.code !== 'EPERM') throw error
      writeFileSync(unsafeProof, 'unsafe')
    }
    const failed = cleanupFreshWorkspace({ workspaceRoot: workspace, runRoot, sourceSha, treeSha, commandRunner: () => ({ status: 0, stdout: '', stderr: '' }), env: {}, deadlineAt: Date.now() + 10_000, includeWorkspaceGenerated: true, reproveGit: false })
    assert.equal(failed.status, 'failed')
    assert.equal(existsSync(outside), true)
    rmSync(unsafeProof, { force: true })
    const proofOutput = join(root, 'proof-output')
    mkdirSync(proofOutput)
    writeFileSync(join(proofOutput, 'partial.txt'), 'partial')
    assert.equal(removePartialProofOutput({ proofOutput, workspaceRoot: workspace, runRoot: join(root, 'other-run'), commandRunner: () => ({ status: 0, stdout: '', stderr: '' }), env: {}, deadlineAt: Date.now() + 10_000 }), 'removed')
    assert.equal(existsSync(proofOutput), false)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('run-root cleanup permits only the checked fresh root sudo fallback and refuses unsafe roots', () => {
  const root = mkdtempSync(join(tmpdir(), 'onprem-recovery-runroot-'))
  try {
    const workspace = join(root, 'workspace')
    mkdirSync(workspace, { recursive: true })
    const runRoot = join(root, 'run')
    mkdirSync(join(runRoot, 'runner-temp'), { recursive: true })
    writeFileSync(join(runRoot, 'runner-temp', 'root-owned-child'), 'temporary')
    const events = []
    const removePath = (target, options) => {
      if (resolve(target) === resolve(runRoot)) {
        events.push('direct-run-root-failed')
        const error = new Error('EPERM')
        error.code = 'EPERM'
        throw error
      }
      return rmSync(target, options)
    }
    const commandRunner = (_file, args, options = {}) => {
      if (args.some((arg) => arg.endsWith('/rm'))) {
        events.push('sudo-run-root')
        assert.equal(_file, '/usr/bin/sudo')
        assert.deepEqual(options.env, { LANG: 'C', LC_ALL: 'C', PATH: '/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin' })
        rmSync(runRoot, { recursive: true, force: true })
      }
      return { status: 0, stdout: '', stderr: '' }
    }
    const cleaned = cleanupFreshWorkspace({ workspaceRoot: workspace, runRoot, sourceSha, treeSha, commandRunner, env: {}, deadlineAt: Date.now() + 10_000, includeWorkspaceGenerated: false, reproveGit: false, removePath })
    assert.equal(cleaned.status, 'passed')
    assert.deepEqual(events, ['direct-run-root-failed', 'sudo-run-root'])
    assert.equal(existsSync(runRoot), false)

    const outside = join(root, 'outside')
    mkdirSync(outside)
    const unsafeRunRoot = join(root, 'unsafe-run')
    try { symlinkSync(outside, unsafeRunRoot) } catch (error) {
      if (error?.code !== 'EPERM') throw error
      writeFileSync(unsafeRunRoot, 'unsafe')
    }
    const refused = cleanupFreshWorkspace({ workspaceRoot: workspace, runRoot: unsafeRunRoot, sourceSha, treeSha, commandRunner, env: {}, deadlineAt: Date.now() + 10_000, includeWorkspaceGenerated: false, reproveGit: false, removePath })
    assert.equal(refused.status, 'failed')
    assert.equal(existsSync(outside), true)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('runner receipt keeps recovery state sanitized after failed output and daemon reset', async () => {
  const root = mkdtempSync(join(tmpdir(), 'onprem-recovery-receipt-'))
  try {
    const runRoot = join(root, 'run')
    const proofOutput = join(root, 'proof-output')
    const receipt = join(root, 'receipt.json')
    const nodeSha256 = createHash('sha256').update(readFileSync(process.execPath)).digest('hex')
    const events = []
    const baseController = hostFixture(events, { resetError: 'password=supersecret /tmp/secret-reset-path' })
    const controller = {
      ...baseController,
      releaseHostLock: (lock, options) => {
        assert.equal(JSON.parse(readFileSync(receipt, 'utf8')).status, 'failed')
        events.push('receipt-before-release')
        return baseController.releaseHostLock(lock, options)
      },
    }
    const snapshots = { ipv4: snapshot('v4-rules\n'), ipv6: snapshot('v6-rules\n') }
    const commandRunner = firewallRunner(events)
    await assert.rejects(() => runLocalProof({
      'source-sha': sourceSha,
      'tree-sha': treeSha,
      'run-number': '5',
      node: process.execPath,
      'node-sha256': nodeSha256,
      'run-root': runRoot,
      'proof-output': proofOutput,
      receipt,
      'workspace-root': resolve('.'),
      'deadline-minutes': '1',
      'allow-disposable-daemon-reset': true,
    }, {
      hostController: controller,
      commandRunner,
      preflight: () => ({ node: { version: 'v24.19.0', sha256: nodeSha256 }, docker: { id: 'mock', serverVersion: '29.0.0', operatingSystem: 'linux', architecture: 'amd64' }, firewallSnapshots: snapshots }),
      executor: async () => ({ status: 'passed', exitCode: 0 }),
      postflight: () => ({ clean: true, resources: {}, firewallChains: {} }),
    }), /GITHUB_OUTPUT identity is invalid/)
    const receiptText = readFileSync(receipt, 'utf8')
    assert.equal(receiptText.includes('supersecret'), false)
    assert.equal(receiptText.includes('secret-reset-path'), false)
    assert.equal(receiptText.includes('v4-rules'), false)
    assert.equal(receiptText.includes('v6-rules'), false)
    assert.equal(JSON.parse(receiptText).dockerDaemonReset, false)
    assert.equal(JSON.parse(receiptText).firewall.equal, true)
    assert.ok(events.indexOf('receipt-before-release') >= 0)
    assert.ok(events.indexOf('receipt-before-release') < events.indexOf('lock-release'))
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})
