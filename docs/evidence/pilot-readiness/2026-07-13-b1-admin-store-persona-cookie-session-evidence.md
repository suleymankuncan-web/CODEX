# B1 Admin And Store Persona Cookie-Session Evidence - 2026-07-13

Status: passed_partial_b1
Shelf: evidence
Evidence class: sanitized_live_staging
Observed at: 2026-07-13T00:07:16+03:00

## Decision

Current controlled staging sessions passed the canonical cookie-session smoke
for `SUPER_ADMIN`, `STORE_MANAGER`, and `STORE_PERSONNEL`. Combined with the
12 July `REGION_MANAGER` receipt, all four personas in B1-20260710-01 now have
current login/session/logout evidence. No P0/P1 finding was reproduced and the
decision is `no_runtime_change`.

This closes the four-persona session slice. It does not prove account recovery,
rankings/personnel-profile authorization, business mutations, or broad
production.

## Executions

| Persona | Command shape | Landing | Role and scope | Result |
| --- | --- | --- | --- | --- |
| Super Admin | canonical cookie-session smoke with ignored `PILOT_ADMIN_*` mapped locally | `/admin/operations` | `SUPER_ADMIN`; one company; no assigned store required | passed twice after one transient role-mismatch attempt |
| Store Manager | `npm.cmd --prefix admin-web run smoke:auth:staging:store-manager` | `/store/home` | `STORE_MANAGER`; one company; one assigned store | passed |
| Store Personnel | `npm.cmd --prefix admin-web run smoke:auth:staging:store-personnel` | `/store/me` | `STORE_PERSONNEL`; one company; one assigned store | passed |

All successful runs also proved:

- browser-session creation `201`, clear `200`, and unauthenticated access `401`;
- host-only HttpOnly/Secure/SameSite=Lax application cookie;
- no app bearer or provider token in browser-readable storage;
- cookie transport with a CSRF nonce and unsafe request rejection `403`;
- logout removed the application cookie.

The first Super Admin attempt authenticated but did not satisfy the expected
role assertion. Two immediate clean reruns passed with `SUPER_ADMIN`; the issue
was not reproducible, so no runtime finding is opened. Recurrence requires a
separate browser/session trace before any code change.

## Security And Limits

The ignored local environment file supplied usernames, passwords, and OTPs.
No credential, OTP, token, cookie value, provider subject, raw identifier, or
personal data is recorded here.

Account recovery remains untested. B1-20260710-04 rankings/personnel-profile
scope also remains separate because current credentials do not by themselves
name an approved positive and negative personnel-profile subject.
