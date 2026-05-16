# React Doctor Master Data Reducer V2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce the React Doctor `prefer-useReducer` warning count by consolidating `MasterDataBootstrapPage` local UI state into one reducer.

**Architecture:** Keep all data fetching and cache updates in `MasterDataBootstrapPage.tsx`; only replace independent `useState` setters with reducer actions. Preserve the existing page layout, query keys, mutation behavior, pagination resets, draft merging, and per-row saving flags.

**Tech Stack:** React 19, TypeScript, TanStack Query, Playwright E2E, React Doctor.

---

### Task 1: Consolidate Master Data Page State

**Files:**
- Modify: `admin-web/src/pages/MasterDataBootstrapPage.tsx`
- Test: `admin-web/e2e/integration-surfaces.spec.ts`
- Test: `admin-web/e2e/admin-routing.spec.ts`

- [x] **Step 1: Replace state imports**

Change the React import from `useState` to `useReducer`:

```tsx
import { useDeferredValue, useMemo, useReducer, type ReactNode } from 'react'
```

- [x] **Step 2: Add reducer types and initial state**

Add a `MasterDataPageState` type, a discriminated `MasterDataPageAction` union, and an `initialMasterDataPageState` constant near the existing local types. Include all current local state fields: tab, batch filters, feedback, promotion result, store filters, store offset, store feedback, store drafts, saving store IDs, personnel filters, personnel offset, personnel feedback, personnel drafts, and saving personnel IDs.

- [x] **Step 3: Add reducer behavior**

Implement `masterDataPageReducer(state, action)` so:

```tsx
case 'setStoreSearch':
  return { ...state, storeSearch: action.value, storeOffset: 0 }
case 'shiftStoreOffset':
  return { ...state, storeOffset: Math.max(0, state.storeOffset + action.delta) }
case 'setStoreSaving': {
  const savingStoreIds = new Set(state.savingStoreIds)
  if (action.isSaving) savingStoreIds.add(action.storeId)
  else savingStoreIds.delete(action.storeId)
  return { ...state, savingStoreIds }
}
```

Mirror this shape for personnel search/filter offset resets, personnel offset shifts, personnel saving IDs, and draft update/clear actions.

- [x] **Step 4: Use reducer in the component**

Replace the 20 `useState` calls with:

```tsx
const [state, dispatch] = useReducer(masterDataPageReducer, initialMasterDataPageState)
```

Destructure the same local names from `state` so existing query and render logic remains readable.

- [x] **Step 5: Replace setters with dispatches**

Replace direct setters in mutation callbacks, helpers, filters, tabs, and pagers with reducer actions. Keep query invalidation, cache updates, and API mutation inputs unchanged.

- [x] **Step 6: Verify targeted behavior**

Run:

```powershell
npm.cmd --prefix admin-web run lint
npm.cmd --prefix admin-web run build
npm.cmd --prefix admin-web run test:e2e -- integration-surfaces.spec.ts
npm.cmd --prefix admin-web run test:e2e -- admin-routing.spec.ts -g "master data"
npx.cmd --yes react-doctor@latest admin-web --full --offline --fail-on none
```

Expected: commands exit 0, and React Doctor no longer reports `MasterDataBootstrapPage.tsx` under `prefer-useReducer`.

- [x] **Step 7: Release gate**

Run:

```powershell
npm.cmd --prefix admin-web run check:release
npm.cmd run check:release
```

Expected: commands exit 0. If a release command flakes, inspect the failing output and rerun only after confirming it is not caused by this reducer change.
