# WorkforceRequestRepository Split V1 Design

## Purpose

Reduce `StoreOpsRepository` ownership density by extracting personnel request persistence into a focused `WorkforceRequestRepository`.

This is a controlled architecture cleanup, not a product feature.

The goal is to make future seller-code and offboarding work safer without changing behavior, SQL semantics, API responses, schema, or authorization rules.

## Current Context

`StoreOpsRepository` currently owns:

- seller-code request lifecycle,
- seller-code approval side effects,
- offboarding request lifecycle,
- offboarding approval side effects,
- store scope listing,
- store personnel targeting rows,
- store headcount gap,
- legacy checklist instance writes.

The risk review in `docs/plans/store-ops-repository-risk-review-2026-04-30.md` identified the workforce request slice as the safest first boundary because it is cohesive and already covered by e2e tests.

## Design Decision

Create:

- `backend/nestjs/src/modules/store-ops/infrastructure/workforce-request.repository.ts`

Keep:

- `backend/nestjs/src/modules/store-ops/infrastructure/store-ops.repository.ts`

The new repository will own only workforce/personnel request persistence:

- `getLatestFranchiseSellerCode`
- `getStoreForSellerCodeRequest`
- `listPositionOptionsForStore`
- `listActiveStoreEmployees`
- `getActiveStoreEmployeeForOffboarding`
- `createSellerCodeRequest`
- `listSellerCodeRequests`
- `getSellerCodeRequestById`
- `countSellerCodeDuplicates`
- `approveSellerCodeRequest`
- `rejectSellerCodeRequest`
- `resubmitSellerCodeRequest`
- `createOffboardingRequest`
- `listOffboardingRequests`
- `getOffboardingRequestById`
- `approveOffboardingRequest`
- `rejectOffboardingRequest`
- `resubmitOffboardingRequest`

`StoreOpsRepository` will continue to own:

- `listStoresByScope`
- `listStorePersonnelTargetingRows`
- `getStoreHeadcountGap`
- `createChecklistInstance`
- `addChecklistResponse`
- `completeChecklistInstance`

## Application Wiring

`WorkforceService` will inject `WorkforceRequestRepository` for seller-code and offboarding calls.

`WorkforceService.getStoreHeadcountGap` will keep using `StoreOpsRepository`.

`OrgService`, `TargetDistributionService`, and `ChecklistService` will keep using `StoreOpsRepository` for their existing non-workforce-request calls.

`StoreOpsModule` will register and export `WorkforceRequestRepository` beside `StoreOpsRepository`.

## Data Flow

No data flow changes.

Seller-code request flow remains:

1. store manager submits request,
2. HR/Admin approves or returns,
3. approval creates employee and assignment,
4. audit event records transition evidence.

Offboarding flow remains:

1. store manager submits request for an active employee,
2. HR/Admin approves or returns,
3. approval terminates employee, closes active assignment, and writes turnover event,
4. audit event records transition evidence.

## Explicit Non-Goals

Do not change:

- database schema,
- migrations,
- indexes,
- DTOs,
- controllers,
- route paths,
- authorization guards,
- request/response payloads,
- seller-code business rules,
- national ID hashing behavior,
- offboarding approval side effects,
- audit event names,
- audit metadata keys,
- checklist behavior,
- target distribution behavior,
- org/store scope behavior,
- headcount gap behavior.

Do not add:

- region queue index,
- pagination,
- new audit helper,
- global audit feed,
- account provisioning,
- master-data promotion behavior.

These may be future improvements, but they are outside V1.

## Error Handling

No error-handling changes.

Domain validation remains in `WorkforceService`.

Repository methods keep the same database behavior and return shapes. Existing service-level `BadRequestException`, `ForbiddenException`, and `NotFoundException` behavior must remain unchanged.

## Test Strategy

Targeted tests after implementation:

- `backend/nestjs`: `npm.cmd test -- --runInBand test/integration/workforce-seller-code.e2e-spec.ts test/integration/workforce-offboarding.e2e-spec.ts`
- `backend/nestjs`: `npm.cmd test -- --runInBand src/modules/store-ops/infrastructure/store-ops.repository.spec.ts`
- `backend/nestjs`: `npm.cmd run build`

Release/guard tests:

- root: `node --test scripts\*.test.mjs`
- root: `npm.cmd run check:release`
- root: `git diff --check`

Expected result:

- all existing seller-code and offboarding e2e tests pass,
- store-scope repository contract remains covered by `store-ops.repository.spec.ts`,
- no test names are removed,
- no production behavior changes.

## No-Go Conditions

Stop and reassess if implementation requires:

- changing SQL behavior,
- changing API payloads,
- changing DB schema or migrations,
- touching checklist repository behavior,
- changing auth/action-scope behavior,
- adding indexes,
- modifying master-data promotion,
- weakening or deleting e2e tests.

## Rollback

Rollback is simple because this is a provider boundary split.

If verification fails in a way that is not a direct import/injection issue, revert the split and keep the risk review as the source of truth.

## CODEX DURUST YORUM

This split is worth doing now because the personnel approval flows have high blast radius and will likely grow.

The safe version is boring: move cohesive persistence methods, update injection, run tests, commit.

The unsafe version is tempting: fix audit actor columns, add region indexes, introduce pagination, and clean checklist at the same time. V1 must not do that.

This is controlled architecture cleanup, not debt panic.
