import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import {
  buildMergedRunnerInvocation,
  buildRunnerEnvironment,
  claimEvidenceAttempt,
  executeEvidence,
  validateEvidenceDiffPaths,
  validateInputs,
  verifyRepositoryState,
} from './staging-remediation-reconciliation-evidence-launcher.mjs'

function istanbulIso(timestamp) {
  return `${new Date(timestamp + 3 * 60 * 60_000).toISOString().replace(/Z$/, '')}+03:00`
}

function validEnvironment(caFile) {
  const now = Date.now()
  const scheme = 'postgresql' + '://'
  return {
    ...process.env,
    DATABASE_INVARIANT_PREFLIGHT_EXPECTED_DATABASE: 'postgres',
    DATABASE_INVARIANT_PREFLIGHT_EXPECTED_HOST: 'staging.example',
    DATABASE_URL: `${scheme}postgres.example:placeholder@staging.example:6543/postgres`,
    DB_SSL_MODE: 'verify-full',
    STAGING_REMEDIATION_CA_FILE: caFile,
    STAGING_REMEDIATION_EXPECTED_PROJECT_REF_SHA256:
      createHash('sha256').update('example').digest('hex'),
    STAGING_REMEDIATION_OWNER_AUTHORIZATION: 'standing-owner-authorization-2026-07-12',
    STAGING_REMEDIATION_RECONCILIATION_EVIDENCE_BRANCH:
      'codex/rem7-reconciliation-evidence-v1-reviewed',
    STAGING_REMEDIATION_RECONCILIATION_REVIEWED_COMMIT: 'a'.repeat(40),
    STAGING_REMEDIATION_WINDOW_END: istanbulIso(now + 5 * 60_000),
    STAGING_REMEDIATION_WINDOW_START: istanbulIso(now - 5 * 60_000),
  }
}

function withCa(run) {
  const directory = mkdtempSync(join(tmpdir(), 'hr-axis-rem7-launcher-'))
  try {
    const caFile = join(directory, 'ca.pem')
    writeFileSync(caFile, '-----BEGIN CERTIFICATE-----\nTEST-ONLY\n-----END CERTIFICATE-----\n', 'utf8')
    return run({ caFile, directory })
  } finally {
    rmSync(directory, { force: true, recursive: true })
  }
}

// Trace: FR-12; NFR-01..04, NFR-07; AC-07; EC-09..12.
test('validates guarded reconciliation inputs and forwards only the merged SHA and CA content', () => withCa(({ caFile }) => {
  const env = validEnvironment(caFile)
  const inputs = validateInputs(env)
  const runner = buildRunnerEnvironment(inputs, env)
  assert.equal(inputs.evidenceBranch, 'codex/rem7-reconciliation-evidence-v1-reviewed')
  assert.equal(runner.STAGING_REMEDIATION_RECONCILIATION_REVIEWED_COMMIT, 'a'.repeat(40))
  assert.equal(runner.STAGING_REMEDIATION_CA_FILE, undefined)
  assert.match(runner.DB_SSL_CA, /BEGIN CERTIFICATE/)
}))

test('pins evidence branch, HEAD, origin/main and clean state', () => {
  const reviewedCommit = 'a'.repeat(40)
  const evidenceBranch = 'codex/rem7-reconciliation-evidence-v1-reviewed'
  const responses = new Map([
    ['fetch origin --quiet', { status: 0, stderr: '', stdout: '' }],
    ['branch --show-current', { status: 0, stderr: '', stdout: `${evidenceBranch}\n` }],
    ['rev-parse HEAD', { status: 0, stderr: '', stdout: `${reviewedCommit}\n` }],
    ['rev-parse origin/main', { status: 0, stderr: '', stdout: `${reviewedCommit}\n` }],
    ['status --porcelain=v1', { status: 0, stderr: '', stdout: '' }],
  ])
  assert.equal(verifyRepositoryState(
    { evidenceBranch, reviewedCommit },
    (args) => responses.get(args.join(' ')),
  ).worktreeClean, true)
})

test('atomically consumes one attempt per reviewed SHA', () => withCa(({ directory }) => {
  const inputs = {
    evidenceBranch: 'codex/rem7-reconciliation-evidence-v1-reviewed',
    launcherDigest: 'c'.repeat(64),
    projectRefFingerprint: 'd'.repeat(64),
    reviewedCommit: 'a'.repeat(40),
    windowEndText: '2026-07-12T16:30:00+03:00',
    windowStartText: '2026-07-12T16:00:00+03:00',
  }
  const marker = claimEvidenceAttempt(inputs, directory, '2026-07-12T13:05:00.000Z')
  assert.equal(JSON.parse(readFileSync(marker, 'utf8')).event, 'staging_remediation_reconciliation.attempted')
  assert.throws(() => claimEvidenceAttempt(inputs, directory), /attempt_already_recorded/)
}))

// Trace: FR-12; NFR-07; AC-07; EC-10.
test('wraps npm.cmd through cmd.exe on Windows', () => {
  assert.deepEqual(buildMergedRunnerInvocation('win32'), {
    args: ['/d', '/s', '/c', 'npm.cmd --silent --prefix backend/nestjs run diagnose:staging:remediation:reconciliation:v1'],
    command: 'cmd.exe',
  })
})

// Trace: FR-14; NFR-05, NFR-06; AC-09.
test('allows only evidence, handoff, plan and index files in the evidence PR', () => {
  assert.deepEqual(validateEvidenceDiffPaths([
    'docs/evidence/readiness/2026-07-12-staging-remediation-reconciliation-v1.json',
    'docs/evidence/readiness/2026-07-12-staging-remediation-reconciliation-v1.md',
    'current-state.md',
    'docs/README.md',
  ]), [
    'current-state.md',
    'docs/README.md',
    'docs/evidence/readiness/2026-07-12-staging-remediation-reconciliation-v1.json',
    'docs/evidence/readiness/2026-07-12-staging-remediation-reconciliation-v1.md',
  ])
  assert.throws(() => validateEvidenceDiffPaths([
    'backend/nestjs/scripts/staging-remediation-reconciliation.ts',
  ]), /evidence_diff_scope_violation/)
})

test('accepts exit two only with an exact sanitized reconciliation receipt', () => withCa(({ directory }) => {
  const inputs = {
    launcherDigest: 'c'.repeat(64),
    projectRefFingerprint: 'd'.repeat(64),
    reviewedCommit: 'a'.repeat(40),
  }
  const receipt = validReceipt(inputs.reviewedCommit)
  const summary = executeEvidence(inputs, {}, {
    executeRunner: () => ({ status: 2, stderr: '', stdout: `${JSON.stringify(receipt)}\n` }),
    temporaryDirectory: directory,
  })
  assert.equal(summary.overallState, 'target_eligible_other_families_blocked')
  assert.equal(summary.familyStates['TARGET-02'], 'eligible_zero')
}))

test('rejects stderr and malformed family catalogs', () => withCa(({ directory }) => {
  const inputs = {
    launcherDigest: 'c'.repeat(64),
    projectRefFingerprint: 'd'.repeat(64),
    reviewedCommit: 'b'.repeat(40),
  }
  assert.throws(() => executeEvidence(inputs, {}, {
    executeRunner: () => ({ status: 2, stderr: 'unsafe', stdout: JSON.stringify(validReceipt(inputs.reviewedCommit)) }),
    temporaryDirectory: directory,
  }), /runner_stderr_rejected/)

  const malformed = validReceipt(inputs.reviewedCommit)
  malformed.queryResult.families.pop()
  const secondDirectory = mkdtempSync(join(tmpdir(), 'hr-axis-rem7-malformed-'))
  try {
    assert.throws(() => executeEvidence(inputs, {}, {
      executeRunner: () => ({ status: 2, stderr: '', stdout: JSON.stringify(malformed) }),
      temporaryDirectory: secondDirectory,
    }), /receipt_contract_mismatch/)
  } finally {
    rmSync(secondDirectory, { force: true, recursive: true })
  }
}))

function validReceipt(reviewedCommit) {
  const families = [
    family('TARGET-02', 'eligible_zero', 54, 0),
    family('ORG-02', 'blocked', 3, 3, 3),
    family('ORG-04', 'blocked', 7, 7, 3),
    family('ASSIGN-01', 'blocked', 4, 4, 2),
  ]
  return {
    certificateVerified: true,
    event: 'staging_remediation_reconciliation.completed',
    queryResult: {
      applicationContracts: [{
        code: 'target_duplicate_employee_rejected', sourceDigest: '4'.repeat(64), state: 'present',
      }],
      families,
      observedAt: '2026-07-12T13:05:00.000Z',
      overallState: 'target_eligible_other_families_blocked',
      querySetVersion: 'staging-remediation-reconciliation-v1',
      sourceDigests: {
        authorityClassifierV1: '3'.repeat(64), invariantV1: '1'.repeat(64), invariantV2: '2'.repeat(64),
      },
    },
    receiptDigest: '5'.repeat(64),
    receiptVersion: '1',
    reviewedCommit,
    runnerDigest: '6'.repeat(64),
    targetClass: 'staging',
    targetFingerprint: '7'.repeat(64),
    timeoutProfile: { connectionMs: 5000, idleMs: 1000, queryMs: 30000, statementMs: 30000 },
    tlsMode: 'verify-full',
    transactionIsolation: 'repeatable_read',
    transactionReadOnly: true,
  }
}

function family(familyCode, state, v1ContinuityCount, activeCount, authorityUnitCount) {
  return {
    activeCount,
    activeQuerySetVersion: 'staging-remediation-invariant-v2',
    ...(authorityUnitCount === undefined ? {} : { authorityUnitCount }),
    constraintEligibility: state === 'eligible_zero' ? 'eligible_after_rem8' : 'blocked',
    decisionRefs: ['locked'],
    family: familyCode,
    nextGate: state === 'eligible_zero' ? 'rem_8' : 'authoritative_row_evidence',
    reason: state === 'eligible_zero'
      ? 'target_zero_locked_preserve_application_enforced'
      : 'authoritative_row_evidence_absent',
    state,
    v1ContinuityCount,
  }
}
