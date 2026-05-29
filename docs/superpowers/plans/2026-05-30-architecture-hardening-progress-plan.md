# Architecture Hardening Progress Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the architecture health audit into a small-PR hardening program that reduces Store Ops growth risk without rewriting the product.

**Architecture:** Keep the existing Vite/React, NestJS, PostgreSQL/Supabase, OpenAPI, Clerk, BullMQ, and release-gate structure. Harden boundaries incrementally: first codify contribution rules, then prevent new boundary leaks, then remove current high-risk adapter/cast/DB-access hotspots. No PR may mix UI polish with auth, DB, scoring, ranking, queue, or business workflow behavior.

**Tech Stack:** NestJS, TypeScript, PostgreSQL, Supabase, BullMQ, React, Vite, shadcn/ui, Tailwind v4, lucide, Playwright, Node test scripts.

---

## Current Evidence Baseline

- `current-state.md` records the current technical decision as `KISMI REFACTOR`.
- `discipline.md` requires small reversible PRs, no mixed-risk batches, and explicit verification.
- `sokrates.md` requires evidence-first architectural decisions and forbids broad changes without a concrete trigger.
- `origin/main` currently includes PR #541: `feat: implement store targets workflow surface`.
- Root `CONTRIBUTING.md` does not exist.
- Store Ops currently has a single broad Nest module:
  - `backend/nestjs/src/modules/store-ops/store-ops.module.ts`
- Current known high-risk code shapes:
  - `backend/nestjs/src/modules/store-ops/application/reporting.service.ts`
  - `backend/nestjs/src/modules/store-ops/application/ranking.service.ts`
  - `backend/nestjs/src/modules/store-ops/application/snapshot.service.ts`
  - `backend/nestjs/src/modules/integration/application/materialization.service.ts`
  - `backend/nestjs/src/modules/integration/application/external-id-mapping.service.ts`
  - `backend/nestjs/src/worker.module.ts`
  - `backend/nestjs/src/shared/jobs/bullmq-worker-host.service.ts`

## Global Rules For Every PR

- Start from fresh `origin/main`.
- Use a branch name like `codex/architecture-hardening-XX-short-name`.
- Keep the PR review story to one risk class.
- Do not change business behavior unless the PR explicitly says so.
- Do not change API shape, DB schema, auth semantics, scoring, ranking, checklist weights, import lifecycle, retry behavior, or queue behavior unless that is the only PR objective.
- Run the exact verification ladder listed for the PR.
- Update `current-state.md` only in docs/state PRs or final closeout PRs.
- Merge only after GitHub checks, Vercel checks when applicable, and Codex review are clean.

---

## PR 1: Architecture Contribution Contract

**Goal:** Add the missing root contribution contract so future Codex or human feature work cannot silently bypass the project rules.

**Review Story:** Docs plus script guard only. No runtime behavior.

**Files:**
- Create: `CONTRIBUTING.md`
- Create: `scripts/contributing-contract.test.mjs`
- Modify: `package.json` only if root `test:scripts` does not already pick up `scripts/*.test.mjs`
- Modify: `current-state.md`

**Required `CONTRIBUTING.md` sections:**
- Required reading before work: `current-state.md`, `sokrates.md`, `discipline.md`.
- Branch and PR rhythm.
- Risk separation rules.
- Backend boundary rules.
- Frontend Store UI rules.
- Data honesty rule: no fake metric, fake coaching, fake ranking, fake trend, or placeholder product copy.
- Store redesign stack: shadcn/ui, Tailwind v4, lucide.
- Verification ladder by change type.
- Merge closeout and current-state update rule.

**Guard Test Content:**
- `scripts/contributing-contract.test.mjs` must assert:
  - `CONTRIBUTING.md` exists.
  - It mentions `current-state.md`, `sokrates.md`, `discipline.md`.
  - It mentions `shadcn/ui`, `Tailwind v4`, and `lucide`.
  - It mentions no fake metrics/data.
  - It mentions PR risk separation.
  - It mentions `current-state.md` merge closeout.

**Steps:**
- [ ] Create `CONTRIBUTING.md` with the required sections.
- [ ] Add `scripts/contributing-contract.test.mjs`.
- [ ] Run `npm.cmd run test:scripts`.
- [ ] Run `git diff --check`.
- [ ] Open PR.
- [ ] Merge after checks and Codex review.

**Verification:**
- `npm.cmd run test:scripts`
- `git diff --check`

**Rollback:**
- Revert the docs/test-only PR.

**Out Of Scope:**
- No backend or frontend implementation changes.

---

## PR 2: Backend Architecture Boundary Guard V1

**Goal:** Prevent new backend boundary leaks while preserving known existing exceptions.

**Review Story:** Script guard only. It freezes current exceptions and blocks new ones.

**Files:**
- Create: `scripts/backend-architecture-boundary-guard.test.mjs`
- Modify: `current-state.md`

**Guard Rules:**
- Application files must not import `DatabaseService` unless explicitly allowlisted.
- Store Ops application files must not add new `as unknown as` repository casts unless explicitly allowlisted.
- Application files must not import unrelated web/controller DTOs.
- Web/controller files must not import infrastructure repositories directly.

**Initial allowlist for direct `DatabaseService`:**
- `backend/nestjs/src/modules/store-ops/application/snapshot.service.ts`
- `backend/nestjs/src/modules/integration/application/materialization.service.ts`
- `backend/nestjs/src/modules/integration/application/external-id-mapping.service.ts`
- `backend/nestjs/src/modules/integration/application/power-bi-export-upload.service.ts`

**Initial allowlist for `as unknown as` casts:**
- `backend/nestjs/src/modules/store-ops/application/reporting.service.ts`
- `backend/nestjs/src/modules/store-ops/application/ranking.service.ts`
- `backend/nestjs/src/modules/store-ops/application/workflow-inbox.service.ts`

**Steps:**
- [ ] Write the boundary guard with explicit allowlist arrays.
- [ ] Add positive tests using current tracked files.
- [ ] Add negative in-memory fake examples proving the guard rejects a new application `DatabaseService` import.
- [ ] Add negative in-memory fake examples proving the guard rejects a new web-to-infrastructure import.
- [ ] Run `npm.cmd run test:scripts`.
- [ ] Open PR.
- [ ] Merge after checks and Codex review.

**Verification:**
- `npm.cmd run test:scripts`
- `npm.cmd run check:release`

**Rollback:**
- Revert the script-only PR. No runtime effect.

**Out Of Scope:**
- Do not fix the existing exceptions in this PR.

---

## PR 3: Reporting And Ranking Explicit Read Repositories

**Goal:** Remove the highest-risk repository facade casts from reporting/ranking orchestration.

**Review Story:** Dependency injection cleanup only. No API or scoring behavior change.

**Files:**
- Modify: `backend/nestjs/src/modules/store-ops/application/reporting.service.ts`
- Modify: `backend/nestjs/src/modules/store-ops/application/ranking.service.ts`
- Modify: `backend/nestjs/src/modules/store-ops/application/workflow-inbox.service.ts`
- Modify: `backend/nestjs/src/modules/store-ops/store-ops.module.ts`
- Modify tests that instantiate these services directly:
  - `backend/nestjs/src/modules/store-ops/application/reporting.service.*.spec.ts`
  - `backend/nestjs/src/modules/store-ops/application/ranking.service.spec.ts`
  - `backend/nestjs/src/modules/store-ops/application/workflow-inbox.service.spec.ts`
- Modify: `scripts/backend-architecture-boundary-guard.test.mjs`

**Implementation Shape:**
- Inject concrete read repositories directly instead of defaulting them through `reportingRepository as unknown as ...`.
- Keep `ReportingRepository` only for methods it still owns.
- Remove allowlisted cast entries as each file is cleaned.

**Steps:**
- [ ] Update `ReportingService` constructor to require explicit read repositories.
- [ ] Update `RankingService` constructor to require explicit read repositories.
- [ ] Update `WorkflowInboxService` constructor to require explicit read repositories.
- [ ] Update `StoreOpsModule` providers only if provider order or tokens are needed.
- [ ] Update direct unit-test constructors with focused mocks.
- [ ] Remove cleaned files from the cast allowlist.
- [ ] Run targeted backend tests.
- [ ] Run backend release check.
- [ ] Open PR.
- [ ] Merge after checks and Codex review.

**Verification:**
- `npm.cmd --prefix backend/nestjs test -- --runInBand src/modules/store-ops/application/ranking.service.spec.ts`
- `npm.cmd --prefix backend/nestjs test -- --runInBand src/modules/store-ops/application/reporting.service.kpi-benchmark-scoring.spec.ts`
- `npm.cmd --prefix backend/nestjs test -- --runInBand src/modules/store-ops/application/workflow-inbox.service.spec.ts`
- `npm.cmd --prefix backend/nestjs run check:release`
- `npm.cmd run test:scripts`

**Rollback:**
- Revert PR. Constructor wiring returns to previous state.

**Out Of Scope:**
- No SQL rewrite.
- No endpoint response changes.
- No scoring/ranking math changes.

---

## PR 4: Snapshot Command Repository Extraction

**Goal:** Move direct DB transaction/query work out of `SnapshotService`.

**Review Story:** Snapshot persistence boundary extraction only.

**Files:**
- Create: `backend/nestjs/src/modules/store-ops/infrastructure/snapshot-run-command.repository.ts`
- Create: `backend/nestjs/src/modules/store-ops/infrastructure/snapshot-run-command.repository.spec.ts`
- Modify: `backend/nestjs/src/modules/store-ops/application/snapshot.service.ts`
- Modify: `backend/nestjs/src/modules/store-ops/store-ops.module.ts`
- Modify: `scripts/backend-architecture-boundary-guard.test.mjs`

**Extraction Target:**
- Idempotency lookup for snapshot run.
- Snapshot transaction wrapper currently owned by `SnapshotService`.
- Audit-event persistence that is purely DB write.
- `getLatestKpiConfigVersion` DB helper if it is SQL-backed inside the service.

**Steps:**
- [ ] Add repository class with methods named by behavior, not SQL shape.
- [ ] Add repository tests for idempotency reuse, new run creation, and audit write invocation.
- [ ] Inject repository into `SnapshotService`.
- [ ] Remove `DatabaseService` from `SnapshotService` constructor.
- [ ] Remove `snapshot.service.ts` from the direct `DatabaseService` allowlist.
- [ ] Run snapshot tests.
- [ ] Run backend release check.
- [ ] Open PR.
- [ ] Merge after checks and Codex review.

**Verification:**
- `npm.cmd --prefix backend/nestjs test -- --runInBand src/modules/store-ops/application/snapshot.service.spec.ts`
- `npm.cmd --prefix backend/nestjs test -- --runInBand src/modules/store-ops/infrastructure/snapshot-run-command.repository.spec.ts`
- `npm.cmd --prefix backend/nestjs run check:release`
- `npm.cmd run test:scripts`

**Rollback:**
- Revert PR. No DB schema change.

**Out Of Scope:**
- Do not change BullMQ dispatch behavior.
- Do not change snapshot scoring.
- Do not change snapshot table schema.

---

## PR 5: External ID Mapping Persistence Boundary

**Goal:** Move direct SQL out of `ExternalIdMappingService` so Nebim/future sources cannot grow mapping logic inside application code.

**Review Story:** Integration mapping repository extraction only.

**Files:**
- Create: `backend/nestjs/src/modules/integration/infrastructure/external-id-mapping-command.repository.ts`
- Create: `backend/nestjs/src/modules/integration/infrastructure/external-id-mapping-command.repository.spec.ts`
- Modify: `backend/nestjs/src/modules/integration/application/external-id-mapping.service.ts`
- Modify: `backend/nestjs/src/modules/integration/integration.module.ts`
- Modify: `backend/nestjs/src/modules/integration/application/external-id-mapping.service.spec.ts`
- Modify: `scripts/backend-architecture-boundary-guard.test.mjs`

**Extraction Target:**
- `resolveMappedInternalId`
- normalized fallback lookup
- ambiguous match detection remains behaviorally identical
- `upsertMapping`

**Steps:**
- [ ] Add repository methods `findActiveMapping`, `findActiveMappingsByNormalizedExternalId`, and `upsertMapping`.
- [ ] Keep `normalizeExternalMappingKey` behavior unchanged.
- [ ] Update service to orchestrate exact-first, normalized fallback, ambiguous rejection.
- [ ] Remove direct `DatabaseService` from service.
- [ ] Remove service from direct `DatabaseService` allowlist.
- [ ] Run targeted tests.
- [ ] Open PR.
- [ ] Merge after checks and Codex review.

**Verification:**
- `npm.cmd --prefix backend/nestjs test -- --runInBand src/modules/integration/application/external-id-mapping.service.spec.ts`
- `npm.cmd --prefix backend/nestjs test -- --runInBand src/modules/integration/infrastructure/external-id-mapping-command.repository.spec.ts`
- `npm.cmd --prefix backend/nestjs run check:release`
- `npm.cmd run test:scripts`

**Rollback:**
- Revert PR. No schema or API change.

**Out Of Scope:**
- No Nebim adapter.
- No JSON adapter.
- No materialization rewrite.

---

## PR 6: Materialization Service First Split

**Goal:** Stop `MaterializationService` from owning every entity materialization write path.

**Review Story:** One entity family extraction. Start with KPI materialization because prim/ranking/snapshot depend on score trust.

**Files:**
- Create: `backend/nestjs/src/modules/integration/application/kpi-materialization.service.ts`
- Create: `backend/nestjs/src/modules/integration/application/kpi-materialization.service.spec.ts`
- Modify: `backend/nestjs/src/modules/integration/application/materialization.service.ts`
- Modify: `backend/nestjs/src/modules/integration/integration.module.ts`
- Modify existing materialization tests only for constructor wiring.

**Extraction Target:**
- KPI raw row load.
- KPI actual upsert.
- KPI target delete/insert behavior.
- KPI materialization stats return shape.

**Steps:**
- [ ] Create `KpiMaterializationService` with one public `materializeKpis` method matching current behavior.
- [ ] Move only KPI-specific logic into that service.
- [ ] Keep batch lifecycle, audit start/end, and dispatch decision in `MaterializationService`.
- [ ] Run existing materialization tests.
- [ ] Add focused KPI materialization tests if existing coverage becomes too broad.
- [ ] Open PR.
- [ ] Merge after checks and Codex review.

**Verification:**
- `npm.cmd --prefix backend/nestjs test -- --runInBand src/modules/integration/application/materialization.service.spec.ts`
- `npm.cmd --prefix backend/nestjs test -- --runInBand src/modules/integration/application/kpi-materialization.service.spec.ts`
- `npm.cmd --prefix backend/nestjs run check:release`

**Rollback:**
- Revert PR. No API or schema change.

**Out Of Scope:**
- Do not split employee/store/assignment in this PR.
- Do not change import retry semantics.

---

## PR 7: Worker Job Context Slimming

**Goal:** Reduce worker context dependency gravity after snapshot and mapping boundaries are cleaner.

**Review Story:** Worker module wiring only.

**Files:**
- Create: `backend/nestjs/src/worker-jobs.module.ts`
- Modify: `backend/nestjs/src/worker.module.ts`
- Modify: `backend/nestjs/src/shared/jobs/bullmq-worker-host.service.ts`
- Create or update: `backend/nestjs/src/shared/jobs/bullmq-worker-host.service.spec.ts`
- Modify: `current-state.md`

**Implementation Shape:**
- `WorkerModule` imports app config, database, observability, and a focused `WorkerJobsModule`.
- `WorkerJobsModule` imports only the modules needed by import and snapshot job handlers.
- Do not import a broad module only to satisfy unrelated controllers.

**Steps:**
- [ ] Add `WorkerJobsModule`.
- [ ] Move worker job handler dependencies into focused provider imports.
- [ ] Keep worker start command `node dist/src/workers.js` unchanged.
- [ ] Add a test that worker module compiles with BullMQ backend disabled.
- [ ] Run backend release check.
- [ ] Open PR.
- [ ] Merge after checks and Codex review.

**Verification:**
- `npm.cmd --prefix backend/nestjs test -- --runInBand src/shared/jobs/bullmq-worker-host.service.spec.ts`
- `npm.cmd --prefix backend/nestjs run build`
- `npm.cmd --prefix backend/nestjs run check:release`

**Rollback:**
- Revert PR. Render worker command remains unchanged.

**Out Of Scope:**
- No Redis provider changes.
- No BullMQ retry/backoff behavior changes.

---

## PR 8: Store Ranking Page Container Split

**Goal:** Reduce frontend Store page bloat without changing `/store/rankings` behavior.

**Review Story:** Frontend decomposition only.

**Files:**
- Modify: `admin-web/src/pages/StoreRankingsPage.tsx`
- Create: `admin-web/src/pages/store-rankings-page-model.ts`
- Create: `admin-web/src/pages/store-rankings-table.tsx`
- Create: `admin-web/src/pages/store-rankings-detail-panel.tsx`
- Create or update: `admin-web/e2e/store-surfaces.spec.ts`

**Extraction Target:**
- Pure sort/filter helpers into model file.
- Table rendering into table component.
- Detail panel rendering into detail component.
- Keep API query and page-level route state in `StoreRankingsPage.tsx`.

**Steps:**
- [ ] Extract pure helpers without behavior change.
- [ ] Extract table component.
- [ ] Extract detail component.
- [ ] Run TypeScript build.
- [ ] Run targeted Playwright route test for `/store/rankings`.
- [ ] Open PR.
- [ ] Merge after checks and Codex review.

**Verification:**
- `npm.cmd --prefix admin-web run lint`
- `npm.cmd --prefix admin-web run build`
- `npm.cmd --prefix admin-web run test:e2e -- store-surfaces.spec.ts --grep "store rankings"`

**Rollback:**
- Revert PR. No backend behavior.

**Out Of Scope:**
- No visual redesign.
- No ranking access or API behavior changes.

---

## PR 9: Store KPI Page Container Split

**Goal:** Reduce `/store/kpis` page bloat and isolate KPI display calculations.

**Review Story:** Frontend decomposition only.

**Files:**
- Modify: `admin-web/src/pages/StoreKpiHighlightsPage.tsx`
- Create: `admin-web/src/pages/store-kpi-highlights-model.ts`
- Create: `admin-web/src/pages/store-kpi-score-summary.tsx`
- Create: `admin-web/src/pages/store-kpi-metric-list.tsx`
- Create or update: `admin-web/e2e/store-surfaces.spec.ts`

**Extraction Target:**
- Formatting/score meaning helpers into model file.
- Score summary UI into component.
- Metric list/details into component.

**Steps:**
- [ ] Extract pure KPI display model helpers.
- [ ] Extract score summary component.
- [ ] Extract metric list component.
- [ ] Keep API queries in page container.
- [ ] Run frontend checks.
- [ ] Open PR.
- [ ] Merge after checks and Codex review.

**Verification:**
- `npm.cmd --prefix admin-web run lint`
- `npm.cmd --prefix admin-web run build`
- `npm.cmd --prefix admin-web run test:e2e -- store-surfaces.spec.ts --grep "store kpis"`

**Rollback:**
- Revert PR. No backend behavior.

**Out Of Scope:**
- No scoring copy change unless test proves current copy is broken.
- No chart redesign.

---

## PR 10: Repository Test Strategy Cleanup Pilot

**Goal:** Prove a better repository test pattern on one contained surface before changing the whole suite.

**Review Story:** Test quality improvement only.

**Pilot Target:**
- `backend/nestjs/src/modules/store-ops/infrastructure/target-distribution.repository.spec.ts`

**Files:**
- Modify: `backend/nestjs/src/modules/store-ops/infrastructure/target-distribution.repository.spec.ts`
- Create: `backend/nestjs/src/modules/store-ops/infrastructure/repository-test-helpers.ts`

**Pattern Change:**
- Keep one SQL-fragment guard per high-risk access invariant.
- Move repeated query-call plumbing into helper functions.
- Prefer assertions on repository output and params over exact SQL substring order.

**Steps:**
- [ ] Add helper to capture executed SQL and params.
- [ ] Replace repeated `query.mock.calls` boilerplate in target distribution tests.
- [ ] Keep no-empty-scope and narrowest-scope SQL assertions.
- [ ] Convert pagination/result tests to output assertions.
- [ ] Run targeted test.
- [ ] Open PR.
- [ ] Merge after checks and Codex review.

**Verification:**
- `npm.cmd --prefix backend/nestjs test -- --runInBand src/modules/store-ops/infrastructure/target-distribution.repository.spec.ts`
- `npm.cmd --prefix backend/nestjs run check:release`

**Rollback:**
- Revert PR. Test-only change.

**Out Of Scope:**
- Do not change repository implementation.
- Do not rewrite all repository tests.

---

## PR 11: StoreOps Internal Module Split V1

**Goal:** Convert StoreOps from one broad module into explicit internal domain modules after the riskiest casts and DB leaks are reduced.

**Review Story:** Nest provider organization only. No controller route or behavior change.

**Files:**
- Create: `backend/nestjs/src/modules/store-ops/store-ops-reporting.module.ts`
- Create: `backend/nestjs/src/modules/store-ops/store-ops-checklist.module.ts`
- Create: `backend/nestjs/src/modules/store-ops/store-ops-targets.module.ts`
- Create: `backend/nestjs/src/modules/store-ops/store-ops-competition.module.ts`
- Modify: `backend/nestjs/src/modules/store-ops/store-ops.module.ts`
- Update backend module compile tests if present.

**Implementation Shape:**
- Keep public `StoreOpsModule` as the compatibility facade.
- Move provider/controller arrays into internal modules.
- Export only services actually used outside each internal module.
- Do not move files on disk in this PR.

**Steps:**
- [ ] Create reporting internal module.
- [ ] Create checklist internal module.
- [ ] Create targets internal module.
- [ ] Create competition internal module.
- [ ] Reduce `StoreOpsModule` to imports/exports facade.
- [ ] Run backend build and release check.
- [ ] Open PR.
- [ ] Merge after checks and Codex review.

**Verification:**
- `npm.cmd --prefix backend/nestjs run build`
- `npm.cmd --prefix backend/nestjs run check:release`
- `npm.cmd run check:release`

**Rollback:**
- Revert PR. No schema/API change.

**Out Of Scope:**
- No code move between directories.
- No route path changes.
- No service logic changes.

---

## PR 12: Final Architecture Evidence And State Closeout

**Goal:** Record what changed, what risk remains, and which boundaries are now enforced.

**Review Story:** Docs/evidence only.

**Files:**
- Create: `docs/evidence/architecture-hardening-progress-2026-05.md`
- Modify: `current-state.md`
- Modify: `docs/plans/project-debt-ledger.md` only if a debt count is intentionally changed.
- Modify: `docs/plans/refactor-completion-inventory-v1.md` only if active backlog status changed.

**Steps:**
- [ ] Summarize merged PRs and exact commit SHAs.
- [ ] Record removed allowlist exceptions.
- [ ] Record remaining allowlist exceptions.
- [ ] Record verification commands and results.
- [ ] Update current-state with the final architecture posture.
- [ ] Run docs/script checks.
- [ ] Open PR.
- [ ] Merge after checks and Codex review.

**Verification:**
- `npm.cmd run test:scripts`
- `git diff --check`

**Rollback:**
- Revert docs-only PR.

**Out Of Scope:**
- No implementation work.

---

## Recommended Execution Order

1. PR 1: Architecture Contribution Contract
2. PR 2: Backend Architecture Boundary Guard V1
3. PR 3: Reporting And Ranking Explicit Read Repositories
4. PR 4: Snapshot Command Repository Extraction
5. PR 5: External ID Mapping Persistence Boundary
6. PR 6: Materialization Service First Split
7. PR 7: Worker Job Context Slimming
8. PR 8: Store Ranking Page Container Split
9. PR 9: Store KPI Page Container Split
10. PR 10: Repository Test Strategy Cleanup Pilot
11. PR 11: StoreOps Internal Module Split V1
12. PR 12: Final Architecture Evidence And State Closeout

## Stop Rules

- Stop and re-plan if any PR needs DB migration.
- Stop and re-plan if a PR changes API response shape.
- Stop and re-plan if a PR changes scoring/ranking/checklist math.
- Stop and re-plan if `check:release` fails for unrelated historical instability.
- Stop and split if a PR touches more than one risk class.

## Success Definition

- Root `CONTRIBUTING.md` exists and is guarded.
- New backend boundary leaks are blocked by script tests.
- `ReportingService`, `RankingService`, and `WorkflowInboxService` no longer rely on broad `as unknown as` repository casts.
- `SnapshotService` no longer injects `DatabaseService` directly.
- `ExternalIdMappingService` no longer injects `DatabaseService` directly.
- Worker context no longer imports broad modules only to satisfy unrelated provider graph needs.
- Store ranking and KPI pages are below the current oversized risk trajectory.
- Final `current-state.md` reflects the merged architecture state.
