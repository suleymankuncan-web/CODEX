# Pilot Data Reconciliation Readback - 2026-07-07

Status: completed_for_pr2  
Finding ID: `PRA-20260707-08`  
Scope: Jan-Jun 2026 active roster, personnel targets, sales/KPI actuals, turnover source data and monthly store snapshots  
Secrets policy: no passwords, OTPs, cookies, bearer tokens, database URLs, private credentials, raw connection strings or raw personnel lists recorded.

## Scope Decision

| Item | Decision |
| --- | --- |
| New module | no |
| Business formula change | no |
| Auth/scope change | no |
| Raw snapshot table patch | no |
| Source-data reconciliation | yes |
| Existing snapshot generator path | yes |

## Input Files

| File | Use |
| --- | --- |
| `yeni.xlsx` | June active company-store roster source |
| `lis.xlsx` | Dealer/operator reference file; non-company rows stay review-only |
| `Ocak Ayı Peronel Hedefleri.xlsx` | January personnel target source |
| `Şubat Ayı Peronel Hedefleri.xlsx` | February personnel target source |
| `Mart Ayı Peronel Hedefleri.xlsx` | March personnel target source |
| `Nisan Ayı Peronel Hedefleri.xlsx` | April personnel target source |
| `Mayıs Ayı Peronel Hedefleri.xlsx` | May personnel target source |
| `HaziranAyı Peronel Hedefleri.xlsx` | June personnel target source |
| Jan-Jun personnel sales/KPI workbooks | Monthly personnel sales/KPI actual source |

## Dry-Run Summary

| Check | Count |
| --- | ---: |
| Input rows | 20100 |
| Review-only rows | 18180 |
| Blocking preflight issues | 0 |
| Would-create employees | 0 |
| Resolved active assignments | 154 |
| Resolved inactive assignments after final apply | 0 |
| Resolved target references | 159 |
| Resolved turnover events | 961 |
| Resolved KPI actuals | 2274 |
| Resolved issues | 0 |

Review-only rows were not auto-applied. The main review reasons were dealer/operator ambiguity, non-June active-roster rows, temporary-store markers and sales/KPI rows that do not map cleanly to the June active roster.

## Root Cause

The reconciliation writer could upsert the accepted June active roster but did not close stale active company-store assignment rows. This allowed old assignment history rows to remain active after the June roster was accepted, which made store/personnel views feel stale and inflated active headcount.

A second hidden edge existed: stale active assignment detection was initially tied to `employee.employment_status = active`. If an assignment row was active while the employee row was inactive, the first pass could miss it and a later active-roster upsert could reactivate the employee. The script now inspects active assignment history rows directly, regardless of employee status, and closes stale rows by exact employee/store/position key.

## Code Fix

| File | Change |
| --- | --- |
| `backend/nestjs/scripts/pilot-roster-reconciliation-apply.ts` | Resolves stale active company-store assignments from active assignment history, scoped to stores present in the accepted June active roster. |
| `backend/nestjs/src/modules/store-ops/infrastructure/pilot-roster-reconciliation.repository.ts` | Adds audited inactive-assignment closure. It sets `assignment_status = inactive` and `end_date = GREATEST(start_date, reconciliationEndDate)` without deleting rows. |
| `backend/nestjs/src/modules/store-ops/infrastructure/pilot-roster-reconciliation.repository.spec.ts` | Covers inactive assignment closure and verifies the employee is only marked inactive when no active assignment remains. |

## Apply Summary

| Apply pass | Active touched | Inactive touched | Target refs touched | Turnover touched | KPI actuals touched | Notes |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| Pass 1 | 0 | 78 | 159 | 0 | 2274 | Closed stale active assignment rows. |
| Pass 2 | 0 | 2 | 159 | 0 | 2274 | Idempotent second pass closed remaining rows exposed by prior state. |
| Final dry-run | 154 resolved | 0 pending | 159 resolved | 961 resolved | 2274 resolved | 0 blocking, 0 unresolved. |

The second pass is no longer expected for future runs after the query fix that removes the employee-status blind spot.

## Source Data Readback

### Active Company Roster

| Metric | Count |
| --- | ---: |
| Company stores | 35 |
| Active company assignment rows | 154 |
| Active company employees | 154 |
| Company stores with active personnel | 33 |
| Cashier assignments | 1 |

### Approved Personnel Targets

| Period | Target rows | Employees | Stores | Total target |
| --- | ---: | ---: | ---: | ---: |
| 2026-01 | 17 | 17 | 7 | 15,810,446.00 |
| 2026-02 | 22 | 22 | 9 | 20,395,667.00 |
| 2026-03 | 26 | 26 | 9 | 25,240,283.70 |
| 2026-04 | 31 | 31 | 10 | 21,583,482.32 |
| 2026-05 | 42 | 42 | 11 | 29,838,897.42 |
| 2026-06 | 32 | 32 | 9 | 31,165,100.45 |

### Pilot Personnel KPI Actuals

These rows use the existing `ops.kpi_actual.source_type = integration` convention and are identified by `source_batch_id = pilot-personnel-sales-kpi-YYYY-MM`.

| Period | KPI rows | Employees | Stores | Metrics |
| --- | ---: | ---: | ---: | ---: |
| 2026-01 | 306 | 33 | 18 | 6 |
| 2026-02 | 342 | 39 | 18 | 6 |
| 2026-03 | 354 | 41 | 18 | 6 |
| 2026-04 | 384 | 46 | 18 | 6 |
| 2026-05 | 402 | 49 | 18 | 6 |
| 2026-06 | 486 | 62 | 19 | 6 |

### Turnover Source Events

Turnover events created by this flow are identified by `termination_reason_code = pilot_monthly_snapshot_absence`.

| Period | Leaver events | Stores with leavers |
| --- | ---: | ---: |
| 2026-01 | 172 | 17 |
| 2026-02 | 162 | 17 |
| 2026-03 | 161 | 18 |
| 2026-04 | 153 | 18 |
| 2026-05 | 154 | 18 |
| 2026-06 | 159 | 19 |

## Snapshot Refresh Readback

Initial dry-run found zero completed monthly snapshot runs for Jan-Jun 2026. The existing snapshot generator functions were installed from `db/jobs/generate_snapshots.sql`, then six monthly snapshot runs were created through the existing `rpt.generate_*_snapshot` functions. Snapshot result rows were not manually patched.

| Period | Action | Workforce rows | Store KPI rows | Checklist rows | Turnover rows |
| --- | --- | ---: | ---: | ---: | ---: |
| 2026-01 | created | 365 | 1363 | 0 | 162 |
| 2026-02 | created | 365 | 1367 | 0 | 162 |
| 2026-03 | created | 365 | 1380 | 0 | 162 |
| 2026-04 | created | 365 | 1383 | 0 | 162 |
| 2026-05 | created | 365 | 1369 | 1 | 162 |
| 2026-06 | created | 365 | 1380 | 5 | 162 |

## Reversibility

Source reconciliation is idempotent:

- Active roster writes are keyed by employee/store/position and close stale assignment history instead of deleting it.
- Target references use approved monthly target rows and can be superseded by later imports.
- KPI actual rows are keyed by existing KPI uniqueness constraints and source batch IDs.
- Turnover events are keyed by employee/store/date/event type and the pilot absence reason code.
- Monthly snapshot runs are immutable reporting outputs; newer completed runs for the same period supersede them in read paths that choose the latest run.

## Remaining Risk

| Risk | Status |
| --- | --- |
| Review-only rows are intentionally not applied | accepted_for_pr2 |
| Ranking eligibility and Store Me alignment still need PR3/PR5 validation | open |
| Reports Excel content must be validated after source refresh | open_for_pr4 |
| Live persona smoke must verify the UI sees the refreshed source data | open_for_pr3 |

