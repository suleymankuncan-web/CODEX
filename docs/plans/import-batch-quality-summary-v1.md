# Import Batch Quality Summary V1

Date: 26 April 2026

## Purpose

Data Quality Guard V1 added stable row-level `qualityIssueCode` values. This V1 makes those codes useful at batch level, so an operator can understand the dominant cleanup work before opening every failed row.

## Implemented

- `GET /api/integrations/import-batches/:batchId` now returns additive `qualityIssueSummary`.
- The summary groups failed rows by stable data quality issue code.
- Each summary item includes:
  - `code`
  - `label`
  - `owner`
  - `severity`
  - `description`
  - `count`
- The summary also reports:
  - `totalIssueRows`
  - `highSeverityRows`
- `/admin/integrations/:batchId` now shows a `Data quality summary` panel.
- Error-row CSV export now includes `qualityIssueCode`.
- Error-row cards show the row-level quality issue code when present.

## Boundary

This does not add:

- DB schema or migration
- Nebim-specific connector behavior
- source payload assumptions
- scoring, ranking, snapshot, or materialization behavior changes
- new retry decision logic
- new global data quality dashboard

The feature only summarizes already-known row error state through the backend-owned quality issue catalog.

## Verification

Red checks were observed before implementation:

- backend batch detail response did not include `qualityIssueSummary`
- frontend import detail page did not render the `Data quality summary` panel

Green targeted checks:

```powershell
cd "C:\Users\suley\OneDrive\Masaüstü\WEBSİTE ÇALIŞMASI\backend\nestjs"
npm.cmd test -- test/integration/import-batch.e2e-spec.ts --runInBand -t "returns import batch detail with row status summary|returns KPI import batch lineage summary|returns import batch error rows|returns KPI import batch error row lineage"
```

Result:

- 1 suite passed
- 4 tests passed
- 25 tests skipped by grep

```powershell
cd "C:\Users\suley\OneDrive\Masaüstü\WEBSİTE ÇALIŞMASI\admin-web"
npx.cmd playwright test e2e/integration-surfaces.spec.ts
```

Result:

- 1 Playwright test passed

Full release gate result is recorded in `current-state.md` after the root gate run.

Full release gate:

```powershell
cd "C:\Users\suley\OneDrive\Masaüstü\WEBSİTE ÇALIŞMASI"
npm.cmd run check:release
```

Result:

- 9 root Node script tests passed
- backend lint passed
- backend 37 suites / 274 tests passed
- backend build passed
- backend `npm audit --omit=dev` found 0 vulnerabilities
- frontend lint passed
- frontend 7 Node script tests passed
- frontend build passed
- frontend 28 Playwright tests passed
- frontend `npm audit --omit=dev` found 0 vulnerabilities

## CODEX DURUST YORUM

This is the right follow-up to Data Quality Guard V1. Row-level codes are useful for exact diagnosis, but batch-level summary is what keeps operators from manually scanning hundreds of failures.

The important part is that this stays additive and read-only. It improves operator visibility without inventing a new cleanup workflow, retry policy, connector, or data quality dashboard too early.
