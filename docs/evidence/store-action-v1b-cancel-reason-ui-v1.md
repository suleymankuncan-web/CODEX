# Store Action V1B Cancel Reason UI V1

Date: 2026-05-23

## Decision

The final V1B terminal Store Action UI slice is limited to cancelling an
existing active persisted action plan from `/store/tasks` with a required cancel
reason.

In scope:

- generated frontend helper for
  `PATCH /api/store-actions/plans/{actionPlanId}/cancel`,
- one inline cancel form on active action-plan rows,
- required `cancelReason` input,
- local 403/409/422-style error rendering through the shared API error path,
- refetch/invalidation for Store Action plans and workflow inbox after success.

Out of scope:

- reopen, delete, comments, attachments, notifications, escalation, or
  action-plan detail routes,
- non-KPI action sources,
- DB migration, backend auth semantics, workflow state-machine changes,
- KPI/checklist/target scoring changes,
- API response-shape changes or broad UI redesign.

## Repo Evidence

- `admin-web/src/features/store-actions/api.ts`
- `admin-web/src/features/store-actions/StoreActionPlanCancelControl.tsx`
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

Store Action V1B create, active status update, close, and cancel are now covered
at the Store Tasks UI boundary. Future work should be a separate decision for
detail routes, comments, attachments, notifications, escalation, non-KPI source
families, or live staging persona evidence.
