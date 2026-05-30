# Architecture Hardening Progress - 2026-05-30

Status: closed local architecture hardening line

## Scope

This evidence closes the PR #542 through PR #552 architecture hardening line.
The line reduced Store Ops growth risk without rewriting the product and
without changing API response shape, DB schema, auth semantics, scoring,
ranking sort, checklist weights, import retry behavior, BullMQ behavior, or
user-facing workflow semantics.

The work was intentionally split into small reviewable PRs. PR #552 was merged
after GitHub/Vercel checks were green and the PR was mergeable. Codex review
comments were not used as a blocking gate for that final continuation because
the user explicitly overrode that gate for the active autonomous run.

## Merged PRs

| PR | Commit | Purpose |
| --- | --- | --- |
| #542 | `09f4bf30ab34f8ee1375ab292b51f8ba8fe58745` | Added the root contribution contract and script guard. |
| #543 | `3ee64053eb53302016b99d63391616bb58ffbbe3` | Added the backend architecture boundary guard. |
| #544 | `534f2c57053444a034b935e9b2fe71088f9e545a` | Injected Store Ops read repositories explicitly and removed broad Store Ops repository casts. |
| #545 | `799134523f00d54ba90c42d8d78be0232ace04a4` | Extracted snapshot command persistence into `SnapshotRunCommandRepository`. |
| #546 | `be3c062545951f470ca951779ba9cabc7fd8489c` | Extracted external ID mapping SQL into `ExternalIdMappingCommandRepository`. |
| #547 | `c8c9b54024244acaecff5e0c9eb446a942d7e536` | Split KPI materialization into `KpiMaterializationService` and `KpiMaterializationRepository`. |
| #548 | `aa207bf27f927115f1563c55c45ad0839ff131aa` | Slimmed worker job context with `WorkerJobsModule`. |
| #549 | `9abea9e61493c80045a6a2ad3c7416b64e6fd449` | Split the Store rankings page container into model, table, and detail panel pieces. |
| #550 | `9bb76104e1f77eb2f49a68cd3350a07b47709af4` | Split the Store KPI highlights page into model, summary, metric list, and formatter pieces. |
| #551 | `0ba31fc5115746851be7714f46e006b88e08b8bc` | Added a repository test helper pilot for target distribution tests. |
| #552 | `b4e68c463aafa2d82cb9b6081e4572bf83dd58b0` | Split StoreOps into internal reporting, checklist, targets, and competition modules. |

## Boundary Changes

New enforced guard:

- `scripts/backend-architecture-boundary-guard.test.mjs` blocks new
  application-layer direct `DatabaseService` imports outside the allowlist.
- It blocks new Store Ops application `as unknown as` broad repository casts.
- It blocks application code importing web/controller layer code.
- It blocks web/controller code importing infrastructure repositories directly.
- Negative tests cover new violations, duplicate allowlist entries, comments,
  namespace imports, re-exports, side-effect imports, and broad repository casts.

Removed direct `DatabaseService` allowlist exceptions:

- `backend/nestjs/src/modules/store-ops/application/snapshot.service.ts`
- `backend/nestjs/src/modules/integration/application/external-id-mapping.service.ts`

Remaining direct `DatabaseService` allowlist exceptions:

- `backend/nestjs/src/modules/integration/application/materialization.service.ts`
- `backend/nestjs/src/modules/integration/application/power-bi-export-upload.service.ts`

Removed Store Ops broad repository cast allowlist exceptions:

- `backend/nestjs/src/modules/store-ops/application/reporting.service.ts`
- `backend/nestjs/src/modules/store-ops/application/ranking.service.ts`
- `backend/nestjs/src/modules/store-ops/application/workflow-inbox.service.ts`

Remaining Store Ops broad repository cast allowlist exceptions:

- none

## Current Architecture Posture

Contribution and review discipline:

- Root `CONTRIBUTING.md` now records required reading, branch/PR rhythm, risk
  separation, backend boundary rules, Store UI rules, real-data-only UI rules,
  verification ladders, and current-state closeout expectations.
- `npm.cmd run test:scripts` guards the contribution contract and backend
  architecture boundary rules.

Store Ops backend:

- `StoreOpsModule` is now a compatibility facade over internal domain modules:
  `StoreOpsReportingModule`, `StoreOpsChecklistModule`,
  `StoreOpsTargetsModule`, and `StoreOpsCompetitionModule`.
- Controllers, route paths, services, repositories, and behavior stayed in
  place; only Nest provider ownership was reorganized.
- `SnapshotOperationsRepository` remains exported through the reporting module
  because `SnapshotModule` consumes it through the StoreOps compatibility
  facade.

Integration and worker context:

- Snapshot command writes are behind `SnapshotRunCommandRepository`.
- External ID mapping writes/lookups are behind
  `ExternalIdMappingCommandRepository`.
- KPI materialization has a focused `KpiMaterializationService` and repository.
- `WorkerModule` no longer imports broad StoreOps/Integration modules only to
  satisfy job handlers; `WorkerJobsModule` owns the focused job dependency
  graph.

Frontend reviewability:

- `/store/rankings` and `/store/kpis` are no longer oversized page-container
  hotspots. API query ownership and route state stayed in the page containers;
  pure display/model and rendering concerns moved into smaller files.

Repository test quality:

- `repository-test-helpers.ts` pilots a lighter pattern for SQL-call plumbing
  while preserving high-risk SQL invariant assertions.

## Verification Record

Local and CI verification used during the line:

```powershell
npm.cmd run test:scripts
npm.cmd run check:release
npm.cmd --prefix backend/nestjs run build
npm.cmd --prefix backend/nestjs run check:release
npm.cmd --prefix backend/nestjs test -- --runInBand src/modules/store-ops/application/ranking.service.spec.ts
npm.cmd --prefix backend/nestjs test -- --runInBand src/modules/store-ops/application/reporting.service.kpi-benchmark-scoring.spec.ts
npm.cmd --prefix backend/nestjs test -- --runInBand src/modules/store-ops/application/workflow-inbox.service.spec.ts
npm.cmd --prefix backend/nestjs test -- --runInBand src/modules/store-ops/application/snapshot.service.spec.ts
npm.cmd --prefix backend/nestjs test -- --runInBand src/modules/store-ops/infrastructure/snapshot-run-command.repository.spec.ts
npm.cmd --prefix backend/nestjs test -- --runInBand src/modules/integration/application/external-id-mapping.service.spec.ts
npm.cmd --prefix backend/nestjs test -- --runInBand src/modules/integration/infrastructure/external-id-mapping-command.repository.spec.ts
npm.cmd --prefix backend/nestjs test -- --runInBand src/modules/integration/application/materialization.service.spec.ts
npm.cmd --prefix backend/nestjs test -- --runInBand src/modules/integration/application/kpi-materialization.service.spec.ts
npm.cmd --prefix backend/nestjs test -- --runInBand src/shared/jobs/bullmq-worker-host.service.spec.ts
npm.cmd --prefix backend/nestjs test -- --runInBand src/modules/store-ops/infrastructure/target-distribution.repository.spec.ts
npm.cmd --prefix admin-web run lint
npm.cmd --prefix admin-web run build
npm.cmd --prefix admin-web run test:e2e -- store-surfaces.spec.ts --grep "store rankings"
npm.cmd --prefix admin-web run test:e2e -- store-surfaces.spec.ts --grep "store KPI"
git diff --check
```

Final PR #552 local verification passed:

```powershell
npm.cmd --prefix backend/nestjs run build
npm.cmd --prefix backend/nestjs run check:release
npm.cmd run check:release
git diff --check
```

Final PR #552 remote checks passed before merge:

- `release-check`
- `release-rehearsal`
- `Vercel`
- `Vercel Preview Comments`

## Remaining Risk And Parked Work

Still parked by design:

- Further `MaterializationService` extraction for employee, store, assignment,
  position, company, and region paths.
- `PowerBiExportUploadService` direct DB boundary extraction.
- Auth-admin write repository boundaries.
- Workforce command/status/audit/access lifecycle repository boundaries.
- Competition scoring/finalization write boundaries.
- Broad frontend redesign work outside the already scoped Store page splits.
- Generated OpenAPI/system-flow script size and broad E2E file size work unless
  a concrete generation bug, flake, runtime issue, or reviewability blocker
  appears.

Do not treat this line as permission to rewrite. The project is safer to grow
than before because new leaks are guarded and several hotspots are narrower,
but future features still need the same small-PR, behavior-preserving rhythm.
