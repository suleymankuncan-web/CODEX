import * as request from "supertest";
import { createIntegrationApp } from "./test-app";

describe("Auth lookups", () => {
  const assignmentId = "11111111-1111-4111-8111-111111111111";
  const secondAssignmentId = "22222222-2222-4222-8222-222222222222";
  const actionStoreAssignmentId = "33333333-3333-4333-8333-333333333333";
  const adminUserId = "90000000-0000-4000-8000-000000000001";
  const reportUserId = "90000000-0000-4000-8000-000000000002";
  const snapshotUserId = "90000000-0000-4000-8000-000000000003";
  const createdUserId = "90000000-0000-4000-8000-000000000004";
  const pilotUserId = "90000000-0000-4000-8000-000000000101";
  const pilotEmployeeId = "70000000-0000-4000-8000-000000000101";
  const pilotProviderSubject = "2f7b9d1e-8a41-4c7e-9d63-0d6b3c9a5f22";
  const pilotRoleAssignmentId = "11111111-2222-4333-8444-555555555555";
  const pilotActionStoreAssignmentId = "22222222-3333-4444-8555-666666666666";
  const companyId = "10000000-0000-4000-8000-000000000001";
  const regionId = "10000000-0000-4000-8000-000000000011";
  const storeId = "10000000-0000-4000-8000-000000000021";

  it("returns auth lookups", async () => {
    const query = jest.fn(async (sql: string) => {
      if (sql.includes("FROM ops.user_account ua") && sql.includes("INNER JOIN ops.user_role_assignment")) {
        return { rowCount: 0, rows: [] };
      }

      if (sql.includes("FROM ops.user_account") && sql.includes("WHERE is_active = TRUE")) {
        return {
          rowCount: 2,
          rows: [
            {
              user_id: createdUserId,
              employee_id: null,
              username: "new.admin",
              email: "new.admin@example.com",
              auth_provider: "oidc",
              is_active: true,
              last_login_at: null,
              created_at: "2026-04-17T22:15:00.000Z",
            },
            {
              user_id: adminUserId,
              employee_id: null,
              username: "super.admin",
              email: "super.admin@example.com",
              auth_provider: "oidc",
              is_active: true,
              last_login_at: null,
              created_at: "2026-04-17T20:00:00.000Z",
            },
          ],
        };
      }

      if (sql.includes("FROM ops.role r")) {
        return {
          rowCount: 1,
          rows: [
            {
              role_id: "role-1",
              role_code: "REPORT_VIEWER",
              role_name: "Report Viewer",
              role_scope_type: "company",
              description: "Can view reports",
              is_system_role: true,
              permission_code: "reports.read",
              resource_name: "reports",
              action_name: "read",
            },
          ],
        };
      }

      if (sql.includes("FROM ops.permission")) {
        return {
          rowCount: 1,
          rows: [
            {
              permission_id: "perm-1",
              permission_code: "reports.read",
              resource_name: "reports",
              action_name: "read",
              description: "Read reports",
            },
          ],
        };
      }

      if (sql.includes("FROM ops.store s") && sql.includes("WHERE s.status = 'active'")) {
        return {
          rowCount: 1,
          rows: [
            {
              store_id: storeId,
              store_code: "IST-021",
              store_name: "Istanbul Field Store",
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
      .get("/api/auth/lookups")
      .set("x-user-id", adminUserId)
      .set("x-role-codes", "SUPER_ADMIN");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      scopeTypes: ["company", "region", "store"],
      authProviders: ["oidc"],
      users: [
        {
          userId: createdUserId,
          username: "new.admin",
          email: "new.admin@example.com",
        },
        {
          userId: adminUserId,
          username: "super.admin",
          email: "super.admin@example.com",
        },
      ],
      roles: [
        {
          roleId: "role-1",
          roleCode: "REPORT_VIEWER",
          roleName: "Report Viewer",
          scopeType: "company",
        },
      ],
      permissions: [
        {
          permissionId: "perm-1",
          permissionCode: "reports.read",
          resourceName: "reports",
          actionName: "read",
        },
      ],
      stores: [
        {
          storeId,
          storeCode: "IST-021",
          storeName: "Istanbul Field Store",
          companyId,
          regionId,
          regionName: "Marmara",
        },
      ],
      optionGroups: {
        users: [
          {
            userId: createdUserId,
            username: "new.admin",
            email: "new.admin@example.com",
          },
          {
            userId: adminUserId,
            username: "super.admin",
            email: "super.admin@example.com",
          },
        ],
        roles: [
          {
            roleId: "role-1",
            roleCode: "REPORT_VIEWER",
            roleName: "Report Viewer",
            scopeType: "company",
          },
        ],
        permissions: [
          {
            permissionId: "perm-1",
            permissionCode: "reports.read",
            resourceName: "reports",
            actionName: "read",
          },
        ],
        stores: [
          {
            storeId,
            storeCode: "IST-021",
            storeName: "Istanbul Field Store",
            companyId,
            regionId,
            regionName: "Marmara",
          },
        ],
        scopeTypes: [
          { value: "company", label: "company" },
          { value: "region", label: "region" },
          { value: "store", label: "store" },
        ],
        authProviders: [{ value: "oidc", label: "oidc" }],
      },
      meta: {
        totalUsers: 2,
        totalRoles: 1,
        totalPermissions: 1,
        totalStores: 1,
      },
    });

    await app.close();
  });

  it("searches active auth users by username email or provider subject", async () => {
    const query = jest.fn(async (sql: string, params?: unknown[]) => {
      if (
        sql.includes("FROM ops.user_account") &&
        sql.includes("provider_subject") &&
        sql.includes("ILIKE")
      ) {
        expect(sql).toContain("ESCAPE");
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

  it("escapes wildcard characters in auth user lookup queries", async () => {
    const query = jest.fn(async (sql: string, params?: unknown[]) => {
      if (
        sql.includes("FROM ops.user_account") &&
        sql.includes("provider_subject") &&
        sql.includes("ILIKE")
      ) {
        expect(sql).toContain("ESCAPE");
        expect(params).toEqual(["%\\%\\_%", 20]);
        return { rowCount: 0, rows: [] };
      }

      return { rowCount: 0, rows: [] };
    });

    const app = await createIntegrationApp({ databaseService: { query } });

    const response = await request(app.getHttpServer())
      .get("/api/auth/lookups/users/search?q=%25_&limit=20")
      .set("x-user-id", adminUserId)
      .set("x-role-codes", "SUPER_ADMIN");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      items: [],
      meta: {
        query: "%_",
        count: 0,
        limit: 20,
      },
    });

    await app.close();
  });

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

  it("searches active stores by code name or region", async () => {
    const query = jest.fn(async (sql: string, params?: unknown[]) => {
      if (sql.includes("FROM ops.store s") && sql.includes("ILIKE")) {
        expect(sql).toContain("ESCAPE");
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
});
