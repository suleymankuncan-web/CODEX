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

const evidencePath =
  'docs/evidence/pilot-readiness/2026-05-06-controlled-pilot-conditional-go-consolidation.md'
const currentState = readText('current-state.md')
const gate = readText('docs/plans/pilot-readiness-gate-v1.md')

test('controlled pilot consolidation evidence exists and records the current decision', () => {
  assert.equal(existsSync(evidencePath), true, `${evidencePath} must exist`)
  const evidence = readText(evidencePath)

  requireAll(evidence, [
    '# Controlled Pilot Conditional Go Consolidation',
    'Final decision: `Conditional Go` for controlled staging/internal pilot.',
    'Broad production rollout: `No-Go`.',
    'This note does not replace the detailed evidence files.',
  ])
})

test('controlled pilot consolidation maps every readiness gate area to evidence', () => {
  const evidence = readText(evidencePath)

  requireAll(evidence, [
    '## Gate Matrix',
    'real staging IdP evidence',
    'true store/personnel baseline evidence',
    'real KPI import smoke evidence',
    'pilot user and scope evidence',
    'release and migration evidence',
    'docs/evidence/pilot-readiness/2026-05-05-pilot-readiness-decision.md',
    'docs/evidence/pilot-readiness/2026-05-06-role-smoke.md',
    'docs/evidence/pilot-readiness/2026-05-06-ranking-privacy-smoke.md',
    'docs/evidence/pilot-readiness/2026-05-06-master-data-power-bi-acceptance.md',
    'docs/evidence/pilot-readiness/2026-05-06-live-protected-api-smoke.md',
    'docs/evidence/pilot-readiness/2026-05-05-staging-master-data-kpi-materialization.md',
  ])
})

test('controlled pilot consolidation preserves restrictions and no-secret rules', () => {
  const evidence = readText(evidencePath)

  requireAll(evidence, [
    'Raw bearer tokens, Clerk cookies, passwords, provider subjects, full JWTs, database secrets, TC/national-id values, and private user data are not recorded.',
    'JSON source integration is suspended for the current pilot and Power BI/Excel operating path.',
    'Do not plan or staff JSON implementation work while Power BI/Excel outputs remain the chosen operating source.',
    'Direct Supabase client access to `ops.*` remains blocked until RLS/policy work is designed.',
    'Current master data is an accepted temporary pilot baseline, not the final HR/master-data source of truth.',
    'March 2026 Power BI import is historical pilot validation data, not proof of future monthly operation.',
    'Stop or pause the pilot if a low-role user can see global metric details outside allowed scope.',
  ])

  assert.doesNotMatch(evidence, /eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/)
})

test('handoff and gate docs link the current consolidation evidence', () => {
  requireText(currentState, evidencePath)
  requireText(gate, evidencePath)
})
