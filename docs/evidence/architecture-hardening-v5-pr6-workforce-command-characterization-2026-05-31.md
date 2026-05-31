# Architecture Hardening V5 PR-6 Workforce Command Characterization

Date: 2026-05-31
Branch: `codex/architecture-hardening-v5-workforce-characterization`

## Scope

This PR selects and characterizes one workforce command path. Runtime
persistence code is not split in this PR.

Selected PR-7 target:

```text
seller-code approval command persistence
```

Current owner:

```text
backend/nestjs/src/modules/store-ops/infrastructure/workforce-request.repository.ts
```

Selected method cluster:

- `countSellerCodeDuplicates`
- `approveSellerCodeRequest`

`WorkforceRequestRepository` may remain the service-facing facade in PR-7.

## Why Seller-Code Approval

Seller-code approval is the lowest-risk remaining workforce command split:

- it creates an employee,
- creates assignment history,
- updates the seller-code request to `approved`,
- stores the approved seller code and employee id,
- writes the `seller_code_request.approved` audit event,
- depends on duplicate seller-code validation before mutation.

Offboarding approval is not selected because it also terminates employees,
closes active assignment, creates turnover events, finds linked user accounts,
and calls access lifecycle closure. That path remains parked until separate
characterization explicitly covers access lifecycle behavior.

## Test Strengthening

This PR strengthens `backend/nestjs/test/integration/workforce-seller-code.e2e-spec.ts`:

- the happy-path HR approval test now asserts approval runs inside one
  transaction,
- the happy path asserts employee and assignment mutations occur,
- a duplicate seller-code approval test proves duplicate detection happens
  before transaction/mutation/audit work.

Existing policy coverage keeps transition names and audit event names explicit:

- `backend/nestjs/src/modules/store-ops/application/workforce-request-transition.policy.spec.ts`

## Protected Behavior For PR-7

PR-7 must preserve:

- request pre-read and access-scope decision in the service,
- duplicate seller-code check before mutation,
- rejection message: `Seller code already exists: <SELLER_CODE>`,
- transaction grouping for employee insert, assignment insert, request update,
  and audit insert,
- transition target status: `approved`,
- audit event: `seller_code_request.approved`,
- audit entity: `ops.seller_code_request`,
- returned command status/message/data shape,
- no offboarding, access lifecycle, DB schema, auth scope, or API contract
  change.

## Verification

```powershell
npm.cmd --prefix backend/nestjs test -- --runInBand src/modules/store-ops/application/workforce-request-transition.policy.spec.ts test/integration/workforce-seller-code.e2e-spec.ts test/integration/workforce-offboarding.e2e-spec.ts
npm.cmd --prefix backend/nestjs run build
npm.cmd run test:scripts
git diff --check
```

Characterization test result:

```text
Test Suites: 3 passed, 3 total
Tests: 20 passed, 20 total
```

## Stop Conditions For PR-7

Stop if:

- extraction changes duplicate detection behavior,
- transaction grouping changes,
- employee or assignment mutation SQL shape changes,
- audit event or metadata changes,
- returned API shape changes,
- offboarding/access lifecycle code must move,
- auth scope behavior changes.

## Rollback

Revert the test/evidence/current-state/inventory changes. No migration, data
repair, queue drain, or runtime rollback is required.
