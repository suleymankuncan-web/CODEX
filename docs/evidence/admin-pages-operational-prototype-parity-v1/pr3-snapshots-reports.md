# PR3 - Snapshots And Reports

Date: 2026-06-30

## Scope

Routes covered:

- `/admin/snapshots`
- `/admin/snapshots/:snapshotRunId`
- `/admin/reports`
- `/admin/reports/snapshot-runs`
- `/admin/reports/workforce/:snapshotRunId`
- `/admin/reports/kpis/:snapshotRunId`
- `/admin/reports/checklists/:snapshotRunId`
- `/admin/reports/turnover/:snapshotRunId`

Prototype contract:

- `admin-web/src/prototypes/admin/snapshots-reports-v1.tsx`

## Behavior Frozen

- Snapshot overview, daily closure, needs-action queue, rerun mutation, dependency checks, lineage, audit export, and report selection APIs were not changed.
- Report CSV exports, sort options, search filters, route links, snapshot-run identifiers, KPI config version display, and table row calculations were preserved.
- Snapshot status semantic golden coverage remains the behavioral source for status labels and rerun visibility.

## UI Implementation

- Snapshot and report surfaces now use the shared `AdminOperationalPage`, `AdminOperationalHeader`, `AdminOperationalMetrics`, and `AdminOperationalSection` rhythm.
- The operational section primitive now supports `ariaLabel` and `eyebrow`, so migrated routes keep accessibility labels and compact section hierarchy without local wrapper forks.
- Detail reports keep dense operational tables and existing export controls while aligning to the PR1/PR2 admin operational visual system.

## Verification

Commands run:

```text
npm.cmd --prefix admin-web run lint
npm.cmd --prefix admin-web run build
npm.cmd --prefix admin-web run test:e2e -- snapshots-surfaces.spec.ts reports-surfaces.spec.ts kpi-config-versioning.spec.ts admin-routing.spec.ts
npm.cmd --prefix admin-web run test:scripts
npm.cmd run test:scripts
git diff --check
```

Results:

- Lint passed.
- Production build passed.
- Targeted Playwright passed: 39 tests.
- Frontend script tests passed: 63 tests.
- Root script tests passed: 488 tests.
- Diff whitespace check passed.

## Residual Risk

- This PR intentionally does not change snapshot/report business copy vocabulary globally, because existing localization and route semantics tests are the current compatibility contract.
- No backend, OpenAPI, DB, auth, or report calculation code changed.
