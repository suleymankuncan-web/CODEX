# Checklist Command Canvas Production Implementation Plan v1

**Status:** Approved for controlled implementation

**Date:** 2026-07-14

**Source prototype:** `D:\hr-axis-external-lab\prototypes\store-checklists-three-concepts-v1`

**Production route:** `/store/checklists`

## Objective

Translate the approved Command Canvas interaction and visual contract into the
production checklist surface using real scoped data. This is a product workflow
implementation, not a fixture or CSS transplant. It includes persistent weekly
BM visit planning and a store-scoped operational history. Broad production
enablement remains a separate owner gate.

## Locked decisions

- `last completed visit` and elapsed days come only from a real checklist
  instance with `status = 'completed'` and a non-null `completed_at`.
- Report Viewer reads its explicitly assigned company scope and cannot mutate.
- Region Manager reads its role-scoped regions and may maintain BM visit plans
  only for those regions.
- Store Manager reads only `roleScopes.STORE_MANAGER.storeIds` and cannot plan.
- Visual Merchandiser keeps the existing assigned-store VM execution flow and
  cannot maintain weekly plans in v1.
- Super Admin receives no implicit weekly-plan write capability.
- The prototype role switcher and fixture records never enter production.
- The production route is a replacement surface: no visible legacy checklist
  layout, duplicate legacy controls or old styling remnants remain beside the
  Command Canvas after cutover.
- The approved prototype is an exact visual and interaction contract. Component
  dimensions, spacing, typography, colors, controls, overlays and responsive
  behavior are compared at the acceptance viewports; material visual drift is
  not accepted as complete.
- Loading, empty, error, forbidden and partial-data states reflect real API
  outcomes.
- Mobile verification covers the weekly planner, long audit history and 30+
  store lists on real iOS Safari and Android Chrome.

## Domain contracts

### Command read model

`GET /api/checklists/command-canvas` is a server-filtered and server-paginated read
model. It returns scoped metrics, store rows, BM/VM completed scores, the latest
real completed visit, elapsed days, checklist state, pending acknowledgement and
open-task counts, risk reason codes, actor capabilities and an opaque next
page contract. Metrics use the complete search/region/period-filtered scope, not
only the current page or selected status card.

### Weekly visit plan

Weekly planning is a separate aggregate, not a repurposed
`ops.checklist_instance` draft:

- `ops.region_weekly_visit_plan`: region, Monday week start,
  `Europe/Istanbul` and `BM_STORE_VISIT`; unique per region/week/type.
- `ops.region_weekly_visit_plan_revision`: append-only complete snapshots with
  monotonic revision, actor, idempotency key, canonical request digest and one
  current-revision pointer.
- `ops.region_weekly_visit_plan_item`: revision, region, store, local date and
  `BM_STORE_VISIT`; cross-region stores, Sunday/out-of-week dates and exact
  same-store/day/type duplicates are rejected by the database.

The plan belongs to a region, not a named manager. A manager rotation transfers
the current plan while preserving creator/audit evidence. The same store may be
planned on different days in one week; an active exact store/type/day duplicate
is rejected. A full-week save is atomic and uses an expected revision; stale
writes return `409`.

Displayed status is derived from the current plan revision, Istanbul calendar
time and real checklist execution. Plan rows never store operational outcome:

- waiting (`Ziyaret Bekleniyor`): the plan date is today/future and no matching
  completion exists; today remains waiting through the Istanbul local day;
- missed (`Checklist yapılmadı`): the Istanbul local plan day ended without a
  matching completed checklist;
- completed (`Ziyaret Tamamlandı`): a real `BM_STORE_VISIT` checklist is completed for the store and
  its `completed_at` falls on the local plan date.

Reschedule/removal creates a new complete revision; revision content and items
cannot be updated or deleted. Only the prior current revision may transition
from current to retired. No historical plan backfill is invented, and existing
`checklist_instance.planned_at` rows are not repurposed.

### Living Store Record

`GET /api/stores/:storeId/operational-history` exposes an allowlisted,
cursor-paginated store timeline built from checklist visits, acknowledgements,
store action lifecycle and weekly-plan events. New events capture actor display,
role and assignment snapshots. Historical projection is explicitly labelled;
unknown historical identity is never replaced with the current manager.

## Delivery train

1. **R3 — Command read API:** repository/service/controller, role-specific
   scope, negative authorization tests, true completed-visit elapsed value,
   stable pagination and OpenAPI contract. No schema, UI or mutation.
2. **R2 — Region Manager Command UI:** production primitives, metrics,
   filters/sort/pagination, real checklist session reuse and responsive parity.
3. **R3 — Role views:** Report Viewer company hierarchy/read-only, Store
   Manager own-store view and VM/Super Admin compatibility.
4. **R5 — Visit-plan schema:** additive region-owned plan/revision/item tables,
   append-only guards, constraints/indexes, schema contracts and fresh-database
   plus rollback-only negative migration smoke.
5. **R4/R5 — Visit-plan API:** scoped GET/PUT, atomic revision save, audit,
   checklist linkage, conflict and cross-scope tests.
6. **R2 — Weekly planner UI:** one planner dialog, local draft then one save,
   real derived states, badge/count and mobile-safe layout.
7. **R4 — Living Store Record API:** bounded unified timeline, actor-time
   projection, privacy allowlist and performance tests.
8. **R2/R3 — History UI and closeout:** drawer/full-screen mobile history,
   incremental loading, accessibility/performance/device evidence and
   controlled staging enablement.

Every PR is independently reversible and uses a squash merge. UI, schema and
write boundaries are not mixed. PR checks are monitored in the background while
the next independent slice is prepared in another worktree; two full release
suites never run concurrently.

## Acceptance gates

- Report Viewer cannot read outside its company role scope and no mutation
  control or mutation endpoint is available to it.
- Region Manager cannot plan outside `roleScopes.REGION_MANAGER.regionIds`.
- Store Manager cannot read another store's command or history data.
- Metrics and rows derive from the same filtered server-side source.
- A plan is completed only by a real completed BM checklist for the same store
  and Istanbul local plan date.
- Simultaneous full-week saves produce one success and one revision conflict.
- Cancelling/rescheduling a plan never deletes checklist or audit history.
- Existing completed checklists appear in store history without plan backfill.
- Company-wide and 30/200-store reads do not introduce N+1 queries.
- OpenAPI generation and generated frontend types stay in sync.
- At 1440x900, 1024x768, 390x844 and 320px there is no page-level horizontal
  overflow; dialogs/drawers restore focus and own scrolling correctly.
- At those viewports, screenshot comparison also confirms exact prototype
  dimensions, spacing, typography, palette and control placement. The old
  checklist layout and duplicate controls are absent from the production DOM.

## Rollback and stop rules

- Disable visit-plan writes, fall back to the read-only Command surface, then
  restore the legacy checklist view if needed.
- Preserve additive plan tables and audit history during rollback; do not drop
  data as an emergency response.
- Before the schema slice, inventory existing staging
  `checklist_instance.status = 'planned'` records read-only. Never convert them
  automatically.
- Stop on an unresolved scope ambiguity, privacy leak, data-integrity failure,
  migration rehearsal failure or unavailable rollback path.
- Broad production enablement requires a separate explicit owner decision after
  controlled staging and real-device evidence.
