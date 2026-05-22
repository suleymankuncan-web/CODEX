# Store Action V1B API Contract V1

## Scope

This evidence records the fourth Store Action V1B implementation kademe:
controller/DTO exposure, OpenAPI schema coverage, generated frontend contract
types, and source-flow artifact refresh for persisted action plans.

It does not add workflow inbox integration, Store Tasks UI mutations,
notifications, escalation, DB migration, KPI scoring changes, checklist rules,
target approval behavior, provider config, or broad auth semantic changes.

## Sokrates Decision

Decision:

- Expose the already-tested Store Action command/read boundary under
  `/api/store-actions/plans`.
- Keep write permission tied to assigned-store action scope.
- Avoid using route-level `RequireActionScope("store")` on lifecycle endpoints
  because those requests carry only `actionPlanId`; the service loads the plan
  and validates its `storeId` against the actor action scope.
- Add generated OpenAPI/frontend type coverage before any UI adopts the write
  endpoints.
- Keep workflow inbox mapping and Store Tasks UI behavior for the next
  kademeler.

Why now:

- Schema, lifecycle, service, repository, and audit command behavior already
  have targeted tests.
- The next narrow risk is public API exposure and contract drift, not UI.

Repo evidence:

- `StoreActionPlanController` delegates list/detail/create/status/close/cancel
  calls without changing service behavior.
- DTOs validate list filters and command bodies at the controller boundary.
- `store-action-plan.openapi.contract.spec.ts` guards the OpenAPI request and
  response schema references.
- `store-action-plan-openapi.ts` keeps Store Action schema mapping out of the
  already-oversized OpenAPI generator and preserves file-size guard pressure.
- `admin-web/src/generated/openapi-types.ts` includes the selected Store Action
  operations for future generated client usage.
- `docs/flows/store-ops-system-flow.json` now records six new Store Action API
  endpoints as OpenAPI-covered but not yet frontend-called.

Counterargument:

- Exposing write endpoints before UI can feel early. The reason it is
  acceptable here is that no frontend route calls them yet, and API exposure is
  a separately reviewable, revertible contract slice before workflow/UI state
  is layered on.

Risk:

- HIGH domain, controlled implementation. The PR exposes write-capable routes,
  but it does not change DB schema, source-domain scoring, existing workflow
  semantics, or frontend behavior. Assigned-store negative cases remain in
  service/controller tests.

Door:

- Medium two-way door. The slice is revertible as one API-contract PR before
  workflow inbox and UI adoption depend on it.

## Implemented Boundary

Endpoints:

- `GET /api/store-actions/plans`
- `GET /api/store-actions/plans/:actionPlanId`
- `POST /api/store-actions/plans`
- `PATCH /api/store-actions/plans/:actionPlanId/status`
- `PATCH /api/store-actions/plans/:actionPlanId/close`
- `PATCH /api/store-actions/plans/:actionPlanId/cancel`

Guard model:

- Read/list/detail/lifecycle routes require authenticated store-manager or
  super-admin roles.
- Create also requires `RequireActionScope("store")` because the request body
  includes `storeId`.
- Lifecycle route store authorization remains service-level after loading the
  plan by id.

Generated contract:

- `docs/api/openapi.json` includes request/response schemas for all six
  operations.
- `admin-web/src/generated/openapi-types.ts` selects the Store Action
  operations for future typed client usage.

## Verification

TDD red proof:

```powershell
npm.cmd --prefix backend/nestjs test -- store-action-plan.service.spec.ts store-action-plan.repository.spec.ts store-action-plan.controller.spec.ts
npm.cmd --prefix backend/nestjs test -- openapi-baseline.contract.spec.ts --runTestsByPath src/shared/openapi-baseline.contract.spec.ts
```

Initial result:

- controller/service/repo test failed before controller/read methods existed.
- OpenAPI baseline failed because `/api/store-actions/plans` was absent from
  the generated contract artifact.

Passed locally:

```powershell
npm.cmd --prefix backend/nestjs test -- store-action-plan.service.spec.ts store-action-plan.repository.spec.ts store-action-plan.controller.spec.ts store-action-plan.openapi.contract.spec.ts store-action-plan.contract.spec.ts openapi-baseline.contract.spec.ts audit-event-catalog.spec.ts
npm.cmd --prefix backend/nestjs run openapi:generate
npm.cmd --prefix admin-web run api:generate
npm.cmd --prefix admin-web run api:check
npm.cmd run system-flow:generate
node --test scripts/file-size-guard.test.mjs
npm.cmd --prefix backend/nestjs run lint
npm.cmd --prefix backend/nestjs run build
npm.cmd --prefix admin-web run lint
npm.cmd --prefix admin-web run build
npm.cmd run test:scripts
npm.cmd run check:release
```

Result:

```text
Store Action API targeted tests: 37 passed, 0 failed
Generated OpenAPI types are current
System flow regenerated with 170 backend endpoints and 170 OpenAPI endpoints
File size guard: 3 passed, 0 failed
Backend lint/build: passed
Admin lint/build: passed
test:scripts: 309 passed, 0 failed
root check:release: backend 123 suites / 712 tests passed; admin Playwright 177 passed; audits/builds passed; exit 0
```

## Next Kademe

Next safe implementation step:

- integrate Store Action plans into the shared workflow inbox as `task` items,
  with explicit source/status mapping and targeted service tests,
- keep Store Tasks UI lifecycle commands for the following kademe unless the
  inbox mapping remains green and reviewable.
