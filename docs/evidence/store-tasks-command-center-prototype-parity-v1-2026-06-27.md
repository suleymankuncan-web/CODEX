# Store Tasks Command Center Prototype Parity V1 Evidence

Date: 2026-06-28

Branch: `codex/store-tasks-command-center-parity`

## Result

Prototype parity: PASS

The production `/store/tasks` surface now follows the approved command-center
prototype as the implementation contract: compact command header, four metric
cards, search/filter toolbar, command queue, right-side drawer, Store Manager
commands, and Region Manager read-only result/open-follow-up modes.

## Scope Verified

- Store shell, Lufian header/sidebar, auth/session handling, Store Action API
  shape, DB schema, and lifecycle statuses were preserved.
- Prototype-only role switcher, prototype rail, and fake data were not copied.
- Visible Store Tasks sources are only `Checklist` and `Projeksiyon`.
- `target_distribution_request` and target approval rows are excluded from
  `/store/tasks`; target work remains in `/store/targets`.
- Store Manager commands use existing Store Action mutations:
  `İşleme al`, `Bloke et`, `Çözüm bildir`.
- Region Manager can read assigned-store action plans but gets no create,
  status, close, cancel, or correction command buttons.
- Region Manager read visibility remains constrained to
  `actionScope.assignedStoreIds`; no `readScope` or region fallback was added.
- Period filtering uses Store Action assignment/creation date and workflow
  attention/creation date. Open prior-period rows remain visible as `Devreden`.

## Visual Evidence

Captured from local production preview at `http://127.0.0.1:4174/store/tasks`
using mocked Store Manager and Region Manager sessions.

- Desktop Store Manager:
  `docs/evidence/screenshots/store-tasks-command-center-2026-06-27/store-tasks-sm-desktop.png`
- Store Manager drawer:
  `docs/evidence/screenshots/store-tasks-command-center-2026-06-27/store-tasks-sm-drawer.png`
- Mobile Store Manager:
  `docs/evidence/screenshots/store-tasks-command-center-2026-06-27/store-tasks-sm-mobile.png`
- Region Manager results:
  `docs/evidence/screenshots/store-tasks-command-center-2026-06-27/store-tasks-rm-results.png`
- Region Manager open follow-ups:
  `docs/evidence/screenshots/store-tasks-command-center-2026-06-27/store-tasks-rm-open-followups.png`

Visual inspection result:

- Desktop: columns, status badges, metrics, toolbar, and drawer align with the
  approved prototype rhythm.
- Mobile: cards stack in one column, no horizontal overflow was visible, and the
  command queue remains usable.
- Drawer: source, facts, source link, next step, command box, and history are
  right-side drawer surfaces, not the old modal/detail dialog.
- Region Manager: default result view and `Açık takipler` view are read-only.

## Verification

Passed:

```powershell
npm.cmd --prefix admin-web run lint
npm.cmd --prefix admin-web run build
npm.cmd --prefix admin-web run test:e2e -- store-action-plans.spec.ts
npm.cmd --prefix admin-web run test:e2e -- store-surfaces.spec.ts
npm.cmd --prefix backend/nestjs test -- --runInBand src/modules/store-ops/web/store-action-plan.controller.spec.ts src/modules/store-ops/application/store-action-plan.service.spec.ts src/modules/store-ops/application/workflow-inbox.service.spec.ts
```

Final observed results:

- `store-action-plans.spec.ts`: 6 passed.
- `store-surfaces.spec.ts`: 83 passed.
- Backend Store Action suites: 3 suites / 26 tests passed.
- Frontend lint and build passed.

Kalıntı scan:

```powershell
rg -n "workflowRuleTitle|workflowRuleCopy|storeTasks\.tab\.targets|Store action list|Action command|Open detail|Create action plan|target_distribution_request|Hedef" admin-web/src/pages/StoreTasksPage.tsx admin-web/src/features/store-tasks
```

Result: no matches in Store Tasks production route/component files.

## Intentional Notes

- Store Action plan list responses still do not include a first-class store
  display name. The UI now uses matching workflow store names by action plan or
  store id when available, with store id only as a last-resort fallback. A
  backend read-model enhancement can remove that fallback later.
- Store Tasks command-center copy is Turkish-first in this parity slice. No new
  English localization keys were introduced because the accepted prototype and
  pilot workflow are Turkish.
- Pilot Region Manager smoke remains dependent on action-store assignments
  matching the stores the Region Manager is expected to inspect.
