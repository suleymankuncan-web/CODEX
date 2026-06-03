# Store Tasks Evidence Detail V1 - 2026-06-03

## Scope

- Extracted the Store Tasks persisted action-plan detail dialog from the main
  workbench file into a focused feature component.
- Reorganized the dialog into real source/status evidence, lifecycle snapshot,
  audit trace, and command sections.
- Kept the command panel behavior from the prior PR: active store-manager
  commands remain available even when detail fetch fails.

## Behavior Preserved

- API response shapes were not changed.
- Store Action status, close, and cancel endpoints and payloads were not
  changed.
- Assigned-store command scope remains enforced by the existing backend
  contract.
- Region-manager Store Tasks visibility remains read-only.
- Target projection runtime generation remains parked until the backend
  projection-calendar contract exists.
- No fake Store Action, checklist, KPI, target, projection, ranking, or
  workflow data was added.

## Evidence Confidence

- The detail dialog now exposes the source link inside the same context where
  the operator reads the plan evidence.
- Technical ids remain visible in an audit trace section instead of being mixed
  with the first operational evidence block.
- Resolution and cancel evidence stay visible as existing Store Action fields.

## File Size Guard

- `admin-web/src/pages/StoreTasksPage.tsx` - 620 lines
- `admin-web/src/features/store-tasks/store-tasks-workbench.tsx` - 539 lines
- `admin-web/src/features/store-tasks/StoreActionPlanDetailDialog.tsx` - 186 lines
- `admin-web/src/features/store-tasks/StoreActionPlanCommandPanel.tsx` - 27 lines
- `admin-web/src/features/store-tasks/store-tasks-workbench-model.ts` - 257 lines

## Verification

- `npm.cmd --prefix admin-web run lint` - pass
- `npm.cmd --prefix admin-web run build` - pass
- `npm.cmd run test:scripts` - pass, 406/406
- `npm.cmd --prefix admin-web run test:e2e -- store-action-plans.spec.ts` -
  pass, 19/19
- `git diff --check` - pass
