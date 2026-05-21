import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'

const workspaceRoot = join(import.meta.dirname, '..')

function readText(path) {
  return readFileSync(join(workspaceRoot, path), 'utf8')
}

function requireText(text, expected) {
  assert.match(text, new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
}

const decisionPath = 'docs/plans/rules-config-boundary-decision-v1.md'
const decision = readText(decisionPath)
const currentState = readText('current-state.md')
const projectProgress = readText('docs/plans/project-progress-plan-v1.md')
const technicalRoadmap = readText('docs/plans/technical-debt-resolution-roadmap-v1.md')

test('rules/config boundary keeps the no-generic-engine decision explicit', () => {
  for (const phrase of [
    '# Rules / Config Boundary Decision V1',
    'Do not implement a generic rules engine now.',
    'Do not create new `dm` or `config` schemas now.',
    'Use domain-owned, typed, tested rules',
    'No generic scoring DSL.',
    'No global weight engine.',
    'No central workflow engine or notification service yet.',
    'No DB-backed runtime config editor.',
  ]) {
    requireText(decision, phrase)
  }
})

test('rules/config boundary keeps each rule family owned by a domain', () => {
  for (const phrase of [
    'KPI thresholds, score profiles, grading bands',
    'Checklist weights and item scoring',
    'Target approval',
    'Competitions',
    'Incentives / prim',
    'Workflow inbox routing',
    'Runtime/provider configuration',
    'Keep scoring interpretation typed, tested, and version-aware',
    'Approval rules stay with target distribution',
    'Stage/package/team rules stay competition-owned',
    'Inbox maps source status into shared queue language',
  ]) {
    requireText(decision, phrase)
  }
})

test('rules/config boundary preserves promotion triggers before shared infrastructure', () => {
  for (const phrase of [
    'Consider a shared rules/config boundary only when at least three are true:',
    'The same rule is consumed by multiple modules.',
    'A business user edits it.',
    'It needs draft/publish or approval lifecycle.',
    'It must be simulated before publish.',
    'Audit must answer which rule version produced an outcome.',
    'Rollback to an older rule version is required.',
    'Historical reports must display old and new interpretations side by side.',
  ]) {
    requireText(decision, phrase)
  }
})

test('rules/config boundary locks the first-code-slice guardrails', () => {
  for (const phrase of [
    'The first implementation slice should not be a rules engine.',
    'add a small read-only governance panel or guard for one existing rule family',
    'Do not combine this with DB schema, auth, API shape, or reporting math changes.',
    'This decision is now guarded by `scripts/rules-config-boundary-contract.test.mjs`.',
  ]) {
    requireText(decision, phrase)
  }
})

test('rules/config boundary is linked from active handoff and roadmap docs', () => {
  for (const text of [currentState, projectProgress, technicalRoadmap]) {
    requireText(text, decisionPath)
    requireText(text, 'Rules / Config Boundary Decision V1')
  }
})
