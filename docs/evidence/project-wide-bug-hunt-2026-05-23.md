# Project-Wide Bug Hunt 2026-05-23

Date: 2026-05-23

## Scope

Areas scanned:

- Store Action,
- Store Tasks,
- auth/session,
- API contract/generated client,
- workflow inbox,
- workforce,
- reports,
- import,
- operations,
- navigation,
- security hygiene,
- obvious mobile/breakage risk through existing targeted route evidence.

This was a low-risk maintenance hunt. It did not intentionally change business
logic, API response shape, auth semantics, permission behavior, DB migrations,
global CSS, or user-facing workflow semantics.

## Sokrates Decision

Claim:

- After Store Action V1B, the useful overnight bug hunt should favor evidence
  and guarded scans over speculative fixes.

Assumptions:

- Obvious low-risk bugs should surface through local gates, targeted scans, or
  existing smoke contracts.
- Large behavior changes, auth changes, DB changes, and UI redesign should be
  parked unless a concrete failing reproduction exists.

Evidence:

- Store Action split tests passed.
- Remaining Store Tasks tests passed.
- Admin lint/build passed.
- Generated API client check passed.
- Root script-contract tests passed.
- Public staging readiness smoke passed public checks and correctly skipped
  protected groups without tokens.

Counterargument:

- Static scans and local E2E are not a substitute for fresh real persona smoke
  on staging.

Risk:

- LOW for this bug hunt because no runtime code fix was applied.
- HIGH if a future pass tries to close protected-route or provider evidence
  with mocks.

Door:

- Two-way. The evidence can be extended with deeper targeted tests when a real
  bug report appears.

## Commands

```powershell
rg -n "TODO|FIXME|BUG|HACK|console\\.log|debugger|javascript:|dangerouslySetInnerHTML|TODO\\(" admin-web/src backend/nestjs/src admin-web/e2e backend/nestjs/test scripts -g "*.ts" -g "*.tsx" -g "*.mjs"

rg -n "store-actions/plans|StoreActionPlan|action plan|actionPlan|sourceDeepLink|canUseStoreActionPlans|canUseWorkflowInbox" admin-web/src backend/nestjs/src admin-web/e2e backend/nestjs/test -g "*.ts" -g "*.tsx"

rg -n "window\\.localStorage|mockRoleCodes|READINESS_BEARER_TOKEN|BACKEND_LOAD_.*TOKEN|PROTECTED_PERF_.*TOKEN|Clerk|session|getToken|Authorization" admin-web/src admin-web/e2e backend/nestjs/src scripts docs/plans docs/evidence -g "*.ts" -g "*.tsx" -g "*.mjs" -g "*.md"

npm.cmd --prefix admin-web run lint
npm.cmd --prefix admin-web run api:check
npm.cmd --prefix admin-web run build
npm.cmd run test:scripts
```

## Results

No clear low-risk product bug was found that should be fixed in this branch.

Notes:

- `javascript:alert(1)` appears only in the Store Action Playwright fixture that
  proves unsafe source links are hidden.
- `console.log` matches are smoke/script reporting output, not browser runtime
  leakage in the application source.
- Protected staging auth/session and role-specific load evidence remain blocked
  without a real secure token/session and must not be replaced by mock evidence.
- Vite build continues to show known large chunks such as localization and Clerk
  session bundles. That is a performance watchlist item, not a new correctness
  bug from this pass.

## Parked Bug Candidates / Watchlist

- Fresh `/store/tasks` real-persona smoke for Store Action visibility.
- Protected route load budgets for role-specific staging tokens.
- Bundle-size optimization for large localization/session chunks if measured
  pilot performance starts hurting.
- Mobile visual QA after the user starts the planned larger page/content design
  changes.
