import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'

import {
  PACKAGE_WORKFLOW_STEPS,
  extractPackageWorkflowBlocks,
  materializeReceipt,
  workflowBodyDigest,
} from './onprem-offline-local-package.mjs'
import {
  buildPackageCheckpoint,
  parseResumeArguments,
  runResumeFromPackage,
  validatePackageCheckpoint,
  validateResumeOptions,
} from './onprem-offline-resume-from-package.mjs'

const checkoutRoot = fs.realpathSync(path.resolve('.'))
const sourceSha = 'a'.repeat(40)
const treeSha = 'b'.repeat(40)
const nodeSha256 = 'c'.repeat(64)
const workflowPath = path.join(checkoutRoot, '.github', 'workflows', 'onprem-offline-proof.yml')

function sha256(value) { return crypto.createHash('sha256').update(value).digest('hex') }
function nativeReceiptHash(value) { return sha256(JSON.stringify(value)) }
function tempDirectory(name = 'offline-resume-contract-') { const root = fs.mkdtempSync(path.join(os.tmpdir(), name)); fs.chmodSync(root, 0o700); return root }
function write(target, value) { fs.mkdirSync(path.dirname(target), { recursive: true, mode: 0o700 }); fs.writeFileSync(target, value, { mode: 0o600 }); return target }
function fileHash(target) { return sha256(fs.readFileSync(target)) }

function fixture() {
  const root = tempDirectory()
  const sessionRoot = path.join(root, 'package-session')
  fs.mkdirSync(sessionRoot, { mode: 0o700 })
  const imageProofRoot = path.join(sessionRoot, 'image-proof')
  fs.mkdirSync(path.join(imageProofRoot, 'onprem-image-proof'), { recursive: true, mode: 0o700 })
  write(path.join(imageProofRoot, 'onprem-image-proof', 'onprem-proof-receipt.json'), '{}\n')
  write(path.join(imageProofRoot, 'artifact-manifest.json'), JSON.stringify({ artifacts: [{ path: 'onprem-image-proof/onprem-proof-receipt.json' }] }))
  write(path.join(sessionRoot, 'image-proof.json'), '{}\n')
  const bundleRoot = path.join(sessionRoot, 'offline-bundle'); const trustRoot = path.join(sessionRoot, 'offline-trust')
  fs.mkdirSync(bundleRoot, { mode: 0o700 }); fs.mkdirSync(trustRoot, { mode: 0o700 })
  for (const name of ['SHA256SUMS', 'current.tar', 'next-transition.tar', 'previous-transition.tar']) write(path.join(bundleRoot, name), `${name}\n`)
  for (const name of ['public-key.pem', 'fingerprint.txt', 'receipt.json', 'onprem-offline-bootstrap-verify.mjs']) write(path.join(trustRoot, name), `${name}\n`)
  const blocks = extractPackageWorkflowBlocks(workflowPath)
  const archiveDigests = Object.fromEntries(['current.tar', 'next-transition.tar', 'previous-transition.tar'].map((name) => [name, 'd'.repeat(64)]))
  const packageReceipt = materializeReceipt({
    schemaVersion: 1, tool: 'onprem-offline-local-package', status: 'passed', hostedEvidence: false, dataClass: 'synthetic',
    source: { sourceSha, treeSha }, execution: { runNumber: '71', runId: '72', runAttempt: '1' },
    runner: { platform: 'linux', executionCheckout: 'detached-disposable', node: { version: 'v24.19.0', sha256: nodeSha256 } },
    workflow: { path: '.github/workflows/onprem-offline-proof.yml', sha256: fileHash(workflowPath), bodySha256: workflowBodyDigest(blocks), bodies: Object.fromEntries(PACKAGE_WORKFLOW_STEPS.map((name) => [name, blocks[name].bodySha256])) },
    imageProof: { imageReceiptSha256: '1'.repeat(64), proofReceiptSha256: '2'.repeat(64), artifactManifestSha256: '3'.repeat(64) },
    phases: [PACKAGE_WORKFLOW_STEPS[0], 'validate-and-copy-proof-input', ...PACKAGE_WORKFLOW_STEPS.slice(1), 'verify-and-copy-handoff'].map((name) => ({ name, status: 'passed', timedOut: false, containmentComplete: true })),
    bundle: { releaseId: 'onprem-offline-resume-test', archiveManifestSha256: '4'.repeat(64), archives: archiveDigests },
    trust: { releaseId: 'onprem-offline-resume-test', keyFingerprint: '5'.repeat(64), bootstrapSha256: '6'.repeat(64) },
    reset: { attempted: true, status: 'passed', initialEmpty: true, afterEmpty: true },
    cleanup: { runnerTemp: 'removed', hostLock: 'released', privateKeyPreserved: false }, failure: null,
  })
  write(path.join(sessionRoot, 'offline-package.json'), `${JSON.stringify(packageReceipt)}\n`)
  const nativePayload = {
    schemaVersion: 2, operation: 'local-native-session', status: 'passed',
    source: { sourceSha, treeSha }, runner: { path: process.execPath, version: 'v24.19.0', sha256: nodeSha256 },
    image: { status: 'passed', receiptSha256: '1'.repeat(64) }, cleanup: { status: 'passed' },
    recovery: { dockerDaemonReset: true, verifiedHost: { inventory: { containers: 0, networks: 0, volumes: 0, images: 0 } } },
  }
  const nativeReceipt = { ...nativePayload, receiptSha256: nativeReceiptHash(nativePayload) }
  write(path.join(sessionRoot, 'native-session.json'), `${JSON.stringify(nativeReceipt)}\n`)
  write(path.join(sessionRoot, 'native-provision.json'), '{}\n')
  const options = { sessionRoot, sourceSha, treeSha, runNumber: '71', runId: '72', runAttempt: '1', node: process.execPath, nodeSha256 }
  const packageResult = { status: 'passed', receipt: path.join(sessionRoot, 'offline-package.json'), outputRoot: bundleRoot, trustRoot }
  const checkpoint = buildPackageCheckpoint(options, packageResult, nativeReceipt)
  write(path.join(sessionRoot, 'offline-package-checkpoint.json'), `${JSON.stringify(checkpoint)}\n`)
  return { root, sessionRoot, options, packageReceipt, nativeReceipt, checkpoint, bundleRoot, trustRoot }
}

function resumeRaw(value, root) {
  return {
    resumeFromPackage: true, confirmDisposableNativeHost: true, allowDisposableDaemonReset: true,
    sessionRoot: value.sessionRoot, runRoot: path.join(root, 'fresh-run'), receiptPath: path.join(root, 'fresh-receipt.json'),
    sourceSha, treeSha, runId: '90', runAttempt: '2', nodePath: process.execPath, nodeSha256, workspaceRoot: checkoutRoot,
  }
}

test('parser requires an explicit package checkpoint boundary and fresh outputs', () => {
  assert.equal(parseResumeArguments(['--help']).help, true)
  assert.throws(() => parseResumeArguments(['--allow-disposable-daemon-reset']), /missing required/)
  assert.throws(() => parseResumeArguments(['--resume-from-package', '--resume-from-package']), /duplicate option/)
})

test('checkpoint certificate binds native receipt hash, run identity, exact phases, and workflow bodies', () => {
  const value = fixture()
  try {
    const options = validateResumeOptions(resumeRaw(value, value.root), { platform: 'linux', arch: 'x64', uid: 1000 })
    const facts = validatePackageCheckpoint(options, {
      uid: 1000,
      validateProofArtifactManifest: () => ({}),
      validateImageProofInput: () => ({ imageReceiptSha256: '1'.repeat(64), proofReceiptSha256: '2'.repeat(64), artifactManifestSha256: '3'.repeat(64), value: { receiptSha256: '1'.repeat(64) } }),
      validateBundleHandoff: (_bundle, _trust, expected) => ({
        manifestSha256: expected.releaseId ? '4'.repeat(64) : null,
        archiveDigests: value.packageReceipt.bundle.archives,
        archiveFiles: Object.fromEntries(['SHA256SUMS', 'current.tar', 'next-transition.tar', 'previous-transition.tar'].map((name) => [name, { sha256: value.checkpoint.files.bundle[name].sha256 }])),
        trustFiles: Object.fromEntries(['public-key.pem', 'fingerprint.txt', 'receipt.json', 'onprem-offline-bootstrap-verify.mjs'].map((name) => [name, { sha256: value.checkpoint.files.trust[name].sha256 }])),
      }),
    })
    assert.equal(facts.handoff.releaseId, 'onprem-offline-resume-test')
    assert.equal(facts.nativeReceipt.receiptSha256, value.nativeReceipt.receiptSha256)
  } finally { fs.rmSync(value.root, { recursive: true, force: true }) }
})

test('tampered checkpoint stops before rehearsal invocation', () => {
  const value = fixture()
  try {
    const checkpointPath = path.join(value.sessionRoot, 'offline-package-checkpoint.json')
    const changed = JSON.parse(fs.readFileSync(checkpointPath, 'utf8'))
    changed.execution.runId = '999'
    fs.writeFileSync(checkpointPath, `${JSON.stringify(changed)}\n`, { mode: 0o600 })
    let rehearsals = 0
    assert.throws(() => runResumeFromPackage(resumeRaw(value, value.root), {
      platform: 'linux', arch: 'x64', uid: 1000,
      runLocalRehearsal: () => { rehearsals += 1; return { receipt: { status: 'passed' } } },
      validateProofArtifactManifest: () => ({}), validateImageProofInput: () => ({}), validateBundleHandoff: () => ({}),
    }), /checkpoint certificate is invalid/)
    assert.equal(rehearsals, 0)
  } finally { fs.rmSync(value.root, { recursive: true, force: true }) }
})

test('positive resume invokes only the fresh rehearsal handoff', () => {
  const value = fixture()
  try {
    let called = 0
    const result = runResumeFromPackage(resumeRaw(value, value.root), {
      platform: 'linux', arch: 'x64', uid: 1000,
      validateProofArtifactManifest: () => ({}),
      validateImageProofInput: () => ({ imageReceiptSha256: '1'.repeat(64), proofReceiptSha256: '2'.repeat(64), artifactManifestSha256: '3'.repeat(64), value: { receiptSha256: '1'.repeat(64) } }),
      validateBundleHandoff: (_bundle, _trust, expected) => ({
        manifestSha256: '4'.repeat(64), archiveDigests: value.packageReceipt.bundle.archives,
        archiveFiles: Object.fromEntries(['SHA256SUMS', 'current.tar', 'next-transition.tar', 'previous-transition.tar'].map((name) => [name, { sha256: value.checkpoint.files.bundle[name].sha256 }])),
        trustFiles: Object.fromEntries(['public-key.pem', 'fingerprint.txt', 'receipt.json', 'onprem-offline-bootstrap-verify.mjs'].map((name) => [name, { sha256: value.checkpoint.files.trust[name].sha256 }])),
      }),
      parseRehearsalArguments: (args) => ({ args }),
      rehearsalDependencies: { preflight: () => ({ inputIdentity: { archiveDigests: value.packageReceipt.bundle.archives, trust: { fingerprint: '5'.repeat(64), publicKeySha256: '5'.repeat(64), bootstrapSha256: '6'.repeat(64) } } }) },
      runLocalRehearsal: (_options, deps) => { called += 1; assert.equal(typeof deps.preflight, 'function'); deps.preflight({}, {}); return { receipt: { status: 'passed' } } },
    })
    assert.equal(result.status, 'passed')
    assert.equal(called, 1)
  } finally { fs.rmSync(value.root, { recursive: true, force: true }) }
})

test('post-copy identity mismatch hard-stops before a resumed rehearsal can pass', () => {
  const value = fixture()
  try {
    let rehearsals = 0
    assert.throws(() => runResumeFromPackage(resumeRaw(value, value.root), {
      platform: 'linux', arch: 'x64', uid: 1000,
      validateProofArtifactManifest: () => ({}),
      validateImageProofInput: () => ({ imageReceiptSha256: '1'.repeat(64), proofReceiptSha256: '2'.repeat(64), artifactManifestSha256: '3'.repeat(64), value: { receiptSha256: '1'.repeat(64) } }),
      validateBundleHandoff: (_bundle, _trust, expected) => ({ manifestSha256: '4'.repeat(64), archiveDigests: value.packageReceipt.bundle.archives, archiveFiles: Object.fromEntries(['SHA256SUMS', 'current.tar', 'next-transition.tar', 'previous-transition.tar'].map((name) => [name, { sha256: value.checkpoint.files.bundle[name].sha256 }])), trustFiles: Object.fromEntries(['public-key.pem', 'fingerprint.txt', 'receipt.json', 'onprem-offline-bootstrap-verify.mjs'].map((name) => [name, { sha256: value.checkpoint.files.trust[name].sha256 }])) }),
      rehearsalDependencies: { preflight: () => ({ inputIdentity: { archiveDigests: { current: 'wrong' }, trust: { fingerprint: '5'.repeat(64), publicKeySha256: '5'.repeat(64), bootstrapSha256: '6'.repeat(64) } } }) },
      runLocalRehearsal: (_options, deps) => { deps.preflight({}, {}); rehearsals += 1; return { receipt: { status: 'passed' } } },
    }), /input identity does not match/)
    assert.equal(rehearsals, 0)
  } finally { fs.rmSync(value.root, { recursive: true, force: true }) }
})
