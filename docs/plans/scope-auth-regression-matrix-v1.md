# Scope/Auth Regression Matrix V1

## Purpose

This matrix documents existing protected surfaces; it does not add a new auth model.

The goal is to keep the current NestJS backend from quietly losing scope guarantees while new modules, reports, or mobile surfaces grow.

## Boundary

Read scope is not action scope.

Claims are not enough; DB assignment/action checks stay in place.

No role semantics are changed.

This pass does not change controllers, guards, repositories, migrations, DTOs, scoring, import, checklist, feed, workforce, or competition behavior. It only records which current tests protect each scope boundary and where future regressions should be added.

## Global Regression Rules

Empty scope returns no data without widening to all companies.

Foreign scope or explicit store filters cannot widen access outside the actor scope.

Assigned-store action rules remain separate from read scope.

A broad read scope does not allow create, approve, complete, acknowledge, or mutate outside `assignedStoreIds`.

Role checks stay role checks; scope checks stay scope checks.

Frontend visibility check is not a backend authorization test.

A backend role guard is not enough for store-scoped actions.

## Matrix

| Surface | Route / entrypoint | Backend boundary | Role guard | Read scope guard | Action scope guard | Positive evidence | Negative evidence |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Auth session context | `/api/auth/session` and admin/store shell bootstrap | Auth session controller, auth context service | Authenticated session resolves app-facing role codes | Session exposes company, region, store read scope without trusting provider defaults as app roles | Session exposes assigned store ids but does not grant action rights by claim alone | `backend/nestjs/src/modules/auth/auth-context.service.spec.ts` | `backend/nestjs/test/integration/auth-scope.e2e-spec.ts` |
| Role/scope policy | Auth admin role assignment flows | Auth role scope policy service | Role assignments can be narrowed only where policy allows it | Role policy blocks unsupported narrow scopes for broader reporting roles | Assignment writes must not imply action-store permission | `backend/nestjs/src/modules/auth/auth-role-scope-policy.service.spec.ts` | `backend/nestjs/src/modules/auth/auth-role-scope-policy.service.spec.ts` |
| Store/org read scope | Store/org reads used by admin and store shells | Store ops repository | Role checks stay separate from scope filtering | Store list and org-style reads intersect requested filters with actor company/store scope | No action rights are inferred from store/org read visibility | `backend/nestjs/src/modules/store-ops/infrastructure/store-ops.repository.spec.ts` | Empty actor scope fails closed with `WHERE FALSE` in `backend/nestjs/src/modules/store-ops/infrastructure/store-ops.repository.spec.ts` |
| Reporting read scope | Admin reports, store performance, rankings, KPI reads | Reporting repositories and reporting service | Reporting roles allow reads only through scoped filters | Workforce, KPI, checklist, turnover, and employee KPI lookup reads return empty data for empty scope and keep region restrictions even with explicit store filters | Reporting read access does not allow create, approve, complete, acknowledge, or mutate | `backend/nestjs/src/modules/store-ops/infrastructure/reporting.repository.spec.ts` | `backend/nestjs/test/integration/auth-scope.e2e-spec.ts` |
| Feed visible posts | Admin/store feed pages | Feed repository | Feed route role visibility is not the feed visibility rule | Feed visibility is computed from actor scope and store-region relationship | Feed reads do not grant announcement management actions | `backend/nestjs/src/modules/store-ops/infrastructure/feed.repository.spec.ts` | Empty scope returns no visible posts in `backend/nestjs/src/modules/store-ops/infrastructure/feed.repository.spec.ts` |
| Competition read scope | Admin/store competition pages | Competition repositories and service | Competition route roles do not bypass caller scope | Competition lists, detail reads, and contribution rows read through caller scope | Competition reads do not allow stage/template/package-plan writes | `backend/nestjs/src/modules/store-ops/infrastructure/competition.repository.spec.ts` | Empty scope returns no competitions, no detail, and no contribution rows in `backend/nestjs/src/modules/store-ops/infrastructure/competition.repository.spec.ts` |
| Checklist read model | `/store/checklists` and mobile checklist today | Checklist repository and mobile checklist controller | Store/checklist route visibility is not enough for result/action access | Mobile checklist today uses assigned stores before read stores, can resolve region scope for read-only visibility, and returns no rows without effective store scope | Checklist read visibility does not grant create, complete, or acknowledge rights | `backend/nestjs/src/modules/store-ops/infrastructure/checklist.repository.spec.ts` | No effective store scope returns no rows in `backend/nestjs/src/modules/store-ops/infrastructure/checklist.repository.spec.ts` |
| Checklist assigned-store actions | Checklist start, completion, acknowledgement | Checklist repository and checklist workflow endpoints | Caller role must allow the checklist action path | Broad read scope is insufficient for checklist mutation | Creation, completion, and acknowledgement require assigned/action store scope | `backend/nestjs/test/integration/auth-scope.e2e-spec.ts` | Caller outside store action scope receives forbidden behavior in `backend/nestjs/test/integration/auth-scope.e2e-spec.ts` |
| Target distribution read scope | `/admin/targets` and target coverage reads | Target distribution repository | Target route role permits read access only through scoped filters | Request listing and coverage reads use the narrowest available actor scope before status filters | Read scope does not permit target creation or approval | `backend/nestjs/src/modules/store-ops/infrastructure/target-distribution.repository.spec.ts` | Empty scope must not list all requests in `backend/nestjs/src/modules/store-ops/infrastructure/target-distribution.repository.spec.ts` |
| Target distribution assigned-store actions | Target request creation and approval | Target distribution service/repository | Role guard must be paired with action-store checks | Broad target read scope is not action permission | Target creation and approval must be checked against assigned action stores | `backend/nestjs/src/modules/store-ops/infrastructure/target-distribution.repository.spec.ts` | Foreign-store target actions are forbidden in `backend/nestjs/test/integration/auth-scope.e2e-spec.ts` |
| Workforce lifecycle assigned-store actions | Seller-code and offboarding request flows | Workforce seller-code/offboarding services | Store-manager actions and HR/Admin approval paths remain separate | Store-manager queue visibility does not grant foreign-store mutation | Seller-code and offboarding store-manager actions stay limited to assigned/action stores | `backend/nestjs/test/integration/workforce-seller-code.e2e-spec.ts`, `backend/nestjs/test/integration/workforce-offboarding.e2e-spec.ts` | Foreign assigned-store action cases stay covered by `backend/nestjs/test/integration/workforce-seller-code.e2e-spec.ts` and `backend/nestjs/test/integration/workforce-offboarding.e2e-spec.ts` |
| Admin/integration/migration roles | Import creation, snapshot run creation, migration execution | Integration, snapshot, and migration controllers | Import, snapshot, and migration actions require their specific roles | Reporting read roles cannot widen into operational write roles | Admin/integration/migration writes require explicit role-owned action paths | `backend/nestjs/test/integration/auth-scope.e2e-spec.ts` | Reporting roles cannot mutate import, snapshot, or migration surfaces in `backend/nestjs/test/integration/auth-scope.e2e-spec.ts` |

## Add-Test Rule For Future Work

When a new endpoint uses company, region, store, or assigned-store scope, add one of these guards before calling the surface done:

- empty scope returns no data or forbidden response,
- explicit foreign filter cannot widen access,
- action endpoint checks `assignedStoreIds` separately from read scope,
- role-only access is not enough for store mutation,
- DB assignment remains the source of truth when token claims and assignments conflict.

## Current Assessment

No new targeted backend test is added in this slice because the inspected protected surfaces already have regression coverage in the files listed above.

The value of this pass is traceability: future workers can now see which tests protect each auth/scope boundary before editing a controller, repository, or DTO.

## Verification

Run:

```powershell
node --test scripts\scope-auth-regression-matrix-contract.test.mjs
```

For release:

```powershell
npm.cmd run check:release
```

## CODEX DURUST YORUM

This is the right kind of boring guard.

The project already has the important auth/scope behavior in tests, but the knowledge was scattered across repository specs and integration e2e files. This matrix turns that scattered knowledge into a map, so a future feature does not accidentally treat read scope as permission to mutate.

The key product decision remains unchanged: users may read what their role and read scope allow, but store actions still require assigned action scope.

## Next Logical Step

Continue with `docs/plans/backend-foundation-hardening-plan-v1.md` P0 item 3: DB health and migration evidence.
