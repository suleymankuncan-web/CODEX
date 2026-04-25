# Competition Plan Wizard V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:test-driven-development and superpowers:verification-before-completion. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let HR/Admin users create a common multi-stage competition package, starting with regional league plus final showdown, without creating each stage manually.

**Architecture:** Add a backend `stage-packages` command that accepts a package code and stage drafts, validates the whole package, and creates every stage inside one database transaction. Frontend V1 builds the package from active team templates and the existing stage preset definitions. No new database tables are needed for V1; package intent is preserved in audit metadata.

**Tech Stack:** NestJS, PostgreSQL repository pattern, class-validator DTOs, React, TypeScript, TanStack Query, Playwright, Jest.

---

### Task 1: Backend Package Contract TDD

**Files:**
- Modify: `backend/nestjs/src/modules/store-ops/application/competition.contract.ts`
- Modify: `backend/nestjs/src/modules/store-ops/application/competition.service.spec.ts`
- Modify: `backend/nestjs/src/modules/store-ops/infrastructure/competition.repository.spec.ts`

- [ ] **Step 1: Write failing service test**

Add a test proving `createStagePackage` validates and forwards a `league_then_final` package with two stage drafts.

- [ ] **Step 2: Write failing repository test**

Add a test proving `createStagePackage` creates multiple stages in one transaction and writes a package-level audit event.

- [ ] **Step 3: Run backend targeted tests to verify RED**

```powershell
cd "C:\Users\suley\OneDrive\Masaüstü\WEBSİTE ÇALIŞMASI\backend\nestjs"
npm.cmd test -- src/modules/store-ops/application/competition.service.spec.ts src/modules/store-ops/infrastructure/competition.repository.spec.ts --runInBand
```

Expected: fail because package types, service method, and repository method do not exist.

### Task 2: Backend Package Implementation

**Files:**
- Modify: `backend/nestjs/src/modules/store-ops/application/competition.contract.ts`
- Modify: `backend/nestjs/src/modules/store-ops/application/competition.service.ts`
- Create: `backend/nestjs/src/modules/store-ops/web/dto/create-competition-stage-package.dto.ts`
- Modify: `backend/nestjs/src/modules/store-ops/web/competition.controller.ts`
- Modify: `backend/nestjs/src/modules/store-ops/infrastructure/competition.repository.ts`

- [ ] **Step 1: Add package input types**

Add `CompetitionStagePackageCode = "league_then_final"` and `CreateCompetitionStagePackageInput`.

- [ ] **Step 2: Add shared stage validation**

Use the same date, minimum team, and team store validation for single-stage and package stage creation. Reject duplicate stage codes inside one package.

- [ ] **Step 3: Add DTO and controller endpoint**

Add:

```http
POST /api/competitions/:competitionId/stage-packages
```

Limit it to `SUPER_ADMIN` and `HR_ADMIN`.

- [ ] **Step 4: Refactor repository insert helper**

Keep `createStageWithTeams` behavior intact, but move the actual insert logic into a helper that can run with an existing transaction client.

- [ ] **Step 5: Add transactional package create**

Create all stages in one `withTransaction` call and write `competition_stage_package.created` audit metadata with package code, stage count, and stage codes.

- [ ] **Step 6: Run backend targeted tests to verify GREEN**

Expected: service and repository specs pass.

- [ ] **Step 7: Commit backend**

Commit message:

```powershell
git commit -m "feat: add competition stage package api"
```

### Task 3: Frontend Package Wizard TDD

**Files:**
- Modify: `admin-web/src/features/competitions/api.ts`
- Create: `admin-web/src/features/competitions/stage-packages.ts`
- Modify: `admin-web/src/features/competitions/StageBuilderForm.tsx`
- Modify: `admin-web/e2e/competition-surfaces.spec.ts`

- [ ] **Step 1: Write failing Playwright test**

Add a test that selects two active team templates, creates the `League then final` package, and asserts the API payload contains `region_league` plus `final_showdown` stages.

- [ ] **Step 2: Run frontend targeted test to verify RED**

```powershell
cd "C:\Users\suley\OneDrive\Masaüstü\WEBSİTE ÇALIŞMASI\admin-web"
npm.cmd run build
npx.cmd playwright test e2e/competition-surfaces.spec.ts
```

Expected: fail because the `Stage package` UI is missing.

### Task 4: Frontend Package Wizard Implementation

**Files:**
- Modify: `admin-web/src/features/competitions/api.ts`
- Create: `admin-web/src/features/competitions/stage-packages.ts`
- Modify: `admin-web/src/features/competitions/StageBuilderForm.tsx`

- [ ] **Step 1: Add package API helper**

Add `createCompetitionStagePackage(competitionId, payload)` for `/competitions/:competitionId/stage-packages`.

- [ ] **Step 2: Add package builder helper**

Build `league_then_final` from existing preset drafts:
- `region_league`
- `final_showdown`

Each stage uses the selected active team templates and sends `sourceTemplateId`.

- [ ] **Step 3: Add Stage package UI**

Add a compact HR/Admin section with:
- `Stage package`
- `Package team 1 template`
- `Package team 2 template`
- `Create stage package`

- [ ] **Step 4: Run frontend targeted tests to verify GREEN**

Expected: competition Playwright spec passes.

- [ ] **Step 5: Commit frontend**

Commit message:

```powershell
git commit -m "feat: add competition plan wizard"
```

### Task 5: Release Gate and Handoff

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

- [ ] **Step 3: Update `current-state.md`**

Record:
- plan wizard behavior
- transactional backend guarantee
- audit event
- frontend package UI
- targeted and release check evidence
- next logical step

- [ ] **Step 4: Commit handoff**

Commit message:

```powershell
git commit -m "docs: record competition plan wizard v1"
```
