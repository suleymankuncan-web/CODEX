# System Flow Fanout And Bottleneck Audit V1

## Scope

This is a source-derived bottleneck audit for the generated system-flow map.
It does not claim live traffic, latency, request volume, query cost, database
load, or provider behavior.

The goal is to separate static route fanout from real runtime pressure
candidates before adding more telemetry or UI.

## Sokrates Decision

Decision:

- Use the generated route/API map to identify candidate pressure points, then
  validate each candidate against page-level query guards, stale-time posture,
  prefetch behavior, and existing tests before promoting it to runtime
  telemetry work.

Why now:

- The precision fix removed false fanout from route preloaders, so the map is
  now useful as an audit input.
- The unlinked endpoints and auth overlay are already classified.
- The next risk is treating static API reachability as if it were live request
  pressure.

Evidence:

- `docs/flows/store-ops-system-flow.json` currently reports 51 frontend
  routes, 130 matched frontend API calls, 164 backend/OpenAPI endpoints, 193
  route/API edges, 34 backend endpoints without frontend calls, and 4 routes
  without API calls.
- The highest static fanout route is `/admin/competitions` with 23 route/API
  edges, but page code shows only the competition list and selected detail read
  are runtime reads on normal entry.
- `/admin/operations` intentionally composes 10 read-only signals across six
  domains and already applies a shared `SIGNAL_STALE_TIME_MS`.
- `/admin/master-data`, `/store/approvals`, `/admin/auth`, `/admin/inbox`, and
  `/store/tasks` all have meaningful enabled guards, stale times, or
  action-triggered prefetch behavior that static fanout alone cannot express.

Counterargument:

- Static code evidence can still miss payload size, database query shape,
  production cardinality, and user behavior. Any future "this is slow" claim
  still needs browser/network, staging smoke, APM, backend logs, or database
  query evidence.

Risk:

- LOW for this docs-only audit.
- MEDIUM for future frontend read-only telemetry composition.
- HIGH for auth semantics, write flows, backend aggregate endpoints, DB schema,
  queue behavior, provider config, alert routing, or SLO/threshold promises.

Door:

- This audit is a two-way door.
- Runtime telemetry with new contracts is medium-door work.
- Auth/provider/DB/queue production decisions remain near-one-way-door work.

Stop rule:

- Stop if the next slice tries to fix a supposed bottleneck without runtime
  evidence, changes API response shape, changes auth/permission behavior,
  changes DB schema, changes queue behavior, or adds hard thresholds without
  an owner decision.

## Static Fanout Snapshot

Generated from `docs/flows/store-ops-system-flow.json` after PR #401.

| Static rank | Route | Edges | Domains | Method mix | Initial interpretation |
| --- | --- | ---: | --- | --- | --- |
| 1 | `/admin/competitions` | 23 | competitions 22, auth 1 | 12 POST, 6 GET, 3 PATCH, 2 PUT | High static command surface; not automatically high initial read pressure. |
| 2 | `/admin/auth` | 14 | auth 14 | 6 GET, 4 PATCH, 4 POST | Sensitive admin surface; broad invalidations and ungated core reads make it a runtime watch point. |
| 3 | `/admin/master-data` | 12 | integrations 12 | 7 GET, 3 POST, 2 PATCH | Import/master-data payload risk; tab and batch guards reduce initial load. |
| 4 | `/admin/master-data/:batchId` | 12 | integrations 12 | 7 GET, 3 POST, 2 PATCH | Same component as `/admin/master-data`; detail/readiness reads depend on batch id. |
| 5 | `/store/approvals` | 12 | workforce 8, target-distributions 4 | 6 GET, 3 POST, 3 PATCH | Cross-domain store workflow; role/persona guards reduce load but mutation invalidations can create pressure. |
| 6 | `/admin/operations` | 10 | reports 2, snapshots 2, workforce 2, integrations 2, workflow 1, health 1 | 10 GET | Deliberate multi-domain read-only aggregation; strongest telemetry host and polling-risk candidate. |
| 7 | `/admin/inbox` | 8 | workforce 7, workflow 1 | 4 GET, 4 PATCH | Queue/action surface with guards and stale time; watch mutation invalidations. |
| 8 | `/store/tasks` | 8 | workforce 4, target-distributions 2, workflow 1, checklists 1 | 7 GET, 1 POST | Inbox entry plus conditional prefetch; pressure depends on task item source types. |
| 9 | `/admin/feed` | 7 | admin 6, auth 1 | 5 POST, 2 GET | Command-heavy admin surface; static count is not a runtime-read alarm. |
| 10 | `/admin/integrations` | 7 | integrations 7 | 4 GET, 3 POST | Import operations surface; real pressure likely comes from import payload size and needs-action queue. |
| 11 | `/admin/integrations/:batchId` | 7 | integrations 7 | 5 GET, 2 POST | Detail page has payload and row/error risk; needs runtime evidence before optimization. |
| 12 | `/admin/audit` | 6 | auth 4, snapshots 1, integrations 1 | 6 GET | Read-only audit surface; sensitive but not obviously broad pressure. |
| 13 | `/store/checklists` | 6 | mobile 4, checklists 2 | 4 POST, 1 GET, 1 PATCH | Store workflow surface; mobile/acknowledgement endpoints deserve evidence before more changes. |

## Runtime Guard Evidence

### `/admin/competitions`

Static fanout is high because the page imports competition command helpers.
Runtime entry is more controlled:

- `CompetitionDashboardPage.tsx` reads `['competitions']` with `staleTime:
  30_000`.
- Detail reads use `['competition-detail', selectedCompetitionId]`, are
  `enabled` only when a competition exists, and use `staleTime: 15_000`.
- The remaining static fanout is mostly create/recalculate/finalize/stage-plan
  command surface, not automatic entry traffic.

Decision:

- Do not treat this as the first telemetry bottleneck. Revisit only with
  browser/network evidence or user-reported slowness around detail loads.

### `/admin/auth`

The auth admin page is a stronger watch point than its static count alone:

- Core reads load users, role assignments, action-store assignments, and
  lookups on entry.
- User and store search queries are correctly gated by a minimum two-character
  search term.
- Mutations invalidate multiple broad auth query families.
- No page-local stale time is visible on the core auth queries in the current
  page code.

Decision:

- Keep as MEDIUM-HIGH risk because it is security-sensitive and broad. Do not
  optimize blindly. If touched, first add targeted query/empty/error evidence
  or a read-only test guard rather than changing auth behavior.

### `/admin/master-data` and `/admin/master-data/:batchId`

The static count is high, but runtime is partly bounded:

- Batch list uses `staleTime: 30_000`.
- Batch detail and promotion-readiness reads are enabled only when `batchId`
  exists.
- Store master and personnel master reads are enabled only on their active tab.
- Master-data write invalidations are scoped to batches/detail/readiness or
  the active master-data query family.

Decision:

- MEDIUM-HIGH candidate for future payload/latency telemetry because the data
  can grow large, not because every edge fires at once.

### `/store/approvals`

This page is cross-domain and action-heavy:

- Target requests are enabled only when the persona can list requests and is
  not read-only.
- Store-targeting personnel reads require target submission visibility.
- Workforce position, employee, rejected seller-code, and rejected
  offboarding reads require the workforce HR queue posture.
- Mutations invalidate target, seller-code, offboarding, and store employee
  query families.

Decision:

- MEDIUM risk. Runtime pressure depends on role/persona and mutation use. It
  is a good candidate for targeted Playwright/network evidence if operators
  report slow store approval workflows.

### `/admin/operations`

This route intentionally aggregates many domains:

- It reads health, import overview, import needs-action, snapshot overview,
  snapshot needs-action, seller-code queue, offboarding queue, workflow inbox,
  KPI config, and rankings.
- Every query uses shared `SIGNAL_STALE_TIME_MS`.
- Existing Playwright coverage checks read-only composition, `SUPER_ADMIN`
  route scope, error posture, workforce/workflow/KPI error handling, and mobile
  bounded width.

Decision:

- MEDIUM-HIGH as the main aggregator and the right place for operator
  telemetry. The safe next move is not to add more calls by default; it is to
  document which existing signals already cover integrations, snapshots,
  workforce, workflow, reports, health, and external blockers, then only add a
  missing read if a real source and test path exist.

### `/admin/inbox`

Runtime posture is controlled:

- Workflow inbox, seller-code reference, seller-code requests, and offboarding
  requests all have role/feature `enabled` guards.
- These reads use `staleTime: 30_000`.
- Mutation invalidations are directed at the affected queue families.

Decision:

- MEDIUM. It is operationally important, but current query posture is healthier
  than raw static fanout implies.

### `/store/tasks`

Runtime posture depends on task content:

- The page reads workflow inbox only when `canUseWorkflowInbox` is true.
- Checklist acknowledgements are prefetched only when a checklist receipt
  action is present.
- Store approval prefetch tasks are run only when a store approval action is
  present and each prefetch task remains individually enabled.

Decision:

- MEDIUM-LOW for initial load, MEDIUM for task-heavy sessions. Keep the
  conditional prefetch pattern; measure before changing.

## Bottleneck Risk Map

| Candidate | Current risk | Why | Next safe evidence |
| --- | --- | --- | --- |
| `/admin/operations` | MEDIUM-HIGH | Multi-domain aggregator; strongest place to see pressure, but also easiest page to over-poll. | Keep existing 30s stale time; add no new reads unless a missing signal has source, owner, and targeted E2E. |
| `/admin/master-data` | MEDIUM-HIGH | Import/master-data payloads and row-level readiness can grow large. Guards reduce initial load. | Browser/network evidence on list/detail/tab changes or backend timing evidence before optimization. |
| `/admin/auth` | MEDIUM-HIGH | Sensitive auth data, broad invalidations, core reads without visible stale time. | Targeted auth query/error evidence before changing cache behavior; preserve auth semantics. |
| `/store/approvals` | MEDIUM | Cross-domain store workflow and mutation invalidations. | Targeted store approvals E2E/network pass for manager and region personas. |
| `/admin/competitions` | MEDIUM | Static command surface is large; runtime entry is list/detail gated. | Revisit only if stage detail or plan history is slow with real data. |
| `/admin/inbox` | MEDIUM | Queue/action surface; guarded reads and stale time reduce pressure. | Keep as operations metric source; measure queue age/volume only after threshold ownership. |
| `/store/tasks` | MEDIUM-LOW | Conditional inbox and prefetch pattern limits initial load. | Verify task-heavy sessions if real users report slow navigation. |

## Milestone 5 Input

Operations Telemetry V1 should not start by inventing a broad observability
platform. The safe path is:

1. Treat `/admin/operations` as the live operator surface, but cap new fetches.
2. Prefer existing signal summaries already present in the page:
   - health/DB/queue posture,
   - import overview and needs-action,
   - snapshot overview and needs-action,
   - workforce pending HR approval queues,
   - workflow inbox pressure,
   - KPI config and ranking readiness,
   - external evidence blockers.
3. Add runtime evidence only when a missing signal has:
   - an existing endpoint or read model,
   - a clear owner,
   - no API/auth/DB behavior change,
   - targeted Playwright or backend test coverage,
   - a rollback story.

Recommended next slice:

- Start Milestone 5 with a small evidence/guard pass that checks whether
  `/admin/operations` already covers all high-risk static fanout domains after
  this audit. Only implement code if that pass finds one clear missing live
  read with an existing endpoint and test path.

## Verification

For this docs-only audit:

- `git diff --check`
- `npm.cmd run test:scripts`

