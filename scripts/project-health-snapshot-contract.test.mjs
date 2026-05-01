import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

const workspaceRoot = join(import.meta.dirname, '..')

function readText(path) {
  return readFileSync(join(workspaceRoot, path), 'utf8')
}

function requireText(text, expected) {
  assert.ok(text.includes(expected), `Missing expected text: ${expected}`)
}

function requireAll(text, expectedValues) {
  for (const expected of expectedValues) {
    requireText(text, expected)
  }
}

const snapshotPath = 'docs/plans/project-health-snapshot-2026-05-01.md'
const snapshot = readText(snapshotPath)
const activeNextActions = readText('docs/plans/active-next-actions.md')
const currentState = readText('current-state.md')
const riskScan = readText('docs/plans/project-risk-scan-2026-04-30.md')

test('project health snapshot separates local health from pilot approval', () => {
  requireAll(snapshot, [
    '# Project Health Snapshot - 2026-05-01',
    'Local foundation status: healthy enough to continue controlled hardening.',
    'Pilot status: not approved.',
    'The project is not blocked by code chaos; it is blocked by missing external evidence.',
  ])
})

test('project health snapshot records current verified release evidence', () => {
  requireAll(snapshot, [
    'root script guard: 122/122',
    'backend: 89/89 suites and 486/486 tests',
    'frontend Playwright: 47/47',
    'audit: 0 vulnerabilities',
    'closed active debts: 89',
  ])
})

test('project health snapshot keeps external blockers and non-goals visible', () => {
  requireAll(snapshot, [
    'real staging IdP values and seeded staging DB evidence',
    'true store/personnel baseline master-data files',
    'real KPI import smoke evidence',
    'Do not open a new product module from this snapshot.',
    'Do not build a JSON/source adapter without a real sample payload or official field list.',
  ])
})

test('project health snapshot documents the next logical path without inflating debt count', () => {
  requireAll(snapshot, [
    'Next logical path',
    'If staging IdP values arrive first, run the staging auth smoke.',
    'If true baseline files arrive first, run the master-data pilot smoke.',
    'This snapshot is a control note, not a closed active debt item.',
  ])
})

test('project health snapshot is linked from handoff and risk docs', () => {
  for (const text of [activeNextActions, currentState, riskScan]) {
    requireText(text, snapshotPath)
  }
})
