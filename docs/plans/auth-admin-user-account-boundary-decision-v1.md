# Auth Admin User Account Boundary Decision V1

## Purpose

Decide whether the next auth admin refactor should move user-account methods
out of `AuthAdminRepository`, and define the guardrails before touching
security-sensitive write behavior.

This is a docs-only decision record. It does not move code, change API
responses, change auth behavior, add DB migrations, or change user-facing
behavior.

## Decision

Do not move user-account writes yet.

The only acceptable next code slice in this area is a read-only extraction:

- move `listUserAccounts`,
- move `getUserAccountById`,
- route `AuthAdminService` list/detail/deactivate/reactivate preflight reads
  through the new read repository.

Keep these methods in `AuthAdminRepository` for now:

- `getUserAccountByProviderSubject`,
- `getActiveEmployeeAccessContext`,
- `listActiveStoresByIds`,
- `createUserAccount`,
- `createPilotUserBinding`,
- `reactivateUserAccount`.

Status:

- The read-only extraction is complete: `listUserAccounts` and
  `getUserAccountById` now live in `AuthAdminUserAccountReadRepository`.
- User-account writes, provider-subject lookup, active employee/store
  validation, and pilot binding remain parked.

Why:

- `listUserAccounts` and `getUserAccountById` are simple admin read/detail
  queries with existing user-account E2E coverage.
- provider-subject lookup, active employee/store validation, pilot binding,
  create, and reactivate behavior sit near auth identity, company/store scope,
  audit writes, and access lifecycle semantics.
- the repository and schema prove a unique provider subject mapping, but they
  do not prove a DB-enforced "one active user account per employee" invariant.

## Sokrates Decision Record

Claim:

- "The next auth admin cleanup should extract user-account behavior."

Assumptions:

- A structural split can preserve all auth/admin behavior.
- Existing tests cover the moved behavior well enough.
- User account read methods are separable from create/reactivate/pilot binding.
- One active account per employee might be a desired product invariant.

Repo evidence:

- `AuthAdminRepository` remains large after lookup and audit reads were split.
- `AuthAdminService` uses `listUserAccounts` only for list responses.
- `AuthAdminService` uses `getUserAccountById` as a read preflight before
  deactivate/reactivate and then delegates deactivation to
  `AccessLifecycleService`.
- `createUserAccount`, `createPilotUserBinding`, and `reactivateUserAccount`
  write audit events inside transactions.
- `createPilotUserBinding` also creates role assignments and action-store
  assignments in the same transaction.
- `db/schema.sql` and migration `041_user_account_provider_subject.sql`
  include a unique partial index for `(auth_provider, provider_subject)` when
  `provider_subject IS NOT NULL`.
- `db/schema.sql`, migration `041_user_account_provider_subject.sql`, and
  migration `044_user_access_lifecycle_metadata.sql` include active/employee
  indexes, not an active-employee uniqueness constraint.
- `user-account-provider-subject-schema-contract.spec.ts` protects provider
  subject schema and lifecycle metadata, but does not assert one active account
  per employee.

Counterargument:

- A single `AuthAdminUserAccountRepository` containing reads and writes would
  reduce the large repository faster and look cleaner.

Why the counterargument is not enough:

- Faster line reduction is not the main goal in auth.
- Grouping read-only list/detail queries with create/reactivate/pilot binding
  would make the next PR harder to review and risk hiding behavior-adjacent
  changes behind a structural title.
- Without an explicit product/DB/test decision for active employee-account
  uniqueness, moving create/reactivate logic could accidentally bless or break
  an implicit rule.

Risk:

- Read-only list/detail extraction: MEDIUM, because it is auth-admin code but
  does not change writes, scopes, or API response shape.
- User create/reactivate/pilot binding extraction: HIGH, because it touches
  identity links, audit writes, role assignment creation, action-store creation,
  and access lifecycle semantics.

Door:

- Read-only extraction is a two-way door: one squash revert restores the
  repository shape.
- Write extraction is near one-way operationally if it changes access,
  provider-subject identity, or audit semantics.

Decision quality score:

- Read-only extraction: 4/5. Scope, evidence, counterargument, risk, rollback,
  and tests are clear.
- Write extraction: 2/5. Goal is clear, but invariant and negative-test
  strategy are not strong enough yet.

## Boundary Map

Safe read-only candidate:

- `listUserAccounts`
- `getUserAccountById`

Keep near current command repository:

- `createUserAccount`
- `reactivateUserAccount`

Keep near pilot binding workflow:

- `getUserAccountByProviderSubject`
- `getActiveEmployeeAccessContext`
- `listActiveStoresByIds`
- `createPilotUserBinding`

Reason:

- pilot binding is not only a user-account write. It also validates active
  employee/store context, company scope, role scope, and creates role/action
  assignments.

## Invariant Status

Proven:

- provider subject is unique per auth provider when provider subject is present.
- user accounts can be active or inactive.
- deactivation closes role assignments, action-store assignments, and mobile
  sessions through `AccessLifecycleService`.

Not proven:

- one active user account per employee.
- one user account per employee across active and inactive rows.
- reactivation conflict behavior when another active user account already
  exists for the same employee.

Therefore:

- do not add or imply an employee-account uniqueness rule in a structural
  refactor PR.
- do not add a DB migration in the same line.
- if the product wants one active account per employee later, handle it as a
  separate product/security decision with schema, data repair, and negative
  tests.

## Verification Ladder For The Next Code Slice

For a read-only extraction of `listUserAccounts` and `getUserAccountById`:

```powershell
npm.cmd --prefix backend/nestjs test -- auth-user-accounts.e2e-spec.ts --runInBand
npm.cmd --prefix backend/nestjs test -- auth-pilot-user-bindings.e2e-spec.ts --runInBand
npm.cmd --prefix backend/nestjs run build
npm.cmd --prefix backend/nestjs run lint
```

Add the full backend suite if the diff touches module exports, shared auth
types, or access lifecycle wiring:

```powershell
npm.cmd --prefix backend/nestjs test -- --runInBand
```

For any later write extraction:

```powershell
npm.cmd --prefix backend/nestjs test -- auth-user-accounts.e2e-spec.ts auth-pilot-user-bindings.e2e-spec.ts auth-role-assignments.e2e-spec.ts auth-action-store-assignments.e2e-spec.ts --runInBand
npm.cmd --prefix backend/nestjs test -- auth-authorization.repository.spec.ts auth-context.service.spec.ts auth-role-scope-policy.service.spec.ts --runInBand
npm.cmd --prefix backend/nestjs test -- --runInBand
npm.cmd --prefix backend/nestjs run build
npm.cmd --prefix backend/nestjs run lint
```

## Stop Rules

Stop and split or park if:

- the diff changes any API response shape,
- `SUPER_ADMIN` or `HR_ADMIN` access behavior changes,
- provider-subject conflict behavior changes,
- active/inactive user account behavior changes,
- deactivation/reactivation audit event names or metadata shape change,
- role assignment or action-store assignment creation moves with user reads,
- a DB migration or uniqueness constraint becomes necessary,
- tests need broad rewrites to pass,
- the PR cannot be explained as "move user account list/detail reads only."

## Recommended Next Step

Next code PR, if auth admin remains the active roadmap line:

- create `AuthAdminUserAccountReadRepository`,
- move only `listUserAccounts` and `getUserAccountById`,
- inject it in `AuthAdminService`,
- update `AuthModule` providers,
- keep create/reactivate/pilot binding in `AuthAdminRepository`.

If that slice feels too small to justify PR overhead, it can batch with no-code
handoff updates for the same auth user-account boundary, but it must not batch
with role assignments, action-store assignments, permission writes, frontend
UI, DB, or API contract work.

If there is no active auth risk to reduce next, shift to the roadmap's next
candidate: stage builder/frontend competition decomposition or competition
repository inventory.
