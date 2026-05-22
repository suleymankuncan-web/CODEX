# Store Action V1B Lifecycle Contract V1

## Scope

This evidence records the second Store Action V1B implementation kademe:
audit catalog metadata and lifecycle contract helpers.

It does not add a controller, endpoint, service command, repository command,
OpenAPI schema, generated frontend client, workflow inbox source, UI behavior,
audit event write, KPI scoring change, checklist rule, target approval change,
DB migration, or auth semantic change.

## Sokrates Decision

Decision:

- Add the four Store Action audit event types to the canonical audit catalog.
- Add feature-owned lifecycle constants and helpers for statuses, priorities,
  source type, terminal statuses, transition checks, and terminal evidence
  requirements.
- Keep runtime writes out until assigned-store command authorization,
  repository transactions, and audit writes are tested in a later kademe.

Why now:

- The schema exists, but service/repository work needs a stable lifecycle
  contract before commands can be implemented safely.
- The audit catalog already enforces event-name discipline; adding the event
  constants now prevents future repository code from inventing uncataloged
  names.

Repo evidence:

- `backend/nestjs/src/modules/store-ops/application/store-action-plan.contract.ts`
  owns Store Action lifecycle and audit event constants.
- `backend/nestjs/src/shared/audit/audit-event-catalog.ts` catalogs
  `store_action_plan.created`, `store_action_plan.status_updated`,
  `store_action_plan.closed`, and `store_action_plan.cancelled`.
- `backend/nestjs/src/modules/store-ops/application/store-action-plan.contract.spec.ts`
  locks lifecycle values, transition rules, terminal evidence requirements,
  and catalog metadata.

Counterargument:

- Cataloging audit events before repository writes could look premature. The
  safer version is to keep them as feature-audit metadata and contract constants
  only; no runtime event emission is introduced in this kademe.

Risk:

- MEDIUM. This touches audit metadata and future write lifecycle definitions,
  but it does not execute writes or expose a new API.

Door:

- Two-way. The PR can be reverted without data repair because it does not change
  schema, data, provider config, runtime behavior, or public API contracts.

## Lifecycle Boundary

Allowed statuses:

- `open`
- `in_progress`
- `blocked`
- `closed`
- `cancelled`

Allowed source type:

- `kpi_exception`

Approved transitions:

- `open` -> `in_progress`, `blocked`, `closed`, `cancelled`
- `in_progress` -> `blocked`, `closed`, `cancelled`
- `blocked` -> `in_progress`, `closed`, `cancelled`
- terminal statuses do not transition further

Terminal evidence:

- `closed` requires a resolution note in the later command layer.
- `cancelled` requires a cancel reason in the later command layer.

## Verification

Passed locally:

```powershell
npm.cmd --prefix backend/nestjs test -- store-action-plan.contract.spec.ts audit-event-catalog.spec.ts
git diff --check
```

Result:

```text
Test Suites: 2 passed, 2 total
Tests: 7 passed, 7 total
```

## Next Kademe

Next safe implementation step:

- add repository/service command tests and command orchestration,
- prove assigned-store negative authorization,
- prove duplicate active source conflict handling,
- prove create/update/close/cancel audit writes,
- still do not expose API/UI until command authorization and audit behavior are
  proven.
