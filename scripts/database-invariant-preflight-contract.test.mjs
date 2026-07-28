import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import test from 'node:test'

const specPath = 'docs/plans/database-invariant-preflight-spec-v1.md'
const queryPath = 'db/preflight/database-invariant-preflight-v1.sql'
const runnerPath = 'backend/nestjs/scripts/database-invariant-preflight.ts'
const runnerConfigPath = 'backend/nestjs/scripts/database-invariant-preflight-config.ts'
const fixtureSmokePath = 'backend/nestjs/scripts/database-invariant-preflight-fixture-smoke.ts'
const smokePath = 'scripts/database-invariant-preflight-smoke.mjs'
const stagingEvidencePath = 'docs/evidence/readiness/2026-07-11-dg2-staging-invariant-preflight-v1.md'

test('database invariant preflight specification freezes the no-mutation boundary', () => {
  const spec = readFileSync(specPath, 'utf8')

  for (const phrase of [
    'BEGIN READ ONLY',
    'read-only-approved',
    'blocked_live_evidence',
    'requires_business_decision',
    'No live run is authorized',
    'No raw identifier',
  ]) {
    assert.match(spec, new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'))
  }
})

test('database invariant preflight implementation files exist', () => {
  assert.equal(existsSync(queryPath), true, `Missing ${queryPath}`)
  assert.equal(existsSync(runnerPath), true, `Missing ${runnerPath}`)
  assert.equal(existsSync(runnerConfigPath), true, `Missing ${runnerConfigPath}`)
  assert.equal(existsSync(fixtureSmokePath), true, `Missing ${fixtureSmokePath}`)
  assert.equal(existsSync(smokePath), true, `Missing ${smokePath}`)
})

test('database invariant smoke is disposable, exact, and rollback verified', () => {
  const fixture = readFileSync(fixtureSmokePath, 'utf8')
  const smoke = readFileSync(smokePath, 'utf8')

  assert.match(fixture, /BEGIN/)
  assert.match(fixture, /ROLLBACK/)
  assert.match(fixture, /fixture_rollback_failed/)
  assert.match(fixture, /localhost/)
  assert.match(fixture, /store_ops_fresh_migration_smoke_preflight/)
  assert.match(smoke, /migration-fresh-db-smoke\.mjs/)
  assert.match(smoke, /blocked_live_evidence/)
  assert.match(smoke, /requires_business_decision/)
})

test('database invariant preflight SQL is read only and covers every required check', () => {
  const sql = readFileSync(queryPath, 'utf8')
  const schema = readFileSync('db/schema.sql', 'utf8')

  for (const checkId of [
    'ORG-01',
    'ORG-02',
    'ORG-03',
    'ORG-04',
    'AUTH-01',
    'AUTH-02',
    'ASSIGN-01',
    'TARGET-01',
    'TARGET-02',
    'TARGET-03',
    'KEY-01',
  ]) {
    assert.match(sql, new RegExp(checkId))
  }

  assert.doesNotMatch(
    stripSqlComments(sql),
    /\b(?:INSERT|UPDATE|DELETE|MERGE|ALTER|CREATE|DROP|TRUNCATE|GRANT|REVOKE|CALL|DO)\b/i,
  )

  const dedicatedChecks = new Set([
    'ops.employee_assignment_history',
    'ops.region',
    // Migration 061 enforces store/region identity with a composite FK and a
    // rollback-only PostgreSQL negative smoke; impossible rows never enter
    // the read-only ORG-04 inventory.
    'ops.region_weekly_visit_plan_item',
    // Migration 062 binds these new scoped records through composite tenant
    // foreign keys. Its local rollback-only smoke proves cross-tenant rows are
    // rejected without mutating the immutable V1 diagnostic query.
    'ops.media_asset',
    'ops.checklist_response_media',
    'ops.store_action_solution_attempt',
    'ops.store_action_plan_evidence',
    'ops.store_action_solution_review',
    'ops.visual_campaign_assignment',
    'ops.visual_campaign_assignment_outcome',
    'ops.visual_campaign_submission',
    'ops.visual_campaign_submission_media',
    'ops.visual_comparison_run',
    'audit.photo_evidence_event',
    // Migration 065 binds each solution upload intent to the exact action
    // plan and media asset through composite tenant/store foreign keys. The
    // PR-5 disposable migration smoke proves the constraint and preserves the
    // digest-locked V1 diagnostic query.
    'ops.store_action_solution_upload_intent',
    'ops.store',
    'ops.user_role_assignment',
  ])
  const scopeBearingTables = [...schema.matchAll(
    /CREATE TABLE(?: IF NOT EXISTS)?\s+([a-z_]+\.[a-z_]+)\s*\(([\s\S]*?)\n\);/g,
  )]
    .filter(([, , body]) => ['company_id', 'region_id', 'store_id']
      .filter((column) => new RegExp(`^\\s*${column}\\s`, 'm').test(body)).length >= 2)
    .map(([, table]) => table)
    .filter((table) => !dedicatedChecks.has(table))

  for (const table of scopeBearingTables) {
    assert.match(sql, new RegExp(table.replace('.', '\\.')), `Missing scope inventory table ${table}`)
  }
  assert.match(sql, /stg\.master_data_bootstrap_batch/)
  assert.match(sql, /resolved_company_id/)
  assert.match(sql, /resolved_region_id/)
  assert.match(sql, /resolved_store_id/)
})

test('database invariant runner proves read-only mode and keeps output sanitized', () => {
  const runner = readFileSync(runnerPath, 'utf8')
  const runnerConfig = readFileSync(runnerConfigPath, 'utf8')

  assert.match(runner, /BEGIN READ ONLY/)
  assert.match(runner, /SHOW transaction_read_only/)
  assert.match(runner, /ROLLBACK/)
  assert.match(runner, /statement_timeout/)
  assert.match(runner, /read-only-approved/)
  assert.match(runner, /DATABASE_INVARIANT_PREFLIGHT_EXPECTED_HOST/)
  assert.match(runner, /DATABASE_INVARIANT_PREFLIGHT_EXPECTED_DATABASE/)
  assert.match(runner, /toLowerCase\(\)/)
  assert.match(runner, /blocked_live_evidence/)
  assert.match(runner, /buildDatabaseInvariantPreflightPoolConfig/)
  assert.match(runnerConfig, /buildDatabasePoolConfig/)
  assert.match(runnerConfig, /poolMax:\s*1/)
  assert.match(runnerConfig, /sslMode !== "verify-full"/)
  assert.doesNotMatch(runner, /rejectUnauthorized:\s*false/)
  assert.doesNotMatch(runnerConfig, /rejectUnauthorized:\s*false/)
  assert.doesNotMatch(runner, /console\.(?:log|error)\([^\n]*(?:DATABASE_URL|connectionString)/)
})

test('DG2-C staging receipt is complete, sanitized, read only, and No-Go', () => {
  assert.equal(existsSync(stagingEvidencePath), true, `Missing ${stagingEvidencePath}`)
  const evidence = readFileSync(stagingEvidencePath, 'utf8')

  for (const phrase of [
    '8ed6886c77ec26df78d62fe4840461dbb3980f68',
    'transactionReadOnly=true',
    'DB_SSL_MODE=verify-full',
    'PostgreSQL version',
    'No-Go for DB-CONSTRAINTS',
    'No-Mutation Statement',
    'No automatic repair',
  ]) {
    assert.match(evidence, new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'))
  }

  const expectedCounts = new Map([
    ['ASSIGN-01', 2],
    ['AUTH-01', 0],
    ['AUTH-02', 0],
    ['KEY-01', 0],
    ['ORG-01', 0],
    ['ORG-02', 3],
    ['ORG-03', 0],
    ['ORG-04', 11],
    ['TARGET-01', 0],
    ['TARGET-02', 54],
    ['TARGET-03', 0],
  ])
  for (const [checkId, count] of expectedCounts) {
    assert.match(evidence, new RegExp('\\| `' + checkId + '` \\|[^\\n]*\\| ' + count + ' \\|'))
  }
  assert.match(evidence, /\| \*\*Total\*\* \|\s*\| \*\*70\*\* \|/)

  assert.doesNotMatch(evidence, /postgres(?:ql)?:\/\//i)
  assert.doesNotMatch(evidence, /(?:db\.[a-z0-9-]+\.supabase\.co|pooler\.supabase\.com)/i)
  assert.doesNotMatch(evidence, /-----BEGIN (?:CERTIFICATE|PRIVATE KEY)-----/)
  assert.doesNotMatch(evidence, /\b(?:\d{1,3}\.){3}\d{1,3}\b/)
  assert.doesNotMatch(evidence, /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)
  assert.doesNotMatch(evidence, /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i)
  assert.doesNotMatch(evidence, /"event"\s*:/)
})

function stripSqlComments(sql) {
  return sql
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/--.*$/gm, '')
}
