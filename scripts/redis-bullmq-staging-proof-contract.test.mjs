import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

const workspaceRoot = join(import.meta.dirname, '..')
const evidencePath = 'docs/evidence/readiness/2026-05-22-redis-bullmq-staging-proof.md'

function readText(path) {
  return readFileSync(join(workspaceRoot, path), 'utf8')
}

function requireText(text, value) {
  assert.ok(text.includes(value), `Missing expected text: ${value}`)
}

const evidence = readText(evidencePath)
const currentState = readText('current-state.md')
const activeNextActions = readText('docs/plans/active-next-actions.md')

test('redis bullmq staging proof records durable staging health', () => {
  for (const phrase of [
    '# Redis / BullMQ Staging Proof - 2026-05-22',
    'Backend `/api/health` returned HTTP `200`.',
    'Health reported `queueBackend=bullmq`.',
    'Health reported queue `status=durable`.',
    'Health reported `checks.redis.status=ok`.',
    'queue message: `BullMQ queue is using Redis-backed durable dispatch.`',
    'Redis check: `ok`, latency `6ms`',
  ]) {
    requireText(evidence, phrase)
  }
})

test('redis bullmq staging proof keeps broad production caveat explicit', () => {
  for (const phrase of [
    'It proves staging connectivity and durable queue health.',
    'not enough to declare broad',
    'Broad production:',
    'Still No-Go.',
    'Production-grade Redis/Key Value tier decision and broad-production profile',
    'External alert provider delivery or explicit owner log-retention acceptance.',
    'Supabase restore drill into an approved disposable target.',
  ]) {
    requireText(evidence, phrase)
  }
})

test('handoff docs point to the redis bullmq staging proof', () => {
  for (const text of [currentState, activeNextActions]) {
    requireText(text, evidencePath)
    requireText(text, '`queueBackend=bullmq`')
    requireText(text, 'queue `status=durable`')
    requireText(text, 'Redis')
    requireText(text, '`status=ok`')
  }
})

test('redis bullmq staging proof contains no obvious secret material', () => {
  assert.doesNotMatch(evidence, /\b(?:postgres(?:ql)?|redis|rediss):\/\/\S+/i)
  assert.doesNotMatch(evidence, /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/)
  assert.doesNotMatch(
    evidence,
    /\b(service_role|SUPABASE_ACCESS_TOKEN|DATABASE_URL|WEBHOOK_SECRET)=/i,
  )
  assert.doesNotMatch(evidence, /\bREDIS_URL=(?!\[secret Render Key Value internal URL\])/i)
})
