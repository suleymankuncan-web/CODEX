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
- `rejected -> draft copy`
- `approved -> executed`
- `draft -> cancelled`

## Approval Ownership

V1 intentionally allows the same authorized HR/Admin user to submit and approve a plan. In the current operating model, the approval gate is a decision lock: it separates preparation from the official decision and prevents direct draft execution.

The data model still records both sides of the decision through `submitted_by_user_id` and `reviewed_by_user_id`. This keeps the future delegated workflow ready: a planner can prepare and submit the package plan, while the HR decision owner reviews, approves, or rejects it.

Future policy can add stricter separation without redesigning the lifecycle:

- Keep V1 behavior: same-user approval is allowed.
- Add delegated approval: submitter and reviewer may differ.
- Add strict approval: submitter cannot approve their own submitted plan.
- Add approval policy tiers for larger package types if needed.

## Data Model

The plan table keeps the current JSON draft payload and adds review metadata:

- `submitted_by_user_id`
- `submitted_at`
- `reviewed_by_user_id`
- `reviewed_at`
- `review_note`

Audit remains the durable history trail.

Cloned-plan source visibility is derived from audit metadata, not a new plan-table column. The plan list may expose a nullable `sourcePlan` object when the plan has a `competition_stage_package_plan.cloned_from_returned` audit event.

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

- `POST /api/competitions/stage-package-plans/:planId/clone`
  - Rejected only.
  - Leaves the source rejected plan immutable.
  - Creates a new `draft` plan with copied package/stage draft payload and a generated `revision` plan name.
  - Writes source-plan audit `competition_stage_package_plan.cloned_to_draft`.
  - Writes new-plan audit `competition_stage_package_plan.cloned_from_returned`.

- Existing execute endpoint changes:
  - Only `approved` plans can execute.
  - Execute still uses `FOR UPDATE` and one transaction for real stage/team creation.

## Frontend Shape

The existing package plan library grows in place:

- Draft plan: `Edit`, `Cancel`, `Mark ready for decision`, `Show history`.
- Cloned draft plan: same draft actions, plus card metadata showing `Cloned from ...`.
- Submitted plan: displayed as `decision ready`, with `Decision note`, `Approve decision`, `Return for revision`, `Show history`.
- Submitted plan also shows a `Decision preview` before approval. The preview is derived from `stageDrafts` and includes plan window, stage count, team template count, stage date rows, and store assignment totals.
- Approved plan: `Execute approved plan`, `Show history`.
- Rejected plan: displayed as `returned`, with `Clone as new draft`, `Show history`.
- Executed/cancelled plan: `Show history` only.
- Rejected plans may be displayed as `returned` in the UI while the API status remains `rejected`.
- Optional decision note input appears inline for submitted plans.
- History metadata renders source/clone references in readable language while preserving raw audit event types.

## Error Handling

- Wrong lifecycle transition returns a controlled bad request.
- Missing plan returns a controlled bad request.
- Existing frontend error panel displays failed actions.

## Test Strategy

- Backend service tests cover submit, approve, reject, and execute delegation.
- Repository tests cover transition guards, SQL updates, audit events, rejected-plan clone, audit-derived source visibility, and approved-only execute.
- Playwright covers draft submit, submitted pre-approval preview, submitted approval, approved execute, rejected history state, clone-as-draft source visibility, and hidden unsafe actions.
- Release checks remain the gate: backend `check:release` and frontend `check:release`.

## Non-Goals

- No multi-approver chain yet.
- No enforced role split between submitter and approver yet; V1 keeps existing `SUPER_ADMIN` / `HR_ADMIN` controller roles and permits same-user approval.
- No rejected-plan reopen in place; corrections use clone-as-new-draft instead.
