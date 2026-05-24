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

const modelPath = 'docs/plans/internal-change-visibility-operating-model-v1.md'
const evidencePath = 'docs/evidence/product-progress/2026-05-24-internal-change-visibility-v1.md'
const model = readText(modelPath)
const evidence = readText(evidencePath)
const library = readText('docs/README.md')
const currentState = readText('current-state.md')
const p2Plan = readText('docs/plans/p2-product-intelligence-execution-v1.md')
const activeNextActions = readText('docs/plans/active-next-actions.md')
const evidenceRegister = readText('docs/evidence/README.md')

test('internal change visibility docs are discoverable', () => {
  for (const path of [modelPath, evidencePath]) {
    requirePath(path)
  }

  for (const text of [library, currentState, p2Plan, activeNextActions, evidenceRegister]) {
    requireText(text, modelPath)
  }

  for (const text of [currentState, p2Plan, activeNextActions, evidenceRegister]) {
    requireText(text, evidencePath)
  }
})

test('internal change visibility model preserves operator note contract', () => {
  for (const phrase of [
    '# Internal Change Visibility Operating Model V1',
    'Status: operating_model_ready',
    '## Sokrates Decision',
    '## Change Note Contract',
    'What changed?',
    'Who cares?',
    'What can the user do differently now?',
    'What did not change?',
    'Which evidence proves it?',
    'Not changed',
    'Risk/rollback',
  ]) {
    requireText(model, phrase)
  }
})

test('internal change visibility blocks unsafe changelog behavior', () => {
  for (const phrase of [
    'not as a new product module or in-app changelog',
    'Do not add an in-app changelog',
    'raw commit logs',
    'branch names',
    'raw audit payloads',
    'raw tokens, cookies, provider subjects, database URLs, Redis URLs',
    'wants to send notifications',
    'changes auth, API response shape, DB, provider config, CSS, or user workflow',
  ]) {
    requireText(model, phrase)
  }
})

test('internal change visibility evidence keeps seed notes scoped and honest', () => {
  for (const phrase of [
    '# Internal Change Visibility V1 Evidence',
    'Evidence class: docs_decision',
    '## Seed Change Notes',
    'PR #499',
    'PR #500',
    'PR #492',
    'No UI, endpoint, auth, DB, scoring, or workflow behavior changed.',
    'No visible Replay page or operator workflow changed.',
    'A docs-only note cannot claim runtime behavior by itself.',
    'Future in-app release notes remain parked',
  ]) {
    requireText(evidence, phrase)
  }
})
