# Auth Surface Readability V1

## Scope

Improve read-only readability on the auth admin dashboard and auth catalog
surfaces.

The change is limited to panel explanation copy that was using the global
`panel-copy` class on light panels:

- `/admin/auth` role-assignment queue explanation,
- `/admin/auth/catalog` role-definition search explanation.

## Sokrates Decision

Claim:

- Auth/admin follow-ups should happen only after route-level evidence, and the
  smallest safe local issue is text readability on existing light panels.

Evidence:

- Browser smoke on `/admin/auth/catalog` showed `panel-copy` rendered as
  `rgba(247, 241, 230, 0.72)` over `rgba(255, 251, 244, 0.88)`, making the
  role-search explanation low contrast on mobile.
- The same class was used by the `/admin/auth` role-assignment queue
  explanation.
- Existing `auth-admin-surfaces.spec.ts` already covers both routes and locale
  switching.

Counterargument:

- This does not solve every possible auth admin UX issue. It intentionally avoids
  changing write flows, permissions, route access, API calls, or layout.

Risk:

- LOW. It is a presentation-only class swap to an existing readable text token.

Door:

- Two-way door. A normal squash revert restores the previous classes.

## Guardrails

- No auth, permission, route-access, API request, API response, DB, provider, or
  mutation behavior changed.
- No new design system or broad auth dashboard redesign was added.
- No role, permission, assignment, pilot binding, or action-store logic changed.

## Verification

- `git diff --check`
- `npm.cmd --prefix admin-web run lint`
- `npm.cmd --prefix admin-web run build`
- `npm.cmd --prefix admin-web run test:e2e -- auth-admin-surfaces.spec.ts --workers=1`
- Browser smoke:
  - mobile overflow: `0`
  - before fix: catalog panel copy color `rgba(247, 241, 230, 0.72)` on light
    panel background `rgba(255, 251, 244, 0.88)`
  - after fix: catalog role-search copy uses `queue-subtitle`, color
    `rgb(90, 101, 95)`, with mobile overflow still `0`
