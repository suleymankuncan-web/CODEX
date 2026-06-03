# Store Tasks Prototype Parity V1 - 2026-06-03

## Scope

This evidence records the `/store/tasks` visual parity pass against the
approved Store Tasks Workflow V3 prototype reviewed in this thread.

The slice is UI-only. It tightens the production Store Tasks surface toward the
approved prototype structure, palette, density, and detail-dialog treatment
while keeping existing Store Action and Workflow Inbox behavior unchanged.

## What Changed

- `/store/tasks` now uses the prototype-style Store Action heading, compact
  metric cards, workflow rule band, filter toolbar, segmented source tabs,
  queue panel, primary row CTA, and detail dialog/bottom-sheet treatment.
- The HTML prototype's demo role switcher was not shipped. Production role
  behavior remains resolved from the authenticated user's actual role and
  scope; no manual prototype role view remains on the page.
- Store Tasks status/tone colors were aligned to the prototype token family:
  amber pending/open, rose checklist/blocked/critical, cyan informational, mint
  completed, violet primary actions, and `#071631`/`#62708a` text hierarchy.
- Queue rows were reworked to the prototype grid rhythm: source icon, action
  copy, source, evidence, status badge, and one CTA. The panel count now reads
  as work count, not legacy action-plan copy.
- The action-plan detail dialog now receives the real workflow `storeName` when
  available and falls back to `storeId` only when the API/model does not provide
  a display name.

## What Did Not Change

- API response shapes were not changed.
- DB schema and migrations were not changed.
- Auth, permission, route, role, scope, and assigned-store command semantics
  were not changed.
- Store Action lifecycle commands still use the existing status, close, cancel,
  and create endpoints and payloads.
- Target projection generation remains parked until a backend source/calendar
  contract exists.
- Screenshot fixtures are visual QA fixtures only; no fake runtime Store
  Action, checklist, KPI, target, projection, or notification data was added.

## Visual QA

- Desktop queue:
  `docs/evidence/store-tasks-prototype-parity-v1-2026-06-03/store-tasks-desktop.png`
- Mobile queue:
  `docs/evidence/store-tasks-prototype-parity-v1-2026-06-03/store-tasks-mobile-390.png`
- Desktop detail dialog:
  `docs/evidence/store-tasks-prototype-parity-v1-2026-06-03/store-tasks-detail-desktop.png`
- Mobile detail bottom sheet:
  `docs/evidence/store-tasks-prototype-parity-v1-2026-06-03/store-tasks-detail-mobile-390.png`

## Verification

- `npm.cmd --prefix admin-web run lint` - pass
- `npm.cmd --prefix admin-web run build` - pass
- `npm.cmd --prefix admin-web run test:e2e -- store-surfaces.spec.ts -g "store tasks"` - pass, 5/5
- `npm.cmd --prefix admin-web run test:e2e -- store-action-plans.spec.ts` - pass, 19/19

## Rollback

Revert this UI slice. No migration rollback, data repair, queue drain, provider
change, or business-state repair is required.
