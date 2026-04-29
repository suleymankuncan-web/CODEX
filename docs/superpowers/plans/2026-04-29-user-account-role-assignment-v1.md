# User Account / Role Assignment V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Link selected pilot employees to existing Keycloak/OIDC login accounts, assign one primary role, and grant exact store scope without broad account rollout.

**Architecture:** Add durable provider-subject mapping to `ops.user_account`, map JWT `sub` to internal app users before DB authorization, add `VISUAL_MERCHANDISER` as a first-class store-scoped role, and expose one HR/Admin pilot binding command that writes user account, role assignments, and action-store assignments in a transaction. The pilot uses store-scoped role assignments for `REGION_MANAGER` as an explicit narrow-scope policy so the region manager sees only the two pilot stores.

**Tech Stack:** NestJS, PostgreSQL SQL migrations, Jest, Supertest, React/Vite, TanStack Query, Playwright, existing RBAC/scope guards, root `check:release`.

---

## File Structure

- Create: `db/migrations/041_user_account_provider_subject.sql`
  - Adds provider-subject mapping columns and uniqueness.
- Create: `db/migrations/042_visual_merchandiser_role.sql`
  - Adds `VISUAL_MERCHANDISER` and grants only store read/report/checklist visibility needed for VM pilot.
- Modify: `db/schema.sql`
  - Aligns canonical schema with migrations.
- Create: `backend/nestjs/src/modules/auth/user-account-provider-subject-schema-contract.spec.ts`
  - Guards provider subject schema and unique index.
- Modify: `backend/nestjs/src/modules/auth/role-catalog-contract.spec.ts`
  - Adds `VISUAL_MERCHANDISER` to catalog, Keycloak realm, and setup-script expectations.
- Modify: `backend/nestjs/src/modules/auth/providers/jwt-auth.provider.ts`
  - Accepts `VISUAL_MERCHANDISER` as an app role claim.
- Modify: `backend/nestjs/src/modules/auth/auth-context.service.ts`
  - Resolves JWT provider subject into internal `ops.user_account.user_id` before role lookup.
- Modify: `backend/nestjs/src/modules/auth/auth-context.service.spec.ts`
  - Covers provider-subject mapping and fail-closed behavior.
- Modify: `backend/nestjs/src/modules/auth/auth-authorization.repository.ts`
  - Adds lookup by `auth_provider + provider_subject`.
- Modify: `backend/nestjs/src/modules/auth/auth-admin.repository.ts`
  - Adds employee readiness lookup, provider-subject duplicate guard, and pilot binding transaction.
- Modify: `backend/nestjs/src/modules/auth/auth-admin.service.ts`
  - Adds pilot binding command, role/scope validation, and response mapping.
- Modify: `backend/nestjs/src/modules/auth/auth-role-scope-policy.service.ts`
  - Allows explicit store-scoped `REGION_MANAGER` assignments as a narrowing policy.
- Create: `backend/nestjs/src/modules/auth/auth-role-scope-policy.service.spec.ts`
  - Guards region-manager store narrowing and rejects other role/scope mismatches.
- Create: `backend/nestjs/src/modules/auth/web/dto/create-pilot-user-binding.dto.ts`
  - Validates employee, provider subject, role, and store scope input.
- Modify: `backend/nestjs/src/modules/auth/web/dto/create-user-account.dto.ts`
  - Adds optional provider subject to the existing low-level user account path for compatibility.
- Modify: `backend/nestjs/src/modules/auth/web/auth-admin.controller.ts`
  - Adds `POST /api/auth/pilot-user-bindings`.
- Modify: `backend/nestjs/test/integration/auth-role-assignments.e2e-spec.ts`
  - Covers pilot binding success/failure paths.
- Modify: `infra/keycloak/store-ops-realm.json`
  - Adds local `VISUAL_MERCHANDISER` role for development smoke.
- Modify: `infra/scripts/setup-keycloak.ps1`
  - Adds role bootstrap and preserves scope mapper setup.
- Modify: `admin-web/src/features/auth/api.ts`
  - Adds typed pilot binding request/response.
- Create: `admin-web/src/features/auth/PilotUserBindingPanel.tsx`
  - Focused HR/Admin binding UI.
- Modify: `admin-web/src/pages/AuthDashboardPage.tsx`
  - Mounts pilot binding panel without bloating existing forms.
- Create: `admin-web/e2e/auth-admin-surfaces.spec.ts`
  - Playwright acceptance for HR/Admin pilot binding UI.
- Modify: `docs/plans/project-debt-ledger.md`
  - Count the implementation as closed only after release gates pass.
- Modify: `current-state.md`
  - Handoff update after implementation.

## Scope Strategy

Use this exact V1 strategy:

- `STORE_MANAGER`: one store-scoped role assignment and one matching action-store assignment.
- `VISUAL_MERCHANDISER`: one store-scoped role assignment per pilot store and one matching action-store assignment per pilot store.
- `REGION_MANAGER`: one store-scoped `REGION_MANAGER` role assignment per pilot store and one matching action-store assignment per pilot store.

This intentionally narrows the pilot region manager to two stores. It avoids broad region read scope while preserving the `REGION_MANAGER` role code for role guards.

The only scope policy exception is:

```text
REGION_MANAGER catalog scope = region
allowed assignment scope = region or store
```

No other region-scoped role receives this narrowing rule in V1.

## Task 1: Provider Subject Schema Contract

**Files:**

- Create: `backend/nestjs/src/modules/auth/user-account-provider-subject-schema-contract.spec.ts`
- Create: `db/migrations/041_user_account_provider_subject.sql`
- Modify: `db/schema.sql`
- Modify: `backend/nestjs/src/modules/auth/web/dto/create-user-account.dto.ts`
- Modify: `admin-web/src/features/auth/api.ts`

- [ ] **Step 1: Write failing schema contract**

Create `backend/nestjs/src/modules/auth/user-account-provider-subject-schema-contract.spec.ts`:

```ts
import { readFileSync } from "node:fs";
import { join } from "node:path";

const schema = readFileSync(join(process.cwd(), "..", "..", "db", "schema.sql"), "utf8");
const migrationsRoot = join(process.cwd(), "..", "..", "db", "migrations");

function readMigration(name: string) {
  return readFileSync(join(migrationsRoot, name), "utf8");
}

describe("user account provider subject schema contract", () => {
  it("stores durable provider subject mapping on user accounts", () => {
    expect(schema).toContain("provider_subject TEXT");
    expect(schema).toContain("updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()");
    expect(schema).toContain("deactivated_at TIMESTAMPTZ");
    expect(schema).toContain("uq_user_account_auth_provider_subject");
    expect(schema).toContain("WHERE provider_subject IS NOT NULL");
  });

  it("adds provider subject through an additive migration", () => {
    const migration = readMigration("041_user_account_provider_subject.sql");

    expect(migration).toContain("ALTER TABLE ops.user_account");
    expect(migration).toContain("ADD COLUMN IF NOT EXISTS provider_subject TEXT");
    expect(migration).toContain("CREATE UNIQUE INDEX IF NOT EXISTS uq_user_account_auth_provider_subject");
    expect(migration).toContain("ON ops.user_account (auth_provider, provider_subject)");
  });
});
```

- [ ] **Step 2: Run red schema contract**

Run:

```powershell
cd "C:\Users\suley\OneDrive\Masaüstü\WEBSİTE ÇALIŞMASI\backend\nestjs"
npm.cmd test -- src/modules/auth/user-account-provider-subject-schema-contract.spec.ts --runInBand
```

Expected:

```text
FAIL user-account-provider-subject-schema-contract
Expected substring: "provider_subject TEXT"
```

- [ ] **Step 3: Add migration**

Create `db/migrations/041_user_account_provider_subject.sql`:

```sql
ALTER TABLE ops.user_account
    ADD COLUMN IF NOT EXISTS provider_subject TEXT,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ADD COLUMN IF NOT EXISTS deactivated_at TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS uq_user_account_auth_provider_subject
    ON ops.user_account (auth_provider, provider_subject)
    WHERE provider_subject IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_user_account_employee_active
    ON ops.user_account (employee_id, is_active);
```

- [ ] **Step 4: Align canonical schema**

Update `ops.user_account` in `db/schema.sql`:

```sql
CREATE TABLE ops.user_account (
    user_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID REFERENCES ops.employee(employee_id),
    username TEXT NOT NULL UNIQUE,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT,
    auth_provider TEXT NOT NULL DEFAULT 'local',
    provider_subject TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deactivated_at TIMESTAMPTZ
);
```

Add indexes near existing auth indexes:

```sql
CREATE UNIQUE INDEX IF NOT EXISTS uq_user_account_auth_provider_subject
    ON ops.user_account (auth_provider, provider_subject)
    WHERE provider_subject IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_user_account_employee_active
    ON ops.user_account (employee_id, is_active);
```

- [ ] **Step 5: Extend low-level user account DTO**

Modify `backend/nestjs/src/modules/auth/web/dto/create-user-account.dto.ts`:

```ts
import { IsEmail, IsIn, IsOptional, IsString, MinLength } from "class-validator";
import { IsPostgresUuid } from "../../../../shared/validation/postgres-uuid";

export class CreateUserAccountDto {
  @IsOptional()
  @IsPostgresUuid()
  employeeId?: string;

  @IsString()
  @MinLength(3)
  username!: string;

  @IsEmail()
  email!: string;

  @IsIn(["local", "oidc", "sso"])
  authProvider!: "local" | "oidc" | "sso";

  @IsOptional()
  @IsString()
  @MinLength(8)
  providerSubject?: string;
}
```

- [ ] **Step 6: Extend frontend user account type**

Modify `admin-web/src/features/auth/api.ts` user account types:

```ts
export type UserAccount = {
  userId: string
  employeeId: string | null
  username: string
  email: string
  authProvider: string
  providerSubject: string | null
  isActive: boolean
  lastLoginAt: string | null
  createdAt: string
}
```

Modify `createUserAccount` input:

```ts
export async function createUserAccount(input: {
  employeeId?: string
  username: string
  email: string
  authProvider: 'local' | 'oidc' | 'sso'
  providerSubject?: string
}) {
  return sendJson<CommandResponse<{ user: UserAccount }>>('/auth/users', {
    method: 'POST',
    body: input,
  })
}
```

- [ ] **Step 7: Run green schema contract**

Run:

```powershell
cd "C:\Users\suley\OneDrive\Masaüstü\WEBSİTE ÇALIŞMASI\backend\nestjs"
npm.cmd test -- src/modules/auth/user-account-provider-subject-schema-contract.spec.ts --runInBand
```

Expected:

```text
PASS src/modules/auth/user-account-provider-subject-schema-contract.spec.ts
```

## Task 2: JWT Subject To Internal User Mapping

**Files:**

- Modify: `backend/nestjs/src/modules/auth/auth-authorization.repository.ts`
- Modify: `backend/nestjs/src/modules/auth/auth-context.service.ts`
- Modify: `backend/nestjs/src/modules/auth/auth-context.service.spec.ts`
- Modify: `backend/nestjs/src/modules/auth/auth-admin.repository.ts`
- Modify: `backend/nestjs/src/modules/auth/auth-admin.service.ts`

- [ ] **Step 1: Write failing auth context test**

Add a test to `backend/nestjs/src/modules/auth/auth-context.service.spec.ts`:

```ts
it("maps JWT subject to internal user account before DB role lookup", async () => {
  const repository = buildAuthorizationRepository({
    mappedProviderUser: {
      user_id: "90000000-0000-4000-8000-000000000010",
      employee_id: "70000000-0000-4000-8000-000000000010",
      username: "store.manager",
      email: "store.manager@example.com",
      is_active: true,
    },
    roleAssignments: [
      {
        role_code: "STORE_MANAGER",
        scope_type: "store",
        company_id: null,
        region_id: null,
        store_id: "10000000-0000-4000-8000-000000000021",
      },
    ],
    actionStoreAssignments: [
      { store_id: "10000000-0000-4000-8000-000000000021" },
    ],
  });

  const service = new AuthContextService(
    { authMode: "jwt", allowMockAuth: false, isProduction: false } as never,
    repository,
    { resolveUser: jest.fn() } as never,
    {
      resolveUser: jest.fn(async () => ({
        userId: "2f7b9d1e-8a41-4c7e-9d63-0d6b3c9a5f22",
        roleCodes: [],
        readScope: { companyIds: [], regionIds: [], storeIds: [] },
        actionScope: { assignedStoreIds: [] },
      })),
    } as never,
  );

  const user = await service.resolveUser({
    headers: { authorization: "Bearer token" },
  });

  expect(repository.getUserAccountByProviderSubject).toHaveBeenCalledWith({
    authProvider: "oidc",
    providerSubject: "2f7b9d1e-8a41-4c7e-9d63-0d6b3c9a5f22",
  });
  expect(repository.getActiveRoleAssignments).toHaveBeenCalledWith(
    "90000000-0000-4000-8000-000000000010",
  );
  expect(user?.userId).toBe("90000000-0000-4000-8000-000000000010");
  expect(user?.employeeId).toBe("70000000-0000-4000-8000-000000000010");
  expect(user?.roleCodes).toEqual(["STORE_MANAGER"]);
});
```

Update the existing `buildAuthorizationRepository` helper in the same file so it includes this mock:

```ts
mappedProviderUser?: {
  user_id: string;
  employee_id: string | null;
  username: string;
  email: string;
  is_active: boolean;
} | null;
```

and returns:

```ts
getUserAccountByProviderSubject: jest.fn(
  async () => input.mappedProviderUser ?? null,
),
```

- [ ] **Step 2: Run red auth context test**

Run:

```powershell
cd "C:\Users\suley\OneDrive\Masaüstü\WEBSİTE ÇALIŞMASI\backend\nestjs"
npm.cmd test -- src/modules/auth/auth-context.service.spec.ts --runInBand
```

Expected:

```text
Property 'getUserAccountByProviderSubject' does not exist
```

- [ ] **Step 3: Add repository lookup**

Modify `backend/nestjs/src/modules/auth/auth-authorization.repository.ts`:

```ts
async getUserAccountByProviderSubject(input: {
  authProvider: string;
  providerSubject: string;
}) {
  const result = await this.databaseService.query<{
    user_id: string;
    employee_id: string | null;
    username: string;
    email: string;
    is_active: boolean;
  }>(
    `
      SELECT
        ua.user_id,
        ua.employee_id,
        ua.username,
        ua.email,
        ua.is_active
      FROM ops.user_account ua
      WHERE ua.auth_provider = $1
        AND ua.provider_subject = $2
      LIMIT 1
    `,
    [input.authProvider, input.providerSubject],
  );

  return result.rows[0] ?? null;
}
```

- [ ] **Step 4: Resolve internal user in AuthContextService**

Modify `backend/nestjs/src/modules/auth/auth-context.service.ts` after `providerUser` is built:

```ts
const providerSubject = providerUser.userId;
let appUser = providerUser;

if (this.appConfigService.authMode === "jwt" && providerSubject !== "unknown-user") {
  const mappedUser =
    await this.authAuthorizationRepository.getUserAccountByProviderSubject({
      authProvider: "oidc",
      providerSubject,
    });

  if (mappedUser) {
    if (!mappedUser.is_active) {
      throw new UnauthorizedException("User account is inactive");
    }

    appUser = buildAuthenticatedUser({
      ...providerUser,
      userId: mappedUser.user_id,
      employeeId: mappedUser.employee_id ?? providerUser.employeeId,
    });
  }
}
```

Then replace role/action lookup calls so they use `appUser.userId` instead of the raw provider subject:

```ts
assignments = await this.authAuthorizationRepository.getActiveRoleAssignments(appUser.userId);
actionStoreAssignments =
  await this.authAuthorizationRepository.getActiveActionStoreAssignments(appUser.userId);
```

Return `appUser` instead of `providerUser` in fallback paths.

- [ ] **Step 5: Persist provider subject in user admin repository**

Modify `backend/nestjs/src/modules/auth/auth-admin.repository.ts` create user insert and returning fields:

```sql
INSERT INTO ops.user_account (
  employee_id,
  username,
  email,
  auth_provider,
  provider_subject
) VALUES (
  $1::uuid,
  $2,
  $3,
  $4,
  $5
)
RETURNING
  user_id,
  employee_id,
  username,
  email,
  auth_provider,
  provider_subject,
  is_active,
  last_login_at,
  created_at
```

Add `provider_subject` to list/get user queries and map it in service responses as `providerSubject`.

- [ ] **Step 6: Pass provider subject from service**

Modify `backend/nestjs/src/modules/auth/auth-admin.service.ts` `createUserAccount` input:

```ts
async createUserAccount(input: {
  employeeId?: string;
  username: string;
  email: string;
  authProvider: "local" | "oidc" | "sso";
  providerSubject?: string;
  actorUserId: string;
}) {
  const user = await this.authAdminRepository.createUserAccount({
    employeeId: input.employeeId ?? null,
    username: input.username,
    email: input.email,
    authProvider: input.authProvider,
    providerSubject: input.providerSubject?.trim() || null,
    actorUserId: input.actorUserId,
  });
```

Map user:

```ts
private mapUser(user: {
  user_id: string;
  employee_id: string | null;
  username: string;
  email: string;
  auth_provider: string;
  provider_subject?: string | null;
  is_active: boolean;
  last_login_at: string | null;
  created_at: string;
}) {
  return {
    userId: user.user_id,
    employeeId: user.employee_id,
    username: user.username,
    email: user.email,
    authProvider: user.auth_provider,
    providerSubject: user.provider_subject ?? null,
    isActive: user.is_active,
    lastLoginAt: user.last_login_at,
    createdAt: user.created_at,
  };
}
```

- [ ] **Step 7: Run targeted auth tests**

Run:

```powershell
cd "C:\Users\suley\OneDrive\Masaüstü\WEBSİTE ÇALIŞMASI\backend\nestjs"
npm.cmd test -- src/modules/auth/auth-context.service.spec.ts test/integration/auth-role-assignments.e2e-spec.ts --runInBand
```

Expected:

```text
PASS src/modules/auth/auth-context.service.spec.ts
PASS test/integration/auth-role-assignments.e2e-spec.ts
```

## Task 3: Visual Merchandiser Role And Narrow Region Manager Scope

**Files:**

- Create: `db/migrations/042_visual_merchandiser_role.sql`
- Modify: `db/schema.sql`
- Modify: `backend/nestjs/src/modules/auth/role-catalog-contract.spec.ts`
- Modify: `backend/nestjs/src/modules/auth/providers/jwt-auth.provider.ts`
- Modify: `backend/nestjs/src/modules/auth/auth-role-scope-policy.service.ts`
- Modify: `backend/nestjs/src/modules/auth/auth-admin.service.ts`
- Modify: `infra/keycloak/store-ops-realm.json`
- Modify: `infra/scripts/setup-keycloak.ps1`

- [ ] **Step 1: Write failing role catalog contract**

Modify `expectedRoleScopes` in `backend/nestjs/src/modules/auth/role-catalog-contract.spec.ts`:

```ts
const expectedRoleScopes: Record<string, string> = {
  AUDITOR: "region",
  HR_ADMIN: "company",
  INTEGRATION_ADMIN: "company",
  REGION_MANAGER: "region",
  REPORT_VIEWER: "company",
  SNAPSHOT_OPERATOR: "company",
  STORE_MANAGER: "store",
  STORE_PERSONNEL: "store",
  SUPER_ADMIN: "company",
  VISUAL_MERCHANDISER: "store",
};
```

Add VM to the expected Keycloak demo roles through the existing expected role loop.

- [ ] **Step 2: Write failing scope policy test**

Add to an existing or new spec for `AuthRoleScopePolicyService`:

```ts
import { AuthRoleScopePolicyService } from "./auth-role-scope-policy.service";

describe("AuthRoleScopePolicyService", () => {
  const service = new AuthRoleScopePolicyService();

  it("allows region manager role assignments to be narrowed to store scope", () => {
    expect(() =>
      service.validateRoleScope({
        roleCode: "REGION_MANAGER",
        roleScopeType: "region",
        assignmentScopeType: "store",
      }),
    ).not.toThrow();
  });

  it("rejects report viewer assignments narrowed to store scope", () => {
    expect(() =>
      service.validateRoleScope({
        roleCode: "REPORT_VIEWER",
        roleScopeType: "company",
        assignmentScopeType: "store",
      }),
    ).toThrow("Role scope type does not match assignment scope");
  });
});
```

- [ ] **Step 3: Run red role tests**

Run:

```powershell
cd "C:\Users\suley\OneDrive\Masaüstü\WEBSİTE ÇALIŞMASI\backend\nestjs"
npm.cmd test -- src/modules/auth/role-catalog-contract.spec.ts src/modules/auth/auth-role-scope-policy.service.spec.ts --runInBand
```

Expected:

```text
FAIL role-catalog-contract
Expected: "store"
Received: undefined
```

- [ ] **Step 4: Add VM role migration**

Create `db/migrations/042_visual_merchandiser_role.sql`:

```sql
INSERT INTO ops.role (role_id, role_code, role_name, role_scope_type, description, is_system_role)
VALUES
    ('60000000-0000-0000-0000-000000000010', 'VISUAL_MERCHANDISER', 'Visual Merchandiser', 'store', 'Executes visual merchandising store checklist workflows for assigned stores', TRUE)
ON CONFLICT (role_code) DO UPDATE
SET
    role_name = EXCLUDED.role_name,
    role_scope_type = EXCLUDED.role_scope_type,
    description = EXCLUDED.description,
    is_system_role = EXCLUDED.is_system_role;

WITH grants(role_code, permission_code) AS (
    VALUES
        ('VISUAL_MERCHANDISER', 'store.read'),
        ('VISUAL_MERCHANDISER', 'reports.read'),
        ('VISUAL_MERCHANDISER', 'checklist.manage')
)
INSERT INTO ops.role_permission (role_id, permission_id)
SELECT role.role_id, permission.permission_id
FROM grants
INNER JOIN ops.role role
    ON role.role_code = grants.role_code
INNER JOIN ops.permission permission
    ON permission.permission_code = grants.permission_code
ON CONFLICT DO NOTHING;
```

- [ ] **Step 5: Align canonical schema role seed evidence**

If `db/schema.sql` includes seed comments or role catalog notes, add `VISUAL_MERCHANDISER` to the canonical role evidence section using the same pattern as the current role catalog migrations.

- [ ] **Step 6: Add VM to JWT app role filter**

Modify `APP_ROLE_CODES` in `backend/nestjs/src/modules/auth/providers/jwt-auth.provider.ts`:

```ts
const APP_ROLE_CODES = new Set([
  "AUDITOR",
  "HR_ADMIN",
  "INTEGRATION_ADMIN",
  "REGION_MANAGER",
  "REPORT_VIEWER",
  "SNAPSHOT_OPERATOR",
  "STORE_MANAGER",
  "STORE_PERSONNEL",
  "SUPER_ADMIN",
  "VISUAL_MERCHANDISER",
]);
```

- [ ] **Step 7: Implement narrow scope policy**

Modify `backend/nestjs/src/modules/auth/auth-role-scope-policy.service.ts`:

```ts
validateRoleScope(input: {
  roleCode: string;
  roleScopeType: string;
  assignmentScopeType: ScopeType;
}) {
  if (
    input.roleCode === "REGION_MANAGER" &&
    input.roleScopeType === "region" &&
    input.assignmentScopeType === "store"
  ) {
    return;
  }

  if (input.roleScopeType !== input.assignmentScopeType) {
    throw semanticValidation("Role scope type does not match assignment scope");
  }
}
```

Update the service call in `backend/nestjs/src/modules/auth/auth-admin.service.ts`:

```ts
this.authRoleScopePolicyService.validateRoleScope({
  roleCode: role.role_code,
  roleScopeType: role.role_scope_type,
  assignmentScopeType: input.scopeType,
});
```

- [ ] **Step 8: Add Keycloak local bootstrap role**

Modify `infra/keycloak/store-ops-realm.json` and add:

```json
{ "name": "VISUAL_MERCHANDISER", "description": "Visual merchandiser pilot role" }
```

Modify `infra/scripts/setup-keycloak.ps1` role bootstrap list to include:

```powershell
"VISUAL_MERCHANDISER"
```

- [ ] **Step 9: Run green role tests**

Run:

```powershell
cd "C:\Users\suley\OneDrive\Masaüstü\WEBSİTE ÇALIŞMASI\backend\nestjs"
npm.cmd test -- src/modules/auth/role-catalog-contract.spec.ts src/modules/auth/auth-role-scope-policy.service.spec.ts src/modules/auth/providers/jwt-auth.provider.spec.ts --runInBand
```

Expected:

```text
PASS src/modules/auth/role-catalog-contract.spec.ts
PASS src/modules/auth/auth-role-scope-policy.service.spec.ts
PASS src/modules/auth/providers/jwt-auth.provider.spec.ts
```

## Task 4: Pilot User Binding Backend Command

**Files:**

- Create: `backend/nestjs/src/modules/auth/web/dto/create-pilot-user-binding.dto.ts`
- Modify: `backend/nestjs/src/modules/auth/auth-admin.repository.ts`
- Modify: `backend/nestjs/src/modules/auth/auth-admin.service.ts`
- Modify: `backend/nestjs/src/modules/auth/web/auth-admin.controller.ts`
- Modify: `backend/nestjs/test/integration/auth-role-assignments.e2e-spec.ts`

- [ ] **Step 1: Write failing e2e test for store manager binding**

Add to `backend/nestjs/test/integration/auth-role-assignments.e2e-spec.ts`:

```ts
it("links a pilot store manager to an employee, role, and own store scope", async () => {
  const employeeId = "70000000-0000-4000-8000-000000000101";
  const providerSubject = "2f7b9d1e-8a41-4c7e-9d63-0d6b3c9a5f22";
  const createdUserId = "90000000-0000-4000-8000-000000000101";
  const query = jest.fn(async (sql: string) => {
    if (sql.includes("FROM ops.employee e") && sql.includes("ops.employee_assignment_history")) {
      return {
        rowCount: 1,
        rows: [{
          employee_id: employeeId,
          employee_code: "FM8375",
          first_name: "Ayse",
          last_name: "Demir",
          employment_status: "active",
          store_id: storeId,
          store_code: "SM140",
          store_name: "Marmara Park",
          company_id: companyId,
          region_id: regionId,
          position_code: "STORE_MANAGER",
        }],
      };
    }

    if (sql.includes("provider_subject = $2")) {
      return { rowCount: 0, rows: [] };
    }

    if (sql.includes("FROM ops.role r") && sql.includes("WHERE r.role_code = $1")) {
      return {
        rowCount: 1,
        rows: [{ role_id: "role-store-manager", role_code: "STORE_MANAGER", role_scope_type: "store", role_name: "Store Manager" }],
      };
    }

    if (sql.includes("INSERT INTO ops.user_account")) {
      return {
        rowCount: 1,
        rows: [{
          user_id: createdUserId,
          employee_id: employeeId,
          username: "ayse.demir",
          email: "ayse.demir@example.com",
          auth_provider: "oidc",
          provider_subject: providerSubject,
          is_active: true,
          last_login_at: null,
          created_at: "2026-04-29T18:30:00.000Z",
        }],
      };
    }

    if (sql.includes("active_assignment_count") || sql.includes("active_action_store_assignment_count")) {
      return { rowCount: 1, rows: [{ active_assignment_count: "0", active_action_store_assignment_count: "0" }] };
    }

    if (sql.includes("INSERT INTO ops.user_role_assignment")) {
      return {
        rowCount: 1,
        rows: [{
          user_role_assignment_id: assignmentId,
          user_id: createdUserId,
          role_code: "STORE_MANAGER",
          scope_type: "store",
          company_id: companyId,
          region_id: regionId,
          store_id: storeId,
          start_at: "2026-04-29T18:30:00.000Z",
          end_at: null,
          created_at: "2026-04-29T18:30:00.000Z",
        }],
      };
    }

    if (sql.includes("INSERT INTO ops.user_action_store_assignment")) {
      return {
        rowCount: 1,
        rows: [{
          user_action_store_assignment_id: actionStoreAssignmentId,
          user_id: createdUserId,
          username: "ayse.demir",
          email: "ayse.demir@example.com",
          store_id: storeId,
          store_code: "SM140",
          store_name: "Marmara Park",
          company_id: companyId,
          region_id: regionId,
          region_name: "Marmara",
          start_at: "2026-04-29T18:30:00.000Z",
          end_at: null,
          created_at: "2026-04-29T18:30:00.000Z",
        }],
      };
    }

    if (sql.includes("INSERT INTO audit.event_log")) {
      return { rowCount: 1, rows: [] };
    }

    return { rowCount: 0, rows: [] };
  });

  const app = await createIntegrationApp({
    databaseService: {
      query,
      withTransaction: async <T>(work: (client: { query: typeof query }) => Promise<T>) =>
        work({ query }),
    },
  });

  const response = await request(app.getHttpServer())
    .post("/api/auth/pilot-user-bindings")
    .set("x-user-id", adminUserId)
    .set("x-role-codes", "HR_ADMIN")
    .send({
      employeeId,
      authProvider: "oidc",
      providerSubject,
      username: "ayse.demir",
      email: "ayse.demir@example.com",
      roleCode: "STORE_MANAGER",
      storeIds: [storeId],
    });

  expect(response.status).toBe(201);
  expect(response.body.command).toEqual({
    status: "created",
    message: "Pilot user binding created",
  });
  expect(response.body.data.binding.roleAssignments).toHaveLength(1);
  expect(response.body.data.binding.actionStoreAssignments).toHaveLength(1);

  await app.close();
});
```

- [ ] **Step 2: Write failing duplicate provider subject test**

Add:

```ts
it("rejects duplicate provider subjects during pilot binding", async () => {
  const query = jest.fn(async (sql: string) => {
    if (sql.includes("provider_subject = $2")) {
      return {
        rowCount: 1,
        rows: [{ user_id: "90000000-0000-4000-8000-000000000099" }],
      };
    }

    return { rowCount: 0, rows: [] };
  });

  const app = await createIntegrationApp({
    databaseService: {
      query,
      withTransaction: async <T>(work: (client: { query: typeof query }) => Promise<T>) =>
        work({ query }),
    },
  });

  const response = await request(app.getHttpServer())
    .post("/api/auth/pilot-user-bindings")
    .set("x-user-id", adminUserId)
    .set("x-role-codes", "HR_ADMIN")
    .send({
      employeeId: "70000000-0000-4000-8000-000000000101",
      authProvider: "oidc",
      providerSubject: "2f7b9d1e-8a41-4c7e-9d63-0d6b3c9a5f22",
      username: "ayse.demir",
      email: "ayse.demir@example.com",
      roleCode: "STORE_MANAGER",
      storeIds: [storeId],
    });

  expect(response.status).toBe(409);

  await app.close();
});
```

- [ ] **Step 3: Write failing VM and region manager scope tests**

Add tests proving:

```text
VISUAL_MERCHANDISER with two storeIds creates two store-scoped role assignments and two action-store assignments.
REGION_MANAGER with two storeIds creates two store-scoped role assignments and two action-store assignments.
STORE_PERSONNEL roleCode is rejected.
Missing employee active assignment is rejected.
```

Use the same mocked SQL shape as the store manager test and assert the generated SQL includes `INSERT INTO ops.user_role_assignment` once per store id.

- [ ] **Step 4: Run red e2e test**

Run:

```powershell
cd "C:\Users\suley\OneDrive\Masaüstü\WEBSİTE ÇALIŞMASI\backend\nestjs"
npm.cmd test -- test/integration/auth-role-assignments.e2e-spec.ts --runInBand
```

Expected:

```text
POST /api/auth/pilot-user-bindings 404
```

- [ ] **Step 5: Add DTO**

Create `backend/nestjs/src/modules/auth/web/dto/create-pilot-user-binding.dto.ts`:

```ts
import { ArrayMaxSize, ArrayMinSize, IsArray, IsEmail, IsIn, IsString, MinLength } from "class-validator";
import { IsPostgresUuid } from "../../../../shared/validation/postgres-uuid";

export class CreatePilotUserBindingDto {
  @IsPostgresUuid()
  employeeId!: string;

  @IsIn(["oidc"])
  authProvider!: "oidc";

  @IsString()
  @MinLength(8)
  providerSubject!: string;

  @IsString()
  @MinLength(3)
  username!: string;

  @IsEmail()
  email!: string;

  @IsIn(["REGION_MANAGER", "STORE_MANAGER", "VISUAL_MERCHANDISER"])
  roleCode!: "REGION_MANAGER" | "STORE_MANAGER" | "VISUAL_MERCHANDISER";

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(5)
  @IsPostgresUuid({ each: true })
  storeIds!: string[];
}
```

- [ ] **Step 6: Add repository methods**

Add to `backend/nestjs/src/modules/auth/auth-admin.repository.ts`:

```ts
async getActiveEmployeeAccessContext(employeeId: string) {
  const result = await this.databaseService.query<{
    employee_id: string;
    employee_code: string | null;
    first_name: string;
    last_name: string;
    employment_status: string;
    store_id: string;
    store_code: string;
    store_name: string;
    company_id: string;
    region_id: string;
    position_code: string | null;
  }>(
    `
      SELECT
        e.employee_id,
        e.external_employee_ref AS employee_code,
        e.first_name,
        e.last_name,
        e.employment_status,
        s.store_id,
        s.store_code,
        s.store_name,
        s.company_id,
        s.region_id,
        p.position_code
      FROM ops.employee e
      INNER JOIN ops.employee_assignment_history eah
        ON eah.employee_id = e.employee_id
       AND eah.is_primary = TRUE
       AND eah.end_date IS NULL
      INNER JOIN ops.store s
        ON s.store_id = eah.store_id
      LEFT JOIN ops.position p
        ON p.position_id = eah.position_id
      WHERE e.employee_id = $1::uuid
        AND e.employment_status = 'active'
      LIMIT 1
    `,
    [employeeId],
  );

  return result.rows[0] ?? null;
}

async getUserAccountByProviderSubject(input: {
  authProvider: string;
  providerSubject: string;
}) {
  const result = await this.databaseService.query<{ user_id: string }>(
    `
      SELECT user_id
      FROM ops.user_account
      WHERE auth_provider = $1
        AND provider_subject = $2
      LIMIT 1
    `,
    [input.authProvider, input.providerSubject],
  );

  return result.rows[0] ?? null;
}
```

Add `createPilotUserBinding` as a transaction:

```ts
async createPilotUserBinding(input: {
  employeeId: string;
  authProvider: "oidc";
  providerSubject: string;
  username: string;
  email: string;
  roleCode: "REGION_MANAGER" | "STORE_MANAGER" | "VISUAL_MERCHANDISER";
  storeIds: string[];
  employee: {
    employee_id: string;
    employee_code: string | null;
    first_name: string;
    last_name: string;
    store_id: string;
    store_code: string;
    store_name: string;
    company_id: string;
    region_id: string;
  };
  actorUserId: string;
}) {
  return this.databaseService.withTransaction(async (client) => {
    const userResult = await client.query<UserAccountRow>(
      `
        INSERT INTO ops.user_account (
          employee_id,
          username,
          email,
          auth_provider,
          provider_subject
        ) VALUES (
          $1::uuid,
          $2,
          $3,
          $4,
          $5
        )
        RETURNING
          user_id,
          employee_id,
          username,
          email,
          auth_provider,
          provider_subject,
          is_active,
          last_login_at,
          created_at
      `,
      [
        input.employeeId,
        input.username,
        input.email,
        input.authProvider,
        input.providerSubject,
      ],
    );
    const user = userResult.rows[0];
    const role = await this.getRoleByCode(input.roleCode);

    if (!role) {
      throw new Error(`Role not found during pilot binding: ${input.roleCode}`);
    }

    const roleAssignments: RoleAssignmentRow[] = [];
    const actionStoreAssignments: ActionStoreAssignmentRow[] = [];

    for (const storeId of input.storeIds) {
      const store = await this.getStoreLookupById(storeId);

      if (!store) {
        throw new Error(`Store not found during pilot binding: ${storeId}`);
      }

      const roleAssignment = await client.query<RoleAssignmentRow>(
        `
          INSERT INTO ops.user_role_assignment (
            user_id,
            role_id,
            scope_type,
            company_id,
            region_id,
            store_id
          ) VALUES (
            $1::uuid,
            $2::uuid,
            'store',
            $3::uuid,
            $4::uuid,
            $5::uuid
          )
          RETURNING
            user_role_assignment_id,
            user_id,
            (SELECT role_code FROM ops.role WHERE role_id = $2::uuid) AS role_code,
            scope_type,
            company_id,
            region_id,
            store_id,
            start_at,
            end_at,
            created_at
        `,
        [user.user_id, role.role_id, store.company_id, store.region_id, store.store_id],
      );
      roleAssignments.push(roleAssignment.rows[0]);

      const actionAssignment = await client.query<ActionStoreAssignmentRow>(
        `
          INSERT INTO ops.user_action_store_assignment (
            user_id,
            store_id
          ) VALUES (
            $1::uuid,
            $2::uuid
          )
          RETURNING
            user_action_store_assignment_id,
            user_id,
            $3::text AS username,
            $4::text AS email,
            store_id,
            $5::text AS store_code,
            $6::text AS store_name,
            $7::uuid AS company_id,
            $8::uuid AS region_id,
            $9::text AS region_name,
            start_at,
            end_at,
            created_at
        `,
        [
          user.user_id,
          store.store_id,
          input.username,
          input.email,
          store.store_code,
          store.store_name,
          store.company_id,
          store.region_id,
          store.region_name,
        ],
      );
      actionStoreAssignments.push(actionAssignment.rows[0]);
    }

    await client.query(
      `
        INSERT INTO audit.event_log (
          actor_user_id,
          event_type,
          entity_name,
          entity_id,
          scope_type,
          company_id,
          region_id,
          store_id,
          metadata
        ) VALUES (
          $1::uuid,
          'user_account.linked_to_employee',
          'ops.user_account',
          $2::uuid,
          'store',
          $3::uuid,
          $4::uuid,
          $5::uuid,
          $6::jsonb
        )
      `,
      [
        input.actorUserId,
        user.user_id,
        input.employee.company_id,
        input.employee.region_id,
        input.storeIds[0],
        JSON.stringify({
          sourceContext: {
            module: "auth-admin",
            operation: "create-pilot-user-binding",
          },
          changedFields: ["employeeId", "authProvider", "providerSubject", "roleCode", "storeIds"],
          details: {
            employeeId: input.employeeId,
            authProvider: input.authProvider,
            roleCode: input.roleCode,
            storeIds: input.storeIds,
          },
        }),
      ],
    );

    return {
      user,
      employee: input.employee,
      roleAssignments,
      actionStoreAssignments,
    };
  });
}
```

- [ ] **Step 7: Add service command**

Add to `backend/nestjs/src/modules/auth/auth-admin.service.ts`:

```ts
async createPilotUserBinding(input: {
  employeeId: string;
  authProvider: "oidc";
  providerSubject: string;
  username: string;
  email: string;
  roleCode: "REGION_MANAGER" | "STORE_MANAGER" | "VISUAL_MERCHANDISER";
  storeIds: string[];
  actorUserId: string;
}) {
  const existingProviderUser = await this.authAdminRepository.getUserAccountByProviderSubject({
    authProvider: input.authProvider,
    providerSubject: input.providerSubject.trim(),
  });

  if (existingProviderUser) {
    throw new ConflictException("Provider subject is already linked to a user account");
  }

  const employee = await this.authAdminRepository.getActiveEmployeeAccessContext(input.employeeId);

  if (!employee) {
    throw new NotFoundException(`Active employee assignment not found: ${input.employeeId}`);
  }

  if (input.roleCode === "STORE_MANAGER" && input.storeIds.length !== 1) {
    throw semanticValidation("STORE_MANAGER pilot binding must target exactly one store");
  }

  if (input.roleCode === "STORE_MANAGER" && input.storeIds[0] !== employee.store_id) {
    throw semanticValidation("STORE_MANAGER pilot binding must use the employee active store");
  }

  const binding = await this.authAdminRepository.createPilotUserBinding({
    ...input,
    providerSubject: input.providerSubject.trim(),
    employee,
    actorUserId: input.actorUserId,
  });

  return buildCommandResponse({
    status: "created",
    message: "Pilot user binding created",
    data: {
      binding: this.mapPilotUserBinding(binding),
    },
  });
}
```

- [ ] **Step 8: Add controller endpoint**

Modify `backend/nestjs/src/modules/auth/web/auth-admin.controller.ts`:

```ts
import { CreatePilotUserBindingDto } from "./dto/create-pilot-user-binding.dto";
```

Add:

```ts
@Post("pilot-user-bindings")
@RequireRoles("SUPER_ADMIN", "HR_ADMIN")
async createPilotUserBinding(
  @Req()
  request: {
    user: {
      userId: string;
    };
  },
  @Body() body: CreatePilotUserBindingDto,
) {
  return this.authAdminService.createPilotUserBinding({
    ...body,
    actorUserId: request.user.userId,
  });
}
```

- [ ] **Step 9: Run green backend binding tests**

Run:

```powershell
cd "C:\Users\suley\OneDrive\Masaüstü\WEBSİTE ÇALIŞMASI\backend\nestjs"
npm.cmd test -- test/integration/auth-role-assignments.e2e-spec.ts --runInBand
```

Expected:

```text
PASS test/integration/auth-role-assignments.e2e-spec.ts
```

## Task 5: VM Checklist Role Boundary Guard

**Files:**

- Modify: `backend/nestjs/src/modules/store-ops/web/mobile-checklist.controller.ts`
- Modify: `backend/nestjs/test/integration/mobile-checklist-today.e2e-spec.ts`

- [ ] **Step 1: Write failing VM role guard test**

In `backend/nestjs/test/integration/mobile-checklist-today.e2e-spec.ts`, add a test proving `VISUAL_MERCHANDISER` can read the checklist today surface for assigned stores but cannot use BM/region-manager completion endpoints until VM checklist type is explicitly supported.

Use these assertions:

```ts
expect(todayResponse.status).toBe(200);
expect(startBmChecklistResponse.status).toBe(403);
```

- [ ] **Step 2: Run red checklist test**

Run:

```powershell
cd "C:\Users\suley\OneDrive\Masaüstü\WEBSİTE ÇALIŞMASI\backend\nestjs"
npm.cmd test -- test/integration/mobile-checklist-today.e2e-spec.ts --runInBand
```

Expected:

```text
VISUAL_MERCHANDISER role is not handled in checklist today route
```

- [ ] **Step 3: Allow VM read only**

Modify `backend/nestjs/src/modules/store-ops/web/mobile-checklist.controller.ts`:

```ts
@Get("today")
@RequireScope("authenticated")
@RequireRoles("REGION_MANAGER", "STORE_MANAGER", "VISUAL_MERCHANDISER", "SUPER_ADMIN")
async getToday(...)
```

Keep mutation endpoints as:

```ts
@RequireRoles("REGION_MANAGER", "SUPER_ADMIN")
```

Do not add `VISUAL_MERCHANDISER` to start/save/complete mutation endpoints in this V1. VM checklist implementation needs a separate checklist-type guard before mutation opens.

- [ ] **Step 4: Run green checklist boundary test**

Run:

```powershell
cd "C:\Users\suley\OneDrive\Masaüstü\WEBSİTE ÇALIŞMASI\backend\nestjs"
npm.cmd test -- test/integration/mobile-checklist-today.e2e-spec.ts --runInBand
```

Expected:

```text
PASS test/integration/mobile-checklist-today.e2e-spec.ts
```

## Task 6: HR/Admin Pilot Binding UI

**Files:**

- Modify: `admin-web/src/features/auth/api.ts`
- Create: `admin-web/src/features/auth/PilotUserBindingPanel.tsx`
- Modify: `admin-web/src/pages/AuthDashboardPage.tsx`
- Create: `admin-web/e2e/auth-admin-surfaces.spec.ts`

- [ ] **Step 1: Add API types**

Modify `admin-web/src/features/auth/api.ts`:

```ts
export type PilotUserBinding = {
  user: UserAccount
  roleAssignments: RoleAssignment[]
  actionStoreAssignments: ActionStoreAssignment[]
  employee: {
    employeeId: string
    employeeCode: string | null
    firstName: string
    lastName: string
    storeId: string
    storeCode: string
    storeName: string
  }
}

export async function createPilotUserBinding(input: {
  employeeId: string
  authProvider: 'oidc'
  providerSubject: string
  username: string
  email: string
  roleCode: 'REGION_MANAGER' | 'STORE_MANAGER' | 'VISUAL_MERCHANDISER'
  storeIds: string[]
}) {
  return sendJson<CommandResponse<{ binding: PilotUserBinding }>>('/auth/pilot-user-bindings', {
    method: 'POST',
    body: input,
  })
}
```

- [ ] **Step 2: Write Playwright red test**

Create `admin-web/e2e/auth-admin-surfaces.spec.ts`:

```ts
import { expect, test } from '@playwright/test'

test('HR admin can submit a pilot user binding', async ({ page }) => {
  await page.route('**/api/auth/lookups', async (route) => {
    await route.fulfill({
      json: {
        scopeTypes: ['company', 'region', 'store'],
        authProviders: ['oidc'],
        users: [],
        roles: [
          { roleId: 'role-store-manager', roleCode: 'STORE_MANAGER', roleName: 'Store Manager', scopeType: 'store' },
          { roleId: 'role-region-manager', roleCode: 'REGION_MANAGER', roleName: 'Region Manager', scopeType: 'region' },
          { roleId: 'role-vm', roleCode: 'VISUAL_MERCHANDISER', roleName: 'Visual Merchandiser', scopeType: 'store' },
        ],
        permissions: [],
        stores: [
          {
            storeId: '10000000-0000-4000-8000-000000000021',
            storeCode: 'SM140',
            storeName: 'Marmara Park',
            companyId: '10000000-0000-4000-8000-000000000001',
            regionId: '10000000-0000-4000-8000-000000000011',
            regionName: 'Marmara',
          },
        ],
        optionGroups: {
          users: [],
          roles: [],
          permissions: [],
          stores: [],
          scopeTypes: [],
          authProviders: [],
        },
        meta: { totalUsers: 0, totalRoles: 3, totalPermissions: 0, totalStores: 1 },
      },
    })
  })
  await page.route('**/api/auth/users?**', async (route) => {
    await route.fulfill({ json: { items: [], meta: { count: 0, total: 0, limit: 50, offset: 0 } } })
  })
  await page.route('**/api/auth/role-assignments?**', async (route) => {
    await route.fulfill({ json: { items: [], meta: { count: 0, total: 0, limit: 50, offset: 0 } } })
  })
  await page.route('**/api/auth/action-store-assignments?**', async (route) => {
    await route.fulfill({ json: { items: [], meta: { count: 0, total: 0, limit: 50, offset: 0 } } })
  })

  let requestBody: Record<string, unknown> | null = null
  await page.route('**/api/auth/pilot-user-bindings', async (route) => {
    requestBody = route.request().postDataJSON()
    await route.fulfill({
      status: 201,
      json: {
        command: { status: 'created', message: 'Pilot user binding created' },
        data: {
          binding: {
            user: {
              userId: '90000000-0000-4000-8000-000000000101',
              employeeId: '70000000-0000-4000-8000-000000000101',
              username: 'ayse.demir',
              email: 'ayse.demir@example.com',
              authProvider: 'oidc',
              providerSubject: '2f7b9d1e-8a41-4c7e-9d63-0d6b3c9a5f22',
              isActive: true,
              lastLoginAt: null,
              createdAt: '2026-04-29T18:30:00.000Z',
            },
            roleAssignments: [],
            actionStoreAssignments: [],
            employee: {
              employeeId: '70000000-0000-4000-8000-000000000101',
              employeeCode: 'FM8375',
              firstName: 'Ayse',
              lastName: 'Demir',
              storeId: '10000000-0000-4000-8000-000000000021',
              storeCode: 'SM140',
              storeName: 'Marmara Park',
            },
          },
        },
      },
    })
  })

  await page.goto('/admin/auth')
  await expect(page.getByRole('heading', { name: 'Pilot user binding' })).toBeVisible()
  await page.getByLabel('Employee id').fill('70000000-0000-4000-8000-000000000101')
  await page.getByLabel('Provider subject').fill('2f7b9d1e-8a41-4c7e-9d63-0d6b3c9a5f22')
  await page.getByLabel('Username').fill('ayse.demir')
  await page.getByLabel('Email').fill('ayse.demir@example.com')
  await page.getByLabel('Pilot role').selectOption('STORE_MANAGER')
  await page.getByLabel('Pilot stores').selectOption('10000000-0000-4000-8000-000000000021')
  await page.getByRole('button', { name: 'Create pilot binding' }).click()

  await expect(page.getByText('Pilot user binding created')).toBeVisible()
  expect(requestBody?.roleCode).toBe('STORE_MANAGER')
  expect(requestBody?.storeIds).toEqual(['10000000-0000-4000-8000-000000000021'])
})
```

- [ ] **Step 3: Run red Playwright test**

Run:

```powershell
cd "C:\Users\suley\OneDrive\Masaüstü\WEBSİTE ÇALIŞMASI\admin-web"
npm.cmd run test:e2e -- e2e/auth-admin-surfaces.spec.ts
```

Expected:

```text
Error: heading "Pilot user binding" not visible
```

- [ ] **Step 4: Create PilotUserBindingPanel component**

Create `admin-web/src/features/auth/PilotUserBindingPanel.tsx` with:

```tsx
import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createPilotUserBinding, type AuthLookupStore } from './api'
import { getErrorMessage } from '../../lib/format'

type PilotRole = 'REGION_MANAGER' | 'STORE_MANAGER' | 'VISUAL_MERCHANDISER'

export function PilotUserBindingPanel({ stores }: { stores: AuthLookupStore[] }) {
  const queryClient = useQueryClient()
  const [employeeId, setEmployeeId] = useState('')
  const [providerSubject, setProviderSubject] = useState('')
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [roleCode, setRoleCode] = useState<PilotRole>('STORE_MANAGER')
  const [storeIds, setStoreIds] = useState<string[]>([])
  const [feedback, setFeedback] = useState<string | null>(null)
  const [errorFeedback, setErrorFeedback] = useState<string | null>(null)

  const mutation = useMutation({
    mutationFn: createPilotUserBinding,
    onSuccess: async (response) => {
      setFeedback(response.command.message)
      setErrorFeedback(null)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['auth-users'] }),
        queryClient.invalidateQueries({ queryKey: ['auth-lookups'] }),
        queryClient.invalidateQueries({ queryKey: ['auth-role-assignments'] }),
        queryClient.invalidateQueries({ queryKey: ['auth-action-store-assignments'] }),
      ])
    },
    onError: (error) => {
      setFeedback(null)
      setErrorFeedback(getErrorMessage(error))
    },
  })

  return (
    <article className="panel">
      <div className="panel-heading">
        <div>
          <div className="eyebrow">Pilot access</div>
          <h3>Pilot user binding</h3>
        </div>
      </div>
      {feedback ? <div className="inline-state inline-state-accent">{feedback}</div> : null}
      {errorFeedback ? <div className="inline-state inline-state-danger">{errorFeedback}</div> : null}
      <div className="form-grid">
        <label className="field-block">
          <span>Employee id</span>
          <input aria-label="Employee id" value={employeeId} onChange={(event) => setEmployeeId(event.target.value)} />
        </label>
        <label className="field-block">
          <span>Provider subject</span>
          <input aria-label="Provider subject" value={providerSubject} onChange={(event) => setProviderSubject(event.target.value)} />
        </label>
        <label className="field-block">
          <span>Username</span>
          <input aria-label="Username" value={username} onChange={(event) => setUsername(event.target.value)} />
        </label>
        <label className="field-block">
          <span>Email</span>
          <input aria-label="Email" value={email} onChange={(event) => setEmail(event.target.value)} />
        </label>
        <label className="field-block">
          <span>Pilot role</span>
          <select aria-label="Pilot role" value={roleCode} onChange={(event) => setRoleCode(event.target.value as PilotRole)}>
            <option value="STORE_MANAGER">STORE_MANAGER</option>
            <option value="REGION_MANAGER">REGION_MANAGER</option>
            <option value="VISUAL_MERCHANDISER">VISUAL_MERCHANDISER</option>
          </select>
        </label>
        <label className="field-block">
          <span>Pilot stores</span>
          <select
            aria-label="Pilot stores"
            multiple
            value={storeIds}
            onChange={(event) => {
              setStoreIds(Array.from(event.currentTarget.selectedOptions).map((option) => option.value))
            }}
          >
            {stores.map((store) => (
              <option key={store.storeId} value={store.storeId}>
                {store.storeCode} - {store.storeName}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="action-cluster">
        <button
          className="control-button"
          type="button"
          disabled={
            mutation.isPending ||
            !employeeId.trim() ||
            !providerSubject.trim() ||
            !username.trim() ||
            !email.trim() ||
            storeIds.length === 0
          }
          onClick={() => {
            mutation.mutate({
              employeeId: employeeId.trim(),
              authProvider: 'oidc',
              providerSubject: providerSubject.trim(),
              username: username.trim(),
              email: email.trim(),
              roleCode,
              storeIds,
            })
          }}
        >
          {mutation.isPending ? 'Creating...' : 'Create pilot binding'}
        </button>
      </div>
    </article>
  )
}
```

- [ ] **Step 5: Mount panel**

Modify `admin-web/src/pages/AuthDashboardPage.tsx`:

```tsx
import { PilotUserBindingPanel } from '../features/auth/PilotUserBindingPanel'
```

Place above the existing two-up grid:

```tsx
<PilotUserBindingPanel stores={lookups.stores} />
```

- [ ] **Step 6: Run green Playwright test**

Run:

```powershell
cd "C:\Users\suley\OneDrive\Masaüstü\WEBSİTE ÇALIŞMASI\admin-web"
npm.cmd run test:e2e -- e2e/auth-admin-surfaces.spec.ts
```

Expected:

```text
1 passed
```

## Task 7: Documentation, Verification, And Commit

**Files:**

- Modify: `docs/plans/project-debt-ledger.md`
- Modify: `current-state.md`
- Modify: `docs/superpowers/plans/2026-04-29-user-account-role-assignment-v1.md`

- [ ] **Step 1: Update debt ledger**

After all targeted tests and release gates pass, update `docs/plans/project-debt-ledger.md`:

```text
Closed active debts: 58
```

Add closed item:

```text
58. User Account / Role Assignment V1
```

Add evidence paragraph:

```text
User Account / Role Assignment V1 is counted as paid because HR/Admin can link selected pilot employees to existing Keycloak/OIDC provider subjects, assign one primary role, grant exact pilot store scope, use VISUAL_MERCHANDISER as a bounded store-scoped role, and resolve JWT subject claims to internal app users before DB role/scope authorization. Targeted backend/frontend checks plus root check:release pass.
```

- [ ] **Step 2: Update current-state**

Add a section:

```markdown
## Son User Account / Role Assignment V1 Implementation

29 Nisan 2026 itibariyla pilot kullanici hesabi, rol ve store scope baglama akisi uygulandi.

Eklenenler:

- `ops.user_account.provider_subject` provider-subject mapping alanı eklendi.
- JWT `sub` degeri internal app user lookup ile `ops.user_account.user_id` kaydina cozulur.
- `VISUAL_MERCHANDISER` store-scoped rol olarak eklendi.
- `REGION_MANAGER` pilotta store-scoped dar role assignment ile iki magazaya indirgenebilir hale geldi.
- HR/Admin `POST /api/auth/pilot-user-bindings` ile employee, provider subject, tek rol ve store scope baglar.
- Admin auth yuzeyinde pilot user binding paneli eklendi.

Dogrulama:

- Backend targeted auth tests.
- Frontend targeted auth Playwright test.
- Root `npm.cmd run check:release`.

CODEX durust yorum:

- Bu parca pilotu guvenli acacak kapidir. Keycloak kimlik kapisi olarak kaldi; yetki ve scope bizim DB tarafinda izlenebilir hale geldi.

Siradaki mantikli adim: gercek pilot kullanicilari Keycloak'ta manuel olusturup HR_ADMIN yuzeyinden 1 bolge muduru, 2 magaza muduru ve 1 visual merchandiser baglama smoke'u yapmak.
```

- [ ] **Step 3: Run backend targeted checks**

Run:

```powershell
cd "C:\Users\suley\OneDrive\Masaüstü\WEBSİTE ÇALIŞMASI\backend\nestjs"
npm.cmd test -- src/modules/auth/user-account-provider-subject-schema-contract.spec.ts src/modules/auth/role-catalog-contract.spec.ts src/modules/auth/auth-role-scope-policy.service.spec.ts src/modules/auth/auth-context.service.spec.ts test/integration/auth-role-assignments.e2e-spec.ts test/integration/mobile-checklist-today.e2e-spec.ts --runInBand
npm.cmd run lint
npm.cmd run build
```

Expected:

```text
PASS targeted auth/checklist suites
backend lint passes
backend build passes
```

- [ ] **Step 4: Run frontend targeted checks**

Run:

```powershell
cd "C:\Users\suley\OneDrive\Masaüstü\WEBSİTE ÇALIŞMASI\admin-web"
npm.cmd run lint
npm.cmd run build
npm.cmd run test:e2e -- e2e/auth-admin-surfaces.spec.ts
```

Expected:

```text
frontend lint passes
frontend build passes
1 Playwright test passes
```

- [ ] **Step 5: Run root release gate**

Run:

```powershell
cd "C:\Users\suley\OneDrive\Masaüstü\WEBSİTE ÇALIŞMASI"
npm.cmd run check:release
```

Expected:

```text
root script tests pass
backend check:release passes
frontend check:release passes
production audits pass
```

- [ ] **Step 6: Commit**

Run:

```powershell
git status --short
git add -- db/migrations/041_user_account_provider_subject.sql db/migrations/042_visual_merchandiser_role.sql db/schema.sql backend/nestjs/src/modules/auth backend/nestjs/test/integration/auth-role-assignments.e2e-spec.ts backend/nestjs/test/integration/mobile-checklist-today.e2e-spec.ts infra/keycloak/store-ops-realm.json infra/scripts/setup-keycloak.ps1 admin-web/src/features/auth admin-web/src/pages/AuthDashboardPage.tsx admin-web/e2e/auth-admin-surfaces.spec.ts docs/plans/project-debt-ledger.md current-state.md docs/superpowers/plans/2026-04-29-user-account-role-assignment-v1.md
git commit -m "feat: add pilot user role assignment"
```

Expected:

```text
working tree clean except pre-existing untracked outputs/
```

## Self-Review

- Spec coverage: identity binding, Keycloak manual user creation, pilot users, single role, store scope, VM boundary, deactivation, audit, backend and frontend surfaces are mapped to tasks.
- Placeholder scan: no `TBD`, `TODO`, or missing implementation step is left in the plan.
- Type consistency: role codes use `REGION_MANAGER`, `STORE_MANAGER`, and `VISUAL_MERCHANDISER`; provider code uses existing `oidc`; canonical identity field is `providerSubject` in TypeScript and `provider_subject` in SQL.
- Scope risk: region manager broad-read risk is handled by explicit store-scoped `REGION_MANAGER` assignment policy instead of region-wide read scope.

## Execution Recommendation

Use inline execution with checkpoints for this plan. The auth model changes are tightly coupled enough that splitting across multiple agents would create unnecessary merge risk.
