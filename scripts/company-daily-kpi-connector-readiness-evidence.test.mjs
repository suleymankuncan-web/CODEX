import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'

const workspaceRoot = join(import.meta.dirname, '..')

function readText(path) {
  return readFileSync(join(workspaceRoot, path), 'utf8')
}

const privateEndpointPatterns = [
  /\b(?:10|127|169\.254|172\.(?:1[6-9]|2\d|3[01])|192\.168)(?:\.\d{1,3}){2,3}\b/,
  /(?:^|[^0-9a-f])(?:f[cd][0-9a-f]{2}|fe[89ab][0-9a-f]):[0-9a-f:]+(?:$|[^0-9a-f])/i,
  /(?:^|[^0-9a-f])::1(?:$|[^0-9a-f])/i,
  /\blocalhost(?::\d+)?\b/i,
  /\b(?:[a-z0-9-]+\.)+(?:internal|local|lan|corp|private)(?::\d+)?\b/i,
]

function containsPrivateEndpoint(value) {
  return privateEndpointPatterns.some((pattern) => pattern.test(value))
}

function requireText(text, expected) {
  const normalizedText = text.replace(/\s+/g, ' ').trim()
  const normalizedExpected = expected.replace(/\s+/g, ' ').trim()
  assert.ok(
    normalizedText.includes(normalizedExpected),
    `Expected document to contain: ${normalizedExpected}`,
  )
}

const contractPath =
  'docs/contracts/company-daily-kpi-connector-readiness-evidence-v1.md'
const contract = readText(contractPath)
const pullContract = readText(
  'docs/contracts/company-daily-kpi-pull-contract-v1.md',
)
const storageContract = readText(
  'docs/contracts/company-daily-kpi-storage-normalization-boundary-v1.md',
)
const intake = readText('docs/plans/real-ingest-connector-contract-intake.md')
const currentState = readText('current-state.md')

test('readiness evidence contract is traceable and product-owner approved', () => {
  for (const section of [
    '## Context',
    '## Functional Requirements',
    '## Non-Functional Requirements',
    '## Acceptance Criteria',
    '## Edge Cases',
    '## API Contracts',
    '## Data Models',
    '## Out Of Scope',
    '## Implementation Gates And Sequence',
  ]) {
    requireText(contract, section)
  }

  const acceptanceCriteria = contract.split('## Acceptance Criteria')[1]

  for (let requirement = 1; requirement <= 18; requirement += 1) {
    requireText(contract, `**FR-${requirement} `)
    assert.match(
      acceptanceCriteria,
      new RegExp(`\\bFR-${requirement}\\b`),
      `FR-${requirement} must be referenced by acceptance criteria`,
    )
  }

  for (let requirement = 1; requirement <= 7; requirement += 1) {
    requireText(contract, `**NFR-${requirement} `)
    assert.match(
      acceptanceCriteria,
      new RegExp(`\\bNFR-${requirement}\\b`),
      `NFR-${requirement} must be referenced by acceptance criteria`,
    )
  }

  for (let criterion = 1; criterion <= 12; criterion += 1) {
    requireText(contract, `**AC-${criterion} `)
  }

  for (let edgeCase = 1; edgeCase <= 10; edgeCase += 1) {
    requireText(contract, `**EC-${edgeCase}:**`)
  }

  for (let exclusion = 1; exclusion <= 8; exclusion += 1) {
    requireText(contract, `**OS-${exclusion}:**`)
  }

  requireText(
    contract,
    'Status: Approved — product-owner approval recorded 1 September 2026',
  )
  requireText(contract, 'Reviewers: Product owner (approved 1 September 2026)')
  assert.doesNotMatch(contract, /Status: Draft|Product owner \(pending\)/i)
})

test('readiness defaults closed and approval authorizes no runtime activation', () => {
  for (const phrase of [
    '`not_ready`',
    '`ready_for_connector_implementation`',
    'authorizes only a separately reviewed, default-off implementation PR using a synthetic HTTP server',
    'MUST NOT imply company-server access, credential provisioning, scheduler activation, Docker activation, deployment, or source enablement',
  ]) {
    requireText(contract, phrase)
  }
})

test('public evidence uses only neutral operation aliases and metadata', () => {
  for (const alias of ['sales', 'footfall', 'gsm', 'store-directory']) {
    requireText(contract, `\`${alias}\``)
  }

  for (const phrase of [
    'Provider-native evidence MUST be captured, reviewed, and retained only in an approved private location.',
    'counts, byte sizes, durations, dates, boolean decisions, safe reason-code names, non-personal owner-role aliases, and delivery-channel categories',
    'Private operation or execution identifiers MUST NOT enter Git, logs, test fixtures, or public receipts.',
  ]) {
    requireText(contract, phrase)
  }
})

test('auth and transport remain fail closed without secret-bearing fields', () => {
  for (const category of [
    'none',
    'basic',
    'bearer',
    'api-key',
    'cookie',
    'mutual-tls',
    'custom',
    'unknown',
  ]) {
    requireText(contract, `\`${category}\``)
  }

  for (const phrase of [
    'transport as `http`, `https`, or `unknown`',
    'network scope as `company-private`',
    'MUST require a separate security acceptance and compensating-control record',
    'It MUST NOT contain a credential value, header value, username, certificate, key, token, cookie, or secret-derived digest.',
  ]) {
    requireText(contract, phrase)
  }
})

test('auth and transport compatibility cannot bypass security acceptance', () => {
  for (const phrase of [
    '`unknown` auth, transport, or TLS verification MUST remain `not_ready` and MUST NOT be overridden by a security acceptance',
    '`none` or `custom` authentication MUST require a separate security acceptance and compensating-control record',
    '`http` MUST pair only with `not-applicable` TLS verification and MUST require a separate security acceptance',
    '`https` MUST pair with `verified` or `unverified` TLS verification',
    '`https` plus `unverified` MUST require a separate security acceptance',
    'Any other transport and TLS pairing MUST be rejected as contradictory evidence.',
  ]) {
    requireText(contract, phrase)
  }
})

test('envelope, nullability, observation, and budget gates are explicit', () => {
  for (const phrase of [
    'success status class, content-type category, top-level response shape, empty result shape',
    'Raw error bodies, stack traces, provider messages, headers, and request fragments MUST NOT be retained',
    '`required`, `nullable`, or `absent`',
    'at least three distinct observation dates',
    '`store-directory` is an undated reference source',
    '`observationDate` is only the evidence-capture date and MUST NOT become a KPI business date',
    'request milliseconds, parse milliseconds, total component milliseconds',
    'response byte, row-count, request-timeout, parse-time, and total-component-time budgets',
    'type NeutralFieldClassification =',
    'interface OperationRuntimeBudget',
  ]) {
    requireText(contract, phrase)
  }
})

test('only successful observations establish budgets and freshness', () => {
  for (const phrase of [
    'Only `2xx` observations with `parseOutcome` equal to `accepted` or `empty` are eligible for the three-date minimum, runtime-budget derivation, or freshness.',
    'Failure or rejected observations MAY support failure-envelope review but MUST NOT satisfy the minimum, set a budget, or refresh evidence age.',
    '`evidenceCollectedThrough` MUST equal the earliest of each required operation\'s latest eligible observation date',
    'A newer `store-directory` capture MUST NOT make stale `sales`, `footfall`, or `gsm` evidence appear fresh.',
  ]) {
    requireText(contract, phrase)
  }
})

test('neutral field classifications are closed over the pure adapter input', () => {
  for (const phrase of [
    "type SalesNeutralFieldAlias =",
    "| 'sourceDateToken'",
    "| 'ephemeralInvoiceId'",
    "| 'personnelCode'",
    "| 'displayName'",
    "| 'storeCode'",
    "| 'isReturn'",
    "| 'quantity'",
    "| 'amountTry'",
    "type FootfallNeutralFieldAlias = 'sourceDateToken' | 'storeCode' | 'total'",
    "type GsmNeutralFieldAlias = 'storeCode' | 'consent'",
    "type StoreDirectoryNeutralFieldAlias = 'storeCode' | 'displayDescription'",
    'type NeutralFieldClassification =',
    'an operation/field pair outside the closed neutral-field union',
  ]) {
    requireText(contract, phrase)
  }
})

test('unknown rate limits never become unlimited retry permission', () => {
  for (const phrase of [
    'Rate-limit knowledge MUST be classified as `documented`, `observed`, or `unknown`.',
    '`unknown` MUST NOT be treated as unlimited access.',
    'bounded component-only retry schedule remains authoritative',
    'a future `429` MUST honor a valid `Retry-After` value',
  ]) {
    requireText(contract, phrase)
  }
})

test('mapping and alert ownership require roles without contact destinations', () => {
  for (const phrase of [
    'approved non-personal organizational role aliases that own store-code mapping and the KPI-import allowlist',
    'an approved non-personal organizational role alias and one bounded delivery-channel category',
    'It MUST NOT contain an address, webhook, token, phone number, or personal contact.',
    'interface SanitizedOwnershipEvidence',
  ]) {
    requireText(contract, phrase)
  }
})

test('future validator is strict and public guards stay tracked-text-only', () => {
  for (const phrase of [
    'reject unknown object keys',
    'non-integer observation or budget counts',
    'duplicate operation entries',
    'duplicate observation dates within an operation',
    'duplicate neutral field entries',
    'incomplete operation budgets',
    'value-like authentication or ownership fields',
    'inconsistent request/parse/total component timings',
    '`evidenceCollectedThrough` value that differs from the earliest of each required operation\'s latest eligible observation date',
    'Repository tests for this contract MUST read only tracked public files and synthetic strings.',
    'zero network, secret, database, Docker, provider, or real-data access',
  ]) {
    requireText(contract, phrase)
  }
})

test('summary exposes deterministic freshness and safe reason codes', () => {
  for (const phrase of [
    'explicit evaluation date',
    'evidence age in calendar days',
    'Review date MUST NOT reset evidence age.',
    'type SafeReasonCode',
    'failureStatusClasses: FailureStatusClass[]',
    "| '3xx'",
    'requestElapsedMs: number',
    'parseElapsedMs: number',
    'totalComponentElapsedMs: number',
    'evidenceCollectedThrough: string',
    'evaluatedAt: string',
    'evidenceAgeDays: number',
  ]) {
    requireText(contract, phrase)
  }
})

test('implementation sequence preserves private evidence and Excel rollback', () => {
  for (const phrase of [
    'Readiness contract PR',
    'Private evidence capture',
    'Connector implementation PR',
    'Private runtime proof',
    'Scheduler/Docker activation',
    'The existing Power BI/Excel path remains active throughout this sequence.',
  ]) {
    requireText(contract, phrase)
  }
})

test('approved source and storage contracts remain authoritative', () => {
  requireText(pullContract, 'Status: Approved')
  requireText(storageContract, 'Status: Approved')
  requireText(
    pullContract,
    'The source MUST NOT introduce a separate scoring, ranking, snapshot, or reporting path.',
  )
  requireText(
    storageContract,
    'The existing Power BI/Excel path remains active through every stage.',
  )
})

test('intake and current state record approval without enabling runtime', () => {
  requireText(intake, contractPath)
  requireText(intake, 'Status: `sample_payload_observed`')
  requireText(
    intake,
    'Live connector implementation remains blocked until a complete sanitized readiness decision is separately approved.',
  )
  requireText(currentState, contractPath)
  requireText(
    currentState,
    'The connector readiness evidence contract is approved; it defines evidence collection requirements but contains no evidence instance.',
  )
  requireText(
    currentState,
    'Live connector mapping, scheduler, Docker runtime activation, canonical KPI projection, and Excel replacement remain suspended.',
  )
})

test('public readiness files contain no private endpoint or realistic fixture', () => {
  const publicReadinessText = [contract, intake, currentState].join('\n')

  assert.equal(
    containsPrivateEndpoint(publicReadinessText),
    false,
    'public readiness files must not contain a private endpoint address or hostname',
  )
  assert.doesNotMatch(
    publicReadinessText,
    /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/i,
    'public readiness files must not contain a realistic GUID fixture',
  )
  assert.doesNotMatch(
    publicReadinessText,
    /https?:\/\/[^\s)`]+/i,
    'public readiness files must not contain an endpoint URL',
  )
  assert.doesNotMatch(
    publicReadinessText,
    /(?:api[-_ ]?key|authorization|password|secret|token)\s*[:=]\s*["'][^"']+["']/i,
    'public readiness files must not contain a credential assignment',
  )
})

test('endpoint privacy guard recognizes private address families and hostnames', () => {
  for (const candidate of [
    ['192', '168', '10', '4'].join('.'),
    ['fd12', '3456', '789a', '', '1'].join(':'),
    ['fe80', '', '1'].join(':'),
    ['', '', '1'].join(':'),
    `${['local', 'host'].join('')}:${['19', '95'].join('')}`,
    ['connector', 'company', 'internal'].join('.'),
    ['kpi-source', 'local'].join('.'),
  ]) {
    assert.equal(
      containsPrivateEndpoint(candidate),
      true,
      `expected private endpoint pattern to match: ${candidate}`,
    )
  }
})
