# Phase 7 Auth Evidence - Local Keycloak

## Metadata

- Evidence status: Local provider smoke passed; staging sign-off not claimed.
- Environment: `local-keycloak`
- Evidence date: 2026-04-26 11:08 Europe/Istanbul
- Evidence owner: Codex-assisted local validation
- Reviewer: Pending
- Related checklist: `docs/plans/phase-7-provider-readiness-checklist.md`

## Security Rules Applied

- Raw bearer tokens were not stored.
- Raw id tokens were not stored.
- Authorization codes were not stored.
- PKCE `code_verifier` values were not stored.
- `state`, `code_challenge`, and `id_token_hint` values are redacted.
- Evidence contains only sanitized decoded payload and sanitized HTTP response shapes.

## Environment Contract

### Frontend

- Origin: `http://localhost:5173`
- Login route: `http://localhost:5173/auth/login?returnTo=/store`
- Callback route: `http://localhost:5173/auth/callback`
- Logout landing route: `http://localhost:5173/auth/login`

### Backend

- API base: `http://localhost:5173/api` through Vite proxy to `http://localhost:3000/api`
- Bootstrap endpoint: `GET /api/auth/bootstrap`
- Session endpoint: `GET /api/auth/session`
- Auth mode: `jwt`

### Provider

- Provider name: Keycloak local
- Issuer: `http://localhost:8080/realms/store-ops`
- Client id: `store-ops-admin-web`
- JWKS URL: `http://localhost:8080/realms/store-ops/protocol/openid-connect/certs`
- Authorization URL: `http://localhost:8080/realms/store-ops/protocol/openid-connect/auth`
- Token URL: `http://localhost:8080/realms/store-ops/protocol/openid-connect/token`
- Logout URL: `http://localhost:8080/realms/store-ops/protocol/openid-connect/logout`
- Accepted audience: `account`
- PKCE method: `S256`
- Refresh token requested: No
- Refresh token returned unexpectedly: Not observed or stored by the browser flow.

## Provider Registration Evidence

- [x] Application type is SPA/browser/public client.
- [x] Authorization code flow is enabled.
- [x] PKCE S256 is required or enforced by client config.
- [x] Implicit flow is disabled on the app client.
- [x] Callback URL matches the frontend `/auth/callback`.
- [x] Post-logout URL matches the frontend `/auth/login`.
- [x] Web origin matches the frontend origin.
- [x] No frontend client secret is configured.
- [x] Refresh-token scopes such as `offline_access` are not requested by `AUTH_SCOPE`.

Notes:

```text
Local Keycloak was configured through infra/scripts/setup-keycloak.ps1 before smoke.
The provider still emits Keycloak default role names in the access-token role claim; backend JWT role extraction now filters session roleCodes to the application role catalog.
```

## Backend Bootstrap Evidence

Command:

```powershell
Invoke-RestMethod -Uri "http://localhost:3000/api/auth/bootstrap"
```

Sanitized response:

```json
{
  "authMode": "jwt",
  "provider": {
    "configured": true,
    "clientId": "store-ops-admin-web",
    "scope": "openid profile email roles",
    "responseType": "code",
    "callbackPath": "/auth/callback",
    "tokenUrl": "http://localhost:8080/realms/store-ops/protocol/openid-connect/token",
    "logoutUrl": "http://localhost:8080/realms/store-ops/protocol/openid-connect/logout",
    "postLogoutRedirectPath": "/auth/login"
  }
}
```

Result:

- [x] Pass
- [ ] Fail

## Login Redirect Evidence

Browser step:

```text
/auth/login?returnTo=/store
```

Sanitized observed authorization URL:

```text
http://localhost:8080/realms/store-ops/protocol/openid-connect/auth?client_id=store-ops-admin-web&redirect_uri=http%3A%2F%2Flocalhost%3A5173%2Fauth%2Fcallback&response_type=code&scope=openid+profile+email+roles&state=%3Cpresent-redacted%3E&code_challenge=%3Cpresent-redacted%3E&code_challenge_method=S256
```

Observed:

- [x] `response_type=code`
- [x] `client_id=store-ops-admin-web`
- [x] `redirect_uri=http://localhost:5173/auth/callback`
- [x] `scope=openid profile email roles`
- [x] `code_challenge` present and redacted
- [x] `code_challenge_method=S256`
- [x] `state` present and redacted
- [x] `audience` omitted because the local Keycloak audience is handled through `account`

Result:

- [x] Pass
- [ ] Fail

## Access Token Payload Evidence

Smoke user: `store.manager`

Sanitized decoded access token payload:

```json
{
  "iss": "http://localhost:8080/realms/store-ops",
  "sub": "202fc242-a29f-4a44-8794-ffa6a58a3048",
  "aud": "account",
  "exp": 1777191208,
  "iat": 1777190908,
  "preferred_username": "store.manager",
  "email": "store.manager@example.com",
  "employee_id": ["DEMO-EMP-201"],
  "roles": [
    "offline_access",
    "STORE_MANAGER",
    "uma_authorization",
    "default-roles-store-ops"
  ],
  "read_company_ids": ["00000000-0000-0000-0000-000000000001"],
  "read_region_ids": ["00000000-0000-0000-0000-000000000010"],
  "read_store_ids": ["00000000-0000-0000-0000-000000000100"],
  "assigned_store_ids": ["00000000-0000-0000-0000-000000000100"]
}
```

Result:

- [x] Pass for local smoke because direct `sub`, direct `aud`, role, read scope, and action scope exist.
- [ ] Fail

Important note:

```text
The local provider still emits default Keycloak role names in the decoded access token. Backend session evidence below proves these are filtered out of app-facing roleCodes. For staging, prefer provider mapper cleanup as well, so the token itself only emits application roles.
```

## Session Evidence

Command:

```text
GET /api/auth/session with Authorization: Bearer <redacted>
```

Store manager sanitized response:

```json
{
  "authMode": "jwt",
  "authenticated": true,
  "user": {
    "userId": "202fc242-a29f-4a44-8794-ffa6a58a3048",
    "employeeId": "DEMO-EMP-201",
    "roleCodes": ["STORE_MANAGER"],
    "readScope": {
      "companyIds": ["00000000-0000-0000-0000-000000000001"],
      "regionIds": ["00000000-0000-0000-0000-000000000010"],
      "storeIds": ["00000000-0000-0000-0000-000000000100"]
    },
    "actionScope": {
      "assignedStoreIds": ["00000000-0000-0000-0000-000000000100"]
    }
  },
  "scopeSummary": {
    "companyCount": 1,
    "regionCount": 1,
    "storeCount": 1,
    "assignedStoreCount": 1
  }
}
```

Result:

- [x] Pass
- [ ] Fail

## Positive Action Smoke Evidence

Result:

- [ ] Pass
- [ ] Fail
- [x] Not executed in this local provider smoke.

Reason:

```text
This smoke focused on OIDC/PKCE/session/logout behavior without a seeded DB-backed action workflow. Positive action smoke must be run against a seeded staging environment.
```

## Negative Action Smoke Evidence

Result:

- [ ] Pass
- [ ] Fail
- [x] Not executed in this local provider smoke.

Reason:

```text
403 action evidence requires a seeded staging environment with one assigned store and one unassigned target store.
```

## Logout Evidence

Browser step:

```text
/auth/logout
```

Sanitized observed logout URL:

```text
http://localhost:8080/realms/store-ops/protocol/openid-connect/logout?post_logout_redirect_uri=http%3A%2F%2Flocalhost%3A5173%2Fauth%2Flogin&id_token_hint=%3Cpresent-redacted%3E&client_id=store-ops-admin-web
```

Observed:

- [x] provider logout request contains `id_token_hint`
- [x] provider logout request contains `client_id`
- [x] provider logout request contains `post_logout_redirect_uri`
- [x] browser returns to `/auth/login`
- [x] local bearer token is cleared
- [x] local provider id token is cleared

Result:

- [x] Pass
- [ ] Fail

## Expired Token Evidence

Test method:

- [x] Injected a synthetic expired JWT in a local test browser.

Sanitized result:

```json
{
  "expiredJwtCleared": true,
  "idTokenCleared": true,
  "authSessionRequestCount": 0,
  "authorizationHeaderSent": false,
  "landingRoute": "/auth/login",
  "browserRefreshTokenUsed": false
}
```

Result:

- [x] Pass
- [ ] Fail

## P1 Limitations

```text
This is local Keycloak real-provider smoke evidence, not staging IdP sign-off.
Positive and negative DB-backed action smoke remain pending for a seeded staging environment.
The local Keycloak access token still contains provider default role names, but backend session roleCodes now filter to app catalog roles only.
```

Token renewal note:

```text
First real IdP smoke uses re-login after access-token expiry. Browser refresh tokens and hidden iframe silent re-auth are intentionally not used. See docs/plans/phase-7-token-renewal-decision.md.
```

## Final Sign-Off

- [x] Provider registration local checks passed.
- [x] Backend bootstrap local checks passed.
- [x] Login redirect local checks passed.
- [x] Access token direct `sub` and `aud` checks passed.
- [x] Role/read/action claims passed for local smoke.
- [x] `/api/auth/session` passed.
- [ ] Positive action smoke passed.
- [ ] Negative `403` action smoke passed.
- [x] Logout smoke passed.
- [x] Expired-token behavior passed.
- [x] No refresh token was requested, stored, logged, or attached by the browser flow.
- [x] No raw secret material is present in this evidence file.

Decision:

- [x] Local provider smoke Go
- [ ] Staging Go
- [x] Staging No-Go until a real staging IdP and seeded action smoke are available

Reviewer notes:

```text
Local OIDC/PKCE mechanics are healthy. The next evidence step is not another local login run; it is staging provider registration plus positive/negative action smoke in a seeded environment.
```
