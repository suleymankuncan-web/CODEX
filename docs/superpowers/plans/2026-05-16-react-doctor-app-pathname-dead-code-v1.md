# React Doctor App Pathname Dead Code V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the highest-signal React Doctor findings without changing product behavior.

**Architecture:** Keep this slice small: fix `App.tsx` pathname dependency diagnostics and remove only verified dead exports. Do not touch checklist/admin cache invalidation or giant-component refactors in this PR.

**Tech Stack:** Vite, React 19, TypeScript, React Router, TanStack Query, React Doctor, Playwright.

---

**Execution status:** Implemented and verified on `codex/react-doctor-app-pathname-dead-code-v1`.

**Verification results:**
- `npm.cmd --prefix admin-web run build` passed.
- `npm.cmd --prefix admin-web run lint` passed.
- `npm.cmd run test:scripts` passed.
- `npm.cmd --prefix admin-web run smoke:pilot` passed.
- `node --test admin-web\scripts\localization-contract.test.mjs` passed.
- `npm.cmd run check:release` passed.
- `npx.cmd --yes react-doctor@latest . --score --full --offline --fail-on none` reported `93`.
- React Doctor JSON summary: `0` errors, `42` warnings, `42` total diagnostics, `13` affected files.

### Task 1: Make App Pathname Effects Explicit

**Files:**
- Modify: `admin-web/src/App.tsx`

- [x] **Step 1: Extract pathname from React Router location**

Add a primitive `pathname` constant immediately after `useLocation()`:

```tsx
const location = useLocation()
const pathname = location.pathname
```

- [x] **Step 2: Replace effect dependencies**

Use `pathname` instead of `location.pathname` in preload effects, route branching, and visible session notice checks.

- [x] **Step 3: Verify**

Run:

```powershell
npm.cmd --prefix admin-web run build
npx.cmd --yes react-doctor@latest . --score --full --offline --fail-on none
```

Expected: build passes and the three `no-mutable-in-deps` errors disappear.

### Task 2: Remove Verified Dead Exports

**Files:**
- Modify: `admin-web/src/app/shell-state.ts`
- Modify: `admin-web/src/app/store-navigation.ts`
- Modify: `admin-web/src/app/admin-navigation.ts`
- Modify: `admin-web/src/lib/query-retry.ts`
- Modify: `admin-web/src/features/workflow/contracts.ts`
- Modify: `admin-web/src/features/checklists/api.ts`
- Delete if still unused: `admin-web/src/app/admin-nav-item.tsx`

- [x] **Step 1: Confirm usages**

Run:

```powershell
rg -n "formatAdminShellSessionMode|formatAdminShellAuthState|formatAdminShellState|shouldRetryTransientQuery|transientQueryRetryDelay|hasAdminLandingRole|isStoreVisualMerchandiserOnly|toChecklistAcknowledgementInboxItem|AdminNavIconId|AdminChecklistTemplateItemInput|StoreNavigationItem|admin-nav-item" admin-web/src admin-web/e2e scripts docs
```

Expected: only same-file internal uses or docs references, except `escapeCsvCellForDownload`, which must remain exported for the CSV safety contract.

- [x] **Step 2: Remove only export markers or unused file**

Convert verified same-file-only exports to local declarations. Delete `admin-nav-item.tsx` only if no source import exists.

- [x] **Step 3: Do not touch CSV helper**

Leave this export intact:

```tsx
export function escapeCsvCellForDownload(...)
```

The contract in `scripts/csv-export-safety-contract.test.mjs` requires it.

### Task 3: Verify Slice

**Files:**
- Test: `admin-web`
- Test: root scripts

- [x] **Step 1: Run static gates**

```powershell
npm.cmd --prefix admin-web run build
npm.cmd --prefix admin-web run lint
npm.cmd run test:scripts
```

- [x] **Step 2: Run targeted pilot smoke**

```powershell
npm.cmd --prefix admin-web run smoke:pilot
```

- [x] **Step 3: Measure React Doctor**

```powershell
npx.cmd --yes react-doctor@latest . --json --full --offline --fail-on none
npx.cmd --yes react-doctor@latest . --score --full --offline --fail-on none
```

Expected: score improves from `90`, total diagnostics fall below `57`, and no new React Doctor error appears.

### Task 4: Next Slice Decision

After this PR is merged, rerun React Doctor on `main` and choose the next slice from the fresh report.

Preferred order:

1. `AdminChecklistTemplatesPage` TanStack Query invalidation, if confirmed real.
2. Small mechanical StoreChecklist performance fixes, not giant component extraction.
3. Admin/store component split packets only after targeted tests are identified.
