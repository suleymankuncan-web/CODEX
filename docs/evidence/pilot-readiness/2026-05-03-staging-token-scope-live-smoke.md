# Staging Token Scope Live Smoke - 2026-05-03

## Scope

Run a live Clerk-authenticated API smoke against HR Axis staging using the local token-scope harness.

This evidence intentionally excludes bearer token, Clerk cookie, password, provider subject, raw JWT payload, email, and browser storage dumps.

Environment:

- API: `https://api-staging.hr-axis.com/api`
- Frontend session source: authenticated staging browser session
- Smoke time: `2026-05-03T07:23:50Z` (`2026-05-03 10:23 +03`)

## Command Path

The browser session token was sent only to a local one-time listener on `127.0.0.1`; the token was not printed in terminal output and was not written to this evidence file.

Harness:

- `admin-web/scripts/auth-token-scope-smoke.mjs`
- `npm.cmd --prefix admin-web run smoke:auth:staging:token-scope`

Store inputs:

- Assigned positive store: `STORE100`, id `00000000-0000-0000-0000-000000000100`
- Unassigned negative store: `DEMO-101`, id `00000000-0000-0000-0000-000000000101`
- Expected role: `STORE_MANAGER`

## Result

Smoke exit:

- `SMOKE_EXIT=0`
- `evidenceStatus=staging-clerk-token-action-scope-smoke-passed`

Authenticated session:

- `authMode=jwt`
- `authenticated=true`
- resolved app user id: `80000000-0000-0000-0000-000000000900`
- employee id: present in API response, not copied here
- resolved roles:
  - `SUPER_ADMIN`
  - `STORE_MANAGER`
- read scope:
  - `companyCount=1`
  - `regionCount=1`
  - `storeCount=1`
  - `storeIds=[00000000-0000-0000-0000-000000000100]`
- action scope:
  - `assignedStoreCount=1`
  - `assignedStoreIds=[00000000-0000-0000-0000-000000000100]`

Assigned-store action-scope smoke:

- Endpoint: `GET /target-distributions/store-personnel`
- Store: `STORE100`
- Store id: `00000000-0000-0000-0000-000000000100`
- HTTP status: `200`
- Result row count: `0`
- Interpretation: route and guard allowed the assigned action store. Row count can be zero because this is a read-only personnel listing smoke, not a data-presence assertion.

Unassigned-store negative action-scope smoke:

- Endpoint: `GET /target-distributions/store-personnel`
- Store: `DEMO-101`
- Store id: `00000000-0000-0000-0000-000000000101`
- HTTP status: `403`
- Message: `Out-of-scope store action`
- DB write expected: `false`
- Interpretation: action-scope guard denied an active but unassigned store.

## Limits

This closes live authenticated session evidence and read-only assigned/unassigned action-scope API smoke for the current staging user.

This does not close:

- write/mutation action smoke,
- logout or expired-token behavior,
- official authenticated Power BI upload smoke,
- true baseline master data readiness,
- real KPI import materialization evidence.

## Pilot Gate Impact

Pilot status remains `No-Go`.

The authenticated session and assigned/unassigned action-scope API evidence item is now closed for the current staging user, but the Pilot Readiness Gate V1 still requires true baseline master data and official real KPI import evidence before pilot approval.
