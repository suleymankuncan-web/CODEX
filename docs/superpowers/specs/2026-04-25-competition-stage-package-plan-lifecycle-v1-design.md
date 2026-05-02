# Competition Stage Package Plan Lifecycle V1 Design

## Goal

Give HR/Admin users controlled lifecycle actions for saved stage package plans before execution: edit a draft, cancel a draft, and inspect plan audit history.

## Decisions

- Only `draft` plans are editable.
- Only `draft` plans are cancellable.
- `executed` plans are immutable because they already created real competition stages.
- `cancelled` plans remain visible for history, but they cannot be executed or edited.
- No hard delete is added in V1.
- Audit history is read-only and sourced from `audit.event_log`.

## API Shape

- `PUT /api/competitions/stage-package-plans/:planId`
  - Replaces the draft plan name and stage draft payload.
  - Reuses the same stage package validation as create/save.
  - Writes `competition_stage_package_plan.updated`.

- `PATCH /api/competitions/stage-package-plans/:planId/cancel`
  - Moves a draft plan to `cancelled`.
  - Writes `competition_stage_package_plan.cancelled`.

- `GET /api/competitions/stage-package-plans/:planId/audit`
  - Returns event log rows for the plan in chronological order.
  - Includes event id, occurred at, actor user id, event type, and metadata.

## Frontend Shape

The existing Package plan library grows in place:

- Draft rows show `Edit`, `Cancel`, and `Execute`.
- Edit opens a compact inline editor for plan name and stage draft fields.
- Save edit calls the update endpoint and refreshes plan list.
- Cancel calls the cancel endpoint and refreshes plan list.
- Every plan row has a `Show history` action that reveals audit events.

## Error Handling

- Updating or cancelling a non-draft plan returns a controlled bad request.
- Missing plan returns a controlled bad request.
- Existing frontend error panel is reused for failed actions.

## Test Strategy

- Service tests cover update, cancel, and audit pass-through responses.
- Repository tests cover SQL, audit writes, draft-only guards, and event log reads.
- Playwright covers editing a saved plan, cancelling it, and showing history.
- Release checks remain the gate: backend `check:release` and frontend `check:release`.

## Non-Goals

- No stage deletion or stage update after execution.
- No approval workflow for plan execution yet.
- No diff viewer for stage draft JSON yet.
