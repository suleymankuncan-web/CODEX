# Workforce Request Repository Split V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Extract seller-code and offboarding request persistence from `StoreOpsRepository` into a focused `WorkforceRequestRepository` without changing behavior.

**Architecture:** Keep service-level validation and authorization in `WorkforceService`. Move only workforce request SQL methods and their row types to a new repository provider. Leave store scope, target personnel rows, headcount gap, and legacy checklist writes in `StoreOpsRepository`.

**Tech Stack:** NestJS, TypeScript, PostgreSQL via existing `DatabaseService`, Jest e2e/unit tests, root release gate.

---

## Scope

This is a mechanical repository boundary split.

Allowed:

- create `WorkforceRequestRepository`,
- move seller-code and offboarding row types and repository methods,
- update `WorkforceService` constructor injection and call sites,
- register/export the new provider in `StoreOpsModule`,
- update handoff documentation,
- run targeted tests and root release gate.

Not allowed:

- no SQL behavior changes,
- no schema/migration changes,
- no new indexes,
- no DTO/controller/auth changes,
- no checklist behavior changes,
- no target-distribution behavior changes,
- no org/store scope behavior changes,
- no headcount gap behavior changes,
- no audit event name or metadata key changes,
- no pagination,
- no global audit feed,
- no account provisioning,
- no master-data promotion changes.

## Files

Create:

- `backend/nestjs/src/modules/store-ops/infrastructure/workforce-request.repository.ts`

Modify:

- `backend/nestjs/src/modules/store-ops/infrastructure/store-ops.repository.ts`
- `backend/nestjs/src/modules/store-ops/application/workforce.service.ts`
- `backend/nestjs/src/modules/store-ops/store-ops.module.ts`
- `current-state.md`
- `docs/superpowers/plans/2026-04-30-workforce-request-repository-split-v1.md`

Do not modify:

- `db/schema.sql`
- `db/migrations/*`
- `backend/nestjs/src/modules/store-ops/application/checklist.service.ts`
- `backend/nestjs/src/modules/store-ops/application/org.service.ts`
- `backend/nestjs/src/modules/store-ops/application/target-distribution.service.ts`
- `backend/nestjs/src/modules/store-ops/infrastructure/checklist.repository.ts`
- `backend/nestjs/src/modules/store-ops/infrastructure/target-distribution.repository.ts`
- `backend/nestjs/src/modules/store-ops/infrastructure/reporting.repository.ts`

## Methods To Move

Move these methods from `StoreOpsRepository` to `WorkforceRequestRepository` with the same names, SQL, input shapes, return shapes, transaction boundaries, audit event names, and metadata fields:

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

Move these row types with the methods:

- `StoreForSellerCodeRequestRow`
- `SellerCodeRequestRow`
- `PositionOptionRow`
- `ActiveStoreEmployeeRow`
- `EmployeeOffboardingRequestRow`

Keep these methods and any required local row types in `StoreOpsRepository`:

- `listStoresByScope`
- `listStorePersonnelTargetingRows`
- `getStoreHeadcountGap`
- `createChecklistInstance`
- `addChecklistResponse`
- `completeChecklistInstance`

## Task 1: Create WorkforceRequestRepository

**Files:**

- Create: `backend/nestjs/src/modules/store-ops/infrastructure/workforce-request.repository.ts`
- Modify: `backend/nestjs/src/modules/store-ops/infrastructure/store-ops.repository.ts`

- [x] **Step 1: Create the new repository shell**

Create `workforce-request.repository.ts` with:

```ts
import { Injectable } from "@nestjs/common";
import { RequestContextStore } from "../../../shared/request-context";
import { DatabaseService } from "../../../shared/database/database.service";

@Injectable()
export class WorkforceRequestRepository {
  constructor(private readonly databaseService: DatabaseService) {}
}
```

- [x] **Step 2: Move row types**

Move these type declarations from `store-ops.repository.ts` into `workforce-request.repository.ts` above the repository class:

```ts
type StoreForSellerCodeRequestRow = { ... };
type SellerCodeRequestRow = { ... };
type PositionOptionRow = { ... };
type ActiveStoreEmployeeRow = { ... };
type EmployeeOffboardingRequestRow = { ... };
```

Keep the existing field names and field types exactly the same.

- [x] **Step 3: Move seller-code methods**

Move these exact method bodies into `WorkforceRequestRepository`:

```ts
async getLatestFranchiseSellerCode() { ... }
async getStoreForSellerCodeRequest(storeId: string) { ... }
async listPositionOptionsForStore(input: { storeId: string }) { ... }
async createSellerCodeRequest(input: { ... }) { ... }
async listSellerCodeRequests(input: { ... }) { ... }
async getSellerCodeRequestById(requestId: string) { ... }
async countSellerCodeDuplicates(sellerCode: string) { ... }
async approveSellerCodeRequest(input: { ... }) { ... }
async rejectSellerCodeRequest(input: { ... }) { ... }
async resubmitSellerCodeRequest(input: { ... }) { ... }
```

Do not change SQL, event names, audit metadata, transactions, return values, or request statuses.

- [x] **Step 4: Move offboarding methods**

Move these exact method bodies into `WorkforceRequestRepository`:

```ts
async listActiveStoreEmployees(input: { storeId: string }) { ... }
async getActiveStoreEmployeeForOffboarding(input: { storeId: string; employeeId: string }) { ... }
async createOffboardingRequest(input: { ... }) { ... }
async listOffboardingRequests(input: { ... }) { ... }
async getOffboardingRequestById(requestId: string) { ... }
async approveOffboardingRequest(input: { ... }) { ... }
async rejectOffboardingRequest(input: { ... }) { ... }
async resubmitOffboardingRequest(input: { ... }) { ... }
```

Do not change SQL, event names, audit metadata, transactions, return values, assignment updates, employee updates, or turnover event writes.

- [x] **Step 5: Remove moved code from StoreOpsRepository**

After moving, `StoreOpsRepository` must start with:

```ts
import { Injectable } from "@nestjs/common";
import { RequestContextStore } from "../../../shared/request-context";
import { DatabaseService } from "../../../shared/database/database.service";

@Injectable()
export class StoreOpsRepository {
  constructor(private readonly databaseService: DatabaseService) {}
```

and must keep only:

```ts
listStoresByScope
listStorePersonnelTargetingRows
getStoreHeadcountGap
createChecklistInstance
addChecklistResponse
completeChecklistInstance
```

- [x] **Step 6: Build check**

Run:

```powershell
cd "C:\Users\suley\OneDrive\Masaüstü\WEBSİTE ÇALIŞMASI\backend\nestjs"
npm.cmd run build
```

Expected:

- build may fail until service/module injection is updated,
- only missing provider/method reference errors are acceptable at this point.

## Task 2: Update Dependency Injection And Call Sites

**Files:**

- Modify: `backend/nestjs/src/modules/store-ops/application/workforce.service.ts`
- Modify: `backend/nestjs/src/modules/store-ops/store-ops.module.ts`

- [x] **Step 1: Update WorkforceService imports**

Change:

```ts
import { StoreOpsRepository } from "../infrastructure/store-ops.repository";
```

to:

```ts
import { StoreOpsRepository } from "../infrastructure/store-ops.repository";
import { WorkforceRequestRepository } from "../infrastructure/workforce-request.repository";
```

- [x] **Step 2: Update WorkforceService constructor**

Change:

```ts
constructor(private readonly storeOpsRepository: StoreOpsRepository) {}
```

to:

```ts
constructor(
  private readonly storeOpsRepository: StoreOpsRepository,
  private readonly workforceRequestRepository: WorkforceRequestRepository,
) {}
```

- [x] **Step 3: Move workforce request call sites**

Replace workforce request calls from `this.storeOpsRepository` to `this.workforceRequestRepository`:

```ts
getLatestFranchiseSellerCode
getStoreForSellerCodeRequest
listSellerCodeRequests
listPositionOptionsForStore
listActiveStoreEmployees
createSellerCodeRequest
getSellerCodeRequestById
countSellerCodeDuplicates
approveSellerCodeRequest
rejectSellerCodeRequest
resubmitSellerCodeRequest
listOffboardingRequests
getActiveStoreEmployeeForOffboarding
createOffboardingRequest
getOffboardingRequestById
approveOffboardingRequest
rejectOffboardingRequest
resubmitOffboardingRequest
```

Keep this call on `StoreOpsRepository`:

```ts
this.storeOpsRepository.getStoreHeadcountGap(...)
```

- [x] **Step 4: Register provider in StoreOpsModule**

Add:

```ts
import { WorkforceRequestRepository } from "./infrastructure/workforce-request.repository";
```

Add `WorkforceRequestRepository` to both `providers` and `exports`.

- [x] **Step 5: Build check**

Run:

```powershell
cd "C:\Users\suley\OneDrive\Masaüstü\WEBSİTE ÇALIŞMASI\backend\nestjs"
npm.cmd run build
```

Expected:

- build passes.

## Task 3: Targeted Verification

**Files:**

- No code changes expected.

- [x] **Step 1: Run workforce e2e tests**

Run:

```powershell
cd "C:\Users\suley\OneDrive\Masaüstü\WEBSİTE ÇALIŞMASI\backend\nestjs"
npm.cmd test -- --runInBand test/integration/workforce-seller-code.e2e-spec.ts test/integration/workforce-offboarding.e2e-spec.ts
```

Expected:

- 2 test suites pass,
- seller-code 7 tests pass,
- offboarding 5 tests pass.

- [x] **Step 2: Run store ops repository unit contract**

Run:

```powershell
cd "C:\Users\suley\OneDrive\Masaüstü\WEBSİTE ÇALIŞMASI\backend\nestjs"
npm.cmd test -- --runInBand src/modules/store-ops/infrastructure/store-ops.repository.spec.ts
```

Expected:

- 1 test suite passes,
- 2 tests pass,
- empty-scope and requested-filter intersection contract remains guarded.

- [x] **Step 3: Run script guards**

Run:

```powershell
cd "C:\Users\suley\OneDrive\Masaüstü\WEBSİTE ÇALIŞMASI"
node --test scripts\*.test.mjs
```

Expected:

- all script guard tests pass.

- [x] **Step 4: Run root release gate**

Run:

```powershell
cd "C:\Users\suley\OneDrive\Masaüstü\WEBSİTE ÇALIŞMASI"
npm.cmd run check:release
```

Expected:

- backend lint/test/build/audit passes,
- frontend build/e2e/audit passes,
- only existing non-failing Vite chunk warning may appear.

- [x] **Step 5: Run whitespace diff check**

Run:

```powershell
cd "C:\Users\suley\OneDrive\Masaüstü\WEBSİTE ÇALIŞMASI"
git diff --check
```

Expected:

- exit code 0,
- Windows LF to CRLF warnings are acceptable,
- whitespace errors are not acceptable.

## Task 4: Documentation And Commit

**Files:**

- Modify: `current-state.md`
- Modify: `docs/superpowers/plans/2026-04-30-workforce-request-repository-split-v1.md`

- [x] **Step 1: Update this plan checklist**

Mark completed steps with `[x]` after implementation and verification.

- [x] **Step 2: Update current-state**

Add a short section:

```md
## Son WorkforceRequestRepository Split V1

30 Nisan 2026 itibariyla `StoreOpsRepository` icinden workforce request persistence boundary'si ayrildi.

Degisenler:

- Yeni `WorkforceRequestRepository` seller-code ve offboarding request lifecycle sorumlulugunu aldi.
- `StoreOpsRepository` store scope, target personnel rows, headcount gap ve legacy checklist write sorumluluklarini tasimaya devam eder.
- DB schema/migration/index, DTO/controller/auth, checklist, target distribution, org scope, headcount gap ve master-data davranisi degismedi.

Dogrulama:

- targeted workforce e2e gecti.
- store-ops repository unit contract gecti.
- backend build gecti.
- root script guard gecti.
- root check:release gecti.

Siradaki mantikli adim: Dis kanit yoksa `reporting.repository.ts` read-heavy risk review yapmak; dis kanit gelirse onu onceliklendirmek.
```

Update the `Devam Komutu` line with the same state in one compact sentence.

- [x] **Step 3: Commit**

Run:

```powershell
cd "C:\Users\suley\OneDrive\Masaüstü\WEBSİTE ÇALIŞMASI"
git status --short
git add backend/nestjs/src/modules/store-ops/infrastructure/workforce-request.repository.ts `
  backend/nestjs/src/modules/store-ops/infrastructure/store-ops.repository.ts `
  backend/nestjs/src/modules/store-ops/application/workforce.service.ts `
  backend/nestjs/src/modules/store-ops/store-ops.module.ts `
  current-state.md `
  docs/superpowers/plans/2026-04-30-workforce-request-repository-split-v1.md
git commit -m "refactor: split workforce request repository"
```

Expected:

- commit succeeds,
- untracked `outputs/` remains uncommitted.

## Self-Review

Spec coverage:

- The plan creates `WorkforceRequestRepository`.
- The plan keeps behavior, SQL, API, schema, auth, checklist, target distribution, org scope, and headcount gap unchanged.
- The plan names exact methods to move and exact methods to keep.
- The plan includes targeted verification and root release gate.

No placeholders:

- There are no open-ended TODO/TBD sections.
- Method bodies are intentionally moved exact, not rewritten.

Type consistency:

- Repository and service names match the design spec.
- The only new provider name is `WorkforceRequestRepository`.
