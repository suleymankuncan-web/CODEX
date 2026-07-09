import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

const workspaceRoot = join(import.meta.dirname, '..')
const evidencePath = 'docs/evidence/readiness/2026-05-22-supabase-staging-logical-restore-drill.md'

function readText(path) {
  return readFileSync(join(workspaceRoot, path), 'utf8')
}

function requireText(text, value) {
  assert.ok(text.includes(value), `Missing expected text: ${value}`)
}

const evidence = readText(evidencePath)
const currentState = readText('docs/history/current-state-through-pr-913-2026-07-09.md')
const activeNextActions = readText('docs/plans/active-next-actions.md')
const jointPlan = readText('docs/plans/production-evidence-closure-joint-plan-v1.md')

test('supabase logical restore proof records the clean application-schema restore', () => {
  for (const phrase of [
    '# Supabase Staging Logical Restore Drill - 2026-05-22',
    'Source project label: hr-axis-staging',
    'Source server version: PostgreSQL 17.6',
    'Restore target version: PostgreSQL 17.10',
    'Restore target disposable: yes',
    'Production database touched: no',
    'PostgreSQL 17 client attempt: success.',
    'Backup file size: `1867369` bytes.',
    'Result: exit code `0`.',
  ]) {
    requireText(evidence, phrase)
  }
})

test('supabase logical restore proof captures matching source and restore counts', () => {
  for (const phrase of [
    'Source application schema/table counts:',
    'Restore application schema/table counts:',
    'audit:3',
    'ops:39',
    'rpt:10',
    'stg:12',
    'Source migration tracking rows:',
    'Restore migration tracking rows:',
    '48',
    'select count(*) from ops.store;',
    '160',
  ]) {
    requireText(evidence, phrase)
  }
})

test('supabase logical restore proof keeps managed Supabase caveats explicit', () => {
  for (const phrase of [
    'It does not prove Supabase managed restore-to-new-project',
    'supabase_vault',
    'Manual logical dump: proven for staging application schemas.',
    'Supabase managed daily backup: not verified in this drill.',
    'PITR: not verified in this drill.',
    'Broad production:',
    'Still No-Go.',
    'Supabase managed backup/PITR policy',
  ]) {
    requireText(evidence, phrase)
  }
})

test('handoff docs point to the supabase logical restore proof', () => {
  for (const text of [currentState, activeNextActions, jointPlan]) {
    requireText(text, evidencePath)
    requireText(text, 'Supabase staging application')
    requireText(text, 'logical')
    requireText(text, 'restore')
  }
})

test('supabase logical restore proof contains no obvious secret material', () => {
  assert.doesNotMatch(evidence, /\b(?:postgres(?:ql)?|redis|rediss):\/\/\S+/i)
  assert.doesNotMatch(evidence, /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i)
  assert.doesNotMatch(evidence, /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/)
  assert.doesNotMatch(
    evidence,
    /\b(service_role|SUPABASE_ACCESS_TOKEN|DATABASE_URL|SOURCE_DATABASE_URL|RESTORE_DATABASE_URL|REDIS_URL|WEBHOOK_SECRET)=/i,
  )
  assert.doesNotMatch(evidence, /\b(password|pwd)\s*[:=]\s*\S+/i)
})
