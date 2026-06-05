# Store Workforce And Approvals Split PR-1 Contract Matrix

Date: 2026-06-05
Status: active PR-1 evidence
Risk class: R0 docs/process
Contract Impact: none

## Scope Guard

This PR does not change runtime code, API response shape, DB schema, auth or
permission semantics, target distribution lifecycle, seller-code lifecycle,
offboarding lifecycle, scoring, routing behavior, or user-facing workflows.

Rollback is docs-only: revert this evidence file and the linked plan/index
updates.

## Source Inventory

| Area | Source | Evidence |
| --- | --- | --- |
| Store route shell | `admin-web/src/app/store-shell.tsx` | No `/store/workforce` route exists yet. `/store/approvals` is guarded by `canListTargetDistributionRequests`. |
| Store sidebar/navigation | `admin-web/src/app/store-navigation.ts`, `admin-web/src/app/store-sidebar.tsx` | No `workforce` nav icon/id exists. Current approvals nav uses `requestsApprovals`. |
| Store auth helpers | `admin-web/src/features/auth/authorization.ts` | Existing helpers cover target list/create/approve, checklist read/acknowledge, assigned action stores, and read stores. No workforce-specific frontend helper exists. |
| Store approvals page | `admin-web/src/pages/StoreApprovalsPage.tsx` and child files | Current page owns target distribution creation, target approval, submitted target ledger, seller-code creation/resubmit, offboarding creation/resubmit, and returned workforce request editing. |
| Store approvals prefetch | `admin-web/src/features/store-approvals/prefetch.ts` | Seller-code/offboarding and store employee prefetch are enabled only for `storeManager` persona plus `canCreateTargetDistributionRequest`. Region/read-only personas do not prefetch workforce queues. |
| Workforce frontend API | `admin-web/src/features/workforce/api.ts` | Typed wrappers exist for seller-code request list/create/approve/reject/resubmit, offboarding list/create/approve/reject/resubmit, position options, and store employees. No typed wrapper exists for `headcount-gap`. |
| Workforce backend controller | `backend/nestjs/src/modules/store-ops/web/workforce.controller.ts` | Store employee and position option reads require `STORE_MANAGER`/`SUPER_ADMIN` plus action-store scope. Seller-code/offboarding lists allow `HR_ADMIN`/`SUPER_ADMIN`/`STORE_MANAGER`; region managers are not allowed. |
| Workforce backend service | `backend/nestjs/src/modules/store-ops/application/workforce.service.ts` | Store-manager list/action paths are limited to assigned stores; rejected seller-code/offboarding resubmit keeps the same request id and requires action-store scope. |
| Workforce reporting/norm context | `docs/evidence/norm-kadro-workforce-planning-readonly-v1.md` | Norm plan and workforce reporting exist as read-only planning context. The current Store workforce product surface is not implemented. |
| Existing E2E guard | `admin-web/e2e/store-surfaces.spec.ts` | Approvals tests already assert target payload shape, seller-code payload shape, offboarding payload shape, returned request resubmit payloads, and that region manager approvals do not query workforce queues. |
| Backend workforce tests | `backend/nestjs/test/integration/workforce-seller-code.e2e-spec.ts`, `backend/nestjs/test/integration/workforce-offboarding.e2e-spec.ts` | Backend tests cover assigned-store list scoping, create, approve, reject, and same-request resubmit behavior. |

## Route And Sidebar Visibility Evidence

Intended `/store/workforce` product visibility can be implemented from the
existing auth summary without changing backend auth semantics, but it needs a
new frontend helper instead of reusing target approvals helpers.

| Actor | Intended Route | Intended Sidebar | Current Mapping Evidence | PR-2 Decision |
| --- | --- | --- | --- | --- |
| Store manager with assigned/action store | allowed | visible | `STORE_MANAGER` plus true action-store scope proves action-store context. `getAssignedStoreIds(authSummary)` is not sufficient for this route because it falls back to read `scope.storeIds`; PR-2 must inspect `authSummary.user.actionScope.assignedStoreIds` or legacy `authSummary.user.assignedStoreIds` directly. Workforce store employee, position, create, and resubmit endpoints already require the same action-store boundary. | Add a workforce-specific frontend helper using true action-scope data, not read-scope fallback data. |
| Region manager with read-scope stores | allowed | visible | `REGION_MANAGER` plus `getReadStoreIds(authSummary).length > 0` proves read-scope context, but current workforce APIs do not provide region workforce detail data. | Route can exist for the role, but region detail must be honest missing-contract state until a read aggregate exists. |
| Store personnel | forbidden | hidden | Current approvals personnel exclusion is recorded in `docs/evidence/pilot-readiness/2026-05-22-pilot-005-store-approvals-personnel-ux.md`. No workforce product requirement grants personnel access. | Helper must return false. Direct route must show access state if reached. |
| Read-only/reporting user without Store workforce scope | forbidden | hidden | `REPORT_VIEWER` can list target requests today, but has no workforce product action or workforce API permission for store employee/personnel detail. | Helper must return false unless a future explicit Store workforce read contract is approved. |
| Admin-only user without Store shell role | forbidden from Store shell | hidden in Store shell | Store shell persona currently treats admin landing roles as region-like for some Store pages, but the workforce product decision is manager/region scoped only. | Do not add workforce nav for admin-only sessions. |

PR-2 route/sidebar parity must prove adding `Norm Kadro` does not change
existing Store route visibility for home, KPI, rankings, approvals, targets,
tasks, checklists, reports, feed, settings, or parked incentives.

## Workforce Data Contract Matrix

| Prototype Field | Production Source | Classification | V1 Rule |
| --- | --- | --- | --- |
| Personnel scope for store manager | `/api/workforce/store-employees?storeId=` via `getStoreEmployees` | Existing typed frontend contract | Count real returned active employees only. |
| Employee display name | `StoreEmployee.displayName` | Existing | Show value from API. If empty, use existing product fallback only; do not invent names. |
| Employee reference | `StoreEmployee.externalEmployeeRef` | Existing nullable | Show when present; otherwise honest missing state. |
| Position | `StoreEmployee.positionName` / `positionCode` | Existing | Group by real values. Missing values become `Pozisyon bilgisi yok`. |
| Hire/start date | `StoreEmployee.assignmentStartDate` | Existing, but not named hire date | Use as `Giris tarihi` / assignment start for active rows. Do not label it as legal hire date unless backend contract changes. |
| Tenure | Derived from `assignmentStartDate` | Derived | Derive deterministically on frontend. Missing date becomes `Kidem hesaplanamadi`. |
| Store average tenure | Derived from store employees with assignment dates | Derived | Allowed for store manager own assigned/action store. Show excluded/missing count if relevant. |
| Store tenure buckets | Derived from store employees with assignment dates | Derived | Allowed for store manager. Buckets must not include employees with missing dates. |
| Store position distribution | Derived from store employee position fields | Derived | Allowed for store manager. Do not hard-code fake categories; only group real labels plus missing bucket. |
| Seller-code request status | `/api/workforce/seller-code-requests?status=` | Existing typed frontend contract | Use existing request statuses and meta only. |
| Offboarding request status | `/api/workforce/offboarding-requests?status=` | Existing typed frontend contract | Use existing request statuses and meta only. |
| Returned seller-code correction | Existing rejected seller-code request + `resubmitSellerCodeRequest(requestId, ...)` | Existing lifecycle | Must preserve the same `requestId`; PR-3/PR-5 must test this. |
| Returned offboarding correction | Existing rejected offboarding request + `resubmitOffboardingRequest(requestId, ...)` | Existing lifecycle | Must preserve the same `requestId`; PR-3/PR-5 must test this. |
| Seller-code creation | `createSellerCodeRequest` payload from current approvals form | Existing lifecycle | Move/reuse the same payload shape only after parity test. |
| Offboarding creation | `createOffboardingRequest` payload from current approvals form | Existing lifecycle | Move/reuse the same payload shape only after parity test. |
| Norm staffing target | `ops.workforce_norm_plan` and `/api/workforce/headcount-gap` backend read | Existing backend data, missing typed frontend wrapper/OpenAPI path | Do not fake. Store UI may show `Norm tanimli degil` or park until typed read wrapper/contract is added. |
| Norm vs actual | Headcount gap read plus active employee count | Partially existing | Do not compute from fake target. Use only if typed/store-scoped read is wired safely. |
| Region store list | Existing Store KPI/rankings surfaces can show scoped stores for KPI context | Existing for KPI/ranking, not workforce | Can inform shell/list shape, but cannot provide workforce personnel detail. |
| Region personnel count per store | No current Store workforce aggregate | Missing contract | PR-4 must show honest missing-contract state or stop for a separate read-contract plan. |
| Region average tenure | No current Store workforce aggregate and region manager cannot call store employee endpoint | Missing contract | Do not derive by unbounded frontend fetch. |
| Region position totals | No current Store workforce aggregate and region manager cannot call store employee endpoint | Missing contract | Do not fake. |
| Region detail modal personnel tab | Current `store-employees` endpoint requires `STORE_MANAGER`/`SUPER_ADMIN` and action-store scope | Missing for region manager | Modal can exist only with empty/missing-contract state until backend read contract exists. |
| Region detail modal workforce requests | Seller/offboarding list endpoints do not allow `REGION_MANAGER` | Missing for region manager | Do not query these endpoints for region manager in PR-4. |

## PR Output Decisions

### PR-2 Route Foundation

- Add `/store/workforce` and sidebar label `Norm Kadro`.
- Add a frontend-only route/sidebar helper based on existing role and scope
  data:
  - store manager: `STORE_MANAGER` plus at least one true action-scope store
    from `authSummary.user.actionScope.assignedStoreIds` or legacy
    `authSummary.user.assignedStoreIds`, without falling back to read
    `scope.storeIds`,
  - region manager: `REGION_MANAGER` plus at least one read-scope store,
  - false for `STORE_PERSONNEL`, plain `REPORT_VIEWER`, and admin-only users.
- Add route/module/preload wiring only after route visibility parity coverage.
- The page can initially render an honest shell/access/loading/error state; it
  must not invent norm, regional aggregate, or personnel data.

### PR-3 Store Manager Workforce

- Store manager implementation is supported by existing contracts for active
  employees, positions, seller-code creation/resubmit, and offboarding
  creation/resubmit.
- Target distribution creation must stay on `/store/targets`; PR-3 must not
  move target forms into workforce.
- Before removing any approvals creation path, add/keep tests that prove:
  seller-code create payload parity, offboarding create payload parity, and
  returned request resubmit keeps the same `requestId`.
- Norm vs actual is not safe as a completed metric unless the headcount gap
  frontend contract is typed and store-scoped in the same PR or explicitly
  parked as `Norm tanimli degil`.

### PR-4 Region Manager Workforce

- Current backend/frontend contracts do not support the approved region manager
  personnel/detail prototype with real data.
- Region manager cannot call `store-employees`, `position-options`,
  `seller-code-requests`, or `offboarding-requests` for scoped store detail
  today.
- PR-4 must either:
  - ship only an honest region workforce shell/list with unavailable detail
    states and no fake aggregate values, or
  - stop for a separate backend read-contract plan.
- It must not fetch all store-manager endpoints in a loop, widen frontend role
  checks, show out-of-scope data, or add `Magazaya git`.

### PR-5 Approvals Talep Merkezi

- PR-5 must wait until PR-3 proves seller-code/offboarding creation and
  returned correction are available from `/store/workforce`.
- Approvals cleanup may remove creation forms only after the replacement path
  exists and tests prove no workflow is stranded.
- Target creation/revision handoff must point to `/store/targets` using
  product language such as `Hedefe git`.
- Returned workforce correction handoff must preserve request type and
  request id.

## Stop Conditions Reinforced By PR-1

Stop before runtime implementation if:

- a UI needs region workforce aggregates but only unbounded browser fetching
  could produce them,
- a region manager view would require calling Store Manager action-scope
  workforce endpoints,
- `REPORT_VIEWER`, `STORE_PERSONNEL`, or admin-only sessions would see
  manager workforce navigation,
- approvals cleanup would remove the only create/resubmit path for
  seller-code or offboarding,
- norm/actual values would be shown without a real typed Store read contract.

## Verification

Planned PR-1 verification:

```powershell
git diff --check
```

No runtime code is changed in this evidence pass.
