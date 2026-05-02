import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

const workspaceRoot = join(import.meta.dirname, '..')

function readText(path) {
  return readFileSync(join(workspaceRoot, path), 'utf8')
}

function requireText(text, expected) {
  assert.ok(text.includes(expected), `Missing expected text: ${expected}`)
}

function requireAll(text, values) {
  for (const value of values) {
    requireText(text, value)
  }
}

const evidencePath = 'docs/evidence/pilot-readiness/2026-05-01-preflight-no-go.md'
const evidence = readText(evidencePath)
const gate = readText('docs/plans/pilot-readiness-gate-v1.md')
const currentState = readText('current-state.md')
const activeNextActions = readText('docs/plans/active-next-actions.md')

test('pilot preflight evidence is explicitly not pilot approval', () => {
  requireAll(evidence, [
    '# Pilot Readiness Preflight Evidence - No-Go',
    'Final decision: No-Go',
    'This is not pilot approval.',
    'Pilot remains blocked until real external evidence is recorded.',
  ])
})

test('pilot preflight records missing external evidence without inventing a flow', () => {
  requireAll(evidence, [
    'real staging IdP evidence is missing',
    'true baseline master data is missing',
    'real KPI import smoke evidence is missing',
    'pilot user and scope evidence is missing',
    'docs/plans/pilot-readiness-gate-v1.md',
    'docs/plans/phase-7-staging-auth-smoke-runbook.md',
    'docs/plans/master-data-bootstrap-pilot-smoke-runbook.md',
    'docs/plans/excel-kpi-import-operator-runbook.md',
  ])
})

test('pilot preflight keeps evidence sanitized and scoped', () => {
  requireAll(evidence, [
    'No raw bearer token, id token, refresh token, authorization code, PKCE verifier, cookie, password, TC/national id, or private data is recorded here.',
    'No production data was touched.',
    'No `ops.*` table was manually edited.',
    'No master-data promotion was run.',
    'No KPI import was run.',
  ])
  assert.doesNotMatch(evidence, /eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/)
})

test('pilot preflight is linked from gate and handoff docs', () => {
  for (const text of [gate, currentState, activeNextActions]) {
    requireText(text, evidencePath)
  }
})
