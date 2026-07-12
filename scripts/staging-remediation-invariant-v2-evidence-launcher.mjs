import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const standingAuthorization = 'standing-owner-authorization-2026-07-12'
const maximumWindowMs = 60 * 60_000

// Trace: FR-DIAG-08, FR-DIAG-09, FR-DIAG-11; NFR-01..04;
// AC-01, AC-11, AC-12; EC-09. This launcher changes no query or business row.

function required(name, env) {
  const value = env[name]?.trim()
  if (!value) throw new Error(`${name.toLowerCase()}_missing`)
  return value
}

export function validateInputs(env = process.env, now = Date.now()) {
  if (required('STAGING_REMEDIATION_OWNER_AUTHORIZATION', env) !== standingAuthorization) {
    throw new Error('owner_authorization_missing')
  }
  if (required('DB_SSL_MODE', env).toLowerCase() !== 'verify-full') {
    throw new Error('verify_full_required')
  }

  const windowStartText = required('STAGING_REMEDIATION_WINDOW_START', env)
  const windowEndText = required('STAGING_REMEDIATION_WINDOW_END', env)
  if (!windowStartText.endsWith('+03:00') || !windowEndText.endsWith('+03:00')) {
    throw new Error('run_window_timezone_invalid')
  }
  const windowStart = Date.parse(windowStartText)
  const windowEnd = Date.parse(windowEndText)
  if (
    !Number.isFinite(windowStart) ||
    !Number.isFinite(windowEnd) ||
    windowEnd <= windowStart ||
    windowEnd - windowStart > maximumWindowMs
  ) {
    throw new Error('run_window_invalid')
  }
  if (now < windowStart || now > windowEnd) throw new Error('run_window_inactive')

  const databaseUrl = new URL(required('DATABASE_URL', env))
  if (!['postgres:', 'postgresql:'].includes(databaseUrl.protocol)) {
    throw new Error('database_protocol_invalid')
  }
  const expectedHostValue =
    env.DATABASE_INVARIANT_PREFLIGHT_EXPECTED_HOST?.trim()
  const expectedDatabase =
    env.DATABASE_INVARIANT_PREFLIGHT_EXPECTED_DATABASE?.trim()
  if (!expectedHostValue || !expectedDatabase) {
    throw new Error('target_identity_missing')
  }
  const expectedHost = expectedHostValue.toLowerCase()
  const actualDatabase = decodeURIComponent(databaseUrl.pathname.replace(/^\/+/, ''))
  if (
    databaseUrl.hostname.toLowerCase() !== expectedHost ||
    actualDatabase !== expectedDatabase
  ) {
    throw new Error('target_identity_mismatch')
  }
  if (/prod(?:uction)?/i.test(`${expectedHost}\0${expectedDatabase}`)) {
    throw new Error('production_target_refused')
  }
  const expectedProjectRefFingerprint =
    env.STAGING_REMEDIATION_EXPECTED_PROJECT_REF_SHA256?.trim().toLowerCase()
  if (!expectedProjectRefFingerprint || !/^[a-f0-9]{64}$/.test(expectedProjectRefFingerprint)) {
    throw new Error('project_ref_fingerprint_missing')
  }
  const username = decodeURIComponent(databaseUrl.username)
  const usernameMatch = username.match(/^postgres\.([a-z0-9]+)$/i)
  const directHostMatch = databaseUrl.hostname.match(
    /^db\.([a-z0-9]+)\.supabase\.co$/i,
  )
  const projectRef = usernameMatch?.[1] ?? directHostMatch?.[1]
  if (!projectRef) throw new Error('project_ref_unresolved')
  const projectRefFingerprint = createHash('sha256')
    .update(projectRef.toLowerCase())
    .digest('hex')
  if (projectRefFingerprint !== expectedProjectRefFingerprint) {
    throw new Error('project_ref_mismatch')
  }

  const caFile = env.STAGING_REMEDIATION_CA_FILE?.trim()
  if (!caFile) throw new Error('ca_file_missing')
  const caPem = readFileSync(caFile, 'utf8')
  if (
    !caPem.includes('-----BEGIN CERTIFICATE-----') ||
    !caPem.includes('-----END CERTIFICATE-----')
  ) {
    throw new Error('ca_pem_invalid')
  }
  if (/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(caPem)) {
    throw new Error('ca_private_key_refused')
  }
  const reviewedCommit = required(
    'STAGING_REMEDIATION_INVARIANT_V2_REVIEWED_COMMIT',
    env,
  ).toLowerCase()
  if (!/^[a-f0-9]{40}$/.test(reviewedCommit)) {
    throw new Error('reviewed_commit_invalid')
  }
  const evidenceBranch = required('STAGING_REMEDIATION_EVIDENCE_BRANCH', env)
  if (!/^codex\/rem-2b-v2-staging-evidence(?:-[a-z0-9][a-z0-9-]*)?$/.test(evidenceBranch)) {
    throw new Error('evidence_branch_invalid')
  }

  return {
    caPem,
    databaseUrl: required('DATABASE_URL', env),
    evidenceBranch,
    expectedDatabase,
    expectedHost,
    launcherDigest: createHash('sha256')
      .update(readFileSync(fileURLToPath(import.meta.url)))
      .digest('hex'),
    projectRefFingerprint,
    reviewedCommit,
    windowEndText,
    windowStartText,
  }
}

export function buildRunnerEnvironment(inputs, env = process.env) {
  const runnerEnvironment = {
    ...env,
    DATABASE_INVARIANT_PREFLIGHT_ACK: 'read-only-approved',
    DATABASE_INVARIANT_PREFLIGHT_EXPECTED_DATABASE: inputs.expectedDatabase,
    DATABASE_INVARIANT_PREFLIGHT_EXPECTED_HOST: inputs.expectedHost,
    DATABASE_INVARIANT_PREFLIGHT_STAGING_APPROVED: 'true',
    DATABASE_INVARIANT_PREFLIGHT_TARGET: 'staging',
    DATABASE_URL: inputs.databaseUrl,
    DB_SSL_CA: inputs.caPem,
    DB_SSL_MODE: 'verify-full',
    NODE_ENV: 'staging',
    STAGING_REMEDIATION_INVARIANT_V2_REVIEWED_COMMIT:
      inputs.reviewedCommit,
  }
  delete runnerEnvironment.STAGING_REMEDIATION_CA_FILE
  return runnerEnvironment
}

function runGit(args) {
  return spawnSync('git', args, {
    cwd: process.cwd(),
    encoding: 'utf8',
    maxBuffer: 1024 * 1024,
  })
}

export function verifyRepositoryState(inputs, executeGit = runGit) {
  const execute = (args) => {
    const result = executeGit(args)
    if (!result || result.status !== 0) throw new Error('git_command_failed')
    return result.stdout.trim()
  }

  execute(['fetch', 'origin', '--quiet'])
  const branch = execute(['branch', '--show-current'])
  const head = execute(['rev-parse', 'HEAD']).toLowerCase()
  const originMain = execute(['rev-parse', 'origin/main']).toLowerCase()
  const worktreeStatus = execute(['status', '--porcelain=v1'])

  if (branch !== inputs.evidenceBranch) throw new Error('evidence_branch_mismatch')
  if (head !== inputs.reviewedCommit) throw new Error('reviewed_commit_mismatch')
  if (originMain !== inputs.reviewedCommit) throw new Error('origin_main_mismatch')
  if (worktreeStatus) throw new Error('worktree_dirty')

  return { branch, head, originMain, worktreeClean: true }
}

export function claimEvidenceAttempt(
  inputs,
  temporaryDirectory,
  attemptedAt = new Date().toISOString(),
) {
  const markerPath = join(
    temporaryDirectory,
    `hr-axis-rem2b-v2-${inputs.reviewedCommit.slice(0, 8)}-attempted.json`,
  )
  const marker = {
    attemptedAt,
    branch: inputs.evidenceBranch,
    event: 'staging_remediation_invariant_v2.attempted',
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
    'diagnose:staging:remediation:v2',
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
  return spawnSync(
    invocation.command,
    invocation.args,
    {
      cwd: process.cwd(),
      encoding: 'utf8',
      env,
      maxBuffer: 2 * 1024 * 1024,
    },
  )
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
  if (
    receipt.event !== 'staging_remediation_invariant_v2.completed' ||
    receipt.reviewedCommit !== inputs.reviewedCommit ||
    receipt.targetClass !== 'staging' ||
    receipt.tlsMode !== 'verify-full' ||
    receipt.certificateVerified !== true ||
    receipt.transactionReadOnly !== true ||
    receipt.transactionIsolation !== 'repeatable_read' ||
    !/^[a-f0-9]{64}$/.test(receipt.receiptDigest ?? '') ||
    !Number.isInteger(receipt.queryResult?.overallCheckHits?.count) ||
    receipt.queryResult.overallCheckHits.count < 0
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
  const prefix = `hr-axis-rem2b-v2-${inputs.reviewedCommit.slice(0, 8)}`
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
    event: receipt.event,
    exitCode: result.status,
    launcherDigest: inputs.launcherDigest,
    overallCheckHits: receipt.queryResult.overallCheckHits.count,
    projectRefFingerprint: inputs.projectRefFingerprint,
    receiptDigest: receipt.receiptDigest,
    receiptPath,
    reviewedCommit: receipt.reviewedCommit,
    stderrPath,
  }
}

export function safeFailure(error) {
  const allowed = new Set([
    'ca_pem_invalid',
    'ca_private_key_refused',
    'ca_file_missing',
    'attempt_already_recorded',
    'attempt_marker_failed',
    'database_protocol_invalid',
    'evidence_branch_mismatch',
    'evidence_branch_invalid',
    'git_command_failed',
    'owner_authorization_missing',
    'origin_main_mismatch',
    'production_target_refused',
    'project_ref_fingerprint_missing',
    'project_ref_mismatch',
    'project_ref_unresolved',
    'run_window_inactive',
    'run_window_invalid',
    'run_window_timezone_invalid',
    'reviewed_commit_mismatch',
    'reviewed_commit_invalid',
    'receipt_contract_mismatch',
    'receipt_invalid',
    'receipt_missing',
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
    : 'staging_remediation_invariant_v2_launcher_failed'
  process.stderr.write(`${JSON.stringify({
    error: code,
    event: 'staging_remediation_invariant_v2.launcher_failed',
  })}\n`)
  process.exitCode = 1
}

function main() {
  try {
    const inputs = validateInputs()
    if (process.argv.includes('--validate-inputs-only')) {
      process.stdout.write(`${JSON.stringify({
        certificatePemLoaded: true,
        event: 'staging_remediation_invariant_v2.inputs_validated',
        targetIdentityMatched: true,
        windowActive: true,
      })}\n`)
      return
    }
    verifyRepositoryState(inputs)
    const summary = executeEvidence(
      inputs,
      buildRunnerEnvironment(inputs),
    )
    process.stdout.write(`${JSON.stringify(summary)}\n`)
  } catch (error) {
    safeFailure(error)
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main()
