# Competition Template Clone Update V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow HR/Admin users to revise reusable competition team templates and clone existing templates without breaking historical stage references.

**Architecture:** Keep template lifecycle inside the existing competition module. Updating changes the existing active template row and replaces its current store membership set; cloning creates a new active template with a new code/name from an existing template source. Existing stages keep their `sourceTemplateId` references and continue to read the template id they were created with.

**Tech Stack:** NestJS, PostgreSQL repository pattern, class-validator DTOs, React, TypeScript, TanStack Query, Playwright, Jest.

---

### Task 1: Backend Contract and Service TDD

**Files:**
- Modify: `backend/nestjs/src/modules/store-ops/application/competition.contract.ts`
- Modify: `backend/nestjs/src/modules/store-ops/application/competition.service.ts`
- Test: `backend/nestjs/src/modules/store-ops/application/competition.service.spec.ts`

- [ ] **Step 1: Write failing service tests**

Add tests proving:

```ts
await service.updateTeamTemplate({
  actorUserId,
  templateId,
  templateCode: "MARMARA_A_REV",
  templateName: "Marmara A Revised",
  description: "Rebalanced stores",
  storeIds: [storeOne, storeOne, storeTwo],
});
```

calls `repo.updateTeamTemplate` with duplicate stores removed and returns command status `updated`.

Add a second test proving:

```ts
await service.cloneTeamTemplate({
  actorUserId,
  sourceTemplateId,
  templateCode: "MARMARA_A_COPY",
  templateName: "Marmara A Copy",
  description: "Copy for May",
});
```

calls `repo.cloneTeamTemplate` and returns command status `created`.

- [ ] **Step 2: Run service tests to verify RED**

Run:

```powershell
cd "C:\Users\suley\OneDrive\Masaüstü\WEBSİTE ÇALIŞMASI\backend\nestjs"
npm.cmd test -- src/modules/store-ops/application/competition.service.spec.ts --runInBand
```

Expected: fail because `updateTeamTemplate` and `cloneTeamTemplate` do not exist.

- [ ] **Step 3: Implement service contract**

Add input types:

```ts
export type UpdateCompetitionTeamTemplateInput = {
  actorUserId: string;
  templateId: string;
  templateCode: string;
  templateName: string;
  description?: string;
  storeIds: string[];
};

export type CloneCompetitionTeamTemplateInput = {
  actorUserId: string;
  sourceTemplateId: string;
  templateCode: string;
  templateName: string;
  description?: string;
};
```

Service behavior:
- `updateTeamTemplate` deduplicates `storeIds`, rejects empty store list, calls repository, returns status `updated`.
- `cloneTeamTemplate` calls repository, returns status `created`.

- [ ] **Step 4: Run service tests to verify GREEN**

Expected: service spec passes.

### Task 2: Backend Repository and Controller TDD

**Files:**
- Modify: `backend/nestjs/src/modules/store-ops/infrastructure/competition.repository.ts`
- Create: `backend/nestjs/src/modules/store-ops/web/dto/update-competition-team-template.dto.ts`
- Create: `backend/nestjs/src/modules/store-ops/web/dto/clone-competition-team-template.dto.ts`
- Modify: `backend/nestjs/src/modules/store-ops/web/competition.controller.ts`
- Test: `backend/nestjs/src/modules/store-ops/infrastructure/competition.repository.spec.ts`

- [ ] **Step 1: Write failing repository tests**

Add repository tests proving:
- update issues `UPDATE ops.competition_team_template`, deletes old membership rows, inserts the provided store ids, writes `competition_team_template.updated` audit metadata.
- clone inserts a new template by selecting from the source template stores, writes `competition_team_template.cloned` audit metadata with `sourceTemplateId`.

- [ ] **Step 2: Run repository tests to verify RED**

Run:

```powershell
npm.cmd test -- src/modules/store-ops/infrastructure/competition.repository.spec.ts --runInBand
```

Expected: fail because repository methods do not exist.

- [ ] **Step 3: Implement repository methods**

Implement:
- `updateTeamTemplate(input: UpdateCompetitionTeamTemplateInput)`
- `cloneTeamTemplate(input: CloneCompetitionTeamTemplateInput)`

Both return a mapped `CompetitionTeamTemplate` with `activeOnly: false`.

- [ ] **Step 4: Add DTOs and controller endpoints**

Endpoints:
- `PUT /api/competitions/team-templates/:templateId`
- `POST /api/competitions/team-templates/:templateId/clone`

Both require `SUPER_ADMIN` or `HR_ADMIN`.

- [ ] **Step 5: Run targeted backend tests**

Run:

```powershell
npm.cmd test -- src/modules/store-ops/application/competition.service.spec.ts src/modules/store-ops/infrastructure/competition.repository.spec.ts --runInBand
```

Expected: both specs pass.

### Task 3: Frontend API and UI TDD

**Files:**
- Modify: `admin-web/src/features/competitions/api.ts`
- Modify: `admin-web/src/features/competitions/StageBuilderForm.tsx`
- Test: `admin-web/e2e/competition-surfaces.spec.ts`

- [ ] **Step 1: Write failing Playwright test**

Add a smoke test that:
- opens `Template library`
- clicks `Edit MARMARA_TEMPLATE_A`
- changes template name and store selection
- clicks `Save template`
- verifies `PUT /api/competitions/team-templates/:templateId` payload
- clicks `Clone MARMARA_TEMPLATE_A`
- fills a new code/name
- clicks `Clone template`
- verifies `POST /api/competitions/team-templates/:templateId/clone` payload

- [ ] **Step 2: Run Playwright competition spec to verify RED**

Run:

```powershell
cd "C:\Users\suley\OneDrive\Masaüstü\WEBSİTE ÇALIŞMASI\admin-web"
npx.cmd playwright test e2e/competition-surfaces.spec.ts
```

Expected: fail because edit/clone controls are missing.

- [ ] **Step 3: Implement frontend API and library controls**

Add:
- `updateCompetitionTeamTemplate`
- `cloneCompetitionTeamTemplate`
- edit state inside `TemplateLibrarySection`
- clone state inside `TemplateLibrarySection`
- mutations that invalidate `['competition-team-templates']`

Use existing compact dashboard primitives and avoid adding new layout shells.

- [ ] **Step 4: Run Playwright competition spec to verify GREEN**

Expected: competition e2e spec passes.

### Task 4: Release Gate and Handoff

**Files:**
- Modify: `current-state.md`

- [ ] **Step 1: Run backend release check**

```powershell
cd "C:\Users\suley\OneDrive\Masaüstü\WEBSİTE ÇALIŞMASI\backend\nestjs"
npm.cmd run check:release
```

- [ ] **Step 2: Run frontend release check**

```powershell
cd "C:\Users\suley\OneDrive\Masaüstü\WEBSİTE ÇALIŞMASI\admin-web"
npm.cmd run check:release
```

- [ ] **Step 3: Update current-state**

Record:
- backend endpoints
- audit event names
- UI behavior
- targeted and release check evidence
- next logical step

- [ ] **Step 4: Commit**

Commit backend, frontend, and handoff changes in focused commits.
