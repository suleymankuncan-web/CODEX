# System-Flow Transitive Precision Specification V1

Status: specified; RED contract pending implementation
Shelf: active plan
Author: Codex
Last verified: 2026-07-10

## 1. Problem And Current Evidence

The generated system-flow map links a route to API calls by scanning reachable
frontend files. It recognizes calls imported from modules whose specifier ends
in `/api`, but it does not resolve a called exported wrapper in another feature
module when that wrapper directly or transitively owns the API call.

Current reproducible evidence:

- `/store/approvals` renders `StoreApprovalsPage`.
- `StoreApprovalsPage` calls `getRequestCenterPage` from
  `features/store-approvals/request-center-api.ts`.
- that wrapper calls `GET /api/workflow/request-center`.
- the generated `/store/approvals` route has zero route-to-API edges.

The original audit named the target-distribution request edge. PR-4 later
moved this surface to the bounded request-center read model. PR-8 therefore
guards the current runtime endpoint instead of preserving the historical
example.

## 2. Scope

PR-8 will:

- resolve called named exported wrappers to their direct API calls;
- follow further named exported wrapper calls transitively inside
  `admin-web/src`;
- deduplicate converging calls and stop cycles deterministically;
- keep route preload registries outside route runtime fanout;
- record the current Store Approvals request-center edge as the production
  fixture;
- regenerate the JSON and HTML system-flow artifacts;
- inspect the target approval double cast against the generated OpenAPI truth.

PR-8 will not:

- infer an endpoint from a dynamic or non-literal path;
- count an imported function that is not called by the owning function/file;
- scan third-party packages or files outside `admin-web/src`;
- migrate legacy API clients broadly;
- change endpoint paths, response payloads, authorization, database state, or
  product behavior;
- add an OpenAPI response schema merely to force removal of a cast.

## 3. Target Typing Decision

`approveTargetDistributionRequest` currently uses a double cast because the
generated OpenAPI type for
`PATCH /api/target-distributions/requests/{requestId}/approve` is
`Record<string, never>`: the checked-in OpenAPI operation has no response
schema even though runtime returns a command envelope.

The cast is not safely removable from frontend evidence alone. It remains in
place unless an already-existing generated response type can express the
runtime value without changing or inventing the API contract. Adding backend
Swagger response models is a separate contract slice, not hidden inside this
generator PR.

## 4. Resolution Contract

For each route component file:

1. Preserve the existing bounded reachable-file traversal.
2. Detect called named imports, including `queryFn` and `mutationFn` references.
3. Resolve the imported module only when it is a relative file under
   `admin-web/src`.
4. Locate the exact named exported function.
5. Add API calls owned directly by that function.
6. Recursively resolve called named imports inside that function.
7. Track `module#export` keys in the active traversal stack to stop cycles.
8. Track API call IDs in a set to deduplicate converging wrappers.

An unresolved module, missing export, dynamic call target, or non-literal API
path is skipped as unresolved evidence; the generator must not guess a path.

## 5. Acceptance Criteria

### AC-01 — Current Store Approvals edge

Given the current Store Approvals page, when system flow is generated, then
`/store/approvals` includes `GET /api/workflow/request-center`.

### AC-02 — Transitive wrapper

Given wrapper A calls imported wrapper B and B owns a literal API call, when A
is called from a route-reachable file, then the route links to B's API call.

### AC-03 — Cycle safety

Given exported wrappers form A → B → A, generation terminates and every
reachable literal API call is emitted at most once.

### AC-04 — Call precision

Given a module exports two wrappers but the route calls only one, the route
must not inherit the unused wrapper's API calls.

### AC-05 — Preload exclusion

Existing `/auth/login` and `/admin/session` preload exclusion assertions remain
exactly green.

### AC-06 — Contract non-change

Generated evidence changes, but API/OpenAPI payload shape, auth, database,
requests, mutations, and runtime UI behavior do not.

### AC-07 — Target cast honesty

The double cast is removed only if the checked-in generated OpenAPI response
already represents the command envelope. Otherwise the spec records the
blocked reason and the cast remains unchanged.

## 6. Verification

- RED then GREEN Store Approvals route-edge contract.
- Synthetic direct, transitive, unused-export, duplicate, and cycle fixtures
  at the generator boundary.
- Existing route ID/source-line, representative route, preload exclusion, and
  endpoint-edge tests.
- Regenerated `docs/flows/store-ops-system-flow.json` and `.html` exactness.
- Root script contracts and the applicable release gate once.

## 7. Rollback And Stop Rules

Rollback is one PR revert covering generator logic, tests, generated artifacts,
and this specification.

Stop and split the work if:

- correct resolution requires TypeScript compiler-wide semantic analysis;
- a dynamic endpoint would need guessing;
- preload registries begin contributing runtime route edges;
- fixing target typing requires a new backend response model or API contract;
- generated route/API counts change outside explainable wrapper edges.

## 8. Contract Impact

Contract Impact: generated architecture evidence only.

- Runtime API/OpenAPI shape: unchanged.
- Authorization and roles: unchanged.
- Database and migrations: unchanged.
- Frontend request/mutation behavior: unchanged.
- Generated system-flow route-to-API edges: corrected.
