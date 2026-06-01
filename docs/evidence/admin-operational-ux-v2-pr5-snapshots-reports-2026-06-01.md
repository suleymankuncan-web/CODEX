# Admin Operational UX V2 PR-5 Evidence

Date: 2026-06-01

Scope:
- `/admin/snapshots`
- `/admin/snapshots/:snapshotRunId`
- `/admin/reports`
- `/admin/reports/snapshot-runs`
- `/admin/reports/workforce/:snapshotRunId`
- `/admin/reports/kpis/:snapshotRunId`
- `/admin/reports/checklists/:snapshotRunId`
- `/admin/reports/turnover/:snapshotRunId`

Change summary:
- Added a snapshot operator decision brief that reads existing daily-closure and snapshot overview data.
- Replaced the reporting summary API endpoint table with a report coverage table based on existing summary card counts and latest completed snapshot context.
- Added targeted e2e assertions for the new snapshot decision brief, report coverage section, and removal of visible internal report endpoint copy.

Protected behavior:
- No API, auth, permission, route, navigation, query key, mutation payload, invalidation key, snapshot status mapping, rerun payload, daily closure behavior, report calculation, export meaning, or business workflow changed.
- Snapshot semantic golden output is unchanged for status label, badge tone, rerun enabled/disabled state, and detail visibility.
- The snapshot decision brief only reads `getDailyClosureStatus` and `getSnapshotOverview`; active table filters, sort, search, and pagination do not change the latest-signal summary.
- The report coverage table only reads `getReportingSummary` card counts and the latest completed snapshot run already used by the page.

Visual QA:
- Desktop checks were run with Playwright against `/admin/snapshots`, `/admin/snapshots/:snapshotRunId`, `/admin/reports`, `/admin/reports/snapshot-runs`, and all report detail routes covered by `reports-surfaces.spec.ts`.
- Mobile overflow check was run through the existing reports detail mobile spec.
- Checked routes reported no horizontal overflow through existing `scrollWidth <= clientWidth` assertions.

Verification:
- `npm.cmd --prefix admin-web run lint`: pass.
- `npm.cmd --prefix admin-web run build`: pass.
- `npm.cmd --prefix admin-web run test:e2e -- snapshots-surfaces.spec.ts reports-surfaces.spec.ts`: pass, 8/8.
- `npm.cmd run test:scripts`: pass, 399/399.

Known notes:
- No screenshots are committed; visual QA evidence is recorded through local Playwright assertions.
