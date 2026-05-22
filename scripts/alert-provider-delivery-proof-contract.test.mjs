import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

const workspaceRoot = join(import.meta.dirname, '..')
const evidencePath = 'docs/evidence/readiness/2026-05-22-alert-provider-delivery-proof.md'

function readText(path) {
  return readFileSync(join(workspaceRoot, path), 'utf8')
}

function requireText(text, value) {
  assert.ok(text.includes(value), `Missing expected text: ${value}`)
}

const evidence = readText(evidencePath)
const currentState = readText('current-state.md')
const activeNextActions = readText('docs/plans/active-next-actions.md')

test('alert provider delivery proof records the proven staging channel', () => {
  for (const phrase of [
    '# Alert Provider Delivery Proof - 2026-05-22',
    'Render Notifications was configured with email and Slack destinations.',
    'Slack received the Render notification.',
    'Email delivery was not observed in this pass and is not counted as proven.',
    'Provider: render-notifications',
    'Proven delivered destination: ops-slack',
    'Health check path: /api/health',
  ]) {
    requireText(evidence, phrase)
  }
})

test('alert provider delivery proof captures concrete smoke and health output', () => {
  for (const phrase of [
    'Evidence time: `2026-05-22T10:28:37.431Z`.',
    'status: `ok`.',
    'total checks: `5`.',
    'passed: `5`.',
    'failed: `0`.',
    'skipped: `0`.',
    'provider delivery: `metadata-only` from the script perspective.',
    'backend health alert signal: passed with HTTP `200`.',
    'Evidence time: `2026-05-22T10:28:37.543Z`.',
    'queue backend: `bullmq`.',
    'queue status: `durable`.',
    'Redis check: `ok`, latency `2ms`.',
    'database check: `ok`, latency `2ms`.',
  ]) {
    requireText(evidence, phrase)
  }
})

test('alert provider delivery proof keeps broad production caveats explicit', () => {
  for (const phrase of [
    'It does not claim app-level Sentry-style error delivery',
    'Email delivery: not proven in this pass.',
    'App-level error-tracking SDK delivery: not implemented and not claimed.',
    'Broad production:',
    'Still No-Go.',
    'Supabase restore drill into an approved disposable target.',
    'Production alert policy decision',
  ]) {
    requireText(evidence, phrase)
  }
})

test('handoff docs point to the alert provider delivery proof', () => {
  for (const text of [currentState, activeNextActions]) {
    requireText(text, evidencePath)
    requireText(text, 'Render Notifications')
    requireText(text, 'Slack')
    requireText(text, 'Email delivery was not observed')
  }
})

test('alert provider delivery proof contains no obvious secret material', () => {
  assert.doesNotMatch(evidence, /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i)
  assert.doesNotMatch(evidence, /hooks\.slack\.com/i)
  assert.doesNotMatch(evidence, /\b(?:postgres(?:ql)?|redis|rediss):\/\/\S+/i)
  assert.doesNotMatch(evidence, /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/)
  assert.doesNotMatch(
    evidence,
    /\b(service_role|SUPABASE_ACCESS_TOKEN|DATABASE_URL|REDIS_URL|WEBHOOK_SECRET|SLACK_WEBHOOK)=/i,
  )
})
