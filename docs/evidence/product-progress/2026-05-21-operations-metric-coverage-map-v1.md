# Operations Metric Coverage Map V1

## Scope

This slice turns the executive system-flow analysis into a concrete
operations-readiness step:

- create the metric ownership and bottleneck plan,
- show the major metric topics inside `/admin/operations`,
- label each topic as live, partial, planned, guarded, or input-blocked.

## Sokrates Decision

Claim:

- The control tower should help us see not only current pressure, but also
  which important operational topics are still missing or parked.

Assumptions:

- Existing import, snapshot, health, data-quality, and external blocker
  signals are already enough to show live V1 coverage.
- Auth, workforce, workflow, KPI/rankings, and release evidence should be named
  before they are implemented as live metrics.

Repo evidence:

- `/admin/operations` already reads backend health, import overview,
  import needs-action, snapshot overview, and snapshot needs-action.
- `docs/plans/operations-control-tower-v1.md` keeps V1 read-only.
- `docs/plans/authorization-matrix-drift-guard-v1.md` identifies auth drift as
  high risk.
- `docs/plans/cross-domain-data-quality-inventory-v1.md` identifies
  cross-domain data-quality and queue posture gaps.

Counterargument:

- Adding more content to the control tower can create dashboard noise. The
  coverage map stays concise and does not fetch or invent new metric values.

Risk:

- LOW to MEDIUM. It changes one admin read-only page and targeted route test
  coverage, but does not change behavior or data flow.

Door:

- Two-way door. A squash revert removes the coverage map and plan.

Stop rule used:

- Stop if this needed a new endpoint, DB schema, auth/permission change,
  provider input, queue behavior change, KPI/ranking math change, import retry,
  mapping approval, snapshot rerun, or workflow semantics. It did not.

## What Changed

- Added `docs/plans/operations-metrics-bottleneck-readiness-v1.md`.
- Added a read-only metric coverage panel to `/admin/operations`.
- Kept the coverage panel in `admin-web/src/pages/operations-metric-coverage-panel.tsx`
  so `OperationsControlTowerPage.tsx` stays under 1000 lines after the slice.
- Updated Turkish and English operations copy for metric ownership/coverage.
- Extended the Operations Control Tower E2E test to guard the coverage map and
  source-surface links.

## What It Intentionally Does Not Do

- No backend aggregation endpoint.
- No API response shape change.
- No auth, role, permission, or route access behavior change.
- No DB migration.
- No provider or runtime configuration.
- No import retry, materialization, mapping approval, snapshot rerun, scoring,
  ranking, workforce command, or workflow behavior change.

## Verification

- `git diff --check` - passed, with only Windows CRLF warnings.
- `npm.cmd --prefix admin-web run lint` - passed.
- `npm.cmd --prefix admin-web run build` - passed.
- `npm.cmd --prefix admin-web run test:e2e -- operations-control-tower.spec.ts --workers=1` - passed, 5/5.
- `npm.cmd --prefix admin-web audit --omit=dev` - passed, 0 vulnerabilities.

## Residual Risk

- Workflow inbox, auth drift, KPI/ranking source trust, and release evidence
  are now visible as coverage topics, but they are not live control tower
  metrics yet.
- The next code slice should choose exactly one of those planned topics and
  reuse existing read endpoints if possible.
