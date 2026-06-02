import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const schema = readFileSync('db/schema.sql', 'utf8')
const migration = readFileSync('db/migrations/049_store_action_plan_v1.sql', 'utf8')
const checklistRemediationSourceMigration = readFileSync(
  'db/migrations/051_store_action_plan_checklist_remediation_source.sql',
  'utf8',
)
const evidence = readFileSync('docs/evidence/store-action-v1b-schema-v1.md', 'utf8')
const plan = readFileSync('docs/superpowers/plans/2026-05-22-store-action-v1b-persisted-action-plans.md', 'utf8')

function assertStoreActionShape(sql) {
  assert.match(sql, /CREATE TABLE(?: IF NOT EXISTS)? ops\.store_action_plan\s*\(/)
  assert.match(sql, /CHECK \(status IN \('open', 'in_progress', 'blocked', 'closed', 'cancelled'\)\)/)
  assert.match(sql, /idx_store_action_plan_active_source_unique/)
  assert.match(sql, /WHERE status IN \('open', 'in_progress', 'blocked'\)/)
}

function assertInitialSourceTypeCheck(sql) {
  assert.match(sql, /CHECK \(source_type IN \('kpi_exception'\)\)/)
}

function assertCurrentSourceTypeCheck(sql) {
  assert.match(sql, /CHECK \(source_type IN \('kpi_exception', 'checklist_remediation'\)\)/)
}

test('store action V1B schema remains additive and source bounded', () => {
  assertStoreActionShape(schema)
  assertStoreActionShape(migration)
  assertCurrentSourceTypeCheck(schema)
  assertInitialSourceTypeCheck(migration)
})

test('store action checklist remediation source migration widens only the source check', () => {
  assert.match(checklistRemediationSourceMigration, /ALTER TABLE ops\.store_action_plan/)
  assert.match(checklistRemediationSourceMigration, /ADD CONSTRAINT store_action_plan_source_type_check/)
  assertCurrentSourceTypeCheck(checklistRemediationSourceMigration)
})

test('store action V1B schema guard does not let schema mask a broken migration', () => {
  const brokenMigration = migration
    .replace(
      'CREATE TABLE IF NOT EXISTS ops.store_action_plan',
      'CREATE TABLE IF NOT EXISTS ops.store_action_plan_missing',
    )
    .replace('CREATE UNIQUE INDEX IF NOT EXISTS idx_store_action_plan_active_source_unique', '')

  assert.throws(() => assertStoreActionShape(brokenMigration))
})

test('store action V1B schema evidence keeps runtime behavior out of scope', () => {
  assert.match(evidence, /does not add a controller, endpoint, service command/)
  assert.match(evidence, /does not store or mutate/)
  assert.match(evidence, /KPI score math/)
  assert.match(evidence, /target approval/)
  assert.match(evidence, /workflow inbox state/)
  assert.match(evidence, /Next safe implementation step/)
})

test('store action V1B implementation plan points to the actual migration number', () => {
  assert.match(plan, /049_store_action_plan_v1\.sql/)
  assert.match(plan, /migration 049/)
  assert.doesNotMatch(plan, /\b040\b/)
})
