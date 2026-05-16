# React Doctor Store Approvals Reducer V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce the React Doctor `prefer-useReducer` warning count by consolidating `StoreApprovalsPage` approval, target request, seller code, and offboarding UI state into one reducer.

**Architecture:** Keep all data queries, mutations, API payloads, authorization checks, and child components unchanged. Move clustered form state and reset/edit flows into reducer actions so target allocation edits, seller request edits, offboarding edits, approval notes, notices, selected store, and active ledger panel transition atomically.

**Tech Stack:** React 19, TypeScript, TanStack Query, Playwright E2E, React Doctor.

---

### Task 1: Consolidate Store Approvals State

**Files:**
- Modify: `admin-web/src/pages/StoreApprovalsPage.tsx`
- Test: `admin-web/e2e/store-surfaces.spec.ts`
- Test: `admin-web/e2e/pilot-api-contracts.spec.ts`

- [x] **Step 1: Replace state import**

Change:

```tsx
import { useMemo, useState, type ReactNode } from 'react'
```

to:

```tsx
import { useMemo, useReducer, type ReactNode } from 'react'
```

- [x] **Step 2: Add reducer model**

Add a `StoreApprovalsPageState` type containing the current local state fields: selected store, target request form fields, notices, approval notes, active panel, seller form fields, seller edit id, offboarding form fields, offboarding edit id, and target allocations.

- [x] **Step 3: Preserve initial behavior**

Create reducer state from:

```tsx
defaultTargetLabel: t('storeApprovals.targetLabelDefault')
initialPanel: showTargetSubmission ? 'targetRequest' : showTargetApprovalQueue ? 'targetApproval' : 'submittedTargets'
```

Keep date defaults equivalent to the old `useState` initializers with `new Date().toISOString().slice(...)`.

- [x] **Step 4: Replace grouped resets and edits**

Use reducer actions for:

```tsx
target request success reset
seller request success reset
offboarding request success reset
returned seller request edit load
returned offboarding request edit load
seller edit cancel
offboarding edit cancel
allocation value/note updates
field changes that clear their notice
approval note updates
panel selection
```

- [x] **Step 5: Verify targeted behavior**

Run:

```powershell
npm.cmd --prefix admin-web run lint
npm.cmd --prefix admin-web run build
npm.cmd --prefix admin-web run test:e2e -- store-surfaces.spec.ts -g "store approvals page|store tasks prefetches approvals"
npm.cmd --prefix admin-web run test:e2e -- pilot-api-contracts.spec.ts -g "store approvals"
npx.cmd --yes react-doctor@latest admin-web --full --offline --fail-on none
```

Expected: commands exit 0, and React Doctor no longer reports `StoreApprovalsPage.tsx` under `prefer-useReducer`.

- [x] **Step 6: Release gate**

Run:

```powershell
npm.cmd --prefix admin-web run check:release
npm.cmd run check:release
```

Expected: both release gates exit 0 before commit/PR.
