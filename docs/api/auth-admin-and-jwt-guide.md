# Auth Admin And JWT Guide

## Purpose
- Explain how authentication and authorization behave in the backend today.
- Document how auth admin endpoints, JWT/JWKS validation, and DB-backed role resolution fit together.

## Auth Modes

### `AUTH_MODE=mock`
- Intended for local development and integration tests.
- Reads user context from request headers such as `x-user-id` and `x-role-codes`.
- Useful when testing controller, guard, and policy wiring without a real identity provider.

### `AUTH_MODE=jwt`
- Validates bearer tokens through the JWT auth provider.
- Supports two validation strategies:
  - shared-secret verification
  - JWKS verification via `JWT_JWKS_URL`

## JWT / JWKS Contract

### Required validation rules
- `issuer` must match configured issuer
- `audience` must match configured audience
- invalid signature, issuer, audience, or malformed token returns `401`

### Identity claims
- `sub`: canonical subject identifier
- `employee_id`: optional employee link
- `roles`: optional token-side fallback role list
- `company_ids`: optional token-side scope fallback
- `region_ids`: optional token-side scope fallback
- `store_ids`: optional token-side scope fallback

## Authorization Resolution Order
1. Authenticate request through mock or JWT provider.
2. Resolve active DB role assignments for the authenticated user.
3. Use DB-backed roles/scopes as canonical authorization context.
4. Only fall back to token/header role data when DB assignments are unavailable.

## Role Assignment Policy

### Supported scope hierarchy
- `company`: requires `companyId`
- `region`: requires `companyId` and `regionId`
- `store`: requires `companyId`, `regionId`, and `storeId`

### Rejected semantic cases
- `company` role assignment with `regionId` or `storeId`
- `region` role assignment without `companyId`
- `region` role assignment with `storeId`
- `store` role assignment without full parent hierarchy
- role assignment whose `scopeType` does not match the target role's `role_scope_type`

These return `422` because the request is structurally valid but semantically invalid for the policy model.

## Admin API Surfaces

### User management
- `POST /api/auth/users`
- `GET /api/auth/users`
- `PATCH /api/auth/users/:userId/deactivate`
- `PATCH /api/auth/users/:userId/reactivate`
- `GET /api/auth/users/:userId/audit`

### Role assignment management
- `POST /api/auth/role-assignments`
- `GET /api/auth/role-assignments`
- `PATCH /api/auth/role-assignments/:assignmentId/deactivate`
- `GET /api/auth/role-assignments/:assignmentId/audit`

### Role / permission management
- `GET /api/auth/roles`
- `GET /api/auth/permissions`
- `POST /api/auth/roles/:roleId/permissions`
- `DELETE /api/auth/roles/:roleId/permissions/:permissionCode`

### Lookups
- `GET /api/auth/lookups`
- Returns user, role, permission, scope, and provider options for admin UI forms.

## Audit Shape
Auth admin writes audit metadata in a shared shape:

```json
{
  "reason": null,
  "correlationId": null,
  "sourceContext": {
    "module": "auth-admin",
    "operation": "create-role-assignment"
  },
  "changedFields": ["roleId", "scopeType"],
  "details": {}
}
```

## Error Model
- `401`: invalid or missing JWT
- `403`: authenticated but missing role or scope
- `404`: referenced role, user, permission, or assignment not found
- `409`: state conflict such as duplicate active assignment or already-granted permission
- `422`: semantically invalid role/scope policy input
