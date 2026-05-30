# Architecture Hardening V2 Plan

Status: proposed execution plan
Created: 2026-05-30

## Goal

Raise the repository's architecture health from roughly 74/100 to the 82-85
range by reducing the remaining high-risk growth hotspots without changing
product behavior.

This is a continuation of the closed Architecture Hardening line documented in
`docs/evidence/architecture-hardening-progress-2026-05.md`.

## Non-Goals

This plan must not change:

- API response shape.
- DB schema or migrations, unless a PR explicitly exists only for migration
  gate visibility.
- Auth or permission semantics.
- KPI scoring result, ranking sort, checklist weights, or score interpretation.
- BullMQ behavior, import retry behavior, or materialization lifecycle status.
- User-facing workflow behavior.
- Store UI design.

If any slice requires one of these changes, stop that slice and record a
separate product or architecture decision before implementation.

## Operating Rules

- Follow `CONTRIBUTING.md`, `discipline.md`, `sokrates.md`, and
  `current-state.md` before every PR.
- Start every PR from fresh `origin/main`.
- Use a `codex/` branch prefix.
- Keep one review story and one rollback story per PR.
- Do not merge until local verification and required remote checks are green.
- Do not treat Codex review as a blocking gate if the user explicitly overrides
  it for an autonomous run; still inspect actionable comments before deciding.
- Update `current-state.md` only when the handoff state or architecture posture
  actually changes.

## Pre-PR Local Review Pass

Before opening each PR, run a local review pass that tries to catch the class of
issues GitHub Codex review usually finds after the PR is opened.

Required pre-PR checks:

1. Inspect `git diff --stat` and confirm the PR still has one review story.
2. Run `git diff --check`.
3. Review every changed file for behavior drift, layer leaks, fake data, broad
   casts, oversized additions, and scope creep.
4. Search changed backend files for new direct `DatabaseService` imports,
   application-to-web imports, web-to-infrastructure imports, and new broad
   `as unknown as` repository casts.
5. Search changed frontend files for fake metrics, role-out-of-scope UI,
   legacy Store UI classes, debug copy, and old shell/sidebar language.
6. Run the targeted verification commands for the PR slice before writing the
   PR description.
7. Write down likely Codex review comments locally and fix actionable issues
   before opening the PR.

This pass does not replace GitHub checks or remote review. It is a latency
reduction step so obvious P1/P2 feedback is handled before the remote review
queue starts.

## Risk Map

| Area | Current Risk | Target State |
| --- | --- | --- |
| `MaterializationService` | Application service owns DB access, entity routing, validation, mapping, row status updates. | Application orchestration only; entity materializers and row status persistence are behind infrastructure boundaries. |
| `PowerBiExportUploadService` | Upload, parse worker orchestration, normalization, reconciliation, source validation, and unused DB dependency live together. | Parser, normalizer, reconciliation, and upload orchestration are separate; no direct DB dependency. |
| StoreOps module graph | `StoreOpsReportingModule` still groups org, workforce, snapshot, ranking, and reporting providers. | Smaller internal modules with explicit ownership and compatibility facade only at the root. |
| Scoring | Live leaderboard, ranking, snapshot, and store blend have multiple score paths. | Shared evaluator contract with golden parity tests. |
| Snapshot tests | Some tests assert SQL call order and parameter indexes directly. | Behavior/golden assertions plus minimal SQL invariant checks. |
| Auth/workforce/competition writes | Large repositories still carry workflow transition and audit behavior. | Transition decisions are visible in policies/helpers; repositories persist. |
| Guard coverage | Guards block important import leaks but do not detect provider graph or size growth. | Guard coverage includes module graph, worker graph, and new large-file risk. |
| Release gate | Migration smoke is documented as manual. | Migration-change PRs surface an explicit smoke decision warning. |

## PR Sequence

### PR-1: Expand Architecture Guard Coverage

Risk: medium

Purpose:

- Make hidden growth risks visible before touching high-risk services.

Files:

- Modify: `scripts/backend-architecture-boundary-guard.test.mjs`
- Modify: `CONTRIBUTING.md`
- Optional docs note under `docs/plans/`

Scope:

- Add contract coverage for StoreOps internal module provider/export growth.
- Add contract coverage for `backend/nestjs/src/worker-jobs.module.ts` growth.
- Add a tracked TS/TSX large-file guard for new 1200+ line files unless
  explicitly allowlisted with a reason.
- Add the pre-PR local review pass to the durable contribution discipline if it
  is not already present in `CONTRIBUTING.md` or `discipline.md`.
- Do not expand current direct `DatabaseService` allowlists.

Verification:

```powershell
npm.cmd run test:scripts
git diff --check
```

Rollback:

- Revert guard/doc changes only. No runtime behavior is touched.

### PR-2: Extract Materialization Row Status Persistence

Risk: medium

Purpose:

- Move raw row status SQL out of `MaterializationService` first, before entity
  extraction.

Files:

- Modify: `backend/nestjs/src/modules/integration/application/materialization.service.ts`
- Create: `backend/nestjs/src/modules/integration/infrastructure/materialization-row-status.repository.ts`
- Modify or create targeted tests under `backend/nestjs/src/modules/integration/`

Scope:

- Move processed, validation-failed, and retryable-error row status updates into
  an infrastructure repository.
- Preserve status strings, processed flags, retry behavior, and error messages.

Verification:

```powershell
npm.cmd --prefix backend/nestjs test -- --runInBand src/modules/integration/application/materialization.service.spec.ts
npm.cmd --prefix backend/nestjs run build
npm.cmd run test:scripts
```

Rollback:

- Revert the repository extraction. Behavior should be identical.

### PR-3: Split Employee And Store Materializers

Risk: high

Purpose:

- Remove the first high-volume entity paths from `MaterializationService`
  without changing import behavior.

Files:

- Modify: `backend/nestjs/src/modules/integration/application/materialization.service.ts`
- Create focused employee/store materializer files under
  `backend/nestjs/src/modules/integration/application/` or
  `backend/nestjs/src/modules/integration/infrastructure/`, depending on
  whether the class is orchestration or persistence.
- Modify targeted materialization tests.

Scope:

- Extract employee materialization.
- Extract store materialization.
- Keep batch routing in `MaterializationService`.
- Keep all mapping, validation, and error text behavior identical.

Verification:

```powershell
npm.cmd --prefix backend/nestjs test -- --runInBand src/modules/integration/application/materialization.service.spec.ts
npm.cmd --prefix backend/nestjs run build
npm.cmd --prefix backend/nestjs run check:release
```

Rollback:

- Revert the extraction PR. No schema or API changes are allowed.

### PR-4: Split Assignment, Position, Company, And Region Materializers

Risk: high

Purpose:

- Finish materialization extraction and remove the direct DB allowlist for
  `MaterializationService`.

Files:

- Modify: `backend/nestjs/src/modules/integration/application/materialization.service.ts`
- Create focused assignment, position, company, and region materializers.
- Modify: `scripts/backend-architecture-boundary-guard.test.mjs`
- Modify targeted materialization tests.

Scope:

- Extract assignment materialization.
- Extract position materialization.
- Extract company materialization.
- Extract region materialization.
- Remove `materialization.service.ts` from the direct `DatabaseService`
  allowlist.

Verification:

```powershell
npm.cmd --prefix backend/nestjs test -- --runInBand src/modules/integration/application/materialization.service.spec.ts
npm.cmd run test:scripts
npm.cmd --prefix backend/nestjs run check:release
```

Rollback:

- Revert the extraction and allowlist removal together.

### PR-5: Extract Power BI Parser And Normalizer

Risk: medium

Purpose:

- Reduce `PowerBiExportUploadService` scope and remove its unused direct DB
  dependency.

Files:

- Modify: `backend/nestjs/src/modules/integration/application/power-bi-export-upload.service.ts`
- Create parser/normalizer files under
  `backend/nestjs/src/modules/integration/application/`
- Modify: `scripts/backend-architecture-boundary-guard.test.mjs`
- Modify: `backend/nestjs/src/modules/integration/application/power-bi-export-upload.service.spec.ts`

Scope:

- Extract spreadsheet parse worker orchestration.
- Extract text, number, and key normalization helpers.
- Remove `_databaseService: DatabaseService`.
- Remove `power-bi-export-upload.service.ts` from the direct DB allowlist.

Verification:

```powershell
npm.cmd --prefix backend/nestjs test -- --runInBand src/modules/integration/application/power-bi-export-upload.service.spec.ts
npm.cmd run test:scripts
npm.cmd --prefix backend/nestjs run build
```

Rollback:

- Revert parser/normalizer extraction and allowlist removal together.

### PR-6: Extract Power BI Reconciliation Builder

Risk: medium

Purpose:

- Isolate Power BI store/personnel reconciliation from upload orchestration.

Files:

- Modify: `backend/nestjs/src/modules/integration/application/power-bi-export-upload.service.ts`
- Create: `backend/nestjs/src/modules/integration/application/power-bi-reconciliation.builder.ts`
- Create or modify targeted reconciliation tests.

Scope:

- Move reconciliation summary construction to a pure builder.
- Preserve response shape and error behavior.
- Keep source authorization and import handoff in the upload service.

Verification:

```powershell
npm.cmd --prefix backend/nestjs test -- --runInBand src/modules/integration/application/power-bi-export-upload.service.spec.ts
npm.cmd --prefix backend/nestjs run check:release
```

Rollback:

- Revert builder extraction only.

### PR-7: Introduce Shared Scoring Evaluator Contract

Risk: high

Purpose:

- Establish one score evaluation contract before prim/incentive work depends on
  performance scores.

Files:

- Modify or create scoring files under
  `backend/nestjs/src/modules/store-ops/application/`
- Modify ranking/live leaderboard targeted specs.
- Add golden scoring fixtures if they do not already exist.

Scope:

- Wrap existing `KpiBenchmarkScoringService` behavior in a shared evaluator.
- Use the evaluator from `RankingService` and `LiveMonthlyLeaderboardService`.
- Preserve existing score outputs and sort semantics.
- Do not change snapshot score generation in this PR except through parity tests.

Verification:

```powershell
npm.cmd --prefix backend/nestjs test -- --runInBand src/modules/store-ops/application/ranking.service.spec.ts
npm.cmd --prefix backend/nestjs test -- --runInBand src/modules/store-ops/application/reporting.service.kpi-benchmark-scoring.spec.ts
npm.cmd --prefix backend/nestjs run build
```

Rollback:

- Revert evaluator adoption. Existing scoring services remain the source.

### PR-8: Improve Snapshot Scoring Test Quality

Risk: medium

Purpose:

- Keep snapshot behavior protected while reducing brittle SQL order and parameter
  index assertions.

Files:

- Modify: `backend/nestjs/src/modules/store-ops/infrastructure/snapshot-run-command.repository.spec.ts`
- Reuse or extend repository test helpers.

Scope:

- Replace raw parameter index assertions with named helper assertions where
  possible.
- Keep critical SQL invariant checks for stored function calls.
- Add or preserve tests for capped benchmark ratios and target-reference scoring.

Verification:

```powershell
npm.cmd --prefix backend/nestjs test -- --runInBand src/modules/store-ops/infrastructure/snapshot-run-command.repository.spec.ts
npm.cmd --prefix backend/nestjs test -- --runInBand src/modules/store-ops/application/snapshot.service.spec.ts
npm.cmd --prefix backend/nestjs run check:release
```

Rollback:

- Revert test refactor only. Runtime code should not change.

### PR-9: Split StoreOps Reporting Module Further

Risk: high

Purpose:

- Reduce the remaining StoreOps module mini-monolith.

Files:

- Modify: `backend/nestjs/src/modules/store-ops/store-ops-reporting.module.ts`
- Create smaller internal modules such as:
  - `store-ops-org.module.ts`
  - `store-ops-workforce.module.ts`
  - `store-ops-snapshot.module.ts`
  - `store-ops-ranking.module.ts`
  - `store-ops-reporting-read.module.ts`
- Modify: `backend/nestjs/src/modules/store-ops/store-ops.module.ts`

Scope:

- Move provider/controller ownership to narrower modules.
- Keep `StoreOpsModule` as compatibility facade.
- Preserve route paths, providers, auth behavior, and response shape.

Verification:

```powershell
npm.cmd --prefix backend/nestjs run build
npm.cmd --prefix backend/nestjs run check:release
npm.cmd run test:scripts
```

Rollback:

- Revert module graph split. No behavior changes are allowed.

### PR-10: Split Auth Admin Role Assignment Commands

Risk: high

Purpose:

- Reduce auth write surface before new role/scope features arrive.

Files:

- Modify: `backend/nestjs/src/modules/auth/auth-admin.repository.ts`
- Create focused role assignment command repository/service files under
  `backend/nestjs/src/modules/auth/`
- Modify targeted auth tests.

Scope:

- Move create/deactivate role assignment write logic and audit write path behind
  a focused command boundary.
- Keep existing auth semantics, audit event types, and returned shape.
- Existing repository can remain as facade if needed.

Verification:

```powershell
npm.cmd --prefix backend/nestjs test -- --runInBand src/modules/auth
npm.cmd --prefix backend/nestjs run build
npm.cmd --prefix backend/nestjs run check:release
```

Rollback:

- Revert command extraction. Auth behavior must remain unchanged.

### PR-11: Extract Workforce Request Transition Policy

Risk: high

Purpose:

- Make workforce request state transitions explicit before norm kadro and store
  action workflows expand this area.

Files:

- Modify: `backend/nestjs/src/modules/store-ops/infrastructure/workforce-request.repository.ts`
- Create transition policy/helper files under
  `backend/nestjs/src/modules/store-ops/application/` or
  `backend/nestjs/src/modules/store-ops/infrastructure/`
- Modify targeted workforce tests.

Scope:

- Extract transition decisions from persistence code.
- Preserve status strings, conflict behavior, and audit event types.
- Repository remains responsible for SQL and transactions.

Verification:

```powershell
npm.cmd --prefix backend/nestjs test -- --runInBand src/modules/store-ops
npm.cmd --prefix backend/nestjs run build
npm.cmd --prefix backend/nestjs run check:release
```

Rollback:

- Revert policy extraction. Workflow behavior must remain unchanged.

### PR-12: Extract Competition Transition Policy

Risk: high

Purpose:

- Make competition stage/package plan transitions explicit before scoring and
  finalization features grow.

Files:

- Modify: `backend/nestjs/src/modules/store-ops/infrastructure/competition.repository.ts`
- Create transition policy/helper files under
  `backend/nestjs/src/modules/store-ops/`
- Modify targeted competition tests.

Scope:

- Extract draft/submitted/approved/rejected transition decisions.
- Preserve audit event types and repository transaction behavior.
- Do not change competition scoring or finalization.

Verification:

```powershell
npm.cmd --prefix backend/nestjs test -- --runInBand src/modules/store-ops
npm.cmd --prefix backend/nestjs run build
npm.cmd --prefix backend/nestjs run check:release
```

Rollback:

- Revert policy extraction. Competition behavior must remain unchanged.

### PR-13: Add Migration Change Release-Gate Warning

Risk: low

Purpose:

- Make DB migration smoke decisions explicit when migration files change.

Files:

- Modify: `scripts/release-gate-contract.test.mjs`
- Modify or create release gate helper script if needed.
- Modify: `docs/plans/release-check-gate.md`
- Modify: `CONTRIBUTING.md`

Scope:

- Do not make Docker-dependent fresh DB smoke mandatory in the root gate unless
  the repository already supports it reliably.
- Add a visible warning or contract expectation when migration files change.
- Document the required PR decision: smoke run evidence or explicit reason.

Verification:

```powershell
npm.cmd run test:scripts
git diff --check
```

Rollback:

- Revert script/docs changes only.

### PR-14: Architecture Hardening V2 Closeout

Risk: low

Purpose:

- Record the final state and prevent the same risk discussion from resetting.

Files:

- Modify: `current-state.md`
- Create or modify evidence under `docs/evidence/`
- Modify: `docs/plans/refactor-completion-inventory-v1.md` only if the active
  refactor backlog changed.

Scope:

- Record merged PRs and the risks each reduced.
- Record closed direct DB allowlists.
- Record remaining intentional parked risks.
- Record final verification commands.
- Update estimated architecture health score.

Verification:

```powershell
npm.cmd run test:scripts
git diff --check
```

Rollback:

- Revert docs closeout only.

## Dependency Order

```text
PR-1
  -> PR-2 -> PR-3 -> PR-4
  -> PR-5 -> PR-6
  -> PR-7 -> PR-8
  -> PR-9
  -> PR-10
  -> PR-11
  -> PR-12
  -> PR-13
  -> PR-14
```

Notes:

- PR-2 through PR-4 must stay in order.
- PR-5 and PR-6 must stay in order.
- PR-7 should happen before any prim/incentive scoring feature.
- PR-10, PR-11, and PR-12 can be reordered after PR-1 if execution needs to
  avoid conflicts, but each must remain its own PR.
- PR-14 is last.

## Definition Of Done

- `MaterializationService` has no direct `DatabaseService` import.
- `PowerBiExportUploadService` has no direct `DatabaseService` import.
- Direct DB allowlist in `backend-architecture-boundary-guard.test.mjs` is
  smaller than the V1 closeout state.
- StoreOps module graph is narrower than the V1 split.
- Scoring evaluator contract exists and live/ranking behavior is covered by
  golden parity tests.
- Snapshot tests are less coupled to SQL call order and parameter indexes.
- Auth, workforce, and competition transition decisions are more visible than
  before.
- Migration-change PRs have an explicit smoke decision mechanism.
- Final evidence and `current-state.md` are updated.

## Stop Conditions

Stop and ask for a product or architecture decision if:

- A slice requires changing API response shape.
- A slice requires changing DB schema.
- A slice changes scoring output, ranking order, checklist weights, or snapshot
  interpretation.
- A slice changes auth scope semantics.
- A slice changes import retry, materialization lifecycle, BullMQ behavior, or
  approval workflow behavior.
- Tests reveal existing behavior is inconsistent with documented business
  expectations.
