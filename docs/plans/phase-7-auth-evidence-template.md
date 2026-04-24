# Phase 7 Auth Evidence Template

## Metadata
- Evidence status: Draft
- Environment:
- Evidence date:
- Evidence owner:
- Reviewer:
- Related checklist: `docs/plans/phase-7-provider-readiness-checklist.md`

## Security Rules
- Do not paste raw bearer tokens.
- Do not paste raw id tokens.
- Do not paste refresh tokens.
- Do not paste authorization codes.
- Do not paste PKCE `code_verifier` values.
- Do not paste client secrets, private keys, cookies, or session storage dumps.
- Do not attach screenshots that expose tokens, cookies, secrets, or personal data beyond the smoke user identity.
- Store only sanitized decoded payloads and sanitized HTTP response shapes.

If raw secret material is accidentally captured, delete the evidence file, rotate the exposed secret or session where applicable, and recreate the evidence with sanitized values.

## Environment Contract

### Frontend
- Origin:
- Login route:
- Callback route:
- Logout landing route:

### Backend
- API base:
- Bootstrap endpoint:
- Session endpoint:
- Auth mode:

### Provider
- Provider name:
- Issuer:
- Client id:
- JWKS URL:
- Authorization URL:
- Token URL:
- Logout URL:
- Accepted audience:
- PKCE method:
- Access token lifetime:
- Refresh token requested: No
- Refresh token returned unexpectedly:

## Provider Registration Evidence
- [ ] Application type is SPA/browser/public client.
- [ ] Authorization code flow is enabled.
- [ ] PKCE S256 is required or enforced.
- [ ] Implicit flow is disabled.
- [ ] Callback URL matches the frontend `/auth/callback`.
- [ ] Post-logout URL matches the frontend `/auth/login`.
- [ ] Web origin matches the frontend origin.
- [ ] No frontend client secret is configured.
- [ ] Refresh-token scopes such as `offline_access` are not requested for first real IdP smoke.

Notes:

```text
<paste sanitized registration notes here>
```

## Backend Bootstrap Evidence

Command or browser step:

```text
GET /api/auth/bootstrap
```

Expected:
- `authMode` is `jwt`
- `provider.configured` is `true`
- `provider.responseType` is `code`
- `provider.tokenUrl` is present
- `provider.logoutUrl` is present when provider logout is expected
- `provider.scope` does not include refresh-token scopes such as `offline_access`

Sanitized response:

```json
{
  "authMode": "jwt",
  "provider": {
    "configured": true,
    "authorizationUrl": "https://idp.example.com/.../authorize",
    "clientId": "store-ops-admin-web",
    "scope": "openid profile email",
    "responseType": "code",
    "audience": "store-ops-api",
    "callbackPath": "/auth/callback",
    "tokenUrl": "https://idp.example.com/.../token",
    "logoutUrl": "https://idp.example.com/.../logout",
    "postLogoutRedirectPath": "/auth/login"
  }
}
```

Result:
- [ ] Pass
- [ ] Fail

Notes:

```text
<paste sanitized notes here>
```

## Login Redirect Evidence

Browser step:

```text
/auth/login?returnTo=/store
```

Expected authorization request fields:
- [ ] `response_type=code`
- [ ] `client_id` matches provider registration
- [ ] `redirect_uri` matches `/auth/callback`
- [ ] `scope` includes `openid profile email`
- [ ] `code_challenge` is present
- [ ] `code_challenge_method=S256`
- [ ] `state` is present
- [ ] `audience` is present only if required by provider

Sanitized observed authorization URL:

```text
https://idp.example.com/.../authorize?client_id=store-ops-admin-web&response_type=code&redirect_uri=https%3A%2F%2Fadmin.stage.example.com%2Fauth%2Fcallback&scope=openid%20profile%20email&code_challenge=<present-redacted>&code_challenge_method=S256&state=<present-redacted>
```

Result:
- [ ] Pass
- [ ] Fail

## Access Token Payload Evidence
Paste only the decoded JWT payload. Do not paste the raw token header, signature, or compact JWT string.

### Store Manager Smoke User

Expected:
- direct `sub` exists
- direct `aud` exists
- token lifetime is acceptable for smoke
- `roles` contains `STORE_MANAGER`
- read scope matches expected company/region/store
- `assigned_store_ids` contains only stores this user can act on

Sanitized decoded access token payload:

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

Result:
- [ ] Pass
- [ ] Fail

### Region Manager Smoke User

Expected:
- direct `sub` exists
- direct `aud` exists
- token lifetime is acceptable for smoke
- `roles` contains `REGION_MANAGER`
- read scope matches expected region
- `assigned_store_ids` contains only stores this user can act on

Sanitized decoded access token payload:

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

Result:
- [ ] Pass
- [ ] Fail

## Session Evidence

Command or browser step:

```text
GET /api/auth/session
```

### Store Manager Sanitized Response

```json
{
  "authenticated": true,
  "user": {
    "userId": "idp-user-123",
    "employeeId": "EMP-STORE-MANAGER-001",
    "roleCodes": ["STORE_MANAGER"],
    "readScope": {
      "companyIds": ["00000000-0000-0000-0000-000000000001"],
      "regionIds": ["11111111-1111-1111-1111-111111111111"],
      "storeIds": ["ba0f7a18-fdd4-44cd-9c03-af32ab535286"]
    },
    "actionScope": {
      "assignedStoreIds": ["ba0f7a18-fdd4-44cd-9c03-af32ab535286"]
    }
  }
}
```

Result:
- [ ] Pass
- [ ] Fail

### Region Manager Sanitized Response

```json
{
  "authenticated": true,
  "user": {
    "userId": "idp-user-456",
    "employeeId": "EMP-REGION-MANAGER-001",
    "roleCodes": ["REGION_MANAGER"],
    "readScope": {
      "companyIds": ["00000000-0000-0000-0000-000000000001"],
      "regionIds": ["11111111-1111-1111-1111-111111111111"],
      "storeIds": []
    },
    "actionScope": {
      "assignedStoreIds": [
        "ba0f7a18-fdd4-44cd-9c03-af32ab535286",
        "c0f7a18-fdd4-44cd-9c03-af32ab535287"
      ]
    }
  }
}
```

Result:
- [ ] Pass
- [ ] Fail

## Positive Action Smoke Evidence

Use a store that exists in the smoke user's `assigned_store_ids`.

Action tested:
- [ ] target distribution create
- [ ] target distribution approve
- [ ] checklist acknowledgement
- [ ] other:

Target store id:

Expected:
- request succeeds
- audit trail exists where applicable
- action belongs to an assigned store

Sanitized result:

```json
{
  "status": 200,
  "operation": "target-distribution-approve",
  "storeId": "ba0f7a18-fdd4-44cd-9c03-af32ab535286",
  "actorRole": "REGION_MANAGER"
}
```

Result:
- [ ] Pass
- [ ] Fail

## Negative Action Smoke Evidence

Use a store that does not exist in the smoke user's `assigned_store_ids`.

Action tested:
- [ ] target distribution create
- [ ] target distribution approve
- [ ] checklist acknowledgement
- [ ] other:

Target store id:

Expected:
- response status is `403`
- no DB write occurs for the rejected action
- no approval/acknowledgement state is changed

Sanitized result:

```json
{
  "status": 403,
  "operation": "target-distribution-approve",
  "storeId": "not-assigned-store-id",
  "actorRole": "REGION_MANAGER",
  "message": "Forbidden"
}
```

Result:
- [ ] Pass
- [ ] Fail

## Logout Evidence

Browser step:

```text
/auth/logout
```

Expected:
- [ ] frontend reads provider `id_token` before clearing local session
- [ ] provider logout request contains `id_token_hint`
- [ ] provider logout request contains `client_id`
- [ ] provider logout request contains `post_logout_redirect_uri`
- [ ] browser returns to `/auth/login`
- [ ] local bearer token is cleared
- [ ] local provider id token is cleared

Sanitized observed logout URL:

```text
https://idp.example.com/.../logout?id_token_hint=<present-redacted>&client_id=store-ops-admin-web&post_logout_redirect_uri=https%3A%2F%2Fadmin.stage.example.com%2Fauth%2Flogin
```

Result:
- [ ] Pass
- [ ] Fail

## Expired Token Evidence

Test method:
- [ ] manually inject sanitized expired JWT in local/staging test browser
- [ ] wait for a short-lived provider token to expire
- [ ] other:

Expected:
- expired bearer JWT is cleared from `sessionStorage`
- provider id token is cleared with the expired bearer session
- API requests do not include `Authorization: Bearer <expired-jwt>`
- user is routed back through login/session recovery
- no browser refresh token is used for first real IdP smoke

Sanitized result:

```json
{
  "expiredJwtCleared": true,
  "idTokenCleared": true,
  "authorizationHeaderSent": false,
  "browserRefreshTokenUsed": false,
  "landingRoute": "/auth/login"
}
```

Result:
- [ ] Pass
- [ ] Fail

## P1 Limitations
Document any limitation that does not block staging sign-off but must remain visible.

```text
<example: employee_id is not yet emitted by provider; employee performance mapping remains incomplete for this smoke user.>
```

Token renewal note:

```text
First real IdP smoke uses re-login after access-token expiry. Browser refresh tokens and hidden iframe silent re-auth are intentionally not used. See docs/plans/phase-7-token-renewal-decision.md.
```

## Final Sign-Off
- [ ] Provider registration P0 checks passed.
- [ ] Backend bootstrap P0 checks passed.
- [ ] Login redirect P0 checks passed.
- [ ] Access token direct `sub` and `aud` checks passed.
- [ ] Role/read/action claims passed.
- [ ] `/api/auth/session` passed.
- [ ] Positive action smoke passed.
- [ ] Negative `403` action smoke passed.
- [ ] Logout smoke passed.
- [ ] Expired-token behavior passed or documented as a P1 limitation with owner/date.
- [ ] No refresh token was requested, stored, logged, or attached.
- [ ] No raw secret material is present in this evidence file.

Decision:
- [ ] Go
- [ ] No-Go

Reviewer notes:

```text
<paste final reviewer notes here>
```
