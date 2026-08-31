# Company Daily KPI Pull Contract V1

Author: Codex with product-owner decisions
Date: 31 August 2026
Status: Draft — pending product-owner approval
Reviewers: Product owner (pending)

## Context

HR Axis will eventually replace the manual Excel handoff for a bounded set of
daily KPI inputs with a company-internal pull integration. The provider exposes
only the previous Europe/Istanbul calendar day's data. It does not offer an API
date range and cannot be used for historical backfill after the provider moves
to the next day.

This contract is the proposed source-semantics boundary for local, synthetic
development. It does not authorize a live connection, credentials, real company
data, a database migration, a scheduler, a deployment, or replacement of the
current Power BI/Excel operating path.

The public repository uses the neutral operation aliases `sales`, `footfall`,
`gsm`, and `store-directory`. Private operation identifiers and the private
execution identifier MUST NOT be committed to Git. Their future mapping belongs
in private runtime configuration outside the repository.

## Functional Requirements

- **FR-1 Previous-day pull:** The provider adapter MUST request the provider's
  previous Europe/Istanbul calendar day without sending start or end dates.
- **FR-2 Local date filter:** Free start/end date filtering MUST apply only to
  data already stored in the HR Axis database. It MUST NOT be translated into a
  provider request or described as provider backfill.
- **FR-3 Sales grain:** Sales MUST be aggregated at business day + store +
  personnel grain.
- **FR-4 Store grains:** Footfall and GSM MUST be aggregated at business day +
  store grain. They MUST NOT be copied onto personnel rows.
- **FR-5 Conversion grain:** Conversion MUST be store-scoped only. Personnel
  conversion MUST NOT be calculated because personnel footfall is unavailable.
- **FR-6 Active-store allowlist:** KPI processing MUST include only stores that
  already exist in HR Axis and have KPI import enabled. A provider store record
  MUST NOT create, reactivate, or enable a store.
- **FR-7 Optional directory:** `store-directory` MAY support reconciliation, but
  it MUST NOT be a required component of daily KPI closure when an existing
  active-store allowlist is available.
- **FR-8 Required component outcomes:** `sales`, `footfall`, and `gsm` MUST each
  record an independent outcome for the business day. A missing required
  component MUST keep daily closure out of `completed` state.
- **FR-9 Component replacement:** When the same component and business day are
  fetched again successfully, the new sanitized aggregate set MUST atomically
  replace that component's previous aggregate set. Old rows absent from the new
  set MAY be removed; the new set MUST NOT be appended to or added onto the old
  set. A failed replacement validation MUST leave the prior successful set
  unchanged. Replacement MUST NOT modify successful outcome sets owned by other
  components.
- **FR-10 Conversion readiness:** Store conversion MUST be produced only from a
  successful sales aggregate and a successful footfall aggregate for the same
  business day and store. GSM success or failure MUST NOT change conversion.
- **FR-11 GSM independence:** GSM MUST be retained as an independent store-day
  metric even when sales or footfall fails.
- **FR-12 Retry window:** Failed components SHOULD be retried idempotently during
  the same Europe/Istanbul day. Retry MUST stop treating the missed business day
  as recoverable after the provider advances to the next day.
- **FR-13 No fabricated backfill:** The system MUST NOT fabricate, copy forward,
  or infer a provider day that can no longer be retrieved. The missing day MUST
  remain visible as incomplete operational evidence.
- **FR-14 Sale classification:** A source row with `Durum=false` MUST be treated
  as a sale. A source row with `Durum=true` MUST be treated as a return.
- **FR-15 Invoice count:** `InvoiceHeaderID` MUST be counted distinctly at the
  aggregate's grain for both sale invoices and return invoices. Employee counts
  use day + store + personnel; the store conversion numerator recomputes
  distinct sale invoices at day + store scope. Only distinct sale invoices
  (`Durum=false`) MAY contribute to conversion; return invoices MUST NOT
  contribute.
- **FR-16 Signed values:** `Adet` and `Tutar` MUST be treated as already signed.
  Return values MUST NOT be negated a second time.
- **FR-17 Decimal arithmetic:** Quantity and money aggregation MUST use
  decimal-safe arithmetic. Binary floating-point arithmetic MUST NOT be used for
  persisted or derived monetary results.
- **FR-18 Ephemeral sensitive fields:** Real names and real `InvoiceHeaderID`
  values MUST NOT appear in fixtures, logs, diagnostics, audit events,
  quarantine evidence, or database fields. A real runtime invoice identifier
  MAY exist only in bounded adapter memory until distinct counts are complete;
  it MUST then be discarded before the persistence boundary and MUST NOT enter a
  canonical row, raw payload, row reference, or row hash input. Clearly
  non-realistic markers such as `invoice-A`, `invoice-B`, and `person-A` MAY be
  used as unit-test inputs, but synthetic invoice identifiers MUST also be
  absent from persistence-boundary outputs. GUID-formatted realistic fixture
  values MUST NOT be used.
- **FR-19 Code-only identity:** Store and personnel matching MUST use approved
  stable codes. Name-based matching MUST NOT be used for this source. A sales
  row without a safe personnel code MUST NOT become a personnel KPI fact.
- **FR-20 Canonical boundary:** Sanitized aggregates MUST enter the existing
  source-agnostic import boundary. The source MUST NOT introduce a separate
  scoring, ranking, snapshot, or reporting path.
- **FR-21 Synthetic-first:** This slice MUST use only synthetic documents and
  tests. It MUST NOT call the provider, inspect secrets, or persist real company
  data.
- **FR-22 Source date binding:** Every `sales` and `footfall` source date MUST be
  converted to a `Europe/Istanbul` business date and validated against the
  scheduled target day `D`. A response containing a different date or mixed
  dates MUST be rejected at component level. Because `gsm` has no source date,
  its successfully validated response MUST be assigned the scheduled target day
  `D`. `store-directory` is an undated reference source.
- **FR-23 Employee KPI set:** Every employee sales aggregate MUST contain
  distinct sale invoice count, distinct return invoice count, sale quantity,
  signed return quantity, net quantity, sale amount, signed return amount, and
  net amount. `Tutar` is the net line amount and all monetary values are in TRY.
  Net quantity and net amount MUST be decimal-safe sums of their signed sale and
  return values.
- **FR-24 Range aggregation:** A selected inclusive local reporting range `R`
  MUST calculate conversion and GSM rate from sums of eligible daily numerator
  and denominator values. It MUST NOT average daily percentages. A day `D` MAY
  enter `conversion(R, S)` only when both `sales` and `footfall` succeeded for
  that same `D` and `S`. A day `D` MAY enter `gsmRate(R, S)` only when the `gsm`
  component succeeded for that `D` and `S`, its total customer count is a valid
  integer greater than zero, and its yes count is between zero and that total.
  Missing or unsuccessful days MUST NOT be treated as zero. `RangeCoverage`
  MUST show every expected day, every included day, and every missing day, and
  the result MUST carry an incomplete-coverage warning when any expected day is
  missing.

## Calculation Rules

For a business day `D`, store `S`, personnel `P`, and inclusive local reporting
range `R`:

```text
salesInvoiceCount(D, S) = distinct InvoiceHeaderID count
                           where Durum=false for D and S

conversion(D, S) = salesInvoiceCount(D, S) / footfall(D, S)

gsmRate(D, S) = gsmYesCustomerCount(D, S) / gsmTotalCustomerCount(D, S)

conversion(R, S) = sum(salesInvoiceCount(D, S)) / sum(footfall(D, S))
                   for D in R where sales(D, S) and footfall(D, S) both
                   succeeded for the same D and S

gsmRate(R, S) = sum(gsmYesCustomerCount(D, S)) /
                sum(gsmTotalCustomerCount(D, S))
                for D in R where gsm(D, S) succeeded and
                gsmTotalCustomerCount(D, S) is valid and greater than zero

salesInvoiceCount(D, S, P) = distinct InvoiceHeaderID count where Durum=false
returnInvoiceCount(D, S, P) = distinct InvoiceHeaderID count where Durum=true
salesQuantity(D, S, P) = decimal-safe sum(Adet where Durum=false)
signedReturnQuantity(D, S, P) = decimal-safe sum(Adet where Durum=true)
netQuantity(D, S, P) = salesQuantity(D, S, P) + signedReturnQuantity(D, S, P)
salesAmountTry(D, S, P) = decimal-safe sum(Tutar where Durum=false)
signedReturnAmountTry(D, S, P) = decimal-safe sum(Tutar where Durum=true)
netAmountTry(D, S, P) = salesAmountTry(D, S, P) + signedReturnAmountTry(D, S, P)
```

- Store conversion is unavailable when footfall is missing, unsuccessful, or
  zero. It MUST NOT become zero, infinity, or a personnel metric.
- GSM rate is unavailable when its denominator is missing, unsuccessful, or
  zero. It MUST NOT become zero or infinity.
- `Tutar` is the net line amount in TRY. Employee quantity and money metrics are
  required and use decimal-safe sums of the already signed `Adet` and `Tutar`
  values; binary floating-point arithmetic is forbidden.
- Store conversion invoice distinctness MUST be calculated at store-day scope;
  employee invoice counts MUST NOT be summed to derive the store numerator.
- Range ratios MUST use summed eligible numerators divided by summed eligible
  denominators. Daily percentages MUST NOT be averaged. Requested days excluded
  for missing or unsuccessful sides MUST be listed as incomplete coverage, not
  represented as zero-valued observations.

## Non-Functional Requirements

- **NFR-1 Timezone determinism:** Date selection MUST produce exactly the
  previous calendar date in `Europe/Istanbul`, including UTC-day and daylight
  boundary test cases.
- **NFR-2 Idempotent replacement:** Replaying the same operation alias and
  business date with the same sanitized aggregate set MUST create zero duplicate
  accepted facts. A changed successfully validated set MUST replace, rather than
  append to, that component-day set.
- **NFR-3 Privacy:** Persistent and diagnostic output for this source MUST
  contain zero raw names, zero invoice GUIDs, and zero real-data fixtures.
- **NFR-4 Atomic component write:** Each source component's sanitized aggregate
  set replacement and outcome MUST be committed atomically. Other component sets
  MUST remain untouched; daily closure MUST be derived separately from component
  outcomes.
- **NFR-5 Auditability:** An incomplete day MUST expose component status, safe
  aggregate counts, retry count, and sanitized reason codes without provider
  payload fragments.
- **NFR-6 Performance:** N/A for this contract-only slice. Runtime budgets MUST
  be defined after the official field contract and sanitized volume envelope
  are available.
- **NFR-7 Availability:** N/A for this contract-only slice. The future runtime
  MUST document a retry cutoff before the next Europe/Istanbul day begins.

## Acceptance Criteria

- **AC-1 (FR-1, FR-2, NFR-1):** Given an instant on an Istanbul calendar day,
  when the scheduled source date is selected, then the request has no date-range
  parameters and its expected result date is the preceding Istanbul calendar
  date; local start/end filters remain database-only.
- **AC-2 (FR-3, FR-4, FR-5):** Given synthetic sales, footfall, and GSM rows for
  one day, when their canonical grains are inspected, then sales is day + store
  + personnel, footfall/GSM are day + store, and no personnel conversion or
  copied store denominator exists.
- **AC-3 (FR-6, FR-7):** Given provider rows for an enabled store, a disabled
  store, and an unknown store, when the allowlist is applied, then only the
  enabled existing store is processed and a failed directory call does not
  invalidate that store's other source outcomes.
- **AC-4 (FR-8, FR-9, FR-11, NFR-4, NFR-5):** Given successful sales and GSM components
  but failed footfall, when closure is evaluated, then the day is incomplete,
  sales and GSM aggregates remain retained, conversion is unavailable, and the
  component status is auditable through safe counts and reason codes without
  provider payload fragments.
- **AC-5 (FR-10, FR-11):** Given successful same-day sales and footfall but
  failed GSM, when metrics are derived, then store conversion is available,
  GSM is unavailable, and daily closure remains incomplete.
- **AC-6 (FR-9, FR-12, FR-13, NFR-2, NFR-4, NFR-7):** Given an accepted
  component-day set and a corrected successful retry, when the new set is
  committed, then it atomically replaces the old set, removes old rows absent
  from the correction, creates no additive duplicates, and leaves other
  components untouched; after the provider advances, a missed day remains
  incomplete and no backfill is attempted.
- **AC-7 (FR-14, FR-15):** Given repeated invoice lines, sale invoices, and
  return invoices, when invoice count is aggregated, then each sale invoice is
  counted once and return invoice identifiers do not enter the conversion
  numerator.
- **AC-8 (FR-16, FR-17):** Given signed sale and return `Adet`/`Tutar` values,
  when they are aggregated, then the original signs are summed once with
  decimal-safe arithmetic and return values are not negated again.
- **AC-9 (FR-18, FR-19, NFR-3):** Given unit-test input using non-realistic
  `person-A`, `invoice-A`, and `invoice-B` markers, when the
  persistence-boundary object and diagnostics are inspected, then neither
  invoice marker nor a hash/reference derived from it exists; no real name,
  real invoice identifier, or GUID-formatted realistic fixture is used, and
  stable approved codes plus sanitized aggregate values are the only output
  identities.
- **AC-10 (FR-20):** Given accepted source aggregates, when they enter HR Axis,
  then they use the shared mapping, validation, lineage, materialization, and
  scoring boundary without a source-specific scoring path.
- **AC-11 (FR-21, NFR-3):** Given this local development slice, when its tests
  run, then they perform no network, secret, database, or real-data access.
- **AC-12 (FR-10, FR-15):** Given one invoice represented under more than one
  personnel row in the same store/day, when store conversion is calculated,
  then store-day distinctness counts that invoice once instead of summing
  personnel invoice counts.
- **AC-13 (NFR-6):** Given this contract-only slice and no sanitized production
  volume envelope, when the specification is reviewed, then it makes no runtime
  performance claim and keeps runtime implementation gated on a measurable
  volume and performance budget.
- **AC-14 (FR-24):** Given a selected local range containing complete and
  incomplete days, when a store ratio is calculated, then the numerator and
  denominator are summed only across days where both relevant sides succeeded,
  daily percentages are not averaged, excluded days are not zero-filled, and
  the result reports incomplete coverage.
- **AC-15 (FR-22, NFR-1):** Given sales or footfall rows with a different or
  mixed Istanbul business date, when the component is validated against target
  `D`, then the component is rejected; a successful dateless GSM response is
  assigned `D`, and the undated directory remains reference-only.
- **AC-16 (FR-14, FR-15, FR-16, FR-17, FR-23):** Given synthetic sale and return
  lines at employee grain, when the aggregate is produced, then all eight
  required count, quantity, and TRY amount metrics are present, return signs are
  preserved, and net values are decimal-safe signed sums.

## Edge Cases

- **EC-1:** Provider response business date differs from the expected previous
  Istanbul day: reject that component and keep the day incomplete.
- **EC-2:** Provider advances before a retry succeeds: retain prior successful
  components, mark the missing component unrecoverable from this API, and do not
  invent backfill.
- **EC-3:** Footfall is zero: preserve the footfall aggregate and leave
  conversion unavailable.
- **EC-4:** GSM total customer count is zero: preserve safe GSM counts and leave
  GSM rate unavailable.
- **EC-5:** Store is unknown, inactive, or KPI import disabled: do not process
  its KPI facts and do not mutate master data.
- **EC-6:** Personnel code is missing or unmapped: do not persist a personnel
  fact and do not retain a fallback name.
- **EC-7:** One required component fails: preserve other successful component
  aggregates but do not mark daily closure completed.
- **EC-8:** Directory lookup fails while a valid allowlist exists: continue the
  required component processing against the existing allowlist.
- **EC-9:** Duplicate raw invoice lines exist: count the invoice identifier once
  at the required distinct scope, then discard it before persistence.
- **EC-10:** A return amount is already negative: sum it as supplied without a
  second sign inversion.
- **EC-11:** A log or quarantine path would require a raw name or invoice GUID:
  emit only a sanitized reason code and safe aggregate/component identifiers.
- **EC-12:** A corrected component response omits a row accepted earlier: the
  successful atomic replacement removes that stale row without appending counts
  and without changing another component's successful set.
- **EC-13:** Sales or footfall contains a source date different from target `D`
  or contains mixed Istanbul dates: reject the entire component outcome.
- **EC-14:** GSM contains no source date: bind a successfully validated result to
  the scheduled target `D`; do not infer a date from execution UTC time.
- **EC-15:** A selected range excludes one or more missing/unsuccessful ratio
  days: calculate from eligible paired days and expose incomplete coverage rather
  than substituting zero or averaging daily percentages.

## API Contracts

The public contract deliberately excludes private endpoint names, private
execution identifiers, authentication material, and provider-native envelopes.
The official field contract remains an implementation gate.

```ts
type SourceOperationAlias = 'sales' | 'footfall' | 'gsm' | 'store-directory'
type ISODate = string // YYYY-MM-DD, interpreted in Europe/Istanbul
type DecimalText = string // base-10 decimal representation; never JS number math

interface PreviousIstanbulDayPull {
  operation: SourceOperationAlias
  // No startDate or endDate is allowed in a provider request.
}

interface ComponentOutcome<TAggregate> {
  operation: Exclude<SourceOperationAlias, 'store-directory'>
  businessDate: ISODate
  status: 'succeeded' | 'failed' | 'missed'
  aggregates: TAggregate[]
  safeReasonCode?: string
  retryCount: number
}

interface LocalMetricDateFilter {
  startDate: ISODate // inclusive database filter
  endDate: ISODate // inclusive database filter
}

interface RangeCoverage {
  expectedDays: ISODate[]
  includedDays: ISODate[] // both relevant ratio sides succeeded
  missingDays: ISODate[] // never zero-filled
  warning?: 'incomplete_coverage'
}
```

Provider error and timeout details MUST be mapped to bounded safe reason codes.
The raw response body MUST NOT enter logs, error details, or persistence.

## Data Models

| Model | Grain / fields | Persistence rule |
| --- | --- | --- |
| Ephemeral sales row | day, store code, personnel code, `Durum`, `InvoiceHeaderID`, signed `Adet`, signed `Tutar` | Memory only; raw name and invoice identifier discarded before boundary |
| Employee sales aggregate | day + store + personnel; distinct sale/return invoice counts; decimal sale/signed-return/net quantities; decimal TRY sale/signed-return/net amounts | Future runtime may persist only after a separate implementation approval |
| Store sales aggregate | day + store; distinct sale invoice count | Derived before invoice identifiers are discarded |
| Store footfall aggregate | day + store; footfall count | Never copied to personnel rows |
| Store GSM aggregate | day + store; yes count, total count, optional derived rate | Independent of conversion |
| Component outcome | day + operation alias; status, safe counts/reason, retry count | No raw payload, name, GUID, or secret |
| Daily closure | day; required component states, `completed`/`incomplete` | `completed` only when sales, footfall, and GSM succeeded |
| Store allowlist entry | existing store id/code, active state, KPI-import-enabled state | Provider directory cannot create or activate entries |

## Out of Scope

- **OS-1:** Live provider calls, credentials, secrets, and company-server work.
- **OS-2:** Provider endpoint names, private operation identifiers, and private
  execution identifiers in the public repository.
- **OS-3:** Historical provider backfill or provider date-range requests.
- **OS-4:** Database migrations, scheduler/runtime implementation, deployment,
  push, or PR creation.
- **OS-5:** Real company payloads, real names, real invoice identifiers, or
  GUID-formatted realistic values in local fixtures, logs, screenshots, or
  evidence. Non-realistic unit-test markers are allowed only as ephemeral inputs
  and MUST NOT cross the persistence boundary.
- **OS-6:** Automatic store creation, activation, or KPI-import enablement.
- **OS-7:** Personnel footfall, personnel conversion, source-specific scoring,
  ranking, target, incentive, or checklist behavior.
- **OS-8:** Removing or changing the current Power BI/Excel path.

## Implementation Gates

Runtime work remains blocked until all of the following are separately reviewed
and approved: the official sanitized field list, stable store/personnel identity
keys, authentication model, provider response/error envelope, timeout and retry
limits, expected volume envelope, privacy-boundary design, and synthetic adapter
tests. If the existing employee KPI uniqueness key omits store, the required day
+ store + personnel grain MUST NOT be squeezed into that table; a migration or
separate storage decision MUST be reviewed and approved first. Any need to retain
a raw name, invoice GUID, provider payload, or real company fixture is a stop
condition rather than permission to weaken this contract.
