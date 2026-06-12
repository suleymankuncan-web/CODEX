# Browser Session Staging Evidence

Status: guarded
Shelf: readiness/security
Date: 2026-06-12

## Scope

This note records a real staging cookie-session proof for the launch
browser-session security blocker after approved staging provider and deploy
configuration were applied.

This is not a broad production Go. Broad production remains `No-Go`.

## Configuration Boundary

The evidence run used the existing staging hosts:

- Frontend: `https://staging.hr-axis.com`
- Backend API: `https://api-staging.hr-axis.com/api`
- Persona class: Region Manager
- Expected app role: `REGION_MANAGER`
- Expected landing route: `/admin/competitions`

The Render backend was configured for provider-backed browser sessions and
redeployed. The Vercel frontend was configured with
`VITE_BROWSER_SESSION_TRANSPORT=cookie` for production and redeployed to the
staging alias.

No raw password, one-time code, bearer token, provider token, cookie value,
provider subject, signing secret, Render API key, or database credential is
recorded here.

## Sanitized Result

Evidence status: `protected_staging_cookie_session_passed`.

Sanitized observed results:

- `GET /api/health` returned `200`.
- `GET /api/auth/bootstrap` returned `authMode=jwt`,
  `provider.configured=true`, `responseType=code`, and a token URL was present.
- Browser login reached `/admin/competitions`.
- `POST /api/auth/browser-session` returned `201`.
- Backend-owned app cookie was observed with:
  - name: `hr_axis_browser_session`;
  - host scope: `api-staging.hr-axis.com`;
  - no leading-dot broad domain;
  - `HttpOnly=true`;
  - `Secure=true`;
  - `SameSite=Lax`.
- Cookie-authenticated `GET /api/auth/session` returned `200`.
- Session role codes included `REGION_MANAGER`.
- Read company scope count was `1`.
- Assigned action store count was `3`.
- App browser storage did not contain
  `store-ops-admin-bearer-token`.
- App browser storage did not contain
  `store-ops-admin-provider-id-token`.
- No token-shaped values were found in `localStorage` or `sessionStorage`.
- Runtime CSRF nonce was present without recording the nonce value.
- Unsafe cookie-authenticated request without `X-CSRF-Token` returned `403`.
- `DELETE /api/auth/browser-session` during logout returned `200`.
- Logout cleared the backend-owned app-session cookie.

Sanitized proof output:

```json
{
  "status": "passed",
  "baseUrl": "https://staging.hr-axis.com",
  "apiBaseUrl": "https://api-staging.hr-axis.com/api",
  "expectedLanding": "/admin/competitions",
  "expectedRole": "REGION_MANAGER",
  "bootstrap": {
    "authMode": "jwt",
    "providerConfigured": true,
    "responseType": "code",
    "tokenUrlPresent": true
  },
  "browserSession": {
    "createStatus": 201,
    "clearStatus": 200
  },
  "cookie": {
    "name": "hr_axis_browser_session",
    "domain": "api-staging.hr-axis.com",
    "httpOnly": true,
    "secure": true,
    "sameSite": "Lax"
  },
  "session": {
    "authStatus": 200,
    "roleCodes": ["REGION_MANAGER"],
    "companyScopeCount": 1,
    "assignedStoreCount": 3
  },
  "storage": {
    "appBearerStored": false,
    "appProviderIdTokenStored": false,
    "tokenShapedStorageKeys": [],
    "suspiciousKeyCount": 0,
    "csrfNoncePresent": true
  },
  "csrf": {
    "unsafeMissingHeaderStatus": 403
  },
  "logout": {
    "appCookiePresentAfterLogout": false
  }
}
```

## What This Proves

- The deployed staging frontend is on cookie browser-session transport.
- The deployed staging backend creates and clears a backend-owned HttpOnly
  Secure app-session cookie.
- The app no longer stores bearer or provider tokens in browser-readable app
  storage for this Region Manager staging login.
- Cookie-authenticated app session resolution still goes through backend role,
  scope, and assigned-store context.
- CSRF protection blocks unsafe cookie-authenticated requests without the
  runtime nonce.

## Limits

This evidence does not approve broad production.

This evidence does not claim Store Action create/approve write behavior for a
different persona. The live persona was `REGION_MANAGER`; the target request create endpoint is scoped to `STORE_MANAGER` and `SUPER_ADMIN`, so no assigned-store positive write was created from this run.

If role assignments, Clerk template, backend auth config, cookie settings,
frontend browser-session transport, or target domain changes, rerun this sanitized proof before relying on the result.

## Historical Note

The earlier blocked attempt remains recorded in
`docs/evidence/readiness/2026-06-12-browser-session-staging-evidence-blocked.md`.
That note is historical context for the pre-configuration failure and must not
be used as the current launch browser-session evidence state.
