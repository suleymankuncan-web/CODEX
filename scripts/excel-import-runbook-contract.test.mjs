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

const runbook = readText('docs/plans/excel-kpi-import-operator-runbook.md')
const activeNextActions = readText('docs/plans/active-next-actions.md')
const currentState = readText('current-state.md')

test('excel import operator runbook keeps core operator sections', () => {
  for (const heading of [
    '# Excel KPI Import Operator Runbook V1',
    '## Decision Rule',
    '## Business Rules To Preserve',
    '## Roles And Responsibilities',
    '## 1. Environment Preflight',
    '## 2. File Preflight',
    '## 3. Store Scope Preflight',
    '## 4. Upload Steps',
    '## 5. Summary Review',
    '## 6. Identity Mapping Review',
    '## 7. Reconciliation Review',
    '## 8. Retry And Re-Upload Rules',
    '## 9. Materialization And Score Trust',
    '## 10. Evidence Note Template',
    '## Go / Conditional Go / No-Go',
  ]) {
    requireText(runbook, heading)
  }
})

test('excel import operator runbook preserves gross personnel and net store rules', () => {
  for (const phrase of [
    'Store performance uses store net sales',
    'Personnel performance uses positive gross personnel sales only',
    'Negative personnel rows do not reduce employee KPI',
    'negative movement is subtracted from both employee and store result',
    'Period `ATV`, `UPT`, and `CR` are recomputed from base totals',
    'Only locally enabled stores should be imported into official KPI scope',
  ]) {
    requireText(runbook, phrase)
  }
})

test('excel import operator runbook requires mapping reconciliation and sanitized evidence', () => {
  for (const phrase of [
    '`unmapped_store` count',
    '`unmapped_employee` count',
    'Do not create official employee records from name-only KPI Excel rows',
    'personnel positive gross sales + personnel negative movements ~= store net sales',
    'Do not paste personal TC numbers',
    'Materialization decision: Go / Conditional Go / No-Go',
  ]) {
    requireText(runbook, phrase)
  }
})

test('excel import operator runbook is linked from active project handoff docs', () => {
  for (const docs of [activeNextActions, currentState]) {
    requireText(docs, 'docs/plans/excel-kpi-import-operator-runbook.md')
  }
})
