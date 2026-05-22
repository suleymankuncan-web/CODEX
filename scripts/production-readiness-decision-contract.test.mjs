import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

const workspaceRoot = join(import.meta.dirname, '..')
const decisionPath = 'docs/evidence/readiness/2026-05-18-production-readiness-decision.md'

function readText(path) {
  return readFileSync(join(workspaceRoot, path), 'utf8')
}

function requireText(text, value) {
  assert.ok(text.includes(value), `Missing expected text: ${value}`)
}

const decision = readText(decisionPath)
const currentState = readText('current-state.md')
const activeNextActions = readText('docs/plans/active-next-actions.md')
const debtLedger = readText('docs/plans/project-debt-ledger.md')
const readinessProgress = readText('docs/superpowers/plans/2026-05-18-readiness-progress.md')

test('production readiness decision records the final release posture', () => {
  for (const phrase of [
    'Local code and release gate: Go.',
    'Controlled staging/internal hardening: Conditional Go.',
    'Controlled pilot expansion: No-Go until real staging auth/action and protected-route evidence is captured.',
    'Broad production rollout: No-Go.',
    'PR #239',
    'c69b7cf24605e9b65b7215f6557f74174dd6364b',
  ]) {
    requireText(decision, phrase)
  }
})

test('production readiness decision summarizes every readiness slice and blocker', () => {
  for (const phrase of [
    'Merged PR #228',
    'Merged PR #229',
    'Merged PR #230',
    'Merged PR #231',
    'Merged PR #232',
    'Merged PR #233',
    'Merged PR #234',
    'Merged PR #235 and review fixes PR #236',
    'Merged PR #237',
    'Merged PR #238',
    'Merged PR #239',
    'Supabase staging restore into a disposable target has not been executed.',
    'Protected route performance and authenticated session evidence remain blocked',
    'broad production requires Redis-backed rate limiting',
    'broad production durable work requires BullMQ/Redis evidence',
    'Staging authenticated upload smoke still needs integration-admin credentials and sample file.',
  ]) {
    requireText(decision, phrase)
  }
})

test('production readiness decision preserves no-secret evidence rules', () => {
  for (const phrase of [
    'No bearer token',
    'authorization code',
    'PKCE verifier',
    'client secret',
    'database URL',
    'Redis URL',
    'provider console values and live secrets must remain outside the repo',
  ]) {
    requireText(decision, phrase)
  }
})

test('production readiness decision uses repo-root-runnable auth evidence commands', () => {
  for (const phrase of [
    'npm.cmd --prefix admin-web run smoke:auth:staging',
    'npm.cmd --prefix admin-web run --silent smoke:auth:staging:action | npm.cmd --prefix admin-web run --silent guard:auth:evidence -- --stdin',
  ]) {
    requireText(decision, phrase)
  }

  assert.doesNotMatch(decision, /`npm\.cmd run smoke:auth:staging`/)
  assert.doesNotMatch(decision, /`npm\.cmd run smoke:auth:staging:action`/)
  assert.doesNotMatch(decision, /`npm\.cmd run guard:auth:evidence`/)
  assert.doesNotMatch(decision, /`npm\.cmd --prefix admin-web run guard:auth:evidence`/)
})

test('handoff and action docs link the production readiness decision', () => {
  for (const text of [currentState, activeNextActions, debtLedger]) {
    requireText(text, 'Production Readiness Decision Packet V1')
    requireText(text, decisionPath)
  }
})

test('handoff docs keep post-merge readiness evidence tiers clear', () => {
  requireText(currentState, '107cc561 Merge pull request #240')
  requireText(currentState, 'PR #240 Final Go/No-Go Readiness Packet')
  requireText(currentState, 'Main `Release Check` passed after PR #240.')
  requireText(debtLedger, 'PR #240 merged')
  requireText(readinessProgress, '| 12 | Final Go/No-Go Readiness Packet | Merged (#240) |')

  requireText(currentState, 'There are six external evidence gaps')
  requireText(currentState, 'Tier A - controlled pilot expansion first')
  requireText(currentState, 'Real staging auth/action smoke with sanitized evidence.')
  requireText(currentState, 'Protected route load smoke with role-specific staging bearer tokens.')
  requireText(currentState, 'Authenticated integration-admin upload smoke with a safe sample file.')

  requireText(activeNextActions, 'The original six external evidence gaps are now')
  requireText(activeNextActions, 'Tier A - controlled pilot expansion follow-up')
  requireText(activeNextActions, 'Verify staging `GET /api/integrations/import-batches` after the SQL')
  requireText(activeNextActions, 'Dedicated integration-admin persona proof if strict non-super-admin upload')
  requireText(activeNextActions, 'docs/evidence/readiness/2026-05-22-live-evidence-proof-pass.md')

  for (const text of [currentState, activeNextActions]) {
    requireText(text, 'Tier B - broad-production/operational hardening')
    requireText(text, 'Supabase staging restore drill into an approved disposable target.')
    requireText(text, 'Alert/error-tracking destination proof or accepted log-retention evidence.')
    requireText(text, 'Broad-production Redis/BullMQ decision and health evidence')
  }
})
