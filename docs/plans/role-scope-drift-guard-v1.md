# Role Scope Drift Guard V1

Date: 2026-05-23

## Purpose

Keep frontend route visibility, backend endpoint authorization, generated API
usage, role assignment, scope assignment, and action-store assignment from
drifting apart during future pilot work.

## Sokrates Decision

Claim: the project now has enough auth/read/write surface that drift is a higher
risk than missing UI polish.

Assumption: the current app DB remains the authorization source of truth; Clerk
only provides identity/session.

Evidence:

- `docs/architecture/pilot-route-role-matrix.md` maps frontend route visibility.
- `docs/plans/scope-auth-regression-matrix-v1.md` maps backend role/scope tests.
- Store Action introduced assigned-store command boundaries that are easy to
  overexpose if route and endpoint checks are not considered together.

Counterargument: generated OpenAPI types reduce shape drift, but they do not
prove authorization behavior.

Risk: LOW as a docs-only guard; HIGH when changing auth/permission semantics.

Door: two-way-door for the guard. Auth semantic changes are near-one-way-door
and need dedicated negative tests.

Stop rule: stop any PR that changes route visibility, backend guards,
role/scope assignment, action-store commands, or auth admin writes without a
matching test/evidence plan.

Verification ladder:

1. Route matrix entry exists.
2. Backend endpoint guard family is identified.
3. Read scope and action scope are named separately.
4. Positive and negative test/evidence path exists.
5. Generated client/API shape check runs only if API contract changes.
6. Current-state or evidence doc is updated when pilot semantics change.

## Drift Sources

| Drift Source | Failure Mode | Guard |
| --- | --- | --- |
| Frontend route added or moved | A role sees a route that backend will reject, or loses a route it should have. | Update `pilot-route-role-matrix.md`; add/adjust Playwright route visibility smoke. |
| Backend endpoint guard changed | Existing UI call starts returning 403/404 or allows too much. | Update `scope-auth-regression-matrix-v1.md`; run targeted backend auth/scope tests. |
| Generated API client changes | Frontend compiles but role/scope semantics are untested. | Run OpenAPI generate/check plus targeted route tests. |
| New command endpoint | Read-only roles get command affordances, or assigned-store scope is bypassed. | Require positive and negative command tests; action-store scope must be separate from read scope. |
| Role assignment UI/admin change | DB assignment semantics drift from Clerk identity assumptions. | Require auth admin repository/service tests and a persona evidence plan. |
| Store Action or workflow relation | Workflow visibility is mistaken for permission to mutate Store Action state. | Treat workflow inbox read and Store Action command permissions as separate proofs. |

## Current Pilot Route Anchor

| Route Family | Primary Roles | Required Scope Proof |
| --- | --- | --- |
| `/admin/integrations` | `SUPER_ADMIN`; optional admin evidence carrier by explicit scope. | Admin/integration read and upload permission when upload evidence is in scope. |
| `/admin/master-data` | `SUPER_ADMIN`, `HR_ADMIN` | Admin read/write surface must not imply auth admin writes. |
| `/admin/reports`, `/admin/targets` | `SUPER_ADMIN`, `REPORT_VIEWER`, scoped admin roles | Reporting read scope and no mutation controls for report-only persona. |
| `/admin/auth`, `/admin/audit` | `SUPER_ADMIN`, audit-specific roles where documented. | Super-admin-only auth mutation proof and audit read proof. |
| `/store/tasks` | `STORE_MANAGER`; read-only visibility for some admin/report contexts only when documented. | Store Action read and assigned-store command proof. |
| `/store/me`, `/store/kpis`, `/store/rankings` | `STORE_MANAGER`, `STORE_PERSONNEL`, store shell roles | Assigned-store read scope and no admin command exposure. |
| `/store/approvals` | `STORE_MANAGER` plus documented admin/region/report roles | Approval action-store scope must not be inferred from route visibility alone. |

## Test And Evidence Map

| Behavior | Preferred Proof |
| --- | --- |
| Route visible for allowed persona | Targeted Playwright route/session fixture or live persona browser evidence. |
| Route hidden/redirected for denied persona | Targeted Playwright negative route fixture or live persona browser evidence. |
| Endpoint allows allowed read | Targeted backend auth/scope Jest/e2e test; protected staging smoke when tokens exist. |
| Endpoint denies forbidden read | Negative backend auth/scope test. |
| Store Action command allows assigned store | Backend action-store test and protected Store Action smoke. |
| Store Action command denies unassigned store | Required negative test/evidence before command proof is closed. |
| Generated client stays current | `openapi:generate`, `api:generate`, `api:check` when API contracts change. |

## PR Checklist

- [ ] Did this PR change route visibility, navigation, auth guard, role/scope
      logic, or command exposure?
- [ ] If yes, does it update the route/endpoint matrix or evidence note?
- [ ] Does it prove both allowed and denied cases?
- [ ] Does it separate read scope from action-store command scope?
- [ ] Does it avoid adding a new role unless the user explicitly scoped it?
- [ ] Does it avoid using a tokenless public smoke as protected auth evidence?
