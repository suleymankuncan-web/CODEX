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

const contractPath = 'docs/plans/source-agnostic-import-boundary-v1.md'
const contract = readText(contractPath)
const currentState = readText('current-state.md')
const activeNextActions = readText('docs/plans/active-next-actions.md')
const debtLedger = readText('docs/plans/project-debt-ledger.md')

test('source agnostic import boundary keeps Power BI/Excel active and JSON suspended', () => {
  for (const phrase of [
    'Excel KPI Import V1 is the active local source path.',
    'JSON is future-only until a real sample payload or official field list exists.',
    'JSON source integration is suspended for the current pilot and Power BI/Excel operating path.',
    'Do not plan or staff JSON implementation work while Power BI/Excel outputs remain the chosen operating source.',
    'Do not build a JSON adapter, endpoint, scheduled job, or field map from guessed data.',
    'When JSON becomes real, it must enter through the same canonical import boundary as Excel.',
  ]) {
    requireText(contract, phrase)
  }
})

test('source agnostic import boundary locks the adapter to canonical rows', () => {
  for (const phrase of [
    'Source adapter',
    'Canonical import payload',
    'Shared mapping and validation',
    'Data quality and lineage',
    'Materialization and snapshotting',
    'Scoring and reporting',
    'No source-specific scoring branch is allowed in V1.',
  ]) {
    requireText(contract, phrase)
  }
})

test('source agnostic import boundary documents required canonical evidence fields', () => {
  for (const phrase of [
    'sourceCode',
    'sourceBatchId',
    'sourceRowReference',
    'rowHash',
    'rawPayload',
    'storeExternalRef',
    'employeeExternalRef',
    'periodStart',
    'periodEnd',
    'metricCode',
    'actualValue',
  ]) {
    requireText(contract, phrase)
  }
})

test('source agnostic import boundary preserves master-data and mapping safety', () => {
  for (const phrase of [
    'No source adapter may auto-create store or employee master data.',
    'unmapped_store',
    'unmapped_employee',
    'Exact external-id mapping wins before normalized fallback.',
    'Ambiguous normalized matches must reject instead of choosing silently.',
    'PowerBI-provided Turkey-average rows remain reconciliation evidence, not scoring source.',
  ]) {
    requireText(contract, phrase)
  }
})

test('source agnostic import boundary is linked from handoff and debt docs', () => {
  for (const text of [currentState, activeNextActions, debtLedger]) {
    requireText(text, contractPath)
    requireText(text, 'Source-Agnostic Import Boundary V1')
  }
})

test('json source suspension is recorded as the current product decision', () => {
  for (const text of [currentState, activeNextActions, debtLedger]) {
    requireText(text, 'JSON Source Suspension V1')
    requireText(text, 'Power BI/Excel')
    requireText(text, 'JSON source integration is suspended')
  }

  requireText(debtLedger, '94. JSON Source Suspension V1')
  requireText(debtLedger, 'JSON Source Suspension V1 is counted as paid because')
})
