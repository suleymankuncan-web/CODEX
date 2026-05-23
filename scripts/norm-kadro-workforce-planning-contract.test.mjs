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

function requireText(text, expected) {
  assert.ok(text.includes(expected), `Missing expected text: ${expected}`)
}

const evidencePath = 'docs/evidence/norm-kadro-workforce-planning-readonly-v1.md'
const evidence = readText(evidencePath)
const currentState = readText('current-state.md')
const growthRoadmap = readText('docs/plans/project-growth-execution-roadmap-v1.md')
const featureBacklog = readText('docs/plans/feature-backlog.md')
const decisionRegistry = readText('docs/plans/decision-registry-v1.md')

test('norm kadro workforce planning evidence records the read-only boundary', () => {
  requirePath(evidencePath)

  for (const phrase of [
    '# Norm Kadro / Workforce Planning Read-Only V1',
    'Do not create a new Norm Kadro module now.',
    'Use the existing workforce report and headcount-gap reads before adding any',
    'ops.workforce_norm_plan',
    'GET /api/reports/workforce',
    '/admin/reports/workforce/:snapshotRunId',
    'GET /api/workforce/headcount-gap',
    'No editing UI, approval workflow, import adapter, or dynamic config.',
    'No automatic command or Store Action creation.',
    'Do not start with:',
  ]) {
    requireText(evidence, phrase)
  }
})

test('norm kadro workforce planning evidence is linked from operating docs', () => {
  for (const text of [currentState, growthRoadmap, featureBacklog, decisionRegistry]) {
    requireText(text, evidencePath)
    requireText(text, 'Norm Kadro / Workforce Planning Read-Only V1')
  }
})
