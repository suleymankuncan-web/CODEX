# Reporting Repository Boundary Inventory V1

Date: 2026-05-20

## Purpose

Record the current `ReportingRepository` shape before any production code
movement. This is the safe first slice from
`technical-debt-resolution-roadmap-v1.md` Phase 2.1.

This document changes no production code, SQL, DTO, API response shape,
authorization behavior, DB schema, CSS, or user-facing behavior.

## Sokrates Decision

- Claim: `ReportingRepository` is a current backend hotspot and should be split
  only after its natural read boundaries and tests are clear.
- Evidence: the repository is 2141 physical lines, 1973 non-empty lines, and 38
  async methods on `origin/main` at PR #337.
- Counterargument: the older risk review correctly warned against splitting a
  large reporting read model only because of line count.
- Decision: proceed with inventory and test-map only; do not move code in this
  slice.
- Risk: LOW for this documentation slice; future code movement is MEDIUM and
  must be verified by targeted backend tests plus build.
- Door: two-way door; a docs-only inventory can be reverted normally.
- Stop rule: stop before implementation if a split requires query shape,
  auth/scope, API response, DB index, or scoring behavior changes.

## Current Shape

Measured files:

- `backend/nestjs/src/modules/store-ops/infrastructure/reporting.repository.ts`
  - 2141 physical lines
  - 1973 non-empty lines
  - 38 async methods
- `backend/nestjs/src/modules/store-ops/application/reporting.service.ts`
  - 1831 physical lines
- `backend/nestjs/src/modules/store-ops/infrastructure/reporting.repository.spec.ts`
  - 530 physical lines

The repository is not random utility code. It is a large reporting read-model
adapter that currently combines snapshot report reads, live KPI reads, ranking
reads, leaderboard reads, benchmark reads, store score inputs, and identity
lookup helpers.

## Caller Map

Primary callers:

- `ReportingService`
  - snapshot run list, row counts, report summary
  - workforce, KPI, checklist, and turnover report detail rows
  - store KPI highlights and store score breakdown
  - live and closed personnel performance profiles
  - closed leaderboard orchestration fallback
- `RankingService`
  - live ranking period discovery
  - store/personnel ranking rows and filters
  - store/personnel Turkey benchmark values
  - auth identity to employee resolution
- `ClosedRankingService`
  - daily closed snapshot lookup
  - closed employee performance snapshot
  - auth identity to employee resolution
- `LiveMonthlyLeaderboardService`
  - live monthly leaderboard fallback
  - personnel period lookup, benchmark lookup, and peer rows
- `WorkflowInboxService`
  - latest completed snapshot lookup
  - KPI exception feed rows

Provider registration:

- `backend/nestjs/src/modules/store-ops/store-ops.module.ts`

## Method Family Map

### Snapshot Report Reads

Methods:

- `getLatestCompletedSnapshotRun`
- `getLatestCompletedSnapshotRunByType`
- `getCompletedSnapshotRunByTypeAndDate`
- `getCompletedDailySnapshotByDate`
- `getSnapshotRowCounts`
- `listSnapshotRuns`
- `getWorkforceReport`
- `getKpiReport`
- `getChecklistReport`
- `getTurnoverReport`

Natural boundary:

- `SnapshotReportingReadRepository`

Why it can move later:

- It is a cohesive read boundary around snapshot runs and report detail rows.
- It has a clear caller in `ReportingService` plus a smaller feed caller in
  `WorkflowInboxService`.

Main risks:

- Report pagination/count semantics.
- Snapshot run date casting.
- Store/company/region scope filtering.
- KPI exception feed behavior.

Test map:

- `backend/nestjs/src/modules/store-ops/infrastructure/reporting.repository.spec.ts`
  - closed daily snapshot selection
  - API-safe date casting
  - access scope contract
- `backend/nestjs/test/integration/reporting.e2e-spec.ts`
  - snapshot runs
  - workforce/KPI/checklist/turnover report rows
  - reporting summary
- `backend/nestjs/test/integration/snapshot-run-read-models.e2e-spec.ts`
  - snapshot run list/detail/read models

### Store Score Breakdown Reads

Methods:

- `getStoreKpiSnapshotRowsForScore`
- `getStoreChecklistSnapshotForScore`

Natural boundary:

- `StoreScoreReportingReadRepository`

Why it can move later:

- Small method family with focused tests and a clear service-level consumer.

Main risks:

- KPI/checklist blend inputs.
- BM/VM checklist template-type semantics.
- Snapshot/store scoping.

Test map:

- `backend/nestjs/src/modules/store-ops/infrastructure/reporting.repository.spec.ts`
  - store monthly score breakdown queries
- `backend/nestjs/src/modules/store-ops/application/reporting.service.store-score-blend.spec.ts`
  - KPI plus BM/VM contribution
  - missing checklist weight redistribution
  - store scope rejection
- `backend/nestjs/src/modules/store-ops/application/store-score-blend.service.spec.ts`
  - blend math
- `backend/nestjs/src/modules/store-ops/web/reporting.controller.store-score-blend.spec.ts`
  - controller-to-service scope propagation
- `backend/nestjs/src/modules/store-ops/checklist-store-score-integration-schema-contract.spec.ts`
  - checklist snapshot SQL contract

### Live Store KPI And Benchmark Reads

Methods:

- `getStoreNameById`
- `getLatestStoreKpiPeriod`
- `listStoreKpiPeriods`
- `getStorePerformanceRows`
- `getPeerStorePerformanceRows`
- `getStoreTurkeyBenchmarkValues`
- `listRankingStoreChecklistRows`

Natural boundary:

- `StorePerformanceReportingReadRepository`

Why it can move later:

- These methods feed live store KPI highlights and live store ranking behavior.

Main risks:

- Store/region/company scope filtering.
- Turkey benchmark aggregation semantics.
- Ranking source filters that exclude demo seed rows.
- Monthly checklist rows used as scored store KPI inputs.

Test map:

- `backend/nestjs/src/modules/store-ops/infrastructure/reporting.repository.spec.ts`
  - benchmark queries
  - ranking source filters
- `backend/nestjs/src/modules/store-ops/application/reporting.service.kpi-benchmark-scoring.spec.ts`
  - store live KPI scoring and capped benchmark metadata
  - completed BM/VM checklist visits in live store KPI highlights
- `backend/nestjs/src/modules/store-ops/application/kpi-benchmark-scoring.service.spec.ts`
  - scoring math
- `admin-web/e2e/kpi-benchmark-explainability.spec.ts`
  - frontend explainability path when UI surface is touched

### Live Personnel KPI And Benchmark Reads

Methods:

- `getLatestEmployeeKpiPeriod`
- `listEmployeeKpiPeriods`
- `getEmployeePerformanceRows`
- `getPeerEmployeePerformanceRows`
- `getEmployeeTurkeyBenchmarkValues`
- `getActiveEmployeeAssignmentScope`

Natural boundary:

- `PersonnelPerformanceReportingReadRepository`

Why it can move later:

- These methods are cohesive around live personnel performance and leaderboard
  fallback.

Main risks:

- Personnel profile authorization and assignment fallback.
- Store personnel self-scope, store manager assigned-store scope, and region
  manager region scope.
- Approved personnel target reference joins.
- Custom imported period compatibility.

Test map:

- `backend/nestjs/src/modules/store-ops/infrastructure/reporting.repository.spec.ts`
  - access scope contract
  - personnel target reference queries
  - personnel period compatibility
- `backend/nestjs/src/modules/store-ops/application/reporting.service.kpi-benchmark-scoring.spec.ts`
  - target achievement scoring
  - custom imported monthly periods
  - closed personnel profile fallback
  - personnel profile access rules
- `backend/nestjs/src/modules/store-ops/application/reporting.service.live-leaderboard.spec.ts`
  - live monthly leaderboard fallback scope
- `backend/nestjs/test/integration/auth-scope.e2e-spec.ts`
  - reporting read access under auth scopes

### Ranking And Closed Leaderboard Reads

Methods:

- `getLatestMonthlyRankingPeriod`
- `listRankingAvailablePeriods`
- `listRankingStoreKpiRows`
- `listRankingStoreChecklistRows`
- `listRankingPersonnelKpiRows`
- `listRankingFilterOptions`
- `getEmployeePerformanceSnapshot`
- `getEmployeeKpiSnapshotRows`
- `listClosedPersonnelLeaderboard`
- `listClosedStoreLeaderboardRows`

Natural boundary:

- `RankingReportingReadRepository`

Why it can move later:

- This is the strongest first code-extraction candidate because the methods are
  high-density, heavily queried, and mostly ranking/leaderboard specific.

Main risks:

- Live and closed ranking source filters.
- Daily/monthly closed leaderboard semantics.
- Current employee row and metric mini-rank behavior.
- Demo seed exclusion.
- Store checklist rows reused by store KPI highlights.

Test map:

- `backend/nestjs/src/modules/store-ops/infrastructure/reporting.repository.spec.ts`
  - ranking source filters
  - benchmark queries
- `backend/nestjs/src/modules/store-ops/application/reporting.service.live-leaderboard.spec.ts`
  - monthly live fallback
- `backend/nestjs/test/integration/reporting.e2e-spec.ts`
  - daily closed ranking
  - monthly closed ranking
  - personal closed performance

### Identity Lookup Helpers

Methods:

- `getEmployeeIdForUser`
- `resolveEmployeeIdForAuthIdentity`
- `getEmployeeIdByExternalRef`
- `isUuid`

Natural boundary:

- `ReportingEmployeeIdentityReadRepository` or a future auth/employee identity
  read model.

Why it should not move first:

- This touches auth-adjacent identity resolution and profile access. It is not
  the safest first implementation slice.

Main risks:

- Company-scope requirement for external employee references.
- Deterministic seed UUID bypass behavior.
- Personal performance and ranking authorization.

Test map:

- `backend/nestjs/src/modules/store-ops/infrastructure/reporting.repository.spec.ts`
  - external reference company-scope guard
  - deterministic UUID compatibility
- `backend/nestjs/src/modules/store-ops/application/reporting.service.kpi-benchmark-scoring.spec.ts`
  - personnel profile access rules
- `backend/nestjs/test/integration/auth-scope.e2e-spec.ts`
  - report viewer and region-scope access

### Shared Scope Helpers

Methods:

- `hasStoreAccessScope`
- `applyStoreAccessScope`
- `applyTurnoverAccessScope`
- `countRows`

Natural boundary:

- Keep in place until the first concrete extraction shows whether a shared
  helper module is actually useful.

Why it should not move first:

- Premature shared-helper extraction could couple future repositories around
  the wrong abstraction.

## Recommended Code Extraction Order

1. `StoreScoreReportingReadRepository`
   - Smallest cohesive move; good first implementation slice if the goal is to
     prove the provider/injection split pattern with low blast radius.
   - Include store score repository/service/controller tests.
2. `RankingReportingReadRepository`
   - Move ranking/closed leaderboard reads first only if the PR can preserve
     `RankingService`, `ClosedRankingService`, and `ReportingService` behavior
     with a normal provider injection change.
   - Include repository tests plus reporting integration tests.
3. `SnapshotReportingReadRepository`
   - Valuable but broader because it touches admin report detail/list/read
     surfaces and `WorkflowInboxService`.
4. `StorePerformanceReportingReadRepository`
   - Move after ranking/store score because store performance shares benchmark
     and checklist inputs.
5. `PersonnelPerformanceReportingReadRepository`
   - Move after store performance because auth/scope risk is higher.
6. Identity lookup helper boundary
   - Move only after a dedicated auth/employee identity decision.

## Recommended First Implementation Slice

Preferred first code slice:

- Extract `StoreScoreReportingReadRepository`.

Reason:

- It is smaller than the ranking boundary, has clear tests, and exercises the
  provider/injection split pattern with lower blast radius.

Alternative if product/ranking work appears first:

- Extract `RankingReportingReadRepository`, but only if the final diff remains
  reviewable in one paragraph and does not pull in live personnel profile
  identity helpers.

## Verification Ladder For First Code Slice

For `StoreScoreReportingReadRepository`:

```powershell
npm.cmd --prefix backend/nestjs test -- reporting.repository.spec.ts --runInBand
npm.cmd --prefix backend/nestjs test -- reporting.service.store-score-blend.spec.ts --runInBand
npm.cmd --prefix backend/nestjs test -- store-score-blend.service.spec.ts --runInBand
npm.cmd --prefix backend/nestjs test -- reporting.controller.store-score-blend.spec.ts --runInBand
npm.cmd --prefix backend/nestjs run build
```

If provider wiring or module exports expand beyond the small boundary:

```powershell
npm.cmd --prefix backend/nestjs test -- reporting.e2e-spec.ts --runInBand
npm.cmd --prefix backend/nestjs test -- --runInBand
```

## Stop Rules For Implementation

Stop and re-plan if any of these appears:

- SQL changes are needed for the extraction.
- Query output row shape changes.
- API response shape changes.
- Auth/scope filtering moves without a targeted regression test.
- `SUPER_ADMIN`, region, store, assigned-store, or personnel self-scope behavior
  changes.
- A DB index or migration becomes necessary.
- The split requires changes in frontend code.
- The PR cannot be explained as one read-boundary extraction.

## What This Inventory Changes

Nothing at runtime.

It only narrows the next safe backend refactor from "split the reporting
repository" to a testable first code slice: `StoreScoreReportingReadRepository`,
with `RankingReportingReadRepository` as the next candidate when ranking work
or query-pressure evidence makes it the better first move.
