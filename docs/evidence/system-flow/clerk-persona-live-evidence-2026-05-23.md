# Clerk Persona Live Evidence - 2026-05-23

Update note:

- This file records the five-persona pass completed earlier on 2026-05-23.
- `REGION_MANAGER` was closed later the same day in
  `docs/evidence/system-flow/clerk-region-manager-live-evidence-2026-05-23.md`.
- Read the two files together for the current active controlled-pilot persona
  evidence set.

## Scope

This evidence refresh was run after the operator asked Codex to sign in and
finish the full persona matrix.

It uses real staging-only Clerk test-mode sessions and the application DB as
the authorization source of truth. The final pass was run after PR #451 and the
operator's Render deploy confirmation.

One-time staging setup was required before the final pass:

- `HR_ADMIN` and `REPORT_VIEWER` staging-only Clerk aliases were created through
  the Clerk browser flow.
- The aliases were bound through the existing app auth-admin API flow.
- No direct DB edit, DB migration, provider config change, API response shape
  change, auth semantics change, CSS change, or product code change was made in
  this evidence branch.

Implementation note:

- The visible `Clerk ile giris yap` action currently opens the Google OAuth
  path. The staging test accounts were verified through the embedded Clerk
  account form by opening `Clerk kullanicisi olustur`, switching to `Sign in`,
  and using the Clerk test-mode email-code flow.
- The final readiness/load smoke used fresh Clerk `hr-axis-api` template
  tokens. The default Clerk token is not accepted by the backend audience
  policy and must not be counted as protected evidence.

## Sokrates Decision

Claim: the controlled staging Clerk evidence can now be upgraded from a partial
pilot-account proof to the full five-persona matrix.

Assumption: Clerk proves browser identity, while HR Axis DB role assignments,
read scope, and action-store assignments remain the source of authorization.

Evidence:

- All five pilot personas produced real Clerk sessions and backend
  `/auth/session` responses.
- Same-session browser route checks passed for allowed and denied routes.
- Non-super-admin personas received `403` on sampled auth-admin endpoints.
- Store-manager assigned/unassigned action-scope proof passed against a
  read-only endpoint.
- Deployed readiness passed with a real store-manager token.
- Backend protected load passed with role-specific tokens.

Counterargument: this is still not broad production proof. It does not replace
provider-delivery evidence, Supabase restore evidence, authenticated upload
evidence, or a production rollout decision.

Risk: MEDIUM. The run touched real staging auth sessions and protected
endpoints, but the committed evidence is sanitized.

Door: this evidence note is a two-way door. Leaking raw auth material, widening
scope, changing provider config, or mutating DB state to force a pass would not
be a safe two-way door and was avoided.

Stop rule used: stop before recording raw bearer tokens, Clerk cookies,
passwords, authorization codes, full provider subjects, full session storage,
private user IDs, employee IDs, store IDs, or private personal data.

Verification ladder:

1. Browser login through Clerk for each pilot persona.
2. Backend `/auth/session` with a real Clerk template token.
3. Same-session route allow/deny checks.
4. Backend negative auth-admin checks for non-super-admin personas.
5. Store-manager assigned and unassigned action-scope read.
6. Deployed readiness with a real token.
7. Backend protected load with role-specific tokens.

## Environment

- Frontend: `https://staging.hr-axis.com`
- Backend API: `https://api-staging.hr-axis.com/api`
- Evidence time: `2026-05-23T09:34:35.274Z`
- Auth provider: Clerk staging/test-mode instance
- Raw token handling: local process memory only
- Code baseline: PR #451 merged and live per operator confirmation

Security note:

- Raw bearer tokens were not printed or committed in this document.
- Clerk cookies were not printed or committed.
- Passwords, auth codes, full provider subjects, and full session storage were
  not printed or committed.
- User IDs, employee IDs, store IDs, provider subjects, and JWT payloads are not
  copied into this evidence note.

## Persona Session And Route Evidence

| Persona | Test email | Landing path | Session | Scope summary | Allowed route checks | Denied route checks |
| --- | --- | --- | --- | --- | --- | --- |
| `SUPER_ADMIN` | `pilot.admin+clerk_test@example.com` | `/admin/integrations` | `200`, authenticated, role `SUPER_ADMIN` | company `1`, region `0`, store `0`, assigned action stores `0` | `/admin/integrations`, `/admin/auth` | n/a |
| `HR_ADMIN` | `pilot.hr+clerk_test@example.com` | `/admin/competitions` | `200`, authenticated, role `HR_ADMIN` | company `1`, region `0`, store `0`, assigned action stores `0` | `/admin/competitions`, `/admin/master-data`, `/admin/checklists` | `/admin/auth`, `/admin/integrations`, `/admin/reports` |
| `STORE_MANAGER` | `pilot.sm+clerk_test@example.com` | `/store/tasks` | `200`, authenticated, role `STORE_MANAGER` | company `1`, region `1`, store `1`, assigned action stores `1` | `/store`, `/store/me`, `/store/tasks`, `/store/approvals`, `/store/kpis`, `/store/rankings` | `/admin/auth` |
| `STORE_PERSONNEL` | `pilot.personel+clerk_test@example.com` | `/store/me` | `200`, authenticated, role `STORE_PERSONNEL` | company `1`, region `1`, store `1`, assigned action stores `1` | `/store/me`, `/store/rankings` | `/admin/auth`, `/admin/targets`, `/store/approvals` |
| `REPORT_VIEWER` | `pilot.report-viewer+clerk_test@example.com` | `/admin/reports` | `200`, authenticated, role `REPORT_VIEWER` | company `1`, region `0`, store `0`, assigned action stores `0` | `/admin/reports`, `/admin/targets`, `/admin/inbox`, `/store/tasks` | `/admin/auth`, `/admin/master-data`, `/admin/integrations` |

Result:

- Full five-persona browser route/session smoke passed.
- Failed route/session checks: `0`.
- `REPORT_VIEWER` direct `/store/tasks` visibility is classified as read-only
  allowed, not as a route-deny requirement. The page exposes workflow inbox
  visibility for reporting, while Store Action command controls remain absent
  for that persona.

## Backend Negative Auth-Admin Evidence

The sampled auth-admin endpoints returned forbidden for every non-super-admin
persona.

| Persona | `GET /auth/users?limit=1` | `POST /auth/users` |
| --- | ---: | ---: |
| `HR_ADMIN` | `403` | `403` |
| `STORE_MANAGER` | `403` | `403` |
| `STORE_PERSONNEL` | `403` | `403` |
| `REPORT_VIEWER` | `403` | `403` |

## Store Manager Action-Scope Evidence

The store-manager token was used against a read-only action-scope endpoint.

| Endpoint | Store class | Status | Result |
| --- | --- | ---: | --- |
| `GET /target-distributions/store-personnel` | assigned action store | `200` | `7` personnel rows |
| `GET /target-distributions/store-personnel` | unassigned action store | `403` | `Out-of-scope store action` |

Result:

- Assigned store read passed.
- Unassigned store denial passed.
- This proof is read-only. It did not create, update, close, or cancel a Store
  Action plan.

## Report Viewer Store Tasks Boundary

`REPORT_VIEWER` can open `/store/tasks` as a read-only workflow-inbox surface.
The final pass checked that command controls were not visible for that persona.

Result:

- `/store/tasks`: route allowed.
- Store Action create/status/close/cancel controls: absent.

This matches the current implementation: report users can inspect queue signals
but cannot manage Store Action plans.

## Deployed Readiness With Real Token

`runDeployedReadinessSmoke` was executed with a fresh store-manager Clerk
template token kept in process memory.

Result:

- Status: `ok`
- Total checks: `14`
- Passed: `14`
- Failed: `0`
- Skipped: `0`
- `tokenProvided`: `true`
- `backend auth session`: `200`, authenticated, role `STORE_MANAGER`

## Backend Protected Load With Role-Specific Tokens

`runBackendReadinessLoadSmoke` was executed with role-specific tokens kept in
process memory:

- session group: `SUPER_ADMIN`
- store read group: `STORE_MANAGER`
- competition read group: `HR_ADMIN`
- import read group: `SUPER_ADMIN`

Result:

- Status: `ok`
- Total groups: `5`
- Passed: `5`
- Failed: `0`
- Skipped: `0`
- Passed groups:
  - public API health
  - authenticated session
  - store read routes
  - competition read routes
  - import read routes

## Decision

Full five-persona controlled staging Clerk matrix: Go.

Controlled staging/internal pilot posture: stronger than the previous partial
proof, but still Conditional Go because non-auth production blockers remain.

Broad production readiness: still No-Go from this evidence alone. This closes
the Clerk/persona protected-token path, but it does not replace separate
production alert-provider delivery proof, Supabase managed restore/PITR/RPO/RTO
decisions, authenticated upload proof, or the broader rollout decision.

## Verification

Checks run:

- Inline Playwright browser login through the staging app's embedded Clerk
  account form for all five pilot personas.
- `GET /api/auth/session` with each real Clerk template bearer token.
- Same-session route allow/deny smoke for each persona.
- Backend negative auth-admin endpoint checks for non-super-admin personas.
- Store-manager assigned/unassigned action-scope read smoke.
- Root deployed readiness smoke through `runDeployedReadinessSmoke` with a real
  token.
- Root backend protected load smoke through `runBackendReadinessLoadSmoke` with
  role-specific tokens.

Final run result:

- Browser persona smoke: passed for all five personas.
- Backend negative auth-admin checks: expected `403` for all sampled
  non-super-admin cases.
- Report-viewer `/store/tasks`: read-only route allowed, command controls
  absent.
- Action-scope smoke: assigned `200`, unassigned `403`.
- Deployed readiness: `14/14` passed.
- Backend protected load: `5/5` groups passed.

Sanitization:

- Raw bearer tokens included: no.
- Clerk cookies included: no.
- Passwords/auth codes included: no.
- Full provider subjects included: no.
- Full session storage included: no.
- Private user, employee, provider, or store IDs included: no.
