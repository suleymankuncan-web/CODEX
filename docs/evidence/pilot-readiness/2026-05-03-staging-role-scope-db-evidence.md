# Staging Role/Scope DB Evidence - 2026-05-03

## Scope

Record sanitized staging DB authorization evidence for the Clerk-backed pilot user.

This note intentionally excludes password, bearer token, Clerk cookie, raw session dump, provider subject, and email.

Environment:

- Frontend: `https://staging.hr-axis.com`
- API: `https://api-staging.hr-axis.com/api`
- Supabase project: `hr-axis-staging`
- Query time: `2026-05-03 09:53 +03` (`2026-05-03T06:53:03Z`)

Read-only SQL checked:

- `ops.user_account`
- `ops.user_role_assignment`
- `ops.user_action_store_assignment`
- `ops.role`
- `ops.company`
- `ops.region`
- `ops.store`

## Sanitized Result

Resolved user:

- `user_id`: `80000000-0000-0000-0000-000000000900`
- `username`: `suleyman.kuncan`
- `auth_provider`: `clerk`
- `is_active`: `true`

Active role assignments:

- `STORE_MANAGER`
  - `scope_type`: `store`
  - `company_code`: `ACME`
  - `region_code`: `IST`
  - `store_code`: `STORE100`
- `SUPER_ADMIN`
  - `scope_type`: `company`
  - `company_code`: `ACME`

Scope summary:

- `company_count`: `1`
- `region_count`: `1`
- `store_count`: `1`
- `assigned_store_count`: `1`

Assigned action store:

- `STORE100` / `IstinyePark Demo Store` / `active`

Unassigned active store candidates available for negative action-scope smoke:

- `DEMO-101` / `Demo Store 101`
- `IST-001` / `Istanbul Kadikoy`
- `IST-002` / `Istanbul Besiktas`
- `IZM-001` / `Izmir Karsiyaka`

## Code Guard Cross-Check

`RoleGuard` allows `SUPER_ADMIN` to satisfy role requirements globally.

`ScopeGuard` still enforces `RequireActionScope("store")` from `request.user.actionScope.assignedStoreIds`; it does not bypass action-store enforcement for `SUPER_ADMIN`. Therefore, the negative API smoke should target an endpoint with `RequireActionScope("store")` and send one of the unassigned store ids above.

## Interpretation

The staging DB now has a concrete authorization binding for the pilot Clerk user:

- the user is active,
- DB-backed roles resolve to `STORE_MANAGER` plus `SUPER_ADMIN`,
- read scope resolves to one company, one region, and one store,
- action scope resolves to one assigned store: `STORE100`.

This closes the DB configuration evidence for the pilot role/scope binding.

## Limits

This evidence does not close:

- live authenticated `/api/auth/session` payload evidence,
- assigned-store positive API action smoke,
- unassigned-store negative API action denial,
- logout or expired-token behavior,
- true baseline master data readiness,
- official real KPI import smoke readiness.

Those API-level checks still need a real Clerk-authenticated browser session or a reusable staging bearer token/automation credential.

## Pilot Gate Impact

Pilot status remains `No-Go`.

The role/scope DB binding is now evidenced, but the Pilot Readiness Gate V1 still requires authenticated session evidence, assigned/unassigned action-scope API smoke, true baseline master data, and official real KPI import evidence before pilot approval.
