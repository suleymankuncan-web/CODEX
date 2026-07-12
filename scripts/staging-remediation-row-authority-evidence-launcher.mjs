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

// Trace: FR-13, FR-14; NFR-02..05; AC-06; EC-13, EC-14.
function required(name, env) {
  const value = env[name]?.trim()
  if (!value) throw new Error(`${name.toLowerCase()}_missing`)
  return value
}

export function validateInputs(env = process.env, now = Date.now()) {
  const reviewedCommit = required(
    'STAGING_REMEDIATION_AUTHORITY_CLASSIFIER_REVIEWED_COMMIT',
    env,
  ).toLowerCase()
  if (!/^[a-f0-9]{40}$/.test(reviewedCommit)) {
    throw new Error('reviewed_commit_invalid')
  }
  const evidenceBranch = required(
    'STAGING_REMEDIATION_AUTHORITY_EVIDENCE_BRANCH',
    env,
  )
  if (!/^codex\/rem-row-authority-evidence-v1(?:-[a-z0-9][a-z0-9-]*)?$/.test(evidenceBranch)) {
    throw new Error('evidence_branch_invalid')
  }

  const translatedEnvironment = {
    ...env,
    STAGING_REMEDIATION_CA_FILE: env.STAGING_REMEDIATION_CA_FILE,
    STAGING_REMEDIATION_EVIDENCE_BRANCH:
      'codex/rem-2b-v2-staging-evidence-authority-adapter',
    STAGING_REMEDIATION_EXPECTED_PROJECT_REF_SHA256:
      env.STAGING_REMEDIATION_EXPECTED_PROJECT_REF_SHA256,
    STAGING_REMEDIATION_INVARIANT_V2_REVIEWED_COMMIT: reviewedCommit,
  }
  const shared = validateV2Inputs(translatedEnvironment, now)
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
  runnerEnvironment.STAGING_REMEDIATION_AUTHORITY_CLASSIFIER_REVIEWED_COMMIT =
    inputs.reviewedCommit
  return runnerEnvironment
}

export function verifyRepositoryState(inputs, executeGit) {
  return verifyV2RepositoryState(inputs, executeGit)
}

export function claimEvidenceAttempt(
  inputs,
  temporaryDirectory = tmpdir(),
  attemptedAt = new Date().toISOString(),
) {
  const prefix = `hr-axis-rem-authority-${inputs.reviewedCommit.slice(0, 8)}`
  const markerPath = join(temporaryDirectory, `${prefix}-attempted.json`)
  const marker = {
    attemptedAt,
    branch: inputs.evidenceBranch,
    event: 'staging_remediation_row_authority_classifier.attempted',
    launcherDigest: inputs.launcherDigest,
    projectRefFingerprint: inputs.projectRefFingerprint,
    reviewedCommit: inputs.reviewedCommit,
    windowEnd: inputs.windowEndText,
    windowStart: inputs.windowStartText,
  }
  try {
    writeFileSync(markerPath, `${JSON.stringify(marker, null, 2)}\n`, {
      encoding: 'utf8',
      flag: 'wx',
      mode: 0o600,
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
    'diagnose:staging:remediation:authority:v1',
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
    cwd: process.cwd(),
    encoding: 'utf8',
    env,
    maxBuffer: 2 * 1024 * 1024,
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
  if (patterns.some((pattern) => pattern.test(value))) {
    throw new Error('unsafe_output_rejected')
  }
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
  const totals = receipt.queryResult?.familyTotals
  const v2Totals = receipt.queryResult?.v2FamilyTotals
  const contracts = receipt.queryResult?.sourceContracts
  const timeout = receipt.timeoutProfile
  if (
    receipt.event !== 'staging_remediation_row_authority_classifier.completed' ||
    receipt.receiptVersion !== '1' ||
    receipt.reviewedCommit !== inputs.reviewedCommit ||
    receipt.targetClass !== 'staging' ||
    receipt.tlsMode !== 'verify-full' ||
    receipt.certificateVerified !== true ||
    receipt.transactionReadOnly !== true ||
    receipt.transactionIsolation !== 'repeatable_read' ||
    !/^[a-f0-9]{64}$/.test(receipt.classifierQueryDigest ?? '') ||
    !/^[a-f0-9]{64}$/.test(receipt.invariantV2QueryDigest ?? '') ||
    !/^[a-f0-9]{64}$/.test(receipt.runnerDigest ?? '') ||
    !/^[a-f0-9]{64}$/.test(receipt.targetFingerprint ?? '') ||
    !/^[a-f0-9]{64}$/.test(receipt.receiptDigest ?? '') ||
    receipt.queryResult?.querySetVersion !==
      'staging-remediation-row-authority-classifier-v1' ||
    !Array.isArray(totals) || totals.length !== 3 ||
    !Array.isArray(v2Totals) || v2Totals.length !== 4 ||
    !Number.isInteger(receipt.queryResult?.overall?.checkHitCount) ||
    receipt.queryResult.overall.checkHitCount < 0 ||
    !Number.isInteger(receipt.queryResult?.overall?.authorityUnitCount) ||
    receipt.queryResult.overall.authorityUnitCount < 0 ||
    !Array.isArray(contracts) || contracts.length !== 1 ||
    contracts[0]?.code !== 'assignment_rotation_lifecycle' ||
    contracts[0]?.state !== 'absent' ||
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
  const attemptMarkerPath = claimEvidenceAttempt(
    inputs,
    temporaryDirectory,
    attemptedAt,
  )
  const prefix = `hr-axis-rem-authority-${inputs.reviewedCommit.slice(0, 8)}`
  const receiptPath = join(temporaryDirectory, `${prefix}-receipt.json`)
  const stderrPath = join(temporaryDirectory, `${prefix}-stderr.txt`)
  const result = executeRunner(runnerEnvironment)
  const stderr = typeof result?.stderr === 'string' ? result.stderr : ''
  const stdout = typeof result?.stdout === 'string' ? result.stdout : ''

  assertSafeText(stderr)
  writeFileSync(stderrPath, stderr, { encoding: 'utf8', mode: 0o600 })
  if (result?.status !== 0 && result?.status !== 2) {
    throw new Error('runner_safety_failure')
  }
  if (stderr.trim()) throw new Error('runner_stderr_rejected')

  const receipt = validateReceipt(stdout, inputs)
  writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`, {
    encoding: 'utf8',
    mode: 0o600,
  })
  return {
    attemptMarkerPath,
    authorityUnitCount: receipt.queryResult.overall.authorityUnitCount,
    event: receipt.event,
    exitCode: result.status,
    launcherDigest: inputs.launcherDigest,
    overallCheckHits: receipt.queryResult.overall.checkHitCount,
    projectRefFingerprint: inputs.projectRefFingerprint,
    receiptDigest: receipt.receiptDigest,
    receiptPath,
    reviewedCommit: receipt.reviewedCommit,
    stderrPath,
  }
}

export function safeFailure(error) {
  const allowed = new Set([
    'attempt_already_recorded',
    'attempt_marker_failed',
    'ca_file_missing',
    'ca_pem_invalid',
    'ca_private_key_refused',
    'database_protocol_invalid',
    'evidence_branch_invalid',
    'evidence_branch_mismatch',
    'git_command_failed',
    'origin_main_mismatch',
    'owner_authorization_missing',
    'production_target_refused',
    'project_ref_fingerprint_missing',
    'project_ref_mismatch',
    'project_ref_unresolved',
    'receipt_contract_mismatch',
    'receipt_invalid',
    'receipt_missing',
    'reviewed_commit_invalid',
    'reviewed_commit_mismatch',
    'run_window_inactive',
    'run_window_invalid',
    'run_window_timezone_invalid',
    'runner_safety_failure',
    'runner_stderr_rejected',
    'target_identity_mismatch',
    'target_identity_missing',
    'unsafe_output_rejected',
    'verify_full_required',
    'worktree_dirty',
  ])
  const code = error instanceof Error && allowed.has(error.message)
    ? error.message
    : 'staging_remediation_row_authority_classifier_launcher_failed'
  process.stderr.write(`${JSON.stringify({
    error: code,
    event: 'staging_remediation_row_authority_classifier.launcher_failed',
  })}\n`)
  process.exitCode = 1
}

function main() {
  try {
    const inputs = validateInputs()
    if (process.argv.includes('--validate-inputs-only')) {
      process.stdout.write(`${JSON.stringify({
        certificatePemLoaded: true,
        event: 'staging_remediation_row_authority_classifier.inputs_validated',
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
