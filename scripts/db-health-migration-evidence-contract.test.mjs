import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'

const workspaceRoot = join(import.meta.dirname, '..')

function readText(path) {
  return readFileSync(join(workspaceRoot, path), 'utf8')
}

function requireText(text, expected) {
  assert.match(text, new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
}

const planPath = 'docs/plans/db-health-migration-evidence-v1.md'
const plan = readText(planPath)
const currentState = readText('current-state.md')
const activeNextActions = readText('docs/plans/active-next-actions.md')
const debtLedger = readText('docs/plans/project-debt-ledger.md')

test('db health and migration evidence preserves the no-run boundary', () => {
  for (const phrase of [
    '# DB Health And Migration Evidence V1',
    'This slice does not replace the migration system.',
    'Migration status is read-only evidence.',
    'Migration status must not execute SQL migration files.',
    'The HTTP run endpoint remains separately guarded.',
  ]) {
    requireText(plan, phrase)
  }
})

test('db health and migration evidence documents observable deploy checks', () => {
  for (const phrase of [
    'GET /api/admin/migrations/status',
    'trackingTable',
    'appliedCount',
    'pending',
    'failed',
    'checksumMismatches',
    'npm.cmd run db:migrate',
  ]) {
    requireText(plan, phrase)
  }
})

test('db health response keeps dependency checks simple and sanitized', () => {
  for (const phrase of [
    'GET /api/health',
    'database',
    'redis',
    'Health check output must not expose connection strings, passwords, hosts, or raw database URLs.',
    '[redacted-url]',
  ]) {
    requireText(plan, phrase)
  }
})

test('db health and migration evidence is linked from handoff and debt docs', () => {
  for (const text of [currentState, activeNextActions, debtLedger]) {
    requireText(text, planPath)
    requireText(text, 'DB Health And Migration Evidence V1')
  }
  requireText(activeNextActions, 'Closed active debts: 69')
  requireText(debtLedger, 'Closed active debts: 69')
  requireText(debtLedger, '69. DB Health And Migration Evidence V1')
})
