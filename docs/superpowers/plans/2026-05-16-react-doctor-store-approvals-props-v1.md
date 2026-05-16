# React Doctor Store Approvals Props V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the remaining low-risk StoreApprovalsPage React Doctor prop/iteration warnings and the unused CSV helper export without changing user-facing behavior.

**Architecture:** Keep the StoreApprovals component structure intact. Group repeated form booleans into small state objects so child form props are semantic objects instead of stacked flags, replace one filter/map chain with a single loop, and make the CSV escaping helper private to its module.

**Tech Stack:** Vite, React 19, TypeScript, React Doctor, Playwright.

---

### Task 1: Add Shared Form State Types

**Files:**
- Modify: `admin-web/src/pages/StoreApprovalsPage.tsx`

- [x] **Step 1: Add access/submission/error object types**

Add these near the local page types:

```tsx
type RequestFormAccess = {
  createAllowed: boolean
  submitAllowed: boolean
}

type RequestFormSubmission = {
  notice: string | null
  pending: boolean
}

type RequestFormErrors = {
  create: unknown
  createVisible: boolean
  resubmit?: unknown
  resubmitVisible?: boolean
}
```

Expected: child form components can receive `access`, `submission`, and `errors` instead of multiple top-level boolean-like props.

### Task 2: Group Store Approval Form Props

**Files:**
- Modify: `admin-web/src/pages/StoreApprovalsPage.tsx`

- [x] **Step 1: Update target distribution form props**

Replace `canCreateForStore`, `canSubmit`, `hasCreateError`, and `isSubmitting` with:

```tsx
access={{
  createAllowed: showTargetSubmission,
  submitAllowed: canSubmit,
}}
errors={{
  create: createMutation.error,
  createVisible: createMutation.isError,
}}
submission={{
  notice: submissionNotice,
  pending: createMutation.isPending,
}}
```

- [x] **Step 2: Update seller code form props**

Replace `canCreateForStore`, `canSubmit`, `hasCreateError`, `hasResubmitError`, `isPending`, and `notice` with grouped `access`, `errors`, and `submission` props.

- [x] **Step 3: Update offboarding form props**

Replace `canCreateForStore`, `canSubmit`, `hasCreateError`, `hasResubmitError`, `isPending`, and `notice` with grouped `access`, `errors`, and `submission` props.

- [x] **Step 4: Update the three form function signatures and reads**

Inside each form, replace reads like `input.canSubmit`, `input.isPending`, and `input.hasCreateError` with `input.access.submitAllowed`, `input.submission.pending`, and `input.errors.createVisible`.

Expected React Doctor result: remove the three `no-many-boolean-props` warnings.

### Task 3: Collapse Allocation Lookup Iteration

**Files:**
- Modify: `admin-web/src/pages/StoreApprovalsPage.tsx`

- [x] **Step 1: Replace filter/map chain with a single loop**

Change the `allocationsByEmployeeId` construction to:

```tsx
    const allocationsByEmployeeId = new Map<string, TargetDistributionAllocation>()
    for (const item of allocations) {
      if (!item.employeeId.trim()) continue
      allocationsByEmployeeId.set(item.employeeId, item)
    }
```

Expected React Doctor result: remove the `js-combine-iterations` warning in this file.

### Task 4: Remove Unused CSV Helper Export

**Files:**
- Modify: `admin-web/src/lib/download-csv.ts`

- [x] **Step 1: Make `escapeCsvCellForDownload` private**

Change:

```ts
export function escapeCsvCellForDownload(...)
```

to:

```ts
function escapeCsvCellForDownload(...)
```

Expected React Doctor result: remove the Knip unused export warning while keeping `downloadCsv` behavior unchanged.

### Task 5: Verify Slice

**Files:**
- Test: `admin-web`

- [x] **Step 1: Run static checks**

```powershell
npm.cmd --prefix admin-web run build
npm.cmd --prefix admin-web run lint
```

- [x] **Step 2: Run targeted StoreApprovals E2E**

```powershell
npm.cmd --prefix admin-web run test:e2e -- store-surfaces.spec.ts -g "store approvals page"
```

- [x] **Step 3: Measure React Doctor**

```powershell
npx.cmd --yes react-doctor@latest admin-web --json --full --offline --fail-on none
npx.cmd --yes react-doctor@latest admin-web --score --full --offline --fail-on none
```

Expected: admin-web remains error-free and total warnings drop below `23`.

Result:
- `npm.cmd --prefix admin-web run build`: passed.
- `npm.cmd --prefix admin-web run lint`: passed.
- `npm.cmd --prefix admin-web run test:e2e -- store-surfaces.spec.ts -g "store approvals page"`: 7 passed.
- `npm.cmd --prefix admin-web run check:release`: passed, including lint, script tests, build, 149 Playwright tests, and audit.
- `npx.cmd --yes react-doctor@latest admin-web --full --offline --fail-on none`: 18 issues across 10 files, score 99/100.
- `npx.cmd --yes react-doctor@latest admin-web --score --full --offline --fail-on none`: 99.
- CI follow-up: root `release-check` initially failed because `scripts/csv-export-safety-contract.test.mjs` still required the safe CSV helper to be exported. The contract now checks for the shared helper by function name and the unchanged header/row call sites instead.
- `npm.cmd run test:scripts`: passed, 178 tests.
- `npm.cmd run check:release`: passed.

### Task 6: Finish

- [x] **Step 1: Commit only this slice**

Stage:

```powershell
git add -- admin-web/src/pages/StoreApprovalsPage.tsx admin-web/src/lib/download-csv.ts docs/superpowers/plans/2026-05-16-react-doctor-store-approvals-props-v1.md
```

Leave existing unrelated local files unstaged.

- [x] **Step 2: PR note**

Mention that Render deploy is not required because this is frontend/docs-only.

PR note: Render deploy is not required because this slice only changes admin-web frontend code and documentation.
