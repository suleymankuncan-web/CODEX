# Role Permission Preview V1 Evidence

Date: 2026-05-23

## Sokrates Decision

Claim:

- Admins need a safe way to inspect route, role, read-scope, and action-scope
  posture before future feature growth adds more surfaces.

Assumption:

- The existing application DB remains the authorization source of truth, and
  this slice should only surface current decisions.

Repo evidence:

- `admin-web/src/app/admin-navigation.ts` already contains primary admin route
  role metadata.
- `docs/architecture/pilot-route-role-matrix.md` records pilot route
  expectations.
- `docs/plans/role-scope-drift-guard-v1.md` and
  `docs/plans/scope-auth-regression-matrix-v1.md` separate read scope from
  assigned-store action scope.

Counterargument:

- A UI preview can drift if operators treat it as the authorization engine. The
  slice therefore labels itself read-only and keeps auth behavior in existing
  guards/tests.

Risk:

- MEDIUM because auth visibility is sensitive, but this slice is read-only
  frontend/docs/test work.

Door:

- Two-way door. A revert removes the preview without changing authorization.

Stop rule:

- Stop if the preview starts editing role assignments, broadening route access,
  changing Clerk/provider behavior, or replacing backend authorization tests.

## Implemented Slice

- Added a read-only Role/Permission Preview panel to `/admin/auth`.
- The panel lets a SUPER_ADMIN preview active pilot roles plus support roles.
- It shows route visibility, shell, allowed role list, scope boundary, and
  action boundary.
- It does not call a new API and does not mutate auth data.

## Guardrails

- No backend guard changes.
- No role assignment or permission write changes.
- No Clerk/provider behavior changes.
- No DB migration.
- No API response shape change.
- No Store Action or target approval command semantics change.

## Verification

Local gates for this slice:

- `npm.cmd --prefix admin-web run lint`
- `npm.cmd --prefix admin-web run build`
- `npm.cmd --prefix admin-web run test:e2e -- auth-admin-surfaces.spec.ts`
- `node --test scripts/file-size-guard.test.mjs`
- `npm.cmd run test:scripts`
- `git diff --check`

## Follow-Up

- Keep this preview explanatory until a future dedicated auth decision scopes a
  generated or backend-sourced policy matrix.
- If a future feature changes route visibility or command exposure, update the
  drift guard docs and targeted positive/negative tests with that PR.
