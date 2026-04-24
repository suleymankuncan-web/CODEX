# Keycloak Local Auth Runbook

## Purpose
Provide a real local identity provider so the app can exercise:
- `/auth/login`
- `/auth/callback`
- `/auth/logout`
- backend JWT verification through JWKS

This is the second step after the local JWT test path.

## What This Setup Uses
- Keycloak in Docker
- realm import from repo
- frontend authorization code + PKCE redirect
- backend JWT verification through JWKS

## Files
- compose file:
  - [docker-compose.keycloak.yml](</E:/WEBSİTE ÇALIŞMASI/infra/docker-compose.keycloak.yml>)
- realm import:
  - [store-ops-realm.json](</E:/WEBSİTE ÇALIŞMASI/infra/keycloak/store-ops-realm.json>)

## Start Keycloak
In `E:\WEBSİTE ÇALIŞMASI\infra`:

```powershell
docker compose -f docker-compose.keycloak.yml up -d
```

Keycloak admin console:
- `http://localhost:8080`

Admin credentials:
- username: `admin`
- password: `admin`

## Imported Realm
The import creates:
- realm:
  - `store-ops`
- client:
  - `store-ops-admin-web`
- demo users:
  - `store.manager`
  - `store.personnel`
  - `region.manager`
  - `admin.operator`

Demo user password:
- `StoreOps123!`

## Backend Env
In `E:\WEBSİTE ÇALIŞMASI\backend\nestjs\.env` use:

```env
AUTH_MODE=jwt
JWT_ISSUER=http://localhost:8080/realms/store-ops
JWT_AUDIENCE=account
JWT_SECRET=
JWT_JWKS_URL=http://localhost:8080/realms/store-ops/protocol/openid-connect/certs

AUTH_AUTHORIZATION_URL=http://localhost:8080/realms/store-ops/protocol/openid-connect/auth
AUTH_CLIENT_ID=store-ops-admin-web
AUTH_SCOPE=openid profile email roles
AUTH_RESPONSE_TYPE=code
AUTH_TOKEN_URL=http://localhost:8080/realms/store-ops/protocol/openid-connect/token
AUTH_AUDIENCE_OVERRIDE=
AUTH_CALLBACK_PATH=/auth/callback
AUTH_LOGOUT_URL=http://localhost:8080/realms/store-ops/protocol/openid-connect/logout
AUTH_POST_LOGOUT_REDIRECT_PATH=/auth/login
```

Important:
- do not set `JWT_SECRET` for this Keycloak path
- use `JWT_JWKS_URL` so backend validates through Keycloak JWKS
- current frontend integration expects `response_type=code` with PKCE S256

## Verified Local Outcome
This local Keycloak path is now verified end to end in the current codebase:
- `store.manager` reaches `/store`
- `admin.operator` reaches admin routes such as `/admin/reports`
- backend resolves the session through `GET /api/auth/session`
- frontend exchanges the authorization code with the saved PKCE verifier
- frontend keeps the returned bearer token in `sessionStorage`
- frontend keeps the returned `id_token` separately in `sessionStorage` for provider logout only

## Important Local Notes
The currently working local setup depends on:
- Keycloak client `store-ops-admin-web`
- a client protocol mapper that emits realm roles to claim name `roles`
- client protocol mappers that emit `read_company_ids`, `read_region_ids`, `read_store_ids`, and `assigned_store_ids`
- the `roles` client scope being attached to the client as a default scope
- Keycloak 26 user profile policy allowing local demo custom attributes; the setup script sets `unmanagedAttributePolicy=ENABLED`
- demo users being updated through Admin REST with `email`, `firstName`, `lastName`, `emailVerified=true`, empty `requiredActions`, and the read/action scope attributes

Backend no longer infers roles, scopes, employee ids, or assigned stores from local demo usernames. If a local login lands without access, fix the Keycloak attributes/mappers instead of adding backend demo fallback logic.

## Frontend Env
In `C:\Users\suley\OneDrive\Masaüstü\admin-web\.env` use:

```env
VITE_API_BASE_URL=http://localhost:3000/api
VITE_AUTH_MODE=bearer
```

Frontend provider config can now come from backend `GET /api/auth/bootstrap`.

## Run App

### Backend
```powershell
cd /d "E:\WEBSİTE ÇALIŞMASI\backend\nestjs"
npm.cmd run start:dev
```

### Frontend
```powershell
cd /d "C:\Users\suley\OneDrive\Masaüstü\admin-web"
npm.cmd run dev
```

## Login Test
1. Open:
   - `http://localhost:5173/auth/login`
2. Click provider login
3. Sign in with one of:
   - `store.manager`
   - `admin.operator`
4. Password:
   - `StoreOps123!`
5. Keycloak redirects back to:
   - `http://localhost:5173/auth/callback`
6. Frontend validates `state`, exchanges `code` through the token endpoint, stores the returned token, and verifies with:
   - `GET /api/auth/session`

## Expected Routing

### `store.manager`
- token carries `STORE_MANAGER`
- token carries read scope and assigned action store claims
- frontend should land in `/store`

### `store.personnel`
- token carries `STORE_PERSONNEL`
- token carries read scope and assigned action store claims
- frontend should land in `/store`

### `region.manager`
- token carries `REGION_MANAGER`
- token carries region read scope and assigned action store claims
- frontend should land in `/admin/targets`

### `admin.operator`
- token carries `SUPER_ADMIN` and `REPORT_VIEWER`
- token carries company/read scope claims
- frontend should land in an admin route such as `/admin/integrations` or `/admin/reports`

## Logout Test
1. Open:
   - `http://localhost:5173/auth/logout`
2. Frontend clears bearer token
3. Frontend redirects to Keycloak logout URL with `id_token_hint`, `client_id`, and `post_logout_redirect_uri`
4. Keycloak should return user to:
   - `http://localhost:5173/auth/login`

## Notes About Current Security Posture
This local Keycloak path now matches the production-shaped browser login direction.

Current limitations:
- no refresh token strategy
- no backend token exchange

That is acceptable for local end-to-end validation while provider-specific refresh/logout behavior is finalized.

## If Login Does Not Work
Check these first:

1. backend `AUTH_MODE=jwt`
2. backend `JWT_ISSUER` exactly matches the Keycloak realm issuer
3. backend `JWT_AUDIENCE` is set to `account` for the current local Keycloak path
4. frontend `VITE_API_BASE_URL` points to `http://localhost:3000/api`
5. Keycloak client redirect URI is exactly:
   - `http://localhost:5173/auth/callback`
6. Keycloak is running on:
   - `http://localhost:8080`
7. the Keycloak client has a protocol mapper that writes realm roles to:
   - `roles`

## Next Hardening Step After This
Once this works end to end, the next auth hardening move should be:
- finalize provider-specific logout and refresh/silent re-auth behavior
