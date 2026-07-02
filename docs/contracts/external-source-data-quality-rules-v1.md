# External Source Data Quality Rules V1

## Decision

Rows that cannot be safely mapped must not block the full pilot surface. They must be quarantined with reason, batch id, source row id, and raw evidence fields. Domain calculations must consume accepted rows only and expose import health separately.

This matches the current pilot tolerance: known unmatched historical personnel should not block incentive, KPI, ranking, or report operation while development and data mapping continue.

## Row Outcomes

| Outcome | Meaning | Can domain calculations consume? | Follow-up |
|---|---|---:|---|
| `accepted` | Store/person/metric/date mapped and valid | yes | none |
| `accepted_without_person` | Store-level row valid; personnel mapping absent but not required | yes for store metrics | optional mapping cleanup |
| `quarantined_store_unmatched` | Store code/name cannot map to one store | no | map store or correct source |
| `quarantined_employee_unmatched` | Employee code cannot map for personnel-level fact | no for personnel fact | map employee/personnel code |
| `quarantined_duplicate` | Same immutable source row already imported | no | review source batch |
| `quarantined_invalid_period` | Period/date invalid or outside accepted range | no | correct source |
| `quarantined_invalid_metric` | Metric code/value cannot be parsed | no | adapter mapping fix |
| `quarantined_ambiguous_store` | Source can map to more than one store | no | add explicit store mapping |
| `quarantined_ambiguous_employee` | Source can map to more than one employee | no | add explicit employee mapping |
| `quarantined_scope_conflict` | Row maps outside expected org/store scope | no | review assignments/source |

## Batch Health

Every import batch must expose:

- `sourceSystem`
- `sourceBatchId`
- period
- created/imported timestamp
- total source rows
- accepted row count
- accepted-without-person row count
- quarantined row count
- top quarantine reasons
- source file/API reference when safe to show

The UI may summarize these values, but the counts must be explainable by batch and reason.

## Pilot Tolerance

Pilot can proceed when:

- Accepted store-level facts exist for the target month.
- Quarantined rows are visible by batch and reason.
- Quarantined personnel rows do not prevent store-level KPI/reporting from rendering.
- Known unmatched historical personnel are listed as data quality work, not hidden.
- Incentive/personnel pages clearly show missing personnel target or sales source where data is absent.
- Store-level accepted data is not held hostage by unrelated personnel mapping gaps.

Pilot must stop when:

- Store mapping has broad unresolved failure.
- Period parsing is inconsistent.
- Accepted rows are silently dropped.
- KPI/prim/ranking calculations use quarantined rows.
- Role/scope filters expose another region/store/personnel's data.
- Import accepted/quarantine counts are not explainable.
- External source values overwrite master data without review.

## Store Mapping Rules

- Store code mapping is required for any accepted row.
- Store name can support audit evidence, but cannot create acceptance alone.
- If a store is closed or inactive for the period, the row must either map to the historical store id or quarantine.
- If one source store maps to multiple HR Axis stores, the row quarantines.
- If multiple source stores map to one HR Axis store, the mapping must be explicit and documented.

## Employee Mapping Rules

- Personnel-level sales, target, incentive, or ranking facts require employee mapping.
- Store-level KPI/reporting facts may be accepted without employee mapping.
- Employee name is evidence only.
- Cashier-specific incentive behavior is parked until product defines it.
- Role labels from source do not override HR Axis role assignments.

## Period And Date Rules

- `period` must match `YYYY-MM`.
- `businessDate` must match `YYYY-MM-DD` when daily data is present.
- A row with a date outside its period quarantines unless the metric explicitly supports carried-over state.
- Monthly rows may use the month end date for `businessDate` when the source has no daily date.
- Reports for the current month should include accepted rows up to the latest available business date in that month.

## Duplicate Rules

Duplicate identity should be based on:

- `sourceSystem`
- `sourceBatchId` or approved idempotency key
- `sourceRowId`
- canonical row identity fields

The same batch may be retried idempotently. A different batch with the same source row must not double-count unless the source marks it as a correction/replacement.

## Sales, Returns, And Exchanges

- Sales rows must keep seller employee code when personnel-level sales are supplied.
- A return or exchange received by another store affects the receiving/processing store when the approved source event says so.
- The original salesperson's accepted sale must not be silently rewritten by a later row unless the source sends an explicit correction event.
- Correction events must be traceable through source lineage.

## Missing Values

- Missing numeric values are not zero.
- Missing target is `missing target`, not `0`.
- Missing KPI source is `missing source`, not `0`.
- Missing GSM approval is `missing source`, not `0`.
- UI/export labels may localize missing state, but calculations must keep the distinction.

## Quarantine Visibility

Quarantine must be visible at least by:

- batch
- reason
- source row id
- store raw evidence
- employee raw evidence when present
- metric code/value raw evidence
- period/date

Quarantine screens must not expose secrets. Raw evidence should be limited to operational fields needed to fix mapping.

## Recovery Flow

1. Import batch is created.
2. Rows are canonicalized.
3. Validation assigns row outcomes.
4. Accepted rows materialize into domain read models.
5. Quarantine counts are shown in import health.
6. Operator fixes master mapping or source file.
7. Batch is retried or correction batch is imported.
8. Evidence is recorded.

## Stop Rules

Stop pilot import flow when:

- Accepted row count is unexpectedly zero for a critical source.
- Store-level facts for the selected month are missing across broad scope.
- Quarantine reason distribution indicates a mapping/systemic parser problem.
- Same source batch creates non-idempotent duplicate facts.
- Scope conflict appears for region/store/personnel data.

Do not stop the full pilot merely because known historical employee rows are unmatched when accepted store-level data is still reliable and the mismatch is visible.

## Business Calculation Rule

Domain calculations must consume accepted rows only. Quarantined rows are evidence and remediation input; they are not calculation input.

This rule applies to:

- KPI score
- ranking score
- target progress
- incentive calculation
- checklist/report summaries
- workforce/norm summaries
- monthly report package export
