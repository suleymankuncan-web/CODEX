# Architecture Hardening V2 Closeout - 2026-05-30

Status: closed

## Scope

Architecture Hardening V2 continued the earlier architecture hardening line
recorded in `docs/evidence/architecture-hardening-progress-2026-05.md`.

The line reduced growth risk in integration materialization, Power BI imports,
Store Ops module ownership, performance scoring, snapshot tests, auth role
assignment writes, workforce transitions, competition transitions, and migration
release visibility.

The line did not change API response shape, DB schema, migrations, auth or
permission semantics, KPI scoring output, ranking sort, checklist weights,
snapshot interpretation, BullMQ behavior, import retry behavior,
materialization lifecycle status, Store UI, or user-facing workflow behavior.

## Merged PRs

| PR | Commit | Purpose | Risk Reduced |
| --- | --- | --- | --- |
| #554 | `e9b93276d9bbd99fcf99870d33b868267389aa3b` | Expanded architecture guards and added the V2 plan. | New oversized files, Store Ops module graph growth, and worker job graph growth now fail script guards instead of drifting silently. |
| #555 | `eb8670d0977415722a84321dfa69345c5c3ff692` | Extracted materialization row status persistence. | Raw row status SQL moved behind `MaterializationRowStatusRepository`. |
| #556 | `5ec11aac1541c146097c393222f046efb0d503ef` | Split employee and store materializers. | Employee/store persistence left the central materialization service and moved to focused service/repository boundaries. |
| #557 | `d6f897f4d2714bba6adeae7e090df32b6cce3bc0` | Split assignment, position, company, and region materializers. | `MaterializationService` became orchestration-only and left the direct `DatabaseService` allowlist. |
| #558 | `094b84fdedfa549220c290fcd64b3a9ec1757673` | Extracted Power BI parser and normalizer. | Power BI upload orchestration lost its direct DB escape hatch and parsing/normalization moved to focused services. |
| #559 | `f66f1328f2a86a00ec267ee1827a2cde1977fdb6` | Extracted Power BI reconciliation builder. | Store/personnel reconciliation became independently testable and stopped growing the upload orchestration service. |
| #560 | `4fdc36e5ab4a82197044cd3a0cb8e915d974bbac` | Introduced a shared performance score evaluator. | Ranking and live leaderboard scoring now share an explicit evaluator contract with golden parity tests. |
| #561 | `619b255c2266f4131f680c985911961fa3b27517` | Improved snapshot scoring repository assertions. | Snapshot tests assert named scoring outputs instead of brittle raw parameter indexes. |
| #562 | `e330985c157109356a300ca0a93382d336fdbdb0` | Split the StoreOps reporting module graph. | Org, workforce, snapshot, ranking, and reporting-read providers moved into narrower internal modules. |
| #563 | `6bc388e9d5885e84bf82febb4d322157621868a7` | Extracted auth role assignment commands. | Role-assignment create/deactivate SQL and audit writes moved behind `AuthRoleAssignmentCommandRepository`. |
| #564 | `c667741277a570f26290977d382a5ac639510f1d` | Extracted workforce request transition policy. | Seller-code/offboarding transition decisions became explicit and unit-tested outside repository SQL. |
| #565 | `709a455788072741d7947ca509d63181a8d37e9a` | Extracted competition stage package plan transition policy. | Draft/submit/approve/reject/clone/execute/cancel transition rules became explicit and unit-tested. |
| #566 | `5c3e0d9314564f935b69939a1177299d1a93c64f` | Surfaced migration change release decisions. | Migration-sensitive PRs now warn during release checks and require smoke evidence or a recorded Conditional Go decision. |

## Boundary State After V2

Direct `DatabaseService` application allowlist:

- Before V2: `MaterializationService` and `PowerBiExportUploadService`
  remained as direct DB exceptions after the V1 closeout.
- After V2: the direct application `DatabaseService` allowlist in
  `scripts/backend-architecture-boundary-guard.test.mjs` is empty.

Store Ops broad repository cast allowlist:

- Remains empty.

Store Ops module ownership:

- `StoreOpsModule` stays as the public compatibility facade.
- `StoreOpsReportingModule` is now a compatibility facade over focused
  internal modules:
  - `StoreOpsOrgModule`
  - `StoreOpsWorkforceModule`
  - `StoreOpsSnapshotModule`
  - `StoreOpsRankingModule`
  - `StoreOpsReportingReadModule`

Guard coverage added or improved:

- New tracked TS/TSX oversized-source guard for unallowlisted 1200+ line files.
- Store Ops internal module graph provider/export limits.
- Worker job module graph provider/export limits.
- Direct `DatabaseService` import guard remains active with no current
  allowlist entries.
- Application-to-web and web-to-infrastructure import guards remain active.
- Store Ops broad `as unknown as` repository cast guard remains active with no
  current allowlist entries.
- Migration-change warning helper is wired into the root release gate and
  handles PR file lists, renames, push ranges, local diff fallback, and API
  failure fallback without blocking CI.

## Verification Record

Representative local gates run across the V2 PR line:

```powershell
npm.cmd run test:scripts
npm.cmd run check:release
npm.cmd --prefix backend/nestjs run build
npm.cmd --prefix backend/nestjs run lint
npm.cmd --prefix backend/nestjs run check:release
npm.cmd --prefix backend/nestjs test -- --runInBand src/modules/integration/application/materialization.service.spec.ts
npm.cmd --prefix backend/nestjs test -- --runInBand src/modules/integration/application/power-bi-export-upload.service.spec.ts src/modules/integration/application/power-bi-reconciliation.builder.spec.ts
npm.cmd --prefix backend/nestjs test -- --runInBand src/modules/store-ops/application/ranking.service.spec.ts src/modules/store-ops/application/reporting.service.live-leaderboard.spec.ts src/modules/store-ops/application/reporting.service.kpi-benchmark-scoring.spec.ts src/modules/store-ops/application/performance-score-evaluator.service.spec.ts src/modules/store-ops/application/kpi-benchmark-scoring.service.spec.ts
npm.cmd --prefix backend/nestjs test -- --runInBand src/modules/store-ops/infrastructure/snapshot-run-command.repository.spec.ts
npm.cmd --prefix backend/nestjs test -- --runInBand src/modules/store-ops/application/snapshot.service.spec.ts
npm.cmd --prefix backend/nestjs test -- --runInBand test/integration/reporting.e2e-spec.ts test/integration/snapshot-run.e2e-spec.ts test/integration/auth-scope.e2e-spec.ts
npm.cmd --prefix backend/nestjs test -- --runInBand src/modules/auth
npm.cmd --prefix backend/nestjs test -- --runInBand test/integration/auth-role-assignments.e2e-spec.ts test/integration/auth-user-accounts.e2e-spec.ts test/integration/auth-action-scope.e2e-spec.ts
npm.cmd --prefix backend/nestjs test -- --runInBand test/integration/workforce-seller-code.e2e-spec.ts test/integration/workforce-offboarding.e2e-spec.ts src/modules/store-ops/application/workforce-request-transition.policy.spec.ts
npm.cmd --prefix backend/nestjs test -- --runInBand src/modules/store-ops/application/competition-stage-package-plan-transition.policy.spec.ts src/modules/store-ops/infrastructure/competition-stage-package-plan.repository.spec.ts src/modules/store-ops/infrastructure/competition.repository.spec.ts src/modules/store-ops/application/competition.service.spec.ts test/integration/competition.e2e-spec.ts
node --test scripts/backend-architecture-boundary-guard.test.mjs
node --test scripts/file-size-guard.test.mjs
node --test scripts/release-gate-contract.test.mjs
node scripts/migration-change-warning.mjs
git diff --check
```

Every V2 PR was opened as a separate reviewable slice. PR #554 through PR #566
were merged after local verification and remote checks. PR #566 was merged
after final remote `release-check`, `release-rehearsal`, Vercel, Vercel Preview
Comments, mergeability, and Codex review channels were clean.

## Remaining Intentional Risk

The project is safer to grow, but not debt-free.

Still parked by design:

- `IntegrationService` still owns import creation, source governance, retry,
  approval, reconciliation, and repository orchestration.
- `MasterDataBootstrapService` still contains promotion/write orchestration.
- `AuthAdminRepository` still contains user account, pilot binding,
  action-store assignment, and role-permission command behavior outside the
  role-assignment command extraction.
- `WorkforceRequestRepository` still owns SQL/transaction persistence for
  workforce requests; only transition decisions were extracted.
- `CompetitionRepository` still owns large competition persistence, scoring,
  finalization, and stage execution areas; only stage package plan transition
  decisions were extracted.
- Broad E2E files and generator scripts remain parked unless they create
  concrete gate time, flake, precision, or reviewability pain.
- Store UI redesign remains a product/UI line, not part of architecture
  hardening.

## Architecture Health Estimate

Estimated architecture health after V2: `84/100`.

Reasoning:

- The highest-risk application-layer direct DB escape hatches in the planned V2
  scope are closed.
- Store Ops module ownership and worker graph growth now have automated guard
  pressure.
- Materialization and Power BI import surfaces are meaningfully narrower.
- Scoring and transition decisions are more explicit before prim, norm kadro,
  Store Action, and incentive growth.
- Remaining risks are real but bounded, named, and guarded by small-PR
  discipline instead of being hidden in a generic refactor bucket.

This score is not production readiness proof. It is a maintainability and
feature-growth estimate based on repo evidence and local/CI verification from
the V2 PR line.
