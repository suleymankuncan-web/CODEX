# Clerk Auth + DB Authorization User Lifecycle V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move HR Axis to Clerk-backed authentication while keeping all authorization, employee lifecycle, and access shutdown rules inside the HR Axis database.

**Architecture:** Clerk proves identity and issues JWTs. The backend verifies those JWTs through the existing `JwtAuthProvider`, maps Clerk `sub` to `ops.user_account.provider_subject`, then derives roles, read scope, action store scope, and active/inactive state from PostgreSQL. A new shared access lifecycle service makes manual user deactivation and HR-approved offboarding close roles, action-store assignments, and mobile sessions consistently.

**Tech Stack:** Clerk, React/Vite, NestJS, PostgreSQL, jose, Jest, Supertest, Playwright

---

## Decisions

- Clerk is the authentication provider for V1.
- Clerk Organizations are not used in V1; company, region, store, role, and action scope remain in HR Axis DB.
- HR Axis DB is authoritative for authorization and access shutdown.
- User accounts are linked by `ops.user_account.auth_provider = 'clerk'` and `ops.user_account.provider_subject = <Clerk user id>`.
- Re-activation does not automatically restore old role assignments or action-store assignments. HR admin must assign access again.
- SMS OTP is out of scope for V1. Use email/password or email magic link first.
- Azure Entra, Keycloak, Auth0, and provider-specific organizations stay out of this implementation.

## File Map

- Modify `backend/nestjs/src/shared/app-config.service.ts`: add provider mapping config for JWT mode.
- Modify `backend/nestjs/src/modules/auth/auth-context.service.ts`: map JWT users using configured provider key instead of hard-coded `oidc`.
- Modify `backend/nestjs/src/modules/auth/auth-context.service.spec.ts`: cover Clerk provider-subject mapping and inactive-user rejection.
- Modify `backend/nestjs/src/modules/auth/providers/jwt-auth.provider.ts`: keep JWT verification generic and compatible with Clerk token claims.
- Modify `backend/nestjs/src/modules/auth/providers/jwt-auth.provider.spec.ts`: prove Clerk issuer/JWKS/audience flow still resolves `sub`.
- Create `backend/nestjs/src/modules/auth/access-lifecycle.repository.ts`: transaction-safe SQL for closing user access, including methods that can run inside an existing transaction client.
- Create `backend/nestjs/src/modules/auth/access-lifecycle.service.ts`: service boundary for manual admin deactivate/reactivate side effects.
- Modify `backend/nestjs/src/modules/auth/auth-admin.repository.ts`: stop using the existing standalone deactivate SQL; keep read/list/reactivate helpers that are not lifecycle side effects.
- Modify `backend/nestjs/src/modules/auth/auth-admin.service.ts`: call access lifecycle service for deactivate/reactivate commands.
- Modify `backend/nestjs/src/modules/auth/auth.module.ts`: register and export access lifecycle service plus repository.
- Modify `backend/nestjs/src/modules/store-ops/application/workforce.service.ts`: pass actor/source lifecycle context to offboarding approval and map access-closure result fields.
- Modify `backend/nestjs/src/modules/store-ops/infrastructure/workforce-request.repository.ts`: call access lifecycle repository inside the same transaction as employee termination.
- Create `db/migrations/044_user_access_lifecycle_metadata.sql`: add deactivation metadata and supporting indexes.
- Modify `db/schema.sql`: fold migration 044 into canonical schema.
- Modify `backend/nestjs/test/integration/auth-user-accounts.e2e-spec.ts`: direct deactivate closes roles/actions/sessions.
- Modify `backend/nestjs/test/integration/workforce-offboarding.e2e-spec.ts`: HR approval closes linked user access.
- Modify `backend/nestjs/test/integration/mobile-auth-session.e2e-spec.ts`: deactivation revokes active mobile sessions.
- Modify `admin-web/src/features/auth/api.ts`: expose lifecycle fields and deactivate reason in auth user DTOs.
- Modify `admin-web/src/pages/AuthDashboardPage.tsx`: show provider, active status, deactivation metadata, and safer deactivate/reactivate UX.
- Modify `admin-web/src/pages/StoreApprovalsPage.tsx`: show offboarding approval result that user access was closed when a linked account exists.
- Modify `admin-web/src/features/session/session-storage.ts`: keep existing bearer mode; Clerk integration should write Clerk session token into the same bearer storage.
- Create `admin-web/src/features/auth/clerk-session.ts`: isolate Clerk SDK token retrieval and login/logout bridge.
- Modify `admin-web/src/main.tsx` or `admin-web/src/App.tsx`: mount Clerk provider only when `VITE_AUTH_PROVIDER=clerk`.
- Modify `admin-web/package.json`: add Clerk React SDK after checking the currently supported package name/version.
- Modify `docs/deployment/staging-auth-runbook.md`: document Clerk project values, HR Axis DB binding, smoke user, and evidence collection.
- Modify `current-state.md`: update active architecture after implementation and staging smoke.

---

### Task 1: Lock Provider Mapping Behavior

**Files:**
- Modify: `backend/nestjs/src/shared/app-config.service.ts`
- Modify: `backend/nestjs/src/modules/auth/auth-context.service.ts`
- Modify: `backend/nestjs/src/modules/auth/auth-context.service.spec.ts`

- [ ] Add `authProviderKey` getter to `AppConfigService`.

```ts
get authProviderKey(): string {
  return this.readString("AUTH_PROVIDER_KEY", "oidc");
}
```

- [ ] Replace the hard-coded provider in `AuthContextService`.

```ts
await this.authAuthorizationRepository.getUserAccountByProviderSubject({
  authProvider: this.appConfigService.authProviderKey,
  providerSubject: providerUser.userId,
});
```

- [ ] Add a unit test where `AUTH_MODE=jwt`, `AUTH_PROVIDER_KEY=clerk`, JWT `sub=clerk_user_123`, and DB has `auth_provider='clerk'`, `provider_subject='clerk_user_123'`.
- [ ] Assert resolved user id becomes HR Axis `user_id`, not Clerk `sub`.
- [ ] Add a unit test where the mapped account has `is_active=false`.
- [ ] Assert `resolveUser` throws `UnauthorizedException("User account is inactive")`.
- [ ] Run:

```powershell
cd backend\nestjs
npm test -- auth-context.service.spec.ts --runInBand
```

Expected: the new tests fail before implementation, then pass after the two code changes above.

---

### Task 2: Make JWT Verification Clerk-Compatible

**Files:**
- Modify: `backend/nestjs/src/modules/auth/providers/jwt-auth.provider.ts`
- Modify: `backend/nestjs/src/modules/auth/providers/jwt-auth.provider.spec.ts`
- Modify: `backend/nestjs/src/shared/app-config.service.spec.ts`

- [ ] Keep the existing issuer/JWKS/audience verification path; Clerk can fit the existing `JWT_ISSUER`, `JWT_JWKS_URL`, and `JWT_AUDIENCE` model.
- [ ] Add tests that prove a token with a Clerk-style `sub` and no HR Axis role claims resolves to a provider user with empty role/scope arrays.
- [ ] Confirm DB assignments override token role/scope later in `AuthContextService`.
- [ ] Add config docs in test names and comments for required staging env:

```env
AUTH_MODE=jwt
AUTH_PROVIDER_KEY=clerk
JWT_ISSUER=<clerk issuer URL>
JWT_JWKS_URL=<clerk JWKS URL>
JWT_AUDIENCE=<backend API audience if configured in Clerk>
```

- [ ] Run:

```powershell
cd backend\nestjs
npm test -- jwt-auth.provider.spec.ts app-config.service.spec.ts --runInBand
```

Expected: PASS.

---

### Task 3: Add User Access Lifecycle Metadata

**Files:**
- Create: `db/migrations/044_user_access_lifecycle_metadata.sql`
- Modify: `db/schema.sql`
- Modify: `backend/nestjs/src/modules/auth/user-account-provider-subject-schema-contract.spec.ts`

- [ ] Add metadata columns to `ops.user_account`.

```sql
ALTER TABLE ops.user_account
  ADD COLUMN IF NOT EXISTS deactivation_reason TEXT,
  ADD COLUMN IF NOT EXISTS deactivated_by_user_id UUID REFERENCES ops.user_account(user_id);
```

- [ ] Add an index for lifecycle screens and audits.

```sql
CREATE INDEX IF NOT EXISTS idx_user_account_active_employee
  ON ops.user_account (is_active, employee_id);
```

- [ ] Update canonical `db/schema.sql` so fresh DBs include the same columns and index.
- [ ] Extend the schema contract test to assert `provider_subject`, `deactivation_reason`, and `deactivated_by_user_id` exist.
- [ ] Run:

```powershell
cd backend\nestjs
npm test -- user-account-provider-subject-schema-contract.spec.ts --runInBand
cd ..\..
npm run smoke:migration:fresh-db
```

Expected: schema contract and fresh migration smoke pass.

---

### Task 4: Implement Shared Access Lifecycle Service

**Files:**
- Create: `backend/nestjs/src/modules/auth/access-lifecycle.repository.ts`
- Create: `backend/nestjs/src/modules/auth/access-lifecycle.service.ts`
- Modify: `backend/nestjs/src/modules/auth/auth.module.ts`
- Modify: `backend/nestjs/test/integration/auth-user-accounts.e2e-spec.ts`

- [ ] Write failing integration test: deactivating an active user ends active role assignments.
- [ ] Write failing integration test: deactivating an active user ends active action-store assignments.
- [ ] Write failing integration test: deactivating an active user revokes active mobile sessions.
- [ ] Implement repository methods:

```ts
async deactivateUserAccess(input: {
  userId: string;
  actorUserId: string;
  reason: "manual_admin_deactivation" | "employee_offboarding";
  sourceEntity?: { entityName: string; entityId: string };
}) {
  return this.databaseService.withTransaction(async (client) => {
    return this.deactivateUserAccessInTransaction(client, input);
  });
}

async deactivateUserAccessInTransaction(
  client: PoolClient,
  input: {
    userId: string;
    actorUserId: string;
    reason: "manual_admin_deactivation" | "employee_offboarding";
    sourceEntity?: { entityName: string; entityId: string };
  },
) {
  // 1. Lock user row with SELECT ... FOR UPDATE.
  // 2. Set user_account.is_active=false, deactivated_at=NOW(),
  //    deactivation_reason, deactivated_by_user_id.
  // 3. Set end_at=NOW() on active user_role_assignment rows.
  // 4. Set end_at=NOW() on active user_action_store_assignment rows.
  // 5. Set status='revoked', revoked_at=NOW(), revoked_by_user_id,
  //    revocation_reason on active mobile_device_session rows.
  // 6. Insert one audit.event_log row with counts for closed roles,
  //    closed action scopes, and revoked sessions.
  // 7. Return the updated user plus counts.
}
```

- [ ] Import `PoolClient` in `access-lifecycle.repository.ts`.

```ts
import { PoolClient } from "pg";
```

- [ ] Use actual SQL updates with `RETURNING` counts, not post-hoc string parsing.
- [ ] Implement service method that turns repeated deactivation into a conflict for manual admin calls.
- [ ] Register `AccessLifecycleRepository` and `AccessLifecycleService` in `AuthModule`.
- [ ] Export both providers from `AuthModule` so store-ops can inject the repository for same-transaction offboarding.
- [ ] Run:

```powershell
cd backend\nestjs
npm test -- auth-user-accounts.e2e-spec.ts --runInBand
```

Expected: PASS.

---

### Task 5: Route Manual Auth Admin Deactivation Through Lifecycle

**Files:**
- Modify: `backend/nestjs/src/modules/auth/auth-admin.repository.ts`
- Modify: `backend/nestjs/src/modules/auth/auth-admin.service.ts`
- Modify: `backend/nestjs/src/modules/auth/web/auth-admin.controller.ts`
- Modify: `backend/nestjs/test/integration/auth-user-accounts.e2e-spec.ts`

- [ ] Add optional request body for deactivate reason.

```ts
type DeactivateUserAccountRequest = {
  reason?: string;
};
```

- [ ] Keep the endpoint path stable: `PATCH /auth/users/:userId/deactivate`.
- [ ] Make `AuthAdminService.deactivateUserAccount` call `AccessLifecycleService.deactivateUserAccess`.
- [ ] Remove the old direct deactivation update from the admin service path so there is one authoritative shutdown implementation.
- [ ] Keep `reactivateUserAccount` simple: it only sets `is_active=true`, clears deactivation metadata, and writes audit. It must not reopen old role/action assignments.
- [ ] Add test that reactivated user has no active role/action assignments unless assigned again.
- [ ] Run:

```powershell
cd backend\nestjs
npm test -- auth-user-accounts.e2e-spec.ts auth-role-assignments.e2e-spec.ts auth-action-store-assignments.e2e-spec.ts --runInBand
```

Expected: PASS.

---

### Task 6: Close User Access During HR-Approved Offboarding

**Files:**
- Modify: `backend/nestjs/src/modules/store-ops/application/workforce.service.ts`
- Modify: `backend/nestjs/src/modules/store-ops/infrastructure/workforce-request.repository.ts`
- Modify: `backend/nestjs/test/integration/workforce-offboarding.e2e-spec.ts`

- [ ] Add failing test: HR approval terminates employee and deactivates linked user account.
- [ ] Add failing test: HR approval succeeds when the employee has no user account, and response reports no linked account.
- [ ] Inject `AccessLifecycleRepository` into `WorkforceRequestRepository`.
- [ ] Inside the existing `approveOffboardingRequest` transaction, find an active linked user by `employee_id`.
- [ ] If linked user exists and active, call `deactivateUserAccessInTransaction` before committing the offboarding transaction.

```ts
{
  userId: linkedUser.user_id,
  actorUserId: input.actorUserId,
  reason: "employee_offboarding",
  sourceEntity: {
    entityName: "ops.employee_offboarding_request",
    entityId: input.requestId,
  },
}
```

- [ ] Return response data that includes `userAccessClosed: true | false`, `closedUserId?: string`, `closedRoleAssignments`, `closedActionStoreAssignments`, and `revokedMobileSessions`.
- [ ] Add test that simulates lifecycle SQL failure and asserts the employee termination transaction rolls back.
- [ ] Run:

```powershell
cd backend\nestjs
npm test -- workforce-offboarding.e2e-spec.ts auth-user-accounts.e2e-spec.ts --runInBand
```

Expected: PASS.

---

### Task 7: Surface Lifecycle State In Admin UI

**Files:**
- Modify: `admin-web/src/features/auth/api.ts`
- Modify: `admin-web/src/pages/AuthDashboardPage.tsx`
- Modify: `admin-web/src/pages/StoreApprovalsPage.tsx`

- [ ] Extend `AuthUserAccount` with:

```ts
deactivatedAt: string | null
deactivationReason: string | null
deactivatedByUserId: string | null
employeeStatus: string | null
```

- [ ] Update user table/details to show provider, active state, employee status, deactivation reason, and deactivated timestamp.
- [ ] Add clear copy to manual deactivate confirmation: this closes login access, active role assignments, active action-store assignments, and active mobile sessions.
- [ ] On offboarding approval success, show one of:
  - `User access closed.`
  - `No linked user account was found. Employee record was terminated.`
- [ ] Run:

```powershell
cd admin-web
npm run lint
npm run build
```

Expected: PASS.

---

### Task 8: Add Clerk Frontend Session Bridge

**Files:**
- Modify: `admin-web/package.json`
- Create: `admin-web/src/features/auth/clerk-session.ts`
- Modify: `admin-web/src/main.tsx`
- Modify: `admin-web/src/App.tsx`
- Modify: `admin-web/src/features/session/session-context.tsx`
- Modify: `admin-web/src/features/session/session-storage.ts`

- [ ] Add Clerk React SDK after checking the current official package name and install command.
- [ ] Keep existing `bearer` mode. Clerk should feed a token into existing bearer session storage instead of creating a parallel auth header system.
- [ ] Use `VITE_AUTH_PROVIDER=clerk` and `VITE_CLERK_PUBLISHABLE_KEY=<key>` to enable Clerk UI.
- [ ] Implement `getClerkBearerToken()` in `clerk-session.ts` that returns the current Clerk session JWT.
- [ ] When Clerk is enabled and the user is signed in, call `startBearerSession(token)` with the Clerk token.
- [ ] When Clerk signs out, call `expireSession()` or `resetSession()` and clear bearer token storage.
- [ ] Preserve mock mode for local development.
- [ ] Run:

```powershell
cd admin-web
npm run lint
npm run build
```

Expected: PASS.

---

### Task 9: Add Staging Auth Runbook And Evidence Checklist

**Files:**
- Create: `docs/deployment/staging-auth-runbook.md`
- Modify: `current-state.md`

- [ ] Document required Clerk values:

```md
- Clerk frontend URL
- Clerk publishable key
- Clerk issuer URL
- Clerk JWKS URL
- Clerk JWT template/audience, if used
- Smoke user email
- Smoke user HR Axis role
- Smoke user assigned store id
- Smoke user unassigned store id
```

- [ ] Document required backend values:

```env
AUTH_MODE=jwt
AUTH_PROVIDER_KEY=clerk
JWT_ISSUER=<clerk issuer URL>
JWT_JWKS_URL=<clerk JWKS URL>
JWT_AUDIENCE=<api audience>
CORS_ALLOWED_ORIGINS=https://staging.hr-axis.com
```

- [ ] Document required frontend values:

```env
VITE_AUTH_MODE=bearer
VITE_AUTH_PROVIDER=clerk
VITE_CLERK_PUBLISHABLE_KEY=<publishable key>
VITE_API_BASE_URL=https://api-staging.hr-axis.com/api
```

- [ ] Add evidence checklist:
  - login succeeds with smoke user
  - `/api/auth/session` resolves HR Axis user id
  - assigned store action succeeds
  - unassigned store action is rejected
  - HR-approved offboarding closes user access
  - inactive user cannot call protected API with an old token
- [ ] Update `current-state.md` only after the implementation and smoke test actually pass.

---

### Task 10: Full Verification

**Files:**
- Verify only

- [ ] Run backend focused auth/workforce tests:

```powershell
cd backend\nestjs
npm test -- auth-context.service.spec.ts jwt-auth.provider.spec.ts auth-user-accounts.e2e-spec.ts workforce-offboarding.e2e-spec.ts mobile-auth-session.e2e-spec.ts --runInBand
```

- [ ] Run backend release checks:

```powershell
cd backend\nestjs
npm run lint
npm test -- --runInBand
npm run build
```

- [ ] Run frontend checks:

```powershell
cd admin-web
npm run lint
npm run build
npm run test:e2e
```

- [ ] Run root migration/script checks:

```powershell
npm run test:scripts
npm run smoke:migration:fresh-db
```

- [ ] Manual staging smoke after deploy:
  - login at `https://staging.hr-axis.com`
  - check `/admin/session`
  - confirm assigned-store action works
  - confirm unassigned-store action is blocked
  - approve offboarding for a linked smoke employee
  - retry API with old token and confirm rejection

Expected: all automated checks pass and the staging evidence checklist is complete.

---

## Implementation Order

1. Provider mapping and JWT tests.
2. DB metadata migration.
3. Access lifecycle service.
4. Manual auth admin deactivation flow.
5. Workforce offboarding integration.
6. Admin UI lifecycle visibility.
7. Clerk frontend bridge.
8. Staging runbook and smoke evidence.

This order keeps risk low: first make identity mapping explicit, then make access shutdown correct, then attach UI and Clerk login.
