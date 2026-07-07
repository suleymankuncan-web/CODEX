# Reports Excel export integrity evidence - 2026-07-07

Scope: `PRA-20260707-02` (`/store/reports` monthly Excel package).

## Investigation

- Read backend export path:
  - `backend/nestjs/src/modules/store-ops/web/store-monthly-report-package.controller.ts`
  - `backend/nestjs/src/modules/store-ops/application/store-monthly-report-package.service.ts`
  - `backend/nestjs/src/modules/store-ops/infrastructure/store-monthly-report-package.repository.ts`
- Read frontend download path:
  - `admin-web/src/pages/StoreReportsPage.tsx`
  - `admin-web/src/features/reports/api.ts`
- Replayed the repository query against the configured staging database without printing credentials, tokens, cookies, OTP values, raw DB URL, or user ids.

## Root Cause

The report repository aggregated `ops.workforce_norm_plan` and `ops.employee_assignment_history` in the same grouped CTE.

That join multiplied planned norm rows by active assignment rows before `SUM(norm_plan.planned_headcount)`, so report exports produced inflated `Norm / Fiili` values such as `4 / 16` or `5 / 25` even though source norm rows summed to the expected store norm.

## Fix

`StoreMonthlyReportPackageRepository` now computes:

- planned norm in `workforce_norm_state`
- active headcount in `workforce_active_state`
- final `workforce_state` by joining those two aggregates by store

This prevents row multiplication while preserving the existing report API shape and workbook format.

## Readback

Readback used the current Region Manager store scope for May and June 2026.

Before the fix:

- May 2026 rows: `30`
- June 2026 rows: `30`
- Manager column: no empty rows and no pilot/example-style value
- Stores with KPI data: `29`
- Inflated planned norm rows over 10:
  - May: `24`
  - June: `26`
- Sample inflated values:
  - `3 / 12`
  - `4 / 16`
  - `5 / 25`

After the fix:

- May 2026 rows: `30`
- June 2026 rows: `30`
- Manager column: no empty rows and no pilot/example-style value
- Stores with KPI data: `29`
- Inflated planned norm rows over 10:
  - May: `0`
  - June: `0`
- Sample corrected values:
  - `3 / 4`
  - `4 / 4`
  - `3 / 3`

Workbook readback after the fix:

- File name: `magaza-izleyis-2026-06.xlsx`
- Workbook bytes: `51729`
- Sheet row count: `30`
- Header count: `22`
- Headers match `STORE_MONTHLY_REPORT_PACKAGE_HEADERS`: `true`
- Header style present: `true`
- Autofilter present: `true`
- Manager empty rows: `0`
- Manager pilot/example-style rows: `0`
- Inflated norm rows: `0`

## Verification

- `npm.cmd --prefix backend\nestjs test -- store-monthly-report-package --runInBand`
  - 3 suites passed
  - 14 tests passed
- `npm.cmd --prefix backend\nestjs run test`
  - 176 suites passed
  - 1106 tests passed
- `npm.cmd run test:scripts`
  - 498 tests passed
- `git diff --check`
  - Passed
