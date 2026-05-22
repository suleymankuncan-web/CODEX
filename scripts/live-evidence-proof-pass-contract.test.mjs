import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

const workspaceRoot = join(import.meta.dirname, '..')
const evidencePath = 'docs/evidence/readiness/2026-05-22-live-evidence-proof-pass.md'

function readText(path) {
  return readFileSync(join(workspaceRoot, path), 'utf8')
}

function requireText(text, value) {
  assert.ok(text.includes(value), `Missing expected text: ${value}`)
}

const evidence = readText(evidencePath)
const currentState = readText('current-state.md')

test('live evidence proof pass records proven and blocked items separately', () => {
  for (const phrase of [
    '# Live Evidence Proof Pass - 2026-05-22',
    'Protected route load smoke | Proven',
    'Authenticated upload smoke | Proven with existing super-admin pilot session',
    'Dedicated integration-admin persona | Not required for current pilot',
    'Redis/BullMQ broad-production health | Still missing',
    'External alert provider delivery | Still missing',
    'Supabase restore drill | Still missing',
  ]) {
    requireText(evidence, phrase)
  }
})

test('live evidence proof pass captures concrete staging smoke outputs', () => {
  for (const phrase of [
    'Evidence time: `2026-05-22T06:39:59.519Z`.',
    'Store reads: availability `100%`, p50 `215.18ms`, p95 `1434.14ms`',
    'HTTP status: `201`.',
    'Batch id tail: `be350e95`.',
    '`canonicalRowCount`: `2`.',
    'GET /api/integrations/import-batches?limit=5`: HTTP `200`',
    'Merge commit: `0971883f6a876086225b68c2e47a08aaba29d013`.',
    'backend health alert signal: passed with HTTP `200`.',
    '`queueBackend`: `in-memory`.',
    'Redis status: `skipped`.',
  ]) {
    requireText(evidence, phrase)
  }
})

test('live evidence proof pass keeps broad production as no-go', () => {
  for (const phrase of [
    'Broad production:',
    'No-Go.',
    'Redis/BullMQ durable queue health is not proven.',
    'Supabase restore drill is not proven.',
    'External alert delivery is not proven.',
    'Import batch list/readback operator evidence is now fixed and live-verified.',
    'Dedicated `INTEGRATION_ADMIN` persona proof: not required for the current',
  ]) {
    requireText(evidence, phrase)
  }
})

test('current state points to the live evidence proof pass', () => {
  requireText(currentState, evidencePath)
  requireText(currentState, 'Protected route load smoke and safe staging upload smoke are now proven.')
  requireText(currentState, 'docs/plans/import-upload-authorization-decision-v1.md')
  requireText(currentState, 'Import batch list read model previously returned HTTP `500`')
  requireText(currentState, 'list query selecting shared join columns without `stg.import_batch`')
  requireText(currentState, 'After Render deploy, real Clerk readback at')
})

test('live evidence proof pass contains no obvious secret material', () => {
  assert.doesNotMatch(evidence, /\b(?:postgres(?:ql)?|redis):\/\/\S+/i)
  assert.doesNotMatch(evidence, /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/)
  assert.doesNotMatch(evidence, /\b(service_role|SUPABASE_ACCESS_TOKEN|DATABASE_URL|REDIS_URL|WEBHOOK_SECRET)=/i)
  assert.doesNotMatch(evidence, /store-ops-admin-bearer-token\s*[:=]/i)
})
