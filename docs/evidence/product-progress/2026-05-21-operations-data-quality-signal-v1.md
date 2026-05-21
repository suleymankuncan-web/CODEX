# Operations Data Quality Signal V1

Date: 2026-05-21

## Decision

Add a small read-only data-quality signal to `/admin/operations` instead of
creating a new data-quality dashboard, backend aggregation endpoint, workflow,
or schema.

## Why

The cross-domain data-quality inventory identified a real growth risk: import
quality, mapping blockers, materialization pressure, and snapshot freshness are
visible in different places. The safest next step is to elevate existing
signals in the Operations Control Tower without changing the underlying
workflow.

## Scope

This slice derives a data-quality snapshot from existing frontend query data:

- import needs-action preview error rows,
- import needs-action `blockedByEntityTypes`,
- import overview blocked batch count,
- snapshot overview needs-action/retry/stuck counts.

## Out Of Scope

- No backend endpoint.
- No DB migration.
- No auth, role, permission, or scope change.
- No API response shape change.
- No import retry, mapping approval, materialization, scoring, or snapshot
  rerun behavior change.
- No new global data-quality workflow.

## Verification

Local gates:

- `git diff --check` - passed, with only Windows CRLF warnings.
- `npm.cmd --prefix admin-web run lint` - passed.
- `npm.cmd --prefix admin-web run build` - passed.
- `npm.cmd --prefix admin-web run test:e2e -- operations-control-tower.spec.ts --workers=1` - 5/5 passed.
- `npm.cmd run test:scripts` - 236/236 passed.
- `npm.cmd --prefix admin-web run test:scripts` - 21/21 passed.
- `npm.cmd --prefix admin-web audit --omit=dev` - 0 vulnerabilities.
- `npm.cmd --prefix admin-web run check:release` - passed:
  OpenAPI types current, lint clean, 21/21 script tests, build passed,
  165/165 Playwright tests passed, production audit 0 vulnerabilities.
- After the final summary-card tone dependency adjustment, reran:
  `npm.cmd --prefix admin-web run lint`, `npm.cmd --prefix admin-web run build`,
  and `npm.cmd --prefix admin-web run test:e2e -- operations-control-tower.spec.ts --workers=1`;
  all passed.

## Residual Risk

This is a V1 signal only. It does not replace import detail, mapping queues, or
snapshot detail pages as the source of truth. Cross-batch quality trends and a
dedicated data-quality dashboard remain parked until an explicit product need
or operator feedback appears.
