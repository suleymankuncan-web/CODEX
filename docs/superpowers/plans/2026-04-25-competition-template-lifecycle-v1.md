# Competition Template Lifecycle V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let HR/Admin inspect active and inactive competition team templates and safely deactivate templates that should no longer be used.

**Architecture:** Keep template lifecycle soft-delete only: `deactivate` sets `is_active = FALSE`, writes audit, and leaves historical `sourceTemplateId` references intact. The template list endpoint accepts `activeOnly`; the stage builder uses active templates for team application while showing a small library surface that can include inactive templates.

**Tech Stack:** NestJS, PostgreSQL SQL repository, class-validator DTO/query DTO, React 19, TanStack Query, Playwright, Jest.

---

### File Structure

- Modify: `backend/nestjs/src/modules/store-ops/application/competition.contract.ts`
  - Add `DeactivateCompetitionTeamTemplateInput`.
- Modify: `backend/nestjs/src/modules/store-ops/application/competition.service.ts`
  - Add `listTeamTemplates({ activeOnly })`.
  - Add `deactivateTeamTemplate`.
- Modify: `backend/nestjs/src/modules/store-ops/infrastructure/competition.repository.ts`
  - Add `deactivateTeamTemplate`.
  - Reuse template row mapper for active/inactive reads.
- Create: `backend/nestjs/src/modules/store-ops/web/dto/list-competition-team-templates.query.ts`
  - Validate optional `activeOnly` boolean.
- Modify: `backend/nestjs/src/modules/store-ops/web/competition.controller.ts`
  - Wire `GET /api/competitions/team-templates?activeOnly=false`.
  - Add `PATCH /api/competitions/team-templates/:templateId/deactivate`.
- Modify: backend Jest specs for service/repository lifecycle coverage.
- Modify: `admin-web/src/features/competitions/api.ts`
  - Add `activeOnly` query support and deactivate helper.
- Modify: `admin-web/src/features/competitions/StageBuilderForm.tsx`
  - Add template library section with status, store count, and deactivate button.
  - Keep stage team select active-only.
- Modify: `admin-web/e2e/competition-surfaces.spec.ts`
  - Add smoke coverage for template deactivation and inactive library visibility.
- Modify: `current-state.md`
  - Record delivery, verification, and next logical step.

### Task 1: Backend RED

- [ ] **Step 1: Service tests**

Add tests proving `listTeamTemplates({ activeOnly: false })` passes the filter to the repository and `deactivateTeamTemplate` returns command status `deactivated`.

- [ ] **Step 2: Repository tests**

Add tests proving the list SQL can skip the active filter and deactivate writes `is_active = FALSE` plus audit metadata.

- [ ] **Step 3: Run RED**

```powershell
npm.cmd test -- src/modules/store-ops/application/competition.service.spec.ts src/modules/store-ops/infrastructure/competition.repository.spec.ts --runInBand
```

Expected: FAIL because lifecycle methods and query DTO are not implemented yet.

### Task 2: Backend GREEN

- [ ] **Step 1: Add service/repository contract**

Add `DeactivateCompetitionTeamTemplateInput` and method signatures.

- [ ] **Step 2: Implement list filter and deactivate**

Use soft delete only. Return the deactivated template with stores.

- [ ] **Step 3: Wire controller**

Restrict both lifecycle actions to `SUPER_ADMIN` and `HR_ADMIN`.

- [ ] **Step 4: Run target tests**

Expected: PASS.

### Task 3: Frontend RED

- [ ] **Step 1: Extend fixture**

Mock active-only and all-template list calls plus deactivate patch call.

- [ ] **Step 2: Add smoke**

Test that the template library shows active and inactive templates when “Show inactive” is enabled, deactivates an active template, and removes it from the team select.

- [ ] **Step 3: Run RED**

```powershell
npm.cmd run build
npx.cmd playwright test e2e/competition-surfaces.spec.ts
```

Expected: FAIL because library lifecycle controls do not exist.

### Task 4: Frontend GREEN

- [ ] **Step 1: Add API helpers**

Add `listCompetitionTeamTemplates({ activeOnly })` and `deactivateCompetitionTeamTemplate`.

- [ ] **Step 2: Add template library section**

Include “Show inactive” toggle, status pill, store count, and deactivate button for active templates.

- [ ] **Step 3: Invalidate template queries**

After deactivation, invalidate active and all template query keys.

- [ ] **Step 4: Run target tests**

Expected: PASS.

### Task 5: Release and Docs

- [ ] **Step 1: Run backend release check**
- [ ] **Step 2: Run frontend release check**
- [ ] **Step 3: Update `current-state.md`**
- [ ] **Step 4: Commit plan, backend, frontend, docs in small chunks**
