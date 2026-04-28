# Mobile Auth/Session V1 Design

## Status

- Date: 2026-04-28
- Status: Approved analysis, design-ready
- Scope: mobile auth/session foundation only
- Out of scope: Mobile BFF, store/feed/workforce/competition feature changes, admin-web auth flow changes

## Goal

Mobile Auth/Session V1 adds a backend-controlled device session layer for the future mobile app while keeping the existing JWT/JWKS resource-server model and DB-owned authorization scope.

The goal is not to make the backend a full identity provider. The goal is to answer three questions safely:

- Is the access token valid?
- Is this mobile device session still active?
- What role/read/action scope does the user have right now according to DB assignments?

## Current State

Backend currently verifies bearer access tokens in:

- `backend/nestjs/src/modules/auth/providers/jwt-auth.provider.ts`

The provider supports:

- JWT verification through JWKS when `JWT_JWKS_URL` is configured.
- JWT verification through `JWT_SECRET` for approved non-JWKS/local cases.
- issuer and audience checks.
- filtering provider/default roles so only app role codes become app-facing `roleCodes`.
- parsing read/action scope claims as fallback provider context.

Canonical authorization is resolved in:

- `backend/nestjs/src/modules/auth/auth-context.service.ts`
- `backend/nestjs/src/modules/auth/auth-authorization.repository.ts`

Important current rule:

- Production fails closed if DB authorization lookup is unavailable.
- DB role assignments override provider role/scope when present.
- Action scope is separated through `assignedStoreIds`.

Current backend session endpoint:

- `GET /api/auth/session`

Current frontend/admin PKCE flow:

- `admin-web/src/features/auth/auth-flow.ts`
- `admin-web/src/features/session/session-storage.ts`

Admin web stores access token in browser `sessionStorage`; this design must not break that flow.

## Decisions

### 1. Refresh Token Ownership

V1 recommendation: refresh tokens stay with the IdP.

Reason:

- The backend is currently a resource server, not an auth server.
- IdP-owned refresh keeps rotation, expiration, MFA, global logout, and provider policy in one place.
- Backend-owned refresh would add auth-server responsibility and a larger security surface.

If a later phase makes the backend a refresh-token broker, then:

- refresh tokens must never be stored plaintext.
- only token hashes are stored.
- refresh token rotation must be supported.
- old token reuse must be treated as a security event.
- reuse detection should revoke all mobile sessions for the user by default.

### 2. Mobile BFF Boundary

Mobile BFF is outside V1.

Reason:

- Auth/session must be stable before screen aggregation.
- BFF endpoints such as `/api/mobile/home` and `/api/mobile/feed` should be planned after session identity and device lifecycle are proven.

### 3. Device Session Boundary

The backend owns a mobile device session record.

The mobile app authenticates with the IdP and then registers or resumes a backend device session.

Recommended request model:

- `Authorization: Bearer <access-token>`
- `X-Mobile-Session-Id: <uuid>` after session creation

Backend validates:

- access token signature/issuer/audience.
- DB user account and active assignments.
- mobile device session is active and belongs to the authenticated user.

### 4. Scope Security

Token claims are not enough.

DB assignment control remains the canonical source for:

- app roles
- read scope
- action scope
- assigned store ids

Provider claims remain fallback context for local/non-production or users without DB assignments, but production must continue fail-closed on DB authorization lookup errors.

### 5. Push Token Storage

Push tokens should be stored in a separate table linked to mobile device session.

Reason:

- push tokens can rotate independently from sessions.
- stale push tokens need cleanup.
- a session can be revoked and all attached push tokens disabled.
- future notification provider metadata should not bloat the session table.

V1 can support registration/revoke without sending real push notifications.

## Proposed V1 Flow

### Login / Session Registration

1. Mobile app starts Authorization Code + PKCE with IdP.
2. IdP returns access token and IdP-owned refresh token to the mobile app.
3. Mobile app calls `POST /api/mobile/auth/sessions` with access token and device metadata.
4. Backend resolves authenticated user through existing `AuthContextService`.
5. Backend creates or resumes an active `ops.mobile_device_session` row.
6. Backend returns `mobileDeviceSessionId`, session status, user summary, scope summary, and expiration metadata.

### Authenticated Mobile Request

1. Mobile app sends `Authorization: Bearer <access-token>`.
2. Mobile app sends `X-Mobile-Session-Id`.
3. Backend verifies token through existing JWT/JWKS flow.
4. Backend verifies active device session.
5. Backend resolves DB role/read/action scope.
6. Existing guards continue to enforce role and scope.

### Logout

1. Mobile app calls `POST /api/mobile/auth/logout`.
2. Backend revokes the active mobile device session.
3. Backend disables push tokens linked to that session.
4. Mobile app clears local access token, IdP refresh token, and device session id from secure storage.
5. Mobile app calls provider logout/revoke if available.

### Admin/User Revoke

1. User or admin revokes a session by id.
2. Backend marks session `revoked`.
3. Backend stores `revoked_at`, `revoked_by_user_id`, and `revocation_reason`.
4. Push tokens for the session are disabled.
5. Future requests with that session id fail.

## PostgreSQL Table Proposal

### P0: `ops.mobile_device_session`

Purpose: backend-owned mobile session lifecycle.

Columns:

- `mobile_device_session_id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
- `user_id UUID NOT NULL REFERENCES ops.user_account(user_id)`
- `provider_subject TEXT NOT NULL`
- `device_id_hash TEXT NOT NULL`
- `platform TEXT NOT NULL CHECK (platform IN ('ios', 'android'))`
- `device_name TEXT`
- `app_version TEXT`
- `os_version TEXT`
- `status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked', 'expired'))`
- `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`
- `last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`
- `expires_at TIMESTAMPTZ`
- `revoked_at TIMESTAMPTZ`
- `revoked_by_user_id UUID REFERENCES ops.user_account(user_id)`
- `revocation_reason TEXT`

Indexes:

- `(user_id, status, last_seen_at DESC)`
- `(mobile_device_session_id, user_id, status)`
- unique active `(user_id, device_id_hash) WHERE status = 'active'`

### P1: `ops.mobile_push_token`

Purpose: push token registration lifecycle without making push delivery part of V1.

Columns:

- `mobile_push_token_id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
- `mobile_device_session_id UUID NOT NULL REFERENCES ops.mobile_device_session(mobile_device_session_id)`
- `user_id UUID NOT NULL REFERENCES ops.user_account(user_id)`
- `platform TEXT NOT NULL CHECK (platform IN ('ios', 'android'))`
- `provider TEXT NOT NULL CHECK (provider IN ('apns', 'fcm'))`
- `token_hash TEXT NOT NULL`
- `token_ciphertext TEXT`
- `status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked'))`
- `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`
- `updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`
- `last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`
- `revoked_at TIMESTAMPTZ`

Indexes:

- unique active `(provider, token_hash) WHERE status = 'active'`
- `(user_id, status, updated_at DESC)`
- `(mobile_device_session_id, status)`

### Future Only: `ops.mobile_refresh_token`

Do not implement in V1 if refresh remains IdP-owned.

If later needed:

- store only `token_hash`.
- store token family id.
- rotate on every refresh.
- mark used token reuse as compromise.
- revoke all user mobile sessions by default on reuse.

## Endpoint Proposal

### P0

- `POST /api/mobile/auth/sessions`
  - Auth: bearer access token required.
  - Body: `deviceId`, `platform`, `deviceName`, `appVersion`, `osVersion`.
  - Creates/resumes active mobile session.

- `GET /api/mobile/auth/session`
  - Auth: bearer access token + active mobile session required.
  - Returns mobile session metadata and existing auth session summary.

- `POST /api/mobile/auth/logout`
  - Auth: bearer access token + active mobile session required.
  - Revokes current session and disables linked push tokens.

- `GET /api/mobile/auth/sessions`
  - Auth: bearer access token required.
  - Lists the current user's mobile sessions.

- `DELETE /api/mobile/auth/sessions/:sessionId`
  - Auth: bearer access token required.
  - Lets the user revoke one of their own sessions.

### P1

- `PUT /api/mobile/auth/push-token`
  - Auth: bearer access token + active mobile session required.
  - Registers or updates push token.

- `DELETE /api/mobile/auth/push-token`
  - Auth: bearer access token + active mobile session required.
  - Revokes push token for the current session.

- `GET /api/admin/mobile-sessions`
  - Auth: `SUPER_ADMIN` or future `auth.manage`.
  - Admin list/search.

- `POST /api/admin/mobile-sessions/:sessionId/revoke`
  - Auth: `SUPER_ADMIN` or future `auth.manage`.
  - Admin revoke.

## Audit Events

Add cataloged events:

- `mobile_device_session.created`
- `mobile_device_session.resumed`
- `mobile_device_session.revoked`
- `mobile_device_session.expired`
- `mobile_push_token.registered`
- `mobile_push_token.revoked`
- future only: `mobile_refresh_token.reused`

No raw tokens, push tokens, or authorization codes may appear in audit metadata.

## Error Behavior

Use the Security Gate V1-A standard error response.

Expected codes:

- missing/invalid bearer access token: `401`
- missing mobile session header on mobile-only endpoints: `401` or `403` depending guard implementation
- revoked/expired session: `401`
- out-of-user session revoke attempt: `403`
- invalid device payload: `400 VALIDATION_ERROR`

## V1 Non-Goals

- no Mobile BFF aggregation
- no backend-issued access token
- no backend-owned refresh token
- no refresh endpoint
- no push delivery
- no social/feed/workforce/competition change
- no admin-web login refactor
- no MFA policy implementation
- no device fingerprint risk scoring

## Open Decisions Before Implementation

1. Confirm mobile app uses a separate IdP client id such as `store-ops-mobile`.
2. Confirm refresh token remains IdP-owned for V1.
3. Confirm mobile app stores IdP refresh token only in secure OS storage.
4. Confirm `deviceId` is app-generated random id, not hardware serial.
5. Confirm max active device policy:
   - V1 recommendation: unlimited but user/admin revocable.
6. Confirm push token V1 means registration/revoke only, no delivery.
7. Confirm backend-owned refresh broker remains future only.

## CODEX Honest View

This design is deliberately conservative. It avoids turning the backend into a second identity provider while still giving the platform the missing production controls: device session revoke, push-token lifecycle, audit evidence, and DB-owned scope enforcement.

The most important product decision is keeping Mobile BFF out of V1. Session trust must be stable before mobile screen aggregation begins.

