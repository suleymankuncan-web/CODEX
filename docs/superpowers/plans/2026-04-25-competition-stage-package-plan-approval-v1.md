# Competition Stage Package Plan Approval V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an approval gate so saved competition stage package plans must be submitted and approved before execution.

**Architecture:** Extend the existing plan row lifecycle instead of adding a new approval table. Backend owns transition guards and audit writes; frontend renders status-specific actions in the existing package plan library.

**Tech Stack:** PostgreSQL migrations, NestJS, Jest, React 18, TanStack Query, Vite, Playwright.

---

## File Map

- Create: `db/migrations/024_competition_stage_package_plan_approval.sql`
- Modify: `db/schema.sql`
- Modify: `backend/nestjs/src/modules/store-ops/application/competition.contract.ts`
- Modify: `backend/nestjs/src/modules/store-ops/application/competition.service.ts`
- Modify: `backend/nestjs/src/modules/store-ops/application/competition.service.spec.ts`
- Modify: `backend/nestjs/src/modules/store-ops/infrastructure/competition.repository.ts`
- Modify: `backend/nestjs/src/modules/store-ops/infrastructure/competition.repository.spec.ts`
- Create: `backend/nestjs/src/modules/store-ops/web/dto/review-competition-stage-package-plan.dto.ts`
- Modify: `backend/nestjs/src/modules/store-ops/web/competition.controller.ts`
- Modify: `admin-web/src/features/competitions/api.ts`
- Modify: `admin-web/src/features/competitions/StageBuilderForm.tsx`
- Modify: `admin-web/e2e/competition-surfaces.spec.ts`
- Modify: `current-state.md`

## Task 1: Database Lifecycle Shape

- [ ] Create migration `024_competition_stage_package_plan_approval.sql`.
- [ ] Add review metadata columns:
  - `submitted_by_user_id TEXT`
  - `submitted_at TIMESTAMPTZ`
  - `reviewed_by_user_id TEXT`
  - `reviewed_at TIMESTAMPTZ`
  - `review_note TEXT`
- [ ] Replace plan status check with:
  - `draft`
  - `submitted`
  - `approved`
  - `rejected`
  - `executed`
  - `cancelled`
- [ ] Update `db/schema.sql` to match the migration.

## Task 2: Backend Service Contract

- [ ] Write failing service tests for:
  - `submitStagePackagePlan(...)`
  - `approveStagePackagePlan(...)`
  - `rejectStagePackagePlan(...)`
  - execute delegation still returning `executed`
- [ ] Run `npm.cmd test -- src/modules/store-ops/application/competition.service.spec.ts --runInBand` and verify missing service methods fail.
- [ ] Add contract types:
  - `SubmitCompetitionStagePackagePlanInput`
  - `ApproveCompetitionStagePackagePlanInput`
  - `RejectCompetitionStagePackagePlanInput`
- [ ] Add review metadata fields to `CompetitionStagePackagePlan`.
- [ ] Implement service methods with command responses:
  - submitted
  - approved
  - rejected

## Task 3: Repository Transition Guards

- [ ] Write failing repository tests for:
  - submit changes draft to submitted and writes audit.
  - approve changes submitted to approved and writes audit.
  - reject changes submitted to rejected and writes audit.
  - execute rejects a draft plan.
  - execute accepts an approved plan.
- [ ] Run `npm.cmd test -- src/modules/store-ops/infrastructure/competition.repository.spec.ts --runInBand` and verify missing repository methods or wrong execute guard fail.
- [ ] Implement repository transition methods using `FOR UPDATE`.
- [ ] Change execute guard from `draft` to `approved`.
- [ ] Preserve transaction behavior for stage/team creation.

## Task 4: Controller And DTO

- [ ] Add `ReviewCompetitionStagePackagePlanDto` with optional `reviewNote`.
- [ ] Add endpoints:
  - `POST /api/competitions/stage-package-plans/:planId/submit`
  - `POST /api/competitions/stage-package-plans/:planId/approve`
  - `POST /api/competitions/stage-package-plans/:planId/reject`
- [ ] Keep V1 roles at `SUPER_ADMIN` and `HR_ADMIN`.

## Task 5: Frontend API And UI

- [ ] Write failing Playwright coverage for submit, approve, execute, reject, and hidden unsafe actions.
- [ ] Add frontend API helpers:
  - `submitCompetitionStagePackagePlan`
  - `approveCompetitionStagePackagePlan`
  - `rejectCompetitionStagePackagePlan`
- [ ] Extend status union and plan metadata fields.
- [ ] Render actions by status:
  - Draft: edit/cancel/submit/history.
  - Submitted: approve/reject/history.
  - Approved: execute/history.
  - Rejected/executed/cancelled: history only.
- [ ] Add inline review note input for submitted rows.

## Task 6: Verification And Handoff

- [ ] Run targeted backend tests:

```powershell
cd "C:\Users\suley\OneDrive\Masaüstü\WEBSİTE ÇALIŞMASI\backend\nestjs"
npm.cmd test -- src/modules/store-ops/application/competition.service.spec.ts src/modules/store-ops/infrastructure/competition.repository.spec.ts --runInBand
```

- [ ] Run targeted frontend smoke:

```powershell
cd "C:\Users\suley\OneDrive\Masaüstü\WEBSİTE ÇALIŞMASI\admin-web"
npm.cmd run test:e2e -- e2e/competition-surfaces.spec.ts -g "approval"
```

- [ ] Run backend release check:

```powershell
cd "C:\Users\suley\OneDrive\Masaüstü\WEBSİTE ÇALIŞMASI\backend\nestjs"
npm.cmd run check:release
```

- [ ] Run frontend release check:

```powershell
cd "C:\Users\suley\OneDrive\Masaüstü\WEBSİTE ÇALIŞMASI\admin-web"
npm.cmd run check:release
```

- [ ] Update `current-state.md`.
- [ ] Commit with `feat: add competition package plan approval`.

## Self Review

- Spec coverage: lifecycle statuses, DB shape, API transitions, frontend actions, and execute guard are covered.
- Placeholder scan: no TBD/TODO/later placeholders remain.
- Type consistency: backend and frontend use `StagePackagePlan` and `reviewNote` consistently.
