# API Contract Drift Reduction Plan

## Goal

Reduce backend/frontend API contract drift with OpenAPI-generated frontend types and clients, without changing runtime behavior, response shapes, authorization, database schema, or business logic.

This track is intentionally incremental. The project should not introduce an API Gateway or any broad routing architecture change for this work. The gateway idea can be revisited later if service boundaries become real, but this codebase currently needs contract visibility and generation first.

## Current Contract Surface

### Backend controllers

The NestJS backend currently exposes API contracts from controller methods and DTO/query classes. The main controller surfaces are:

- `backend/nestjs/src/modules/integration/web/integration.controller.ts`
- `backend/nestjs/src/modules/store-ops/web/competition.controller.ts`
- `backend/nestjs/src/modules/store-ops/web/reporting.controller.ts`
- `backend/nestjs/src/modules/store-ops/web/snapshot.controller.ts`
- `backend/nestjs/src/modules/store-ops/web/target-distribution.controller.ts`
- `backend/nestjs/src/modules/store-ops/web/workforce.controller.ts`
- `backend/nestjs/src/modules/store-ops/web/checklist.controller.ts`
- `backend/nestjs/src/modules/store-ops/web/admin-checklist-template.controller.ts`
- `backend/nestjs/src/modules/store-ops/web/mobile-checklist.controller.ts`
- `backend/nestjs/src/modules/store-ops/web/feed.controller.ts`
- `backend/nestjs/src/modules/store-ops/web/org.controller.ts`
- `backend/nestjs/src/modules/store-ops/web/workflow-inbox.controller.ts`
- `backend/nestjs/src/modules/auth/web/auth-admin.controller.ts`
- `backend/nestjs/src/modules/auth/web/auth-session.controller.ts`
- `backend/nestjs/src/modules/auth/web/mobile-auth.controller.ts`
- `backend/nestjs/src/modules/snapshot/snapshot-scheduler.controller.ts`

Integration is the best first domain because it already has a large, actively used admin surface and the frontend client is manually typed in one concentrated file.

### Frontend manual clients

The admin frontend currently keeps feature-level API functions and TypeScript response types by hand:

- `admin-web/src/features/integrations/api.ts`
- `admin-web/src/features/competitions/api.ts`
- `admin-web/src/features/checklists/api.ts`
- `admin-web/src/features/workforce/api.ts`
- `admin-web/src/features/workflow/api.ts`
- `admin-web/src/features/feed/api.ts`
- `admin-web/src/features/reports/api.ts`
- `admin-web/src/features/snapshots/api.ts`
- `admin-web/src/features/targets/api.ts`
- `admin-web/src/features/auth/api.ts`
- `admin-web/src/lib/api.ts`

This is workable while the project is small, but every backend response adjustment now depends on humans remembering to update matching frontend types. That is the drift risk this track addresses.

## Pilot Decision

### First pilot endpoint

Use `GET /integrations/import-batches/overview` as the first generated-contract pilot.

Reasons:

- It is read-only.
- It has no request body and does not mutate state.
- It does not require DB migration, permission changes, or auth behavior changes.
- The frontend already has a small manual `ImportOverview` type in `admin-web/src/features/integrations/api.ts`.
- The endpoint is already documented in `docs/api/store-ops-api-contracts.md`.
- Existing Playwright surfaces mock it in `admin-routing.spec.ts`, `integration-surfaces.spec.ts`, and `pilot-smoke.spec.ts`.

### Second pilot endpoint

Use `GET /integrations/master-data-bootstrap/batches` after the overview pilot is stable.

Reasons:

- It exercises the shared list envelope shape.
- It is still read-only.
- It has existing DTO/query validation and targeted UI contract coverage.
- It is more complex than the overview endpoint, so it should not be the first generated-client migration.

## Slice Plan

### Slice 1: inventory and pilot selection

This PR only records the contract surface, risk map, pilot endpoint, validation expectations, and stop conditions. It must not change application behavior.

Touched files:

- `docs/plans/api-contract-drift-plan.md`

### Slice 2: OpenAPI schema generation baseline

Introduce the smallest NestJS OpenAPI schema generation path that can describe existing routes without changing route behavior.

Expected shape:

- Add OpenAPI tooling only if it is not already present.
- Prefer schema generation as a script/artifact first.
- Avoid exposing a public production docs route unless explicitly decided later.
- Start with integration read endpoints and shared response envelopes.

Expected verification:

- backend lint
- backend build
- targeted backend tests for integration/admin controller coverage when touched

### Slice 3: generated frontend type/client pilot

Generate frontend types for `GET /integrations/import-batches/overview` and use the generated response type at the frontend boundary.

Expected constraints:

- Keep `admin-web/src/lib/api.ts` request behavior intact.
- Preserve current endpoint path and response parsing.
- Do not change UI data mapping or display behavior.
- Keep manual type exports compatible until all callers move.

Expected verification:

- frontend lint
- frontend build
- targeted Playwright coverage for integrations overview/admin route

### Slice 4: drift gate

Add a freshness check that fails when generated API contract artifacts are stale.

Expected shape:

- A deterministic generation script.
- A check script that regenerates contract artifacts and fails on diff.
- CI integration only after local generation is stable.

Expected verification:

- backend lint/build
- frontend lint/build
- contract generation check

### Slice 5: domain rollout

After the pilot is stable, expand in this order:

1. integrations/master-data
2. competitions
3. store approvals/checklists
4. auth/session last

Auth/session stays last because the blast radius is higher and accidental response or permission drift is more expensive there.

## Stop Conditions

Stop and report instead of merging if any of these happen:

- API response shape would change.
- Auth, permission, token, or session behavior would change.
- Database schema or migration would be required.
- A write endpoint becomes necessary before read pilots are stable.
- Generated code forces a large architecture change.
- Local lint/build or targeted tests fail.
- GitHub checks fail.
- The PR is not mergeable.
- Required checks fail, mergeability is blocked, or final local adversarial
  review finds an unresolved issue.

## Merge Gate

Every slice uses a separate worktree and branch. A PR can be squash-merged only when all are true:

- Local verification passed.
- GitHub checks are green.
- GitHub reports the PR as mergeable.
- Final local adversarial review is clean. GitHub Codex review remains
  owner-disabled and is not requested or awaited.

