# Store Tasks Command Dialog V1 Evidence - 2026-06-03

## Scope

- Moved persisted Store Action status, close, and cancel commands out of the
  Store Tasks row action strip and into the existing action-plan detail dialog.
- Kept the row compact: persisted plans expose detail/source navigation at row
  level; command forms open only after the operator inspects detail context.
- Reused the existing Store Action control components and mutation endpoints.

## Behavior Preserved

- API response shapes were not changed.
- Store Action lifecycle commands, payloads, query invalidation, and error
  handling were not changed.
- Assigned-store command scope remains enforced by the existing backend
  contract.
- Region-manager Store Tasks visibility remains read-only.
- Checklist receipt acknowledgement and checklist remediation semantics remain
  separate.

## Evidence Confidence

- The command panel appears only for active persisted plans when the current
  Store Tasks persona can mutate Store Action plans.
- Detail fetch can fall back to the list-row plan when a test or transient
  response lacks the detail envelope; the page no longer enters the route error
  boundary for that partial response.
- Detail fetch failure does not block active plan commands. The dialog shows the
  detail error while keeping status, close, and cancel controls available from
  the already-loaded list-row plan.
- Source links and unsafe source-link filtering remain row-level behavior.

## File Size Guard

- `admin-web/src/pages/StoreTasksPage.tsx` - 620 lines
- `admin-web/src/features/store-tasks/store-tasks-workbench.tsx` - 656 lines
- `admin-web/src/features/store-tasks/StoreActionPlanCommandPanel.tsx` - 27 lines
- `admin-web/src/features/store-tasks/store-tasks-workbench-model.ts` - 257 lines

## Verification

- `npm.cmd --prefix admin-web run lint` - pass
- `npm.cmd --prefix admin-web run build` - pass
- `npm.cmd run test:scripts` - pass, 406/406
- `npm.cmd --prefix admin-web run test:e2e -- store-action-plans.spec.ts -g "persisted action plan|status|close|cancel|checklist remediation" --reporter=line` -
  pass, 14/14
- `npm.cmd --prefix admin-web run test:e2e -- store-action-plans.spec.ts -g "keeps close failures local" --reporter=line` -
  pass, 1/1
- `npm.cmd --prefix admin-web run test:e2e -- store-action-plans.spec.ts` -
  pass, 19/19
- `git diff --check` - pass

Note: one full spec run hit a transient blank preview page after a stale
Playwright preview process. The stale process was stopped, the app was rebuilt,
the isolated failing test passed, and the full spec passed on the next run.
