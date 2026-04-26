# KPI Raw Row Lineage Persistence V1

Date: 26 April 2026

Status: `implemented`

## Purpose

Persist source-agnostic KPI row lineage at the staging table level, not only inside `payload_json`.

This makes future reconciliation, source evidence review, and adapter debugging easier when real source data arrives.

## What Changed

- Added migration `027_kpi_raw_lineage_columns.sql`.
- Added `stg.kpi_raw.row_hash`.
- Added `stg.kpi_raw.raw_row_reference`.
- Added indexes for row hash and readable row reference lookups.
- Updated canonical `db/schema.sql`.
- Updated KPI import staging insert to write `rowHash` and `rawRowReference` into first-class raw columns.
- Added schema contract coverage.
- Added import-batch integration coverage proving KPI lineage is staged as raw columns.

## Boundaries

- No Nebim-specific connector was added.
- No source cadence was assumed.
- No score formula changed.
- No materialization scoring behavior changed.
- No snapshot or ranking behavior changed.

## Verification

- Red test observed: canonical schema and migration did not contain KPI raw lineage columns.
- Red test observed: KPI import staging insert did not write `row_hash` and `raw_row_reference`.
- Targeted backend tests passed:

```powershell
npm.cmd test -- src/modules/integration/source-agnostic-ingest-schema-contract.spec.ts src/modules/integration/application/kpi-import-normalization.service.spec.ts test/integration/import-batch.e2e-spec.ts --runInBand
```

- Backend build passed:

```powershell
npm.cmd run build
```

- Official root release gate passed:

```powershell
npm.cmd run check:release
```

## CODEX DÜRÜST YORUM

This is a good follow-up to the source-agnostic contract work. The previous step defined row lineage; this step makes that lineage queryable without parsing payload JSON every time.

It still does not complete real source integration. The real connector remains blocked until sample payload/access details exist.

## Next Logical Step

If real source details arrive, write the source mapping spec against the canonical KPI contract.

If source details still do not exist, choose the next backend/data step only through the intake gate.
