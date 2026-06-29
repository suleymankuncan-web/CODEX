# PR1 - Operations / Inbox / Data Quality

Date: 2026-06-30
Branch: `codex/admin-operational-pr1-operations-inbox-data-quality`

## Scope

Routes in this PR:

- `/admin/operations`
- `/admin/inbox`
- `/admin/data-quality`

Frozen behavior:

- Existing API calls stay unchanged.
- Existing role gates stay unchanged.
- Existing seller-code/offboarding mutations stay unchanged.
- No polling, timers, DB migration, auth change, or business calculation change is introduced.

## Prototype Contract

Production-bound prototype file:

- `admin-web/src/prototypes/admin/operations-inbox-data-quality-v1.tsx`

Shared production primitives:

- `admin-web/src/pages/admin-operational-primitives.tsx`

Parity approach:

- The prototype and live routes use the same `AdminOperational*` primitive family.
- Live pages keep their data and mutations, but adopt the same header, metric, section, row, badge, and key-value rhythm.
- Existing deep links and action ownership remain on the original route surfaces.

## Page Mapping

`/admin/operations`

- New compact command header.
- Primary readiness, operator pressure, external blocker, and backend metrics moved into the operational metric strip.
- The command header was extracted from `OperationsControlTowerPage.tsx`, lowering the page from the frozen oversized baseline to the standard file-size guard budget.
- Existing operator action model, capacity readiness, signal freshness, workforce, workflow, KPI, import, and snapshot panels remain as evidence/detail surfaces.

`/admin/inbox`

- New compact command header.
- Queue metrics moved to the operational metric strip.
- Workflow item rows moved to the operational row primitive.
- Seller-code and offboarding approval behavior remains unchanged.

`/admin/data-quality`

- New compact command header.
- Status, total pressure, import, snapshot, workforce, and source trust moved into one operational metric strip.
- Import, snapshot, workforce identity, and source-trust panels remain attached to existing detail routes.

## Verification

Passed:

- `npm.cmd --prefix admin-web run lint`
- `npm.cmd --prefix admin-web run build`
- `npm.cmd --prefix admin-web run test:e2e -- operations-control-tower.spec.ts operations-surfaces.spec.ts data-quality-center.spec.ts admin-inbox.spec.ts`
  - 22 passed.
  - Includes desktop render, role gate, mutation, locale, source-link, and mobile overflow assertions for the touched routes.
- `npm.cmd --prefix admin-web run test:e2e -- admin-surfaces.spec.ts`
  - 6 passed.
  - Cross-checks general migrated admin read surfaces and auth admin surfaces.
- `npm.cmd run test:scripts`
  - 488 passed.
  - Confirms file-size guard no longer needs an oversized exception for `OperationsControlTowerPage.tsx`.

Not run in this PR:

- Full `check:release`; PR1 is a scoped frontend admin UI slice and no API/OpenAPI/schema change was made.
