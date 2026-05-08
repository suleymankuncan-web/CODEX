import * as request from "supertest";
import { createIntegrationApp } from "./test-app";

describe("Auth role assignments", () => {
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
  const otherCompanyId = "10000000-0000-4000-8000-000000000002";
  const otherRegionId = "10000000-0000-4000-8000-000000000012";
  const regionId = "10000000-0000-4000-8000-000000000011";
  const storeId = "10000000-0000-4000-8000-000000000021";

  it("creates a role assignment for a user", async () => {
    const query = jest.fn(async (sql: string) => {
      if (sql.includes("FROM ops.user_account ua")) {
        return { rowCount: 0, rows: [] };
      }

      if (sql.includes("FROM ops.company c")) {
        return {
          rowCount: 1,
          rows: [{ company_id: companyId }],
        };
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

      if (sql.includes("FROM ops.company c")) {
        return {
          rowCount: 1,
          rows: [{ company_id: companyId }],
        };
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

  it("rejects region-scoped role assignments when the region belongs to another company", async () => {
    const query = jest.fn(async (sql: string) => {
      if (sql.includes("FROM ops.user_account ua")) {
        return { rowCount: 0, rows: [] };
      }

      if (sql.includes("FROM ops.company c")) {
        return {
          rowCount: 1,
          rows: [{ company_id: companyId }],
        };
      }

      if (sql.includes("FROM ops.region r") && sql.includes("WHERE r.region_id = $1::uuid")) {
        return {
          rowCount: 1,
          rows: [{ region_id: regionId, company_id: otherCompanyId }],
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
        companyId,
        regionId,
      });

    expect(response.status).toBe(422);
    expect(response.body.message).toBe("Region does not belong to the provided company");

    await app.close();
  });

  it("rejects store-scoped role assignments when the store hierarchy does not match", async () => {
    const query = jest.fn(async (sql: string) => {
      if (sql.includes("FROM ops.user_account ua")) {
        return { rowCount: 0, rows: [] };
      }

      if (sql.includes("FROM ops.company c")) {
        return {
          rowCount: 1,
          rows: [{ company_id: companyId }],
        };
      }

      if (sql.includes("FROM ops.region r") && sql.includes("WHERE r.region_id = $1::uuid")) {
        return {
          rowCount: 1,
          rows: [{ region_id: regionId, company_id: companyId }],
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
              region_id: otherRegionId,
              region_name: "Marmara",
            },
          ],
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
        roleCode: "STORE_MANAGER",
        scopeType: "store",
        companyId,
        regionId,
        storeId,
      });

    expect(response.status).toBe(422);
    expect(response.body.message).toBe(
      "Store does not belong to the provided company and region",
    );

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
});
