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

const planPath = 'docs/plans/backend-foundation-hardening-plan-v1.md'
const plan = readText(planPath)
const currentState = readText('current-state.md')
const activeNextActions = readText('docs/plans/active-next-actions.md')
const debtLedger = readText('docs/plans/project-debt-ledger.md')

test('backend foundation hardening plan keeps the no-new-module boundary', () => {
  for (const phrase of [
    '# Backend Foundation Hardening Plan V1',
    'No new product module is opened by this plan.',
    'No guessed external source adapter work is allowed.',
    'No new scoring engine is allowed.',
    'No broad UI redesign is included.',
    'The priority is to harden existing backend, data, auth, import, and operator evidence surfaces.',
  ]) {
    requireText(plan, phrase)
  }
})

test('backend foundation hardening plan defines ordered priorities', () => {
  for (const phrase of [
    '## P0 - Keep The Current Foundation Trustworthy',
    '## P1 - Prepare For Real Data And Pilot Operations',
    '## P2 - Later Scale And Product Depth',
    'Import decision evidence',
    'Scope/auth regression matrix',
    'DB health and migration evidence',
    'Backup/restore drill',
    'Performance/index review after real data volume exists',
  ]) {
    requireText(plan, phrase)
  }
})

test('backend foundation hardening plan preserves go no-go gates', () => {
  for (const phrase of [
    'Do not start a new module unless the intake interview proves the existing surface cannot carry it.',
    'Do not promote master data without dry-run evidence and sanitized evidence.',
    'Do not build JSON-specific code without a real sample payload or official field list.',
    'Do not change score math while working on evidence, runbooks, or operator visibility.',
    'Every hardening slice must pass root `npm.cmd run check:release` before commit.',
  ]) {
    requireText(plan, phrase)
  }
})

test('backend foundation hardening plan is linked without inflating closed debt count', () => {
  for (const text of [currentState, activeNextActions, debtLedger]) {
    requireText(text, planPath)
    requireText(text, 'Backend Foundation Hardening Plan V1')
  }
  requireText(debtLedger, 'Backend Foundation Hardening Plan V1 is a planning/control artifact and is not counted as a closed active debt item.')
})
