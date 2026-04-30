# Test Suite Hygiene V1

## Purpose

Reduce backend test maintenance risk without weakening the safety net.

No behavior coverage is deleted in this pass.

Production code is not changed.

Test count must stay stable unless a duplicate test is explicitly documented.

Root `npm.cmd run check:release` remains the release gate.

## Honest Risk Check

Project scatter risk: low if we split mechanically and keep the same assertions.

Primary risk: accidentally dropping a test case during file movement.

Secondary risk: creating a broad helper abstraction that hides business expectations.

The safe move is to split large files by domain, not to rewrite test logic.

## No-Go Rules

No-Go: any targeted auth suite failure.

No-Go: root release gate failure.

No-Go: broad helper abstraction that hides business expectations.

No-Go: reducing test count without an explicit duplicate-removal note.

No-Go: changing production behavior while doing test hygiene.

## First Safe Slice

First safe slice: split `backend/nestjs/test/integration/auth-role-assignments.e2e-spec.ts`.

Target files:

- `backend/nestjs/test/integration/auth-pilot-user-bindings.e2e-spec.ts`
- `backend/nestjs/test/integration/auth-role-assignments.e2e-spec.ts`
- `backend/nestjs/test/integration/auth-action-store-assignments.e2e-spec.ts`
- `backend/nestjs/test/integration/auth-user-accounts.e2e-spec.ts`
- `backend/nestjs/test/integration/auth-role-permissions.e2e-spec.ts`
- `backend/nestjs/test/integration/auth-lookups.e2e-spec.ts`

Expected behavior at the time of this slice:

- The same 28 auth-admin integration tests still run.
- Test names remain unchanged.
- Setup may be duplicated in the first slice if that keeps expectations visible.
- Shared helpers may be introduced later only if they remove repeated setup without hiding business assertions.

## Deferred Files

Do not split these in the first slice:

- `backend/nestjs/test/integration/import-batch.e2e-spec.ts`
- `backend/nestjs/src/modules/integration/application/master-data-bootstrap.service.spec.ts`

Reason:

- Both are larger and touch import/master-data business evidence. They should be split only after the auth split proves the pattern.

## Second Safe Slice

Second safe slice: split integration source management tests out of `backend/nestjs/test/integration/import-batch.e2e-spec.ts`.

Target files:

- `backend/nestjs/test/integration/import-batch.e2e-spec.ts`
- `backend/nestjs/test/integration/integration-sources.e2e-spec.ts`

Expected behavior:

- The same 32 import/integration e2e tests still run across the two files.
- The 24 import batch tests remain in `import-batch.e2e-spec.ts`.
- The 8 integration source tests move to `integration-sources.e2e-spec.ts`.
- Test names remain unchanged.
- Production code is not changed.

Reason:

- Integration source CRUD, lookup, audit, duplicate-source, inactive-source, and deactivate-guard tests are a natural boundary.
- This reduces the largest import test file without touching staging, reconciliation, mapping, retry, or master-data assertions.

Deferred after this slice:

- Do not split staging/materialization/reconciliation from `import-batch.e2e-spec.ts` in the same pass.
- Do not split `master-data-bootstrap.service.spec.ts` in this pass.
- Review the remaining import file shape before choosing the next slice.

## Third Safe Slice

Third safe slice: split import batch evidence tests out of `backend/nestjs/test/integration/import-batch.e2e-spec.ts`.

Target files:

- `backend/nestjs/test/integration/import-batch.e2e-spec.ts`
- `backend/nestjs/test/integration/import-batch-evidence.e2e-spec.ts`
- `backend/nestjs/test/integration/integration-sources.e2e-spec.ts`

Expected behavior:

- The same 32 import/integration e2e tests still run across the three files.
- The 11 import batch staging/creation tests remain in `import-batch.e2e-spec.ts`.
- The 13 batch detail, lineage, reconciliation, error row, mapping, audit, and retry tests move to `import-batch-evidence.e2e-spec.ts`.
- The 8 integration source tests remain in `integration-sources.e2e-spec.ts`.
- Test names remain unchanged.
- Production code is not changed.

Reason:

- Batch evidence tests are read/reconcile/retry focused and form a natural boundary from staging-row creation.
- This keeps source/staging tests, evidence tests, and integration source management tests understandable without hiding business expectations behind helpers.

Deferred after this slice:

- Do not split `master-data-bootstrap.service.spec.ts` in this pass.
- Do not introduce shared helper abstractions until repeated setup becomes the real maintenance problem.
- Review remaining large backend specs by risk, not by line count alone.

## Fourth Safe Slice

Fourth safe slice: split competition team template repository tests out of `backend/nestjs/src/modules/store-ops/infrastructure/competition.repository.spec.ts`.

Target files:

- `backend/nestjs/src/modules/store-ops/infrastructure/competition.repository.spec.ts`
- `backend/nestjs/src/modules/store-ops/infrastructure/competition-team-template.repository.spec.ts`

Expected behavior:

- The same 27 competition repository tests still run across the two files.
- The 21 stage, package plan, finalization, score, and scope tests remain in `competition.repository.spec.ts`.
- The 6 team template CRUD/clone/list tests move to `competition-team-template.repository.spec.ts`.
- Test names remain unchanged.
- Production code is not changed.

Reason:

- Team template management is a natural repository boundary and does not require changing competition package, finalization, score, or scope assertions.
- Master-data remains deliberately deferred because its business rules are denser and should not be split merely because it is the largest file.

Deferred after this slice:

- Do not split master-data until a separate, mechanical boundary is proven.
- Review `competition.service.spec.ts`, `snapshot-run.e2e-spec.ts`, and `auth-scope.e2e-spec.ts` as lower-risk future candidates.

## Fifth Safe Slice

Fifth safe slice: split competition stage package plan repository tests out of `backend/nestjs/src/modules/store-ops/infrastructure/competition.repository.spec.ts`.

Target files:

- `backend/nestjs/src/modules/store-ops/infrastructure/competition.repository.spec.ts`
- `backend/nestjs/src/modules/store-ops/infrastructure/competition-stage-package-plan.repository.spec.ts`
- `backend/nestjs/src/modules/store-ops/infrastructure/competition-team-template.repository.spec.ts`

Expected behavior:

- The same 27 competition repository tests still run across the three files.
- The 10 stage creation, execution, finalization, score, and scope tests remain in `competition.repository.spec.ts`.
- The 11 stage package plan draft/review/clone/audit tests move to `competition-stage-package-plan.repository.spec.ts`.
- The 6 team template CRUD/clone/list tests remain in `competition-team-template.repository.spec.ts`.
- Test names remain unchanged.
- Production code is not changed.

Reason:

- Stage package plan lifecycle is a natural boundary from stage execution/finalization and team template management.
- This keeps the repository tests small enough to scan without extracting broad shared helpers.

Deferred after this slice:

- Do not split master-data until a separate, mechanical boundary is proven.
- Next low-risk candidates remain `competition.service.spec.ts`, `snapshot-run.e2e-spec.ts`, and `auth-scope.e2e-spec.ts`.

## Sixth Safe Slice

Sixth safe slice: split snapshot run read-model tests out of `backend/nestjs/test/integration/snapshot-run.e2e-spec.ts`.

Target files:

- `backend/nestjs/test/integration/snapshot-run.e2e-spec.ts`
- `backend/nestjs/test/integration/snapshot-run-read-models.e2e-spec.ts`

Expected behavior:

- The same 13 snapshot run e2e tests still run across the two files.
- The 4 command/rerun governance tests remain in `snapshot-run.e2e-spec.ts`.
- The 9 list/detail/audit/summary/overview/needs-action/lookups/dependencies/lineage read-model tests move to `snapshot-run-read-models.e2e-spec.ts`.
- Test names remain unchanged.
- Production code is not changed.

Reason:

- Snapshot run commands and snapshot run read models are a clean mechanical boundary.
- This reduces the command file to the paths that create/rerun or block reruns, while keeping screen/read evidence together.

Deferred after this slice:

- Do not split master-data until a separate, mechanical boundary is proven.
- Next low-risk candidates remain `competition.service.spec.ts` and `auth-scope.e2e-spec.ts`.

## Seventh Safe Slice

Seventh safe slice: split competition service team-template tests out of `backend/nestjs/src/modules/store-ops/application/competition.service.spec.ts`.

Target files:

- `backend/nestjs/src/modules/store-ops/application/competition.service.spec.ts`
- `backend/nestjs/src/modules/store-ops/application/competition-team-template.service.spec.ts`

Expected behavior:

- The same 24 competition service tests still run across the two files.
- The 8 list/create/update/deactivate/clone team-template service tests move to `competition-team-template.service.spec.ts`.
- The 16 stage, package, plan, finalization, and scoped detail tests remain in `competition.service.spec.ts`.
- Test names remain unchanged.
- Production code is not changed.

Reason:

- Team-template service behavior is a natural boundary from stage package planning and competition finalization.
- This is lower risk than starting with `auth-scope.e2e-spec.ts`, because auth-scope is a security matrix and should be split only after an even tighter boundary is chosen.

Deferred after this slice:

- Do not split master-data until a separate, mechanical boundary is proven.
- Next candidate is `auth-scope.e2e-spec.ts` only if its scope surfaces can be split without weakening security evidence.

## Eighth Safe Slice

Eighth safe slice: split action-scope authorization tests out of `backend/nestjs/test/integration/auth-scope.e2e-spec.ts`.

Target files:

- `backend/nestjs/test/integration/auth-scope.e2e-spec.ts`
- `backend/nestjs/test/integration/auth-action-scope.e2e-spec.ts`

Expected behavior:

- The same 18 auth scope integration tests still run across the two files.
- The 12 read-scope, role, session, and JWT tests remain in `auth-scope.e2e-spec.ts`.
- The 6 target-distribution and checklist action-scope tests move to `auth-action-scope.e2e-spec.ts`.
- Test names remain unchanged.
- Production code is not changed.

Reason:

- Action-scope tests guard write/action surfaces, not general read/session scope.
- This keeps the security evidence complete while separating assigned-store action checks from the broader auth matrix.

Deferred after this slice:

- Do not split master-data until a separate, mechanical boundary is proven.
- Test Suite Hygiene V1 should pause unless another oversized file has a clearly mechanical boundary.

## Verification

Targeted:

```powershell
cd "C:\Users\suley\OneDrive\Masaüstü\WEBSİTE ÇALIŞMASI\backend\nestjs"
npm.cmd test -- --runInBand test/integration/auth-pilot-user-bindings.e2e-spec.ts test/integration/auth-role-assignments.e2e-spec.ts test/integration/auth-action-store-assignments.e2e-spec.ts test/integration/auth-user-accounts.e2e-spec.ts test/integration/auth-role-permissions.e2e-spec.ts test/integration/auth-lookups.e2e-spec.ts
```

Import split:

```powershell
cd "C:\Users\suley\OneDrive\MasaÃ¼stÃ¼\WEBSÄ°TE Ã‡ALIÅMASI\backend\nestjs"
npm.cmd test -- --runInBand test/integration/import-batch.e2e-spec.ts test/integration/import-batch-evidence.e2e-spec.ts test/integration/integration-sources.e2e-spec.ts
```

Competition repository split:

```powershell
cd "C:\Users\suley\OneDrive\MasaÃ¼stÃ¼\WEBSÄ°TE Ã‡ALIÅMASI\backend\nestjs"
npm.cmd test -- --runInBand src/modules/store-ops/infrastructure/competition.repository.spec.ts src/modules/store-ops/infrastructure/competition-stage-package-plan.repository.spec.ts src/modules/store-ops/infrastructure/competition-team-template.repository.spec.ts
```

Snapshot run split:

```powershell
cd "C:\Users\suley\OneDrive\MasaÃƒÂ¼stÃƒÂ¼\WEBSÃ„Â°TE Ãƒâ€¡ALIÃ…ÂMASI\backend\nestjs"
npm.cmd test -- --runInBand test/integration/snapshot-run.e2e-spec.ts test/integration/snapshot-run-read-models.e2e-spec.ts
```

Competition service split:

```powershell
cd "C:\Users\suley\OneDrive\MasaÃƒÆ’Ã‚Â¼stÃƒÆ’Ã‚Â¼\WEBSÃƒâ€Ã‚Â°TE ÃƒÆ’Ã¢â‚¬Â¡ALIÃƒâ€¦Ã‚ÂMASI\backend\nestjs"
npm.cmd test -- --runInBand src/modules/store-ops/application/competition.service.spec.ts src/modules/store-ops/application/competition-team-template.service.spec.ts
```

Auth scope split:

```powershell
cd "C:\Users\suley\OneDrive\MasaÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¼stÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¼\WEBSÃƒÆ’Ã¢â‚¬ÂÃƒâ€šÃ‚Â°TE ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¡ALIÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚ÂMASI\backend\nestjs"
npm.cmd test -- --runInBand test/integration/auth-scope.e2e-spec.ts test/integration/auth-action-scope.e2e-spec.ts
```

Guard:

```powershell
cd "C:\Users\suley\OneDrive\Masaüstü\WEBSİTE ÇALIŞMASI"
node --test scripts\test-suite-hygiene-contract.test.mjs
```

Release:

```powershell
cd "C:\Users\suley\OneDrive\Masaüstü\WEBSİTE ÇALIŞMASI"
npm.cmd run check:release
```

## CODEX DURUST YORUM

This is safe if it stays boring.

The project will not scatter from this pass because no production code changes and no test intent changes. The only acceptable change is file structure: a large auth integration test file becomes smaller domain files.

The risk becomes real only if we start inventing clever helpers, rewriting assertions, or mixing this with feature work. We will not do that in V1.

## Next Logical Step

After the auth action-scope split, pause Test Suite Hygiene V1 unless another oversized file has a clearly mechanical boundary.

Master-data now has its own explicit plan:

- `docs/plans/master-data-bootstrap-test-hygiene-v1.md`

Do not implement that plan by starting with a split. The first approved implementation step must be the guard-only task that freezes all 29 current master-data bootstrap service test names before any test block moves.

## Ninth Safe Slice

Ninth safe slice: split master-data bootstrap staging and normalization tests out of `backend/nestjs/src/modules/integration/application/master-data-bootstrap.service.spec.ts`.

Target files:

- `backend/nestjs/src/modules/integration/application/master-data-bootstrap.service.spec.ts`
- `backend/nestjs/src/modules/integration/application/master-data-bootstrap-staging.service.spec.ts`

Expected behavior:

- The same 29 master-data bootstrap service tests still run across the two files.
- The 4 staging and normalization tests move to `master-data-bootstrap-staging.service.spec.ts`.
- Validation, read-model/readiness, and promotion safety tests remain in `master-data-bootstrap.service.spec.ts`.
- Test names remain unchanged.
- Production code is not changed.

Reason:

- Staging/normalization is the cleanest mechanical boundary.
- This reduces the largest master-data service test file without touching validation or live promotion safety evidence.

Deferred after this slice:

- Do not split validation or promotion in the same pass.
- Consider read-model/readiness only after this slice passes targeted tests, guard, and release.

## Tenth Safe Slice

Tenth safe slice: split master-data bootstrap read-model and readiness tests out of `backend/nestjs/src/modules/integration/application/master-data-bootstrap.service.spec.ts`.

Target files:

- `backend/nestjs/src/modules/integration/application/master-data-bootstrap.service.spec.ts`
- `backend/nestjs/src/modules/integration/application/master-data-bootstrap-staging.service.spec.ts`
- `backend/nestjs/src/modules/integration/application/master-data-bootstrap-read-models.service.spec.ts`

Expected behavior:

- The same 29 master-data bootstrap service tests still run across the three files.
- The 19 validation and promotion safety tests remain in `master-data-bootstrap.service.spec.ts`.
- The 4 staging and normalization tests remain in `master-data-bootstrap-staging.service.spec.ts`.
- The 6 list/review/readiness tests move to `master-data-bootstrap-read-models.service.spec.ts`.
- `buildBootstrapReadinessRow` moves with the read-model/readiness tests because it is exclusive to that bucket.
- Test names remain unchanged.
- Production code is not changed.

Reason:

- Read-model/readiness tests are a clean boundary from validation and promotion write safety.
- This keeps promotion safety evidence in the original service spec while making admin/readiness evidence easier to scan.

Deferred after this slice:

- Stop Master Data Bootstrap Test Hygiene V1 here unless a new explicit plan is approved.
- Do not split validation or promotion safety just because the file is still large.
