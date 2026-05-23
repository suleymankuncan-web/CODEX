# Store Action V1B Status Update UI V1

Date: 2026-05-22

## Decision

The next Store Action write UI slice is limited to non-terminal status updates
for existing persisted action plans on `/store/tasks`.

In scope:

- generated frontend helper for
  `PATCH /api/store-actions/plans/{actionPlanId}/status`,
- one inline status form on persisted action-plan rows,
- status values limited to `open`, `in_progress`, and `blocked`,
- optional note forwarding through the existing API body,
- local 403/409/422-style error rendering through the shared API error path,
- refetch/invalidation for Store Action plans and workflow inbox after success.

Out of scope:

- close or cancel commands,
- resolution notes, cancel reasons, comments, attachments, notifications, or
  escalation,
- non-KPI action sources,
- DB migration, backend auth semantics, workflow state-machine changes,
- KPI/checklist/target scoring changes,
- API response-shape changes or broad UI redesign.

## Repo Evidence

- `admin-web/src/features/store-actions/api.ts`
- `admin-web/src/features/store-actions/StoreActionPlanStatusControl.tsx`
- `admin-web/src/features/store-actions/StoreActionPlansPanel.tsx`
- `admin-web/src/pages/StoreTasksPage.tsx`
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

Close and cancel remain separate decisions. Do not combine terminal lifecycle
commands with comments, attachments, notifications, escalation, non-KPI sources,
or action-plan detail routes.
