# Operations Metrics And Bottleneck Readiness V1

## Reader And Action

Reader:

- A future engineer deciding which operational metrics should appear in
  `/admin/operations`, which domain owns each signal, and where a bottleneck
  should be fixed.

After reading, they should be able to:

- see every major metric topic that belongs in the control tower,
- separate live signals from planned or externally blocked signals,
- avoid inventing new metrics before the source of truth is known,
- pick the next smallest read-only implementation slice.

## Sokrates Decision

Decision:

- Keep `/admin/operations` as the metric/control-tower entry point, but do not
  pretend every domain already has a live aggregate metric.
- First add a metric ownership and coverage map, then expand live read models
  domain by domain only when the source, owner, threshold, and verification are
  clear.

Why now:

- The executive HTML flow correctly describes the system path, but it is an
  overview, not a bottleneck-monitoring source of truth.
- `/admin/operations` already composes backend health, import pressure,
  snapshot freshness, data quality, and external blocker signals.
- The next risk is hidden gaps: auth drift, workforce queues, workflow inbox
  pressure, reporting freshness, and release evidence can exist outside the
  current summary cards.

Evidence:

- `docs/plans/operations-control-tower-v1.md` defines the current page as
  read-only and existing-signal only.
- `docs/plans/cross-domain-data-quality-inventory-v1.md` identifies import,
  mapping, materialization, snapshot, KPI trust, and queue posture as the data
  trust chain.
- `docs/plans/authorization-matrix-drift-guard-v1.md` identifies auth matrix
  drift as a high-risk growth failure mode.
- `/admin/operations` currently reads public health, import overview and
  needs-action preview, snapshot overview and needs-action preview, and static
  external evidence blockers.
- The route is `SUPER_ADMIN` scoped and currently has targeted Playwright
  coverage in `admin-web/e2e/operations-control-tower.spec.ts`.

Counterargument:

- A single dashboard can become noisy or misleading if it mixes real metrics,
  inferred summaries, and wish-list signals. The page should therefore label
  each topic as live, planned, or externally blocked.

Risk:

- LOW for docs and a read-only coverage map.
- MEDIUM for future frontend read-only composition over more endpoints.
- HIGH for any new backend aggregation endpoint, DB schema, queue behavior,
  auth/permission change, provider configuration, or alert routing.

Door:

- The plan and coverage map are two-way doors.
- Provider config, DB restore, auth semantics, queue durability, and new write
  actions remain near-one-way-door work.

Stop rule:

- Stop if a proposed metric needs a new write endpoint, DB migration, auth
  broadening, scoring/math change, provider secret, queue behavior change, or
  unverified external runtime state.

Decision quality score:

- 4/5. Repo evidence and rollback are clear. The natural limit is that real
  staging/provider evidence still needs user-provided inputs.

## Metric Ownership Map

| Domain | Bottleneck Question | Current Source | Owner | V1 Status | Next Safe Slice |
| --- | --- | --- | --- | --- | --- |
| Backend / DB / Queue | Is the API alive, is DB reachable, and is queue posture acceptable? | Public `/api/health` payload. | Platform / backend. | Live in `/admin/operations`. | Add stale-age copy only if operators need it. |
| Integration / Import | Are imports failed, retry-ready, blocked, stuck, or producing errors? | Import overview and needs-action preview. | Integration operations. | Live in `/admin/operations`. | Add cross-batch trend only after source query is chosen. |
| Data Quality / Mapping | Are error rows, mapping blockers, or failed materialization signals visible? | Import needs-action preview plus import/snapshot overview. | Integration operations. | Partial live signal. | Add unresolved mapping backlog only from existing read endpoints. |
| Snapshot / Reporting | Are reports fresh, failed, retry-ready, or stuck? | Snapshot overview and needs-action preview. | Snapshot / reporting. | Live in `/admin/operations`. | Add latest reporting snapshot age only if the existing reporting endpoint already exposes it. |
| Auth / Role / Scope | Is route/endpoint access drifting from the matrix? | Auth matrix docs, backend auth tests, admin auth/audit pages. | Auth / pilot readiness. | Guarded, not live metric. | Add docs/test guard evidence link before any runtime metric. |
| Workforce Requests | Are seller-code/offboarding queues aging or piling up? | Workforce request read endpoints, Admin Inbox, and Store Approvals. | HR / store operations. | Live count/preview in `/admin/operations`. | Add queue age/overdue only after threshold ownership is decided. |
| Workflow Inbox | Are inbox items overdue, unseen, or concentrating by source type? | Workflow inbox endpoint and store/admin task surfaces. | Store operations. | Live count/urgency/preview in `/admin/operations`. | Add overdue/unseen only after threshold ownership is decided. |
| KPI / Rankings | Are KPI source trust, closed snapshot mode, and leaderboard freshness clear? | Reporting read models, KPI config, ranking pages. | Reporting / KPI governance. | Partly visible through snapshot/reporting pages. | Add source-trust/freshness caveat only as read-only copy unless source metrics exist. |
| Release / External Evidence | Which production blockers need real input? | Evidence docs, smoke scripts, health observability, provider state. | Platform / product owner. | Static blockers visible. | Convert a blocker to live only after real provider input exists. |

## Threshold Policy

Do not hard-code alert thresholds casually.

Allowed in V1:

- show exact counts returned by existing read models,
- mark any failed/unavailable signal as attention,
- mark existing `blocked`, `retry_ready`, `needs_action`, or `stuck` totals as
  operator pressure,
- label external evidence as input-needed instead of failed.

Not allowed without a separate decision:

- SLA/SLO promises,
- business threshold math,
- KPI scoring reinterpretation,
- queue-age escalation rules,
- automatic retry or remediation actions.

## Implementation Ladder

1. Docs-only ownership map and stop rules.
2. Read-only coverage map in `/admin/operations` that makes live/planned/blocked
   metric topics visible.
3. Add one domain's live read-only metric only when it can reuse an existing
   endpoint and has targeted Playwright coverage.
4. Add backend aggregation only if repeated frontend composition becomes
   fragile and the response contract is explicitly planned.
5. Add alerts, writes, provider config, or DB schema only under a separate
   high-risk decision.

## Verification Ladder

Docs-only:

- `git diff --check`.

Frontend read-only composition:

- `npm.cmd --prefix admin-web run lint`.
- `npm.cmd --prefix admin-web run build`.
- `npm.cmd --prefix admin-web run test:e2e -- operations-control-tower.spec.ts --workers=1`.

API contract:

- `npm.cmd --prefix backend/nestjs run openapi:generate`.
- `npm.cmd --prefix admin-web run api:generate`.
- `npm.cmd --prefix admin-web run api:check`.

Backend read model:

- targeted Jest for the owning repository/service/controller,
- backend build,
- full backend test only if the blast radius crosses domains.

## First Implementation Slice

Add a read-only metric coverage map to `/admin/operations`.

Scope:

- Shows which metric topics are live, planned, or external-input blocked.
- Links users to the current source surface when a safe route exists.
- Does not fetch new data.
- Does not add backend endpoints.
- Does not change API, auth, DB, scoring, import, snapshot, workflow, or
  workforce behavior.

Expected result:

- Operators can see that import/snapshot/backend/external signals are covered.
- Operators can also see that auth drift, workforce queues, workflow inbox
  pressure, and KPI/ranking source trust are not yet full live metrics.
- Future work starts from a named gap instead of a vague dashboard expansion.

## Current Implementation Status

Implemented:

- Metric coverage map is live in `/admin/operations`.
- Workforce request pressure is live in `/admin/operations` as a read-only
  pending HR approval count/preview over existing seller-code and offboarding
  read endpoints.
- Workflow inbox pressure is live in `/admin/operations` as a read-only
  count/urgency/preview over the existing workflow inbox endpoint.

Still planned:

- Auth drift runtime evidence beyond docs/test guards.
- KPI/ranking source-trust and leaderboard freshness.
- Release/external provider evidence closure.
