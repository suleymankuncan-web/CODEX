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

const inventory = readText('docs/plans/mobile-api-bff-endpoint-inventory-v1.md')
const currentState = readText('current-state.md')
const activeNextActions = readText('docs/plans/active-next-actions.md')
const debtLedger = readText('docs/plans/project-debt-ledger.md')

test('mobile api bff inventory keeps auth and bff boundaries separate', () => {
  for (const phrase of [
    'Do not create a broad Mobile BFF yet.',
    'Keep Mobile Auth/Session separate from Mobile BFF.',
    'Do not build backend-owned refresh-token broker as part of BFF.',
    'P0:',
    'Keep Mobile Auth/Session V1 P0 as the only mobile-specific backend surface that is already implemented.',
  ]) {
    requireText(inventory, phrase)
  }
})

test('mobile api bff inventory documents screen endpoint decisions', () => {
  for (const phrase of [
    'GET /api/mobile/home',
    'GET /api/mobile/store-performance',
    'GET /api/mobile/checklists/today',
    'GET /api/feed',
    'GET /api/workflow/inbox',
    'GET /api/reports/my-performance',
    'GET /api/reports/leaderboards/closed',
    'GET /api/competitions',
    'GET /api/workforce/seller-code-requests',
  ]) {
    requireText(inventory, phrase)
  }
})

test('mobile api bff inventory requires decision gate before new mobile endpoints', () => {
  for (const phrase of [
    'Which mobile screen needs this exact payload?',
    'How many existing calls would the screen otherwise make?',
    'Which role and scope rules must be enforced?',
    'Which existing service owns the source of truth?',
    'What test proves the endpoint does not widen scope?',
  ]) {
    requireText(inventory, phrase)
  }
})

test('mobile api bff inventory is linked from handoff and debt docs', () => {
  for (const text of [currentState, activeNextActions, debtLedger]) {
    requireText(text, 'docs/plans/mobile-api-bff-endpoint-inventory-v1.md')
    requireText(text, 'Mobile API/BFF Endpoint Inventory V1')
  }
})
