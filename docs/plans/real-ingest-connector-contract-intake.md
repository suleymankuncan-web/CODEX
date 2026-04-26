# Real Ingest Connector And Payload Contract Intake

Date: 26 April 2026

Status: `external_source_unknown`

## Purpose

Prevent the project from coding a Nebim-specific connector against imagined data.

The safe goal is to keep the platform ready for real operational data while making the connector shape source-agnostic until the real source contract is known.

## Current User Answer

The product owner currently has no confirmed information about how data will be pulled from Nebim.

Unknown today:

- whether the source is API, database view, file export, SFTP, Excel/CSV, Power BI, or an intermediary service
- authentication model
- payload fields
- cadence
- date and timezone semantics
- identity keys
- return/refund behavior
- whether values arrive as latest state or additive events

## Decision

Do not build a Nebim-specific connector yet.

Build or document only the source-agnostic contract boundary until at least one real sample payload or official field list is available.

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

This means the local project is not starting from zero. The missing part is the real external contract.

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

1. Delivery type: API, DB view, file, SFTP, manual upload, Power BI export, or intermediary service.
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

- `unknown_source`: current state, no real external contract
- `contract_draft`: expected fields are documented but not proven
- `sample_payload_validated`: sample payload maps into canonical rows
- `sandbox_connected`: non-production source access works
- `production_candidate`: production-like source is reachable and validated
- `active`: scheduled production ingest can run
- `suspended`: source is intentionally disabled

## V1 Scope

Allowed now:

- document the source-agnostic contract
- keep existing `stg` import model as the ingest boundary
- prepare future mapping questions
- avoid false certainty in Nebim-specific planning docs

Not allowed yet:

- hard-code a Nebim field map
- write a fake Nebim API client
- assume 30-minute cadence is vendor-confirmed
- assume return/refund semantics
- treat blank personnel rows as employee performance
- calculate new score behavior from unverified source fields

## CODEX DÜRÜST YORUM

This is the right place to slow down.

Writing connector code without a real sample payload would create exactly the kind of technical debt this project is trying to avoid: hidden assumptions under KPI, ranking, score, and reporting behavior.

The platform is in a healthy place because it already has `stg` import boundaries, batch metadata, normalization, and materialization concepts. The next safe move is not a fake Nebim connector. The next safe move is a source-agnostic contract and an external discovery checklist.

Recommendation: continue with contract-first planning now, and move actual connector implementation only after real source evidence exists.

## Next Logical Step

If a real Nebim/API/file sample becomes available, convert it into a source mapping spec and then implement only the adapter layer.

If no external source detail is available yet, move the local backend work to KPI config governance implementation planning, because that is still fully within project control.
