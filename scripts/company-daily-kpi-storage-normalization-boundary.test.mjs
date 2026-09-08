import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'

const workspaceRoot = join(import.meta.dirname, '..')

function readText(path) {
  return readFileSync(join(workspaceRoot, path), 'utf8')
}

function requireText(text, expected) {
  const normalizedText = text.replace(/\s+/g, ' ').trim()
  const normalizedExpected = expected.replace(/\s+/g, ' ').trim()
  assert.ok(
    normalizedText.includes(normalizedExpected),
    `Expected document to contain: ${normalizedExpected}`,
  )
}

const contractPath = 'docs/contracts/company-daily-kpi-storage-normalization-boundary-v1.md'
const contract = readText(contractPath)
const sourceContract = readText('docs/contracts/company-daily-kpi-pull-contract-v1.md')
const intake = readText('docs/plans/real-ingest-connector-contract-intake.md')
const currentState = readText('current-state.md')
const schema = readText('db/schema.sql')
const materializationRepository = readText(
  'backend/nestjs/src/modules/integration/infrastructure/kpi-materialization.repository.ts',
)
const normalizationService = readText(
  'backend/nestjs/src/modules/integration/application/kpi-import-normalization.service.ts',
)

test('storage boundary has mandatory sections and requirement traceability', () => {
  for (const section of [
    '## Context',
    '## Functional Requirements',
    '## Non-Functional Requirements',
    '## Acceptance Criteria',
    '## Edge Cases',
    '## API Contracts',
    '## Data Models',
    '## Out Of Scope',
  ]) {
    requireText(contract, section)
  }

  for (let requirement = 1; requirement <= 19; requirement += 1) {
    requireText(contract, `**FR-${requirement} `)
    assert.match(
      contract.split('## Acceptance Criteria')[1],
      new RegExp(`\\bFR-${requirement}\\b`),
      `FR-${requirement} must be referenced by acceptance criteria`,
    )
  }

  for (let requirement = 1; requirement <= 8; requirement += 1) {
    requireText(contract, `**NFR-${requirement} `)
    assert.match(
      contract.split('## Acceptance Criteria')[1],
      new RegExp(`\\bNFR-${requirement}\\b`),
      `NFR-${requirement} must be referenced by acceptance criteria`,
    )
  }

  for (let criterion = 1; criterion <= 14; criterion += 1) {
    requireText(contract, `**AC-${criterion} `)
  }

  for (let edgeCase = 1; edgeCase <= 10; edgeCase += 1) {
    requireText(contract, `**EC-${edgeCase}:**`)
  }

  for (let exclusion = 1; exclusion <= 7; exclusion += 1) {
    requireText(contract, `**OS-${exclusion}:**`)
  }
})

test('storage boundary records product-owner approval before pure adapter code', () => {
  requireText(contract, 'Status: Approved')
  requireText(contract, 'Reviewers: Product owner (approved 1 September 2026)')
  assert.doesNotMatch(contract, /Status: Draft|Product owner \(pending/i)
})

test('storage boundary records only neutral observed source shapes', () => {
  for (const phrase of [
    'sales lines, store-day footfall totals, store-level GSM consent observations, and an undated store directory',
    'Sales and return invoices have separate ephemeral identifiers',
    'returns arrive with already-negative quantity and TRY amount values',
    'Personnel codes are stable and unique per person.',
    'first pull should run at 02:00 Europe/Istanbul',
    'does not retain or reproduce screenshots, provider-native field names, endpoint addresses, operation identifiers',
  ]) {
    requireText(contract, phrase)
  }

  for (const alias of ['sales', 'footfall', 'gsm', 'store-directory']) {
    requireText(contract, `\`${alias}\``)
  }
})

test('provider rows stop at the in-memory sanitizer privacy boundary', () => {
  for (const phrase of [
    'Provider response rows MAY exist only in bounded adapter memory.',
    'MUST NOT be written to a raw table, file, cache, log, audit event, quarantine record, screenshot, row hash, or batch payload hash.',
    'Every invoice identifier MUST be discarded before output is returned.',
    'Display names and store descriptions MUST be discarded.',
    'raw response bytes, names, invoice identifiers, display descriptions, and private connection details MUST NOT contribute to the digest.',
  ]) {
    requireText(contract, phrase)
  }
})

test('decimal and signed-return rules reject binary Number math', () => {
  for (const phrase of [
    'validated base-10 `DecimalText`',
    'preserve numeric lexemes without binary floating-point arithmetic',
    'Converting provider amounts to JavaScript `Number` before aggregation is forbidden.',
    'Return quantity and amount values are already negative and MUST NOT be negated again.',
    'arbitrary-precision decimal implementation or integer minor-unit strategy with explicit scale',
  ]) {
    requireText(contract, phrase)
  }
})

test('typed component sets own atomic replacement and deterministic digests', () => {
  for (const phrase of [
    'one `SanitizedComponentSet` owned by source + business day + operation alias',
    'deterministic digest of the neutral source code, operation alias, business date, and sorted sanitized aggregate set.',
    'Status, retry count, reason code, timestamps',
    'An unchanged corrected retry MUST therefore keep the same digest.',
    'validate the entire component set before opening its replacement transaction',
    'remove or supersede the prior aggregate set for the same source + day + component',
    'Failure MUST roll back the whole replacement and leave the previous successful set plus every other component unchanged.',
    'Employee sales, store sales, store footfall, and store GSM MUST remain independently replaceable component-owned facts.',
  ]) {
    requireText(contract, phrase)
  }
})

test('employee grain remains store-aware and range cube preserves daily facts', () => {
  for (const phrase of [
    'Employee sales persistence MUST enforce business day + store + personnel uniqueness.',
    'current employee KPI unique key and upsert target omit store and MUST NOT be reused unchanged.',
    'Each accepted business day MUST remain a separate fact.',
    'A later day MUST NOT overwrite an earlier day.',
    'divide summed eligible numerators by summed eligible denominators rather than averaging daily rates.',
  ]) {
    requireText(contract, phrase)
  }
})

test('canonical projection does not create a second scoring path', () => {
  for (const phrase of [
    'shared KPI mapping, validation, lineage, materialization, scoring, snapshot, and reporting path',
    'MUST NOT become a second scoring or ranking source.',
    'existing KPI materialization and scoring remain the only path',
    'The existing Power BI/Excel path remains active through every stage.',
  ]) {
    requireText(contract, phrase)
  }

  requireText(sourceContract, 'The source MUST NOT introduce a separate scoring, ranking, snapshot, or reporting path.')
})

test('repo evidence proves current persistence cannot be reused unchanged', () => {
  requireText(
    schema,
    'ON ops.kpi_actual (kpi_id, employee_id, period_type, period_start, period_end)',
  )
  requireText(
    materializationRepository,
    'ON CONFLICT (kpi_id, employee_id, period_type, period_start, period_end)',
  )
  requireText(normalizationService, 'const normalized = Number(String(value).replace(",", "."));')
  requireText(contract, 'existing employee KPI uniqueness key omits store')
  requireText(contract, 'KPI materialization performs row-by-row upserts')
  requireText(contract, 'generic normalization path uses JavaScript `Number`')
})

test('PR sequence keeps migration and live runtime behind separate approval gates', () => {
  for (const phrase of [
    'PR 1 — this draft and guard',
    'PR 2 — pure adapter',
    'Future migration PR',
    'Future runtime PR',
    'no network, database, scheduler, Docker, or provider-native configuration',
    'include expand/contract DDL, fresh-database smoke, rollback, query compatibility review',
  ]) {
    requireText(contract, phrase)
  }
})

test('runtime schedule is documented without adding a scheduler', () => {
  for (const phrase of [
    'first attempt at 02:00 Europe/Istanbul',
    '02:10, 02:30, 03:00, 04:00, 06:00, 09:00, 12:00, 16:00, 20:00, and 23:00',
    'A future `429` MUST honor `Retry-After`',
    'configuration-class `4xx` MUST stop automatic retries',
    'Scheduling metadata MUST NOT be treated as permission to add the worker in this slice.',
  ]) {
    requireText(contract, phrase)
  }
})

test('handoff and intake preserve the contract boundary around private activation', () => {
  requireText(intake, 'Status: `sample_payload_observed`')
  requireText(intake, contractPath)
  requireText(
    intake,
    'does not authorize live API access, migration, scheduling, Docker runtime changes, deployment, or Excel replacement',
  )
  requireText(currentState, contractPath)
  requireText(currentState, 'The network-free pure adapter, typed daily component storage, and atomic replacement repository are present without projecting into canonical KPI scoring.')
  requireText(currentState, 'Reusable live connector mapping, hosted scheduling, and Excel replacement remain suspended.')
  requireText(currentState, 'The private-server schedule and canonical KPI projection described above are active only for the approved company deployment.')
})

test('public boundary contains no realistic private connection or fixture values', () => {
  assert.doesNotMatch(
    contract,
    /\b(?:10|127|169\.254|172\.(?:1[6-9]|2\d|3[01])|192\.168)(?:\.\d{1,3}){2,3}\b/,
    'contract must not contain a private endpoint address',
  )
  assert.doesNotMatch(
    contract,
    /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/i,
    'contract must not contain a realistic GUID fixture',
  )
  assert.doesNotMatch(contract, /https?:\/\//i, 'contract must not contain an endpoint URL')
})
