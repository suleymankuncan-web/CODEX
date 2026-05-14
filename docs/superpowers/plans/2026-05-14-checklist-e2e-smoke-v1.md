# Checklist E2E Smoke V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prove the complete checklist handoff works from field visit completion to store-manager acknowledgement.

**Architecture:** Add one backend stateful integration smoke that exercises the real HTTP controllers with a mocked database state machine. Add one frontend Playwright smoke that moves the UI from a region-manager checklist visit into a store-manager acknowledgement queue and verifies the queue clears after acknowledgement.

**Tech Stack:** NestJS, Supertest, React, TanStack Query, Playwright.

---

## File Structure

- Modify `backend/nestjs/test/integration/mobile-checklist-today.e2e-spec.ts`
  - Add a stateful HTTP smoke covering `POST /mobile/checklists/instances`, `PATCH /mobile/checklists/instances/:id/responses`, `POST /mobile/checklists/instances/:id/complete`, `POST /checklists/acknowledgements/list`, `POST /checklists/instances/:id/acknowledge`, and a final list read.
- Modify `admin-web/e2e/checklist-today-surfaces.spec.ts`
  - Add a stateful Playwright smoke that starts a checklist as `REGION_MANAGER`, completes it, switches to `STORE_MANAGER`, acknowledges the completed result, and verifies pending results are cleared.
  - Extend existing fixtures with optional mutable role/result state while keeping existing tests unchanged.
- Create `docs/superpowers/plans/2026-05-14-checklist-e2e-smoke-v1.md`
  - Record the package plan and verification commands.

## Tasks

### Task 1: Backend Stateful Handoff Smoke

**Files:**
- Modify `backend/nestjs/test/integration/mobile-checklist-today.e2e-spec.ts`

- [x] Add a test named `hands a completed BM checklist to the store manager acknowledgement queue`.
- [x] Use a mutable in-memory state object:

```ts
const state = {
  active: false,
  responseSaved: false,
  completed: false,
  acknowledged: false,
  acknowledgementNote: null as string | null,
};
```

- [x] Mock database queries so the same `checklistInstanceId` moves through start, save, complete, list, acknowledge, and list again.
- [x] Assert the first acknowledgement list contains one completed result with response details and `acknowledgement: null`.
- [x] Assert the second acknowledgement list contains the same result with acknowledgement metadata.
- [x] Run:

```bash
npm.cmd --prefix backend/nestjs test -- mobile-checklist-today.e2e-spec.ts --runInBand
```

Expected: PASS.

### Task 2: Frontend Stateful Handoff Smoke

**Files:**
- Modify `admin-web/e2e/checklist-today-surfaces.spec.ts`

- [x] Add fixture state types:

```ts
type ChecklistRoleState = { current: string[] }
type ChecklistHandoffState = {
  completed: boolean
  acknowledged: boolean
  acknowledgementNote?: string
}
```

- [x] Update `routeChecklistApi` so auth/session and acknowledgement fixtures can read the mutable state when it is provided.
- [x] Add a helper `setMockSessionRoles(page, roleCodes)` that updates the mock session local storage before switching from region manager to store manager.
- [x] Add a test named `completed checklist handoff moves from field visit to store acknowledgement history`.
- [x] In that test, run the UI story in English to avoid brittle Turkish terminal encoding:
  - Start checklist as region manager.
  - Save score/comment.
  - Complete the visit.
  - Switch mock session to store manager.
  - Open result detail.
  - Acknowledge the result.
  - Verify the pending section becomes empty and the note appears in recent history.
- [x] Run:

```bash
npm.cmd --prefix admin-web run test:e2e -- e2e/checklist-today-surfaces.spec.ts
```

Expected: PASS.

### Task 3: Release Gates And PR Prep

**Files:**
- All modified files above.

- [x] Run focused backend smoke.
- [x] Run focused frontend smoke.
- [x] Run `npm.cmd --prefix admin-web run lint`.
- [x] Run `npm.cmd --prefix backend/nestjs test -- mobile-checklist-today.e2e-spec.ts --runInBand`.
- [x] Run `npm.cmd run check:release`.
- [ ] Commit only intended files and push `codex/checklist-e2e-smoke-v1`.

## Self-Review

- Spec coverage: the plan validates the exact product handoff we wanted: field completion creates a store-visible result, and store acknowledgement clears the pending queue.
- Placeholder scan: no TBD/TODO/HACK placeholders are left in the implementation steps.
- Type consistency: `ChecklistRoleState`, `ChecklistHandoffState`, request log, and fixture names are scoped to the Playwright spec and do not affect production contracts.
