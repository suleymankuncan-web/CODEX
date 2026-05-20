# Reports Detail Mobile Readability V1

## Scope

This slice improves the mobile table heading/action area across the admin
reports detail family:

- `/admin/reports/workforce/:snapshotRunId`
- `/admin/reports/kpis/:snapshotRunId`
- `/admin/reports/checklists/:snapshotRunId`
- `/admin/reports/turnover/:snapshotRunId`

The change keeps report API calls, response shapes, auth/permission behavior,
export/search/sort behavior, visible copy, data calculations, DB state, and
route targets unchanged.

## Sokrates Decision

Claim:

- A browser pass showed a concrete V1 gap in the reports detail family: on
  mobile, the table heading copy and the search/sort/export controls competed
  for the same horizontal space, making the explanatory copy hard to read.

Assumptions:

- The reports detail pages share one layout issue and one verification family,
  so this is a valid batch PR instead of four micro PRs.
- The fix should stay scoped to the report table panels instead of changing the
  global `.panel-heading`, `.toolbar-cluster`, or `.panel-copy` behavior.

Evidence:

- Mobile browser review of workforce and KPI report detail pages showed the
  table copy sitting too close to the action controls.
- The route inventory already listed the reports detail family as a candidate
  only after browser proof.
- `shell.css` gives `.panel-copy` a sidebar-oriented light color, while these
  report panels sit on light surfaces.

Counterargument:

- A global panel-heading or panel-copy correction may eventually be cleaner, but
  it would widen the blast radius to inbox, auth, snapshots, import, and other
  admin surfaces. This PR keeps the fix local and reversible.

Risk:

- LOW-MEDIUM. The slice is scoped CSS/layout/readability only, but it changes
  visible mobile layout for report table panels.

Door:

- Two-way door. The scoped class and CSS can be reverted in one squash commit
  without touching API, auth, DB, providers, or migrations.

Stop rule used:

- Stop if the fix required report data changes, new API fields, auth changes,
  export/search/sort behavior changes, copy changes, global redesign, or a
  broader admin layout rewrite. It did not.

## Verification

Local gates:

- `npm.cmd --prefix admin-web run lint` - passed.
- `npm.cmd --prefix admin-web run build` - passed.
- `npx.cmd playwright test kpi-config-versioning.spec.ts -g "report|reports detail" --workers=1` - passed, 7/7.

Browser check:

- Local preview at `http://127.0.0.1:4182`.
- Workforce, KPI, checklist, and turnover report detail routes were checked on
  desktop `1366x900` and mobile `390x900`.
- All checked routes had:
  - panel copy color `rgb(90, 101, 95)`.
  - panel copy line-height `25.92px`.
  - horizontal overflow false.
  - console errors empty.
  - mobile toolbar positioned below the panel copy.
- Screenshots were written under
  `admin-web/test-results/uiux-reports-detail-mobile-v1/`.

## Files Touched

- `admin-web/src/pages/ReportsWorkforcePage.tsx`
- `admin-web/src/pages/ReportsKpisPage.tsx`
- `admin-web/src/pages/ReportsChecklistsPage.tsx`
- `admin-web/src/pages/ReportsTurnoverPage.tsx`
- `admin-web/src/styles/admin-support.css`
- `admin-web/e2e/kpi-config-versioning.spec.ts`

## Next Candidate

Park reports detail polish after this slice unless a new concrete browser or
pilot gap appears. The next UI/UX V1 candidate should come from a fresh
route-family audit, not from continuing a polish train by inertia.
