import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import test from 'node:test'

const specPath = 'docs/plans/database-invariant-preflight-spec-v1.md'
const queryPath = 'db/preflight/database-invariant-preflight-v1.sql'
const runnerPath = 'backend/nestjs/scripts/database-invariant-preflight.ts'

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
})

test('database invariant preflight SQL is read only and covers every required check', () => {
  const sql = readFileSync(queryPath, 'utf8')

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
})

test('database invariant runner proves read-only mode and keeps output sanitized', () => {
  const runner = readFileSync(runnerPath, 'utf8')

  assert.match(runner, /BEGIN READ ONLY/)
  assert.match(runner, /SHOW transaction_read_only/)
  assert.match(runner, /ROLLBACK/)
  assert.match(runner, /statement_timeout/)
  assert.match(runner, /read-only-approved/)
  assert.match(runner, /blocked_live_evidence/)
  assert.doesNotMatch(runner, /console\.(?:log|error)\([^\n]*(?:DATABASE_URL|connectionString)/)
})

function stripSqlComments(sql) {
  return sql
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/--.*$/gm, '')
}
