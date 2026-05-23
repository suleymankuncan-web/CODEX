# Clerk Region Manager Live Evidence - 2026-05-23

## Scope

This evidence closes the `REGION_MANAGER` follow-up that remained after the
five-persona Clerk evidence pass.

It uses the existing staging-only Clerk test account for the region manager
persona and the application DB as the authorization source of truth. No product
code, auth semantics, API response shape, DB schema, provider configuration,
CSS, or user-facing workflow behavior was changed.

## Sokrates Decision

Claim:

- `REGION_MANAGER` is an active product role and needs fresh protected staging
  evidence before being treated as signed-off in the pilot scenario pack.

Assumptions:

- Clerk proves browser identity.
- HR Axis DB role, read scope, and action-store assignments remain the
  authorization source of truth.
- Existing staging-only pilot accounts are acceptable evidence inputs when no
  duplicate account/onboarding proof is being requested.

Evidence:

- The region manager Clerk account produced a real bearer session.
- Backend `/auth/session` returned authenticated `REGION_MANAGER`.
- Allowed route checks opened.
- Denied route checks showed the route-forbidden state.
- Auth-admin API endpoints returned `403`.
- Deployed readiness passed with the region manager token.

Counterargument:

- This is still controlled staging evidence, not broad production approval.
- It does not prove provider onboarding, managed restore/PITR, broad-production
  Redis durability, or future upload role/sample variations.

Risk:

- MEDIUM while collecting evidence because real staging auth sessions and a
  bearer token were used.
- LOW for the committed note because all secret and private identifiers are
  redacted or summarized.

Door:

- Two-way-door evidence note. It can be refreshed after a deploy, role change,
  or pilot-scope change.

Stop rule used:

- Do not record raw bearer tokens, Clerk cookies, passwords, auth codes,
  provider subjects, full session storage, private user IDs, employee IDs, or
  store IDs.

## Environment

- Frontend: `https://staging.hr-axis.com`
- Backend API: `https://api-staging.hr-axis.com/api`
- Persona: `REGION_MANAGER`
- Test account alias: `pilot.bm+clerk_test@example.com`
- Evidence time: `2026-05-23T11:58:08.905Z`
- Raw token handling: local process memory only

Security note:

- Raw bearer tokens were not printed or committed.
- Clerk cookies were not printed or committed.
- Passwords, auth codes, provider subjects, private IDs, and full session
  storage were not printed or committed.

## Session Evidence

The region manager persona signed in through the staging app's Clerk modal using
the documented Clerk test-mode email-code path.

Result:

- Token captured in browser session storage: yes.
- Backend `/auth/session`: `200`.
- `authMode`: `jwt`.
- Authenticated: yes.
- Role: `REGION_MANAGER`.
- Read scope count: company `1`, region `1`, store `0`.
- Action scope count: assigned stores `1`.

## Route Evidence

The first post-login landing was `/store/home`. This matches the current
application landing resolver for `REGION_MANAGER`; the admin target route is
still allowed when opened directly after the same session is established.

| Route | Expected | Observed | Result |
| --- | --- | --- | --- |
| `/admin/targets` | allowed | opened | pass |
| `/admin/competitions` | allowed | opened | pass |
| `/store/rankings` | allowed | opened | pass |
| `/admin/auth` | denied | route-forbidden copy | pass |
| `/admin/master-data` | denied | route-forbidden copy | pass |
| `/admin/integrations` | denied | route-forbidden copy | pass |

## Backend Boundary Evidence

The same region manager token was used against sampled auth-admin endpoints.

| Endpoint | Expected | Observed | Result |
| --- | ---: | ---: | --- |
| `GET /auth/users?limit=1` | `403` | `403` | pass |
| `POST /auth/users` | `403` | `403` | pass |

No auth-admin mutation was accepted.

## Deployed Readiness With Region Manager Token

`runDeployedReadinessSmoke` was executed with the region manager Clerk token
kept in process memory.

Result:

- Status: `ok`.
- Total checks: `14`.
- Passed: `14`.
- Failed: `0`.
- Skipped: `0`.
- `tokenProvided`: `true`.
- Backend auth session: `200`, authenticated, role `REGION_MANAGER`.

## Logout Evidence

The evidence script navigated to `/auth/logout` after the checks.

Result:

- Final path: `/auth/login`.
- Bearer token stored after logout: no.
- Provider ID token stored after logout: no.

## Decision

`REGION_MANAGER` controlled staging Clerk evidence: Go.

The active pilot persona set now has fresh protected Clerk evidence for:

- `SUPER_ADMIN`
- `HR_ADMIN`
- `REGION_MANAGER`
- `STORE_MANAGER`
- `STORE_PERSONNEL`
- `REPORT_VIEWER`

Controlled staging/internal pilot posture remains Conditional Go because
broad-production provider and recovery posture decisions stay separate from
this auth evidence.

Broad production readiness remains No-Go from this evidence alone.

## Verification

Checks run:

- Playwright browser login through the staging app's embedded Clerk account
  form.
- `GET /api/auth/session` with a real Clerk bearer token.
- Same-session route allow/deny checks.
- Backend auth-admin negative endpoint checks.
- Root deployed readiness smoke through `runDeployedReadinessSmoke` with a real
  token.
- Logout storage clear check.

Final run result:

- Region manager browser/session smoke: passed.
- Route allow/deny checks: passed.
- Backend auth-admin negative checks: passed.
- Deployed readiness: `14/14` passed.
- Logout storage clear: passed.

Sanitization:

- Raw bearer tokens included: no.
- Clerk cookies included: no.
- Passwords/auth codes included: no.
- Full provider subjects included: no.
- Full session storage included: no.
- Private user, employee, provider, or store IDs included: no.
