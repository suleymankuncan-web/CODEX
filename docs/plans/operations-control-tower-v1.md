# Operations Control Tower V1

## Reader And Action

Reader:

- A future engineer shaping the first operator-facing health/readiness overview.

After reading, they should be able to:

- build or review a read-only V1 control surface without inventing new backend
  behavior,
- know which signals are in scope,
- know which signals remain external-evidence blocked.

## Sokrates Decision

Claim:

- Store Ops needs one operator mental model for readiness and health signals,
  but the first control tower should be read-only and should compose existing
  signals.

Assumptions:

- The project already has enough health, import, snapshot, alert, queue, and
  readiness evidence to design the first surface.
- New APIs should be added only after existing signals prove insufficient.

Repo evidence:

- Backend health and operational monitoring docs define liveness, dependency,
  queue, observability, and alert signals.
- Readiness evidence docs separate public smoke, protected auth blockers,
  restore blockers, alert provider blockers, and Redis/BullMQ blockers.
- Integration/import detail surfaces already show quality and reconciliation
  data.
- Snapshot/reporting docs and tests already track snapshot runs and read models.

Counterargument:

- A unified dashboard could become another broad admin page. That is why V1 is
  explicitly read-only and signal-contract first.

Risk:

- LOW for this spec.
- MEDIUM for a later read-only UI using existing endpoints.
- HIGH if it introduces new operational writes, provider config, or auth/DB
  behavior.

Door:

- The spec is a two-way door.
- Provider config, DB restore, and queue/runtime changes are near one-way-door.

Stop rule:

- Stop if the first implementation needs a new write endpoint, migration,
  provider secret, auth behavior change, or invented data source.

## V1 Signal Groups

| Signal Group | What The Operator Needs To Know | Existing Source Shape | V1 Behavior |
| --- | --- | --- | --- |
| Backend health | Is the API alive, is DB reachable, is queue/Redis status acceptable for the current posture? | Health endpoints and operational monitoring contract. | Show status, mode, and blocker reason. |
| Frontend/deploy readiness | Is the current frontend/backend pair reachable and smokeable? | Deployed readiness smoke evidence and release checks. | Show latest known evidence and what is stale/blocked. |
| Auth/protected route readiness | Can real role-specific sessions hit protected routes? | Staging auth evidence docs and smoke scripts. | Mark blocked unless real bearer inputs exist. |
| Import health | Are latest batches successful, failed, retrying, or blocked by quality issues? | Import batch detail/list and quality summaries. | Show latest batch state and top issue families. |
| External ID mapping | Are unresolved mappings blocking materialization or reconciliation trust? | External mapping candidate/read surfaces. | Show unresolved mapping count and owner action. |
| Snapshot freshness | Are reporting snapshots completed for the expected period and source config? | Snapshot run read models and reporting surfaces. | Show latest completed/failed/stale state. |
| Queue/jobs | Is work process-local or durable; are retries/failures visible? | Queue health, import batch state, snapshot run state. | Show mode and durable-readiness blocker. |
| Alerts/incidents | Is alert routing metadata present; is provider delivery proven? | Operational monitoring contract and alert smoke evidence. | Show metadata status and provider blocker separately. |

## V1 Page Contract

The first surface should answer, in one screen:

- Can the pilot continue safely?
- What blocks broad production?
- Which data pipeline needs operator attention?
- Which signal is local-code ready but external-evidence blocked?
- Which signal is stale rather than failed?

Suggested sections:

1. Readiness summary.
2. Live/provider blockers.
3. Data pipeline health.
4. Snapshot and reporting freshness.
5. Queue and alert posture.
6. Operator action list.

## Explicitly Out Of Scope

- New write actions.
- Provider configuration.
- Restore execution.
- Redis/BullMQ enablement.
- Alert delivery configuration.
- New DB tables.
- New API Gateway or BFF.
- New workflow state machine.

## First Implementation Slice Later

Recommended first code/product slice:

- create a read-only admin/operator page or panel that uses existing health and
  already-generated/read endpoints only, with clear blocked-vs-failed language.

Verification later:

- admin lint,
- admin build,
- targeted Playwright for the page,
- no backend tests unless a backend read aggregation endpoint is explicitly
  added in a later plan.

## Current Implementation Status

The first read-only UI slice is implemented as `/admin/operations`.

What it does:

- reads public backend health and queue posture,
- reads import overview plus import needs-action preview,
- reads snapshot overview plus snapshot needs-action preview,
- derives a read-only data-quality snapshot from existing import and snapshot
  signals,
- derives a read-only operator action list from the same existing health,
  import, data-quality, snapshot, and external blocker signals,
- shows external/live evidence blockers as blocked-by-input rather than
  complete,
- keeps the route `SUPER_ADMIN` scoped for V1.

What it intentionally does not do:

- no backend aggregation endpoint,
- no write actions,
- no provider configuration,
- no DB migration,
- no auth/permission model change,
- no API response shape change.
- no data-quality workflow, mapping approval, import retry, scoring, or
  snapshot rerun behavior change.

Evidence:

- `docs/evidence/product-progress/2026-05-21-operations-control-tower-v1.md`
- `docs/evidence/product-progress/2026-05-21-operations-data-quality-signal-v1.md`
- `docs/evidence/product-progress/2026-05-21-operations-action-list-v1.md`
