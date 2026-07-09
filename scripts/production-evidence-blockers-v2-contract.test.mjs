import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

const workspaceRoot = join(import.meta.dirname, '..')
const evidencePath = 'docs/evidence/readiness/2026-05-22-production-evidence-blockers-v2.md'

function readText(path) {
  return readFileSync(join(workspaceRoot, path), 'utf8')
}

function requireText(text, value) {
  assert.ok(text.includes(value), `Missing expected text: ${value}`)
}

const evidence = readText(evidencePath)
const currentState = readText('docs/history/current-state-through-pr-913-2026-07-09.md')
const activeNextActions = readText('docs/plans/active-next-actions.md')
const v1Decision = readText('docs/evidence/readiness/2026-05-18-production-readiness-decision.md')

test('production evidence blocker V2 records the five requested evidence items', () => {
  for (const phrase of [
    '# Production Evidence Blockers V2 - 2026-05-22',
    'Redis / durable queue posture.',
    'Supabase restore drill.',
    'Authenticated upload smoke.',
    'Alert delivery.',
    'Readiness decision update.',
    'docs/evidence/system-flow/clerk-persona-live-evidence-2026-05-22.md',
  ]) {
    requireText(evidence, phrase)
  }
})

test('production evidence blocker V2 records real smoke results without upgrading missing evidence', () => {
  for (const phrase of [
    'queue backend: `in-memory`',
    'queue status: `process-local`',
    'Redis check: `skipped`',
    'provider delivery: `not-configured`',
    'public availability: `100%`',
    'public p50: `79.79ms`',
    'protected groups skipped',
    'status: `blocked`',
    'Authenticated staging upload smoke for the current controlled pilot: Go.',
    'Broad production rollout: No-Go.',
  ]) {
    requireText(evidence, phrase)
  }
})

test('production evidence blocker V2 keeps missing live inputs as blockers', () => {
  for (const phrase of [
    'Cannot close broad-production Redis/queue evidence.',
    'Cannot run restore drill.',
    'Alert routing stays metadata/log-only.',
    'Dedicated `INTEGRATION_ADMIN` persona proof: not a current pilot blocker.',
    'Protected route load budgets remain blocked in this run.',
    'Stop before inventing provider delivery',
    'protected route budget evidence.',
  ]) {
    requireText(evidence, phrase)
  }
})

test('handoff and action docs point to the V2 blocker refresh', () => {
  for (const text of [currentState, activeNextActions, v1Decision]) {
    requireText(text, evidencePath)
    requireText(text, 'docs/evidence/system-flow/clerk-persona-live-evidence-2026-05-22.md')
    requireText(text, 'docs/plans/import-upload-authorization-decision-v1.md')
  }
})

test('production evidence blocker V2 contains no obvious secret material', () => {
  assert.doesNotMatch(evidence, /\b(?:postgres(?:ql)?|redis):\/\/\S+/i)
  assert.doesNotMatch(evidence, /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/)
  assert.doesNotMatch(evidence, /\b(service_role|SUPABASE_ACCESS_TOKEN|DATABASE_URL|REDIS_URL|WEBHOOK_SECRET)=/i)
})
