import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import {
  LIFECYCLE_ORDER,
  REQUIRED_HOST_TOOLS,
  WORKFLOW_STEPS,
  assertDockerEnvironmentSafe,
  assertCanonicalWorkspaceRoot,
  captureFirewallSnapshots,
  executeWorkflowBody,
  validateDockerRootContext,
  extractWorkflowBlocks,
  lifecyclePlan,
  parseCliArguments,
  recoverAfterLifecycle,
  runLifecycle,
  runLocalRehearsal,
  runSupervisedLifecycle,
  stableJson,
  strictCopyImmutableInputs,
  validateArchiveMemberPath,
  validateChecksumManifest,
  workflowBodyDigest,
} from './onprem-offline-local-rehearsal.mjs'
import { FIREWALL_DIAGNOSTIC_LINE_CAP } from './onprem-image-local-proof-recovery.mjs'

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const scriptPath = path.join(repositoryRoot, 'scripts', 'onprem-offline-local-rehearsal.mjs')
const workflowPath = path.join(repositoryRoot, '.github', 'workflows', 'onprem-offline-proof.yml')

function temporaryDirectory() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'onprem-local-contract-'))
}

function digest(value) {
  return createHash('sha256').update(value).digest('hex')
}

function validArguments(overrides = {}) {
  const values = {
    '--allow-disposable-daemon-reset': true,
    '--bundle-root': path.resolve('fixtures/bundle'),
    '--trust-root': path.resolve('fixtures/trust'),
    '--manifest-sha256': 'a'.repeat(64),
    '--release-id': 'onprem-offline-1234567890ab',
    '--trusted-fingerprint': 'b'.repeat(64),
    '--bootstrap-sha256': 'c'.repeat(64),
    '--node': path.resolve('node'),
    '--node-sha256': 'd'.repeat(64),
    '--source-sha': 'e'.repeat(40),
    '--tree-sha': 'f'.repeat(40),
    '--run-id': '42',
    '--run-attempt': '1',
    '--receipt': path.resolve('receipts/offline.json'),
  }
  Object.assign(values, overrides)
  return Object.entries(values).flatMap(([name, value]) => value === true ? [name] : [name, value])
}

test('extracts exactly the named workflow bodies and preserves their order', () => {
  const blocks = extractWorkflowBlocks(workflowPath)
  assert.deepEqual(Object.keys(blocks), WORKFLOW_STEPS)
  assert.equal(workflowBodyDigest(blocks), workflowBodyDigest(extractWorkflowBlocks(workflowPath)))
  for (const marker of WORKFLOW_STEPS) {
    assert.match(blocks[marker].body, /^set -euo pipefail/m)
    assert.match(blocks[marker].body, /\n$/)
    assert.match(blocks[marker].bodySha256, /^[a-f0-9]{64}$/)
  }
  assert.match(blocks[WORKFLOW_STEPS[0]].body, /iptables-save/)
  assert.match(blocks[WORKFLOW_STEPS[1]].body, /operations\/(?:preflight|install|migrate|activate|smoke|backup|restore)\.sh/)
  assert.match(blocks[WORKFLOW_STEPS[2]].body, /offline-runtime-quiesced/)
  assert.match(blocks[WORKFLOW_STEPS[3]].body, /iptables-restore/)
  assert.match(blocks[WORKFLOW_STEPS[4]].body, /rehearsal-failure\.json/)
  assert.match(blocks[WORKFLOW_STEPS[5]].body, /sensitive_paths=/)
})

test('fails closed for missing, duplicated, or malformed workflow markers', () => {
  const directory = temporaryDirectory()
  try {
    const original = fs.readFileSync(workflowPath, 'utf8')
    const marker = `      - name: ${WORKFLOW_STEPS[0]}`
    const duplicatePath = path.join(directory, 'duplicate.yml')
    fs.writeFileSync(duplicatePath, original.replace(marker, `${marker}\n${marker}`))
    assert.throws(() => extractWorkflowBlocks(duplicatePath), /missing or duplicated/)

    const missingPath = path.join(directory, 'missing.yml')
    fs.writeFileSync(missingPath, original.replace(marker, '      - name: missing marker'))
    assert.throws(() => extractWorkflowBlocks(missingPath), /missing or duplicated/)

    const malformedPath = path.join(directory, 'malformed.yml')
    const markerOffset = original.indexOf(marker)
    const bodyOffset = original.indexOf('          set -euo pipefail\n', markerOffset)
    const malformed = `${original.slice(0, bodyOffset)}        set -euo pipefail\n${original.slice(bodyOffset + '          set -euo pipefail\n'.length)}`
    fs.writeFileSync(malformedPath, malformed)
    assert.throws(() => extractWorkflowBlocks(malformedPath), /malformed/)
  } finally {
    fs.rmSync(directory, { recursive: true, force: true })
  }
})

test('runner source only delegates operation semantics to extracted workflow bodies', () => {
  const source = fs.readFileSync(scriptPath, 'utf8')
  assert.doesNotMatch(source, /sudo\s+iptables\s+-N/)
  assert.doesNotMatch(source, /docker\s+run\s+--pull=never/)
  assert.doesNotMatch(source, /operations\/(?:preflight|install|migrate|activate|smoke|backup|restore)\.sh/)
  assert.deepEqual(REQUIRED_HOST_TOOLS.includes('nft'), true)
  assert.match(source, /stdio:\s*\['ignore', 'inherit', 'inherit'\]/)
  assert.match(source, /setsid --wait bash/)
  assert.match(source, /kill -TERM -- "-\$leader"/)
  assert.match(source, /kill -KILL -- "-\$leader"/)
  assert.match(source, /containmentComplete/)
  assert.match(source, /dockerIdentityCheck/)
  assert.deepEqual(lifecyclePlan(), LIFECYCLE_ORDER)
})

test('workflow process-group supervisor proves containment before returning', { skip: process.platform !== 'linux' }, () => {
  const directory = temporaryDirectory()
  try {
    const context = {
      runnerTemp: directory,
      workspace: repositoryRoot,
      dockerHome: directory,
      dockerConfig: directory,
      dockerIdentityCheck: () => undefined,
      dockerContextCheck: () => undefined,
      options: {
        runId: '42', runAttempt: '1', sourceSha: 'e'.repeat(40), treeSha: 'f'.repeat(40), releaseId: 'onprem-offline-1234567890ab',
        trustedFingerprint: 'b'.repeat(64), bootstrapSha256: 'c'.repeat(64), manifestSha256: 'a'.repeat(64), nodePath: '/opt/node-v24.19.0/bin/node',
      },
    }
    const result = executeWorkflowBody('set -euo pipefail\nprintf supervisor-ok\n', context, { timeoutMs: 5000 })
    assert.equal(result.status, 'passed')
    assert.equal(result.containmentComplete, true)
    assert.equal(fs.readdirSync(directory).length, 0)
    assert.throws(() => executeWorkflowBody('exit 0\n', { ...context, dockerIdentityCheck: () => { throw new Error('fixed Docker identity unavailable') } }), /fixed Docker identity unavailable/)
  } finally {
    fs.rmSync(directory, { recursive: true, force: true })
  }
})

test('archive envelope allows canonical directory members but rejects unsafe paths', () => {
  assert.deepEqual(validateArchiveMemberPath('current/'), { normalized: 'current', directory: true })
  assert.deepEqual(validateArchiveMemberPath('current/bundle-manifest.json'), { normalized: 'current/bundle-manifest.json', directory: false })
  for (const member of ['', '/', '/current', 'current//', 'current/./manifest', 'current/../manifest', 'current\\manifest']) {
    assert.throws(() => validateArchiveMemberPath(member), /unsafe member path/)
  }
})

test('CLI is strict about required values, duplicate options, and unknown options', () => {
  assert.deepEqual(parseCliArguments(['--help']), { help: true })
  const parsed = parseCliArguments(validArguments())
  assert.equal(parsed.runId, '42')
  assert.equal(parsed.runAttempt, '1')
  assert.equal(parsed.allowDisposableDaemonReset, true)
  assert.throws(() => parseCliArguments(validArguments().filter((value) => value !== '--allow-disposable-daemon-reset')), /allow-disposable-daemon-reset/)
  assert.throws(() => parseCliArguments([...validArguments(), '--unknown', 'value']), /unknown option/)
  assert.throws(() => parseCliArguments([...validArguments(), '--run-id', '7']), /duplicate option/)
  assert.throws(() => parseCliArguments(validArguments({ '--source-sha': 'not-a-sha' })), /source-sha/)
  assert.throws(() => parseCliArguments([...validArguments(), 'positional']), /unknown option/)
  const directory = temporaryDirectory()
  try {
    const runRoot = path.join(directory, 'run-root')
    assert.throws(() => parseCliArguments(validArguments({ '--run-root': runRoot, '--receipt': path.join(runRoot, 'receipt.json') })), /external to --run-root/)
    assert.doesNotThrow(() => parseCliArguments(validArguments({ '--run-root': runRoot, '--receipt': path.join(directory, 'receipt.json') })))
  } finally {
    fs.rmSync(directory, { recursive: true, force: true })
  }
})

test('workspace root must be the harness checkout after canonical resolution', () => {
  const directory = temporaryDirectory()
  try {
    const cleanWorkspace = path.join(directory, 'clean-workspace')
    fs.mkdirSync(cleanWorkspace)
    execFileSync('git', ['-C', cleanWorkspace, 'init', '--quiet'])
    execFileSync('git', ['-C', cleanWorkspace, 'config', 'user.name', 'offline-contract-test'])
    execFileSync('git', ['-C', cleanWorkspace, 'config', 'user.email', 'offline-contract-test@example.invalid'])
    execFileSync('git', ['-C', cleanWorkspace, 'config', 'core.autocrlf', 'false'])
    fs.writeFileSync(path.join(cleanWorkspace, 'README.txt'), 'clean workspace\n')
    execFileSync('git', ['-C', cleanWorkspace, 'add', '--', 'README.txt'])
    execFileSync('git', ['-C', cleanWorkspace, 'commit', '--quiet', '-m', 'clean workspace'])
    assert.equal(execFileSync('git', ['-C', cleanWorkspace, 'status', '--porcelain'], { encoding: 'utf8' }), '')
    assert.equal(assertCanonicalWorkspaceRoot(repositoryRoot), fs.realpathSync(repositoryRoot))
    assert.throws(
      () => parseCliArguments(validArguments({ '--workspace-root': cleanWorkspace })),
      /workspace root must resolve to the harness checkout repository root/,
    )
  } finally {
    fs.rmSync(directory, { recursive: true, force: true })
  }
})

test('immutable input copy is exact and checksum validation is fail-closed', () => {
  const directory = temporaryDirectory()
  try {
    const bundle = path.join(directory, 'bundle')
    const trust = path.join(directory, 'trust')
    const destination = path.join(directory, 'incoming')
    fs.mkdirSync(bundle)
    fs.mkdirSync(trust)
    const archiveContents = { 'current.tar': 'current', 'next-transition.tar': 'next', 'previous-transition.tar': 'previous' }
    for (const [name, contents] of Object.entries(archiveContents)) fs.writeFileSync(path.join(bundle, name), contents)
    const checksums = Object.entries(archiveContents).map(([name, contents]) => `${digest(contents)}  ${name}`).join('\n') + '\n'
    fs.writeFileSync(path.join(bundle, 'SHA256SUMS'), checksums)
    for (const name of ['public-key.pem', 'fingerprint.txt', 'receipt.json', 'onprem-offline-bootstrap-verify.mjs']) fs.writeFileSync(path.join(trust, name), name)
    const copied = strictCopyImmutableInputs(bundle, trust, destination)
    assert.deepEqual(fs.readdirSync(copied.bundleRoot).sort(), ['SHA256SUMS', 'current.tar', 'next-transition.tar', 'previous-transition.tar', 'trust'].sort())
    assert.deepEqual(fs.readdirSync(copied.trustRoot).sort(), ['fingerprint.txt', 'onprem-offline-bootstrap-verify.mjs', 'public-key.pem', 'receipt.json'].sort())
    const manifestDigest = digest(checksums)
    assert.deepEqual(Object.keys(validateChecksumManifest(path.join(bundle, 'SHA256SUMS'), manifestDigest)).sort(), Object.keys(archiveContents).sort())
    assert.throws(() => validateChecksumManifest(path.join(bundle, 'SHA256SUMS'), '0'.repeat(64)), /mismatch/)
    assert.throws(() => strictCopyImmutableInputs(bundle, trust, destination), /fresh/)
  } finally {
    fs.rmSync(directory, { recursive: true, force: true })
  }
})

test('all outcomes finalize in quiesce, restore, failure receipt, materialize, cleanup order', () => {
  const directory = temporaryDirectory()
  const blocks = extractWorkflowBlocks(workflowPath)
  const context = {
    runRoot: directory,
    runnerTemp: path.join(directory, 'runner-temp'),
    workspace: path.join(directory, 'workspace'),
    options: {
      runId: '42', runAttempt: '1', sourceSha: 'e'.repeat(40), treeSha: 'f'.repeat(40), releaseId: 'onprem-offline-1234567890ab',
      trustedFingerprint: 'b'.repeat(64), bootstrapSha256: 'c'.repeat(64), manifestSha256: 'a'.repeat(64), nodePath: '/opt/node-v24.19.0/bin/node', nodeSha256: 'd'.repeat(64), runnerTemp: path.join(directory, 'runner-temp'),
    },
    workflowBlocks: blocks,
  }
  fs.mkdirSync(context.runnerTemp, { recursive: true, mode: 0o700 })
  fs.mkdirSync(context.workspace, { recursive: true, mode: 0o700 })
  const calls = []
  const execute = (body) => {
    calls.push(WORKFLOW_STEPS.find((marker) => blocks[marker].body === body))
    return { status: 'failed', exitCode: 99 }
  }
  const preflight = {
    environment: { platform: 'linux', architecture: 'x64', kernel: 'Linux test', isWsl: false },
    node: { path: '/opt/node-v24.19.0/bin/node', version: 'v24.19.0', sha256: 'd'.repeat(64) },
    docker: { serverVersion: 'test', os: 'linux', architecture: 'amd64', composeVersion: 'test', context: 'default', endpoint: 'unix:///var/run/docker.sock' },
    git: { head: 'e'.repeat(40), tree: 'f'.repeat(40) },
    workflowSha256: '1'.repeat(64), workflowBodySha256: workflowBodyDigest(blocks),
    inputIdentity: { archiveIdentities: {}, archiveDigests: {}, manifest: { imageIdentities: {} }, trust: { publicKeySha256: 'b'.repeat(64) } },
  }
  const result = runLifecycle(context, preflight, { execute })
  assert.deepEqual(calls, [WORKFLOW_STEPS[0], WORKFLOW_STEPS[2], WORKFLOW_STEPS[3], WORKFLOW_STEPS[4], WORKFLOW_STEPS[5]])
  assert.equal(result.receipt.status, 'failed')
  assert.equal(result.receipt.egress.failureReceiptAfterRestore, true)
  assert.equal(result.cleanup.runRootRemoved, true)
  assert.doesNotMatch(stableJson(result.receipt), /PASSWORD|TOKEN|PRIVATE_KEY/)
})

function supervisedFixture({ phaseFailure = false, resetFailure = false, resetUnverified = false, ipv6Mismatch = false, ipv6CounterOnlyMismatch = false, ipv6DiagnosticOverflow = false, semanticTimestampDrift = false, postInventory = null, finalGit = null } = {}) {
  const directory = temporaryDirectory()
  const runnerTemp = path.join(directory, 'runner-temp')
  const workspace = repositoryRoot
  const blocks = extractWorkflowBlocks(workflowPath)
  fs.mkdirSync(path.join(runnerTemp, 'offline-receipts'), { recursive: true, mode: 0o700 })
  const options = {
    workspaceRoot: repositoryRoot,
    runnerTemp,
    runId: '42', runAttempt: '1', sourceSha: 'e'.repeat(40), treeSha: 'f'.repeat(40), releaseId: 'onprem-offline-1234567890ab',
    trustedFingerprint: 'b'.repeat(64), bootstrapSha256: 'c'.repeat(64), manifestSha256: 'a'.repeat(64), nodePath: '/opt/node-v24.19.0/bin/node', nodeSha256: 'd'.repeat(64),
  }
  const context = { runRoot: directory, runnerTemp, workspace, dockerHome: path.join(runnerTemp, 'docker-home'), dockerConfig: path.join(runnerTemp, 'docker-config'), options, workflowBlocks: blocks }
  const semanticFirewall = (family, timestamp) => Buffer.from([
    `# Generated by ${family} v1.8.9 (nf_tables) on ${timestamp}`,
    '*filter', ':INPUT ACCEPT [0:0]', '-A INPUT -j ACCEPT', 'COMMIT', `# Completed on ${timestamp}`,
  ].join('\n') + '\n', 'ascii')
  const ipv4Bytes = semanticTimestampDrift ? semanticFirewall('iptables-save', 'Mon Jun 10 09:18:34 2024') : Buffer.from('ipv4-before\n')
  const ipv4AfterBytes = semanticTimestampDrift ? semanticFirewall('iptables-save', 'Tue Jun 11 10:19:35 2024') : ipv4Bytes
  const overflowRules = (start) => Array.from({ length: FIREWALL_DIAGNOSTIC_LINE_CAP + 1 }, (_, index) => `:INPUT ACCEPT [${start + index}:${start + index}]`).join('\n')
  const ipv6Bytes = ipv6DiagnosticOverflow
    ? Buffer.from(overflowRules(0))
    : ipv6CounterOnlyMismatch
    ? Buffer.from('*filter\n:INPUT ACCEPT [0:0]\n-A INPUT -c 0 0 -j ACCEPT\nCOMMIT\n')
    : semanticTimestampDrift ? semanticFirewall('ip6tables-save', 'Mon Jun 10 09:18:34 2024') : Buffer.from('ipv6-before\n')
  const ipv6AfterBytes = ipv6DiagnosticOverflow
    ? Buffer.from(overflowRules(1))
    : ipv6CounterOnlyMismatch
    ? Buffer.from('*filter\n:INPUT ACCEPT [12:34]\n-A INPUT -c 5 6 -j ACCEPT\nCOMMIT\n')
    : ipv6Mismatch ? Buffer.from('ipv6-after-drift\n') : semanticTimestampDrift ? semanticFirewall('ip6tables-save', 'Tue Jun 11 10:19:35 2024') : ipv6Bytes
  const snapshots = {
    ipv4: { bytes: ipv4Bytes, byteLength: ipv4Bytes.length, sha256: digest(ipv4Bytes) },
    ipv6: { bytes: ipv6Bytes, byteLength: ipv6Bytes.length, sha256: digest(ipv6Bytes) },
  }
  const order = []
  const commandRunner = (file, args, commandOptions = {}) => {
    const recoverySudo = file === '/usr/bin/sudo' && args[0] === '-n'
    const actualFile = recoverySudo ? args[1] : file
    const actualArgs = recoverySudo ? args.slice(2) : args
    if (actualFile === '/usr/sbin/iptables-restore' || actualFile === '/usr/sbin/ip6tables-restore') {
      assert.equal(file, '/usr/bin/sudo')
      assert.deepEqual(commandOptions.env, { LANG: 'C', LC_ALL: 'C', PATH: '/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin' })
      assert.deepEqual(actualArgs, ['--counters'])
      order.push(path.basename(actualFile))
      return { status: 0, stdout: '', stderr: '' }
    }
    if (actualFile === '/usr/sbin/iptables-save' || actualFile === '/usr/sbin/ip6tables-save') {
      assert.equal(file, '/usr/bin/sudo')
      assert.deepEqual(commandOptions.env, { LANG: 'C', LC_ALL: 'C', PATH: '/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin' })
      assert.deepEqual(actualArgs, [])
      order.push(path.basename(actualFile))
      const bytes = actualFile === '/usr/sbin/ip6tables-save' ? ipv6AfterBytes : ipv4AfterBytes
      return { status: 0, stdout: bytes.toString('utf8'), stderr: '' }
    }
    if (actualFile === 'git') {
      if (actualArgs.includes('status')) return { status: 0, stdout: '', stderr: '' }
      if (actualArgs.includes('HEAD^{tree}')) return { status: 0, stdout: finalGit?.tree ?? options.treeSha, stderr: '' }
      return { status: 0, stdout: finalGit?.head ?? options.sourceSha, stderr: '' }
    }
    return { status: 0, stdout: '', stderr: '' }
  }
  const execute = (body) => {
    const marker = WORKFLOW_STEPS.find((value) => blocks[value].body === body)
    order.push(`phase:${marker}`)
    if (marker === WORKFLOW_STEPS[4]) {
      fs.writeFileSync(path.join(runnerTemp, 'offline-receipts', 'rehearsal.json'), JSON.stringify({ status: 'passed', sanitized: true, operation: 'offline-rehearsal', releaseId: options.releaseId }))
    }
    if (phaseFailure && marker === WORKFLOW_STEPS[1]) return { status: 'failed', exitCode: 17, containmentComplete: true }
    return { status: 'passed', exitCode: 0, containmentComplete: true }
  }
  const controller = {
    resetDedicatedNativeDockerHost() {
      order.push('reset')
      if (resetFailure) throw new Error('reset failed')
      return { dockerDaemonReset: !resetUnverified }
    },
    inspectDedicatedNativeDockerHost() {
      order.push('post-inspect')
      return { inventory: postInventory ?? { containers: 0, networks: 0, volumes: 0, images: 0 } }
    },
  }
  const beforeHost = { inventory: { containers: 0, networks: 0, volumes: 0, images: 0 } }
  return { directory, context, options, snapshots, order, commandRunner, execute, controller, beforeHost, finalGit }
}

test('supervised recovery orders reset, both firewall restores, post-inspection, and source checks', () => {
  const fixture = supervisedFixture()
  try {
    const result = runSupervisedLifecycle(fixture.context, { git: { head: fixture.options.sourceSha, tree: fixture.options.treeSha }, inputIdentity: { manifest: { sourceRevision: fixture.options.sourceSha } } }, {
      lock: { path: 'lock-held' }, beforeHost: fixture.beforeHost, snapshots: fixture.snapshots, commandRunner: fixture.commandRunner, platform: 'linux', uid: 1000,
      controller: fixture.controller, execute: fixture.execute, finalGit: { head: fixture.options.sourceSha, tree: fixture.options.treeSha },
    })
    assert.equal(result.receipt.status, 'passed')
    assert.equal(result.recovery.ok, true)
    assert.ok(fixture.order.indexOf('reset') > fixture.order.indexOf(`phase:${WORKFLOW_STEPS[3]}`))
    assert.ok(fixture.order.indexOf('iptables-restore') < fixture.order.indexOf('ip6tables-restore'))
    assert.ok(fixture.order.indexOf('ip6tables-restore') < fixture.order.indexOf('post-inspect'))
    assert.equal(result.recovery.firewall.ipv4.byteEqual, true)
    assert.equal(result.recovery.firewall.ipv6.byteEqual, true)
    assert.equal(result.recovery.firewall.equal, true)
    assert.equal(result.recovery.firewall.equal, result.recovery.firewall.byteEqual)
    assert.equal(result.recovery.firewall.ipv4.diagnostic, null)
    assert.equal(result.recovery.firewall.ipv6.diagnostic, null)
  } finally {
    fs.rmSync(fixture.directory, { recursive: true, force: true })
  }
})

test('offline recovery accepts timestamp-only IPv4/IPv6 drift while preserving raw and semantic flags', () => {
  const fixture = supervisedFixture({ semanticTimestampDrift: true })
  try {
    const result = runSupervisedLifecycle(fixture.context, { git: { head: fixture.options.sourceSha, tree: fixture.options.treeSha }, inputIdentity: { manifest: { sourceRevision: fixture.options.sourceSha } } }, {
      lock: { path: 'lock-held' }, beforeHost: fixture.beforeHost, snapshots: fixture.snapshots, commandRunner: fixture.commandRunner, platform: 'linux', uid: 1000,
      controller: fixture.controller, execute: fixture.execute, finalGit: { head: fixture.options.sourceSha, tree: fixture.options.treeSha },
    })
    assert.equal(result.receipt.status, 'passed')
    assert.equal(result.recovery.ok, true)
    assert.equal(result.recovery.firewall.byteEqual, false)
    assert.equal(result.recovery.firewall.equal, false)
    assert.equal(result.recovery.firewall.equal, result.recovery.firewall.byteEqual)
    assert.equal(result.recovery.firewall.timestampOnlyEquivalent, true)
    assert.equal(result.recovery.firewall.equivalent, true)
    for (const family of [result.recovery.firewall.ipv4, result.recovery.firewall.ipv6]) {
      assert.equal(family.byteEqual, false)
      assert.equal(family.timestampOnlyEquivalent, true)
      assert.equal(family.equivalent, true)
    }
    assert.doesNotMatch(stableJson(result.receipt), /Generated by|Completed on|iptables-save|ip6tables-save|filter|INPUT/)
  } finally {
    fs.rmSync(fixture.directory, { recursive: true, force: true })
  }
})

test('counter-only-shaped firewall drift remains a failed recovery with sanitized diagnostics', () => {
  const fixture = supervisedFixture({ ipv6CounterOnlyMismatch: true })
  try {
    const result = runSupervisedLifecycle(fixture.context, { git: { head: fixture.options.sourceSha, tree: fixture.options.treeSha }, inputIdentity: { manifest: { sourceRevision: fixture.options.sourceSha } } }, {
      lock: { path: 'lock-held' }, beforeHost: fixture.beforeHost, snapshots: fixture.snapshots, commandRunner: fixture.commandRunner, platform: 'linux', uid: 1000,
      controller: fixture.controller, execute: fixture.execute, finalGit: { head: fixture.options.sourceSha, tree: fixture.options.treeSha },
    })
    assert.equal(result.recovery.ok, false)
    assert.equal(result.recovery.firewall.ipv6.byteEqual, false)
    assert.equal(result.recovery.firewall.ipv6.diagnostic.counterOnly, true)
    assert.equal(result.receipt.status, 'failed')

    const serializedRecovery = stableJson(result.recovery)
    const serializedReceipt = stableJson(result.receipt)
    for (const serialized of [serializedRecovery, serializedReceipt]) {
      assert.doesNotMatch(serialized, /\*filter\n:INPUT ACCEPT \[[0-9]+:[0-9]+\]/)
      assert.doesNotMatch(serialized, /-A INPUT -c [0-9]+ [0-9]+ -j ACCEPT/)
      assert.doesNotMatch(serialized, /"(?:bytes|text)"\s*:/)
    }
  } finally {
    fs.rmSync(fixture.directory, { recursive: true, force: true })
  }
})

test('offline recovery and its receipt stay bounded when firewall line digests overflow', () => {
  const fixture = supervisedFixture({ ipv6DiagnosticOverflow: true })
  try {
    const result = runSupervisedLifecycle(fixture.context, { git: { head: fixture.options.sourceSha, tree: fixture.options.treeSha }, inputIdentity: { manifest: { sourceRevision: fixture.options.sourceSha } } }, {
      lock: { path: 'lock-held' }, beforeHost: fixture.beforeHost, snapshots: fixture.snapshots, commandRunner: fixture.commandRunner, platform: 'linux', uid: 1000,
      controller: fixture.controller, execute: fixture.execute, finalGit: { head: fixture.options.sourceSha, tree: fixture.options.treeSha },
    })
    const recoveryDiagnostic = result.recovery.firewall.ipv6.diagnostic
    const receiptDiagnostic = result.receipt.recovery.firewall.ipv6.diagnostic
    assert.equal(result.recovery.ok, false)
    assert.equal(result.receipt.status, 'failed')
    for (const diagnostic of [recoveryDiagnostic, receiptDiagnostic]) {
      assert.equal(diagnostic.lineDigestTruncated, true)
      assert.equal(diagnostic.counterOnly, false)
      assert.equal(diagnostic.preLines.length, FIREWALL_DIAGNOSTIC_LINE_CAP)
      assert.equal(diagnostic.postLines.length, FIREWALL_DIAGNOSTIC_LINE_CAP)
    }
    assert.equal(receiptDiagnostic.lineDigestTruncated, recoveryDiagnostic.lineDigestTruncated)
    for (const serialized of [stableJson(result.recovery), stableJson(result.receipt)]) {
      assert.doesNotMatch(serialized, /:INPUT ACCEPT|\[[0-9]+:[0-9]+\]/)
      assert.doesNotMatch(serialized, /"(?:bytes|text)"\s*:/)
    }
  } finally {
    fs.rmSync(fixture.directory, { recursive: true, force: true })
  }
})

test('phase failure still runs containment recovery, while reset failure still restores both families', () => {
  for (const change of [{ phaseFailure: true }, { resetFailure: true }, { resetUnverified: true }]) {
    const fixture = supervisedFixture(change)
    try {
      const result = runSupervisedLifecycle(fixture.context, { git: { head: fixture.options.sourceSha, tree: fixture.options.treeSha }, inputIdentity: { manifest: { sourceRevision: fixture.options.sourceSha } } }, {
        lock: { path: 'lock-held' }, beforeHost: fixture.beforeHost, snapshots: fixture.snapshots, commandRunner: fixture.commandRunner, platform: 'linux', uid: 1000,
        controller: fixture.controller, execute: fixture.execute, finalGit: { head: fixture.options.sourceSha, tree: fixture.options.treeSha },
      })
      assert.equal(result.receipt.status, 'failed')
      assert.ok(fixture.order.includes('reset'))
      assert.ok(fixture.order.includes('iptables-restore'))
      assert.ok(fixture.order.includes('ip6tables-restore'))
      assert.ok(fixture.order.includes('post-inspect'))
      const firstRecovery = fixture.order.indexOf('reset')
      assert.ok(firstRecovery > fixture.order.indexOf(`phase:${WORKFLOW_STEPS[3]}`))
    } finally {
      fs.rmSync(fixture.directory, { recursive: true, force: true })
    }
  }
})

test('recovery deadline exhaustion reserves both firewall families and attempts both restores', () => {
  const fixture = supervisedFixture()
  let now = 1000
  let resetDeadlineAt = null
  const resetDeadline = new Error('reset recovery deadline exhausted')
  resetDeadline.code = 'OFFLINE_RECOVERY_DEADLINE'
  const controller = {
    ...fixture.controller,
    resetDedicatedNativeDockerHost(options) {
      resetDeadlineAt = options.recoveryDeadlineAt
      now = 1055
      throw resetDeadline
    },
  }
  const boundedRunner = (file, args, commandOptions = {}) => {
    assert.deepEqual(commandOptions.env, { LANG: 'C', LC_ALL: 'C', PATH: '/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin' })
    assert.ok(Number.isSafeInteger(commandOptions.timeout) && commandOptions.timeout > 0)
    const actualFile = file === '/usr/bin/sudo' && args[0] === '-n' ? args[1] : file
    if (actualFile === '/usr/sbin/iptables-restore') now = 1081
    return fixture.commandRunner(file, args, commandOptions)
  }
  try {
    const result = runSupervisedLifecycle(fixture.context, { git: { head: fixture.options.sourceSha, tree: fixture.options.treeSha }, inputIdentity: { manifest: { sourceRevision: fixture.options.sourceSha } } }, {
      lock: { path: 'lock-held' }, beforeHost: fixture.beforeHost, snapshots: fixture.snapshots, commandRunner: boundedRunner, platform: 'linux', uid: 1000,
      controller, execute: fixture.execute, finalGit: { head: fixture.options.sourceSha, tree: fixture.options.treeSha }, now: () => now, recoveryBudgetMs: 100, firewallFamilyReserveMs: 20,
    })
    assert.equal(result.receipt.status, 'failed')
    assert.deepEqual(fixture.order.filter((value) => value === 'iptables-restore' || value === 'ip6tables-restore'), ['iptables-restore', 'ip6tables-restore'])
    assert.equal(result.recovery.firewall.ipv4.attempted, true)
    assert.equal(result.recovery.firewall.ipv6.attempted, true)
    assert.match(result.recovery.timeoutReason, /deadline exhausted/)
    assert.deepEqual(result.recovery.timeoutReasons.map((entry) => entry.stage), ['reset', 'ipv4-restore'])
    assert.equal(result.recovery.budgetMs, 100)
    assert.equal(result.recovery.firewallReserveMs, 20)
    assert.equal(resetDeadlineAt, 1060)
  } finally {
    fs.rmSync(fixture.directory, { recursive: true, force: true })
  }
})

test('IPv6 byte mismatch, nonempty post-reset inventory, and dirty final Git block success', () => {
  for (const change of [{ ipv6Mismatch: true }, { postInventory: { containers: 1, networks: 0, volumes: 0, images: 0 } }, { finalGit: { head: '1'.repeat(40), tree: '2'.repeat(40) } }]) {
    const fixture = supervisedFixture(change)
    try {
      const result = runSupervisedLifecycle(fixture.context, { git: { head: fixture.options.sourceSha, tree: fixture.options.treeSha }, inputIdentity: { manifest: { sourceRevision: fixture.options.sourceSha } } }, {
        lock: { path: 'lock-held' }, beforeHost: fixture.beforeHost, snapshots: fixture.snapshots, commandRunner: fixture.commandRunner, platform: 'linux', uid: 1000,
        controller: fixture.controller, execute: fixture.execute, finalGit: change.finalGit ?? { head: fixture.options.sourceSha, tree: fixture.options.treeSha },
      })
      assert.equal(result.receipt.status, 'failed')
      assert.equal(result.recovery.ok, false)
      if (change.ipv6Mismatch) {
        assert.equal(result.recovery.firewall.ipv6.diagnostic.counterOnly, false)
      }
    } finally {
      fs.rmSync(fixture.directory, { recursive: true, force: true })
    }
  }
})

test('Docker escape environment names are rejected before local execution', () => {
  for (const name of ['DOCKER_HOST', 'DOCKER_CONTEXT', 'DOCKER_CONFIG']) {
    assert.throws(() => assertDockerEnvironmentSafe({ [name]: '/escape' }), new RegExp(`${name} override`))
  }
})

test('bare sudo Docker context is fixed to default, the dedicated socket, and data-root', () => {
  const calls = []
  const runner = (file, args) => {
    calls.push({ file, args })
    const command = args.slice(2)
    if (command[0] === 'context' && command[1] === 'show') return { status: 0, stdout: 'default\n', stderr: '' }
    if (command[0] === 'context' && command[1] === 'inspect') return { status: 0, stdout: '"unix:///var/run/docker.sock"\n', stderr: '' }
    if (command[0] === 'info') return { status: 0, stdout: JSON.stringify({ DockerRootDir: '/var/lib/hr-axis-onprem-rehearsal/docker' }), stderr: '' }
    return { status: 1, stdout: '', stderr: 'unexpected command' }
  }
  assert.deepEqual(validateDockerRootContext(runner), { context: 'default', endpoint: 'unix:///var/run/docker.sock', dockerRootDir: '/var/lib/hr-axis-onprem-rehearsal/docker' })
  assert.deepEqual(calls.map(({ file, args }) => [file, ...args]), [
    ['sudo', '-n', 'docker', 'context', 'show'],
    ['sudo', '-n', 'docker', 'context', 'inspect', 'default', '--format', '{{json .Endpoints.docker.Host}}'],
    ['sudo', '-n', 'docker', 'info', '--format', '{{json .}}'],
  ])
  assert.throws(() => validateDockerRootContext((file, args) => args.includes('show') ? { status: 0, stdout: 'remote\n', stderr: '' } : { status: 1, stdout: '', stderr: '' }), /context must be default/)
})

test('external receipt is materialized pending under lock and finalized after lock release', () => {
  const fixture = supervisedFixture()
  try {
    const events = fixture.order
    const writes = []
    const controller = {
      acquireHostLock() { events.push('lock'); return { path: 'lock-held' } },
      inspectDedicatedNativeDockerHost() {
        if (events.includes('reset')) return fixture.controller.inspectDedicatedNativeDockerHost()
        events.push('inspect-before')
        return fixture.beforeHost
      },
      resetDedicatedNativeDockerHost: fixture.controller.resetDedicatedNativeDockerHost,
      releaseHostLock() { events.push('release') },
    }
    const options = { ...fixture.options, allowDisposableDaemonReset: true, receiptPath: path.join(fixture.directory, 'external-receipt.json') }
    const preflight = { git: { head: options.sourceSha, tree: options.treeSha }, inputIdentity: { manifest: { sourceRevision: options.sourceSha } } }
    const result = runLocalRehearsal(options, {
      commandRunner: fixture.commandRunner,
      fsApi: fs,
      platform: 'linux',
      uid: 1000,
      controller,
      context: fixture.context,
      workflowBlocks: fixture.context.workflowBlocks,
      preflight,
      snapshots: fixture.snapshots,
      execute: fixture.execute,
      finalGit: { head: options.sourceSha, tree: options.treeSha },
      writeReceipt: (_path, receipt) => { writes.push(receipt); events.push(`receipt:${receipt.status}`) },
    })
    assert.equal(result.receipt.status, 'passed')
    assert.deepEqual(writes.map((receipt) => receipt.status), ['pending', 'passed'])
    assert.ok(events.indexOf('post-inspect') < events.indexOf('receipt:pending'))
    assert.ok(events.indexOf('receipt:pending') < events.indexOf('release'))
    assert.ok(events.indexOf('release') < events.indexOf('receipt:passed'))
    assert.equal(result.receipt.lockRelease.status, 'released')
  } finally {
    fs.rmSync(fixture.directory, { recursive: true, force: true })
  }
})

test('lock release failure rewrites the external receipt as failed before returning', () => {
  const fixture = supervisedFixture()
  try {
    const events = fixture.order
    const writes = []
    const releaseError = Object.assign(new Error('release details must not leak'), { code: 'LOCK_RELEASE_FAILED' })
    const controller = {
      acquireHostLock() { events.push('lock'); return { path: 'lock-held' } },
      inspectDedicatedNativeDockerHost() {
        if (events.includes('reset')) return fixture.controller.inspectDedicatedNativeDockerHost()
        events.push('inspect-before')
        return fixture.beforeHost
      },
      resetDedicatedNativeDockerHost: fixture.controller.resetDedicatedNativeDockerHost,
      releaseHostLock() { events.push('release'); throw releaseError },
    }
    const options = { ...fixture.options, allowDisposableDaemonReset: true, receiptPath: path.join(fixture.directory, 'external-receipt.json') }
    const preflight = { git: { head: options.sourceSha, tree: options.treeSha }, inputIdentity: { manifest: { sourceRevision: options.sourceSha } } }
    assert.throws(() => runLocalRehearsal(options, {
      commandRunner: fixture.commandRunner,
      fsApi: fs,
      platform: 'linux',
      uid: 1000,
      controller,
      context: fixture.context,
      workflowBlocks: fixture.context.workflowBlocks,
      preflight,
      snapshots: fixture.snapshots,
      execute: fixture.execute,
      finalGit: { head: options.sourceSha, tree: options.treeSha },
      writeReceipt: (_path, receipt) => { writes.push(receipt); events.push(`receipt:${receipt.status}`) },
    }), /lock release failed \(LOCK_RELEASE_FAILED\)/)
    assert.deepEqual(writes.map((receipt) => receipt.status), ['pending', 'failed'])
    assert.ok(events.indexOf('post-inspect') < events.indexOf('receipt:pending'))
    assert.ok(events.indexOf('receipt:pending') < events.indexOf('release'))
    assert.ok(events.indexOf('release') < events.indexOf('receipt:failed'))
    assert.equal(writes.at(-1).lockRelease.status, 'failed')
    assert.equal(writes.at(-1).lockRelease.ownerHeld, null)
    assert.equal(writes.at(-1).lockRelease.errorCode, 'LOCK_RELEASE_FAILED')
    assert.equal(writes.at(-1).failure.phase, 'lock-release')
    assert.doesNotMatch(stableJson(writes.at(-1)), /release details must not leak/)
  } finally {
    fs.rmSync(fixture.directory, { recursive: true, force: true })
  }
})

test('firewall snapshot failure writes a sanitized failed receipt before lock release', () => {
  const fixture = supervisedFixture()
  try {
    const events = fixture.order
    const writes = []
    const controller = {
      acquireHostLock() { events.push('lock'); return { path: 'lock-held' } },
      inspectDedicatedNativeDockerHost() { events.push('inspect-before'); return fixture.beforeHost },
      releaseHostLock() { events.push('release') },
    }
    const failingRunner = (file, args, commandOptions) => {
      if (file === '/usr/bin/sudo' && args[1] === '/usr/sbin/iptables-save') throw new Error('snapshot command failed')
      return fixture.commandRunner(file, args, commandOptions)
    }
    const options = { ...fixture.options, allowDisposableDaemonReset: true, receiptPath: path.join(fixture.directory, 'external-receipt.json') }
    assert.throws(() => runLocalRehearsal(options, {
      commandRunner: failingRunner,
      fsApi: fs,
      platform: 'linux',
      uid: 1000,
      controller,
      context: fixture.context,
      workflowBlocks: fixture.context.workflowBlocks,
      preflight: { git: { head: options.sourceSha, tree: options.treeSha }, inputIdentity: { manifest: { sourceRevision: options.sourceSha } } },
      writeReceipt: (_path, receipt) => { writes.push(receipt); events.push(`receipt:${receipt.status}`) },
    }), /firewall snapshot failed/)
    assert.deepEqual(writes.map((receipt) => receipt.status), ['pending', 'failed'])
    assert.equal(writes.at(-1).failure.phase, 'firewall-snapshot')
    assert.equal(writes.at(-1).lockRelease.status, 'released')
    assert.ok(events.indexOf('receipt:pending') < events.indexOf('release'))
    assert.ok(events.indexOf('release') < events.indexOf('receipt:failed'))
  } finally {
    fs.rmSync(fixture.directory, { recursive: true, force: true })
  }
})
