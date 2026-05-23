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

const roadmapPath = 'docs/plans/project-growth-execution-roadmap-v1.md'
const roadmap = readText(roadmapPath)
const library = readText('docs/README.md')
const currentState = readText('current-state.md')
const activeNextActions = readText('docs/plans/active-next-actions.md')
const decisionRegistry = readText('docs/plans/decision-registry-v1.md')
const runbookRegistry = readText('docs/plans/runbook-registry-v1.md')
const controlBoard = readText('docs/plans/project-control-board-v1.md')

test('growth execution roadmap is discoverable from operating docs', () => {
  requirePath(roadmapPath)

  for (const text of [
    library,
    currentState,
    activeNextActions,
    decisionRegistry,
    runbookRegistry,
    controlBoard,
  ]) {
    requireText(text, roadmapPath)
  }
})

test('growth execution roadmap preserves ordered first eight tracks', () => {
  for (const phrase of [
    '# Project Growth Execution Roadmap V1',
    'Status: active',
    'Shelf: operating',
    '## Sokrates Decision',
    '## Priority Order',
    '## Dependency Graph',
    '## PR Rhythm',
    '## Definition Of Done For The Eight-Track Line',
    'Pilot Feedback Loop V1',
    'Data Quality & Reconciliation Center V1',
    'Operations Telemetry / Control Tower V2',
    'Store Action -> Coaching Loop V2',
    'Role / Permission Preview UI',
    'Rules / Config Versioning',
    'Norm Kadro / Workforce Planning Read-Only V1',
    'Production Ops Closure',
  ]) {
    requireText(roadmap, phrase)
  }
})

test('growth execution roadmap keeps first slices and stop rules explicit', () => {
  for (const phrase of [
    'First safe slice:',
    'Stop rules:',
    'stop if it becomes a full ticketing system',
    'stop if the slice wants to repair data automatically',
    'stop if it becomes a generic observability platform',
    'stop if it becomes a generic workflow engine',
    'stop if preview output is treated as the authorization engine',
    'stop if a generic rule engine is proposed',
    'stop if baseline ownership is unclear',
    'stop if production provider input is missing',
  ]) {
    requireText(roadmap, phrase)
  }
})

test('growth execution roadmap blocks broad unsafe claims', () => {
  for (const phrase of [
    'Do not change auth, API response shape, DB, provider config',
    'no broad production Go without owner acceptance',
    'It is not done when:',
    'production Go is claimed without owner acceptance',
    'UI redesign work is mixed into these tracks',
  ]) {
    requireText(roadmap, phrase)
  }
})
