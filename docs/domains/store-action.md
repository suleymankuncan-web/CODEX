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
- API/OpenAPI/frontend client drift must be checked when endpoint contracts
  change.

## Parked Or High-Risk

- Checklist low-score direct candidates.
- Target coverage direct candidates.
- Comments, attachments, notifications, escalation, assignment transfer, AI
  coaching, and non-KPI source families.
- Reopen/delete behavior for terminal action plans.

Open those only with a source decision, auth/action-scope evidence, and a
separate go/no-go note.

## Latest Evidence

- `docs/evidence/store-action-coaching-detail-v2a.md`
