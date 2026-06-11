# Security Launch Blocker PR Train V1

Status: active
Shelf: readiness/security
Last verified: 2026-06-12

> For agentic workers: REQUIRED SUB-SKILL before implementation:
> `superpowers:executing-plans`. Execute one PR at a time. Do not combine
> auth transport, frontend storage removal, env guards, and provider evidence in
> a single PR.

## Reader And Action

Reader:

- a future agent, engineer, security reviewer, or release owner who needs to
  turn the security launch-blocker review into small mergeable PRs.

After reading, they should be able to:

- identify the concrete launch blockers from the security review,
- execute the PR train without widening scope into broad auth redesign,
- preserve the existing Clerk identity plus HR Axis DB authorization boundary,
- know exactly which checks and stop rules apply before each merge,
- close the train only with tests and sanitized evidence, not assumptions.

## Goal

Remove launch-blocking browser token storage and close the adjacent browser
session security gaps required before an MVP or broad production launch claim.

The train addresses the security checklist as follows:

- no raw API, bearer, id, refresh, JWT secret, database, or provider secret in
  the frontend;
- no bearer or provider id token persisted in `localStorage` or
  `sessionStorage`;
- backend validation, CORS allowlist, rate limiting, RBAC, scope guards, SQL
  safety, release checks, and dependency audits stay active;
- cookie auth uses `HttpOnly`, `Secure`, and `SameSite` attributes;
- unsafe cookie-authenticated requests have CSRF protection;
- committed examples and docs do not contain secrets;
- launch readiness remains blocked until real provider/session evidence is
  recorded without raw tokens.

## Architecture

The existing model stays intact:

- Clerk authenticates identity.
- Backend verifies provider JWTs through the existing JWT/JWKS path.
- HR Axis database role, scope, and assigned-store rows authorize behavior.
- Frontend route visibility remains UX only; backend guards stay authoritative.

The browser session transport changes:

1. The frontend may request a provider token from Clerk in memory.
2. The frontend sends that token once to a backend browser-session endpoint.
3. The backend verifies the provider token through the existing auth provider.
4. The backend issues a short-lived, backend-signed app session cookie using
   the existing `jose` dependency or Node crypto primitives.
5. The browser stores only cookies:
   - host-only `HttpOnly` app session cookie, not readable by JavaScript;
   - readable CSRF nonce cookie, not an auth credential.
6. Browser-session creation and API calls use `credentials: "include"`.
7. Unsafe methods include an `X-CSRF-Token` header matching the CSRF cookie and
   the hash stored inside the signed app session.
8. Backend request auth resolves cookie sessions for browser traffic and keeps
   `Authorization: Bearer` support for controlled scripts, smoke tests, and
   rollback until the train closes.

The app session cookie must contain only minimum auth transport claims:

- session envelope version;
- signing key id;
- provider key;
- provider subject;
- issued-at timestamp;
- expiry timestamp;
- CSRF nonce hash;
- optional session id for log correlation.

It must not contain app roles, store ids, region ids, private user data, raw
provider JWTs, refresh tokens, or secrets. Role/scope lookup continues through
backend DB authorization on each request.

## Tech Stack

- Frontend: Vite, React, Clerk browser SDK, existing API client.
- Backend: NestJS, existing JWT/JWKS provider, Express middleware, existing
  validation/CORS/rate-limit/security header stack.
- Session: backend-signed short-lived cookie with `HttpOnly`, `Secure` in
  production, host-only scope by default, `SameSite=Lax` by default, and CSRF
  nonce binding.
- Verification: existing root script tests, backend unit/e2e tests, frontend
  build/e2e tests, security guard scripts, sanitized staging evidence.

## Plan Review Fixes Applied

The first plan pass left several implementation traps. They are fixed in this
version:

- frontend transport uses `VITE_BROWSER_SESSION_TRANSPORT`, not a broad
  `VITE_AUTH_TRANSPORT`, so existing `VITE_AUTH_MODE=mock|bearer` semantics do
  not drift;
- backend cookie auth must use a dedicated browser-session resolver and shared
  authorization merge path, not a synthetic `Authorization` header;
- Clerk bridge, PKCE callback, logout, Session Readiness copy, and existing
  bearer smoke/e2e harnesses are all in scope for the frontend migration;
- session signing, key rotation, TTL, host-only cookie scope, and no
  cookie-only refresh are explicit requirements;
- CSRF is scoped to cookie-authenticated protected state-changing requests, with
  endpoint-specific behavior for session create/clear;
- mobile session endpoints remain out of scope.

## Findings Being Addressed

### P0 Launch Blocker: Browser-Readable Tokens

Current risk:

- `admin-web/src/features/session/session-storage.ts` reads a bearer token from
  frontend env and browser storage.
- The same session layer can write bearer and provider id tokens to
  `sessionStorage`.
- `admin-web/src/features/auth/clerk-session.tsx` currently syncs Clerk tokens
  into the bearer session path.
- `admin-web/src/pages/AuthCallbackPage.tsx` currently writes PKCE token
  exchange results through `startBearerSession`.
- `admin-web/src/pages/AuthLogoutPage.tsx` can depend on a stored provider id
  token for `id_token_hint`.
- Session Readiness and Auth Flow localized copy still describes sessionStorage
  bearer-token behavior.
- The API client sends browser-owned `Authorization: Bearer ...` headers.

Why this blocks launch:

- XSS can read `sessionStorage` and exfiltrate active bearer or id tokens.
- Logout and expired-token guards help cleanup, but they do not remove the
  theft risk while a session is live.
- `VITE_BEARER_TOKEN` is documented as local-only, but the runtime path still
  exists and must not be the browser launch path.

Required outcome:

- Real provider browser sessions do not persist bearer, id, access, refresh, or
  provider tokens in `localStorage` or `sessionStorage`.
- Frontend committed env examples keep `VITE_BEARER_TOKEN` empty.
- Script guards fail if token storage returns to the launch browser path.

### P1 Launch Blocker: CSRF After Cookie Auth

Current risk:

- CSRF is not the main issue while browser auth uses explicit bearer headers.
- Moving to cookies creates CSRF exposure for unsafe methods if not guarded.

Required outcome:

- Cookie-authenticated `POST`, `PUT`, `PATCH`, and `DELETE` requests require a
  valid CSRF header.
- Bearer-authenticated script requests remain supported without CSRF during the
  migration window.
- CSRF failure returns a generic 403 response without leaking session details.

### P1 Launch Blocker: Browser Session Env Contract

Current risk:

- `VITE_AUTH_MODE=bearer` and `VITE_BEARER_TOKEN` are historically useful for
  local and smoke flows.
- Launch mode needs a named, guarded browser transport contract so future work
  does not silently reintroduce token persistence.

Required outcome:

- Environment inventory names the cookie browser-session variables.
- `VITE_AUTH_MODE` keeps its existing `mock` versus `bearer` meaning.
- `VITE_BROWSER_SESSION_TRANSPORT` selects whether real browser sessions use
  legacy bearer transport or cookie transport.
- Production-like config fails closed when cookie sessions are enabled without
  a signing secret or secure cookie settings.
- Local/dev mocks remain allowed only where existing mock auth rules allow them.

### P1 Launch Blocker: Evidence Without Raw Secrets

Current risk:

- Security evidence can accidentally include bearer tokens, cookies, provider
  subjects, auth codes, or storage dumps.

Required outcome:

- Auth/session evidence records only sanitized facts:
  - cookie flags observed;
  - browser storage has no raw tokens;
  - CSRF negative and positive checks pass;
  - assigned-store and unassigned-store authorization still behave correctly.
- No evidence file stores raw cookies, JWTs, passwords, provider secrets,
  database URLs, Redis URLs, provider subjects, or private user data.

## Already Strong, Do Not Rebuild

The review found these areas already have useful controls. Do not rewrite them
unless a targeted failure appears:

- backend global validation pipe with whitelist and forbidden unknown fields;
- explicit CORS allowlist with credentials support and no production `*`;
- global rate limit middleware with Redis requirement for broad production;
- security headers through backend middleware and frontend deployment configs;
- JWT/JWKS verification with issuer, audience, and expiry requirements;
- app DB role/scope guards and assigned-store action-scope guard;
- `.env` ignore rules, env inventory, and Supabase boundary guard;
- release checks with dependency audits.

The train should preserve these controls and add coverage only where the
browser token-storage gap exists.

## Non-Goals

This train does not:

- replace Clerk;
- create a new identity provider;
- add backend refresh-token storage;
- add long-lived server-side sessions;
- change mobile session endpoints or mobile session storage;
- change role names, scope semantics, or assigned-store authorization;
- change API response shapes except for the new browser-session endpoints;
- change database schema unless a later PR is explicitly rescoped and approved;
- move direct Supabase access into the frontend;
- change KPI scoring, checklist weights, import lifecycle, queue posture, or
  workflow state machines;
- claim broad production readiness by itself;
- paste or request secrets in docs, PRs, issues, or chat.

## Authority And Hard Stops

Allowed within this plan:

- create `codex/` branches for each PR;
- edit docs, tests, backend auth transport, frontend session transport, env
  examples, and guard scripts within the scoped train;
- run local release gates and GitHub/Vercel checks;
- open one small PR at a time with rollback and verification notes.

Stop and ask for explicit owner input before:

- changing provider configuration in Clerk, Render, Vercel, Supabase, or Redis;
- adding a cookie `Domain` attribute instead of using host-only cookies;
- handling raw bearer tokens, cookies, passwords, JWTs, private keys, or
  database URLs;
- mutating staging or production data;
- adding a DB migration;
- changing role/scope authorization semantics;
- extending browser app-session TTL beyond one hour;
- removing bearer support from protected smoke scripts;
- changing API response contracts outside the new session endpoints;
- claiming protected staging evidence without a real session;
- merging any PR with red local, GitHub, Vercel, or Codex review state.

## PR Train Overview

### PR-0: Plan And Control Links

Status: this document.

Scope:

- add the security launch-blocker PR train plan;
- link it from the docs library, active next actions, control board, and runbook
  registry.

Verification:

- `git diff --check`;
- `npm.cmd run test:scripts`.

Merge criteria:

- docs-only diff;
- no runtime behavior change;
- plan linked from the operating docs.

Rollback:

- revert the docs-only PR.

### PR-1: Browser Session Contract And Env Guard

Purpose:

- introduce the exact cookie-session contract before behavior changes.

Expected files:

- `docs/plans/environment-variable-inventory.md`;
- `docs/domains/auth.md`;
- `backend/nestjs/.env.example`;
- `admin-web/.env.example`;
- `backend/nestjs/src/shared/app-config.service.ts`;
- a focused script guard under `scripts/`.

Implementation tasks:

- define production-like for this train as `NODE_ENV=production` or any deployed
  staging/production environment using a real provider session. Do not use
  `READINESS_PROFILE=controlled-pilot` to weaken cookie security;
- add backend env contract:
  - `BROWSER_SESSION_COOKIE_ENABLED`;
  - `BROWSER_SESSION_COOKIE_NAME`;
  - `BROWSER_SESSION_CSRF_COOKIE_NAME`;
  - `BROWSER_SESSION_SECRET`;
  - `BROWSER_SESSION_PREVIOUS_SECRET`;
  - `BROWSER_SESSION_TTL_SECONDS`;
  - `BROWSER_SESSION_RENEWAL_WINDOW_SECONDS`;
  - `BROWSER_SESSION_SAME_SITE`;
- add frontend env contract:
  - `VITE_BROWSER_SESSION_TRANSPORT` with allowed values `bearer` and
    `cookie`;
- require `BROWSER_SESSION_SECRET` only when cookie sessions are enabled in a
  production-like backend;
- reject default, empty, short, or low-entropy browser-session secrets in
  production-like backends;
- sign new cookies only with `BROWSER_SESSION_SECRET` and verify with
  `BROWSER_SESSION_SECRET` plus optional `BROWSER_SESSION_PREVIOUS_SECRET`;
- require `Secure` cookies when `NODE_ENV=production`;
- default cookies to host-only scope with no `Domain` attribute;
- reject `SameSite=None` unless secure cookies are enabled;
- keep `SameSite=None` behind explicit owner approval because the current
  staging and production frontend/API hosts are same-site subdomains;
- define `BROWSER_SESSION_TTL_SECONDS` default and upper bound. V1 default is
  900 seconds; production-like values above 3600 seconds require explicit owner
  approval;
- define renewal as provider-backed only. A cookie alone cannot refresh itself;
  frontend must re-derive a fresh app session from the active Clerk/provider
  browser session;
- keep committed examples placeholder-only;
- document that `VITE_BEARER_TOKEN` remains local-only and must not be used for
  launch browser sessions.

Verification:

- targeted env-contract script;
- `npm.cmd run test:scripts`;
- backend config tests if existing config coverage is touched.

Merge criteria:

- env names are documented, guarded, and represented in examples;
- no auth behavior changes yet;
- production-like startup cannot enable cookie sessions insecurely.
- `VITE_AUTH_MODE` keeps the existing `mock`/`bearer` contract and is not
  overloaded as the browser transport flag.

Rollback:

- revert env additions and guard changes before behavior PRs are merged.

### PR-2: Backend Cookie Session Foundation

Purpose:

- add backend support for issuing, verifying, and clearing secure browser
  session cookies without changing authorization semantics.

Expected files:

- `backend/nestjs/src/modules/auth/`;
- `backend/nestjs/src/shared/http/`;
- `backend/nestjs/src/shared/app-config.service.ts`;
- backend auth tests under the existing NestJS test structure.

Implementation tasks:

- add `POST /api/auth/browser-session`:
  - accepts a provider bearer token in the `Authorization` header;
  - verifies it through the existing JWT/JWKS auth provider;
  - creates a short-lived backend app session;
  - sets the HttpOnly app session cookie;
  - sets the readable CSRF nonce cookie;
  - returns only sanitized session metadata already safe for the browser.
- add `DELETE /api/auth/browser-session`:
  - clears the app session and CSRF cookies;
  - does not require raw token evidence;
  - does not perform any DB or authorization mutation in V1.
- extract the current JWT provider-user plus DB authorization merge into a
  shared internal path in `AuthContextService` so JWT and cookie transport use
  the same role/scope/assigned-store resolution;
- add a dedicated browser-session resolver:
  - verify the signed app session envelope;
  - reject expired, malformed, unsigned, wrong-key, wrong-version, or
    unsupported-algorithm cookies;
  - derive provider key and provider subject from the signed envelope;
  - call the shared DB authorization merge path;
  - do not synthesize a fake `Authorization` header and do not feed the app
    session cookie into `JwtAuthProvider`.
- add cookie request auth:
  - read the app session cookie;
  - verify signature and expiry;
  - derive provider key and provider subject;
  - continue loading app user, role, scope, and assigned stores through the
    existing backend auth context;
  - prefer explicit bearer auth when both bearer and cookie are present during
    the migration window.
- add CSRF middleware for cookie-authenticated unsafe requests:
  - protect cookie-authenticated protected `POST`, `PUT`, `PATCH`, and
    `DELETE` domain routes;
  - skip `GET`, `HEAD`, and `OPTIONS`;
  - skip bearer-authenticated script calls while bearer support remains;
  - verify header, readable CSRF cookie, and signed session CSRF hash;
  - return 403 without session internals on failure.
- keep browser-session create and clear endpoint behavior explicit:
  - create requires a valid provider bearer token and does not require an
    existing CSRF token;
  - clear may clear cookies without trusting the session and returns no
    sensitive output;
  - any future server-side logout mutation is a separate CSRF-protected PR.
- ensure CORS preflight allows `X-CSRF-Token` only through the existing explicit
  origin allowlist and credentials contract.
- keep `/api/health`, `/api/health/live`, and `/api/auth/bootstrap` public.

Verification:

- backend unit tests for cookie flag construction;
- backend unit tests for app-session signing, previous-secret verification, and
  current-secret signing;
- backend auth tests for valid session, expired session, malformed session, and
  logout clear-cookie behavior;
- backend tests proving JWT bearer auth and cookie auth produce equivalent
  app user role/scope/action-scope results for the same mapped provider subject;
- backend CSRF tests for unsafe methods with missing, mismatched, and valid
  CSRF tokens;
- backend CSRF tests proving browser-session create and clear follow their
  endpoint-specific rules;
- backend tests proving bearer-authenticated smoke/script requests still work;
- `npm.cmd --prefix backend/nestjs run test -- --runInBand`;
- `npm.cmd --prefix backend/nestjs run build`;
- `npm.cmd run test:scripts`.

Merge criteria:

- no role/scope permission changes;
- no DB migration;
- bearer path remains compatible;
- cookies use `HttpOnly`, `Secure` in production, bounded TTL, and approved
  `SameSite`;
- CSRF guard is active only where cookie auth applies.
- no cookie-authenticated request can bypass the existing app DB role/scope and
  assigned-store authorization path.

Rollback:

- disable cookie sessions through env or revert this PR;
- bearer auth remains the rollback path.

### PR-3: Frontend Cookie Session Bridge

Purpose:

- remove browser-readable token persistence from real provider sessions and
  move browser API calls to cookie transport.

Expected files:

- `admin-web/src/features/session/session-storage.ts`;
- `admin-web/src/features/session/session-context.tsx`;
- `admin-web/src/features/session/session-context-value.ts`;
- `admin-web/src/features/auth/clerk-session.tsx`;
- `admin-web/src/pages/AuthCallbackPage.tsx`;
- `admin-web/src/pages/AuthLogoutPage.tsx`;
- `admin-web/src/lib/api.ts`;
- `admin-web/src/features/localization/messages/auth-flow.ts`;
- `admin-web/src/features/localization/messages/session-readiness.ts`;
- frontend auth/session tests and Playwright specs.

Implementation tasks:

- when `VITE_BROWSER_SESSION_TRANSPORT=cookie`, request Clerk/provider token
  only in memory;
- call `POST /api/auth/browser-session` with the token;
- never write bearer, id, access, refresh, or provider tokens to
  `localStorage` or `sessionStorage`;
- allow the existing transient PKCE `code_verifier` sessionStorage value only
  for the pre-auth authorization-code exchange. It must still be removed after
  exchange and must never appear in evidence;
- keep non-secret UI preferences out of scope and do not confuse them with
  token storage;
- configure browser-session create/clear and normal browser API calls with
  `credentials: "include"` in cookie transport;
- attach `X-CSRF-Token` from the readable CSRF cookie for unsafe methods;
- call `DELETE /api/auth/browser-session` on logout and clear any legacy token
  storage keys defensively;
- update Clerk refresh handling so token refresh creates a new backend app
  session instead of writing a token to sessionStorage;
- update PKCE callback handling so `access_token` is posted to the backend
  browser-session endpoint in cookie transport and `id_token` is not persisted;
- update logout behavior:
  - Clerk sessions use Clerk `signOut` plus backend cookie clear;
  - generic OIDC logout must not require storing an id token in browser storage;
  - provider logout without `id_token_hint` is acceptable in cookie transport
    unless the provider owner explicitly requires a different flow;
- update user-facing Auth Flow and Session Readiness copy so it no longer says
  real provider tokens are stored in sessionStorage;
- keep local/mock auth behavior available only under existing mock rules;
- keep bearer mode available for approved smoke scripts until closeout.

Verification:

- frontend unit tests for no token writes in cookie transport;
- frontend API client tests for `credentials: "include"`;
- unsafe-method tests for CSRF header attachment;
- Clerk bridge tests for cookie-session creation and renewal without
  sessionStorage token writes;
- PKCE callback tests for browser-session endpoint handoff without id-token
  persistence;
- logout tests proving legacy storage keys are cleared;
- localization/copy checks or targeted e2e assertions proving the visible auth
  explanation no longer claims sessionStorage token storage for launch mode;
- targeted Playwright auth/session smoke if available;
- `npm.cmd --prefix admin-web run build`;
- `npm.cmd run test:scripts`.

Merge criteria:

- real provider browser transport no longer persists raw tokens;
- existing route visibility and app authorization behavior are unchanged;
- logout clears backend cookies and legacy local/session storage keys;
- no raw token appears in test snapshots, logs, or evidence.

Rollback:

- switch `VITE_BROWSER_SESSION_TRANSPORT` back to `bearer` for controlled
  rollback while investigating;
- do not remove bearer backend support until PR-5 closeout.

### PR-4: Token Storage Regression Guard

Purpose:

- make browser-readable auth token persistence hard to reintroduce.

Expected files:

- `scripts/`;
- `package.json`;
- `docs/plans/staging-auth-session-edge-evidence-guard-v1.md`;
- `docs/plans/environment-variable-inventory.md`;
- possibly `admin-web/scripts/` if the existing auth evidence guard is extended.

Implementation tasks:

- add or extend a script guard that rejects launch browser code paths writing
  bearer, id, access, refresh, or provider token values to browser storage;
- keep narrowly allowed local/mock and pre-auth PKCE keys documented if any
  remain;
- extend sanitized evidence guard to reject raw cookies, JWT-like strings,
  authorization codes, PKCE verifiers, and storage dumps;
- update auth edge evidence language from "local bearer token storage is empty"
  to "no browser-readable token storage exists for provider sessions".

Verification:

- targeted new guard;
- `npm.cmd run test:scripts`;
- `git diff --check`.

Merge criteria:

- guard fails on obvious reintroduction of `sessionStorage` token writes in the
  provider browser path;
- guard does not block non-secret UI preferences;
- guard does not block the transient PKCE verifier storage path, but evidence
  guard rejects any captured verifier value;
- existing bearer-based smoke/e2e helpers remain allowed only in test/script
  files and only with redacted output;
- evidence guard still accepts sanitized auth/session facts.

Rollback:

- revert guard PR only if it produces a false positive that blocks urgent
  controlled-pilot repair, then immediately replace it with a narrower guard.

### PR-5: Staging Cookie Session Evidence

Purpose:

- prove the new browser session model with real protected staging input without
  storing raw secrets.

Expected files:

- `admin-web/scripts/auth-live-smoke.mjs` or a new cookie-session smoke script;
- `admin-web/scripts/auth-evidence-guard.mjs`;
- dated evidence under `docs/evidence/pilot-readiness/` or
  `docs/evidence/readiness/`;
- `docs/plans/clerk-persona-staging-evidence-runbook-v1.md` if the runbook
  needs a new cookie-session step.

Implementation tasks:

- add a smoke path that logs in through the real provider and confirms:
  - app session cookie exists with expected flags, with value redacted before
    output;
  - CSRF cookie exists and is not an auth credential, with value redacted before
    output;
  - `localStorage` and `sessionStorage` have no raw provider/bearer tokens;
  - an assigned-store protected action succeeds;
  - an unassigned-store action still returns 403;
  - unsafe request without CSRF returns 403;
  - logout clears app session and CSRF cookies;
  - evidence output is sanitized.
- keep legacy bearer-token staging smokes available for controlled script
  checks, but do not use them as proof that launch browser token storage is
  fixed.
- if no real staging credentials/session are available, record
  `blocked_external` instead of inventing proof.

Verification:

- smoke script local dry-run where possible;
- sanitized staging evidence guard;
- root `npm.cmd run test:scripts`;
- relevant backend/frontend release gates touched by the script.

Merge criteria:

- real staging evidence exists or the blocker is recorded explicitly;
- raw tokens/cookies/passwords/provider subjects are absent from evidence;
- cookie evidence records only name, domain/host scope, path, expiry class,
  `HttpOnly`, `Secure`, and `SameSite` facts;
- assigned/unassigned authorization behavior remains correct.

Rollback:

- do not roll back evidence unless it contains sensitive material; if sensitive
  material appears, rotate the exposed values and replace the evidence with a
  sanitized incident note.

### PR-6: Closeout And Launch Decision Update

Purpose:

- close the train only after the secure browser session path is implemented,
  guarded, and proven.

Expected files:

- `current-state.md`;
- `docs/plans/active-next-actions.md`;
- `docs/plans/project-control-board-v1.md`;
- `docs/plans/runbook-registry-v1.md`;
- dated closeout evidence under `docs/evidence/readiness/`.

Implementation tasks:

- record which PRs landed and which checks passed;
- record whether broad production remains `No-Go` for unrelated provider,
  Redis, recovery, or observability reasons;
- update the recommended next action;
- explicitly state whether bearer fallback remains temporarily supported or can
  be scheduled for removal in a separate train.

Verification:

- `git diff --check`;
- `npm.cmd run test:scripts`;
- GitHub/Vercel checks for the closeout PR.

Merge criteria:

- closeout does not claim more than the evidence proves;
- all previous train PRs are merged or explicitly parked with reason;
- no raw secrets in evidence.

Rollback:

- revert closeout docs if the decision is wrong; do not revert behavior PRs
  through the closeout PR.

## Verification Ladder

Minimum local gates by PR type:

| PR type | Required local gates |
| --- | --- |
| Docs-only | `git diff --check`, `npm.cmd run test:scripts` |
| Backend auth/session | targeted backend auth tests, backend build, `npm.cmd run test:scripts`, root `npm.cmd run check:release` before ready-to-merge unless blocked by documented external input |
| Frontend session/API | frontend build, targeted frontend tests, `npm.cmd run test:scripts`, root `npm.cmd run check:release` before ready-to-merge unless blocked by documented external input |
| Evidence script | targeted script test, evidence guard, `npm.cmd run test:scripts` |
| Closeout | `git diff --check`, `npm.cmd run test:scripts`, CI/Vercel green |

Additional remote gates before merge:

- GitHub checks green;
- Vercel preview checks green where frontend/deploy config is touched;
- Codex review has no major unresolved findings;
- PR body includes verification, rollback, and `Contract Impact`.

## Acceptance Criteria

The train is complete only when all of these are true:

- real provider browser sessions do not persist bearer, id, access, refresh, or
  provider tokens in browser-readable storage;
- app session cookie is `HttpOnly`, `Secure` in production, bounded by TTL, and
  uses the approved `SameSite` mode;
- app session cookie is host-only by default and has no `Domain` attribute
  unless a separate owner-approved cross-subdomain cookie decision exists;
- app session renewal requires an active provider browser session and never
  refreshes from the app cookie alone;
- unsafe cookie-authenticated requests require CSRF protection;
- backend DB role/scope/assigned-store authorization still decides access;
- CORS remains explicit allowlist only;
- `VITE_BEARER_TOKEN` remains empty for production-like browser deployments;
- `VITE_AUTH_MODE` and `VITE_BROWSER_SESSION_TRANSPORT` are separate contracts;
- launch-mode env examples are placeholder-only and documented;
- tests and guards fail if launch browser token storage is reintroduced;
- staging/provider evidence is real and sanitized, or explicitly recorded as
  `blocked_external`;
- broad production remains `No-Go` until unrelated Redis, recovery,
  observability, provider, and owner-acceptance items are closed or accepted.

## Rollback Strategy

The migration keeps bearer auth as a controlled rollback path until closeout.

Rollback order:

1. Disable cookie transport in frontend env by setting
   `VITE_BROWSER_SESSION_TRANSPORT=bearer`.
2. Keep backend bearer verification active.
3. Clear app session and CSRF cookies on logout or manual recovery.
4. Revert the smallest failing PR.
5. Record the rollback in the closeout or active next-actions document.

Do not roll back by:

- reintroducing browser-readable token persistence for launch mode;
- weakening backend role/scope guards;
- widening CORS;
- disabling rate limits;
- pasting secrets into evidence to debug.

## Next Action

Execute PR-0 first by merging this docs-only plan and control-link update.

After PR-0, start PR-1 only if the owner confirms this train is the next active
workstream. If real staging credentials or provider owner access are missing
later, continue through local contract and implementation PRs, then stop at
PR-5 with a `blocked_external` evidence note rather than inventing proof.
