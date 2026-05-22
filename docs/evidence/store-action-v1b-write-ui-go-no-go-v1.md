# Store Action V1B Write UI Go/No-Go V1

Date: 2026-05-22

## Decision

Store Action write UI is a conditional GO only for one narrow first slice:

- create a persisted action plan from an existing KPI exception candidate,
- keep the action source as `kpi_exception`,
- keep owner/due date/priority/title/summary inside the existing Store Action
  command contract,
- keep the Store Tasks plan list read-only after creation except for the new
  created item becoming visible.

Everything else remains NO-GO until a separate slice:

- status changes,
- close/cancel commands,
- comments,
- attachments,
- notifications,
- escalation,
- admin or Operations Control Tower action-plan detail workflows,
- non-KPI direct checklist or target-derived action sources,
- any new DB migration, auth semantics, workflow state machine, scoring rule,
  or API response-shape change.

## Sokrates

Claim:

- The project is ready to design the first Store Action write UI only because
  the backend schema, lifecycle contract, service commands, API contract,
  workflow inbox source, and Store Tasks read-only list are already staged and
  tested.

Assumptions:

- Existing backend command tests still prove assigned-store positive and
  forbidden unassigned-store behavior.
- Store Tasks remains the owning day-to-day surface.
- KPI exception candidates are still the only approved source for V1.
- The first UI slice can be reviewed and reverted without touching schema or
  lifecycle semantics.

Repo evidence:

- `docs/evidence/store-action-v1a-read-only-candidates-v1.md`
- `docs/evidence/store-action-v1b-schema-v1.md`
- `docs/evidence/store-action-v1b-lifecycle-contract-v1.md`
- `docs/evidence/store-action-v1b-command-service-v1.md`
- `docs/evidence/store-action-v1b-api-contract-v1.md`
- `docs/evidence/store-action-v1b-workflow-inbox-v1.md`
- `docs/evidence/store-action-v1b-store-tasks-list-v1.md`

Counterarguments:

- Users may expect close/cancel/status controls immediately after create.
  Shipping those together would mix command semantics, recovery behavior, and
  UI state risk in one PR.
- A create button can become a shadow workflow engine if it accepts sources
  beyond KPI exceptions.
- Frontend affordances can accidentally imply write authority if the UI is not
  scoped to assigned action stores and backend 403 handling.

Risk:

- First create-only UI: MEDIUM. It performs a real write, but over an already
  bounded backend command and source model.
- Create plus lifecycle controls in one PR: HIGH. It widens state transitions,
  audit expectations, cache invalidation, and recovery behavior.

Door:

- Create-only UI is a two-way door if it adds no schema/auth/API-shape change
  and can be reverted while leaving existing backend commands unused.
- Lifecycle controls become a heavier door because bad state transitions or
  audit gaps may leave persisted records needing cleanup.

## First Safe Code Slice

Slice name:

- `Store Action V1B Create From KPI Candidate UI`

Scope:

- Add generated frontend write helper for `POST /api/store-actions/plans`.
- Add one create affordance only on an existing read-only KPI exception
  candidate row in `/store/tasks`.
- Use existing candidate fields to prefill source context.
- Require explicit title/summary/due date/priority input before submit.
- On success, invalidate/refetch Store Action plan list and workflow inbox
  queries.
- On 403/409/422, show a local error state without changing candidate meaning.

Non-goals:

- Do not add status, close, or cancel controls.
- Do not create action plans from checklist acknowledgements or target approvals.
- Do not add new routes.
- Do not add DB migration, backend policy change, or workflow inbox mapping
  change.
- Do not add notifications, comments, files, AI copy, or admin action detail.

## Stop Rules

Stop and split the work if:

- the UI needs status/close/cancel to make create usable,
- the source is not a KPI exception candidate,
- the existing backend command contract is insufficient,
- a new DB migration or auth rule is required,
- the PR changes KPI scoring, checklist scoring, target approval, or workflow
  state semantics,
- review requires more than one paragraph to explain the change,
- targeted E2E cannot prove success and error recovery without broad mocks.

## Verification Ladder

Before push:

- `npm.cmd --prefix admin-web run api:check`
- `npm.cmd --prefix admin-web run lint`
- `npm.cmd --prefix admin-web run build`
- `npm.cmd --prefix admin-web run test:e2e -- store-surfaces.spec.ts --grep "store tasks"`
- backend Store Action targeted tests if any backend command/client contract is
  touched:
  - store action plan service/repository tests,
  - store action plan controller/API tests,
  - workflow inbox tests if query invalidation or inbox source behavior changes.
- `npm.cmd run test:scripts` if docs/evidence/flow artifacts change.

PR gate:

- GitHub checks green.
- PR mergeable.
- Codex "found no major issue", "didn't find any major issues", or thumbs-up.

## Final Answer

Do not build a broad Store Action workflow UI yet.

Next code PR should be create-only from existing KPI exception candidates. If
that slice passes cleanly, status update can be considered as the next separate
PR, then close/cancel as another separate PR.
