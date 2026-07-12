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
