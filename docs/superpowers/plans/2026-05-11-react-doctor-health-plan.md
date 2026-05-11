# React Doctor Health Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce React Doctor findings in `admin-web` without changing product behavior, while prioritizing correctness and stale-cache risks before cosmetic or architectural cleanup.

**Architecture:** Treat the 159 diagnostics as a triage backlog, not 159 bugs. Fix small behavior-affecting issues first, verify false positives before changing working code, and split giant-component refactors into separate PRs only around active product surfaces.

**Tech Stack:** Vite, React 19, TypeScript, TanStack Query, Playwright, React Doctor.

---

## Baseline

Command used:

```bash
cd D:\store-ops-workspace\admin-web
npx.cmd --yes react-doctor@latest . --json --full --offline --fail-on none
```

Current score: 86 / 100.

Current diagnostics: 159 across 51 / 145 files.

Category breakdown:

- Dead Code: 59
- Performance: 46
- Architecture: 22
- TanStack Query: 14
- State & Effects: 11
- Correctness: 7

Rule breakdown:

- `types`: 32
- `exports`: 27
- `no-giant-component`: 17
- `query-mutation-missing-invalidation`: 14
- `js-tosorted-immutable`: 10
- `prefer-useReducer`: 9
- `js-combine-iterations`: 8
- `js-hoist-intl`: 8
- `js-flatmap-filter`: 6
- `rerender-lazy-state-init`: 6
- `no-array-index-as-key`: 5
- `no-many-boolean-props`: 3
- `no-react19-deprecated-apis`: 2
- `rendering-hydration-mismatch-time`: 2
- `async-await-in-loop`: 2
- `js-hoist-regexp`: 2
- `js-min-max-loop`: 2
- `rerender-functional-setstate`: 2
- `no-cascading-set-state`: 2

---

## Execution Order

Do not attempt one large PR. Use small slices:

1. Correctness slice.
2. TanStack Query cache slice.
3. Dead code slice.
4. Small performance slice.
5. State/effects hygiene slice.
6. Architecture extraction slice.

Run after every slice:

```bash
cd D:\store-ops-workspace\admin-web
npm.cmd run build
npm.cmd run lint
npx.cmd playwright test e2e/store-surfaces.spec.ts -g "store personnel profile"
npx.cmd --yes react-doctor@latest . --score --full --offline --fail-on none
```

Add page-specific Playwright tests when a slice touches a page with an existing e2e surface.

---

## Task 1: Correctness Slice

**Why first:** These can cause user-visible UI bugs: unstable list keys and time values inside render.

**Files:**

- Modify: `admin-web/src/pages/TargetApprovalQueuePage.tsx`
- Modify: `admin-web/src/pages/ReportsTurnoverPage.tsx`
- Modify: `admin-web/src/pages/AdminKpiConfigPage.tsx`
- Modify: `admin-web/src/pages/IntegrationDashboardPage.tsx`

**Diagnostics covered:**

- `no-array-index-as-key`: 5
- `rendering-hydration-mismatch-time`: 2

- [ ] Step 1: Inspect each index key and identify a stable row key.

Use these candidates:

- `TargetApprovalQueuePage.tsx:359`: prefer target/request/queue id fields already present in the mapped row.
- `ReportsTurnoverPage.tsx:242`: prefer employee id plus period/snapshot id.
- `AdminKpiConfigPage.tsx:432`, `539`, `933`: prefer metric code, band code, ownership code, or composed stable labels.

Run:

```bash
rg -n "key=\\{index\\}|map\\(.*index" admin-web/src/pages/TargetApprovalQueuePage.tsx admin-web/src/pages/ReportsTurnoverPage.tsx admin-web/src/pages/AdminKpiConfigPage.tsx
```

Expected: find all 5 index-key sites before editing.

- [ ] Step 2: Replace each `key={index}` with a stable unique key.

Use the smallest local field available. If the row has no stable id, build a deterministic composite key from immutable row values rather than array position.

- [ ] Step 3: Move the `new Date()` render value in `IntegrationDashboardPage.tsx` out of JSX.

Use a client-only state value:

```tsx
const [renderedAt, setRenderedAt] = useState('')

useEffect(() => {
  setRenderedAt(new Date().toLocaleString())
}, [])
```

Render `renderedAt || '-'`.

- [ ] Step 4: Verify.

Run:

```bash
cd D:\store-ops-workspace\admin-web
npm.cmd run build
npm.cmd run lint
npx.cmd --yes react-doctor@latest . --full --offline --fail-on none
```

Expected: correctness count drops from 7 to 0 or only acknowledged false positives remain.

---

## Task 2: TanStack Query Cache Slice

**Why second:** Stale cache after mutations is a real product risk. But the report includes likely false positives because React Doctor does not always recognize helper functions such as `refreshFeed()` or `refreshAuthData()`.

**Files:**

- Inspect/possibly modify: `admin-web/src/pages/MasterDataBootstrapPage.tsx`
- Inspect/possibly modify: `admin-web/src/pages/AdminFeedPage.tsx`
- Inspect/possibly modify: `admin-web/src/pages/AuthDashboardPage.tsx`
- Inspect/possibly modify: `admin-web/src/features/competitions/StageBuilderForm.tsx`

**Diagnostics covered:**

- `query-mutation-missing-invalidation`: 14

- [ ] Step 1: Classify each warning as true positive or false positive.

Known likely false positives:

- `MasterDataBootstrapPage.tsx`: mutations already call `invalidateMasterDataQueries(queryClient, batchId)`.
- `AdminFeedPage.tsx`: mutations already call `refreshFeed()`, which invalidates `['admin-feed']` and `['visible-feed']`.
- `AuthDashboardPage.tsx`: many mutations already call `refreshAuthData()`.

Likely true positives to inspect:

- `StageBuilderForm.tsx:679`: `createMutation` calls `input.onCreated()` but no local query invalidation.
- `StageBuilderForm.tsx:688`: `createStagePackageMutation` calls `input.onCreated()` but no local query invalidation.

- [ ] Step 2: For true positives, add direct invalidations.

For stage creation:

```ts
await queryClient.invalidateQueries({ queryKey: ['competition-stage-builder-lookups'] })
await input.onCreated()
```

For stage package creation:

```ts
await queryClient.invalidateQueries({
  queryKey: ['competition-stage-package-plans', input.competitionId],
})
await input.onCreated()
```

If a mutation changes templates, keep the existing `['competition-team-templates']` invalidation.

- [ ] Step 3: Do not rewrite working helper invalidations only to satisfy the tool.

If React Doctor still flags helper-based invalidations after inspection, document them as false positives in the PR body instead of duplicating code.

- [ ] Step 4: Verify.

Run:

```bash
cd D:\store-ops-workspace\admin-web
npm.cmd run build
npm.cmd run lint
npx.cmd --yes react-doctor@latest . --full --offline --fail-on none
```

Expected: true stale-cache risks are fixed. Remaining query warnings, if any, are explicitly identified as helper-detection false positives.

---

## Task 3: Dead Code Slice

**Why third:** This gives the largest count reduction with low runtime risk, but exported API-contract types must be removed carefully.

**Files with most findings:**

- `admin-web/src/features/reports/api.ts`: 19 findings
- `admin-web/src/features/workflow/contracts.ts`
- `admin-web/src/features/auth/api.ts`
- `admin-web/src/features/integrations/api.ts`
- `admin-web/src/features/competitions/api.ts`
- `admin-web/src/features/kpi/grading.ts`
- `admin-web/src/features/kpi/source-semantics.ts`
- `admin-web/src/features/reports/snapshot-labels.ts`
- `admin-web/src/lib/i18n.ts`
- `admin-web/src/features/localization/dictionary.ts`

**Diagnostics covered:**

- `types`: 32
- `exports`: 27

- [ ] Step 1: Confirm each symbol is unused before removal.

For each reported symbol, run:

```bash
rg -n "SymbolName" admin-web/src admin-web/e2e
```

Expected for removal: only its declaration appears.

- [ ] Step 2: Remove unused type declarations first.

Start with `src/features/reports/api.ts` because it has the highest density. Remove only symbols that are not referenced by any component or test.

- [ ] Step 3: Remove unused exported functions.

Candidates:

- `appLocaleStorageKey`
- `isAppLocale`
- `normalizeAppLocale`
- `interpolateTranslation`
- `describeSessionMode`
- `resolveAuthErrorCopy`
- `updateFeedPost`
- `formatFeedPostType`
- `formatFeedScope`
- `getClosedLeaderboard`
- workflow formatter exports
- KPI grading/source formatter exports

- [ ] Step 4: Verify TypeScript catches accidental contract damage.

Run:

```bash
cd D:\store-ops-workspace\admin-web
npm.cmd run build
npm.cmd run lint
npx.cmd --yes react-doctor@latest . --full --offline --fail-on none
```

Expected: dead-code count drops materially. Build must pass with `noUnusedLocals`.

---

## Task 4: Small Performance Slice

**Why fourth:** These are mostly mechanical, low-risk improvements.

**Files:**

- `admin-web/src/features/kpi/grading.ts`
- `admin-web/src/pages/StoreTasksPage.tsx`
- `admin-web/src/pages/StoreMyPerformancePage.tsx`
- `admin-web/src/features/competitions/StageBuilderForm.tsx`
- `admin-web/src/pages/AdminInboxPage.tsx`
- `admin-web/src/features/reports/snapshot-labels.ts`
- `admin-web/src/lib/format.ts`
- `admin-web/src/pages/StoreKpiHighlightsPage.tsx`
- `admin-web/e2e/pilot-smoke.spec.ts`

**Diagnostics covered:**

- `js-tosorted-immutable`: 10
- `js-combine-iterations`: 8
- `js-hoist-intl`: 8
- `js-flatmap-filter`: 6
- `rerender-lazy-state-init`: 6
- `async-await-in-loop`: 2
- `js-hoist-regexp`: 2
- `js-min-max-loop`: 2
- `rerender-functional-setstate`: 2

- [ ] Step 1: Replace safe `[...items].sort(...)` with `items.toSorted(...)`.

This project targets ES2023 in `tsconfig.app.json`, so `toSorted()` is supported by the TS lib target.

- [ ] Step 2: Cache or memoize repeated `Intl` constructors.

For generic helpers in `src/lib/format.ts`, use module-level caches:

```ts
const numberFormatCache = new Map<string, Intl.NumberFormat>()
```

Key by locale and options. Do the same for date formatters.

- [ ] Step 3: Convert `useState(slice())` to lazy initializers.

Example:

```ts
const [items, setItems] = useState(() => source.slice(0, 10))
```

- [ ] Step 4: Combine obvious `map().filter(Boolean)` chains only where readability remains good.

Do not turn simple UI code into dense reducers just to please the tool.

- [ ] Step 5: Replace `array.sort()[0]` min/max patterns with O(n) min/max.

Use:

```ts
const bestValue = Math.max(...values)
```

or a loop if the array can be large.

- [ ] Step 6: Verify.

Run:

```bash
cd D:\store-ops-workspace\admin-web
npm.cmd run build
npm.cmd run lint
npx.cmd playwright test e2e/store-surfaces.spec.ts
npx.cmd --yes react-doctor@latest . --full --offline --fail-on none
```

Expected: performance count drops sharply without UI behavior changes.

---

## Task 5: State and Effects Hygiene Slice

**Why fifth:** `useReducer` warnings are architectural suggestions, not automatic bugs. Apply only where state groups are truly related.

**Files:**

- `admin-web/src/features/auth/PilotUserBindingPanel.tsx`
- `admin-web/src/pages/StoreMyPerformancePage.tsx`
- `admin-web/src/pages/StoreRankingsPage.tsx`
- `admin-web/src/pages/MasterDataBootstrapPage.tsx`
- `admin-web/src/pages/IntegrationDashboardPage.tsx`
- `admin-web/src/features/competitions/StageBuilderForm.tsx`
- `admin-web/src/pages/StoreApprovalsPage.tsx`
- `admin-web/src/pages/SnapshotsDashboardPage.tsx`
- `admin-web/src/pages/AuthDashboardPage.tsx`
- `admin-web/src/features/auth/clerk-session.tsx`
- `admin-web/src/pages/AuthLoginPage.tsx`

**Diagnostics covered:**

- `prefer-useReducer`: 9
- `no-cascading-set-state`: 2

- [ ] Step 1: Only reduce grouped form/filter state.

Good candidates:

- filter state in `StoreRankingsPage`
- date-filter state in `StoreMyPerformancePage`
- auth/admin form state in `AuthDashboardPage`
- approval request form state in `StoreApprovalsPage`

- [ ] Step 2: Avoid reducer churn for independent UI toggles.

Do not move unrelated booleans into one reducer if it makes event handlers harder to read.

- [ ] Step 3: Fix cascading `setState` effects by deriving or batching related state.

Files:

- `src/features/auth/clerk-session.tsx`
- `src/pages/AuthLoginPage.tsx`

- [ ] Step 4: Verify with focused UI tests.

Run:

```bash
cd D:\store-ops-workspace\admin-web
npm.cmd run build
npm.cmd run lint
npx.cmd playwright test e2e/store-surfaces.spec.ts -g "store shell"
```

Add page-specific tests if reducers touch forms without coverage.

---

## Task 6: Architecture Extraction Slice

**Why last:** Giant components are real maintainability debt, but extracting them can create broad regression risk. Do not do all 17 at once.

**Files with largest impact:**

- `admin-web/src/pages/StoreMyPerformancePage.tsx`: 1193 lines
- `admin-web/src/pages/AuthDashboardPage.tsx`: 987 lines
- `admin-web/src/pages/StoreKpiHighlightsPage.tsx`: 979 lines
- `admin-web/src/pages/IntegrationDashboardPage.tsx`: 964 lines
- `admin-web/src/features/competitions/StageBuilderForm.tsx`: 741 and 608 line components
- `admin-web/src/pages/StoreApprovalsPage.tsx`: 691 lines
- `admin-web/src/pages/AdminKpiConfigPage.tsx`: 628 lines

**Diagnostics covered:**

- `no-giant-component`: 17
- `no-many-boolean-props`: 3
- `no-react19-deprecated-apis`: 2

- [ ] Step 1: Start with active product surfaces only.

Recommended first target:

- `StoreMyPerformancePage.tsx`

Extract to:

- `admin-web/src/features/store-performance/StorePerformanceDateFilter.tsx`
- `admin-web/src/features/store-performance/StorePerformanceScorePanel.tsx`
- `admin-web/src/features/store-performance/StorePerformanceMetricGrid.tsx`
- `admin-web/src/features/store-performance/StorePerformanceTimeline.tsx`
- `admin-web/src/features/store-performance/store-performance-model.ts`

- [ ] Step 2: Keep data fetching in the page for the first extraction.

Move presentation and pure derivation first. Do not move query ownership until the UI split is stable.

- [ ] Step 3: Preserve current CSS class names.

Avoid visual churn while extracting. The goal is maintainability, not redesign.

- [ ] Step 4: Replace boolean-heavy approval subforms only after active store/personnel surfaces are stable.

For `StoreApprovalsPage`, introduce explicit props objects:

```ts
type FormPermissions = {
  canCreateForStore: boolean
  canSubmit: boolean
}
```

This reduces prop sprawl without changing behavior.

- [ ] Step 5: React 19 `useContext` warnings are low priority.

Files:

- `src/features/localization/useLocalization.ts`
- `src/features/session/session-context-value.ts`

Switch to `use()` only if build/lint and React 19 behavior stay clean. `useContext` remains familiar and safe, so this is not urgent.

- [ ] Step 6: Verify full store surface.

Run:

```bash
cd D:\store-ops-workspace\admin-web
npm.cmd run build
npm.cmd run lint
npx.cmd playwright test e2e/store-surfaces.spec.ts
npx.cmd --yes react-doctor@latest . --full --offline --fail-on none
```

Expected: StoreMyPerformance giant-component warning disappears or is reduced, with no UI behavior regression.

---

## Recommended PR Slices

1. `codex/react-doctor-correctness-v1`
   - Stable keys and render-time date cleanup.

2. `codex/react-doctor-query-cache-v1`
   - True TanStack invalidation fixes; document false positives.

3. `codex/react-doctor-dead-code-v1`
   - Unused type/export cleanup.

4. `codex/react-doctor-performance-v1`
   - toSorted, Intl cache, lazy state init, min/max cleanup.

5. `codex/react-doctor-store-me-extract-v1`
   - Extract `StoreMyPerformancePage` presentation pieces.

6. `codex/react-doctor-admin-surfaces-v1`
   - Optional later slice for Auth/Admin/Approvals giant components.

---

## Risk Notes

- Do not chase every React Doctor warning blindly.
- Query invalidation warnings can be false positives when invalidation is hidden behind a helper.
- Dead exported API types might be intentionally kept as contract documentation; remove only after `rg` confirms no local references.
- Giant component extraction should preserve markup and class names first; redesign belongs in a separate UI task.
- Run product-specific Playwright tests after touching any store/personnel surface.

---

## Success Criteria

- Build and lint pass.
- Existing store/personnel Playwright tests pass.
- React Doctor score improves from 86.
- Correctness diagnostics drop to zero or are explicitly documented.
- No product behavior changes unless covered by tests.
