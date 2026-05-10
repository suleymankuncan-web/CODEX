# ReportingRepository Risk Review - 30 April 2026

## Purpose

Review `backend/nestjs/src/modules/store-ops/infrastructure/reporting.repository.ts` before opening another refactor.

This is a risk review only.

No production behavior, SQL, migration, DTO, controller, auth rule, scoring rule, or UI behavior is changed by this document.

## Current Shape

`ReportingRepository` is large: 1897 physical lines and 1737 non-empty lines.

It currently owns several read-heavy families:

- snapshot run lookup, list, row counts, and completed daily/monthly snapshot selection
- workforce, KPI, checklist, and turnover report read models from `rpt.*` snapshots
- store live performance rows from `ops.kpi_actual`
- employee live performance rows from `ops.kpi_actual`
- Turkey benchmark aggregation for store and employee KPI scoring
- store score breakdown read inputs from monthly KPI/checklist snapshots
- closed daily personnel ranking rows and metric mini-ranks
- closed monthly personnel aggregate rows and metric mini-ranks
- closed personnel and store leaderboard rows
- auth identity to employee lookup helpers used by personal performance/ranking surfaces

This is not random code. The file is a reporting/read-model boundary that accumulated several related reporting use cases.

## Caller Surfaces

Primary callers:

- `ReportingService`
  - snapshot run list and row counts
  - workforce, KPI, checklist, turnover reports
  - store KPI highlights
  - store score breakdown
  - employee personal performance
  - Turkey benchmark support
- `ClosedRankingService`
  - completed daily snapshot lookup
  - closed daily/monthly personnel ranking rows
  - closed metric mini-ranks
  - personal closed performance snapshot
- `WorkflowInboxService`
  - latest completed snapshot and KPI report summary

This means a broad split would have high review cost unless it is driven by one concrete reporting/ranking change.

## Green Signals

- Empty read scope is guarded before querying for report lists and employee KPI period lookups.
- External employee reference resolution refuses to run without company scope.
- Read APIs are paginated for broad snapshot report lists.
- Snapshot report list endpoints use a data query plus a count query instead of returning unbounded lists.
- Closed daily and monthly ranking behavior is covered by integration tests.
- Benchmark math is covered by repository tests and uses PowerBI-compatible metric-specific rules for ranking Turkey references.
- Approved personnel target references are tested in live employee performance queries.
- Store score breakdown reads are covered by repository tests.
- Snapshot run read models were already split and guarded separately in e2e tests.
- Existing snapshot tables are intentionally read-oriented and immutable in the current schema design.

## Test Evidence

Direct repository tests:

- `backend/nestjs/src/modules/store-ops/infrastructure/reporting.repository.spec.ts`
  - closed daily snapshot selection
  - monthly closed ranking snapshot selection
  - API-safe snapshot date casting
  - empty-scope fail-closed behavior
  - store monthly score breakdown inputs
  - Turkey benchmark weighted-total formulas
  - approved personnel target reference joins

Integration coverage:

- `backend/nestjs/test/integration/reporting.e2e-spec.ts`
  - snapshot runs
  - workforce, KPI, checklist, turnover report rows
  - reporting summary
  - daily closed ranking
  - personal closed performance
  - monthly closed ranking
- `backend/nestjs/test/integration/snapshot-run-read-models.e2e-spec.ts`
  - snapshot run list/detail/read models and evidence surfaces
- `backend/nestjs/test/integration/auth-scope.e2e-spec.ts`
  - report viewer access
  - JWT mode reporting reads
  - region scope restrictions for reporting reads

## Risk Assessment

### P1 - Ownership Density

The file combines admin reporting, live KPI performance, benchmark aggregation, closed rankings, leaderboards, and identity-to-employee lookup helpers.

Risk:

- Future changes can be harder to review because unrelated read concerns live in one large repository.
- A broad split could accidentally weaken auth/scope behavior if done without a concrete boundary.

Decision:

- Do not split only because of line count.
- Split only when one concrete change touches one family of reads.

### P1 - Read-Heavy Query Scale

The highest future pressure is likely not TypeScript size; it is query behavior when real pilot data grows.

Likely pressure points:

- live store/personnel performance reads from `ops.kpi_actual`
- Turkey benchmark aggregations over KPI actuals
- closed monthly personnel aggregate rows over multiple daily snapshots
- leaderboard/ranking queries with metric mini-ranks
- snapshot report list count queries on large snapshot tables

Decision:

- Do not add speculative indexes today.
- Run index/query review only after real pilot row volume or slow-query evidence exists.

### P1 - Monthly Closed Ranking Query Complexity

`listClosedMonthlyPersonnelAggregateRows` and `listClosedMonthlyMetricRankRows` aggregate multiple daily snapshots and calculate ranks.

Risk:

- With many employees, many days, and multiple KPI rows, monthly ranking can become one of the first reporting hot paths.

Current guard:

- Ranking snapshot indexes already exist around `snapshot_run_id`, score, store, employee, and KPI dimensions.
- Integration tests lock the intended monthly evidence behavior.

Decision:

- Keep current query until measured volume proves it is slow.
- If slow, prefer query evidence plus targeted index/materialized read-model plan over a blind refactor.

### P2 - Identity Lookup Boundary

`resolveEmployeeIdForAuthIdentity`, `getEmployeeIdForUser`, and `getEmployeeIdByExternalRef` live inside reporting persistence.

Risk:

- The lookup is conceptually closer to auth/user/account or employee identity read models.
- Moving it now could disturb personal performance/ranking authorization.

Decision:

- Do not move it now.
- Revisit only with a dedicated auth/employee identity read-model boundary decision.

### P2 - Shaped CTE SELECT Star

The monthly personnel aggregate query uses `SELECT *` inside a shaped CTE.

Risk:

- Low immediate production risk, but explicit columns would be clearer if that query is touched later.

Decision:

- Do not edit it as a standalone cleanup.
- If monthly ranking query changes later, replace with explicit columns as part of that same slice.

### P2 - Count Query Cost

Broad report list methods run a data query and a separate count query.

Risk:

- Fine for current expected size, but count queries can become expensive on large snapshots.

Decision:

- Keep the current API contract.
- Revisit only if large snapshot tables make report pagination slow.

## Split Candidates

Recommended future split order, only when a matching feature or issue appears:

1. `ClosedRankingReadRepository`
   - daily/monthly closed ranking rows
   - metric mini-ranks
   - closed leaderboard rows
   - best candidate if ranking expands again
2. `PerformanceReadRepository`
   - store live performance rows
   - employee live performance rows
   - peer rows
   - Turkey benchmarks
   - best candidate if KPI performance/benchmark behavior changes again
3. `SnapshotReportRepository`
   - snapshot run list/detail/counts
   - workforce/KPI/checklist/turnover snapshot read models
   - best candidate if admin reporting screens grow
4. Auth/employee identity read model
   - only after a dedicated auth/employee boundary decision

## What Not To Do Now

- Do not split all reporting code in one pass.
- Do not add indexes without real row-volume or slow-query evidence.
- Do not move auth identity resolution without an auth/employee boundary plan.
- Do not create a cache/materialized view until a measured hot path exists.
- Do not change score, ranking, checklist, or benchmark semantics during repository cleanup.

## Trigger To Promote This To Implementation

Promote to implementation only if at least one of these happens:

- a concrete ranking or leaderboard feature touches daily/monthly closed ranking reads
- a KPI performance/benchmark feature touches live performance or benchmark reads
- report endpoints show slow-query evidence under pilot data
- real staging/pilot row volume proves count queries or ranking queries are slow
- an auth/employee identity boundary plan is approved

## Recommended Next Move

No immediate reporting refactor.

Keep `ReportingRepository` as a monitored read-model boundary and treat future splits as planned investments tied to concrete changes.

If external staging/source/master-data evidence is still unavailable, the next local move should be another small, evidence-based guard or a concrete plan for the first reporting split only when a matching change appears.

## CODEX DURUST YORUM

This file is big, but it is not currently a fire.

The healthy move is to keep it on the board as a planned investment, not to cut it up because the line count looks scary. The system is now past the phase where every large file needs panic surgery. We should split only where the next product or data pressure gives us a clean seam and a testable success condition.

For now, the main reporting risk is future data volume, not current correctness.
