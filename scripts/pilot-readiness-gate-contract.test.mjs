import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

function readText(path) {
  return readFileSync(path, 'utf8')
}

function requireText(text, value) {
  assert.ok(text.includes(value), `Missing expected text: ${value}`)
}

function requireAll(text, values) {
  for (const value of values) {
    requireText(text, value)
  }
}

const gatePath = 'docs/plans/pilot-readiness-gate-v1.md'
const gate = readText(gatePath)
const currentState = readText('docs/history/current-state-through-pr-913-2026-07-09.md')
const activeNextActions = readText('docs/plans/active-next-actions.md')
const debtLedger = readText('docs/plans/project-debt-ledger.md')

test('pilot readiness gate keeps pilot blocked until external evidence exists', () => {
  requireAll(gate, [
    'Status: V1 pilot readiness gate',
    'Pilot is not approved until the required external evidence is recorded.',
    'real staging IdP evidence',
    'true store/personnel baseline evidence',
    'real KPI import smoke evidence',
    'pilot user and scope evidence',
  ])
})

test('pilot readiness gate references existing guarded runbooks instead of inventing a new flow', () => {
  requireAll(gate, [
    'docs/plans/phase-7-staging-auth-smoke-runbook.md',
    'docs/plans/phase-7-auth-evidence-template.md',
    'docs/plans/master-data-bootstrap-pilot-smoke-runbook.md',
    'docs/plans/excel-kpi-import-operator-runbook.md',
    'docs/plans/import-decision-evidence-v1.md',
    'npm.cmd run check:release',
  ])
})

test('pilot readiness gate defines concrete go conditional go and no-go decisions', () => {
  requireAll(gate, [
    '## Go',
    '## Conditional Go',
    '## No-Go',
    'No-Go if staging auth evidence is missing.',
    'No-Go if true baseline master data is missing.',
    'No-Go if KPI import smoke has not produced sanitized evidence.',
  ])
})

test('pilot readiness gate keeps non-goals and codex honest view explicit', () => {
  requireAll(gate, [
    '## Non-Goals',
    'Do not open production rollout from this gate.',
    'Do not build a JSON/source adapter without a real sample payload or official field list.',
    'Do not redesign UI as part of pilot readiness.',
    '## CODEX DURUST YORUM',
  ])
})

test('pilot readiness gate is recorded in handoff docs and debt ledger', () => {
  for (const text of [currentState, activeNextActions, debtLedger]) {
    requireText(text, 'Pilot Readiness Gate V1')
  }
})
