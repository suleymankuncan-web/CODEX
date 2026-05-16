# React Doctor Auth Dashboard Reducer V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the AuthDashboardPage React Doctor `prefer-useReducer` warning without changing auth user, role assignment, action-store assignment, search, or feedback behavior.

**Architecture:** Keep this slice scoped to `AuthDashboardPage.tsx`. Replace the page-level `useState` cluster with a typed reducer that owns the three form drafts, search inputs, selected lookup rows, and success/error feedback. Leave the large component decomposition warning for a later PR.

**Tech Stack:** Vite, React 19, TypeScript, React Doctor, Playwright.

---

### Task 1: Add Auth Dashboard Reducer Types

**Files:**
- Modify: `admin-web/src/pages/AuthDashboardPage.tsx`

- [x] **Step 1: Import `useReducer`**

Change the React import to:

```tsx
import { useDeferredValue, useMemo, useReducer } from 'react'
```

- [x] **Step 2: Add form state aliases**

Add these aliases near the existing page-local types:

```tsx
type AuthUserFormState = {
  employeeId: string
  username: string
  email: string
  authProvider: AuthProvider
}

type AuthAssignmentFormState = {
  userId: string
  roleCode: string
  scopeType: RoleScopeType
  companyId: string
  regionId: string
  storeId: string
  effectiveFrom: string
  effectiveTo: string
}

type AuthActionStoreFormState = {
  userId: string
  storeId: string
  effectiveFrom: string
  effectiveTo: string
}
```

- [x] **Step 3: Add reducer state and actions**

Add a typed state/action model before `mergeAuthUsers`:

```tsx
type AuthDashboardState = {
  search: string
  assignmentUserSearch: string
  assignmentStoreSearch: string
  actionStoreUserSearch: string
  actionStoreSearch: string
  selectedAssignmentUser: AuthLookupUser | null
  selectedAssignmentStore: AuthLookupStore | null
  selectedActionStoreUser: AuthLookupUser | null
  selectedActionStore: AuthLookupStore | null
  feedback: string | null
  errorFeedback: string | null
  userForm: AuthUserFormState
  assignmentForm: AuthAssignmentFormState
  actionStoreForm: AuthActionStoreFormState
}

type AuthDashboardAction =
  | { type: 'setSearch'; value: string }
  | { type: 'setAssignmentUserSearch'; value: string }
  | { type: 'setAssignmentStoreSearch'; value: string }
  | { type: 'setActionStoreUserSearch'; value: string }
  | { type: 'setActionStoreSearch'; value: string }
  | { type: 'setFeedback'; message: string | null }
  | { type: 'setErrorFeedback'; message: string | null }
  | { type: 'clearFeedback' }
  | { type: 'createUserSucceeded'; message: string }
  | { type: 'createAssignmentSucceeded'; message: string }
  | { type: 'createActionStoreSucceeded'; message: string }
  | { type: 'mutationSucceeded'; message: string }
  | { type: 'userClosed'; message: string }
  | { type: 'updateUserForm'; form: AuthUserFormState }
  | { type: 'updateAssignmentForm'; form: AuthAssignmentFormState }
  | { type: 'updateActionStoreForm'; form: AuthActionStoreFormState }
  | { type: 'selectAssignmentUser'; user: AuthLookupUser | null; userId: string }
  | { type: 'selectAssignmentStore'; store: AuthLookupStore | null; storeId: string }
  | { type: 'selectActionStoreUser'; user: AuthLookupUser | null; userId: string }
  | { type: 'selectActionStore'; store: AuthLookupStore | null; storeId: string }
  | { type: 'setAssignmentScopeType'; scopeType: RoleScopeType }
```

Expected: every current local `useState` value has a typed reducer home.

### Task 2: Implement Initial State and Reducer

**Files:**
- Modify: `admin-web/src/pages/AuthDashboardPage.tsx`

- [x] **Step 1: Add initial state constants**

Add these constants before the reducer:

```tsx
const initialAuthUserForm: AuthUserFormState = {
  employeeId: '',
  username: '',
  email: '',
  authProvider: 'oidc',
}

const initialAuthAssignmentForm: AuthAssignmentFormState = {
  userId: '',
  roleCode: '',
  scopeType: 'company',
  companyId: '',
  regionId: '',
  storeId: '',
  effectiveFrom: '',
  effectiveTo: '',
}

const initialAuthActionStoreForm: AuthActionStoreFormState = {
  userId: '',
  storeId: '',
  effectiveFrom: '',
  effectiveTo: '',
}

const initialAuthDashboardState: AuthDashboardState = {
  search: '',
  assignmentUserSearch: '',
  assignmentStoreSearch: '',
  actionStoreUserSearch: '',
  actionStoreSearch: '',
  selectedAssignmentUser: null,
  selectedAssignmentStore: null,
  selectedActionStoreUser: null,
  selectedActionStore: null,
  feedback: null,
  errorFeedback: null,
  userForm: initialAuthUserForm,
  assignmentForm: initialAuthAssignmentForm,
  actionStoreForm: initialAuthActionStoreForm,
}
```

- [x] **Step 2: Add reducer function**

Add a reducer that preserves the existing state transitions:

```tsx
function authDashboardReducer(
  state: AuthDashboardState,
  action: AuthDashboardAction,
): AuthDashboardState {
  switch (action.type) {
    case 'setSearch':
      return { ...state, search: action.value }
    case 'setAssignmentUserSearch':
      return { ...state, assignmentUserSearch: action.value }
    case 'setAssignmentStoreSearch':
      return { ...state, assignmentStoreSearch: action.value }
    case 'setActionStoreUserSearch':
      return { ...state, actionStoreUserSearch: action.value }
    case 'setActionStoreSearch':
      return { ...state, actionStoreSearch: action.value }
    case 'setFeedback':
      return { ...state, feedback: action.message }
    case 'setErrorFeedback':
      return { ...state, errorFeedback: action.message }
    case 'clearFeedback':
      return { ...state, feedback: null, errorFeedback: null }
    case 'createUserSucceeded':
      return { ...state, feedback: action.message, errorFeedback: null, userForm: initialAuthUserForm }
    case 'createAssignmentSucceeded':
      return {
        ...state,
        feedback: action.message,
        errorFeedback: null,
        assignmentForm: initialAuthAssignmentForm,
        assignmentUserSearch: '',
        assignmentStoreSearch: '',
        selectedAssignmentUser: null,
        selectedAssignmentStore: null,
      }
    case 'createActionStoreSucceeded':
      return {
        ...state,
        feedback: action.message,
        errorFeedback: null,
        actionStoreForm: initialAuthActionStoreForm,
        actionStoreUserSearch: '',
        actionStoreSearch: '',
        selectedActionStoreUser: null,
        selectedActionStore: null,
      }
    case 'mutationSucceeded':
    case 'userClosed':
      return { ...state, feedback: action.message, errorFeedback: null }
    case 'updateUserForm':
      return { ...state, userForm: action.form }
    case 'updateAssignmentForm':
      return { ...state, assignmentForm: action.form }
    case 'updateActionStoreForm':
      return { ...state, actionStoreForm: action.form }
    case 'selectAssignmentUser':
      return {
        ...state,
        selectedAssignmentUser: action.user,
        assignmentForm: { ...state.assignmentForm, userId: action.userId },
      }
    case 'selectAssignmentStore':
      return {
        ...state,
        selectedAssignmentStore: action.store,
        assignmentForm: {
          ...state.assignmentForm,
          storeId: action.storeId,
          companyId: action.store?.companyId ?? state.assignmentForm.companyId,
          regionId: action.store?.regionId ?? state.assignmentForm.regionId,
        },
      }
    case 'selectActionStoreUser':
      return {
        ...state,
        selectedActionStoreUser: action.user,
        actionStoreForm: { ...state.actionStoreForm, userId: action.userId },
      }
    case 'selectActionStore':
      return {
        ...state,
        selectedActionStore: action.store,
        actionStoreForm: { ...state.actionStoreForm, storeId: action.storeId },
      }
    case 'setAssignmentScopeType':
      return {
        ...state,
        assignmentStoreSearch: action.scopeType === 'store' ? state.assignmentStoreSearch : '',
        selectedAssignmentStore: action.scopeType === 'store' ? state.selectedAssignmentStore : null,
        assignmentForm: {
          ...state.assignmentForm,
          scopeType: action.scopeType,
          regionId: action.scopeType === 'company' ? '' : state.assignmentForm.regionId,
          storeId: action.scopeType === 'store' ? state.assignmentForm.storeId : '',
        },
      }
    default:
      return state
  }
}
```

Expected: reducer actions cover feedback, success resets, form field edits, lookup selections, and assignment scope transitions.

### Task 3: Replace Page State Hooks

**Files:**
- Modify: `admin-web/src/pages/AuthDashboardPage.tsx`

- [x] **Step 1: Replace the `useState` block**

Inside `AuthDashboardPage`, replace the current state hook cluster with:

```tsx
  const [authState, dispatchAuthState] = useReducer(
    authDashboardReducer,
    initialAuthDashboardState,
  )
  const {
    search,
    assignmentUserSearch,
    assignmentStoreSearch,
    actionStoreUserSearch,
    actionStoreSearch,
    selectedAssignmentUser,
    selectedAssignmentStore,
    selectedActionStoreUser,
    selectedActionStore,
    feedback,
    errorFeedback,
    userForm,
    assignmentForm,
    actionStoreForm,
  } = authState
```

- [x] **Step 2: Update mutation callbacks**

Use dispatches for create user, create role assignment, create action-store assignment, deactivate/reactivate success, and error callbacks while keeping query invalidation unchanged.

- [x] **Step 3: Update local helpers and form controls**

Use reducer actions for `updateUserForm`, `updateAssignmentForm`, `updateActionStoreForm`, `selectAssignmentUser`, `selectAssignmentStore`, `selectActionStoreUser`, `selectActionStore`, search inputs, and submit handlers.

Expected: `AuthDashboardPage` has one `useReducer` hook and no `useState` calls.

### Task 4: Verify Slice

**Files:**
- Test: `admin-web`

- [x] **Step 1: Run static checks**

```powershell
npm.cmd --prefix admin-web run build
npm.cmd --prefix admin-web run lint
```

- [x] **Step 2: Run targeted auth E2E**

```powershell
npm.cmd --prefix admin-web run test:e2e -- auth-admin-surfaces.spec.ts
```

- [x] **Step 3: Measure React Doctor**

```powershell
npx.cmd --yes react-doctor@latest admin-web --full --offline --fail-on none
npx.cmd --yes react-doctor@latest admin-web --score --full --offline --fail-on none
```

Expected: React Doctor drops from 15 issues to 14 issues and stays at score 99/100 or better.

### Task 5: Finish

- [x] **Step 1: Run release checks**

```powershell
npm.cmd --prefix admin-web run check:release
npm.cmd run check:release
```

- [x] **Step 2: Commit only this slice**

Stage:

```powershell
git add -- admin-web/src/pages/AuthDashboardPage.tsx docs/superpowers/plans/2026-05-16-react-doctor-auth-dashboard-reducer-v1.md
```

Leave existing unrelated local files unstaged.

- [x] **Step 3: PR note**

Mention that Render deploy is not required because this is frontend/docs-only.

### Verification Results

- `npm.cmd --prefix admin-web run build` passed.
- `npm.cmd --prefix admin-web run lint` passed.
- `npm.cmd --prefix admin-web run test:e2e -- auth-admin-surfaces.spec.ts` passed: 4 tests.
- `npx.cmd --yes react-doctor@latest admin-web --full --offline --fail-on none` dropped React Doctor from 15 to 14 issues across 9 files.
- `npx.cmd --yes react-doctor@latest admin-web --score --full --offline --fail-on none` stayed at score 99.
- `npm.cmd --prefix admin-web run check:release` passed.
- `npm.cmd run check:release` passed on rerun after a transient first failure in the combined release gate.

Render deploy is not required for this PR because the change is frontend/docs-only and does not alter infrastructure, migrations, or runtime environment configuration.
