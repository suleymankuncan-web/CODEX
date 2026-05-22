# Store Action Source Guard V1

## Scope

This evidence records the second Store Action / Coaching Loop V1A slice.

It does not add a new endpoint, DB table, migration, workflow state machine,
auth rule, KPI scoring rule, checklist scoring rule, target approval rule,
notification, UI surface, or write command.

## Sokrates Decision

Decision:

- Keep `kpi_exception` workflow inbox `task` items as the only active read-only
  Store Action candidate source.
- Explicitly park `checklist_receipt` workflow inbox items at the
  acknowledgement boundary.
- Explicitly park `target_distribution_request` workflow inbox items at the
  approval boundary.
- Add a type-level source decision map so future workflow source types must be
  classified before they can silently enter Store Action candidate logic.

Why now:

- The first V1A slice proved a read-only Store Action candidate can be derived
  safely from existing KPI exception tasks.
- The next tempting sources, checklist and target, are real workflow signals
  but are not yet safe coaching candidates.
- A source guard prevents the Store Action helper from drifting into "every
  workflow item is coaching work" as new inbox source types appear.

Repo evidence:

- `toKpiExceptionInboxItem` emits `itemType: "task"` with
  `sourceType: "kpi_exception"` and `inboxStatus: "needs_attention"`.
- `toChecklistAcknowledgementInboxItem` emits `itemType: "acknowledgement"` and
  `sourceType: "checklist_receipt"`.
- `toTargetApprovalInboxItem` emits `itemType: "approval"` and
  `sourceType: "target_distribution_request"`.
- `WorkflowInboxService` already scopes these source reads; this slice does not
  change those scopes.
- `STORE_ACTION_WORKFLOW_SOURCE_DECISIONS` now covers
  `WorkflowInboxItem['sourceType']` with an explicit decision for every current
  source.

Counterargument:

- Checklist low-score and target coverage/miss candidates would create more
  visible Store Action value than a guard. That is true, but both require
  source-specific business decisions first. Checklist needs a threshold owner
  and a relationship to acknowledgement. Target needs protection around
  approval and scoring-reference semantics.

Risk:

- LOW. The helper still returns only KPI exception task candidates.
- MEDIUM if future code bypasses the helper and treats checklist receipts or
  target approvals as Store Action candidates without a source decision.
- HIGH if future work introduces persisted action plans or workflow commands
  without the separate V1B decision.

Door:

- Two-way door. The source decision map can be expanded when a future source is
  approved.
- Persisted action plans, target mutations, checklist scoring, and workflow
  state changes remain medium/high-risk work.

Stop rule:

- Stop before adding checklist-derived candidates until low-score threshold
  ownership and acknowledgement interaction are explicit.
- Stop before adding target-derived candidates until target approval and
  scoring-reference semantics are protected.
- Stop before adding a new Store Action endpoint until there is a second
  consumer or candidate data no longer fits the existing workflow inbox payload.

## Source Decisions

| Workflow source | Workflow item type | Store Action V1A decision | Why |
| --- | --- | --- | --- |
| `kpi_exception` | `task` | `read_only_candidate` | Existing KPI status-band signal, assigned-store scope, no new DB or KPI math. |
| `checklist_receipt` | `acknowledgement` | `parked_acknowledgement_boundary` | A receipt acknowledgement is not automatically a coaching candidate; low-score follow-up needs a threshold decision. |
| `target_distribution_request` | `approval` | `parked_approval_boundary` | A target approval is not automatically a coaching candidate; coverage/miss follow-up must not change approval or scoring-reference semantics. |

## Verification

Required for this slice:

- `git diff --check`
- `node --test scripts/store-action-readonly-candidates-contract.test.mjs`
- `npm.cmd run test:scripts`
- `npm.cmd --prefix admin-web run lint`
- `npm.cmd --prefix admin-web run build`

No backend or OpenAPI gate is required because this slice does not touch
backend code, API contracts, generated clients, auth, DB, or workflow behavior.

## Next Decision

The next Store Action move should remain read-only unless V1B is explicitly
approved.

Best next options:

1. checklist low-score source decision, docs-only first,
2. target coverage/miss source decision, docs-only first,
3. dedicated Store Action read endpoint only after a second consumer exists,
4. persisted action-plan V1B shaping with DB/auth/audit/workflow decisions.
