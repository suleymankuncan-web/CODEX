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

const plan = readText('docs/superpowers/plans/2026-04-28-mobile-checklist-today-v1.md')
const currentState = readText('current-state.md')
const activeNextActions = readText('docs/plans/active-next-actions.md')
const debtLedger = readText('docs/plans/project-debt-ledger.md')

test('mobile checklist implementation plan keeps required plan header', () => {
  for (const phrase of [
    '# Mobile Checklist Today V1 Implementation Plan',
    'REQUIRED SUB-SKILL',
    '**Goal:**',
    '**Architecture:**',
    '**Tech Stack:**',
  ]) {
    requireText(plan, phrase)
  }
})

test('mobile checklist implementation plan covers backend workflow tasks', () => {
  for (const phrase of [
    'Task 1: Schema Contract And Migration',
    'Task 2: Checklist Contracts And Repository',
    'Task 3: HR Template Draft And Publish Backend',
    'Task 4: Region Manager Draft/Resume/Response Flow',
    'Task 5: Response Save, In-Progress Status, Completion, And Locking',
    'Task 6: Mobile Today Read Model And Monthly Average',
    'Task 7: Store Manager Mobile Acknowledgement',
  ]) {
    requireText(plan, phrase)
  }
})

test('mobile checklist implementation plan preserves locked product rules', () => {
  for (const phrase of [
    'HR-managed weights must total `100`.',
    'Region manager scores each item from `0` to `10`.',
    'Completed checklist instances are locked',
    'monthlySummaries',
    'Store manager acknowledgement does not delay score inclusion.',
    'Do not enforce one checklist per store/template/month.',
  ]) {
    requireText(plan, phrase)
  }
})

test('mobile checklist implementation plan defines verification and debt timing', () => {
  for (const phrase of [
    'npm.cmd run check:release',
    'Increment closed active debts only after implementation and release gates pass.',
    'feat: add mobile checklist today workflow',
  ]) {
    requireText(plan, phrase)
  }
})

test('mobile checklist implementation plan is linked from handoff docs without counting implementation done', () => {
  for (const text of [currentState, activeNextActions, debtLedger]) {
    requireText(text, 'Mobile Checklist Today V1 Implementation Plan')
    requireText(text, 'docs/superpowers/plans/2026-04-28-mobile-checklist-today-v1.md')
  }

  requireText(debtLedger, 'Mobile Checklist Today V1 implementation is planned, not counted as paid yet.')
})
