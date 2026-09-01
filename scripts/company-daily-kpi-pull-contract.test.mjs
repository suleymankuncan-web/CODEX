import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'

const workspaceRoot = join(import.meta.dirname, '..')

function readText(path) {
  return readFileSync(join(workspaceRoot, path), 'utf8')
}

function requireText(text, phrase) {
  const normalizedText = text.replace(/\s+/g, ' ').trim()
  const normalizedPhrase = phrase.replace(/\s+/g, ' ').trim()
  assert.ok(
    normalizedText.includes(normalizedPhrase),
    `expected document to include: ${normalizedPhrase}`,
  )
}

const contractPath = 'docs/contracts/company-daily-kpi-pull-contract-v1.md'
const contract = readText(contractPath)
const intake = readText('docs/plans/real-ingest-connector-contract-intake.md')
const genericJsonDraft = readText('docs/plans/json-ingestion-contract-v1.md')
const currentState = readText('current-state.md')

function sectionBetween(text, startHeading, endHeading) {
  const start = text.indexOf(startHeading)
  const end = text.indexOf(endHeading, start + startHeading.length)
  assert.notEqual(start, -1, `missing section: ${startHeading}`)
  assert.notEqual(end, -1, `missing section boundary: ${endHeading}`)
  return text.slice(start, end)
}

test('daily pull specification has all mandatory sections and requirement traceability', () => {
  for (const heading of [
    '# Company Daily KPI Pull Contract V1',
    '## Context',
    '## Functional Requirements',
    '## Non-Functional Requirements',
    '## Acceptance Criteria',
    '## Edge Cases',
    '## API Contracts',
    '## Data Models',
    '## Out of Scope',
  ]) {
    requireText(contract, heading)
  }

  const functionalRequirements = sectionBetween(
    contract,
    '## Functional Requirements',
    '## Calculation Rules',
  )
  const nonFunctionalRequirements = sectionBetween(
    contract,
    '## Non-Functional Requirements',
    '## Acceptance Criteria',
  )
  const acceptanceCriteria = sectionBetween(
    contract,
    '## Acceptance Criteria',
    '## Edge Cases',
  )
  const requirementIds = [
    ...functionalRequirements.matchAll(/\*\*(FR-\d+)/g),
    ...nonFunctionalRequirements.matchAll(/\*\*(NFR-\d+)/g),
  ].map((match) => match[1])

  assert.ok(requirementIds.length > 0, 'expected numbered requirements')
  for (const requirementId of requirementIds) {
    assert.match(
      acceptanceCriteria,
      new RegExp(`\\b${requirementId}\\b`),
      `${requirementId} must be referenced by acceptance criteria`,
    )
  }

  for (let edgeCase = 1; edgeCase <= 15; edgeCase += 1) {
    requireText(contract, `**EC-${edgeCase}:**`)
  }
})

test('daily pull public documents record product-owner approval without authorizing runtime', () => {
  requireText(
    contract,
    'Status: Approved — product-owner approval recorded 31 August 2026',
  )
  requireText(contract, 'Reviewers: Product owner (approved 31 August 2026)')
  requireText(contract, 'approved source-semantics boundary')
  requireText(
    currentState,
    'the product owner approved the documented source semantics in `docs/contracts/company-daily-kpi-pull-contract-v1.md` on 31 August 2026',
  )
  requireText(
    intake,
    'The approved source semantics, grains, partial-success behavior, signed sale/return rules, active-store allowlist, missed-day risk, and privacy boundary are locked in `docs/contracts/company-daily-kpi-pull-contract-v1.md`. Product-owner approval was recorded on 31 August 2026.',
  )
  requireText(
    intake,
    'Status: `sample_payload_observed`',
  )
  requireText(
    intake,
    '`sample_payload_observed`: current state; neutral sample shapes and owner-confirmed semantics are recorded, while nullability, error, volume, and runtime details are not proven',
  )
  requireText(
    currentState,
    'Live connector mapping, scheduler, Docker runtime activation, canonical KPI projection, and Excel replacement remain suspended.',
  )
  assert.doesNotMatch(
    contract,
    /Status:\s*Draft|pending product-owner approval|proposed source-semantics boundary/i,
  )
  assert.doesNotMatch(
    currentState,
    /company-daily-kpi-pull-contract-v1\.md` is proposed|pending product-owner approval/i,
  )
  assert.doesNotMatch(
    intake,
    /Status:\s*`contract_draft`|remain pending product-owner approval/i,
  )
})

test('daily pull contract separates previous-day provider reads from local date filters', () => {
  for (const phrase of [
    'previous Europe/Istanbul calendar day',
    'without sending start or end dates',
    'Free start/end date filtering MUST apply only to data already stored in the HR Axis database.',
    'No startDate or endDate is allowed in a provider request.',
    'Historical provider backfill or provider date-range requests.',
  ]) {
    requireText(contract, phrase)
  }
})

test('daily pull contract locks independent sales, footfall, gsm, and conversion grains', () => {
  for (const phrase of [
    'Sales MUST be aggregated at business day + store + personnel grain.',
    'Footfall and GSM MUST be aggregated at business day + store grain.',
    'They MUST NOT be copied onto personnel rows.',
    'Personnel conversion MUST NOT be calculated',
    'Store conversion MUST be produced only from a successful sales aggregate and a successful footfall aggregate for the same business day and store.',
  ]) {
    requireText(contract, phrase)
  }
})

test('daily pull contract locks daily and range conversion and gsm formulas', () => {
  for (const phrase of [
    'salesInvoiceCount(D, S) = distinct InvoiceHeaderID count',
    'where Durum=false for D and S',
    'conversion(D, S) = salesInvoiceCount(D, S) / footfall(D, S)',
    'gsmRate(D, S) = gsmYesCustomerCount(D, S) / gsmTotalCustomerCount(D, S)',
    'conversion(R, S) = sum(salesInvoiceCount(D, S)) / sum(footfall(D, S))',
    'gsmRate(R, S) = sum(gsmYesCustomerCount(D, S)) / sum(gsmTotalCustomerCount(D, S))',
    'A day `D` MAY enter `conversion(R, S)` only when both `sales` and `footfall` succeeded for that same `D` and `S`.',
    'A day `D` MAY enter `gsmRate(R, S)` only when the `gsm` component succeeded for that `D` and `S`, its total customer count is a valid integer greater than zero',
    'Daily percentages MUST NOT be averaged.',
    'Missing or unsuccessful days MUST NOT be treated as zero',
    'the result MUST carry an incomplete-coverage warning',
    'expectedDays: ISODate[]',
    'includedDays: ISODate[]',
    'missingDays: ISODate[]',
    'Store conversion is unavailable when footfall is missing, unsuccessful, or zero.',
    'GSM rate is unavailable when its denominator is missing, unsuccessful, or zero.',
  ]) {
    requireText(contract, phrase)
  }
})

test('daily pull contract uses the existing enabled-store allowlist without directory activation', () => {
  for (const phrase of [
    'already exist in HR Axis and have KPI import enabled',
    'MUST NOT create, reactivate, or enable a store',
    '`store-directory` MAY support reconciliation',
    'MUST NOT be a required component of daily KPI closure',
  ]) {
    requireText(contract, phrase)
  }
})

test('daily pull contract preserves successful components while closure fails closed', () => {
  for (const phrase of [
    '`sales`, `footfall`, and `gsm` MUST each',
    'A missing required component MUST keep daily closure out of `completed` state.',
    'Replacement MUST NOT modify successful outcome sets owned by other components.',
    'GSM MUST be retained as an independent store-day',
    'daily closure MUST be derived separately from component outcomes.',
  ]) {
    requireText(contract, phrase)
  }
})

test('daily pull contract records atomic replacement retry and unrecoverable missed-day risk', () => {
  for (const phrase of [
    'retried idempotently during the same Europe/Istanbul day',
    'the new sanitized aggregate set MUST atomically replace that component\'s previous aggregate set',
    'Old rows absent from the new set MAY be removed',
    'the new set MUST NOT be appended to or added onto the old set',
    'A failed replacement validation MUST leave the prior successful set unchanged.',
    'Other component sets MUST remain untouched',
    'after the provider advances to the next day',
    'The system MUST NOT fabricate, copy forward, or infer a provider day that can no longer be retrieved.',
    'a missed day remains incomplete and no backfill is attempted',
  ]) {
    requireText(contract, phrase)
  }
})

test('daily pull contract locks the required employee sale, return, quantity, and TRY amount set', () => {
  for (const phrase of [
    '`Durum=false` MUST be treated as a sale',
    '`Durum=true` MUST be treated as a return',
    '`InvoiceHeaderID` MUST be counted distinctly',
    'return invoices MUST NOT contribute',
    '`Adet` and `Tutar` MUST be treated as already signed',
    'Return values MUST NOT be negated a second time.',
    'Binary floating-point arithmetic MUST NOT be used',
    'distinct sale invoice count, distinct return invoice count, sale quantity, signed return quantity, net quantity, sale amount, signed return amount, and net amount',
    '`Tutar` is the net line amount and all monetary values are in TRY.',
    'netAmountTry(D, S, P) = salesAmountTry(D, S, P) + signedReturnAmountTry(D, S, P)',
  ]) {
    requireText(contract, phrase)
  }
})

test('daily pull contract permits only non-realistic fixture markers and blocks them at persistence', () => {
  for (const phrase of [
    'Real names and real `InvoiceHeaderID` values MUST NOT appear in fixtures, logs, diagnostics, audit events, quarantine evidence, or database fields.',
    '`invoice-A`, `invoice-B`, and `person-A` MAY be used as unit-test inputs',
    'synthetic invoice identifiers MUST also be absent from persistence-boundary outputs.',
    'GUID-formatted realistic fixture values MUST NOT be used.',
    'Name-based matching MUST NOT be used for this source.',
    'perform no network, secret, database, or real-data access',
  ]) {
    requireText(contract, phrase)
  }

  assert.doesNotMatch(
    contract,
    /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/i,
    'contract fixtures must not contain a realistic GUID value',
  )
})

test('daily pull contract binds source dates to the scheduled Istanbul target day', () => {
  for (const phrase of [
    'Every `sales` and `footfall` source date MUST be converted to a `Europe/Istanbul` business date',
    'A response containing a different date or mixed dates MUST be rejected at component level.',
    'Because `gsm` has no source date, its successfully validated response MUST be assigned the scheduled target day `D`.',
    '`store-directory` is an undated reference source.',
  ]) {
    requireText(contract, phrase)
  }
})

test('daily pull contract gates incompatible employee KPI uniqueness', () => {
  for (const phrase of [
    'If the existing employee KPI uniqueness key omits store',
    'day + store + personnel grain MUST NOT be squeezed into that table',
    'a migration or separate storage decision MUST be reviewed and approved first.',
  ]) {
    requireText(contract, phrase)
  }
})

test('public documents use neutral aliases and keep runtime work parked', () => {
  for (const phrase of [
    'private operation and execution identifiers remain outside Git',
    'provider-native fields, endpoints, or private operation identifiers.',
    'a network-free pure adapter driven only by',
  ]) {
    requireText(intake, phrase)
  }

  requireText(genericJsonDraft, 'is not the selected contract for the company daily pull source')
  requireText(currentState, 'Live connector mapping, scheduler, Docker runtime activation, canonical KPI projection, and Excel replacement remain suspended.')
  for (const alias of ['sales', 'footfall', 'gsm', 'store-directory']) {
    requireText(contract, `\`${alias}\``)
  }
})
