import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import test from 'node:test'
import {
  buildMergedRunnerInvocation,
  buildRunnerEnvironment,
  claimEvidenceAttempt,
  executeEvidence,
  validateInputs,
  verifyRepositoryState,
} from './staging-remediation-invariant-v2-evidence-launcher.mjs'

const launcherPath = join(
  process.cwd(),
  'scripts',
  'staging-remediation-invariant-v2-evidence-launcher.mjs',
)

function istanbulIso(timestamp) {
  return `${new Date(timestamp + 3 * 60 * 60_000)
    .toISOString()
    .replace(/Z$/, '')}+03:00`
}

function validEnvironment(caFile) {
  const now = Date.now()
  return {
    ...process.env,
    DATABASE_INVARIANT_PREFLIGHT_EXPECTED_DATABASE: 'postgres',
    DATABASE_INVARIANT_PREFLIGHT_EXPECTED_HOST:
      'aws-0-eu-central-1.pooler.supabase.com',
    DATABASE_URL:
      'postgresql://postgres.example:placeholder@aws-0-eu-central-1.pooler.supabase.com:6543/postgres',
    DB_SSL_CA: '',
    DB_SSL_MODE: 'verify-full',
    NODE_ENV: 'staging',
    STAGING_REMEDIATION_CA_FILE: caFile,
    STAGING_REMEDIATION_EVIDENCE_BRANCH:
      'codex/rem-2b-v2-staging-evidence-reviewed',
    STAGING_REMEDIATION_EXPECTED_PROJECT_REF_SHA256: createHash('sha256')
      .update('example')
      .digest('hex'),
    STAGING_REMEDIATION_INVARIANT_V2_REVIEWED_COMMIT: 'a'.repeat(40),
    STAGING_REMEDIATION_OWNER_AUTHORIZATION:
      'standing-owner-authorization-2026-07-12',
    STAGING_REMEDIATION_WINDOW_END: istanbulIso(now + 5 * 60_000),
    STAGING_REMEDIATION_WINDOW_START: istanbulIso(now - 5 * 60_000),
  }
}

test('validates secure V2 evidence inputs without exposing their values', () => {
  const directory = mkdtempSync(join(tmpdir(), 'hr-axis-v2-launcher-'))
  try {
    const caFile = join(directory, 'ca.pem')
    writeFileSync(
      caFile,
      '-----BEGIN CERTIFICATE-----\nTEST-ONLY\n-----END CERTIFICATE-----\n',
      'utf8',
    )

    const result = spawnSync(
      process.execPath,
      [launcherPath, '--validate-inputs-only'],
      { encoding: 'utf8', env: validEnvironment(caFile) },
    )

    assert.equal(result.status, 0, result.stderr)
    assert.equal(result.stderr, '')
    assert.deepEqual(JSON.parse(result.stdout), {
      certificatePemLoaded: true,
      event: 'staging_remediation_invariant_v2.inputs_validated',
      targetIdentityMatched: true,
      windowActive: true,
    })
    assert.doesNotMatch(result.stdout, /postgres(?:ql)?:\/\//i)
    assert.doesNotMatch(result.stdout, /BEGIN CERTIFICATE/)
    assert.doesNotMatch(result.stdout, /ca\.pem/i)
  } finally {
    rmSync(directory, { force: true, recursive: true })
  }
})

test('rejects a CA path passed as DB_SSL_CA instead of reading a CA file', () => {
  const directory = mkdtempSync(join(tmpdir(), 'hr-axis-v2-launcher-'))
  try {
    const caFile = join(directory, 'ca.pem')
    writeFileSync(
      caFile,
      '-----BEGIN CERTIFICATE-----\nTEST-ONLY\n-----END CERTIFICATE-----\n',
      'utf8',
    )
    const env = validEnvironment(caFile)
    env.DB_SSL_CA = caFile
    env.STAGING_REMEDIATION_CA_FILE = ''

    const result = spawnSync(
      process.execPath,
      [launcherPath, '--validate-inputs-only'],
      { encoding: 'utf8', env },
    )

    assert.equal(result.status, 1)
    assert.equal(result.stdout, '')
    assert.deepEqual(JSON.parse(result.stderr), {
      error: 'ca_file_missing',
      event: 'staging_remediation_invariant_v2.launcher_failed',
    })
    assert.doesNotMatch(result.stderr, /ca\.pem/i)
  } finally {
    rmSync(directory, { force: true, recursive: true })
  }
})

test('fails closed when the independently expected target identity is absent', () => {
  const directory = mkdtempSync(join(tmpdir(), 'hr-axis-v2-launcher-'))
  try {
    const caFile = join(directory, 'ca.pem')
    writeFileSync(
      caFile,
      '-----BEGIN CERTIFICATE-----\nTEST-ONLY\n-----END CERTIFICATE-----\n',
      'utf8',
    )
    const env = validEnvironment(caFile)
    env.DATABASE_INVARIANT_PREFLIGHT_EXPECTED_HOST = ''

    const result = spawnSync(
      process.execPath,
      [launcherPath, '--validate-inputs-only'],
      { encoding: 'utf8', env },
    )

    assert.equal(result.status, 1)
    assert.equal(result.stdout, '')
    assert.deepEqual(JSON.parse(result.stderr), {
      error: 'target_identity_missing',
      event: 'staging_remediation_invariant_v2.launcher_failed',
    })
  } finally {
    rmSync(directory, { force: true, recursive: true })
  }
})

test('rejects a run window that is not explicitly Europe/Istanbul +03:00', () => {
  const directory = mkdtempSync(join(tmpdir(), 'hr-axis-v2-launcher-'))
  try {
    const caFile = join(directory, 'ca.pem')
    writeFileSync(
      caFile,
      '-----BEGIN CERTIFICATE-----\nTEST-ONLY\n-----END CERTIFICATE-----\n',
      'utf8',
    )
    const env = validEnvironment(caFile)
    env.STAGING_REMEDIATION_WINDOW_START = new Date(
      Date.now() - 60_000,
    ).toISOString()
    env.STAGING_REMEDIATION_WINDOW_END = new Date(
      Date.now() + 60_000,
    ).toISOString()

    const result = spawnSync(
      process.execPath,
      [launcherPath, '--validate-inputs-only'],
      { encoding: 'utf8', env },
    )

    assert.equal(result.status, 1)
    assert.equal(result.stdout, '')
    assert.deepEqual(JSON.parse(result.stderr), {
      error: 'run_window_timezone_invalid',
      event: 'staging_remediation_invariant_v2.launcher_failed',
    })
  } finally {
    rmSync(directory, { force: true, recursive: true })
  }
})

test('passes PEM content rather than the CA file path to the merged runner', () => {
  const directory = mkdtempSync(join(tmpdir(), 'hr-axis-v2-launcher-'))
  try {
    const caFile = join(directory, 'ca.pem')
    const caPem =
      '-----BEGIN CERTIFICATE-----\nTEST-ONLY\n-----END CERTIFICATE-----\n'
    writeFileSync(caFile, caPem, 'utf8')
    const env = validEnvironment(caFile)
    env.DB_SSL_CA = caFile

    const runnerEnvironment = buildRunnerEnvironment(
      validateInputs(env),
      env,
    )

    assert.equal(runnerEnvironment.DB_SSL_CA, caPem)
    assert.equal(runnerEnvironment.DB_SSL_MODE, 'verify-full')
    assert.equal(runnerEnvironment.DATABASE_INVARIANT_PREFLIGHT_TARGET, 'staging')
    assert.equal(
      runnerEnvironment.DATABASE_INVARIANT_PREFLIGHT_ACK,
      'read-only-approved',
    )
    assert.equal(
      runnerEnvironment.DATABASE_INVARIANT_PREFLIGHT_STAGING_APPROVED,
      'true',
    )
    assert.equal(runnerEnvironment.STAGING_REMEDIATION_CA_FILE, undefined)
  } finally {
    rmSync(directory, { force: true, recursive: true })
  }
})

test('pins branch, HEAD and origin/main to the reviewed merged commit', () => {
  const reviewedCommit = 'a'.repeat(40)
  const evidenceBranch = 'codex/rem-2b-v2-staging-evidence-reviewed'
  const responses = new Map([
    ['fetch origin --quiet', { status: 0, stderr: '', stdout: '' }],
    ['branch --show-current', { status: 0, stderr: '', stdout: `${evidenceBranch}\n` }],
    ['rev-parse HEAD', { status: 0, stderr: '', stdout: `${reviewedCommit}\n` }],
    ['rev-parse origin/main', { status: 0, stderr: '', stdout: `${reviewedCommit}\n` }],
    ['status --porcelain=v1', { status: 0, stderr: '', stdout: '' }],
  ])

  const result = verifyRepositoryState(
    { evidenceBranch, reviewedCommit },
    (args) => responses.get(args.join(' ')),
  )

  assert.deepEqual(result, {
    branch: evidenceBranch,
    head: reviewedCommit,
    originMain: reviewedCommit,
    worktreeClean: true,
  })
})

test('atomically permits only one evidence attempt for a reviewed commit', () => {
  const directory = mkdtempSync(join(tmpdir(), 'hr-axis-v2-launcher-'))
  try {
    const inputs = {
      evidenceBranch: 'codex/rem-2b-v2-staging-evidence-reviewed',
      launcherDigest: 'c'.repeat(64),
      projectRefFingerprint: 'd'.repeat(64),
      reviewedCommit: 'a'.repeat(40),
      windowEndText: '2026-07-12T16:30:00+03:00',
      windowStartText: '2026-07-12T16:00:00+03:00',
    }
    const markerPath = claimEvidenceAttempt(
      inputs,
      directory,
      '2026-07-12T13:05:00.000Z',
    )

    assert.deepEqual(JSON.parse(readFileSync(markerPath, 'utf8')), {
      attemptedAt: '2026-07-12T13:05:00.000Z',
      branch: inputs.evidenceBranch,
      event: 'staging_remediation_invariant_v2.attempted',
      launcherDigest: inputs.launcherDigest,
      projectRefFingerprint: inputs.projectRefFingerprint,
      reviewedCommit: inputs.reviewedCommit,
      windowEnd: inputs.windowEndText,
      windowStart: inputs.windowStartText,
    })
    assert.throws(
      () => claimEvidenceAttempt(inputs, directory, '2026-07-12T13:06:00.000Z'),
      /attempt_already_recorded/,
    )
  } finally {
    rmSync(directory, { force: true, recursive: true })
  }
})

test('accepts only a sanitized receipt bound to the reviewed commit', () => {
  const directory = mkdtempSync(join(tmpdir(), 'hr-axis-v2-launcher-'))
  try {
    const reviewedCommit = 'a'.repeat(40)
    const inputs = {
      evidenceBranch: 'codex/rem-2b-v2-staging-evidence-reviewed',
      launcherDigest: 'c'.repeat(64),
      projectRefFingerprint: 'd'.repeat(64),
      reviewedCommit,
      windowEndText: '2026-07-12T16:30:00+03:00',
      windowStartText: '2026-07-12T16:00:00+03:00',
    }
    const receipt = {
      certificateVerified: true,
      event: 'staging_remediation_invariant_v2.completed',
      queryResult: {
        overallCheckHits: { count: 9, unit: 'check_hits' },
      },
      receiptDigest: 'b'.repeat(64),
      reviewedCommit,
      targetClass: 'staging',
      tlsMode: 'verify-full',
      transactionIsolation: 'repeatable_read',
      transactionReadOnly: true,
    }

    const summary = executeEvidence(inputs, {}, {
      attemptedAt: '2026-07-12T13:05:00.000Z',
      executeRunner: () => ({
        status: 2,
        stderr: '',
        stdout: `${JSON.stringify(receipt)}\n`,
      }),
      temporaryDirectory: directory,
    })

    assert.equal(summary.event, receipt.event)
    assert.equal(summary.exitCode, 2)
    assert.equal(summary.launcherDigest, inputs.launcherDigest)
    assert.equal(summary.projectRefFingerprint, inputs.projectRefFingerprint)
    assert.equal(summary.overallCheckHits, 9)
    assert.equal(summary.receiptDigest, receipt.receiptDigest)
    assert.equal(summary.reviewedCommit, reviewedCommit)
    assert.deepEqual(
      JSON.parse(readFileSync(summary.receiptPath, 'utf8')),
      receipt,
    )
    assert.equal(readFileSync(summary.stderrPath, 'utf8'), '')
    assert.doesNotMatch(JSON.stringify(summary), /postgres(?:ql)?:\/\//i)
    assert.doesNotMatch(JSON.stringify(summary), /BEGIN CERTIFICATE/)
  } finally {
    rmSync(directory, { force: true, recursive: true })
  }
})

test('rejects a malformed reviewed commit before repository or runner access', () => {
  const directory = mkdtempSync(join(tmpdir(), 'hr-axis-v2-launcher-'))
  try {
    const caFile = join(directory, 'ca.pem')
    writeFileSync(
      caFile,
      '-----BEGIN CERTIFICATE-----\nTEST-ONLY\n-----END CERTIFICATE-----\n',
      'utf8',
    )
    const env = validEnvironment(caFile)
    env.STAGING_REMEDIATION_INVARIANT_V2_REVIEWED_COMMIT = 'not-a-sha'

    const result = spawnSync(
      process.execPath,
      [launcherPath, '--validate-inputs-only'],
      { encoding: 'utf8', env },
    )

    assert.equal(result.status, 1)
    assert.equal(result.stdout, '')
    assert.deepEqual(JSON.parse(result.stderr), {
      error: 'reviewed_commit_invalid',
      event: 'staging_remediation_invariant_v2.launcher_failed',
    })
  } finally {
    rmSync(directory, { force: true, recursive: true })
  }
})

test('accepts only a dedicated REM-2B V2 evidence branch name', () => {
  const directory = mkdtempSync(join(tmpdir(), 'hr-axis-v2-launcher-'))
  try {
    const caFile = join(directory, 'ca.pem')
    writeFileSync(
      caFile,
      '-----BEGIN CERTIFICATE-----\nTEST-ONLY\n-----END CERTIFICATE-----\n',
      'utf8',
    )
    const env = validEnvironment(caFile)
    env.STAGING_REMEDIATION_EVIDENCE_BRANCH = 'main'

    const result = spawnSync(
      process.execPath,
      [launcherPath, '--validate-inputs-only'],
      { encoding: 'utf8', env },
    )

    assert.equal(result.status, 1)
    assert.equal(result.stdout, '')
    assert.deepEqual(JSON.parse(result.stderr), {
      error: 'evidence_branch_invalid',
      event: 'staging_remediation_invariant_v2.launcher_failed',
    })
  } finally {
    rmSync(directory, { force: true, recursive: true })
  }
})

test('exposes one canonical root entry point for the reviewed launcher', () => {
  const packageJson = JSON.parse(
    readFileSync(join(process.cwd(), 'package.json'), 'utf8'),
  )

  assert.equal(
    packageJson.scripts['evidence:staging:remediation:v2'],
    'node scripts/staging-remediation-invariant-v2-evidence-launcher.mjs',
  )
})

test('rejects a database URL whose project ref differs from the authenticated target', () => {
  const directory = mkdtempSync(join(tmpdir(), 'hr-axis-v2-launcher-'))
  try {
    const caFile = join(directory, 'ca.pem')
    writeFileSync(
      caFile,
      '-----BEGIN CERTIFICATE-----\nTEST-ONLY\n-----END CERTIFICATE-----\n',
      'utf8',
    )
    const env = validEnvironment(caFile)
    env.STAGING_REMEDIATION_EXPECTED_PROJECT_REF_SHA256 = '0'.repeat(64)

    const result = spawnSync(
      process.execPath,
      [launcherPath, '--validate-inputs-only'],
      { encoding: 'utf8', env },
    )

    assert.equal(result.status, 1)
    assert.equal(result.stdout, '')
    assert.deepEqual(JSON.parse(result.stderr), {
      error: 'project_ref_mismatch',
      event: 'staging_remediation_invariant_v2.launcher_failed',
    })
    assert.doesNotMatch(result.stderr, /postgres\.example/i)
  } finally {
    rmSync(directory, { force: true, recursive: true })
  }
})

test('rejects CA input that also contains private key material', () => {
  const directory = mkdtempSync(join(tmpdir(), 'hr-axis-v2-launcher-'))
  try {
    const caFile = join(directory, 'ca.pem')
    writeFileSync(
      caFile,
      [
        '-----BEGIN CERTIFICATE-----',
        'TEST-ONLY',
        '-----END CERTIFICATE-----',
        '-----BEGIN PRIVATE KEY-----',
        'FORBIDDEN',
        '-----END PRIVATE KEY-----',
        '',
      ].join('\n'),
      'utf8',
    )

    const result = spawnSync(
      process.execPath,
      [launcherPath, '--validate-inputs-only'],
      { encoding: 'utf8', env: validEnvironment(caFile) },
    )

    assert.equal(result.status, 1)
    assert.equal(result.stdout, '')
    assert.deepEqual(JSON.parse(result.stderr), {
      error: 'ca_private_key_refused',
      event: 'staging_remediation_invariant_v2.launcher_failed',
    })
    assert.doesNotMatch(result.stderr, /FORBIDDEN/)
  } finally {
    rmSync(directory, { force: true, recursive: true })
  }
})

test('wraps npm.cmd through cmd.exe on Windows', () => {
  assert.deepEqual(buildMergedRunnerInvocation('win32'), {
    args: [
      '/d',
      '/s',
      '/c',
      'npm.cmd --silent --prefix backend/nestjs run diagnose:staging:remediation:v2',
    ],
    command: 'cmd.exe',
  })
  assert.deepEqual(buildMergedRunnerInvocation('linux'), {
    args: [
      '--silent',
      '--prefix',
      'backend/nestjs',
      'run',
      'diagnose:staging:remediation:v2',
    ],
    command: 'npm',
  })
})
