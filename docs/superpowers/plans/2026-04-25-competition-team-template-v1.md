# Competition Team Template V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let HR/Admin create reusable competition team templates and apply them while building a competition stage.

**Architecture:** The existing database already has `ops.competition_team_template` and `ops.competition_team_template_store`, and stage creation already accepts `sourceTemplateId`. V1 adds backend list/create endpoints plus a frontend template creation/apply surface inside the existing competition admin flow; update/delete/deactivate stays out of scope until we need template lifecycle management.

**Tech Stack:** NestJS, PostgreSQL SQL repository, class-validator DTOs, React 19, TypeScript, TanStack Query, Playwright, Jest.

---

### File Structure

- Modify: `backend/nestjs/src/modules/store-ops/application/competition.contract.ts`
  - Add `CompetitionTeamTemplate`, `CreateCompetitionTeamTemplateInput`.
- Modify: `backend/nestjs/src/modules/store-ops/application/competition.service.ts`
  - Add `listTeamTemplates` and `createTeamTemplate`.
  - Validate non-empty store assignments.
- Modify: `backend/nestjs/src/modules/store-ops/infrastructure/competition.repository.ts`
  - Add SQL read/write methods for template header and stores.
  - Map store membership for each template.
- Create: `backend/nestjs/src/modules/store-ops/web/dto/create-competition-team-template.dto.ts`
  - Validate template code/name/description/store IDs.
- Modify: `backend/nestjs/src/modules/store-ops/web/competition.controller.ts`
  - Add `GET /api/competitions/team-templates`.
  - Add `POST /api/competitions/team-templates`.
- Modify: `backend/nestjs/src/modules/store-ops/application/competition.service.spec.ts`
  - Cover list/create delegation and no-store validation.
- Modify: `backend/nestjs/src/modules/store-ops/infrastructure/competition.repository.spec.ts`
  - Cover SQL for template list and create.
- Modify: `admin-web/src/features/competitions/api.ts`
  - Add template types and API helpers.
- Modify: `admin-web/src/features/competitions/StageBuilderForm.tsx`
  - Fetch templates.
  - Add a small template creation form.
  - Add per-team “Apply template” select that fills team code/name/store IDs/sourceTemplateId.
- Modify: `admin-web/e2e/competition-surfaces.spec.ts`
  - Extend competition smoke for template creation and applying template into stage payload.
- Modify: `current-state.md`
  - Record delivery and next logical step.

### Task 1: Backend RED Tests

- [ ] **Step 1: Add service tests**

Add tests that expect:

- `listTeamTemplates` returns a list response from repository rows.
- `createTeamTemplate` rejects empty `storeIds`.
- `createTeamTemplate` returns command status `created` and passes `actorUserId`.

- [ ] **Step 2: Add repository tests**

Add tests that expect:

- `listTeamTemplates` queries `ops.competition_team_template` and `ops.competition_team_template_store`.
- `createTeamTemplate` inserts into both template tables and writes audit metadata.

- [ ] **Step 3: Run RED**

Run:

```powershell
npm.cmd test -- src/modules/store-ops/application/competition.service.spec.ts src/modules/store-ops/infrastructure/competition.repository.spec.ts --runInBand
```

Expected: FAIL because service/repository methods do not exist yet.

### Task 2: Backend GREEN

- [ ] **Step 1: Add contract types**

Add `CompetitionTeamTemplate` with `templateId`, `templateCode`, `templateName`, `description`, `isActive`, `stores`.

- [ ] **Step 2: Add service methods**

Use `buildListResponse` for list and `buildCommandResponse` for create.

- [ ] **Step 3: Add repository methods**

List active templates ordered by `template_code`, and aggregate stores with a left join so empty templates can still be represented if created manually.

- [ ] **Step 4: Add controller endpoints and DTO**

Both endpoints are restricted to `SUPER_ADMIN` and `HR_ADMIN`.

- [ ] **Step 5: Run backend target tests**

Run:

```powershell
npm.cmd test -- src/modules/store-ops/application/competition.service.spec.ts src/modules/store-ops/infrastructure/competition.repository.spec.ts --runInBand
```

Expected: PASS.

### Task 3: Frontend RED Test

- [ ] **Step 1: Extend Playwright fixture**

Mock `GET /api/competitions/team-templates` and `POST /api/competitions/team-templates`.

- [ ] **Step 2: Add user flow**

The test creates a template with one store, applies it to Team 1, fills Team 2 manually, creates the stage, and asserts Team 1 includes `sourceTemplateId` and the template store ID.

- [ ] **Step 3: Run RED**

Run:

```powershell
npm.cmd run build
npx.cmd playwright test e2e/competition-surfaces.spec.ts
```

Expected: FAIL because the frontend template controls do not exist yet.

### Task 4: Frontend GREEN

- [ ] **Step 1: Add API helpers**

Add `listCompetitionTeamTemplates` and `createCompetitionTeamTemplate`.

- [ ] **Step 2: Extend stage builder state**

Add optional `sourceTemplateId` on team drafts.

- [ ] **Step 3: Add template creation form**

Use the same store checkbox list. Button disabled until code/name/store selection is valid.

- [ ] **Step 4: Add per-team apply select**

Selecting a template fills team code/name/store IDs and source template.

- [ ] **Step 5: Run frontend target tests**

Run:

```powershell
npm.cmd run build
npx.cmd playwright test e2e/competition-surfaces.spec.ts
```

Expected: PASS.

### Task 5: Release and Docs

- [ ] **Step 1: Run backend release check**

```powershell
npm.cmd run check:release
```

- [ ] **Step 2: Run frontend release check**

```powershell
npm.cmd run check:release
```

- [ ] **Step 3: Update `current-state.md`**

Record the template V1 behavior, test evidence, and next logical step.

- [ ] **Step 4: Commit in small chunks**

Commit the plan, backend, frontend, and state docs separately.
