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
  validateInputs,
  verifyRepositoryState,
} from './staging-remediation-row-authority-evidence-launcher.mjs'

function istanbulIso(timestamp) {
  return `${new Date(timestamp + 3 * 60 * 60_000).toISOString().replace(/Z$/, '')}+03:00`
}

function validEnvironment(caFile) {
  const now = Date.now()
  return {
    ...process.env,
    DATABASE_INVARIANT_PREFLIGHT_EXPECTED_DATABASE: 'postgres',
    DATABASE_INVARIANT_PREFLIGHT_EXPECTED_HOST: 'aws-0-eu-central-1.pooler.supabase.com',
    DATABASE_URL: 'postgresql://postgres.example:placeholder@aws-0-eu-central-1.pooler.supabase.com:6543/postgres',
    DB_SSL_MODE: 'verify-full',
    STAGING_REMEDIATION_AUTHORITY_CLASSIFIER_REVIEWED_COMMIT: 'a'.repeat(40),
    STAGING_REMEDIATION_AUTHORITY_EVIDENCE_BRANCH: 'codex/rem-row-authority-evidence-v1-reviewed',
    STAGING_REMEDIATION_CA_FILE: caFile,
    STAGING_REMEDIATION_EXPECTED_PROJECT_REF_SHA256: createHash('sha256').update('example').digest('hex'),
    STAGING_REMEDIATION_OWNER_AUTHORIZATION: 'standing-owner-authorization-2026-07-12',
    STAGING_REMEDIATION_WINDOW_END: istanbulIso(now + 5 * 60_000),
    STAGING_REMEDIATION_WINDOW_START: istanbulIso(now - 5 * 60_000),
  }
}

function withCa(run) {
  const directory = mkdtempSync(join(tmpdir(), 'hr-axis-authority-launcher-'))
  try {
    const caFile = join(directory, 'ca.pem')
    writeFileSync(caFile, '-----BEGIN CERTIFICATE-----\nTEST-ONLY\n-----END CERTIFICATE-----\n', 'utf8')
    return run({ caFile, directory })
  } finally {
    rmSync(directory, { force: true, recursive: true })
  }
}

// Trace: FR-13; NFR-02..04; AC-06; EC-13.
test('validates secure authority evidence inputs and loads CA PEM without exposing paths', () => withCa(({ caFile }) => {
  const inputs = validateInputs(validEnvironment(caFile))
  assert.match(inputs.caPem, /BEGIN CERTIFICATE/)
  assert.equal(inputs.evidenceBranch, 'codex/rem-row-authority-evidence-v1-reviewed')
  assert.equal(inputs.reviewedCommit, 'a'.repeat(40))
}))

test('passes only CA content and exact reviewed commit to the merged runner', () => withCa(({ caFile }) => {
  const env = validEnvironment(caFile)
  const runnerEnvironment = buildRunnerEnvironment(validateInputs(env), env)
  assert.match(runnerEnvironment.DB_SSL_CA, /BEGIN CERTIFICATE/)
  assert.equal(runnerEnvironment.STAGING_REMEDIATION_CA_FILE, undefined)
  assert.equal(runnerEnvironment.STAGING_REMEDIATION_AUTHORITY_CLASSIFIER_REVIEWED_COMMIT, 'a'.repeat(40))
  assert.equal(runnerEnvironment.DATABASE_INVARIANT_PREFLIGHT_TARGET, 'staging')
}))

test('pins evidence branch, HEAD, origin/main, and clean worktree to one reviewed commit', () => {
  const reviewedCommit = 'a'.repeat(40)
  const evidenceBranch = 'codex/rem-row-authority-evidence-v1-reviewed'
  const responses = new Map([
    ['fetch origin --quiet', { status: 0, stderr: '', stdout: '' }],
    ['branch --show-current', { status: 0, stderr: '', stdout: `${evidenceBranch}\n` }],
    ['rev-parse HEAD', { status: 0, stderr: '', stdout: `${reviewedCommit}\n` }],
    ['rev-parse origin/main', { status: 0, stderr: '', stdout: `${reviewedCommit}\n` }],
    ['status --porcelain=v1', { status: 0, stderr: '', stdout: '' }],
  ])
  assert.deepEqual(verifyRepositoryState(
    { evidenceBranch, reviewedCommit },
    (args) => responses.get(args.join(' ')),
  ), {
    branch: evidenceBranch,
    head: reviewedCommit,
    originMain: reviewedCommit,
    worktreeClean: true,
  })
})

test('atomically consumes at most one attempt for a reviewed commit', () => withCa(({ directory }) => {
  const inputs = {
    evidenceBranch: 'codex/rem-row-authority-evidence-v1-reviewed',
    launcherDigest: 'c'.repeat(64),
    projectRefFingerprint: 'd'.repeat(64),
    reviewedCommit: 'a'.repeat(40),
    windowEndText: '2026-07-12T16:30:00+03:00',
    windowStartText: '2026-07-12T16:00:00+03:00',
  }
  const marker = claimEvidenceAttempt(inputs, directory, '2026-07-12T13:05:00.000Z')
  assert.equal(JSON.parse(readFileSync(marker, 'utf8')).event, 'staging_remediation_row_authority_classifier.attempted')
  assert.throws(() => claimEvidenceAttempt(inputs, directory), /attempt_already_recorded/)
}))

// Trace: FR-13; NFR-05; AC-06; EC-14.
test('wraps npm.cmd through cmd.exe on Windows and uses direct npm elsewhere', () => {
  assert.deepEqual(buildMergedRunnerInvocation('win32'), {
    args: ['/d', '/s', '/c', 'npm.cmd --silent --prefix backend/nestjs run diagnose:staging:remediation:authority:v1'],
    command: 'cmd.exe',
  })
  assert.deepEqual(buildMergedRunnerInvocation('linux'), {
    args: ['--silent', '--prefix', 'backend/nestjs', 'run', 'diagnose:staging:remediation:authority:v1'],
    command: 'npm',
  })
})

test('accepts only a sanitized receipt bound to the reviewed commit and rejects stderr', () => withCa(({ directory }) => {
  const inputs = {
    launcherDigest: 'c'.repeat(64),
    projectRefFingerprint: 'd'.repeat(64),
    reviewedCommit: 'a'.repeat(40),
  }
  const receipt = {
    certificateVerified: true,
    classifierQueryDigest: '1'.repeat(64),
    event: 'staging_remediation_row_authority_classifier.completed',
    invariantV2QueryDigest: '2'.repeat(64),
    queryResult: {
      buckets: [],
      familyTotals: [
        { authorityUnitCount: 0, checkHitCount: 0, family: 'ASSIGN-01' },
        { authorityUnitCount: 0, checkHitCount: 0, family: 'ORG-02' },
        { authorityUnitCount: 0, checkHitCount: 0, family: 'ORG-04' },
      ],
      observedAt: '2026-07-12T13:05:00.000Z',
      overall: { authorityUnitCount: 0, checkHitCount: 0 },
      querySetVersion: 'staging-remediation-row-authority-classifier-v1',
      sourceContracts: [{ code: 'assignment_rotation_lifecycle', state: 'absent' }],
      v2FamilyTotals: [
        { family: 'ASSIGN-01', hitCount: 0 },
        { family: 'ORG-02', hitCount: 0 },
        { family: 'ORG-04', hitCount: 0 },
        { family: 'TARGET-02', hitCount: 0 },
      ],
    },
    receiptDigest: '3'.repeat(64),
    receiptVersion: '1',
    reviewedCommit: inputs.reviewedCommit,
    runnerDigest: '4'.repeat(64),
    targetClass: 'staging',
    targetFingerprint: '5'.repeat(64),
    timeoutProfile: { connectionMs: 5000, idleMs: 1000, queryMs: 30000, statementMs: 30000 },
    tlsMode: 'verify-full',
    transactionIsolation: 'repeatable_read',
    transactionReadOnly: true,
  }
  const run = (_command, _args, options) => ({ status: 0, stderr: '', stdout: `${JSON.stringify(receipt)}\n`, options })
  const summary = executeEvidence(inputs, {}, { executeRunner: run, temporaryDirectory: directory })
  assert.equal(summary.receiptDigest, receipt.receiptDigest)
  const unsafeInputs = { ...inputs, reviewedCommit: 'b'.repeat(40) }
  assert.throws(
    () => executeEvidence(unsafeInputs, {}, {
      executeRunner: () => ({ status: 0, stderr: 'unsafe', stdout: JSON.stringify(receipt) }),
      temporaryDirectory: directory,
    }),
    /runner_stderr_rejected/,
  )
}))
