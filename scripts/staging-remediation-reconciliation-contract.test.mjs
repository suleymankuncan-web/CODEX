import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

const root = join(import.meta.dirname, '..')
const runner = read('backend/nestjs/scripts/staging-remediation-reconciliation.ts')
const packageJson = JSON.parse(read('backend/nestjs/package.json'))
const sqlPaths = [
  'db/preflight/database-invariant-preflight-v1.sql',
  'db/preflight/staging-remediation-invariant-v2.sql',
  'db/preflight/staging-remediation-row-authority-classifier-v1.sql',
]

// Trace: FR-01, FR-02, FR-11; NFR-02..04; AC-02, AC-06; EC-02, EC-03, EC-11.
test('runner binds all immutable sources to one repeatable-read read-only transaction', () => {
  for (const path of sqlPaths) assert.match(runner, new RegExp(path.split('/').at(-1).replaceAll('.', '\\.')))
  assert.equal(count(runner, 'new Pool('), 1)
  assert.match(runner, /BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY/)
  assert.match(runner, /SHOW transaction_isolation/)
  assert.match(runner, /SHOW transaction_read_only/)
  assert.match(runner, /SET LOCAL statement_timeout = '30000ms'/)
  assert.ok(runner.indexOf('const invariantV1 = await') < runner.indexOf('const invariantV2Rows = await'))
  assert.ok(runner.indexOf('const invariantV2Rows = await') < runner.indexOf('const classifierRows = await'))
  assert.match(runner, /await client\.query\("ROLLBACK"\)/)
  assert.doesNotMatch(runner, /client\.query\("COMMIT"\)/)
})

// Trace: FR-01, FR-13; NFR-04; AC-02, AC-08; EC-11.
test('consumed SQL files remain static read-only documents', () => {
  for (const path of sqlPaths) {
    const sql = read(path).replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/--[^\r\n]*/g, ' ')
    assert.match(sql, /^\s*(?:WITH\b|SELECT\b)/i)
    assert.doesNotMatch(
      sql,
      /\b(?:INSERT|UPDATE|DELETE|MERGE|ALTER|CREATE|DROP|TRUNCATE|GRANT|REVOKE|COPY|CALL|DO)\b/i,
    )
  }
})

// Trace: FR-07, FR-13; NFR-05; AC-04, AC-08; EC-06.
test('application enforcement and fixture scripts are included in the canonical command surface', () => {
  assert.match(runner, /verifyTargetDuplicateApplicationContract/)
  assert.equal(
    packageJson.scripts['diagnose:staging:remediation:reconciliation:v1'],
    'ts-node scripts/staging-remediation-reconciliation.ts',
  )
  assert.equal(
    packageJson.scripts['smoke:staging:remediation:reconciliation:fixture'],
    'ts-node scripts/staging-remediation-reconciliation-fixture-smoke.ts',
  )
})

function read(path) {
  return readFileSync(join(root, path), 'utf8')
}

function count(value, needle) {
  return value.split(needle).length - 1
}
