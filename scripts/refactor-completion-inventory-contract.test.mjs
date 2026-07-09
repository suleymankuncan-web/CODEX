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

const inventoryPath = 'docs/plans/refactor-completion-inventory-v1.md'
const inventory = readText(inventoryPath)
const currentState = readText('docs/history/current-state-through-pr-913-2026-07-09.md')
const technicalRoadmap = readText('docs/plans/technical-debt-resolution-roadmap-v1.md')

test('refactor completion inventory closes broad refactor as a standing theme', () => {
  for (const phrase of [
    '# Refactor Completion Inventory V1',
    'closes the recurring "large file means keep refactoring" loop',
    'Close broad refactor as an open-ended theme.',
    'The generic "refactor debt" loop is closed.',
  ]) {
    requireText(inventory, phrase)
  }
})

test('refactor completion inventory keeps active code candidates finite', () => {
  for (const phrase of [
    'S01: RankingService Pure Helper Extraction',
    'S02: MasterDataBootstrapService Validation Boundary',
    'S03: ReportingService Test-Map And Pure Helper Candidate',
    'S04: IntegrationService Pure Mapping Helper Extraction',
    'S05: Test Suite Helper Extraction',
  ]) {
    requireText(inventory, phrase)
  }
})

test('refactor completion inventory parks high-risk and redesign-sensitive work', () => {
  for (const phrase of [
    'Redesign-sensitive frontend pages and competition/store surfaces.',
    'Auth admin write/security boundaries.',
    'Workforce request command/write/status/audit/access lifecycle boundaries.',
    'Competition stage creation, package execution, score recalculation, and',
    'Integration materialization and raw import write paths.',
    'OpenAPI and system-flow generator scripts.',
  ]) {
    requireText(inventory, phrase)
  }
})

test('refactor completion inventory is linked from handoff and roadmap docs', () => {
  for (const text of [currentState, technicalRoadmap]) {
    requireText(text, inventoryPath)
    requireText(text, 'Refactor Completion Inventory V1')
  }
})
