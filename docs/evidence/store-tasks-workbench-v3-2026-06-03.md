# Store Tasks Workbench V3 Evidence - 2026-06-03

## Scope

- Reworked `/store/tasks` as a role-aware operational workbench.
- Store manager view uses the real Store Action plan list and existing
  create/status/close/cancel controls.
- Region manager view uses the real workflow inbox remediation rows in a
  read-only surface.
- Store personnel remains out of scope for this route.
- No fake Store Action, checklist, target projection, KPI, or ranking data was
  added.

## Behavior Preserved

- API response shapes were not changed.
- Store Action command semantics were not changed.
- Assigned-store command scope remains enforced by the backend.
- Checklist acknowledgement, checklist prefetch, approval workflow, scoring,
  ranking, import, and snapshot behavior were not changed.
- Region manager can inspect scoped remediation work but cannot create, update,
  close, or cancel Store Action plans from this page.

## Data And Empty State Rules

- Persisted action plans render from `/api/store-actions/plans`.
- Workflow candidate rows render from `/api/workflow/inbox`.
- Duplicate workflow rows are suppressed only when a persisted action plan
  matches the same action plan id or source key.
- KPI/projection rows are shown only when existing workflow or Store Action
  data exists. Target projection generation remains parked until the backend
  contract exists.
- Missing source links render as an honest unavailable-source state instead of
  fake navigation.

## Visual QA

| Persona | Viewport | Screenshot | Horizontal overflow |
| --- | --- | --- | --- |
| Store manager | Desktop | `docs/evidence/store-tasks-workbench-v3-manager-desktop-2026-06-03.png` | 0 |
| Store manager | Mobile | `docs/evidence/store-tasks-workbench-v3-manager-mobile-2026-06-03.png` | 0 |
| Region manager | Desktop | `docs/evidence/store-tasks-workbench-v3-region-desktop-2026-06-03.png` | 0 |
| Region manager | Mobile | `docs/evidence/store-tasks-workbench-v3-region-mobile-2026-06-03.png` | 0 |

## File Size Guard

- `admin-web/src/pages/StoreTasksPage.tsx` - 556 lines
- `admin-web/src/features/store-tasks/store-tasks-workbench.tsx` - 646 lines
- `admin-web/src/features/store-tasks/store-tasks-workbench-model.ts` - 257 lines

## Verification

- `npm.cmd --prefix admin-web run lint` - pass
- `npm.cmd --prefix admin-web run build` - pass
- `npm.cmd run test:scripts` - pass, 406/406
- `npm.cmd --prefix admin-web run test:e2e -- store-action-plans.spec.ts store-surfaces.spec.ts -g "store tasks|tasks by direct route|Store tasks"` -
  pass, 22/22
- `git diff --check` - pass
