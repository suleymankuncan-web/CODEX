# Store Action Coaching Detail V2A

Date: 2026-05-23

## Decision

Add the first Store Action coaching-loop slice as an on-demand read-only plan
detail disclosure on `/store/tasks`.

This slice uses the existing `GET /api/store-actions/plans/{actionPlanId}`
endpoint and the existing generated OpenAPI type. It does not add comments,
attachments, notifications, escalation, a new workflow state, a DB migration, a
new Store Action source family, KPI scoring changes, auth semantics, or command
behavior.

## Sokrates Triage

Claim:

- Store managers need more context before a persisted action plan becomes a
  useful coaching loop, but the next safe step is not a comment/write model.

Assumptions:

- Existing plan detail fields are enough for the first context view.
- True comments/history need a dedicated source decision because they imply new
  write/storage semantics.
- Fetching detail on demand avoids increasing `/store/tasks` initial fanout.

Repo evidence:

- Backend already exposes `GET /api/store-actions/plans/{actionPlanId}` and
  validates assigned action-store scope in `StoreActionPlanService.getPlan`.
- Store Tasks already lists persisted action plans and invalidates the list and
  workflow inbox after lifecycle commands.
- The current Store Action shelf parks comments, attachments, notifications,
  escalation, assignment transfer, AI coaching, and non-KPI source families.

Counterargument:

- A read-only detail disclosure is not a full coaching workflow. That is true,
  but it creates a reviewable stepping stone without adding hidden operational
  state.

Risk:

- LOW/MEDIUM. The frontend now calls an existing protected detail endpoint only
  after a user opens detail. Backend/auth/API shape/DB behavior stay unchanged.

Door:

- Two-way door. The UI disclosure and typed client helper can be reverted as one
  frontend slice.

Stop rule:

- Stop before comments, attachments, escalation, notification, or non-KPI source
  work unless a fresh go/no-go decision defines storage, auth, audit, and tests.

Verification ladder:

1. Targeted Store Action Playwright proves on-demand detail fetch and visible
   lifecycle/source context.
2. Admin frontend lint/build prove TypeScript and bundle health.
3. File-size guard proves this slice did not re-grow oversized files.
4. `git diff --check` proves no whitespace damage.

## Implemented Behavior

- `/store/tasks` action-plan rows include an `Open coaching detail` disclosure.
- The disclosure fetches the existing plan detail endpoint on demand.
- The detail view shows owner, creator, created/updated timestamps, source ID,
  snapshot/KPI identifiers when present, terminal timestamps, and existing
  close/cancel evidence when present.
- Empty optional fields show `Not available`; no fake comments or synthetic
  audit history are invented.

## Not Implemented

- No persisted comments.
- No audit-event history endpoint.
- No attachments.
- No reminders/escalations/notifications.
- No new source families.
- No automatic Store Action creation.
- No scoring, approval, workflow, auth, or DB changes.

## Next Decision

The next Store Action expansion should choose one path explicitly:

1. read-only audit-event history, if existing audit events can be safely exposed
   without leaking unrelated actor data;
2. comments, only with a DB/auth/audit design and assigned-store tests;
3. source family expansion, only after checklist/target/workforce source
   decisions are refreshed.
