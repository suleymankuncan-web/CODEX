# AuthAdminRepository Risk Review - 30 April 2026

## Purpose

Review `backend/nestjs/src/modules/auth/auth-admin.repository.ts` before opening another auth-admin refactor.

This review also closes one small pagination count defect found during the scan.

## Current Shape

`AuthAdminRepository` is large: 1769 physical lines and 1647 non-empty lines.

It currently owns several sensitive admin persistence families:

- role lookup by code/id
- user account lookup/create/list/deactivate/reactivate/audit
- provider subject lookup for OIDC-backed user binding
- active employee access context lookup for pilot binding
- role assignment create/list/deactivate/audit
- action-store assignment create/list/deactivate/audit
- pilot user binding transaction
- role catalog, permission catalog, and auth lookup surfaces
- role permission grant/revoke/audit writes

This is an admin auth boundary, not a generic repository. A broad split has a higher security blast radius than a normal data repository split.

## Caller Surfaces

Primary callers:

- `AuthAdminService`
  - validates role/scope policy before role assignment writes
  - creates user accounts
  - creates pilot user bindings
  - exposes auth lookups
  - manages role permissions
- `AuthAdminController`
  - protected by `SUPER_ADMIN` by default
  - `POST /auth/pilot-user-bindings` also allows `HR_ADMIN`
- Runtime auth is separate:
  - `AuthAuthorizationRepository` is used by `AuthContextService`
  - this keeps admin writes separate from request-time auth context resolution

## Immediate Fix Closed

### Auth User Account Pagination Count Fix V1

Finding:

- `listUserAccounts` passed `LIMIT/OFFSET` parameters into the count query.
- With non-zero offset, the count aggregate row can be skipped or the count path can become coupled to page parameters.

Fix:

- Count query now receives only filter parameters.
- Data query still receives filter parameters plus `limit` and `offset`.
- Added regression coverage for second-page user account listing.

Verification:

- `backend/nestjs`: `npm.cmd test -- --runInBand test/integration/auth-user-accounts.e2e-spec.ts` passed, 7/7.

## Green Signals

- Admin controller is role-protected, with `SUPER_ADMIN` as default boundary.
- Pilot user binding is intentionally narrower: `SUPER_ADMIN` and `HR_ADMIN`.
- Role/scope validation lives in `AuthRoleScopePolicyService`, not ad hoc controller code.
- Role assignment creation checks duplicate active assignment before insert.
- Action-store assignment has both a service pre-check and a DB unique active index.
- User account provider subject mapping has a unique partial index on `(auth_provider, provider_subject)`.
- Mutating auth-admin operations write audit events inside transactions.
- Action scope remains separate from read scope.
- Runtime authorization reads are kept in `AuthAuthorizationRepository`, so request-time auth does not depend on admin repository writes.
- Auth e2e coverage is already split into focused files instead of one oversized test.

## Test Evidence

Backend integration coverage:

- `backend/nestjs/test/integration/auth-user-accounts.e2e-spec.ts` - 7 tests after this fix
- `backend/nestjs/test/integration/auth-role-assignments.e2e-spec.ts` - 9 tests
- `backend/nestjs/test/integration/auth-action-store-assignments.e2e-spec.ts` - 4 tests
- `backend/nestjs/test/integration/auth-role-permissions.e2e-spec.ts` - 6 tests
- `backend/nestjs/test/integration/auth-pilot-user-bindings.e2e-spec.ts` - 2 tests
- `backend/nestjs/test/integration/auth-lookups.e2e-spec.ts` - 1 test
- `backend/nestjs/test/integration/auth-scope.e2e-spec.ts` - 12 tests
- `backend/nestjs/test/integration/auth-action-scope.e2e-spec.ts` - 6 tests

Schema/contract coverage:

- `backend/nestjs/src/modules/auth/user-account-provider-subject-schema-contract.spec.ts`
- `backend/nestjs/src/modules/auth/role-catalog-contract.spec.ts`
- `backend/nestjs/src/modules/auth/auth-role-scope-policy.service.spec.ts`

Frontend smoke:

- `admin-web/e2e/auth-admin-surfaces.spec.ts`
  - HR admin pilot user binding surface submits the expected payload.

## Risk Assessment

### P1 - Ownership Density

The repository combines user accounts, role assignments, action-store assignments, pilot binding, permission grants, lookup catalogs, and audit writes.

Risk:

- Future auth-admin changes can become hard to review if they cross multiple concerns in one file.
- A broad split can accidentally weaken audit, transaction, or scope validation behavior.

Decision:

- Do not split all auth-admin persistence in one pass.
- Split only when a concrete auth-admin change touches a clean family of operations.

### P1 - Role Assignment DB-Level Active Uniqueness

`createRoleAssignment` checks duplicate active assignments in service code before insert, but `ops.user_role_assignment` currently has a non-unique `idx_user_role_scope` index.

Contrast:

- `ops.user_action_store_assignment` already has `uq_user_action_store_assignment_active`.

Risk:

- Two concurrent admin requests could theoretically create duplicate active role assignments for the same user/role/scope.
- The current pilot/admin UI likely has low concurrency, but production hardening should not rely only on application pre-checks.

Decision:

- Do not add a migration blindly during this review.
- Promote to a dedicated migration/design slice before multi-admin or bulk user provisioning.
- The design must handle nullable `company_id`, `region_id`, and `store_id` safely.

### P1 - User Account Identity Policy

Provider subject uniqueness is protected by DB index.

Still open:

- `employee_id` is not unique in `ops.user_account`.
- `createUserAccount` and `createPilotUserBinding` do not explicitly enforce one active account per employee.

Risk:

- If the product rule is "one active internal account per employee", the DB and service do not fully enforce that yet.
- If future local plus OIDC accounts are allowed for the same employee, this may be intentional.

Decision:

- Treat this as a product/security policy decision, not an immediate schema patch.
- Before broader pilot rollout, decide whether one active account per employee is mandatory.

### P1 - Admin Lookup Scaling

`listActiveUserLookups` caps users at 50 and `listActiveStoreLookups` caps stores at 200.

Risk:

- This is fine for pilot setup, but not enough for 900-1000 users if the admin UI relies on dropdown-only lookup.

Decision:

- Do not expand now.
- Future admin UX should use searchable lookup endpoints before broad rollout.

### P2 - Audit Pagination Totals

Audit list methods return `total: rows.length` from the service layer.

Risk:

- For small audit lists this is acceptable.
- For paginated audit history, the API does not expose full database total.

Decision:

- Leave as is until admin audit UI needs true paginated totals.
- If changed later, apply consistently across role assignment, action-store assignment, and user account audit reads.

### P2 - Role Permission Mutation Boundary

`grantRolePermission` and `revokeRolePermission` directly mutate `ops.role_permission`.

Current guard:

- Controller requires `SUPER_ADMIN`.
- DB primary key prevents duplicate role/permission pairs.
- Audit events are written.

Risk:

- If more admins are added later, permission changes may need stronger approval/change-management.

Decision:

- No workflow now.
- Revisit only before multiple admins can freely edit role permissions.

### P2 - Provider Subject Lookup Duplication

Both `AuthAdminRepository` and `AuthAuthorizationRepository` have provider subject lookup methods.

Risk:

- Low current risk because one is admin/write support and the other is runtime auth resolution.

Decision:

- Keep separate for now.
- Only merge into a shared identity read model if more provider-subject behavior appears.

## Split Candidates

Recommended future split order, only when a matching change appears:

1. `AuthUserAccountRepository`
   - user account create/list/deactivate/reactivate/audit
   - provider subject lookup
2. `RoleAssignmentRepository`
   - role lookup
   - role assignment create/list/deactivate/audit
   - DB active uniqueness migration plan
3. `ActionStoreAssignmentRepository`
   - action-store assignment create/list/deactivate/audit
4. `PilotUserBindingRepository`
   - only if pilot binding grows beyond a small setup workflow
5. `RolePermissionRepository`
   - only if role permission governance expands

## What Not To Do Now

- Do not split auth-admin into five repositories without a matching feature.
- Do not add a role-assignment uniqueness migration without a nullable-scope design.
- Do not introduce a new approval workflow for role permissions yet.
- Do not replace Keycloak/OIDC or runtime auth context behavior.
- Do not broaden `HR_ADMIN` auth-admin access beyond the pilot binding endpoint.

## Trigger To Promote This To Implementation

Promote follow-up implementation only if at least one of these happens:

- pilot user provisioning moves from 1 region manager / 2 store managers / 1 visual merchandiser to broader rollout
- multi-admin auth management starts
- bulk user provisioning is introduced
- duplicate role assignment evidence appears
- auth-admin UI needs searchable user/store lookup at real scale
- role permission changes become an operational workflow

## Recommended Next Move

The immediate pagination count bug is closed.

The next hardening candidate is not a broad repository split. It is a small design plan for role assignment active uniqueness:

- define the exact uniqueness rule
- handle nullable company/region/store scope ids
- decide whether future-dated role assignments are allowed to overlap
- then add a guarded migration and tests if approved

## CODEX DURUST YORUM

Auth admin is one of the few places where "clean refactor" can quietly turn into "auth regression". So the right move is not to slice it for aesthetics.

The good news: the runtime auth path is separate, the admin endpoints are role-protected, action-scope is separated from read-scope, and the pilot binding path is guarded.

The honest risk: role assignment uniqueness is still more application-level than database-level. That is the next thing I would harden before broad user rollout.
