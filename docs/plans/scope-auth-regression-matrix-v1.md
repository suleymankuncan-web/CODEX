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

## Matrix

| Surface | Protected rule | Existing regression evidence |
| --- | --- | --- |
| Auth session context | The API session response must expose app-facing role codes, read scope, action scope, and assigned store ids without trusting provider defaults as app roles. | `backend/nestjs/test/integration/auth-scope.e2e-spec.ts`, `backend/nestjs/src/modules/auth/auth-context.service.spec.ts` |
| Role/scope policy | Role assignments can be narrowed only where the role policy allows it. A role that requires broader reporting scope must not be silently narrowed into an unsupported store-only assignment. | `backend/nestjs/src/modules/auth/auth-role-scope-policy.service.spec.ts` |
| Store/org read scope | Store list and org-style reads must intersect requested filters with actor company/store scope. Empty actor scope must fail closed with `WHERE FALSE`. | `backend/nestjs/src/modules/store-ops/infrastructure/store-ops.repository.spec.ts` |
| Reporting read scope | Workforce, KPI, checklist, turnover, and employee KPI lookup reads must return empty data for empty scope and keep region restrictions even when a caller passes an explicit store filter. | `backend/nestjs/test/integration/auth-scope.e2e-spec.ts`, `backend/nestjs/src/modules/store-ops/infrastructure/reporting.repository.spec.ts` |
| Feed visible posts | Feed visibility must be computed from actor scope. Store-scoped users can see their store-region posts through the store-region relationship, but other-region posts stay hidden. Empty scope returns no visible posts without querying. | `backend/nestjs/src/modules/store-ops/infrastructure/feed.repository.spec.ts` |
| Competition read scope | Competition lists, detail reads, and contribution rows must read through caller scope. Empty scope returns no competitions, no detail, and no contribution rows without querying. | `backend/nestjs/src/modules/store-ops/infrastructure/competition.repository.spec.ts` |
| Checklist read model | Mobile checklist today uses assigned stores before read stores, can resolve region scope to stores for read-only today visibility, and returns no rows when no effective store scope exists. | `backend/nestjs/src/modules/store-ops/infrastructure/checklist.repository.spec.ts` |
| Checklist assigned-store actions | Checklist creation/completion/acknowledgement must be action scoped. A caller outside the store action scope must receive forbidden behavior even if the route exists and the role is otherwise valid. | `backend/nestjs/test/integration/auth-scope.e2e-spec.ts`, `backend/nestjs/src/modules/store-ops/infrastructure/checklist.repository.spec.ts` |
| Target distribution read scope | Request listing and coverage reads must use the narrowest available actor scope before status filters. Empty scope must not list all requests. | `backend/nestjs/src/modules/store-ops/infrastructure/target-distribution.repository.spec.ts` |
| Target distribution assigned-store actions | Target creation and approval must be checked against assigned action stores. Broad read scope does not permit creating or approving a target request for a foreign store. | `backend/nestjs/test/integration/auth-scope.e2e-spec.ts`, `backend/nestjs/src/modules/store-ops/infrastructure/target-distribution.repository.spec.ts` |
| Workforce lifecycle assigned-store actions | Seller-code and offboarding store-manager actions stay limited to assigned/action stores. HR/Admin approval stays a separate role-owned mutation path. | `backend/nestjs/test/integration/workforce-seller-code.e2e-spec.ts`, `backend/nestjs/test/integration/workforce-offboarding.e2e-spec.ts` |
| Admin/integration/migration roles | Import batch creation, snapshot run creation, and migration execution require their specific roles; reporting roles cannot mutate these surfaces. | `backend/nestjs/test/integration/auth-scope.e2e-spec.ts` |

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
