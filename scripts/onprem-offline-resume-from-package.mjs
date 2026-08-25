import fs from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'

import {
  PACKAGE_WORKFLOW_STEPS,
  extractPackageWorkflowBlocks,
  receiptSelfHash,
  stableJson,
  validateBundleHandoff,
  validateImageProofInput,
  validateProofArtifactManifest,
  workflowBodyDigest,
} from './onprem-offline-local-package.mjs'
import {
  parseCliArguments as parseRehearsalArguments,
  validatePreflight,
  runLocalRehearsal,
} from './onprem-offline-local-rehearsal.mjs'

const SCRIPT_ROOT = path.dirname(fileURLToPath(import.meta.url))
const REPOSITORY_ROOT = path.resolve(SCRIPT_ROOT, '..')
const SHA1 = /^[a-f0-9]{40}$/
const SHA256 = /^[a-f0-9]{64}$/
const POSITIVE = /^[1-9][0-9]*$/
const NODE_VERSION = 'v24.19.0'
const BUNDLE_FILES = Object.freeze(['SHA256SUMS', 'current.tar', 'next-transition.tar', 'previous-transition.tar'])
const TRUST_FILES = Object.freeze(['public-key.pem', 'fingerprint.txt', 'receipt.json', 'onprem-offline-bootstrap-verify.mjs'])
const CHECKPOINT_FILE = 'offline-package-checkpoint.json'
const EXPECTED_PACKAGE_PHASES = Object.freeze([PACKAGE_WORKFLOW_STEPS[0], 'validate-and-copy-proof-input', ...PACKAGE_WORKFLOW_STEPS.slice(1), 'verify-and-copy-handoff'])
const DISPOSABLE_ROOTS = Object.freeze(['/var/lib/hr-axis-onprem-rehearsal', '/var/lib/hr-axis-onprem-offline-proof', '/run/hr-axis-onprem-rehearsal-docker', '/run/hr-axis-onprem-offline-proof'])

const fail = (message) => { throw new Error(message) }
const object = (value) => value !== null && typeof value === 'object' && !Array.isArray(value)
const hashBytes = (value) => createHash('sha256').update(value).digest('hex')
const nativeReceiptSelfHash = (value) => {
  const copy = { ...value }
  delete copy.receiptSha256
  return hashBytes(JSON.stringify(copy))
}
function stableHashFile(filePath, label) {
  const before = fs.lstatSync(filePath)
  if (!before.isFile() || before.isSymbolicLink() || before.nlink !== undefined && before.nlink !== 1) fail(`${label} is not a stable regular file`)
  const bytes = fs.readFileSync(filePath)
  const after = fs.lstatSync(filePath)
  for (const field of ['dev', 'ino', 'size', 'mtimeMs', 'nlink', 'mode', 'uid', 'gid']) if (!Object.is(before[field], after[field])) fail(`${label} changed while being read`)
  if (bytes.length !== before.size) fail(`${label} changed while being read`)
  return hashBytes(bytes)
}
const checkpointSelfHash = (value) => {
  const copy = { ...value }
  delete copy.checkpointSha256
  return hashBytes(stableJson(copy))
}

function assertString(value, label) {
  if (typeof value !== 'string' || value.length === 0 || /[\0\r\n]/.test(value)) fail(`${label} is invalid`)
  return value
}

function assertHash(value, label, expression) {
  assertString(value, label)
  if (!expression.test(value)) fail(`${label} is invalid`)
  return value
}

function assertPositive(value, label) {
  assertString(value, label)
  if (!POSITIVE.test(value)) fail(`${label} must be a positive decimal number`)
  return value
}

function assertAbsolute(value, label) {
  assertString(value, label)
  if (!path.isAbsolute(value)) fail(`${label} must be absolute`)
  return path.resolve(value)
}

function isWithin(parent, candidate) {
  const root = path.resolve(parent)
  const target = path.resolve(candidate)
  return target === root || target.startsWith(`${root}${path.sep}`)
}

function assertNoSymlinkAncestors(target, label) {
  let cursor = path.resolve(target)
  const root = path.parse(cursor).root
  while (true) {
    let stats
    try { stats = fs.lstatSync(cursor) } catch { fail(`${label} cannot be checked safely`) }
    if (stats.isSymbolicLink()) fail(`${label} has a symlink ancestor`)
    if (cursor === root) return
    cursor = path.dirname(cursor)
  }
}

function privateDirectory(target, label, { allowMissing = false } = {}) {
  const absolute = assertAbsolute(target, label)
  if (allowMissing) {
    try { fs.lstatSync(absolute) } catch (error) {
      if (error?.code === 'ENOENT') return absolute
      fail(`${label} cannot be checked safely`)
    }
  }
  assertNoSymlinkAncestors(absolute, label)
  let stats
  try { stats = fs.lstatSync(absolute) } catch { fail(`${label} is missing`) }
  if (!stats.isDirectory() || stats.isSymbolicLink()) fail(`${label} must be a directory`)
  if (process.platform === 'linux') {
    if ((stats.mode & 0o077) !== 0) fail(`${label} must be private`)
    const uid = typeof process.getuid === 'function' ? process.getuid() : null
    if (Number.isInteger(uid) && uid > 0 && stats.uid !== 0 && stats.uid !== uid) fail(`${label} is not root- or caller-owned`)
  }
  return absolute
}

function regularFile(target, label) {
  const absolute = assertAbsolute(target, label)
  assertNoSymlinkAncestors(absolute, label)
  let stats
  try { stats = fs.lstatSync(absolute) } catch { fail(`${label} is missing`) }
  if (!stats.isFile() || stats.isSymbolicLink() || (stats.nlink !== undefined && stats.nlink !== 1)) fail(`${label} must be a regular file`)
  return absolute
}

function readJson(target, label) {
  const file = regularFile(target, label)
  const before = fs.lstatSync(file)
  const bytes = fs.readFileSync(file)
  const after = fs.lstatSync(file)
  for (const field of ['dev', 'ino', 'size', 'mtimeMs', 'nlink', 'mode', 'uid', 'gid']) if (!Object.is(before[field], after[field])) fail(`${label} changed while being read`)
  if (bytes.length !== before.size) fail(`${label} changed while being read`)
  try { return JSON.parse(bytes.toString('utf8')) } catch { fail(`${label} is invalid JSON`) }
}

function assertReceiptHash(receipt, label) {
  if (!object(receipt) || !SHA256.test(receipt.receiptSha256 ?? '') || receipt.receiptSha256 !== receiptSelfHash(receipt)) fail(`${label} self-hash is invalid`)
  return receipt
}

function assertNativeReceiptHash(receipt, label) {
  if (!object(receipt) || !SHA256.test(receipt.receiptSha256 ?? '') || receipt.receiptSha256 !== nativeReceiptSelfHash(receipt)) fail(`${label} self-hash is invalid`)
  return receipt
}

function assertPassedPhaseSet(phases, label, expectedNames) {
  if (!Array.isArray(phases) || phases.length !== expectedNames.length) fail(`${label} phases are missing or incomplete`)
  for (let index = 0; index < expectedNames.length; index += 1) {
    const phase = phases[index]
    if (!object(phase) || phase.name !== expectedNames[index] || phase.status !== 'passed' || phase.timedOut === true || phase.containmentComplete === false) fail(`${label} contains an unproved or out-of-order phase`)
  }
}

function packagePaths(sessionRoot) {
  return Object.freeze({
    sessionRoot,
    imageProofRoot: path.join(sessionRoot, 'image-proof'),
    imageReceipt: path.join(sessionRoot, 'image-proof.json'),
    nativeSessionReceipt: path.join(sessionRoot, 'native-session.json'),
    packageReceipt: path.join(sessionRoot, 'offline-package.json'),
    checkpoint: path.join(sessionRoot, CHECKPOINT_FILE),
    bundleRoot: path.join(sessionRoot, 'offline-bundle'),
    trustRoot: path.join(sessionRoot, 'offline-trust'),
  })
}

function checkpointFileHashes(paths, packageReceipt, nativeReceipt) {
  const manifest = readJson(path.join(paths.imageProofRoot, 'artifact-manifest.json'), 'image proof artifact manifest')
  const producer = manifest.artifacts?.find((entry) => entry?.path === 'onprem-image-proof/onprem-proof-receipt.json')
  if (!producer) fail('image proof producer receipt is missing from the manifest')
  const image = {
    receipt: { path: 'image-proof.json', sha256: stableHashFile(paths.imageReceipt, 'image proof receipt') },
    manifest: { path: 'image-proof/artifact-manifest.json', sha256: stableHashFile(path.join(paths.imageProofRoot, 'artifact-manifest.json'), 'image proof manifest') },
    producer: { path: `image-proof/${producer.path}`, sha256: stableHashFile(path.join(paths.imageProofRoot, ...producer.path.split('/')), 'image proof producer receipt') },
  }
  const bundle = Object.fromEntries(BUNDLE_FILES.map((name) => [name, { path: `offline-bundle/${name}`, sha256: stableHashFile(path.join(paths.bundleRoot, name), `bundle ${name}`) }]))
  const trust = Object.fromEntries(TRUST_FILES.map((name) => [name, { path: `offline-trust/${name}`, sha256: stableHashFile(path.join(paths.trustRoot, name), `trust ${name}`) }]))
  return {
    packageReceipt: { path: 'offline-package.json', sha256: stableHashFile(paths.packageReceipt, 'offline package receipt'), receiptSha256: packageReceipt.receiptSha256 },
    nativeSession: { path: 'native-session.json', sha256: stableHashFile(paths.nativeSessionReceipt, 'native session receipt'), receiptSha256: nativeReceipt.receiptSha256 },
    image, bundle, trust,
  }
}

export function buildPackageCheckpoint(options, packageResult, nativeReceipt) {
  if (!object(options) || !object(packageResult) || packageResult.status !== 'passed') fail('a passed package result is required for checkpoint creation')
  const paths = packagePaths(options.sessionRoot)
  if (packageResult.receipt !== paths.packageReceipt || packageResult.outputRoot !== paths.bundleRoot || packageResult.trustRoot !== paths.trustRoot) fail('package result paths do not match checkpoint session')
  const packageReceipt = assertReceiptHash(readJson(paths.packageReceipt, 'offline package receipt'), 'offline package receipt')
  const native = assertNativeReceiptHash(nativeReceipt ?? readJson(paths.nativeSessionReceipt, 'native session receipt'), 'native session receipt')
  const files = checkpointFileHashes(paths, packageReceipt, native)
  const value = {
    schemaVersion: 1,
    tool: 'onprem-offline-package-checkpoint',
    status: 'passed',
    hostedEvidence: false,
    dataClass: 'synthetic',
    execution: {
      sourceSha: options.sourceSha,
      treeSha: options.treeSha,
      runNumber: String(options.runNumber),
      runId: String(options.runId),
      runAttempt: String(options.runAttempt),
      node: { path: options.node, version: packageReceipt.runner?.node?.version ?? NODE_VERSION, sha256: options.nodeSha256 },
    },
    package: {
      receiptSha256: packageReceipt.receiptSha256,
      workflow: packageReceipt.workflow,
      imageProof: packageReceipt.imageProof,
      bundle: packageReceipt.bundle,
      trust: packageReceipt.trust,
    },
    files,
  }
  return Object.freeze({ ...value, checkpointSha256: checkpointSelfHash(value) })
}

export function writePackageCheckpoint(options, packageResult, nativeReceipt) {
  const paths = packagePaths(options.sessionRoot)
  const checkpoint = buildPackageCheckpoint(options, packageResult, nativeReceipt)
  const temporary = `${paths.checkpoint}.tmp-${process.pid}`
  fs.writeFileSync(temporary, `${stableJson(checkpoint)}\n`, { mode: 0o600, flag: 'wx' })
  try {
    fs.chmodSync(temporary, 0o600)
    fs.renameSync(temporary, paths.checkpoint)
  } catch (error) {
    try { fs.rmSync(temporary, { force: true }) } catch { /* preserve the original write failure */ }
    throw error
  }
  return Object.freeze({ path: paths.checkpoint, checkpoint })
}

function assertExactSource(receipt, sourceSha, treeSha, label) {
  if (!object(receipt?.source) || receipt.source.sourceSha !== sourceSha || receipt.source.treeSha !== treeSha) fail(`${label} source identity does not match`)
}

function validateNativeSessionCheckpoint(nativeReceipt, options, imageFacts) {
  assertNativeReceiptHash(nativeReceipt, 'native session receipt')
  if (nativeReceipt.status !== 'passed' || nativeReceipt.operation !== 'local-native-session') fail('native session checkpoint is not passed')
  assertExactSource(nativeReceipt, options.sourceSha, options.treeSha, 'native session checkpoint')
  if (nativeReceipt.runner?.path !== options.nodePath || nativeReceipt.runner?.version !== NODE_VERSION || nativeReceipt.runner?.sha256 !== options.nodeSha256) fail('native session Node identity does not match')
  if (nativeReceipt.image?.status !== 'passed' || (nativeReceipt.image.receiptSha256 !== imageFacts.value.receiptSha256 && nativeReceipt.image.receiptSha256 !== imageFacts.imageReceiptSha256)) fail('native session image identity is not bound')
  if (nativeReceipt.cleanup?.status !== undefined && nativeReceipt.cleanup.status !== 'passed') fail('native session cleanup is not passed')
  if (nativeReceipt.recovery?.dockerDaemonReset !== true || nativeReceipt.recovery?.verifiedHost?.inventory?.containers !== 0 || nativeReceipt.recovery?.verifiedHost?.inventory?.networks !== 0 || nativeReceipt.recovery?.verifiedHost?.inventory?.volumes !== 0 || nativeReceipt.recovery?.verifiedHost?.inventory?.images !== 0) fail('native session host reset is not proved')
}

export function parseResumeArguments(argv) {
  if (!Array.isArray(argv)) fail('CLI arguments are required')
  if (argv.length === 1 && argv[0] === '--help') return Object.freeze({ help: true })
  const names = new Map([
    ['--session-root', 'sessionRoot'], ['--run-root', 'runRoot'], ['--receipt', 'receiptPath'], ['--source-sha', 'sourceSha'], ['--tree-sha', 'treeSha'],
    ['--run-id', 'runId'], ['--run-attempt', 'runAttempt'], ['--node', 'nodePath'], ['--node-sha256', 'nodeSha256'], ['--workspace-root', 'workspaceRoot'],
  ])
  const flags = new Map([
    ['--resume-from-package', 'resumeFromPackage'], ['--confirm-disposable-native-host', 'confirmDisposableNativeHost'], ['--allow-disposable-daemon-reset', 'allowDisposableDaemonReset'],
  ])
  const parsed = {}
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index]
    if (flags.has(token)) {
      const key = flags.get(token)
      if (Object.hasOwn(parsed, key)) fail(`duplicate option: ${token}`)
      parsed[key] = true
      continue
    }
    if (!names.has(token)) fail(`unknown or positional argument: ${token}`)
    const key = names.get(token)
    if (Object.hasOwn(parsed, key)) fail(`duplicate option: ${token}`)
    const value = argv[index + 1]
    if (!value || value.startsWith('--')) fail(`missing value for ${token}`)
    parsed[key] = value
    index += 1
  }
  for (const key of ['resumeFromPackage', 'confirmDisposableNativeHost', 'allowDisposableDaemonReset', 'sessionRoot', 'runRoot', 'receiptPath', 'sourceSha', 'treeSha', 'runId', 'runAttempt', 'nodePath', 'nodeSha256']) if (!Object.hasOwn(parsed, key)) fail(`missing required option: ${key === 'resumeFromPackage' ? '--resume-from-package' : key}`)
  return Object.freeze(parsed)
}

export function validateResumeOptions(raw, dependencies = {}) {
  if (!object(raw)) fail('resume options are required')
  if (raw.resumeFromPackage !== true || raw.confirmDisposableNativeHost !== true || raw.allowDisposableDaemonReset !== true) fail('resume requires both disposable-host confirmations and --resume-from-package')
  const platform = dependencies.platform ?? process.platform
  const arch = dependencies.arch ?? process.arch
  const uid = dependencies.uid ?? (typeof process.getuid === 'function' ? process.getuid() : null)
  if (platform !== 'linux') fail('offline package resume requires Linux')
  if (!Number.isInteger(uid) || uid <= 0) fail('offline package resume requires a non-root caller')
  if (arch !== 'x64' && arch !== 'amd64') fail('offline package resume requires Linux amd64')
  const workspaceRoot = path.resolve(raw.workspaceRoot ?? REPOSITORY_ROOT)
  if (fs.realpathSync(workspaceRoot) !== fs.realpathSync(REPOSITORY_ROOT)) fail('workspace root must resolve to this checkout')
  const sessionRoot = privateDirectory(raw.sessionRoot, 'session root')
  const runRoot = assertAbsolute(raw.runRoot, 'run root')
  const receiptPath = assertAbsolute(raw.receiptPath, 'receipt path')
  if (fs.existsSync(runRoot)) fail('run root must be fresh and absent')
  if (fs.existsSync(receiptPath)) fail('receipt path must be fresh and absent')
  if (isWithin(workspaceRoot, runRoot) || isWithin(workspaceRoot, receiptPath)) fail('resume outputs may not be inside the checkout')
  if (isWithin(sessionRoot, runRoot) || isWithin(sessionRoot, receiptPath)) fail('resume outputs must be external to the package checkpoint')
  if (DISPOSABLE_ROOTS.some((root) => isWithin(root, runRoot) || isWithin(root, receiptPath))) fail('resume outputs may not be inside disposable daemon roots')
  privateDirectory(path.dirname(runRoot), 'run root parent')
  privateDirectory(path.dirname(receiptPath), 'receipt parent')
  if (isWithin(runRoot, receiptPath) || isWithin(receiptPath, runRoot)) fail('resume output paths may not overlap')
  assertNoSymlinkAncestors(path.dirname(runRoot), 'run root parent')
  assertNoSymlinkAncestors(path.dirname(receiptPath), 'receipt parent')
  if (path.resolve(receiptPath) === path.resolve(path.join(sessionRoot, 'offline-package.json'))) fail('resume receipt may not overwrite the package checkpoint')
  return Object.freeze({
    resumeFromPackage: true,
    confirmDisposableNativeHost: true,
    allowDisposableDaemonReset: true,
    sessionRoot,
    runRoot,
    receiptPath,
    sourceSha: assertHash(raw.sourceSha, 'source SHA', SHA1),
    treeSha: assertHash(raw.treeSha, 'tree SHA', SHA1),
    runId: assertPositive(raw.runId, 'run ID'),
    runAttempt: assertPositive(raw.runAttempt, 'run attempt'),
    nodePath: assertAbsolute(raw.nodePath, 'pinned Node'),
    nodeSha256: assertHash(raw.nodeSha256, 'Node SHA-256', SHA256),
    workspaceRoot,
  })
}

export function validatePackageCheckpoint(options, dependencies = {}) {
  const paths = packagePaths(options.sessionRoot)
  const allowedSessionEntries = new Set(['image-proof', 'image-proof.json', 'native-provision.json', 'native-session.json', 'offline-package.json', CHECKPOINT_FILE, 'offline-bundle', 'offline-trust', 'offline-rehearsal-run', 'offline-rehearsal.json'])
  for (const entry of fs.readdirSync(options.sessionRoot)) if (!allowedSessionEntries.has(entry)) fail(`session root contains unsupported checkpoint entry: ${entry}`)
  privateDirectory(paths.imageProofRoot, 'checkpoint image proof root')
  privateDirectory(paths.bundleRoot, 'checkpoint bundle root')
  privateDirectory(paths.trustRoot, 'checkpoint trust root')
  const checkpoint = readJson(paths.checkpoint, 'offline package checkpoint')
  if (!object(checkpoint) || checkpoint.tool !== 'onprem-offline-package-checkpoint' || checkpoint.status !== 'passed' || checkpoint.hostedEvidence !== false || checkpoint.dataClass !== 'synthetic' || !SHA256.test(checkpoint.checkpointSha256 ?? '') || checkpoint.checkpointSha256 !== checkpointSelfHash(checkpoint)) fail('offline package checkpoint certificate is invalid')
  if (checkpoint.execution?.sourceSha !== options.sourceSha || checkpoint.execution?.treeSha !== options.treeSha || checkpoint.execution?.node?.path !== options.nodePath || checkpoint.execution?.node?.sha256 !== options.nodeSha256 || checkpoint.execution?.node?.version !== NODE_VERSION) fail('offline package checkpoint execution identity does not match')
  for (const key of ['runNumber', 'runId', 'runAttempt']) if (!POSITIVE.test(String(checkpoint.execution?.[key] ?? ''))) fail(`offline package checkpoint ${key} is invalid`)
  if (!object(checkpoint.files) || !object(checkpoint.package) || !object(checkpoint.package.workflow)) fail('offline package checkpoint certificate is incomplete')
  const checkpointPaths = [checkpoint.files.packageReceipt, checkpoint.files.nativeSession, checkpoint.files.image?.receipt, checkpoint.files.image?.manifest, checkpoint.files.image?.producer, ...BUNDLE_FILES.map((name) => checkpoint.files.bundle?.[name]), ...TRUST_FILES.map((name) => checkpoint.files.trust?.[name])]
  if (checkpointPaths.some((entry) => !object(entry) || typeof entry.path !== 'string' || !SHA256.test(entry.sha256 ?? ''))) fail('offline package checkpoint file bindings are incomplete')
  const expectedRelative = new Set(['offline-package.json', 'native-session.json', 'image-proof.json', 'image-proof/artifact-manifest.json', 'image-proof/onprem-image-proof/onprem-proof-receipt.json', ...BUNDLE_FILES.map((name) => `offline-bundle/${name}`), ...TRUST_FILES.map((name) => `offline-trust/${name}`)])
  for (const entry of checkpointPaths) if (!expectedRelative.has(entry.path)) fail('offline package checkpoint file binding is unsafe')
  for (const entry of checkpointPaths) {
    const target = path.join(options.sessionRoot, entry.path)
    if (stableHashFile(regularFile(target, `checkpoint file ${entry.path}`), `checkpoint file ${entry.path}`) !== entry.sha256) fail(`offline package checkpoint file changed: ${entry.path}`)
  }
  const packageReceipt = assertReceiptHash(readJson(paths.packageReceipt, 'offline package checkpoint'), 'offline package checkpoint')
  if (packageReceipt.status !== 'passed' || packageReceipt.tool !== 'onprem-offline-local-package') fail('offline package checkpoint is not passed')
  assertExactSource(packageReceipt, options.sourceSha, options.treeSha, 'offline package checkpoint')
  if (packageReceipt.execution?.runNumber !== checkpoint.execution.runNumber || packageReceipt.execution?.runId !== checkpoint.execution.runId || packageReceipt.execution?.runAttempt !== checkpoint.execution.runAttempt) fail('offline package checkpoint run identity does not match')
  if (checkpoint.package.receiptSha256 !== packageReceipt.receiptSha256 || checkpoint.files.packageReceipt.receiptSha256 !== packageReceipt.receiptSha256) fail('offline package checkpoint receipt binding does not match')
  if (stableJson(checkpoint.package.workflow) !== stableJson(packageReceipt.workflow) || stableJson(checkpoint.package.imageProof) !== stableJson(packageReceipt.imageProof) || stableJson(checkpoint.package.bundle) !== stableJson(packageReceipt.bundle) || stableJson(checkpoint.package.trust) !== stableJson(packageReceipt.trust)) fail('offline package checkpoint package identity does not match')
  if (packageReceipt.runner?.platform !== 'linux' || packageReceipt.runner?.executionCheckout !== 'detached-disposable' || packageReceipt.runner?.node?.version !== NODE_VERSION || packageReceipt.runner.node.sha256 !== options.nodeSha256) fail('offline package checkpoint Node identity does not match')
  if (packageReceipt.reset?.attempted !== true || packageReceipt.reset.status !== 'passed' || packageReceipt.reset.afterEmpty !== true) fail('offline package checkpoint reset is not proved')
  if (packageReceipt.cleanup?.runnerTemp !== 'removed' || packageReceipt.cleanup?.hostLock !== 'released' || packageReceipt.cleanup?.privateKeyPreserved !== false || packageReceipt.failure !== null) fail('offline package checkpoint cleanup is not complete')
  assertPassedPhaseSet(packageReceipt.phases, 'offline package checkpoint', EXPECTED_PACKAGE_PHASES)

  const workflowPath = path.join(options.workspaceRoot, '.github', 'workflows', 'onprem-offline-proof.yml')
  regularFile(workflowPath, 'offline workflow')
  if (packageReceipt.workflow?.path !== '.github/workflows/onprem-offline-proof.yml' || packageReceipt.workflow?.sha256 !== stableHashFile(workflowPath, 'offline workflow')) fail('offline package checkpoint workflow hash does not match')
  const blocks = extractPackageWorkflowBlocks(workflowPath)
  if (packageReceipt.workflow?.bodySha256 !== workflowBodyDigest(blocks)) fail('offline package checkpoint workflow body hash does not match')
  if (!object(packageReceipt.workflow?.bodies) || Object.keys(packageReceipt.workflow.bodies).join('\u0000') !== PACKAGE_WORKFLOW_STEPS.join('\u0000')) fail('offline package checkpoint workflow body set is invalid')
  for (const marker of PACKAGE_WORKFLOW_STEPS) if (packageReceipt.workflow.bodies[marker] !== blocks[marker].bodySha256) fail(`offline package checkpoint workflow body changed: ${marker}`)

  const manifestFacts = (dependencies.validateProofArtifactManifest ?? validateProofArtifactManifest)(paths.imageProofRoot, { sourceSha: options.sourceSha, platform: 'linux', uid: dependencies.uid ?? process.getuid?.() })
  const imageFacts = (dependencies.validateImageProofInput ?? validateImageProofInput)({ imageProofRoot: paths.imageProofRoot, imageReceipt: paths.imageReceipt, sourceSha: options.sourceSha, treeSha: options.treeSha, nodeSha256: options.nodeSha256, platform: 'linux', uid: dependencies.uid ?? process.getuid?.() }, manifestFacts)
  if (packageReceipt.imageProof?.imageReceiptSha256 !== imageFacts.imageReceiptSha256 || packageReceipt.imageProof?.proofReceiptSha256 !== imageFacts.proofReceiptSha256 || packageReceipt.imageProof?.artifactManifestSha256 !== imageFacts.artifactManifestSha256) fail('offline package checkpoint image identity does not match')

  const nativeReceipt = readJson(paths.nativeSessionReceipt, 'native session checkpoint')
  validateNativeSessionCheckpoint(nativeReceipt, options, imageFacts)
  if (checkpoint.files.nativeSession.receiptSha256 !== nativeReceipt.receiptSha256) fail('offline package checkpoint native receipt binding does not match')
  const releaseId = packageReceipt.bundle?.releaseId
  const keyFingerprint = packageReceipt.trust?.keyFingerprint ?? packageReceipt.bundle?.keyFingerprint
  const bootstrapSha256 = packageReceipt.trust?.bootstrapSha256 ?? packageReceipt.bundle?.bootstrapSha256
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,200}$/.test(releaseId ?? '') || !SHA256.test(keyFingerprint ?? '') || !SHA256.test(bootstrapSha256 ?? '')) fail('offline package checkpoint handoff identity is invalid')
  const handoff = (dependencies.validateBundleHandoff ?? validateBundleHandoff)(paths.bundleRoot, paths.trustRoot, { sourceSha: options.sourceSha, releaseId, keyFingerprint, bootstrapSha256 })
  if (handoff.manifestSha256 !== packageReceipt.bundle.archiveManifestSha256) fail('offline package checkpoint archive identity does not match')
  if (stableJson(handoff.archiveDigests) !== stableJson(packageReceipt.bundle.archives)) fail('offline package checkpoint archive digests do not match')
  for (const name of BUNDLE_FILES) if (handoff.archiveFiles?.[name]?.sha256 !== checkpoint.files.bundle?.[name]?.sha256) fail(`offline package checkpoint bundle file changed: ${name}`)
  for (const name of TRUST_FILES) if (handoff.trustFiles?.[name]?.sha256 !== checkpoint.files.trust?.[name]?.sha256) fail(`offline package checkpoint trust file changed: ${name}`)
  return Object.freeze({ paths, packageReceipt, nativeReceipt, imageFacts, handoff: Object.freeze({ releaseId, manifestSha256: handoff.manifestSha256, keyFingerprint, bootstrapSha256 }) })
}

function rehearsalArguments(options, checkpoint) {
  return [
    '--allow-disposable-daemon-reset', '--bundle-root', checkpoint.paths.bundleRoot, '--trust-root', checkpoint.paths.trustRoot,
    '--manifest-sha256', checkpoint.handoff.manifestSha256, '--release-id', checkpoint.handoff.releaseId, '--trusted-fingerprint', checkpoint.handoff.keyFingerprint,
    '--bootstrap-sha256', checkpoint.handoff.bootstrapSha256, '--node', options.nodePath, '--node-sha256', options.nodeSha256,
    '--source-sha', options.sourceSha, '--tree-sha', options.treeSha, '--run-id', options.runId, '--run-attempt', options.runAttempt,
    '--receipt', options.receiptPath, '--workspace-root', options.workspaceRoot, '--run-root', options.runRoot,
  ]
}

export function runResumeFromPackage(rawOptions, dependencies = {}) {
  const options = validateResumeOptions(rawOptions, dependencies)
  if (typeof dependencies.env === 'object') {
    for (const name of Object.keys(dependencies.env)) if (/^DOCKER_/i.test(name)) fail(`${name} override is not allowed`)
  }
  const checkpoint = validatePackageCheckpoint(options, dependencies)
  const parse = dependencies.parseRehearsalArguments ?? parseRehearsalArguments
  const rehearsal = dependencies.runLocalRehearsal ?? runLocalRehearsal
  const parsed = parse(rehearsalArguments(options, checkpoint))
  const rehearsalDependencies = { ...(dependencies.rehearsalDependencies ?? {}) }
  const basePreflight = rehearsalDependencies.preflight ?? validatePreflight
  rehearsalDependencies.preflight = (context, preflightOptions) => {
    const result = basePreflight(context, preflightOptions)
    const expectedArchives = checkpoint.packageReceipt.bundle?.archives
    if (!object(result?.inputIdentity) || stableJson(result.inputIdentity.archiveDigests) !== stableJson(expectedArchives) || result.inputIdentity.trust?.fingerprint !== checkpoint.handoff.keyFingerprint || result.inputIdentity.trust?.publicKeySha256 !== checkpoint.handoff.keyFingerprint || result.inputIdentity.trust?.bootstrapSha256 !== checkpoint.handoff.bootstrapSha256) fail('resumed rehearsal input identity does not match package checkpoint')
    return result
  }
  const result = rehearsal(parsed, rehearsalDependencies)
  if (!object(result) || !object(result.receipt) || result.receipt.status !== 'passed') fail('resumed offline rehearsal did not return a passed receipt')
  return Object.freeze({ status: 'passed', checkpoint, receipt: options.receiptPath, rehearsal: result.receipt })
}

export function helpText() {
  return 'Usage: node scripts/onprem-offline-resume-from-package.mjs --resume-from-package --confirm-disposable-native-host --allow-disposable-daemon-reset --session-root EXISTING_PACKAGE_SESSION --run-root FRESH_RUN_ROOT --receipt FRESH_RECEIPT --source-sha SHA1 --tree-sha SHA1 --run-id N --run-attempt N --node ABS --node-sha256 SHA256 [--workspace-root ABS]\n\nReuses only a passed, self-hashed offline-package.json plus its exact bundle/trust handoff. It revalidates image/native/workflow identity, requires a fresh rehearsal root and receipt, and always runs the complete ordered offline rehearsal including rollback, egress restore, receipt materialization, and cleanup. It never resumes from a log line or skips a mutable phase.\n'
}

function main() {
  try {
    const options = parseResumeArguments(process.argv.slice(2))
    if (options.help) { process.stdout.write(helpText()); return }
    const result = runResumeFromPackage(options)
    process.stdout.write(`offline package resume ${result.status}: ${result.receipt}\n`)
  } catch (error) {
    process.stderr.write(`offline package resume stopped: ${error instanceof Error ? error.message : 'unknown error'}\n`)
    process.exitCode = 1
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) main()
