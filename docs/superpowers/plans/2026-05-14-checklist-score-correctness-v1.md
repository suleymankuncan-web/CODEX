# Checklist Score Correctness V1

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans or test-driven development discipline to implement this plan task-by-task. Keep this slice narrow: correctness guards first, product UI changes only if a failing test proves the need.

**Goal:** Make rankings use completed BM/VM checklist evidence consistently with the store score profile, while keeping missing checklist visits non-penalizing.

**Architecture:** Backend-first slice. The existing `StoreScoreBlendService` already handles monthly score breakdowns. The gap is the live rankings read model: store KPI rows come from `ops.kpi_actual`, while completed checklist visits live in `ops.checklist_instance` / `rpt.store_checklist_snapshot`. Add a repository read model for completed monthly checklist averages and merge those rows into `RankingService` before scoring.

**Tech Stack:** NestJS, TypeScript, PostgreSQL SQL, Jest, React/Vite Playwright smoke if frontend display needs adjustment.

## Current Finding

- `getStoreMonthlyScoreBreakdown` already reads BM and VM checklist snapshots by template type.
- `RankingService` scores `BM_CHECKLIST` and `VM_CHECKLIST` correctly when those metric rows are present.
- `listRankingStoreKpiRows` currently reads only `ops.kpi_actual`; completed checklist visits from the checklist workflow can be invisible to rankings unless imported as KPI facts.
- Missing checklist weights already return to KPI performance in `scoreStoreProfileWithChecklistFallback`.

## Implementation Order

1. Add a failing backend service test proving completed checklist rows feed store rankings even when `ops.kpi_actual` has no checklist metric rows.
2. Add repository SQL test for a new completed checklist ranking read model.
3. Implement `ReportingRepository.listRankingStoreChecklistRows`.
4. Merge checklist rows with KPI rows in `RankingService`.
5. Run focused backend tests and frontend rankings smoke if touched behavior leaks to UI.
6. Run release check, commit, push, and open PR.

## Detailed Steps

- [x] Add `listRankingStoreChecklistRows` to ranking repository mocks.
- [x] Add `RankingService` test:
  - KPI rows contain only `TARGET_ACHIEVEMENT`, `CR`, `ATV`, `UPT`.
  - completed checklist rows contain `BM_CHECKLIST = 80`, `VM_CHECKLIST = 100`.
  - store ranking score becomes `99` with default `90/5/5` store profile.
  - row metrics expose both checklist values.
- [x] Add repository test asserting the checklist ranking query:
  - reads `ops.checklist_instance`
  - joins `ops.checklist_template`
  - requires `ci.status = 'completed'`
  - filters by `ci.completed_at::date BETWEEN ...`
  - maps `BM_STORE_VISIT` to `BM_CHECKLIST` and `VM_STORE_VISIT` to `VM_CHECKLIST`
  - respects `store.kpi_import_enabled = TRUE`
- [x] Implement the repository method with company scope support.
- [x] Update `RankingService.getRankings` to request and merge completed checklist rows for store scoring.
- [x] Verify frontend rankings still show BM/VM columns and no signal chrome regression.

## Verification

- [x] `npm.cmd --prefix backend/nestjs test -- src/modules/store-ops/application/ranking.service.spec.ts src/modules/store-ops/infrastructure/reporting.repository.spec.ts --runInBand`
- [x] `npm.cmd --prefix backend/nestjs test -- src/modules/store-ops/application/store-score-blend.service.spec.ts src/modules/store-ops/application/reporting.service.store-score-blend.spec.ts --runInBand`
- [x] `npm.cmd --prefix backend/nestjs run build`
- [x] `npm.cmd --prefix admin-web run test:e2e -- e2e/store-surfaces.spec.ts --grep "store rankings"`
- [x] `npm.cmd run check:release`

## Out Of Scope

- Changing checklist weights.
- Changing the visual design of rankings.
- New checklist template workflow.
- Backfilling production data.
- Replacing live rankings with closed snapshot rankings.
