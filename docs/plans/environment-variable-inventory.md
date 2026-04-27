# Environment Variable Inventory

## Metadata

- Status: V1 deployment inventory.
- Owner: Platform, backend, frontend, and release operator.
- Last updated: 2026-04-27.
- Purpose: Keep environment variables visible before staging, pilot, or production deployment.

## Decision Rule

No target environment should be approved until every P0 variable in this document is either filled, intentionally unused, or covered by a written Conditional Go note.

Do not store real values in this document. Store only names, owners, purpose, required status, and source of truth.

## Backend Runtime Variables

These values are read by `backend/nestjs/src/shared/app-config.service.ts`.

| Variable | P0/P1 | Production rule | Notes |
| --- | --- | --- | --- |
| `APP_PORT` | P1 | Set by hosting platform or explicit runtime env. | Defaults to `3000`. |
| `APP_NAME` | P1 | Stable service name. | Defaults to `store-ops-backend`. |
| `NODE_ENV` | P0 | Must be `production` in production. | Controls production auth fail-closed behavior. |
| `DATABASE_URL` | P0 | Must point to target DB, never local development. | Secret-bearing connection string. |
| `DB_POOL_MAX` | P1 | Size for hosting tier. | Defaults to `20`. |
| `DB_SSL_MODE` | P0 | Use provider-required SSL mode. | Local default is `disable`; production should be reviewed. |
| `AUTH_MODE` | P0 | Must be `jwt` for real environments. | Local may use `mock`. |
| `ALLOW_MOCK_AUTH` | P0 | Must be `false` or unset in production. | Production must not allow mock auth. |
| `JWT_AUDIENCE` | P0 | Must match accepted access token audience. | Defaults to `store-ops-api`. |
| `JWT_ISSUER` | P0 | Must exactly match provider issuer. | Production rejects issuer mismatch. |
| `JWT_JWKS_URL` | P0 | Required for real IdP JWT verification. | Preferred over shared secret verification. |
| `JWT_SECRET` | P0 conditional | Empty with JWKS; non-default only for approved non-JWKS mode. | Must never be `change-me` in production without JWKS. |
| `AUTH_AUTHORIZATION_URL` | P0 | Real provider authorize URL. | Used by `/api/auth/bootstrap`. |
| `AUTH_CLIENT_ID` | P0 | Real public browser client id. | No client secret in frontend. |
| `AUTH_SCOPE` | P0 | Includes `openid profile email`. | Add provider-specific role scope only if required. |
| `AUTH_RESPONSE_TYPE` | P0 | Must be `code`. | PKCE login expects authorization code. |
| `AUTH_TOKEN_URL` | P0 | Real provider token URL. | Required for PKCE code exchange. |
| `AUTH_AUDIENCE_OVERRIDE` | P1 conditional | Set only if provider requires `audience` auth param. | Leave empty otherwise. |
| `AUTH_CALLBACK_PATH` | P0 | `/auth/callback` unless route changes. | Must match provider callback registration. |
| `AUTH_LOGOUT_URL` | P1 | Provider logout endpoint when supported. | Needed for provider logout smoke. |
| `AUTH_POST_LOGOUT_REDIRECT_PATH` | P0 | `/auth/login` unless route changes. | Must match provider post-logout registration. |
| `QUEUE_BACKEND` | P0 | `bullmq` when durable worker queue is required. | Local default is `in-memory`. |
| `REDIS_URL` | P0 conditional | Required when `QUEUE_BACKEND=bullmq`. | Secret-bearing if provider uses credentials. |
| `QUEUE_IMPORT_NAME` | P1 | Stable import queue name. | Defaults to `store-ops-import`. |
| `QUEUE_SNAPSHOT_NAME` | P1 | Stable snapshot queue name. | Defaults to `store-ops-snapshot`. |
| `DAILY_CLOSURE_AUTOMATION_ENABLED` | P1 | Keep `false` until closure schedule is approved. | Enables automated closure polling. |
| `DAILY_CLOSURE_POLL_MINUTES` | P1 | Approved polling interval. | Defaults to `15`. |
| `DAILY_CLOSURE_ACTOR_USER_ID` | P0 conditional | Required if daily closure automation is enabled. | Must be a real service/operator actor id. |

## Frontend Build-Time Variables

These values are read by `admin-web/src`.

| Variable | P0/P1 | Production rule | Notes |
| --- | --- | --- | --- |
| `VITE_API_BASE_URL` | P0 | Points to production backend `/api`. | Public value, not secret. |
| `VITE_AUTH_MODE` | P0 | Must be `bearer` for real environments. | Local can use `mock`. |
| `VITE_USER_ID` | P1 local-only | Do not use for production auth. | Mock-session helper only. |
| `VITE_ROLE_CODES` | P1 local-only | Do not use for production auth. | Mock-session helper only. |
| `VITE_COMPANY_IDS` | P1 local-only | Do not use for production auth. | Mock-session helper only. |
| `VITE_BEARER_TOKEN` | P0 local-only | Must be empty in committed examples and production. | Never put real tokens in env files. |
| `VITE_OIDC_AUTHORIZATION_URL` | P0 fallback | Real provider authorize URL if bootstrap is unavailable. | Backend bootstrap is preferred. |
| `VITE_OIDC_CLIENT_ID` | P0 fallback | Real public client id if bootstrap is unavailable. | Public, not secret. |
| `VITE_OIDC_SCOPE` | P0 fallback | Includes `openid profile email`. | Match backend/provider registration. |
| `VITE_OIDC_RESPONSE_TYPE` | P0 fallback | Must be `code` for PKCE. | Do not use `token` in production examples. |
| `VITE_OIDC_AUDIENCE` | P1 conditional | Set only if provider requires audience. | Public request parameter. |
| `VITE_OIDC_CALLBACK_PATH` | P0 fallback | `/auth/callback`. | Must match provider registration. |
| `VITE_OIDC_TOKEN_URL` | P0 fallback | Real provider token URL if bootstrap is unavailable. | Needed for PKCE exchange. |
| `VITE_OIDC_LOGOUT_URL` | P1 fallback | Real provider logout URL if bootstrap is unavailable. | Used for provider logout. |
| `VITE_POST_LOGOUT_REDIRECT_PATH` | P0 fallback | `/auth/login`. | Must match provider registration. |

Production preference:

- The backend `/api/auth/bootstrap` response should supply provider values.
- Frontend `VITE_OIDC_*` values remain a fallback and local configuration aid.
- No frontend variable may contain a client secret, raw token, refresh token, PKCE verifier, or private key.

## Auth Smoke Evidence Variables

These values are read by `admin-web/scripts/auth-live-smoke.mjs`.

| Variable | P0/P1 | Staging rule | Notes |
| --- | --- | --- | --- |
| `AUTH_SMOKE_BASE_URL` | P0 | Non-local HTTPS frontend URL. | Required in staging mode. |
| `AUTH_SMOKE_API_BASE_URL` | P0 | Non-local HTTPS backend `/api` URL. | Required in staging mode. |
| `AUTH_SMOKE_USERNAME` | P0 | Real staging smoke user. | Do not commit real username if sensitive. |
| `AUTH_SMOKE_PASSWORD` | P0 | Secret. | Never commit or paste into evidence. |
| `AUTH_SMOKE_EXPECTED_ROLE` | P0 | Expected app role code. | Example: `STORE_MANAGER`. |
| `AUTH_SMOKE_EXPECTED_LANDING` | P1 | Expected post-login route. | Defaults to `/store`. |
| `AUTH_SMOKE_ENVIRONMENT` | P0 | Target evidence name. | Example: `staging`. |
| `AUTH_SMOKE_PROVIDER_NAME` | P0 | Human-readable provider name. | Evidence metadata. |
| `AUTH_SMOKE_PROVIDER_ISSUER` | P0 | Non-local HTTPS issuer. | Must match `JWT_ISSUER`. |
| `AUTH_SMOKE_JWKS_URL` | P0 | Non-local HTTPS JWKS URL. | Must match backend verification. |
| `AUTH_SMOKE_ACCEPTED_AUDIENCE` | P0 | Expected token audience. | Must satisfy `JWT_AUDIENCE`. |
| `AUTH_SMOKE_ASSIGNED_STORE_ID` | P0 action smoke | Store id where action should succeed. | Required for staging action smoke. |
| `AUTH_SMOKE_UNASSIGNED_STORE_ID` | P0 action smoke | Store id where action should return `403`. | Required for negative action smoke. |
| `AUTH_SMOKE_ACTION_REQUEST_MONTH` | P0 action smoke | Request month for target-distribution action. | Format `YYYY-MM-01`. |

## Secret Handling Rules

- Do not commit `.env` files.
- Do not paste raw bearer tokens.
- Do not paste raw id tokens.
- Do not paste refresh tokens.
- Do not paste authorization codes.
- Do not paste PKCE `code_verifier` values.
- Do not paste client secrets.
- Do not store production credentials in screenshots.
- Keep committed `.env.example` files placeholder-only.
- Store real secrets in the hosting environment or secret manager.
- Rotate any value that appears in chat, issue comments, screenshots, or logs.

## Production Fill-In Checklist

### Backend

- [ ] `NODE_ENV=production`
- [ ] `AUTH_MODE=jwt`
- [ ] `ALLOW_MOCK_AUTH=false` or unset with production fail-closed behavior verified.
- [ ] `DATABASE_URL` points to production DB.
- [ ] `JWT_ISSUER`, `JWT_AUDIENCE`, and `JWT_JWKS_URL` match real provider.
- [ ] `JWT_SECRET` is empty when JWKS is used, or explicitly approved for non-JWKS mode.
- [ ] Provider authorize/token/logout URLs are filled.
- [ ] Queue backend and Redis are filled if durable workers are enabled.
- [ ] Daily closure automation remains disabled until approved.

### Frontend

- [ ] `VITE_API_BASE_URL` points to production API.
- [ ] `VITE_AUTH_MODE=bearer`.
- [ ] `VITE_OIDC_RESPONSE_TYPE=code` if frontend fallback provider env is used.
- [ ] `VITE_BEARER_TOKEN` is empty.
- [ ] No `VITE_*` value contains a secret.

### Smoke

- [ ] Staging smoke variables are supplied through local shell or CI secret store.
- [ ] `AUTH_SMOKE_PASSWORD` is not written to docs.
- [ ] Assigned and unassigned store ids are seeded and approved.
- [ ] Evidence is piped through `npm.cmd run guard:auth:evidence`.

## CODEX Dürüst Yorum

This inventory is useful because it turns "we will configure it later" into a checklist with owners and risk level. The project already has strong release gates; the remaining production risk is mostly environment drift, secret handling, and real provider/source values. This document reduces that drift without pretending the real values are known today.

## Next Logical Step

Use `docs/plans/deployment-runbook-skeleton.md` as the operator flow for the first staging or pilot deploy rehearsal.
