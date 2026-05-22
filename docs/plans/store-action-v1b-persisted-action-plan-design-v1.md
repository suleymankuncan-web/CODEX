# Store Action V1B Persisted Action Plan Design V1

## Scope

This design turns the Store Action V1B go/no-go decision into an executable
write-feature design.

It does not implement code, endpoints, migrations, OpenAPI output, UI behavior,
auth behavior, KPI scoring, checklist scoring, target approval, notifications,
or workflow status changes.

## Sokrates Decision

Decision:

- Proceed with V1B design as the next safe step.
- Do not implement V1B code in the design PR.
- When implementation begins, split it into reversible kademeler:
  1. schema contract and migration,
  2. audit catalog and repository/service command tests,
  3. OpenAPI and generated client,
  4. workflow inbox integration,
  5. minimal Store Tasks UI.

Why now:

- V1A read-only candidates are bounded: KPI exception is active; direct
  checklist and target sources remain parked.
- The user explicitly asked to continue and finish the feature in stages.
- Persisted plans are useful only if lifecycle, auth, audit, workflow, API, and
  UI boundaries are designed before code.

Repo evidence:

- `docs/evidence/store-action-persisted-action-plan-v1b-decision.md` blocks
  casual write-state implementation and names required gates.
- `WorkflowInboxService` already normalizes source-owned work into a shared
  inbox shape and keeps assigned-store read scope separate from broad read
  roles.
- `TargetDistributionService` and `WorkforceService` already use
  assigned-store action scope for store commands.
- `audit.event_log` and `AUDIT_EVENT_CATALOG` are the project-owned audit path
  for state-changing commands.
- The existing API response helpers use `buildListResponse` and
  `buildCommandResponse`; V1B should stay on that envelope.

Counterargument:

- The fastest path would be to add a table and UI button immediately. That
  would close the loop visibly, but it would also risk introducing status,
  owner, scope, and audit semantics that future code cannot easily unwind.

Risk:

- LOW for this design PR.
- MEDIUM/HIGH for implementation because it touches DB, commands, auth action
  scope, audit, OpenAPI, workflow inbox, and UI.

Door:

- Design is a two-way door.
- DB migration plus user-visible lifecycle state is a near-one-way door and
  must be implemented in small PRs with rollback and tests.

Decision quality score:

- 5/5 for design. The feature has explicit source boundaries, a staged plan,
  verification gates, counterarguments, stop rules, and rollback shape.

## Product Loop

V1B should implement only this product loop:

```text
read-only candidate -> accepted action plan -> owner and due date -> status
update -> resolution note -> closed
```

V1B does not include:

- notifications,
- escalation,
- file upload,
- AI coaching,
- rewards, incentives, or points,
- generic workflow engine,
- generic rules engine,
- multi-role approval.

## Owner And Lifecycle

Owner:

- The source domain owns the source fact.
- Store Action owns the action-plan follow-up object.
- Store manager is the first action owner.
- Region manager, report viewer, and super admin may read according to scope.
- Write actions require assigned-store action scope.

Lifecycle:

| Status | Meaning | Terminal |
| --- | --- | --- |
| `open` | Plan was created and is waiting for work. | no |
| `in_progress` | Owner has started work. | no |
| `blocked` | Owner cannot complete without outside action. | no |
| `closed` | Resolution note was recorded. | yes |
| `cancelled` | Plan was intentionally stopped with a reason. | yes |

Rules:

- New plans start as `open`.
- `overdue` is derived from `due_on < current_date` and non-terminal status;
  it is not stored as a lifecycle status.
- `closed` requires `resolution_note`.
- `cancelled` requires `cancel_reason`.
- Reopen is parked outside V1B.
- Comments, attachments, escalation, and assignment transfer are parked outside
  V1B.

Allowed transitions:

| From | To |
| --- | --- |
| `open` | `in_progress`, `blocked`, `closed`, `cancelled` |
| `in_progress` | `blocked`, `closed`, `cancelled` |
| `blocked` | `in_progress`, `closed`, `cancelled` |
| `closed` | none |
| `cancelled` | none |

## Source Boundary

V1B implementation starts only with KPI exception candidates.

Active V1B source:

- `kpi_exception`

Parked direct sources:

- `checklist_receipt`
- `target_distribution_request`
- target coverage rows
- workforce/headcount pressure
- incentive/challenge signals

The action plan must not reinterpret KPI score math, checklist scores, target
approval, target reference promotion, or workforce approval behavior.

## Data Model Draft

Primary table:

```sql
CREATE TABLE IF NOT EXISTS ops.store_action_plan (
    store_action_plan_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES ops.company(company_id),
    region_id UUID NOT NULL REFERENCES ops.region(region_id),
    store_id UUID NOT NULL REFERENCES ops.store(store_id),
    owner_user_id UUID NOT NULL REFERENCES ops.user_account(user_id),
    created_by_user_id UUID NOT NULL REFERENCES ops.user_account(user_id),
    source_type TEXT NOT NULL,
    source_id TEXT NOT NULL,
    source_deep_link TEXT,
    source_snapshot_run_id UUID REFERENCES rpt.snapshot_run(snapshot_run_id),
    source_kpi_id UUID REFERENCES ops.kpi_definition(kpi_id),
    title TEXT NOT NULL,
    summary TEXT,
    priority TEXT NOT NULL DEFAULT 'medium',
    status TEXT NOT NULL DEFAULT 'open',
    due_on DATE NOT NULL,
    resolution_note TEXT,
    closed_by_user_id UUID REFERENCES ops.user_account(user_id),
    closed_at TIMESTAMPTZ,
    cancel_reason TEXT,
    cancelled_by_user_id UUID REFERENCES ops.user_account(user_id),
    cancelled_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (source_type IN ('kpi_exception')),
    CHECK (priority IN ('high', 'medium', 'low')),
    CHECK (status IN ('open', 'in_progress', 'blocked', 'closed', 'cancelled')),
    CHECK (status <> 'closed' OR (closed_at IS NOT NULL AND resolution_note IS NOT NULL)),
    CHECK (status <> 'cancelled' OR (cancelled_at IS NOT NULL AND cancel_reason IS NOT NULL))
);
```

Indexes:

```sql
CREATE INDEX IF NOT EXISTS idx_store_action_plan_store_status_due
    ON ops.store_action_plan (store_id, status, due_on);

CREATE INDEX IF NOT EXISTS idx_store_action_plan_owner_status_due
    ON ops.store_action_plan (owner_user_id, status, due_on);

CREATE INDEX IF NOT EXISTS idx_store_action_plan_scope_status_due
    ON ops.store_action_plan (company_id, region_id, status, due_on);

CREATE UNIQUE INDEX IF NOT EXISTS idx_store_action_plan_active_source_unique
    ON ops.store_action_plan (store_id, source_type, source_id)
    WHERE status IN ('open', 'in_progress', 'blocked');
```

Rollback shape:

- Drop the unique index.
- Drop the other indexes.
- Drop `ops.store_action_plan`.
- Do not touch KPI, checklist, target, workflow, or user-account tables.

## Auth And Scope

Read:

- `STORE_MANAGER`: assigned action stores only.
- `REGION_MANAGER`: stores in actor read scope.
- `REPORT_VIEWER`: stores in actor read scope.
- `SUPER_ADMIN`: actor read scope, with broad support reads allowed by existing
  auth behavior.

Write:

- `STORE_MANAGER`: assigned action stores only.
- `SUPER_ADMIN`: allowed only when the user has assigned action-store scope for
  the target store.
- `REGION_MANAGER`, `REPORT_VIEWER`, `HR_ADMIN`, `AUDITOR`, and store personnel
  do not create, update, close, or cancel V1B plans.

Required negative tests:

- assigned store create succeeds,
- unassigned store create fails with 403,
- read scope alone does not allow write,
- terminal plan update fails,
- foreign-scope plan detail is not returned,
- duplicate active source create fails with 409.

## Audit

Add catalog events before writing commands:

| Event type | Entity | Trigger |
| --- | --- | --- |
| `store_action_plan.created` | `ops.store_action_plan` | plan creation |
| `store_action_plan.status_updated` | `ops.store_action_plan` | non-terminal status change |
| `store_action_plan.closed` | `ops.store_action_plan` | resolution closure |
| `store_action_plan.cancelled` | `ops.store_action_plan` | cancellation |

Audit metadata must include:

- `storeActionPlanId`,
- `storeId`,
- `sourceType`,
- `sourceId`,
- `previousStatus` for updates,
- `nextStatus`,
- `dueOn`,
- `reason` or `resolutionNote` when applicable.

## API Design

Base path:

- `/api/store-actions`

List plans:

```text
GET /api/store-actions/plans?status=open&storeId=<uuid>&limit=50&offset=0
```

Response:

```json
{
  "items": [
    {
      "actionPlanId": "uuid",
      "storeId": "uuid",
      "storeName": "Store name",
      "sourceType": "kpi_exception",
      "sourceId": "snapshot:store:kpi",
      "title": "Net sales off track",
      "summary": "Store follow-up is required",
      "priority": "high",
      "status": "open",
      "dueOn": "2026-05-29",
      "isOverdue": false,
      "createdAt": "2026-05-22T00:00:00.000Z",
      "updatedAt": "2026-05-22T00:00:00.000Z"
    }
  ],
  "meta": { "count": 1, "total": 1, "limit": 50, "offset": 0 }
}
```

Get plan detail:

```text
GET /api/store-actions/plans/:actionPlanId
```

Create plan:

```text
POST /api/store-actions/plans
```

Request:

```json
{
  "storeId": "uuid",
  "sourceType": "kpi_exception",
  "sourceId": "snapshot:store:kpi",
  "sourceDeepLink": "/store/kpis",
  "sourceSnapshotRunId": "uuid",
  "sourceKpiId": "uuid",
  "title": "Net sales off track",
  "summary": "Review contributing KPI and record coaching follow-up.",
  "priority": "high",
  "dueOn": "2026-05-29"
}
```

Response:

```json
{
  "command": {
    "status": "created",
    "message": "Store action plan created"
  },
  "data": { "plan": { "actionPlanId": "uuid" } }
}
```

Update status:

```text
PATCH /api/store-actions/plans/:actionPlanId/status
```

Request:

```json
{ "status": "in_progress", "note": "Started coaching follow-up." }
```

Close:

```text
PATCH /api/store-actions/plans/:actionPlanId/close
```

Request:

```json
{ "resolutionNote": "Reviewed KPI drivers and agreed on next week focus." }
```

Cancel:

```text
PATCH /api/store-actions/plans/:actionPlanId/cancel
```

Request:

```json
{ "cancelReason": "Duplicate of an existing plan." }
```

HTTP semantics:

- 400 for malformed UUIDs or request bodies.
- 403 for missing role or assigned-store action scope.
- 404 for missing or foreign-scope plan detail.
- 409 for duplicate active source or invalid lifecycle transition.
- 422 for semantic validation such as past due date.

Pagination:

- Use the existing list envelope with `limit` and `offset`.
- Default `limit` is 50.
- Maximum `limit` is 100.

Versioning:

- No new API version path.
- Changes must be additive once the endpoint ships.
- OpenAPI and generated frontend types are required in the same implementation
  PR that introduces the endpoint.

Idempotency:

- V1B does not add a generic idempotency table.
- Source-derived create is protected by the active-source unique index.
- A retry that hits the same active source returns 409 with enough client
  context to refetch the existing plan.

## Workflow Inbox Mapping

After the plan table and API are stable, V1B may extend the workflow inbox.

New source type:

- `store_action_plan`
- `itemType: "task"`
- `sourceType: "store_action_plan"`

Mapping:

| Plan status | Inbox status | Item type |
| --- | --- | --- |
| `open` | `needs_attention` | `task` |
| `in_progress` | `needs_attention` | `task` |
| `blocked` | `needs_attention` | `task` |
| `closed` | `completed` | `task` |
| `cancelled` | `completed` | `task` |

Urgency:

- `high` if priority is `high` or the plan is overdue.
- `medium` if priority is `medium`.
- `low` if priority is `low` and not overdue.

Deep link:

- `/store/tasks?actionPlan=<actionPlanId>`

The shared inbox must not own action-plan lifecycle policy.

## UI Boundary

V1B minimal UI is a Store Tasks extension, not a broad redesign.

Allowed first UI:

- list existing action plans on `/store/tasks`,
- create a plan from an existing KPI exception candidate,
- change status to `in_progress` or `blocked`,
- close with resolution note,
- cancel with reason,
- show loading, empty, error, and retry states,
- work on mobile without horizontal overflow.

Not allowed in first UI:

- new admin dashboard,
- new Operations Tower detail workflow,
- route redesign,
- notifications,
- file upload,
- comments thread,
- AI recommendation copy.

## Operations Boundary

Operations Control Tower may later show summary only:

- open plans count,
- overdue plans count,
- blocked plans count,
- link to owning Store Tasks surface.

It must not own plan detail, commands, assignment, or resolution.

## Implementation Kademeleri

1. Schema and migration contract.
2. Audit catalog events.
3. Repository and service commands with assigned-store negative tests.
4. Controller, DTOs, OpenAPI, and generated frontend client.
5. Workflow inbox `store_action_plan` source adapter.
   - Implemented as a narrow active-plan inbox adapter.
   - Evidence: `docs/evidence/store-action-v1b-workflow-inbox-v1.md`.
6. Minimal Store Tasks UI.
   - First read-only list slice shows persisted action plans on `/store/tasks`
     without lifecycle commands.
   - Evidence: `docs/evidence/store-action-v1b-store-tasks-list-v1.md`.
7. Write UI go/no-go decision.
   - First write UI is conditional GO only for create-from-KPI-candidate.
   - Status, close, cancel, comments, attachments, notifications, escalation,
     non-KPI sources, new routes, DB/auth/workflow/scoring/API-shape changes
     remain NO-GO.
   - Evidence: `docs/evidence/store-action-v1b-write-ui-go-no-go-v1.md`.
8. Targeted Playwright and deployed smoke evidence when staging is ready.

Stop before the next kademe if the current one changes KPI scoring, checklist
rules, target approval semantics, auth semantics, or workflow behavior outside
the explicit V1B slice.
