# Architecture Hardening V5 PR-7 Workforce Seller-Code Command Extraction

Date: 2026-05-31

## Scope

This slice extracts only the seller-code approval command persistence path from
`WorkforceRequestRepository` into
`backend/nestjs/src/modules/store-ops/infrastructure/workforce-seller-code-command.repository.ts`.

`WorkforceRequestRepository` remains the service-facing facade.

## Protected Behavior

Preserved behavior:

- Seller-code duplicate counting still checks active employee external refs and
  approved seller-code requests case-insensitively.
- Seller-code approval still runs in one `DatabaseService.withTransaction`
  group.
- Employee insertion still writes the approved seller code as
  `external_employee_ref`.
- Employee assignment insertion still uses the requested store, region,
  position, hire date, and active assignment status.
- Request update still writes approved status, approved seller code, employee
  id, reviewer, review timestamp, review note, and update timestamp.
- Audit event remains `seller_code_request.approved` through the existing
  transition policy.
- Returned projection still uses `sellerCodeRequestReturnProjection`.

Out of scope:

- Offboarding approval.
- Access lifecycle closure.
- Auth or permission semantics.
- API response shape.
- DB schema or migrations.
- Queue, import, materialization, scoring, ranking, or Store UI behavior.

## Size Impact

- `workforce-request.repository.ts`: `910` lines before PR-7, `797` lines
  after PR-7.
- New focused command repository:
  `workforce-seller-code-command.repository.ts`: `145` lines.

## Verification

```powershell
npm.cmd --prefix backend/nestjs test -- --runInBand src/modules/store-ops/application/workforce-request-transition.policy.spec.ts test/integration/workforce-seller-code.e2e-spec.ts test/integration/workforce-offboarding.e2e-spec.ts
npm.cmd --prefix backend/nestjs run build
npm.cmd --prefix backend/nestjs run lint
npm.cmd --prefix backend/nestjs run check:release
npm.cmd run test:scripts
git diff --check
```

Results:

- Targeted workforce suite: passed, `3` suites and `20` tests.
- Backend build: passed.
- Backend lint: passed.
- Backend release check: passed, `134` suites and `768` tests, build and audit
  clean.
- Script guards: passed, `386` tests.
- Diff whitespace check: passed.

## Rollback

Revert the extraction commit. No migration, data repair, queue drain, contract
regeneration, or external operational step is required.
