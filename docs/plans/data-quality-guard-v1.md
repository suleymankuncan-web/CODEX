# Data Quality Guard V1

Date: 26 April 2026

## Purpose

This note closes the next local backend/data guard without guessing Nebim or any future source payload.

The goal is simple:

- failed import rows should explain the quality problem with a stable code
- the old `errorCategory` API field should stay intact
- source-specific connector work should still wait for real source evidence
- scoring, ranking, snapshot, and materialization behavior should not change

## Implemented

- Backend-owned import data quality issue catalog.
- Deterministic classifier for import validation/write error rows.
- Additive `qualityIssueCode` on import batch error responses.
- Additive `canonicalContract.dataQualityIssueCodes` on the import payload template response.
- Frontend integration API types for the new additive fields.

Initial quality issue codes:

- `missing_identity`
- `unmapped_store`
- `unmapped_employee`
- `unmapped_position`
- `unmapped_region`
- `unmapped_company`
- `invalid_metric`
- `duplicate_source_row`
- `late_correction_candidate`
- `schema_mismatch`
- `system_write_failure`
- `unknown_quality_issue`

## Boundary

V1 deliberately does not add:

- Nebim-specific connector code
- source API/file/SFTP assumptions
- DB migration
- new scoring math
- ranking behavior change
- snapshot behavior change
- new admin UI surface

This is a contract and guardrail layer. It makes bad data easier to classify and discuss before a real connector exists.

## Verification

Red checks were observed before implementation:

- data quality catalog module missing
- canonical KPI payload contract missing `dataQualityIssueCodes`
- import batch error rows missing `qualityIssueCode`

Green targeted checks:

```powershell
cd "C:\Users\suley\OneDrive\Masaüstü\WEBSİTE ÇALIŞMASI\backend\nestjs"
npm.cmd test -- src/modules/integration/application/import-data-quality.spec.ts test/integration/import-batch.e2e-spec.ts --runInBand -t "data quality|source-agnostic canonical KPI payload contract template|returns import batch error rows|returns KPI import batch error row lineage"
```

Result:

- 2 suites passed
- 13 tests passed
- 26 tests skipped by grep

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

This is a healthy guard to add before real source integration. It does not pretend we know the Nebim payload yet, but it gives future operators and developers a stable language for data problems.

The important part is that V1 stays additive. Existing `errorCategory` remains available, and the new `qualityIssueCode` is more specific without breaking old consumers. That is the right kind of backend hardening for this stage.

Next expansion should only happen when real source evidence shows new recurring issue types. Until then, this catalog is enough.
