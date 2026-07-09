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

const contractPath = 'docs/plans/monthly-ranking-score-source-contract-v1.md'
const contract = readText(contractPath)
const currentState = readText('docs/history/current-state-through-pr-913-2026-07-09.md')
const activeNextActions = readText('docs/plans/active-next-actions.md')
const debtLedger = readText('docs/plans/project-debt-ledger.md')

test('monthly ranking score source contract locks official snapshot evidence', () => {
  for (const phrase of [
    'GET /reports/leaderboards/closed',
    'includedSnapshotRuns',
    'Monthly ranking must not infer included days from the frontend snapshot list.',
    'Only completed daily snapshot runs returned by the backend contract are official evidence.',
  ]) {
    requireText(contract, phrase)
  }
})

test('monthly ranking score source contract documents personnel scoring sources', () => {
  for (const phrase of [
    'Personnel monthly primary score',
    'average closed-day total score',
    'TARGET_ACHIEVEMENT: TARGET',
    'ATV: TURKEY_AVERAGE',
    'UPT: TURKEY_AVERAGE',
    'Personnel ranking does not include checklist metrics in V1.',
  ]) {
    requireText(contract, phrase)
  }
})

test('monthly ranking score source contract documents store scoring sources', () => {
  for (const phrase of [
    'Store monthly score',
    'TARGET_ACHIEVEMENT: TARGET',
    'CR: TURKEY_AVERAGE',
    'ATV: TURKEY_AVERAGE',
    'UPT: TURKEY_AVERAGE',
    'BM_CHECKLIST: CHECKLIST_SCORE',
    'VM_CHECKLIST: CHECKLIST_SCORE',
    'missingWeightPolicy: return_missing_weight_to_kpi',
  ]) {
    requireText(contract, phrase)
  }
})

test('monthly ranking score source contract is linked from handoff and debt docs', () => {
  for (const text of [currentState, activeNextActions, debtLedger]) {
    requireText(text, contractPath)
    requireText(text, 'Monthly Ranking Score Source Contract V1')
  }
})
