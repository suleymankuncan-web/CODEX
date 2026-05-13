# Admin Checklist Builder V3 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the placeholder admin checklist page with the V3 section-based checklist template builder and wire it to the existing create/publish backend commands.

**Architecture:** Keep the slice focused on the existing `/admin/checklists` route. The frontend owns draft editing state with section cards and item rows, then maps the draft to the existing `POST /admin/checklist-templates` and `POST /admin/checklist-templates/:id/publish` API shape. Current backend has no list/update endpoint, so this slice does not fake historical template management.

**Tech Stack:** React 19, Vite, TypeScript, TanStack Query mutations, existing NestJS checklist-template commands.

---

### Task 1: API Client Contract

**Files:**
- Modify: `admin-web/src/features/checklists/api.ts`

- [ ] Add `ChecklistTemplateResponseType`, template item payload, create payload, publish payload, and command response types.
- [ ] Add `createAdminChecklistTemplate(input)` using `sendJson('/admin/checklist-templates', { method: 'POST', body: input })`.
- [ ] Add `publishAdminChecklistTemplate(input)` using `sendJson('/admin/checklist-templates/:id/publish', { method: 'POST', body: { effectiveFrom, effectiveTo } })`.

### Task 2: Admin Page Replacement

**Files:**
- Modify: `admin-web/src/app/admin-shell.tsx`
- Replace: `admin-web/src/pages/AdminChecklistTemplatesPage.tsx`

- [ ] Pass `authSummary` into `AdminChecklistTemplatesPage`.
- [ ] Remove old hero/metric/empty-state placeholder content from `AdminChecklistTemplatesPage.tsx`.
- [ ] Implement V3 draft state: template metadata, sections, items, section add, item add, item remove, and item updates.
- [ ] Resolve `companyId` from `authSummary.user.readScope.companyIds[0]` or `authSummary.user.scope.companyIds[0]`.
- [ ] Disable save/publish when company scope is missing or total weight is not 100.
- [ ] On draft save, call create API and keep returned `checklistTemplateId`.
- [ ] On publish, create a draft first when needed, then publish the returned/current draft id.

### Task 3: Styling

**Files:**
- Modify: `admin-web/src/index.css`

- [ ] Add scoped `.admin-checklist-builder-*` classes for the V3 page.
- [ ] Use existing app variables for color, border, radius, focus rings, and responsive behavior.
- [ ] Preserve the existing admin sidebar; do not implement a page-local sidebar.

### Task 4: Verification

**Commands:**
- `npm --prefix admin-web run lint`
- `npm --prefix admin-web run build`

- [ ] Fix TypeScript/lint issues caused by the slice.
- [ ] Leave unrelated dirty files untouched.
