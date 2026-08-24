import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'

import { expectedNativeDockerHostMarker, hostContract } from './onprem-native-docker-host.mjs'
import {
  parsePassedProvisionReceipt,
  parsePassedImageReceipt,
  parseSessionArguments,
  readImmutableReceiptSnapshot,
  runNativeSession,
  validateSessionOptions,
} from './onprem-native-session-proof.mjs'

const checkoutRoot = fs.realpathSync(path.resolve('.'))
const sourceSha = 'a'.repeat(40)
const treeSha = 'b'.repeat(40)
const nodeSha256 = 'c'.repeat(64)
const engineId = 'engine-contract-id'

function temporaryDirectory() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'native-session-contract-'))
}

function writeFile(target, contents) {
  fs.writeFileSync(target, contents, { encoding: 'utf8', mode: 0o600, flag: 'wx' })
}

function validArgv(paths, nodePath) {
  return [
    '--confirm-disposable-native-host', '--allow-disposable-daemon-reset',
    '--source-sha', sourceSha, '--tree-sha', treeSha, '--run-number', '7',
    '--node', nodePath, '--node-sha256', nodeSha256,
    '--run-root', paths.runRoot, '--proof-output', paths.proofOutput,
    '--provision-receipt', paths.provisionReceipt, '--image-receipt', paths.imageReceipt, '--session-receipt', paths.sessionReceipt,
    '--deadline-minutes', '12', '--workspace-root', checkoutRoot,
  ]
}

function validFixture() {
  const directory = temporaryDirectory()
  fs.chmodSync(directory, 0o700)
  const nodePath = path.join(directory, 'node')
  writeFile(nodePath, 'synthetic pinned node')
  const digest = createHash('sha256').update(fs.readFileSync(nodePath)).digest('hex')
  const output = path.join(directory, 'outputs')
  fs.mkdirSync(output, { mode: 0o700 })
  fs.chmodSync(output, 0o700)
  const paths = {
    runRoot: path.join(output, 'run-root'),
    proofOutput: path.join(output, 'proof-output'),
    provisionReceipt: path.join(output, 'provision.json'),
    imageReceipt: path.join(output, 'image.json'),
    sessionReceipt: path.join(output, 'session.json'),
  }
  const raw = {
    confirmDisposableNativeHost: true,
    allowDisposableDaemonReset: true,
    sourceSha,
    treeSha,
    runNumber: '7',
    node: nodePath,
    nodeSha256: digest,
    ...paths,
    workspaceRoot: checkoutRoot,
    deadlineMinutes: '12',
  }
  const dependencies = {
    platform: 'linux', uid: 1000, arch: 'x64', env: {}, execPath: nodePath, nodeVersion: 'v24.19.0',
    checkoutRoot,
    gitState: { head: sourceSha, tree: treeSha, clean: true },
  }
  return { directory, nodePath, paths, raw, dependencies, nodeSha256: digest }
}

function imageReceipt(options, overrides = {}) {
  return {
    schemaVersion: 2,
    tool: 'onprem-image-local-proof',
    status: 'passed',
    hostedEvidence: false,
    dataClass: 'synthetic',
    proofMode: 'full',
    imageScope: 'both',
    sourceSha: options.sourceSha,
    treeSha: options.treeSha,
    node: { version: 'v24.19.0', sha256: options.nodeSha256 },
    dockerDaemonReset: true,
    docker: { id: engineId, serverVersion: '29.0.0', operatingSystem: 'linux', architecture: 'amd64', digest: 'sha256:' + 'd'.repeat(64), rootContext: { context: 'default', endpoint: 'unix:///var/run/docker.sock', dockerRootDir: '/var/lib/hr-axis-onprem-rehearsal/docker' } },
    recovery: { dockerDaemonReset: true },
    verifiedHost: { after: verifiedHost() },
    firewall: { status: 'passed', equal: true, byteEqual: true, timestampOnlyEquivalent: false, equivalent: true, ipv4: { status: 'passed', byteEqual: true, timestampOnlyEquivalent: false, equivalent: true }, ipv6: { status: 'passed', byteEqual: true, timestampOnlyEquivalent: false, equivalent: true } },
    postflight: { status: 'passed', clean: true },
    cleanup: { status: 'passed', runRoot: 'removed', proofOutput: 'preserved' },
    phases: [{ name: 'preflight', status: 'passed', exitCode: 0, signal: null, timedOut: false, durationMs: 1 }, { name: 'recovery', status: 'passed', exitCode: 0, signal: null, timedOut: false, durationMs: 2 }],
    ...overrides,
  }
}

function verifiedHost() {
  const marker = expectedNativeDockerHostMarker()
  return {
    contract: hostContract.version,
    marker: { schema: marker.schema, version: marker.version },
    units: { containerd: hostContract.containerdUnit, dockerd: hostContract.dockerdUnit },
    pids: { containerd: 101, dockerd: 202 },
    processes: {
      containerd: { startTime: 1001, executable: '/usr/bin/containerd', cgroup: `/system.slice/${hostContract.containerdUnit}` },
      dockerd: { startTime: 2002, executable: '/usr/bin/dockerd', cgroup: `/system.slice/${hostContract.dockerdUnit}` },
    },
    socket: hostContract.socket,
    dockerRootDir: hostContract.dockerDataRoot,
    inventory: { containers: 0, networks: 0, volumes: 0, images: 0 },
  }
}

function provisionReceipt() {
  const marker = expectedNativeDockerHostMarker()
  const defaultState = { active: false, inactive: true, enabled: false, disabled: true }
  return {
    schema: 'hr-axis-onprem-native-docker-host-provision-v1',
    version: 1,
    status: 'passed',
    evidence: 'local-native-host-provisioning',
    contract: hostContract.version,
    marker,
    host: { platform: 'linux', architecture: 'x64' },
    units: { containerd: hostContract.containerdUnit, dockerd: hostContract.dockerdUnit, defaults: { dockerService: defaultState, dockerSocket: defaultState } },
    socket: { path: hostContract.socket },
    roots: { paths: { dockerDataRoot: hostContract.dockerDataRoot, dockerExecRoot: hostContract.dockerExecRoot, containerdRoot: hostContract.containerdRoot, containerdState: hostContract.containerdState } },
    cleanup: { rootsRecreated: true, markerInstalled: true, unitsInstalled: true, normalDockerDisabled: true },
    inspect: { passed: true, inventory: { containers: 0, networks: 0, volumes: 0, images: 0 } },
    failureStage: null,
  }
}

test('parser accepts the closed allowlist and bounded deadline', () => {
  const fixture = validFixture()
  try {
    const parsed = parseSessionArguments(validArgv(fixture.paths, fixture.nodePath))
    assert.equal(parsed.confirmDisposableNativeHost, true)
    assert.equal(parsed.allowDisposableDaemonReset, true)
    assert.equal(parsed.deadlineMinutes, '12')
    assert.throws(() => parseSessionArguments(validArgv(fixture.paths, fixture.nodePath).concat('positional')), /unknown or positional/)
    assert.throws(() => parseSessionArguments(validArgv(fixture.paths, fixture.nodePath).concat('--unknown', 'x')), /unknown or positional/)
    assert.throws(() => parseSessionArguments(validArgv(fixture.paths, fixture.nodePath).concat('--deadline-minutes', '12')), /duplicate option/)
    assert.throws(() => parseSessionArguments(validArgv(fixture.paths, fixture.nodePath).map((value) => value === '--confirm-disposable-native-host' ? '--unknown' : value)), /unknown or positional/)
  } finally { fs.rmSync(fixture.directory, { recursive: true, force: true }) }
})

test('preflight identity mismatches block provisioning', async () => {
  const fixture = validFixture()
  try {
    let provisionCalls = 0
    await assert.rejects(() => runNativeSession(fixture.raw, { ...fixture.dependencies, gitState: { head: 'f'.repeat(40), tree: treeSha, clean: true }, provisionNativeDockerHost: () => { provisionCalls += 1 } }), /source identity/)
    assert.equal(provisionCalls, 0)
    assert.throws(() => validateSessionOptions(fixture.raw, { ...fixture.dependencies, env: { DOCKER_CONTEXT: 'desktop' } }), /DOCKER_CONTEXT/)
    assert.throws(() => validateSessionOptions({ ...fixture.raw, sourceSha: 'bad' }, fixture.dependencies), /source SHA/)
  } finally { fs.rmSync(fixture.directory, { recursive: true, force: true }) }
})

test('provision receipt parser binds the fixed host bootstrap contract', () => {
  const valid = provisionReceipt()
  assert.equal(parsePassedProvisionReceipt(valid).status, 'passed')
  const mutations = [
    ['schema', (value) => { value.schema = 'wrong' }],
    ['marker', (value) => { value.marker.schema = 'wrong' }],
    ['default units', (value) => { value.units.defaults.dockerService.disabled = false }],
    ['roots', (value) => { value.roots.paths.dockerDataRoot = '/tmp/escape' }],
    ['cleanup', (value) => { value.cleanup.unitsInstalled = false }],
    ['inventory', (value) => { value.inspect.inventory.images = 1 }],
    ['failure stage', (value) => { value.failureStage = 'inspect' }],
    ['host', (value) => { value.host.architecture = 'arm64' }],
  ]
  for (const [label, mutate] of mutations) {
    const candidate = JSON.parse(JSON.stringify(valid))
    mutate(candidate)
    assert.throws(() => parsePassedProvisionReceipt(candidate), /provision receipt/, label)
  }
})

test('Git identity preflight uses a fixed environment without caller overrides', () => {
  const fixture = validFixture()
  try {
    const calls = []
    const options = validateSessionOptions(fixture.raw, {
      ...fixture.dependencies,
      gitState: undefined,
      gitExecFileSync: (binary, args, commandOptions) => {
        calls.push({ binary, args, commandOptions })
        if (args.includes('HEAD^{tree}')) return `${treeSha}\n`
        if (args.includes('--porcelain=v1')) return ''
        return `${sourceSha}\n`
      },
    })
    assert.equal(options.git.head, sourceSha)
    assert.equal(options.git.tree, treeSha)
    assert.equal(options.git.clean, true)
    assert.equal(calls.length, 3)
    for (const call of calls) {
      assert.equal(call.binary, 'git')
      assert.deepEqual(call.commandOptions.env, {
        PATH: '/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin',
        LANG: 'C',
        LC_ALL: 'C',
        GIT_CONFIG_NOSYSTEM: '1',
        GIT_CONFIG_SYSTEM: '/dev/null',
        GIT_CONFIG_GLOBAL: '/dev/null',
        GIT_TERMINAL_PROMPT: '0',
      })
      assert.equal(Object.hasOwn(call.commandOptions.env, 'GIT_DIR'), false)
      assert.equal(Object.hasOwn(call.commandOptions.env, 'GIT_WORK_TREE'), false)
      assert.equal(Object.hasOwn(call.commandOptions.env, 'GIT_INDEX_FILE'), false)
    }
  } finally { fs.rmSync(fixture.directory, { recursive: true, force: true }) }
})

test('receipt snapshots reject unsafe files and stat identity changes', () => {
  const fixture = validFixture()
  try {
    const target = path.join(fixture.directory, 'receipt.json')
    writeFile(target, JSON.stringify(provisionReceipt()))
    const snapshot = readImmutableReceiptSnapshot(fs, target, 'receipt', { uid: 1000, platform: 'linux', strictPermissions: false })
    assert.equal(snapshot.sha256, createHash('sha256').update(fs.readFileSync(target)).digest('hex'))
    const baseLstat = fs.lstatSync.bind(fs)
    const changedAdapter = {
      lstatSync: (pathname) => {
        const stats = baseLstat(pathname)
        if (pathname === target && changedAdapter.calls++ === 1) {
          const replacement = { ...stats }
          replacement.size += 1
          replacement.isFile = stats.isFile.bind(stats)
          replacement.isSymbolicLink = stats.isSymbolicLink.bind(stats)
          return replacement
        }
        return stats
      },
      readFileSync: fs.readFileSync.bind(fs),
    }
    changedAdapter.calls = 0
    assert.throws(() => readImmutableReceiptSnapshot(changedAdapter, target, 'receipt', { uid: 1000, platform: 'linux', strictPermissions: false }), /changed while being read/)

    const unsafeAdapter = {
      lstatSync: (pathname) => {
        const stats = baseLstat(pathname)
        const unsafe = { ...stats, mode: (stats.mode & ~0o777) | 0o644, isFile: stats.isFile.bind(stats), isSymbolicLink: stats.isSymbolicLink.bind(stats) }
        return unsafe
      },
      readFileSync: fs.readFileSync.bind(fs),
    }
    assert.throws(() => readImmutableReceiptSnapshot(unsafeAdapter, target, 'receipt', { uid: 1000, platform: 'linux', strictPermissions: true }), /permissions are not private/)
  } finally { fs.rmSync(fixture.directory, { recursive: true, force: true }) }
})

test('output paths reject existing, overlap, symlink, checkout, and daemon-root targets', () => {
  const fixture = validFixture()
  try {
    const existing = path.join(fixture.directory, 'existing')
    writeFile(existing, 'occupied')
    assert.throws(() => validateSessionOptions({ ...fixture.raw, runRoot: existing }, fixture.dependencies), /fresh/)
    assert.throws(() => validateSessionOptions({ ...fixture.raw, proofOutput: fixture.raw.runRoot }, fixture.dependencies), /overlap/)
    assert.throws(() => validateSessionOptions({ ...fixture.raw, runRoot: checkoutRoot }, fixture.dependencies), /fresh|checkout/)
    assert.throws(() => validateSessionOptions({ ...fixture.raw, runRoot: '/var/lib/hr-axis-onprem-rehearsal/session' }, fixture.dependencies), /parent|daemon roots|fresh/)
    if (process.platform === 'linux') {
      const unsafeParent = path.join(fixture.directory, 'unsafe-parent')
      fs.mkdirSync(unsafeParent, { mode: 0o1777 })
      fs.chmodSync(unsafeParent, 0o1777)
      assert.throws(() => validateSessionOptions({ ...fixture.raw, runRoot: path.join(unsafeParent, 'run') }, fixture.dependencies), /writable by group or other users/)
    }
    const link = path.join(fixture.directory, 'link')
    try {
      fs.symlinkSync(path.join(fixture.directory, 'outputs'), link, 'junction')
      assert.throws(() => validateSessionOptions({ ...fixture.raw, runRoot: path.join(link, 'run') }, fixture.dependencies), /symlink|canonical/)
    } catch (error) {
      if (error?.code !== 'EPERM') throw error
    }
  } finally { fs.rmSync(fixture.directory, { recursive: true, force: true }) }
})

test('passed image receipt requires reset, both firewall families, postflight, cleanup, and identities', () => {
  const fixture = validFixture()
  try {
    const options = validateSessionOptions(fixture.raw, fixture.dependencies)
    assert.equal(parsePassedImageReceipt(imageReceipt(options), options).docker.id, engineId)
    for (const mutation of [
      { sourceSha: 'f'.repeat(40) },
      { dockerDaemonReset: false },
      { firewall: { status: 'passed', equal: true, ipv4: { status: 'passed', byteEqual: true }, ipv6: { status: 'passed', byteEqual: false } } },
      { postflight: { clean: false } },
      { postflight: { status: 'failed', clean: true } },
      { cleanup: { status: 'failed', runRoot: 'removed', proofOutput: 'preserved' } },
      { node: { version: 'v24.19.0', sha256: 'e'.repeat(64) } },
      { hostedEvidence: true },
      { verifiedHost: { after: { ...verifiedHost(), socket: '/tmp/escape' } } },
      { verifiedHost: { after: { ...verifiedHost(), inventory: { containers: 1, networks: 0, volumes: 0, images: 0 } } } },
      { verifiedHost: { after: { ...verifiedHost(), pids: { containerd: 0, dockerd: 202 } } } },
    ]) assert.throws(() => parsePassedImageReceipt(imageReceipt(options, mutation), options))
  } finally { fs.rmSync(fixture.directory, { recursive: true, force: true }) }
})

test('passed image receipt preserves timestamp-only firewall success with false raw flags', () => {
  const fixture = validFixture()
  try {
    const options = validateSessionOptions(fixture.raw, fixture.dependencies)
    const semantic = imageReceipt(options, {
      firewall: {
        status: 'passed', equal: false, byteEqual: false, timestampOnlyEquivalent: true, equivalent: true,
        ipv4: { status: 'passed', byteEqual: false, timestampOnlyEquivalent: true, equivalent: true },
        ipv6: { status: 'passed', byteEqual: false, timestampOnlyEquivalent: true, equivalent: true },
      },
    })
    const parsed = parsePassedImageReceipt(semantic, options)
    assert.equal(parsed.firewall.byteEqual, false)
    assert.equal(parsed.firewall.timestampOnlyEquivalent, true)
    assert.equal(parsed.firewall.equivalent, true)
    assert.equal(parsed.firewall.ipv4.byteEqual, false)
    assert.equal(parsed.firewall.ipv6.timestampOnlyEquivalent, true)
    for (const mutation of [
      { firewall: { ...semantic.firewall, equal: true } },
      { firewall: { ...semantic.firewall, equivalent: false } },
      { firewall: { ...semantic.firewall, timestampOnlyEquivalent: false } },
      { firewall: { ...semantic.firewall, ipv4: { ...semantic.firewall.ipv4, equivalent: false } } },
    ]) assert.throws(() => parsePassedImageReceipt({ ...semantic, ...mutation }, options))
  } finally { fs.rmSync(fixture.directory, { recursive: true, force: true }) }
})

test('passed image receipt accepts current comma-bearing workflow phase names and rejects unsafe names', () => {
  const fixture = validFixture()
  try {
    const options = validateSessionOptions(fixture.raw, fixture.dependencies)
    const currentWorkflowPhases = [
      'Prove ONP-2 static Compose, network, and firewall contracts',
      'Generate SeaweedFS storage SBOM, license, and vulnerability evidence',
    ]
    const parsed = parsePassedImageReceipt(imageReceipt(options, {
      phases: currentWorkflowPhases.map((name) => ({ name, status: 'passed' })),
    }), options)
    assert.deepEqual(parsed.phases.map((phase) => phase.name), currentWorkflowPhases)

    for (const unsafeName of [
      'unsafe\nphase',
      'unsafe\u0007phase',
      'phase && echo unsafe',
      '../escape',
      'phase/../../escape',
      'phase!',
    ]) {
      assert.throws(() => parsePassedImageReceipt(imageReceipt(options, {
        phases: [{ name: unsafeName, status: 'passed' }],
      }), options), /image receipt phase is invalid/, JSON.stringify(unsafeName))
    }
  } finally { fs.rmSync(fixture.directory, { recursive: true, force: true }) }
})

test('provision is synchronous-first, proof receives exact identity, and session receipt is sanitized', async () => {
  const fixture = validFixture()
  try {
    const events = []
    const options = validateSessionOptions(fixture.raw, fixture.dependencies)
    const provision = (input) => {
      events.push('provision')
      assert.equal(input.confirmDisposableNativeHost, true)
      assert.equal(input.receiptPath, options.provisionReceipt)
      writeFile(options.provisionReceipt, JSON.stringify(provisionReceipt()))
      return { receiptPath: options.provisionReceipt, receipt: provisionReceipt() }
    }
    const proof = async (input) => {
      events.push('proof')
      assert.deepEqual(input, {
        'source-sha': options.sourceSha, 'tree-sha': options.treeSha, 'run-number': options.runNumber, node: options.node, 'node-sha256': options.nodeSha256,
        'run-root': options.runRoot, 'proof-output': options.proofOutput, receipt: options.imageReceipt, 'workspace-root': options.workspaceRoot,
        'deadline-minutes': String(options.deadlineMinutes), 'allow-disposable-daemon-reset': true,
      })
      writeFile(options.imageReceipt, JSON.stringify(imageReceipt(options)))
      return { receipt: options.imageReceipt, phases: [] }
    }
    const result = await runNativeSession(fixture.raw, { ...fixture.dependencies, provisionNativeDockerHost: provision, runLocalProof: proof })
    assert.deepEqual(events, ['provision', 'proof'])
    assert.equal(result.receipt.status, 'passed')
    assert.equal(result.receipt.source.sourceSha, sourceSha)
    assert.equal(result.receipt.engine.id, engineId)
    assert.equal(result.receipt.cleanup.postflightClean, true)
    assert.equal(result.receipt.hostedEvidence, false)
    assert.equal(result.receipt.evidence, 'local-native-session')
    assert.equal(result.receipt.recovery.verifiedHost.socket, hostContract.socket)
    assert.equal(result.receipt.provision.receiptSha256, createHash('sha256').update(fs.readFileSync(options.provisionReceipt)).digest('hex'))
    if (process.platform === 'linux') assert.equal(fs.statSync(options.sessionReceipt).mode & 0o777, 0o600)
    assert.equal(Object.hasOwn(result.receipt, 'raw'), false)
  } finally { fs.rmSync(fixture.directory, { recursive: true, force: true }) }
})

test('provision or proof/image/session receipt failures never create false success', async () => {
  const fixture = validFixture()
  try {
    let proofCalls = 0
    await assert.rejects(() => runNativeSession(fixture.raw, { ...fixture.dependencies, provisionNativeDockerHost: () => { throw new Error('provision failed') }, runLocalProof: async () => { proofCalls += 1 } }), /provision failed/)
    assert.equal(proofCalls, 0)

    const bootstrapFailure = validFixture()
    try {
      let bootstrapProofCalls = 0
      await assert.rejects(() => runNativeSession(bootstrapFailure.raw, {
        ...bootstrapFailure.dependencies,
        provisionNativeDockerHost: () => {
          const invalid = provisionReceipt()
          invalid.inspect.inventory.images = 1
          writeFile(bootstrapFailure.paths.provisionReceipt, JSON.stringify(invalid))
          return { receiptPath: bootstrapFailure.paths.provisionReceipt, receipt: invalid }
        },
        runLocalProof: async () => { bootstrapProofCalls += 1 },
      }), /provision receipt/)
      assert.equal(bootstrapProofCalls, 0)
    } finally { fs.rmSync(bootstrapFailure.directory, { recursive: true, force: true }) }

    const fixture2 = validFixture()
    try {
      await assert.rejects(() => runNativeSession(fixture2.raw, { ...fixture2.dependencies, provisionNativeDockerHost: () => { writeFile(fixture2.paths.provisionReceipt, JSON.stringify(provisionReceipt())); return { receipt: provisionReceipt() } }, runLocalProof: async () => { throw new Error('proof failed') } }), /proof failed/)
      assert.equal(fs.existsSync(fixture2.paths.sessionReceipt), false)
    } finally { fs.rmSync(fixture2.directory, { recursive: true, force: true }) }

    const fixture3 = validFixture()
    try {
      await assert.rejects(() => runNativeSession(fixture3.raw, { ...fixture3.dependencies, provisionNativeDockerHost: () => { writeFile(fixture3.paths.provisionReceipt, JSON.stringify(provisionReceipt())); return { receipt: provisionReceipt() } }, runLocalProof: async () => { writeFile(fixture3.paths.imageReceipt, JSON.stringify({ status: 'failed' })); return {} } }), /image receipt is not passed/)
      assert.equal(fs.existsSync(fixture3.paths.sessionReceipt), false)
    } finally { fs.rmSync(fixture3.directory, { recursive: true, force: true }) }

    const fixture4 = validFixture()
    try {
      const options4 = validateSessionOptions(fixture4.raw, fixture4.dependencies)
      await assert.rejects(() => runNativeSession(fixture4.raw, {
        ...fixture4.dependencies,
        provisionNativeDockerHost: () => { writeFile(fixture4.paths.provisionReceipt, JSON.stringify(provisionReceipt())); return { receipt: provisionReceipt() } },
        runLocalProof: async () => {
          writeFile(fixture4.paths.imageReceipt, JSON.stringify(imageReceipt(options4)))
          writeFile(fixture4.paths.sessionReceipt, 'attacker\n')
          return {}
        },
      }), /session receipt must be fresh/)
      assert.equal(fs.readFileSync(fixture4.paths.sessionReceipt, 'utf8'), 'attacker\n')
    } finally { fs.rmSync(fixture4.directory, { recursive: true, force: true }) }
  } finally { fs.rmSync(fixture.directory, { recursive: true, force: true }) }
})

test('wrapper source does not own WSL, Docker/firewall, background, or global configuration operations', () => {
  const source = fs.readFileSync(new URL('./onprem-native-session-proof.mjs', import.meta.url), 'utf8')
  assert.doesNotMatch(source, /wsl\.exe|iptables|ip6tables|docker\s+(?:run|info|context|compose|network|volume|ps)/i)
  assert.doesNotMatch(source, /spawn(?:Sync)?\s*\(|fork\s*\(/)
  assert.doesNotMatch(source, /systemctl|firewall-cmd|netsh|Set-VM|wslconfig/i)
  assert.match(source, /provisionNativeDockerHost/)
  assert.match(source, /runLocalProof/)
})
