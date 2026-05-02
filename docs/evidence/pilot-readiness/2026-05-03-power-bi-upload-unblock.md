# Power BI Upload Unblock Evidence - 2026-05-03

## Context

Operator report: clicking `Power BI export yukle` on `/admin/integrations` produced no visible movement.

## Finding

- The upload button is intentionally disabled when any prerequisite is missing.
- The UI did not show a clear disabled reason next to the button.
- The reference seed only created `HRIS` and `POS` integration sources. There was no default active `power-bi-kpi` source for the temporary Excel upload adapter.
- Backend role mismatch was not the root cause: `RoleGuard` permits `SUPER_ADMIN` globally before checking route-specific roles.

## Change

- Added migration `db/migrations/045_power_bi_kpi_source_seed.sql`.
- Added default seed row:
  - `source_code=power-bi-kpi`
  - `entity_type=kpi`
  - `source_system=power_bi`
  - `state_model=closed_period`
  - `is_active=TRUE` for newly inserted rows
- Added `/admin/integrations` upload readiness feedback:
  - missing active Power BI KPI source
  - missing personnel/store Excel file
  - missing source selection
  - invalid period
- Added root contract test `scripts/default-power-bi-source-contract.test.mjs`.
- Added Playwright regression for the disabled upload explanation.

## Verification

- RED: `node --test .\scripts\default-power-bi-source-contract.test.mjs` failed before seed/migration change.
- RED: `npm.cmd run test:e2e -- integration-surfaces.spec.ts -g "admin dashboard explains why Power BI export upload is unavailable"` failed before UI feedback.
- GREEN: `node --test .\scripts\default-power-bi-source-contract.test.mjs` passed.
- GREEN: `npm.cmd run build` in `admin-web` passed.
- GREEN: `npm.cmd run test:e2e -- integration-surfaces.spec.ts -g "admin dashboard explains why Power BI export upload is unavailable"` passed.
- Wider: `node --test .\scripts\*.test.mjs` passed, 124/124.
- Wider: `npm.cmd run test:e2e -- integration-surfaces.spec.ts` passed, 5/5.
- Hygiene: `git diff --check` passed, with line-ending warnings only.

## Not Completed

- `npm.cmd run smoke:migration:fresh-db` could not start because Docker Desktop daemon was not running on this machine.
- Staging DB migration was not applied in this evidence item.
- Official authenticated staging upload was not run.
- No import batch id, source batch id, unmapped counts, or materialization evidence was produced yet.

## Next Step

Deploy backend/frontend, apply `045_power_bi_kpi_source_seed.sql` through the normal migration path on staging, then rerun the authenticated March 2026 Power BI Excel upload smoke and record sanitized batch evidence.
