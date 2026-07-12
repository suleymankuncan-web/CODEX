import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import {
  buildRunnerEnvironment as buildV2RunnerEnvironment,
  validateInputs as validateV2Inputs,
  verifyRepositoryState as verifyV2RepositoryState,
} from './staging-remediation-invariant-v2-evidence-launcher.mjs'

function required(name, env) {
  const value = env[name]?.trim()
  if (!value) throw new Error(`${name.toLowerCase()}_missing`)
  return value
}

// Trace: FR-12; NFR-01..04, NFR-07; AC-07; EC-09..12.
export function validateInputs(env = process.env, now = Date.now()) {
  const reviewedCommit = required(
    'STAGING_REMEDIATION_RECONCILIATION_REVIEWED_COMMIT',
    env,
  ).toLowerCase()
  if (!/^[a-f0-9]{40}$/.test(reviewedCommit)) throw new Error('reviewed_commit_invalid')
  const evidenceBranch = required(
    'STAGING_REMEDIATION_RECONCILIATION_EVIDENCE_BRANCH',
    env,
  )
  if (!/^codex\/rem7-reconciliation-evidence-v1(?:-[a-z0-9][a-z0-9-]*)?$/.test(evidenceBranch)) {
    throw new Error('evidence_branch_invalid')
  }
  const shared = validateV2Inputs({
    ...env,
    STAGING_REMEDIATION_EVIDENCE_BRANCH:
      'codex/rem-2b-v2-staging-evidence-reconciliation-adapter',
    STAGING_REMEDIATION_INVARIANT_V2_REVIEWED_COMMIT: reviewedCommit,
  }, now)
  return {
    ...shared,
    evidenceBranch,
    launcherDigest: digestLauncherFiles(),
    reviewedCommit,
  }
}

function digestLauncherFiles() {
  const paths = [
    fileURLToPath(import.meta.url),
    fileURLToPath(new URL('./staging-remediation-invariant-v2-evidence-launcher.mjs', import.meta.url)),
  ]
  return createHash('sha256')
    .update(paths.map((path) => `${path.split(/[\\/]/).at(-1)}\0${readFileSync(path)}`).join('\0'))
    .digest('hex')
}

export function buildRunnerEnvironment(inputs, env = process.env) {
  const runnerEnvironment = buildV2RunnerEnvironment(inputs, env)
  delete runnerEnvironment.STAGING_REMEDIATION_INVARIANT_V2_REVIEWED_COMMIT
  runnerEnvironment.STAGING_REMEDIATION_RECONCILIATION_REVIEWED_COMMIT =
    inputs.reviewedCommit
  return runnerEnvironment
}

export function verifyRepositoryState(inputs, executeGit) {
  return verifyV2RepositoryState(inputs, executeGit)
}

// Trace: FR-14; NFR-05, NFR-06; AC-09.
export function validateEvidenceDiffPaths(paths) {
  const allowedExact = new Set([
    'current-state.md',
    'docs/README.md',
    'docs/plans/post-dg2-staging-remediation-and-constraint-reentry-plan-v1.md',
    'docs/plans/rem-2-owner-decision-packet-v1.md',
    'docs/plans/staging-remediation-reconciliation-spec-v1.md',
  ])
  const evidencePattern =
    /^docs\/evidence\/readiness\/\d{4}-\d{2}-\d{2}-staging-remediation-reconciliation-v1\.(?:json|md)$/
  if (!Array.isArray(paths) || paths.length === 0
    || paths.some((path) => typeof path !== 'string'
      || (!allowedExact.has(path.replaceAll('\\', '/'))
        && !evidencePattern.test(path.replaceAll('\\', '/'))))) {
    throw new Error('evidence_diff_scope_violation')
  }
  return paths.map((path) => path.replaceAll('\\', '/')).sort()
}

export function claimEvidenceAttempt(
  inputs,
  temporaryDirectory = tmpdir(),
  attemptedAt = new Date().toISOString(),
) {
  const prefix = `hr-axis-rem7-reconciliation-${inputs.reviewedCommit.slice(0, 8)}`
  const markerPath = join(temporaryDirectory, `${prefix}-attempted.json`)
  const marker = {
    attemptedAt,
    branch: inputs.evidenceBranch,
    event: 'staging_remediation_reconciliation.attempted',
    launcherDigest: inputs.launcherDigest,
    projectRefFingerprint: inputs.projectRefFingerprint,
    reviewedCommit: inputs.reviewedCommit,
    windowEnd: inputs.windowEndText,
    windowStart: inputs.windowStartText,
  }
  try {
    writeFileSync(markerPath, `${JSON.stringify(marker, null, 2)}\n`, {
      encoding: 'utf8', flag: 'wx', mode: 0o600,
    })
  } catch (error) {
    if (error && typeof error === 'object' && error.code === 'EEXIST') {
      throw new Error('attempt_already_recorded')
    }
    throw new Error('attempt_marker_failed')
  }
  return markerPath
}

export function buildMergedRunnerInvocation(platform = process.platform) {
  const npmArgs = [
    '--silent',
    '--prefix',
    'backend/nestjs',
    'run',
    'diagnose:staging:remediation:reconciliation:v1',
  ]
  if (platform === 'win32') {
    return {
      args: ['/d', '/s', '/c', ['npm.cmd', ...npmArgs].join(' ')],
      command: 'cmd.exe',
    }
  }
  return { args: npmArgs, command: 'npm' }
}

function executeMergedRunner(env) {
  const invocation = buildMergedRunnerInvocation()
  return spawnSync(invocation.command, invocation.args, {
    cwd: process.cwd(), encoding: 'utf8', env, maxBuffer: 2 * 1024 * 1024,
  })
}

function assertSafeText(value) {
  const patterns = [
    /\b(?:postgres(?:ql)?|https?):\/\//i,
    /-----BEGIN [A-Z ]+-----/,
    /\bpassword\b/i,
    /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/i,
    /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i,
  ]
  if (patterns.some((pattern) => pattern.test(value))) throw new Error('unsafe_output_rejected')
}

function validateReceipt(stdout, inputs) {
  if (!stdout.trim()) throw new Error('receipt_missing')
  assertSafeText(stdout)
  let receipt
  try {
    receipt = JSON.parse(stdout)
  } catch {
    throw new Error('receipt_invalid')
  }
  const result = receipt.queryResult
  const families = result?.families
  const sources = result?.sourceDigests
  const application = result?.applicationContracts
  const timeout = receipt.timeoutProfile
  const exactFamilies = ['TARGET-02', 'ORG-02', 'ORG-04', 'ASSIGN-01']
  const allowedStates = new Set(['eligible_zero', 'preserved_excluded', 'blocked', 'not_applicable'])
  if (
    receipt.event !== 'staging_remediation_reconciliation.completed' ||
    receipt.receiptVersion !== '1' ||
    receipt.reviewedCommit !== inputs.reviewedCommit ||
    receipt.targetClass !== 'staging' ||
    receipt.tlsMode !== 'verify-full' ||
    receipt.certificateVerified !== true ||
    receipt.transactionReadOnly !== true ||
    receipt.transactionIsolation !== 'repeatable_read' ||
    !/^[a-f0-9]{64}$/.test(receipt.runnerDigest ?? '') ||
    !/^[a-f0-9]{64}$/.test(receipt.targetFingerprint ?? '') ||
    !/^[a-f0-9]{64}$/.test(receipt.receiptDigest ?? '') ||
    result?.querySetVersion !== 'staging-remediation-reconciliation-v1' ||
    !Array.isArray(families) || families.length !== exactFamilies.length ||
    families.some((family, index) => family?.family !== exactFamilies[index]
      || !allowedStates.has(family?.state)
      || !Number.isInteger(family?.activeCount)
      || family.activeCount < 0
      || !Number.isInteger(family?.v1ContinuityCount)
      || family.v1ContinuityCount < 0) ||
    !sources || !['invariantV1', 'invariantV2', 'authorityClassifierV1']
      .every((key) => /^[a-f0-9]{64}$/.test(sources[key] ?? '')) ||
    !Array.isArray(application) || application.length !== 1 ||
    application[0]?.code !== 'target_duplicate_employee_rejected' ||
    application[0]?.state !== 'present' ||
    !/^[a-f0-9]{64}$/.test(application[0]?.sourceDigest ?? '') ||
    timeout?.connectionMs !== 5000 || timeout?.idleMs !== 1000 ||
    timeout?.queryMs !== 30000 || timeout?.statementMs !== 30000
  ) {
    throw new Error('receipt_contract_mismatch')
  }
  return receipt
}

export function executeEvidence(
  inputs,
  runnerEnvironment,
  {
    attemptedAt = new Date().toISOString(),
    executeRunner = executeMergedRunner,
    temporaryDirectory = tmpdir(),
  } = {},
) {
  const attemptMarkerPath = claimEvidenceAttempt(inputs, temporaryDirectory, attemptedAt)
  const prefix = `hr-axis-rem7-reconciliation-${inputs.reviewedCommit.slice(0, 8)}`
  const receiptPath = join(temporaryDirectory, `${prefix}-receipt.json`)
  const stderrPath = join(temporaryDirectory, `${prefix}-stderr.txt`)
  const result = executeRunner(runnerEnvironment)
  const stderr = typeof result?.stderr === 'string' ? result.stderr : ''
  const stdout = typeof result?.stdout === 'string' ? result.stdout : ''

  assertSafeText(stderr)
  writeFileSync(stderrPath, stderr, { encoding: 'utf8', mode: 0o600 })
  if (result?.status !== 0 && result?.status !== 2) throw new Error('runner_safety_failure')
  if (stderr.trim()) throw new Error('runner_stderr_rejected')

  const receipt = validateReceipt(stdout, inputs)
  writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`, {
    encoding: 'utf8', mode: 0o600,
  })
  return {
    attemptMarkerPath,
    event: receipt.event,
    exitCode: result.status,
    familyStates: Object.fromEntries(receipt.queryResult.families.map((item) => [item.family, item.state])),
    launcherDigest: inputs.launcherDigest,
    overallState: receipt.queryResult.overallState,
    projectRefFingerprint: inputs.projectRefFingerprint,
    receiptDigest: receipt.receiptDigest,
    receiptPath,
    reviewedCommit: receipt.reviewedCommit,
    stderrPath,
  }
}

export function safeFailure(error) {
  const allowed = new Set([
    'attempt_already_recorded', 'attempt_marker_failed', 'ca_file_missing',
    'ca_pem_invalid', 'ca_private_key_refused', 'database_protocol_invalid',
    'evidence_branch_invalid', 'evidence_branch_mismatch', 'git_command_failed',
    'evidence_diff_scope_violation',
    'origin_main_mismatch', 'owner_authorization_missing', 'production_target_refused',
    'project_ref_fingerprint_missing', 'project_ref_mismatch', 'project_ref_unresolved',
    'receipt_contract_mismatch', 'receipt_invalid', 'receipt_missing',
    'reviewed_commit_invalid', 'reviewed_commit_mismatch', 'run_window_inactive',
    'run_window_invalid', 'run_window_timezone_invalid', 'runner_safety_failure',
    'runner_stderr_rejected', 'target_identity_mismatch', 'target_identity_missing',
    'unsafe_output_rejected', 'verify_full_required', 'worktree_dirty',
  ])
  const code = error instanceof Error && allowed.has(error.message)
    ? error.message
    : 'staging_remediation_reconciliation_launcher_failed'
  process.stderr.write(`${JSON.stringify({
    error: code,
    event: 'staging_remediation_reconciliation.launcher_failed',
  })}\n`)
  process.exitCode = 1
}

function main() {
  try {
    const inputs = validateInputs()
    if (process.argv.includes('--validate-inputs-only')) {
      process.stdout.write(`${JSON.stringify({
        certificatePemLoaded: true,
        event: 'staging_remediation_reconciliation.inputs_validated',
        targetIdentityMatched: true,
        windowActive: true,
      })}\n`)
      return
    }
    verifyRepositoryState(inputs)
    const summary = executeEvidence(inputs, buildRunnerEnvironment(inputs))
    process.stdout.write(`${JSON.stringify(summary)}\n`)
  } catch (error) {
    safeFailure(error)
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main()
