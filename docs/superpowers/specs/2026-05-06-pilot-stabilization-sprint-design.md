# Pilot Stabilization Sprint Design

## Purpose

Stabilize the current HR Axis pilot without restarting the project or redesigning the UI.

This is a design document only. It does not implement route changes, tests, endpoint changes, deploy automation, or visual redesign.

## Current Situation

The project has reached a working pilot state through fast iterations across:

- Clerk auth and role/scope resolution,
- admin and store route guards,
- store manager surfaces,
- ranking visibility,
- Power BI Excel import,
- master data bootstrap,
- target and approval queues,
- Vercel frontend deployment,
- Render backend deployment.

The product foundation is not disposable. The risk is operational: too many patched surfaces now make it hard to tell which screens are core product, which screens are ops/debug, and which paths must be checked before each deploy.

## Stabilization Boundary

This sprint must not add new product features.

This sprint must not start the premium retail UI redesign.

The sprint exists to:

- document current route and role behavior,
- classify admin and store screens,
- harden API response contracts against missing/null fields,
- create a small deploy smoke suite,
- separate demo/debug behavior from live user behavior,
- standardize deploy and cache checks.

UI quality work is explicitly parked until these reliability tasks are complete.

## Recommended Approach

Use a targeted stabilization sprint inside the existing repository.

Why:

- The current system already contains working domain knowledge that would be expensive to rediscover in a rewrite.
- Recent bugs were fixable at the contract/route/cache layer, not signs that the whole architecture collapsed.
- A new project would recreate auth, import, ranking, scope, and deploy lessons from scratch.
- A cleanup sprint gives the team a safer release base before visual polish.

Rejected alternatives:

- Full rewrite: too risky and too slow while the pilot is already close to usable.
- Keep patching only live bugs: short-term fast, but it increases fear of touching the codebase.
- UI redesign first: improves appearance, but does not reduce the auth, route, contract, or deploy risk.

## Workstream 1: Route And Role Inventory

Create a single source of truth for protected routes.

The inventory should classify every route by:

- route path,
- shell: admin or store,
- allowed roles,
- default landing behavior,
- refresh/return-path expectation,
- live-read scope,
- whether the screen is core, ops, or legacy/pilot.

Initial routes to cover:

- `/admin/integrations`
- `/admin/master-data`
- `/admin/snapshots`
- `/admin/inbox`
- `/admin/feed`
- `/admin/checklists`
- `/admin/competitions`
- `/admin/reports`
- `/admin/targets`
- `/admin/kpi-config`
- `/admin/auth`
- `/admin/audit`
- `/admin/session`
- `/store`
- `/store/me`
- `/store/rankings`
- `/store/approvals`
- `/store/checklists`
- `/store/tasks`
- `/store/kpis`
- `/store/feed`
- `/store/competitions`
- `/store/incentives`

Expected output:

- a route/role matrix in repo docs,
- no behavior changes until the matrix is reviewed,
- clear identification of routes that should remain visible in primary navigation.

## Workstream 2: Screen Classification

Classify screens into three groups.

Core:

- surfaces needed for the pilot user journey,
- surfaces that should survive into the first production product.

Ops:

- operational or support screens that are useful for admins,
- not necessarily part of the main product navigation.

Legacy/Pilot:

- debug, temporary, demo, or transitional screens,
- kept until safely removed or hidden,
- not allowed to drive user-facing navigation decisions.

Initial classification hypothesis:

Core admin:

- `/admin/integrations`
- `/admin/master-data`
- `/admin/targets`
- `/admin/auth`
- `/admin/audit`

Ops admin:

- `/admin/session`
- `/admin/snapshots`
- `/admin/reports`
- `/admin/kpi-config`

Needs product decision:

- `/admin/inbox`
- `/admin/feed`
- `/admin/checklists`
- `/admin/competitions`

Core store:

- `/store`
- `/store/me`
- `/store/rankings`
- `/store/approvals`

Secondary store:

- `/store/checklists`
- `/store/tasks`
- `/store/kpis`
- `/store/feed`
- `/store/competitions`
- `/store/incentives`

## Workstream 3: API Contract Hardening

Prevent frontend crashes when backend responses omit optional fields or return null.

Priority endpoints:

- `/api/auth/session`
- `/api/integrations/master-data-bootstrap/batches`
- `/api/reports/my-performance`
- `/api/store/rankings` or current ranking endpoint equivalent
- `/api/store/approvals` or current approval endpoint equivalent
- `/api/targets` or current target queue endpoint equivalent
- `/api/competitions` or current competition endpoint equivalent

Rules:

- Frontend types must match actual backend response shape.
- Missing optional fields must render fallback UI instead of crashing.
- Date formatting must never receive undefined or invalid values without a fallback.
- Numeric KPI/ranking values must render empty/error states instead of impossible values.
- API client must fail clearly when Vercel serves HTML for a backend API path.

Expected output:

- targeted contract tests for the highest-risk endpoints,
- small frontend guards where fields are genuinely optional,
- no broad schema redesign in this sprint.

## Workstream 4: Smoke Test Package

Create a deploy-ready smoke suite that proves the current pilot has not regressed.

Required smoke paths:

- admin session verifies,
- `/admin/integrations` opens,
- `/admin/master-data` opens with a batch list or empty state,
- `/admin/targets` opens with a queue or empty state,
- `/store` opens for a scoped store user,
- `/store/me` opens for the store user,
- `/store/rankings` opens and excludes demo rows in live mode,
- `/store/approvals` opens for the store user,
- refreshing a protected route returns to the same route after auth verification,
- staging frontend uses `https://api-staging.hr-axis.com/api` instead of a relative Vercel `/api` fallback.

The smoke suite should be small enough to run before every promote.

## Workstream 5: Demo And Live Data Boundary

Make demo behavior explicit.

Rules:

- Demo rows must not appear in live rankings.
- Store manager/personnel users may see national ranking position and score, but not broad competitor detail unless the role allows it.
- Region manager and higher roles may see broader lists and filters.
- Debug/demo screens must not be the default landing for real users.
- Demo behavior should be controlled by seed/source flags or explicit ops routes, not by hidden UI assumptions.

## Workstream 6: Deploy And Cache Checklist

Document the deployment path so deploys stop feeling like guesswork.

Checklist must cover:

- frontend-only change: Vercel preview, then promote,
- backend/API change: Render deploy, then frontend smoke if affected,
- DB migration change: Render predeploy migration evidence and migration status smoke,
- commit hash vs Vercel deployment id mapping,
- production promote verification,
- browser cache/old chunk symptoms and recovery,
- required URLs to test after promote.

Expected output:

- one release checklist document,
- a short command list for local verification,
- a production smoke order that can be followed manually or automated later.

## Testing Strategy

The first implementation plan should add tests before changing behavior.

Test layers:

- route/role contract tests for expected route visibility and refresh behavior,
- frontend e2e smoke tests for core admin and store routes,
- API contract tests for missing/null response fields,
- script contract tests for deployment checklist requirements,
- existing release checks to make sure no unrelated guard is broken.

Minimum verification for each stabilization change:

- targeted test for the changed behavior,
- `npm.cmd --prefix admin-web run lint` when frontend code changes,
- `npm.cmd --prefix admin-web run build` when frontend code changes,
- relevant Playwright spec when route/UI behavior changes,
- root script contract test when docs/checklist contracts change,
- `git diff --check`.

## Non-Goals

This sprint will not:

- create a new repo,
- rewrite the backend,
- redesign the store UI,
- add new KPI/business features,
- change the current data model without a separate spec,
- remove working screens before they are classified and reviewed,
- broaden access for any role without an explicit role matrix decision.

## Risks

Risk: cleanup turns into a broad refactor.

Mitigation: every task must be tied to route inventory, contract hardening, smoke coverage, demo/live separation, or deploy checklist.

Risk: tests become too large and slow for daily use.

Mitigation: keep smoke tests small and push broad coverage into targeted specs.

Risk: hiding pilot screens breaks an operator workflow.

Mitigation: classify before hiding; move questionable screens to ops/legacy status first.

Risk: UI redesign pressure returns early.

Mitigation: park UI work until smoke and contract gates are stable.

## Acceptance Criteria

- Route/role matrix exists and covers admin and store shells.
- Each current page is classified as core, ops, secondary, or legacy/pilot.
- Critical API contracts have tests or explicit frontend fallbacks for missing/null fields.
- A small smoke suite covers the pilot-critical admin and store paths.
- Demo/live data rules are documented and enforced for rankings.
- Deploy checklist explains Vercel, Render, migration, promote, and cache checks.
- UI redesign remains deferred until stabilization tasks are complete.

## Implementation Scope For Next Plan

The next implementation plan should be split into small tasks:

1. Add route/role inventory docs and a script contract that prevents the matrix from disappearing.
2. Add screen classification docs and update navigation only after review.
3. Add API contract tests for the highest-risk response shapes.
4. Add or extend Playwright smoke tests for core admin/store routes.
5. Add deploy checklist contract coverage.
6. Review demo/live ranking source enforcement.

Each task should be independently testable and committed separately.
