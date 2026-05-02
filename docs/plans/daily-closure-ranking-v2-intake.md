# Daily Closure Ranking V2 Intake

## Purpose

This note opens the feature intake gate for the next Daily Closure / Historical Ranking step.

Important correction:

- Daily Closure / Historical Ranking is not a from-zero feature anymore.
- V1 already exists in backend, frontend, tests, and migrations.
- V2 should strengthen trust, explainability, and manager usability without creating a second ranking engine.

## Current V1 Evidence

Backend:

- `backend/nestjs/src/modules/store-ops/application/closed-ranking.service.ts`
- `backend/nestjs/src/modules/store-ops/application/closed-ranking.contract.ts`
- `backend/nestjs/src/modules/store-ops/web/reporting.controller.ts`
- endpoint: `GET /api/reports/leaderboards/closed`

Data:

- `rpt.employee_performance_snapshot`
- `rpt.employee_kpi_snapshot`
- `rpt.snapshot_run`
- read indexes in `db/migrations/021_closed_ranking_read_indexes.sql`

Frontend:

- `admin-web/src/pages/StoreRankingsPage.tsx`
- store route: `/store/rankings`

Current V1 supports:

- daily and monthly closed ranking
- selected day/month
- store rank and Turkey rank
- weighted total score ordering
- KPI mini-ranks
- month-to-date calculation from completed daily snapshots
- `daysWithPerformance / closedDaysInPeriod`
- minimum 3 closed performance days for official monthly rank
- no-data and not-closed states

## Feature Intake Interview

### 1. Who is this for?

Primary V2 users:

- `STORE_PERSONNEL`
- `STORE_MANAGER`

Secondary later users:

- `REGION_MANAGER`
- `HR_ADMIN`
- `SUPER_ADMIN`

V2 should stay store-shell first. Admin and region expansion can come later when the operational question is clearer.

### 2. What exact problem are we solving?

V1 can show the rank, but the next product problem is trust:

- Is this ranking official or preview-only?
- Why does a person have no rank?
- Which closed days are counted?
- Which days are missing performance data?
- Can a store manager understand the store team without guessing from one card?

Out of scope for V2:

- region leagues
- tournaments
- rewards
- new score formula
- second ranking engine
- attendance/worked-day truth without HR/timekeeping integration

### 3. What permission and scope boundary applies?

Rules stay the same:

- `STORE_PERSONNEL` can read only self-oriented closed ranking context.
- `STORE_MANAGER` can read assigned-store personnel ranking context.
- Store manager write/action authority still depends on `actionScope.assignedStoreIds`.
- Ranking reads must not leak unmanaged store personnel details.
- Region/admin views are not part of the first V2 implementation.

### 4. What data does it touch?

V2 should initially be read-model only.

Data owners:

- `rpt`: closed snapshot and ranking read models
- `ops`: employee/store identity and assignment metadata
- `audit`: closure/recompute traceability, if exposed later

No new schema is required for the first V2 step.

Possible future schema only if needed:

- closure data-quality diagnostics
- closure approval/sign-off
- immutable recompute explanation records

### 5. What existing flows does it connect to?

Connected:

- snapshot runs
- closed employee performance snapshots
- closed employee KPI snapshots
- `/store/rankings`
- `/store/me` closed mode
- KPI config/grading labels

Not connected in V2:

- Operational Feed
- Competitions
- target distribution approvals
- incentive payout
- attendance import

### 6. How do we know it is correct?

Required checks for V2 implementation:

- backend service test for any new response field or state
- frontend Playwright smoke for readable coverage/official/preview copy
- no data leakage between store personnel and store manager scopes
- `npm.cmd run check:release` from workspace root before completion

## Approaches

### Option A: New Ranking Engine

Build a new closure/ranking subsystem.

Tradeoff:

- high risk of duplicating V1 and creating a second source of truth
- not recommended

### Option B: Strengthen The Existing Closed Ranking Read Model

Keep the existing backend endpoint and read model, but add trust/explainability fields and clearer store manager presentation.

Tradeoff:

- smaller, safer, and aligned with current architecture
- recommended

### Option C: UI-Only Polish

Only rewrite UI copy and cards without backend changes.

Tradeoff:

- useful, but limited if the UI cannot distinguish official, preview, no-data, and missing-day reasons precisely
- acceptable only for very small copy fixes

## Recommended V2 Slice

Use Option B.

V2A should be:

1. Add a small `rankingStatus` / `eligibilityReason` style explanation to the closed ranking contract, derived from existing coverage and source state.
2. Show Turkish-first labels on `/store/rankings`:
   - official ranking
   - preview only
   - not closed yet
   - no performance data
   - one more closed performance day needed
3. Keep the endpoint and tables unchanged unless a failing test proves a missing backend field is necessary.

This is deliberately small. It improves trust without touching score math.

## CODEX DURUST YORUM

This module is already in a healthier state than the backlog suggested. The risk is not that ranking does not exist; the risk is that users may not understand whether a number is official, preview-only, or absent because of missing data.

I do not recommend a new schema or new ranking engine now. That would be product overbuild and could create the second source of truth we have been avoiding.

I recommend continuing with a small V2 explainability slice first. If users understand the rank, coverage, and official/preview state, then later region/league/tournament ideas can build on it instead of fighting it.

## Decision

Proceed with Daily Closure Ranking V2 as an explainability and trust layer over the existing V1 closed ranking read model.

Do not start region leagues or tournament ranking inside this module.

## Next Logical Step

Write the V2 implementation plan for `rankingStatus` / `eligibilityReason` and Turkish-first `/store/rankings` copy, then implement it with TDD.
