# Browser Session Staging Evidence Blocked

Status: blocked_external
Shelf: readiness/security
Date: 2026-06-12

## Scope

This note records Security Launch Blocker PR Train V1 PR-5. The secure
browser-session implementation and local guards are in place, but real staging
cookie-session evidence is not claimed from this workspace.

## Decision

Evidence status: `blocked_external`.

Reason: this workspace did not initially contain an approved real staging
provider session, staging smoke credential, controlled browser session, or
seeded assigned/unassigned store input for a cookie-session evidence run. A
later controlled staging login attempt provided a real Region Manager persona,
but the deployed staging frontend/backend still did not satisfy the
cookie-session evidence contract. The train must not invent proof, paste
credentials, record raw cookies, mutate staging data, or change Clerk, Render,
Vercel, Supabase, or provider configuration to manufacture evidence.

This is not a broad production Go. Broad production remains `No-Go`.

## Already Proven Locally And In CI

- PR-1 recorded and guarded the browser-session env contract.
- PR-2 added backend-owned browser app-session cookie support, bounded TTL,
  host-only cookie behavior, key rotation support, and CSRF handling for
  cookie-authenticated unsafe protected routes.
- PR-3 moved real browser sessions to the cookie transport path and removed
  launch browser token persistence from provider sessions.
- PR-4 added token-storage regression coverage and hardened auth evidence
  guards against raw cookies, codes, verifiers, token-shaped values, and
  browser storage dumps.

These local and CI results are implementation and guard evidence only. They do
not prove real staging provider behavior.

## 2026-06-12 Controlled Staging Attempt

A real staging login was attempted against:

- Frontend: `https://staging.hr-axis.com`
- Backend API: `https://api-staging.hr-axis.com/api`
- Persona class: Region Manager
- Expected app role: `REGION_MANAGER`
- Expected landing route: `/admin/competitions`

The credential and one-time code were handled only through the local shell and
were not recorded in repository files or evidence output.

Sanitized observed results:

- `GET https://api-staging.hr-axis.com/api/health` returned `200`.
- `GET https://api-staging.hr-axis.com/api/auth/bootstrap` returned
  `authMode=jwt`, but `provider.configured=false`; provider token and logout
  URLs were not configured in the backend bootstrap response.
- Browser login reached `/admin/competitions`.
- Direct API `GET /auth/session` with only browser credentials returned `403`,
  so the backend did not accept the browser session as an app cookie session.
- Browser storage contained `sessionStorage` key
  `store-ops-admin-bearer-token`.
- No `hr_axis_browser_session` app cookie was observed.
- Observed cookies were Clerk/browser-provider cookies, not backend-owned
  HttpOnly app-session cookies.

Result: the controlled staging attempt does not unblock this evidence. It
confirms the live staging deployment is still on a browser-readable bearer
storage path for this persona/build and lacks accepted backend browser-session
cookie proof. The remaining blocker is approved real staging provider evidence
on a deployed cookie-session configuration.

## Required External Inputs To Unblock

- Approved staging frontend origin and backend API target for the smoke run.
- Approved Clerk/provider login method or controlled browser session for the
  staging persona.
- Expected app role and landing route for that persona.
- Seeded assigned store id where the protected action should succeed.
- Seeded unassigned store id where the protected action should return `403`.
- Approved request month for the Store Action negative and positive checks.
- Confirmation that the staging backend has cookie sessions enabled with a
  non-default signing secret, HTTPS/Secure cookie behavior, explicit CORS
  allowlist, host-only app-session cookie scope, no cookie `Domain` attribute,
  and app-session TTL at or below one hour.
- Confirmation that the staging frontend uses
  `VITE_BROWSER_SESSION_TRANSPORT=cookie` for the evidence run.
- Confirmation that `GET /api/auth/bootstrap` reports the provider as
  configured for the deployed backend used by the frontend evidence run.

## Required Evidence Once Inputs Exist

The live staging evidence must be generated through a sanitized smoke path and
then pass the auth evidence guard before being recorded.

The accepted evidence must show only sanitized facts:

- app-session cookie exists with value redacted;
- cookie attributes record only name, host scope, path, expiry class,
  `HttpOnly`, `Secure`, and `SameSite`;
- no cookie `Domain` attribute is present;
- CSRF nonce transport is proven without recording the nonce value;
- `localStorage` and `sessionStorage` contain no bearer, id, access, refresh,
  provider, or app-session token values;
- assigned-store protected action succeeds;
- unassigned-store protected action returns `403`;
- unsafe cookie-authenticated request without CSRF returns `403`;
- logout clears app-session and CSRF cookie state;
- evidence contains no raw bearer token, id token, access token, refresh token,
  provider token, authorization code, PKCE verifier, raw cookie value, password,
  provider subject, private key, database URL, Redis URL, or provider secret.

Legacy bearer staging smoke may remain available for controlled script checks,
but it is not evidence that launch browser token storage is fixed.

## Current Launch Decision

The MVP/launch browser-session blocker is locally implemented and guarded, but
real protected staging cookie-session evidence remains externally blocked until
the inputs above are available and the sanitized smoke passes.

Do not claim broad production readiness from this note.
