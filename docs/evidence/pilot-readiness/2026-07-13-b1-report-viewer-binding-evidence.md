# B1 Report Viewer Binding Evidence - 2026-07-13

Status: passed_partial_b1
Shelf: evidence
Evidence class: sanitized_live_staging_plus_contract
Observed at: 2026-07-13T00:42:26+03:00

## Decision

A staging-only Clerk account was created in the application catalog through the
existing Super Admin auth workflow and assigned `REPORT_VIEWER` at company
scope. No action-store assignment was added. The real cookie-session smoke
passed and no P0/P1 authorization finding was observed. Decision:
`no_runtime_change`.

The provider subject, credentials, OTP, internal user/assignment IDs, and raw
company ID are intentionally excluded.

## Live Result

| Boundary | Sanitized result |
| --- | --- |
| Expected landing | `/admin/reports` |
| Role | `REPORT_VIEWER` |
| Company read scope | one company |
| Action-store scope | zero stores |
| Browser session create / clear | `201` / `200` |
| Request without session | `401` |
| Cookie | host-only, HttpOnly, Secure, SameSite=Lax |
| Browser-readable app/provider token | absent |
| Unsafe request without CSRF header | `403` |
| Logout | application cookie removed |

The account did not exist in the application catalog before this operation.
The first pre-binding smoke stopped at browser-session creation with `401`, as
expected. After the canonical user and role assignment, the same smoke passed.

## Executable Authorization Evidence

- Frontend Report Viewer portfolio, forbidden-route, incentive-navigation, and
  no-action contracts: `7/7` passed.
- Backend role-specific company scope, reporting/personnel cross-company
  denial, and Store Action read/no-command contracts: `52/52` passed across
  four suites.

## Limit

This proves the real persona binding, role/company scope, protected reports
landing, session security, and executable read-only boundaries. It does not yet
record a fresh live report-period totals/export comparison or a live incentive
period readback. Those remain the final B1-20260710-05 data-evidence slice.

No production environment, database schema, role semantics, provider config,
or product code changed.
