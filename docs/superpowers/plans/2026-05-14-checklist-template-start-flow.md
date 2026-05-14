# Checklist Template Start Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Published BM/VM checklist templates created in the admin builder must feed the field checklist start modal and response flow.

**Architecture:** The backend `mobile/checklists/today` payload remains the single read model for field users, but it should only expose the currently effective published version per template code. The frontend store checklist page uses that payload to open a modal, start or continue an instance, render the template items from the published admin template, save item responses, and complete the instance without showing the old inline response surface.

**Tech Stack:** NestJS, PostgreSQL repository SQL, React, TanStack Query, Playwright, Jest.

---

## File Structure

- Modify `backend/nestjs/src/modules/store-ops/infrastructure/checklist.repository.ts`
  - Tighten the published template query used by `getMobileChecklistToday` so duplicate published versions do not create duplicate field cards.
  - Keep company, role template type, effective date, and store scope guards intact.
- Modify `backend/nestjs/src/modules/store-ops/infrastructure/checklist.repository.spec.ts`
  - Add a repository assertion that the template SQL ranks published template versions by code/type and filters to the latest current version.
- Modify `admin-web/src/pages/StoreChecklistsPage.tsx`
  - Replace the inline active-instance response list with a modal-style checklist session.
  - Open the modal from “Checklist yap” for new visits and from the active status for in-progress visits.
  - Render sections/items from `mobileToday.templates.items`.
  - Save score/comment per item and complete the instance from inside the modal.
- Modify `admin-web/src/features/localization/messages/store-checklists.ts`
  - Add localized labels for the modal, section grouping, start/continue actions, save state, cancel confirmation, and empty template guard.
- Modify `admin-web/e2e/checklist-today-surfaces.spec.ts`
  - Update tests to assert the published template items appear in the modal after start/continue.
  - Assert the start request posts the selected `checklistTemplateId` and `storeId`.
  - Assert save/complete calls use the active instance and template item from the admin-published payload.

## Tasks

### Task 1: Backend Published Template Selection

**Files:**
- Modify `backend/nestjs/src/modules/store-ops/infrastructure/checklist.repository.ts`
- Modify `backend/nestjs/src/modules/store-ops/infrastructure/checklist.repository.spec.ts`

- [x] Add a failing repository test that inspects the mobile template SQL and expects a ranked latest-version filter:

```ts
it("returns only the latest currently effective published template version per code", async () => {
  const query = createQueryMock({
    stores: [{ store_id: "store-1", store_name: "Marmara Park" }],
    templates: [
      {
        checklist_template_id: "template-v2",
        template_code: "BM_STORE_VISIT_2026",
        template_type: "BM_STORE_VISIT",
        template_name: "BM Store Visit",
        version_no: 2,
      },
    ],
  });
  const repository = new ChecklistRepository({ query } as never);

  await repository.getMobileChecklistToday({
    actorUserId: "region-user-1",
    assignedStoreIds: ["store-1"],
    readStoreIds: [],
    allowedTemplateTypes: ["BM_STORE_VISIT"],
  });

  const [templateSql] = query.mock.calls[1];
  expect(templateSql).toContain("ROW_NUMBER() OVER");
  expect(templateSql).toContain("PARTITION BY ct.company_id, ct.template_type, ct.template_code");
  expect(templateSql).toContain("ranked_templates.version_rank = 1");
});
```

- [x] Change the template query to use a `WITH ranked_templates AS (...)` CTE that filters `status = 'published'`, current effective dates, role-visible types, and ranks by `version_no DESC, effective_from DESC, checklist_template_id DESC`.

- [x] Run:

```bash
npm.cmd --prefix backend/nestjs test -- checklist.repository.spec.ts --runInBand
```

Expected: PASS.

### Task 2: Store Checklist Modal Session

**Files:**
- Modify `admin-web/src/pages/StoreChecklistsPage.tsx`
- Modify `admin-web/src/features/localization/messages/store-checklists.ts`

- [x] Add local state for a selected checklist session:

```ts
type ChecklistSession = ChecklistCoverageRow
```

- [x] Add a `ChecklistVisitModal` component at the bottom of `StoreChecklistsPage.tsx` that:
  - groups `template.items` by `sectionName`;
  - shows store name, template name, template code/version;
  - shows score/comment fields for each item;
  - starts the checklist if no active instance exists;
  - saves each item against the active instance id;
  - completes only when an active instance id exists;
  - asks for confirmation before closing when the session is in progress.

- [x] Replace the old inline active-instance item table with compact row actions:
  - `Checklist yap` opens the modal for new rows.
  - `Devam et` opens the modal for active rows.
  - row cards keep store/template/month summary visible but do not render every question inline.

- [x] Add localization keys for:
  - modal title/copy;
  - template metadata labels;
  - continue action;
  - close/cancel/confirm copy;
  - empty template warning;
  - save item and complete action copy.

### Task 3: Browser Contract Tests

**Files:**
- Modify `admin-web/e2e/checklist-today-surfaces.spec.ts`

- [x] Update route fixtures to track start, save, and complete payloads.
- [x] Add an e2e assertion that clicking “Checklist yap” opens a modal with the fixture template item text `Vitrin standartlara uygun`.
- [x] Add an e2e assertion that the start request body contains `checklistTemplateId: templateId` and `storeId`.
- [x] Add an e2e assertion that saving a score posts `templateItemId` from the published template item.
- [x] Add an e2e assertion that active visits use “Devam et” and can complete from the modal.

### Task 4: Verification And PR Prep

**Files:**
- All modified files above.

- [x] Run focused backend test:

```bash
npm.cmd --prefix backend/nestjs test -- checklist.repository.spec.ts --runInBand
```

- [x] Run focused frontend e2e:

```bash
npm.cmd --prefix admin-web run test:e2e -- e2e/checklist-today-surfaces.spec.ts
```

- [x] Run frontend release gate:

```bash
npm.cmd --prefix admin-web run check:release
```

- [x] Run root release gate:

```bash
npm.cmd run check:release
```

- [ ] Commit only intended files and push `codex/checklist-template-start-flow`.

## Self-Review

- Spec coverage: admin-published templates already write to `ops.checklist_template`; this plan connects that record to the mobile read model and the store checklist start/session UI.
- Placeholder scan: no placeholder tasks remain.
- Type consistency: `ChecklistCoverageRow`, `MobileChecklistToday`, and mutation input names match current frontend contracts.
