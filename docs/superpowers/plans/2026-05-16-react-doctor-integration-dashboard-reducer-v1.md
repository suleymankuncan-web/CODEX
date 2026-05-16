# React Doctor Integration Dashboard Reducer V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the IntegrationDashboardPage React Doctor `prefer-useReducer` warning without changing upload, evidence, filtering, sorting, pagination, or feedback behavior.

**Architecture:** Keep this slice scoped to `IntegrationDashboardPage.tsx`. Replace the page-level `useState` cluster with a typed reducer, preserving mount-time default date generation and the existing offset reset behavior for queue filters.

**Tech Stack:** Vite, React 19, TypeScript, React Doctor, Playwright.

---

### Task 1: Add Integration Dashboard Reducer Types

**Files:**
- Modify: `admin-web/src/pages/IntegrationDashboardPage.tsx`

- [x] **Step 1: Import `useReducer`**

Change the React import to:

```tsx
import { useDeferredValue, useMemo, useReducer, type ReactNode } from 'react'
```

- [x] **Step 2: Add state type aliases**

Add these near the existing page-local types:

```tsx
type IntegrationSortValue = 'priority' | 'errors' | 'records' | 'entity'
type IntegrationTemplateSourceSystem = 'nebim_v3' | 'power_bi'
type IntegrationQueueFilter = 'entityTypeFilter' | 'statusFilter'
```

- [x] **Step 3: Add reducer state and actions**

Add this state and action model near those aliases:

```tsx
type IntegrationDashboardState = {
  activeTab: IntegrationTab
  search: string
  sortBy: IntegrationSortValue
  offset: number
  entityTypeFilter: string
  statusFilter: string
  feedback: string | null
  createdBatchId: string | null
  uploadFeedback: string | null
  uploadedBatchId: string | null
  templateSourceSystem: IntegrationTemplateSourceSystem
  selectedTemplateSourceCode: string
  powerBiSourceCode: string
  powerBiPeriodType: PowerBiPeriodType
  powerBiPeriodMonth: string
  powerBiPeriodStart: string
  powerBiPeriodEnd: string
  personnelFile: File | null
  storeFile: File | null
}

type IntegrationDashboardAction =
  | { type: 'setActiveTab'; value: IntegrationTab }
  | { type: 'setSearch'; value: string }
  | { type: 'setSortBy'; value: IntegrationSortValue }
  | { type: 'setQueueFilter'; field: IntegrationQueueFilter; value: string }
  | { type: 'setOffset'; value: number }
  | { type: 'clearQueueFilters' }
  | { type: 'retrySucceeded'; message: string }
  | { type: 'batchCreated'; message: string; batchId: string }
  | { type: 'uploadSucceeded'; message: string; batchId: string }
  | { type: 'uploadFailed'; message: string }
  | { type: 'setTemplateSourceSystem'; value: IntegrationTemplateSourceSystem }
  | { type: 'setSelectedTemplateSourceCode'; value: string }
  | { type: 'setPowerBiSourceCode'; value: string }
  | { type: 'setPowerBiPeriodType'; value: PowerBiPeriodType }
  | { type: 'setPowerBiPeriodMonth'; value: string }
  | { type: 'setPowerBiPeriodStart'; value: string; syncEnd: boolean }
  | { type: 'setPowerBiPeriodEnd'; value: string }
  | { type: 'setPersonnelFile'; value: File | null }
  | { type: 'setStoreFile'; value: File | null }
```

Expected: every current local `useState` value has a typed home in reducer state.

### Task 2: Implement Reducer

**Files:**
- Modify: `admin-web/src/pages/IntegrationDashboardPage.tsx`

- [x] **Step 1: Add initial state factory**

Add this after `getCurrentIsoMonth`:

```tsx
function createInitialIntegrationDashboardState(): IntegrationDashboardState {
  return {
    activeTab: 'uploads',
    search: '',
    sortBy: 'priority',
    offset: 0,
    entityTypeFilter: '',
    statusFilter: '',
    feedback: null,
    createdBatchId: null,
    uploadFeedback: null,
    uploadedBatchId: null,
    templateSourceSystem: 'power_bi',
    selectedTemplateSourceCode: '',
    powerBiSourceCode: '',
    powerBiPeriodType: 'monthly',
    powerBiPeriodMonth: getCurrentIsoMonth(),
    powerBiPeriodStart: getCurrentIsoDate(),
    powerBiPeriodEnd: getCurrentIsoDate(),
    personnelFile: null,
    storeFile: null,
  }
}
```

- [x] **Step 2: Add reducer function**

Add this reducer after the initial state factory:

```tsx
function integrationDashboardReducer(
  state: IntegrationDashboardState,
  action: IntegrationDashboardAction,
): IntegrationDashboardState {
  switch (action.type) {
    case 'setActiveTab':
      return { ...state, activeTab: action.value }
    case 'setSearch':
      return { ...state, search: action.value }
    case 'setSortBy':
      return { ...state, sortBy: action.value }
    case 'setQueueFilter':
      return { ...state, [action.field]: action.value, offset: 0 }
    case 'setOffset':
      return { ...state, offset: action.value }
    case 'clearQueueFilters':
      return { ...state, offset: 0, entityTypeFilter: '', statusFilter: '', search: '' }
    case 'retrySucceeded':
      return { ...state, feedback: action.message, createdBatchId: null }
    case 'batchCreated':
      return { ...state, feedback: action.message, createdBatchId: action.batchId }
    case 'uploadSucceeded':
      return { ...state, uploadFeedback: action.message, uploadedBatchId: action.batchId }
    case 'uploadFailed':
      return { ...state, uploadFeedback: action.message, uploadedBatchId: null }
    case 'setTemplateSourceSystem':
      return { ...state, templateSourceSystem: action.value, selectedTemplateSourceCode: '' }
    case 'setSelectedTemplateSourceCode':
      return { ...state, selectedTemplateSourceCode: action.value }
    case 'setPowerBiSourceCode':
      return { ...state, powerBiSourceCode: action.value }
    case 'setPowerBiPeriodType':
      return { ...state, powerBiPeriodType: action.value }
    case 'setPowerBiPeriodMonth':
      return { ...state, powerBiPeriodMonth: action.value }
    case 'setPowerBiPeriodStart':
      return {
        ...state,
        powerBiPeriodStart: action.value,
        powerBiPeriodEnd: action.syncEnd ? action.value : state.powerBiPeriodEnd,
      }
    case 'setPowerBiPeriodEnd':
      return { ...state, powerBiPeriodEnd: action.value }
    case 'setPersonnelFile':
      return { ...state, personnelFile: action.value }
    case 'setStoreFile':
      return { ...state, storeFile: action.value }
    default:
      return state
  }
}
```

Expected: reducer actions preserve current page behavior, including resetting selected template source when the source system changes.

### Task 3: Replace Page State Hooks

**Files:**
- Modify: `admin-web/src/pages/IntegrationDashboardPage.tsx`

- [x] **Step 1: Replace the `useState` block**

Inside `IntegrationDashboardPage`, replace the existing state hook cluster with:

```tsx
  const [pageState, dispatchPageState] = useReducer(
    integrationDashboardReducer,
    undefined,
    createInitialIntegrationDashboardState,
  )
  const {
    activeTab,
    search,
    sortBy,
    offset,
    entityTypeFilter,
    statusFilter,
    feedback,
    createdBatchId,
    uploadFeedback,
    uploadedBatchId,
    templateSourceSystem,
    selectedTemplateSourceCode,
    powerBiSourceCode,
    powerBiPeriodType,
    powerBiPeriodMonth,
    powerBiPeriodStart,
    powerBiPeriodEnd,
    personnelFile,
    storeFile,
  } = pageState
```

- [x] **Step 2: Update mutation callbacks**

Replace direct feedback setters with these dispatches:

```tsx
dispatchPageState({ type: 'retrySucceeded', message: response.command.message })
dispatchPageState({
  type: 'batchCreated',
  message: response.command.message,
  batchId: response.data.batch.batchId,
})
dispatchPageState({
  type: 'uploadSucceeded',
  message: response.command.message,
  batchId: response.data.batch.batchId,
})
dispatchPageState({ type: 'uploadFailed', message: getErrorMessage(error) })
```

- [x] **Step 3: Update event handlers**

Use dispatches for remaining UI updates:

```tsx
dispatchPageState({ type: 'setActiveTab', value: 'uploads' })
dispatchPageState({ type: 'setActiveTab', value: tab.id })
dispatchPageState({ type: 'setPowerBiSourceCode', value: event.target.value })
dispatchPageState({ type: 'setPowerBiPeriodType', value: event.target.value as PowerBiPeriodType })
dispatchPageState({ type: 'setPowerBiPeriodMonth', value: event.target.value })
dispatchPageState({
  type: 'setPowerBiPeriodStart',
  value: event.target.value,
  syncEnd: powerBiPeriodType === 'daily',
})
dispatchPageState({ type: 'setPowerBiPeriodEnd', value: event.target.value })
dispatchPageState({ type: 'setPersonnelFile', value: event.target.files?.[0] ?? null })
dispatchPageState({ type: 'setStoreFile', value: event.target.files?.[0] ?? null })
dispatchPageState({ type: 'setTemplateSourceSystem', value: event.target.value as IntegrationTemplateSourceSystem })
dispatchPageState({ type: 'setSelectedTemplateSourceCode', value: event.target.value })
dispatchPageState({ type: 'setSortBy', value: value as IntegrationSortValue })
dispatchPageState({ type: 'setSearch', value: event.target.value })
dispatchPageState({ type: 'setQueueFilter', field: 'entityTypeFilter', value: event.target.value })
dispatchPageState({ type: 'setQueueFilter', field: 'statusFilter', value: event.target.value })
dispatchPageState({ type: 'clearQueueFilters' })
dispatchPageState({ type: 'setOffset', value: Math.max(0, offset - PAGE_SIZE) })
dispatchPageState({ type: 'setOffset', value: offset + PAGE_SIZE })
```

Expected: `IntegrationDashboardPage` has one `useReducer` hook and no `useState` calls.

### Task 4: Verify Slice

**Files:**
- Test: `admin-web`

- [x] **Step 1: Run static checks**

```powershell
npm.cmd --prefix admin-web run build
npm.cmd --prefix admin-web run lint
```

- [x] **Step 2: Run targeted integration E2E**

```powershell
npm.cmd --prefix admin-web run test:e2e -- integration-surfaces.spec.ts -g "admin integrations|admin dashboard"
```

- [x] **Step 3: Measure React Doctor**

```powershell
npx.cmd --yes react-doctor@latest admin-web --full --offline --fail-on none
npx.cmd --yes react-doctor@latest admin-web --score --full --offline --fail-on none
```

Expected: React Doctor drops from 17 issues to 16 issues and stays at score 99/100 or better.

**Result:**
- `npm.cmd --prefix admin-web run build`: passed.
- `npm.cmd --prefix admin-web run lint`: passed.
- `npm.cmd --prefix admin-web run test:e2e -- integration-surfaces.spec.ts -g "admin integrations|admin dashboard"`: 4 passed.
- `npx.cmd --yes react-doctor@latest admin-web --full --offline --fail-on none`: 16 issues across 9/158 files, score 99.
- `npx.cmd --yes react-doctor@latest admin-web --score --full --offline --fail-on none`: 99.
- `npm.cmd --prefix admin-web run check:release`: passed.
- `npm.cmd run check:release`: passed on isolated rerun after the first parallel attempt conflicted with the concurrent admin-web Playwright server.

### Task 5: Finish

- [ ] **Step 1: Commit only this slice**

Stage:

```powershell
git add -- admin-web/src/pages/IntegrationDashboardPage.tsx docs/superpowers/plans/2026-05-16-react-doctor-integration-dashboard-reducer-v1.md
```

Leave existing unrelated local files unstaged.

- [ ] **Step 2: PR note**

Mention that Render deploy is not required because this is frontend/docs-only.
