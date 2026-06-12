import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

const workspaceRoot = join(import.meta.dirname, '..')

const closeoutPath =
  'docs/evidence/readiness/2026-06-12-security-launch-blocker-pr-train-closeout.md'
const passedPath =
  'docs/evidence/readiness/2026-06-12-browser-session-staging-evidence.md'
const blockedPath =
  'docs/evidence/readiness/2026-06-12-browser-session-staging-evidence-blocked.md'

function readText(path) {
  return readFileSync(join(workspaceRoot, path), 'utf8')
}

function requireText(text, value) {
  assert.ok(text.includes(value), `Missing expected text: ${value}`)
}

const closeout = readText(closeoutPath)
const currentState = readText('current-state.md')
const activeNextActions = readText('docs/plans/active-next-actions.md')
const controlBoard = readText('docs/plans/project-control-board-v1.md')
const runbookRegistry = readText('docs/plans/runbook-registry-v1.md')
const evidenceRegister = readText('docs/evidence/README.md')
const library = readText('docs/README.md')
const trainPlan = readText('docs/plans/security-launch-blocker-pr-train-v1.md')

test('security launch blocker closeout evidence exists and keeps production no-go explicit', () => {
  assert.equal(existsSync(join(workspaceRoot, closeoutPath)), true, `${closeoutPath} must exist`)

  for (const expected of [
    '# Security Launch Blocker PR Train V1 Closeout',
    'Status: guarded',
    'No broad production Go is claimed here.',
    'Broad production remains `No-Go`.',
    'A later approved Region Manager staging run closed the browser-session evidence',
    'Real Region Manager staging cookie-session evidence is now recorded as',
    '`protected_staging_cookie_session_passed`.',
    'Do not use legacy bearer smoke',
    'as proof that launch browser token storage is fixed.',
  ]) {
    requireText(closeout, expected)
  }
})

test('security launch blocker closeout records merged PR train through PR-5', () => {
  for (const expected of [
    '| PR-0 plan and control links | `#684` | `70109c43afc9e42ae3ec428ad9c67b777db3a3a1` |',
    '| PR-1 env/session contract and guards | `#685` | `93b1763b5cc04ace4b02ae5d65a77910def3bb59` |',
    '| PR-2 backend browser-session foundation | `#686` | `512b8f1cff2bd4cb1ec8c4f1c4babbf33528b88d` |',
    '| PR-3 frontend cookie-session bridge | `#687` | `1b286556bdfe329e2f99cfd261b5b0c433f9c5fb` |',
    '| PR-4 token-storage and evidence guards | `#688` | `d244b811e2f764605c1f5a2bc15c4b7ec5030d7a` |',
    '| PR-5 staging evidence status | `#689` | `5ae2695f230983022ba28ff851be3a2341fa35d9` |',
    'PR-6 is this closeout/update-docs slice.',
  ]) {
    requireText(closeout, expected)
  }
})

test('security launch blocker closeout preserves auth and evidence boundaries', () => {
  for (const expected of [
    'browser-readable storage',
    'do not contain role, scope, store, or raw provider token data',
    'existing HR Axis DB role, scope, and',
    'assigned-store authorization path',
    'Bearer support remains as a controlled rollback and script-smoke path',
    'Auth evidence guards reject raw cookies',
    passedPath,
    blockedPath,
  ]) {
    requireText(closeout, expected)
  }
})

test('operating docs point to the security launch closeout and current staging proof', () => {
  for (const text of [currentState, activeNextActions, controlBoard, runbookRegistry, library]) {
    requireText(text, closeoutPath)
    requireText(text, passedPath)
  }

  requireText(evidenceRegister, '2026-06-12-security-launch-blocker-pr-train-closeout.md')
  requireText(evidenceRegister, '2026-06-12-browser-session-staging-evidence.md')
  requireText(evidenceRegister, '2026-06-12-browser-session-staging-evidence-blocked.md')
  requireText(library, 'do not reopen the local')
  requireText(library, 'Security Launch Blocker PR Train V1. That implementation and guard train is')
  requireText(library, 'Real Region Manager staging cookie-session evidence passed')
  requireText(library, 'Do not claim broad production readiness from this auth proof.')
  requireText(controlBoard, 'Launch browser session security | Guarded / staging proof passed')
  requireText(runbookRegistry, 'Check launch browser-session evidence')
  for (const text of [activeNextActions, currentState]) {
    requireText(text, 'Security Launch Blocker PR Train V1 is closed for local implementation')
    requireText(text, 'guards through PR #689')
    requireText(text, 'The earlier blocked attempt remains historical context')
  }
})

test('security launch train plan points to the closeout evidence', () => {
  requireText(trainPlan, closeoutPath)
  requireText(trainPlan, 'PR-6 closeout evidence:')
})
