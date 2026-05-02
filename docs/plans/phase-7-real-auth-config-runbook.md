# Phase 7 Real Auth Config Runbook

## Purpose
Turn the current real-auth scaffolding into one concrete configuration shape that can actually be wired in local and early staging environments.

This runbook is intentionally practical:
- exact route URLs
- exact env keys
- exact redirect expectations
- exact protocol shape that matches the current codebase

## Recommended Current Protocol Shape
Use an OIDC-compatible authorization code flow with PKCE.

Current chosen shape for this project state:
- authorization redirect from `/auth/login`
- callback handled by `/auth/callback`
- frontend receives `code` and `state`
- frontend exchanges the code at the provider token endpoint with the saved PKCE verifier
- frontend stores the returned bearer token transiently
- frontend clears locally stored bearer/id tokens when the bearer JWT `exp` is already expired
- frontend verifies it through `GET /api/auth/session`

## Why This Shape Is The Current Recommendation
At the current implementation state:
- backend already verifies JWT bearer tokens
- frontend login generates `code_verifier`, `code_challenge`, and random `state`
- frontend callback exchanges authorization codes with PKCE
- frontend can route into `/admin` or `/store` only after session verification

This means the production-shaped path is:
- use a provider that supports SPA/public-client authorization code + PKCE
- keep the backend as bearer-token verifier
- keep `/api/auth/session` as the canonical role/scope gate

## Important Scope Note
This is the recommended shape for the **current codebase** and local/early-staging validation.

Later hardening can still add:
- backend-assisted token exchange
- backend-mediated refresh if long-lived sessions become a product requirement
- provider-specific logout coordination

But that should come after the team has one working PKCE real-auth path end to end.

## Provider Readiness Gate
Before moving from local Keycloak validation to a real staging or production IdP, complete:

- `docs/plans/phase-7-provider-readiness-checklist.md`

That checklist is the go/no-go contract for provider registration, environment values, access-token claim mappers, staging smoke tests, and evidence capture. P0 failures in that checklist should block staging sign-off.

Token renewal policy is captured in:

- `docs/plans/phase-7-token-renewal-decision.md`

For first real IdP smoke, do not request or store browser refresh tokens. Expired access tokens should clear locally and re-authenticate through `/auth/login`. If the product later needs longer lived sessions, use backend-mediated refresh rather than hidden iframe silent re-auth as the primary strategy.

## Local Development URLs

### Frontend
- app origin: `http://localhost:5173`
- login route: `http://localhost:5173/auth/login`
- callback route: `http://localhost:5173/auth/callback`
- logout landing: `http://localhost:5173/auth/login`

### Backend
- API origin: `http://localhost:3000`
- API base used by frontend: `http://localhost:3000/api`
- bootstrap metadata endpoint: `http://localhost:3000/api/auth/bootstrap`
- session verification endpoint: `http://localhost:3000/api/auth/session`

## Redirect Contract

### Login start
Frontend opens the provider authorization URL with:
- `client_id`
- `redirect_uri=http://localhost:5173/auth/callback`
- `response_type=code`
- `scope=openid profile email`
- `code_challenge`
- `code_challenge_method=S256`
- optional `audience`
- random `state`

### Callback success
Provider redirects back to:
- `http://localhost:5173/auth/callback?code=...&state=...`

The frontend validates the returned `state`, reads the stored `code_verifier`, posts to the provider token endpoint, then stores the returned `access_token` in `sessionStorage`.

If the bearer token is a JWT with an expired `exp` claim, the frontend clears the bearer token and provider `id_token` from `sessionStorage` before sending API requests. This is a client-side hygiene guard only; backend JWT verification remains authoritative.

Legacy `access_token` or `token` callback parsing still exists for local/manual dev fallback URLs. Production frontend builds reject those URLs, avoid storing the token, and clean the token from the address bar. The real provider flow should be Authorization Code + PKCE.

### Logout
Frontend reads the provider `id_token` before clearing local bearer session state.

If provider logout is configured, frontend redirects to:
- provider logout URL

with:
- `id_token_hint`
- `client_id`
- `post_logout_redirect_uri=http://localhost:5173/auth/login`

## Required JWT Claims

### Must validate
- `iss`
- `aud`
  - production tokens must contain this claim directly
- valid signature
- valid lifetime

### Required identity
- `sub`
  - production tokens must contain this claim directly

### Authorization claims
- `employee_id`
- `roles`
- `read_company_ids`
- `read_region_ids`
- `read_store_ids`
- `assigned_store_ids`

Backend remains authoritative because DB role assignments override token role/read-scope data when present. The JWT provider does not infer role or scope from local demo usernames.

## Backend Env Template
These envs are the concrete current contract for backend-driven auth bootstrap metadata:

```env
AUTH_MODE=jwt
JWT_ISSUER=https://your-idp.example.com/
JWT_AUDIENCE=store-ops-api
JWT_SECRET=
JWT_JWKS_URL=https://your-idp.example.com/.well-known/jwks.json

AUTH_AUTHORIZATION_URL=https://your-idp.example.com/authorize
AUTH_CLIENT_ID=store-ops-admin-web
AUTH_SCOPE=openid profile email
AUTH_RESPONSE_TYPE=code
AUTH_TOKEN_URL=https://your-idp.example.com/token
AUTH_AUDIENCE_OVERRIDE=store-ops-api
AUTH_CALLBACK_PATH=/auth/callback
AUTH_LOGOUT_URL=https://your-idp.example.com/logout
AUTH_POST_LOGOUT_REDIRECT_PATH=/auth/login
```

Notes:
- prefer `JWT_JWKS_URL` for real providers
- leave `JWT_SECRET` empty when JWKS is used
- `AUTH_AUDIENCE_OVERRIDE` is what frontend sends to the provider
- `JWT_AUDIENCE` is what backend verifies in the resulting token
- `AUTH_TOKEN_URL` is required for `response_type=code`

## Frontend Env Template
Frontend can now read provider bootstrap metadata from backend, so frontend env can stay minimal:

```env
VITE_API_BASE_URL=http://localhost:3000/api
VITE_AUTH_MODE=bearer
```

Optional fallback-only frontend envs still exist, but backend bootstrap should now be preferred over duplicating provider config in the SPA.

## Expected Provider Registration
When registering the app in the IdP, use:

- application type: SPA or browser-based app
- allowed callback URL:
  - `http://localhost:5173/auth/callback`
- allowed logout / post-logout URL:
  - `http://localhost:5173/auth/login`
- allowed web origin:
  - `http://localhost:5173`

If the provider uses different field names, map them to the same underlying values.

## Early Staging Variant
For early staging, keep the same shape and replace origins only:

- frontend origin:
  - `https://admin.your-stage.example.com`
- callback:
  - `https://admin.your-stage.example.com/auth/callback`
- logout landing:
  - `https://admin.your-stage.example.com/auth/login`
- API base:
  - `https://api.your-stage.example.com/api`

## Sanity Checklist
Before trying login, confirm:

1. backend runs with `AUTH_MODE=jwt`
2. `/api/auth/bootstrap` returns provider config with `responseType=code` and `tokenUrl`
3. frontend uses `VITE_API_BASE_URL` that points to backend
4. IdP callback URL exactly matches `/auth/callback`
5. JWT issuer and audience in backend match real token contents
6. provider returns direct `sub` and `aud` claims in production tokens
7. provider returns a bearer access token the backend can verify
8. `docs/plans/phase-7-provider-readiness-checklist.md` has no unchecked P0 item for the target environment

## What Is Still Not Final
- provider-specific logout quirks
- backend-assisted token exchange

Expired access tokens are currently cleared locally and then re-auth is expected through `/auth/login`. Browser-stored refresh tokens and hidden iframe silent re-auth are not part of the first real IdP smoke. Backend-mediated refresh is deferred until long-session requirements are proven.

## Keep Vs Clean Up

### Keep
These are the parts that should remain as the durable direction:
- backend-driven auth bootstrap through `GET /api/auth/bootstrap`
- frontend login/callback/logout route contract:
  - `/auth/login`
  - `/auth/callback`
  - `/auth/logout`
- backend JWT verification through JWKS
- store/admin shell split with role-aware landing
- bearer token persistence in `sessionStorage`
- expired JWT bearer cleanup before API authorization headers are built
- provider `id_token` persistence only for logout `id_token_hint`
- Keycloak client-side realm-role mapper that emits `roles`
- Keycloak local realm/client/user bootstrap as a reusable local auth path

### Clean Up Before Production
These are local/demo tolerances added to get Keycloak validation working end to end:
- tolerance for manual/local `access_token` callback URLs in frontend dev builds only

Backend production JWT validation now rejects missing `aud` and missing direct `sub`; remaining tolerance is non-production only.

### Production Hardening Follow-Up
Before switching from local Keycloak demo flow to a real production IdP, remove or replace the temporary tolerances above and require:
1. stable `sub` claim directly in the access token
2. explicit audience claim policy agreed with the provider and emitted as `aud`
3. provider-managed role and scope claims
4. logout flow that includes provider-required parameters such as `id_token_hint` when needed
5. token renewal policy from `docs/plans/phase-7-token-renewal-decision.md`

Use the provider readiness checklist as the handoff document for items 1 through 4. Item 5 is currently decided as re-login on expiry for first smoke, with backend-mediated refresh deferred until long-session requirements are proven.
