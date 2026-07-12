import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

const root = process.cwd()
const sqlPath = join(root, 'db', 'preflight', 'staging-remediation-row-authority-classifier-v1.sql')
const runnerPath = join(root, 'backend', 'nestjs', 'scripts', 'staging-remediation-row-authority-classifier.ts')
const contractPath = join(root, 'backend', 'nestjs', 'scripts', 'staging-remediation-row-authority-classifier-contract.ts')
const allowlistsPath = join(root, 'backend', 'nestjs', 'scripts', 'staging-remediation-row-authority-classifier-allowlists.ts')
const launcherPath = join(root, 'scripts', 'staging-remediation-row-authority-evidence-launcher.mjs')

// Trace: FR-01, FR-05..10; NFR-01, NFR-06; AC-01, AC-03, AC-04; EC-01..12.
test('row-authority SQL is read only and encodes every deterministic root cause', () => {
  const sql = readFileSync(sqlPath, 'utf8')
  const executable = sql.replace(/--.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '')
  assert.doesNotMatch(executable, /\b(?:insert|update|delete|merge|alter|create|drop|truncate|grant|revoke|copy|call|do)\b/i)
  for (const reason of [
    'org04.scope_hierarchy_mismatch',
    'org04.role_assignment_never_configured',
    'org04.role_assignment_not_effective',
    'org04.region_portfolio_not_effective',
    'org04.duplicate_rows_same_manager',
    'org04.mixed_scope_multiple_managers',
    'org04.multiple_distinct_managers',
    'org04.unique_manager_region_mismatch',
    'org02.rotation_authority_source_absent',
    'assign01.rotation_authority_source_absent',
  ]) assert.match(sql, new RegExp(reason.replaceAll('.', '\\.')))
  assert.match(sql, /COUNT\s*\(\s*DISTINCT[^)]*user_id/i)
  assert.match(sql, /authority_unit/i)
  assert.match(sql, /assignment_rotation_lifecycle/i)
})

// Trace: FR-02, FR-03, FR-11, FR-12; NFR-02..05; AC-01, AC-02, AC-05, AC-07.
test('runner owns one V2 plus classifier snapshot and sanitizes before stdout', () => {
  const runner = readFileSync(runnerPath, 'utf8')
  assert.match(runner, /BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY/)
  assert.match(runner, /staging-remediation-invariant-v2\.sql/)
  assert.match(runner, /staging-remediation-row-authority-classifier-v1\.sql/)
  assert.match(runner, /validateInvariantV2QueryResult/)
  assert.match(runner, /validateAuthorityClassifierResult|buildAuthorityClassifierResult/)
  assert.match(runner, /ROLLBACK/)
  assert.ok(runner.indexOf('ROLLBACK') < runner.indexOf('process.stdout.write'))
  assert.match(runner, /statement_timeout = '30000ms'/)
})

// Trace: FR-05, FR-06, FR-11; NFR-03, NFR-06; AC-03, AC-05; EC-01..06, EC-10.
test('typed classifier vocabulary is exact and family/source constrained', () => {
  const allowlists = readFileSync(allowlistsPath, 'utf8')
  const contract = readFileSync(contractPath, 'utf8')
  assert.match(allowlists, /reasonBelongsToAuthorityFamily/)
  assert.match(allowlists, /sourceBelongsToAuthorityReason/)
  assert.match(contract, /duplicate_sample_authority_ref/)
  assert.match(contract, /unsorted_sample_authority_ref/)
  assert.match(contract, /v2_authority_reconciliation_mismatch/)
  assert.match(contract, /source_contract_version_change_required/)
  assert.match(contract, /receipt_digest_mismatch/)
})

// Trace: FR-13, FR-14; NFR-02..04; AC-06; EC-13, EC-14.
test('root launcher preserves one-shot target, CA, SHA, Windows, and receipt guards', () => {
  const launcher = readFileSync(launcherPath, 'utf8')
  for (const token of [
    'STAGING_REMEDIATION_CA_FILE',
    'STAGING_REMEDIATION_EXPECTED_PROJECT_REF_SHA256',
    'STAGING_REMEDIATION_AUTHORITY_CLASSIFIER_REVIEWED_COMMIT',
    'STAGING_REMEDIATION_AUTHORITY_EVIDENCE_BRANCH',
    "flag: 'wx'",
    'cmd.exe',
    "'/d'",
    "'/s'",
    "'/c'",
    'runner_stderr_rejected',
    'receiptDigest',
  ]) assert.ok(launcher.includes(token), `missing launcher token ${token}`)
})

test('package scripts expose only the versioned runner and evidence launcher', () => {
  const rootPackage = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
  const backendPackage = JSON.parse(readFileSync(join(root, 'backend', 'nestjs', 'package.json'), 'utf8'))
  assert.equal(
    rootPackage.scripts['evidence:staging:remediation:authority:v1'],
    'node scripts/staging-remediation-row-authority-evidence-launcher.mjs',
  )
  assert.equal(
    backendPackage.scripts['diagnose:staging:remediation:authority:v1'],
    'ts-node scripts/staging-remediation-row-authority-classifier.ts',
  )
})

// Trace: FR-02..10; NFR-01, NFR-06; AC-01..04, AC-08; EC-01..12.
test('disposable database smoke executes classifier roots and proves rollback', () => {
  const smoke = readFileSync(join(root, 'scripts', 'database-invariant-preflight-smoke.mjs'), 'utf8')
  assert.match(smoke, /smoke:staging:remediation:authority:fixture/)
  assert.match(smoke, /authorityClassifierFixtureRolledBack/)
  assert.match(smoke, /authorityClassifierReasons/)
  assert.match(smoke, /diagnose:staging:remediation:authority:v1/)
})
