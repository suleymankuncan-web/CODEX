# Competition Stage Package Plan Drafts V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** IK/Admin kullanicisi `league_then_final` stage package kurgusunu hemen stage yaratmadan kaydedilebilir taslak olarak tutabilsin ve toplantidan sonra ayni taslagi tek komutla execute edebilsin.

**Architecture:** V1, stage package draftlarini ayri bir DB tablosunda saklar; save islemi stage yaratmaz. Execute islemi mevcut transaction guvenceli stage package insert helper'ini kullanarak draft icindeki stage'leri yaratir, drafti `executed` durumuna alir ve tekrar execute edilmesini engeller.

**Tech Stack:** NestJS, PostgreSQL SQL migrations, Jest, React 18, TanStack Query, Vite, Playwright.

---

## File Map

- Create: `db/migrations/023_competition_stage_package_plans.sql`
- Modify: `db/schema.sql`
- Modify: `backend/nestjs/src/modules/store-ops/application/competition.contract.ts`
- Modify: `backend/nestjs/src/modules/store-ops/application/competition.service.ts`
- Modify: `backend/nestjs/src/modules/store-ops/application/competition.service.spec.ts`
- Modify: `backend/nestjs/src/modules/store-ops/infrastructure/competition.repository.ts`
- Modify: `backend/nestjs/src/modules/store-ops/infrastructure/competition.repository.spec.ts`
- Create: `backend/nestjs/src/modules/store-ops/web/dto/create-competition-stage-package-plan.dto.ts`
- Modify: `backend/nestjs/src/modules/store-ops/web/competition.controller.ts`
- Modify: `admin-web/src/features/competitions/api.ts`
- Modify: `admin-web/src/features/competitions/StageBuilderForm.tsx`
- Modify: `admin-web/e2e/competition-surfaces.spec.ts`
- Modify: `current-state.md`

## Task 1: Backend Contract And Service Tests

**Files:**
- Modify: `backend/nestjs/src/modules/store-ops/application/competition.contract.ts`
- Modify: `backend/nestjs/src/modules/store-ops/application/competition.service.spec.ts`

- [ ] **Step 1: Write the failing service tests**

Add tests that call `service.createStagePackagePlan(...)`, `service.listStagePackagePlans(...)`, and `service.executeStagePackagePlan(...)`. The first expected failure is TypeScript compile failure because the service methods and repository mock methods do not exist yet.

Expected new assertions:

```ts
await expect(
  service.createStagePackagePlan({
    actorUserId: "hr-1",
    competitionId: "competition-1",
    packageCode: "league_then_final",
    planName: "April regional package",
    stages: validPackageStages,
  }),
).resolves.toEqual({
  status: "created",
  message: "Competition stage package plan saved",
  data: expect.objectContaining({ planName: "April regional package", planStatus: "draft" }),
});
```

```ts
await expect(
  service.executeStagePackagePlan({ actorUserId: "hr-1", planId: "plan-1" }),
).resolves.toEqual({
  status: "executed",
  message: "Competition stage package plan executed",
  data: expect.objectContaining({ planStatus: "executed", createdStageIds: ["stage-1", "stage-2"] }),
});
```

- [ ] **Step 2: Verify RED**

Run:

```powershell
cd "C:\Users\suley\OneDrive\Masaüstü\WEBSİTE ÇALIŞMASI\backend\nestjs"
npm.cmd test -- src/modules/store-ops/application/competition.service.spec.ts --runInBand
```

Expected: FAIL with missing service/repository methods or missing contract types.

- [ ] **Step 3: Add contract types and service pass-through methods**

Add `CompetitionStagePackagePlanStatus`, `CompetitionStagePackagePlan`, `CreateCompetitionStagePackagePlanInput`, and `ExecuteCompetitionStagePackagePlanInput`. Implement service validation by reusing existing stage package validation before save, and execute through repository.

- [ ] **Step 4: Verify GREEN**

Run the same targeted service spec. Expected: PASS.

## Task 2: Backend Persistence And API

**Files:**
- Create: `db/migrations/023_competition_stage_package_plans.sql`
- Modify: `db/schema.sql`
- Modify: `backend/nestjs/src/modules/store-ops/infrastructure/competition.repository.spec.ts`
- Modify: `backend/nestjs/src/modules/store-ops/infrastructure/competition.repository.ts`
- Create: `backend/nestjs/src/modules/store-ops/web/dto/create-competition-stage-package-plan.dto.ts`
- Modify: `backend/nestjs/src/modules/store-ops/web/competition.controller.ts`

- [ ] **Step 1: Write failing repository tests**

Add one test for saving a draft and one test for executing a draft. Expected first failure: repository methods do not exist.

Save test should verify:

```ts
expect(sql).toContain("ops.competition_stage_package_plan");
expect(params).toContain("competition_stage_package_plan.saved");
expect(result.planStatus).toBe("draft");
```

Execute test should verify:

```ts
expect(databaseService.withTransaction).toHaveBeenCalledTimes(1);
expect(result.plan.planStatus).toBe("executed");
expect(result.stages).toHaveLength(2);
expect(params).toContain("competition_stage_package_plan.executed");
```

- [ ] **Step 2: Verify RED**

Run:

```powershell
cd "C:\Users\suley\OneDrive\Masaüstü\WEBSİTE ÇALIŞMASI\backend\nestjs"
npm.cmd test -- src/modules/store-ops/infrastructure/competition.repository.spec.ts --runInBand
```

Expected: FAIL with missing repository methods.

- [ ] **Step 3: Add DB table**

Create `ops.competition_stage_package_plan` with `competition_id`, `package_code`, `plan_name`, `plan_status`, `stage_drafts_json`, creator/updater/execution metadata, `created_stage_ids`, and timestamps. Add the same table definition to `db/schema.sql`.

- [ ] **Step 4: Implement repository methods**

Implement:

```ts
listStagePackagePlans({ competitionId }: { competitionId: string }): Promise<CompetitionStagePackagePlan[]>
createStagePackagePlan(input: CreateCompetitionStagePackagePlanInput): Promise<CompetitionStagePackagePlan>
executeStagePackagePlan(input: ExecuteCompetitionStagePackagePlanInput): Promise<{ plan: CompetitionStagePackagePlan; stages: CompetitionStage[] }>
```

Execution must lock the plan row with `FOR UPDATE`, reject non-draft plans, create all stages in the same transaction, update the plan with `plan_status = 'executed'`, and write audit.

- [ ] **Step 5: Add controller endpoints**

Add:

```text
GET /api/competitions/:competitionId/stage-package-plans
POST /api/competitions/:competitionId/stage-package-plans
POST /api/competitions/stage-package-plans/:planId/execute
```

Use `SUPER_ADMIN` and `HR_ADMIN` only.

- [ ] **Step 6: Verify backend targeted tests**

Run:

```powershell
cd "C:\Users\suley\OneDrive\Masaüstü\WEBSİTE ÇALIŞMASI\backend\nestjs"
npm.cmd test -- src/modules/store-ops/application/competition.service.spec.ts src/modules/store-ops/infrastructure/competition.repository.spec.ts --runInBand
```

Expected: PASS.

## Task 3: Frontend API And Stage Builder Draft UI

**Files:**
- Modify: `admin-web/src/features/competitions/api.ts`
- Modify: `admin-web/src/features/competitions/StageBuilderForm.tsx`
- Modify: `admin-web/e2e/competition-surfaces.spec.ts`

- [ ] **Step 1: Write failing Playwright test**

Extend the admin competition smoke test to mock:

```text
GET /api/competitions/:competitionId/stage-package-plans
POST /api/competitions/:competitionId/stage-package-plans
POST /api/competitions/stage-package-plans/:planId/execute
```

The test fills a package plan name, saves the package plan, sees it in the library, executes it, and verifies the API payload/plan id.

- [ ] **Step 2: Verify RED**

Run:

```powershell
cd "C:\Users\suley\OneDrive\Masaüstü\WEBSİTE ÇALIŞMASI\admin-web"
npm.cmd run build; npx.cmd playwright test e2e/competition-surfaces.spec.ts
```

Expected: FAIL because the plan name input/library/execute controls do not exist yet.

- [ ] **Step 3: Add frontend API helpers**

Add `CompetitionStagePackagePlan`, `createCompetitionStagePackagePlan`, `listCompetitionStagePackagePlans`, and `executeCompetitionStagePackagePlan` to `admin-web/src/features/competitions/api.ts`.

- [ ] **Step 4: Add Stage Builder UI**

Inside `StagePackageBuilderSection`, add:

- `Package plan name` input.
- `Save package plan` button that calls the draft API and does not create stages.
- `Package plan library` area that lists saved draft/executed plans.
- `Execute <plan name>` button for draft plans.
- Query invalidation for `competition-stage-package-plans`, competition list, and competition detail.

- [ ] **Step 5: Verify frontend targeted tests**

Run the same build and Playwright command. Expected: PASS.

## Task 4: Release Verification And Handoff

**Files:**
- Modify: `current-state.md`

- [ ] **Step 1: Run backend release check**

```powershell
cd "C:\Users\suley\OneDrive\Masaüstü\WEBSİTE ÇALIŞMASI\backend\nestjs"
npm.cmd run check:release
```

Expected: lint, Jest, build, and `npm audit --omit=dev` all pass.

- [ ] **Step 2: Run frontend release check**

```powershell
cd "C:\Users\suley\OneDrive\Masaüstü\WEBSİTE ÇALIŞMASI\admin-web"
npm.cmd run check:release
```

Expected: lint, build, Playwright, and `npm audit --omit=dev` all pass.

- [ ] **Step 3: Update `current-state.md`**

Append a section named `Son Competition Stage Package Plan Drafts V1` with changed behavior, tests, and the next logical step.

- [ ] **Step 4: Commit**

```powershell
cd "C:\Users\suley\OneDrive\Masaüstü\WEBSİTE ÇALIŞMASI"
git add docs/superpowers/plans/2026-04-25-competition-stage-package-plan-drafts-v1.md db/migrations/023_competition_stage_package_plans.sql db/schema.sql backend/nestjs/src/modules/store-ops admin-web/src/features/competitions admin-web/e2e/competition-surfaces.spec.ts current-state.md
git commit -m "feat: add competition package plan drafts"
```

## Self Review

- Spec coverage: Save draft, list draft, execute draft, no duplicate execution, audit, frontend workflow, and release checks are all covered.
- Placeholder scan: No TBD/TODO/later language remains in the executable tasks.
- Type consistency: Plan uses `stage package plan`, `planStatus`, `stageDrafts`, and existing `league_then_final` package code consistently.
