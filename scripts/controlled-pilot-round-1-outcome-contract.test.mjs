import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import test from 'node:test'

const outcomePath = 'docs/evidence/pilot-readiness/2026-05-06-controlled-pilot-round-1-outcome.md'
const feedbackLogPath = 'docs/evidence/pilot-readiness/2026-05-05-controlled-pilot-feedback-log.md'
const consolidationPath =
  'docs/evidence/pilot-readiness/2026-05-06-controlled-pilot-conditional-go-consolidation.md'
const checklistPath = 'docs/plans/controlled-pilot-operating-checklist-v1.md'
const gatePath = 'docs/plans/pilot-readiness-gate-v1.md'

function readText(path) {
  return readFileSync(path, 'utf8')
}

function requireText(text, expected) {
  assert.ok(text.includes(expected), `Missing expected text: ${expected}`)
}

function requireAll(text, expectedValues) {
  for (const expected of expectedValues) {
    requireText(text, expected)
  }
}

function requireNoJwt(text) {
  assert.equal(
    /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/.test(text),
    false,
    'round 1 outcome must not contain compact JWT-looking values',
  )
}

const currentState = readText('docs/history/current-state-through-pr-913-2026-07-09.md')
const activeNextActions = readText('docs/plans/active-next-actions.md')
const feedbackLog = readText(feedbackLogPath)
const gate = readText(gatePath)

test('controlled pilot round 1 outcome records continue decision without widening rollout', () => {
  assert.equal(existsSync(outcomePath), true, `${outcomePath} must exist`)
  const outcome = readText(outcomePath)

  requireAll(outcome, [
    '# Controlled Pilot Round 1 Outcome',
    'Final decision: `Continue` for the current controlled staging/internal pilot scope.',
    'Broad production rollout remains `No-Go`.',
    'This note does not approve wider rollout or new pilot users by itself.',
    'No active route blocker remains from Round 1.',
  ])
})

test('controlled pilot round 1 outcome summarizes checked routes and closed issues', () => {
  const outcome = readText(outcomePath)

  requireAll(outcome, [
    '/admin/integrations',
    '/admin/master-data',
    '/admin/targets',
    '/admin/competitions',
    '/admin/audit',
    '/store',
    '/store/me',
    '/store/kpis',
    '/store/rankings',
    '/store/approvals',
    'PILOT-002',
    'PILOT-003',
    'PILOT-004',
    'Product owner confirmed `/store/me` opened',
    'Product owner confirmed `/store/approvals` opened',
    'Product owner confirmed `/store/kpis` opened',
    'Product owner confirmed `/store/rankings` opened',
    'No demo-data issue was reported during this pass.',
  ])
})

test('controlled pilot round 1 outcome preserves current constraints and next operating action', () => {
  const outcome = readText(outcomePath)

  requireAll(outcome, [
    'Power BI/Excel outputs remain the active operating source.',
    'JSON source integration is suspended for the current pilot and Power BI/Excel operating path.',
    'Direct Supabase client access to `ops.*` remains blocked until RLS/policy work is designed.',
    'Run `npm.cmd run check:pilot-stabilization` before a new invitation wave or deploy that can affect pilot routes.',
    'Continue collecting feedback in the controlled pilot feedback log.',
    'Do not expand scope until the next invite list, roles, and store/action assignments are explicit.',
  ])

  requireNoJwt(outcome)
})

test('controlled pilot round 1 outcome is linked from active handoff and pilot records', () => {
  for (const text of [currentState, activeNextActions, feedbackLog, gate]) {
    requireText(text, outcomePath)
  }

  requireText(currentState, 'Controlled Pilot Round 1 Outcome')
  requireText(activeNextActions, 'Recorded: Controlled Pilot Round 1 Outcome V1')
  requireText(feedbackLog, 'Controlled Pilot Round 1 Outcome')
})
