# Store Action V1B Create From KPI Candidate UI V1

Date: 2026-05-22

## Decision

The first Store Action write UI is implemented only as a create-only action from
an existing `kpi_exception` workflow candidate on `/store/tasks`.

In scope:

- generated frontend write helper for `POST /api/store-actions/plans`,
- one inline create affordance on existing KPI follow-up rows,
- required title, summary, due date, and priority inputs,
- `sourceType: "kpi_exception"` only,
- safe in-app `sourceDeepLink` forwarding,
- local 403/409/422-style error rendering through the shared API error path,
- refetch/invalidation for Store Action plans and workflow inbox after success.

Out of scope:

- status, close, or cancel commands,
- comments, attachments, notifications, escalation, or action-plan detail routes,
- non-KPI checklist or target-derived action sources,
- DB migration, backend auth semantics, workflow state-machine changes,
- KPI/checklist/target scoring changes,
- API response-shape changes or broad UI redesign.

## Repo Evidence

- `admin-web/src/features/store-actions/api.ts`
- `admin-web/src/features/store-actions/StoreActionPlanCreateControl.tsx`
- `admin-web/src/pages/StoreTasksPage.tsx`
- `admin-web/src/features/localization/messages/store-tasks.ts`
- `admin-web/e2e/store-surfaces.spec.ts`

## Verification

Local gates:

- `npm.cmd --prefix admin-web run lint`
- `npm.cmd --prefix admin-web run api:check`
- `npm.cmd --prefix admin-web run build`
- `npm.cmd --prefix admin-web run test:e2e -- store-surfaces.spec.ts --grep "store tasks"`
- `npm.cmd --prefix admin-web run test:e2e -- pilot-smoke.spec.ts --grep "core store routes"`
- `npm.cmd run system-flow:generate`
- `npm.cmd run test:scripts`

Notes:

- Playwright gates must run after the build and one target at a time on port
  `4174`; parallel preview runs can reuse stale `dist` or collide on the same
  server. The targeted Store Tasks and pilot smoke gates passed after sequential
  reruns.
- Backend code was not changed in this slice.

## Next Slice

Consider status update only as a separate decision and PR. Do not combine it
with close/cancel, comments, attachments, notifications, escalation, or non-KPI
sources.
