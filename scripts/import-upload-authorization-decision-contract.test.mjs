import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

const workspaceRoot = join(import.meta.dirname, '..')
const decisionPath = 'docs/plans/import-upload-authorization-decision-v1.md'

function readText(path) {
  return readFileSync(join(workspaceRoot, path), 'utf8')
}

function requireText(text, value) {
  assert.ok(text.includes(value), `Missing expected text: ${value}`)
}

const decision = readText(decisionPath)
const currentState = readText('current-state.md')
const activeNextActions = readText('docs/plans/active-next-actions.md')
const liveEvidence = readText('docs/evidence/readiness/2026-05-22-live-evidence-proof-pass.md')
const productionBlockers = readText('docs/evidence/readiness/2026-05-22-production-evidence-blockers-v2.md')

test('import upload authorization decision keeps integration admin optional for pilot', () => {
  for (const phrase of [
    '# Import Upload Authorization Decision V1',
    'Dedicated `INTEGRATION_ADMIN` persona proof is not required for the current',
    '`INTEGRATION_ADMIN` remains a future optional separation-of-duties role, not a',
    'Controlled pilot import/upload evidence:',
    '`Go` with the existing `SUPER_ADMIN` pilot session.',
  ]) {
    requireText(decision, phrase)
  }
})

test('import upload authorization decision does not silently widen HR admin behavior', () => {
  for (const phrase of [
    'That is not claimed by this decision.',
    'backend integration upload/read endpoints currently require',
    '`SUPER_ADMIN` can satisfy those requirements through the existing role guard',
    'granting `HR_ADMIN` access would be an explicit auth/permission behavior',
    'Do not widen `HR_ADMIN` integration permissions without a dedicated auth PR.',
  ]) {
    requireText(decision, phrase)
  }
})

test('handoff and evidence docs reference the import upload authorization decision', () => {
  for (const text of [currentState, activeNextActions, liveEvidence, productionBlockers]) {
    requireText(text, decisionPath)
  }

  requireText(currentState, 'Dedicated non-super-admin `INTEGRATION_ADMIN` persona proof is no longer a')
  requireText(activeNextActions, 'Dedicated integration-admin persona proof is no longer required')
  requireText(liveEvidence, 'Dedicated integration-admin persona proof is not required')
  requireText(productionBlockers, 'Dedicated `INTEGRATION_ADMIN` persona proof: not a current pilot blocker.')
})

test('import upload authorization decision contains no obvious secret material', () => {
  assert.doesNotMatch(decision, /\b(?:postgres(?:ql)?|redis):\/\/\S+/i)
  assert.doesNotMatch(decision, /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/)
  assert.doesNotMatch(decision, /\b(service_role|SUPABASE_ACCESS_TOKEN|DATABASE_URL|REDIS_URL|WEBHOOK_SECRET)=/i)
  assert.doesNotMatch(decision, /store-ops-admin-bearer-token\s*[:=]/i)
})
