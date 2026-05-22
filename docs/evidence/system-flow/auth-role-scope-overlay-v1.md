# System Flow Auth Role Scope Overlay V1

## Scope

This static overlay connects the generated system-flow map to the existing
authorization and scope evidence.

It does not change auth behavior. It does not prove live Clerk persona access.
It is a source-derived orientation layer for route visibility, endpoint role
guards, read scope, and assigned-store action scope.

## Sokrates Decision

Decision:

- Keep the current auth model and add a static overlay before any auth or route
  behavior work.

Why now:

- The system-flow map now has precise route/API edges and the 34 unlinked
  endpoints are classified. The next risk is interpreting those edges without
  losing role/scope/action-store context.

Evidence:

- `docs/flows/store-ops-system-flow.json` records route guards and route-level
  role visibility.
- `docs/plans/authorization-matrix-drift-guard-v1.md` defines the drift rules.
- `docs/plans/scope-auth-regression-matrix-v1.md` maps protected surfaces to
  positive and negative tests.
- Controller decorators in `backend/nestjs/src/modules/**/web` and
  `backend/nestjs/src/shared/**` show role, read-scope, public, and
  action-scope boundaries.

Counterargument:

- Static overlay can drift. This document is useful only if future route,
  endpoint, role, or scope changes update the matrix or add targeted tests.

Risk:

- LOW for this docs-only overlay.
- HIGH for any future auth, role, permission, provider, or backend scope
  behavior change.

Door:

- The overlay is a two-way door. Auth semantics are not.

Stop rule:

- Stop before changing role semantics, Clerk/provider behavior, DB assignment
  logic, action-store checks, or protected route visibility without a separate
  decision and negative tests.

## Route Visibility Overlay

Route visibility is frontend navigation and route-shell behavior. It is not a
backend authorization guarantee.

| Route family | Frontend guard | Route roles from system flow | Backend implication |
| --- | --- | --- | --- |
| `/auth/login`, `/auth/callback`, `/auth/logout` | `AuthFlowShell` | None | Auth entry routes should only call bootstrap/callback/session helpers; no broad business API fanout. |
| `/admin/session` | None, rendered through `SessionReadinessPage` | None | Session readiness should only depend on `GET /api/auth/session`. |
| `/admin/operations` | `AdminRouteGuard` | `SUPER_ADMIN` | Operations surfaces may aggregate read-only health/readiness signals but should not add hidden write controls. |
| `/admin/auth*` | `AdminRouteGuard` | `SUPER_ADMIN` | Auth admin endpoints remain high-risk; writes require existing auth-admin tests and negative coverage. |
| `/admin/audit*` | `AdminRouteGuard` | `AUDITOR`, `SUPER_ADMIN` | Audit visibility is read evidence, not permission to mutate auth/admin records. |
| `/admin/integrations*` | `AdminRouteGuard` | `INTEGRATION_ADMIN`, `SUPER_ADMIN` | Integration source/import endpoints require company scope and integration roles; source lifecycle UI remains parked. |
| `/admin/master-data*` | `AdminRouteGuard` | `HR_ADMIN`, `INTEGRATION_ADMIN`, `SUPER_ADMIN` | Master-data bootstrap writes remain guarded by true baseline/evidence decisions. |
| `/admin/snapshots*` | `AdminRouteGuard` | `SNAPSHOT_OPERATOR`, `SUPER_ADMIN` | Snapshot reads and commands require company scope and snapshot operator role. |
| `/admin/reports*` | `AdminRouteGuard` | `REPORT_VIEWER`, `SUPER_ADMIN` | Report routes are read surfaces; they do not grant scoring/config writes. |
| `/admin/kpi-config` | `AdminRouteGuard` | `SUPER_ADMIN` | KPI config write/publish behavior stays separate from report read visibility. |
| `/admin/targets` | `AdminRouteGuard` | `REGION_MANAGER`, `REPORT_VIEWER`, `SUPER_ADMIN` | Target queue read visibility does not grant target creation or approval without action-store checks. |
| `/admin/competitions` | `AdminRouteGuard` | `HR_ADMIN`, `REGION_MANAGER`, `REPORT_VIEWER`, `SUPER_ADMIN` | Competition reads and admin commands share a page; backend role/action tests remain the source of truth. |
| `/admin/feed` | `AdminRouteGuard` | `HR_ADMIN`, `REGION_MANAGER`, `SUPER_ADMIN` | Feed management routes require backend feed role/scope checks; update UI remains parked. |
| `/admin/inbox` | `AdminRouteGuard` | `HR_ADMIN`, `REPORT_VIEWER`, `SUPER_ADMIN` | Inbox visibility is not permission to approve/return every source action. |
| `/store/home`, `/store` | None at shell entry | None | Store shell still relies on session/store context before protected child routes. |
| `/store/checklists` | `StoreRouteGuard` | `STORE_ACCESS`, `VISUAL_MERCHANDISER` | Checklist result/action access remains backend-scoped by role and assigned stores. |
| `/store/feed` | `StoreRouteGuard` | `STORE_ACCESS`, `VISUAL_MERCHANDISER` | Feed visibility is computed by backend feed scope, not route visibility alone. |
| `/store/settings` | `StoreRouteGuard` | `STORE_ACCESS`, `VISUAL_MERCHANDISER` | Settings is a shell/user preference surface; do not infer domain write permission. |
| `/store/approvals` | `StoreRouteGuard` + target-request list eligibility | `STORE_MANAGER`, `REGION_MANAGER`, `REPORT_VIEWER`, `SUPER_ADMIN` | `STORE_PERSONNEL` is excluded from the route/link UX; backend read/write/action-scope checks remain the source of truth. |
| Other `/store/*` pages | `StoreRouteGuard` | `STORE_ACCESS` | Store access is a route family signal; concrete backend endpoints still enforce role, read scope, and action scope. |

## Endpoint Boundary Overlay

| Endpoint family | Backend guard pattern | Scope/action boundary | Existing evidence |
| --- | --- | --- | --- |
| Health | `@Public()` on `GET /api/health` and `GET /api/health/live` | Public health response must remain sanitized. | Health/readiness contract tests and deployed readiness smoke. |
| Auth session/bootstrap | Auth session controller, bootstrap public entry | DB assignments remain the app role/scope source of truth. | `auth-context.service.spec.ts`, `auth-scope.e2e-spec.ts`, staging auth runbook guards. |
| Auth admin | `SUPER_ADMIN`, with limited `HR_ADMIN` lookup paths | Role/scope writes must not imply action-store rights. | Auth admin tests and `scope-auth-regression-matrix-v1.md`. |
| Integration imports/source management | `@RequireScope("company")`, mostly `INTEGRATION_ADMIN` | Company scope gates import/source reads and writes. | Import batch e2e split, source boundary docs, source management parked classification. |
| Master-data bootstrap | `@RequireScope("company")`, `HR_ADMIN`, `INTEGRATION_ADMIN`, `SUPER_ADMIN` | Live promotion remains guarded by baseline and dry-run evidence. | Master-data bootstrap service/e2e tests and pilot smoke runbook. |
| Snapshots | `@RequireScope("company")`, `SNAPSHOT_OPERATOR` | Snapshot command/read surfaces are company-scoped operator surfaces. | Snapshot run e2e/read-model tests and operational monitoring docs. |
| Reporting | `@RequireScope("authenticated")` with report/store roles per endpoint | Reporting read scope does not grant mutation or action rights. | Reporting repository specs and auth-scope e2e tests. |
| Workforce | HR/Admin role paths plus store-manager action paths | Store-manager create/resubmit actions require assigned/action store scope. | Workforce seller-code/offboarding e2e suites. |
| Target distributions | Read paths have role guards; create/approve use `@RequireActionScope("store")` | Target actions must check assigned store scope separately from read visibility. | Target distribution repository specs and auth-scope e2e tests. |
| Checklist | Read/acknowledgement/store flows split by role | Creation/start and workflow actions must remain assigned-store constrained. | Checklist flow, mobile checklist today, and auth action-scope tests. |
| Feed | `@RequireScope("authenticated")` plus admin feed roles for management | Feed read visibility is backend-computed; route role is not enough. | Feed repository specs and feed e2e. |
| Competition | Mixed read/admin command route; backend roles differ by endpoint | Reads stay scoped; stage/template/package commands require admin roles. | Competition repository/service/e2e tests. |
| Mobile auth/checklists | Mobile session guard for session endpoints; checklist mobile routes use role/scope/action decorators | Mobile namespace is not a broad BFF or backend-owned refresh-token broker. | Mobile auth/session and mobile checklist today tests/docs. |
| Migrations | `SUPER_ADMIN`, authenticated; run endpoint disabled unless config enables it | CLI/CI migration path remains preferred; no UI command surface by default. | DB health and migration evidence docs/tests. |

## Action-Store Hotspots

Action-store scope is stricter than read scope. These areas should receive
negative tests before any behavior change:

| Domain | Current action-store boundary | Why it matters |
| --- | --- | --- |
| Checklist start/complete/acknowledge | Checklist service receives actor action scope; auditor/mobile start paths include store action constraints. | Broad checklist read visibility must not allow foreign-store mutation. |
| Mobile checklist start | `POST /api/mobile/checklists/instances` has `@RequireActionScope("store")`. | Region/VM field actions must stay assigned-store constrained. |
| Target distributions | Request creation and approval use `@RequireActionScope("store")`. | Region/report visibility must not become approval permission. |
| Workforce seller-code/offboarding | Store-manager create/resubmit actions use assigned/action store checks; HR/Admin approval paths are separate. | Store managers must not mutate unassigned stores. |
| Store acknowledgement | Store-manager acknowledgement paths must remain scoped to assigned/action stores. | Completed checklist visibility is not acknowledgement permission. |

## Overlay Use Rules

- If a route changes, update the route visibility row and the relevant
  protected-surface row in `scope-auth-regression-matrix-v1.md`.
- If an endpoint changes, name role guard, read scope, action scope, positive
  test, and negative test before implementation is considered complete.
- If a source-map edge is missing, classify it before deciding it is dead.
- If a route has `STORE_ACCESS`, still inspect the backend endpoint roles; the
  route role is intentionally coarse.
- If a backend endpoint has a role guard, still inspect read/action scope; role
  alone is not the authorization model.

## Follow-Up

Milestone 4 should use this overlay when reviewing fanout and bottleneck
candidates. A high-fanout route is more risky when it crosses multiple auth
boundaries, not merely when it calls many endpoints.

Milestone 5 should prioritize telemetry signals that preserve these boundaries:
operations read-only health, import/snapshot readiness, workforce queue
pressure, workflow inbox pressure, report freshness, and auth/session evidence.
