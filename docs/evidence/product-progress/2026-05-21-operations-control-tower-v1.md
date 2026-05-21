# Operations Control Tower V1

## Scope

This slice adds the first read-only `/admin/operations` control tower surface.
It composes existing signals only:

- public backend health and queue posture,
- import batch overview and needs-action preview,
- snapshot overview and needs-action preview,
- external/live evidence blockers that still require real provider input.

The route is scoped to `SUPER_ADMIN` and does not add writes, backend
aggregation, DB migrations, provider config, auth model changes, API response
shape changes, or business behavior changes.

## Sokrates Decision

Claim:

- The growth-foundation plan needs an operator mental model before more modules
  are added, and the safest first implementation is a read-only surface over
  existing signals.

Assumptions:

- Existing import, snapshot, and health endpoints are enough for V1.
- External evidence blockers should be visible but not marked closed.

Repo evidence:

- `docs/plans/operations-control-tower-v1.md` defines V1 as read-only.
- Existing generated/read frontend clients already cover import and snapshot
  overview/needs-action endpoints.
- Public `/api/health` already exposes queue and dependency posture.

Counterargument:

- A new admin page can become a broad dashboard. This slice avoids that by
  staying read-only, `SUPER_ADMIN` scoped, and limited to existing signals.

Risk:

- MEDIUM. It is user-facing admin UI and navigation, but backend/auth/DB/API
  behavior stays unchanged and rollback is one squash revert.

Door:

- Two-way door. No migration, provider setting, auth behavior, or API contract
  change is introduced.

Stop rule used:

- Stop if the control tower needed a new write endpoint, migration, provider
  secret, auth behavior change, or invented data source. It did not.

## Verification

Local gates:

- `npm.cmd --prefix admin-web run lint` - passed.
- `npm.cmd exec -- tsc -p tsconfig.app.json --noEmit --pretty false` from
  `admin-web` - passed.
- `npm.cmd --prefix admin-web run build` - passed.
- `npm.cmd --prefix admin-web run test:e2e -- operations-control-tower.spec.ts --workers=1` - passed, 3/3.
- `npm.cmd --prefix admin-web run test:e2e -- admin-routing.spec.ts --grep "admin shell switches|admin command shell keeps navigation|admin shell fallback|snapshot operations page" --workers=1` - passed, 4/4.
- `npm.cmd run check:release` from `admin-web` after the retry-guard fix -
  passed: generated API types current, lint passed, 21/21 script tests passed,
  frontend build passed, 163/163 Playwright tests passed, and npm audit reported
  0 vulnerabilities.
- Codex review flagged cache key ambiguity for preview-sized import/snapshot
  needs-action queries. The page and route preloader now include the preview
  limit in those query keys, isolating V1 preview cache from dashboard-sized
  queues. Follow-up local gates passed: `git diff --check`, admin lint,
  admin `test:scripts` 21/21, admin build, and Operations Control Tower E2E 3/3.
- Codex follow-up review flagged two operator-risk states: needs-action queue
  failures were not part of the top readiness status, and HTTP-200 health
  payloads with `status: "error"` could look neutral in the backend metric.
  Both are fixed and covered by Operations Control Tower E2E regressions.
  Final local frontend release gate passed after those fixes:
  `npm.cmd run check:release` from `admin-web` reported generated API types
  current, lint clean, 21/21 script tests, frontend build, 165/165 Playwright
  tests, and npm audit 0 vulnerabilities.

## Files Touched

- `admin-web/src/pages/OperationsControlTowerPage.tsx`
- `admin-web/src/features/operations/api.ts`
- `admin-web/src/features/localization/messages/admin-operations.ts`
- `admin-web/src/features/localization/messages/index.ts`
- `admin-web/src/features/localization/messages/admin-shell.ts`
- `admin-web/src/app/admin-navigation.ts`
- `admin-web/src/app/admin-shell.tsx`
- `admin-web/src/app/route-loaders.tsx`
- `admin-web/src/app/route-preloaders.ts`
- `admin-web/src/app/route-data-preloaders.ts`
- `admin-web/e2e/operations-control-tower.spec.ts`

## Remaining Watch

- External evidence remains blocked until real bearer/provider/restore/Redis
  or upload inputs exist.
- V1 does not add a backend aggregation endpoint. Add one later only if
  repeated frontend composition proves insufficient.
- Broader operator roles should not receive the page until per-domain visibility
  is designed; V1 stays `SUPER_ADMIN` only.
