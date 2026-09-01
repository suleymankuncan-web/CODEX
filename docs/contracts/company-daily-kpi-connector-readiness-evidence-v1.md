# Company Daily KPI Connector Readiness Evidence V1

Author: Codex with recorded product-owner context
Date: 1 September 2026
Status: Approved — product-owner approval recorded 1 September 2026
Reviewers: Product owner (approved 1 September 2026)

## Context

The approved company daily KPI pull contract, pure adapter, typed component
storage, and atomic repository are present. They intentionally stop before a
live network client, private operation mapping, scheduler, Docker worker, or
Excel replacement.

The source is available only inside the company network and returns the
previous Europe/Istanbul day. Neutral sample shapes and business semantics are
known, but authentication category, transport acceptance, response/error
envelopes, nullability variants, response volume, latency, timeout budget,
mapping ownership, and alert ownership are not yet approved implementation
inputs.

This contract defines the sanitized evidence required before connector code may
be proposed. It does not contain an evidence instance and does not authorize a
provider call. Private endpoint addresses, private operation identifiers,
credentials, headers, raw bodies, source-native field names, real codes, or
company data remain outside Git.

## Functional Requirements

- **FR-1 Default closed state:** Connector readiness MUST default to
  `not_ready`. Missing, stale, contradictory, or unreviewed evidence MUST NOT be
  interpreted as approval to implement or activate a connector.
- **FR-2 Private evidence boundary:** Provider-native evidence MUST be captured,
  reviewed, and retained only in an approved private location. A public
  readiness summary MAY contain only the bounded categories, counts, byte
  sizes, durations, dates, boolean decisions, safe reason-code names,
  non-personal owner-role aliases, and delivery-channel categories defined by
  this contract.
- **FR-3 Neutral operation aliases:** All public evidence MUST use only
  `sales`, `footfall`, `gsm`, and `store-directory`. Private operation or
  execution identifiers MUST NOT enter Git, logs, test fixtures, or public
  receipts.
- **FR-4 Authentication classification:** Readiness evidence MUST classify the
  authentication mechanism as `none`, `basic`, `bearer`, `api-key`, `cookie`,
  `mutual-tls`, `custom`, or `unknown`. It MUST NOT contain a credential value,
  header value, username, certificate, key, token, cookie, or secret-derived
  digest. `unknown` MUST keep readiness closed. `none` or `custom`
  authentication MUST require a separate security acceptance and
  compensating-control record.
- **FR-5 Transport decision:** Evidence MUST classify transport as `http`,
  `https`, or `unknown`, network scope as `company-private`, and TLS verification
  as `verified`, `not-applicable`, `unverified`, or `unknown`. `unknown` auth,
  transport, or TLS verification MUST remain `not_ready` and MUST NOT be
  overridden by a security acceptance. `http` MUST pair only with
  `not-applicable` TLS verification and MUST require a separate security
  acceptance. `https` MUST pair with `verified` or `unverified` TLS
  verification. `https` plus `unverified` MUST require a separate security
  acceptance. Any other transport and TLS pairing MUST be rejected as
  contradictory evidence.
- **FR-6 Success envelope:** Each operation alias MUST record the observed HTTP
  success status class, content-type category, top-level response shape, empty
  result shape, and whether the response can be parsed without source-native
  details entering diagnostics.
- **FR-7 Failure envelope:** Evidence MUST classify observed or officially
  documented failure behavior using bounded status classes and safe reason
  categories. Raw error bodies, stack traces, provider messages, headers, and
  request fragments MUST NOT be retained in public evidence.
- **FR-8 Nullability and type variants:** Each neutral input field used by the
  pure adapter MUST have an approved `required`, `nullable`, or `absent`
  classification plus its accepted neutral type category. An unclassified field
  or an observed type outside the approved set MUST keep connector readiness
  closed. Operation/field pairs MUST come from the closed neutral-field unions
  in this contract; the evidence MUST classify every pair exactly once.
- **FR-9 Volume and latency observations:** Each operation alias MUST have
  sanitized observations from at least three distinct observation dates. For
  `sales`, `footfall`, and `gsm`, `observationDate` MUST equal the validated
  target business day. Because `store-directory` is an undated reference
  source, its `observationDate` is only the evidence-capture date and MUST NOT
  become a KPI business date. An observation MAY contain only observation date,
  row count, response byte count, request milliseconds, parse milliseconds,
  total component milliseconds, status class, and parse outcome. Business
  values and source identifiers MUST NOT be retained. Only `2xx` observations
  with `parseOutcome` equal to `accepted` or `empty` are eligible for the
  three-date minimum, runtime-budget derivation, or freshness. Failure or
  rejected observations MAY support failure-envelope review but MUST NOT satisfy
  the minimum, set a budget, or refresh evidence age.
- **FR-10 Runtime budgets:** The proposed connector MUST have explicit response
  byte, row-count, request-timeout, parse-time, and total-component-time budgets
  derived only from reviewed eligible sanitized observations. A budget MUST
  remain below the next scheduled retry boundary and MUST fail closed when
  exceeded.
- **FR-11 Rate-limit posture:** Rate-limit knowledge MUST be classified as
  `documented`, `observed`, or `unknown`. `unknown` MUST NOT be treated as
  unlimited access. The existing bounded component-only retry schedule remains
  authoritative, and a future `429` MUST honor a valid `Retry-After` value.
- **FR-12 Mapping ownership:** Evidence MUST identify approved non-personal
  organizational role aliases that own store-code mapping and the KPI-import
  allowlist. An empty, unapproved, or person-like owner value MUST keep connector
  readiness closed.
- **FR-13 Alert ownership:** Evidence MUST identify an approved non-personal
  organizational role alias and one bounded delivery-channel category for
  missed-day, repeated component failure, configuration failure, and
  exhausted-retry alerts. It MUST NOT contain an address, webhook, token, phone
  number, or personal contact.
- **FR-14 Safe reason mapping:** Every approved transport, envelope, validation,
  mapping, budget, and persistence failure MUST map to a bounded public safe
  reason code before connector implementation. Unknown failures MUST map to a
  generic safe code without raw provider material.
- **FR-15 Readiness derivation:** `ready_for_connector_implementation` MAY be
  reached only when every required field is present, all four operation aliases
  have reviewed envelope evidence, every required adapter field is classified,
  minimum observations and budgets exist, mapping and alert owners are known,
  transport/security decisions are approved, and privacy checks pass.
- **FR-16 No activation implication:**
  `ready_for_connector_implementation` authorizes only a separately reviewed,
  default-off implementation PR using a synthetic HTTP server. It MUST NOT imply
  company-server access, credential provisioning, scheduler activation, Docker
  activation, deployment, or source enablement.
- **FR-17 Repository guard:** Repository tests for this contract MUST read only
  tracked public files and synthetic strings. They MUST perform zero network,
  secret, database, Docker, provider, or real-data access.
- **FR-18 Existing path preservation:** Power BI/Excel MUST remain active until
  a later runtime proof, reconciliation window, rollback decision, and explicit
  product-owner cutover approval are complete.

## Non-Functional Requirements

- **NFR-1 Privacy:** Public diff, fixtures, diagnostics, and receipts MUST contain
  zero private endpoint addresses, zero private operation identifiers, zero
  credentials, zero real names/codes, zero raw response fragments, and zero
  realistic GUID fixtures.
- **NFR-2 Determinism:** The same sanitized readiness evidence and explicit
  evaluation date MUST produce the same readiness state, evidence age, and
  ordered missing-gate list.
- **NFR-3 Bounded evidence:** Each per-operation observation MUST contain exactly
  the allowlisted metadata fields and non-negative bounded integers. Additional
  fields MUST be rejected rather than ignored.
- **NFR-4 Evidence freshness:** The owner-reviewed public readiness decision MUST
  record the review date and the conservative complete-evidence date.
  `evidenceCollectedThrough` MUST equal the earliest of each required
  operation's latest eligible observation date, so every required operation is
  fresh through that date. A newer `store-directory` capture MUST NOT make stale
  `sales`, `footfall`, or `gsm` evidence appear fresh. A future implementation
  review MUST revalidate transport, auth category, envelope behavior, and
  budgets when the explicit evaluation date is more than 30 calendar days after
  `evidenceCollectedThrough` or the provider behavior changes. Review date MUST
  NOT reset evidence age.
- **NFR-5 Fail-closed security:** Unknown auth, transport, or TLS verification
  MUST remain `not_ready`. Plain HTTP, unverified TLS, `none` auth, or `custom`
  auth MUST remain `not_ready` until an explicit security acceptance and
  compensating-control record exists outside this contract. Security acceptance
  MUST NOT make an unknown or contradictory classification ready.
- **NFR-6 No performance claim:** This contract MUST NOT claim a production timeout,
  throughput, payload ceiling, or latency SLO before sanitized observations are
  reviewed.
- **NFR-7 Auditability:** A readiness summary MUST expose the readiness state,
  review date, evaluation date, non-negative evidence age in calendar days,
  completed gate names, and missing gate names without exposing private evidence
  values.

## Acceptance Criteria

- **AC-1 (FR-1, FR-15, NFR-2, NFR-4, NFR-7):** Given any required readiness
  field is missing, unknown, stale, contradictory, or unreviewed, when readiness
  is derived for an explicit evaluation date, then the state is `not_ready`,
  evidence age is non-negative, and an ordered safe missing-gate list is
  produced.
- **AC-2 (FR-2, FR-3, FR-17, NFR-1):** Given the public contract and its guard,
  when they are scanned, then only neutral operation aliases and synthetic
  categories exist and no provider call, private identifier, endpoint, secret,
  real value, or realistic GUID exists.
- **AC-3 (FR-4, NFR-5):** Given auth is `unknown` or its evidence includes a
  value-like field, when readiness is evaluated, then it remains `not_ready` and
  the value-like field is rejected. Given auth is `none` or `custom`, readiness
  MUST remain closed until the separate security acceptance exists.
- **AC-4 (FR-5, NFR-5):** Given transport/TLS is unknown or contradictory, when
  readiness is evaluated, then it remains `not_ready` regardless of security
  acceptance. Given `http` plus `not-applicable` or `https` plus `unverified`,
  readiness MUST remain closed until the separate security acceptance exists.
- **AC-5 (FR-6, FR-7, FR-14):** Given every operation has reviewed success and
  failure status/envelope categories, when a future connector maps an error,
  then only a `SafeReasonCode` may cross the diagnostic boundary and no raw body
  or provider message may cross it.
- **AC-6 (FR-8):** Given one closed-union neutral adapter field has no explicit
  approved `NeutralFieldClassification` entry, appears more than once, or an
  unknown operation/field pair is supplied, when readiness is derived, then
  connector implementation remains blocked and no default value is invented.
- **AC-7 (FR-9, FR-10, NFR-3, NFR-4, NFR-6):** Given fewer than three distinct
  eligible observation dates for an alias, a minimum derived from a failure or
  rejected observation, stale evidence for any required operation, or a missing
  explicit byte/row/request/parse/component budget, when readiness is derived,
  then it remains `not_ready` and no performance claim is made.
- **AC-8 (FR-11):** Given rate-limit knowledge is `unknown`, when retry behavior
  is reviewed, then access is not described as unlimited and retries remain on
  the approved bounded component schedule.
- **AC-9 (FR-12, FR-13):** Given mapping or alert ownership is unknown or names a
  person/contact destination, when public evidence is validated, then it is
  rejected and readiness remains `not_ready`.
- **AC-10 (FR-15, FR-16):** Given every readiness gate is complete and approved,
  when the state reaches `ready_for_connector_implementation`, then only a
  default-off synthetic-server implementation PR is allowed; live runtime and
  activation remain separately blocked.
- **AC-11 (FR-17):** Given the contract guard runs locally or in CI, when it
  completes, then it reads tracked text only and performs no network, secret,
  database, Docker, or provider access.
- **AC-12 (FR-18):** Given readiness or connector implementation later succeeds,
  when operating-path status is inspected, then Power BI/Excel remains active
  until a separately approved cutover and rollback decision exists.

## Edge Cases

- **EC-1:** A response is `3xx`, or is `2xx` with an unexpected content type or
  top-level shape: keep readiness closed and classify the unexpected status or
  envelope mismatch.
- **EC-2:** An operation returns an empty result using a different shape than a
  non-empty result: require both shapes to be approved before implementation.
- **EC-3:** A neutral field is absent on one day and null on another: classify
  both variants explicitly; do not invent an empty string or zero.
- **EC-4:** A response exceeds the observed byte or row budget: reject the whole
  component safely; do not partially persist it.
- **EC-5:** A request completes after the next retry boundary: classify the
  attempt as timed out for orchestration purposes and prevent overlapping retry
  ownership.
- **EC-6:** A `429` has no valid `Retry-After`: use only the approved bounded
  schedule and never create an unbounded retry loop.
- **EC-7:** A status/error category changes after approval: invalidate readiness
  until the evidence and safe mapping are reviewed again.
- **EC-8:** Store mapping ownership is known but the allowlist source is not:
  keep readiness closed and do not activate or create stores from directory
  data.
- **EC-9:** Alert delivery is configured but no owning role exists: keep
  readiness closed because escalation ownership is incomplete.
- **EC-10:** A private evidence document contains a raw body, endpoint, header,
  or credential: do not copy or summarize the sensitive value into Git; record
  only the failed privacy gate outside the repository.

## API Contracts

These are public neutral metadata contracts. They are not provider request or
response types and MUST NOT contain provider-native keys.

```ts
type SourceOperationAlias = 'sales' | 'footfall' | 'gsm' | 'store-directory'
type ReadinessState = 'not_ready' | 'ready_for_connector_implementation'
type AuthCategory =
  | 'none'
  | 'basic'
  | 'bearer'
  | 'api-key'
  | 'cookie'
  | 'mutual-tls'
  | 'custom'
  | 'unknown'
type TransportCategory = 'http' | 'https' | 'unknown'
type TlsVerification = 'verified' | 'not-applicable' | 'unverified' | 'unknown'
type RateLimitKnowledge = 'documented' | 'observed' | 'unknown'
type NeutralFieldPresence = 'required' | 'nullable' | 'absent'
type NeutralFieldType = 'string' | 'boolean' | 'integer' | 'decimal-text' | 'date'
type SalesNeutralFieldAlias =
  | 'sourceDateToken'
  | 'ephemeralInvoiceId'
  | 'personnelCode'
  | 'displayName'
  | 'storeCode'
  | 'isReturn'
  | 'quantity'
  | 'amountTry'
type FootfallNeutralFieldAlias = 'sourceDateToken' | 'storeCode' | 'total'
type GsmNeutralFieldAlias = 'storeCode' | 'consent'
type StoreDirectoryNeutralFieldAlias = 'storeCode' | 'displayDescription'
type AlertChannelCategory = 'email' | 'chat' | 'incident-system' | 'other' | 'unknown'
type FailureStatusClass =
  | '3xx'
  | '4xx'
  | '5xx'
  | 'timeout'
  | 'connection-failure'
  | 'unknown'
type SafeReasonCode =
  | 'transport_failure'
  | 'timeout'
  | 'unexpected_status'
  | 'content_type_mismatch'
  | 'envelope_mismatch'
  | 'validation_failed'
  | 'budget_exceeded'
  | 'mapping_missing'
  | 'persistence_failed'
  | 'unknown_failure'

interface SanitizedOperationObservation {
  observationDate: string // YYYY-MM-DD only; semantics are defined by FR-9
  rowCount: number // non-negative integer
  responseBytes: number // non-negative integer
  requestElapsedMs: number // non-negative integer
  parseElapsedMs: number // non-negative integer
  totalComponentElapsedMs: number // non-negative integer
  statusClass:
    | '2xx'
    | '3xx'
    | '4xx'
    | '5xx'
    | 'timeout'
    | 'connection-failure'
  parseOutcome: 'accepted' | 'empty' | 'rejected'
}

interface SanitizedOperationEvidence {
  operation: SourceOperationAlias
  successStatusClass: '2xx' | 'unknown'
  contentType: 'application/json' | 'other' | 'unknown'
  topLevelShape: 'array' | 'object' | 'unknown'
  emptyResultShape: 'empty-array' | 'empty-object' | 'no-content' | 'unknown'
  failureStatusClasses: FailureStatusClass[]
  safeFailureCategories: SafeReasonCode[]
  observations: SanitizedOperationObservation[]
}

interface NeutralFieldRule {
  presence: NeutralFieldPresence
  acceptedTypes: NeutralFieldType[]
}

type NeutralFieldClassification =
  | (NeutralFieldRule & {
      operation: 'sales'
      fieldAlias: SalesNeutralFieldAlias
    })
  | (NeutralFieldRule & {
      operation: 'footfall'
      fieldAlias: FootfallNeutralFieldAlias
    })
  | (NeutralFieldRule & {
      operation: 'gsm'
      fieldAlias: GsmNeutralFieldAlias
    })
  | (NeutralFieldRule & {
      operation: 'store-directory'
      fieldAlias: StoreDirectoryNeutralFieldAlias
    })

interface OperationRuntimeBudget {
  operation: SourceOperationAlias
  maxRows: number // positive integer
  maxResponseBytes: number // positive integer
  requestTimeoutMs: number // positive integer
  parseTimeoutMs: number // positive integer
  totalComponentTimeoutMs: number // positive integer below retry boundary
}

interface SanitizedOwnershipEvidence {
  storeMappingOwnerRole: string // approved non-personal role alias
  allowlistOwnerRole: string // approved non-personal role alias
  alertOwnerRole: string // approved non-personal role alias
  alertChannelCategory: AlertChannelCategory
}

interface ConnectorReadinessEvidence {
  schemaVersion: 1
  dataClass: 'sanitized-metadata'
  networkScope: 'company-private'
  authCategory: AuthCategory
  transport: TransportCategory
  tlsVerification: TlsVerification
  securityAcceptanceRecorded: boolean
  rateLimitKnowledge: RateLimitKnowledge
  operationEvidence: SanitizedOperationEvidence[]
  neutralFieldClassifications: NeutralFieldClassification[]
  runtimeBudgets: OperationRuntimeBudget[]
  ownership: SanitizedOwnershipEvidence
  privacyReviewPassed: boolean
  // Earliest of each required operation's latest eligible observationDate.
  evidenceCollectedThrough: string
  reviewedAt: string // YYYY-MM-DD
}

interface ConnectorReadinessSummary {
  state: ReadinessState
  evidenceCollectedThrough: string
  reviewedAt: string
  evaluatedAt: string
  evidenceAgeDays: number // non-negative integer
  completedGates: string[]
  missingGates: string[]
}
```

The future validator MUST reject unknown object keys, non-integer observation or
budget counts, negative observation values, non-positive budgets, budgets that
reach the next retry boundary, duplicate operation entries, duplicate
observation dates within an operation, duplicate neutral field entries,
  incomplete operation budgets, a minimum or budget derived from an ineligible
  observation, non-neutral aliases, an operation/field pair outside the closed
  neutral-field union, value-like authentication or
ownership fields, personal/contact-like ownership values, unknown alert channel
categories, inconsistent request/parse/total component timings, an
  `evidenceCollectedThrough` value that differs from the earliest of each
  required operation's latest eligible observation date,
or any evidence/review/evaluation date ordering that would produce a negative
age. Any field that could carry a private endpoint or raw response MUST also be
rejected.

## Data Models

| Model | Persistence location | Required content | Forbidden content |
| --- | --- | --- | --- |
| Private source evidence | Approved private company location, outside Git | Provider-native proof needed for review | Copy into public repository |
| Sanitized operation observation | Private review input; optional bounded public summary only after approval | Alias, date, counts, bytes, request/parse/total times, status class, parse outcome | Business values, raw rows, provider keys, endpoint, headers |
| Readiness decision | Public contract/status after owner approval | State, review date, completed and missing gate names | Secret or private evidence values |
| Future connector configuration | Private runtime configuration only | Private mapping and secret references | Credential values in Git or logs |

No database migration is authorized by this contract. Evidence instances MUST
NOT be written into application KPI, audit, import, component, or raw-payload
tables.

## Out Of Scope

- **OS-1:** Live provider calls, private endpoint access, credential inspection,
  or company-server execution.
- **OS-2:** Provider-native operation mappings, request builders, auth headers,
  cookies, certificates, or secret provisioning.
- **OS-3:** Network connector implementation, HTTP client code, scheduler,
  worker, queue, Docker Compose, deployment, or source activation.
- **OS-4:** New migration, repository write, canonical KPI projection, scoring,
  ranking, snapshot, target, checklist, or report behavior.
- **OS-5:** Raw response capture, payload retention, quarantine storage, or
  company-data fixtures.
- **OS-6:** Invented timeout, volume, rate-limit, or latency claims.
- **OS-7:** Excel/Power BI removal or cutover.
- **OS-8:** Production or broad-pilot approval.

## Implementation Gates And Sequence

1. **Readiness contract PR:** review this approved contract and its
   tracked-text-only guard.
   No evidence instance, network code, secret, database, scheduler, or Docker
   change is included.
2. **Private evidence capture:** only from the company network in a separately
   authorized session. Keep endpoint, auth material, provider-native envelopes,
   and raw responses outside Git. Produce only the sanitized categories required
   by this contract for owner review.
3. **Connector implementation PR:** only after this contract and a complete
   sanitized readiness decision are approved. Use a local synthetic HTTP server,
   default-off configuration, bounded budgets, safe error mapping, and zero live
   provider access in CI.
4. **Private runtime proof:** only after connector review. Provision secrets and
   private operation mapping outside Git, run a controlled read-only proof, and
   reconcile sanitized aggregates against the existing Excel path.
5. **Scheduler/Docker activation:** only after separate product-owner and IT
   approval, alert ownership, missed-day runbook, rollback proof, and a successful
   reconciliation window.

The existing Power BI/Excel path remains active throughout this sequence.
