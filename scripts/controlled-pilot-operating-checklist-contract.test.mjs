import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import test from 'node:test'

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

const checklistPath = 'docs/plans/controlled-pilot-operating-checklist-v1.md'
const consolidationPath =
  'docs/evidence/pilot-readiness/2026-05-06-controlled-pilot-conditional-go-consolidation.md'
const currentState = readText('docs/history/current-state-through-pr-913-2026-07-09.md')
const pilotGate = readText('docs/plans/pilot-readiness-gate-v1.md')

test('controlled pilot operating checklist exists and keeps the pilot boundary', () => {
  assert.equal(existsSync(checklistPath), true, `${checklistPath} must exist`)
  const checklist = readText(checklistPath)

  requireAll(checklist, [
    '# Controlled Pilot Operating Checklist V1',
    consolidationPath,
    'Controlled staging/internal pilot: `Conditional Go`.',
    'Broad production rollout: `No-Go`.',
    'This checklist does not approve broad production rollout.',
  ])
})

test('controlled pilot operating checklist covers before during and exit operations', () => {
  const checklist = readText(checklistPath)

  requireAll(checklist, [
    '## Before Inviting Pilot Users',
    '## During Pilot',
    '## Feedback Intake',
    '## Pause / Rollback Triggers',
    '## Pilot Exit Decision',
    '/store',
    '/store/me',
    '/store/kpis',
    '/store/approvals',
    '/store/rankings',
    '/admin/integrations',
    '/admin/master-data',
    '/admin/targets',
  ])
})

test('controlled pilot operating checklist preserves evidence safety and closed future work', () => {
  const checklist = readText(checklistPath)

  requireAll(checklist, [
    'Raw bearer tokens, Clerk cookies, passwords, provider subjects, full JWTs, database secrets, TC/national-id values, and private user data must not be recorded.',
    'JSON source integration is suspended for the current pilot and Power BI/Excel operating path.',
    'Do not plan or staff JSON implementation work while Power BI/Excel outputs remain the chosen operating source.',
    'Direct Supabase client access to `ops.*` remains blocked until RLS/policy work is designed.',
    'Pause the pilot if a low-role user can see global metric details outside allowed scope.',
    'Pause the pilot if a user can act on an unassigned store.',
  ])

  assert.doesNotMatch(checklist, /eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/)
})

test('handoff and pilot gate link the controlled pilot operating checklist', () => {
  requireText(currentState, checklistPath)
  requireText(pilotGate, checklistPath)
})
