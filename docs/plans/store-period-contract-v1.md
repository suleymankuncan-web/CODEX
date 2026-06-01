# Store Period Contract V1

This plan records the Store rankings and Store Me period semantics agreed on
2026-06-01. It exists so the daily/monthly work can proceed in small PRs
without hiding API or role-behavior changes inside UI polish.

## Product Semantics

- Monthly selection means the loaded monthly cumulative period. During daily
  imports this is month-to-date, using the latest loaded monthly period end.
- Single-day selection means only that day's data. It is not cumulative.
- Empty or unloaded dates must render honest empty states. Do not synthesize
  rankings, scores, KPI values, or rank positions.
- Store manager and store personnel rankings remain Top 100 scoped. If their
  row is outside the visible Top 100 and the backend does not return an owned
  current row, the UI must not invent the rank.
- Store manager and store personnel do not receive KPI detail columns on
  `/store/rankings`; privileged roles may receive detail metrics.
- `/store/me` and `/store/personnel/:employeeId` keep their existing live
  daily/monthly profile contract and should converge visually with the same
  period semantics.

## Current Repo Evidence

| Surface | Current contract | Evidence |
| --- | --- | --- |
| `/api/reports/rankings` | Live rankings now accept `periodType=daily\|monthly`; response `source.periodType` and `availablePeriods[].periodType` reflect the selected loaded period. | `backend/nestjs/src/modules/store-ops/web/dto/get-ranking.query.ts`, `backend/nestjs/src/modules/store-ops/application/ranking.service.ts`, `docs/api/openapi.json` |
| `/store/rankings` UI | Frontend still submits monthly rankings only. Day selection remains a UI empty-state placeholder until the next frontend PR wires daily requests. | `admin-web/src/features/reports/api.ts`, `admin-web/src/pages/StoreRankingsPage.tsx` |
| `/store/me` and personnel profile | Live period query already supports `daily`, `weekly`, and `monthly`; page model exposes loaded daily/monthly periods from real `availablePeriods`. | `admin-web/src/pages/StoreMyPerformancePage.tsx`, `admin-web/src/pages/store-my-performance-model.ts` |

## PR Train

1. **PR-1: Rankings Period API Contract**
   - Expand the rankings backend query contract from monthly-only to
     daily/monthly.
   - Preserve response shape, role access, ranking sort, KPI scoring, checklist
     weights, and DB schema.
   - Verification: backend ranking service/repository tests, backend lint/build,
     OpenAPI generation, frontend API type generation.

2. **PR-2: Rankings Frontend Period Wiring**
   - Add `periodType` to the frontend rankings API client.
   - Convert day selection from local empty placeholder to
     `periodType=daily&periodStart=YYYY-MM-DD`.
   - Restrict day options to loaded `availablePeriods` dates only.
   - Keep monthly default cumulative/month-to-date.
   - Verification: targeted rankings Playwright tests plus frontend lint/build.

3. **PR-3: Rankings Role Visibility Finalization**
   - Re-check store manager and store personnel summary-only ranking UI.
   - Keep profile action visible only for self or authorized in-scope rows.
   - Ensure Top 100 outside-scope states are honest and do not fake ranks.
   - Verification: targeted role/scope Playwright tests.

4. **PR-4: Store Me Period Parity**
   - Align `/store/me` date controls with the finalized rankings period language.
   - Preserve existing daily/monthly profile API behavior and score semantics.
   - Ensure unloaded dates show empty/fallback states without fake coaching,
     score, rank, or trend.
   - Verification: targeted Store Me and personnel profile Playwright tests.

## Stop Rules

- Stop if daily rankings require a DB migration, data repair, or queue/import
  lifecycle change.
- Stop if backend data cannot distinguish a cumulative monthly row from a daily
  row by `period_type`, `period_start`, and `period_end`.
- Stop if role scope would need a permission semantic change.
- Stop if UI work would require fake ranking rows, fake KPI detail, or fake rank
  positions.
