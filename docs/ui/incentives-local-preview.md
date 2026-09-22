# Primler: approved prototype and implementation contract

The owner approved integrating this prototype into the existing Store routes,
alongside the KPI monthly aggregation fix and the bounded UI audit fixes, through
sequentially verified PRs. Approval does not establish deployment. Start `admin-web` with
`npm run dev -- --host 127.0.0.1 --port 5190 --strictPort`, then open
`/labs/incentives.html?role=report-viewer` or `?role=region-manager`.
The dev-only entry renders the actual incentive components with explicit sample
data. API writes stay in memory and reset on reload. It is not a build entry.

The 22 September revision follows the Checklist page: blue header, light Azure
surfaces, a left manager directory with “Tüm Mağazalar” first, and a store ledger
on the right. Both roles open the same store drawer, with personnel entitlements,
positions and inline amount/rate editing. The separate period rate reference
section was removed from the drawer at the owner's request; personnel rate
selectors still use the period's persisted brackets.
The list only displays `Kontrol bekliyor` or `Tamamlandı`; completion happens in the
store drawer. A single required note covers all changed personnel. Existing
correction notes are displayed together without repeating identical text.
The note field is present when an editable drawer opens and becomes enabled after
an amount change. Rate/amount edits retain row, total and footer geometry; the
amount input has one calculated-difference line instead of repeated amounts.
Authorized viewer final approval remains a separate tab; the store drawer also
offers accept/return for the existing whole regional package. Manager filtering uses user account
assignments; the regional manager directory contains only their current session
and the stores already present in their authorized workspace. Closing drawers
restores focus and preserves the selected manager and list filters.

## Roles and data mapping

| Surface | Existing authority/data | Behavior |
| --- | --- | --- |
| Period summary, stores, personnel | `/api/store/incentives/workspace` | Final amounts, review status, corrections and existing month semantics |
| Viewer manager directory | `/api/org/region-managers`, direct `storeIds` | Assigned-store filtering; a missing manager yields an empty scope |
| Manager workspace | Store and regional capabilities, closed-period guard | Review stores, correct personnel amounts, inspect rates, submit a regional package |
| Viewer without final approval permission | Existing REPORT_VIEWER read scope | Read only; no approval endpoint call |
| Authorized viewer | Existing `INCENTIVE_FINAL_APPROVAL` permission and final-approval API | Approve packages in a batch or accept/return a whole package from a store drawer; return requires a note |

## Boundary decision and failure behavior

Owner requested minimum changes and retained regional packages. No new approval
entity, permission, database table or endpoint was introduced. The existing final
approval POST now accepts optional `decision` and `reviewNote`; omitted decision
still approves. Return uses the existing repository transition under the same
company, permission, self-approval and exact-submission locks, with a distinct
return audit event. Store corrections reuse the existing per-person commands with
one shared note, then mark the store reviewed only after every command succeeds.
The first failure stops the sequence and refetches authoritative amounts, so a
retry does not repeat already confirmed corrections. Unsaved edits require an
explicit discard before closing the drawer. Deployment requires the matching
backend contract before enabling the new return UI. The old backend rejects the
new command fields through strict DTO validation; it cannot silently approve a return.

Bulk approval orchestrates the existing single-package command sequentially.
It does not add a backend permission, expand scope, change rates or bypass a
review. Each request carries the exact `regionPackageId` and `submittedAt` shown
in confirmation. Own submissions and non-submitted packages cannot be selected.
Selections reset on period/manager/status changes; the period and manager controls
are locked during a batch. The first failed or uncertain response stops the batch;
successful approvals remain recorded and the package list is refreshed. Mutation
retries are disabled. Navigation prevents starting subsequent writes.

The separate Store KPI fix makes monthly store details use the existing ranking
daily-component aggregator whenever the selected store/month contains daily facts.
Monthly-only historical records retain their existing read path. The selected
month, store authorization, full monthly target and benchmark aggregation remain
consistent; snapshots are unchanged.

## Verification and self-review

- Drawer layout follow-up: frontend build and scoped lint passed; 29 relevant
  browser cases passed in 23.2 seconds. Added geometry assertions at 1280/390/320px
  cover rate selection, direct amount edits, long notes, invalid input and reset,
  including stable content height, control positions and fixed footer buttons.
  Both roles were also visually checked in the local preview. Evidence:
  `outputs/incentives-layout-{build,lint,e2e}.log`.
  After removing the rate reference section, the rebuild and scoped lint passed;
  all 12 affected layout/rate scenarios passed in 17.6 seconds. Evidence:
  `outputs/incentives-layout-final-{build,e2e}.log`.
- Preceding store-review revision: frontend build/lint, labs TypeScript, backend
  build/OpenAPI generation and lint passed. There are 38 passing targeted browser
  scenarios across the main run and scoped rechecks (320/390/1024/1440px, resize,
  shared note, partial failure/retry, explicit discard, exact package accept/return).
  The main run passed 35/36; its retry fixture was corrected to mirror the server's
  reset-to-pending rule, and that case plus both new package decisions passed.
  The final affected subset passed 9/9 in 10.5 seconds. Evidence:
  `outputs/incentives-store-review-{build,lint,labs,e2e,recheck,final}.log`.
- Package backend coverage: 46 passing cases across the initial run and targeted
  recheck. The old audit assertion was updated for the parameterized event type;
  return now has stale-version, wrong-company and revoked-grant negative cases.
- Root script suite: 1,552 passed, 46 platform-specific skips and two findings
  (a local URL in current-state and stale generated flow artifacts). Both were
  fixed; affected script files passed all 29 tests on recheck. The long root suite
  was not restarted for those bounded fixes.
- Bulk success, self-approval exclusion, scope change, 403/409/500 stop behavior,
  exact package body and permission revocation tests.
- Backend build/lint and focused KPI tests: monthly daily aggregation, monthly-only
  fallback, explicit daily range, missing month and rejected store scope.
- Actual PostgreSQL period queries verified in a disposable local container:
  daily-only default, daily precedence, explicit month, store isolation, seed
  exclusion, available months and leap-year month end.
- Inline self-review covers financial write boundaries, stale selection, partial
  completion and monthly read/scoring consistency. Local sample data is not
  evidence of a live deployment.
