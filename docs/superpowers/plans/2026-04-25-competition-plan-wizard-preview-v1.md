# Competition Plan Wizard Preview V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:test-driven-development and superpowers:verification-before-completion. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let HR/Admin users review and edit generated package stages before creating a multi-stage competition package.

**Architecture:** Keep the backend package endpoint unchanged because it already accepts explicit stage drafts and creates them transactionally. Move frontend package generation into editable stage drafts, render a compact preview/editor for each generated stage, then build the final API payload from the edited drafts plus selected active team templates.

**Tech Stack:** React, TypeScript, TanStack Query, Playwright, Vite.

---

### Task 1: Frontend Preview TDD

**Files:**
- Modify: `admin-web/e2e/competition-surfaces.spec.ts`

- [ ] **Step 1: Write failing Playwright test**

Extend the existing `admin can create a league then final stage package from templates` test:
- Select the `league_then_final` package.
- Select two active package team templates.
- Assert generated preview fields are visible:
  - `Package stage 1 code` = `REGION_LEAGUE`
  - `Package stage 2 code` = `FINAL_SHOWDOWN`
- Edit `Package stage 2 name` to `Marmara Final Night`.
- Edit `Package stage 2 starts` to `2026-04-23`.
- Submit the package.
- Assert the POST payload includes the edited second stage name and date while preserving selected template teams.

- [ ] **Step 2: Run frontend targeted test to verify RED**

```powershell
cd "C:\Users\suley\OneDrive\Masaüstü\WEBSİTE ÇALIŞMASI\admin-web"
npm.cmd run build
npx.cmd playwright test e2e/competition-surfaces.spec.ts
```

Expected: fail because package preview fields such as `Package stage 2 name` do not exist yet.

### Task 2: Editable Package Drafts

**Files:**
- Modify: `admin-web/src/features/competitions/stage-packages.ts`

- [ ] **Step 1: Add package stage draft type**

Create `StagePackageStageDraft` with editable string `stageOrder` and the same stage fields as the API payload, excluding teams.

- [ ] **Step 2: Add draft generator**

Add `createStagePackageStageDrafts({ competitionStartsOn, competitionEndsOn, packageCode })`, which uses existing preset definitions and returns editable stage drafts for the package.

- [ ] **Step 3: Change payload builder**

Change `buildStagePackagePayload` to accept:
- `packageCode`
- edited `stageDrafts`
- selected `templates`

The helper converts `stageOrder` to number and attaches teams from the selected templates.

### Task 3: Package Preview UI

**Files:**
- Modify: `admin-web/src/features/competitions/StageBuilderForm.tsx`

- [ ] **Step 1: Store generated stage drafts in state**

Initialize package state with `league_then_final` stage drafts. When package code changes, regenerate stage drafts. Team template selection must not reset edited stage fields.

- [ ] **Step 2: Validate edited stage drafts**

Extend package validation:
- at least two package stages
- valid stage code
- required stage name
- integer stage order >= 1
- valid date range
- no duplicate stage codes

- [ ] **Step 3: Render preview editor**

Inside `StagePackageBuilderSection`, render one compact row per stage with:
- `Package stage N code`
- `Package stage N name`
- `Package stage N order`
- `Package stage N type`
- `Package stage N starts`
- `Package stage N ends`

- [ ] **Step 4: Submit edited payload**

Build the package payload from the edited stage drafts and selected templates, then call the existing `createCompetitionStagePackage` mutation.

- [ ] **Step 5: Run frontend targeted tests to verify GREEN**

Expected: competition Playwright spec passes.

- [ ] **Step 6: Commit frontend**

```powershell
git commit -m "feat: add competition plan preview editor"
```

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

- [ ] **Step 3: Update `current-state.md`**

Record:
- editable plan wizard preview behavior
- unchanged backend transaction guarantee
- targeted and release check evidence
- next logical step

- [ ] **Step 4: Commit handoff**

```powershell
git commit -m "docs: record competition plan preview v1"
```
