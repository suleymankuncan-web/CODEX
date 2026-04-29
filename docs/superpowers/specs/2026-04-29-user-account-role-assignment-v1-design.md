# User Account / Role Assignment V1 Design

Date: 29 April 2026

Status: `approved_for_planning`

## Goal

Define the first controlled path from live `ops.employee` records to real application login accounts, roles, and store scope.

This design sits after Master Data Bootstrap Personnel Promotion V1. Personnel can now be promoted into live employee and assignment records. The next risk is not creating more personnel data; the next risk is giving the right people login access without opening broad or confusing authorization.

V1 must support a small pilot:

- one region manager
- two store managers
- one visual merchandiser
- existing HR admin / super admin operator

## Current State

Existing foundations:

- `ops.employee` holds live employee identity.
- `ops.employee_assignment_history` holds active employee-to-store assignment.
- `ops.user_account` already has `employee_id`, `username`, `email`, `auth_provider`, `is_active`, and audit-backed activation/deactivation behavior.
- `ops.user_role_assignment` already stores scoped role assignments.
- `ops.user_action_store_assignment` already stores action-store grants separate from role read scope.
- Auth context resolves DB role assignments as the canonical authorization source when available.
- Mobile Auth/Session V1 keeps Keycloak/IdP as the token authority and DB assignments as the application permission authority.
- Master Data Bootstrap Admin Review Surface V1 lets HR/Admin review promoted employee evidence before any user account creation.

Current gaps:

- `ops.user_account` does not yet store a durable Keycloak `providerSubject` / `sub` mapping.
- Current JWT resolution treats token `sub` as the app-facing `userId`; implementation must not rely on name or email matching.
- `VISUAL_MERCHANDISER` is not yet a first-class role.
- The pilot needs a safe HR-owned screen/command that creates or links a user account, assigns one role, and assigns store scope in one auditable operation.

## Locked Decisions

- V1 does not create accounts for every employee.
- V1 pilot users are:
  - `1 REGION_MANAGER`
  - `2 STORE_MANAGER`
  - `1 VISUAL_MERCHANDISER`
  - existing `HR_ADMIN` / `SUPER_ADMIN`
- `STORE_PERSONNEL` login creation stays out of V1.
- Keycloak stays the identity provider.
- Keycloak user creation stays manual in V1.
- HR/Admin receives already-created Keycloak users and links them to live employees.
- Every pilot login account must be linked to a real `employeeId`.
- Name/surname is display evidence only; it is not a matching key.
- Main identity link is `employeeId + authProvider + providerSubject`.
- Email and username are stored for review/display, not for canonical login matching.
- HR_ADMIN can create/activate/link pilot accounts directly; no second approval is required in V1.
- Each V1 user has one primary app role.
- Multi-role users stay out of V1.
- `VISUAL_MERCHANDISER` is the role code for VM users.
- A VM user must not receive region-manager, target approval, personnel management, or BM checklist authority by accident.
- Deactivation is two-layer:
  - deactivate app user / role / scope in our backend
  - manually disable the Keycloak user

## Pilot Role And Scope Matrix

| Persona | Role code | Employee binding | Read scope | Action scope | V1 notes |
| --- | --- | --- | --- | --- | --- |
| HR admin | `HR_ADMIN` | existing user | company | company/admin surfaces | creates pilot bindings |
| Region manager | `REGION_MANAGER` | required | pilot region or assigned pilot stores | two pilot stores | supervises pilot store-manager flows |
| Store manager A | `STORE_MANAGER` | required | own store | own store | real store-manager experience |
| Store manager B | `STORE_MANAGER` | required | own store | own store | real store-manager experience |
| Visual merchandiser | `VISUAL_MERCHANDISER` | required | two pilot stores | two pilot stores | VM checklist only |

Important scope note:

Current role scope validation is strict: a role's `role_scope_type` must match the assignment scope. `STORE_MANAGER` naturally fits store scope. `VISUAL_MERCHANDISER` should be store-scoped so the pilot can grant exactly two store assignments.

`REGION_MANAGER` is currently region-scoped. If the pilot requires exact two-store read visibility, implementation must verify how the existing read/action separation behaves before coding. The preferred V1 behavior is:

- role identity remains `REGION_MANAGER`
- operational action is limited to the two pilot stores
- read surfaces used by the pilot must not silently show unrelated stores

If exact read narrowing cannot be achieved with existing structures, implementation must stop and choose one explicit option before code:

1. use a pilot region that contains only the two pilot stores
2. add a dedicated store-set read-scope mechanism
3. accept region-wide read with two-store action scope and label it clearly as a pilot limitation

The recommended path is option 1 for the first pilot if the organization can define a clean pilot region/scope. Option 2 is more durable but should be planned carefully because it expands the auth model.

## Identity Binding

V1 identity binding should use a durable provider subject.

Example:

```text
employeeId = 4c5c3b17-2cc2-4d99-9f5e-c3ef07f95c01
authProvider = keycloak
providerSubject = 2f7b9d1e-8a41-4c7e-9d63-0d6b3c9a5f22
username = ayse.demir
email = ayse.demir@example.com
```

User-facing login remains normal:

```text
username/email + password
```

`providerSubject` is never shown as a login credential. It is the backend's stable identity link to Keycloak token `sub`.

Recommended data contract:

```text
userId
employeeId
authProvider
providerSubject
username
email
isActive
createdByUserId
createdAt
updatedAt
deactivatedAt
```

Recommended constraint:

```text
unique(authProvider, providerSubject) where providerSubject is not null
```

Recommended implementation direction:

- Do not force Keycloak `sub` to equal internal `user_id`.
- Add a provider-subject lookup to resolve token `sub` into internal `ops.user_account.user_id`.
- Keep `employeeId` as the person link.

## HR_ADMIN Workflow

HR_ADMIN creates or links a pilot user from an admin auth surface.

Recommended V1 flow:

1. HR_ADMIN selects a live employee.
2. System shows employee evidence:
   - name
   - seller/employee code
   - position
   - active store assignment
   - store code/name
3. System recommends role and scope from position/assignment:
   - store manager position -> `STORE_MANAGER` and own active store
   - region manager position -> `REGION_MANAGER` and approved pilot stores/region
   - visual merchandiser position -> `VISUAL_MERCHANDISER` and approved pilot stores
4. HR_ADMIN enters Keycloak identity evidence:
   - `providerSubject`
   - username
   - email
5. HR_ADMIN reviews and confirms.
6. Backend writes:
   - user account link
   - one active role assignment
   - required action-store assignments
   - audit events

The system may recommend role/scope, but HR_ADMIN makes the final activation decision.

## Role Rules

V1 allowed pilot roles:

```text
REGION_MANAGER
STORE_MANAGER
VISUAL_MERCHANDISER
HR_ADMIN
SUPER_ADMIN
```

V1 should reject:

- multiple primary app roles for the same new pilot user
- `STORE_PERSONNEL` account creation
- user account creation without `employeeId`
- user account creation without `providerSubject`
- role assignment when the employee has no active assignment needed for the requested scope
- VM user receiving broad region-manager-like permissions

## Visual Merchandiser Boundary

`VISUAL_MERCHANDISER` exists because VM users are not region managers.

V1 role intent:

- can see assigned pilot stores needed for VM work
- can perform VM checklist workflow when VM checklist implementation is opened
- cannot approve targets
- cannot manage personnel
- cannot perform BM checklist as a region manager
- cannot see unrelated stores

If the existing checklist permission is too broad, implementation must add or plan a VM-specific permission/checklist-type guard before enabling VM checklist actions.

## Deactivation And Transfer

V1 deactivation:

- set app user inactive or end active role/scope assignments
- manually disable the Keycloak user
- write audit evidence

Store transfer:

- role/scope should not silently follow a new assignment without HR_ADMIN review
- the system should show the old scope as stale or requiring review
- HR_ADMIN updates scope explicitly

Offboarding:

- app account should be deactivated
- active role and action-store assignments should end
- Keycloak user should be manually disabled

## Audit Requirements

V1 should emit cataloged audit events for:

```text
user_account.linked_to_employee
user_account.activated
user_account.deactivated
user_role_assignment.created
user_role_assignment.deactivated
user_action_store_assignment.created
user_action_store_assignment.deactivated
```

Existing event names may be reused where already implemented, but provider subject and employee binding changes must be traceable.

Audit metadata must not include passwords, raw tokens, authorization codes, or refresh tokens.

## Error And Guard Behavior

Expected failures:

- unknown employee -> `404`
- inactive employee -> `409` or semantic validation error
- employee has no active assignment for requested role/scope -> semantic validation error
- duplicate `authProvider + providerSubject` -> `409`
- duplicate active role/scope -> `409`
- duplicate active action-store assignment -> `409`
- unauthorized role trying to create accounts -> `403`
- missing provider subject -> validation error

All errors must use the standard Security Gate V1-A response shape.

## Frontend Surface

Recommended V1 UI:

- admin shell only
- route can live under existing auth/admin area or a dedicated pilot user binding section
- HR_ADMIN and SUPER_ADMIN visible
- should show employee evidence before activation
- should show recommended role/scope but require explicit confirm
- should show created user account, role assignment, and action-store assignment evidence

No store-user surface is required for account creation.

## Out Of Scope

V1 does not include:

- automatic Keycloak user creation
- Keycloak admin API integration
- bulk account creation
- accounts for all employees
- `STORE_PERSONNEL` login rollout
- multi-role users
- self-service account request
- password management UI
- MFA policy
- backend-owned refresh token broker
- full mobile rollout
- VM checklist implementation itself
- broad auth redesign

## Acceptance Criteria

- Given a live store manager employee with an active store assignment, when HR_ADMIN links a Keycloak subject and confirms `STORE_MANAGER`, then the app creates one active user account linked to that `employeeId`, one store-scoped role assignment, and action scope for that store.
- Given a region manager pilot employee, when HR_ADMIN assigns `REGION_MANAGER`, then the user can operate only on the approved pilot stores according to the chosen pilot scope strategy.
- Given a visual merchandiser employee, when HR_ADMIN assigns `VISUAL_MERCHANDISER`, then the user receives VM role and only approved pilot stores.
- Given a duplicate provider subject, when HR_ADMIN submits the binding, then the backend rejects the request without creating a second user.
- Given a user is deactivated, when they authenticate later, then DB authorization returns no active role/scope and protected app behavior fails closed.
- Given an employee changes store, when existing user scope is stale, then the system must not silently move access without HR_ADMIN review.
- Given the user is a store manager, when they open store-facing pages, then they see only their own store.
- Given a VM user, when they attempt region-manager-only actions, then the backend returns `403`.

## Test Plan

Backend:

- schema contract for provider subject mapping
- role catalog contract including `VISUAL_MERCHANDISER`
- service tests for create/link pilot account
- duplicate provider subject conflict test
- employee-required validation test
- store-manager own-store scope test
- VM role permission/scope guard test
- deactivate user account test
- auth resolution test mapping token `sub` to internal user account

Frontend:

- admin pilot account creation/readiness surface e2e
- recommended role/scope display test
- duplicate/error state rendering test

Release:

```powershell
npm.cmd run check:release
```

## CODEX Honest View

This is the right next slice because it closes the gap between master data and real controlled usage. It is not a shiny feature, but it is the gate that prevents the product from turning into a pile of users with unclear authority.

The most important warning is the `REGION_MANAGER` two-store pilot scope. The current auth model separates role read scope from action-store scope. Before implementing, we must verify whether exact two-store read visibility is already achievable. If not, we should not pretend it is solved. We either use a pilot region containing only those stores or deliberately add a store-set read-scope mechanism.

Keycloak is enough for V1. Replacing it now would be a distraction. The durable work is linking Keycloak identity to `employeeId`, role, and store scope cleanly inside our backend.

Recommendation: continue to implementation planning, but keep V1 narrow: HR_ADMIN links four pilot accounts, no bulk rollout, no Keycloak automation, no store personnel accounts.
