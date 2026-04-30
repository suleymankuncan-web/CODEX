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

Expected behavior:

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

## Verification

Targeted:

```powershell
cd "C:\Users\suley\OneDrive\Masaüstü\WEBSİTE ÇALIŞMASI\backend\nestjs"
npm.cmd test -- --runInBand test/integration/auth-pilot-user-bindings.e2e-spec.ts test/integration/auth-role-assignments.e2e-spec.ts test/integration/auth-action-store-assignments.e2e-spec.ts test/integration/auth-user-accounts.e2e-spec.ts test/integration/auth-role-permissions.e2e-spec.ts test/integration/auth-lookups.e2e-spec.ts
```

Import source split:

```powershell
cd "C:\Users\suley\OneDrive\MasaÃ¼stÃ¼\WEBSÄ°TE Ã‡ALIÅMASI\backend\nestjs"
npm.cmd test -- --runInBand test/integration/import-batch.e2e-spec.ts test/integration/integration-sources.e2e-spec.ts
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

After the integration source split, review the remaining `import-batch.e2e-spec.ts` shape. If the pattern is clean, plan a separate import-batch sub-slice for mapping/reconciliation/retry evidence. Do not split master-data in the same pass.
