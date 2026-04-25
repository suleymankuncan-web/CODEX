# Competition Stage Package Plan Approval V1 Design

## Goal

Add an approval gate between saved stage package plan drafts and real stage creation so HR can prepare a plan, submit it after review, and execute only an approved plan.

## Recommended Approach

Use the existing `ops.competition_stage_package_plan` row as the lifecycle source of truth and extend `plan_status`.

Rejected alternatives:

- A separate approval table is more flexible, but too heavy before we need multi-step approval chains.
- Keeping direct draft execution is faster, but it weakens the control boundary we just built.

## Lifecycle

Supported statuses:

- `draft`: editable, cancellable, submittable.
- `submitted`: locked for review; cannot edit, cancel, or execute.
- `approved`: locked and executable.
- `rejected`: locked history state; cannot execute.
- `executed`: immutable because real stages were created.
- `cancelled`: immutable history state.

Transitions:

- `draft -> submitted`
- `submitted -> approved`
- `submitted -> rejected`
- `approved -> executed`
- `draft -> cancelled`

## Data Model

The plan table keeps the current JSON draft payload and adds review metadata:

- `submitted_by_user_id`
- `submitted_at`
- `reviewed_by_user_id`
- `reviewed_at`
- `review_note`

Audit remains the durable history trail.

## API Shape

- `POST /api/competitions/stage-package-plans/:planId/submit`
  - Draft only.
  - Sets status to `submitted`.
  - Writes `competition_stage_package_plan.submitted`.

- `POST /api/competitions/stage-package-plans/:planId/approve`
  - Submitted only.
  - Sets status to `approved`.
  - Optional `reviewNote`.
  - Writes `competition_stage_package_plan.approved`.

- `POST /api/competitions/stage-package-plans/:planId/reject`
  - Submitted only.
  - Sets status to `rejected`.
  - Optional `reviewNote`.
  - Writes `competition_stage_package_plan.rejected`.

- Existing execute endpoint changes:
  - Only `approved` plans can execute.
  - Execute still uses `FOR UPDATE` and one transaction for real stage/team creation.

## Frontend Shape

The existing package plan library grows in place:

- Draft plan: `Edit`, `Cancel`, `Submit for review`, `Show history`.
- Submitted plan: `Approve`, `Reject`, `Show history`.
- Approved plan: `Execute`, `Show history`.
- Rejected/executed/cancelled plan: `Show history` only.
- Optional review note input appears inline for submitted plans.

## Error Handling

- Wrong lifecycle transition returns a controlled bad request.
- Missing plan returns a controlled bad request.
- Existing frontend error panel displays failed actions.

## Test Strategy

- Backend service tests cover submit, approve, reject, and execute delegation.
- Repository tests cover transition guards, SQL updates, audit events, and approved-only execute.
- Playwright covers draft submit, submitted approval, approved execute, rejected history state, and hidden unsafe actions.
- Release checks remain the gate: backend `check:release` and frontend `check:release`.

## Non-Goals

- No multi-approver chain yet.
- No role split between submitter and approver yet; V1 keeps existing `SUPER_ADMIN` / `HR_ADMIN` controller roles.
- No rejected-plan reopen/clone yet.
