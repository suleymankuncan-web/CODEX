# Phase 7 Provider Readiness Checklist

## Metadata
- Status: Draft until a real staging or production IdP is selected. Local Keycloak smoke evidence exists.
- Owner: Backend/frontend auth integration.
- Last updated: 2026-04-26.
- Purpose: Define the provider-side go/no-go contract before staging PKCE login smoke tests start.

## Decision Rule
Do not start staging smoke validation until every P0 item in this document is checked.

This checklist is not a suggestion list. It is the acceptance gate for replacing the local Keycloak demo path with a real staging or production identity provider.

Token renewal policy is defined in `docs/plans/phase-7-token-renewal-decision.md`: first real IdP smoke uses re-login on access-token expiry, does not store browser refresh tokens, and defers backend-mediated refresh until long-session requirements are proven.

## Context
The application now uses browser authorization code + PKCE for login and backend JWT/JWKS verification for API authorization.

The backend is deliberately fail-closed in production for identity essentials:
- production access tokens must contain direct `sub`
- production access tokens must contain direct `aud`
- invalid signature, issuer, audience, or lifetime returns `401`
- production DB authorization lookup failure returns `503`

The frontend keeps bearer tokens in `sessionStorage`, stores provider `id_token` only for logout, clears expired bearer JWTs before API headers are built, and uses `GET /api/auth/session` as the canonical role/scope gate.

Backend web DTOs validate database UUID inputs with the shared PostgreSQL UUID validator instead of `class-validator`'s versioned `IsUUID` decorator. This keeps deterministic seeded IDs and production PostgreSQL UUID values under one validation contract.

## Provider Registration Checklist

### P0 Required
- [ ] Application type is SPA, browser app, or public client.
- [ ] Authorization code flow is enabled.
- [ ] PKCE is required or enforced with `S256`.
- [ ] Implicit flow is disabled for the production/staging client.
- [ ] Production/staging callback smoke proves `access_token` / `token` callback URLs are rejected by the frontend build.
- [ ] No client secret is embedded in the frontend.
- [ ] Allowed callback URL exactly matches the target environment `/auth/callback`.
- [ ] Allowed post-logout URL exactly matches the target environment `/auth/login`.
- [ ] Allowed web origin exactly matches the frontend origin.
- [ ] Access token is a JWT that can be verified by backend through `JWT_JWKS_URL`.
- [ ] Provider exposes a stable JWKS endpoint and supports key rotation without changing app code.

### Local Values
- Frontend origin: `http://localhost:5173`
- Callback URL: `http://localhost:5173/auth/callback`
- Post-logout URL: `http://localhost:5173/auth/login`
- API base: `http://localhost:3000/api`

### Staging Values
Fill these before staging smoke:
- Frontend origin: `https://admin.your-stage.example.com`
- Callback URL: `https://admin.your-stage.example.com/auth/callback`
- Post-logout URL: `https://admin.your-stage.example.com/auth/login`
- API base: `https://api.your-stage.example.com/api`

## Backend Environment Checklist

### P0 Required
- [ ] `AUTH_MODE=jwt`
- [ ] `JWT_ISSUER` exactly matches the access token `iss`
- [ ] `JWT_AUDIENCE` exactly matches at least one accepted access token `aud`
- [ ] `JWT_JWKS_URL` points to the provider signing keys
- [ ] `JWT_SECRET` is empty when JWKS verification is used
- [ ] `AUTH_AUTHORIZATION_URL` points to the provider authorize endpoint
- [ ] `AUTH_CLIENT_ID` matches the provider client/application id
- [ ] `AUTH_SCOPE` includes at least `openid profile email`
- [ ] `AUTH_RESPONSE_TYPE=code`
- [ ] `AUTH_TOKEN_URL` points to the provider token endpoint
- [ ] `AUTH_CALLBACK_PATH=/auth/callback`
- [ ] `AUTH_LOGOUT_URL` points to the provider logout endpoint when provider logout is supported
- [ ] `AUTH_POST_LOGOUT_REDIRECT_PATH=/auth/login`

### Conditional
- [ ] `AUTH_AUDIENCE_OVERRIDE` is set if the provider requires an `audience` authorization parameter.
- [ ] `AUTH_SCOPE` also includes a provider-specific scope if that is required to emit application roles or custom claims.
- [ ] `AUTH_SCOPE` does not request refresh-token scopes such as `offline_access` for first real IdP smoke.

## Frontend Environment Checklist

### P0 Required
- [ ] `VITE_API_BASE_URL` points to the backend `/api` origin for the target environment.
- [ ] `VITE_AUTH_MODE=bearer`
- [ ] No provider secret is present in frontend env files.

## Access Token Claim Contract

### P0 Required Claims
| Claim | Required shape | Notes |
| --- | --- | --- |
| `iss` | string | Must exactly match `JWT_ISSUER`. |
| `sub` | direct non-empty string | Production rejects tokens without this direct claim. |
| `aud` | direct string or string array | Production rejects tokens without this direct claim. Must satisfy backend audience verification. |
| `exp` | numeric JWT expiry | Frontend clears expired JWTs and backend validates lifetime. |
| `iat` | numeric issued-at | Recommended for traceability and token lifetime review. |
| `roles` | string array or comma-separated string | Preferred portable app role claim. Keep provider default roles out of this claim. |
| `read_company_ids` | string array or comma-separated string | Read-scope company ids. |
| `read_region_ids` | string array or comma-separated string | Read-scope region ids. |
| `read_store_ids` | string array or comma-separated string | Read-scope store ids. |
| `assigned_store_ids` | string array or comma-separated string | Action-scope store ids. This controls write/action eligibility. |

### P1 Recommended Claims
| Claim | Required shape | Notes |
| --- | --- | --- |
| `employee_id` | string | Stable employee link. Needed for employee/performance mapping quality. |
| `preferred_username` | string | Display and support diagnostics. |
| `email` | string | Display and support diagnostics. |
| `name`, `given_name`, `family_name` | string | Optional display fields. |

### Accepted Compatibility Claims
These are accepted by the backend but should not be the primary production mapper names:
- `company_ids`
- `region_ids`
- `store_ids`

For role extraction, the backend also accepts:
- `realm_access.roles`
- `resource_access[AUTH_CLIENT_ID].roles`

The preferred provider-portable contract is still direct top-level `roles` plus direct read/action scope claims.

## Role And Scope Rules

### P0 Required
- [ ] Provider roles map only to application roles that exist in the app role catalog.
- [ ] Provider roles do not include broad provider defaults such as offline/default account roles unless the backend is expected to ignore them.
- [ ] Read scope and action scope are not treated as the same thing.
- [ ] `read_*` claims define what the user can see.
- [ ] `assigned_store_ids` defines which stores the user can act on.
- [ ] Store action endpoints must reject actions outside `assigned_store_ids`.
- [ ] DB role assignments, when present, remain canonical over token role/scope context.
- [x] Module web DTOs use shared PostgreSQL UUID validation for database UUID fields; raw `IsUUID` reintroduction is guarded by a backend contract test.

## Sanitized Token Payload Examples

### Store Manager
Use this shape as the minimum payload target for a store manager smoke user. Do not store real signatures, raw tokens, or secrets in this document.

```json
{
  "iss": "https://idp.example.com/realms/store-ops",
  "sub": "idp-user-123",
  "aud": "store-ops-api",
  "exp": 1893456000,
  "iat": 1893452400,
  "preferred_username": "store.manager@example.com",
  "email": "store.manager@example.com",
  "employee_id": "EMP-STORE-MANAGER-001",
  "roles": ["STORE_MANAGER"],
  "read_company_ids": ["00000000-0000-0000-0000-000000000001"],
  "read_region_ids": ["11111111-1111-1111-1111-111111111111"],
  "read_store_ids": ["ba0f7a18-fdd4-44cd-9c03-af32ab535286"],
  "assigned_store_ids": ["ba0f7a18-fdd4-44cd-9c03-af32ab535286"]
}
```

### Region Manager
Use this shape to verify broad read scope with narrower action scope.

```json
{
  "iss": "https://idp.example.com/realms/store-ops",
  "sub": "idp-user-456",
  "aud": "store-ops-api",
  "exp": 1893456000,
  "iat": 1893452400,
  "preferred_username": "region.manager@example.com",
  "email": "region.manager@example.com",
  "employee_id": "EMP-REGION-MANAGER-001",
  "roles": ["REGION_MANAGER"],
  "read_company_ids": ["00000000-0000-0000-0000-000000000001"],
  "read_region_ids": ["11111111-1111-1111-1111-111111111111"],
  "read_store_ids": [],
  "assigned_store_ids": [
    "ba0f7a18-fdd4-44cd-9c03-af32ab535286",
    "c0f7a18-fdd4-44cd-9c03-af32ab535287"
  ]
}
```

## Staging Smoke Checklist

### P0 Required
- [ ] `GET /api/auth/bootstrap` returns `authMode=jwt`.
- [ ] `GET /api/auth/bootstrap` returns provider `configured=true`.
- [ ] Bootstrap provider has `responseType=code`.
- [ ] Bootstrap provider has non-empty `tokenUrl`.
- [ ] Login redirect includes `response_type=code`.
- [ ] Login redirect includes `code_challenge_method=S256`.
- [ ] Callback exchanges authorization code successfully.
- [ ] Frontend reaches `/store` or `/admin` through role-aware landing.
- [ ] `GET /api/auth/session` returns non-empty `roleCodes`.
- [ ] `GET /api/auth/session` returns expected `readScope`.
- [ ] `GET /api/auth/session` returns expected `actionScope.assignedStoreIds`.
- [ ] Store manager can view only authorized store data.
- [ ] Store manager can create or acknowledge actions only for `assigned_store_ids`.
- [ ] An action attempted outside `assigned_store_ids` returns `403`.
- [ ] Logout redirects to provider logout with `id_token_hint`.
- [ ] Logout returns the browser to `/auth/login`.
- [ ] Local bearer/id token session storage is cleared after logout.
- [ ] Expired bearer JWT is cleared and not sent as an `Authorization` header.

## Go / No-Go Criteria

### No-Go P0 Failures
Any item below blocks staging sign-off:
- Missing direct `sub` in production-shaped access token.
- Missing direct `aud` in production-shaped access token.
- Access token cannot be verified through JWKS.
- Authorization code + PKCE is not enabled.
- Implicit flow is still the only configured browser flow.
- Production frontend accepts `access_token` or `token` callback URLs.
- Provider does not emit app roles.
- Provider does not emit read scope.
- Provider does not emit action scope.
- `/api/auth/session` is empty for a valid smoke user.
- Expected authorized action returns `401`, `403`, or `503`.
- Expected unauthorized action does not return `403`.
- Logout cannot return safely to `/auth/login`.
- Real token payload contains secrets, raw signatures, or unrelated privileged provider roles in evidence files.

### Allowed P1 Limitations
These can proceed only if documented:
- `employee_id` is absent, with employee/performance mapping marked incomplete.
- Re-login is required after access token expiry, per `docs/plans/phase-7-token-renewal-decision.md`.
- Optional display profile fields are missing.
- Provider-specific logout requires an extra parameter that is documented and tested.

## Evidence To Attach After Smoke
Create or update a dated staging evidence note from:

- `docs/plans/phase-7-auth-evidence-template.md`

The evidence note must include:
- environment name
- frontend origin
- backend API base
- provider issuer
- provider client id
- JWKS URL
- accepted audience
- sanitized decoded access token payload
- `/api/auth/bootstrap` sanitized response
- `/api/auth/session` sanitized response for each smoke user
- login smoke date/time
- logout smoke date/time
- failed unauthorized action evidence showing `403`
- access token lifetime and re-login-on-expiry behavior
- confirmation that no refresh token was requested, stored, logged, or attached
- known P1 limitations

Do not attach raw bearer tokens, id tokens, refresh tokens, client secrets, private keys, or screenshots that expose secrets.

## Local Provider Smoke Evidence

Latest local evidence:

- `docs/plans/phase-7-auth-evidence-local-keycloak-2026-04-26.md`

Result:

- Local Keycloak OIDC authorization code + PKCE login passed.
- `GET /api/auth/bootstrap` returned `authMode=jwt` and provider `configured=true`.
- Login redirect included `response_type=code`, `state`, `code_challenge`, and `code_challenge_method=S256`.
- Callback exchanged the authorization code successfully.
- Store manager reached `/store`.
- `GET /api/auth/session` returned `STORE_MANAGER`, read scope, and assigned action store.
- `npm.cmd run smoke:auth:action` passed against a seeded local DB.
- Assigned-store target distribution create returned `201` and `submitted`.
- Unassigned-store target distribution create returned `403` with no write expected.
- Logout sent provider logout params and returned to `/auth/login`.
- Expired bearer token was cleared before API authorization headers were sent.

Remaining staging blockers:

- A real staging IdP registration is not yet provided.
- Positive action smoke in a seeded staging DB-backed environment is not yet captured.
- Negative unassigned-store `403` staging evidence is not yet captured.
- Local Keycloak access tokens still contain provider default role names; backend session role extraction filters these to app catalog roles, but staging provider mappers should also avoid emitting provider defaults.

## Out Of Scope
- Choosing the final IdP vendor.
- Implementing refresh token rotation.
- Implementing backend-assisted token exchange.
- Removing the dev-only local/manual callback fallback entirely.
- Defining employee master-data ownership.

Those items should be handled after one real provider passes this checklist end to end.
