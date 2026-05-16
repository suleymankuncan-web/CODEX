# React Doctor Store Rankings Reducer V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the StoreRankingsPage React Doctor `prefer-useReducer` warning without changing ranking filters, sorting, pagination, or detail drawer behavior.

**Architecture:** Keep `StoreRankingsPage.tsx` as the only production code target for this slice. Replace the ten local `useState` hooks that model one ranking view state with a typed reducer and small dispatch helpers, preserving existing query key values and reset behavior.

**Tech Stack:** Vite, React 19, TypeScript, React Doctor, Playwright.

---

### Task 1: Add Ranking Page Reducer Types

**Files:**
- Modify: `admin-web/src/pages/StoreRankingsPage.tsx`

- [x] **Step 1: Import `useReducer`**

Change the React import to:

```tsx
import { useMemo, useReducer, type CSSProperties, type ReactNode } from 'react'
```

- [x] **Step 2: Add reducer state and action types**

Add these near the ranking page local types:

```tsx
type StoreRankingsPageState = {
  periodStart: string
  regionManagerUserId: string
  regionId: string
  storeId: string
  search: string
  offset: number
  activeList: ActiveRankingList
  sortKey: RankingSortKey
  sortDirection: RankingSortDirection
  selectedDetail: RankingDetailSelection
}

type StoreRankingsTextFilter = 'periodStart' | 'regionManagerUserId' | 'regionId' | 'storeId' | 'search'

type StoreRankingsPageAction =
  | { type: 'setFilter'; field: StoreRankingsTextFilter; value: string }
  | { type: 'setOffset'; value: number }
  | { type: 'clearFilters' }
  | { type: 'setActiveList'; value: ActiveRankingList }
  | { type: 'setSort'; value: RankingSortKey }
  | { type: 'setSelectedDetail'; value: RankingDetailSelection }

const initialStoreRankingsPageState: StoreRankingsPageState = {
  periodStart: '',
  regionManagerUserId: '',
  regionId: '',
  storeId: '',
  search: '',
  offset: 0,
  activeList: 'stores',
  sortKey: 'score',
  sortDirection: 'desc',
  selectedDetail: null,
}
```

Expected: all state managed by the current ten hooks is represented in one typed state object.

### Task 2: Implement Reducer

**Files:**
- Modify: `admin-web/src/pages/StoreRankingsPage.tsx`

- [x] **Step 1: Add reducer function**

Add this reducer before `getLatestRankingFromCache`:

```tsx
function storeRankingsPageReducer(
  state: StoreRankingsPageState,
  action: StoreRankingsPageAction,
): StoreRankingsPageState {
  switch (action.type) {
    case 'setFilter':
      return { ...state, [action.field]: action.value, offset: 0 }
    case 'setOffset':
      return { ...state, offset: action.value }
    case 'clearFilters':
      return {
        ...state,
        regionManagerUserId: '',
        regionId: '',
        storeId: '',
        search: '',
        offset: 0,
      }
    case 'setActiveList':
      return { ...state, activeList: action.value, selectedDetail: null }
    case 'setSort':
      return state.sortKey === action.value
        ? {
            ...state,
            offset: 0,
            sortDirection: state.sortDirection === 'desc' ? 'asc' : 'desc',
          }
        : {
            ...state,
            offset: 0,
            sortKey: action.value,
            sortDirection: 'desc',
          }
    case 'setSelectedDetail':
      return { ...state, selectedDetail: action.value }
    default:
      return state
  }
}
```

Expected: filter and sort actions preserve the existing offset reset behavior.

### Task 3: Replace StoreRankingsPage State Hooks

**Files:**
- Modify: `admin-web/src/pages/StoreRankingsPage.tsx`

- [x] **Step 1: Replace the ten `useState` hooks**

Inside `StoreRankingsPage`, replace the local state hook block with:

```tsx
  const [pageState, dispatchPageState] = useReducer(
    storeRankingsPageReducer,
    initialStoreRankingsPageState,
  )
  const {
    periodStart,
    regionManagerUserId,
    regionId,
    storeId,
    search,
    offset,
    activeList,
    sortKey,
    sortDirection,
    selectedDetail,
  } = pageState
```

- [x] **Step 2: Replace local state helpers**

Replace `setFilter` and `updateSort` with:

```tsx
  const setFilter = (field: StoreRankingsTextFilter) => (value: string) => {
    dispatchPageState({ type: 'setFilter', field, value })
  }
  const updateSort = (nextSortKey: RankingSortKey) => {
    dispatchPageState({ type: 'setSort', value: nextSortKey })
  }
```

- [x] **Step 3: Update dispatch call sites**

Use these replacements:

```tsx
onPeriodStartChange={setFilter('periodStart')}
onRegionManagerChange={setFilter('regionManagerUserId')}
onRegionChange={setFilter('regionId')}
onStoreChange={setFilter('storeId')}
onSearchChange={setFilter('search')}
onOffsetChange={(value) => dispatchPageState({ type: 'setOffset', value })}
onClearFilters={() => dispatchPageState({ type: 'clearFilters' })}
onActiveListChange={(nextList) => dispatchPageState({ type: 'setActiveList', value: nextList })}
onOpenDetail={(value) => dispatchPageState({ type: 'setSelectedDetail', value })}
onClose={() => dispatchPageState({ type: 'setSelectedDetail', value: null })}
```

Expected: `StoreRankingsPage` has one `useReducer` hook and no `useState` calls.

### Task 4: Verify Slice

**Files:**
- Test: `admin-web`

- [x] **Step 1: Run static checks**

```powershell
npm.cmd --prefix admin-web run build
npm.cmd --prefix admin-web run lint
```

- [x] **Step 2: Run targeted StoreRankings E2E**

```powershell
npm.cmd --prefix admin-web run test:e2e -- store-surfaces.spec.ts -g "store rankings"
```

- [x] **Step 3: Measure React Doctor**

```powershell
npx.cmd --yes react-doctor@latest admin-web --full --offline --fail-on none
npx.cmd --yes react-doctor@latest admin-web --score --full --offline --fail-on none
```

Expected: React Doctor drops from 18 issues to 17 issues and stays at score 99/100 or better.

Result:
- `npm.cmd --prefix admin-web run build`: passed.
- `npm.cmd --prefix admin-web run lint`: passed.
- `npm.cmd --prefix admin-web run test:e2e -- store-surfaces.spec.ts -g "store rankings"`: 7 passed.
- `npm.cmd --prefix admin-web run check:release`: passed, including lint, script tests, build, 149 Playwright tests, and audit.
- `npx.cmd --yes react-doctor@latest admin-web --full --offline --fail-on none`: 17 issues across 9 files, score 99/100.
- `npx.cmd --yes react-doctor@latest admin-web --score --full --offline --fail-on none`: 99.
- `npm.cmd run check:release`: passed.

### Task 5: Finish

- [x] **Step 1: Commit only this slice**

Stage:

```powershell
git add -- admin-web/src/pages/StoreRankingsPage.tsx docs/superpowers/plans/2026-05-16-react-doctor-store-rankings-reducer-v1.md
```

Leave existing unrelated local files unstaged.

- [x] **Step 2: PR note**

Mention that Render deploy is not required because this is frontend/docs-only.

PR note: Render deploy is not required because this slice only changes admin-web frontend state management and documentation.
