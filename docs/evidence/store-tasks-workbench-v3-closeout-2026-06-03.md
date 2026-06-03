# Store Tasks Workbench V3 Closeout - 2026-06-03

## Scope

This closeout records the Store Tasks V3 PR train that moved `/store/tasks`
from a broad shared work queue into a role-aware operational workbench with
real Store Action and Workflow Inbox data.

## Merged PRs

| PR | Merge commit | Scope |
| --- | --- | --- |
| #643 | `879882fe73a0462ea3779df95fc1c95cdbd3c1d9` | Store Tasks Workbench V3: role-aware manager/region surfaces, real Store Action plans, workflow rows, visual QA evidence. |
| #644 | `146ee726373bda3d2300326681a032c40c3045fe` | Store Tasks command dialog: status, close, and cancel commands moved from rows into the detail dialog; detail fetch failure keeps commands available from the loaded list row. |
| #645 | `29b700ca619870f93b811ac20ac2adec9451fc71` | Store Tasks evidence detail: extracted the detail dialog and separated source/status evidence, lifecycle, audit trace, and command sections. |

## Behavior Preserved

- API response shapes were not changed.
- DB schema and migrations were not changed in this UI train.
- Auth and permission semantics were not changed.
- Assigned-store Store Action command scope remains enforced by the backend.
- Store Action lifecycle semantics were not changed: status update, close with
  resolution note, and cancel with reason continue through the existing
  endpoints and payloads.
- Checklist acknowledgement and checklist remediation remain separate source
  meanings.
- Region managers read scoped Store Tasks evidence but do not approve, reject,
  reopen, close, cancel, or verify Store Action plans in V1.

## Data Honesty

- Store manager rows render from real `/api/store-actions/plans` and
  `/api/workflow/inbox` responses.
- Region manager rows render from real workflow-inbox remediation visibility.
- No fake Store Action, checklist, KPI, target, projection, ranking, coaching,
  notification, or workflow data was added.
- Target projection runtime generation remains parked until the backend
  projection-calendar/source contract exists.

## Verification Summary

PR #643:

- `npm.cmd --prefix admin-web run lint` - pass
- `npm.cmd --prefix admin-web run build` - pass
- `npm.cmd run test:scripts` - pass, 406/406
- `npm.cmd --prefix admin-web run test:e2e -- store-action-plans.spec.ts store-surfaces.spec.ts -g "store tasks|tasks by direct route|Store tasks"` - pass, 22/22
- desktop/mobile visual QA for store-manager and region-manager views - pass, no horizontal overflow

PR #644:

- `npm.cmd --prefix admin-web run lint` - pass
- `npm.cmd --prefix admin-web run build` - pass
- `npm.cmd run test:scripts` - pass, 406/406
- `npm.cmd --prefix admin-web run test:e2e -- store-action-plans.spec.ts` - pass, 19/19
- Codex P1 for detail-fetch command availability was fixed before merge.

PR #645:

- `npm.cmd --prefix admin-web run lint` - pass
- `npm.cmd --prefix admin-web run build` - pass
- `npm.cmd run test:scripts` - pass, 406/406
- `npm.cmd --prefix admin-web run test:e2e -- store-action-plans.spec.ts` - pass, 19/19

Closeout docs PR:

- `git diff --check` - pass
- `npm.cmd run test:scripts` - pass, 406/406

Remote gates:

- GitHub `frontend-release-check` - pass for #643, #644, and #645
- GitHub `release-check` - pass for #643, #644, and #645
- GitHub `release-rehearsal` - pass for #643, #644, and #645
- Vercel preview - ready for #643, #644, and #645
- Codex release-blocking review - clean before #643, #644, and #645 merge

## Remaining Parked Work

- Target projection task generation is approved only by
  `docs/plans/store-action-target-projection-v1.md` and remains unimplemented
  until the projection calendar/source contract is ready.
- Photo/file evidence, comments, attachments, notifications, escalation,
  reassignment, reopen/delete behavior, and region-manager verification remain
  outside this V3 closeout.
- Store personnel remains outside `/store/tasks` route scope unless a separate
  product decision creates a personnel-specific task surface.

## Rollback

Each runtime PR is independently revertible:

- #643 reverts the Store Tasks V3 surface.
- #644 reverts command placement back out of the detail dialog.
- #645 reverts the extracted evidence-detail component and visible section
  grouping.

No migration rollback, data repair, queue drain, or provider state change is
required for this PR train.
