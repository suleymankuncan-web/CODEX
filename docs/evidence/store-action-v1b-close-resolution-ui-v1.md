# Store Action V1B Close Resolution UI V1

Date: 2026-05-23

## Decision

The next terminal Store Action UI slice is limited to closing an existing active
persisted action plan from `/store/tasks` with a required resolution note.

In scope:

- generated frontend helper for
  `PATCH /api/store-actions/plans/{actionPlanId}/close`,
- one inline close form on active action-plan rows,
- required `resolutionNote` input,
- local 403/409/422-style error rendering through the shared API error path,
- refetch/invalidation for Store Action plans and workflow inbox after success.

Out of scope:

- cancel commands and cancel reasons,
- reopen, comments, attachments, notifications, escalation, or action-plan
  detail routes,
- non-KPI action sources,
- DB migration, backend auth semantics, workflow state-machine changes,
- KPI/checklist/target scoring changes,
- API response-shape changes or broad UI redesign.

## Repo Evidence

- `admin-web/src/features/store-actions/api.ts`
- `admin-web/src/features/store-actions/StoreActionPlanCloseControl.tsx`
- `admin-web/src/features/store-actions/StoreActionPlansPanel.tsx`
- `admin-web/src/features/localization/messages/store-tasks.ts`
- `admin-web/e2e/store-surfaces.spec.ts`

## Verification

Target local gates for this slice:

- `npm.cmd --prefix admin-web run lint`
- `npm.cmd --prefix admin-web run api:check`
- `npm.cmd --prefix admin-web run build`
- `npm.cmd --prefix admin-web run test:e2e -- store-surfaces.spec.ts --grep "store tasks"`
- `npm.cmd run system-flow:generate`
- `npm.cmd run test:scripts`
- `git diff --check`

## Next Slice

Cancel remains a separate terminal decision. Do not combine it with comments,
attachments, notifications, escalation, non-KPI sources, or action-plan detail
routes.
