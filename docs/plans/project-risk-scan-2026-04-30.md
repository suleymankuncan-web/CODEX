# Project Risk Scan - 30 April 2026

## Purpose

Record the current project health check after Master Data Bootstrap Test Hygiene V1.

This is not a new feature plan.

No production behavior was changed by this scan.

## Green Signals

- Latest root `npm.cmd run check:release` passed after the master-data read-model split.
- Backend release check passed with 88 suites and 476 tests.
- Frontend Playwright passed with 46 tests.
- Root script tests passed with 100 tests.
- No tracked `node_modules`, `dist`, `test-results`, or `outputs` paths were found.
- No tracked `.env` file was found.
- No `TODO`, `FIXME`, `HACK`, `XXX`, `test.only`, `describe.only`, `it.only`, `debugger`, or `console.log` markers were found in tracked source/test/script/doc paths scanned.
- `outputs/` remains untracked and intentionally ignored by the current work.

## Watchlist

### 1. Large Backend Production Files

Observed largest backend source files:

- `backend/nestjs/src/modules/integration/infrastructure/integration.repository.ts` - 2180 lines
- `backend/nestjs/src/modules/store-ops/infrastructure/competition.repository.ts` - 2042 lines
- `backend/nestjs/src/modules/store-ops/infrastructure/store-ops.repository.ts` - 1912 lines
- `backend/nestjs/src/modules/store-ops/infrastructure/reporting.repository.ts` - 1737 lines
- `backend/nestjs/src/modules/auth/auth-admin.repository.ts` - 1647 lines

Risk:

- Maintenance and review cost can rise as these files continue to absorb unrelated behavior.

Decision:

- Do not refactor them only because they are large.
- Pick one only when a concrete feature or defect touches a clear boundary.
- Any split should be planned as a small domain slice with targeted tests and root `check:release`.

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

1. backend repository boundary risk review for one large repository file,
2. real staging/source/master-data evidence if it becomes available,
3. targeted cleanup of ignored local generated files if the user wants workspace hygiene.
