# Landing Return-State Investigation V1 - 2026-05-23

## Reader And Action

Reader:

- the pilot moderator, support engineer, QA operator, product owner, or future
  agent deciding whether the `HR_ADMIN` and `REPORT_VIEWER` first-route
  observations from the assisted persona rehearsal are blockers.

After reading, they should be able to:

- understand why a persona can land on a store route after login,
- distinguish default landing behavior from `returnTo` behavior,
- know when this should be treated as a bug versus expected auth flow behavior,
- decide the next safe pilot step without changing auth/navigation semantics.

## Scope

Mode:

- docs-only root-cause investigation

Environment:

- frontend staging: `https://staging.hr-axis.com`
- backend staging API: `https://api-staging.hr-axis.com/api`
- source baseline: `826ed7fb`

This pass does not change code, API responses, auth behavior, DB schema, CSS,
provider configuration, role assignments, user-facing copy, or staging data.

## Sokrates Decision

Claim:

- The assisted rehearsal first-route observations are explained by existing
  `returnTo` preservation and store-shell read/support visibility. They are not
  evidence that the role landing resolver is broken.

Assumptions:

- The user-observed first route came from a browser/session that may have
  carried a previous route or auth return target.
- Direct allowed and forbidden route checks are stronger evidence than the
  first visible route in a reused browser context.
- Changing `returnTo` precedence would be an auth/navigation behavior change and
  should not happen inside a docs/evidence slice.

Repo evidence:

- `admin-web/src/app/shell-state.ts` maps clean ready sessions as:
  - `HR_ADMIN` -> `/admin/competitions`
  - `REPORT_VIEWER` -> `/admin/reports`
  - `REGION_MANAGER` / `STORE_MANAGER` -> `/store/home`
  - store-personnel-only -> `/store/me`
- `admin-web/src/app/auth-flow-shell.tsx` intentionally sets
  `readyPath = returnTo ?? firstAllowedPath`.
- `admin-web/src/pages/AuthLoginPage.tsx` passes the current `returnTo` into
  the provider login actions.
- `admin-web/src/features/auth/clerk-session.tsx` passes the sanitized return
  path to Clerk as the sign-in fallback redirect.
- `admin-web/e2e/store-return-to.spec.ts` already guards that ready sessions
  return to a requested store route and that protocol-relative malicious return
  targets are ignored.
- `admin-web/src/app/store-shell.tsx` exposes `/store` and `/store/home` as
  store-shell routes once the session is ready; route-specific guards still
  apply to restricted store subroutes.
- `admin-web/src/app/admin-shell.tsx` and `AdminRouteGuard` still enforce
  admin route role checks. The assisted rehearsal confirmed forbidden admin
  routes failed closed.

Counterargument:

- A pilot participant may still find it confusing if they log in and land on a
  stale store route instead of the role's canonical default surface. That is a
  real product-friction candidate, but not a security or correctness blocker
  while forbidden routes and command controls remain closed.

Risk:

- LOW for this docs-only investigation.
- MEDIUM if future work changes login return behavior because it affects every
  direct-link and expired-session recovery path.
- HIGH if the team silently turns this into an auth permission or route-access
  policy change without a dedicated decision.

Door:

- The investigation is a two-way door.
- `returnTo` precedence is a medium-door behavior change because it affects real
  user navigation after login and session expiry.

Stop rule:

- Stop before code if the proposed fix would change login redirect precedence,
  store-shell route visibility, role landing defaults, or auth route semantics.

Verification ladder:

1. Source-level trace of landing and return path flow.
2. Existing E2E return-to regression coverage.
3. Assisted real-persona route allow/deny observations.
4. Optional future clean-browser persona check with no prior `returnTo`.
5. Optional future UX decision if first-route confusion becomes repeated pilot
   feedback.

## Root Cause

The first-route observations were likely caused by preserved auth return state,
not by an incorrect role default.

Flow:

1. A user visits a route while unauthenticated or after a session refresh.
2. The shell sends them to `/auth/login?returnTo=<current route>`.
3. Login/callback preserves the sanitized `returnTo`.
4. Once the session is ready, the auth shell navigates to `returnTo` first.
5. Only when `returnTo` is absent or invalid does it use the role's
   `firstAllowedPath`.

Therefore:

- clean `HR_ADMIN` default remains `/admin/competitions`;
- clean `REPORT_VIEWER` default remains `/admin/reports`;
- a valid prior `/store/home`, `/store`, or `/store/me` return target can still
  take the user to that route after login;
- route-specific authorization still decides what the user can actually do on
  the destination surface.

## What The Assisted Rehearsal Proved

From `docs/evidence/pilot-readiness/2026-05-23-assisted-persona-rehearsal-v1.md`:

- direct positive routes opened for each persona,
- forbidden admin routes showed the forbidden route state,
- read-only and personnel personas did not see Store Action
  create/status/close/cancel controls,
- no red error, infinite loading, or blank screen was reported.

That is sufficient for controlled-pilot continuation because the observed
first-route mismatch did not grant access to forbidden surfaces or command
controls.

## When This Becomes A Bug

Treat this as a bug if any of these happen:

- a clean login with no `returnTo` sends `HR_ADMIN` somewhere other than
  `/admin/competitions`;
- a clean login with no `returnTo` sends `REPORT_VIEWER` somewhere other than
  `/admin/reports`;
- an invalid, external, protocol-relative, or `/auth/*` return path is accepted;
- a stale return path lets a role read forbidden data;
- a read-only persona sees Store Action command controls;
- a forbidden admin route opens instead of showing the forbidden route state.

## Decision

Landing/return-state follow-up: closed as root-caused, no code change.

Controlled pilot: `Conditional Go / Continue`.

Broad production: still `No-Go`.

Why:

- The default role landing mapping is correct in source.
- The observed first-route mismatch is consistent with intentional `returnTo`
  preservation.
- Direct route allow/deny checks matched expectations.
- No command-control or forbidden-data leak was observed.

## Next Action

Do not change auth redirect behavior now.

If this reappears as repeated pilot friction, open a dedicated UX/auth decision
with one of these scoped options:

- clean-browser login rehearsal that explicitly starts from `/auth/login`
  without `returnTo`,
- clearer login copy that labels the preserved return target,
- a role-aware return target fallback only for destinations that are forbidden
  or empty for the resolved role.

The next controlled-pilot evidence item remains Store Action command-mode proof
against a named staging action plan or candidate with a rollback/cleanup note.
