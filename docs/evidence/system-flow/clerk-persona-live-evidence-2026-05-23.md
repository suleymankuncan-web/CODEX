# Clerk Persona Live Evidence - 2026-05-23

## Scope

This evidence refresh was run after the operator asked Codex to sign in and
record the result.

It uses the existing staging-only Clerk pilot accounts. It does not create new
Clerk users, change provider configuration, change HR Axis role/scope
semantics, change DB data, change API response shape, or approve broad
production rollout.

Implementation note:

- The visible `Clerk ile giris yap` action currently opens the Google OAuth
  path. The existing pilot test accounts were verified through the embedded
  Clerk account form by opening `Clerk kullanicisi olustur`, switching to
  `Sign in`, and using the Clerk test-mode email-code flow.
- This note records the working evidence path; it does not change login
  behavior.

## Sokrates Decision

Claim: fresh protected staging evidence can be honestly refreshed with the
existing Clerk pilot accounts, but only for personas that have known staging
credentials.

Assumption: Clerk proves the browser session, while the application DB remains
the source of truth for role, read scope, action-store scope, and route/action
permissions.

Evidence:

- Four existing pilot personas produced real Clerk sessions and backend
  `/auth/session` responses.
- Browser route allow/deny checks passed for `SUPER_ADMIN`,
  `REGION_MANAGER`, `STORE_MANAGER`, and `STORE_PERSONNEL`.
- Store-manager assigned/unassigned action-scope proof passed against a
  read-only endpoint.
- Deployed readiness passed with a real token.
- Backend protected load passed with role-specific tokens for the sampled
  groups.

Counterargument: this is still not a complete five-persona matrix because
`HR_ADMIN` and `REPORT_VIEWER` staging Clerk aliases were not found in repo
evidence or the local environment.

Risk: MEDIUM. The run touched real staging auth sessions and protected
endpoints, but the committed evidence is sanitized and docs-only.

Door: the evidence note is a two-way door. Leaking raw auth material, widening
scope, changing provider config, or mutating DB state to force a pass would not
be a safe two-way door and was avoided.

Stop rule used: stop before recording raw bearer tokens, Clerk cookies,
passwords, authorization codes, full provider subjects, full session storage,
private user IDs, or private personal data.

Verification ladder:

1. Browser login through Clerk for each available pilot persona.
2. Backend `/auth/session` with the real browser token.
3. Same-session route allow/deny checks.
4. Store-manager assigned and unassigned action-scope read.
5. Deployed readiness with a real token.
6. Backend protected load with role-specific tokens.

## Environment

- Frontend: `https://staging.hr-axis.com`
- Backend API: `https://api-staging.hr-axis.com/api`
- Evidence time: `2026-05-23T07:09:13.740Z`
- Auth provider: Clerk staging/test-mode instance
- Raw token handling: local process memory only

Security note:

- Raw bearer tokens were not printed or committed.
- Clerk cookies were not printed or committed.
- Passwords, auth codes, full provider subjects, and full session storage were
  not printed or committed.
- User IDs and employee IDs returned by `/auth/session` were not copied into
  this evidence note.

## Persona Session And Route Evidence

| Persona | Test email | Landing path | Session | Scope summary | Allowed route checks | Denied route checks |
| --- | --- | --- | --- | --- | --- | --- |
| `SUPER_ADMIN` | `pilot.admin+clerk_test@example.com` | `/admin/integrations` | `200`, authenticated, role `SUPER_ADMIN` | company `1`, region `0`, store `0`, assigned action stores `0` | `/admin/integrations`, `/admin/auth` | n/a |
| `REGION_MANAGER` | `pilot.bm+clerk_test@example.com` | `/store/home` | `200`, authenticated, role `REGION_MANAGER` | company `1`, region `1`, store `0`, assigned action stores `1` | `/admin/targets`, `/admin/competitions` | `/admin/auth`, `/admin/master-data`, `/admin/integrations` |
| `STORE_MANAGER` | `pilot.sm+clerk_test@example.com` | `/store/home` | `200`, authenticated, role `STORE_MANAGER` | company `1`, region `1`, store `1`, assigned action stores `1` | `/store`, `/store/me`, `/store/rankings`, `/store/approvals` | `/admin/auth` |
| `STORE_PERSONNEL` | `pilot.personel+clerk_test@example.com` | `/store/me` | `200`, authenticated, role `STORE_PERSONNEL` | company `1`, region `1`, store `1`, assigned action stores `1` | `/store/me`, `/store/rankings` | `/admin/auth`, `/admin/targets`, `/store/approvals` |

Result:

- Available persona route/session smoke passed.
- Failed available-persona checks: `0`.
- The route-denied copy observed for low-role admin/store-manager-only routes
  was `Bu rol icin rota kullanilamaz`. Evidence classifiers should count that
  copy as a deny outcome, not as an allowed route.
- `REGION_MANAGER` landed on `/store/home` after the embedded sign-in path even
  though the requested return route was `/admin/targets`; direct route checks
  still allowed `/admin/targets` and `/admin/competitions`. Treat landing
  fidelity as a UX/deep-link watch item, not an authorization failure.

## Store Manager Action-Scope Evidence

The store-manager token was used against a read-only action-scope endpoint.

| Endpoint | Store class | Status | Result |
| --- | --- | ---: | --- |
| `GET /target-distributions/store-personnel` | assigned action store `1ac47ec2-c19d-4ac8-a23a-181a466a0891` | `200` | `7` personnel rows |
| `GET /target-distributions/store-personnel` | unassigned action store `f01da0a0-d48d-4f26-834b-317a5d66aac8` | `403` | `Out-of-scope store action` |

Result:

- Assigned store read passed.
- Unassigned store denial passed.
- This proof is read-only. It did not create, update, close, or cancel a Store
  Action plan.

## Deployed Readiness With Real Token

`runDeployedReadinessSmoke` was executed with a fresh store-manager Clerk token
kept in process memory.

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
- competition read group: `REGION_MANAGER`
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

## Missing Personas

The following personas remain blocked for the full five-persona runbook:

| Persona | Status | Reason |
| --- | --- | --- |
| `HR_ADMIN` | blocked | No staging Clerk alias or credential was found in repo evidence or the local environment. |
| `REPORT_VIEWER` | blocked | No staging Clerk alias or credential was found in repo evidence or the local environment. |

If those personas are required for a later pilot gate, create or reveal the
staging-only accounts, bind them through the approved app role/scope flow, and
rerun the same sanitized evidence path.

## Decision

Controlled staging Clerk persona evidence for the existing pilot account set:
Go.

Full five-persona runbook: Partial Go. The existing four available personas
plus `REGION_MANAGER`-style regional proof are current, but `HR_ADMIN` and
`REPORT_VIEWER` are still blocked by missing accounts/credentials.

Broad production readiness: still No-Go from this evidence alone. This closes
fresh protected-token evidence for sampled controlled-pilot paths, but it does
not replace separate production Redis/BullMQ posture, production alert policy,
Supabase managed restore/PITR/RPO/RTO decisions, or any future HR/report-viewer
persona onboarding proof.

## Verification

Checks run:

- Inline Playwright browser login through the staging app's embedded Clerk
  account form for four existing pilot personas.
- `GET /api/auth/session` with each real Clerk bearer token.
- Same-session route allow/deny smoke for each available persona.
- Store-manager assigned/unassigned action-scope read smoke.
- Root deployed readiness smoke through `runDeployedReadinessSmoke` with a real
  token.
- Root backend protected load smoke through `runBackendReadinessLoadSmoke` with
  role-specific tokens.

Final run result:

- Browser persona smoke: passed for all four available personas.
- Action-scope smoke: assigned `200`, unassigned `403`.
- Deployed readiness: `14/14` passed.
- Backend protected load: `5/5` groups passed.

Sanitization:

- Raw bearer tokens included: no.
- Clerk cookies included: no.
- Passwords/auth codes included: no.
- Full provider subjects included: no.
- Full session storage included: no.
- Private user or employee IDs included: no.
