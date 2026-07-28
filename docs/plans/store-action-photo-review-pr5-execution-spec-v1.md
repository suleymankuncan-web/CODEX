# Store Action Photo Review PR-5 Execution Spec V1

Status: implementation active, runtime disabled by default
Base: PR #1023 merge `2d7047089a2acc6004aeb6ca1140c80fcba792c5`

## Contract

Only newly created `checklist_remediation` actions may pin resolution workflow
V2 while `STORE_ACTION_PHOTO_RESOLUTION_ENABLED=true`. Existing records and KPI
actions remain V1. A V2 action cannot be closed by the Store Manager. Its
current owner submits a non-empty note and one ready, plan-bound solution asset;
the result is `solution_review_pending`. Only the assigned Region Manager may
approve the current attempt and close the action or reject it with a reason.
Rejection produces `correction_required`; resubmission creates a new immutable
attempt.

PR-5 remains synthetic-only. Camera, arbitrary gallery media, real photographs,
required-evidence enforcement, new scanners, AI and broad production are not
authorized by this slice.

## Integrity and authorization

- The server re-reads owner, company, region, store, role and action scope.
- Upload intent binds one `action_evidence` asset to one plan, store and actor.
- Only the trusted checklist-completion path can pin V2; its exact persisted
  finding media is linked to the new action in the same database transaction.
- Submit and review lock the action row, compare `photo_evidence_version`, use
  payload-bound idempotency, and reject stale or superseded attempts.
- Attempt, evidence and review rows are append-only under the PR-1 triggers.
- State and both operational/photo audit records are written atomically.
- Report Viewer receives no new media or review authority.
- Solution media holds block retention cleanup until Region Manager approval;
  rejection/resubmission keeps the hold. Store Manager cancellation cannot
  bypass V2 review.
- Mixed-role sessions use role-specific Store Manager and Region Manager
  scopes before any idempotent replay result is returned.

## Rollback and pending queue

Normal rollback is feature-off, not destructive schema reversal:

1. Set `STORE_ACTION_PHOTO_RESOLUTION_ENABLED=false` to stop new V2 creation,
   uploads and submissions.
2. Keep `REGION_MANAGER_SOLUTION_REVIEW_ENABLED=true` so assigned Region
   Managers can drain the explicit `solution_review_pending` queue.
3. Preserve all attempts, media links, reviews and pending states.
4. Freeze review too only for a security or integrity incident; re-enable after
   reconciliation. Never reinterpret or auto-close pending work.

The rollback SQL refuses to run after any V2 row or upload intent exists.

## Traceability

- FR-05 / AC-05: Store Manager note plus ready solution evidence produces
  `solution_review_pending`, never `closed`.
- FR-06 / AC-06: assigned Region Manager approval/rejection; rejection reason
  required.
- FR-07 / EC-02 / EC-05: immutable attempts, payload-bound idempotency, row lock,
  expected-version CAS, stale review rejection.
- AC-02 / EC-03: cross-company/store/role/owner/asset failures are fail-closed.
- EC-12: `resolution_workflow_version=1` remains the default for historical V1.
- AC-08 / AC-14: no AI dependency and no production activation.
