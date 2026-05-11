# Store Me Performance Detail UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrate the accepted `/store/me` prototype behavior into the real React surface: compact period filter, smaller same-period comparison card, clearer progress tracks, and a KPI detail dialog with month-by-month personnel rows.

**Architecture:** Keep the slice frontend-only. Reuse the existing `/reports/my-performance` endpoint for monthly rows by querying available monthly periods; do not add backend fields or change scoring semantics. Scope styling to store/me-specific classes so rankings and other store surfaces are not disturbed.

**Tech Stack:** React 19, React Query, Vite, Playwright, existing localization dictionary.

---

### Task 1: Lock The Expected Store/Me Behavior

**Files:**
- Modify: `admin-web/e2e/store-surfaces.spec.ts`

- [ ] **Step 1: Write the failing e2e expectations**

Add assertions to the existing `store self-performance page renders live score, metrics, and ranks` test:

```ts
await expect(page.getByRole('button', { name: /Tarih filtresi/i })).toBeVisible()
await page.getByRole('button', { name: /KPI detayları/i }).click()
await expect(page.getByRole('dialog', { name: /ay ay performansı/i })).toBeVisible()
await expect(page.getByText('Nisan 2026')).toBeVisible()
await expect(page.getByText('Mayıs 2026')).toBeVisible()
await expect(page.getByRole('dialog')).not.toContainText('CR')
```

- [ ] **Step 2: Run the targeted test and verify RED**

Run:

```powershell
npm.cmd --prefix admin-web run test:e2e -- store-surfaces.spec.ts -g "store self-performance page renders live score, metrics, and ranks"
```

Expected: fail because the date filter button and KPI detail dialog are not implemented yet.

### Task 2: Add Month Row Data Preparation

**Files:**
- Modify: `admin-web/src/pages/StoreMyPerformancePage.tsx`

- [ ] **Step 1: Query available monthly periods**

Use `useQueries` for the live monthly periods already returned by `getMyPerformance`. Keep it to the current active year and at most 12 periods.

- [ ] **Step 2: Build row view models**

Create small helpers in `StoreMyPerformancePage.tsx` that resolve UPT, ATV, and `TARGET_ACHIEVEMENT` values from `MyPerformanceSummary.metrics`, format them through existing KPI formatters, and calculate a bounded trend width from the score.

- [ ] **Step 3: Preserve fallback behavior**

If historical monthly queries have no data yet, the modal still shows the current performance period as one row.

### Task 3: Implement The Store/Me UI

**Files:**
- Modify: `admin-web/src/pages/StoreMyPerformancePage.tsx`
- Modify: `admin-web/src/features/localization/messages/store-me.ts`

- [ ] **Step 1: Replace the bulky filter toolbar with a single-line disclosure**

Keep the existing live/closed selectors and selects, but put them inside a compact expandable date filter panel.

- [ ] **Step 2: Add compact performance stage**

Add a store/me-specific layout with a score ring, target progress card, compact same-period comparison card, and KPI detail button.

- [ ] **Step 3: Add KPI detail dialog**

Use a semantic `dialog`-style overlay implemented with React state. Include close button, Escape-friendly semantics through a normal button, and month rows that exclude CR.

- [ ] **Step 4: Add Turkish and English copy**

Add dictionary keys for the date filter, target progress, same-period comparison, and monthly detail dialog.

### Task 4: Style The Accepted Design Without Global Drift

**Files:**
- Modify: `admin-web/src/index.css`

- [ ] **Step 1: Add scoped classes**

Add `store-me-*` classes for the new layout, filter disclosure, score ring, target progress, compact comparison card, modal, and month rows.

- [ ] **Step 2: Keep responsive behavior simple**

Desktop uses the two-column stage; tablet/mobile collapse to one column. Avoid horizontal page scroll; only the month table may scroll inside the dialog if needed.

### Task 5: Verify

**Files:**
- No code changes expected.

- [ ] **Step 1: Run targeted e2e**

```powershell
npm.cmd --prefix admin-web run test:e2e -- store-surfaces.spec.ts -g "store self-performance page renders live score, metrics, and ranks"
```

- [ ] **Step 2: Run frontend lint**

```powershell
npm.cmd --prefix admin-web run lint
```

- [ ] **Step 3: Run frontend build**

```powershell
npm.cmd --prefix admin-web run build
```

- [ ] **Step 4: Browser screenshot smoke**

Open `/store/me`, click `KPI detayları`, and verify the dialog shows month rows without CR.
