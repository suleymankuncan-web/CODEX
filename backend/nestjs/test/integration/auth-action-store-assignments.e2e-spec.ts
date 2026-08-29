import * as request from "supertest";
import { createIntegrationApp } from "./test-app";

describe("Auth action store assignments", () => {
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
  const secondStoreId = "10000000-0000-4000-8000-000000000022";

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

  it("creates a de-duplicated batch of action store assignments atomically", async () => {
    const query = jest.fn(async (sql: string, params?: unknown[]) => {
      if (sql.includes("FROM ops.user_account ua") && sql.includes("INNER JOIN ops.user_role_assignment")) {
        return { rowCount: 0, rows: [] };
      }

      if (sql.includes("FROM ops.store s") && sql.includes("s.store_id = ANY($1::uuid[])")) {
        expect(params).toEqual([[storeId, secondStoreId]]);
        return {
          rowCount: 2,
          rows: [
            {
              store_id: storeId,
              store_code: "IST-021",
              store_name: "Istanbul Field Store",
              company_id: companyId,
              region_id: regionId,
              region_name: "Marmara",
            },
            {
              store_id: secondStoreId,
              store_code: "IST-022",
              store_name: "Istanbul Second Store",
              company_id: companyId,
              region_id: regionId,
              region_name: "Marmara",
            },
          ],
        };
      }

      if (sql.includes("FROM ops.user_action_store_assignment") && sql.includes("FOR UPDATE")) {
        expect(params).toEqual([reportUserId, [storeId, secondStoreId]]);
        return { rowCount: 0, rows: [] };
      }

      if (sql.includes("FROM UNNEST($2::uuid[])")) {
        expect(params).toEqual([
          reportUserId,
          [storeId, secondStoreId],
          "2026-04-24T00:00:00.000Z",
          null,
        ]);
        return {
          rowCount: 2,
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
            {
              user_action_store_assignment_id: secondAssignmentId,
              user_id: reportUserId,
              username: "region.manager",
              email: "region.manager@example.com",
              store_id: secondStoreId,
              store_code: "IST-022",
              store_name: "Istanbul Second Store",
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
      .post("/api/auth/action-store-assignments/batch")
      .set("x-user-id", adminUserId)
      .set("x-role-codes", "SUPER_ADMIN")
      .send({
        userId: reportUserId,
        storeIds: [storeId, secondStoreId, storeId],
        effectiveFrom: "2026-04-24T00:00:00.000Z",
      });

    expect(response.status).toBe(201);
    expect(response.body.command).toEqual({
      status: "created",
      message: "Action store assignments created",
    });
    expect(response.body.data.assignments).toHaveLength(2);
    expect(response.body.data.assignments.map((assignment: { storeId: string }) => assignment.storeId)).toEqual([
      storeId,
      secondStoreId,
    ]);

    await app.close();
  });

  it("rejects a batch when any requested store is inactive or unknown", async () => {
    const query = jest.fn(async (sql: string) => {
      if (sql.includes("FROM ops.user_account ua") && sql.includes("INNER JOIN ops.user_role_assignment")) {
        return { rowCount: 0, rows: [] };
      }

      if (sql.includes("FROM ops.store s") && sql.includes("s.store_id = ANY($1::uuid[])")) {
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
    const withTransaction = jest.fn();
    const app = await createIntegrationApp({
      databaseService: { query, withTransaction },
    });

    const response = await request(app.getHttpServer())
      .post("/api/auth/action-store-assignments/batch")
      .set("x-user-id", adminUserId)
      .set("x-role-codes", "SUPER_ADMIN")
      .send({ userId: reportUserId, storeIds: [storeId, secondStoreId] });

    expect(response.status).toBe(404);
    expect(withTransaction).not.toHaveBeenCalled();

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
});
