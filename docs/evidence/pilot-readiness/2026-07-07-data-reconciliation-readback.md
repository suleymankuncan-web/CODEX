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

## Public DB Rerun - 2026-07-07

Status: verified_after_public_connection

The database readback was repeated after the user switched the connection from private to public. The rerun used the local `admin-web/.env.local` database key without printing or recording the value. No data mutation was executed.

### Rerun Connection

| Check | Result |
| --- | --- |
| `DATABASE_URL` present | yes |
| `DB_SSL_MODE` present | yes |
| `pg` client available | yes |
| Read-only connection | pass |
| Secrets printed | no |

### Current Store Inventory

| Store type | Status | KPI import | Stores |
| --- | --- | --- | ---: |
| company | active | true | 35 |
| company | closed | false | 1 |
| company | closed | true | 3 |
| franchise | active | true | 107 |
| operator | active | true | 16 |

### Region Scope Readback

| Region scope | Active stores |
| --- | ---: |
| Onur Kaytan Bolgesi | 30 |
| Eda Doganay Bolgesi | 28 |
| Eyup Buyukyilmaz Bolgesi | 20 |
| Levent Yilmaz Bolgesi | 22 |
| Mehmet Unlu Bolgesi | 20 |
| Oktay Unsal Bolgesi | 14 |
| Ugur Buyukburc Bolgesi | 14 |
| Sercan Pohrenkci Bolgesi | 9 |

### Monthly Snapshot Coverage

| Period | Store KPI stores | Store KPI rows | Employee performance rows |
| --- | ---: | ---: | ---: |
| 2026-01 | 153 | 1363 | 0 |
| 2026-02 | 153 | 1367 | 0 |
| 2026-03 | 154 | 1380 | 0 |
| 2026-04 | 157 | 1383 | 0 |
| 2026-05 | 154 | 1369 | 0 |
| 2026-06 | 156 | 1380 | 0 |

Note: monthly employee performance snapshot rows are still zero. Current personnel ranking/read surfaces must therefore continue to be validated through the live KPI actual/ranking service path rather than assuming `rpt.employee_performance_snapshot` is populated.

### Approved Personnel Targets

| Period | Target rows | Employees | Stores | Total target |
| --- | ---: | ---: | ---: | ---: |
| 2026-01 | 17 | 17 | 7 | 15,810,446.00 |
| 2026-02 | 22 | 22 | 9 | 20,395,667.00 |
| 2026-03 | 26 | 26 | 9 | 25,240,283.70 |
| 2026-04 | 31 | 31 | 10 | 21,583,482.32 |
| 2026-05 | 42 | 42 | 11 | 29,838,897.42 |
| 2026-06 | 32 | 32 | 9 | 31,165,100.45 |

### Monthly Net Sales Actual Coverage

| Period | Scope | Stores | Employees | Rows | Total actual |
| --- | --- | ---: | ---: | ---: | ---: |
| 2026-01 | employee | 152 | 582 | 582 | 434,614,595.73 |
| 2026-01 | store | 153 | 0 | 153 | 495,460,244.54 |
| 2026-02 | employee | 153 | 631 | 631 | 320,409,168.03 |
| 2026-02 | store | 153 | 0 | 153 | 336,356,014.39 |
| 2026-03 | employee | 154 | 727 | 727 | 531,205,124.21 |
| 2026-03 | store | 154 | 0 | 154 | 523,662,829.31 |
| 2026-04 | employee | 154 | 675 | 675 | 366,493,061.06 |
| 2026-04 | store | 154 | 0 | 154 | 372,450,726.44 |
| 2026-05 | employee | 154 | 632 | 632 | 575,946,719.56 |
| 2026-05 | store | 154 | 0 | 154 | 624,502,451.87 |
| 2026-06 | employee | 155 | 580 | 580 | 417,737,307.76 |
| 2026-06 | store | 153 | 0 | 153 | 502,693,094.11 |

### Active Assignment Position Split

| Position | Active employees | Stores |
| --- | ---: | ---: |
| SALES_ASSOCIATE | 608 | 155 |
| STORE_MANAGER | 129 | 121 |
| SHIFT_LEAD | 38 | 37 |
| ASSISTANT_MANAGER | 24 | 24 |
| CASHIER | 1 | 1 |

### Ranking Eligibility Rerun

| Period | Eligible | Store managers excluded | Below 50,000 TL | Below 2% share | Missing store sales |
| --- | ---: | ---: | ---: | ---: | ---: |
| 2026-01 | 523 | 41 | 13 | 5 | 0 |
| 2026-02 | 558 | 43 | 25 | 5 | 0 |
| 2026-03 | 616 | 51 | 50 | 10 | 0 |
| 2026-04 | 593 | 46 | 33 | 3 | 0 |
| 2026-05 | 546 | 51 | 27 | 8 | 0 |
| 2026-06 | 486 | 51 | 30 | 9 | 4 |

This confirms the official personnel ranking eligibility policy is active in data readback: store managers are excluded, rows below 50,000 TL are excluded, and rows below 2% store sales share are excluded.

### Norm Kadro Demo Readback

| Store | Active | Norm | Gap | YTD leavers |
| --- | ---: | ---: | ---: | ---: |
| Bursa Downtown Avm | 3 | 3 | 0 | 92 |
| Bursa Marka Park Avm | 7 | 8 | 1 | 1 |
| Istanbul Marmara forum Avm | 8 | 8 | 0 | 1 |

The Bursa Downtown leaver count is intentionally left as a data-hygiene risk instead of being patched in a snapshot table. If it affects the pilot view, the source turnover event set must be reviewed and corrected through the reconciliation/source-data path.

