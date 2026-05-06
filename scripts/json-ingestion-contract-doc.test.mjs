import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'

const workspaceRoot = join(import.meta.dirname, '..')
const contractPath = 'docs/plans/json-ingestion-contract-v1.md'
const contract = readFileSync(join(workspaceRoot, contractPath), 'utf8')

function requireText(expected) {
  assert.ok(contract.includes(expected), `contract must include ${expected}`)
}

test('json ingestion contract documents endpoint envelope and idempotency', () => {
  for (const phrase of [
    '# JSON Ingestion Contract V1',
    'POST /api/integrations/kpi-json-import',
    'sourceCode',
    'periodType',
    'periodStart',
    'periodEnd',
    'idempotencyKey',
    'rows',
  ]) {
    requireText(phrase)
  }
})

test('json ingestion contract preserves matching and review policy', () => {
  for (const phrase of [
    'Code-based matching wins when present',
    'Store/personnel name matching remains reviewable',
    'Ambiguous rows go to review',
    'No source adapter may auto-create store or employee master data',
  ]) {
    requireText(phrase)
  }
})

test('json ingestion contract keeps the canonical import boundary', () => {
  for (const phrase of [
    'When JSON becomes real, it must enter through the same canonical import boundary as Excel.',
    'Source adapter',
    'Canonical import payload',
    'rowHash',
    'rawPayload',
    'sourceRowReference',
  ]) {
    requireText(phrase)
  }
})
