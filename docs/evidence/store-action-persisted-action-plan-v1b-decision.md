# Store Action Persisted Action Plan V1B Decision

## Scope

This evidence records the go/no-go decision before any persisted Store Action
action-plan write model is implemented.

It does not add a new endpoint, DB table, migration, workflow state machine,
auth rule, audit event, UI surface, notification, or write command.

## Sokrates Decision

Decision:

- Do not implement persisted Store Action action plans yet.
- Treat V1A read-only candidates as complete enough for the current Store
  Action foundation.
- Park V1B until the project explicitly approves a write-feature slice with DB,
  auth/action-scope, audit, workflow, API, and frontend recovery decisions.

Why now:

- V1A now has bounded source decisions for KPI, checklist, and target signals.
- Persisted action plans would create real operational state, not just a
  read-only interpretation.
- Starting V1B casually would introduce a second workflow lifecycle unless the
  owner, statuses, audit events, and inbox mapping are locked first.

Repo evidence:

- `docs/evidence/store-action-readonly-candidates-v1.md` proves the first
  read-only KPI candidate path.
- `docs/evidence/store-action-source-guard-v1.md` prevents non-KPI workflow
  sources from silently becoming coaching candidates.
- `docs/evidence/store-action-checklist-source-decision-v1.md` keeps checklist
  receipts as acknowledgements and routes checklist score follow-up through KPI
  exceptions.
- `docs/evidence/store-action-target-source-decision-v1.md` keeps target
  requests as approvals and routes target performance follow-up through KPI
  exceptions.
- Existing workflow language supports `task`, but the source domain must own
  lifecycle status before inbox normalization.
- Existing auth patterns separate read scope from assigned-store action scope;
  V1B writes would need negative action-scope tests.

Counterargument:

- A persisted plan would finally close the product loop from signal to owner,
  due date, evidence, and closure. That is the right eventual direction, but it
  is no longer a low-risk V1A continuation. It is a write feature with DB,
  audit, workflow, API, and UI implications.

Risk:

- LOW for this decision report.
- HIGH for implementation without a separate V1B plan because it touches DB,
  commands, auth/action scope, audit, workflow inbox, API contracts, and
  frontend state recovery.

Door:

- Decision report is a two-way door.
- Persisted action-plan implementation is medium/high-risk and near-one-way if
  it ships with migrations and user-visible lifecycle state.

## V1B Go / No-Go

Current decision:

```text
NO-GO for V1B implementation right now.
GO only for a future explicitly approved V1B design or implementation slice.
```

This is not a product rejection. It is a sequencing decision.

## Required Before V1B Code

Before implementation, a V1B slice must answer:

- action-plan owner: store manager only, or region/admin visibility too,
- lifecycle: open, in-progress, closed, cancelled, overdue, reopened or not,
- data placement: `ops` table shape, source reference, due date, owner,
  resolution evidence, and rollback,
- auth: read scope and assigned-store action scope, with forbidden-store tests,
- audit: create/update/close/cancel event names and metadata,
- API: OpenAPI schemas, generated client, response and command bodies,
- workflow inbox: source type, item type, status mapping, deep link, urgency,
- frontend: owning route/surface, loading/empty/error/retry states,
- operations: whether only summary counts/link are exposed,
- migration/release: migration smoke and rollback plan.

## Smallest Future V1B Slice

The smallest safe future implementation is not a full coaching workflow.

Recommended first V1B slice after explicit approval:

1. docs/schema decision with table draft and lifecycle contract,
2. backend schema contract red test,
3. migration plus repository create/list for assigned-store action scope,
4. audit event test,
5. OpenAPI/generated client,
6. minimal Store Tasks read/create surface,
7. workflow inbox integration only after action-plan lifecycle exists.

Stop if the first slice tries to add notifications, escalation, files,
automatic remediation, incentives, AI coaching, generic workflow engine, or
multi-role approval.

## Verification

Required for this slice:

- `git diff --check`
- `node --test scripts/store-action-readonly-candidates-contract.test.mjs`
- `npm.cmd run test:scripts`

No frontend build, backend build, OpenAPI generation, or Playwright gate is
required because this slice changes only docs and root script contracts.

## Final Store Action V1A State

Store Action V1A is now bounded as:

- active source: KPI exception read-only candidates,
- parked direct sources: checklist receipts and target coverage/approval,
- first surface: `/store/tasks`,
- no DB write model,
- no workflow state machine change,
- no scoring, target, checklist, auth, or API behavior change.

The next code move should not be Store Action V1B unless the user explicitly
chooses that write-feature risk.
