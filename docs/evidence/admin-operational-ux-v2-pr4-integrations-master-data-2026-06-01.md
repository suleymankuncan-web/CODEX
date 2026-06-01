# Admin Operational UX V2 PR-4 Evidence

Date: 2026-06-01

Scope:
- `/admin/integrations`
- `/admin/integrations/:batchId`
- `/admin/master-data`
- `/admin/master-data/:batchId`

Change summary:
- Added an integration operator handoff strip that surfaces the current queue decision from existing import overview and needs-action data.
- Added a master-data readiness strip that summarizes bootstrap batch readiness from the current batch list.
- Kept import upload, retry, validation, promotion, route, polling, and mutation behavior unchanged.
- Added targeted e2e assertions for the new decision/readiness signals and mobile overflow checks for integration and master-data detail routes.

Protected behavior:
- No API, auth, permission, route, navigation, query key, mutation payload, invalidation key, upload payload, retry, validation, promotion, batch status mapping, queue, snapshot, scoring, or business behavior changed.
- The integration handoff only reads `getImportOverview` and `getNeedsAction` data already loaded by the page.
- The master-data readiness strip only reads `getMasterDataBootstrapBatches` list data already loaded by the page.
- Disabled/enabled action logic for retry, validate, and promote remains owned by the existing backend-derived state.

Visual QA:
- Desktop and mobile checks were run with Playwright against `/admin/integrations`, `/admin/integrations/:batchId`, `/admin/master-data`, and `/admin/master-data/:batchId`.
- Checked routes reported no horizontal overflow through existing `scrollWidth <= clientWidth` assertions.
- `/admin/integrations` keeps Power BI upload controls on the default tab while exposing the queue decision before tab content.
- `/admin/master-data` exposes readiness distribution before the batch table without changing selected batch workflow actions.

Verification:
- `npm.cmd --prefix admin-web run lint`: pass.
- `npm.cmd --prefix admin-web run build`: pass.
- `npm.cmd --prefix admin-web run test:e2e -- integration-surfaces.spec.ts master-data-surfaces.spec.ts`: pass, 14/14.
- `node --test scripts/file-size-guard.test.mjs`: pass, 3/3.

Known notes:
- No screenshots are committed; visual QA evidence is recorded through local Playwright assertions.
- `npm.cmd run test:scripts` initially failed because the first implementation grew frozen oversized page baselines; the page calls were reduced and the file-size guard now passes without raising baselines.
- One targeted e2e rerun failed while `npm.cmd --prefix admin-web run build` was running in parallel; the same suite passed on rerun when executed alone.
