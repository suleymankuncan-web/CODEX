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

const runbookPath = 'docs/plans/backup-restore-drill-runbook-v1.md'
const runbook = readText(runbookPath)
const currentState = readText('current-state.md')
const activeNextActions = readText('docs/plans/active-next-actions.md')
const debtLedger = readText('docs/plans/project-debt-ledger.md')

test('backup restore drill runbook keeps the local staging boundary', () => {
  for (const phrase of [
    '# Backup Restore Drill Runbook V1',
    'Run this drill only in local or staging.',
    'Do not run restore commands against production.',
    'Do not automate production backup or restore from this V1 runbook.',
    'No destructive command is approved unless the restore target is explicitly confirmed as disposable.',
  ]) {
    requireText(runbook, phrase)
  }
})

test('backup restore drill runbook documents concrete commands and targets', () => {
  for (const phrase of [
    'pg_dump',
    'pg_restore',
    'createdb',
    'dropdb',
    'store_ops_restore_drill',
    'BACKUP_FILE',
    'RESTORE_DATABASE_URL',
  ]) {
    requireText(runbook, phrase)
  }
})

test('backup restore drill runbook requires sanitized evidence and go no-go states', () => {
  for (const phrase of [
    'Sanitized Evidence',
    'No raw DATABASE_URL',
    'No passwords',
    'No customer or personnel personal data samples',
    'Go',
    'Conditional Go',
    'No-Go',
    'Restore proof',
  ]) {
    requireText(runbook, phrase)
  }
})

test('backup restore drill runbook is linked from handoff and debt docs', () => {
  for (const text of [currentState, activeNextActions, debtLedger]) {
    requireText(text, runbookPath)
    requireText(text, 'Backup Restore Drill Runbook V1')
  }
  requireText(activeNextActions, 'Closed active debts: 72')
  requireText(debtLedger, 'Closed active debts: 72')
  requireText(debtLedger, '72. Backup Restore Drill Runbook V1')
})
