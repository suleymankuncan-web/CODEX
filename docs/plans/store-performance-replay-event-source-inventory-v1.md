# Store Performance Replay Event Source Inventory V1

Status: inventory_ready
Shelf: operating
Last verified: 2026-05-24

## Reader And Action

Reader:

- a future agent, engineer, or product owner deciding whether Store Performance
  Replay can become a read-only timeline.

After reading, they should know which existing sources can support a factual
timeline, which sources need more guardrails, and where the implementation must
stop before it creates false causality or synthetic events.

## Sokrates Decision

Claim:

- Store Performance Replay is useful only if each timeline item has a stable
  source id, timestamp, scope, source route, and safe user-facing meaning.

Assumptions:

- UI/content redesign is parked.
- AI-generated narrative is out of scope.
- No new event bus, backend aggregator, API response change, auth change, DB
  migration, or scoring/workflow behavior change is allowed in this slice.
- Audit events are operational evidence, not automatically user-facing product
  facts.

Repo evidence:

- `audit.event_log` already stores several lifecycle events for imports,
  snapshots, target approvals, checklist work, Store Action plans, and pilot
  feedback.
- Official read models already expose timestamps and source ids for import
  batches, snapshot runs, target requests, checklist instances, Store Action
  plans, and pilot feedback.
- The frontend already has source routes such as `/admin/integrations/:batchId`,
  `/admin/snapshots/:snapshotRunId`, `/admin/reports/snapshot-runs`,
  `/admin/targets`, `/store/approvals`, `/store/tasks`,
  `/store/checklists`, `/store/rankings`, and `/admin/pilot-feedback`.

Counterargument:

- A replay screen could be built quickly by reading audit logs directly, but
  that would mix internal audit metadata with user-facing facts and could leak
  private details or imply causality that the system has not proven.

Risk:

- LOW for this docs-only inventory.
- MEDIUM for a future read-only timeline adapter, because wording and ordering
  can make derived facts look causal.
- HIGH for persisted replay events, notification/escalation rules, AI
  summaries, or any metric that treats engagement/action events as performance
  evidence.

Door:

- Two-way for docs and pure read-only mapping helpers.
- One-way-ish for user-facing history, retention policy, and causality labels
  because operator trust is hard to restore after a wrong timeline claim.

Decision:

- Store Performance Replay can move from `parked_until_event_inventory` to
  `event_inventory_ready`.
- Do not build a timeline UI yet.
- The first implementation, if later approved, should be a pure read-only
  normalizer/test map that accepts already-fetched rows and returns sourced
  event candidates. It must not query new endpoints or infer impact.

## Readiness Codes

| Code | Meaning |
| --- | --- |
| READY | Stable source id, timestamp, scope, and source route exist. Safe for future read-only candidate mapping. |
| PARTIAL | Useful source exists, but event taxonomy, scope, redaction, or route semantics need a guard before product UI. |
| PARKED | Not safe for Replay until a separate data policy or product decision exists. |

## Event Source Inventory

| Source family | Candidate event(s) | Stable id | Timestamp(s) | Scope keys | Source route | Readiness | Guardrail |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Import batch lifecycle | `import_batch.created`, `import_batch.started`, `import_batch.retried`, row status `completed`, `completed_with_errors`, `failed` | `import_batch_id` | `started_at`, `finished_at`, `last_retried_at`, source window timestamps | company ids, source code, entity type | `/admin/integrations/:batchId` | PARTIAL | Terminal events are written by materialization flow/tests, but the audit catalog currently only lists created/started/retried. Before product UI, either use row status as the user-facing fact or align the catalog. Do not claim store performance impact from an import alone. |
| Snapshot run lifecycle | `snapshot_run.created`, `snapshot_run.rerun_requested`, `snapshot_run.started`, `snapshot_run.completed`, `snapshot_run.failed` | `snapshot_run_id` | `generated_at`, `started_at`, `finished_at` | company ids, snapshot type, period start/end | `/admin/snapshots/:snapshotRunId`, `/admin/reports/snapshot-runs` | READY | Use this as the official freshness/generation anchor for KPI, ranking, workforce, checklist, and turnover read models. |
| KPI/ranking period generated | Derived from completed `snapshot_run` plus reporting/ranking read models | `snapshot_run_id`, period keys | `generated_at`, period start/end | company ids, store/employee ids from read model | `/admin/reports/kpis/:snapshotRunId`, `/store/rankings` | PARTIAL | There is no separate ranking-generated event. Use snapshot completion as the source event; do not invent rank movement events unless comparing two official snapshots with explicit wording. |
| Target approval lifecycle | `target_distribution_request.created`, `target_distribution_request.approved` | `target_distribution_request_id` | `created_at`, `approved_at`, `updated_at` | company id, region id, store id | `/admin/targets`, `/store/approvals` | READY | Only submitted/approved are confirmed lifecycle events. Do not show returned/rejected unless a repository event and product route are added later. |
| Checklist lifecycle | `checklist_instance.created`, `checklist_instance.completed`, `checklist_instance.acknowledged`, row-state mobile completion | `checklist_instance_id`, acknowledgement id | `created_at`, `completed_at`, `acknowledged_at` | store id, template id, assigned/auditor employee where available | `/store/checklists`, `/admin/reports/checklists/:snapshotRunId` | PARTIAL | Admin checklist completion emits audit evidence; mobile completion currently has row-state completion without the same audit event in the checked repository path. Before Replay UI, choose row-state mapping or add a separate audited event slice. |
| Store Action lifecycle | `store_action_plan.created`, `store_action_plan.status_updated`, `store_action_plan.closed`, `store_action_plan.cancelled` | `store_action_plan_id` | `created_at`, `updated_at`, `due_on`, `closed_at`, `cancelled_at` | company id, region id, store id, owner user id, source ids | `/store/tasks` | READY | Safe as a human follow-up timeline. Do not claim it caused KPI/ranking movement unless a later analysis explicitly links official before/after snapshots. |
| Pilot feedback lifecycle | `pilot_feedback.created`, `pilot_feedback.classified` | `pilot_feedback_id` | `created_at`, `classified_at`, `updated_at` | pilot scope, actor roles, route path | `/admin/pilot-feedback` | READY | Use as pilot/operator context only. It is not a store/person performance fact. |
| Workflow inbox item | Existing read-only workflow item derived from target, workforce, Store Action, and other queues | source entity id by item type | due/created/update fields by source | role/scope/action-store dependent | `/admin/inbox`, source-specific deep link | PARTIAL | Inbox is an aggregation surface. Replay should link back to the source entity, not treat the inbox item as a primary event. |

## Explicitly Excluded For Now

- Raw login/session activity and per-user engagement events. These need the
  usage/performance correlation data policy first.
- Internal audit metadata that has no safe product route.
- Error logs, provider incidents, or infrastructure telemetry as store
  performance events. These belong to operations/readiness evidence.
- AI narrative, action recommendations, or causal claims.
- Generic event bus or event-sourcing architecture.

## First Safe Implementation Slice

If product code is later approved, start here:

1. Add a pure frontend or shared test-only mapper that accepts already-fetched
   source rows for Store Action, snapshot runs, import batches, target requests,
   checklist summaries, and pilot feedback.
2. Return a `ReplayEventCandidate` shape with:
   - `id`,
   - `sourceFamily`,
   - `sourceId`,
   - `occurredAt`,
   - `scope`,
   - `sourceRoute`,
   - `title`,
   - `safeSummary`,
   - `readiness`,
   - `redactionNotes`.
3. Unit test ordering, redaction, unknown-source handling, and no-causality
   wording.
4. Stop before adding a page, endpoint, timeline persistence, notification, or
   AI summary.

## Stop Rules

- Stop if a proposed event lacks a stable source id or timestamp.
- Stop if a route would expose a source outside the actor's role/scope/action
  store visibility.
- Stop if copy says or implies "caused", "because of", "improved due to", or
  "underperformed because" without a separately verified analysis.
- Stop if raw audit metadata would expose private payloads, actor internals,
  provider subjects, tokens, cookies, or secret-like ids.
- Stop if implementation needs a DB migration, new endpoint, auth semantics
  change, workflow state-machine change, or global UI redesign.

## Verification Ladder

Docs-only inventory:

1. `git diff --check`
2. `npm.cmd run test:scripts`

Future pure mapper:

1. Unit tests for mapping, ordering, redaction, and unknown-source fallback.
2. `npm.cmd --prefix admin-web run lint`
3. `npm.cmd --prefix admin-web run build`
4. Targeted Playwright only after a visible surface exists.
5. `npm.cmd run test:scripts` if route/docs/source matrices change.
