import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import test from 'node:test'

const feedbackLogPath = 'docs/evidence/pilot-readiness/2026-05-05-controlled-pilot-feedback-log.md'
const pilot005EvidencePath =
  'docs/evidence/pilot-readiness/2026-05-22-pilot-005-store-approvals-personnel-ux.md'
const checklistPath = 'docs/plans/controlled-pilot-operating-checklist-v1.md'
const gatePath = 'docs/plans/pilot-readiness-gate-v1.md'
const currentStatePath = 'docs/history/current-state-through-pr-913-2026-07-09.md'

function readText(path) {
  return readFileSync(path, 'utf8')
}

function requireText(text, value) {
  assert.ok(text.includes(value), `Missing expected text: ${value}`)
}

function requireNoJwt(text) {
  assert.equal(
    /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/.test(text),
    false,
    'feedback log must not contain compact JWT-looking values',
  )
}

const feedbackLog = readText(feedbackLogPath)
const pilot005Evidence = readText(pilot005EvidencePath)
const checklist = readText(checklistPath)
const gate = readText(gatePath)
const currentState = readText(currentStatePath)

test('controlled pilot feedback log keeps the pilot boundary and evidence safety rules', () => {
  assert.equal(existsSync(feedbackLogPath), true)

  for (const expected of [
    '# Controlled Pilot Feedback Log',
    'Pilot decision:',
    '`Conditional Go` for controlled staging/internal pilot.',
    'Broad production rollout is not approved by this log.',
    'Do not record:',
    'raw bearer tokens',
    'Clerk cookies',
    'full JWT payloads',
    'personal identity documents',
    'Allowed evidence:',
  ]) {
    requireText(feedbackLog, expected)
  }

  requireNoJwt(feedbackLog)
})

test('controlled pilot feedback log preserves session issue and decision registers', () => {
  for (const expected of [
    '## Daily Smoke Template',
    '## Session 0 - 2026-05-05 Initial Pilot Start',
    '## Session 1 - 2026-05-05 First Low-Role Browser Check',
    '### Session 1 Investigation Update - 2026-05-05',
    '## Issue Register',
    '## Decision Register',
    'PILOT-001',
    'PILOT-002',
    'PILOT-003',
    'PILOT-004',
    'Pause pilot progression pending investigation',
    'Close Session 1 navigation blockers',
    'Continue controlled pilot after route smoke',
  ]) {
    requireText(feedbackLog, expected)
  }
})

test('controlled pilot feedback log records fixed route blockers without reopening rollout scope', () => {
  for (const expected of [
    '`/store/me` first hit auth return-path bugs',
    '`/store/approvals` redirected to `/store`',
    'Product owner confirmed `/store/me` opened',
    'Product owner confirmed `/store/approvals` opened',
    'Product owner confirmed `/store/kpis` opened',
    'Product owner confirmed `/store/rankings` opened',
    'No demo-data issue was reported during this pass.',
  ]) {
    requireText(feedbackLog, expected)
  }
})

test('controlled pilot feedback log records the closed PILOT-005 approvals UX cleanup', () => {
  for (const expected of [
    'PILOT-005',
    'Closed on 2026-05-22 by route/navigation cleanup',
    '`STORE_PERSONNEL` no longer opens `/store/approvals` by direct route',
    pilot005EvidencePath,
  ]) {
    requireText(feedbackLog, expected)
  }

  for (const expected of [
    '# PILOT-005 Store Approvals Personnel UX Evidence',
    'This is a UX/navigation correction.',
    'Store personnel targeted Playwright: `8/8` passed.',
    'Store approvals targeted Playwright: `10/10` passed.',
  ]) {
    requireText(pilot005Evidence, expected)
  }

  requireNoJwt(pilot005Evidence)
})

test('handoff gate and checklist link the controlled pilot feedback log as the active operating record', () => {
  for (const text of [currentState, checklist, gate]) {
    requireText(text, feedbackLogPath)
  }

  requireText(currentState, 'The active controlled pilot feedback log is')
  requireText(checklist, 'Active operating record:')
  requireText(gate, 'controlled pilot feedback log')
})
