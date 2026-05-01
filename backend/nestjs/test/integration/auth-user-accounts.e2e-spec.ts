import * as request from "supertest";
import { createIntegrationApp } from "./test-app";

describe("Auth user accounts", () => {
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

  it("creates a user account", async () => {
    const query = jest.fn(async (sql: string) => {
      if (sql.includes("FROM ops.user_account ua")) {
        return { rowCount: 0, rows: [] };
      }

      if (sql.includes("INSERT INTO ops.user_account")) {
        return {
          rowCount: 1,
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
      .post("/api/auth/users")
      .set("x-user-id", adminUserId)
      .set("x-role-codes", "SUPER_ADMIN")
      .send({
        username: "new.admin",
        email: "new.admin@example.com",
        authProvider: "oidc",
      });

    expect(response.status).toBe(201);
    expect(response.body.command).toEqual({
      status: "created",
      message: "User account created",
    });
    expect(response.body.data.user).toEqual({
      userId: createdUserId,
      employeeId: null,
      username: "new.admin",
      email: "new.admin@example.com",
      authProvider: "oidc",
      providerSubject: null,
      isActive: true,
      lastLoginAt: null,
      createdAt: "2026-04-17T22:15:00.000Z",
    });

    await app.close();
  });

  it("lists user accounts with filters and pagination metadata", async () => {
    const query = jest.fn(async (sql: string, params?: unknown[]) => {
      if (sql.includes("FROM ops.user_account ua") && sql.includes("INNER JOIN ops.user_role_assignment")) {
        return { rowCount: 0, rows: [] };
      }

      if (sql.includes("FROM ops.user_account ua") && sql.includes("COUNT(*)::text AS total_count")) {
        expect(params).toEqual(["oidc", true]);
        return {
          rowCount: 1,
          rows: [{ total_count: "1" }],
        };
      }

      if (sql.includes("FROM ops.user_account ua")) {
        expect(params).toEqual(["oidc", true, 20, 0]);
        return {
          rowCount: 1,
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
          ],
        };
      }

      return { rowCount: 0, rows: [] };
    });

    const app = await createIntegrationApp({
      databaseService: { query },
    });

    const response = await request(app.getHttpServer())
      .get("/api/auth/users?limit=20&offset=0&authProvider=oidc&isActive=true")
      .set("x-user-id", adminUserId)
      .set("x-role-codes", "SUPER_ADMIN");

    expect(response.status).toBe(200);
    expect(response.body.items).toEqual([
      {
        userId: createdUserId,
        employeeId: null,
        username: "new.admin",
        email: "new.admin@example.com",
        authProvider: "oidc",
        providerSubject: null,
        isActive: true,
        lastLoginAt: null,
        createdAt: "2026-04-17T22:15:00.000Z",
      },
    ]);
    expect(response.body.meta).toEqual({
      count: 1,
      total: 1,
      limit: 20,
      offset: 0,
    });

    await app.close();
  });

  it("keeps user account total count independent from pagination offset", async () => {
    const query = jest.fn(async (sql: string, params?: unknown[]) => {
      if (
        sql.includes("FROM ops.user_account ua") &&
        sql.includes("INNER JOIN ops.user_role_assignment")
      ) {
        return { rowCount: 0, rows: [] };
      }

      if (sql.includes("FROM ops.user_account ua") && sql.includes("COUNT(*)::text AS total_count")) {
        expect(params).toEqual(["oidc", true]);
        expect(sql).not.toContain("LIMIT");
        expect(sql).not.toContain("OFFSET");
        return {
          rowCount: 1,
          rows: [{ total_count: "42" }],
        };
      }

      if (sql.includes("FROM ops.user_account ua")) {
        expect(params).toEqual(["oidc", true, 20, 20]);
        return {
          rowCount: 0,
          rows: [],
        };
      }

      return { rowCount: 0, rows: [] };
    });

    const app = await createIntegrationApp({
      databaseService: { query },
    });

    const response = await request(app.getHttpServer())
      .get("/api/auth/users?limit=20&offset=20&authProvider=oidc&isActive=true")
      .set("x-user-id", adminUserId)
      .set("x-role-codes", "SUPER_ADMIN");

    expect(response.status).toBe(200);
    expect(response.body.meta).toEqual({
      count: 0,
      total: 42,
      limit: 20,
      offset: 20,
    });

    await app.close();
  });

  it("deactivates a user account", async () => {
    const lifecycleQueries: string[] = [];
    const query = jest.fn(async (sql: string, params?: unknown[]) => {
      if (sql.includes("FROM ops.user_account ua") && sql.includes("INNER JOIN ops.user_role_assignment")) {
        return { rowCount: 0, rows: [] };
      }

      if (sql.includes("/* access_lifecycle_lock_user */")) {
        lifecycleQueries.push("lock-user");
        expect(params).toEqual([createdUserId]);
        return {
          rowCount: 1,
          rows: [
            {
              user_id: createdUserId,
              employee_id: null,
              username: "new.admin",
              email: "new.admin@example.com",
              auth_provider: "oidc",
              provider_subject: null,
              is_active: true,
              last_login_at: null,
              created_at: "2026-04-17T22:15:00.000Z",
            },
          ],
        };
      }

      if (sql.includes("/* access_lifecycle_deactivate_user */")) {
        lifecycleQueries.push("deactivate-user");
        expect(params).toEqual([
          createdUserId,
          adminUserId,
          "manual_admin_deactivation",
        ]);
        return {
          rowCount: 1,
          rows: [
            {
              user_id: createdUserId,
              employee_id: null,
              username: "new.admin",
              email: "new.admin@example.com",
              auth_provider: "oidc",
              provider_subject: null,
              is_active: false,
              last_login_at: null,
              created_at: "2026-04-17T22:15:00.000Z",
            },
          ],
        };
      }

      if (sql.includes("/* access_lifecycle_close_role_assignments */")) {
        lifecycleQueries.push("close-roles");
        expect(params).toEqual([createdUserId]);
        return {
          rowCount: 2,
          rows: [
            { user_role_assignment_id: assignmentId },
            { user_role_assignment_id: secondAssignmentId },
          ],
        };
      }

      if (sql.includes("/* access_lifecycle_close_action_store_assignments */")) {
        lifecycleQueries.push("close-action-stores");
        expect(params).toEqual([createdUserId]);
        return {
          rowCount: 1,
          rows: [{ user_action_store_assignment_id: actionStoreAssignmentId }],
        };
      }

      if (sql.includes("/* access_lifecycle_revoke_mobile_sessions */")) {
        lifecycleQueries.push("revoke-mobile-sessions");
        expect(params).toEqual([createdUserId, adminUserId, "manual_admin_deactivation"]);
        return {
          rowCount: 1,
          rows: [{ mobile_device_session_id: "44444444-4444-4444-8444-444444444444" }],
        };
      }

      if (sql.includes("FROM ops.user_account") && sql.includes("WHERE user_id = $1::uuid")) {
        return {
          rowCount: 1,
          rows: [
            {
              user_id: createdUserId,
              employee_id: null,
              username: "new.admin",
              email: "new.admin@example.com",
              auth_provider: "oidc",
              provider_subject: null,
              is_active: true,
              last_login_at: null,
              created_at: "2026-04-17T22:15:00.000Z",
            },
          ],
        };
      }

      if (sql.includes("UPDATE ops.user_account")) {
        return {
          rowCount: 1,
          rows: [
            {
              user_id: createdUserId,
              employee_id: null,
              username: "new.admin",
              email: "new.admin@example.com",
              auth_provider: "oidc",
              provider_subject: null,
              is_active: false,
              last_login_at: null,
              created_at: "2026-04-17T22:15:00.000Z",
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
      .patch(`/api/auth/users/${createdUserId}/deactivate`)
      .set("x-user-id", adminUserId)
      .set("x-role-codes", "SUPER_ADMIN");

    expect(response.status).toBe(200);
    expect(response.body.command).toEqual({
      status: "updated",
      message: "User account deactivated",
    });
    expect(response.body.data.user).toEqual({
      userId: createdUserId,
      employeeId: null,
      username: "new.admin",
      email: "new.admin@example.com",
      authProvider: "oidc",
      providerSubject: null,
      isActive: false,
      lastLoginAt: null,
      createdAt: "2026-04-17T22:15:00.000Z",
    });
    expect(response.body.data.accessClosure).toEqual({
      closedRoleAssignments: 2,
      closedActionStoreAssignments: 1,
      revokedMobileSessions: 1,
    });
    expect(lifecycleQueries).toEqual([
      "lock-user",
      "deactivate-user",
      "close-roles",
      "close-action-stores",
      "revoke-mobile-sessions",
    ]);

    await app.close();
  });

  it("reactivates a user account", async () => {
    const query = jest.fn(async (sql: string) => {
      if (sql.includes("FROM ops.user_account ua") && sql.includes("INNER JOIN ops.user_role_assignment")) {
        return { rowCount: 0, rows: [] };
      }

      if (sql.includes("FROM ops.user_account") && sql.includes("WHERE user_id = $1::uuid")) {
        return {
          rowCount: 1,
          rows: [
            {
              user_id: createdUserId,
              employee_id: null,
              username: "new.admin",
              email: "new.admin@example.com",
              auth_provider: "oidc",
              is_active: false,
              last_login_at: null,
              created_at: "2026-04-17T22:15:00.000Z",
            },
          ],
        };
      }

      if (sql.includes("UPDATE ops.user_account") && sql.includes("SET is_active = TRUE")) {
        expect(sql).toContain("deactivation_reason = NULL");
        expect(sql).toContain("deactivated_by_user_id = NULL");
        return {
          rowCount: 1,
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
      .patch(`/api/auth/users/${createdUserId}/reactivate`)
      .set("x-user-id", adminUserId)
      .set("x-role-codes", "SUPER_ADMIN");

    expect(response.status).toBe(200);
    expect(response.body.command).toEqual({
      status: "updated",
      message: "User account reactivated",
    });
    expect(response.body.data.user).toEqual({
      userId: createdUserId,
      employeeId: null,
      username: "new.admin",
      email: "new.admin@example.com",
      authProvider: "oidc",
      providerSubject: null,
      isActive: true,
      lastLoginAt: null,
      createdAt: "2026-04-17T22:15:00.000Z",
    });
    expect(
      query.mock.calls.some(([sql]) =>
        String(sql).includes("UPDATE ops.user_role_assignment"),
      ),
    ).toBe(false);
    expect(
      query.mock.calls.some(([sql]) =>
        String(sql).includes("UPDATE ops.user_action_store_assignment"),
      ),
    ).toBe(false);

    await app.close();
  });

  it("returns user account audit events", async () => {
    const query = jest.fn(async (sql: string) => {
      if (sql.includes("FROM ops.user_account ua") && sql.includes("INNER JOIN ops.user_role_assignment")) {
        return { rowCount: 0, rows: [] };
      }

      if (sql.includes("FROM audit.event_log")) {
        return {
          rowCount: 3,
          rows: [
            {
              event_log_id: "evt-u1",
              occurred_at: "2026-04-17T22:15:00.000Z",
              actor_user_id: adminUserId,
              event_type: "user_account.created",
              metadata_json: {
                reason: null,
                correlationId: null,
                sourceContext: {
                  module: "auth-admin",
                  operation: "create-user-account",
                },
                changedFields: ["employeeId", "username", "email", "authProvider", "isActive"],
                details: {
                  employeeId: null,
                  username: "new.admin",
                  email: "new.admin@example.com",
                  authProvider: "oidc",
                  isActive: true,
                },
              },
            },
            {
              event_log_id: "evt-u2",
              occurred_at: "2026-04-17T22:20:00.000Z",
              actor_user_id: adminUserId,
              event_type: "user_account.deactivated",
              metadata_json: {
                reason: null,
                correlationId: null,
                sourceContext: {
                  module: "auth-admin",
                  operation: "deactivate-user-account",
                },
                changedFields: ["isActive"],
                details: {
                  username: "new.admin",
                  email: "new.admin@example.com",
                  isActive: false,
                },
              },
            },
            {
              event_log_id: "evt-u3",
              occurred_at: "2026-04-17T22:25:00.000Z",
              actor_user_id: adminUserId,
              event_type: "user_account.reactivated",
              metadata_json: {
                reason: null,
                correlationId: null,
                sourceContext: {
                  module: "auth-admin",
                  operation: "reactivate-user-account",
                },
                changedFields: ["isActive"],
                details: {
                  username: "new.admin",
                  email: "new.admin@example.com",
                  isActive: true,
                },
              },
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
      .get(`/api/auth/users/${createdUserId}/audit`)
      .set("x-user-id", adminUserId)
      .set("x-role-codes", "SUPER_ADMIN");

    expect(response.status).toBe(200);
    expect(response.body.meta).toEqual({
      count: 3,
      total: 3,
      limit: 50,
      offset: 0,
    });
    expect(response.body.items).toEqual([
      {
        eventLogId: "evt-u1",
        occurredAt: "2026-04-17T22:15:00.000Z",
        actorUserId: adminUserId,
        correlationId: null,
        eventType: "user_account.created",
        metadata: {
          reason: null,
          correlationId: null,
          sourceContext: {
            module: "auth-admin",
            operation: "create-user-account",
          },
          changedFields: ["employeeId", "username", "email", "authProvider", "isActive"],
          details: {
            employeeId: null,
            username: "new.admin",
            email: "new.admin@example.com",
            authProvider: "oidc",
            isActive: true,
          },
        },
      },
      {
        eventLogId: "evt-u2",
        occurredAt: "2026-04-17T22:20:00.000Z",
        actorUserId: adminUserId,
        correlationId: null,
        eventType: "user_account.deactivated",
        metadata: {
          reason: null,
          correlationId: null,
          sourceContext: {
            module: "auth-admin",
            operation: "deactivate-user-account",
          },
          changedFields: ["isActive"],
          details: {
            username: "new.admin",
            email: "new.admin@example.com",
            isActive: false,
          },
        },
      },
      {
        eventLogId: "evt-u3",
        occurredAt: "2026-04-17T22:25:00.000Z",
        actorUserId: adminUserId,
        correlationId: null,
        eventType: "user_account.reactivated",
        metadata: {
          reason: null,
          correlationId: null,
          sourceContext: {
            module: "auth-admin",
            operation: "reactivate-user-account",
          },
          changedFields: ["isActive"],
          details: {
            username: "new.admin",
            email: "new.admin@example.com",
            isActive: true,
          },
        },
      },
    ]);

    await app.close();
  });

  it("rejects reactivation when the user account is already active", async () => {
    const query = jest.fn(async (sql: string) => {
      if (sql.includes("FROM ops.user_account ua") && sql.includes("INNER JOIN ops.user_role_assignment")) {
        return { rowCount: 0, rows: [] };
      }

      if (sql.includes("FROM ops.user_account") && sql.includes("WHERE user_id = $1::uuid")) {
        return {
          rowCount: 1,
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
          ],
        };
      }

      if (sql.includes("UPDATE ops.user_account") && sql.includes("SET is_active = TRUE")) {
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
      .patch(`/api/auth/users/${createdUserId}/reactivate`)
      .set("x-user-id", adminUserId)
      .set("x-role-codes", "SUPER_ADMIN");

    expect(response.status).toBe(409);
    expect(response.body.message).toBe("User account is already active");

    await app.close();
  });
});
