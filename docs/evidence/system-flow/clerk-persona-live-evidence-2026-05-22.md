# Clerk Persona Live Evidence - 2026-05-22

## Scope

This evidence closes the fresh Clerk persona proof that was previously parked
in Milestone 7 of the system-flow readiness line.

It uses real staging Clerk sessions through the existing pilot test-mode
persona accounts. It does not create duplicate Clerk accounts, change Clerk
provider configuration, change HR Axis role/scope semantics, change DB schema,
or approve broad production rollout.

## Sokrates Decision

Decision:

- Reuse the existing staging-only Clerk pilot accounts instead of creating new
  duplicate accounts.
- Collect fresh real-token evidence from those accounts.
- Keep raw token/session/provider material out of docs, terminal summaries,
  PR comments, and committed files.

Why:

- The existing pilot accounts already produce real Clerk sessions and are
  already bound to HR Axis DB roles/scopes.
- Creating new accounts would not improve evidence quality unless a missing
  persona is explicitly required, and it would add staging auth/DB cleanup
  risk.
- The riskiest open proof was not account creation itself; it was whether real
  Clerk sessions still mint tokens that the backend accepts and maps to the
  expected HR Axis authorization context.

Counterargument:

- Creating a completely fresh account would prove the onboarding path more
  directly. That is true, but the current pilot binding UI only supports the
  bounded pilot roles and requires provider subject handling. That belongs in a
  separate onboarding smoke, not in this evidence closeout.

Risk:

- MEDIUM, because this touches real staging auth sessions and protected
  endpoints.
- LOW for the committed note, because only sanitized evidence is stored.

Door:

- The evidence note is a two-way door.
- Provider config changes, DB role widening, or account cleanup are not casual
  two-way work and were intentionally avoided.

Stop rule used:

- Stop before recording raw bearer tokens, Clerk cookies, full provider
  subjects, passwords, full session storage, or private personal data.
- Stop before widening a persona's scope to force a smoke to pass.

## Environment

- Frontend: `https://staging.hr-axis.com`
- Backend API: `https://api-staging.hr-axis.com/api`
- Auth provider: Clerk development/test-mode staging instance
- Clerk test sign-in code used locally: `424242`
- Evidence time: `2026-05-22T05:00:04.822Z` for persona route smoke and
  `2026-05-22T05:02:16.517Z` for deployed readiness smoke

Security note:

- Raw bearer tokens were used only in local process memory or local environment
  variables for smoke commands.
- No raw bearer token, Clerk cookie, password, full provider subject, full JWT,
  or session storage dump is recorded here.

## Persona Session And Route Evidence

Fresh browser login was performed through the staging app's Clerk modal for
each persona. The frontend stored a bearer token, and the backend
`GET /api/auth/session` returned the expected HR Axis role/scope context.

| Persona | Test email | Expected role | Login landing | Session | Scope summary | Route result |
| --- | --- | --- | --- | --- | --- | --- |
| Super admin | `pilot.admin+clerk_test@example.com` | `SUPER_ADMIN` | `/admin/integrations` | `200`, authenticated | company `1`, region `0`, store `0`, assigned action stores `0` | `/admin/integrations` and `/admin/auth` allowed |
| Region manager | `pilot.bm+clerk_test@example.com` | `REGION_MANAGER` | `/admin/targets` | `200`, authenticated | company `1`, region `1`, store `0`, assigned action stores `1` | `/admin/targets` and `/admin/competitions` allowed; auth/master-data/integrations denied by route guard copy |
| Store manager | `pilot.sm+clerk_test@example.com` | `STORE_MANAGER` | `/store` | `200`, authenticated | company `1`, region `1`, store `1`, assigned action stores `1` | `/store`, `/store/me`, `/store/rankings`, and `/store/approvals` allowed; `/admin/auth` denied |
| Store personnel | `pilot.personel+clerk_test@example.com` | `STORE_PERSONNEL` | `/store` | `200`, authenticated | company `1`, region `1`, store `1`, assigned action stores `1` | `/store/me` and `/store/rankings` allowed; `/admin/auth` and `/admin/targets` denied |

Result:

- Persona route/session smoke passed.
- Failed checks: `0`.
- Important correction from the first local attempt: route checks must run
  inside the real Clerk browser session. Injecting only the bearer token into a
  new browser context produces false negatives because the Clerk bridge expects
  a live Clerk session during hydration.

## Store Manager Action-Scope Evidence

The store manager persona produced a real Clerk bearer token. The
`smoke:auth:staging:token-scope` path then used that token without printing it.

Pre-smoke summary:

- Login final route: `/store`
- Token captured: yes
- `/auth/session`: `200`
- Role: `STORE_MANAGER`
- Assigned action store id: `1ac47ec2-c19d-4ac8-a23a-181a466a0891`
- Ranking store candidates found for negative proof: `112`
- Unassigned candidate used: `f01da0a0-d48d-4f26-834b-317a5d66aac8`
  (`Sanliurfa Siverek Cadde`)

Smoke result:

| Endpoint | Store class | Status | Result |
| --- | --- | ---: | --- |
| `GET /target-distributions/store-personnel` | assigned action store | `200` | `7` personnel rows |
| `GET /target-distributions/store-personnel` | unassigned action store | `403` | `Out-of-scope store action` |

Result:

- `staging-clerk-token-action-scope-smoke-passed`
- This was read-only action-scope proof; it did not create a target request or
  write DB data.

## Deployed Readiness With Real Token

The root deployed readiness smoke was rerun with a fresh store manager Clerk
bearer token.

Result:

- Status: `ok`
- Total checks: `14`
- Passed: `14`
- Failed: `0`
- Skipped: `0`
- `tokenProvided`: `true`
- `backend auth session`: `200`, authenticated, role `STORE_MANAGER`

Additional observed readiness facts:

- Backend health and dependency checks passed.
- Rate-limit and correlation headers were present.
- Frontend root, SPA fallback, security headers, and sampled static assets
  passed.
- Backend health still reports queue backend `in-memory` and observability
  `log-only`; this remains acceptable for controlled pilot posture, not broad
  production approval.

## Account Creation Decision

No new Clerk accounts were created in this slice.

Reason:

- The existing staging pilot accounts are real Clerk users for the controlled
  pilot and still produce valid tokens.
- The missing proof was fresh session/action evidence, now collected.
- Creating duplicate accounts would require provider-subject binding and
  staging DB role/action assignment work, which is a separate onboarding smoke
  with cleanup requirements.

If a future onboarding smoke is explicitly requested, create a separate
evidence slice that:

- creates one new staging-only Clerk account,
- captures its provider subject only locally,
- binds it through the approved auth admin flow,
- verifies session/role/scope,
- records no raw provider subject or token,
- and defines cleanup/deactivation evidence.

## Decision

Controlled staging Clerk persona evidence: Go.

Broad production readiness: still not approved by this note alone. This closes
the real Clerk/persona/token evidence blocker, but broad production still needs
the broader release/readiness decision set to be accepted, including durable
queue/Redis posture and any remaining external provider evidence.

## Verification

Commands/checks run:

- Playwright browser login through Clerk modal for four pilot personas.
- `GET /api/auth/session` with each real Clerk bearer token.
- Same-session route allow/deny browser smoke for each persona.
- Store manager token-scope smoke using
  `admin-web/scripts/auth-token-scope-smoke.mjs --staging`.
- Root deployed readiness smoke through `runDeployedReadinessSmoke` with
  `READINESS_BEARER_TOKEN` supplied from a fresh local Clerk session.

Sanitization:

- Raw bearer tokens were not printed.
- Clerk cookies were not printed.
- Passwords were not printed.
- Full provider subjects were not printed.
- Full session storage was not printed.
