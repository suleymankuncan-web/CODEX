import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

const workspaceRoot = join(import.meta.dirname, '..')
const evidencePath =
  'docs/evidence/readiness/2026-05-22-readiness-profile-reset-after-broad-smoke.md'

function readText(path) {
  return readFileSync(join(workspaceRoot, path), 'utf8')
}

function requireText(text, value) {
  assert.ok(text.includes(value), `Missing expected text: ${value}`)
}

const evidence = readText(evidencePath)
const currentState = readText('docs/history/current-state-through-pr-913-2026-07-09.md')
const activeNextActions = readText('docs/plans/active-next-actions.md')
const jointPlan = readText('docs/plans/production-evidence-closure-joint-plan-v1.md')

test('readiness profile reset proof records broad-profile Redis/BullMQ smoke', () => {
  for (const phrase of [
    '# Readiness Profile Reset After Broad Smoke - 2026-05-22',
    'READINESS_PROFILE=broad-production',
    'queue backend: `bullmq`.',
    'queue status: `durable`.',
    'Redis check: `ok`, latency `4ms`',
    'readiness profile: `broad-production`.',
    'observability status: `degraded`.',
    'error tracking DSN configured: `false`.',
  ]) {
    requireText(evidence, phrase)
  }
})

test('readiness profile reset proof records controlled-pilot recovery', () => {
  for (const phrase of [
    'READINESS_PROFILE=controlled-pilot',
    'Evidence time: `2026-05-22T11:58:55.931Z`.',
    'observability status: `ok`.',
    'readiness profile: `controlled-pilot`.',
    'status: `ok`.',
    'passed: `13`.',
    'p95 `199.86ms`',
    'passed: `5`.',
    'observability status: `ok`.',
  ]) {
    requireText(evidence, phrase)
  }
})

test('readiness profile reset proof keeps broad production caveat explicit', () => {
  for (const phrase of [
    'Do not bypass this with a fake DSN.',
    'Current staging posture: Conditional Go for controlled pilot.',
    'Broad production:',
    'Still No-Go.',
    'Choose real app-level error tracking',
    'production-grade Redis/Key Value tier',
    'Supabase managed backup/PITR/RPO/RTO policy',
  ]) {
    requireText(evidence, phrase)
  }
})

test('handoff docs point to readiness profile reset proof', () => {
  for (const text of [currentState, activeNextActions, jointPlan]) {
    requireText(text, evidencePath)
    requireText(text, 'controlled-pilot')
    requireText(text, 'broad-production')
    requireText(text, 'observability')
  }
})

test('readiness profile reset proof contains no obvious secret material', () => {
  assert.doesNotMatch(evidence, /\b(?:postgres(?:ql)?|redis|rediss):\/\/\S+/i)
  assert.doesNotMatch(evidence, /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i)
  assert.doesNotMatch(evidence, /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/)
  assert.doesNotMatch(
    evidence,
    /\b(service_role|SUPABASE_ACCESS_TOKEN|DATABASE_URL|WEBHOOK_SECRET|SLACK_WEBHOOK)=/i,
  )
  assert.doesNotMatch(evidence, /\bREDIS_URL=(?!\[secret Render Key Value internal URL\])/i)
  assert.doesNotMatch(evidence, /\b(password|pwd)\s*[:=]\s*\S+/i)
})
