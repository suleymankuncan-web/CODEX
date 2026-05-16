# React Doctor Store Checklists Reducer V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the StoreChecklistsPage React Doctor `prefer-useReducer` warning without changing checklist visit, acknowledgement, filtering, sorting, autosave, or deep-link behavior.

**Architecture:** Keep this slice scoped to `StoreChecklistsPage.tsx`. Replace the page-level `useState` cluster with a typed reducer that preserves search-derived initial state, session-storage command notice pickup, local active instance overlays, modal selection, draft score/comment state, and filter/sort state.

**Tech Stack:** Vite, React 19, TypeScript, React Doctor, Playwright.

---

### Task 1: Add Store Checklists Reducer Types

**Files:**
- Modify: `admin-web/src/pages/StoreChecklistsPage.tsx`

- [x] **Step 1: Import `useReducer`**

Change the React import to:

```tsx
import { useReducer, useRef } from 'react'
```

- [x] **Step 2: Add reducer state aliases**

Add this alias near the existing page-local types:

```tsx
type ChecklistActiveInstance = MobileChecklistToday['activeInstances'][number]
```

- [x] **Step 3: Add reducer state and actions**

Add a typed state/action model near `CHECKLIST_COMMAND_NOTICE_KEY`:

```tsx
type StoreChecklistsState = {
  ackNotes: Record<string, string>
  ackNotice: string | null
  scores: Record<string, number>
  comments: Record<string, string>
  selectedSessionKey: string | null
  selectedResultId: string | null
  searchQuery: string
  selectedMonth: string
  typeFilter: ChecklistTypeFilter
  statusFilter: ChecklistStatusFilter
  activeTab: ChecklistTab
  visitSort: ChecklistSort
  resultSort: ChecklistSort
  localActiveInstances: Record<string, ChecklistActiveInstance>
  sessionDirty: boolean
}

type StoreChecklistsAction =
  | { type: 'setAckNotice'; message: string | null }
  | { type: 'acknowledgeSucceeded'; checklistInstanceId: string }
  | { type: 'startVisitSucceeded'; rowKey: string; instance: ChecklistActiveInstance }
  | { type: 'saveResponseSucceeded' }
  | { type: 'completeVisitSucceeded'; checklistInstanceId: string }
  | { type: 'openSession'; rowKey: string; scores: Record<string, number>; comments: Record<string, string> }
  | { type: 'resetSessionDrafts' }
  | { type: 'closeSession' }
  | { type: 'completeVisitSubmitted' }
  | { type: 'setScoreDraft'; templateItemId: string; score: number | null }
  | { type: 'setCommentDraft'; templateItemId: string; comment: string }
  | { type: 'setAckNote'; checklistInstanceId: string; note: string }
  | { type: 'selectTab'; tab: ChecklistTab }
  | { type: 'openResult'; tab: ChecklistTab; checklistInstanceId: string }
  | { type: 'closeResult' }
  | { type: 'clearFilters'; typeFilter: ChecklistTypeFilter }
  | { type: 'setSearchQuery'; value: string }
  | { type: 'setSelectedMonth'; value: string }
  | { type: 'setTypeFilter'; value: ChecklistTypeFilter }
  | { type: 'setStatusFilter'; value: ChecklistStatusFilter }
  | { type: 'toggleVisitSort'; key: ChecklistSortKey }
  | { type: 'toggleResultSort'; key: ChecklistSortKey }
```

Expected: every current local `useState` value has a typed reducer home.

### Task 2: Implement Initial State and Reducer

**Files:**
- Modify: `admin-web/src/pages/StoreChecklistsPage.tsx`

- [x] **Step 1: Add initial state factory**

Add this helper before `StoreChecklistsPage`:

```tsx
function createInitialStoreChecklistsState(search: string): StoreChecklistsState {
  return {
    ackNotes: {},
    ackNotice: takeChecklistCommandNotice(),
    scores: {},
    comments: {},
    selectedSessionKey: null,
    selectedResultId: resolveChecklistResultFromSearch(search),
    searchQuery: '',
    selectedMonth: 'all',
    typeFilter: 'all',
    statusFilter: 'all',
    activeTab: resolveChecklistTabFromSearch(search),
    visitSort: { key: 'priority', direction: 'desc' },
    resultSort: { key: 'date', direction: 'desc' },
    localActiveInstances: {},
    sessionDirty: false,
  }
}
```

- [x] **Step 2: Add reducer function**

Add a reducer that preserves the existing state transitions:

```tsx
function storeChecklistsReducer(
  state: StoreChecklistsState,
  action: StoreChecklistsAction,
): StoreChecklistsState {
  switch (action.type) {
    case 'setAckNotice':
      return { ...state, ackNotice: action.message }
    case 'acknowledgeSucceeded': {
      const nextAckNotes = { ...state.ackNotes }
      delete nextAckNotes[action.checklistInstanceId]
      return { ...state, ackNotes: nextAckNotes, selectedResultId: null, activeTab: 'history' }
    }
    case 'startVisitSucceeded':
      return {
        ...state,
        localActiveInstances: { ...state.localActiveInstances, [action.rowKey]: action.instance },
        scores: {},
        comments: {},
        selectedSessionKey: action.rowKey,
        sessionDirty: false,
      }
    case 'saveResponseSucceeded':
      return { ...state, sessionDirty: false }
    case 'completeVisitSucceeded':
      return {
        ...state,
        localActiveInstances: Object.fromEntries(
          Object.entries(state.localActiveInstances).filter(
            ([, instance]) => instance.checklistInstanceId !== action.checklistInstanceId,
          ),
        ),
        selectedSessionKey: null,
        sessionDirty: false,
      }
    case 'openSession':
      return {
        ...state,
        selectedSessionKey: action.rowKey,
        scores: action.scores,
        comments: action.comments,
        sessionDirty: false,
      }
    case 'resetSessionDrafts':
      return { ...state, scores: {}, comments: {}, selectedSessionKey: null, sessionDirty: false }
    case 'closeSession':
    case 'completeVisitSubmitted':
      return { ...state, selectedSessionKey: null, sessionDirty: false }
    case 'setScoreDraft': {
      const nextScores = { ...state.scores }
      if (action.score === null) {
        delete nextScores[action.templateItemId]
      } else {
        nextScores[action.templateItemId] = action.score
      }
      return { ...state, scores: nextScores, sessionDirty: true }
    }
    case 'setCommentDraft':
      return {
        ...state,
        comments: { ...state.comments, [action.templateItemId]: action.comment },
        sessionDirty: true,
      }
    case 'setAckNote':
      return {
        ...state,
        ackNotes: { ...state.ackNotes, [action.checklistInstanceId]: action.note },
      }
    case 'selectTab':
      return { ...state, activeTab: action.tab, selectedResultId: null }
    case 'openResult':
      return { ...state, activeTab: action.tab, selectedResultId: action.checklistInstanceId }
    case 'closeResult':
      return { ...state, selectedResultId: null }
    case 'clearFilters':
      return {
        ...state,
        searchQuery: '',
        selectedMonth: 'all',
        typeFilter: action.typeFilter,
        statusFilter: 'all',
      }
    case 'setSearchQuery':
      return { ...state, searchQuery: action.value }
    case 'setSelectedMonth':
      return { ...state, selectedMonth: action.value }
    case 'setTypeFilter':
      return { ...state, typeFilter: action.value }
    case 'setStatusFilter':
      return { ...state, statusFilter: action.value }
    case 'toggleVisitSort':
      return { ...state, visitSort: toggleSort(state.visitSort, action.key) }
    case 'toggleResultSort':
      return { ...state, resultSort: toggleSort(state.resultSort, action.key) }
    default:
      return state
  }
}
```

Expected: reducer actions cover command notices, route-linked modal selection, visit session drafts, acknowledgement notes, filters, and sort toggles.

### Task 3: Replace Page State Hooks

**Files:**
- Modify: `admin-web/src/pages/StoreChecklistsPage.tsx`

- [x] **Step 1: Replace the `useState` block**

Inside `StoreChecklistsPage`, replace the current state hook cluster with:

```tsx
  const [pageState, dispatchPageState] = useReducer(
    storeChecklistsReducer,
    location.search,
    createInitialStoreChecklistsState,
  )
  const {
    ackNotes,
    ackNotice,
    scores,
    comments,
    selectedSessionKey,
    selectedResultId,
    searchQuery,
    selectedMonth,
    typeFilter,
    statusFilter,
    activeTab,
    visitSort,
    resultSort,
    localActiveInstances,
    sessionDirty,
  } = pageState
```

- [x] **Step 2: Update command and mutation callbacks**

Use dispatches for acknowledgement, start, save, and complete success callbacks while keeping query invalidation and navigation unchanged.

- [x] **Step 3: Update modal and toolbar handlers**

Use reducer actions for filter changes, sort toggles, tab selection, result selection, session open/close, score/comment drafts, and acknowledgement notes.

Expected: `StoreChecklistsPage` has one `useReducer` hook and no `useState` calls.

### Task 4: Verify Slice

**Files:**
- Test: `admin-web`

- [x] **Step 1: Run static checks**

```powershell
npm.cmd --prefix admin-web run build
npm.cmd --prefix admin-web run lint
```

- [x] **Step 2: Run targeted checklist E2E**

```powershell
npm.cmd --prefix admin-web run test:e2e -- checklist-today-surfaces.spec.ts
```

- [x] **Step 3: Measure React Doctor**

```powershell
npx.cmd --yes react-doctor@latest admin-web --full --offline --fail-on none
npx.cmd --yes react-doctor@latest admin-web --score --full --offline --fail-on none
```

Expected: React Doctor drops from 16 issues to 15 issues and stays at score 99/100 or better.

### Task 5: Finish

- [x] **Step 1: Run release checks**

```powershell
npm.cmd --prefix admin-web run check:release
npm.cmd run check:release
```

- [x] **Step 2: Commit only this slice**

Stage:

```powershell
git add -- admin-web/src/pages/StoreChecklistsPage.tsx docs/superpowers/plans/2026-05-16-react-doctor-store-checklists-reducer-v1.md
```

Leave existing unrelated local files unstaged.

- [x] **Step 3: PR note**

Mention that Render deploy is not required because this is frontend/docs-only.

### Verification Results

- `npm.cmd --prefix admin-web run build` passed.
- `npm.cmd --prefix admin-web run lint` passed.
- `npm.cmd --prefix admin-web run test:e2e -- checklist-today-surfaces.spec.ts` passed: 11 tests.
- `npx.cmd --yes react-doctor@latest admin-web --full --offline --fail-on none` dropped React Doctor from 16 to 15 issues across 9 files.
- `npx.cmd --yes react-doctor@latest admin-web --score --full --offline --fail-on none` stayed at score 99.
- `npm.cmd --prefix admin-web run test:e2e -- --workers=1` passed: 149 tests.
- `npm.cmd --prefix admin-web audit --omit=dev` passed with 0 vulnerabilities.
- `npm.cmd --prefix backend/nestjs run check:release` passed.
- `npm.cmd --prefix admin-web run check:release` passed.
- `npm.cmd run check:release` passed.

Render deploy is not required for this PR because the change is frontend/docs-only and does not alter infrastructure, migrations, or runtime environment configuration.
