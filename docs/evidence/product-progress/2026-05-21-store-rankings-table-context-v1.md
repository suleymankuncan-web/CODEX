# Store Rankings Table Context V1

## Purpose

Record the first Store KPI / Rankings Product Readiness V1 slice after the
Admin KPI Config row-context work. This slice improves the Store Rankings table
context for assistive technology and mobile boundedness evidence without
changing ranking data, KPI scoring, sort semantics, API calls, auth,
permissions, DB state, CSS behavior, or user workflow semantics.

## Sokrates Triage

Claim:

- The rankings screen has visible list context, but the table itself did not
  expose a table-level accessible name. Repeated data tables are easier to
  navigate and test when their current result window is part of the table
  semantics.

Assumptions:

- Adding a hidden `<caption>` reuses existing localized result-window copy and
  changes accessibility semantics only.
- A mobile overflow assertion is appropriate evidence because the table switches
  into a stacked card layout on small screens.

Repo evidence:

- `StoreRankingsPage.tsx` already computes localized store/personnel result
  captions and renders them visibly above the table.
- `foundation.css` already provides a reusable `.sr-only` utility.
- `store-surfaces.spec.ts` already owns the Store Rankings locale and route
  coverage, making it the right targeted Playwright gate for this slice.

Counterargument:

- This does not redesign the rankings screen or change score explanations.
  That is intentional: the current safe gap is table context and mobile
  boundedness evidence, not ranking logic or broad visual redesign.

Risk:

- LOW. The code change adds a hidden table caption and test assertions.
- MEDIUM only if existing tests or assistive-technology behavior depended on
  the table being unnamed, which would be an undesirable dependency.

Door:

- Two-way door. The caption can be renamed or removed without touching data,
  API, auth, DB, KPI scoring, sorting, or workflow behavior.

Stop rules applied:

- No ranking score calculation changes.
- No sorting, pagination, filter, period, or detail-drawer behavior changes.
- No API response or request payload changes.
- No auth/permission/DB changes.
- No global CSS change.

## What Changed

- The Store Rankings table now has a hidden localized caption using the existing
  result-window copy, for example `Showing store results 1-1.` in English.
- The Store Rankings locale persistence test now asserts table names for store
  and personnel lists.
- The same targeted test now verifies the Store Rankings page does not create
  page-level horizontal overflow at a 390px mobile viewport.

## Verification

Local gate for the PR:

```powershell
npm.cmd --prefix admin-web run lint
npm.cmd --prefix admin-web run build
npm.cmd --prefix admin-web run test:e2e -- store-surfaces.spec.ts --workers=1
npm.cmd --prefix admin-web run test:e2e -- kpi-benchmark-explainability.spec.ts --workers=1
git diff --check
```

Result:

- `npm.cmd --prefix admin-web run lint` passed after installing local
  `admin-web` dependencies in the isolated worktree.
- `npm.cmd --prefix admin-web run build` passed.
- `npm.cmd --prefix admin-web run test:e2e -- store-surfaces.spec.ts --workers=1`
  passed: 54/54.
- `npm.cmd --prefix admin-web run test:e2e -- kpi-benchmark-explainability.spec.ts --workers=1`
  passed: 4/4.
- `git diff --check` passed with only Windows line-ending warnings.

## Next Product Readiness Target

If this Store Rankings slice merges cleanly, continue with the next Store KPI /
Rankings candidate only if fresh evidence shows a concrete gap. Otherwise move
to the Integration Dashboard / Master Data surface family from the refreshed
product surface audit.
