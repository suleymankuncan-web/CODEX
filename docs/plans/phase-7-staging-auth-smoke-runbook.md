# Phase 7 Staging Auth Smoke Runbook

## Purpose

This runbook defines the exact command path for collecting real staging IdP evidence without storing raw tokens, authorization codes, PKCE verifiers, refresh tokens, client secrets, cookies, or session storage dumps.

The local Keycloak smoke is already proven. This runbook is only for a real staging identity provider and a seeded staging database.

## Commands

Run provider login/logout evidence only:

```powershell
cd "C:\Users\suley\OneDrive\Masaüstü\WEBSİTE ÇALIŞMASI\admin-web"
npm.cmd run smoke:auth:staging
```

Run provider evidence plus positive/negative seeded action evidence:

```powershell
cd "C:\Users\suley\OneDrive\Masaüstü\WEBSİTE ÇALIŞMASI\admin-web"
npm.cmd run smoke:auth:staging:action
```

The script writes sanitized JSON evidence to stdout. Paste only the sanitized output into a dated evidence note copied from:

- `docs/plans/phase-7-auth-evidence-template.md`

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
