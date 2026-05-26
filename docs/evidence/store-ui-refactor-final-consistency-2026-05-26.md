# Store UI Refactor Final Consistency - 2026-05-26

## Scope

This pass closes the Store UI refactor line after PR #528 through PR #532.
The active Store routes were reviewed against the agreed Store Me visual
language, role-aware navigation, real-data-only rule, and shadcn/Tailwind v4
component standard.

`/store/incentives` remains intentionally parked. It is not in the role toolbar
and was not productized in this line.

## Merged Batch Line

- PR #528: Store Page Intent Matrix and route/data/role inventory.
- PR #529: legacy Store competitions/settings surface cleanup.
- PR #530: utility Store targets/reports/settings surface clarification.
- PR #531: operational read surfaces for home, KPIs, rankings, and feed.
- PR #532: workflow-heavy Store checklists and approvals surfaces.

## Consistency Findings

- Active redesigned Store surfaces no longer depend on `dashboard-primitives`,
  old checklist modal CSS, old approval ledger card classes, or the old
  screen/empty/status primitive language.
- Store form controls now use shadcn components for the redesigned active
  surfaces, including the Store Me date filter checkbox added in this final
  pass.
- `/store/incentives` is the only Store page still importing
  `dashboard-primitives`; this is the documented parked exception and should be
  handled only when that module is explicitly productized.
- The remaining native `<button>` match is the rankings drawer backdrop close
  layer, not a visible user-control style. The visible drawer actions use
  shadcn `Button`.
- No fake metric, fake coaching text, fake score, fake ranking, or fabricated
  trend source was added in this line.
- Business behavior was not changed: auth, permission semantics, API response
  shape, DB schema, scoring, ranking sort, checklist weights, and approval
  state-machine behavior remain out of scope.

## Commands

```powershell
rg -n "dashboard-primitives|store-checklist-modal-backdrop|store-checklist-modals|store-approvals-ledger-card|screen-state|empty-card|status-pill" admin-web/src/pages -g "Store*.tsx" -g "store-*.tsx"
rg -n "<select|<input|<textarea" admin-web/src/pages -g "Store*.tsx" -g "store-*.tsx"
rg -n "<button" admin-web/src/pages -g "Store*.tsx" -g "store-*.tsx"
git diff --check
npm.cmd --prefix admin-web run lint
npm.cmd --prefix admin-web run build
npm.cmd --prefix admin-web run test:e2e -- store-surfaces.spec.ts -g "store self-performance"
npm.cmd --prefix admin-web run test:e2e -- checklist-today-surfaces.spec.ts -g "completed checklist handoff moves"
npm.cmd --prefix admin-web run check:release
```

The first full `check:release` pass hit a one-off
`checklist-today-surfaces.spec.ts` handoff visibility failure while the page was
still on the blank shell background. The isolated failing spec passed on rerun,
and the subsequent full `check:release` passed with 202/202 Playwright tests.

## Review Notes

The final consistency slice is intentionally small. It records the completed
Store route refactor line, documents the parked `/store/incentives` exception,
and removes the last visible active Store native checkbox control without
changing Store workflow behavior.
