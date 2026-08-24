import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'

import {
  helpText,
  parseSingleSessionArguments,
  runSingleSession,
  validateSingleSessionOptions,
} from './onprem-native-full-offline-rehearsal.mjs'

const checkoutRoot = fs.realpathSync(path.resolve('.'))
const sourceSha = 'a'.repeat(40)
const treeSha = 'b'.repeat(40)
const nodeSha256 = 'c'.repeat(64)

function temporaryDirectory() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'native-full-offline-contract-'))
  fs.chmodSync(directory, 0o700)
  return directory
}

function linuxFsApi() {
  return {
    ...fs,
    lstatSync(target) {
      const stats = fs.lstatSync(target)
      return {
        isDirectory: stats.isDirectory.bind(stats),
        isSymbolicLink: stats.isSymbolicLink.bind(stats),
        mode: stats.isDirectory() ? 0o40700 : stats.mode,
        uid: 1000,
      }
    },
  }
}

function fixture() {
  const directory = temporaryDirectory()
  const sessionRoot = emptySessionRoot(directory, 'session')
  const raw = {
    confirmDisposableNativeHost: true,
    allowDisposableDaemonReset: true,
    sourceSha,
    treeSha,
    runNumber: '71',
    runId: '72',
    runAttempt: '2',
    node: path.join(directory, 'node'),
    nodeSha256,
    sessionRoot,
    workspaceRoot: checkoutRoot,
    nativeDeadlineMinutes: '12',
    packageDeadlineMinutes: '13',
  }
  const dependencies = { platform: 'linux', uid: 1000, arch: 'x64', env: {}, fsApi: linuxFsApi(), writePackageCheckpoint: () => {} }
  return { directory, sessionRoot, raw, dependencies }
}

function emptySessionRoot(directory, name) {
  const sessionRoot = path.join(directory, name)
  fs.mkdirSync(sessionRoot, { mode: 0o700 })
  fs.chmodSync(sessionRoot, 0o700)
  return sessionRoot
}

function argv(raw) {
  return [
    '--confirm-disposable-native-host', '--allow-disposable-daemon-reset',
    '--source-sha', raw.sourceSha, '--tree-sha', raw.treeSha,
    '--run-number', raw.runNumber, '--run-id', raw.runId, '--run-attempt', raw.runAttempt,
    '--node', raw.node, '--node-sha256', raw.nodeSha256, '--session-root', raw.sessionRoot,
    '--workspace-root', raw.workspaceRoot,
    '--native-deadline-minutes', raw.nativeDeadlineMinutes,
    '--package-deadline-minutes', raw.packageDeadlineMinutes,
  ]
}

function handoff(options) {
  const releaseId = 'onprem-offline-72'
  const manifestSha256 = 'd'.repeat(64)
  const keyFingerprint = 'e'.repeat(64)
  const bootstrapSha256 = 'f'.repeat(64)
  return {
    status: 'passed',
    receipt: options.receipt,
    outputRoot: options.outputRoot,
    trustRoot: options.trustRoot,
    bundle: { releaseId, manifestSha256, keyFingerprint, bootstrapSha256 },
    trust: { releaseId, keyFingerprint, bootstrapSha256 },
  }
}

function optionMap(values) {
  const mapped = {}
  for (let index = 0; index < values.length; index += 1) {
    if (values[index].startsWith('--') && values[index] !== '--allow-disposable-daemon-reset') {
      mapped[values[index]] = values[index + 1]
      index += 1
    }
  }
  return mapped
}

test('parser uses a closed required argument set and help is isolated', () => {
  const value = fixture()
  try {
    const parsed = parseSingleSessionArguments(argv(value.raw))
    assert.equal(parsed.runNumber, '71')
    assert.equal(parsed.packageDeadlineMinutes, '13')
    assert.equal(parseSingleSessionArguments(['--help']).help, true)
    assert.throws(() => parseSingleSessionArguments(argv(value.raw).concat('--unknown', 'x')), /unknown or positional/)
    assert.throws(() => parseSingleSessionArguments(argv(value.raw).concat('--run-id', '99')), /duplicate option/)
    assert.throws(() => parseSingleSessionArguments(argv(value.raw).filter((item) => item !== '--session-root' && item !== value.raw.sessionRoot)), /missing required option/)
    assert.throws(() => parseSingleSessionArguments(['--help', '--run-id', '1']), /unknown or positional/)
    assert.match(helpText(), /single-process/)
  } finally { fs.rmSync(value.directory, { recursive: true, force: true }) }
})

test('validation requires a private empty external session root and rejects inherited Docker overrides', () => {
  const value = fixture()
  try {
    const options = validateSingleSessionOptions(value.raw, value.dependencies)
    assert.equal(options.sessionRoot, value.sessionRoot)
    assert.equal(options.paths.imageProofRoot, path.join(value.sessionRoot, 'image-proof'))
    assert.equal(options.packageDeadlineMinutes, 13)
    assert.throws(() => validateSingleSessionOptions({ ...value.raw, sessionRoot: checkoutRoot }, value.dependencies), /session root must be empty|inside the checkout/)
    assert.throws(() => validateSingleSessionOptions(value.raw, { ...value.dependencies, env: { DOCKER_HOST: 'unix:///unexpected.sock' } }), /DOCKER_HOST/)
    assert.throws(() => validateSingleSessionOptions(value.raw, { ...value.dependencies, env: { DOCKER_TLS_VERIFY: '1' } }), /DOCKER_TLS_VERIFY/)
    fs.writeFileSync(path.join(value.sessionRoot, 'not-fresh'), 'x', { mode: 0o600 })
    assert.throws(() => validateSingleSessionOptions(value.raw, value.dependencies), /session root must be empty/)
  } finally { fs.rmSync(value.directory, { recursive: true, force: true }) }
})

test('one process performs native session, package, then rehearsal with exact handoff', async () => {
  const value = fixture()
  try {
    const calls = []
    const result = await runSingleSession(value.raw, {
      ...value.dependencies,
      runNativeSession: async (options) => {
        calls.push({ stage: 'native', pid: process.pid, options })
        return { receipt: { status: 'passed' } }
      },
      runLocalPackage: (options) => {
        calls.push({ stage: 'package', pid: process.pid, options })
        return handoff(options)
      },
      parseRehearsalArguments: (values) => {
        calls.push({ stage: 'parse-rehearsal', pid: process.pid, values })
        return { allowDisposableDaemonReset: true, receiptPath: optionMap(values)['--receipt'] }
      },
      runLocalRehearsal: (options) => {
        calls.push({ stage: 'rehearsal', pid: process.pid, options })
        return { receipt: { status: 'passed' } }
      },
      writePackageCheckpoint: () => calls.push({ stage: 'checkpoint', pid: process.pid }),
    })
    assert.equal(result.status, 'passed')
    assert.deepEqual(calls.map((call) => call.stage), ['native', 'package', 'checkpoint', 'parse-rehearsal', 'rehearsal'])
    assert.deepEqual(calls.map((call) => call.pid), [process.pid, process.pid, process.pid, process.pid, process.pid])
    assert.equal(calls[1].options.imageProofRoot, calls[0].options.proofOutput)
    assert.equal(calls[1].options.imageReceipt, calls[0].options.imageReceipt)
    assert.equal(calls[1].options.runNumber, '71')
    const rehearsal = optionMap(calls[3].values)
    assert.equal(rehearsal['--bundle-root'], calls[1].options.outputRoot)
    assert.equal(rehearsal['--trust-root'], calls[1].options.trustRoot)
    assert.equal(rehearsal['--source-sha'], sourceSha)
    assert.equal(rehearsal['--tree-sha'], treeSha)
    assert.equal(rehearsal['--run-id'], '72')
    assert.equal(rehearsal['--run-attempt'], '2')
    assert.equal(rehearsal['--release-id'], 'onprem-offline-72')
    assert.equal(rehearsal['--manifest-sha256'], 'd'.repeat(64))
    assert.equal(rehearsal['--trusted-fingerprint'], 'e'.repeat(64))
    assert.equal(rehearsal['--bootstrap-sha256'], 'f'.repeat(64))
    assert.equal(result.receipts.offlineRehearsal, path.join(value.sessionRoot, 'offline-rehearsal.json'))
    assert.deepEqual(fs.readdirSync(value.sessionRoot), [])
  } finally { fs.rmSync(value.directory, { recursive: true, force: true }) }
})

test('checkpoint writer failure blocks rehearsal and preserves child evidence', async () => {
  const value = fixture()
  try {
    let rehearsals = 0
    await assert.rejects(() => runSingleSession(value.raw, {
      ...value.dependencies,
      runNativeSession: async () => ({ receipt: { status: 'passed' } }),
      runLocalPackage: handoff,
      writePackageCheckpoint: () => { throw new Error('checkpoint failed') },
      runLocalRehearsal: () => { rehearsals += 1; return { receipt: { status: 'passed' } } },
    }), /single-session offline package checkpoint failed/)
    assert.equal(rehearsals, 0)
  } finally { fs.rmSync(value.directory, { recursive: true, force: true }) }
})

test('a native failure prevents package and rehearsal without outer cleanup', async () => {
  const value = fixture()
  try {
    let packageCalls = 0
    let rehearsalCalls = 0
    await assert.rejects(() => runSingleSession(value.raw, {
      ...value.dependencies,
      runNativeSession: async () => {
        fs.writeFileSync(path.join(value.sessionRoot, 'native-sentinel'), 'retain', { mode: 0o600 })
        throw new Error('native failed')
      },
      runLocalPackage: () => { packageCalls += 1 },
      runLocalRehearsal: () => { rehearsalCalls += 1 },
    }), /single-session native session failed/)
    assert.equal(packageCalls, 0)
    assert.equal(rehearsalCalls, 0)
    assert.equal(fs.readFileSync(path.join(value.sessionRoot, 'native-sentinel'), 'utf8'), 'retain')
    const nonPassedRoot = emptySessionRoot(value.directory, 'native-non-passed')
    await assert.rejects(() => runSingleSession({ ...value.raw, sessionRoot: nonPassedRoot }, {
      ...value.dependencies,
      runNativeSession: async () => ({ receipt: { status: 'failed' } }),
      runLocalPackage: () => { packageCalls += 1 },
      runLocalRehearsal: () => { rehearsalCalls += 1 },
    }), /single-session native session failed/)
    assert.equal(packageCalls, 0)
    assert.equal(rehearsalCalls, 0)
  } finally { fs.rmSync(value.directory, { recursive: true, force: true }) }
})

test('a package failure or malformed package handoff prevents rehearsal and preserves child evidence', async () => {
  const value = fixture()
  try {
    let rehearsalCalls = 0
    const native = async () => ({ receipt: { status: 'passed' } })
    await assert.rejects(() => runSingleSession(value.raw, {
      ...value.dependencies,
      runNativeSession: native,
      runLocalPackage: () => {
        fs.writeFileSync(path.join(value.sessionRoot, 'package-sentinel'), 'retain', { mode: 0o600 })
        throw new Error('package failed')
      },
      runLocalRehearsal: () => { rehearsalCalls += 1 },
    }), /single-session offline package failed/)
    assert.equal(rehearsalCalls, 0)
    assert.equal(fs.readFileSync(path.join(value.sessionRoot, 'package-sentinel'), 'utf8'), 'retain')
    const malformed = [
      ['status', (result) => ({ ...result, status: 'failed' })],
      ['receipt', (result) => ({ ...result, receipt: path.join(value.directory, 'wrong-package.json') })],
      ['digest', (result) => ({ ...result, bundle: { ...result.bundle, manifestSha256: 'not-a-digest' } })],
      ['trust', (result) => ({ ...result, trust: { releaseId: 'wrong', keyFingerprint: 'e'.repeat(64), bootstrapSha256: 'f'.repeat(64) } })],
    ]
    for (const [label, mutate] of malformed) {
      const sessionRoot = emptySessionRoot(value.directory, `malformed-${label}`)
      await assert.rejects(() => runSingleSession({ ...value.raw, sessionRoot }, {
        ...value.dependencies,
        runNativeSession: native,
        runLocalPackage: (options) => {
          fs.writeFileSync(path.join(sessionRoot, 'package-sentinel'), label, { mode: 0o600 })
          return mutate(handoff(options))
        },
        runLocalRehearsal: () => { rehearsalCalls += 1 },
      }), /single-session offline package handoff failed/)
      assert.equal(fs.readFileSync(path.join(sessionRoot, 'package-sentinel'), 'utf8'), label)
    }
    assert.equal(rehearsalCalls, 0)
  } finally { fs.rmSync(value.directory, { recursive: true, force: true }) }
})

test('a non-passed rehearsal receipt is not converted into success or cleaned up', async () => {
  const value = fixture()
  try {
    await assert.rejects(() => runSingleSession(value.raw, {
      ...value.dependencies,
      runNativeSession: async () => ({ receipt: { status: 'passed' } }),
      runLocalPackage: handoff,
      parseRehearsalArguments: () => ({ allowDisposableDaemonReset: true }),
      runLocalRehearsal: () => {
        fs.writeFileSync(path.join(value.sessionRoot, 'rehearsal-sentinel'), 'retain', { mode: 0o600 })
        return { receipt: { status: 'failed' } }
      },
    }), /single-session offline rehearsal failed/)
    assert.equal(fs.readFileSync(path.join(value.sessionRoot, 'rehearsal-sentinel'), 'utf8'), 'retain')
  } finally { fs.rmSync(value.directory, { recursive: true, force: true }) }
})

test('the orchestrator stays a pure in-process delegator', () => {
  const source = fs.readFileSync(new URL('./onprem-native-full-offline-rehearsal.mjs', import.meta.url), 'utf8')
  assert.doesNotMatch(source, /node:child_process|\bspawn(?:Sync)?\b|\bexec(?:File|Sync)?\b|\bfork\b|wsl\.exe|systemctl|iptables|ip6tables|\brmSync\b|\bunlinkSync\b|\brmdirSync\b/)
  assert.match(source, /await native\(/)
  assert.match(source, /packageBuilder\(/)
  assert.match(source, /rehearsal\(/)
})
