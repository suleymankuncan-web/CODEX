# Admin Reports Link Context V1

## Scope

This slice improves the admin reports summary and snapshot chooser routes:

- `/admin/reports`
- `/admin/reports/snapshot-runs`

The change keeps API calls, response shapes, route permissions, sorting,
export behavior, drill-down href targets, auth behavior, DB state, and report
calculations unchanged.

## Sokrates Decision

Claim:

- The reports pages were already structurally solid and did not need a visual
  repaint, but repeated drill-down links had weak accessible names because the
  same visible labels appeared for multiple snapshot runs.

Assumptions:

- Adding snapshot context to `aria-label` improves keyboard/screen-reader route
  confidence without changing the visible layout.
- A small Turkish KPI copy cleanup is safe if tests assert both visible copy
  and route targets.

Evidence:

- Existing `kpi-config-versioning.spec.ts` already covers reports summary,
  snapshot runs, and report detail localization.
- Browser review for desktop and mobile showed no horizontal overflow and no
  console errors.
- Link inventory showed repeated visible labels such as `İşgücü`, `KPIlar`,
  `Checklistler`, and `Personel çıkışı` across multiple snapshot contexts.

Counterargument:

- Admin reports could receive broader visual polish, but that would increase
  review cost without a concrete overlap/state/readability bug. The smaller
  accessibility slice has clearer value and rollback.

Risk:

- LOW. The slice is presentation/accessibility only and keeps all link targets
  unchanged.

Door:

- Two-way door. The labels can be adjusted without migration or API work.

Stop rule used:

- Stop if improving the route required report API, auth, permission, sorting,
  export, or data transformation changes. It did not.

## Verification

Local gates:

- `npm.cmd --prefix admin-web run lint` - passed.
- `npm.cmd --prefix admin-web run build` - passed.
- `npx.cmd playwright test kpi-config-versioning.spec.ts -g "reports summary|snapshot runs page" --workers=1` - passed, 2/2.

Browser check:

- Local preview at `http://127.0.0.1:4179`.
- `/admin/reports` and `/admin/reports/snapshot-runs` on desktop `1366x900`
  and mobile `390x900`:
  - headings rendered.
  - horizontal overflow was false.
  - content drill-down links kept the same `href` values.
  - content drill-down links now expose snapshot-specific `aria-label` values.
  - console errors were empty.

## Files Touched

- `admin-web/src/pages/ReportsSummaryPage.tsx`
- `admin-web/src/pages/ReportsSnapshotRunsPage.tsx`
- `admin-web/src/features/localization/messages/reports-summary.ts`
- `admin-web/src/features/localization/messages/reports-snapshot-runs.ts`
- `admin-web/e2e/kpi-config-versioning.spec.ts`

## Next Candidate

The next UI/UX V1 candidate should not automatically be more reports polish.
Either run a browser pass on reports detail pages and fix only concrete
overflow/focus/context issues, or move to the higher-value admin import detail
candidate from the route inventory.
