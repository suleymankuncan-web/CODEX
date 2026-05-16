# React Doctor Store Checklists Iteration V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the low-risk StoreChecklistsPage React Doctor iteration and Intl allocation warnings without changing UI behavior.

**Architecture:** Keep the slice inside the existing store checklist page. Replace chained array transforms with small explicit loops where the code is computing aggregate values, use `toSorted()` for immutable ordering, and hoist month formatters to module scope by app locale.

**Tech Stack:** Vite, React 19, TypeScript, TanStack Query, React Doctor, Playwright.

---

**Execution status:** Implemented and verified on `codex/react-doctor-store-checklists-iteration-v1`.

**Verification results:**
- `npm.cmd --prefix admin-web run build` passed.
- `npm.cmd --prefix admin-web run lint` passed.
- `npm.cmd --prefix admin-web run test:e2e -- checklist-today-surfaces.spec.ts` passed.
- `npm.cmd --prefix admin-web run check:release` passed.
- `npx.cmd --yes react-doctor@latest admin-web --json --full --offline --fail-on none` reported `0` errors, `29` warnings, `29` total diagnostics.
- `npx.cmd --yes react-doctor@latest admin-web --score --full --offline --fail-on none` reported `95`.

### Task 1: Hoist Month Formatters

**Files:**
- Modify: `admin-web/src/pages/StoreChecklistsPage.tsx`

- [x] **Step 1: Add module-level month formatters**

Add this near the existing module constants:

```tsx
const checklistMonthFormatters: Record<AppLocale, Intl.DateTimeFormat> = {
  tr: new Intl.DateTimeFormat(getIntlLocale('tr'), {
    month: 'long',
    year: 'numeric',
  }),
  en: new Intl.DateTimeFormat(getIntlLocale('en'), {
    month: 'long',
    year: 'numeric',
  }),
}
```

- [x] **Step 2: Reuse the formatter in `formatMonthKey`**

Change `formatMonthKey` to:

```tsx
function formatMonthKey(value: string, locale: AppLocale) {
  const [year, month] = value.split('-').map(Number)
  return checklistMonthFormatters[locale].format(new Date(year, month - 1, 1))
}
```

Expected React Doctor result: remove the `js-hoist-intl` warning for `StoreChecklistsPage.tsx`.

### Task 2: Combine Score Ratio Iterations

**Files:**
- Modify: `admin-web/src/pages/StoreChecklistsPage.tsx`

- [x] **Step 1: Replace modal score map/filter with a single pass**

Use counters before `currentScore`:

```tsx
  let scoredRatioTotal = 0
  let scoredRatioCount = 0

  for (const item of input.session.template.items) {
    const score = input.scores[item.templateItemId]
    if (!Number.isFinite(score) || item.maxScore <= 0) continue
    scoredRatioTotal += Math.round((score / item.maxScore) * 100)
    scoredRatioCount += 1
  }

  const currentScore =
    scoredRatioCount > 0 ? Math.round(scoredRatioTotal / scoredRatioCount) : 0
```

- [x] **Step 2: Replace section response ratio map/filter with a single pass**

Inside `groupChecklistResultResponses`, iterate each section's items and compute `ratioTotal` plus `ratioCount`, then push a result object.

Expected React Doctor result: remove the `js-combine-iterations` warnings for the modal current score and grouped section average.

### Task 3: Simplify Store Visit Date/Score Aggregates

**Files:**
- Modify: `admin-web/src/pages/StoreChecklistsPage.tsx`

- [x] **Step 1: Replace date map/filter/sort with direct comparison**

Change `getStoreVisitDate` to read BM and VM dates directly and return the newest non-null value using `compareDate`.

- [x] **Step 2: Replace score map/filter with direct comparison**

Change `getStoreVisitScore` to read BM and VM scores directly and return the lower non-null score.

Expected React Doctor result: remove the `js-combine-iterations` and `js-min-max-loop` warnings for store visit date and score helpers.

### Task 4: Use Immutable Sorting APIs

**Files:**
- Modify: `admin-web/src/pages/StoreChecklistsPage.tsx`

- [x] **Step 1: Update month options sorting**

Use `Array.from(monthKeys).toSorted((left, right) => right.localeCompare(left))` before mapping.

- [x] **Step 2: Update the three checklist sort helpers**

Change `sortCoverageRows`, `sortStoreVisitRows`, and `sortChecklistItems` from `[...items].sort(...)` to `items.toSorted(...)`.

Expected React Doctor result: remove the `js-tosorted-immutable` warnings for this file.

### Task 5: Verify Slice

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
npx.cmd --yes react-doctor@latest admin-web --json --full --offline --fail-on none
npx.cmd --yes react-doctor@latest admin-web --score --full --offline --fail-on none
```

Expected: admin-web remains error-free and total warnings drop below `39`.

### Task 6: Finish

- [x] **Step 1: Commit only this slice**

Stage:

```powershell
git add -- admin-web/src/pages/StoreChecklistsPage.tsx docs/superpowers/plans/2026-05-16-react-doctor-store-checklists-iteration-v1.md
```

Leave existing unrelated local files unstaged.

- [ ] **Step 2: PR note**

Mention that Render deploy is not required because this is frontend-only.
