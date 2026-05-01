# Project Risk Scan - 30 April 2026

## Purpose

Record the current project health check after Master Data Bootstrap Test Hygiene V1.

This is not a new feature plan.

No production behavior was changed by this scan.

## Green Signals

- Latest root `npm.cmd run check:release` passed after Pilot Readiness Gate V1.
- Backend release check passed with 89 suites and 486 tests.
- Frontend Playwright passed with 47 tests.
- Root script tests passed with 113 tests.
- No tracked `node_modules`, `dist`, `test-results`, or `outputs` paths were found.
- No tracked `.env` file was found.
- No `TODO`, `FIXME`, `HACK`, `XXX`, `test.only`, `describe.only`, `it.only`, `debugger`, or `console.log` markers were found in tracked source/test/script/doc paths scanned.
- `outputs/` is ignored by root `.gitignore` and remains outside tracked release files.
- Project debt ledger snapshot counts are now guarded against drift across `project-debt-ledger.md`, `active-next-actions.md`, and the latest `current-state.md` debt ledger block.
- Repo Hygiene Guard V1 rejects tracked generated folders and local secret env files through root script tests.
- Pilot readiness is now an explicit Go / Conditional Go / No-Go evidence gate, not an informal confidence statement.

## Watchlist

### 1. Large Backend Production Files

Observed largest backend source files:

- `backend/nestjs/src/modules/store-ops/infrastructure/competition.repository.ts` - 2215 lines
- `backend/nestjs/src/modules/store-ops/infrastructure/reporting.repository.ts` - 1897 lines
- `backend/nestjs/src/modules/auth/auth-admin.repository.ts` - 1769 lines
- `backend/nestjs/src/modules/integration/infrastructure/integration.repository.ts` - 1713 lines
- `backend/nestjs/src/modules/store-ops/infrastructure/workforce-request.repository.ts` - 1623 lines
- `backend/nestjs/src/modules/store-ops/application/reporting.service.ts` - 1533 lines

Risk:

- Maintenance and review cost can rise as these files continue to absorb unrelated behavior.

Decision:

- Do not refactor them only because they are large.
- Pick one only when a concrete feature or defect touches a clear boundary.
- Any split should be planned as a small domain slice with targeted tests and root `check:release`.
- `integration.repository.ts` has now been reviewed separately and is treated as a planned investment, not an active refactor target.
- `store-ops.repository.ts` has now been reviewed separately; the workforce request slice was extracted into `WorkforceRequestRepository`, while remaining checklist/read boundaries are treated as planned investments, not active refactor targets.
- `reporting.repository.ts` has now been reviewed separately; it remains a monitored read-model boundary, while closed-ranking/performance/snapshot-report splits and query/index work wait for concrete reporting changes or measured pilot data.
- `auth-admin.repository.ts` has now been reviewed separately; one user-account pagination count defect was fixed, open-ended active role-assignment DB uniqueness is now implemented with nullable-scope-safe index protection, searchable active user/store lookup endpoints are implemented with literal wildcard escaping and without schema/index migration, and `/admin/auth` now uses those endpoints for role/action-store assignment selection.

Reference:

- `docs/plans/integration-repository-risk-review-2026-04-30.md`
- `docs/plans/store-ops-repository-risk-review-2026-04-30.md`
- `docs/plans/reporting-repository-risk-review-2026-04-30.md`
- `docs/plans/auth-admin-repository-risk-review-2026-04-30.md`
- `docs/superpowers/plans/2026-04-30-auth-role-assignment-active-uniqueness-v1.md`
- `docs/superpowers/plans/2026-04-30-auth-admin-searchable-lookups-v1.md`

### 2. Large Frontend Files

Observed largest frontend files:

- `admin-web/src/features/competitions/StageBuilderForm.tsx` - 2009 lines
- `admin-web/e2e/competition-surfaces.spec.ts` - 1431 lines
- `admin-web/e2e/store-surfaces.spec.ts` - 1209 lines
- `admin-web/src/pages/StoreApprovalsPage.tsx` - 1201 lines
- `admin-web/src/index.css` - 1062 lines
- `admin-web/src/pages/StoreKpiHighlightsPage.tsx` - 1044 lines

Risk:

- UI iteration can become slower if large screens are redesigned before backend/data contracts stabilize.

Decision:

- Keep broad UI redesign deferred.
- When UI work starts, split by reversible pilot surfaces, not by a full visual rewrite.
- `StageBuilderForm.tsx` has now been reviewed separately and is treated as a planned investment, not an active refactor target.

Reference:

- `docs/plans/stage-builder-form-risk-review-2026-04-30.md`

### 3. Master Data Validation/Promotion Test Split

Status: `planned_investment`

Current shape:

- `master-data-bootstrap.service.spec.ts` now keeps validation and promotion safety together.
- `master-data-bootstrap-staging.service.spec.ts` owns staging/normalization.
- `master-data-bootstrap-read-models.service.spec.ts` owns read-model/readiness.
- The guard keeps all 29 master-data service test names present exactly once.

Risk:

- Validation and promotion protect live master-data write safety, so splitting them without a new plan could weaken review confidence.

Decision:

- Do not split validation or promotion now.
- Treat this as a planned investment, not active debt.
- Revisit only with an explicit plan that freezes validation and promotion test names separately before moving anything.

### 4. External Evidence Still Blocks Real-World Confidence

Still external:

- real staging IdP values and seeded staging DB evidence
- true store/personnel baseline master-data files
- real JSON/source delivery details or sample payload
- realistic production-like data volume for index/performance review
- real pilot KPI import smoke evidence

Decision:

- Do not write source-specific JSON adapter code without real evidence.
- Do not promote full baseline master data without the pilot smoke runbook.
- Do not add speculative indexes without measured query evidence.

### 5. Ignored Local Files

Observed ignored local files:

- `backend/nestjs/Yeni Metin Belgesi.txt`
- `admin-web/Yeni Metin Belgesi.txt`
- generated local folders such as `admin-web/test-results/`, `admin-web/dist/`, `backend/nestjs/dist/`, and `node_modules/`

Risk:

- No tracked repo risk today because `.gitignore` covers them.

Decision:

- Leave them alone unless the user asks for local cleanup.

## CODEX DURUST YORUM

The project is currently debt-controlled, not debt-free.

The highest-value risks are no longer hidden bugs in the test suite. They are now operational and scaling risks:

- real staging evidence,
- real baseline data,
- large file maintainability,
- future UI redesign discipline,
- measured DB performance after realistic data exists.

That is a healthier phase. The dangerous move would be to open a new module or broad refactor just because the project feels large. The safe move is to keep using guarded slices.

## Recommended Next Move

Do not open validation/promotion test split now.

If no external evidence is available, choose the next small guard through the intake gate.

The best local candidates to consider next are:

1. real staging/source/master-data evidence if it becomes available,
2. targeted auth-admin UI changes only if pilot admin operation proves a concrete need,
3. reporting service boundary review if a concrete reporting API/UI change appears,
4. targeted cleanup of ignored local generated files if the user wants workspace hygiene.

Note:

- Searchable auth-admin lookup V1 has a design spec at `docs/superpowers/specs/2026-04-30-auth-admin-searchable-lookups-v1-design.md`.
- Searchable auth-admin lookup V1 has a backend-first implementation plan at `docs/superpowers/plans/2026-04-30-auth-admin-searchable-lookups-v1.md`.
- Backend endpoints are implemented for active user and active store search, and frontend wiring is implemented for role/action-store assignment. Schema/index work and broad auth-admin repository split remain future optional slices that need measured evidence or a concrete auth-admin workflow.
