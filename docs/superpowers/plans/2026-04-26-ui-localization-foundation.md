# UI Localization Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Turkish-default, English-switchable localization foundation to `admin-web`.

**Architecture:** Extend the existing i18n utility with storage helpers, add a React provider and compact language toggle, then migrate only the competition read experience to prove the pattern. Keep API identifiers and backend codes untranslated.

**Tech Stack:** React 19, TypeScript, Vite, TanStack Query, Playwright.

---

### Task 1: Add Failing E2E Coverage

**Files:**
- Modify: `admin-web/e2e/store-surfaces.spec.ts`

- [ ] **Step 1: Write the failing test**

Add a Playwright test that opens `/store/competitions`, expects Turkish read-summary labels by default, switches to English through the language toggle, verifies English labels, reloads, and verifies English persists.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm.cmd run test:e2e -- store-surfaces.spec.ts --grep "language toggle localizes competition read labels"`

Expected: FAIL because the language toggle and Turkish labels do not exist yet.

### Task 2: Add Localization Runtime

**Files:**
- Modify: `admin-web/src/lib/i18n.ts`
- Create: `admin-web/src/features/localization/dictionary.ts`
- Create: `admin-web/src/features/localization/LocalizationProvider.tsx`
- Create: `admin-web/src/features/localization/LanguageToggle.tsx`

- [ ] **Step 1: Extend i18n helpers**

Add locale normalization and browser storage helpers around the existing `tr/en` locale types.

- [ ] **Step 2: Add typed dictionary**

Add focused `tr` and `en` labels for shared shell text and competition read labels.

- [ ] **Step 3: Add provider and toggle**

Expose `useLocalization()` and render `TR / EN` as a compact segmented control.

### Task 3: Wire App and Competition Pages

**Files:**
- Modify: `admin-web/src/App.tsx`
- Modify: `admin-web/src/features/competitions/readability.ts`
- Modify: `admin-web/src/pages/StoreCompetitionsPage.tsx`
- Modify: `admin-web/src/pages/CompetitionDashboardPage.tsx`
- Modify: `admin-web/src/index.css`

- [ ] **Step 1: Wrap the app**

Wrap shell rendering in `LocalizationProvider`.

- [ ] **Step 2: Add shell toggle**

Place `LanguageToggle` in admin and store topbar action clusters.

- [ ] **Step 3: Localize competition read labels**

Pass the current locale into readability helpers and replace visible competition read labels with dictionary values.

- [ ] **Step 4: Style the selector**

Use existing button/chip visual language with stable dimensions and accessible focus states.

### Task 4: Verify and Commit

**Files:**
- Modify: `current-state.md`
- Modify: `docs/plans/active-next-actions.md`

- [ ] **Step 1: Run focused E2E**

Run: `npm.cmd run test:e2e -- store-surfaces.spec.ts --grep "language toggle localizes competition read labels"`

Expected: PASS.

- [ ] **Step 2: Run release check**

Run: `npm.cmd run check:release`

Expected: lint, build, Playwright, and production audit pass.

- [ ] **Step 3: Update state docs and commit**

Record the completed localization foundation and the next logical step, then commit with `feat: add ui localization foundation`.
