import * as request from "supertest";
import { createIntegrationApp } from "./test-app";

describe("Auth role permissions", () => {
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

  it("lists role catalog entries with permission visibility", async () => {
    const query = jest.fn(async (sql: string) => {
      if (sql.includes("FROM ops.user_account ua") && sql.includes("INNER JOIN ops.user_role_assignment")) {
        return { rowCount: 0, rows: [] };
      }

      if (sql.includes("FROM ops.role r") && sql.includes("LEFT JOIN ops.role_permission")) {
        return {
          rowCount: 2,
          rows: [
            {
              role_id: "role-1",
              role_code: "REPORT_VIEWER",
              role_name: "Report Viewer",
              role_scope_type: "company",
              description: "Read reporting data",
              is_system_role: true,
              permission_code: "reports.read",
              resource_name: "reports",
              action_name: "read",
            },
            {
              role_id: "role-2",
              role_code: "SUPER_ADMIN",
              role_name: "Super Admin",
              role_scope_type: "company",
              description: "Full access",
              is_system_role: true,
              permission_code: "auth.manage",
              resource_name: "auth",
              action_name: "manage",
            },
          ],
        };
      }

      return { rowCount: 0, rows: [] };
    });

    const app = await createIntegrationApp({
      databaseService: { query },
    });

    const response = await request(app.getHttpServer())
      .get("/api/auth/roles")
      .set("x-user-id", adminUserId)
      .set("x-role-codes", "SUPER_ADMIN");

    expect(response.status).toBe(200);
    expect(response.body.items).toEqual([
      {
        roleId: "role-1",
        roleCode: "REPORT_VIEWER",
        roleName: "Report Viewer",
        scopeType: "company",
        description: "Read reporting data",
        isSystemRole: true,
        permissions: [
          {
            permissionCode: "reports.read",
            resourceName: "reports",
            actionName: "read",
          },
        ],
      },
      {
        roleId: "role-2",
        roleCode: "SUPER_ADMIN",
        roleName: "Super Admin",
        scopeType: "company",
        description: "Full access",
        isSystemRole: true,
        permissions: [
          {
            permissionCode: "auth.manage",
            resourceName: "auth",
            actionName: "manage",
          },
        ],
      },
    ]);
    expect(response.body.meta).toEqual({
      count: 2,
      total: 2,
      limit: 50,
      offset: 0,
    });

    await app.close();
  });

  it("lists permission catalog entries", async () => {
    const query = jest.fn(async (sql: string) => {
      if (sql.includes("FROM ops.user_account ua") && sql.includes("INNER JOIN ops.user_role_assignment")) {
        return { rowCount: 0, rows: [] };
      }

      if (sql.includes("FROM ops.permission")) {
        return {
          rowCount: 2,
          rows: [
            {
              permission_id: "perm-1",
              permission_code: "reports.read",
              resource_name: "reports",
              action_name: "read",
              description: "Read reports",
            },
            {
              permission_id: "perm-2",
              permission_code: "auth.manage",
              resource_name: "auth",
              action_name: "manage",
              description: "Manage auth settings",
            },
          ],
        };
      }

      return { rowCount: 0, rows: [] };
    });

    const app = await createIntegrationApp({
      databaseService: { query },
    });

    const response = await request(app.getHttpServer())
      .get("/api/auth/permissions")
      .set("x-user-id", adminUserId)
      .set("x-role-codes", "SUPER_ADMIN");

    expect(response.status).toBe(200);
    expect(response.body.items).toEqual([
      {
        permissionId: "perm-1",
        permissionCode: "reports.read",
        resourceName: "reports",
        actionName: "read",
        description: "Read reports",
      },
      {
        permissionId: "perm-2",
        permissionCode: "auth.manage",
        resourceName: "auth",
        actionName: "manage",
        description: "Manage auth settings",
      },
    ]);
    expect(response.body.meta).toEqual({
      count: 2,
      total: 2,
      limit: 50,
      offset: 0,
    });

    await app.close();
  });

  it("grants a permission to a role", async () => {
    const query = jest.fn(async (sql: string) => {
      if (sql.includes("FROM ops.user_account ua") && sql.includes("INNER JOIN ops.user_role_assignment")) {
        return { rowCount: 0, rows: [] };
      }

      if (sql.includes("FROM ops.role r") && sql.includes("WHERE r.role_id = $1::uuid")) {
        return {
          rowCount: 1,
          rows: [{ role_id: "role-1", role_code: "REPORT_VIEWER" }],
        };
      }

      if (sql.includes("FROM ops.permission p") && sql.includes("WHERE p.permission_code = $1")) {
        return {
          rowCount: 1,
          rows: [{ permission_id: "perm-1", permission_code: "reports.read" }],
        };
      }

      if (sql.includes("FROM ops.role_permission")) {
        return {
          rowCount: 0,
          rows: [],
        };
      }

      if (sql.includes("INSERT INTO ops.role_permission")) {
        return {
          rowCount: 1,
          rows: [
            {
              role_id: "role-1",
              permission_id: "perm-1",
              role_code: "REPORT_VIEWER",
              permission_code: "reports.read",
              granted_at: "2026-04-17T22:40:00.000Z",
            },
          ],
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
      .post("/api/auth/roles/role-1/permissions")
      .set("x-user-id", adminUserId)
      .set("x-role-codes", "SUPER_ADMIN")
      .send({
        permissionCode: "reports.read",
      });

    expect(response.status).toBe(201);
    expect(response.body.command).toEqual({
      status: "created",
      message: "Role permission granted",
    });
    expect(response.body.data.rolePermission).toEqual({
      roleId: "role-1",
      roleCode: "REPORT_VIEWER",
      permissionId: "perm-1",
      permissionCode: "reports.read",
      grantedAt: "2026-04-17T22:40:00.000Z",
    });

    await app.close();
  });

  it("rejects duplicate permission grants for the same role", async () => {
    const query = jest.fn(async (sql: string) => {
      if (sql.includes("FROM ops.user_account ua") && sql.includes("INNER JOIN ops.user_role_assignment")) {
        return { rowCount: 0, rows: [] };
      }

      if (sql.includes("FROM ops.role r") && sql.includes("WHERE r.role_id = $1::uuid")) {
        return {
          rowCount: 1,
          rows: [{ role_id: "role-1", role_code: "REPORT_VIEWER" }],
        };
      }

      if (sql.includes("FROM ops.permission p") && sql.includes("WHERE p.permission_code = $1")) {
        return {
          rowCount: 1,
          rows: [{ permission_id: "perm-1", permission_code: "reports.read" }],
        };
      }

      if (sql.includes("FROM ops.role_permission")) {
        return {
          rowCount: 1,
          rows: [{ role_id: "role-1", permission_id: "perm-1" }],
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
      .post("/api/auth/roles/role-1/permissions")
      .set("x-user-id", adminUserId)
      .set("x-role-codes", "SUPER_ADMIN")
      .send({
        permissionCode: "reports.read",
      });

    expect(response.status).toBe(409);
    expect(response.body.message).toBe("Role permission already granted");

    await app.close();
  });

  it("revokes a permission from a role", async () => {
    const query = jest.fn(async (sql: string) => {
      if (sql.includes("FROM ops.user_account ua") && sql.includes("INNER JOIN ops.user_role_assignment")) {
        return { rowCount: 0, rows: [] };
      }

      if (sql.includes("DELETE FROM ops.role_permission")) {
        return {
          rowCount: 1,
          rows: [
            {
              role_id: "role-1",
              permission_id: "perm-1",
              role_code: "REPORT_VIEWER",
              permission_code: "reports.read",
            },
          ],
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
      .delete("/api/auth/roles/role-1/permissions/reports.read")
      .set("x-user-id", adminUserId)
      .set("x-role-codes", "SUPER_ADMIN");

    expect(response.status).toBe(200);
    expect(response.body.command).toEqual({
      status: "updated",
      message: "Role permission revoked",
    });
    expect(response.body.data.rolePermission).toEqual({
      roleId: "role-1",
      roleCode: "REPORT_VIEWER",
      permissionId: "perm-1",
      permissionCode: "reports.read",
    });

    await app.close();
  });

  it("returns not found when revoking a missing role permission", async () => {
    const query = jest.fn(async (sql: string) => {
      if (sql.includes("FROM ops.user_account ua") && sql.includes("INNER JOIN ops.user_role_assignment")) {
        return { rowCount: 0, rows: [] };
      }

      if (sql.includes("DELETE FROM ops.role_permission")) {
        return {
          rowCount: 0,
          rows: [],
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
      .delete("/api/auth/roles/role-1/permissions/reports.read")
      .set("x-user-id", adminUserId)
      .set("x-role-codes", "SUPER_ADMIN");

    expect(response.status).toBe(404);
    expect(response.body.message).toBe("Role permission not found: role-1 -> reports.read");

    await app.close();
  });
});
