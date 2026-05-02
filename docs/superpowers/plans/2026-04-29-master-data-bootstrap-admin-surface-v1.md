# Master Data Bootstrap Admin Surface V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an admin/HR review surface for master data bootstrap batch readiness, row evidence, and promotion outcomes.

**Architecture:** Reuse the existing NestJS master-data-bootstrap endpoints from the React admin app. Add typed frontend API helpers, a focused `MasterDataBootstrapPage`, admin shell navigation, and Playwright acceptance coverage. No backend promotion logic or schema changes are required.

**Tech Stack:** React, TypeScript, Vite, TanStack Query, Playwright, existing dashboard primitives.

---

## File Structure

- `admin-web/src/features/integrations/api.ts`: add master-data-bootstrap response types and API helpers.
- `admin-web/src/pages/MasterDataBootstrapPage.tsx`: create focused list/detail/review surface.
- `admin-web/src/App.tsx`: add admin nav item and guarded routes.
- `admin-web/e2e/integration-surfaces.spec.ts`: add Playwright acceptance coverage with mocked API responses.
- `docs/superpowers/specs/2026-04-29-master-data-bootstrap-admin-surface-v1-design.md`: approved design.
- `docs/superpowers/plans/2026-04-29-master-data-bootstrap-admin-surface-v1.md`: this plan.
- `current-state.md`: update handoff after verification.
- `docs/plans/project-debt-ledger.md`: count the closed visibility debt after verification.

## Task 1: Failing Acceptance Coverage

**Files:**

- Modify: `admin-web/e2e/integration-surfaces.spec.ts`

- [x] **Step 1: Write failing Playwright test**

Add a test that opens `/admin/master-data/bootstrap-batch-personnel-1` and expects:

- heading `Master data bootstrap`
- readiness counters
- `Promoted entity`
- `employee-live-1`
- a working `Promote personnel` button that posts to `/promote-personnel`

- [x] **Step 2: Run RED test**

Run:

```powershell
npm.cmd run test:e2e -- e2e/integration-surfaces.spec.ts
```

Expected result:

```text
Route not available or expected master data controls are missing
```

## Task 2: Frontend API Helpers

**Files:**

- Modify: `admin-web/src/features/integrations/api.ts`

- [x] **Step 1: Add typed responses**

Add types for bootstrap batch queue items, batch detail rows, readiness summary, readiness rows, and promotion command responses.

- [x] **Step 2: Add API helper functions**

Add:

- `getMasterDataBootstrapBatches`
- `getMasterDataBootstrapBatchDetail`
- `getMasterDataBootstrapPromotionReadiness`
- `validateMasterDataBootstrapBatch`
- `promoteMasterDataBootstrapStores`
- `promoteMasterDataBootstrapPersonnel`

## Task 3: Admin Surface

**Files:**

- Create: `admin-web/src/pages/MasterDataBootstrapPage.tsx`
- Modify: `admin-web/src/App.tsx`

- [x] **Step 1: Create page**

Create a focused page that shows batch list, detail summary, readiness counters, row evidence, and action buttons.

- [x] **Step 2: Add routes and navigation**

Add:

```text
/admin/master-data
/admin/master-data/:batchId
```

Guard with `SUPER_ADMIN`, `HR_ADMIN`, and `INTEGRATION_ADMIN`.

- [x] **Step 3: Keep action boundaries**

Validate and promote buttons call backend commands only. The page does not compute promotion eligibility beyond rendering `canPromote`.

## Task 4: Verification And Commit

**Files:**

- Modify: `docs/superpowers/plans/2026-04-29-master-data-bootstrap-admin-surface-v1.md`
- Modify: `current-state.md`
- Modify: `docs/plans/project-debt-ledger.md`

- [x] **Step 1: Run targeted frontend checks**

Run:

```powershell
cd admin-web
npm.cmd run lint
npm.cmd run build
npm.cmd run test:e2e -- e2e/integration-surfaces.spec.ts
```

- [x] **Step 2: Run root release check**

Run from repo root:

```powershell
npm.cmd run check:release
```

- [x] **Step 3: Update docs**

Update handoff and debt ledger with the closed admin visibility slice.

- [x] **Step 4: Stage only related files**

Do not stage `outputs/`.

- [x] **Step 5: Commit**

Run:

```powershell
git commit -m "feat: expose master data bootstrap review surface"
```

## Self-Review Notes

Spec coverage:

- frontend-only visibility: Task 2 and Task 3
- readiness and promoted evidence: Task 1 and Task 3
- correct personnel promotion endpoint: Task 1 and Task 3
- no auth/user creation: Task 3 boundary and docs
- verification: Task 4
