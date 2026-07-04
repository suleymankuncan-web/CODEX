# Store Manager Persona Audit Fix Train V1 - PR5 Evidence

Date: 2026-07-04

## Scope

PR5 adds a repeatable Store Manager persona e2e and live smoke pack.

Covered behavior:

- Store Manager route visibility and `/store/reports` denial.
- Checklist result acknowledgement from Store Manager task flow.
- Target distribution tab boundary for Store Manager.
- Store Manager incentive read-only boundary.
- Workforce UUID fallback guard.
- Feed composer hidden for Store Manager.
- Staging cookie-session smoke for the Store Manager pilot persona.

## Commands

```powershell
npm.cmd --prefix admin-web run test:e2e:store-manager -- --workers=1
npm.cmd --prefix admin-web run lint
npm.cmd --prefix admin-web run build
npm.cmd run test:scripts
npm.cmd --prefix admin-web run smoke:auth:staging:store-manager
git diff --check
```

## Result

- `test:e2e:store-manager`: passed, 3 tests.
- `lint`: passed.
- `build`: passed.
- `test:scripts`: passed, 498 tests.
- `smoke:auth:staging:store-manager`: passed.
- `git diff --check`: passed.

## Sanitized Staging Signals

- Landing route: `/store/home`.
- Expected role: `STORE_MANAGER`.
- Assigned store count: `1`.
- Browser session cookie: `HttpOnly`, `Secure`, `SameSite=Lax`, host-only.
- Browser session create/clear flow: passed.
- No bearer or provider id token stored in local/session storage.
- CSRF missing-header unsafe request: `403`.
- Logout clears app cookie.

## Exclusions

Password, OTP, bearer token, provider token, cookie value, provider subject, and raw storage values were not recorded.
