# Admin Operational UX V2 PR-3 Evidence

Date: 2026-06-01

Scope:
- `/admin/operations`
- `/admin/data-quality`
- `/admin/inbox`

Change summary:
- Moved the Operations operator action list directly below the command header so the first decision appears before broad status telemetry.
- Replaced Data Quality internal route display with real status, total pressure, and source-family signals.
- Grouped Data Quality evidence panels into responsive read/action pairs.
- Removed the Inbox internal route badge and exposed live needs-attention/queue counts on the header and queue sections.
- Lowered the frozen file-size baseline for `OperationsControlTowerPage.tsx` from 943 to 942 after the page stayed below the prior cap.

Protected behavior:
- No API, auth, permission, route, navigation, query key, mutation payload, invalidation key, workflow status, approval, queue, import, snapshot, scoring, or business behavior changed.
- Workflow inbox approve/reject payloads and disabled-action behavior remain covered by existing e2e tests.
- Data Quality and Operations continue to read the same existing APIs and source signals.

Visual QA:
- Desktop and mobile checks were run with Playwright against local Vite on `/admin/operations`, `/admin/data-quality`, and `/admin/inbox`.
- All checked routes reported `scrollWidth - innerWidth = 0`.
- `/admin/operations` action list was visible in both desktop and mobile first viewport after the final layout adjustment.
- Data Quality and Inbox first viewports showed real signal counts instead of internal route badges.

Verification:
- `git diff --check`: pass.
- `npm.cmd --prefix admin-web run lint`: pass.
- `npm.cmd --prefix admin-web run build`: pass.
- `npm.cmd --prefix admin-web run test:e2e -- operations-control-tower.spec.ts data-quality-center.spec.ts admin-inbox.spec.ts`: pass, 17/17.
- `npm.cmd run test:scripts`: pass, 399/399.

Known notes:
- A first targeted e2e run failed while `npm.cmd --prefix admin-web run build` was running in parallel; the failure showed a blank page and passed on rerun when the e2e suite was run alone.
- No screenshots are committed; the visual QA evidence is recorded as local Playwright inspection output.
