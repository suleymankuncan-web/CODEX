# React Doctor Small Perf V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the next low-risk admin-web React Doctor performance warnings without changing UI behavior.

**Architecture:** Keep edits scoped to small pure helpers and event handlers. Hoist stable Turkish number formatters to module scope, switch offset increment/decrement handlers to functional state updates, and replace chained filter/map assertions with a single pass or a single locator filter.

**Tech Stack:** Vite, React 19, TypeScript, React Doctor, Playwright.

---

**Execution status:** Implemented and verified on `codex/react-doctor-small-perf-v1`.

**Verification results:**
- `npm.cmd --prefix admin-web run build` passed.
- `npm.cmd --prefix admin-web run lint` passed.
- `npm.cmd --prefix admin-web run test:e2e -- checklist-today-surfaces.spec.ts` passed.
- `npm.cmd --prefix admin-web run check:release` passed.
- `npx.cmd --yes react-doctor@latest admin-web --json --full --offline --fail-on none` reported `0` errors, `23` warnings, `23` total diagnostics.
- `npx.cmd --yes react-doctor@latest admin-web --score --full --offline --fail-on none` reported `96`.

### Task 1: Hoist Number Formatters

**Files:**
- Modify: `admin-web/src/pages/MasterDataBootstrapPage.tsx`
- Modify: `admin-web/src/pages/IntegrationDashboardPage.tsx`

- [x] **Step 1: Add module-level number formatters**

For each file, add a module-level formatter near the existing constants:

```tsx
const trNumberFormatter = new Intl.NumberFormat('tr-TR')
```

- [x] **Step 2: Reuse the formatter**

Change each local `formatNumber` helper to:

```tsx
function formatNumber(value: number) {
  return trNumberFormatter.format(value)
}
```

Expected React Doctor result: remove the `js-hoist-intl` warnings in both files.

### Task 2: Use Functional Offset Updates

**Files:**
- Modify: `admin-web/src/pages/MasterDataBootstrapPage.tsx`

- [x] **Step 1: Update store pager callbacks**

Change the store `MasterDataPager` callbacks to:

```tsx
onPrevious={() => setStoreOffset((current) => Math.max(0, current - PAGE_SIZE))}
onNext={() => setStoreOffset((current) => current + PAGE_SIZE)}
```

- [x] **Step 2: Update personnel pager callbacks**

Change the personnel `MasterDataPager` callbacks to:

```tsx
onPrevious={() => setPersonnelOffset((current) => Math.max(0, current - PAGE_SIZE))}
onNext={() => setPersonnelOffset((current) => current + PAGE_SIZE)}
```

Expected React Doctor result: remove the two `rerender-functional-setstate` warnings in this file.

### Task 3: Collapse VM Checklist Template Iteration

**Files:**
- Modify: `admin-web/src/pages/StoreHomePage.tsx`

- [x] **Step 1: Build VM template ids and template rows in one pass**

Replace the chained `filter().map()` that builds `vmTemplateIds` with:

```tsx
  const vmTemplateIds = new Set<string>()
  const vmTemplates: MobileChecklistToday['templates'] = []

  for (const template of mobileToday.templates) {
    if (template.templateType !== 'VM_STORE_VISIT') continue
    vmTemplateIds.add(template.checklistTemplateId)
    vmTemplates.push(template)
  }
```

- [x] **Step 2: Reuse `vmTemplates` in the returned data**

Change the returned `templates` value to:

```tsx
templates: vmTemplates,
```

Expected React Doctor result: remove the `js-combine-iterations` warning in `StoreHomePage.tsx`.

### Task 4: Collapse Checklist E2E Locator Filters

**Files:**
- Modify: `admin-web/e2e/checklist-today-surfaces.spec.ts`

- [x] **Step 1: Replace chained locator filters with one filter**

Change the acknowledged history assertion to use one `filter` call:

```ts
  await expect(
    page.locator('.store-checklists-history-row').filter({
      hasText: /(?=.*BM Result)(?=.*Acknowledged)/,
    }),
  ).toBeVisible()
```

Expected React Doctor result: remove the E2E `js-combine-iterations` warning.

### Task 5: Verify Slice

**Files:**
- Test: `admin-web`

- [x] **Step 1: Run static checks**

```powershell
npm.cmd --prefix admin-web run build
npm.cmd --prefix admin-web run lint
```

- [x] **Step 2: Run targeted E2E**

```powershell
npm.cmd --prefix admin-web run test:e2e -- checklist-today-surfaces.spec.ts
```

- [x] **Step 3: Measure React Doctor**

```powershell
npx.cmd --yes react-doctor@latest admin-web --json --full --offline --fail-on none
npx.cmd --yes react-doctor@latest admin-web --score --full --offline --fail-on none
```

Expected: admin-web remains error-free and total warnings drop below `29`.

### Task 6: Finish

- [x] **Step 1: Commit only this slice**

Stage:

```powershell
git add -- admin-web/src/pages/MasterDataBootstrapPage.tsx admin-web/src/pages/IntegrationDashboardPage.tsx admin-web/src/pages/StoreHomePage.tsx admin-web/e2e/checklist-today-surfaces.spec.ts docs/superpowers/plans/2026-05-16-react-doctor-small-perf-v1.md
```

Leave existing unrelated local files unstaged.

- [ ] **Step 2: PR note**

Mention that Render deploy is not required because this is frontend/test/docs-only.
