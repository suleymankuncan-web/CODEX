# Company Daily KPI Storage And Normalization Boundary V1

Author: Codex with product-owner input
Date: 31 August 2026
Status: Approved
Reviewers: Product owner (approved 1 September 2026)

## Context

The approved company daily KPI pull contract defines the source semantics, but
the current persistence path cannot implement those semantics unchanged. The
existing employee KPI uniqueness key omits store, KPI materialization performs
row-by-row upserts, and the generic normalization path uses JavaScript `Number`
for metric values before persisting a JSON payload. Those behaviors do not prove
day + store + personnel grain, component-set replacement, decimal-safe money, or
the source-specific privacy boundary.

The product owner has confirmed a company-network pull source that returns only
the preceding Europe/Istanbul day. Sanitized observations establish four neutral
input shapes: sales lines, store-day footfall totals, store-level GSM consent
observations, and an undated store directory. Sales and return invoices have
separate ephemeral identifiers; returns arrive with already-negative quantity
and TRY amount values. Personnel codes are stable and unique per person. The
first pull should run at 02:00 Europe/Istanbul from an on-prem Docker worker.

The observed evidence contained real company values and private connection
details. This public contract records only neutral aliases and behavior. It does
not retain or reproduce screenshots, provider-native field names, endpoint
addresses, operation identifiers, real codes, names, invoice identifiers, or
store descriptions.

This slice selects a proposed storage and normalization boundary for review. It
does not add a migration, repository, live API client, scheduler, Docker runtime
change, credential, deployment, or replacement of the Power BI/Excel path.

## Proposed Boundary Flow

```text
private runtime configuration
  -> in-memory provider decoder
  -> pure sanitizer and aggregate builder
  -> sanitized component set
  -> future atomic component-set transaction
  -> canonical KPI import/materialization boundary
  -> existing scoring, snapshot, ranking, and reporting paths
```

Provider rows MUST NOT cross the in-memory sanitizer boundary. Only sanitized,
typed daily aggregates may reach future persistence.

## Functional Requirements

- **FR-1 Neutral public contract:** Public code, documents, logs, and fixtures
  MUST use the aliases `sales`, `footfall`, `gsm`, and `store-directory`.
  Provider-native field names, endpoint addresses, private operation identifiers,
  and private execution identifiers MUST remain outside Git.
- **FR-2 Ephemeral source rows:** Provider response rows MAY exist only in
  bounded adapter memory. A provider response body MUST NOT be written to a raw
  table, file, cache, log, audit event, quarantine record, screenshot, row hash,
  or batch payload hash.
- **FR-3 Neutral observed shapes:** The pure adapter boundary MUST model sales
  lines with source date, ephemeral invoice identifier, personnel code, optional
  display name, store code, sale/return flag, quantity decimal text, and TRY
  amount decimal text. It MUST model footfall as source date + store code +
  integer total, GSM as store code + consent value, and store directory as store
  code + optional display description.
- **FR-4 Date binding:** Sales and footfall dates MUST be decoded and validated
  against the scheduled preceding Europe/Istanbul day. Mixed or mismatched dates
  MUST reject the entire component. GSM MUST receive the scheduled target day;
  store-directory remains undated reference data.
- **FR-5 Decimal-safe input:** Quantity and TRY amount values MUST enter the
  aggregate builder as validated base-10 `DecimalText`. The live decoder MUST
  preserve numeric lexemes without binary floating-point arithmetic. Converting
  provider amounts to JavaScript `Number` before aggregation is forbidden.
- **FR-6 Signed returns:** Sale rows and return rows MUST be accumulated
  separately. Return quantity and amount values are already negative and MUST
  NOT be negated again. Net values MUST be decimal-safe sums of sale and signed
  return values.
- **FR-7 Distinct invoice scopes:** Ephemeral invoice identifiers MAY be used in
  memory to calculate distinct sale and return invoice counts. Employee counts
  MUST use day + store + personnel scope. Store sale invoice count MUST be
  recomputed at day + store scope and MUST NOT be obtained by summing personnel
  counts. Every invoice identifier MUST be discarded before output is returned.
- **FR-8 Typed sanitized outputs:** The adapter MUST return typed employee sales,
  store sales, store footfall, store GSM, and optional directory reconciliation
  aggregates. It MUST NOT return a generic provider payload or a bag of raw
  fields.
- **FR-9 Code-only identity:** Sanitized aggregates MUST contain only stable
  store and personnel codes at the adapter boundary. Display names and store
  descriptions MUST be discarded. Missing personnel code MUST reject the
  affected personnel sales row without retaining a fallback name.
- **FR-10 Allowlist before acceptance:** Future persistence MUST resolve codes
  through approved exact mappings and MUST accept aggregates only for existing,
  active, KPI-import-enabled stores. Directory rows MUST NOT create, activate,
  or enable master data.
- **FR-11 Component-set ownership:** Every required component result MUST be
  represented as one `SanitizedComponentSet` owned by source + business day +
  operation alias. The set MUST include status, aggregate count, retry count,
  and an optional bounded safe reason code. It MUST NOT include provider rows or
  provider-derived identifiers.
- **FR-12 Sanitized set digest:** Idempotency and replacement comparison MUST use
  a deterministic digest of the neutral source code, operation alias, business
  date, and sorted sanitized aggregate set. Status, retry count, reason code,
  timestamps, raw response bytes, names, invoice identifiers, display
  descriptions, and private connection details MUST NOT contribute to the
  digest. An unchanged corrected retry MUST therefore keep the same digest.
- **FR-13 Atomic replacement:** A future successful write MUST validate the
  entire component set before opening its replacement transaction. Within one
  transaction it MUST remove or supersede the prior aggregate set for the same
  source + day + component, write the complete new set, and record the successful
  outcome. Failure MUST roll back the whole replacement and leave the previous
  successful set plus every other component unchanged.
- **FR-14 Typed daily persistence:** Future storage MUST use typed sanitized
  daily aggregate models rather than persisting provider payload JSON. Employee
  sales, store sales, store footfall, and store GSM MUST remain independently
  replaceable component-owned facts.
- **FR-15 Store-aware employee grain:** Employee sales persistence MUST enforce
  business day + store + personnel uniqueness. The current employee KPI unique
  key and upsert target omit store and MUST NOT be reused unchanged. Any future
  canonical materialization migration MUST preserve legacy rows and explicitly
  support store-aware employee rows before this source writes data.
- **FR-16 Canonical projection:** Accepted daily aggregates MUST be projected
  through the shared KPI mapping, validation, lineage, materialization, scoring,
  snapshot, and reporting path. The component-set layer MUST NOT become a second
  scoring or ranking source.
- **FR-17 Daily cube:** Each accepted business day MUST remain a separate fact.
  A later day MUST NOT overwrite an earlier day. Range totals MUST sum eligible
  daily facts, and range conversion/GSM rates MUST divide summed eligible
  numerators by summed eligible denominators rather than averaging daily rates.
- **FR-18 Runtime schedule contract:** A future on-prem Docker worker SHOULD make
  its first attempt at 02:00 Europe/Istanbul. Only failed components SHOULD be
  retried at 02:10, 02:30, 03:00, 04:00, 06:00, 09:00, 12:00, 16:00, 20:00,
  and 23:00 while the provider still exposes the target day. A future `429` MUST
  honor `Retry-After`; a bounded `5xx`, timeout, or connection failure MAY follow
  the backoff; a configuration-class `4xx` MUST stop automatic retries and raise
  a safe operational outcome. Scheduling metadata MUST NOT be treated as
  permission to add the worker in this slice.
- **FR-19 Evidence status:** Sanitized visual observations establish an observed
  sample shape, not a fully validated provider contract. Error envelopes,
  nullability outside observed rows, maximum volume, response latency, store
  mapping ownership, transport acceptance, and alert ownership remain gates.

## Non-Functional Requirements

- **NFR-1 Privacy:** Persistent, diagnostic, and test outputs MUST contain zero
  real names, invoice identifiers, store descriptions, private endpoints, or
  provider payload fragments.
- **NFR-2 Atomicity:** One component replacement MUST be all-or-nothing and MUST
  not lock or mutate another component's accepted set beyond the minimum shared
  daily-closure recomputation.
- **NFR-3 Determinism:** Equivalent sanitized inputs in any row order MUST produce
  byte-equivalent sorted aggregate outputs and the same sanitized set digest.
- **NFR-4 Decimal correctness:** Quantity and TRY amount aggregation MUST use an
  arbitrary-precision decimal implementation or integer minor-unit strategy with
  explicit scale. Binary floating-point accumulation is prohibited.
- **NFR-5 Auditability:** Outcomes MAY retain source alias, target day, status,
  aggregate count, retry count, safe reason code, sanitized set digest, and
  timestamps. They MUST NOT retain provider evidence fields.
- **NFR-6 Performance:** N/A for this draft. No throughput or timeout claim may
  be approved until sanitized daily row counts, payload sizes, and response
  latency are measured.
- **NFR-7 Security:** The future worker MUST run inside the company network with
  private configuration injected at runtime. Public ingress is forbidden. The
  internal HTTP/TLS decision and compensating network controls require separate
  review before activation.
- **NFR-8 Rollback:** PR 2 pure-adapter code MUST be removable without a database
  rollback. Any later schema migration MUST have its own expand/contract and
  rollback proof.

## Acceptance Criteria

- **AC-1 (FR-2, FR-7, FR-9, NFR-1):** Given synthetic source rows containing
  `invoice-A`, `person-A`, and a display label, when the adapter returns a
  sanitized component set, then no invoice marker, display label, or digest
  derived from either value exists in the output.
- **AC-2 (FR-4):** Given sales or footfall rows with mixed or mismatched target
  dates, when the component is normalized, then the entire component fails with
  a safe reason and returns no accepted aggregate set.
- **AC-3 (FR-5, FR-6, NFR-4):** Given decimal sale values and already-negative
  return values, when employee totals are produced, then sale, signed return,
  and net values are exact base-10 results and no second sign inversion occurs.
- **AC-4 (FR-7):** Given repeated invoice lines and one invoice observed across
  more than one personnel grouping in the same store, when counts are produced,
  then employee and store distinct counts are calculated at their own scopes and
  invoice identifiers are absent from output.
- **AC-5 (FR-3, FR-8, FR-11, NFR-5):** Given valid synthetic rows for each required component,
  when normalized, then each operation produces one typed, independently owned
  `SanitizedComponentSet` with only sanitized aggregates and safe metadata.
- **AC-6 (FR-12, NFR-3):** Given equivalent sanitized aggregates in different
  row orders, when set digests are calculated, then outputs and digests match;
  changing a sanitized metric changes the digest.
- **AC-7 (FR-13, NFR-2):** Given a prior successful component set and a corrected
  valid set, when future persistence replaces it, then stale rows disappear,
  other components remain unchanged, and a failed write restores the prior set.
- **AC-8 (FR-14, FR-15):** Given an employee appearing under two stores on one
  day, when the future schema is evaluated, then both day + store + personnel
  facts can coexist and the current store-omitting conflict target is rejected.
- **AC-9 (FR-16):** Given accepted component facts, when canonical projection is
  designed, then existing KPI materialization and scoring remain the only path
  to score, snapshot, ranking, and reporting behavior.
- **AC-10 (FR-17):** Given three complete synthetic days, when a range is read,
  then all three daily facts remain present, totals equal the sum of daily facts,
  and conversion/GSM use ratios of eligible sums rather than averages of rates.
- **AC-11 (FR-1, FR-18, NFR-1, NFR-7):** Given this contract PR, when the diff is inspected,
  then it contains no live client, scheduler, Docker runtime change, endpoint,
  credential, provider identifier, or public ingress.
- **AC-12 (FR-19, NFR-5, NFR-6):** Given only observed sample shapes, when readiness is
  reported, then it says `sample_payload_observed` and keeps runtime blocked on
  the remaining measured provider and operations evidence.
- **AC-13 (FR-10, NFR-1):** Given synthetic aggregates for enabled, disabled,
  unknown, and unmapped codes, when future acceptance is evaluated, then only
  exact-mapped facts for existing KPI-enabled stores are eligible and no name,
  description, directory row, or fallback matching mutates master data.
- **AC-14 (NFR-8):** Given the two authorized local PRs, when either is reverted,
  then no database rollback, provider change, scheduler change, or Excel-path
  recovery is required because neither PR changes those boundaries.

## Edge Cases

- **EC-1:** An amount token is blank, non-decimal, non-finite, or exceeds the
  future approved precision: reject the component before producing a set.
- **EC-2:** A return row contains a positive amount or quantity contrary to the
  approved signed-return contract: reject the sales component; do not silently
  negate or normalize it.
- **EC-3:** Sales or footfall contains multiple source dates: reject the full
  component even if one date matches the target.
- **EC-4:** GSM contains an unknown, blank, or ambiguous consent value: reject
  the component until a separately approved normalization rule exists.
- **EC-5:** Footfall is duplicated for one store/day: reject the component unless
  a future official contract proves an additive grain.
- **EC-6:** A store or personnel code is unmapped: exclude the affected fact with
  a safe mapping reason; never fall back to a name or description.
- **EC-7:** A corrected retry omits a formerly accepted employee/store row: the
  future atomic replacement removes that stale row.
- **EC-8:** Component persistence succeeds but daily closure dependencies remain
  incomplete: retain the component set and keep closure incomplete.
- **EC-9:** The worker starts after 02:00 but before the provider day advances:
  attempt only missing components for the current target day.
- **EC-10:** The provider day advances before a missing component succeeds: mark
  it missed and do not fabricate or copy forward data.

## API Contracts

These are public neutral interfaces. A private runtime mapping must translate
provider-native keys into these shapes outside Git.

```ts
type ISODate = string // YYYY-MM-DD in Europe/Istanbul
type DecimalText = string // validated base-10 text, never Number arithmetic
type SourceOperation = 'sales' | 'footfall' | 'gsm' | 'store-directory'

interface NeutralSalesLine {
  sourceDateToken: string
  ephemeralInvoiceId: string
  personnelCode: string
  displayName?: string
  storeCode: string
  isReturn: boolean
  quantity: DecimalText
  amountTry: DecimalText
}

interface NeutralFootfallRow {
  sourceDateToken: string
  storeCode: string
  total: number // validated non-negative integer; never money math
}

interface NeutralGsmRow {
  storeCode: string
  consent: 'yes' | 'no'
}

interface NeutralStoreDirectoryRow {
  storeCode: string
  displayDescription?: string
}

interface EmployeeSalesDailyAggregate {
  businessDate: ISODate
  storeCode: string
  personnelCode: string
  saleInvoiceCount: number
  returnInvoiceCount: number
  saleQuantity: DecimalText
  signedReturnQuantity: DecimalText
  netQuantity: DecimalText
  saleAmountTry: DecimalText
  signedReturnAmountTry: DecimalText
  netAmountTry: DecimalText
}

interface StoreSalesDailyAggregate {
  businessDate: ISODate
  storeCode: string
  saleInvoiceCount: number
  returnInvoiceCount: number
}

interface StoreFootfallDailyAggregate {
  businessDate: ISODate
  storeCode: string
  footfall: number
}

interface StoreGsmDailyAggregate {
  businessDate: ISODate
  storeCode: string
  yesCustomerCount: number
  totalCustomerCount: number
}

interface SanitizedComponentSet<TAggregate> {
  sourceCode: string // neutral configured source code, never a provider identifier
  operation: Exclude<SourceOperation, 'store-directory'>
  businessDate: ISODate
  status: 'succeeded' | 'failed' | 'missed'
  aggregates: TAggregate[]
  aggregateCount: number
  retryCount: number
  sanitizedSetDigest?: string
  safeReasonCode?: string
}
```

## Data Models

| Model | Proposed grain / key | Required values | Forbidden values |
| --- | --- | --- | --- |
| Component outcome | source + business day + component | status, retry count, aggregate count, safe reason, sanitized digest, timestamps | payload, name, invoice id, endpoint |
| Employee sales daily | component set + day + store + personnel | eight approved count/quantity/TRY metrics | name, invoice id, footfall, GSM |
| Store sales daily | component set + day + store | distinct sale and return invoice counts | invoice ids, personnel denominator |
| Store footfall daily | component set + day + store | non-negative integer footfall | personnel id |
| Store GSM daily | component set + day + store | valid yes and total counts | customer identity, personnel id |
| Directory reconciliation | no KPI fact persistence in V1 | safe code-level comparison only | automatic activation, display description persistence |
| Canonical KPI projection | existing canonical metric grain after approved migration | mapped internal ids, metric code/value, lineage to sanitized set | provider payload or source-specific scoring |

The future physical schema MUST use foreign keys to existing source, store, and
employee records after exact code mapping. It MUST use check constraints for
non-negative counts and valid GSM bounds. Decimal precision and indexes require
measured volume evidence and belong to the migration PR.

## Out Of Scope

- **OS-1:** Live API calls, provider-native field mapping, credentials, endpoint
  configuration, or reading company data.
- **OS-2:** Database migration, DDL, repository writes, transaction code, or
  changing the existing employee KPI unique index.
- **OS-3:** Scheduler, Docker Compose change, worker activation, alert delivery,
  firewall, TLS, or deployment.
- **OS-4:** Excel/Power BI removal or behavior change.
- **OS-5:** New scoring, ranking, snapshot, target, checklist, or reporting math.
- **OS-6:** Runtime performance claims without sanitized measurements.
- **OS-7:** Realistic fixtures, screenshots, real codes, real descriptions,
  provider payloads, private identifiers, or private URLs in Git.

## Implementation Gates And PR Sequence

1. **PR 1 — this draft and guard:** approve the storage/normalization boundary;
   no runtime or migration.
2. **PR 2 — pure adapter:** use TDD and only synthetic neutral rows; no network,
   database, scheduler, Docker, or provider-native configuration.
3. **Future migration PR:** only after this boundary and adapter output are
   approved; include expand/contract DDL, fresh-database smoke, rollback, query
   compatibility review, and atomic replacement repository tests.
4. **Future runtime PR:** only after sanitized error envelopes, nullability,
   volume/latency, mapping ownership, internal transport controls, and alert
   ownership are approved.

The existing Power BI/Excel path remains active through every stage. A future
connector may be enabled only by a separate owner decision after runtime proof.
