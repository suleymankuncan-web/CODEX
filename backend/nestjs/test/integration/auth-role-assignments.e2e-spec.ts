import * as request from "supertest";
import { createIntegrationApp } from "./test-app";

describe("Auth role assignment management", () => {
  const assignmentId = "11111111-1111-4111-8111-111111111111";
  const secondAssignmentId = "22222222-2222-4222-8222-222222222222";
  const actionStoreAssignmentId = "33333333-3333-4333-8333-333333333333";
  const adminUserId = "90000000-0000-4000-8000-000000000001";
  const reportUserId = "90000000-0000-4000-8000-000000000002";
  const snapshotUserId = "90000000-0000-4000-8000-000000000003";
  const createdUserId = "90000000-0000-4000-8000-000000000004";
  const companyId = "10000000-0000-4000-8000-000000000001";
  const regionId = "10000000-0000-4000-8000-000000000011";
  const storeId = "10000000-0000-4000-8000-000000000021";

  it("creates a role assignment for a user", async () => {
    const query = jest.fn(async (sql: string) => {
      if (sql.includes("FROM ops.user_account ua")) {
        return { rowCount: 0, rows: [] };
      }

      if (sql.includes("FROM ops.role r") && sql.includes("WHERE r.role_code = $1")) {
        return {
          rowCount: 1,
          rows: [{ role_id: "role-1", role_code: "REPORT_VIEWER", role_scope_type: "company" }],
        };
      }

      if (sql.includes("FROM ops.user_role_assignment ura") && sql.includes("active_assignment_count")) {
        return {
          rowCount: 1,
          rows: [{ active_assignment_count: "0" }],
        };
      }

      if (sql.includes("INSERT INTO ops.user_role_assignment")) {
        return {
          rowCount: 1,
          rows: [
            {
              user_role_assignment_id: assignmentId,
              user_id: reportUserId,
              role_code: "REPORT_VIEWER",
              scope_type: "company",
              company_id: companyId,
              region_id: null,
              store_id: null,
              start_at: "2026-04-17T20:00:00.000Z",
              end_at: null,
              created_at: "2026-04-17T20:00:00.000Z",
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
      .post("/api/auth/role-assignments")
      .set("x-user-id", adminUserId)
      .set("x-role-codes", "SUPER_ADMIN")
      .send({
        userId: reportUserId,
        roleCode: "REPORT_VIEWER",
        scopeType: "company",
        companyId,
      });

    expect(response.status).toBe(201);
    expect(response.body.command).toEqual({
      status: "created",
      message: "Role assignment created",
    });
    expect(response.body.data.assignment).toEqual({
      assignmentId,
      userId: reportUserId,
      roleCode: "REPORT_VIEWER",
      scopeType: "company",
      companyId,
      regionId: null,
      storeId: null,
      effectiveFrom: "2026-04-17T20:00:00.000Z",
      effectiveTo: null,
      createdAt: "2026-04-17T20:00:00.000Z",
      active: true,
    });

    await app.close();
  });

  it("rejects duplicate active role assignments", async () => {
    const query = jest.fn(async (sql: string) => {
      if (sql.includes("FROM ops.user_account ua")) {
        return { rowCount: 0, rows: [] };
      }

      if (sql.includes("FROM ops.role r") && sql.includes("WHERE r.role_code = $1")) {
        return {
          rowCount: 1,
          rows: [{ role_id: "role-1", role_code: "REPORT_VIEWER", role_scope_type: "company" }],
        };
      }

      if (sql.includes("FROM ops.user_role_assignment ura") && sql.includes("active_assignment_count")) {
        return {
          rowCount: 1,
          rows: [{ active_assignment_count: "1" }],
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
      .post("/api/auth/role-assignments")
      .set("x-user-id", adminUserId)
      .set("x-role-codes", "SUPER_ADMIN")
      .send({
        userId: reportUserId,
        roleCode: "REPORT_VIEWER",
        scopeType: "company",
        companyId,
      });

    expect(response.status).toBe(409);

    await app.close();
  });

  it("creates an action store assignment for a user", async () => {
    const query = jest.fn(async (sql: string) => {
      if (sql.includes("FROM ops.user_account ua") && sql.includes("INNER JOIN ops.user_role_assignment")) {
        return { rowCount: 0, rows: [] };
      }

      if (sql.includes("active_action_store_assignment_count")) {
        return {
          rowCount: 1,
          rows: [{ active_action_store_assignment_count: "0" }],
        };
      }

      if (sql.includes("FROM ops.store s") && sql.includes("WHERE s.store_id = $1::uuid")) {
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

      if (sql.includes("INSERT INTO ops.user_action_store_assignment")) {
        return {
          rowCount: 1,
          rows: [
            {
              user_action_store_assignment_id: actionStoreAssignmentId,
              user_id: reportUserId,
              username: "region.manager",
              email: "region.manager@example.com",
              store_id: storeId,
              store_code: "IST-021",
              store_name: "Istanbul Field Store",
              company_id: companyId,
              region_id: regionId,
              region_name: "Marmara",
              start_at: "2026-04-24T00:00:00.000Z",
              end_at: null,
              created_at: "2026-04-24T00:00:00.000Z",
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
      .post("/api/auth/action-store-assignments")
      .set("x-user-id", adminUserId)
      .set("x-role-codes", "SUPER_ADMIN")
      .send({
        userId: reportUserId,
        storeId,
        effectiveFrom: "2026-04-24T00:00:00.000Z",
      });

    expect(response.status).toBe(201);
    expect(response.body.command).toEqual({
      status: "created",
      message: "Action store assignment created",
    });
    expect(response.body.data.assignment).toEqual({
      assignmentId: actionStoreAssignmentId,
      userId: reportUserId,
      username: "region.manager",
      email: "region.manager@example.com",
      storeId,
      storeCode: "IST-021",
      storeName: "Istanbul Field Store",
      companyId,
      regionId,
      regionName: "Marmara",
      effectiveFrom: "2026-04-24T00:00:00.000Z",
      effectiveTo: null,
      createdAt: "2026-04-24T00:00:00.000Z",
      active: true,
    });

    await app.close();
  });

  it("lists action store assignments with store context", async () => {
    const query = jest.fn(async (sql: string, params?: unknown[]) => {
      if (sql.includes("FROM ops.user_account ua") && sql.includes("INNER JOIN ops.user_role_assignment")) {
        return { rowCount: 0, rows: [] };
      }

      if (
        sql.includes("COUNT(*)::text AS total_count") &&
        sql.includes("FROM ops.user_action_store_assignment uasa")
      ) {
        return {
          rowCount: 1,
          rows: [{ total_count: "1" }],
        };
      }

      if (sql.includes("FROM ops.user_action_store_assignment uasa")) {
        expect(params).toEqual([reportUserId, true, 20, 0]);
        return {
          rowCount: 1,
          rows: [
            {
              user_action_store_assignment_id: actionStoreAssignmentId,
              user_id: reportUserId,
              username: "region.manager",
              email: "region.manager@example.com",
              store_id: storeId,
              store_code: "IST-021",
              store_name: "Istanbul Field Store",
              company_id: companyId,
              region_id: regionId,
              region_name: "Marmara",
              start_at: "2026-04-24T00:00:00.000Z",
              end_at: null,
              created_at: "2026-04-24T00:00:00.000Z",
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
      .get(`/api/auth/action-store-assignments?limit=20&offset=0&userId=${reportUserId}&active=true`)
      .set("x-user-id", adminUserId)
      .set("x-role-codes", "SUPER_ADMIN");

    expect(response.status).toBe(200);
    expect(response.body.items).toEqual([
      {
        assignmentId: actionStoreAssignmentId,
        userId: reportUserId,
        username: "region.manager",
        email: "region.manager@example.com",
        storeId,
        storeCode: "IST-021",
        storeName: "Istanbul Field Store",
        companyId,
        regionId,
        regionName: "Marmara",
        effectiveFrom: "2026-04-24T00:00:00.000Z",
        effectiveTo: null,
        createdAt: "2026-04-24T00:00:00.000Z",
        active: true,
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

  it("deactivates an action store assignment", async () => {
    const query = jest.fn(async (sql: string) => {
      if (sql.includes("FROM ops.user_account ua") && sql.includes("INNER JOIN ops.user_role_assignment")) {
        return { rowCount: 0, rows: [] };
      }

      if (
        sql.includes("FROM ops.user_action_store_assignment uasa") &&
        sql.includes("WHERE uasa.user_action_store_assignment_id = $1::uuid")
      ) {
        return {
          rowCount: 1,
          rows: [
            {
              user_action_store_assignment_id: actionStoreAssignmentId,
              user_id: reportUserId,
              username: "region.manager",
              email: "region.manager@example.com",
              store_id: storeId,
              store_code: "IST-021",
              store_name: "Istanbul Field Store",
              company_id: companyId,
              region_id: regionId,
              region_name: "Marmara",
              start_at: "2026-04-24T00:00:00.000Z",
              end_at: null,
              created_at: "2026-04-24T00:00:00.000Z",
            },
          ],
        };
      }

      if (sql.includes("UPDATE ops.user_action_store_assignment")) {
        return {
          rowCount: 1,
          rows: [
            {
              user_action_store_assignment_id: actionStoreAssignmentId,
              user_id: reportUserId,
              username: "region.manager",
              email: "region.manager@example.com",
              store_id: storeId,
              store_code: "IST-021",
              store_name: "Istanbul Field Store",
              company_id: companyId,
              region_id: regionId,
              region_name: "Marmara",
              start_at: "2026-04-24T00:00:00.000Z",
              end_at: "2026-04-24T12:00:00.000Z",
              created_at: "2026-04-24T00:00:00.000Z",
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
      .patch(`/api/auth/action-store-assignments/${actionStoreAssignmentId}/deactivate`)
      .set("x-user-id", adminUserId)
      .set("x-role-codes", "SUPER_ADMIN");

    expect(response.status).toBe(200);
    expect(response.body.command).toEqual({
      status: "updated",
      message: "Action store assignment deactivated",
    });
    expect(response.body.data.assignment).toEqual({
      assignmentId: actionStoreAssignmentId,
      userId: reportUserId,
      username: "region.manager",
      email: "region.manager@example.com",
      storeId,
      storeCode: "IST-021",
      storeName: "Istanbul Field Store",
      companyId,
      regionId,
      regionName: "Marmara",
      effectiveFrom: "2026-04-24T00:00:00.000Z",
      effectiveTo: "2026-04-24T12:00:00.000Z",
      createdAt: "2026-04-24T00:00:00.000Z",
      active: false,
    });

    await app.close();
  });

  it("returns action store assignment audit events", async () => {
    const query = jest.fn(async (sql: string) => {
      if (sql.includes("FROM ops.user_account ua") && sql.includes("INNER JOIN ops.user_role_assignment")) {
        return { rowCount: 0, rows: [] };
      }

      if (sql.includes("FROM audit.event_log")) {
        return {
          rowCount: 2,
          rows: [
            {
              event_log_id: "evt-action-1",
              occurred_at: "2026-04-24T00:00:00.000Z",
              actor_user_id: adminUserId,
              event_type: "user_action_store_assignment.created",
              metadata_json: {
                reason: null,
                correlationId: null,
                sourceContext: {
                  module: "auth-admin",
                  operation: "create-action-store-assignment",
                },
                changedFields: ["userId", "storeId", "effectiveFrom", "effectiveTo"],
                details: {
                  userId: reportUserId,
                  storeId,
                  effectiveFrom: "2026-04-24T00:00:00.000Z",
                  effectiveTo: null,
                },
              },
            },
            {
              event_log_id: "evt-action-2",
              occurred_at: "2026-04-24T12:00:00.000Z",
              actor_user_id: adminUserId,
              event_type: "user_action_store_assignment.deactivated",
              metadata_json: {
                reason: null,
                correlationId: null,
                sourceContext: {
                  module: "auth-admin",
                  operation: "deactivate-action-store-assignment",
                },
                changedFields: ["endAt"],
                details: {
                  userId: reportUserId,
                  storeId,
                  endAt: "2026-04-24T12:00:00.000Z",
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
      .get(`/api/auth/action-store-assignments/${actionStoreAssignmentId}/audit`)
      .set("x-user-id", adminUserId)
      .set("x-role-codes", "SUPER_ADMIN");

    expect(response.status).toBe(200);
    expect(response.body.meta).toEqual({
      count: 2,
      total: 2,
      limit: 50,
      offset: 0,
    });
    expect(response.body.items).toEqual([
      {
        eventLogId: "evt-action-1",
        occurredAt: "2026-04-24T00:00:00.000Z",
        actorUserId: adminUserId,
        correlationId: null,
        eventType: "user_action_store_assignment.created",
        metadata: {
          reason: null,
          correlationId: null,
          sourceContext: {
            module: "auth-admin",
            operation: "create-action-store-assignment",
          },
          changedFields: ["userId", "storeId", "effectiveFrom", "effectiveTo"],
          details: {
            userId: reportUserId,
            storeId,
            effectiveFrom: "2026-04-24T00:00:00.000Z",
            effectiveTo: null,
          },
        },
      },
      {
        eventLogId: "evt-action-2",
        occurredAt: "2026-04-24T12:00:00.000Z",
        actorUserId: adminUserId,
        correlationId: null,
        eventType: "user_action_store_assignment.deactivated",
        metadata: {
          reason: null,
          correlationId: null,
          sourceContext: {
            module: "auth-admin",
            operation: "deactivate-action-store-assignment",
          },
          changedFields: ["endAt"],
          details: {
            userId: reportUserId,
            storeId,
            endAt: "2026-04-24T12:00:00.000Z",
          },
        },
      },
    ]);

    await app.close();
  });

  it("rejects region-scoped role assignments without company context", async () => {
    const query = jest.fn(async (sql: string) => {
      if (sql.includes("FROM ops.user_account ua")) {
        return { rowCount: 0, rows: [] };
      }

      if (sql.includes("FROM ops.role r") && sql.includes("WHERE r.role_code = $1")) {
        return {
          rowCount: 1,
          rows: [{ role_id: "role-region", role_code: "REGION_MANAGER", role_scope_type: "region" }],
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
      .post("/api/auth/role-assignments")
      .set("x-user-id", adminUserId)
      .set("x-role-codes", "SUPER_ADMIN")
      .send({
        userId: reportUserId,
        roleCode: "REGION_MANAGER",
        scopeType: "region",
        regionId,
      });

    expect(response.status).toBe(422);
    expect(response.body.message).toBe("companyId is required for region-scoped assignments");

    await app.close();
  });

  it("rejects company-scoped role assignments with narrower scope identifiers", async () => {
    const query = jest.fn(async (sql: string) => {
      if (sql.includes("FROM ops.user_account ua")) {
        return { rowCount: 0, rows: [] };
      }

      if (sql.includes("FROM ops.role r") && sql.includes("WHERE r.role_code = $1")) {
        return {
          rowCount: 1,
          rows: [{ role_id: "role-company", role_code: "REPORT_VIEWER", role_scope_type: "company" }],
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
      .post("/api/auth/role-assignments")
      .set("x-user-id", adminUserId)
      .set("x-role-codes", "SUPER_ADMIN")
      .send({
        userId: reportUserId,
        roleCode: "REPORT_VIEWER",
        scopeType: "company",
        companyId,
        regionId,
      });

    expect(response.status).toBe(422);
    expect(response.body.message).toBe(
      "regionId and storeId must not be provided for company-scoped assignments",
    );

    await app.close();
  });

  it("lists active role assignments with pagination metadata", async () => {
    const query = jest.fn(async (sql: string) => {
      if (sql.includes("FROM ops.user_account ua")) {
        return { rowCount: 0, rows: [] };
      }

      if (sql.includes("COUNT(*)::text AS total_count") && sql.includes("FROM ops.user_role_assignment ura")) {
        return {
          rowCount: 1,
          rows: [{ total_count: "2" }],
        };
      }

      if (sql.includes("FROM ops.user_role_assignment ura")) {
        return {
          rowCount: 2,
          rows: [
            {
              user_role_assignment_id: assignmentId,
              user_id: reportUserId,
              username: "report.user",
              email: "report@example.com",
              role_code: "REPORT_VIEWER",
              role_name: "Report Viewer",
              scope_type: "company",
              company_id: companyId,
              region_id: null,
              store_id: null,
              start_at: "2026-04-17T20:00:00.000Z",
              end_at: null,
              created_at: "2026-04-17T20:00:00.000Z",
            },
            {
              user_role_assignment_id: secondAssignmentId,
              user_id: snapshotUserId,
              username: "snapshot.user",
              email: "snapshot@example.com",
              role_code: "SNAPSHOT_OPERATOR",
              role_name: "Snapshot Operator",
              scope_type: "region",
              company_id: null,
              region_id: regionId,
              store_id: null,
              start_at: "2026-04-17T21:00:00.000Z",
              end_at: null,
              created_at: "2026-04-17T21:00:00.000Z",
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
      .get("/api/auth/role-assignments?limit=20&offset=0")
      .set("x-user-id", adminUserId)
      .set("x-role-codes", "SUPER_ADMIN");

    expect(response.status).toBe(200);
    expect(response.body.items).toEqual([
      {
        assignmentId,
        userId: reportUserId,
        username: "report.user",
        email: "report@example.com",
        roleCode: "REPORT_VIEWER",
        roleName: "Report Viewer",
        scopeType: "company",
        companyId,
        regionId: null,
        storeId: null,
        effectiveFrom: "2026-04-17T20:00:00.000Z",
        effectiveTo: null,
        createdAt: "2026-04-17T20:00:00.000Z",
        active: true,
      },
      {
        assignmentId: secondAssignmentId,
        userId: snapshotUserId,
        username: "snapshot.user",
        email: "snapshot@example.com",
        roleCode: "SNAPSHOT_OPERATOR",
        roleName: "Snapshot Operator",
        scopeType: "region",
        companyId: null,
        regionId,
        storeId: null,
        effectiveFrom: "2026-04-17T21:00:00.000Z",
        effectiveTo: null,
        createdAt: "2026-04-17T21:00:00.000Z",
        active: true,
      },
    ]);
    expect(response.body.meta).toEqual({
      count: 2,
      total: 2,
      limit: 20,
      offset: 0,
    });

    await app.close();
  });

  it("filters role assignments by role, scope, active state, and user", async () => {
    const query = jest.fn(async (sql: string, params?: unknown[]) => {
      if (sql.includes("FROM ops.user_account ua")) {
        return { rowCount: 0, rows: [] };
      }

      if (sql.includes("COUNT(*)::text AS total_count") && sql.includes("FROM ops.user_role_assignment ura")) {
        return {
          rowCount: 1,
          rows: [{ total_count: "1" }],
        };
      }

      if (sql.includes("FROM ops.user_role_assignment ura")) {
        expect(params).toEqual([reportUserId, "REPORT_VIEWER", "company", true, 20, 0]);
        return {
          rowCount: 1,
          rows: [
            {
              user_role_assignment_id: assignmentId,
              user_id: reportUserId,
              username: "report.user",
              email: "report@example.com",
              role_code: "REPORT_VIEWER",
              role_name: "Report Viewer",
              scope_type: "company",
              company_id: companyId,
              region_id: null,
              store_id: null,
              start_at: "2026-04-17T20:00:00.000Z",
              end_at: null,
              created_at: "2026-04-17T20:00:00.000Z",
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
      .get(
        `/api/auth/role-assignments?limit=20&offset=0&userId=${reportUserId}&roleCode=REPORT_VIEWER&scopeType=company&active=true`,
      )
      .set("x-user-id", adminUserId)
      .set("x-role-codes", "SUPER_ADMIN");

    expect(response.status).toBe(200);
    expect(response.body.meta).toEqual({
      count: 1,
      total: 1,
      limit: 20,
      offset: 0,
    });

    await app.close();
  });

  it("returns role assignment audit events", async () => {
    const query = jest.fn(async (sql: string) => {
      if (sql.includes("FROM ops.user_account ua")) {
        return { rowCount: 0, rows: [] };
      }

      if (sql.includes("FROM audit.event_log")) {
        return {
          rowCount: 2,
          rows: [
            {
              event_log_id: "evt-1",
              occurred_at: "2026-04-17T20:00:00.000Z",
              actor_user_id: adminUserId,
              event_type: "user_role_assignment.created",
              metadata_json: {
                reason: null,
                correlationId: null,
                sourceContext: {
                  module: "auth-admin",
                  operation: "create-role-assignment",
                },
                changedFields: [
                  "roleId",
                  "scopeType",
                  "companyId",
                  "regionId",
                  "storeId",
                  "effectiveFrom",
                  "effectiveTo",
                ],
                details: {
                  userId: reportUserId,
                  roleId: "role-1",
                  scopeType: "company",
                  companyId,
                  regionId: null,
                  storeId: null,
                  effectiveFrom: "2026-04-17T20:00:00.000Z",
                  effectiveTo: null,
                },
              },
            },
            {
              event_log_id: "evt-2",
              occurred_at: "2026-04-17T22:00:00.000Z",
              actor_user_id: adminUserId,
              event_type: "user_role_assignment.deactivated",
              metadata_json: {
                reason: null,
                correlationId: null,
                sourceContext: {
                  module: "auth-admin",
                  operation: "deactivate-role-assignment",
                },
                changedFields: ["endAt"],
                details: {
                  userId: reportUserId,
                  roleCode: "REPORT_VIEWER",
                  scopeType: "company",
                  companyId,
                  regionId: null,
                  storeId: null,
                  endAt: "2026-04-17T22:00:00.000Z",
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
      .get(`/api/auth/role-assignments/${assignmentId}/audit`)
      .set("x-user-id", adminUserId)
      .set("x-role-codes", "SUPER_ADMIN");

    expect(response.status).toBe(200);
    expect(response.body.meta).toEqual({
      count: 2,
      total: 2,
      limit: 50,
      offset: 0,
    });
    expect(response.body.items).toEqual([
      {
        eventLogId: "evt-1",
        occurredAt: "2026-04-17T20:00:00.000Z",
        actorUserId: adminUserId,
        correlationId: null,
        eventType: "user_role_assignment.created",
        metadata: {
          reason: null,
          correlationId: null,
          sourceContext: {
            module: "auth-admin",
            operation: "create-role-assignment",
          },
          changedFields: [
            "roleId",
            "scopeType",
            "companyId",
            "regionId",
            "storeId",
            "effectiveFrom",
            "effectiveTo",
          ],
          details: {
            userId: reportUserId,
            roleId: "role-1",
            scopeType: "company",
            companyId,
            regionId: null,
            storeId: null,
            effectiveFrom: "2026-04-17T20:00:00.000Z",
            effectiveTo: null,
          },
        },
      },
      {
        eventLogId: "evt-2",
        occurredAt: "2026-04-17T22:00:00.000Z",
        actorUserId: adminUserId,
        correlationId: null,
        eventType: "user_role_assignment.deactivated",
        metadata: {
          reason: null,
          correlationId: null,
          sourceContext: {
            module: "auth-admin",
            operation: "deactivate-role-assignment",
          },
          changedFields: ["endAt"],
          details: {
            userId: reportUserId,
            roleCode: "REPORT_VIEWER",
            scopeType: "company",
            companyId,
            regionId: null,
            storeId: null,
            endAt: "2026-04-17T22:00:00.000Z",
          },
        },
      },
    ]);

    await app.close();
  });

  it("deactivates an active role assignment", async () => {
    const query = jest.fn(async (sql: string) => {
      if (sql.includes("FROM ops.user_account ua")) {
        return { rowCount: 0, rows: [] };
      }

      if (sql.includes("FROM ops.user_role_assignment ura") && sql.includes("WHERE ura.user_role_assignment_id = $1::uuid")) {
        return {
          rowCount: 1,
          rows: [
            {
              user_role_assignment_id: assignmentId,
              user_id: reportUserId,
              role_code: "REPORT_VIEWER",
              scope_type: "company",
              company_id: companyId,
              region_id: null,
              store_id: null,
              start_at: "2026-04-17T20:00:00.000Z",
              end_at: null,
              created_at: "2026-04-17T20:00:00.000Z",
            },
          ],
        };
      }

      if (sql.includes("UPDATE ops.user_role_assignment")) {
        return {
          rowCount: 1,
          rows: [
            {
              user_role_assignment_id: assignmentId,
              user_id: reportUserId,
              role_code: "REPORT_VIEWER",
              scope_type: "company",
              company_id: companyId,
              region_id: null,
              store_id: null,
              start_at: "2026-04-17T20:00:00.000Z",
              end_at: "2026-04-17T22:00:00.000Z",
              created_at: "2026-04-17T20:00:00.000Z",
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
      .patch(`/api/auth/role-assignments/${assignmentId}/deactivate`)
      .set("x-user-id", adminUserId)
      .set("x-role-codes", "SUPER_ADMIN");

    expect(response.status).toBe(200);
    expect(response.body.command).toEqual({
      status: "updated",
      message: "Role assignment deactivated",
    });
    expect(response.body.data.assignment).toEqual({
      assignmentId,
      userId: reportUserId,
      roleCode: "REPORT_VIEWER",
      scopeType: "company",
      companyId,
      regionId: null,
      storeId: null,
      effectiveFrom: "2026-04-17T20:00:00.000Z",
      effectiveTo: "2026-04-17T22:00:00.000Z",
      createdAt: "2026-04-17T20:00:00.000Z",
      active: false,
    });

    await app.close();
  });

  it("rejects deactivation when the role assignment is already inactive", async () => {
    const query = jest.fn(async (sql: string) => {
      if (sql.includes("FROM ops.user_account ua")) {
        return { rowCount: 0, rows: [] };
      }

      if (sql.includes("FROM ops.user_role_assignment ura") && sql.includes("WHERE ura.user_role_assignment_id = $1::uuid")) {
        return {
          rowCount: 1,
          rows: [
            {
              user_role_assignment_id: assignmentId,
              user_id: reportUserId,
              role_code: "REPORT_VIEWER",
              scope_type: "company",
              company_id: companyId,
              region_id: null,
              store_id: null,
              start_at: "2026-04-17T20:00:00.000Z",
              end_at: "2026-04-17T22:00:00.000Z",
              created_at: "2026-04-17T20:00:00.000Z",
            },
          ],
        };
      }

      if (sql.includes("UPDATE ops.user_role_assignment")) {
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
      .patch(`/api/auth/role-assignments/${assignmentId}/deactivate`)
      .set("x-user-id", adminUserId)
      .set("x-role-codes", "SUPER_ADMIN");

    expect(response.status).toBe(409);
    expect(response.body.message).toBe("Role assignment is already inactive");

    await app.close();
  });

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
        expect(params).toEqual(["oidc", true, 20, 0]);
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

  it("deactivates a user account", async () => {
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
      isActive: false,
      lastLoginAt: null,
      createdAt: "2026-04-17T22:15:00.000Z",
    });

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
      isActive: true,
      lastLoginAt: null,
      createdAt: "2026-04-17T22:15:00.000Z",
    });

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
});
