# Admin Operational UX V2 PR-9 Parked Routes Decision

Date: 2026-06-01

Scope:

- `/admin/session`
- `/admin/feed`

Runtime code changed: no

## Decision

Both routes remain explicitly parked for Admin Operational UX V2.

`/admin/session` remains a diagnostic session/auth readiness route. It is
unguarded through `SessionGate`, exposes mock/bearer setup, stores local session
state, and verifies `/api/auth/session`. Modernizing it as product UI would risk
blurring a diagnostic/development operator tool with a production admin surface.

`/admin/feed` remains a write/composer workflow route. It creates feed posts and
executes publish, pin, unpin, and archive commands. The page also applies
role-aware scope defaults for `REGION_MANAGER`. Modernizing this surface safely
requires a dedicated feed workflow contract pass, not a polish-only parked route
decision.

## Repo Evidence

`/admin/session`:

- `admin-web/src/app/admin-shell.tsx` routes `/admin/session` through
  `SessionGate`, not `AdminRouteGuard`.
- `admin-web/src/app/admin-navigation.ts` exposes the `session` nav item without
  role restrictions.
- `admin-web/src/pages/SessionReadinessPage.tsx` imports
  `dashboard-primitives`, renders `hero-panel`, `MetricCard`, `StatusPill`,
  and diagnostic mock/bearer fields.
- `admin-web/e2e/admin-routing.spec.ts` covers session readiness, locale
  switching, session persistence, and session routing.

`/admin/feed`:

- `admin-web/src/app/admin-shell.tsx` guards `/admin/feed` for `SUPER_ADMIN`,
  `HR_ADMIN`, and `REGION_MANAGER`.
- `admin-web/src/app/admin-navigation.ts` exposes the `feed` nav item for the
  same roles.
- `admin-web/src/app/route-data-preloaders.ts` preloads `admin-feed` and
  `auth-lookups` only for `SUPER_ADMIN`, `HR_ADMIN`, and `REGION_MANAGER`.
- `admin-web/src/pages/AdminFeedPage.tsx` imports `dashboard-primitives`,
  renders `hero-panel`, `MetricCard`, `StatusPill`, and executes feed write
  commands.
- `admin-web/src/features/feed/api.ts` sends the existing command payloads for
  create, publish, pin, unpin, and archive.
- `admin-web/e2e/feed-surfaces.spec.ts` already verifies HR publish payload,
  transient retry behavior, region-manager scope defaults, locale switching,
  and store feed visibility.

## Protected Behavior

Do not change during Admin Operational UX V2:

- `/admin/session` route guard posture, local session storage, mock/bearer mode,
  auth verification query key, or `/api/auth/session` verification behavior.
- `/admin/feed` allowed roles, navigation visibility, prefetch enablement,
  create payload shape, publish/pin/unpin/archive command routes, mutation
  invalidation, region-manager default region scope, or store feed visibility.

## Reopen Triggers

`/admin/session` can be reopened only if the product decision changes from
diagnostic readiness to a supported production admin settings surface.

`/admin/feed` can be reopened only through a dedicated behavior-preserving feed
workflow PR that first freezes:

- create feed post payload shape,
- publish/pin/unpin/archive state transitions,
- role-based visibility and scope defaults,
- admin/store feed query invalidation,
- store feed read visibility.

## Verification

Required for this docs-only PR:

- `npm.cmd run test:scripts`
- `git diff --stat`
- `git diff --check`
