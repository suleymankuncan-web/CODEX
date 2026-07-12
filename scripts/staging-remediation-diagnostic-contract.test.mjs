import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import test from 'node:test'

const planPath = 'docs/plans/post-dg2-staging-remediation-and-constraint-reentry-plan-v1.md'
const v1QueryPath = 'db/preflight/database-invariant-preflight-v1.sql'
const v1EvidencePath = 'docs/evidence/readiness/2026-07-11-dg2-staging-invariant-preflight-v1.md'
const diagnosticQueryPath = 'db/preflight/staging-remediation-diagnostic-v1.sql'
const runnerPath = 'backend/nestjs/scripts/staging-remediation-diagnostic.ts'
const contractPath = 'backend/nestjs/scripts/staging-remediation-diagnostic-contract.ts'
const allowlistsPath = 'backend/nestjs/scripts/staging-remediation-diagnostic-allowlists.ts'
const v2SpecPath = 'docs/plans/staging-remediation-invariant-spec-v2.md'
const v2QueryPath = 'db/preflight/staging-remediation-invariant-v2.sql'
const v2RunnerPath = 'backend/nestjs/scripts/staging-remediation-invariant-v2.ts'
const v2ContractPath = 'backend/nestjs/scripts/staging-remediation-invariant-v2-contract.ts'
const v2AllowlistsPath = 'backend/nestjs/scripts/staging-remediation-invariant-v2-allowlists.ts'
const sourceTables = [
  'audit.event_log',
  'ops.employee_assignment_history',
  'ops.employee_offboarding_request',
  'ops.kpi_actual',
  'ops.kpi_target',
  'ops.personnel_target_reference',
  'ops.sales_target_incentive_adjustment',
  'ops.sales_target_incentive_projection',
  'ops.sales_target_incentive_region_correction',
  'ops.sales_target_incentive_region_package',
  'ops.sales_target_incentive_region_package_store',
  'ops.sales_target_incentive_store_review',
  'ops.seller_code_request',
  'ops.store_action_plan',
  'ops.target_distribution_request',
  'ops.turnover_event',
  'ops.workforce_norm_plan',
  'rpt.sales_target_incentive_assignment_snapshot',
  'rpt.sales_target_incentive_final_snapshot',
  'rpt.turnover_snapshot',
  'stg.master_data_bootstrap_row',
]

// Trace: FR-SCOPE-01..04, FR-DIAG-01..11, NFR-01..04, NFR-08..10, AC-01, AC-02, AC-11, EC-01..08.
test('REM-1A preserves immutable V1 artifacts and adds only versioned diagnostics', () => {
  assert.equal(sha256(v1QueryPath), 'f6d33e91aa5ba76a6026b419d1df2692640222453727d7ec227d6d61474394cd')
  assert.equal(sha256(v1EvidencePath), '94c4f49099d2e8b64bcf5b692f2101172915e52639938ca094bbfbffb0a32c6d')
  for (const path of [planPath, diagnosticQueryPath, runnerPath, contractPath, allowlistsPath]) {
    assert.equal(existsSync(path), true, `Missing ${path}`)
  }
})

// Trace: FR-SCOPE-01, FR-DEC-08; NFR-02, NFR-08; AC-11.
test('REM-2B preserves every V1 artifact and adds an isolated V2 contract', () => {
  assert.equal(sha256(v1QueryPath), 'f6d33e91aa5ba76a6026b419d1df2692640222453727d7ec227d6d61474394cd')
  assert.equal(sha256('docs/plans/database-invariant-preflight-spec-v1.md'), '61b6baf10cc993fc1a5bfe9eefd5760cdd50c23d4f54e63e36b6300d46b4109a')
  assert.equal(sha256(v1EvidencePath), '94c4f49099d2e8b64bcf5b692f2101172915e52639938ca094bbfbffb0a32c6d')
  for (const path of [v2SpecPath, v2QueryPath, v2RunnerPath, v2ContractPath, v2AllowlistsPath]) {
    assert.equal(existsSync(path), true, `Missing ${path}`)
  }
})

test('V2 specification traces locked decisions, bridge equations, and the live stop gate', () => {
  const spec = readFileSync(v2SpecPath, 'utf8')
  for (const phrase of [
    'REM2-TARGET-02-PILOT-20260712',
    'REM2-ORG04-KPI-PERIOD-END-20260712',
    'REM2-ORG04-NORM-LIFECYCLE-20260712',
    'REM2-ORG02-ASSIGNMENT-LIFECYCLE-20260712',
    'REM2-ASSIGN01-PRIMARY-SUPPORT-20260712',
    'REM2-ASSIGN01-WINNER-ROTATION-20260712',
    'V1 = carriedForwardCount + revisedValidCount',
    'V2 = carriedForwardCount + v2NewCount',
    'D-STAGING-MUTATION = NOT_READY',
    'D-CONSTRAINT-WINDOW = NOT_READY',
    'REPEATABLE READ READ ONLY',
  ]) assert.match(spec, new RegExp(escapeRegex(phrase)))
})

test('versioned diagnostic SQL is read only and owns the reviewed reason/source vocabulary', () => {
  const sql = readFileSync(diagnosticQueryPath, 'utf8')
  const allowlists = readFileSync(allowlistsPath, 'utf8')
  for (const phrase of [
    'staging-remediation-diagnostic-v1',
    'target.count_less_than_json_length',
    'target.count_greater_than_json_length',
    'target.write_source_legacy_or_unknown',
    'org.assignment_region_store_region',
    'org.region_company_store_company',
    'org.employee_company_store_company',
    'org.position_company_store_company',
    'org.scope_company_region',
    'org.scope_company_store',
    'org.scope_region_store',
    'org.bootstrap_resolved_company_batch_company',
    'assignment.same_day_boundary',
    'assignment.strict_multi_day',
    'assignment.open_ended',
    'assignment.same_scope',
    'assignment.cross_scope',
    'distinct_count_unresolved',
  ]) {
    assert.match(sql, new RegExp(escapeRegex(phrase)))
  }
  for (const sourceTable of sourceTables) {
    assert.match(sql, new RegExp(escapeRegex(sourceTable)))
    assert.match(allowlists, new RegExp(escapeRegex(sourceTable)))
  }
  assert.match(sql, /CASE[\s\S]*jsonb_typeof[\s\S]*jsonb_array_length/)
  assert.doesNotMatch(stripSqlComments(sql), /\b(?:INSERT|UPDATE|DELETE|MERGE|ALTER|CREATE|DROP|TRUNCATE|GRANT|REVOKE|CALL|DO)\b/i)
})

// Trace: FR-DEC-08; NFR-02..04; AC-04, AC-05, AC-11; EC-01, EC-04, EC-05, EC-08.
test('V2 SQL encodes every locked revised semantic and an exact record bridge', () => {
  const sql = readFileSync(v2QueryPath, 'utf8')
  for (const phrase of [
    'staging-remediation-invariant-v2',
    'pilot_imported_personnel_targets',
    "reference.status = 'approved'",
    'jsonb_array_length',
    "role.role_code = 'REGION_MANAGER'",
    'period_end',
    'ops.workforce_norm_plan',
    'assignment_status',
    'is_primary_assignment',
    "'[]'",
    'carriedForwardCount',
    'revisedValidCount',
    'v2NewCount',
  ]) {
    assert.match(sql, new RegExp(escapeRegex(phrase)))
  }
  assert.match(sql, /start_at::date\s*<=/)
  assert.match(sql, /date_trunc\('month',\s*actual\.period_start\)/)
  assert.match(sql, /COUNT\(assignment\.user_role_assignment_id\)[\s\S]*FILTER \(WHERE assignment\.user_id IS NOT NULL\)/)
  assert.match(sql, /end_at\s+IS\s+NULL\s+OR\s+[^\n]*end_at::date\s*>=/)
  assert.match(sql, /period_end\s*<\s*params\.observed_on/)
  assert.match(sql, /region\.company_id AS region_company_id/)
  assert.match(sql, /company_id IS DISTINCT FROM region_company_id/)
  assert.match(sql, /start_date[\s\S]*end_date[\s\S]*daterange/)
  assert.doesNotMatch(stripSqlComments(sql), /\b(?:INSERT|UPDATE|DELETE|MERGE|ALTER|CREATE|DROP|TRUNCATE|GRANT|REVOKE|CALL|DO)\b/i)
})

test('V2 typed allowlists cover every SQL-emitted invariant, reason, and source', () => {
  const allowlists = readFileSync(v2AllowlistsPath, 'utf8')
  const requiredCodes = [
    'assignment.exactly_one_open_primary',
    'assignment.lifecycle_region',
    'assignment.primary_ranges_non_overlapping',
    'norm.lifecycle_manager',
    'org.kpi_period_end_manager',
    'org.scope_hierarchy',
    'target.ordinary_count_matches_json',
    'target.pilot_count_matches_approved_references',
    'assignment.region_company_store_company',
    'assignment.employee_company_store_company',
    'assignment.position_company_store_company',
    'org.bootstrap_resolved_company_batch_company',
    'org.scope_company_region',
    'org.scope_company_store',
    'org.scope_region_store',
    ...sourceTables,
    'ops.user_action_store_assignment',
    'ops.user_role_assignment',
  ]
  for (const code of requiredCodes) {
    assert.match(allowlists, new RegExp(escapeRegex(code)))
  }
})

test('runner proves one repeatable-read read-only snapshot and sanitizes before output', () => {
  const runner = readFileSync(runnerPath, 'utf8')
  const contract = readFileSync(contractPath, 'utf8')
  const executionContract = `${runner}\n${contract}`
  assert.match(executionContract, /BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY/)
  assert.match(executionContract, /SHOW transaction_isolation/)
  assert.match(executionContract, /SHOW transaction_read_only/)
  assert.match(runner, /assertSanitizedDiagnosticJson/)
  assert.match(runner, /ROLLBACK/)
  assert.ok(
    runner.indexOf('await client.query("ROLLBACK")') < runner.indexOf('process.stdout.write(serialized)'),
    'sanitized receipt must not be written before rollback succeeds',
  )
  assert.match(contract, /receipt_digest_mismatch/)
  assert.match(contract, /diagnostic_schema_mismatch/)
  assert.match(contract, /too_many_sample_refs/)
  assert.doesNotMatch(runner, /console\.(?:log|error)\([^\n]*(?:DATABASE_URL|connectionString)/)
})

// Trace: FR-DIAG-08, FR-DIAG-09, FR-DIAG-11, FR-DEC-08; NFR-01..04; AC-01, AC-11, AC-12.
test('V2 runner is a separate reviewed read-only entry point', () => {
  const runner = readFileSync(v2RunnerPath, 'utf8')
  const packageJson = readFileSync('backend/nestjs/package.json', 'utf8')
  assert.match(runner, /staging-remediation-invariant-v2\.sql/)
  assert.match(runner, /BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY/)
  assert.match(runner, /SHOW transaction_isolation/)
  assert.match(runner, /SHOW transaction_read_only/)
  assert.match(runner, /STAGING_REMEDIATION_INVARIANT_V2_REVIEWED_COMMIT/)
  assert.match(runner, /validateInvariantV2QueryResult/)
  assert.match(runner, /createInvariantV2Receipt/)
  assert.match(runner, /assertSanitizedInvariantV2Json/)
  assert.match(runner, /ROLLBACK/)
  assert.ok(
    runner.indexOf('await client.query("ROLLBACK")') < runner.indexOf('process.stdout.write(serialized)'),
    'V2 receipt must not be written before rollback succeeds',
  )
  assert.match(packageJson, /"diagnose:staging:remediation:v2"/)
})

test('disposable invariant fixture executes and validates V2 before rollback', () => {
  const fixture = readFileSync('backend/nestjs/scripts/database-invariant-preflight-fixture-smoke.ts', 'utf8')
  assert.match(fixture, /staging-remediation-invariant-v2\.sql/)
  assert.match(fixture, /validateInvariantV2QueryResult/)
  assert.match(fixture, /fixture_v2_bridge_mismatch/)
})

test('root disposable smoke executes the V2 runner and verifies its receipt bridge', () => {
  const smoke = readFileSync('scripts/database-invariant-preflight-smoke.mjs', 'utf8')
  assert.match(smoke, /diagnose:staging:remediation:v2/)
  assert.match(smoke, /STAGING_REMEDIATION_INVARIANT_V2_REVIEWED_COMMIT/)
  assert.match(smoke, /invariantV2ReceiptBound/)
  assert.match(smoke, /invariantV2BridgeExact/)
})

function sha256(path) {
  const canonicalText = readFileSync(path, 'utf8').replace(/\r\n?/g, '\n')
  return createHash('sha256').update(canonicalText).digest('hex')
}

function stripSqlComments(sql) {
  return sql.replace(/\/\*[\s\S]*?\*\//g, '').replace(/--.*$/gm, '')
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
