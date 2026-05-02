# Import Lineage Evidence Surface V1

Date: 26 April 2026

Status: `implemented`

## Purpose

Expose KPI raw row lineage in the import detail surface so operators can see whether a KPI batch is traceable without opening raw JSON.

This builds on `stg.kpi_raw.row_hash` and `stg.kpi_raw.raw_row_reference`.

## What Changed

- `GET /api/integrations/import-batches/:batchId` now returns `lineageSummary`.
- KPI batches report:
  - whether lineage is supported
  - how many rows have `row_hash`
  - how many rows have `raw_row_reference`
  - one sample row hash
  - one sample raw row reference
- `GET /api/integrations/import-batches/:batchId/errors` now includes `rowHash` and `rawRowReference` for KPI error rows when present.
- `/admin/integrations/:batchId` now shows a `Source row lineage` panel.
- KPI error rows now show row-level lineage evidence when available.
- Long lineage values wrap safely in the admin UI.

## Boundaries

- No Nebim-specific connector was added.
- No fake adapter was added.
- No source cadence was assumed.
- No score formula changed.
- No materialization, snapshot, ranking, or external source behavior changed.
- Non-KPI imports do not pretend to have row lineage; the surface shows the feature boundary.

## Verification

- Red backend test observed: batch detail did not return `lineageSummary`.
- Red backend test observed: KPI error rows did not return `rowHash` and `rawRowReference`.
- Red frontend test observed: admin import detail did not show `Source row lineage`.
- Targeted backend tests passed:

```powershell
npm.cmd test -- test/integration/import-batch.e2e-spec.ts --runInBand -t "lineage"
```

- Targeted frontend test passed:

```powershell
npm.cmd run build; if ($LASTEXITCODE -eq 0) { npx.cmd playwright test e2e/integration-surfaces.spec.ts }
```

- Official root release gate passed:

```powershell
npm.cmd run check:release
```

## CODEX DURUST YORUM

This is the right follow-up after persisting row lineage. Storing evidence without surfacing it would still leave operators dependent on raw JSON or database access.

This does not finish real source integration. It only makes the local reconciliation surface more honest and useful when real source data arrives.

## Next Logical Step

If external source details arrive, return to the source mapping specification. If not, choose the next backend/data step through the intake gate without guessing external source behavior.
