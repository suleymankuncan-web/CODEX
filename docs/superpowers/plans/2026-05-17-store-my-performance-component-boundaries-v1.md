# Store My Performance Component Boundaries V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce the real maintenance and regression risk in `/store/me` by separating stable presentational sections from `StoreMyPerformancePage` while preserving every visible behavior, query, route, label, and CSS class.

**Architecture:** Keep `StoreMyPerformancePage.tsx` as the container for authorization, TanStack Query calls, reducer state, period fallback effects, and derived performance data. Add one sibling section module for the extracted JSX sections. Do not redesign UI, change copy, move API calls, or alter E2E selectors in this PR.

**Tech Stack:** React 19, TypeScript, React Router, TanStack Query, Playwright E2E, React Doctor.

---

## Why This Slice Is Worth Doing

React Doctor is only the signal, not the reason. The useful reason is that `StoreMyPerformancePage` is both large and product-important:

- It is the largest remaining store-facing page in the Doctor list.
- It owns KPI score, ranks, target progress, period filters, and KPI detail behavior for store users.
- It already has reducer state from the previous PR, so the next risk is render and section coupling, not state semantics.
- It has strong E2E coverage in `admin-web/e2e/store-surfaces.spec.ts`, `admin-web/e2e/kpi-benchmark-explainability.spec.ts`, and `admin-web/e2e/pilot-api-contracts.spec.ts`.

Success is not just a better Doctor score. Success is a smaller page container, section components that can be changed independently, unchanged E2E behavior, and a clear next slice if Doctor still reports the page as giant.

## Non-Goals

- Do not change the visual design.
- Do not change translations, text keys, CSS class names, aria labels, or links.
- Do not change API request shape, query keys, retry behavior, or fallback behavior.
- Do not extract shared components for other pages yet.
- Do not chase every remaining `no-giant-component` warning in the same PR.

## Files

- Modify: `admin-web/src/pages/StoreMyPerformancePage.tsx`
- Add: `admin-web/src/pages/store-my-performance-sections.tsx`
- Test: `admin-web/e2e/store-surfaces.spec.ts`
- Test: `admin-web/e2e/kpi-benchmark-explainability.spec.ts`
- Test: `admin-web/e2e/pilot-api-contracts.spec.ts`

---

### Task 1: Establish The Component Boundary

- [ ] Add `admin-web/src/pages/store-my-performance-sections.tsx`.
- [ ] Move `NavGlyph` from `StoreMyPerformancePage.tsx` into the new section module.
- [ ] Export section components from the new module, but keep all data fetching and reducer logic in `StoreMyPerformancePage.tsx`.
- [ ] Keep prop types local to the new module unless an existing exported app type already fits.
- [ ] Import `NavLink`, `CalendarDays`, `ChevronDown`, `X`, and `CSSProperties` in the section module only where they are used.

Expected section exports:

```tsx
StoreMyPerformanceRail
StoreMyPerformanceTopbar
StoreMyPerformanceDateFilter
StoreMyPerformanceScorePanel
StoreMyPerformanceHeroPanel
StoreMyPerformancePartialAlert
StoreMyPerformanceMetricGrid
StoreMyPerformanceLowerGrid
StoreMyPerformanceKpiDialog
StoreMyPerformanceMobileDock
```

### Task 2: Extract Navigation And Period Controls

- [ ] Replace the inline internal rail JSX with `<StoreMyPerformanceRail />`.
- [ ] Replace the inline topbar JSX with `<StoreMyPerformanceTopbar />`.
- [ ] Replace the inline date-filter JSX with `<StoreMyPerformanceDateFilter />`.
- [ ] Pass event handlers from the container instead of dispatching inside the section module.
- [ ] Preserve the existing values for `aria-label`, `aria-expanded`, disabled states, select values, checkbox checked states, and option keys.

Run after this task:

```powershell
npm.cmd --prefix admin-web run lint
npm.cmd --prefix admin-web run build
```

### Task 3: Extract Score, Hero, Metrics, And Coaching Sections

- [ ] Replace the inline score aside with `<StoreMyPerformanceScorePanel />`.
- [ ] Replace the inline hero and target progress panel with `<StoreMyPerformanceHeroPanel />`.
- [ ] Replace the partial-data warning with `<StoreMyPerformancePartialAlert />`.
- [ ] Replace the KPI metric grid with `<StoreMyPerformanceMetricGrid />`.
- [ ] Replace the lower trend/coaching grid with `<StoreMyPerformanceLowerGrid />`.
- [ ] Keep `metricCards`, `samePeriodMetrics`, `trendPoints`, target progress values, and rank values computed in `StoreMyPerformancePage.tsx` for this PR.
- [ ] Do not change inline CSS variable names such as `--store-me-v2-score`, `--store-me-v2-fill`, and `--store-me-v2-width`.

Run after this task:

```powershell
npm.cmd --prefix admin-web run lint
npm.cmd --prefix admin-web run build
npm.cmd --prefix admin-web run test:e2e -- store-surfaces.spec.ts -g "store self-performance"
```

### Task 4: Extract The KPI Detail Dialog

- [ ] Replace the inline KPI dialog/backdrop with `<StoreMyPerformanceKpiDialog />`.
- [ ] Keep open/close state and Escape-key behavior in `StoreMyPerformancePage.tsx`.
- [ ] Pass `onClose` into the dialog section and preserve backdrop close behavior by comparing `event.target` and `event.currentTarget`.
- [ ] Preserve the monthly table row keys, labels, and fallback trend text.
- [ ] Replace the inline mobile dock with `<StoreMyPerformanceMobileDock />`.

Run after this task:

```powershell
npm.cmd --prefix admin-web run lint
npm.cmd --prefix admin-web run build
npm.cmd --prefix admin-web run test:e2e -- kpi-benchmark-explainability.spec.ts -g "my performance"
npm.cmd --prefix admin-web run test:e2e -- pilot-api-contracts.spec.ts -g "store my performance"
```

### Task 5: Check Whether V1 Actually Reduced Risk

- [ ] Run React Doctor:

```powershell
npx.cmd --yes react-doctor@latest admin-web --full --offline --fail-on none
```

- [ ] Record whether `StoreMyPerformancePage.tsx` still appears under `no-giant-component`.
- [ ] If the page still appears, do not expand this PR automatically. Create the next plan around pure model extraction from `StoreMyPerformancePage.tsx`.
- [ ] If the page drops from the Doctor list, keep the PR scoped to this extraction and move to release gates.

### Task 6: Release Gates And PR

- [ ] Run the admin release gate:

```powershell
npm.cmd --prefix admin-web run check:release
```

- [ ] Run the root release gate:

```powershell
npm.cmd run check:release
```

- [ ] Open the PR only after all required commands pass.
- [ ] PR summary sentence:

```text
Extracted the store self-performance page into stable section components without changing data flow, UI behavior, or KPI semantics.
```

- [ ] Render deploy note:

```text
Frontend-only refactor; no manual Render deploy is required beyond the normal merge pipeline.
```

---

## Follow-Up Plan After V1

Only do these after V1 is merged and verified:

1. If `StoreMyPerformancePage` still fails `no-giant-component`, extract pure derived data into `admin-web/src/pages/store-my-performance-model.ts`.
2. Next inspect `StoreKpiHighlightsPage.tsx`, because it is in the same KPI domain and likely benefits from the lessons from `/store/me`.
3. Then choose between `StoreApprovalsPage.tsx` and `AdminChecklistTemplatesPage.tsx` based on product change frequency, not line count alone.
4. Defer broad admin pages like `MasterDataBootstrapPage.tsx`, `AuthDashboardPage.tsx`, and `IntegrationDashboardPage.tsx` unless they block active work.

## Stop Criteria

Stop and reassess instead of continuing if:

- Any E2E fails in a way that suggests behavior changed.
- The extracted section props become harder to understand than the original JSX.
- More than one page needs to change.
- The diff starts changing CSS, translation keys, query logic, or app routing.

Plan complete and saved to `docs/superpowers/plans/2026-05-17-store-my-performance-component-boundaries-v1.md`.

Execution recommendation: use inline execution for this first PR unless the user explicitly asks for parallel subagents. The task is mostly mechanical extraction and the safest path is one careful owner preserving behavior.
