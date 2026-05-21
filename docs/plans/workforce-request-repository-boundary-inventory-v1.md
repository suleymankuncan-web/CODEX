# Workforce Request Repository Boundary Inventory V1

## Purpose

Create a repo-backed map before splitting `WorkforceRequestRepository`.

This is a docs-only planning slice. It changes no backend code, SQL, DTO,
OpenAPI contract, API response shape, auth/permission behavior, DB schema, CSS,
or user-facing behavior.

## Sokrates Decision

Claim:

- `WorkforceRequestRepository` is still a concentrated backend hotspot and can
  be improved with a narrow read-boundary extraction after the inventory lands.

Assumptions:

- Seller-code and offboarding request reads can be moved behind a delegated
  repository without changing service orchestration.
- Request command methods are more dangerous because they own status changes,
  audit writes, employee mutations, duplicate checks, and access closure.

Evidence:

- `backend/nestjs/src/modules/store-ops/infrastructure/workforce-request.repository.ts`
  is roughly 1689 physical lines.
- It mixes store/personnel lookup reads, seller-code request queue/detail
  reads, seller-code command flows, offboarding queue/detail reads, offboarding
  command flows, audit event persistence, and offboarding access lifecycle
  closure.
- Existing integration coverage includes
  `backend/nestjs/test/integration/workforce-seller-code.e2e-spec.ts` and
  `backend/nestjs/test/integration/workforce-offboarding.e2e-spec.ts`.

Counterargument:

- The repository is already behind `WorkforceService`, so the product does not
  need an immediate split to function. A reckless extraction would add files
  without lowering risk.

Risk:

- This inventory is LOW risk because it is docs-only.
- A seller-code queue/detail read extraction is LOW/MEDIUM risk because it
  should preserve the same SQL and response rows while reducing review surface.
- Offboarding reads are MEDIUM risk because the same row model also supports
  approval/rejection flows.
- Command/write extraction is MEDIUM/HIGH risk because it touches request
  status transitions, employee assignment mutation, turnover events, audit
  metadata, duplicate seller-code checks, and access lifecycle closure.

Door:

- Inventory and read-only extraction are two-way-door changes.
- Moving write/state-machine boundaries without invariant tests approaches a
  one-way-door operational risk and should not be bundled with read cleanup.

Stop rules:

- Stop if response fields, route behavior, status transitions, auth scope, or
  audit metadata would change.
- Stop if offboarding approval access closure behavior must move.
- Stop if DB migration or index work becomes necessary.
- Stop if seller-code duplicate detection changes.
- Stop if the PR cannot be explained as one read boundary.

## Current Method Families

### Store And Personnel Lookup Reads

Methods:

- `getLatestFranchiseSellerCode`
- `getStoreForSellerCodeRequest`
- `listPositionOptionsForStore`
- `listActiveStoreEmployees`
- `getActiveStoreEmployeeForOffboarding`

Notes:

- These are read-only helpers used before create/resubmit flows.
- They are candidates for a future lookup repository, but they are not the
  safest first split because some helpers feed command preconditions.

### Seller-Code Queue And Detail Reads

Methods:

- `listSellerCodeRequests`
- `getSellerCodeRequestById`

Notes:

- These methods are the safest first code extraction candidate.
- They build the same scoped list/detail row shape and do not own mutation or
  audit writes.
- `getSellerCodeRequestById` is also used by review/resubmit commands, so the
  facade method should remain on `WorkforceRequestRepository` and delegate to
  the new read repository.

### Seller-Code Command And Validation Flows

Methods:

- `createSellerCodeRequest`
- `countSellerCodeDuplicates`
- `approveSellerCodeRequest`
- `rejectSellerCodeRequest`
- `resubmitSellerCodeRequest`

Notes:

- These should stay parked until there is an explicit invariant/test decision.
- Approval creates an employee and assignment, mutates request status, records
  audit, and depends on duplicate seller-code validation.
- Rejection and resubmission own status/audit semantics.

### Offboarding Queue And Detail Reads

Methods:

- `listOffboardingRequests`
- `getOffboardingRequestById`

Notes:

- These are a plausible second read extraction after seller-code reads.
- They are slightly riskier than seller-code reads because the same row family
  is coupled to employee termination and access closure flows.

### Offboarding Command And Access Closure Flows

Methods:

- `createOffboardingRequest`
- `approveOffboardingRequest`
- `rejectOffboardingRequest`
- `resubmitOffboardingRequest`

Notes:

- These are parked.
- Approval terminates the employee, closes active assignment, inserts turnover
  event, looks up linked user access, calls `AccessLifecycleRepository`, updates
  request status, and records audit metadata.
- This boundary needs a separate invariant plan before any code movement.

## Existing Regression Map

Primary tests:

```powershell
npm.cmd --prefix backend/nestjs test -- workforce-seller-code.e2e-spec.ts --runInBand
npm.cmd --prefix backend/nestjs test -- workforce-offboarding.e2e-spec.ts --runInBand
```

Recommended broader grep gate for workforce slices:

```powershell
npm.cmd --prefix backend/nestjs test -- workforce --runInBand
npm.cmd --prefix backend/nestjs run build
npm.cmd --prefix backend/nestjs run lint
```

Use backend full Jest only when a slice touches shared module wiring,
dependency injection, or offboarding access lifecycle behavior:

```powershell
npm.cmd --prefix backend/nestjs test -- --runInBand
```

## Recommended Next PR

Next safe code slice:

- Extract a `WorkforceSellerCodeReadRepository` for
  `listSellerCodeRequests` and `getSellerCodeRequestById`.

Constraints:

- Keep `WorkforceRequestRepository` as the service-facing facade.
- Preserve SQL text, ordering, limits, filter precedence, return row type, and
  null behavior.
- Do not move create/approve/reject/resubmit or duplicate validation.
- Do not touch controller DTOs, API contract generation, auth scope, DB schema,
  or frontend code.

Verification ladder:

```powershell
npm.cmd --prefix backend/nestjs test -- workforce-seller-code.e2e-spec.ts --runInBand
npm.cmd --prefix backend/nestjs test -- workforce --runInBand
npm.cmd --prefix backend/nestjs run build
npm.cmd --prefix backend/nestjs run lint
```

## Parked Work

Park until explicitly scoped:

- Seller-code command repository extraction.
- Offboarding command repository extraction.
- Offboarding access lifecycle extraction.
- Any DB/index work for workforce request lists.
- Any API contract, DTO, auth, or UI behavior change.
