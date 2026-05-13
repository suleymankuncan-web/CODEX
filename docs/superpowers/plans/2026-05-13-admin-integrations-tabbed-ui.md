# Admin Integrations Tabbed UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the old long admin integrations surface with a compact tabbed management panel that preserves all current integration behavior.

**Architecture:** Keep the current React Query data sources and mutations in `IntegrationDashboardPage.tsx`, but reorganize the render tree into four tabs: uploads, store scope, evidence, and errors. Add scoped CSS under `integration-management-*` so the page matches the existing admin command palette without affecting other pages.

**Tech Stack:** Vite, React, TypeScript, TanStack Query, Playwright, existing NestJS integration API.

---

### Task 1: Replace The Page Render

**Files:**
- Modify: `admin-web/src/pages/IntegrationDashboardPage.tsx`

- [ ] Preserve existing API calls: import overview, lookups, import template, store master data, store master lookups, retry, sample import, store master update, and Power BI upload.
- [ ] Add tab state with `uploads`, `scope`, `evidence`, and `errors`.
- [ ] Move Power BI upload into `uploads`, with separate personnel and store file controls.
- [ ] Move store master controls into `scope`, renaming visible "Bölge" copy to "Bölge müdürü".
- [ ] Move payload template/sample import/technical JSON into `evidence`.
- [ ] Move needs-action queue and retry controls into `errors`.

### Task 2: Replace Visible Copy

**Files:**
- Modify: `admin-web/src/features/localization/messages/admin-integrations.ts`

- [ ] Remove old visible concepts from the live surface: "Entegrasyon operasyonları", "Aktarım sözleşmesi", "Test veri şablonu", "Geçici Power BI akışı", "İşlem kuyruğu", and "Aksiyon bekleyen partiler".
- [ ] Add Turkish and English copy for the four-tab management model.

### Task 3: Add Scoped Styling

**Files:**
- Modify: `admin-web/src/index.css`

- [ ] Add `integration-management-*` classes using existing admin-command colors: `#f8f5fb`, `#edf7f6`, `#734ce8`, `#3765ea`, `#10a9b7`.
- [ ] Keep responsive behavior consistent with the admin shell.

### Task 4: Update Tests

**Files:**
- Modify: `admin-web/e2e/integration-surfaces.spec.ts`
- Modify if needed: `admin-web/e2e/pilot-smoke.spec.ts`

- [ ] Update page assertions to the new title and tab names.
- [ ] Keep behavioral assertions for store master update, token preservation, Power BI period controls, disabled upload blockers, and locale persistence.

### Task 5: Verify

**Commands:**
- `npm --prefix admin-web run build`
- `npm --prefix admin-web run test:e2e -- integration-surfaces.spec.ts`

- [ ] Fix TypeScript, lint, or Playwright failures until green.
