# Auth Session Redirect Stability PR0 Evidence - 2026-07-05

## Scope

PR0 targets the browser state where Clerk still has a signed-in provider user,
but the HR Axis app session has been expired locally after a transient 401 or
CSRF/session recovery event.

The fix keeps the existing auth, permission, cookie-session, and bearer-session
contracts intact. It only changes the Clerk session bridge so a still signed-in
provider user can rebuild the app session even when Clerk returns the same token
that was already seen before local expiration.

## Root Cause

`ClerkSessionBridge` stored the last provider token and skipped
`startProviderSession(...)` whenever Clerk returned the same token again.

After `SESSION_EXPIRED_EVENT`, the app cleared the local browser session and
sent the user to `/auth/login`. If Clerk was still signed in and returned the
same token, the bridge could skip session recreation, leaving the login screen
waiting for session sync until a manual reload or a later external state change.

## Fix Evidence

- Added a contract guard:
  `admin-web/scripts/clerk-session-recovery-contract.test.mjs`
- The guard requires `ClerkSessionBridge` to check local app session readiness
  and resync the provider session when the app session is no longer ready.
- Updated `admin-web/src/features/auth/clerk-session.tsx` so the same Clerk
  token is accepted when `isSessionReady(session)` is false.

## Verification

Commands run:

```powershell
npm.cmd run test:scripts
npm.cmd --prefix admin-web run test:scripts
npm.cmd --prefix admin-web run lint
npm.cmd --prefix admin-web run build
npm.cmd --prefix admin-web run test:e2e -- store-return-to.spec.ts auth-cookie-session.spec.ts
```

Results:

- Root script tests: passed.
- Admin web script tests: 91 passed.
- Admin web lint: passed.
- Admin web build: passed.
- Auth e2e subset: 11 passed.

Note: the first e2e attempt was started in parallel with the build and failed
because `dist` did not exist yet. It was rerun after the build completed and
passed.

## Sensitive Data

No bearer token, provider token, CSRF token, cookie value, Clerk user id, or
private user data is recorded in this evidence.
