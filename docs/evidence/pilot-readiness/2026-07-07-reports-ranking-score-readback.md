# Reports Ranking Score Export Readback - 2026-07-07

Scope: `PRA-20260707-02` (`/store/reports` monthly Excel package).

## Root Cause

The monthly report package tried to read the store score from `ops.kpi_actual` metric codes
`WEIGHTED_STORE_SCORE` / `STORE_SCORE`.

The active ranking score is not stored as a single KPI actual row. It is calculated by the
central `RankingService` from the current KPI score profile and the store KPI/checklist inputs.
Because the export bypassed that service, the Excel `Skor` column rendered `Veri yok` even when
the Rankings/KPI surfaces had enough data to calculate a score.

The report manager fallback also stripped only `Bölgesi`, not ASCII `Bolgesi`, so region names
such as `Onur Kaytan Bolgesi` appeared in the `Bölge Müdürü` column.

## Fix

- `StoreMonthlyReportPackageService` now optionally receives `RankingService`.
- The report controller passes the authenticated user's ranking context to the package service.
- For the selected monthly period, package rows are mapped by `store_id` to the central ranking
  service's `storeLeaderboard.items[].scoreValue`.
- The report still exports only the report scope rows; the ranking response is used only as the
  score source map.
- The region manager fallback strips both `Bölgesi` and `Bolgesi`.

## Live Readback

Readback used the configured staging database and the current Onur Kaytan region-manager scope
for `2026-06`. No passwords, connection strings, cookies, OTP values, tokens, email inbox data,
or private credentials were recorded.

| Check | Before | After |
| --- | ---: | ---: |
| Report rows | 30 | 30 |
| Rows with empty score | 30 | 1 |
| Unique manager display values | `Onur Kaytan Bolgesi` | `Onur Kaytan` |
| Workbook sheet | opens | opens |
| Header encoding | previously at risk | `Bölge Müdürü`, `Mağaza`, `Rapor aralığı`, `Ziyaretten geçen gün` |
| First data score | `Veri yok` | `87,20` |

Sample after-fix rows:

| Store | Score | Manager | Note |
| --- | ---: | --- | --- |
| Balıkesir 10 Burda AVM | 87,20 | Onur Kaytan | Tamam |
| Balıkesir Edremit Avm | 93,99 | Onur Kaytan | Tamam |
| Bursa Downtown Avm | 74,81 | Onur Kaytan | Tamam |

## Remaining Data Risk

Turnover remains a data-hygiene risk, not an Excel formatting issue. Live readback found repeated
termination events in `ops.turnover_event`; for example, some stores had the same employee repeated
across multiple month-end event dates. That produces values such as `%1.150 / 46 ayrılan` in the
report. Fixing this safely requires a turnover-event reconciliation decision, not a workbook-only
patch.
