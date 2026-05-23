# Data Quality Center V1

Date: 2026-05-23
Track: Project Growth Execution Roadmap V1 / Track 2
Status: implementation slice in progress

## Sokrates Decision

Decision:

- Add a read-only `/admin/data-quality` surface for `SUPER_ADMIN`.

Why:

- Pilot feedback and Store Action work need a clear way to separate data defects
  from product defects.
- Operations Control Tower already has a compact data-quality card, but
  operators need a focused page that shows import, mapping, snapshot, workforce,
  and KPI source-trust pressure together.

Guardrails:

- No import retry behavior change.
- No mapping approval behavior change.
- No snapshot rerun behavior change.
- No KPI scoring or source-trust rule change.
- No backend contract, auth semantics, DB schema, provider config, or global CSS
  behavior change.

## Signals Used

- `/api/integrations/import-batches/overview`
- `/api/integrations/import-batches/needs-action`
- `/api/snapshots/runs/overview`
- `/api/snapshots/runs/needs-action`
- `/api/workforce/seller-code-requests?status=pending_hr_approval`
- `/api/workforce/offboarding-requests?status=pending_hr_approval`
- `/api/reports/kpi-config`
- `/api/reports/rankings`

## Verification Plan

Local gates for this slice:

- `npm.cmd --prefix admin-web run lint`
- `npm.cmd --prefix admin-web run build`
- `npm.cmd --prefix admin-web run test:e2e -- data-quality-center.spec.ts`
- `npm.cmd --prefix admin-web run test:e2e -- operations-control-tower.spec.ts`
- `npm.cmd run system-flow:generate`
- `node --test scripts/file-size-guard.test.mjs`
- `npm.cmd run test:scripts`
- `git diff --check`

## Current Notes

- The new surface is intentionally not a data repair workflow.
- Track 3 should continue by expanding Operations Telemetry V2 only after this
  read-only data-quality separator merges cleanly.
