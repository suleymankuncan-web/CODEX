# Checklist Result Acknowledgement Detail Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Completed BM/VM checklist results should open as a compact detail modal, show scored items and low-score signals, and let only authorized store managers acknowledge the result from that detail view.

**Architecture:** Keep `/checklists/acknowledgements/list` as the single read model for acknowledgement/result inboxes, but enrich each item with template type and response details. The backend remains the source of role filtering: store managers and region managers read BM+VM results for their assigned stores, visual merchandisers read VM results only, and only store managers/super admins can acknowledge assigned-store results. The frontend removes inline acknowledgement controls from cards and moves reading plus acknowledgement into a focused modal.

**Tech Stack:** NestJS, PostgreSQL repository SQL, React, TanStack Query, Playwright, Jest.

---

## File Structure

- Modify `backend/nestjs/src/modules/store-ops/infrastructure/checklist-acknowledgement.repository.ts`
  - Add `template_type`, `completed_by_user_id`, and aggregated response item details to the acknowledgement list query.
  - Add optional `allowedTemplateTypes` filtering so VM cannot see BM checklist results.
- Modify `backend/nestjs/src/modules/store-ops/infrastructure/checklist-acknowledgement.repository.spec.ts`
  - Assert the list query joins template items/responses and applies template-type filters when provided.
- Modify `backend/nestjs/src/modules/store-ops/application/checklist.service.ts`
  - Resolve readable checklist result template types by role.
  - Keep acknowledgement mutation limited to assigned action stores.
- Modify `backend/nestjs/src/modules/store-ops/application/checklist.service.spec.ts`
  - Update acknowledgement list scope expectations and add role-filter assertions for store manager, region manager, and visual merchandiser.
- Modify `backend/nestjs/src/modules/store-ops/web/checklist.controller.ts`
  - Allow region manager and visual merchandiser roles to read checklist result lists.
- Modify `admin-web/src/features/checklists/api.ts`
  - Add response detail types to `ChecklistAcknowledgementItem`.
- Modify `admin-web/src/features/auth/authorization.ts`
  - Split result reading from acknowledgement mutation roles.
- Modify `admin-web/src/pages/StoreChecklistsPage.tsx`
  - Add selected result modal state.
  - Replace inline acknowledgement textareas/buttons with compact rows and a detail modal.
  - Show section summaries, low-score rows, response notes, acknowledgement note, and read-only messaging.
- Modify `admin-web/src/features/localization/messages/store-checklists.ts`
  - Add localized labels for result detail, low-score summary, section result rows, and acknowledgement action.
- Modify `admin-web/src/index.css`
  - Add compact result-modal and response-table styling using the existing light command UI palette.
- Modify `admin-web/e2e/checklist-today-surfaces.spec.ts`
  - Cover store manager acknowledgement from modal, region manager read-only BM+VM result visibility, and VM-only result filtering.

## Tasks

### Task 1: Backend Result Read Model

**Files:**
- Modify `backend/nestjs/src/modules/store-ops/infrastructure/checklist-acknowledgement.repository.ts`
- Modify `backend/nestjs/src/modules/store-ops/infrastructure/checklist-acknowledgement.repository.spec.ts`

- [x] Add repository tests that call `listChecklistAcknowledgements` with `allowedTemplateTypes: ["VM_STORE_VISIT"]` and assert the SQL contains `ct.template_type = ANY`.
- [x] Update the acknowledgement list SQL to select `ct.template_type`, `ci.completed_by_user_id`, and `responses_json` via `jsonb_agg` from `ops.checklist_template_item` plus `ops.checklist_response`.
- [x] Map `responses_json` to `responses` with numeric `weight`, `maxScore`, and nullable `scoreValue`.
- [x] Run `npm.cmd --prefix backend/nestjs test -- checklist-acknowledgement.repository.spec.ts --runInBand`.

### Task 2: Backend Role Rules

**Files:**
- Modify `backend/nestjs/src/modules/store-ops/application/checklist.service.ts`
- Modify `backend/nestjs/src/modules/store-ops/application/checklist.service.spec.ts`
- Modify `backend/nestjs/src/modules/store-ops/web/checklist.controller.ts`

- [x] Add a private service helper that resolves acknowledgement result template types:
  - `SUPER_ADMIN` and `REPORT_VIEWER`: no template type restriction.
  - `STORE_MANAGER` and `REGION_MANAGER`: `["BM_STORE_VISIT", "VM_STORE_VISIT"]`.
  - `VISUAL_MERCHANDISER`: `["VM_STORE_VISIT"]`.
  - other roles: empty list.
- [x] Pass `allowedTemplateTypes` to the repository.
- [x] Add controller read roles `REGION_MANAGER` and `VISUAL_MERCHANDISER` to `acknowledgements/list`.
- [x] Keep `acknowledgeChecklist` write roles unchanged.
- [x] Run `npm.cmd --prefix backend/nestjs test -- checklist.service.spec.ts --runInBand`.

### Task 3: Frontend Result Detail Modal

**Files:**
- Modify `admin-web/src/features/checklists/api.ts`
- Modify `admin-web/src/features/auth/authorization.ts`
- Modify `admin-web/src/pages/StoreChecklistsPage.tsx`
- Modify `admin-web/src/features/localization/messages/store-checklists.ts`
- Modify `admin-web/src/index.css`

- [x] Add `responses` and `templateType` to `ChecklistAcknowledgementItem`.
- [x] Add `canReadChecklistResults` for `STORE_MANAGER`, `SUPER_ADMIN`, `REPORT_VIEWER`, `REGION_MANAGER`, and `VISUAL_MERCHANDISER`.
- [x] Use `canReadChecklistResults` for fetching checklist results; keep `canAcknowledgeChecklist` only for store-manager/super-admin mutation.
- [x] Add `selectedResultId` and derive `selectedResult`.
- [x] Replace inline card acknowledgement controls with `Detayi gor` / `View details`.
- [x] Create `ChecklistResultModal` that shows:
  - store, template, category/type, completed time, score and compliance;
  - low-score count based on `scoreValue / maxScore < 0.7`;
  - section summaries with average percentage;
  - all response items with score/max, comment, and low-score styling;
  - acknowledgement note and action only when `canAcknowledgeChecklist` is true.
- [x] Run `npm.cmd --prefix admin-web run lint`.

### Task 4: Browser Contract Coverage

**Files:**
- Modify `admin-web/e2e/checklist-today-surfaces.spec.ts`

- [x] Add fixture responses for two sections, one low score, and one note.
- [x] Update store-manager test to open the detail modal, assert low-score and note copy, submit acknowledgement, and assert the acknowledgement request body.
- [x] Add a region-manager read-only result test that can open BM/VM result details but does not see the acknowledgement textarea/button.
- [x] Add a visual-merchandiser result test that sees VM results and not BM results.
- [x] Run `npm.cmd --prefix admin-web run test:e2e -- e2e/checklist-today-surfaces.spec.ts`.

### Task 5: Release Gates And PR

**Files:**
- All modified files above.

- [x] Run `npm.cmd --prefix backend/nestjs test -- checklist-acknowledgement.repository.spec.ts checklist.service.spec.ts --runInBand`.
- [x] Run `npm.cmd --prefix admin-web run check:release`.
- [x] Run `npm.cmd --prefix backend/nestjs run check:release`.
- [x] Run `npm.cmd run check:release`.
- [ ] Commit only intended files, push `codex/checklist-result-ack-detail-v1`, and create a PR.

## Self-Review

- Spec coverage: store manager acknowledgement, BM read-only result visibility, VM-only result visibility, and compact modal detail are all represented.
- Placeholder scan: no placeholder steps remain.
- Type consistency: backend `responses` maps to frontend `ChecklistAcknowledgementItem.responses`; `allowedTemplateTypes` is optional so workflow inbox callers remain compatible.
