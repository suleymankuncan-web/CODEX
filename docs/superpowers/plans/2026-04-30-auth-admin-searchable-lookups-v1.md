# Auth Admin Searchable Lookups V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:test-driven-development, then superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add backend searchable auth-admin user and store lookup endpoints without changing the existing bundled `/api/auth/lookups` contract.

**Architecture:** Keep current auth-admin controller/service/repository structure. Add a small query DTO, two controller routes, two service methods, two repository methods, and targeted e2e coverage. Do not add migrations, indexes, frontend wiring, or auth policy changes in V1.

**Tech Stack:** NestJS, TypeScript, class-validator DTOs, PostgreSQL via existing `DatabaseService`, Jest + Supertest e2e, root script guards, root release gate.

---

## Source Spec

Implementation must follow:

- `docs/superpowers/specs/2026-04-30-auth-admin-searchable-lookups-v1-design.md`

Locked decisions:

- Existing `GET /api/auth/lookups` remains compatible.
- V1 adds backend search only for users and stores.
- Invalid or above-max limit is rejected, not clamped.
- `providerSubject` is returned for user lookup evidence.
- Frontend wiring is not included in this implementation plan.
- No schema/index migration is included.

## File Map

Create:

- `backend/nestjs/src/modules/auth/web/dto/search-auth-lookup.query.ts`

Modify:

- `backend/nestjs/src/modules/auth/web/auth-admin.controller.ts`
- `backend/nestjs/src/modules/auth/auth-admin.service.ts`
- `backend/nestjs/src/modules/auth/auth-admin.repository.ts`
- `backend/nestjs/test/integration/auth-lookups.e2e-spec.ts`
- `current-state.md`
- `docs/plans/project-debt-ledger.md`
- `docs/plans/project-risk-scan-2026-04-30.md`
- `docs/superpowers/plans/2026-04-30-auth-admin-searchable-lookups-v1.md`

Do not modify:

- `db/schema.sql`
- `db/migrations/*`
- `backend/nestjs/src/modules/auth/auth-authorization.repository.ts`
- `backend/nestjs/src/modules/auth/auth-context.service.ts`
- `backend/nestjs/src/modules/auth/auth-admin.module.ts` unless build proves provider registration is needed
- `backend/nestjs/src/modules/auth/auth-role-scope-policy.service.ts`
- `backend/nestjs/src/modules/auth/web/dto/create-role-assignment.dto.ts`
- `backend/nestjs/src/modules/auth/web/dto/create-pilot-user-binding.dto.ts`
- `admin-web/*`
- `infra/keycloak/*`

## Response Contracts

User search endpoint:

```http
GET /api/auth/lookups/users/search?q=<text>&limit=20
```

Response:

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

Store search endpoint:

```http
GET /api/auth/lookups/stores/search?q=<text>&limit=20
```

Response:

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

## Task 1: Add Search DTO With Validation

**Files:**

- Create: `backend/nestjs/src/modules/auth/web/dto/search-auth-lookup.query.ts`

- [ ] **Step 1: Write the DTO**

Create the file:

```ts
import { Transform, Type } from "class-transformer";
import { IsInt, IsOptional, IsString, Max, Min, MinLength } from "class-validator";

export class SearchAuthLookupQueryDto {
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @MinLength(2)
  q!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit = 20;
}
```

Notes:

- `q` trimming belongs in DTO so service/repository receive canonical query text.
- `limit > 50` must fail validation.
- Do not add default offset or pagination in V1.

- [ ] **Step 2: Run build to catch DTO import issues after wiring**

Do not run yet if no files import this DTO. Build is part of Task 4 after controller wiring.

## Task 2: Add Failing E2E Coverage

**Files:**

- Modify: `backend/nestjs/test/integration/auth-lookups.e2e-spec.ts`

- [ ] **Step 1: Add user search success test**

Append this test inside `describe("Auth lookups", () => { ... })`:

```ts
  it("searches active auth users by username email or provider subject", async () => {
    const query = jest.fn(async (sql: string, params?: unknown[]) => {
      if (sql.includes("FROM ops.user_account") && sql.includes("provider_subject") && sql.includes("ILIKE")) {
        expect(params).toEqual(["%manager%", 20]);
        return {
          rowCount: 1,
          rows: [
            {
              user_id: pilotUserId,
              username: "store.manager",
              email: "store.manager@example.com",
              auth_provider: "oidc",
              provider_subject: pilotProviderSubject,
            },
          ],
        };
      }

      return { rowCount: 0, rows: [] };
    });

    const app = await createIntegrationApp({ databaseService: { query } });

    const response = await request(app.getHttpServer())
      .get("/api/auth/lookups/users/search?q= manager &limit=20")
      .set("x-user-id", adminUserId)
      .set("x-role-codes", "SUPER_ADMIN");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      items: [
        {
          userId: pilotUserId,
          username: "store.manager",
          email: "store.manager@example.com",
          authProvider: "oidc",
          providerSubject: pilotProviderSubject,
        },
      ],
      meta: {
        query: "manager",
        count: 1,
        limit: 20,
      },
    });

    await app.close();
  });
```

- [ ] **Step 2: Add user search validation test**

Append:

```ts
  it("rejects too-short auth user lookup queries", async () => {
    const app = await createIntegrationApp({
      databaseService: {
        query: jest.fn(async () => ({ rowCount: 0, rows: [] })),
      },
    });

    const response = await request(app.getHttpServer())
      .get("/api/auth/lookups/users/search?q=a")
      .set("x-user-id", adminUserId)
      .set("x-role-codes", "SUPER_ADMIN");

    expect(response.status).toBe(400);

    await app.close();
  });
```

- [ ] **Step 3: Add user limit validation test**

Append:

```ts
  it("rejects above-max auth user lookup limits", async () => {
    const app = await createIntegrationApp({
      databaseService: {
        query: jest.fn(async () => ({ rowCount: 0, rows: [] })),
      },
    });

    const response = await request(app.getHttpServer())
      .get("/api/auth/lookups/users/search?q=manager&limit=51")
      .set("x-user-id", adminUserId)
      .set("x-role-codes", "SUPER_ADMIN");

    expect(response.status).toBe(400);

    await app.close();
  });
```

- [ ] **Step 4: Add store search success test**

Append:

```ts
  it("searches active stores by code name or region", async () => {
    const query = jest.fn(async (sql: string, params?: unknown[]) => {
      if (sql.includes("FROM ops.store s") && sql.includes("ILIKE")) {
        expect(params).toEqual(["%marmara%", 20]);
        return {
          rowCount: 1,
          rows: [
            {
              store_id: storeId,
              store_code: "SM140",
              store_name: "Marmara Park",
              company_id: companyId,
              region_id: regionId,
              region_name: "Marmara",
            },
          ],
        };
      }

      return { rowCount: 0, rows: [] };
    });

    const app = await createIntegrationApp({ databaseService: { query } });

    const response = await request(app.getHttpServer())
      .get("/api/auth/lookups/stores/search?q=marmara&limit=20")
      .set("x-user-id", adminUserId)
      .set("x-role-codes", "SUPER_ADMIN");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      items: [
        {
          storeId,
          storeCode: "SM140",
          storeName: "Marmara Park",
          companyId,
          regionId,
          regionName: "Marmara",
        },
      ],
      meta: {
        query: "marmara",
        count: 1,
        limit: 20,
      },
    });

    await app.close();
  });
```

- [ ] **Step 5: Add store search validation test**

Append:

```ts
  it("rejects too-short store lookup queries", async () => {
    const app = await createIntegrationApp({
      databaseService: {
        query: jest.fn(async () => ({ rowCount: 0, rows: [] })),
      },
    });

    const response = await request(app.getHttpServer())
      .get("/api/auth/lookups/stores/search?q=s")
      .set("x-user-id", adminUserId)
      .set("x-role-codes", "SUPER_ADMIN");

    expect(response.status).toBe(400);

    await app.close();
  });
```

- [ ] **Step 6: Run tests and verify RED**

Run:

```powershell
cd "C:\Users\suley\OneDrive\Masaüstü\WEBSİTE ÇALIŞMASI\backend\nestjs"
npm.cmd test -- --runInBand test/integration/auth-lookups.e2e-spec.ts
```

Expected:

- existing bundled lookup test passes,
- new search tests fail with missing route or validation not wired,
- failure is due to missing implementation, not TypeScript syntax.

## Task 3: Implement Controller And Service Search Methods

**Files:**

- Modify: `backend/nestjs/src/modules/auth/web/auth-admin.controller.ts`
- Modify: `backend/nestjs/src/modules/auth/auth-admin.service.ts`

- [ ] **Step 1: Import the query DTO**

In `auth-admin.controller.ts`, add:

```ts
import { SearchAuthLookupQueryDto } from "./dto/search-auth-lookup.query";
```

- [ ] **Step 2: Add controller routes below `getAuthLookups`**

Add:

```ts
  @Get("lookups/users/search")
  async searchAuthUsers(@Query() query: SearchAuthLookupQueryDto) {
    return this.authAdminService.searchAuthUsers({
      query: query.q,
      limit: query.limit,
    });
  }

  @Get("lookups/stores/search")
  async searchAuthStores(@Query() query: SearchAuthLookupQueryDto) {
    return this.authAdminService.searchAuthStores({
      query: query.q,
      limit: query.limit,
    });
  }
```

Do not alter `@RequireRoles("SUPER_ADMIN")`.

- [ ] **Step 3: Add service methods below `getAuthLookups`**

In `auth-admin.service.ts`, add:

```ts
  async searchAuthUsers(input: { query: string; limit: number }) {
    const rows = await this.authAdminRepository.searchActiveUserLookups(input);
    const items = rows.map((item) => ({
      userId: item.user_id,
      username: item.username,
      email: item.email,
      authProvider: item.auth_provider,
      providerSubject: item.provider_subject,
    }));

    return {
      items,
      meta: {
        query: input.query,
        count: items.length,
        limit: input.limit,
      },
    };
  }

  async searchAuthStores(input: { query: string; limit: number }) {
    const rows = await this.authAdminRepository.searchActiveStoreLookups(input);
    const items = rows.map((item) => ({
      storeId: item.store_id,
      storeCode: item.store_code,
      storeName: item.store_name,
      companyId: item.company_id,
      regionId: item.region_id,
      regionName: item.region_name,
    }));

    return {
      items,
      meta: {
        query: input.query,
        count: items.length,
        limit: input.limit,
      },
    };
  }
```

Do not change existing `getAuthLookups()`.

## Task 4: Implement Repository Search Methods

**Files:**

- Modify: `backend/nestjs/src/modules/auth/auth-admin.repository.ts`

- [ ] **Step 1: Add user search method after `listActiveUserLookups`**

Add:

```ts
  async searchActiveUserLookups(input: { query: string; limit: number }) {
    const searchTerm = `%${input.query}%`;
    const result = await this.databaseService.query<{
      user_id: string;
      username: string;
      email: string;
      auth_provider: string;
      provider_subject: string | null;
    }>(
      `
        SELECT user_id, username, email, auth_provider, provider_subject
        FROM ops.user_account
        WHERE is_active = TRUE
          AND (
            username ILIKE $1
            OR email ILIKE $1
            OR provider_subject ILIKE $1
          )
        ORDER BY username ASC, user_id ASC
        LIMIT $2
      `,
      [searchTerm, input.limit],
    );

    return result.rows;
  }
```

Security note:

- Do not select `password_hash`, `last_login_at`, or inactive users.

- [ ] **Step 2: Add store search method after `listActiveStoreLookups`**

Add:

```ts
  async searchActiveStoreLookups(input: { query: string; limit: number }) {
    const searchTerm = `%${input.query}%`;
    const result = await this.databaseService.query<StoreLookupRow>(
      `
        SELECT
          s.store_id,
          s.store_code,
          s.store_name,
          s.company_id,
          s.region_id,
          r.region_name
        FROM ops.store s
        INNER JOIN ops.region r ON r.region_id = s.region_id
        WHERE s.status = 'active'
          AND (
            s.store_code ILIKE $1
            OR s.store_name ILIKE $1
            OR r.region_name ILIKE $1
          )
        ORDER BY s.store_code ASC, s.store_id ASC
        LIMIT $2
      `,
      [searchTerm, input.limit],
    );

    return result.rows;
  }
```

Security note:

- Do not return inactive stores.
- Do not add DB indexes or migrations in this task.

- [ ] **Step 3: Run targeted auth lookup test and verify GREEN**

Run:

```powershell
cd "C:\Users\suley\OneDrive\Masaüstü\WEBSİTE ÇALIŞMASI\backend\nestjs"
npm.cmd test -- --runInBand test/integration/auth-lookups.e2e-spec.ts
```

Expected:

- all auth lookup tests pass.

## Task 5: Targeted And Release Verification

**Files:**

- No code changes expected.

- [ ] **Step 1: Run auth lookup tests**

```powershell
cd "C:\Users\suley\OneDrive\Masaüstü\WEBSİTE ÇALIŞMASI\backend\nestjs"
npm.cmd test -- --runInBand test/integration/auth-lookups.e2e-spec.ts
```

Expected:

- bundled lookup and searchable lookup tests pass.

- [ ] **Step 2: Run auth role assignment regression**

```powershell
cd "C:\Users\suley\OneDrive\Masaüstü\WEBSİTE ÇALIŞMASI\backend\nestjs"
npm.cmd test -- --runInBand test/integration/auth-role-assignments.e2e-spec.ts
```

Expected:

- role assignment behavior remains unchanged.

- [ ] **Step 3: Run backend build**

```powershell
cd "C:\Users\suley\OneDrive\Masaüstü\WEBSİTE ÇALIŞMASI\backend\nestjs"
npm.cmd run build
```

Expected:

- build passes.

- [ ] **Step 4: Run root script guards**

```powershell
cd "C:\Users\suley\OneDrive\Masaüstü\WEBSİTE ÇALIŞMASI"
node --test scripts\*.test.mjs
```

Expected:

- 100/100 script guard tests pass.

- [ ] **Step 5: Run root release gate**

```powershell
cd "C:\Users\suley\OneDrive\Masaüstü\WEBSİTE ÇALIŞMASI"
npm.cmd run check:release
```

Expected:

- backend lint/test/build/audit passes,
- frontend lint/build/e2e/audit passes,
- no new audit vulnerabilities,
- existing non-failing Vite chunk warning is acceptable.

- [ ] **Step 6: Run diff check**

```powershell
cd "C:\Users\suley\OneDrive\Masaüstü\WEBSİTE ÇALIŞMASI"
git diff --check
```

Expected:

- no whitespace errors,
- Windows LF to CRLF warnings are acceptable.

## Task 6: Documentation And Commit

**Files:**

- Modify: `current-state.md`
- Modify: `docs/plans/project-debt-ledger.md`
- Modify: `docs/plans/project-risk-scan-2026-04-30.md`
- Modify: `docs/superpowers/plans/2026-04-30-auth-admin-searchable-lookups-v1.md`

- [ ] **Step 1: Update this plan checklist**

Mark completed implementation and verification steps with `[x]`.

- [ ] **Step 2: Update current-state**

Add a section:

```md
## Son Auth Admin Searchable Lookups V1

30 Nisan 2026 itibariyla backend searchable auth-admin lookup endpointleri eklendi.

Eklenenler:

- `GET /api/auth/lookups/users/search?q=<text>&limit=20`
- `GET /api/auth/lookups/stores/search?q=<text>&limit=20`
- Existing `/api/auth/lookups` compatible kaldi.
- Query en az 2 karakter ister; `limit > 50` validation error dondurur.
- User search active users icinde username/email/provider_subject arar.
- Store search active stores icinde store_code/store_name/region_name arar.
- Schema/index/frontend/auth-policy degismedi.

Dogrulama:

- targeted auth lookup tests.
- auth role assignment regression.
- backend build.
- root script guards.
- root check:release.
```

- [ ] **Step 3: Update debt ledger**

Increment closed active debt count by one and add:

```md
Auth Admin Searchable Lookups V1 is counted as paid because auth-admin now has capped searchable backend lookup endpoints for active users and active stores, while the bundled `/api/auth/lookups` contract remains compatible. The implementation avoids schema/index migration and broad auth-admin refactor, and is guarded by targeted auth lookup tests plus root release gates.
```

Remove searchable auth-admin lookup from strategic backlog if present.

- [ ] **Step 4: Update risk scan**

Record that auth-admin lookup scale now has backend V1 endpoints and the next step is optional frontend wiring only when needed.

- [ ] **Step 5: Commit**

Run:

```powershell
cd "C:\Users\suley\OneDrive\Masaüstü\WEBSİTE ÇALIŞMASI"
git status --short
git add backend/nestjs/src/modules/auth/web/dto/search-auth-lookup.query.ts `
  backend/nestjs/src/modules/auth/web/auth-admin.controller.ts `
  backend/nestjs/src/modules/auth/auth-admin.service.ts `
  backend/nestjs/src/modules/auth/auth-admin.repository.ts `
  backend/nestjs/test/integration/auth-lookups.e2e-spec.ts `
  current-state.md `
  docs/plans/project-debt-ledger.md `
  docs/plans/project-risk-scan-2026-04-30.md `
  docs/superpowers/plans/2026-04-30-auth-admin-searchable-lookups-v1.md
git commit -m "feat: add searchable auth lookups"
```

Expected:

- commit succeeds,
- untracked `outputs/` remains uncommitted.

## Self-Review

Spec coverage:

- User search endpoint is planned.
- Store search endpoint is planned.
- Existing bundled lookup compatibility is preserved.
- Validation, max limit, active-only filtering, provider subject evidence, no schema/index migration, and no frontend V1 wiring are all covered.

No placeholders:

- There are no TBD/TODO sections.
- All code snippets needed for the implementation are included.

Type consistency:

- DTO name is `SearchAuthLookupQueryDto`.
- Service methods are `searchAuthUsers` and `searchAuthStores`.
- Repository methods are `searchActiveUserLookups` and `searchActiveStoreLookups`.
- Response keys match the design spec: `items` and `meta`.
