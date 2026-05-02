# DM / CONFIG Boundary Strategy

## Purpose

This note records where business rules, dynamic configuration, jobs, API/BFF behavior, and schema ownership live today.

The goal is to avoid adding new schemas or modules just because the product is growing. New layers should appear only when they solve a real ownership, versioning, audit, or reuse problem.

## Decision Summary

Do not create separate `dm` or `config` database schemas yet.

For now:

- `DM` is a conceptual business-rule boundary implemented through typed backend contracts, application services, and tested repositories.
- `CONFIG` is split between runtime environment config and module-owned data config.
- `JOB` is a backend orchestration/runtime layer, not a database schema.
- `API/BFF` is currently Nest controllers plus frontend feature API helpers; no standalone BFF is needed yet.

The current model is still healthy because ownership is understandable:

- operational truth lives in `ops`
- external ingestion and normalization staging live in `stg`
- immutable reporting snapshots/read models live in `rpt`
- traceability lives in `audit`

## CODEX DURUST YORUM

The ChatGPT suggestion is directionally good, but applying it literally today would be premature.

Adding `dm` and `config` schemas now would make the project look more enterprise-ready, but it would also create new places to put half-formed logic. That is exactly how projects start feeling organized on paper and confusing in practice.

The better move is this:

- keep current schemas stable
- document the boundary
- keep business rules typed and tested in services/contracts
- keep data-driven config close to the module that owns it
- promote to `dm` or `config` only when the same rule/config is versioned, audited, business-editable, and reused across multiple modules

My honest read: the project is not under-architected right now. The bigger risk is over-splitting before the product proves which rules really need independent lifecycle management.

## Current Physical Schemas

### `ops`

Owner of operational truth and current module configuration.

Examples:

- organization and workforce
- auth users, roles, permissions and assignments
- action store assignments
- checklists
- KPI definitions, targets and actuals
- KPI score profile config
- target distribution requests
- competition plans, stages, teams and templates
- operational feed posts

Rule:

- Put mutable business workflow state here when it is the source of truth.
- Put module-owned data config here when it affects operational behavior and needs audit or admin control.

### `stg`

Owner of external source ingestion and pre-operational staging.

Examples:

- integration sources
- import batches
- raw imported employees, stores, positions, assignments and KPI rows
- external id mapping
- integration source polling schedule fields

Rule:

- Keep source lineage here.
- Do not place final business decisions here.

### `rpt`

Owner of immutable reporting snapshots and read models.

Examples:

- snapshot runs
- store KPI snapshots
- employee KPI snapshots
- employee performance snapshots
- competition score snapshots
- competition warnings

Rule:

- Reporting consumes truth; it does not redefine truth.
- Do not put business-rule ownership into `rpt`.

### `audit`

Owner of traceability.

Examples:

- event log
- before/after JSON payloads
- actor, scope and correlation metadata

Rule:

- Audit records what happened; it should not become workflow state.

## DM Boundary

In this project, `DM` should mean "domain model / decision model", not automatically a DB schema.

Today `DM` lives in:

- backend application services
- typed contract files
- repository query behavior
- tests that lock rules

Examples:

- feed visibility and writer guards in `FeedService`
- competition package plan lifecycle in `CompetitionService`
- action/read scope separation in auth context and service guards
- KPI scoring behavior in KPI config contracts and reporting/closed-ranking services
- import normalization and materialization rules in integration services
- snapshot immutability and daily closure rules in snapshot services

### When `dm` Schema Becomes Worth It

Consider a real `dm` schema only when at least three of these are true:

- a rule must be versioned over time
- a business user edits the rule, not only a developer
- multiple modules consume the same rule
- the rule needs approval/publish lifecycle
- the rule must be simulated before publish
- audit needs to answer "which rule version produced this result?"
- rollback to an older rule version is required

Potential future `dm` candidates:

- incentive / prim rule plans
- score formula versioning
- competition eligibility and advancement rules
- KPI exception threshold rules
- challenge qualification rules
- localization rule packs if labels become business-owned rather than code-owned

## CONFIG Boundary

`CONFIG` is not one thing. It has three different meanings in this project.

### 1. Runtime Config

Owned by environment variables and `AppConfigService`.

Examples:

- auth mode and JWT settings
- database URL and pool settings
- Redis and queue backend
- import/snapshot queue names
- daily closure automation settings

Rule:

- Keep infra/runtime behavior in env-backed config.
- Do not let business users edit runtime config from the product UI.

### 2. Module-Owned Data Config

Owned by the module that uses it.

Examples:

- `ops.kpi_score_profile_config`
- `stg.integration_source` polling schedule fields
- `ops.role`, `ops.permission`, `ops.role_permission`
- future competition presets/templates while they are competition-owned

Rule:

- If config changes product behavior and must be audited, keep it in the owning module schema until it clearly becomes cross-module.

### 3. Frontend/UI Config

Owned by frontend contracts and later the localization layer.

Examples:

- label dictionaries
- route label maps
- UI option lists that mirror backend enum contracts

Rule:

- User-facing language can move toward a localization foundation.
- API enum values, role codes, permission codes, metric codes and audit event codes stay stable.

## JOB Boundary

`JOB` currently exists as code orchestration:

- `shared/jobs`
- BullMQ and in-memory dispatchers
- worker host services
- `workers.ts`
- snapshot scheduler and daily closure worker
- import batch and snapshot job payloads

Current persistent state lives in the business owner tables:

- import state in `stg.import_batch`
- snapshot state in `rpt.snapshot_run`
- audit state in `audit.event_log`

Do not create a separate job schema yet.

Consider persistent job tables only if:

- retry history becomes product-visible
- job dependencies/DAGs become configurable
- operators need a cross-module job console
- long-running work needs durable pause/resume/cancel state beyond BullMQ and owner tables

## API / BFF Boundary

Today the API/BFF boundary is:

- Nest controllers as backend API surface
- frontend feature API helper files
- route-level frontend pages that compose the calls

This is enough for now.

Consider a dedicated BFF layer only if:

- admin/store shells repeatedly need the same multi-endpoint aggregation
- route performance suffers because pages need too many sequential calls
- frontend starts duplicating permission or shaping logic
- mobile or another client needs a different view contract

Until then, keep controllers close to their module and keep frontend API helpers typed.

## Placement Rules

Use this placement table for new work:

| Need | Put It Here Now | Do Not Put It Here |
| --- | --- | --- |
| Operational workflow state | `ops` | `rpt` |
| External raw/source state | `stg` | `ops` unless materialized |
| Immutable report output | `rpt` | `ops` |
| Trace/audit trail | `audit` | business tables only |
| Runtime/env behavior | `AppConfigService` | DB config |
| Module-specific dynamic config | owning schema/table | global config schema |
| Cross-module versioned business rules | service/contracts now, future `dm` later | ad hoc JSON without contract |
| Store/admin page data shaping | controller + frontend feature API | standalone BFF too early |

## Guardrails

- Do not add schemas for appearance.
- Do not turn `rpt` into a business-rule dump.
- Do not let `CONFIG` become an untyped JSON graveyard.
- Do not let Feed calculate scores.
- Do not let Competition own company announcement streams.
- Do not let frontend-only logic decide permission or scope.
- Do not let jobs become hidden sources of truth.

## Migration Trigger Checklist

Before creating `dm` or `config`, answer yes to these:

1. Is this rule/config used by more than one module?
2. Does it need draft/publish or approval lifecycle?
3. Does audit need to know the exact version used?
4. Does a business user need to edit it?
5. Does it require simulation, rollback, or comparison?
6. Would keeping it inside the current owner module create duplicate logic?

If fewer than three answers are yes, keep it in the current owner module.

## Immediate Project Decision

For the next phase:

- keep current schemas: `ops`, `stg`, `rpt`, `audit`
- do not add `dm` schema
- do not add `config` schema
- continue to use `ops.kpi_score_profile_config` for KPI scoring config
- continue to use `AppConfigService` for runtime config
- keep jobs as code orchestration with owner-table state
- use this note during future feature intake interviews

## Next Review Point

Revisit this decision when one of these starts:

- incentive / prim rules
- rule-versioned competition formats
- KPI threshold configuration with publish/approval lifecycle
- localized label packs managed outside code
- cross-module operator job console
