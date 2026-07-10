import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import test from 'node:test'

const specPath = 'docs/plans/database-invariant-preflight-spec-v1.md'
const queryPath = 'db/preflight/database-invariant-preflight-v1.sql'
const runnerPath = 'backend/nestjs/scripts/database-invariant-preflight.ts'
const fixtureSmokePath = 'backend/nestjs/scripts/database-invariant-preflight-fixture-smoke.ts'
const smokePath = 'scripts/database-invariant-preflight-smoke.mjs'

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

  assert.match(runner, /BEGIN READ ONLY/)
  assert.match(runner, /SHOW transaction_read_only/)
  assert.match(runner, /ROLLBACK/)
  assert.match(runner, /statement_timeout/)
  assert.match(runner, /read-only-approved/)
  assert.match(runner, /DATABASE_INVARIANT_PREFLIGHT_EXPECTED_HOST/)
  assert.match(runner, /DATABASE_INVARIANT_PREFLIGHT_EXPECTED_DATABASE/)
  assert.match(runner, /blocked_live_evidence/)
  assert.doesNotMatch(runner, /console\.(?:log|error)\([^\n]*(?:DATABASE_URL|connectionString)/)
})

function stripSqlComments(sql) {
  return sql
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/--.*$/gm, '')
}
