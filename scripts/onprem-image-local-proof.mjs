import { spawn, spawnSync } from 'node:child_process'
import {
  chmodSync,
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  realpathSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { createHash } from 'node:crypto'
import { dirname, basename, isAbsolute, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  acquireVerifiedHost,
  captureFirewallSnapshots,
  compareFirewallSnapshots,
  cleanupFreshWorkspace,
  DEFAULT_RECOVERY_BUDGET_MS,
  DISPOSABLE_DAEMON_ROOTS,
  recoverDedicatedHost,
  removePartialProofOutput,
} from './onprem-image-local-proof-recovery.mjs'

const SCRIPT_PATH = fileURLToPath(import.meta.url)
const CHECKOUT_ROOT = realpathSync(join(dirname(SCRIPT_PATH), '..'))
const WORKFLOW_RELATIVE_PATH = '.github/workflows/onprem-image-proof.yml'
const SOURCE_SHA = /^[a-f0-9]{40}$/
const SHA256 = /^[a-f0-9]{64}$/
const POSITIVE_INTEGER = /^[1-9][0-9]*$/
const SAFE_ENV_NAME = /^[A-Z_][A-Z0-9_]*$/
const FULL_PROOF_STEPS = Object.freeze([
  'Validate full proof inputs and exact checkout',
  'Pull pinned Keycloak base and build the optimized ONP-3B image',
  'Build dedicated images with synthetic inputs',
  'Prove ONP-2 static Compose, network, and firewall contracts',
  'Prove ONP-3B production-shaped Keycloak contracts',
  'Prove non-root image users',
  'Prove capability-free Caddy bootstrap under production restrictions',
  'Prove the pruned backend dependency graph and lazy runtime features',
  'Start frontend with read-only root and least privilege',
  'Start API and worker from the same backend image',
  'Generate SPDX SBOMs with pinned Syft',
  'Fail closed on image vulnerabilities and secrets with pinned Trivy',
  'Export final filesystems and layers then run content guards',
  'Generate signed complete content-guard index',
  'Generate production license inventories and notices',
  'Generate sanitized Keycloak image manifest',
  'Self-test signed synthetic release manifest',
  'Prepare UID-bound ephemeral synthetic secret files',
  'Run mandatory fresh-volume core proof behind a reversible firewall',
  'Run mandatory synthetic SeaweedFS photo-storage proof',
  'Generate SeaweedFS storage SBOM, license, and vulnerability evidence',
  'Emit fresh full proof identity and receipt',
])
const ACTION_STEPS = Object.freeze([
  'Checkout',
  'Pin host proof toolchain to the image build Node line',
  'Upload sanitized runtime receipt',
  'Upload sanitized Keycloak runtime receipt',
  'Upload sanitized photo-storage proof and supply-chain evidence',
  'Upload sanitized proof artifacts',
])
const FULL_PROOF_UPLOAD_CONTRACT = Object.freeze([
  Object.freeze({
    name: 'Upload sanitized runtime receipt',
    artifactName: 'onprem-core-runtime-proof-${{ github.sha }}',
    ifNoFilesFound: 'error',
    paths: Object.freeze(['${{ runner.temp }}/onprem-core-runtime-receipt.json']),
  }),
  Object.freeze({
    name: 'Upload sanitized Keycloak runtime receipt',
    artifactName: 'onprem-keycloak-runtime-proof-${{ github.sha }}',
    ifNoFilesFound: 'error',
    paths: Object.freeze(['${{ runner.temp }}/onprem-keycloak-runtime-receipt.json']),
  }),
  Object.freeze({
    name: 'Upload sanitized photo-storage proof and supply-chain evidence',
    artifactName: 'onprem-photo-storage-proof-${{ github.sha }}',
    ifNoFilesFound: 'error',
    paths: Object.freeze([
      '${{ runner.temp }}/onprem-photo-storage-runtime-receipt.json',
      'proof/photo-storage-sbom.spdx.json',
      'proof/photo-storage-trivy.json',
      'proof/photo-storage-license-receipt.json',
    ]),
  }),
  Object.freeze({
    name: 'Upload sanitized proof artifacts',
    artifactName: 'onprem-image-proof-${{ github.sha }}',
    ifNoFilesFound: 'error',
    paths: Object.freeze([
      'proof/*-content-guard.json',
      'proof/*-sbom.spdx.json',
      'proof/*-trivy.json',
      'proof/*-license-inventory.json',
      'proof/*-image-license-reconciliation.json',
      'proof/base-license-evidence/**',
      'proof/base-license-evidence.tar',
      'proof/*-THIRD_PARTY_NOTICES.txt',
      'proof/keycloak-image-manifest.json',
      'proof/keycloak-LICENSE.txt',
      'proof/keycloak-license-paths.txt',
      'proof/keycloak-license-reconciliation.json',
      'proof/keycloak-license-evidence.tar',
      'proof/backend-image.tar',
      'proof/frontend-image.tar',
      'proof/keycloak-image.tar',
      'proof/release-manifest.json',
      'proof/onprem-proof-receipt.json',
      'proof/content-guard-index.json',
      'proof/content-guard-index-public.pem',
      'proof/ephemeral-public.pem',
    ]),
  }),
])
const STEP_ENV_KEYS = Object.freeze({
  'Validate full proof inputs and exact checkout': ['EXPECTED_SHA', 'PROOF_MODE', 'IMAGE_SCOPE'],
  'Build dedicated images with synthetic inputs': ['SOURCE_REVISION', 'BUILD_VERSION'],
  'Self-test signed synthetic release manifest': ['SOURCE_REVISION', 'BUILD_VERSION'],
  'Prepare UID-bound ephemeral synthetic secret files': ['RELEASE_ID'],
  'Run mandatory fresh-volume core proof behind a reversible firewall': ['RELEASE_ID'],
  'Run mandatory synthetic SeaweedFS photo-storage proof': ['RELEASE_ID'],
  'Emit fresh full proof identity and receipt': ['EXPECTED_SHA'],
})
const PERSISTED_GITHUB_ENV_KEYS = Object.freeze(new Set(['KEYCLOAK_IMAGE_ID', 'BUILD_TIMESTAMP', 'ONPREM_CORE_ENV']))
const TARGET_PROJECTS = Object.freeze(['hr-axis-onprem-core', 'hr-axis-onprem-keycloak', 'hr-axis-onprem-photo-storage'])
const RUNNER_FIREWALL_CHAINS = Object.freeze([
  ['iptables', 'HR_AXIS_OFF_DOCKER_EGRESS'],
  ['iptables', 'HR_AXIS_OFFLINE_HOST_EGRESS'],
  ['ip6tables', 'HR_AXIS_OFFLINE_HOST6_EGRESS'],
])
const REQUIRED_HOST_TOOLS = Object.freeze([
  'bash', 'git', 'docker', 'sudo', 'node', 'sha256sum', 'jq', 'tar', 'curl', 'openssl',
  'awk', 'grep', 'sed', 'tee', 'mktemp', 'apt-get', 'iptables', 'iptables-save',
  'iptables-restore', 'ip6tables', 'ip6tables-save', 'ip6tables-restore',
])
const DEFAULT_DEADLINE_MINUTES = 60
const MAX_DEADLINE_MINUTES = 60
const MAX_FAILURE_LENGTH = 320
const ROOT_DOCKER_SOCKET = 'unix:///var/run/docker.sock'
const DEDICATED_DOCKER_ROOT = '/var/lib/hr-axis-onprem-rehearsal/docker'
const ROOT_DOCKER_ENV = Object.freeze({
  LANG: 'C',
  LC_ALL: 'C',
  PATH: '/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin',
})
// Process-group containment is part of the proof contract.  The workflow body
// may create children which outlive the bash leader, so a successful leader
// exit is not sufficient evidence that the phase is safe to continue.
const PROCESS_GROUP_TERM_GRACE_MS = 2_000
const PROCESS_GROUP_KILL_GRACE_MS = 1_000
const PROCESS_GROUP_POLL_MS = 50

const fail = (message) => { throw new Error(message) }
const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value)
const isPortableAbsolute = (value) => isAbsolute(value) || /^[A-Za-z]:[\\/]/.test(value)
const normalizedPath = (value) => value.split(sep).join('/')

function assertString(value, label, { allowNewlines = false } = {}) {
  if (typeof value !== 'string' || value.length === 0 || (allowNewlines ? /[\0]/ : /[\0\r\n]/).test(value)) fail(`${label} is invalid`)
  return value
}

function assertHash(value, label, pattern = SHA256) {
  if (typeof value !== 'string' || !pattern.test(value)) fail(`${label} is invalid`)
  return value
}

function stripYamlScalar(value) {
  const text = String(value ?? '').trim()
  if ((text.startsWith("'") && text.endsWith("'")) || (text.startsWith('"') && text.endsWith('"'))) {
    return text.slice(1, -1)
  }
  return text
}

function unindentBlock(lines, indentation) {
  const body = []
  for (const line of lines) {
    if (line.trim() === '') { body.push(''); continue }
    if (line.trim().startsWith('#') && (line.match(/^\s*/)?.[0].length ?? 0) < indentation) continue
    const spaces = line.match(/^\s*/)?.[0].length ?? 0
    if (spaces < indentation) fail('workflow run block indentation is malformed')
    body.push(line.slice(indentation))
  }
  if (!body.some((line) => line.trim() !== '')) fail('workflow run block is empty')
  return `${body.join('\n')}\n`
}

function findJobSection(source, name) {
  const lines = source.split(/\r?\n/)
  const start = lines.findIndex((line) => line === `  ${name}:`)
  if (start < 0) fail(`workflow job is missing: ${name}`)
  const next = lines.findIndex((line, index) => index > start && /^  [a-z][a-z0-9_-]*:\s*$/.test(line))
  return lines.slice(start, next < 0 ? lines.length : next)
}

function parseWorkflowEnv(source) {
  const lines = source.split(/\r?\n/)
  const start = lines.findIndex((line) => line === 'env:')
  if (start < 0) fail('workflow top-level env mapping is missing')
  const end = lines.findIndex((line, index) => index > start && line === 'jobs:')
  if (end < 0) fail('workflow jobs mapping is missing')
  const output = {}
  for (const line of lines.slice(start + 1, end)) {
    if (!line.trim() || line.trim().startsWith('#')) continue
    const match = line.match(/^  ([A-Z_][A-Z0-9_]*):(?:\s*(.*))?$/)
    if (!match) fail('workflow top-level env mapping is malformed')
    const [, key, raw] = match
    if (Object.hasOwn(output, key)) fail(`duplicate workflow env key: ${key}`)
    output[key] = stripYamlScalar(raw ?? '')
  }
  return output
}

function parseEnvBlock(lines) {
  const start = lines.findIndex((line) => line === '        env:')
  if (start < 0) return {}
  const result = {}
  for (let index = start + 1; index < lines.length; index += 1) {
    const line = lines[index]
    if (line.trim() === '') continue
    if (/^        \S/.test(line)) break
    const match = line.match(/^          ([A-Z_][A-Z0-9_]*):(?:\s*(.*))?$/)
    if (!match) fail('workflow step env mapping is malformed')
    const [, key, raw] = match
    if (Object.hasOwn(result, key)) fail(`duplicate step env key: ${key}`)
    result[key] = stripYamlScalar(raw ?? '')
  }
  return result
}

function parseWithBlock(lines) {
  const start = lines.findIndex((line) => line === '        with:')
  if (start < 0) return {}
  const result = {}
  for (let index = start + 1; index < lines.length; index += 1) {
    const line = lines[index]
    if (line.trim() === '') continue
    if (/^        \S/.test(line)) break
    const match = line.match(/^          ([a-z][a-z0-9-]*):(?:\s*(.*))?$/)
    if (!match) fail('workflow action with mapping is malformed')
    const [, key, raw] = match
    if (Object.hasOwn(result, key)) fail(`duplicate action with key: ${key}`)
    if (raw === '|') {
      const block = []
      for (index += 1; index < lines.length; index += 1) {
        const nested = lines[index]
        if (nested.trim() !== '' && !/^            /.test(nested)) { index -= 1; break }
        block.push(nested.trim() === '' ? '' : nested.slice(12))
      }
      result[key] = block.join('\n').replace(/\n+$/, '')
    } else {
      result[key] = stripYamlScalar(raw ?? '')
    }
  }
  return result
}

function parseStepSection(lines) {
  const names = lines.filter((line) => /^      - name: /.test(line))
  if (names.length !== 1) fail('workflow step section is malformed')
  const name = names[0].slice('      - name: '.length).trim()
  if (!name || name.includes('\n')) fail('workflow step name is malformed')
  const runMatches = lines.filter((line) => line === '        run: |')
  const usesMatches = lines.filter((line) => /^        uses:\s+\S+(?:\s+#.*)?$/.test(line))
  if (runMatches.length > 1 || usesMatches.length > 1) fail(`workflow step has duplicate run/uses: ${name}`)
  const runIndex = lines.indexOf('        run: |')
  const body = runIndex >= 0
    ? unindentBlock(lines.slice(runIndex + 1), 10)
    : null
  const uses = usesMatches.length
    ? usesMatches[0].replace(/^        uses:\s+/, '').split(/\s+#/, 1)[0].trim()
    : null
  const properties = new Set()
  for (const line of lines.slice(1)) {
    const match = line.match(/^        ([a-z][a-z0-9_-]*):(?:\s*(.*))?$/)
    if (match) properties.add(match[1])
  }
  for (const property of properties) {
    if (!['run', 'uses', 'if', 'env', 'with', 'id', 'name'].includes(property)) fail(`unsupported workflow step property: ${property}`)
  }
  const condition = lines.find((line) => /^        if:/.test(line))?.replace(/^        if:\s*/, '').trim() ?? null
  if (condition !== null && condition !== "inputs.proof_mode == 'full'") fail(`unsupported workflow condition in ${name}`)
  for (const line of lines) {
    if (!line.includes('${{')) continue
    // Action inputs include runner.temp for upload paths.  They are resolved
    // by the artifact collector; run-step expressions use the narrower
    // renderer below.
    assertSupportedExpressions(line, runIndex >= 0
      ? undefined
      : ['inputs.expected_sha', 'inputs.proof_mode', 'inputs.image_scope', 'github.run_number', 'github.sha', 'runner.temp'])
  }
  return { name, body, uses, env: parseEnvBlock(lines), with: parseWithBlock(lines), condition }
}

function assertSupportedExpressions(value, allowed = ['inputs.expected_sha', 'inputs.proof_mode', 'inputs.image_scope', 'github.run_number', 'github.sha']) {
  const text = String(value)
  if (text.includes('${{')) {
    const matches = [...text.matchAll(/\$\{\{\s*([^}]+?)\s*\}\}/g)]
    if (matches.length === 0) fail('malformed GitHub expression')
    for (const match of matches) {
      const expression = match[1].trim()
      if (!allowed.includes(expression)) {
        fail(`unsupported GitHub expression: ${expression}`)
      }
    }
    if (text.replace(/\$\{\{\s*[^}]+?\s*\}\}/g, '').includes('${{')) fail('malformed GitHub expression')
  }
  return true
}

function assertExactUploadContract(uploads) {
  if (!Array.isArray(uploads) || uploads.length !== FULL_PROOF_UPLOAD_CONTRACT.length) {
    fail('full proof upload contract changed')
  }
  for (const [index, upload] of uploads.entries()) {
    const expected = FULL_PROOF_UPLOAD_CONTRACT[index]
    const actualKeys = isObject(upload) ? Object.keys(upload).sort() : []
    const expectedKeys = ['artifactName', 'ifNoFilesFound', 'name', 'paths']
    const keysMatch = actualKeys.length === expectedKeys.length && actualKeys.every((key, keyIndex) => key === expectedKeys[keyIndex])
    const pathsMatch = Array.isArray(upload?.paths)
      && upload.paths.length === expected.paths.length
      && upload.paths.every((path, pathIndex) => path === expected.paths[pathIndex])
    if (!keysMatch
      || upload.name !== expected.name
      || upload.artifactName !== expected.artifactName
      || upload.ifNoFilesFound !== expected.ifNoFilesFound
      || !pathsMatch) {
      fail(`full proof upload contract changed: ${expected.name}`)
    }
  }
  return true
}

export function renderWorkflowExpressions(value, context) {
  assertSupportedExpressions(String(value))
  const input = String(value)
  return input.replace(/\$\{\{\s*([^}]+?)\s*\}\}/g, (_whole, expression) => {
    const key = expression.trim()
    if (key === 'inputs.expected_sha') return context.expectedSha
    if (key === 'inputs.proof_mode') return context.proofMode
    if (key === 'inputs.image_scope') return context.imageScope
    if (key === 'github.run_number') return String(context.runNumber)
    if (key === 'github.sha') return context.githubSha
    fail(`unsupported GitHub expression: ${key}`)
  })
}

function splitStepSections(jobLines) {
  const starts = []
  for (let index = 0; index < jobLines.length; index += 1) {
    if (/^      - name: /.test(jobLines[index])) starts.push(index)
  }
  if (!starts.length) fail('proof job has no steps')
  return starts.map((start, index) => jobLines.slice(start, starts[index + 1] ?? jobLines.length))
}

export function extractFullProofPlan(source) {
  assertString(source, 'workflow source', { allowNewlines: true })
  const job = findJobSection(source, 'proof')
  const parsed = splitStepSections(job).map(parseStepSection)
  const names = parsed.map((step) => step.name)
  const duplicate = names.find((name, index) => names.indexOf(name) !== index)
  if (duplicate) fail(`duplicate workflow step: ${duplicate}`)
  const runSteps = parsed.filter((step) => step.body !== null)
  if (runSteps.length !== FULL_PROOF_STEPS.length || runSteps.some((step, index) => step.name !== FULL_PROOF_STEPS[index])) {
    fail('full proof run step order or membership changed')
  }
  const actionSteps = parsed.filter((step) => step.body === null)
  if (actionSteps.length !== ACTION_STEPS.length || actionSteps.some((step, index) => step.name !== ACTION_STEPS[index])) {
    fail('full proof action step order or membership changed')
  }
  for (const step of runSteps) {
    if (step.uses !== null) fail(`run step unexpectedly has uses: ${step.name}`)
    const expectedEnv = STEP_ENV_KEYS[step.name] ?? []
    const actualEnv = Object.keys(step.env)
    if (actualEnv.length !== expectedEnv.length || actualEnv.some((key) => !expectedEnv.includes(key))) {
      fail(`full proof step env changed: ${step.name}`)
    }
    if (step.name === FULL_PROOF_STEPS[0] && step.condition !== null) fail('input validation step must not be conditional')
    if (step.name !== FULL_PROOF_STEPS[0] && step.condition !== "inputs.proof_mode == 'full'") fail(`full proof step condition changed: ${step.name}`)
  }
  for (const step of actionSteps) {
    if (!step.uses || !/@[a-f0-9]{40}$/i.test(step.uses)) fail(`workflow action is not pinned: ${step.name}`)
  }
  const uploads = actionSteps.filter((step) => step.uses?.startsWith('actions/upload-artifact@'))
  if (uploads.length !== 4 || uploads.some((step) => !step.with.path || step.with['if-no-files-found'] !== 'error')) fail('full proof upload action shape changed')
  const parsedUploads = uploads.map((step) => ({
    name: step.name,
    artifactName: step.with.name,
    ifNoFilesFound: step.with['if-no-files-found'],
    paths: step.with.path.split(/\r?\n/).map((line) => line.trim()).filter(Boolean),
  }))
  for (const upload of uploads) {
    const withKeys = Object.keys(upload.with).sort()
    if (withKeys.length !== 3 || withKeys.some((key, index) => key !== ['if-no-files-found', 'name', 'path'][index])) {
      fail(`full proof upload contract changed: ${upload.name}`)
    }
  }
  assertExactUploadContract(parsedUploads)
  return {
    globalEnv: parseWorkflowEnv(source),
    steps: runSteps,
    uploads: parsedUploads,
  }
}

function parseArgv(argv) {
  const values = {}
  const allowed = new Set(['source-sha', 'tree-sha', 'run-number', 'node', 'node-sha256', 'run-root', 'proof-output', 'receipt', 'workspace-root', 'deadline-minutes', 'allow-disposable-daemon-reset'])
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index]
    if (!token.startsWith('--')) fail(`unexpected CLI argument: ${token}`)
    const key = token.slice(2)
    if (!allowed.has(key) || Object.hasOwn(values, key)) fail(`unknown or duplicate CLI argument: ${token}`)
    if (key === 'allow-disposable-daemon-reset') {
      values[key] = true
      continue
    }
    const value = argv[index + 1]
    if (!value || value.startsWith('--')) fail(`missing value for --${key}`)
    values[key] = value
    index += 1
  }
  return values
}

function candidatePath(value, label, { mustExist = false, directory = false } = {}) {
  assertString(value, label)
  if (!isPortableAbsolute(value)) fail(`${label} must be absolute`)
  const pathname = resolve(value)
  if (mustExist) {
    let stat
    try { stat = lstatSync(pathname) } catch { fail(`${label} does not exist`) }
    if (stat.isSymbolicLink() || (directory ? !stat.isDirectory() : !stat.isFile())) fail(`${label} has an unsafe type`)
    return realpathSync(pathname)
  }
  if (existsSync(pathname)) fail(`${label} must be fresh`)
  const parent = dirname(pathname)
  let parentReal
  try { parentReal = realpathSync(parent) } catch { fail(`${label} parent must exist`) }
  return join(parentReal, basename(pathname))
}

function inside(pathname, root) {
  const candidate = resolve(pathname)
  const base = resolve(root)
  const rel = relative(base, candidate)
  return rel === '' || (rel !== '..' && !rel.startsWith(`..${sep}`) && !isAbsolute(rel))
}

export function validateCliOptions(raw, { checkoutRoot = CHECKOUT_ROOT } = {}) {
  if (!isObject(raw)) fail('CLI options are required')
  for (const key of ['source-sha', 'tree-sha', 'run-number', 'node', 'node-sha256', 'run-root', 'proof-output', 'receipt']) {
    if (!Object.hasOwn(raw, key)) fail(`missing required --${key}`)
  }
  const sourceSha = assertHash(raw['source-sha'], 'source SHA', SOURCE_SHA)
  if (raw['allow-disposable-daemon-reset'] !== true) fail('--allow-disposable-daemon-reset is required')
  const treeSha = assertHash(raw['tree-sha'], 'tree SHA', SOURCE_SHA)
  if (!POSITIVE_INTEGER.test(raw['run-number']) || Number(raw['run-number']) > Number.MAX_SAFE_INTEGER) fail('run number is invalid')
  const nodeSha256 = assertHash(raw['node-sha256'], 'node SHA-256')
  const workspaceInput = raw['workspace-root'] ?? checkoutRoot
  const workspaceRoot = candidatePath(workspaceInput, 'workspace root', { mustExist: true, directory: true })
  const canonicalCheckout = realpathSync(checkoutRoot)
  if (workspaceRoot !== canonicalCheckout) fail('workspace root is not this checkout')
  const runRoot = candidatePath(raw['run-root'], 'run root')
  const proofOutput = candidatePath(raw['proof-output'], 'proof output')
  const receipt = candidatePath(raw.receipt, 'receipt')
  const node = candidatePath(raw.node, 'pinned node', { mustExist: true })
  for (const [candidate, label] of [[runRoot, 'run root'], [proofOutput, 'proof output'], [receipt, 'receipt']]) {
    if (inside(candidate, workspaceRoot)) fail(`${label} may not be inside workspace`)
    if (DISPOSABLE_DAEMON_ROOTS.some((root) => inside(candidate, root))) fail(`${label} may not be inside disposable daemon roots`)
  }
  if (inside(proofOutput, runRoot) || inside(runRoot, proofOutput) || inside(receipt, proofOutput) || inside(proofOutput, receipt) || inside(receipt, runRoot) || inside(runRoot, receipt)) fail('run root, proof output, and receipt may not overlap')
  const deadlineMinutes = raw['deadline-minutes'] === undefined ? DEFAULT_DEADLINE_MINUTES : Number(raw['deadline-minutes'])
  if (!Number.isInteger(deadlineMinutes) || deadlineMinutes < 1 || deadlineMinutes > MAX_DEADLINE_MINUTES) fail('deadline-minutes is outside the bounded range')
  return {
    sourceSha,
    treeSha,
    runNumber: Number(raw['run-number']),
    node,
    nodeSha256,
    runRoot,
    proofOutput,
    receipt,
    workspaceRoot,
    deadlineMinutes,
    allowDisposableDaemonReset: true,
  }
}

function safeInheritedEnvironment(nodePath, runRoot) {
  const pathEntries = [dirname(nodePath), '/usr/local/sbin', '/usr/local/bin', '/usr/sbin', '/usr/bin', '/sbin', '/bin']
  const env = {
    PATH: [...new Set(pathEntries)].join(':'),
    HOME: join(runRoot, 'home'),
    TMPDIR: join(runRoot, 'runner-temp'),
    LANG: 'C.UTF-8',
    LC_ALL: 'C.UTF-8',
    SHELL: '/bin/bash',
  }
  mkdirSync(env.HOME, { recursive: true, mode: 0o700 })
  mkdirSync(env.TMPDIR, { recursive: true, mode: 0o700 })
  return env
}

function sha256File(pathname) {
  return createHash('sha256').update(readFileSync(pathname)).digest('hex')
}

function assertExecutingNode(options) {
  let executingNode
  try { executingNode = realpathSync(process.execPath) } catch { fail('executing Node path is unavailable') }
  if (executingNode !== options.node) fail('executing Node is not the supplied pinned Node')
  let executingSha256
  try { executingSha256 = sha256File(process.execPath) } catch { fail('executing Node SHA-256 is unavailable') }
  if (executingSha256 !== options.nodeSha256) fail('executing Node SHA-256 does not match supplied pinned Node')
}

function defaultReadOnlyCommand(file, args, options = {}) {
  const result = spawnSync(file, args, {
    cwd: options.cwd,
    env: options.env,
    encoding: options.binaryOutput === true ? null : 'utf8',
    timeout: options.timeoutMs,
    input: options.input,
    windowsHide: true,
  })
  return { status: result.status, signal: result.signal ?? null, stdout: result.stdout ?? '', stderr: result.stderr ?? '', error: result.error ?? null }
}

function commandSucceeded(result, label) {
  if (!result || result.error || result.status !== 0) fail(`${label} failed`)
  return result
}

function remaining(deadlineAt) {
  const value = deadlineAt - Date.now()
  if (value <= 0) fail('overall proof deadline exceeded')
  return value
}

function boundedCommandTimeout(deadlineAt) {
  return Math.min(120_000, Number.isFinite(deadlineAt) ? remaining(deadlineAt) : 120_000)
}

function assertDockerEnvironmentSafe(env = {}) {
  for (const name of ['DOCKER_HOST', 'DOCKER_CONTEXT', 'DOCKER_CONFIG']) {
    if (Object.prototype.hasOwnProperty.call(process.env ?? {}, name) || Object.prototype.hasOwnProperty.call(env ?? {}, name)) fail(`${name} override is not allowed`)
  }
}

function rootDockerOptions(cwd, deadlineAt) {
  return { cwd, env: ROOT_DOCKER_ENV, timeoutMs: boundedCommandTimeout(deadlineAt) }
}

/** Prove the root sudo Docker client cannot escape to another context/socket. */
export function validateDockerRootContext({ commandRunner = defaultReadOnlyCommand, cwd, env, deadlineAt } = {}) {
  assertDockerEnvironmentSafe(env)
  const context = command(commandRunner, 'sudo', ['-n', 'docker', 'context', 'show'], rootDockerOptions(cwd, deadlineAt), 'root Docker context').stdout.trim()
  if (context !== 'default') fail('root Docker context must be default')
  const endpointOutput = command(commandRunner, 'sudo', ['-n', 'docker', 'context', 'inspect', 'default', '--format', '{{json .Endpoints.docker.Host}}'], rootDockerOptions(cwd, deadlineAt), 'root Docker context endpoint').stdout.trim()
  let endpoint
  try { endpoint = JSON.parse(endpointOutput) } catch { fail('root Docker context endpoint is invalid') }
  if (endpoint !== ROOT_DOCKER_SOCKET) fail('root Docker context endpoint is not the fixed Docker socket')
  const infoOutput = command(commandRunner, 'sudo', ['-n', 'docker', 'info', '--format', '{{json .}}'], rootDockerOptions(cwd, deadlineAt), 'root Docker info').stdout
  let info
  try { info = JSON.parse(infoOutput.trim()) } catch { fail('root Docker info is invalid') }
  if (!isObject(info) || info.DockerRootDir !== DEDICATED_DOCKER_ROOT) fail('root Docker info data-root is not fixed')
  return Object.freeze({ context, endpoint, dockerRootDir: info.DockerRootDir })
}

function command(commandRunner, file, args, options, label) {
  const result = commandRunner(file, args, options)
  return commandSucceeded(result, label)
}

function isSecretName(name) {
  return /(?:TOKEN|PASSWORD|SECRET|CREDENTIAL|PRIVATE.?KEY|ACCESS.?KEY)/i.test(name)
}

function dockerIdentityFromOutput(output) {
  let value
  try { value = JSON.parse(output.trim()) } catch { fail('Docker engine identity is not valid JSON') }
  if (!isObject(value)) fail('Docker engine identity is malformed')
  const os = value.OSType ?? value.OsType ?? value.osType
  const architecture = value.Architecture ?? value.architecture
  const serverVersion = value.ServerVersion ?? value.serverVersion ?? value.Version
  const id = value.ID ?? value.Id ?? value.id
  if (os !== 'linux' || !['amd64', 'x86_64'].includes(String(architecture).toLowerCase()) || typeof serverVersion !== 'string' || !serverVersion || typeof id !== 'string' || !id) fail('Docker engine is not native Linux amd64 or has no identity')
  return { id: String(id).slice(0, 128), serverVersion: String(serverVersion).slice(0, 80), operatingSystem: 'linux', architecture: 'amd64' }
}

function inspectResourceGroup(commandRunner, cwd, env, deadlineAt, project) {
  const statuses = {}
  for (const [kind, args] of [
    ['containers', ['ps', '-aq', '--filter', `label=com.docker.compose.project=${project}`]],
    ['volumes', ['volume', 'ls', '-q', '--filter', `label=com.docker.compose.project=${project}`]],
    ['networks', ['network', 'ls', '-q', '--filter', `label=com.docker.compose.project=${project}`]],
  ]) {
    const result = command(commandRunner, 'docker', args, { cwd, env, timeoutMs: Math.min(120_000, remaining(deadlineAt)) }, `Docker ${kind} preflight`)
    statuses[kind] = result.stdout.trim() === ''
  }
  return statuses
}

function inspectFirewallChains(commandRunner, cwd, env, deadlineAt) {
  const statuses = {}
  for (const [tool, chain] of RUNNER_FIREWALL_CHAINS) {
    const result = commandRunner('sudo', ['-n', tool, '-S', chain], { cwd, env, timeoutMs: Math.min(120_000, remaining(deadlineAt)) })
    if (result.error) fail(`firewall chain inspection failed: ${chain}`)
    statuses[`${tool}:${chain}`] = result.status === 0
  }
  return statuses
}

function assertFreshWorkspaceOutputs(workspaceRoot) {
  for (const relativePath of ['proof', 'infra/onprem/core/secret-files', 'infra/onprem/photo-storage/secret-files']) {
    const pathname = join(workspaceRoot, relativePath)
    let cursor = pathname
    while (true) {
      try {
        const stats = lstatSync(cursor)
        if (stats.isSymbolicLink()) fail(`workspace output path has a symlink ancestor: ${relativePath}`)
        if (cursor === pathname) fail(`workspace output path is not fresh: ${relativePath}`)
      } catch (error) {
        if (error?.code !== 'ENOENT') throw error
      }
      if (cursor === workspaceRoot) break
      const parent = dirname(cursor)
      if (parent === cursor || !inside(parent, workspaceRoot)) break
      cursor = parent
    }
  }
}

export function captureFirewallSnapshot({ commandRunner = defaultReadOnlyCommand, cwd, env, deadlineAt = Date.now() + 120_000 } = {}) {
  return captureFirewallSnapshots({ commandRunner, cwd, env, deadlineAt }).ipv4
}

export function inspectPostflight({ commandRunner = defaultReadOnlyCommand, cwd, env, deadlineAt = Date.now() + 120_000, firewallBaseline = null, firewallAfter = null, firewallComparison = null, firewallCaptureError = null } = {}) {
  const resources = {}
  for (const project of TARGET_PROJECTS) resources[project] = inspectResourceGroup(commandRunner, cwd, env, deadlineAt, project)
  const chains = inspectFirewallChains(commandRunner, cwd, env, deadlineAt)
  let firewall = {
    preSha256: firewallBaseline?.sha256 ?? null,
    postSha256: firewallAfter?.sha256 ?? null,
    equal: false,
    byteEqual: false,
    timestampOnlyEquivalent: false,
    equivalent: false,
  }
  if (!firewallCaptureError && firewallComparison && typeof firewallComparison === 'object') {
    const byteEqual = firewallComparison.byteEqual === true
    const timestampOnlyEquivalent = !byteEqual && firewallComparison.timestampOnlyEquivalent === true
    const equivalent = firewallComparison.equivalent === true && (byteEqual || timestampOnlyEquivalent)
    firewall = {
      ...firewall,
      equal: byteEqual,
      byteEqual,
      timestampOnlyEquivalent,
      equivalent,
    }
  } else if (!firewallCaptureError && Buffer.isBuffer(firewallBaseline?.bytes) && Buffer.isBuffer(firewallAfter?.bytes)) {
    const comparison = compareFirewallSnapshots(firewallBaseline.bytes, firewallAfter.bytes, 'iptables-save')
    firewall = { ...firewall, ...comparison, equal: comparison.byteEqual }
  }
  const clean = Object.values(resources).every((group) => Object.values(group).every(Boolean)) && Object.values(chains).every((exists) => !exists) && firewall.equivalent
  return { clean, resources, firewallChains: chains, firewall }
}

export function runPreflightChecks({ options, workflow, commandRunner = defaultReadOnlyCommand, host = {}, env, deadlineAt } = {}) {
  const platform = host.platform ?? process.platform
  const uid = host.uid ?? (typeof process.getuid === 'function' ? process.getuid() : undefined)
  const arch = host.arch ?? process.arch
  if (platform !== 'linux' || uid === undefined || uid === 0) fail('local proof requires a non-root Linux caller')
  if (arch !== 'x64') fail('local proof requires an amd64 Node host')
  assertDockerEnvironmentSafe(env)
  let socket
  try { socket = lstatSync('/var/run/docker.sock') } catch { fail('native local Docker socket is unavailable') }
  if (!socket.isSocket()) fail('native local Docker socket is not a Unix socket')
  command(commandRunner, 'sudo', ['-n', 'true'], { cwd: options.workspaceRoot, env, timeoutMs: Math.min(120_000, remaining(deadlineAt)) }, 'passwordless sudo check')
  const rootContext = validateDockerRootContext({ commandRunner, cwd: options.workspaceRoot, env, deadlineAt })
  const nodeStat = lstatSync(options.node)
  if (nodeStat.isSymbolicLink() || !nodeStat.isFile() || (nodeStat.mode & 0o111) === 0) fail('pinned Node path is not an executable regular file')
  const nodeSha256 = sha256File(options.node)
  if (nodeSha256 !== options.nodeSha256) fail('pinned Node SHA-256 does not match')
  const nodeVersionResult = command(commandRunner, options.node, ['--version'], { cwd: options.workspaceRoot, env, timeoutMs: Math.min(120_000, remaining(deadlineAt)) }, 'pinned Node version check')
  if (nodeVersionResult.stdout.trim() !== 'v24.19.0') fail('pinned Node version is not v24.19.0')
  for (const tool of REQUIRED_HOST_TOOLS) command(commandRunner, 'bash', ['--noprofile', '--norc', '-c', 'command -v "$1"', 'tool-check', tool], { cwd: options.workspaceRoot, env, timeoutMs: Math.min(120_000, remaining(deadlineAt)) }, `required host tool check: ${tool}`)
  command(commandRunner, 'docker', ['compose', 'version'], { cwd: options.workspaceRoot, env, timeoutMs: Math.min(120_000, remaining(deadlineAt)) }, 'Docker Compose check')
  const dockerInfo = command(commandRunner, 'docker', ['info', '--format', '{{json .}}'], { cwd: options.workspaceRoot, env, timeoutMs: Math.min(120_000, remaining(deadlineAt)) }, 'Docker engine check')
  const docker = dockerIdentityFromOutput(dockerInfo.stdout)
  const head = command(commandRunner, 'git', ['rev-parse', 'HEAD'], { cwd: options.workspaceRoot, env, timeoutMs: Math.min(120_000, remaining(deadlineAt)) }, 'Git HEAD check').stdout.trim()
  const tree = command(commandRunner, 'git', ['rev-parse', 'HEAD^{tree}'], { cwd: options.workspaceRoot, env, timeoutMs: Math.min(120_000, remaining(deadlineAt)) }, 'Git tree check').stdout.trim()
  assertFreshWorkspaceOutputs(options.workspaceRoot)
  const dirty = command(commandRunner, 'git', ['status', '--porcelain', '--untracked-files=all'], { cwd: options.workspaceRoot, env, timeoutMs: Math.min(120_000, remaining(deadlineAt)) }, 'Git clean check').stdout.trim()
  if (head !== options.sourceSha || tree !== options.treeSha || dirty !== '') fail('Git checkout is not the exact clean requested identity')
  const resources = {}
  for (const project of TARGET_PROJECTS) resources[project] = inspectResourceGroup(commandRunner, options.workspaceRoot, env, deadlineAt, project)
  if (Object.values(resources).some((group) => Object.values(group).some((empty) => !empty))) fail('pre-existing exact proof Docker resources were found')
  const firewallChains = inspectFirewallChains(commandRunner, options.workspaceRoot, env, deadlineAt)
  if (Object.values(firewallChains).some(Boolean)) fail('pre-existing runner firewall chain was found')
  const firewallSnapshots = captureFirewallSnapshots({ commandRunner, cwd: options.workspaceRoot, env, deadlineAt })
  return { node: { version: 'v24.19.0', sha256: nodeSha256 }, docker: { ...docker, rootContext }, resources, firewallChains, firewallBaseline: firewallSnapshots.ipv4, firewallSnapshots }
}

function appendPersistedEnv(env, envPath, runTemp) {
  if (!existsSync(envPath)) return env
  const lines = readFileSync(envPath, 'utf8').split(/\r?\n/).filter(Boolean)
  const updated = { ...env }
  for (const line of lines) {
    const separator = line.indexOf('=')
    if (separator <= 0) fail('GITHUB_ENV contains malformed state')
    const key = line.slice(0, separator)
    const value = line.slice(separator + 1)
    if (!PERSISTED_GITHUB_ENV_KEYS.has(key) || !SAFE_ENV_NAME.test(key) || /[\r\n]/.test(value)) fail(`unsupported GITHUB_ENV key: ${key}`)
    if (key === 'ONPREM_CORE_ENV' && !inside(value, runTemp)) fail('ONPREM_CORE_ENV escaped RUNNER_TEMP')
    updated[key] = value
  }
  return updated
}

function normalizePhaseResult(result) {
  if (!result || typeof result !== 'object') {
    return {
      status: 'failed',
      exitCode: null,
      signal: null,
      timedOut: false,
      containmentOk: false,
      containmentEscalated: false,
      containmentObserved: false,
    }
  }
  const timedOut = result.timedOut === true || result.status === 'timed-out'
  const containment = result.containment
  const containmentKnown = Boolean(containment && typeof containment === 'object')
  const containmentOk = containmentKnown ? containment.ok === true : true
  const containmentEscalated = containmentKnown && containment.escalated === true
  const containmentObserved = containmentKnown && containment.hadGroup === true
  const passed = containmentOk && (result.status === 'passed' || (result.status === 0 && !result.error))
  return {
    status: timedOut ? 'timed-out' : passed ? 'passed' : 'failed',
    exitCode: Number.isInteger(result.exitCode) ? result.exitCode : (Number.isInteger(result.status) ? result.status : null),
    signal: result.signal ?? null,
    timedOut,
    containmentOk,
    containmentEscalated,
    containmentObserved,
  }
}

function processGroupState(processApi, pgid) {
  if (!processApi || typeof processApi.kill !== 'function' || !Number.isInteger(pgid) || pgid <= 0) return 'unknown'
  try {
    processApi.kill(-pgid, 0)
    return 'present'
  } catch (error) {
    return error?.code === 'ESRCH' ? 'absent' : 'unknown'
  }
}

function signalProcessGroup(processApi, pgid, signal) {
  if (!processApi || typeof processApi.kill !== 'function' || !Number.isInteger(pgid) || pgid <= 0) {
    return { sent: false, absent: false }
  }
  try {
    processApi.kill(-pgid, signal)
    return { sent: true, absent: false }
  } catch (error) {
    return { sent: false, absent: error?.code === 'ESRCH' }
  }
}

export async function waitForProcessGroupAbsence({ processApi = process, pgid, graceMs = PROCESS_GROUP_TERM_GRACE_MS, pollMs = PROCESS_GROUP_POLL_MS } = {}) {
  const deadline = Date.now() + Math.max(0, Number.isFinite(graceMs) ? graceMs : 0)
  while (true) {
    if (processGroupState(processApi, pgid) === 'absent') return true
    const remaining = deadline - Date.now()
    if (remaining <= 0) return false
    await new Promise((resolveDelay) => setTimeout(resolveDelay, Math.min(Math.max(1, pollMs), remaining)))
  }
}

export async function containProcessGroup({
  pgid,
  processApi = process,
  termGraceMs = PROCESS_GROUP_TERM_GRACE_MS,
  killGraceMs = PROCESS_GROUP_KILL_GRACE_MS,
  pollMs = PROCESS_GROUP_POLL_MS,
} = {}) {
  if (!processApi || typeof processApi.kill !== 'function' || !Number.isInteger(pgid) || pgid <= 0) {
    return { ok: false, groupAbsent: false, hadGroup: false, termSent: false, killSent: false, escalated: false }
  }
  const initial = processGroupState(processApi, pgid)
  if (initial === 'absent') {
    return { ok: true, groupAbsent: true, hadGroup: false, termSent: false, killSent: false, escalated: false }
  }
  // A present or uncertain group is never accepted merely because its bash
  // leader emitted `close`; it must be positively absent after escalation.
  const hadGroup = true
  const term = signalProcessGroup(processApi, pgid, 'SIGTERM')
  const termAbsent = await waitForProcessGroupAbsence({ processApi, pgid, graceMs: termGraceMs, pollMs })
  if (termAbsent) {
    return { ok: true, groupAbsent: true, hadGroup, termSent: term.sent, killSent: false, escalated: false }
  }
  const kill = signalProcessGroup(processApi, pgid, 'SIGKILL')
  const killAbsent = await waitForProcessGroupAbsence({ processApi, pgid, graceMs: killGraceMs, pollMs })
  return {
    ok: killAbsent,
    groupAbsent: killAbsent,
    hadGroup,
    termSent: term.sent,
    killSent: kill.sent,
    escalated: true,
  }
}

function safeContainment(result) {
  return {
    ok: result?.ok === true,
    groupAbsent: result?.groupAbsent === true,
    hadGroup: result?.hadGroup === true,
    termSent: result?.termSent === true,
    killSent: result?.killSent === true,
    escalated: result?.escalated === true,
  }
}

export function executeShellPhase({
  body,
  cwd,
  env,
  timeoutMs,
  spawnProcess = null,
  processApi = process,
  termGraceMs = PROCESS_GROUP_TERM_GRACE_MS,
  killGraceMs = PROCESS_GROUP_KILL_GRACE_MS,
  pollMs = PROCESS_GROUP_POLL_MS,
}) {
  return new Promise((resolvePhase) => {
    const args = ['--noprofile', '--norc', '-euo', 'pipefail', '-c', body]
    const options = { cwd, env, stdio: 'inherit', detached: true }
    let child
    try {
      child = spawnProcess ? spawnProcess('bash', args, options) : spawn('bash', args, options)
    } catch (error) {
      resolvePhase({
        status: 'failed',
        exitCode: null,
        signal: null,
        timedOut: false,
        containment: safeContainment({ ok: false }),
        error,
      })
      return
    }
    const pgid = child?.pid
    let timedOut = false
    let childDone = false
    let childResult = null
    let containmentResult = null
    let containmentPromise = null
    let containmentDone = false
    let resolved = false

    const finish = () => {
      if (resolved || !containmentDone || (!childDone && !timedOut)) return
      resolved = true
      const containment = safeContainment(containmentResult)
      const leaderStatus = timedOut
        ? 'timed-out'
        : childResult?.error
          ? 'failed'
          : childResult?.code === 0
            ? 'passed'
            : 'failed'
      // `hadGroup` on a normal leader exit means a descendant survived long
      // enough to require containment.  Treat that as a failed phase even if
      // TERM/KILL eventually cleaned it up; accepting it would hide an orphan.
      const containmentFailure = containment.ok !== true || (!timedOut && containment.hadGroup === true)
      resolvePhase({
        status: timedOut ? 'timed-out' : containmentFailure ? 'failed' : leaderStatus,
        exitCode: childResult?.code ?? null,
        signal: childResult?.signal ?? null,
        timedOut,
        containment,
        error: containmentFailure ? new Error('workflow process-group containment was not proved safe') : childResult?.error,
      })
    }

    const beginContainment = () => {
      if (containmentPromise) return containmentPromise
      containmentPromise = containProcessGroup({ pgid, processApi, termGraceMs, killGraceMs, pollMs })
        .catch(() => ({ ok: false, groupAbsent: false, hadGroup: true, termSent: false, killSent: false, escalated: false }))
        .then((result) => {
          containmentResult = result
          containmentDone = true
          finish()
          return result
        })
      return containmentPromise
    }

    const timeout = setTimeout(() => {
      timedOut = true
      beginContainment()
    }, Math.max(1, Number.isFinite(timeoutMs) ? timeoutMs : 1))
    child.once('error', (error) => {
      if (childDone) return
      clearTimeout(timeout)
      childDone = true
      childResult = { error, code: null, signal: null }
      beginContainment()
      finish()
    })
    child.once('close', (code, signal) => {
      if (childDone) return
      clearTimeout(timeout)
      childDone = true
      childResult = { code, signal }
      beginContainment()
      finish()
    })
  })
}

export async function executeProofBodies({ steps, context, baseEnv, cwd, githubEnvPath, deadlineAt, executor = executeShellPhase, beforeStep = null } = {}) {
  const phases = []
  let failureReason = null
  let currentEnv = { ...baseEnv }
  for (const step of steps) {
    if (failureReason) {
      phases.push({ name: step.name, status: 'skipped', exitCode: null, signal: null, timedOut: false, durationMs: 0 })
      continue
    }
    const started = Date.now()
    let result
    try {
      const env = { ...currentEnv }
      for (const [key, raw] of Object.entries(step.env)) env[key] = renderWorkflowExpressions(raw, context)
      const timeoutMs = Math.max(1, deadlineAt - Date.now())
      if (beforeStep) await beforeStep({ step, env, timeoutMs, deadlineAt })
      result = await executor({ body: step.body, cwd, env, timeoutMs, step })
    } catch (error) {
      result = { status: error?.message?.includes('deadline') ? 'timed-out' : 'failed', exitCode: null, signal: null, timedOut: error?.message?.includes('deadline') }
      failureReason = error instanceof Error ? error.message : 'proof phase failed'
    }
    const normalized = normalizePhaseResult(result)
    phases.push({ name: step.name, ...normalized, durationMs: Date.now() - started })
    if (normalized.status !== 'passed') {
      failureReason ??= normalized.status === 'timed-out' ? `proof phase timed out: ${step.name}` : `proof phase failed: ${step.name}`
      continue
    }
    currentEnv = appendPersistedEnv(currentEnv, githubEnvPath, baseEnv.RUNNER_TEMP)
  }
  return { phases, failureReason, env: currentEnv }
}

function safeFailureReason(error) {
  const message = error instanceof Error ? error.message : String(error ?? 'proof failed')
  return message
    .replace(/[A-Za-z]:[\\/][^\s]*/g, '<path>')
    .replace(/\/(?:[^\s/]+\/){1,}[^\s/]*/g, '<path>')
    .replace(/https?:\/\/[^\s)]+/gi, '<url>')
    .replace(/\b(password|secret|token|credential|private.?key|access.?key)\s*[:=]\s*[^\s,;)]+/gi, '$1=<redacted>')
    .replace(/\b[0-9a-f]{64,}\b/gi, '<hex>')
    .replace(/[^\x20-\x7e]/g, '?')
    .slice(0, MAX_FAILURE_LENGTH)
}

function escapeRegex(value) { return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') }

function patternRegex(pattern) {
  const segments = pattern.split('/')
  const expression = segments.map((segment) => {
    if (segment === '**') return '.+'
    return segment.split('*').map(escapeRegex).join('[^/]+')
  }).join('\\/')
  return new RegExp(`^${expression}$`)
}

function selectedProofFiles(proofRoot, pattern) {
  if (pattern.includes('..') || !pattern.startsWith('proof/')) fail('upload artifact path is unsafe')
  const relativePattern = pattern.slice('proof/'.length)
  const segments = relativePattern.split('/')
  const result = []
  if (segments.length === 1 && segments[0].includes('*')) {
    for (const entry of readdirSync(proofRoot, { withFileTypes: true })) {
      if (entry.isSymbolicLink() && patternRegex(pattern).test(`proof/${entry.name}`)) fail('selected upload artifact is a symlink')
      if (entry.isFile() && patternRegex(pattern).test(`proof/${entry.name}`)) result.push({ source: join(proofRoot, entry.name), relative: entry.name })
    }
    return result
  }
  if (segments[0] === 'base-license-evidence' && segments[1] === '**') {
    const root = join(proofRoot, 'base-license-evidence')
    if (!existsSync(root)) return result
    const visit = (directory, prefix) => {
      for (const entry of readdirSync(directory, { withFileTypes: true })) {
        const pathname = join(directory, entry.name)
        const child = `${prefix}/${entry.name}`
        if (entry.isSymbolicLink()) fail('selected upload artifact is a symlink')
        if (entry.isDirectory()) visit(pathname, child)
        else if (entry.isFile()) result.push({ source: pathname, relative: child })
      }
    }
    visit(root, 'base-license-evidence')
    return result
  }
  const rel = relativePattern
  const pathname = join(proofRoot, rel)
  if (existsSync(pathname)) {
    const stat = lstatSync(pathname)
    if (stat.isSymbolicLink()) fail('selected upload artifact is a symlink')
    if (!stat.isFile()) fail('selected upload artifact is not a regular file')
    result.push({ source: pathname, relative: rel })
  }
  return result
}

function validateSelectedFile(file, label) {
  const stat = lstatSync(file.source)
  if (stat.isSymbolicLink() || !stat.isFile() || stat.nlink !== 1) fail(`${label} is not a safe regular file`)
  const relativePath = normalizedPath(file.relative)
  const parts = relativePath.split('/')
  const knownLayerContentGuard = /^(?:backend|frontend|keycloak)-layer-[0-9]+-content-guard\.json$/.test(relativePath)
  if (parts.some((part) => part === '..' || part === '.' || /(?:rootfs|secret|credential|token|password|private[-_. ]?key|access[-_. ]?key)/i.test(part))
    || (parts.some((part) => /layer/i.test(part)) && !knownLayerContentGuard)) fail(`${label} has an unsafe path`)
  return { ...file, bytes: stat.size, sha256: sha256File(file.source) }
}

function resolveRuntimeUpload(raw, workspaceRoot, runTemp) {
  const rendered = raw.replace(/^\$\{\{\s*runner\.temp\s*\}\}/, runTemp)
  if (rendered.includes('${{') || rendered.includes('..')) fail('unsupported upload artifact path expression')
  if (isPortableAbsolute(rendered)) {
    if (!inside(rendered, runTemp)) fail('runtime upload artifact escaped RUNNER_TEMP')
    return { source: rendered, relative: basename(rendered) }
  }
  if (!rendered.startsWith('proof/')) fail('upload artifact path is outside proof')
  return null
}

export function collectUploadArtifacts({ workspaceRoot, runTemp, outputRoot, uploads, expectedSha } = {}) {
  assertExactUploadContract(uploads)
  const groups = []
  for (const upload of uploads) {
    const files = []
    const seen = new Set()
    for (const raw of upload.paths) {
      const runtime = resolveRuntimeUpload(raw, workspaceRoot, runTemp)
      if (runtime) {
        if (!existsSync(runtime.source)) fail(`required runtime receipt is missing: ${basename(runtime.source)}`)
        files.push(runtime)
      } else {
        for (const file of selectedProofFiles(join(workspaceRoot, 'proof'), raw)) files.push(file)
      }
    }
    if (!files.length) fail(`upload artifact is empty: ${upload.name}`)
    const checked = files.map((file) => validateSelectedFile(file, upload.name))
    for (const file of checked) {
      const key = file.source
      if (seen.has(key)) fail(`upload artifact selected a file twice: ${basename(key)}`)
      seen.add(key)
    }
    groups.push({
      name: upload.artifactName.replace(/\$\{\{\s*github\.sha\s*\}\}/g, expectedSha),
      stepName: upload.name,
      files: checked,
    })
  }
  const imageGroup = groups.find((group) => group.stepName === 'Upload sanitized proof artifacts')
  const imageNames = new Set(imageGroup?.files.map((file) => basename(file.source)) ?? [])
  for (const required of ['release-manifest.json', 'onprem-proof-receipt.json', 'backend-image.tar', 'frontend-image.tar', 'keycloak-image.tar', 'backend-content-guard.json', 'frontend-content-guard.json', 'keycloak-content-guard.json', 'content-guard-index.json', 'content-guard-index-public.pem', 'ephemeral-public.pem']) {
    if (!imageNames.has(required)) fail(`required proof artifact is missing: ${required}`)
  }
  const proofReceiptFile = imageGroup.files.find((file) => basename(file.source) === 'onprem-proof-receipt.json')
  const releaseManifestFile = imageGroup.files.find((file) => basename(file.source) === 'release-manifest.json')
  let proofReceipt
  try { proofReceipt = JSON.parse(readFileSync(proofReceiptFile.source, 'utf8')) } catch { fail('local proof receipt is invalid JSON') }
  if (proofReceipt.proofMode !== 'full' || proofReceipt.imageScope !== 'both' || proofReceipt.expectedSha !== expectedSha || proofReceipt.dataClass !== 'synthetic') fail('local proof receipt identity is invalid')
  let releaseManifest
  try { releaseManifest = JSON.parse(readFileSync(releaseManifestFile.source, 'utf8')) } catch { fail('release manifest is invalid JSON') }
  if (!isObject(releaseManifest) || releaseManifest.dataClass !== 'synthetic' || releaseManifest.sourceRevision !== expectedSha || !isObject(releaseManifest.imageIds)) fail('release manifest source identity is invalid')
  const releaseImageIds = {}
  for (const image of ['backend', 'frontend', 'keycloak']) {
    const imageId = releaseManifest.imageIds[image]
    if (typeof imageId !== 'string' || !/^sha256:[a-f0-9]{64}$/i.test(imageId)) fail(`release manifest image identity is invalid: ${image}`)
    releaseImageIds[image] = imageId.toLowerCase()
  }
  const releaseIdentity = { sourceRevision: releaseManifest.sourceRevision, imageIds: releaseImageIds }
  const evidenceSha = sha256File(releaseManifestFile.source)
  if (proofReceipt.evidenceSha !== evidenceSha) fail('local proof receipt evidence hash does not match release manifest')
  if (!existsSync(outputRoot)) mkdirSync(outputRoot, { recursive: true, mode: 0o700 })
  const manifestArtifacts = []
  for (const group of groups) {
    const groupDirectory = join(outputRoot, group.stepName === 'Upload sanitized proof artifacts' ? 'onprem-image-proof' : group.stepName.includes('Keycloak') ? 'onprem-keycloak-runtime-proof' : group.stepName.includes('photo-storage') ? 'onprem-photo-storage-proof' : 'onprem-core-runtime-proof')
    mkdirSync(groupDirectory, { recursive: true, mode: 0o700 })
    for (const file of group.files) {
      const destination = join(groupDirectory, file.relative)
      mkdirSync(dirname(destination), { recursive: true, mode: 0o700 })
      copyFileSync(file.source, destination)
      chmodSync(destination, 0o600)
      manifestArtifacts.push({ group: basename(groupDirectory), path: normalizedPath(relative(outputRoot, destination)), bytes: file.bytes, sha256: file.sha256 })
    }
  }
  const proofReceiptSha256 = sha256File(proofReceiptFile.source)
  const manifest = { schemaVersion: 1, dataClass: 'synthetic', proofMode: 'full', imageScope: 'both', expectedSha, evidenceSha, receiptSha256: proofReceiptSha256, releaseIdentity, artifacts: manifestArtifacts }
  const manifestPath = join(outputRoot, 'artifact-manifest.json')
  writeFileSync(manifestPath, `${JSON.stringify(manifest)}\n`, { mode: 0o600 })
  const manifestSha256 = sha256File(manifestPath)
  return {
    manifestPath,
    manifest,
    manifestSha256,
    proofReceiptSha256,
    releaseIdentity,
    groups: groups.map((group) => ({ name: group.name, files: group.files.length })),
  }
}

function validateGitHubOutput(pathname, expectedSha) {
  const entries = {}
  if (!existsSync(pathname)) fail('GITHUB_OUTPUT is missing')
  for (const line of readFileSync(pathname, 'utf8').split(/\r?\n/).filter(Boolean)) {
    const separator = line.indexOf('=')
    if (separator <= 0) fail('GITHUB_OUTPUT is malformed')
    const key = line.slice(0, separator); const value = line.slice(separator + 1)
    if (!['proof_mode', 'image_scope', 'evidence_sha', 'receipt_sha256', 'proven_sha'].includes(key) || Object.hasOwn(entries, key)) fail('GITHUB_OUTPUT contains unsupported state')
    entries[key] = value
  }
  if (entries.proof_mode !== 'full' || entries.image_scope !== 'both' || entries.proven_sha !== expectedSha || !SHA256.test(entries.evidence_sha) || !SHA256.test(entries.receipt_sha256)) fail('GITHUB_OUTPUT identity is invalid')
  return entries
}

function sanitizeHostIdentity(value) {
  if (!isObject(value)) return null
  return {
    contract: typeof value.contract === 'string' ? value.contract : null,
    marker: isObject(value.marker) ? { schema: value.marker.schema ?? null, version: value.marker.version ?? null } : null,
    units: isObject(value.units) ? { containerd: value.units.containerd ?? null, dockerd: value.units.dockerd ?? null } : null,
    pids: isObject(value.pids) ? { containerd: Number.isSafeInteger(value.pids.containerd) ? value.pids.containerd : null, dockerd: Number.isSafeInteger(value.pids.dockerd) ? value.pids.dockerd : null } : null,
    processes: isObject(value.processes) ? {
      containerd: isObject(value.processes.containerd) ? { startTime: Number.isSafeInteger(value.processes.containerd.startTime) ? value.processes.containerd.startTime : null, executable: value.processes.containerd.executable ?? null, cgroup: value.processes.containerd.cgroup ?? null } : null,
      dockerd: isObject(value.processes.dockerd) ? { startTime: Number.isSafeInteger(value.processes.dockerd.startTime) ? value.processes.dockerd.startTime : null, executable: value.processes.dockerd.executable ?? null, cgroup: value.processes.dockerd.cgroup ?? null } : null,
    } : null,
    socket: typeof value.socket === 'string' ? value.socket : null,
    dockerRootDir: typeof value.dockerRootDir === 'string' ? value.dockerRootDir : null,
    inventory: isObject(value.inventory) ? { containers: value.inventory.containers ?? null, networks: value.inventory.networks ?? null, volumes: value.inventory.volumes ?? null, images: value.inventory.images ?? null } : null,
  }
}

const INVALID_FIREWALL_DIAGNOSTIC_VALUE = Symbol('invalid-firewall-diagnostic-value')
const MAX_FIREWALL_DIAGNOSTIC_LINES = 1_024

function ownDataProperty(value, key) {
  const descriptor = Object.getOwnPropertyDescriptor(value, key)
  return descriptor && Object.hasOwn(descriptor, 'value') ? descriptor.value : INVALID_FIREWALL_DIAGNOSTIC_VALUE
}

function nonNegativeSafeInteger(value) {
  return Number.isSafeInteger(value) && value >= 0
}

function sanitizeFirewallDiagnosticLines(value) {
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_FIREWALL_DIAGNOSTIC_LINES) return null
  const lines = []
  for (let index = 0; index < value.length; index += 1) {
    if (!Object.hasOwn(value, index)) return null
    const line = ownDataProperty(value, index)
    if (!isObject(line)) return null
    const sha256 = ownDataProperty(line, 'sha256')
    const byteLength = ownDataProperty(line, 'byteLength')
    if (typeof sha256 !== 'string' || !SHA256.test(sha256) || !nonNegativeSafeInteger(byteLength)) return null
    lines.push({ sha256, byteLength })
  }
  return lines
}

/** Keep only fixed, hash/length/offset/boolean mismatch evidence at the receipt boundary. */
export function sanitizeFirewallDiagnostic(value) {
  try {
    if (!isObject(value)) return null
    const preByteLength = ownDataProperty(value, 'preByteLength')
    const postByteLength = ownDataProperty(value, 'postByteLength')
    const preSha256 = ownDataProperty(value, 'preSha256')
    const postSha256 = ownDataProperty(value, 'postSha256')
    const firstDifferingByteOffset = ownDataProperty(value, 'firstDifferingByteOffset')
    const preLines = sanitizeFirewallDiagnosticLines(ownDataProperty(value, 'preLines'))
    const postLines = sanitizeFirewallDiagnosticLines(ownDataProperty(value, 'postLines'))
    const counterOnly = ownDataProperty(value, 'counterOnly')
    const lineDigestTruncated = ownDataProperty(value, 'lineDigestTruncated')
    const byteEqual = ownDataProperty(value, 'byteEqual')
    const timestampOnlyEquivalent = ownDataProperty(value, 'timestampOnlyEquivalent')
    const equivalent = ownDataProperty(value, 'equivalent')
    if (!nonNegativeSafeInteger(preByteLength)
      || !nonNegativeSafeInteger(postByteLength)
      || typeof preSha256 !== 'string' || !SHA256.test(preSha256)
      || typeof postSha256 !== 'string' || !SHA256.test(postSha256)
      || !nonNegativeSafeInteger(firstDifferingByteOffset)
      || firstDifferingByteOffset > Math.min(preByteLength, postByteLength)
      || preLines === null || postLines === null
      || typeof counterOnly !== 'boolean'
      || typeof lineDigestTruncated !== 'boolean'
      || typeof byteEqual !== 'boolean'
      || typeof timestampOnlyEquivalent !== 'boolean'
      || typeof equivalent !== 'boolean'
      || equivalent !== (byteEqual || timestampOnlyEquivalent)
      || (byteEqual && timestampOnlyEquivalent)) return null
    return { preByteLength, postByteLength, preSha256, postSha256, firstDifferingByteOffset, preLines, postLines, counterOnly, lineDigestTruncated, byteEqual, timestampOnlyEquivalent, equivalent }
  } catch {
    return null
  }
}

function sanitizePostflight(value) {
  if (!isObject(value)) return { status: 'not-run', clean: false }
  const resources = Object.fromEntries(TARGET_PROJECTS.map((project) => [project, isObject(value.resources?.[project]) ? Object.fromEntries(['containers', 'volumes', 'networks'].map((kind) => [kind, value.resources[project][kind] === true])) : {}]))
  const firewallChains = Object.fromEntries(RUNNER_FIREWALL_CHAINS.map(([tool, chain]) => {
    const key = `${tool}:${chain}`
    return [key, value.firewallChains?.[key] === true]
  }))
  const firewall = isObject(value.firewall) ? {
    status: value.firewall.status ?? null,
    equal: value.firewall.equal === true,
    byteEqual: value.firewall.byteEqual === true,
    timestampOnlyEquivalent: value.firewall.timestampOnlyEquivalent === true,
    equivalent: value.firewall.equivalent === true,
    preSha256: value.firewall.preSha256 ?? null,
    postSha256: value.firewall.postSha256 ?? null,
    ipv4: isObject(value.firewall.ipv4) ? { preSha256: value.firewall.ipv4.preSha256 ?? null, postSha256: value.firewall.ipv4.postSha256 ?? null, status: value.firewall.ipv4.status ?? null, byteEqual: value.firewall.ipv4.byteEqual === true, timestampOnlyEquivalent: value.firewall.ipv4.timestampOnlyEquivalent === true, equivalent: value.firewall.ipv4.equivalent === true, diagnostic: sanitizeFirewallDiagnostic(value.firewall.ipv4.diagnostic) } : null,
    ipv6: isObject(value.firewall.ipv6) ? { preSha256: value.firewall.ipv6.preSha256 ?? null, postSha256: value.firewall.ipv6.postSha256 ?? null, status: value.firewall.ipv6.status ?? null, byteEqual: value.firewall.ipv6.byteEqual === true, timestampOnlyEquivalent: value.firewall.ipv6.timestampOnlyEquivalent === true, equivalent: value.firewall.ipv6.equivalent === true, diagnostic: sanitizeFirewallDiagnostic(value.firewall.ipv6.diagnostic) } : null,
  } : null
  return { status: typeof value.status === 'string' ? value.status : 'failed', clean: value.clean === true, resources, firewallChains, firewall }
}

function buildReceipt({ options, node, docker, phases, failureReason, artifact, postflight, recovery, cleanup, partialProofOutput }) {
  return {
    schemaVersion: 2,
    tool: 'onprem-image-local-proof',
    status: failureReason ? 'failed' : 'passed',
    hostedEvidence: false,
    dataClass: 'synthetic',
    proofMode: 'full',
    imageScope: 'both',
    sourceSha: options.sourceSha,
    treeSha: options.treeSha,
    runNumber: options.runNumber,
    node: node ?? { sha256: options.nodeSha256, version: null },
    docker: docker ?? null,
    phases,
    failureReason: failureReason ? safeFailureReason(failureReason) : null,
    artifact: artifact ? { manifestSha256: artifact.manifestSha256 ?? (existsSync(artifact.manifestPath) ? sha256File(artifact.manifestPath) : null), evidenceSha: artifact.manifest.evidenceSha, releaseIdentity: artifact.releaseIdentity, groups: artifact.groups } : null,
    postflight: sanitizePostflight(postflight),
    dockerDaemonReset: recovery?.dockerDaemonReset === true,
    verifiedHost: recovery ? { before: sanitizeHostIdentity(recovery.hostBefore), after: sanitizeHostIdentity(recovery.hostAfter) } : { before: null, after: null },
    firewall: recovery?.firewall ? {
      status: recovery.firewall.status ?? 'failed',
      equal: recovery.firewall.equal === true,
      byteEqual: recovery.firewall.byteEqual === true,
      timestampOnlyEquivalent: recovery.firewall.timestampOnlyEquivalent === true,
      equivalent: recovery.firewall.equivalent === true,
      ipv4: { preSha256: recovery.firewall.ipv4?.preSha256 ?? null, postSha256: recovery.firewall.ipv4?.postSha256 ?? null, status: recovery.firewall.ipv4?.status ?? 'missing', byteEqual: recovery.firewall.ipv4?.byteEqual === true, timestampOnlyEquivalent: recovery.firewall.ipv4?.timestampOnlyEquivalent === true, equivalent: recovery.firewall.ipv4?.equivalent === true, diagnostic: sanitizeFirewallDiagnostic(recovery.firewall.ipv4?.diagnostic) },
      ipv6: { preSha256: recovery.firewall.ipv6?.preSha256 ?? null, postSha256: recovery.firewall.ipv6?.postSha256 ?? null, status: recovery.firewall.ipv6?.status ?? 'missing', byteEqual: recovery.firewall.ipv6?.byteEqual === true, timestampOnlyEquivalent: recovery.firewall.ipv6?.timestampOnlyEquivalent === true, equivalent: recovery.firewall.ipv6?.equivalent === true, diagnostic: sanitizeFirewallDiagnostic(recovery.firewall.ipv6?.diagnostic) },
    } : recovery ? { status: 'failed', equal: false, byteEqual: false, timestampOnlyEquivalent: false, equivalent: false, ipv4: null, ipv6: null } : { status: 'not-run', equal: false, byteEqual: false, timestampOnlyEquivalent: false, equivalent: false, ipv4: null, ipv6: null },
    recovery: recovery ? { attempted: recovery.attempted === true, timedOut: recovery.timedOut === true, budgetMs: Number.isSafeInteger(recovery.budgetMs) ? recovery.budgetMs : null, resetBudgetMs: Number.isSafeInteger(recovery.resetBudgetMs) ? recovery.resetBudgetMs : null, firewallBudgetMs: Number.isSafeInteger(recovery.firewallBudgetMs) ? recovery.firewallBudgetMs : null, dockerDaemonReset: recovery.dockerDaemonReset === true, failures: recovery.failures ?? [] } : { attempted: false, timedOut: false, budgetMs: null, resetBudgetMs: null, firewallBudgetMs: null, dockerDaemonReset: false, failures: [] },
    cleanup: cleanup ? { ...cleanup, proofOutput: partialProofOutput ?? cleanup.proofOutput } : { status: 'not-run', failures: [] },
  }
}

export async function runLocalProof(rawOptions, dependencies = {}) {
  const options = validateCliOptions(rawOptions)
  assertExecutingNode(options)
  const deadlineAt = Date.now() + options.deadlineMinutes * 60_000
  mkdirSync(options.runRoot, { recursive: true, mode: 0o700 })
  const runnerTemp = join(options.runRoot, 'runner-temp')
  mkdirSync(runnerTemp, { recursive: true, mode: 0o700 })
  const githubEnvPath = join(options.runRoot, 'github-env')
  const githubOutputPath = join(options.runRoot, 'github-output')
  writeFileSync(githubEnvPath, '', { mode: 0o600 }); writeFileSync(githubOutputPath, '', { mode: 0o600 })
  const env = safeInheritedEnvironment(options.node, options.runRoot)
  Object.assign(env, {
    GITHUB_WORKSPACE: options.workspaceRoot,
    RUNNER_TEMP: runnerTemp,
    GITHUB_ENV: githubEnvPath,
    GITHUB_OUTPUT: githubOutputPath,
    GITHUB_SHA: options.sourceSha,
    GITHUB_RUN_NUMBER: String(options.runNumber),
    EXPECTED_SHA: options.sourceSha,
    PROOF_MODE: 'full',
    IMAGE_SCOPE: 'both',
  })
  const context = { expectedSha: options.sourceSha, proofMode: 'full', imageScope: 'both', runNumber: options.runNumber, githubSha: options.sourceSha }
  const phases = []
  const commandRunner = dependencies.commandRunner ?? defaultReadOnlyCommand
  const hostController = dependencies.hostController ?? {}
  const hostOptions = { ...(dependencies.hostOptions ?? {}), env }
  if (dependencies.hostCommandRunner !== undefined && (!dependencies.hostController || typeof dependencies.hostController !== 'object')) fail('hostCommandRunner injection requires an injected hostController')
  if (dependencies.hostCommandRunner !== undefined && typeof dependencies.hostCommandRunner !== 'function') fail('hostCommandRunner injection must be a function')
  const hostCommandRunner = dependencies.hostCommandRunner
  let nodeIdentity = null; let dockerIdentity = null; let firewallSnapshots = null; let artifact = null; let postflight = null; let failureReason = null
  let verifiedHost = null; let bodyBegan = false; let recovery = null; let cleanup = null; let partialProofOutput = 'not-run'
  let recoveryDeadlineAt = null
  let bodyResult = { phases: [], failureReason: null, env }
  let plan = null
  try {
    const workflow = readFileSync(join(options.workspaceRoot, WORKFLOW_RELATIVE_PATH), 'utf8')
    plan = extractFullProofPlan(workflow)
    for (const [key, value] of Object.entries(plan.globalEnv)) {
      if (!SAFE_ENV_NAME.test(key) || isSecretName(key)) fail(`unsafe workflow env key: ${key}`)
      env[key] = renderWorkflowExpressions(value, context)
    }
    const preflightStart = Date.now()
    try {
      verifiedHost = acquireVerifiedHost({ hostController, ...(hostCommandRunner !== undefined ? { commandRunner: hostCommandRunner } : {}), hostOptions })
      const preflight = (dependencies.preflight ?? runPreflightChecks)({ options, workflow, commandRunner, host: dependencies.host, env, deadlineAt })
      nodeIdentity = preflight.node; dockerIdentity = preflight.docker
      firewallSnapshots = preflight.firewallSnapshots ?? captureFirewallSnapshots({ commandRunner, cwd: options.workspaceRoot, env, deadlineAt })
      phases.push({ name: 'preflight', status: 'passed', exitCode: 0, signal: null, timedOut: false, durationMs: Date.now() - preflightStart })
    } catch (error) {
      phases.push({ name: 'preflight', status: 'failed', exitCode: null, signal: null, timedOut: /deadline/.test(String(error?.message)).valueOf(), durationMs: Date.now() - preflightStart })
      throw error
    }
    bodyBegan = true
    let bodyFailure = null
    try {
      bodyResult = await executeProofBodies({
        steps: plan.steps,
        context,
        baseEnv: env,
        cwd: options.workspaceRoot,
        githubEnvPath,
        deadlineAt,
        executor: dependencies.executor ?? ((input) => executeShellPhase(input)),
        beforeStep: ({ env: phaseEnv, deadlineAt: phaseDeadline }) => (dependencies.rootContextCheck ?? validateDockerRootContext)({ commandRunner, cwd: options.workspaceRoot, env: phaseEnv, deadlineAt: phaseDeadline }),
      })
      phases.push(...bodyResult.phases)
      bodyFailure = bodyResult.failureReason
    } catch (error) {
      bodyFailure = error instanceof Error ? error.message : 'proof body execution failed'
    }
    let outputIdentity = null
    let outputFailure = null
    if (!bodyFailure) {
      try { outputIdentity = validateGitHubOutput(githubOutputPath, options.sourceSha) } catch (error) { outputFailure = error instanceof Error ? error.message : 'proof output identity failed' }
    }
    if (bodyFailure) fail(bodyFailure)
    if (outputFailure) fail(outputFailure)
    const artifactStart = Date.now()
    artifact = collectUploadArtifacts({ workspaceRoot: options.workspaceRoot, runTemp: runnerTemp, outputRoot: options.proofOutput, uploads: plan.uploads, expectedSha: options.sourceSha })
    if (outputIdentity.receipt_sha256 !== artifact.proofReceiptSha256) fail('GITHUB_OUTPUT receipt checksum does not match local proof receipt')
    phases.push({ name: 'artifact-selection', status: 'passed', exitCode: 0, signal: null, timedOut: false, durationMs: Date.now() - artifactStart })
  } catch (error) {
    failureReason = error instanceof Error ? error.message : 'local proof failed'
  } finally {
    if (bodyBegan) {
      const recoveryStart = Date.now()
      recoveryDeadlineAt = recoveryStart + DEFAULT_RECOVERY_BUDGET_MS
      try {
        recovery = recoverDedicatedHost({
          lock: verifiedHost?.lock,
          inspectionBefore: verifiedHost?.inspection,
          hostController: verifiedHost?.controller ?? hostController,
          commandRunner,
          hostCommandRunner,
          hostOptions,
          cwd: options.workspaceRoot,
          env: bodyResult.env,
          snapshots: firewallSnapshots,
          deadlineAt,
          recoveryDeadlineAt,
          bodyBegan,
          allowDisposableDaemonReset: options.allowDisposableDaemonReset,
        })
        for (const [name, phase] of Object.entries(recovery.phases ?? {})) phases.push({ name: `recovery-${name}`, status: phase.status, exitCode: phase.status === 'passed' ? 0 : 1, signal: null, timedOut: phase.timedOut === true, durationMs: phase.durationMs })
        phases.push({ name: 'recovery', status: recovery.failures.length === 0 && recovery.dockerDaemonReset && recovery.firewall?.equivalent === true && recovery.hostAfter ? 'passed' : 'failed', exitCode: recovery.failures.length === 0 ? 0 : 1, signal: null, timedOut: recovery.timedOut === true, durationMs: Date.now() - recoveryStart })
        if (recovery.failures.length > 0 || !recovery.dockerDaemonReset || recovery.firewall?.equivalent !== true || !recovery.hostAfter) {
          failureReason ??= `recovery failed: ${(recovery.failures ?? []).join('; ') || 'identity or firewall recovery was not verified'}`
        }
      } catch (error) {
        recovery = { attempted: true, timedOut: /deadline/.test(String(error?.message)).valueOf(), dockerDaemonReset: false, hostBefore: verifiedHost?.inspection ?? null, hostAfter: null, firewall: { status: 'failed', equal: false, byteEqual: false, timestampOnlyEquivalent: false, equivalent: false, failures: [] }, failures: [safeFailureReason(error)] }
        phases.push({ name: 'recovery', status: 'failed', exitCode: null, signal: null, timedOut: recovery.timedOut, durationMs: Date.now() - recoveryStart })
        failureReason ??= `recovery failed: ${error instanceof Error ? error.message : 'unknown error'}`
      }
      const postflightStart = Date.now()
      try {
        const firewallBaseline = firewallSnapshots?.ipv4 ?? null
        const firewallAfter = recovery?.firewall?.ipv4?.postSha256 ? { sha256: recovery.firewall.ipv4.postSha256 } : null
        const firewallCaptureError = recovery?.firewall?.equivalent === true ? null : new Error('firewall recovery was not verified')
        const inspectedPostflight = (dependencies.postflight ?? inspectPostflight)({ commandRunner, cwd: options.workspaceRoot, env: bodyResult.env, deadlineAt: recoveryDeadlineAt ?? deadlineAt, firewallBaseline, firewallAfter, firewallComparison: recovery?.firewall ?? null, firewallCaptureError })
        postflight = { ...inspectedPostflight, firewall: recovery?.firewall ?? inspectedPostflight.firewall ?? null, clean: Boolean(inspectedPostflight.clean && recovery?.dockerDaemonReset === true && recovery?.firewall?.equivalent === true && recovery?.hostAfter) }
        phases.push({ name: 'postflight', status: postflight.clean ? 'passed' : 'failed', exitCode: postflight.clean ? 0 : 1, signal: null, timedOut: false, durationMs: Date.now() - postflightStart })
        if (!postflight.clean) failureReason ??= 'postflight cleanup residue or recovery identity was not verified'
      } catch (error) {
        postflight = { status: 'failed', clean: false, firewall: recovery?.firewall ?? null }
        phases.push({ name: 'postflight', status: 'failed', exitCode: null, signal: null, timedOut: /deadline/.test(String(error?.message)).valueOf(), durationMs: Date.now() - postflightStart })
        failureReason ??= `postflight failed: ${error instanceof Error ? error.message : 'unknown error'}`
      }
    }
    const cleanupStart = Date.now()
    const cleanupDeadlineAt = bodyBegan ? (recoveryDeadlineAt ?? deadlineAt) : deadlineAt
    try {
      cleanup = cleanupFreshWorkspace({ workspaceRoot: options.workspaceRoot, runRoot: options.runRoot, proofOutput: options.proofOutput, sourceSha: options.sourceSha, treeSha: options.treeSha, commandRunner, env, deadlineAt: cleanupDeadlineAt, includeWorkspaceGenerated: bodyBegan, reproveGit: bodyBegan })
      phases.push({ name: 'workspace-cleanup', status: cleanup.status === 'passed' ? 'passed' : 'failed', exitCode: cleanup.status === 'passed' ? 0 : 1, signal: null, timedOut: cleanup.timedOut === true, durationMs: Date.now() - cleanupStart })
      if (cleanup.status !== 'passed') failureReason ??= `workspace cleanup failed: ${(cleanup.failures ?? []).join('; ') || 'cleanup state was not verified'}`
    } catch (error) {
      cleanup = { status: 'failed', timedOut: /deadline/.test(String(error?.message)).valueOf(), generated: {}, runRoot: 'failed', proofOutput: 'unknown', git: null, failures: [safeFailureReason(error)] }
      phases.push({ name: 'workspace-cleanup', status: 'failed', exitCode: null, signal: null, timedOut: cleanup.timedOut, durationMs: Date.now() - cleanupStart })
      failureReason ??= `workspace cleanup failed: ${error instanceof Error ? error.message : 'unknown error'}`
    }
    if (failureReason) {
      try { partialProofOutput = removePartialProofOutput({ proofOutput: options.proofOutput, workspaceRoot: options.workspaceRoot, runRoot: options.runRoot, commandRunner, env, deadlineAt: cleanupDeadlineAt }) } catch (error) {
        partialProofOutput = 'failed'
        failureReason = `${failureReason}; partial proof output cleanup failed: ${error instanceof Error ? error.message : 'unknown error'}`
      }
    } else {
      partialProofOutput = 'preserved'
    }
    let receiptWritten = false
    const materializeReceipt = () => {
      const receipt = buildReceipt({ options, node: nodeIdentity, docker: dockerIdentity, phases, failureReason, artifact, postflight, recovery, cleanup, partialProofOutput })
      writeFileSync(options.receipt, `${JSON.stringify(receipt)}\n`, { mode: 0o600 })
      receiptWritten = true
    }
    // The receipt is materialized while the verified host lock is still held.
    // A release failure below rewrites it as failed before returning.
    try {
      materializeReceipt()
    } catch (error) {
      failureReason ??= `receipt materialization failed: ${error instanceof Error ? error.message : 'unknown error'}`
    }
    if (verifiedHost?.lock) {
      const lockStart = Date.now()
      try {
        const releaseOptions = { ...hostOptions }
        if (hostCommandRunner !== undefined) releaseOptions.commandRunner = hostCommandRunner
        verifiedHost.controller.releaseHostLock(verifiedHost.lock, releaseOptions)
        phases.push({ name: 'host-lock-release', status: 'passed', exitCode: 0, signal: null, timedOut: false, durationMs: Date.now() - lockStart })
      } catch (error) {
        phases.push({ name: 'host-lock-release', status: 'failed', exitCode: null, signal: null, timedOut: false, durationMs: Date.now() - lockStart })
        failureReason ??= `host lock release failed: ${error instanceof Error ? error.message : 'unknown error'}`
        if (receiptWritten) {
          try { materializeReceipt() } catch (rewriteError) { failureReason = `${failureReason}; failed receipt rewrite: ${rewriteError instanceof Error ? rewriteError.message : 'unknown error'}` }
        }
      }
    }
  }
  if (failureReason) fail(safeFailureReason(failureReason))
  return { receipt: options.receipt, artifact, phases }
}

function cliUsage() {
  return 'Usage: node scripts/onprem-image-local-proof.mjs --source-sha <sha> --tree-sha <tree> --run-number <n> --node <absolute> --node-sha256 <sha256> --run-root <fresh-absolute> --proof-output <fresh-absolute> --receipt <fresh-absolute> --allow-disposable-daemon-reset [--workspace-root <checkout>] [--deadline-minutes <1-60>]'
}

if (process.argv[1] && realpathSync(process.argv[1]) === realpathSync(SCRIPT_PATH)) {
  try {
    const raw = parseArgv(process.argv.slice(2))
    await runLocalProof(raw)
  } catch (error) {
    process.stderr.write(`${safeFailureReason(error)}\n${cliUsage()}\n`)
    process.exitCode = 1
  }
}

export { FULL_PROOF_STEPS, ACTION_STEPS, FULL_PROOF_UPLOAD_CONTRACT, TARGET_PROJECTS, RUNNER_FIREWALL_CHAINS, parseArgv, assertFreshWorkspaceOutputs, dockerIdentityFromOutput }
