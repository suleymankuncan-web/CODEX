import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

const workspaceRoot = join(import.meta.dirname, '..')

function readText(path) {
  return readFileSync(join(workspaceRoot, path), 'utf8')
}

function requireText(text, value) {
  assert.ok(text.includes(value), `Missing expected text: ${value}`)
}

function requirePath(path) {
  assert.ok(existsSync(join(workspaceRoot, path)), `Missing expected path: ${path}`)
}

const library = readText('docs/README.md')
const currentState = readText('current-state.md')
const activeNextActions = readText('docs/plans/active-next-actions.md')
const evidenceRegister = readText('docs/evidence/README.md')
const metadataStandard = readText('docs/plans/docs-library-metadata-standard-v1.md')

const domainShelves = [
  'docs/domains/auth.md',
  'docs/domains/store-action.md',
  'docs/domains/import-master-data.md',
  'docs/domains/reporting-kpi.md',
  'docs/domains/workforce.md',
  'docs/domains/readiness-ops.md',
]

test('documentation library has the required shelves', () => {
  for (const path of [
    'docs/README.md',
    'docs/evidence/README.md',
    'docs/plans/docs-library-metadata-standard-v1.md',
    ...domainShelves,
  ]) {
    requirePath(path)
  }

  for (const phrase of [
    '# HR Axis / Store Ops Documentation Library',
    '## Start Here',
    '### Operating Shelf',
    '### Pilot Shelf',
    '### Readiness And Operations Shelf',
    '### Architecture Shelf',
    '### Domain Shelf',
    '### Evidence Shelf',
    '### Historical Planning Shelf',
    '## Status Vocabulary',
    '## How To Add A New Document',
  ]) {
    requireText(library, phrase)
  }
})

test('operating handoff docs point to the documentation library', () => {
  for (const text of [currentState, activeNextActions]) {
    requireText(text, 'docs/README.md')
  }

  requireText(currentState, 'Documentation Library entry point')
  requireText(activeNextActions, 'Documentation entry point:')
})

test('domain shelves declare status and preserve high-risk boundaries', () => {
  for (const path of domainShelves) {
    const text = readText(path)
    requireText(text, 'Status: active shelf index')
    requireText(text, '## Reader And Action')
    requireText(text, '## Source Documents')
    requireText(text, '## Active Rules')
    requireText(text, '## Parked Or High-Risk')
  }

  requireText(readText('docs/domains/auth.md'), 'Application DB role/scope/action-store assignments authorize behavior.')
  requireText(readText('docs/domains/store-action.md'), 'Store Action should not become a generic')
  requireText(readText('docs/domains/import-master-data.md'), 'JSON source integration is suspended')
  requireText(readText('docs/domains/readiness-ops.md'), 'Broad production remains `No-Go`.')
})

test('evidence register keeps evidence classes and secret rules visible', () => {
  for (const phrase of [
    '# Evidence Register',
    'Status: active evidence index',
    '`local_test`',
    '`public_staging`',
    '`protected_staging`',
    '`provider_proof`',
    '`docs_decision`',
    'Do not record:',
    'raw bearer tokens',
    'Clerk cookies',
    'database URLs',
    'Redis URLs',
    'Broad production:',
    'still `No-Go`',
  ]) {
    requireText(evidenceRegister, phrase)
  }
})

test('metadata standard defines lightweight statuses and guard scope', () => {
  for (const phrase of [
    '# Docs Library Metadata Standard V1',
    'Status: active',
    'Shelf: architecture',
    'Use lightweight metadata for important docs.',
    'Do not bulk-edit every old file just to add metadata.',
    '## Shelf Meanings',
    '## PR Checklist',
    '## Stop Rules',
    'Guard:',
    'Do not guard:',
    'active | guarded | closed | parked | blocked_external | superseded | historical',
  ]) {
    requireText(metadataStandard, phrase)
  }

  for (const status of [
    '`active`',
    '`guarded`',
    '`closed`',
    '`parked`',
    '`blocked_external`',
    '`superseded`',
    '`historical`',
  ]) {
    requireText(metadataStandard, status)
  }

  for (const shelf of [
    '`operating`',
    '`pilot`',
    '`readiness`',
    '`architecture`',
    '`domain`',
    '`evidence`',
    '`historical`',
  ]) {
    requireText(metadataStandard, shelf)
  }
})
