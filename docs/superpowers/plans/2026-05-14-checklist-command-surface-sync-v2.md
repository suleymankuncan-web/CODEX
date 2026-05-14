# Checklist Command Surface Sync V2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the live store checklist page with the command/ledger surface represented by `outputs/checklist-command-surfaces-v1.html` while preserving the existing API behavior.

**Architecture:** Keep the current React Query API contracts and role gates. Replace the old `panel` / `stacked-row` checklist presentation with checklist-owned command classes, compact rows, filter/sort state, and modal flows that cannot close from backdrop clicks.

**Tech Stack:** Vite, React, TypeScript, React Query, Playwright.

---

### Task 1: Replace Store Checklist Page Structure

**Files:**
- Modify: `admin-web/src/pages/StoreChecklistsPage.tsx`

- [ ] Remove `Link`, `EmptyState`, `KeyValue`, and `StatusPill` usage from the checklist page.
- [ ] Add local checklist-only UI primitives: badge, metric, empty block, fact, score bar.
- [ ] Add filter state for search, month, checklist type, status, and row sorting.
- [ ] Render the visit surface as a compact command ledger with sortable header buttons.
- [ ] Render acknowledgement records as checklist-owned history rows instead of `stacked-row`.
- [ ] Preserve the existing API calls and mutation payloads:
  - `getMobileChecklistToday`
  - `startMobileChecklistInstance`
  - `saveMobileChecklistResponse`
  - `completeMobileChecklistInstance`
  - `getChecklistAcknowledgements`
  - `acknowledgeChecklist`

### Task 2: Rework Checklist Modals

**Files:**
- Modify: `admin-web/src/pages/StoreChecklistsPage.tsx`
- Modify: `admin-web/src/index.css`

- [ ] Keep the visit modal fixed and non-dismissible from backdrop clicks.
- [ ] Show progress, score, answer count, and section grouping inside the visit modal.
- [ ] Keep explicit cancel and complete confirmation behavior.
- [ ] Rebuild the result modal around score summary, low-score rows, sections, and acknowledgement note.

### Task 3: Replace Checklist CSS

**Files:**
- Modify: `admin-web/src/index.css`

- [ ] Replace checklist page styles with command-surface classes that match the existing Plum/Lufian shell palette.
- [ ] Keep rows compact and responsive.
- [ ] Remove page dependency on old checklist `panel`, `stacked-row`, `key-grid`, and `control-button` classes.

### Task 4: Update Focused Tests

**Files:**
- Modify: `admin-web/e2e/checklist-today-surfaces.spec.ts`

- [ ] Change selectors from `.stacked-row` to checklist-owned row classes.
- [ ] Keep existing user-visible acceptance checks for BM, VM, and store manager flows.
- [ ] Add a guard that the checklist surface does not render `.stacked-row`.

### Task 5: Verify

**Commands:**
- `npm.cmd --prefix admin-web run lint`
- `$env:CI='true'; npm.cmd --prefix admin-web run test:e2e -- checklist-today-surfaces.spec.ts`
- `$env:CI='true'; npm.cmd --prefix admin-web run check:release`

Expected: all commands pass.
