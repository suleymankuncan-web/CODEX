import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { expectedNativeDockerHostMarker, hostContract } from './onprem-native-docker-host.mjs'
import {
  PACKAGE_WORKFLOW_STEPS,
  assertDockerEnvironmentSafe,
  buildPackageReceipt,
  buildHardenedGitInvocation,
  copyStableFile,
  extractPackageWorkflowBlocks,
  FIXED_LINUX_TOOLS,
  parsePackageArguments,
  parseWorkflowEnv,
  receiptSelfHash,
  readStableJsonFile,
  runLocalPackage,
  runWorkflowBody,
  stagePinnedNode,
  stableJson,
  validateNodeRuntime,
  validateImageProofInput,
  validateProofArtifactManifest,
  workflowBodyDigest,
  materializeReceipt,
} from './onprem-offline-local-package.mjs'

const workflowPath = path.resolve('.github/workflows/onprem-offline-proof.yml')

function tempDirectory() { return fs.mkdtempSync(path.join(os.tmpdir(), 'onprem-offline-package-contract-')) }
function sha256(value) { return crypto.createHash('sha256').update(value).digest('hex') }
function validArguments(overrides = {}) {
  const values = {
    '--confirm-disposable-native-host': true,
    '--allow-disposable-daemon-reset': true,
    '--image-proof-root': '/var/tmp/image-proof',
    '--image-receipt': '/var/tmp/image-receipt.json',
    '--output-root': '/var/tmp/offline-bundle',
    '--trust-root': '/var/tmp/offline-trust',
    '--receipt': '/var/tmp/offline-package-receipt.json',
    '--source-sha': 'a'.repeat(40),
    '--tree-sha': 'b'.repeat(40),
    '--node': '/opt/node-v24.19.0/bin/node',
    '--node-sha256': 'c'.repeat(64),
    '--run-id': '42',
    '--run-attempt': '1',
    '--deadline-minutes': '10',
  }
  Object.assign(values, overrides)
  return Object.entries(values).flatMap(([key, value]) => value === true ? [key] : [key, value])
}

function privateMode(target) {
  try { fs.chmodSync(target, 0o600) } catch { /* Windows mode emulation is best effort. */ }
}

function fileSnapshot(target) {
  const stats = fs.lstatSync(target)
  return {
    path: path.resolve(target), sha256: sha256(fs.readFileSync(target)), bytes: stats.size, mode: stats.mode,
    uid: Number.isInteger(stats.uid) ? stats.uid : null, gid: Number.isInteger(stats.gid) ? stats.gid : null,
    nlink: stats.nlink, dev: Number.isInteger(stats.dev) ? stats.dev : null, ino: Number.isInteger(stats.ino) ? stats.ino : null,
    mtimeMs: stats.mtimeMs, ctimeMs: stats.ctimeMs,
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

function passedImageReceipt(options, artifact) {
  const equalFirewall = { status: 'passed', byteEqual: true, timestampOnlyEquivalent: false, equivalent: true }
  return {
    schemaVersion: 2, tool: 'onprem-image-local-proof', status: 'passed', hostedEvidence: false,
    dataClass: 'synthetic', proofMode: 'full', imageScope: 'both', sourceSha: options.sourceSha, treeSha: options.treeSha,
    node: { version: 'v24.19.0', sha256: options.nodeSha256 }, dockerDaemonReset: true,
    docker: { id: 'engine-contract-id', serverVersion: '29.0.0', operatingSystem: 'linux', architecture: 'amd64', digest: `sha256:${'d'.repeat(64)}`, rootContext: { context: 'default', endpoint: `unix://${hostContract.socket}`, dockerRootDir: hostContract.dockerDataRoot } },
    recovery: { dockerDaemonReset: true }, verifiedHost: { after: verifiedHost() },
    firewall: { ...equalFirewall, equal: true, ipv4: { ...equalFirewall }, ipv6: { ...equalFirewall } },
    postflight: { status: 'passed', clean: true }, cleanup: { status: 'passed', runRoot: 'removed', proofOutput: 'preserved' },
    phases: [{ name: 'proof', status: 'passed', exitCode: 0, signal: null, timedOut: false, durationMs: 1 }], artifact,
  }
}

function packageFixture({ executeBody, controller } = {}) {
  const root = tempDirectory()
  const imageProofRoot = path.join(root, 'image-proof')
  fs.mkdirSync(imageProofRoot, { recursive: true, mode: 0o700 })
  const artifact = Buffer.from('synthetic proof artifact\n')
  const artifactPath = path.join(imageProofRoot, 'proof.txt')
  fs.writeFileSync(artifactPath, artifact)
  const sourceSha = 'a'.repeat(40)
  const treeSha = 'b'.repeat(40)
  const node = process.execPath
  const nodeSha256 = sha256(fs.readFileSync(node))
  const proofReceipt = Buffer.from(`${JSON.stringify({ proofMode: 'full', imageScope: 'both', expectedSha: sourceSha, dataClass: 'synthetic', evidenceSha: 'e'.repeat(64) })}\n`)
  const proofReceiptPath = path.join(imageProofRoot, 'onprem-image-proof', 'onprem-proof-receipt.json')
  fs.mkdirSync(path.dirname(proofReceiptPath), { recursive: true, mode: 0o700 })
  fs.writeFileSync(proofReceiptPath, proofReceipt, { mode: 0o600 })
  const manifestPath = path.join(imageProofRoot, 'artifact-manifest.json')
  fs.writeFileSync(manifestPath, `${JSON.stringify({
    schemaVersion: 1, dataClass: 'synthetic', proofMode: 'full', imageScope: 'both', expectedSha: sourceSha, evidenceSha: 'e'.repeat(64), receiptSha256: sha256(proofReceipt),
    artifacts: [
      { group: 'onprem-image-proof', path: 'proof.txt', bytes: artifact.length, sha256: sha256(artifact) },
      { group: 'onprem-image-proof', path: 'onprem-image-proof/onprem-proof-receipt.json', bytes: proofReceipt.length, sha256: sha256(proofReceipt) },
    ],
  })}\n`, { mode: 0o600 })
  privateMode(manifestPath)
  const imageReceipt = path.join(root, 'image-receipt.json')
  fs.writeFileSync(imageReceipt, `${JSON.stringify(passedImageReceipt({ sourceSha, treeSha, nodeSha256 }, { manifestSha256: sha256(fs.readFileSync(manifestPath)), evidenceSha: 'e'.repeat(64) }))}\n`, { mode: 0o600 })
  privateMode(imageReceipt)
  const options = {
    confirmDisposableNativeHost: true, allowDisposableDaemonReset: true,
    imageProofRoot, imageReceipt, outputRoot: path.join(root, 'output'), trustRoot: path.join(root, 'trust'), receipt: path.join(root, 'receipt.json'),
    sourceSha, treeSha, node, nodeSha256, runId: '42', runAttempt: '1', deadlineMinutes: 10, workspaceRoot: path.resolve('.'),
  }
  const uid = typeof process.getuid === 'function' ? process.getuid() : 1000
  const manifestFacts = validateProofArtifactManifest(imageProofRoot, { sourceSha, platform: 'linux', uid })
  const imageFacts = validateImageProofInput(options, manifestFacts)
  const imageReceiptSnapshot = fileSnapshot(imageReceipt)
  const workflowSource = path.resolve('.github/workflows/onprem-offline-proof.yml')
  const blocks = extractPackageWorkflowBlocks(workflowSource)
  const pinned = parseWorkflowEnv(workflowSource)
  const emptyHost = { inventory: { containers: [], networks: [], volumes: [], images: [] } }
  const inspections = []
  const resets = []
  const controllerCalls = controller ?? {
    acquireHostLock: () => ({ token: 'test-lock' }),
    inspectDedicatedNativeDockerHost: (value) => { inspections.push(value); return emptyHost },
    resetDedicatedNativeDockerHost: (value) => { resets.push(value); return { dockerDaemonReset: true, after: emptyHost } },
    releaseHostLock: () => true,
  }
  const observations = []
  const body = executeBody ?? ((_body, context) => {
    observations.push({ marker: context.marker, context })
    return { status: 'passed', exitCode: 0, signal: null, timedOut: false, containmentComplete: true, durationMs: 0 }
  })
  const deps = {
    platform: 'linux', arch: 'x64', uid, env: {},
    lstatRunnerTemp: (target) => { const stats = fs.lstatSync(target); return { mode: 0o40700, isDirectory: () => stats.isDirectory(), isSymbolicLink: () => stats.isSymbolicLink() } },
    gitIdentity: { head: sourceSha, tree: treeSha },
    validateNodeRuntime: () => ({ path: node, version: 'v24.19.0', sha256: nodeSha256 }),
    validateProofArtifactManifest: () => manifestFacts,
    validateImageProofInput: () => imageFacts,
    createDetachedCheckout: (_options, runnerTemp) => {
      const executionRoot = path.join(runnerTemp, 'test-execution-checkout')
      fs.mkdirSync(path.join(executionRoot, '.github', 'workflows'), { recursive: true, mode: 0o700 })
      fs.copyFileSync(workflowSource, path.join(executionRoot, '.github', 'workflows', 'onprem-offline-proof.yml'))
      return { root: executionRoot, git: { head: sourceSha, tree: treeSha } }
    },
    workflowBlocks: blocks, workflowEnv: pinned, controller: controllerCalls, executeBody: body,
  }
  return { root, options, deps, observations, inspections, resets, manifestFacts, imageFacts, imageReceiptSnapshot, sourceSha, treeSha }
}

function writePackageOutput(target) {
  fs.writeFileSync(target, [
    'release_id=release-1',
    `key_fingerprint=${'1'.repeat(64)}`,
    `bootstrap_sha256=${'2'.repeat(64)}`,
    `bundle_archive_manifest_sha256=${'3'.repeat(64)}`,
    '',
  ].join('\n'))
}

function syntheticBundleFacts() {
  const snapshot = { sha256: '4'.repeat(64), bytes: 1 }
  return {
    releaseId: 'release-1', manifestSha256: '3'.repeat(64), archiveDigests: { 'current.tar': '5'.repeat(64), 'next-transition.tar': '6'.repeat(64), 'previous-transition.tar': '7'.repeat(64) },
    archiveFiles: Object.fromEntries(['SHA256SUMS', 'current.tar', 'next-transition.tar', 'previous-transition.tar'].map((name) => [name, snapshot])),
    trustFiles: Object.fromEntries(['public-key.pem', 'fingerprint.txt', 'receipt.json', 'onprem-offline-bootstrap-verify.mjs'].map((name) => [name, snapshot])),
    keyFingerprint: '1'.repeat(64), bootstrapSha256: '2'.repeat(64),
  }
}

test('workflow extraction is linked to the exact eight package build bodies', () => {
  const blocks = extractPackageWorkflowBlocks(workflowPath)
  assert.deepEqual(Object.keys(blocks), PACKAGE_WORKFLOW_STEPS)
  assert.equal(workflowBodyDigest(blocks), workflowBodyDigest(extractPackageWorkflowBlocks(workflowPath)))
  for (const marker of PACKAGE_WORKFLOW_STEPS) {
    assert.match(blocks[marker].body, /^set -euo pipefail/m)
    assert.match(blocks[marker].body, /\n$/)
    assert.match(blocks[marker].bodySha256, /^[a-f0-9]{64}$/)
  }
  const source = fs.readFileSync(workflowPath, 'utf8')
  assert.ok(PACKAGE_WORKFLOW_STEPS.every((marker) => source.includes(`- name: ${marker}`)))
})

test('workflow marker removal, duplication, malformed bodies, and unsupported operations fail closed', () => {
  const root = tempDirectory()
  try {
    const source = fs.readFileSync(workflowPath, 'utf8')
    const marker = `      - name: ${PACKAGE_WORKFLOW_STEPS[0]}`
    const duplicate = path.join(root, 'duplicate.yml')
    fs.writeFileSync(duplicate, source.replace(marker, `${marker}\n${marker}`))
    assert.throws(() => extractPackageWorkflowBlocks(duplicate), /missing or duplicated/)
    const missing = path.join(root, 'missing.yml')
    fs.writeFileSync(missing, source.replace(marker, '      - name: removed package marker'))
    assert.throws(() => extractPackageWorkflowBlocks(missing), /missing or duplicated/)
    const malformed = path.join(root, 'malformed.yml')
    const markerOffset = source.indexOf(marker)
    const bodyMatch = source.slice(markerOffset).match(/ {10}set -euo pipefail\r?\n/)
    assert.ok(bodyMatch)
    const body = markerOffset + bodyMatch.index
    fs.writeFileSync(malformed, `${source.slice(0, body)}        set -euo pipefail\n${source.slice(body + bodyMatch[0].length)}`)
    assert.throws(() => extractPackageWorkflowBlocks(malformed), /malformed/)
    const unsupported = path.join(root, 'unsupported.yml')
    const packageMarker = `      - name: ${PACKAGE_WORKFLOW_STEPS[1]}`
    const packageOffset = source.indexOf(packageMarker)
    const packageBodyMatch = source.slice(packageOffset).match(/set -euo pipefail\r?\n/)
    assert.ok(packageBodyMatch)
    const packageBodyEnd = packageOffset + packageBodyMatch.index + packageBodyMatch[0].length
    fs.writeFileSync(unsupported, `${source.slice(0, packageBodyEnd)}          curl https://example.invalid\n${source.slice(packageBodyEnd)}`)
    assert.throws(() => extractPackageWorkflowBlocks(unsupported), /unsupported source operation/)
  } finally { fs.rmSync(root, { recursive: true, force: true }) }
})

test('package argument parser requires both disposable-host confirmations and rejects unsafe options', () => {
  const parsed = parsePackageArguments(validArguments())
  assert.equal(parsed.confirmDisposableNativeHost, true)
  assert.equal(parsed.allowDisposableDaemonReset, true)
  assert.equal(parsed.runId, '42')
  assert.throws(() => parsePackageArguments(validArguments().filter((value) => value !== '--confirm-disposable-native-host')), /confirmDisposableNativeHost|confirm-disposable-native-host/)
  assert.throws(() => parsePackageArguments(validArguments().filter((value) => value !== '--allow-disposable-daemon-reset')), /allowDisposableDaemonReset|allow-disposable-daemon-reset/)
  assert.throws(() => parsePackageArguments([...validArguments(), '--unknown', 'x']), /unknown or positional/)
  assert.throws(() => parsePackageArguments([...validArguments(), '--run-id', '7']), /duplicate option/)
  assert.throws(() => parsePackageArguments(validArguments({ '--source-sha': 'not-a-sha' })), /source SHA/)
  assert.deepEqual(parsePackageArguments(['--help']), { help: true })
  assert.doesNotThrow(() => assertDockerEnvironmentSafe({ PATH: '/usr/bin' }))
  assert.throws(() => assertDockerEnvironmentSafe({ DOCKER_TLS_VERIFY: '1' }), /DOCKER_TLS_VERIFY/)
})

test('every caller and detached-checkout Git operation disables repository-local execution surfaces', () => {
  const runnerTemp = path.resolve('/var/tmp/onprem-git-contract')
  for (const args of [
    ['-C', '/workspace', 'status', '--porcelain=v1'],
    ['-C', '/workspace', 'rev-parse', 'HEAD'],
    ['clone', '--no-local', '--no-hardlinks', '--no-checkout', '--', '/workspace', '/snapshot'],
    ['-C', '/snapshot', 'checkout', '--detach', 'a'.repeat(40)],
  ]) {
    const invocation = buildHardenedGitInvocation(args, runnerTemp)
    assert.equal(invocation.file, '/usr/bin/git')
    assert.deepEqual(invocation.args.slice(0, 6), [
      '-c', 'core.fsmonitor=false',
      '-c', 'core.hooksPath=/dev/null',
      '-c', 'core.useBuiltinFSMonitor=false',
    ])
    assert.equal(invocation.env.PATH, '/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin')
    assert.equal(invocation.env.GIT_CONFIG_NOSYSTEM, '1')
    assert.equal(invocation.env.GIT_CONFIG_GLOBAL, path.join(runnerTemp, 'empty-git-config'))
    assert.equal(invocation.env.GIT_CONFIG_SYSTEM, path.join(runnerTemp, 'empty-git-config'))
    assert.equal(Object.hasOwn(invocation.env, 'HOME'), true)
  }
})

test('producer-shaped proof manifest binds its declared inner receipt and rejects mismatch or absence', () => {
  const root = tempDirectory()
  try {
    const writeManifest = (manifest) => {
      const manifestPath = path.join(root, 'artifact-manifest.json')
      fs.writeFileSync(manifestPath, `${JSON.stringify(manifest)}\n`)
      privateMode(manifestPath)
    }
    const file = path.join(root, 'onprem-image-proof', 'release-manifest.json')
    fs.mkdirSync(path.dirname(file), { recursive: true })
    const bytes = Buffer.from('{"sourceRevision":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"}\n')
    const proofReceipt = Buffer.from('{"proofMode":"full","imageScope":"both","dataClass":"synthetic"}\n')
    const proofReceiptPath = path.join(root, 'onprem-image-proof', 'onprem-proof-receipt.json')
    fs.writeFileSync(file, bytes)
    fs.writeFileSync(proofReceiptPath, proofReceipt)
    const artifacts = [
      { group: 'onprem-image-proof', path: 'onprem-image-proof/release-manifest.json', bytes: bytes.length, sha256: sha256(bytes) },
      { group: 'onprem-image-proof', path: 'onprem-image-proof/onprem-proof-receipt.json', bytes: proofReceipt.length, sha256: sha256(proofReceipt) },
    ]
    writeManifest({
      schemaVersion: 1, dataClass: 'synthetic', proofMode: 'full', imageScope: 'both', expectedSha: 'a'.repeat(40), evidenceSha: 'b'.repeat(64), receiptSha256: sha256(proofReceipt), artifacts,
    })
    const facts = validateProofArtifactManifest(root, { sourceSha: 'a'.repeat(40) })
    assert.match(facts.manifestSha256, /^[a-f0-9]{64}$/)
    assert.equal(facts.proofReceiptSha256, sha256(proofReceipt))
    assert.equal(facts.files[0].bytes, bytes.length)
    writeManifest({
      schemaVersion: 1, dataClass: 'synthetic', proofMode: 'full', imageScope: 'both', expectedSha: 'a'.repeat(40), evidenceSha: 'b'.repeat(64), receiptSha256: 'd'.repeat(64), artifacts,
    })
    assert.throws(() => validateProofArtifactManifest(root, { sourceSha: 'a'.repeat(40) }), /does not match producer proof receipt/)
    writeManifest({
      schemaVersion: 1, dataClass: 'synthetic', proofMode: 'full', imageScope: 'both', expectedSha: 'a'.repeat(40), evidenceSha: 'b'.repeat(64), receiptSha256: sha256(proofReceipt), artifacts: artifacts.slice(0, 1),
    })
    assert.throws(() => validateProofArtifactManifest(root, { sourceSha: 'a'.repeat(40) }), /exactly one producer proof receipt/)
    writeManifest({
      schemaVersion: 1, dataClass: 'synthetic', proofMode: 'full', imageScope: 'both', expectedSha: 'a'.repeat(40), evidenceSha: 'b'.repeat(64), receiptSha256: 'd'.repeat(64),
      artifacts: [{ group: 'onprem-image-proof', path: '../outside.txt', bytes: 1, sha256: 'c'.repeat(64) }],
    })
    assert.throws(() => validateProofArtifactManifest(root, { sourceSha: 'a'.repeat(40) }), /unsafe/)
  } finally { fs.rmSync(root, { recursive: true, force: true }) }
})

test('local package runs bodies only in the disposable checkout and copies proof after Establish', () => {
  const fixture = packageFixture({ executeBody: (_body, context) => {
    fixture.observations.push({ marker: context.marker, context, proofAvailable: fs.existsSync(path.join(context.env.PROOF_DOWNLOAD, 'proof.txt')) })
    if (context.marker === PACKAGE_WORKFLOW_STEPS[1]) return { status: 'failed', exitCode: 17, signal: null, timedOut: false, containmentComplete: true, durationMs: 1 }
    return { status: 'passed', exitCode: 0, signal: null, timedOut: false, containmentComplete: true, durationMs: 1 }
  } })
  try {
    assert.throws(() => runLocalPackage(fixture.options, fixture.deps), /local offline package failed/)
    assert.equal(fixture.observations.length, 2)
    assert.equal(fixture.observations[0].marker, PACKAGE_WORKFLOW_STEPS[0])
    assert.equal(fixture.observations[0].proofAvailable, false)
    assert.equal(fixture.observations[1].marker, PACKAGE_WORKFLOW_STEPS[1])
    assert.equal(fixture.observations[1].proofAvailable, true)
    for (const observation of fixture.observations) {
      assert.notEqual(observation.context.workspaceRoot, fixture.options.workspaceRoot)
      assert.equal(observation.context.env.GITHUB_WORKSPACE, observation.context.workspaceRoot)
      assert.notEqual(observation.context.env.PINNED_NODE_SOURCE, fixture.options.node)
      assert.ok(observation.context.env.PINNED_NODE_SOURCE.startsWith(observation.context.env.RUNNER_TEMP))
      assert.ok(observation.context.env.PATH.startsWith(path.dirname(observation.context.env.PINNED_NODE_SOURCE)))
      assert.ok(Object.keys(observation.context.env).some((name) => name === 'DOCKER_HOST'))
    }
    const controllerEnv = fixture.deps.controller.inspectDedicatedNativeDockerHost
    assert.equal(typeof controllerEnv, 'function')
    for (const inspection of fixture.inspections) assert.deepEqual(Object.keys(inspection.env).filter((name) => /^DOCKER_/.test(name)), [])
    const receipt = JSON.parse(fs.readFileSync(fixture.options.receipt, 'utf8'))
    assert.deepEqual(receipt.phases.map((phase) => phase.name), [PACKAGE_WORKFLOW_STEPS[0], 'validate-and-copy-proof-input', PACKAGE_WORKFLOW_STEPS[1]])
    assert.equal(receipt.reset.attempted, false)
  } finally { fs.rmSync(fixture.root, { recursive: true, force: true }) }
})

test('timed-out vendor mutation gets an independent viable reset window and empty reinspection', () => {
  const fixture = packageFixture()
  fixture.deps.executeBody = (_body, context) => {
    fixture.observations.push({ marker: context.marker, context })
    if (context.marker === PACKAGE_WORKFLOW_STEPS[2]) return { status: 'passed', exitCode: 0, signal: 'SIGTERM', timedOut: true, containmentComplete: true, durationMs: 2 }
    return { status: 'passed', exitCode: 0, signal: null, timedOut: false, containmentComplete: true, durationMs: 1 }
  }
  try {
    assert.throws(() => runLocalPackage(fixture.options, fixture.deps), /local offline package failed/)
    assert.equal(fixture.resets.length, 1)
    assert.ok(fixture.resets[0].recoveryDeadlineAt > Date.now())
    assert.equal(fixture.resets[0].env && Object.keys(fixture.resets[0].env).some((name) => /^DOCKER_/.test(name)), false)
    const receipt = JSON.parse(fs.readFileSync(fixture.options.receipt, 'utf8'))
    assert.equal(receipt.reset.attempted, true)
    assert.equal(receipt.reset.status, 'passed')
    assert.equal(receipt.reset.afterEmpty, true)
    assert.ok(receipt.reset.resetReserveMs >= 60_000)
    const timedOutPhase = receipt.phases.find((phase) => phase.marker === PACKAGE_WORKFLOW_STEPS[2])
    assert.equal(timedOutPhase.timedOut, true)
    assert.equal(timedOutPhase.status, 'failed')
    assert.equal(receipt.status, 'failed')
    assert.equal(fixture.observations.at(-1).marker, PACKAGE_WORKFLOW_STEPS[2])
  } finally { fs.rmSync(fixture.root, { recursive: true, force: true }) }
})

test('successful final body is followed immediately by reset and empty proof before validation or handoff', () => {
  const order = []
  let inspections = 0
  const emptyHost = { inventory: { containers: [], networks: [], volumes: [], images: [] } }
  const controller = {
    acquireHostLock: () => ({ token: 'lock' }),
    inspectDedicatedNativeDockerHost: () => { inspections += 1; order.push(inspections === 1 ? 'inspect-before' : 'inspect-after'); return emptyHost },
    resetDedicatedNativeDockerHost: () => { order.push('reset'); return { dockerDaemonReset: true } },
    releaseHostLock: () => { order.push('release') },
  }
  const fixture = packageFixture({ controller })
  fixture.deps.executeBody = (_body, context) => {
    order.push(`body:${context.marker}`)
    if (context.marker === PACKAGE_WORKFLOW_STEPS[6]) writePackageOutput(context.env.GITHUB_OUTPUT)
    return { status: 'passed', exitCode: 0, signal: null, timedOut: false, containmentComplete: true, durationMs: 1 }
  }
  fixture.deps.validateBundleHandoff = () => { order.push('validate-handoff'); return syntheticBundleFacts() }
  fixture.deps.copyHandoff = (_source, _destination, names) => { order.push(`copy:${names.length}`) }
  try {
    const result = runLocalPackage(fixture.options, fixture.deps)
    assert.equal(result.status, 'passed')
    const finalBody = order.indexOf(`body:${PACKAGE_WORKFLOW_STEPS.at(-1)}`)
    assert.deepEqual(order.slice(finalBody, finalBody + 4), [`body:${PACKAGE_WORKFLOW_STEPS.at(-1)}`, 'reset', 'inspect-after', 'validate-handoff'])
    assert.ok(order.indexOf('validate-handoff') < order.indexOf('copy:4'))
    assert.ok(order.lastIndexOf('copy:4') < order.indexOf('release'))
  } finally { fs.rmSync(fixture.root, { recursive: true, force: true }) }
})

test('reset failure retains lock, runner diagnostics, and truthful sanitized signing-key state without handoff', () => {
  const order = []
  const emptyHost = { inventory: { containers: [], networks: [], volumes: [], images: [] } }
  const controller = {
    acquireHostLock: () => ({ token: 'lock' }),
    inspectDedicatedNativeDockerHost: () => emptyHost,
    resetDedicatedNativeDockerHost: () => { order.push('reset'); throw Object.assign(new Error('raw reset diagnostic'), { code: 'RESET_FAILED' }) },
    releaseHostLock: () => { order.push('release') },
  }
  const fixture = packageFixture({ controller })
  let retainedRunnerTemp
  fixture.deps.executeBody = (_body, context) => {
    retainedRunnerTemp = context.runnerTemp
    if (context.marker === PACKAGE_WORKFLOW_STEPS[3]) fs.writeFileSync(path.join(context.runnerTemp, 'onprem-offline-private.pem'), 'RAW PRIVATE KEY MUST NOT LEAK', { mode: 0o600 })
    if (context.marker === PACKAGE_WORKFLOW_STEPS[6]) writePackageOutput(context.env.GITHUB_OUTPUT)
    return { status: 'passed', exitCode: 0, signal: null, timedOut: false, containmentComplete: true, durationMs: 1 }
  }
  fixture.deps.validateBundleHandoff = () => { order.push('validate-handoff'); return syntheticBundleFacts() }
  fixture.deps.copyHandoff = () => { order.push('copy') }
  try {
    assert.throws(() => runLocalPackage(fixture.options, fixture.deps), /local offline package failed/)
    assert.deepEqual(order, ['reset'])
    assert.ok(retainedRunnerTemp && fs.existsSync(retainedRunnerTemp))
    const receipt = JSON.parse(fs.readFileSync(fixture.options.receipt, 'utf8'))
    assert.equal(receipt.reset.status, 'failed')
    assert.equal(receipt.cleanup.runnerTemp, 'retained-reset-failure')
    assert.equal(receipt.cleanup.hostLock, 'retained-reset-failure')
    assert.equal(receipt.cleanup.privateKeyPreserved, true)
    assert.doesNotMatch(JSON.stringify(receipt), /RAW PRIVATE KEY|raw reset diagnostic/)
    assert.deepEqual(fs.readdirSync(fixture.options.outputRoot), [])
    assert.deepEqual(fs.readdirSync(fixture.options.trustRoot), [])
  } finally { fs.rmSync(fixture.root, { recursive: true, force: true }) }
})

test('unsafe or unobservable runner and key types report unknown sanitized private-key state', () => {
  const emptyHost = { inventory: { containers: [], networks: [], volumes: [], images: [] } }
  const safeParent = { mode: 0o40700, isDirectory: () => true, isSymbolicLink: () => false }
  const cases = [
    ['parent EACCES', { lstatRunnerTemp: () => { throw Object.assign(new Error('raw parent observation diagnostic'), { code: 'EACCES' }) } }],
    ['runner symlink', { lstatRunnerTemp: () => ({ ...safeParent, isSymbolicLink: () => true }) }],
    ['runner non-directory', { lstatRunnerTemp: () => ({ ...safeParent, isDirectory: () => false }) }],
    ['runner non-private', { lstatRunnerTemp: () => ({ ...safeParent, mode: 0o40770 }) }],
    ['key symlink', { lstatRunnerTemp: () => safeParent, lstatPrivateKey: () => ({ isFile: () => true, isSymbolicLink: () => true }) }],
    ['key non-file', { lstatRunnerTemp: () => safeParent, lstatPrivateKey: () => ({ isFile: () => false, isSymbolicLink: () => false }) }],
  ]
  for (const [label, observations] of cases) {
    const fixture = packageFixture({ controller: {
      acquireHostLock: () => ({ token: 'lock' }), inspectDedicatedNativeDockerHost: () => emptyHost,
      resetDedicatedNativeDockerHost: () => { throw Object.assign(new Error('raw reset diagnostic'), { code: 'RESET_FAILED' }) }, releaseHostLock: () => {},
    } })
    fixture.deps.executeBody = (_body, context) => {
      if (context.marker === PACKAGE_WORKFLOW_STEPS[3]) fs.writeFileSync(path.join(context.runnerTemp, 'onprem-offline-private.pem'), `RAW PRIVATE KEY MUST NOT LEAK ${label}`, { mode: 0o600 })
      if (context.marker === PACKAGE_WORKFLOW_STEPS[6]) writePackageOutput(context.env.GITHUB_OUTPUT)
      return { status: 'passed', exitCode: 0, signal: null, timedOut: false, containmentComplete: true, durationMs: 1 }
    }
    Object.assign(fixture.deps, observations)
    try {
      assert.throws(() => runLocalPackage(fixture.options, fixture.deps), /local offline package failed/)
      const receipt = JSON.parse(fs.readFileSync(fixture.options.receipt, 'utf8'))
      assert.equal(receipt.cleanup.runnerTemp, 'retained-reset-failure')
      assert.equal(receipt.cleanup.privateKeyPreserved, null, label)
      assert.doesNotMatch(JSON.stringify(receipt), /RAW PRIVATE KEY|raw parent observation diagnostic|EACCES/)
    } finally { fs.rmSync(fixture.root, { recursive: true, force: true }) }
  }
})

test('nonempty post-reset inventory also retains the lock and runner without handoff', () => {
  const order = []
  let inspections = 0
  const controller = {
    acquireHostLock: () => ({ token: 'lock' }),
    inspectDedicatedNativeDockerHost: () => {
      inspections += 1
      return { inventory: { containers: inspections === 1 ? [] : ['remaining-container'], networks: [], volumes: [], images: [] } }
    },
    resetDedicatedNativeDockerHost: () => { order.push('reset'); return { dockerDaemonReset: true } },
    releaseHostLock: () => { order.push('release') },
  }
  const fixture = packageFixture({ controller })
  fixture.deps.executeBody = (_body, context) => {
    if (context.marker === PACKAGE_WORKFLOW_STEPS[6]) writePackageOutput(context.env.GITHUB_OUTPUT)
    return { status: 'passed', exitCode: 0, signal: null, timedOut: false, containmentComplete: true, durationMs: 1 }
  }
  fixture.deps.validateBundleHandoff = () => { order.push('validate-handoff'); return syntheticBundleFacts() }
  fixture.deps.copyHandoff = () => { order.push('copy') }
  try {
    assert.throws(() => runLocalPackage(fixture.options, fixture.deps), /local offline package failed/)
    assert.deepEqual(order, ['reset'])
    const receipt = JSON.parse(fs.readFileSync(fixture.options.receipt, 'utf8'))
    assert.equal(receipt.reset.status, 'failed')
    assert.equal(receipt.reset.afterEmpty, false)
    assert.equal(receipt.cleanup.runnerTemp, 'retained-reset-failure')
    assert.equal(receipt.cleanup.hostLock, 'retained-reset-failure')
  } finally { fs.rmSync(fixture.root, { recursive: true, force: true }) }
})

test('an unverified reset result retains the recovery interlock even when inventory is empty', () => {
  const order = []
  const emptyHost = { inventory: { containers: [], networks: [], volumes: [], images: [] } }
  const controller = {
    acquireHostLock: () => ({ token: 'lock' }),
    inspectDedicatedNativeDockerHost: () => emptyHost,
    resetDedicatedNativeDockerHost: () => { order.push('reset'); return { dockerDaemonReset: false } },
    releaseHostLock: () => { order.push('release') },
  }
  const fixture = packageFixture({ controller })
  fixture.deps.executeBody = (_body, context) => {
    if (context.marker === PACKAGE_WORKFLOW_STEPS[6]) writePackageOutput(context.env.GITHUB_OUTPUT)
    return { status: 'passed', exitCode: 0, signal: null, timedOut: false, containmentComplete: true, durationMs: 1 }
  }
  fixture.deps.validateBundleHandoff = () => { order.push('validate-handoff'); return syntheticBundleFacts() }
  fixture.deps.copyHandoff = () => { order.push('copy') }
  try {
    assert.throws(() => runLocalPackage(fixture.options, fixture.deps), /local offline package failed/)
    assert.deepEqual(order, ['reset'])
    const receipt = JSON.parse(fs.readFileSync(fixture.options.receipt, 'utf8'))
    assert.equal(receipt.reset.status, 'failed')
    assert.equal(receipt.cleanup.runnerTemp, 'retained-reset-failure')
    assert.equal(receipt.cleanup.hostLock, 'retained-reset-failure')
  } finally { fs.rmSync(fixture.root, { recursive: true, force: true }) }
})

test('unproven process-group containment retains the host lock and runner evidence without reset', () => {
  const recoveryActions = []
  const fixture = packageFixture({ controller: {
    acquireHostLock: () => ({ token: 'test-lock' }),
    inspectDedicatedNativeDockerHost: () => ({ inventory: { containers: [], networks: [], volumes: [], images: [] } }),
    resetDedicatedNativeDockerHost: () => { recoveryActions.push('reset'); return { dockerDaemonReset: true } },
    releaseHostLock: () => { recoveryActions.push('release') },
  } })
  let retainedRunnerTemp = null
  fixture.deps.executeBody = (_body, context) => {
    retainedRunnerTemp = context.runnerTemp
    return runWorkflowBody('set -euo pipefail\n', {
      ...context,
      bashPath: '/usr/bin/bash',
      setsidPath: '/usr/bin/setsid',
      supervisorRunner: (_file, args) => {
        const index = args.indexOf('offline-workflow-supervisor')
        fs.writeFileSync(args[index + 1], '', { mode: 0o600 })
        fs.writeFileSync(args[index + 2], '4242\n', { mode: 0o600 })
        fs.writeFileSync(args[index + 3], '1\n', { mode: 0o600 })
        throw Object.assign(new Error('outer timeout must not leak'), { code: 'ETIMEDOUT', signal: 'SIGTERM' })
      },
    })
  }
  fixture.deps.removeRunnerTemp = () => { recoveryActions.push('cleanup') }
  try {
    assert.throws(() => runLocalPackage(fixture.options, fixture.deps), /local offline package failed/)
    assert.deepEqual(recoveryActions, [])
    assert.ok(retainedRunnerTemp && fs.existsSync(retainedRunnerTemp))
    const recoveryMarkers = fs.readdirSync(retainedRunnerTemp).filter((name) => name.startsWith('.workflow-'))
    assert.equal(recoveryMarkers.length, 3)
    assert.equal(recoveryMarkers.some((name) => name.startsWith('.workflow-timeout-')), true)
    assert.equal(recoveryMarkers.some((name) => name.startsWith('.workflow-leader-')), true)
    assert.equal(recoveryMarkers.some((name) => name.startsWith('.workflow-contained-')), true)
    const receipt = JSON.parse(fs.readFileSync(fixture.options.receipt, 'utf8'))
    assert.equal(receipt.failure.code, 'WORKFLOW_CONTAINMENT_FAILED')
    assert.equal(receipt.reset.status, 'blocked-containment')
    assert.equal(receipt.reset.attempted, false)
    assert.equal(receipt.cleanup.runnerTemp, 'retained-containment-failure')
    assert.equal(receipt.cleanup.hostLock, 'retained-containment-failure')
    assert.equal(receipt.cleanup.privateKeyPreserved, false)
    assert.equal(receipt.phases[0].status, 'failed')
    assert.equal(receipt.phases[0].timedOut, true)
    assert.equal(receipt.phases[0].containmentComplete, false)
    assert.doesNotMatch(JSON.stringify(receipt), /outer timeout must not leak/)
    assert.deepEqual(receipt.imageProof, {
      imageReceiptSha256: fixture.imageFacts.imageReceiptSha256,
      proofReceiptSha256: fixture.imageFacts.proofReceiptSha256,
      artifactManifestSha256: fixture.imageFacts.artifactManifestSha256,
    })
  } finally { fs.rmSync(fixture.root, { recursive: true, force: true }) }
})

test('runner cleanup failure retains lock, runner evidence, and truthful private-key state', () => {
  const order = []
  const emptyHost = { inventory: { containers: [], networks: [], volumes: [], images: [] } }
  const controller = {
    acquireHostLock: () => ({ token: 'lock' }),
    inspectDedicatedNativeDockerHost: () => emptyHost,
    resetDedicatedNativeDockerHost: () => { order.push('reset'); return { dockerDaemonReset: true } },
    releaseHostLock: () => { order.push('release') },
  }
  const fixture = packageFixture({ controller })
  let retainedRunnerTemp
  fixture.deps.executeBody = (_body, context) => {
    retainedRunnerTemp = context.runnerTemp
    if (context.marker === PACKAGE_WORKFLOW_STEPS[3]) fs.writeFileSync(path.join(context.runnerTemp, 'onprem-offline-private.pem'), 'RAW PRIVATE KEY MUST NOT LEAK', { mode: 0o600 })
    if (context.marker === PACKAGE_WORKFLOW_STEPS[6]) writePackageOutput(context.env.GITHUB_OUTPUT)
    return { status: 'passed', exitCode: 0, signal: null, timedOut: false, containmentComplete: true, durationMs: 1 }
  }
  fixture.deps.validateBundleHandoff = () => syntheticBundleFacts()
  fixture.deps.copyHandoff = () => {}
  fixture.deps.removeRunnerTemp = () => { order.push('cleanup'); throw Object.assign(new Error('raw cleanup diagnostic'), { code: 'EPERM' }) }
  try {
    assert.throws(() => runLocalPackage(fixture.options, fixture.deps), /local offline package failed/)
    assert.deepEqual(order, ['reset', 'cleanup'])
    assert.ok(retainedRunnerTemp && fs.existsSync(retainedRunnerTemp))
    const receipt = JSON.parse(fs.readFileSync(fixture.options.receipt, 'utf8'))
    assert.equal(receipt.status, 'failed')
    assert.equal(receipt.failure.code, 'RUNNER_TEMP_CLEANUP_FAILED')
    assert.equal(receipt.cleanup.runnerTemp, 'retained-cleanup-failure')
    assert.equal(receipt.cleanup.hostLock, 'retained-cleanup-failure')
    assert.equal(receipt.cleanup.privateKeyPreserved, true)
    assert.doesNotMatch(JSON.stringify(receipt), /RAW PRIVATE KEY|raw cleanup diagnostic/)
  } finally { fs.rmSync(fixture.root, { recursive: true, force: true }) }
})

test('runner directory still present after cleanup retains the host interlock', () => {
  const order = []
  const emptyHost = { inventory: { containers: [], networks: [], volumes: [], images: [] } }
  const controller = {
    acquireHostLock: () => ({ token: 'lock' }),
    inspectDedicatedNativeDockerHost: () => emptyHost,
    resetDedicatedNativeDockerHost: () => { order.push('reset'); return { dockerDaemonReset: true } },
    releaseHostLock: () => { order.push('release') },
  }
  const fixture = packageFixture({ controller })
  let retainedRunnerTemp
  fixture.deps.executeBody = (_body, context) => {
    retainedRunnerTemp = context.runnerTemp
    if (context.marker === PACKAGE_WORKFLOW_STEPS[6]) writePackageOutput(context.env.GITHUB_OUTPUT)
    return { status: 'passed', exitCode: 0, signal: null, timedOut: false, containmentComplete: true, durationMs: 1 }
  }
  fixture.deps.validateBundleHandoff = () => syntheticBundleFacts()
  fixture.deps.copyHandoff = () => {}
  fixture.deps.removeRunnerTemp = () => { order.push('cleanup') }
  fixture.deps.lstatPrivateKey = () => { throw Object.assign(new Error('raw key observation diagnostic'), { code: 'EACCES' }) }
  try {
    assert.throws(() => runLocalPackage(fixture.options, fixture.deps), /local offline package failed/)
    assert.deepEqual(order, ['reset', 'cleanup'])
    assert.ok(retainedRunnerTemp && fs.existsSync(retainedRunnerTemp))
    const receipt = JSON.parse(fs.readFileSync(fixture.options.receipt, 'utf8'))
    assert.equal(receipt.status, 'failed')
    assert.equal(receipt.failure.code, 'RUNNER_TEMP_CLEANUP_FAILED')
    assert.equal(receipt.cleanup.runnerTemp, 'retained-cleanup-failure')
    assert.equal(receipt.cleanup.hostLock, 'retained-cleanup-failure')
    assert.equal(receipt.cleanup.privateKeyPreserved, null)
    assert.doesNotMatch(JSON.stringify(receipt), /raw key observation diagnostic|EACCES/)
  } finally { fs.rmSync(fixture.root, { recursive: true, force: true }) }
})

test('unobservable runner cleanup retains the host interlock without claiming key removal', () => {
  const order = []
  const emptyHost = { inventory: { containers: [], networks: [], volumes: [], images: [] } }
  const fixture = packageFixture({ controller: {
    acquireHostLock: () => ({ token: 'lock' }), inspectDedicatedNativeDockerHost: () => emptyHost,
    resetDedicatedNativeDockerHost: () => { order.push('reset'); return { dockerDaemonReset: true } },
    releaseHostLock: () => { order.push('release') },
  } })
  fixture.deps.executeBody = (_body, context) => {
    if (context.marker === PACKAGE_WORKFLOW_STEPS[3]) fs.writeFileSync(path.join(context.runnerTemp, 'onprem-offline-private.pem'), 'RAW PRIVATE KEY MUST NOT LEAK', { mode: 0o600 })
    if (context.marker === PACKAGE_WORKFLOW_STEPS[6]) writePackageOutput(context.env.GITHUB_OUTPUT)
    return { status: 'passed', exitCode: 0, signal: null, timedOut: false, containmentComplete: true, durationMs: 1 }
  }
  fixture.deps.validateBundleHandoff = () => syntheticBundleFacts()
  fixture.deps.copyHandoff = () => {}
  fixture.deps.removeRunnerTemp = () => { order.push('cleanup') }
  fixture.deps.lstatRunnerTemp = () => { throw Object.assign(new Error('raw cleanup observation diagnostic'), { code: 'EACCES' }) }
  try {
    assert.throws(() => runLocalPackage(fixture.options, fixture.deps), /local offline package failed/)
    assert.deepEqual(order, ['reset', 'cleanup'])
    const receipt = JSON.parse(fs.readFileSync(fixture.options.receipt, 'utf8'))
    assert.equal(receipt.status, 'failed')
    assert.equal(receipt.failure.code, 'RUNNER_TEMP_CLEANUP_UNVERIFIED')
    assert.equal(receipt.cleanup.runnerTemp, 'cleanup-unverified')
    assert.equal(receipt.cleanup.hostLock, 'retained-cleanup-failure')
    assert.equal(receipt.cleanup.privateKeyPreserved, null)
    assert.doesNotMatch(JSON.stringify(receipt), /RAW PRIVATE KEY|raw cleanup observation diagnostic|EACCES/)
  } finally { fs.rmSync(fixture.root, { recursive: true, force: true }) }
})

test('verified runner cleanup precedes lock release and a release failure stays non-success', () => {
  const order = []
  const emptyHost = { inventory: { containers: [], networks: [], volumes: [], images: [] } }
  const controller = {
    acquireHostLock: () => ({ token: 'lock' }),
    inspectDedicatedNativeDockerHost: () => emptyHost,
    resetDedicatedNativeDockerHost: () => { order.push('reset'); return { dockerDaemonReset: true } },
    releaseHostLock: () => { order.push('release'); throw Object.assign(new Error('raw release diagnostic'), { code: 'LOCK_RELEASE_FAILED' }) },
  }
  const fixture = packageFixture({ controller })
  let removedRunnerTemp
  fixture.deps.executeBody = (_body, context) => {
    removedRunnerTemp = context.runnerTemp
    if (context.marker === PACKAGE_WORKFLOW_STEPS[3]) fs.writeFileSync(path.join(context.runnerTemp, 'onprem-offline-private.pem'), 'RAW PRIVATE KEY MUST NOT LEAK', { mode: 0o600 })
    if (context.marker === PACKAGE_WORKFLOW_STEPS[6]) writePackageOutput(context.env.GITHUB_OUTPUT)
    return { status: 'passed', exitCode: 0, signal: null, timedOut: false, containmentComplete: true, durationMs: 1 }
  }
  fixture.deps.validateBundleHandoff = () => syntheticBundleFacts()
  fixture.deps.copyHandoff = () => {}
  fixture.deps.removeRunnerTemp = (target) => { order.push('cleanup'); fs.rmSync(target, { recursive: true, force: true }) }
  try {
    assert.throws(() => runLocalPackage(fixture.options, fixture.deps), /local offline package failed/)
    assert.deepEqual(order, ['reset', 'cleanup', 'release'])
    assert.ok(removedRunnerTemp && !fs.existsSync(removedRunnerTemp))
    const receipt = JSON.parse(fs.readFileSync(fixture.options.receipt, 'utf8'))
    assert.equal(receipt.status, 'failed')
    assert.equal(receipt.failure.code, 'LOCK_RELEASE_FAILED')
    assert.equal(receipt.cleanup.runnerTemp, 'removed')
    assert.equal(receipt.cleanup.hostLock, 'release-failed')
    assert.equal(receipt.cleanup.privateKeyPreserved, false)
    assert.doesNotMatch(JSON.stringify(receipt), /RAW PRIVATE KEY|raw release diagnostic/)
  } finally { fs.rmSync(fixture.root, { recursive: true, force: true }) }
})

test('workflow body result requires process-group containment proof before advancing', () => {
  const root = tempDirectory()
  try {
    const base = { workspaceRoot: root, runnerTemp: root, env: { RUNNER_TEMP: root }, timeoutMs: 1000, bashPath: 'bash', setsidPath: 'setsid' }
    const contained = runWorkflowBody('set -euo pipefail\n', {
      ...base,
      supervisorRunner: (_file, args) => {
        const index = args.indexOf('offline-workflow-supervisor')
        fs.writeFileSync(args[index + 3], '1\n')
        return { status: 0, signal: null }
      },
    })
    assert.equal(contained.status, 'passed')
    assert.equal(contained.containmentComplete, true)
    assert.equal(fs.readdirSync(root).some((name) => name.startsWith('.workflow-')), false)
    const timedOut = runWorkflowBody('set -euo pipefail\n', {
      ...base,
      supervisorRunner: (_file, args) => {
        const index = args.indexOf('offline-workflow-supervisor')
        fs.writeFileSync(args[index + 1], '')
        fs.writeFileSync(args[index + 3], '1\n')
        return { status: 0, signal: 'SIGTERM' }
      },
    })
    assert.deepEqual({ status: timedOut.status, exitCode: timedOut.exitCode, signal: timedOut.signal, timedOut: timedOut.timedOut, containmentComplete: timedOut.containmentComplete }, {
      status: 'failed', exitCode: 0, signal: 'SIGTERM', timedOut: true, containmentComplete: true,
    })
    assert.equal(fs.readdirSync(root).some((name) => name.startsWith('.workflow-')), false)
    const unproven = runWorkflowBody('set -euo pipefail\n', { ...base, supervisorRunner: () => ({ status: 0, signal: null }) })
    assert.equal(unproven.status, 'failed')
    assert.equal(unproven.containmentComplete, false)
  } finally { fs.rmSync(root, { recursive: true, force: true }) }
})

test('pinned Node staging rejects a replacement after source validation and exposes only the private copy', () => {
  const root = tempDirectory()
  const source = path.join(root, 'node-source')
  const bytes = Buffer.from('validated-node-binary')
  fs.writeFileSync(source, bytes)
  const options = { node: source, nodeSha256: sha256(bytes) }
  try {
    fs.writeFileSync(source, 'replacement-node-binary')
    fs.mkdirSync(path.join(root, 'runner-temp'))
    assert.throws(() => stagePinnedNode(options, path.join(root, 'runner-temp')), /SHA-256 mismatch/)
    fs.writeFileSync(source, bytes)
    fs.mkdirSync(path.join(root, 'runner-temp-2'))
    const staged = stagePinnedNode(options, path.join(root, 'runner-temp-2'))
    assert.notEqual(staged.path, source)
    assert.equal(staged.binDir, path.join(root, 'runner-temp-2', 'pinned-node-bin'))
    assert.equal(staged.path, path.join(staged.binDir, 'node'))
    assert.equal(staged.sha256, options.nodeSha256)

    const calls = []
    const runtime = validateNodeRuntime(options, (file, args, commandOptions) => {
      calls.push({ file, args, commandOptions })
      return { status: 0, stdout: `${JSON.stringify({ version: 'v24.19.0', execPath: staged.path, realPath: staged.path, sha256: options.nodeSha256 })}\n`, stderr: '' }
    }, staged)
    assert.equal(runtime.path, staged.path)
    assert.equal(calls.length, 1)
    assert.equal(calls[0].file, 'node')
    assert.equal(calls[0].commandOptions.env.PATH.slice(0, staged.binDir.length), staged.binDir)
    assert.equal(calls[0].commandOptions.env.PATH.startsWith(`${staged.binDir}:`), true)
    assert.equal(calls[0].args[0], '-e')
  } finally { fs.rmSync(root, { recursive: true, force: true }) }
})

test('fixed Ubuntu 24.04 tools use canonical merged-/usr paths', () => {
  assert.deepEqual(FIXED_LINUX_TOOLS, {
    git: '/usr/bin/git', tar: '/usr/bin/tar', bash: '/usr/bin/bash', setsid: '/usr/bin/setsid',
  })
})

test('archive-size files are streamed into a digest-bound destination copy', () => {
  const root = tempDirectory()
  const source = path.join(root, 'current.tar')
  const destination = path.join(root, 'handoff-current.tar')
  const bytes = Buffer.alloc(3 * 64 * 1024 + 17, 0x5a)
  fs.writeFileSync(source, bytes)
  privateMode(source)
  try {
    const copied = copyStableFile(source, destination, 'current archive')
    assert.equal(copied.bytes, bytes.length)
    assert.equal(copied.sha256, sha256(bytes))
    assert.equal(copied.destination.bytes, bytes.length)
    assert.equal(copied.destination.sha256, sha256(bytes))

    const tamperedDestination = path.join(root, 'tampered-current.tar')
    assert.throws(() => copyStableFile(source, tamperedDestination, 'current archive', {
      afterCopy: (target) => fs.appendFileSync(target, 'tamper'),
    }), /destination verification failed/)
  } finally { fs.rmSync(root, { recursive: true, force: true }) }
})

test('outer supervisor ETIMEDOUT is a timeout without a string exit code', () => {
  const root = tempDirectory()
  try {
    const error = Object.assign(new Error('outer timeout'), { code: 'ETIMEDOUT', signal: 'SIGTERM' })
    let timeoutMarker; let leaderMarker; let containmentMarker
    const result = runWorkflowBody('set -euo pipefail\n', {
      workspaceRoot: root, runnerTemp: root, env: { RUNNER_TEMP: root }, timeoutMs: 1000,
      bashPath: '/usr/bin/bash', setsidPath: '/usr/bin/setsid', supervisorRunner: (_file, args) => {
        const index = args.indexOf('offline-workflow-supervisor')
        timeoutMarker = args[index + 1]
        leaderMarker = args[index + 2]
        containmentMarker = args[index + 3]
        fs.writeFileSync(timeoutMarker, '', { mode: 0o600 })
        fs.writeFileSync(leaderMarker, '4242\n', { mode: 0o600 })
        fs.writeFileSync(containmentMarker, '1\n', { mode: 0o600 })
        throw error
      },
    })
    assert.equal(result.status, 'failed')
    assert.equal(result.timedOut, true)
    assert.equal(result.exitCode, null)
    assert.equal(result.signal, 'SIGTERM')
    assert.equal(result.containmentComplete, false)
    assert.ok(timeoutMarker && fs.existsSync(timeoutMarker))
    assert.ok(leaderMarker && fs.existsSync(leaderMarker))
    assert.equal(fs.readFileSync(leaderMarker, 'utf8'), '4242\n')
    assert.ok(containmentMarker && fs.existsSync(containmentMarker))
    assert.equal(fs.readFileSync(containmentMarker, 'utf8'), '1\n')
  } finally { fs.rmSync(root, { recursive: true, force: true }) }
})

test('descriptor-captured manifest and receipt JSON remain bound to bytes across transient pathname replacement', { skip: process.platform !== 'linux' }, () => {
  const root = tempDirectory()
  const replaceAndRestore = (target, tamperedBytes) => {
    const backup = `${target}.restore`
    fs.renameSync(target, backup)
    fs.writeFileSync(target, tamperedBytes, { mode: 0o600 })
    fs.rmSync(target)
    fs.renameSync(backup, target)
  }
  try {
    const manifestPath = path.join(root, 'manifest.json')
    const receiptPath = path.join(root, 'receipt.json')
    const manifestBytes = Buffer.from('{"identity":"manifest-original"}\n')
    const receiptBytes = Buffer.from('{"identity":"receipt-original"}\n')
    fs.writeFileSync(manifestPath, manifestBytes, { mode: 0o600 })
    fs.writeFileSync(receiptPath, receiptBytes, { mode: 0o600 })
    const manifest = readStableJsonFile(manifestPath, 'manifest', { platform: 'linux', uid: process.getuid?.(), afterRead: () => replaceAndRestore(manifestPath, Buffer.from('{"identity":"manifest-tampered"}\n')) })
    const receipt = readStableJsonFile(receiptPath, 'receipt', { platform: 'linux', uid: process.getuid?.(), afterRead: () => replaceAndRestore(receiptPath, Buffer.from('{"identity":"receipt-tampered"}\n')) })
    assert.equal(manifest.value.identity, 'manifest-original')
    assert.equal(manifest.sha256, sha256(manifestBytes))
    assert.equal(receipt.value.identity, 'receipt-original')
    assert.equal(receipt.sha256, sha256(receiptBytes))
    assert.equal(fs.readFileSync(manifestPath).toString(), manifestBytes.toString())
    assert.equal(fs.readFileSync(receiptPath).toString(), receiptBytes.toString())
  } finally { fs.rmSync(root, { recursive: true, force: true }) }
})

test('image proof binding keeps outer receipt, inner proof receipt, manifest, and evidence identities distinct', (t) => {
  const fixture = packageFixture()
  try {
    const facts = validateImageProofInput(fixture.options, fixture.manifestFacts)
    assert.equal(facts.imageReceiptSha256, fixture.imageReceiptSnapshot.sha256)
    assert.equal(facts.proofReceiptSha256, fixture.manifestFacts.manifest.receiptSha256)
    assert.notEqual(facts.imageReceiptSha256, facts.proofReceiptSha256)
    assert.equal(facts.artifactManifestSha256, fixture.manifestFacts.manifestSha256)
    assert.equal(facts.parsed.sourceSha, fixture.sourceSha)
    assert.throws(() => validateImageProofInput(fixture.options, { ...fixture.manifestFacts, manifestSha256: 'f'.repeat(64) }), /artifact manifest hash/)
    assert.throws(() => validateImageProofInput(fixture.options, { ...fixture.manifestFacts, manifest: { ...fixture.manifestFacts.manifest, evidenceSha: 'f'.repeat(64) } }), /evidence hash/)
    assert.throws(() => validateImageProofInput(fixture.options, { ...fixture.manifestFacts, proofReceiptSha256: 'f'.repeat(64) }), /producer proof receipt binding/)
    const link = path.join(fixture.root, 'image-proof-link')
    try { fs.symlinkSync(fixture.options.imageProofRoot, link, 'junction') } catch { t.skip('symlink creation unavailable on this host'); return }
    assert.throws(() => validateProofArtifactManifest(link, { sourceSha: fixture.sourceSha, platform: 'linux', uid: fixture.deps.uid }), /symlink/)
  } finally { fs.rmSync(fixture.root, { recursive: true, force: true }) }
})

test('later receipt validation cannot replace the immutable option-validation snapshot', () => {
  const fixture = packageFixture()
  fixture.deps.validateImageProofInput = () => {
    fs.writeFileSync(fixture.options.imageReceipt, `${JSON.stringify({ artifact: { manifestSha256: 'f'.repeat(64), evidenceSha: 'e'.repeat(64) } })}\n`, { mode: 0o600 })
    privateMode(fixture.options.imageReceipt)
    const changed = fileSnapshot(fixture.options.imageReceipt)
    return { value: {}, parsed: {}, imageReceiptSha256: changed.sha256, proofReceiptSha256: fixture.manifestFacts.proofReceiptSha256, imageReceiptSnapshot: changed, artifactManifestSha256: fixture.manifestFacts.manifestSha256, manifest: fixture.manifestFacts.manifest, files: fixture.manifestFacts.files }
  }
  try {
    assert.throws(() => runLocalPackage(fixture.options, fixture.deps), /local offline package failed/)
    assert.deepEqual(fixture.observations.map(({ marker }) => marker), [PACKAGE_WORKFLOW_STEPS[0]])
    const receipt = JSON.parse(fs.readFileSync(fixture.options.receipt, 'utf8'))
    assert.equal(receipt.failure.code, 'PACKAGE_FAILURE')
  } finally { fs.rmSync(fixture.root, { recursive: true, force: true }) }
})

test('receipt self-hash is stable and excludes only the self field', () => {
  const payload = materializeReceipt({ schemaVersion: 1, status: 'passed', source: { treeSha: 'b'.repeat(40), sourceSha: 'a'.repeat(40) } })
  assert.match(payload.receiptSha256, /^[a-f0-9]{64}$/)
  assert.equal(receiptSelfHash(payload), payload.receiptSha256)
  const changed = { ...payload, status: 'failed' }
  assert.notEqual(receiptSelfHash(changed), payload.receiptSha256)
  const receipt = buildPackageReceipt({ sourceSha: 'a'.repeat(40), treeSha: 'b'.repeat(40) }, { status: 'failed' })
  assert.equal(receipt.receiptSha256, receiptSelfHash(receipt))
  assert.doesNotMatch(JSON.stringify(receipt), /BEGIN (?:RSA|EC|OPENSSH|PRIVATE) KEY/)
})

test('workflow parser uses pinned top-level env and package source has no archive-stage duplication', () => {
  const env = parseWorkflowEnv(workflowPath)
  for (const key of ['CADDY_IMAGE', 'POSTGRES_IMAGE', 'REDIS_IMAGE', 'SEAWEEDFS_IMAGE', 'TRIVY_IMAGE', 'SYFT_IMAGE']) assert.match(env[key], /@sha256:[a-f0-9]{64}$/)
  const packageSources = ['scripts/onprem-offline-local-package.mjs', 'scripts/onprem-offline-local-package-artifacts.mjs']
  const source = packageSources.map((name) => fs.readFileSync(path.resolve(name), 'utf8')).join('\n')
  assert.doesNotMatch(source, /tar\s+--sort=name/)
  assert.doesNotMatch(source, /docker\s+save\s+[^\n]*\$CADDY_IMAGE/)
  assert.doesNotMatch(source, /onprem-offline-private\.pem.*trust/i)
  assert.doesNotMatch(source, /\b(?:hashFile|copyFileSync)\b/)
  for (const name of packageSources) assert.ok(fs.readFileSync(path.resolve(name), 'utf8').split(/\r?\n/).length <= 900, `${name} exceeds the new-script size guard`)
})
