# Authorization Matrix Drift Guard V1

## Reader And Action

Reader:

- A future engineer adding or changing an admin/store route, backend endpoint,
  role, scope, or assigned-store action.

After reading, they should be able to:

- update the authorization matrix before implementation drifts,
- decide which negative tests are required,
- avoid confusing read scope with action scope.

## Sokrates Decision

Claim:

- Authorization drift is one of the highest future risks because the project
  uses role, read scope, and assigned-store action scope together.

Assumptions:

- The existing auth model is healthy and should not be changed by this plan.
- The missing piece is not a new auth model; it is a living matrix and guard
  rhythm.

Repo evidence:

- The scope/auth regression matrix already records protected surfaces and
  existing tests.
- The pilot route role matrix records route-level access expectations.
- Backend auth/scope tests already cover session context, empty scope,
  foreign filters, assigned-store actions, and admin/integration roles.
- User-account and auth-admin boundary decisions already treat auth writes as
  high risk.

Counterargument:

- More matrix documentation can go stale. That is why V1 must connect each row
  to a test family and a future guard script rather than becoming static prose.

Risk:

- LOW for this docs-only plan.
- HIGH for any future auth/permission behavior change.

Door:

- The plan is a two-way door.
- Auth model changes, role semantics, and permission broadening are near
  one-way-door decisions.

Stop rule:

- Stop if a route or endpoint change can broaden access and no negative test is
  identified before implementation.

## Matrix Scope

The living matrix should cover four layers:

1. Frontend route visibility.
2. Backend endpoint role guard.
3. Backend read-scope filter.
4. Assigned-store action-scope check for mutations.

For each protected surface, record:

- user role or role family,
- required read scope,
- required action scope if any,
- route visibility expectation,
- endpoint status expectation,
- positive test,
- negative test,
- owning domain,
- next review trigger.

## Drift Guard Rules

- A new protected route must either map to an existing matrix row or add a row.
- A new endpoint must name role, read scope, and action scope separately.
- A write/action endpoint must have at least one forbidden or foreign-scope
  negative test before it is treated as done.
- A frontend visibility check is not a backend authorization test.
- A backend role guard is not enough for store-scoped actions.
- `SUPER_ADMIN` role behavior must not silently bypass assigned-store action
  semantics unless explicitly designed and tested.

## Candidate Guard Shape

V1 can stay lightweight:

1. Keep the route/endpoint matrix in docs.
2. Add or extend a script contract that asserts the required matrix sections
   exist and name test families.
3. For code changes, require the PR body or plan note to mention the relevant
   matrix row.

Do not try to fully parse decorators, routes, and tests in the first slice.

## First Implementation Slice Later

Recommended first code/docs slice:

- extend the existing scope/auth regression matrix with route/endpoint/action
  columns and add a small docs contract test that prevents removing the
  negative-test guidance.

Verification later:

- script contract test,
- targeted backend auth tests only if behavior or matrix coverage changes,
- full pilot stabilization gate only for auth behavior changes.
