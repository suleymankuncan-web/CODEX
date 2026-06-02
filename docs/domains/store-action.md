# Store Action Shelf

Status: active shelf index

## Reader And Action

Reader:

- an engineer or future agent changing Store Action candidates, persisted
  action plans, Store Tasks visibility, lifecycle commands, or coaching-loop
  behavior.

After reading, they should know the current Store Action boundary and where to
look before adding another source or write command.

## Source Documents

Use these first:

- `docs/plans/store-action-coaching-loop-v1.md`
- `docs/plans/store-action-checklist-remediation-v1.md`
- `docs/plans/store-action-checklist-remediation-implementation-v1.md`
- `docs/plans/store-action-target-projection-v1.md`
- `docs/plans/store-action-v1b-persisted-action-plan-design-v1.md`
- `docs/evidence/store-action-test-hygiene-and-visibility-v1.md`
- `docs/evidence/store-action-persisted-action-plan-v1b-decision.md`
- `docs/evidence/store-action-v1b-api-contract-v1.md`
- `docs/evidence/store-action-v1b-workflow-inbox-v1.md`
- `docs/evidence/pilot-readiness/2026-05-23-store-action-command-live-proof-v1.md`

## Active Rules

- V1A read-only candidates derive from KPI/reporting signals.
- V1B persisted action plans support the narrow lifecycle already implemented.
- V2A coaching detail is read-only and on-demand: `/store/tasks` may open the
  existing plan detail endpoint for context, but it does not create comments,
  attachments, escalation, notification, or new source-family behavior.
- Assigned-store command access must pass; unassigned-store command access must
  fail closed.
- Source families stay source-owned. Store Action should not become a generic
  workflow engine.
- Checklist acknowledgement and checklist remediation are separate: a
  `checklist_receipt` is acknowledgement work, while `checklist_remediation`
  tasks are created only from real persisted non-compliant checklist findings
  after acknowledgement.
- Target-achievement Store Action tasks are projection-risk work, not raw daily
  KPI drift: future target projection tasks require a ready projection
  calendar, weighted confidence gate, projection thresholds, and cautious
  before/after result language.
- API/OpenAPI/frontend client drift must be checked when endpoint contracts
  change.

## Parked Or High-Risk

- Checklist low-score direct candidates are no longer a generic open idea; the
  shipped path is explicit `checklist_remediation` from persisted
  `is_non_compliant = true` findings only. Score-only threshold generation
  remains parked until threshold ownership is persisted.
- Target coverage direct candidates.
- Target projection is approved only through the explicit projection decision;
  target coverage, approval, missing target, and stale reference workflows stay
  parked outside that path.
- Comments, attachments, notifications, escalation, assignment transfer, AI
  coaching, and non-KPI source families.
- Reopen/delete behavior for terminal action plans.

Open those only with a source decision, auth/action-scope evidence, and a
separate go/no-go note.

## Latest Evidence

- `docs/evidence/store-action-coaching-detail-v2a.md`
- `docs/evidence/store-action-checklist-remediation-v1-closeout-2026-06-02.md`
