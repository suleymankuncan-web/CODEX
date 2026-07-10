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

const spec = readText('docs/superpowers/specs/2026-04-28-mobile-checklist-today-v1-design.md')
const activeNextActions = readText('docs/plans/active-next-actions.md')
const debtLedger = readText('docs/plans/project-debt-ledger.md')

test('mobile checklist today design locks role responsibilities', () => {
  for (const phrase of [
    '`HR_ADMIN` creates and publishes checklist templates.',
    '`REGION_MANAGER` sees assigned stores and starts a checklist for the store they are visiting.',
    '`STORE_MANAGER` can only mark `Kabul ettim / Gördüm`',
    'Store manager acknowledgement does not delay score inclusion.',
  ]) {
    requireText(spec, phrase)
  }
})

test('mobile checklist today design locks scoring and versioning decisions', () => {
  for (const phrase of [
    'Publishing changed items or weights creates a new version.',
    'HR-managed weights must total `100`.',
    'Region manager scores each item from `0` to `10`.',
    'checklistScore = sum(itemContribution)',
    'Existing completed checklist instances remain tied to the version used at completion time.',
  ]) {
    requireText(spec, phrase)
  }
})

test('mobile checklist today design locks lifecycle and monthly aggregation', () => {
  for (const phrase of [
    '`planned`: opened but no meaningful response saved yet; shown as `Taslak`',
    '`in_progress`: at least one item response saved; shown as `Devam ediyor`',
    '`completed`: finalized, scored, locked, and visible to store manager acknowledgement',
    '`cancelled`: reserved for future `cancel with reason`; not part of V1 implementation',
    'Do not enforce one checklist per store/template/month.',
    'monthlyChecklistScore = average(completedChecklistScoresInMonth)',
  ]) {
    requireText(spec, phrase)
  }
})

test('mobile checklist today design names the mobile read model and non-goals', () => {
  for (const phrase of [
    'GET /api/mobile/checklists/today',
    'This endpoint is a composition/read model. It must not become a duplicate checklist engine.',
    'V1 does not include:',
    'completed checklist edit flow',
    'cancellation with reason',
    'VM checklist implementation',
  ]) {
    requireText(spec, phrase)
  }
})

test('mobile checklist today design is linked from handoff and debt docs', () => {
  for (const text of [activeNextActions, debtLedger]) {
    requireText(text, 'Mobile Checklist Today V1 Design')
    requireText(text, 'docs/superpowers/specs/2026-04-28-mobile-checklist-today-v1-design.md')
  }
})
