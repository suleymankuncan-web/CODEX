# B1 Region Manager Cookie-Session Evidence - 2026-07-12

Status: passed_partial_b1
Shelf: evidence
Evidence class: sanitized_live_staging
Observed at: 2026-07-12T23:29:03+03:00

## Decision

A current controlled staging `REGION_MANAGER` session passed the repository's
canonical cookie-session smoke. No P0/P1 finding was observed and the decision
is `no_runtime_change`.

This closes only the Region Manager login/session slice of B1-20260710-01. It
does not prove Admin, Store Manager, or Store Personnel sessions, account
recovery, broad production, or any business mutation.

## Execution

Command:

```text
npm.cmd --prefix admin-web run smoke:auth:staging:cookie-session
```

Repository state:

- branch: `codex/b1-login-session-evidence-20260712`
- tested base SHA: `ae2265dc35c3356aed1ad1f9fb029251cc7016a6`
- frontend host: `staging.hr-axis.com`
- API host: `api-staging.hr-axis.com`
- configured persona: `REGION_MANAGER`

The ignored local environment file supplied the persona credentials and OTP.
No credential, OTP, token, cookie value, provider subject, raw identifier, or
personal data is recorded here.

## Sanitized Result

| Boundary | Result |
| --- | --- |
| Protected landing | `/admin/competitions` reached |
| Browser-session creation | `201` |
| Request without bearer/session | `401` |
| Authenticated session readback | `200`, authenticated |
| Role readback | `REGION_MANAGER` |
| Company scope | one company |
| Assigned-store scope | 30 stores |
| Session cookie | host-only, HttpOnly, Secure, SameSite=Lax |
| App bearer/provider token in browser storage | absent |
| Cookie transport and CSRF nonce | present |
| Unsafe request without CSRF header | `403` |
| Logout/session clear | `200`; application cookie absent afterward |

## Limitations And Next Gate

- The smoke validates login, protected landing, authenticated session
  readback, cookie transport, CSRF rejection, and logout for one persona.
- It does not execute password/account recovery.
- B1-20260710-01 remains partial until current sanitized sessions exist for
  Admin, Store Manager, and Store Personnel and the recovery expectation is
  separately evidenced or explicitly removed from the acceptance boundary.
- No runtime, authorization, database, provider, or production change is
  authorized by this result.
