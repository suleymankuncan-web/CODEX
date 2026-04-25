# Competition Stage Format Presets V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let HR/Admin users apply common stage format presets such as regional league, first-half qualifier, and final showdown while creating competition stages.

**Architecture:** Keep preset definitions lightweight in frontend code for V1 and send `stagePresetCode` with the stage create payload. Backend validates the optional preset code and records it in advancement rule/audit metadata without adding new database tables. Existing manual stage creation remains unchanged when no preset is selected.

**Tech Stack:** NestJS, PostgreSQL repository pattern, class-validator DTOs, React, TypeScript, TanStack Query, Playwright, Jest.

---

### Task 1: Backend Preset Contract

**Files:**
- Modify: `backend/nestjs/src/modules/store-ops/application/competition.contract.ts`
- Modify: `backend/nestjs/src/modules/store-ops/web/dto/create-competition-stage.dto.ts`
- Modify: `backend/nestjs/src/modules/store-ops/application/competition.service.spec.ts`
- Modify: `backend/nestjs/src/modules/store-ops/infrastructure/competition.repository.spec.ts`

- [ ] **Step 1: Write failing service test**

Add a test proving `createStage` accepts `stagePresetCode: "region_league"` and forwards it to `repo.createStageWithTeams`.

- [ ] **Step 2: Write failing repository test**

Add a test proving `createStageWithTeams` writes an advancement rule JSON containing `presetCode: "region_league"` and audit metadata containing `stagePresetCode`.

- [ ] **Step 3: Run backend targeted tests to verify RED**

Run:

```powershell
cd "C:\Users\suley\OneDrive\Masaüstü\WEBSİTE ÇALIŞMASI\backend\nestjs"
npm.cmd test -- src/modules/store-ops/application/competition.service.spec.ts src/modules/store-ops/infrastructure/competition.repository.spec.ts --runInBand
```

Expected: fail because `stagePresetCode` contract and repository rule handling do not exist.

### Task 2: Backend Preset Implementation

**Files:**
- Modify: `backend/nestjs/src/modules/store-ops/application/competition.contract.ts`
- Modify: `backend/nestjs/src/modules/store-ops/web/dto/create-competition-stage.dto.ts`
- Modify: `backend/nestjs/src/modules/store-ops/infrastructure/competition.repository.ts`

- [ ] **Step 1: Add preset type**

Add:

```ts
export type CompetitionStagePresetCode =
  | "region_league"
  | "first_half_qualifier"
  | "final_showdown";
```

Add `stagePresetCode?: CompetitionStagePresetCode` to `CreateCompetitionStageInput`.

- [ ] **Step 2: Add DTO validation**

Add optional `stagePresetCode` with:

```ts
@IsOptional()
@IsIn(["region_league", "first_half_qualifier", "final_showdown"])
stagePresetCode?: "region_league" | "first_half_qualifier" | "final_showdown";
```

- [ ] **Step 3: Add repository advancement rule helper**

Use:

```ts
function buildAdvancementRule(stagePresetCode?: string) {
  if (stagePresetCode === "region_league") {
    return { type: "rank_all", presetCode: stagePresetCode };
  }

  if (stagePresetCode) {
    return { type: "top_n", count: 1, presetCode: stagePresetCode };
  }

  return { type: "top_n", count: 1 };
}
```

Use this helper when inserting `advancement_rule_json` and include `stagePresetCode: input.stagePresetCode ?? null` in audit metadata.

- [ ] **Step 4: Run backend targeted tests to verify GREEN**

Expected: service and repository specs pass.

- [ ] **Step 5: Commit backend**

Commit message:

```powershell
git commit -m "feat: add competition stage preset contract"
```

### Task 3: Frontend Preset Selector TDD

**Files:**
- Modify: `admin-web/src/features/competitions/api.ts`
- Create: `admin-web/src/features/competitions/stage-presets.ts`
- Modify: `admin-web/src/features/competitions/StageBuilderForm.tsx`
- Modify: `admin-web/e2e/competition-surfaces.spec.ts`

- [ ] **Step 1: Write failing Playwright test**

Add a test that:
- selects `Regional league` from `Stage preset`
- sees `Stage code = REGION_LEAGUE`
- sees `Stage name = Regional League`
- sees `Stage type = league`
- creates the stage
- asserts payload includes `stagePresetCode: "region_league"`

- [ ] **Step 2: Run Playwright competition spec to verify RED**

Run:

```powershell
cd "C:\Users\suley\OneDrive\Masaüstü\WEBSİTE ÇALIŞMASI\admin-web"
npm.cmd run build
npx.cmd playwright test e2e/competition-surfaces.spec.ts
```

Expected: fail because `Stage preset` control is missing.

### Task 4: Frontend Preset Implementation

**Files:**
- Modify: `admin-web/src/features/competitions/api.ts`
- Create: `admin-web/src/features/competitions/stage-presets.ts`
- Modify: `admin-web/src/features/competitions/StageBuilderForm.tsx`

- [ ] **Step 1: Add frontend preset definitions**

Create `stage-presets.ts` with:
- `region_league`: full competition date range, stage type `league`, code `REGION_LEAGUE`, name `Regional League`, order `1`.
- `first_half_qualifier`: first half date range, stage type `qualifier`, code `FIRST_HALF_QUALIFIER`, name `First Half Qualifier`, order `1`.
- `final_showdown`: second half/final date range, stage type `final`, code `FINAL_SHOWDOWN`, name `Final Showdown`, order `2`.

- [ ] **Step 2: Add API payload field**

Add `stagePresetCode?: StagePresetCode` to `CreateCompetitionStagePayload`.

- [ ] **Step 3: Add Stage preset select**

Add a `Stage preset` select above stage fields. Selecting a preset updates stage code, name, order, type, and date range while preserving team drafts.

- [ ] **Step 4: Include preset in payload**

When `draft.stagePresetCode` exists, send it as `stagePresetCode`.

- [ ] **Step 5: Run frontend targeted tests to verify GREEN**

Expected: competition Playwright spec passes.

- [ ] **Step 6: Commit frontend**

Commit message:

```powershell
git commit -m "feat: add competition stage preset selector"
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
- preset codes
- backend audit behavior
- frontend selector behavior
- targeted and release check evidence
- next logical step

- [ ] **Step 4: Commit handoff**

Commit message:

```powershell
git commit -m "docs: record competition stage preset v1"
```
