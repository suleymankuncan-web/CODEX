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
  assertCanonicalWorkspaceRoot,
  extractWorkflowBlocks,
  lifecyclePlan,
  parseCliArguments,
  runLifecycle,
  stableJson,
  strictCopyImmutableInputs,
  validateArchiveMemberPath,
  validateChecksumManifest,
  workflowBodyDigest,
} from './onprem-offline-local-rehearsal.mjs'

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
  return Object.entries(values).flatMap(([name, value]) => [name, value])
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
  assert.deepEqual(lifecyclePlan(), LIFECYCLE_ORDER)
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
