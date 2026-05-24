import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

const workspaceRoot = join(import.meta.dirname, '..')

function readText(path) {
  return readFileSync(join(workspaceRoot, path), 'utf8')
}

function requirePath(path) {
  assert.ok(existsSync(join(workspaceRoot, path)), `Missing expected path: ${path}`)
}

function requireText(text, value) {
  assert.ok(text.includes(value), `Missing expected text: ${value}`)
}

const policyPath = 'docs/plans/usage-performance-correlation-policy-v1.md'
const policy = readText(policyPath)
const library = readText('docs/README.md')
const currentState = readText('current-state.md')
const p2Plan = readText('docs/plans/p2-product-intelligence-execution-v1.md')
const activeNextActions = readText('docs/plans/active-next-actions.md')

test('usage performance correlation policy is discoverable', () => {
  requirePath(policyPath)

  for (const text of [library, currentState, p2Plan, activeNextActions]) {
    requireText(text, policyPath)
  }
})

test('usage performance correlation policy separates engagement signals', () => {
  for (const phrase of [
    '# Usage Performance Correlation Policy V1',
    'Status: data_policy_ready',
    '## Sokrates Decision',
    '## Engagement Signal Vocabulary',
    '`visited`',
    '`read_brief`',
    '`opened_source`',
    '`acted`',
    '`completed_assigned_work`',
    '`ignored_or_stale`',
    'Do not collapse them into one "login score".',
  ]) {
    requireText(policy, phrase)
  }
})

test('usage performance correlation policy blocks surveillance and causality claims', () => {
  for (const phrase of [
    'Do not add usage tracking now.',
    'Do not treat login frequency as performance evidence.',
    'Raw login counts are not a safe or fair performance signal.',
    'Default: no product surface for individual login frequency.',
    'associated with',
    'instead of "caused by"',
    'tracks every login as product evidence without policy',
    'exposes individual login frequency to managers',
    'creates a hidden surveillance surface',
  ]) {
    requireText(policy, phrase)
  }
})

test('usage performance correlation policy keeps privacy and scoring boundaries explicit', () => {
  for (const phrase of [
    'Do not store or expose raw Clerk tokens, cookies, provider subjects, IPs',
    'keep engagement out of KPI/ranking scoring',
    'separate explicit policy and owner decision',
    'changes performance/KPI scoring',
    'stores tokens, cookies, provider subjects, IPs, or private payloads',
    'bypasses role/scope/action-store visibility',
    'starts UI before the user starts UI/content direction',
  ]) {
    requireText(policy, phrase)
  }
})
