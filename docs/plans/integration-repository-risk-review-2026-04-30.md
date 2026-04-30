# IntegrationRepository Risk Review - 30 April 2026

## Purpose

Review `backend/nestjs/src/modules/integration/infrastructure/integration.repository.ts` as a backend maintainability and scale risk without changing production code.

This is not a refactor plan and not a new adapter plan.

No application behavior was changed by this review.

## Current Shape

Observed file:

- `backend/nestjs/src/modules/integration/infrastructure/integration.repository.ts` - 2322 physical source lines

The file currently owns several related integration persistence responsibilities:

- import batch creation and raw staging writes for employee, store, KPI, assignment, position, company, and region rows
- integration source list/create/activate/deactivate/schedule/audit reads
- active scheduled integration source listing
- external ID mapping candidate reads and audit evidence writes
- KPI import store scope list/update reads and writes
- import batch list/summary/latest-status reads
- import action counts and needs-action queue classification
- import batch detail, row status, lineage, quality issue, dependency, error, audit, and retry evidence reads/writes

This repository is large because it is the persistence boundary for source-agnostic import, evidence, retry, and source governance. It is not obviously random code.

## Green Signals

- Import source and batch behavior has broad e2e coverage split across:
  - `backend/nestjs/test/integration/import-batch.e2e-spec.ts`
  - `backend/nestjs/test/integration/import-batch-evidence.e2e-spec.ts`
  - `backend/nestjs/test/integration/integration-sources.e2e-spec.ts`
- The guard in `scripts/test-suite-hygiene-contract.test.mjs` freezes 32 import/integration e2e tests across those three files.
- Import batch idempotency exists through `idempotency_key` and `source_batch_id`.
- Raw KPI lineage fields are first-class columns: `row_hash` and `raw_row_reference`.
- Integration source deactivation has a guard when active import batches exist.
- Store KPI import scope is explicit through `ops.store.kpi_import_enabled`.
- Audit events are written for key source, batch, retry, mapping, and store-scope changes.
- Dynamic table use is bounded by `getRawTableMetadata`, which maps known entity types to known staging table names.

## Risks

### P1 - Repository Ownership Density

One repository owns raw staging writes, source governance, store-scope admin updates, evidence read models, retry queue classification, dependency summaries, and audit evidence.

Risk:

- unrelated future changes may land in the same file,
- review diff context becomes harder,
- a source-adapter change could accidentally touch evidence or retry behavior.

This is a maintenance risk, not an active production bug.

### P1 - Raw Table Query Scale

Several read paths repeatedly query or union raw staging tables by `import_batch_id`, `normalized_status`, and `validation_error`:

- action totals
- needs-action queue
- row status summary
- quality issue rows
- dependency summary
- error row pagination

Current schema has strong import-batch/source indexes and KPI lineage indexes, but the raw staging tables do not yet have a measured index strategy for high-volume real imports.

Risk:

- real Excel or future JSON volumes may make needs-action and detail pages slower,
- speculative indexes could also add write cost before real evidence exists.

Decision:

- do not add indexes now without real import volume or local staging query evidence,
- when real data exists, measure these paths first.

### P1 - Error Classification Uses Message Text

Dependency blockers are classified through `validation_error ILIKE` message patterns.

Risk:

- changing validation copy could change retry/blocked classification,
- future source adapters may introduce new dependency wording that is not classified.

Decision:

- do not change this now,
- future improvement should be a stable row-level issue code for dependency class, not more text matching.

### P2 - createImportBatch Raw Insert Branch Density

`createImportBatch` contains separate insert branches for seven entity types.

Risk:

- adding a new entity type or source-specific column could make this method harder to audit,
- row identity fallback rules such as `"unknown"` need to stay deliberate and tested.

Decision:

- do not extract this until a new entity type or adapter forces the boundary,
- first future split should isolate raw staging writers by entity type with no behavior change.

### P2 - Audit Write Repetition

Several methods repeat the same `audit.event_log` insert pattern with slightly different metadata.

Risk:

- future audit metadata fields may drift,
- repeated correlation/requested actor fields can be forgotten in new methods.

Decision:

- not active debt today because audit event catalog and e2e evidence exist,
- a small local audit helper can be considered only when adding a new integration audit event.

### P2 - SELECT Star In CTE Outputs

The file uses `SELECT *` only against shaped CTE outputs (`action_totals`, `action_queue`), not arbitrary tables.

Risk:

- low today, but explicit columns would make long-term review easier.

Decision:

- not worth touching alone; include only inside a future mechanical cleanup with tests.

## No-Go Decisions

- Do not split `IntegrationRepository` only because it is large.
- Do not add raw table indexes without real volume/query evidence.
- Do not implement source-specific JSON adapter work without real sample payload or official field list.
- Do not change retry/blocked classification without a stable issue-code plan.
- Do not mix repository boundary cleanup with import behavior, scoring, materialization, or master-data promotion changes.

## Recommended Future Split Order

If a future integration change touches this repository, use this order:

1. Extract a raw staging writer boundary for `createImportBatch` entity-specific inserts.
2. Extract integration source governance reads/writes into a source repository boundary.
3. Extract import batch evidence/read-model queries into an evidence repository boundary.
4. Extract retry/action-queue read models only after stable issue-code classification exists.
5. Run targeted import/integration e2e tests and root release gate after each mechanical slice.

## Recommended Performance Review Trigger

Open a measured performance/index review only when one of these is true:

- real Excel baseline import has enough rows to exercise raw table queries,
- a real JSON/source adapter sample exists,
- local staging has production-like import batch row counts,
- admin import detail or needs-action queue becomes visibly slow.

Candidate measurements:

- `stg.*_raw(import_batch_id, normalized_status)`
- `stg.*_raw(import_batch_id, normalized_status, processed_at)`
- dependency blocker query paths that currently inspect `validation_error`
- `stg.import_batch(status, started_at)` for stuck/needs-action scans

No index should be added without before/after query evidence.

## Decision

Status: `planned_investment`

This repository is a real pressure point, but not an urgent refactor target.

The correct near-term rule is: do not keep adding unrelated import/source/evidence behavior here without a boundary decision. The first actual split should happen only when a concrete integration change touches one of the named boundaries.

## CODEX DURUST YORUM

This file is important enough to respect and dangerous enough not to casually refactor.

The good news: the project already reduced risk around this area by splitting import/source/evidence tests and guarding 32 e2e cases. That means we are not blind.

The honest risk: when real data volume arrives, this repository will be one of the first places where hidden performance cost can appear. The answer is not panic-indexing today. The answer is to keep the import boundary stable, collect real row volume, and then measure.

## Recommended Next Move

Do not refactor this repository now.

If external source/master-data evidence is unavailable, the next local review candidate is `backend/nestjs/src/modules/store-ops/infrastructure/store-ops.repository.ts`, because it is a broad operational repository and may carry scope-sensitive behavior.
