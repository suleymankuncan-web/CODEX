import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import test from 'node:test'

const evidencePath =
  'docs/evidence/pilot-readiness/2026-05-22-controlled-pilot-round-2-stabilization.md'
const feedbackLogPath = 'docs/evidence/pilot-readiness/2026-05-05-controlled-pilot-feedback-log.md'

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

function requireNoSecretMaterial(text) {
  assert.doesNotMatch(text, /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/)
  assert.doesNotMatch(text, /\b(?:postgres(?:ql)?|redis):\/\/\S+/i)
  assert.doesNotMatch(
    text,
    /\b(?:DATABASE_URL|REDIS_URL|WEBHOOK_SECRET|CLERK_SECRET_KEY|READINESS_BEARER_TOKEN)=/i,
  )
}

const currentState = readText('current-state.md')
const activeNextActions = readText('docs/plans/active-next-actions.md')
const feedbackLog = readText(feedbackLogPath)

test('controlled pilot round 2 stabilization records a continue decision without widening scope', () => {
  assert.equal(existsSync(evidencePath), true, `${evidencePath} must exist`)
  const evidence = readText(evidencePath)

  requireAll(evidence, [
    '# Controlled Pilot Round 2 Stabilization Evidence',
    'Decision: continue the same controlled staging/internal pilot scope.',
    'Controlled pilot round 2 technical stabilization: `Continue`.',
    'Broad production rollout remains `No-Go`.',
    'It does not claim a fresh real-token persona rerun in this turn',
  ])
})

test('controlled pilot round 2 stabilization captures local and staging smoke results', () => {
  const evidence = readText(evidencePath)

  requireAll(evidence, [
    'npm.cmd run check:pilot-stabilization',
    'contract tests: `14/14` passed',
    'pilot Playwright smoke: `7/7` passed',
    'npm.cmd run smoke:deployed-readiness',
    'passed: `13`',
    'failed: `0`',
    'skipped: `1`',
    'backend auth session`, because `READINESS_BEARER_TOKEN` was',
    'npm.cmd run smoke:backend-readiness-load',
    'public API health group: passed',
    'public API health availability: `100%`',
    'public API health p50: `128.89ms`',
    'public API health p95: `222.99ms`',
    'npm.cmd run smoke:alert-routing',
    'passed: `4`',
    'backend health alert signal: passed with HTTP `200`',
  ])
})

test('controlled pilot round 2 stabilization keeps blocked external evidence explicit', () => {
  const evidence = readText(evidencePath)

  requireAll(evidence, [
    'role-specific bearer tokens were present. They must not be counted as pass.',
    'It does not prove protected route load budgets for role-specific staging',
    'It does not prove external alert provider delivery.',
    'It does not prove Supabase restore into an approved disposable target.',
    'It does not prove Redis/BullMQ broad-production durability.',
    'It does not approve new roles, new pilot users, wider store scope, or',
  ])

  requireNoSecretMaterial(evidence)
})

test('controlled pilot round 2 stabilization is linked from active handoff docs', () => {
  for (const text of [currentState, activeNextActions, feedbackLog]) {
    requireText(text, evidencePath)
  }

  requireText(currentState, 'Controlled Pilot Round 2 technical stabilization')
  requireText(activeNextActions, 'Controlled Pilot Round 2 technical stabilization is recorded')
  requireText(feedbackLog, 'Controlled Pilot Round 2 technical stabilization')
})
