# Authenticated Clerk Store Smoke Evidence

Date: 2026-05-02 23:53 +03
Environment: HR Axis staging
Executed by: Product owner in browser
Prepared by: Codex

## Scope

This is a sanitized manual authenticated smoke note. It intentionally does not include the smoke user's password, raw bearer token, Clerk cookie, session dump, authorization code, or private data.

Frontend:

- `https://staging.hr-axis.com`

API base active in deployed bundle:

- `https://api-staging.hr-axis.com/api`

## Manual Smoke Result

The product owner confirmed the authenticated Clerk session could open these store routes:

- `/store`
- `/store/me`
- `/store/kpis`
- `/store/approvals`

The product owner also confirmed that the previous 45-second refresh/reload behavior did not recur during this smoke.

## Evidence Boundaries

This closes the manual browser check for the store shell routes and the 45-second refresh symptom.

This note does not prove:

- raw `/api/auth/session` response payload,
- assigned-store positive action write,
- unassigned-store negative action denial,
- logout and expired-token behavior,
- true baseline master data readiness,
- real KPI import smoke readiness.

## Pilot Gate Impact

This is meaningful staging auth evidence for the store-facing path, but it is still not full pilot `Go`.

Remaining required evidence:

- Sanitized backend session evidence with resolved role/scope.
- Assigned-store positive action smoke.
- Unassigned-store negative scope smoke.
- True store/personnel baseline evidence.
- Real KPI import smoke evidence.
- Release/migration evidence for the pilot commit.
