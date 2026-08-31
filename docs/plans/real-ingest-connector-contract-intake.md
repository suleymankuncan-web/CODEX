# Real Ingest Connector And Payload Contract Intake

Date: 31 August 2026

Status: `contract_draft`

## Purpose

Prevent the project from coding a source-specific JSON connector against imagined data.

The safe goal is to keep the platform ready for real operational data while making the connector shape source-agnostic until the real source contract is known.

## Current User Answer

The product owner approved a contract-only local slice for a company-internal
daily pull source. The provider exposes only the previous Europe/Istanbul day;
it accepts no date range and offers no historical backfill. The public contract
uses `sales`, `footfall`, `gsm`, and `store-directory` aliases so private
operation and execution identifiers remain outside Git.

The approved source semantics, grains, partial-success behavior, signed
sale/return rules, active-store allowlist, missed-day risk, and privacy boundary
are locked in
`docs/contracts/company-daily-kpi-pull-contract-v1.md`.

Unknown today:

- authentication model
- official provider field names, types, nullability, and response envelope
- stable store and personnel code fields
- timeout, retry, rate-limit, and maximum-volume constraints
- sanitized error/status shapes
- production scheduling and operational alert ownership

## Decision

Do not build or connect the source-specific runtime connector yet.

The approved local scope is documentation and synthetic contract testing only.
Runtime work remains blocked until an official sanitized field list and the
remaining implementation-gate inputs are available and separately approved.

## Current Local Foundation

The project already has the right local bones for real ingest:

- `stg.integration_source`
- `stg.import_batch`
- `stg.kpi_raw`
- `stg.external_id_map`
- import batch idempotency metadata
- integration source schedule/profile fields
- integration scheduler service
- KPI import normalization service
- materialization service
- live sync metadata on KPI actuals
- source-agnostic KPI contract metadata from `GET /api/integrations/import-payload-templates`
- deterministic KPI row `rowHash` and readable `rawRowReference`

This means the local project is not starting from zero. The missing part is the real external contract.

For this daily source, the generic raw-row lineage capability is not permission
to persist provider payloads. Raw names and invoice GUIDs must be removed before
the canonical persistence boundary and must not contribute to row hashes or raw
row references.

## Source-Agnostic Ingest Shape

V1 should keep these layers separate:

1. Source registration
   - source name
   - source system
   - delivery type
   - state model
   - poll schedule
   - owner/contact note

2. Import batch envelope
   - one accepted batch per source pull/upload
   - idempotency key
   - source batch id
   - source payload hash
   - captured time
   - window start/end if provided
   - status and error reason

3. Source adapter
   - the only source-specific code
   - maps real external fields into canonical raw rows
   - must not calculate business score

4. Canonical raw KPI rows
   - store external code
   - employee/seller external code when employee-scoped
   - metric code
   - metric scope
   - metric value
   - business date
   - source timestamp when provided
   - raw row reference or payload hash

5. Materialization
   - updates latest live state
   - later closure persists daily official snapshots

## Minimum Canonical Payload Contract

Any future source should be translated into this internal shape before scoring:

```text
sourceSystem
integrationSourceId
sourceBatchId
sourcePayloadHash
sourceCapturedAt
sourceWindowStartedAt
sourceWindowEndedAt
businessDate
storeExternalCode
employeeExternalCode
metricScope
metricCode
metricValue
metricUnit
rowHash
rawRowReference
```

`employeeExternalCode` can be empty only for store-scoped metrics.

## Metric Boundary

Likely imported operational metrics:

- `NET_SALES`
- `TICKET_COUNT`
- `ITEM_COUNT`
- `UPT`
- `ATV`
- `CR`

Likely derived or internal metrics:

- `TARGET_ACHIEVEMENT`
- weighted personnel score
- weighted store score
- BM checklist score
- VM checklist score

Rule:

- Imported metrics come from source payloads.
- Derived metrics are calculated by this platform.
- Checklist metrics belong to platform workflow/checklist data unless the source later proves otherwise.

## External Discovery Checklist

Before coding a real connector, collect:

1. Delivery type: pull API, push endpoint, file upload, SFTP, scheduled export, manual import, or intermediary service.
2. Authentication/access model.
3. One sanitized sample payload or official field list.
4. Source cadence and late-correction behavior.
5. Whether rows represent latest state or additive events.
6. Store identity key and mapping owner.
7. Personnel/seller identity key and mapping owner.
8. Business date and timezone rule.
9. Return/refund rule: already netted or separate rows.
10. Blank personnel / store aggregate row behavior.
11. Idempotency key candidate.
12. Error/retry expectation.
13. Data retention/security restriction.

## Readiness States

Use these states when discussing the source:

- `unknown_source`: no real external contract
- `contract_draft`: current state; product semantics are approved but provider fields and runtime details are not proven
- `sample_payload_validated`: sample payload maps into canonical rows
- `sandbox_connected`: non-production source access works
- `production_candidate`: production-like source is reachable and validated
- `active`: scheduled production ingest can run
- `suspended`: source is intentionally disabled

## V1 Scope

Allowed now:

- document and expose the source-agnostic contract
- document the approved company daily pull semantics using public aliases
- add synthetic, network-free contract guards
- keep existing `stg` import model as the ingest boundary
- prepare future mapping questions
- avoid false certainty in old Nebim-specific planning docs

Not allowed yet:

- hard-code a source field map before the JSON sample arrives
- write a fake source API client
- call the live provider or read/write credentials
- place private operation or execution identifiers in the public repository
- send a provider start/end date or promise historical provider backfill
- persist raw names, invoice GUIDs, raw response bodies, or real company fixtures
- treat blank personnel rows as employee performance
- calculate new score behavior from unverified source fields

## CODEX DÜRÜST YORUM

This is the right place to slow down.

Writing connector code without a real sample payload would create exactly the kind of technical debt this project is trying to avoid: hidden assumptions under KPI, ranking, score, and reporting behavior.

The platform is in a healthy place because it already has `stg` import boundaries, batch metadata, normalization, materialization concepts, and canonical KPI row lineage metadata. The next safe move is not a live connector. The approved next move is the local contract and synthetic guard; a field mapping follows only after official sanitized provider evidence exists.

Recommendation: keep the current source-agnostic contract and Power BI/Excel rollback path, and move actual connector implementation only after the implementation gates in the company daily pull contract are satisfied.

## Next Logical Step

If an official sanitized field list becomes available, convert it into a source mapping spec and then implement only a synthetic pure-adapter slice first.

Until then, do not call the provider, inspect secrets, create a scheduler, or use real company data. Keep the existing Excel path active.
