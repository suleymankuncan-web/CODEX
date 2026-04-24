# Auth Admin And JWT Guide

## Purpose
- Explain how authentication and authorization behave in the backend today.
- Document how auth admin endpoints, JWT/JWKS validation, and DB-backed role resolution fit together.

## Auth Modes

### `AUTH_MODE=mock`
- Intended for local development and integration tests.
- Reads user context from request headers such as `x-user-id` and `x-role-codes`.
- Useful when testing controller, guard, and policy wiring without a real identity provider.
- Should be treated as development-only.
- In production, mock mode should stay disabled unless `ALLOW_MOCK_AUTH=true` is set intentionally for a tightly controlled environment.

### `AUTH_MODE=jwt`
- Validates bearer tokens through the JWT auth provider.
- Supports two validation strategies:
  - shared-secret verification
  - JWKS verification via `JWT_JWKS_URL`
- This should be the default expectation for production deployments.

## JWT / JWKS Contract

### Required validation rules
- `issuer` must match configured issuer
- `audience` must match configured audience
- production JWTs must contain a direct `aud` claim
- production JWTs must contain a direct non-empty `sub` claim
- invalid signature, issuer, audience, or malformed token returns `401`
- in non-production, sparse local tokens can still be tolerated for isolated development/test flows

### Identity claims
- `sub`: canonical subject identifier; required directly in production access tokens
- `employee_id`: optional employee link
- `roles`: optional provider role list
- `read_company_ids`: optional provider read-scope company list
- `read_region_ids`: optional provider read-scope region list
- `read_store_ids`: optional provider read-scope store list
- `assigned_store_ids`: optional provider action-store list
- `company_ids`, `region_ids`, `store_ids`: legacy claim names still accepted for compatibility

## Authorization Resolution Order
1. Authenticate request through mock or JWT provider.
2. Resolve active DB role assignments for the authenticated user.
3. Use DB-backed roles/scopes as canonical authorization context.
4. If no DB role assignments exist, use explicit token/header role data as the provider context.
5. Do not infer roles, scopes, employee ids, or assigned stores from local demo usernames.

If the DB authorization lookup itself fails:
- production fails closed with `503 Authorization context is unavailable`
- non-production keeps the provider context to preserve local development and isolated integration tests

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

### Session / bootstrap
- `GET /api/auth/session`
- Returns the authenticated user's resolved role and scope summary.
- `GET /api/auth/bootstrap`
- Public endpoint for frontend auth bootstrap metadata.
- Returns current `authMode` plus provider-oriented fields such as:
  - authorization URL
  - client id
  - scope
  - response type
  - token URL for authorization code + PKCE exchange
  - callback path
  - logout URL
  - post-logout redirect path

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
- `401`: invalid or missing JWT, including production tokens without required `aud` or `sub`
- `403`: authenticated but missing role or scope
- `404`: referenced role, user, permission, or assignment not found
- `409`: state conflict such as duplicate active assignment or already-granted permission
- `503`: production authorization context could not be resolved from DB-backed assignments
- `422`: semantically invalid role/scope policy input

## Security Expectations
- Do not rely on implicit defaults for production auth configuration.
- Prefer `AUTH_MODE=jwt` with explicit `JWT_ISSUER`, `JWT_AUDIENCE`, and either `JWT_SECRET` or `JWT_JWKS_URL`.
- Production IdP access tokens must emit `sub` and `aud` directly; backend fallback tolerance is for non-production only.
- Prefer authorization code + PKCE for browser login; implicit access-token callback is local/manual dev-only and production frontend builds reject it.
- Keep mock auth disabled in production unless there is a deliberate break-glass reason.
- Frontend bearer tokens should be treated as transient session state rather than durable browser storage.
