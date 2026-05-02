# Auth Admin Searchable Lookups V1 Design

## Purpose

Prepare auth-admin user and store selection for broader rollout without opening a broad auth-admin refactor.

This is a design document only. It does not implement endpoints, repository changes, frontend changes, migrations, or tests.

## Current Situation

`GET /api/auth/lookups` currently returns one bundled lookup payload:

- active users from `ops.user_account`, ordered by username, limited to 50,
- roles,
- permissions,
- active stores from `ops.store`, ordered by store code, limited to 200.

This is fine for pilot setup. It becomes weak when the system moves toward hundreds of users and stores because admin screens can silently miss the target user or store if the row is outside the fixed dropdown window.

The recent role-assignment active uniqueness work closed the database duplicate-risk slice. The remaining broad rollout auth-admin risk is lookup scale and operator searchability.

## V1 Product Boundary

V1 adds searchable lookup support only for:

- auth users,
- active stores.

V1 does not change:

- role list behavior,
- permission list behavior,
- role assignment rules,
- action-store assignment rules,
- pilot user binding transaction behavior,
- Keycloak/OIDC behavior,
- runtime authorization lookup,
- mobile auth/session behavior,
- auth-admin repository boundaries.

## CODEX DURUST YORUM

This is the right next auth-admin hardening if broad rollout approaches.

It is not glamorous, but it prevents a real operator problem: "I know this user/store exists, but the dropdown does not show it." The safe V1 is not a new admin module and not a repository split. It is a small search surface beside the existing bundled lookup endpoint.

The main risk is overbuilding search before real rollout pressure. So V1 should be backend-first, capped, audited through existing auth protection, and only then lightly connected to the existing admin surface.

## Recommended Approach

Use dedicated searchable endpoints and keep `GET /api/auth/lookups` unchanged.

Recommended endpoints:

- `GET /api/auth/lookups/users/search?q=<text>&limit=20`
- `GET /api/auth/lookups/stores/search?q=<text>&limit=20`

Why this approach:

- Existing screens using `/api/auth/lookups` keep working.
- Search behavior can be tested independently.
- It avoids making the bundled lookup endpoint slower or more complex.
- It does not force a broad frontend redesign.
- It is easy to add debounce/typeahead later.

Rejected alternatives:

- Expand the bundled endpoint limit to 1000: quick but wasteful, still weak for future growth, and increases payload size.
- Replace `/api/auth/lookups` entirely: too much blast radius for a scale hardening slice.
- Add a generic search endpoint for every auth catalog: unnecessary because roles and permissions are still small catalog data.

## Backend Contract

### User Search

Endpoint:

```http
GET /api/auth/lookups/users/search?q=<text>&limit=20
```

Authorization:

- same auth-admin protection as current auth lookup surfaces,
- default `SUPER_ADMIN` boundary should remain,
- do not broaden HR access in this slice unless a current endpoint already allows it.

Query behavior:

- trim `q`,
- require at least 2 non-space characters,
- default limit: 20,
- max limit: 50,
- only active users: `is_active = TRUE`,
- search case-insensitively across:
  - `username`,
  - `email`,
  - `provider_subject`.

Return shape:

```json
{
  "items": [
    {
      "userId": "uuid",
      "username": "string",
      "email": "string",
      "authProvider": "oidc",
      "providerSubject": "string veya null"
    }
  ],
  "meta": {
    "query": "string",
    "count": 1,
    "limit": 20
  }
}
```

Empty or too-short query:

- return `400` validation response,
- do not return the first 20 users as a fallback.

### Store Search

Endpoint:

```http
GET /api/auth/lookups/stores/search?q=<text>&limit=20
```

Authorization:

- same auth-admin protection as current auth lookup surfaces.

Query behavior:

- trim `q`,
- require at least 2 non-space characters,
- default limit: 20,
- max limit: 50,
- only active stores: `s.status = 'active'`,
- search case-insensitively across:
  - `store_code`,
  - `store_name`,
  - `region_name`.

Return shape:

```json
{
  "items": [
    {
      "storeId": "uuid",
      "storeCode": "SM140",
      "storeName": "string",
      "companyId": "uuid",
      "regionId": "uuid",
      "regionName": "string"
    }
  ],
  "meta": {
    "query": "string",
    "count": 1,
    "limit": 20
  }
}
```

## Query And Index Policy

V1 should use simple `ILIKE` search with capped results.

Do not add speculative indexes in V1 unless a local explain/volume proof shows a real need. The target is 900-1000 users, which is safe for capped admin searches in the current phase.

If real pilot data later shows slow search:

- review `LOWER(username)`, `LOWER(email)`, `LOWER(provider_subject)` expression indexes,
- review `LOWER(store_code)`, `LOWER(store_name)`, `LOWER(region_name)` search needs,
- consider trigram indexes only after measured evidence.

## Frontend Boundary

V1 frontend should be minimal:

- keep the current auth admin page structure,
- replace fixed dropdown-only selection only where pilot user binding or role/action assignment forms need user/store selection,
- use a text search input with explicit "no results" and loading states,
- avoid creating a new Auth Admin redesign.

If frontend changes are deferred, backend endpoints can still ship first and be used later.

## Error Handling

Use the existing global error response format.

Validation failures:

- query missing or shorter than 2 characters,
- limit above max,
- invalid limit value.

Security:

- do not leak inactive users,
- do not return password hash or unrelated user account fields,
- do not return stores with inactive status,
- keep existing auth-admin role protection.

## Testing Strategy

Backend targeted tests:

- user search returns active users matching username,
- user search returns active users matching email,
- user search can match provider subject,
- user search excludes inactive users,
- user search rejects too-short query,
- user search rejects invalid or above-max limit,
- store search returns active stores matching code,
- store search returns active stores matching name,
- store search returns active stores matching region name,
- store search excludes inactive stores,
- store search rejects too-short query.

Existing regression:

- `auth-lookups.e2e-spec.ts` must still prove bundled `/api/auth/lookups` works.
- `auth-role-assignments.e2e-spec.ts` should remain unchanged unless frontend wiring requires it.

Full verification:

- backend targeted auth lookup tests,
- backend build,
- root script guards,
- root `check:release`,
- `git diff --check`.

## Implementation Scope For Next Plan

Create or modify only:

- backend DTOs for search query validation,
- `AuthAdminController` searchable lookup routes,
- `AuthAdminService` search methods,
- `AuthAdminRepository` search methods,
- `auth-lookups.e2e-spec.ts` targeted coverage,
- optional frontend auth-admin search wiring if included in the implementation plan,
- handoff docs.

Do not modify:

- database schema or migrations,
- runtime auth context,
- mobile auth/session,
- role assignment uniqueness,
- role permission governance,
- Keycloak realm config,
- master-data/bootstrap flows.

## Locked V1 Decisions

1. Should invalid `limit > 50` be rejected with validation error, or clamped to 50?

V1 answer: reject invalid limits. It keeps API behavior explicit.

2. Should `providerSubject` be returned to the frontend?

V1 answer: yes, for HR/Admin matching evidence, but never as a login credential. It helps distinguish users during pilot setup.

3. Should frontend wiring be included in the first implementation?

V1 answer: backend first. Minimal frontend wiring should be a separate optional slice after backend endpoints pass targeted tests.

## Acceptance Criteria

- Existing `/api/auth/lookups` behavior remains compatible.
- New user search endpoint returns only active users and supports username/email/provider-subject matching.
- New store search endpoint returns only active stores and supports store-code/store-name/region-name matching.
- Search queries require at least 2 characters.
- Search results are capped.
- No broad auth-admin repository split is introduced.
- No schema/index migration is introduced without measured evidence.
- Release gates pass.
