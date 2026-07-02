import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'

const workspaceRoot = join(import.meta.dirname, '..')

function readText(path) {
  return readFileSync(join(workspaceRoot, path), 'utf8')
}

function requireText(text, phrase) {
  assert.ok(text.includes(phrase), `expected document to include: ${phrase}`)
}

const canonicalContract = readText('docs/contracts/external-source-canonical-data-contract-v1.md')
const qualityRules = readText('docs/contracts/external-source-data-quality-rules-v1.md')

test('external source contract keeps provider payloads behind the canonical boundary', () => {
  for (const phrase of [
    'provider-agnostic row shapes',
    'Domain pages must not read provider-native payloads directly.',
    'Adapter output must be canonical, validated, and auditable.',
    'This document does not assume Nebim field names.',
    'sourceBatchId',
    'sourceRowId',
    'sourceRowHash',
  ]) {
    requireText(canonicalContract, phrase)
  }
})

test('external source contract defines the pilot fact families', () => {
  for (const phrase of [
    '## Canonical Fact Families',
    '### Sales Fact',
    '### Target Fact',
    '### KPI Fact',
    '### GSM Approval Fact',
    '### Checklist And Action Fact',
    '### Workforce And Norm Fact',
    '### Report Package Fact',
  ]) {
    requireText(canonicalContract, phrase)
  }
})

test('external source contract blocks unsafe source behaviors', () => {
  for (const phrase of [
    'No source adapter may auto-create store, region, or employee master data.',
    'Quarantined rows contributing to KPI, ranking, incentive, target, checklist, workforce, or report calculations.',
    'Provider region labels overriding HR Axis region assignments.',
  ]) {
    requireText(canonicalContract, phrase)
  }
})

test('data quality rules keep quarantine separate from calculations', () => {
  for (const phrase of [
    'Rows that cannot be safely mapped must not block the full pilot surface.',
    'Domain calculations must consume accepted rows only',
    'quarantined_employee_unmatched',
    'quarantined_store_unmatched',
    'quarantined_duplicate',
    'accepted_without_person',
  ]) {
    requireText(qualityRules, phrase)
  }
})

test('data quality rules preserve pilot tolerance and stop rules', () => {
  for (const phrase of [
    'Known unmatched historical personnel',
    'Quarantined personnel rows do not prevent store-level KPI/reporting from rendering.',
    'Pilot must stop when:',
    'KPI/prim/ranking calculations use quarantined rows.',
    'Import accepted/quarantine counts are not explainable.',
  ]) {
    requireText(qualityRules, phrase)
  }
})

test('data quality rules lock sales return and missing-value semantics', () => {
  for (const phrase of [
    "The original salesperson's accepted sale must not be silently rewritten",
    'Missing numeric values are not zero.',
    'Missing target is `missing target`, not `0`.',
    'Missing GSM approval is `missing source`, not `0`.',
  ]) {
    requireText(qualityRules, phrase)
  }
})
