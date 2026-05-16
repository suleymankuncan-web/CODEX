# React Doctor Store My Performance Reducer V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce the React Doctor `prefer-useReducer` warning count by consolidating `StoreMyPerformancePage` period/filter/modal UI state into one reducer.

**Architecture:** Keep the existing page, query keys, API calls, memoized period derivations, and rendered UI intact. Replace clustered `useState` calls with a reducer that preserves current behavior for live period fallback, date filter toggling, year/month/day selections, closed snapshot selection, and KPI detail modal visibility.

**Tech Stack:** React 19, TypeScript, TanStack Query, Playwright E2E, React Doctor.

---

### Task 1: Consolidate Store Performance UI State

**Files:**
- Modify: `admin-web/src/pages/StoreMyPerformancePage.tsx`
- Test: `admin-web/e2e/store-surfaces.spec.ts`
- Test: `admin-web/e2e/kpi-benchmark-explainability.spec.ts`

- [x] **Step 1: Replace state import**

Change:

```tsx
import { useEffect, useMemo, useState, type CSSProperties } from 'react'
```

to:

```tsx
import { useEffect, useMemo, useReducer, type CSSProperties } from 'react'
```

- [x] **Step 2: Add reducer model**

Add a `StoreMyPerformancePageState` type with these fields:

```tsx
sourceMode: 'live' | 'closed'
selectedLivePeriodType: LivePeriodType
selectedLivePeriodStart: string
selectedLiveYears: string[]
selectedLiveMonthKeys: string[]
selectedLiveDayStarts: string[]
selectedClosedSnapshotRunId: string
isDateFilterOpen: boolean
isKpiDetailOpen: boolean
```

Add a reducer action union for fallback selection, live period type changes, year/month/day selection, date filter toggle, source mode selection, closed snapshot selection, and KPI modal visibility.

- [x] **Step 3: Preserve initial prop behavior**

Initialize reducer state from `input.initialLivePeriodType` and `input.initialLivePeriodStart?.trim() ?? ''`, matching the old `useState` initializers. Do not reset reducer state when props change after mount, because the old `useState` initializers did not do that either.

- [x] **Step 4: Replace setters with dispatches**

Use reducer actions in:

```tsx
livePeriodFallbackStart effect
Escape key modal effect
changeLivePeriodType
toggleLiveYearSelection
toggleLiveMonthSelection
toggleLiveDaySelection
date filter trigger
source mode buttons
closed snapshot select
KPI detail open/close handlers
```

- [x] **Step 5: Verify targeted behavior**

Run:

```powershell
npm.cmd --prefix admin-web run lint
npm.cmd --prefix admin-web run build
npm.cmd --prefix admin-web run test:e2e -- store-surfaces.spec.ts -g "store self-performance|personnel performance profile"
npm.cmd --prefix admin-web run test:e2e -- kpi-benchmark-explainability.spec.ts
npx.cmd --yes react-doctor@latest admin-web --full --offline --fail-on none
```

Expected: commands exit 0, and React Doctor no longer reports `StoreMyPerformancePage.tsx` under `prefer-useReducer`.

- [x] **Step 6: Release gate**

Run:

```powershell
npm.cmd --prefix admin-web run check:release
npm.cmd run check:release
```

Expected: both release gates exit 0 before commit/PR.
