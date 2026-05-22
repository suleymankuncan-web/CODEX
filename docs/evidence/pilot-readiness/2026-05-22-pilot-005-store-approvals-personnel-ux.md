# PILOT-005 Store Approvals Personnel UX Evidence

Date: 2026-05-22

Environment:

- Local verification workspace: `D:\store-ops-workspace`
- Frontend surface: admin/store web

## Purpose

Close `PILOT-005`: `STORE_PERSONNEL` could open `/store/approvals` by direct
route even though the role has no expected operation on that page.

This is a UX/navigation correction. It does not change backend authorization,
API response shape, database state, target approval semantics, or store manager
approval workflows.

## Sokrates Decision

Decision: close `PILOT-005` with a small frontend route/navigation guard.

Claim:

- `/store/approvals` is an approvals/action surface for store manager,
  region/reporting review, and super-admin contexts.
- `STORE_PERSONNEL` should not see or deep-link into the surface because no
  store-personnel action belongs there.

Repo evidence:

- `docs/architecture/pilot-route-role-matrix.md` already excludes
  `STORE_PERSONNEL` from `/store/approvals`.
- Existing frontend/backend action gates already restrict write actions to
  manager/super-admin or region/super-admin approval roles by scope.
- The controlled pilot feedback log recorded `PILOT-005` as UX/navigation
  cleanup, not as a backend authorization blocker.

Counterargument:

- A read-only approvals view for personnel could be useful later for explaining
  manager-assigned targets.

Why not now:

- No scoped product requirement exists for personnel to inspect approvals.
- Keeping a no-action approvals page visible increases route confusion during
  the controlled pilot.

Risk: `LOW`.

Door: two-way. The route/link guard can be reverted or replaced by a real
personnel read-only product surface when that requirement is explicitly scoped.

Stop rule:

- Stop if the change alters backend auth, API response shape, target approval
  semantics, database migrations, or manager/region approvals behavior.

## Implementation Boundary

Changed behavior:

- `STORE_PERSONNEL` no longer opens `/store/approvals` by direct route.
- `STORE_PERSONNEL` no longer sees `/store/approvals` links from the store
  performance rail/mobile dock or incentive handoff surface.
- Route-data prefetch skips approvals data when the session cannot list target
  distribution requests.

Unchanged behavior:

- Store manager approvals remain available.
- Region/reporting/super-admin approvals read/review paths remain available
  through the existing target request list permission.
- Backend authorization remains the source of truth for writes and scoped reads.

## Verification

Commands run:

```powershell
npm.cmd --prefix admin-web run build
npm.cmd --prefix admin-web run lint
npm.cmd --prefix admin-web run test:e2e -- store-surfaces.spec.ts -g "store personnel" --workers=1
npm.cmd --prefix admin-web run test:e2e -- store-surfaces.spec.ts -g "approvals" --workers=1
node --test scripts\controlled-pilot-feedback-log-contract.test.mjs scripts\pilot-route-role-matrix-contract.test.mjs scripts\controlled-pilot-round-2-stabilization-contract.test.mjs
npm.cmd run check:pilot-stabilization
npm.cmd run test:scripts
git diff --check

$env:READINESS_FRONTEND_URL='https://staging.hr-axis.com'
$env:READINESS_BACKEND_URL='https://api-staging.hr-axis.com/api'
$env:READINESS_ENVIRONMENT='staging'
$env:READINESS_TIMEOUT_MS='45000'
npm.cmd run smoke:deployed-readiness

$env:BACKEND_LOAD_API_BASE_URL='https://api-staging.hr-axis.com/api'
$env:BACKEND_LOAD_ENVIRONMENT='staging'
$env:BACKEND_LOAD_ITERATIONS='3'
$env:BACKEND_LOAD_CONCURRENCY='2'
$env:BACKEND_LOAD_TIMEOUT_MS='45000'
npm.cmd run smoke:backend-readiness-load

$env:ALERT_SMOKE_BACKEND_URL='https://api-staging.hr-axis.com/api'
$env:ALERT_SMOKE_ENVIRONMENT='staging'
npm.cmd run smoke:alert-routing
```

Results:

- Admin build: passed.
- Admin lint: passed.
- Store personnel targeted Playwright: `8/8` passed.
- Store approvals targeted Playwright: `10/10` passed.
- Pilot/docs contract subset: `12/12` passed.
- `check:pilot-stabilization`: passed with `14/14` contracts and `7/7`
  pilot Playwright tests.
- Root `test:scripts`: `267/267` passed.
- `git diff --check`: passed.

System-flow note:

- `npm.cmd run test:scripts` initially reported system-flow generated artifact
  drift after the store route source lines moved.
- `npm.cmd run system-flow:generate` refreshed
  `docs/flows/store-ops-system-flow.json` and
  `docs/flows/store-ops-system-flow.html`.
- `node --test scripts\system-flow-generator-contract.test.mjs` passed after
  regeneration.

Live/public smoke results:

- `smoke:deployed-readiness`: status `ok`, `13` passed, `0` failed, `1`
  skipped; backend auth session was skipped because no
  `READINESS_BEARER_TOKEN` was provided.
- `smoke:backend-readiness-load`: status `blocked`, public API health group
  passed with `100%` availability, p50 `63.16ms`, p95 `358.43ms`, and `0`
  5xx responses; protected groups were skipped because no role-specific bearer
  tokens were provided.
- `smoke:alert-routing`: status `ok`, `4` passed, `0` failed, `1` skipped;
  external alert provider delivery stayed skipped because no approved provider
  metadata was configured.

## Evidence Safety

No raw bearer tokens, Clerk cookies, passwords, authorization codes, PKCE
verifiers, provider secrets, database URLs, Redis URLs, webhook secrets, or
private user data are recorded in this note.
