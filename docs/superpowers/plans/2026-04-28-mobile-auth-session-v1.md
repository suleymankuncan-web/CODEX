# Mobile Auth/Session V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add backend-owned mobile device session tracking on top of the existing JWT/JWKS auth flow without changing admin-web auth, adding Mobile BFF, or taking refresh-token ownership from the IdP.

**Architecture:** Keep the backend as a resource server. Mobile app receives access and refresh tokens from the IdP through Authorization Code + PKCE; backend verifies access tokens, records mobile device sessions, enforces active session state for mobile endpoints, and continues using DB role/action assignments as canonical authorization.

**Tech Stack:** NestJS 11, TypeScript, PostgreSQL raw SQL migrations, `pg`, `jose`, Jest, Supertest.

---

## Scope

In scope:

- add `ops.mobile_device_session`
- add P0 mobile session endpoints
- add mobile session repository/service/controller
- add mobile session guard/helper for mobile endpoints
- keep DB assignment scope canonical
- add audit event catalog entries
- update env/docs/checklists
- add targeted unit/e2e tests

Out of scope:

- Mobile BFF
- backend-owned refresh tokens
- refresh endpoint
- push delivery
- admin-web login refactor
- store/feed/workforce/competition module changes
- new packages

## Current Files To Read First

- `backend/nestjs/src/modules/auth/providers/jwt-auth.provider.ts`
- `backend/nestjs/src/modules/auth/auth-context.service.ts`
- `backend/nestjs/src/modules/auth/auth-authorization.repository.ts`
- `backend/nestjs/src/modules/auth/web/auth-session.controller.ts`
- `backend/nestjs/src/modules/auth/guards/auth.guard.ts`
- `backend/nestjs/src/modules/auth/guards/scope.guard.ts`
- `backend/nestjs/src/shared/audit/audit-event-catalog.ts`
- `backend/nestjs/src/shared/database/database.service.ts`
- `db/schema.sql`
- `admin-web/src/features/auth/auth-flow.ts`
- `admin-web/src/features/session/session-storage.ts`

## File Structure

Create:

- `db/migrations/036_mobile_device_sessions.sql`
- `backend/nestjs/src/modules/auth/mobile-session.repository.ts`
- `backend/nestjs/src/modules/auth/mobile-session.service.ts`
- `backend/nestjs/src/modules/auth/guards/mobile-session.guard.ts`
- `backend/nestjs/src/modules/auth/web/mobile-auth.controller.ts`
- `backend/nestjs/src/modules/auth/web/dto/register-mobile-session.dto.ts`
- `backend/nestjs/src/modules/auth/mobile-session.service.spec.ts`
- `backend/nestjs/src/modules/auth/guards/mobile-session.guard.spec.ts`
- `backend/nestjs/test/integration/mobile-auth-session.e2e-spec.ts`

Modify:

- `db/schema.sql`
- `backend/nestjs/src/modules/auth/auth.module.ts`
- `backend/nestjs/src/shared/audit/audit-event-catalog.ts`
- `backend/nestjs/src/shared/audit/audit-event-catalog.spec.ts`
- `docs/plans/environment-variable-inventory.md`
- `docs/plans/production-environment-readiness-checklist.md`
- `current-state.md`
- `docs/plans/active-next-actions.md`
- `docs/plans/project-debt-ledger.md`

Do not modify:

- `admin-web/src/features/auth/auth-flow.ts`
- `admin-web/src/features/session/session-storage.ts`
- `backend/nestjs/src/shared/http/configure-http-security.ts`
- store/feed/workforce/competition modules

## Task 1: Schema Contract For Mobile Sessions

**Files:**

- Create: `db/migrations/036_mobile_device_sessions.sql`
- Modify: `db/schema.sql`
- Test: `backend/nestjs/src/modules/auth/mobile-session-schema-contract.spec.ts`

- [ ] **Step 1: Write failing schema contract test**

Create a test that reads `db/schema.sql` and asserts:

- `CREATE TABLE ops.mobile_device_session`
- `mobile_device_session_id UUID PRIMARY KEY`
- `user_id UUID NOT NULL REFERENCES ops.user_account`
- `device_id_hash TEXT NOT NULL`
- `status TEXT NOT NULL`
- no `refresh_token` plaintext column
- index text for user/status lookup exists

Run:

```powershell
cd "C:\Users\suley\OneDrive\Masaüstü\WEBSİTE ÇALIŞMASI\backend\nestjs"
npm.cmd test -- src/modules/auth/mobile-session-schema-contract.spec.ts --runInBand
```

Expected: FAIL because table does not exist.

- [ ] **Step 2: Add migration and canonical schema**

Add `ops.mobile_device_session` to migration and `db/schema.sql`.

Important SQL rules:

- use `CREATE TABLE IF NOT EXISTS`
- do not use `DROP`, `TRUNCATE`, or destructive updates
- do not add refresh-token plaintext column
- add indexes for `user_id/status/last_seen_at` and `mobile_device_session_id/user_id/status`
- add partial unique index for active `(user_id, device_id_hash)`

- [ ] **Step 3: Run schema contract test**

Expected: PASS.

## Task 2: Repository Layer

**Files:**

- Create: `backend/nestjs/src/modules/auth/mobile-session.repository.ts`
- Test: `backend/nestjs/src/modules/auth/mobile-session.repository.spec.ts`

- [ ] **Step 1: Write repository tests**

Cover:

- create active session.
- resume active session by user and device hash.
- update `last_seen_at`.
- revoke session by session id and user id.
- reject cross-user revoke by returning null/empty result.
- list sessions by user id.

- [ ] **Step 2: Implement repository**

Repository methods:

- `findActiveByUserAndDeviceHash(input)`
- `createSession(input)`
- `touchSession(input)`
- `getActiveSessionForUser(input)`
- `listSessionsForUser(input)`
- `revokeSession(input)`
- `revokeSessionPushTokens(input)` only when the push token table is implemented in P1; omit it from P0.

Use `DatabaseService.query` and `withTransaction` patterns already used in auth repositories.

- [ ] **Step 3: Run repository test**

Expected: PASS.

## Task 3: Service Layer

**Files:**

- Create: `backend/nestjs/src/modules/auth/mobile-session.service.ts`
- Test: `backend/nestjs/src/modules/auth/mobile-session.service.spec.ts`

- [ ] **Step 1: Write service tests**

Cover:

- registering a new device creates a session.
- registering same user/device resumes and touches existing active session.
- logout revokes current session.
- user cannot revoke another user's session.
- returned session payload never includes token material.

- [ ] **Step 2: Implement service**

Service responsibilities:

- hash `deviceId` with Node `crypto.createHash("sha256")`.
- never persist raw device id.
- call repository methods.
- write audit events through repository transaction or direct audit insert helper pattern.
- expose mapped DTO-safe response.

No new package needed.

- [ ] **Step 3: Run service test**

Expected: PASS.

## Task 4: Mobile Session Guard

**Files:**

- Create: `backend/nestjs/src/modules/auth/guards/mobile-session.guard.ts`
- Test: `backend/nestjs/src/modules/auth/guards/mobile-session.guard.spec.ts`

- [ ] **Step 1: Write guard tests**

Cover:

- missing `X-Mobile-Session-Id` rejects mobile-only endpoint.
- active session belonging to current user passes.
- revoked/expired/missing session rejects.
- session belonging to different user rejects.

- [ ] **Step 2: Implement guard**

Guard should run after `AuthGuard`.

Expected behavior:

- read `request.user.userId`.
- read `x-mobile-session-id`.
- verify active session through `MobileSessionService`.
- attach `request.mobileSession`.

Use standard Nest exceptions so Security Gate V1-A formats errors globally.

- [ ] **Step 3: Register guard only where needed**

Do not make it global in V1.

Use it only on mobile auth/session endpoints that require an existing mobile session.

## Task 5: Mobile Auth Controller

**Files:**

- Create: `backend/nestjs/src/modules/auth/web/mobile-auth.controller.ts`
- Create: `backend/nestjs/src/modules/auth/web/dto/register-mobile-session.dto.ts`
- Modify: `backend/nestjs/src/modules/auth/auth.module.ts`
- Test: `backend/nestjs/test/integration/mobile-auth-session.e2e-spec.ts`

- [ ] **Step 1: Write e2e tests**

Cover:

- `POST /api/mobile/auth/sessions` with bearer token creates/resumes session.
- `GET /api/mobile/auth/session` requires active mobile session id.
- `POST /api/mobile/auth/logout` revokes session.
- revoked session cannot access `GET /api/mobile/auth/session`.
- DB assignment scope remains canonical in returned session.

- [ ] **Step 2: Add DTO**

Fields:

- `deviceId: string`
- `platform: "ios" | "android"`
- `deviceName?: string`
- `appVersion?: string`
- `osVersion?: string`

Validation:

- non-empty `deviceId`
- enum platform
- optional string metadata

- [ ] **Step 3: Add controller**

Endpoints:

- `POST /api/mobile/auth/sessions`
- `GET /api/mobile/auth/session`
- `POST /api/mobile/auth/logout`
- `GET /api/mobile/auth/sessions`
- `DELETE /api/mobile/auth/sessions/:sessionId`

All endpoints require existing `AuthGuard` through module global guard.

Endpoints except session registration must require active mobile session guard.

- [ ] **Step 4: Register controller/provider**

Update `AuthModule` with controller and service/repository/guard providers.

## Task 6: Audit Event Catalog

**Files:**

- Modify: `backend/nestjs/src/shared/audit/audit-event-catalog.ts`
- Modify/Test: `backend/nestjs/src/shared/audit/audit-event-catalog.spec.ts`

- [ ] **Step 1: Add audit event catalog expectations**

Events:

- `mobile_device_session.created`
- `mobile_device_session.resumed`
- `mobile_device_session.revoked`
- `mobile_device_session.expired`

Optional P1 future:

- `mobile_push_token.registered`
- `mobile_push_token.revoked`
- `mobile_refresh_token.reused`

- [ ] **Step 2: Ensure no sensitive metadata**

Tests should assert catalog exists. Service tests should assert no raw token/device id appears in audit metadata.

## Task 7: Docs And Env Inventory

**Files:**

- Modify: `docs/plans/environment-variable-inventory.md`
- Modify: `docs/plans/production-environment-readiness-checklist.md`
- Modify: `current-state.md`
- Modify: `docs/plans/active-next-actions.md`
- Modify: `docs/plans/project-debt-ledger.md`

- [ ] **Step 1: Add mobile auth V1 status**

Document:

- refresh token is IdP-owned.
- backend mobile device session is DB-owned.
- Mobile BFF is out of scope.
- push token registration is P1 unless implemented.

- [ ] **Step 2: Debt ledger accounting**

Only count as closed active debt after implementation and release gates pass.

If only docs are written, do not increment closed debt count.

## Task 8: Verification

**Files:** no code changes beyond prior tasks.

- [ ] **Step 1: Run targeted backend tests**

```powershell
cd "C:\Users\suley\OneDrive\Masaüstü\WEBSİTE ÇALIŞMASI\backend\nestjs"
npm.cmd test -- src/modules/auth/mobile-session-schema-contract.spec.ts src/modules/auth/mobile-session.repository.spec.ts src/modules/auth/mobile-session.service.spec.ts src/modules/auth/guards/mobile-session.guard.spec.ts test/integration/mobile-auth-session.e2e-spec.ts --runInBand
```

Expected: all targeted tests pass.

- [ ] **Step 2: Run backend release gate**

```powershell
cd "C:\Users\suley\OneDrive\Masaüstü\WEBSİTE ÇALIŞMASI\backend\nestjs"
npm.cmd run check:release
```

Expected: lint, tests, build, audit pass.

- [ ] **Step 3: Run root release gate**

```powershell
cd "C:\Users\suley\OneDrive\Masaüstü\WEBSİTE ÇALIŞMASI"
npm.cmd run check:release
```

Expected: root script tests, backend release, frontend release pass.

## P0/P1/P2 Priority

P0:

- `ops.mobile_device_session`
- create/resume/list/revoke/logout mobile sessions
- active mobile session guard
- DB assignment canonical scope remains unchanged
- audit events
- targeted + release tests

P1:

- push token registration/revoke table and endpoints
- admin session list/revoke
- max active device policy
- IdP revoke/backchannel integration

P2:

- Mobile BFF
- backend-owned refresh broker
- refresh token rotation/reuse detection implementation
- push delivery
- risk-based device scoring

## Approval Required Before Coding

Need explicit approval for:

- mobile app uses IdP-owned refresh tokens in V1.
- backend does not implement refresh endpoint in V1.
- mobile app sends `X-Mobile-Session-Id` for mobile-only endpoints.
- raw `deviceId` is hashed before persistence.
- Mobile BFF remains a separate future phase.
- P0 implementation excludes push token table unless separately approved.

## CODEX Honest View

This is the correct next backend hardening step after migration tracking and Security Gate V1-A. It adds missing mobile session control without widening scope into BFF, social feed, or backend-owned refresh token issuance.

The plan deliberately keeps P0 small. That is not weakness; it is how we keep the platform from pretending to be production-safe before session revoke and DB scope checks are proven.
