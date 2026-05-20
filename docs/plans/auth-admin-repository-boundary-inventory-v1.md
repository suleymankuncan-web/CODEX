# Auth Admin Repository Boundary Inventory V1

## Purpose

Prepare the auth admin repository for controlled refactor without changing
authorization behavior.

This is a docs-only inventory. It does not approve a broad auth rewrite or a
multi-family code split. Auth admin remains security-sensitive; code movement
must start with the smallest read-only boundary and must keep controller role
guards, service policy checks, audit writes, and API response shapes unchanged.

## Current Shape

Source file:

- `backend/nestjs/src/modules/auth/auth-admin.repository.ts`

Current size on `origin/main` after PR #350:

- roughly 1845 physical lines,
- roughly 1715 non-empty lines,
- 34 repository methods.

Primary caller:

- `backend/nestjs/src/modules/auth/auth-admin.service.ts`

Controller boundary:

- `AuthAdminController` is guarded by `@RequireRoles("SUPER_ADMIN")`.
- `POST /auth/pilot-user-bindings` additionally allows `HR_ADMIN` and requires
  company scope.
- Runtime authorization remains separate in `AuthAuthorizationRepository`.

## Method Families

### Lookup And Catalog Reads

These are read-only helpers used by admin commands and lookup screens:

- `getRoleByCode`
- `getRoleById`
- `getCompanyLookupById`
- `getRegionLookupById`
- `getStoreLookupById`
- `listRoles`
- `listPermissions`
- `listActiveUserLookups`
- `searchActiveUserLookups`
- `listActiveStoreLookups`
- `searchActiveStoreLookups`
- `getPermissionByCode`
- `getRolePermission`

Risk:

- Low-to-medium. These reads influence write validation, so a split still needs
  auth-admin and permission regression tests.

Suggested boundary:

- `AuthAdminLookupRepository`

### Role Assignment Persistence

Methods:

- `countActiveAssignments`
- `createRoleAssignment`
- `listRoleAssignments`
- `getRoleAssignmentById`
- `deactivateRoleAssignment`
- `getRoleAssignmentAudit`

Risk:

- High for writes, medium for audit reads.
- Role/scope semantics are enforced partly in `AuthRoleScopePolicyService` and
  partly by repository queries/audit writes.

Split guidance:

- Move audit reads only after lookup/catalog boundary is stable.
- Do not move create/deactivate until negative permission and scope tests are
  explicitly selected.
- Do not add DB uniqueness migration in the same PR.

### Action Store Assignment Persistence

Methods:

- `countActiveActionStoreAssignments`
- `createActionStoreAssignment`
- `listActionStoreAssignments`
- `getActionStoreAssignmentById`
- `deactivateActionStoreAssignment`
- `getActionStoreAssignmentAudit`

Risk:

- High for writes because this affects assigned-store action authority.
- Existing active uniqueness protection is stronger than role assignment, so do
  not weaken it during refactor.

Split guidance:

- Keep action-store assignment writes together when they move.
- Include negative assigned-store/action-scope tests before moving writes.

### User Account And Pilot Binding

Methods:

- `getUserAccountByProviderSubject`
- `getActiveEmployeeAccessContext`
- `listActiveStoresByIds`
- `createUserAccount`
- `createPilotUserBinding`
- `listUserAccounts`
- `getUserAccountById`
- `reactivateUserAccount`
- `getUserAccountAudit`

Risk:

- High for create/reactivate/pilot binding.
- Medium for account list/audit reads.

Split guidance:

- Do not combine pilot binding with role assignment or action-store write
  splits.
- Keep provider-subject and active employee access checks close to pilot
  binding until a dedicated user account boundary is proven.

### Role Permission Mutation

Methods:

- `grantRolePermission`
- `revokeRolePermission`

Risk:

- High. This changes the permission graph available to roles.

Split guidance:

- Do not move permission writes before lookup/catalog and audit reads are
  stable.
- Do not change approval/governance behavior in a structural PR.

## Test Map

Backend integration tests:

- `auth-user-accounts.e2e-spec.ts` - 7 tests
- `auth-role-assignments.e2e-spec.ts` - 11 tests
- `auth-action-store-assignments.e2e-spec.ts` - 4 tests
- `auth-role-permissions.e2e-spec.ts` - 6 tests
- `auth-pilot-user-bindings.e2e-spec.ts` - 3 tests
- `auth-lookups.e2e-spec.ts` - 7 tests
- `auth-scope.e2e-spec.ts` - 12 tests
- `auth-action-scope.e2e-spec.ts` - 6 tests

Backend unit/schema tests:

- `auth-authorization.repository.spec.ts`
- `auth-role-scope-policy.service.spec.ts`
- `auth-context.service.spec.ts`
- `scope.guard.spec.ts`
- `mobile-session.guard.spec.ts`
- `jwt-auth.provider.spec.ts`
- `role-catalog-contract.spec.ts`
- `user-account-provider-subject-schema-contract.spec.ts`
- `user-role-assignment-active-uniqueness-schema-contract.spec.ts`

Frontend smoke:

- `admin-web/e2e/auth-admin-surfaces.spec.ts`

## Recommended Implementation Order

1. `AuthAdminLookupRepository`
   - Move lookup/catalog read methods only.
   - Keep response mapping in `AuthAdminService`.
   - Required gates:
     - `npm.cmd --prefix backend/nestjs test -- auth-lookups.e2e-spec.ts auth-role-permissions.e2e-spec.ts auth-role-assignments.e2e-spec.ts --runInBand`
     - `npm.cmd --prefix backend/nestjs run build`
     - `npm.cmd --prefix backend/nestjs run lint`
     - `npm.cmd --prefix backend/nestjs test -- --runInBand`
2. Audit read boundary
   - Move `getRoleAssignmentAudit`, `getActionStoreAssignmentAudit`, and
     `getUserAccountAudit` together only if the lookup split is stable.
   - Required gates:
     - role assignment, action-store assignment, and user account e2e specs.
3. User account read/write boundary
   - Only after deciding whether one active account per employee is a product
     invariant.
4. Role assignment write boundary
   - Only after DB-level active uniqueness is designed or explicitly parked.
5. Action-store assignment write boundary
   - Only with assigned-store negative tests.
6. Pilot binding boundary
   - Only if pilot binding grows beyond a small setup workflow.
7. Role permission write boundary
   - Last among auth admin splits unless permission governance becomes the
     active product/risk work.

## Stop Rules

Stop or split the plan if:

- any low-role user could gain visibility or write authority,
- `SUPER_ADMIN` or `HR_ADMIN` controller access changes,
- company/region/store scope validation changes,
- action-store assignment semantics change,
- audit event names or metadata shape change,
- API response shape changes,
- a DB migration appears necessary,
- the PR includes both auth code movement and unrelated frontend/product work,
- negative auth tests are missing for the moved behavior.

## Sokrates Decision

Decision: proceed next with a lookup/catalog read-only split only.

Why:

- It removes a meaningful chunk from the 1845-line auth admin repository.
- It has the smallest auth blast radius among the candidate splits.
- It is reversible by a normal squash revert.
- Existing auth lookup, role assignment, and role permission tests can verify
  the behavior surface without changing permissions.

Do not start with user writes, role assignment writes, action-store writes,
pilot binding, role permission writes, or DB migrations.
