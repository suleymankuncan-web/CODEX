# Store Action V1B Workflow Inbox Evidence

Date: 2026-05-22

## Decision

Persisted Store Action plans can enter the shared workflow inbox as `task`
items through a narrow source adapter.

This slice does not add a new workflow state machine. Store Action still owns
plan lifecycle, audit, and commands. The shared inbox only normalizes active
plans into the existing queue language.

## Sokrates Triage

Claim:

- Store managers should see active persisted action plans in the existing work
  queue once the plan API exists.

Assumptions:

- Active action plans are already scoped by assigned action stores.
- The inbox can show them as tasks without becoming the owner of lifecycle
  policy.
- Closed and cancelled plan history belongs to the action plan API/detail flow,
  not the default shared inbox list.

Repo evidence:

- Store Action V1B already has schema, audit catalog, command service, API
  contract, and assigned-store tests.
- `WorkflowInboxService` already aggregates target approvals, checklist
  acknowledgements, and KPI exception tasks.
- `Feature Integration Spine V1` says source features own lifecycle while the
  shared inbox owns normalization only.

Counterargument:

- Adding another source to the shared inbox increases pressure on the inbox and
  frontend source labels. That pressure is real, so this slice adds one source
  adapter and updates only enum/label handling.

Risk:

- MEDIUM because it touches workflow aggregation, OpenAPI source type, generated
  frontend types, and visible queue labels.

Door:

- Two-way for the inbox adapter and labels. Nearer to one-way only if future
  work starts using inbox status as the source lifecycle, which this slice does
  not do.

Stop rule:

- Stop if this requires a DB migration, auth semantic change, action-plan
  lifecycle change, workflow approval semantics, or broad Store Tasks redesign.

## Implementation

Backend:

- Added `store_action_plan` as a `WorkflowInboxItem.sourceType`.
- Added `toStoreActionPlanInboxItem` mapping:
  - `itemType`: `task`
  - active statuses `open`, `in_progress`, `blocked` map to
    `needs_attention`
  - terminal statuses can map to `completed`, but the service only lists active
    plans for the shared inbox.
  - high priority or overdue plans become high urgency.
  - deep link: `/store/tasks?actionPlan=<actionPlanId>`
- Added `StoreActionPlanRepository.listWorkflowInboxPlans` for active queue
  reads.
- `WorkflowInboxService` fetches action plans only for `STORE_MANAGER` and
  `SUPER_ADMIN`, and only from assigned action stores.

Frontend/API:

- Extended `/api/workflow/inbox` OpenAPI source-type enum with
  `store_action_plan`.
- Regenerated frontend OpenAPI types.
- Added source labels and action labels for Store Tasks, Admin Inbox detail,
  and Operations workflow signal formatting.
- Added a Store Tasks Playwright assertion for a mocked `store_action_plan`
  workflow item.
- Kept read-only candidate derivation limited to `kpi_exception`; persisted
  action plans are not reclassified as V1A read-only candidates.

## Guardrails Kept

- No DB migration.
- No action-plan command or lifecycle behavior change.
- No KPI, checklist, target, or workforce business rule change.
- No auth/permission semantic change.
- No broad Store Tasks UI redesign.
- No notifications, escalation, or provider work.

## Verification

Initial TDD red:

```text
npm.cmd --prefix backend/nestjs test -- workflow-inbox.service.spec.ts store-action-plan.repository.spec.ts
```

Failed as expected before implementation because
`listWorkflowInboxPlans` and the fifth `WorkflowInboxService` dependency did
not exist.

Passing gates:

```text
npm.cmd --prefix backend/nestjs test -- workflow-inbox.service.spec.ts store-action-plan.repository.spec.ts
npm.cmd --prefix backend/nestjs run openapi:generate
npm.cmd --prefix admin-web run api:generate
npm.cmd --prefix admin-web run api:check
npm.cmd run system-flow:generate
npm.cmd --prefix backend/nestjs run lint
npm.cmd --prefix backend/nestjs run build
npm.cmd --prefix admin-web run lint
npm.cmd --prefix admin-web run build
node --test scripts/file-size-guard.test.mjs
npm.cmd run test:scripts
npm.cmd --prefix admin-web run test:e2e -- admin-inbox.spec.ts store-surfaces.spec.ts operations-control-tower.spec.ts
npm.cmd --prefix admin-web run test:e2e -- store-surfaces.spec.ts --grep "persisted action plans"
npm.cmd run check:release
```

Results:

- Backend targeted Jest: 2 suites, 11 tests passed.
- Backend lint/build: passed.
- OpenAPI/generated API checks: passed/current.
- System flow regenerated with unchanged endpoint/route counts.
- Admin lint/build: passed.
- File size guard: 3 passed.
- Root script tests: 309 passed.
- New Store Tasks action-plan Playwright test: 1 passed after narrowing the
  source label locator to an exact match.
- Targeted Playwright: 69 passed.
- Full release gate: passed.
  - Admin Playwright: 178 passed.
  - Backend Jest: 123 suites, 714 tests passed.
  - Production audit: 0 vulnerabilities.

## Remaining Work

Next Store Action V1B kademe:

- Minimal Store Tasks UI for listing existing persisted action plans and then,
  separately, create/status/close/cancel controls.
- Do not start UI write controls until the review story is narrow enough to
  test without changing source-domain behavior.
