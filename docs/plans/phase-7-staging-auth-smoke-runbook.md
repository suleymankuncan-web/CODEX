# Phase 7 Staging Auth Smoke Runbook

## Purpose

This runbook defines the operational checklist for collecting real staging IdP evidence without storing raw tokens, authorization codes, PKCE verifiers, refresh tokens, client secrets, cookies, or browser storage dumps.

The local Keycloak smoke is already proven. This runbook is only for a real staging identity provider and a seeded staging database.

## Roles And Responsibilities

Prepared by:
- Confirms the staging provider registration values.
- Confirms seeded staging store coverage exists.
- Prepares the dated evidence note from `docs/plans/phase-7-auth-evidence-template.md`.

Executed by:
- Sets the required environment variables locally or in the controlled runner.
- Runs the staging smoke command.
- Copies only sanitized JSON output into the evidence note.

Reviewed by:
- Checks the evidence note for missing P0 items.
- Confirms no raw token, cookie, secret, authorization code, or PKCE verifier was pasted.
- Confirms the positive and negative action results match the expected assigned-store policy.

Approved by:
- Makes the final Go, Conditional Go, or No-Go decision.
- Records known P1 limitations when Conditional Go is used.
- Blocks sign-off when a P0 item fails.

## Security Evidence Rules

- Do not paste raw bearer tokens.
- Do not paste raw id tokens.
- Do not paste refresh tokens.
- Do not paste authorization codes.
- Do not paste PKCE `code_verifier` values.
- Do not paste client secrets, private keys, cookies, or browser storage dumps.
- Do not attach screenshots that expose tokens, cookies, secrets, or personal data beyond the smoke user identity.
- Store only sanitized decoded payloads and sanitized HTTP response shapes.

If raw secret material is accidentally captured, delete the evidence file, rotate the exposed secret or session where applicable, and recreate the evidence with sanitized values.

## Commands

Run provider login/logout evidence only:

```powershell
cd "<workspace-root>\admin-web"
npm.cmd run smoke:auth:staging
```

Run provider evidence plus positive/negative seeded action evidence:

```powershell
cd "<workspace-root>\admin-web"
npm.cmd run smoke:auth:staging:action
```

Run the evidence guard before storing the final evidence:

```powershell
cd "<workspace-root>\admin-web"
npm.cmd run --silent smoke:auth:staging:action | npm.cmd run --silent guard:auth:evidence -- --stdin
```

The smoke script writes sanitized JSON evidence to stdout. The guard checks that the JSON evidence shape is complete, contains no raw token/code/verifier/secret/cookie material, and proves assigned-store success plus unassigned-store `403` for action smoke. Paste only guarded sanitized output into a dated evidence note copied from:

- `docs/plans/phase-7-auth-evidence-template.md`

## Session Edge Review

Logout evidence must prove:

- provider logout request includes `id_token_hint`,
- browser returns to `/auth/login`,
- no browser-readable token storage exists for provider sessions,
- local provider id token storage is cleared.

Expired Token evidence must prove:

- expired bearer JWT is cleared,
- provider id token is cleared with the expired bearer session,
- API requests do not include `Authorization: Bearer <expired-jwt>`,
- browser returns to `/auth/login` or the approved session-recovery route,
- no browser refresh token is requested or used.

No refresh token should be requested, stored, logged, or attached in this first real staging IdP smoke.

## Required Environment

Set these values before running either staging command:

```powershell
$env:AUTH_SMOKE_BASE_URL="https://admin.stage.example.com"
$env:AUTH_SMOKE_API_BASE_URL="https://api.stage.example.com/api"
$env:AUTH_SMOKE_USERNAME="stage.store.manager@example.com"
$env:AUTH_SMOKE_PASSWORD="<staging-password>"
$env:AUTH_SMOKE_EXPECTED_ROLE="STORE_MANAGER"
$env:AUTH_SMOKE_EXPECTED_LANDING="/store"
$env:AUTH_SMOKE_ENVIRONMENT="staging"
$env:AUTH_SMOKE_PROVIDER_NAME="Corporate Staging IdP"
$env:AUTH_SMOKE_PROVIDER_ISSUER="https://idp.stage.example.com/realms/store-ops"
$env:AUTH_SMOKE_JWKS_URL="https://idp.stage.example.com/realms/store-ops/protocol/openid-connect/certs"
$env:AUTH_SMOKE_ACCEPTED_AUDIENCE="store-ops-api"
```

For `smoke:auth:staging:action`, also set:

```powershell
$env:AUTH_SMOKE_ASSIGNED_STORE_ID="<seeded-assigned-store-uuid>"
$env:AUTH_SMOKE_UNASSIGNED_STORE_ID="<seeded-unassigned-store-uuid>"
$env:AUTH_SMOKE_ACTION_REQUEST_MONTH="2026-04-01"
```

## Guardrails

The staging script fails before any network request if:

- `AUTH_SMOKE_BASE_URL` or `AUTH_SMOKE_API_BASE_URL` is missing, local, or non-HTTPS.
- local demo credentials such as `store.manager / StoreOps123!` are used.
- staging evidence metadata such as issuer, JWKS URL, provider name, or accepted audience is missing.
- action smoke is requested without explicit assigned and unassigned seeded store IDs.

## Operator Checklist

### 1. Environment Preparation

- [ ] Staging frontend URL is known.
- [ ] Staging API URL is known.
- [ ] Staging provider issuer is known.
- [ ] Staging JWKS URL is known.
- [ ] Staging client id is confirmed in provider registration.
- [ ] Staging accepted audience is confirmed against backend `JWT_AUDIENCE`.
- [ ] Smoke user username and password are available through the approved secret channel.
- [ ] Smoke user role is known.
- [ ] Seeded assigned store ID exists in staging.
- [ ] Seeded unassigned store ID exists in staging.
- [ ] Evidence note file is created from `docs/plans/phase-7-auth-evidence-template.md`.

### 2. Preflight Review

- [ ] Provider registration uses authorization code flow.
- [ ] PKCE `S256` is required or enforced.
- [ ] Implicit flow is disabled.
- [ ] Callback URL matches staging `/auth/callback`.
- [ ] Post-logout URL matches staging `/auth/login`.
- [ ] No frontend client secret exists.
- [ ] Backend is running with `AUTH_MODE=jwt`.
- [ ] Backend JWKS verification points at the staging provider.
- [ ] Backend `JWT_SECRET` is not used for the staging JWKS path.
- [ ] `AUTH_SCOPE` does not request refresh-token scopes such as `offline_access`.

### 3. Smoke Execution

- [ ] Export all required environment variables.
- [ ] Run `npm.cmd run smoke:auth:staging:action`.
- [ ] Run `npm.cmd run --silent smoke:auth:staging:action | npm.cmd run --silent guard:auth:evidence -- --stdin`.
- [ ] Confirm the command did not use local fallback URLs or local demo credentials.
- [ ] Confirm provider redirect uses `response_type=code`.
- [ ] Confirm provider redirect uses `code_challenge_method=S256`.
- [ ] Confirm `/api/auth/session` returns the expected role.
- [ ] Confirm `/api/auth/session` returns read scope.
- [ ] Confirm `/api/auth/session` returns `actionScope.assignedStoreIds`.
- [ ] Confirm assigned-store action succeeds.
- [ ] Confirm unassigned-store action returns `403`.
- [ ] Confirm logout clears local browser token storage.
- [ ] Confirm expired bearer token is cleared before an API `Authorization` header is sent.

### 4. Evidence Review

- [ ] Evidence contains environment name, frontend origin, backend API base, provider issuer, client id, JWKS URL, and accepted audience.
- [ ] Evidence contains sanitized bootstrap response.
- [ ] Evidence contains sanitized decoded access token payload.
- [ ] Evidence contains sanitized `/api/auth/session` response.
- [ ] Evidence contains positive action result.
- [ ] Evidence contains negative `403` action result.
- [ ] Evidence contains logout result.
- [ ] Evidence contains expired-token result.
- [ ] Evidence guard passes before the note is approved.
- [ ] Evidence contains no raw bearer token, id token, refresh token, code, verifier, cookie, client secret, private key, or browser storage dump.

### 5. Approval Decision

- [ ] Go: all P0 items pass and no secret material is present.
- [ ] Conditional Go: all P0 security and auth/action checks pass, but a documented P1 limitation remains.
- [ ] No-Go: any P0 item fails, any secret material is captured, positive action fails, or negative action does not return `403`.

## Expected Evidence

Provider smoke must prove:

- `GET /api/auth/bootstrap` returns `authMode=jwt` and configured provider metadata.
- login redirect uses authorization code flow and PKCE `S256`.
- token payload has direct `sub`, direct `aud`, expected app role, read scope, and action scope.
- `GET /api/auth/session` returns app-facing role/scope/action-scope data.
- logout reaches provider logout and clears local browser storage.
- expired bearer token is cleared before it can be sent as an API `Authorization` header.

Action smoke must additionally prove:

- assigned store target distribution create returns success and submitted command status.
- unassigned store target distribution create returns `403`.
- rejected action is documented as no DB write expected.

## No-Go

Do not claim staging sign-off if any of these are true:

- real staging IdP registration values are not available
- staging backend is not running with JWKS verification
- staging DB is not seeded with assigned and unassigned store coverage
- any raw token, authorization code, verifier, cookie, secret, or session dump is captured in evidence
- positive action does not succeed
- negative action does not return `403`
