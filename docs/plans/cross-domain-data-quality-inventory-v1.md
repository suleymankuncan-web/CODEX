# Cross-Domain Data Quality Inventory V1

## Reader And Action

Reader:

- A future engineer deciding how to make data trust visible across import,
  mapping, materialization, snapshots, KPI source trust, and operator surfaces.

After reading, they should be able to:

- identify which data-quality signal already exists,
- identify which signal belongs in a future read-only control tower,
- avoid inventing a new data-quality workflow before the existing signals are
  connected.

## Sokrates Decision

Claim:

- Data quality is already partially guarded, but the growth risk is that each
  domain reports health differently and operators cannot see the end-to-end
  trust picture.

Assumptions:

- Import quality, mapping, snapshot freshness, KPI source trust, and failed
  materialization should be connected before a new dashboard or workflow is
  implemented.
- Existing read models should be reused first.

Repo evidence:

- Import row failures have stable quality issue codes.
- Import batch detail has batch-level quality summary.
- External ID mapping candidates and approval audit exist.
- Source-agnostic import boundary records canonical mapping and scoring rules.
- Snapshot tables are immutable read models and snapshot runs track run state.
- KPI source policy keeps imported source rows distinct from scoring truth.

Counterargument:

- A dedicated data-quality dashboard sounds like the obvious next step. It may
  be right later, but without a signal inventory it risks duplicating import
  detail, snapshot, and mapping surfaces.

Risk:

- LOW for this inventory.
- MEDIUM for a later read-only data-quality page.
- HIGH if it changes materialization, scoring, mapping approval, DB schema, or
  retry/write behavior.

Door:

- The inventory is a two-way door.
- Mapping approval, materialization retry, and snapshot rerun behavior changes
  are near one-way-door and need their own plans.

Stop rule:

- Stop if a proposed data-quality slice changes scoring, ranking, snapshot,
  import status transitions, external ID mapping approval semantics, or DB
  schema.

## Signal Inventory

| Signal | Current Meaning | Current Coverage | Gap |
| --- | --- | --- | --- |
| Import row quality code | Why a row failed or needs cleanup. | Quality issue catalog and import error responses. | Needs cross-batch trend visibility before heavy operator rollout. |
| Batch quality summary | Dominant issue families in one import batch. | Import batch detail response and UI panel. | Not yet summarized across latest batches in one operator view. |
| External ID mapping candidates | Which source IDs may map to internal stores/personnel. | Mapping candidate/read surfaces and approval audit. | No single readiness signal showing unresolved mapping backlog by source/entity. |
| Source lineage | Where a row came from and how it was normalized. | Source-agnostic import boundary and lineage metadata. | Future source adapters still require real sample evidence before implementation. |
| Materialization failure | Whether accepted staging data reached operational tables. | Import batch status, error rows, retry/status paths. | Failed materialization needs clearer operator-level grouping by cause. |
| Snapshot freshness | Whether reports reflect latest completed snapshot period. | Snapshot run read models and reporting pages. | Needs stale/failed/missing distinction in a control-tower view. |
| KPI source trust | Whether KPI values are official scoring inputs or reconciliation evidence. | KPI source policy and scoring docs. | Needs surface-level trust language when source data is partial or late. |
| Queue/retry posture | Whether background work is process-local, durable, failed, or retrying. | Health/queue docs, import batch state, snapshot run state. | Cross-domain stuck/failed job signal is not yet unified. |

## V1 Control-Tower Data Quality Cards

When the operations control tower is implemented, data quality should appear as
read-only cards:

1. Latest import batch health.
2. Top unresolved quality issue families.
3. External mapping backlog.
4. Materialization status.
5. Snapshot freshness.
6. KPI source trust caveat.
7. Queue/retry status.

## Explicitly Out Of Scope

- New connector implementation.
- New source payload assumptions.
- Mapping auto-approval.
- New retry policy.
- New score math.
- Snapshot rerun behavior changes.
- DB migrations.
- Global data-quality workflow implementation.

## First Implementation Slice Later

Recommended first code/product slice:

- add one read-only operator summary using existing import batch and mapping
  read endpoints, or place those signals in the first operations control tower
  V1 surface.

Current status:

- The first read-only product slice places a data-quality snapshot in
  `/admin/operations`.
- It derives the signal only from existing import needs-action preview,
  import overview, and snapshot overview data.
- It shows preview error-row pressure, visible mapping blocker entity types,
  blocked import batches, and snapshot issue pressure.
- It does not add a backend aggregation endpoint, data-quality workflow, DB
  migration, API response shape change, mapping approval behavior, import retry
  behavior, scoring change, or snapshot rerun behavior.
- Evidence:
  `docs/evidence/product-progress/2026-05-21-operations-data-quality-signal-v1.md`.

Verification later:

- admin lint/build,
- targeted integration Playwright,
- backend tests only if a new read aggregation endpoint is intentionally added.
