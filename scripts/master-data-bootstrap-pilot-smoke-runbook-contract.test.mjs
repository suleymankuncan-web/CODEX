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

const runbookPath = 'docs/plans/master-data-bootstrap-pilot-smoke-runbook.md'
const runbook = readText(runbookPath)
const currentState = readText('docs/history/current-state-through-pr-913-2026-07-09.md')
const activeNextActions = readText('docs/plans/active-next-actions.md')
const debtLedger = readText('docs/plans/project-debt-ledger.md')

test('master data bootstrap pilot smoke runbook keeps core operator sections', () => {
  for (const heading of [
    '# Master Data Bootstrap Pilot Smoke Runbook V1',
    '## Decision Rule',
    '## Scope',
    '## Roles And Responsibilities',
    '## 1. Environment Preflight',
    '## 2. Baseline File Preflight',
    '## 3. Stage The Baseline Batch',
    '## 4. Validate The Batch',
    '## 5. Review Row Evidence',
    '## 6. Review Promotion Dry-Run Evidence',
    '## 7. Scoped Pilot Promotion',
    '## 8. Evidence Note Template',
    '## Go / Conditional Go / No-Go',
  ]) {
    requireText(runbook, heading)
  }
})

test('master data bootstrap pilot smoke runbook preserves live-write safety boundaries', () => {
  for (const phrase of [
    'Do not use KPI snapshot Excel files as master-data baseline files.',
    'Do not manually edit live `ops.*` tables.',
    'Do not promote a full company baseline as the first smoke.',
    'No fake store or personnel rows should be invented for the smoke.',
    'Promotion must stay blocked until backend readiness is clean.',
    'The dry-run evidence panel does not promote rows.',
  ]) {
    requireText(runbook, phrase)
  }
})

test('master data bootstrap pilot smoke runbook locks the ordered smoke sequence', () => {
  for (const phrase of [
    'stage the baseline batch',
    'validate the batch',
    'inspect row evidence',
    'inspect promotion dry-run evidence',
    'promote only the approved scoped pilot batch',
    'capture sanitized evidence',
  ]) {
    requireText(runbook, phrase)
  }
})

test('master data bootstrap pilot smoke runbook is linked from handoff and debt docs', () => {
  for (const text of [currentState, activeNextActions, debtLedger]) {
    requireText(text, runbookPath)
    requireText(text, 'Master Data Bootstrap Pilot Smoke Runbook V1')
  }
})
