# Competition Stage Package Plan Lifecycle V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add controlled edit, cancel, and audit history actions for saved competition stage package plans.

**Architecture:** The feature extends the existing DB-backed stage package plan model without adding new tables. Backend update/cancel methods mutate only `draft` plans and write audit events; the audit endpoint reads existing `audit.event_log` rows. Frontend expands the existing plan library with inline draft editing, cancel, and history display.

**Tech Stack:** NestJS, PostgreSQL, Jest, React 18, TanStack Query, Vite, Playwright.

---

## File Map

- Modify: `backend/nestjs/src/modules/store-ops/application/competition.contract.ts`
- Modify: `backend/nestjs/src/modules/store-ops/application/competition.service.ts`
- Modify: `backend/nestjs/src/modules/store-ops/application/competition.service.spec.ts`
- Modify: `backend/nestjs/src/modules/store-ops/infrastructure/competition.repository.ts`
- Modify: `backend/nestjs/src/modules/store-ops/infrastructure/competition.repository.spec.ts`
- Create: `backend/nestjs/src/modules/store-ops/web/dto/update-competition-stage-package-plan.dto.ts`
- Modify: `backend/nestjs/src/modules/store-ops/web/competition.controller.ts`
- Modify: `admin-web/src/features/competitions/api.ts`
- Modify: `admin-web/src/features/competitions/StageBuilderForm.tsx`
- Modify: `admin-web/e2e/competition-surfaces.spec.ts`
- Modify: `current-state.md`

## Task 1: Backend Contract And Service Tests

- [ ] Write failing service tests for:
  - `updateStagePackagePlan(...)`
  - `cancelStagePackagePlan(...)`
  - `listStagePackagePlanAudit(...)`
- [ ] Run `npm.cmd test -- src/modules/store-ops/application/competition.service.spec.ts --runInBand` and verify TypeScript fails because service methods do not exist.
- [ ] Add contract types:
  - `UpdateCompetitionStagePackagePlanInput`
  - `CancelCompetitionStagePackagePlanInput`
  - `CompetitionStagePackagePlanAuditEvent`
- [ ] Implement service methods:
  - Update validates stage package draft payload before repository call.
  - Cancel delegates to repository.
  - Audit returns `buildListResponse`.
- [ ] Re-run targeted service spec and verify it passes.

## Task 2: Repository Persistence

- [ ] Write failing repository tests for:
  - Updating a draft plan and writing `competition_stage_package_plan.updated`.
  - Rejecting update for an executed plan.
  - Cancelling a draft plan and writing `competition_stage_package_plan.cancelled`.
  - Reading audit rows from `audit.event_log`.
- [ ] Run `npm.cmd test -- src/modules/store-ops/infrastructure/competition.repository.spec.ts --runInBand` and verify missing repository methods fail.
- [ ] Implement repository methods:
  - `updateStagePackagePlan(input)`
  - `cancelStagePackagePlan(input)`
  - `listStagePackagePlanAudit(input)`
- [ ] Use `FOR UPDATE` for update/cancel to enforce draft-only decisions.
- [ ] Re-run targeted repository spec and verify it passes.

## Task 3: Controller And DTO

- [ ] Add `UpdateCompetitionStagePackagePlanDto` with `planName`, `packageCode`, and nested `stages`.
- [ ] Add controller endpoints:
  - `PUT /api/competitions/stage-package-plans/:planId`
  - `PATCH /api/competitions/stage-package-plans/:planId/cancel`
  - `GET /api/competitions/stage-package-plans/:planId/audit`
- [ ] Keep roles limited to `SUPER_ADMIN` and `HR_ADMIN`.
- [ ] Run targeted backend service and repository specs.

## Task 4: Frontend API And E2E

- [ ] Add failing Playwright coverage for edit, cancel, and history in `competition-surfaces.spec.ts`.
- [ ] Run `npm.cmd run build; npx.cmd playwright test e2e/competition-surfaces.spec.ts` and verify it fails on missing edit/cancel/history controls.
- [ ] Add frontend API helpers:
  - `updateCompetitionStagePackagePlan`
  - `cancelCompetitionStagePackagePlan`
  - `listCompetitionStagePackagePlanAudit`
- [ ] Expand Stage Builder plan library:
  - Draft rows show Edit, Cancel, Execute, Show history.
  - Edit row updates plan name and package stage fields.
  - Cancel changes status to cancelled after mutation.
  - History shows audit event rows.
- [ ] Re-run targeted frontend build and Playwright spec.

## Task 5: Release And Handoff

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

- [ ] Update `current-state.md` with behavior, checks, and next logical step.
- [ ] Commit with `feat: add competition package plan lifecycle`.

## Self Review

- Spec coverage: Draft edit, draft cancel, audit history, immutable executed/cancelled plans, frontend controls, and release gates are covered.
- Placeholder scan: No TBD/TODO/later placeholders remain.
- Type consistency: Method and type names use `StagePackagePlan` consistently across backend and frontend.
