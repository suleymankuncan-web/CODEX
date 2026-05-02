import * as request from "supertest";
import { createIntegrationApp } from "./test-app";

describe("Auth action scope integration", () => {
  it("rejects checklist creation when authenticated user is out of store scope", async () => {
    const app = await createIntegrationApp({
      authContextService: {
        resolveUser: jest.fn(async () => ({
          userId: "user-1",
          roleCodes: ["AUDITOR"],
          scope: {
            companyIds: [],
            regionIds: [],
            storeIds: [],
          },
        })),
      },
    });

    const response = await request(app.getHttpServer())
      .post("/api/checklists/instances")
      .send({
        templateId: "22222222-2222-4222-8222-222222222222",
        storeId: "11111111-1111-4111-8111-111111111111",
      });

    expect(response.status).toBe(403);

    await app.close();
  });

  it("accepts seeded PostgreSQL UUID store ids for target distribution creation", async () => {
    const seededStoreId = "00000000-0000-0000-0000-000000000100";
    const query = jest.fn(async (sql: string) => {
      if (sql.includes("INSERT INTO ops.target_distribution_request")) {
        return {
          rowCount: 1,
          rows: [
            {
              target_distribution_request_id: "33333333-3333-4333-8333-333333333333",
              company_id: "00000000-0000-0000-0000-000000000001",
              region_id: "00000000-0000-0000-0000-000000000010",
              store_id: seededStoreId,
              request_month: "2026-04-01",
              target_label: "Net Sales",
              total_target_value: "1000.00",
              allocation_count: 1,
              request_status: "submitted",
              request_reason: null,
              allocation_json: [],
              submitted_by_user_id: "user-1",
              approved_by_user_id: null,
              approved_at: null,
              approval_note: null,
              created_at: "2026-04-01T00:00:00.000Z",
              updated_at: "2026-04-01T00:00:00.000Z",
            },
          ],
        };
      }

      return { rowCount: 1, rows: [] };
    });
    const app = await createIntegrationApp({
      authContextService: {
        resolveUser: jest.fn(async () => ({
          userId: "user-1",
          roleCodes: ["STORE_MANAGER"],
          scope: {
            companyIds: ["00000000-0000-0000-0000-000000000001"],
            regionIds: ["00000000-0000-0000-0000-000000000010"],
            storeIds: [seededStoreId],
          },
          readScope: {
            companyIds: ["00000000-0000-0000-0000-000000000001"],
            regionIds: ["00000000-0000-0000-0000-000000000010"],
            storeIds: [seededStoreId],
          },
          actionScope: {
            assignedStoreIds: [seededStoreId],
          },
          assignedStoreIds: [seededStoreId],
        })),
      },
      databaseService: {
        query,
        withTransaction: async <T>(work: (client: { query: typeof query }) => Promise<T>) =>
          work({ query }),
      },
    });

    const response = await request(app.getHttpServer())
      .post("/api/target-distributions/requests")
      .send({
        storeId: seededStoreId,
        requestMonth: "2026-04-01",
        targetLabel: "Net Sales",
        totalTargetValue: 1000,
        allocations: [
          {
            employeeId: "00000000-0000-4000-8000-000000000501",
            assigneeLabel: "Sales Associate",
            targetValue: 1000,
          },
        ],
      });

    expect(response.status).toBe(201);
    expect(response.body.command.status).toBe("submitted");
    expect(response.body.data.request.storeId).toBe(seededStoreId);

    await app.close();
  });

  it("rejects target distribution creation outside assigned action stores even with broad read scope", async () => {
    const assignedStoreId = "11111111-1111-4111-8111-111111111111";
    const requestedStoreId = "22222222-2222-4222-8222-222222222222";
    const query = jest.fn(async (sql: string) => {
      if (sql.includes("INSERT INTO ops.target_distribution_request")) {
        return {
          rowCount: 1,
          rows: [
            {
              target_distribution_request_id: "33333333-3333-4333-8333-333333333333",
              company_id: "00000000-0000-0000-0000-000000000001",
              region_id: "44444444-4444-4444-8444-444444444444",
              store_id: requestedStoreId,
              request_month: "2026-04-01",
              target_label: "Net Sales",
              total_target_value: "1000.00",
              allocation_count: 1,
              request_status: "pending_region_approval",
              request_reason: null,
              allocation_json: [],
              submitted_by_user_id: "user-1",
              approved_by_user_id: null,
              approved_at: null,
              approval_note: null,
              created_at: "2026-04-01T00:00:00.000Z",
              updated_at: "2026-04-01T00:00:00.000Z",
            },
          ],
        };
      }

      return { rowCount: 0, rows: [] };
    });
    const app = await createIntegrationApp({
      authContextService: {
        resolveUser: jest.fn(async () => ({
          userId: "user-1",
          roleCodes: ["STORE_MANAGER"],
          scope: {
            companyIds: ["00000000-0000-0000-0000-000000000001"],
            regionIds: ["44444444-4444-4444-8444-444444444444"],
            storeIds: [assignedStoreId, requestedStoreId],
          },
          readScope: {
            companyIds: ["00000000-0000-0000-0000-000000000001"],
            regionIds: ["44444444-4444-4444-8444-444444444444"],
            storeIds: [assignedStoreId, requestedStoreId],
          },
          actionScope: {
            assignedStoreIds: [assignedStoreId],
          },
          assignedStoreIds: [assignedStoreId],
        })),
      },
      databaseService: {
        query,
        withTransaction: async <T>(work: (client: { query: typeof query }) => Promise<T>) =>
          work({ query }),
      },
    });

    const response = await request(app.getHttpServer())
      .post("/api/target-distributions/requests")
      .send({
        storeId: requestedStoreId,
        requestMonth: "2026-04-01",
        targetLabel: "Net Sales",
        totalTargetValue: 1000,
        allocations: [
          {
            employeeId: "00000000-0000-4000-8000-000000000501",
            assigneeLabel: "Sales Associate",
            targetValue: 1000,
          },
        ],
      });

    expect(response.status).toBe(403);
    expect(query).not.toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO ops.target_distribution_request"),
      expect.anything(),
    );

    await app.close();
  });

  it("rejects target distribution approval for report viewer role", async () => {
    const requestId = "33333333-3333-4333-8333-333333333333";
    const storeId = "11111111-1111-4111-8111-111111111111";
    const query = jest.fn(async (sql: string) => {
      if (sql.includes("FROM ops.target_distribution_request")) {
        return {
          rowCount: 1,
          rows: [
            {
              target_distribution_request_id: requestId,
              company_id: "00000000-0000-0000-0000-000000000001",
              region_id: "44444444-4444-4444-8444-444444444444",
              store_id: storeId,
            },
          ],
        };
      }

      if (sql.includes("UPDATE ops.target_distribution_request")) {
        return {
          rowCount: 1,
          rows: [
            {
              target_distribution_request_id: requestId,
              company_id: "00000000-0000-0000-0000-000000000001",
              region_id: "44444444-4444-4444-8444-444444444444",
              store_id: storeId,
              request_month: "2026-04-01",
              target_label: "Net Sales",
              total_target_value: "1000.00",
              allocation_count: 1,
              request_status: "approved",
              request_reason: null,
              allocation_json: [],
              submitted_by_user_id: "user-1",
              approved_by_user_id: "viewer-1",
              approved_at: "2026-04-01T00:00:00.000Z",
              approval_note: null,
              created_at: "2026-04-01T00:00:00.000Z",
              updated_at: "2026-04-01T00:00:00.000Z",
            },
          ],
        };
      }

      return { rowCount: 1, rows: [] };
    });
    const app = await createIntegrationApp({
      databaseService: {
        query,
        withTransaction: async <T>(work: (client: { query: typeof query }) => Promise<T>) =>
          work({ query }),
      },
    });

    const response = await request(app.getHttpServer())
      .patch(`/api/target-distributions/requests/${requestId}/approve`)
      .set("x-user-id", "viewer-1")
      .set("x-role-codes", "REPORT_VIEWER")
      .set("x-assigned-store-ids", storeId)
      .send({});

    expect(response.status).toBe(403);
    expect(query).not.toHaveBeenCalledWith(
      expect.stringContaining("UPDATE ops.target_distribution_request"),
      expect.anything(),
    );

    await app.close();
  });

  it("rejects target distribution approval outside assigned action stores", async () => {
    const assignedStoreId = "11111111-1111-4111-8111-111111111111";
    const requestStoreId = "22222222-2222-4222-8222-222222222222";
    const requestId = "33333333-3333-4333-8333-333333333333";
    const query = jest.fn(async (sql: string) => {
      if (sql.includes("FROM ops.target_distribution_request")) {
        return {
          rowCount: 1,
          rows: [
            {
              target_distribution_request_id: requestId,
              company_id: "00000000-0000-0000-0000-000000000001",
              region_id: "44444444-4444-4444-8444-444444444444",
              store_id: requestStoreId,
            },
          ],
        };
      }

      if (sql.includes("UPDATE ops.target_distribution_request")) {
        return {
          rowCount: 1,
          rows: [
            {
              target_distribution_request_id: requestId,
              company_id: "00000000-0000-0000-0000-000000000001",
              region_id: "44444444-4444-4444-8444-444444444444",
              store_id: requestStoreId,
              request_month: "2026-04-01",
              target_label: "Net Sales",
              total_target_value: "1000.00",
              allocation_count: 1,
              request_status: "approved",
              request_reason: null,
              allocation_json: [],
              submitted_by_user_id: "user-1",
              approved_by_user_id: "region-1",
              approved_at: "2026-04-01T00:00:00.000Z",
              approval_note: null,
              created_at: "2026-04-01T00:00:00.000Z",
              updated_at: "2026-04-01T00:00:00.000Z",
            },
          ],
        };
      }

      return { rowCount: 0, rows: [] };
    });
    const app = await createIntegrationApp({
      authContextService: {
        resolveUser: jest.fn(async () => ({
          userId: "region-1",
          roleCodes: ["REGION_MANAGER"],
          scope: {
            companyIds: ["00000000-0000-0000-0000-000000000001"],
            regionIds: ["44444444-4444-4444-8444-444444444444"],
            storeIds: [assignedStoreId, requestStoreId],
          },
          readScope: {
            companyIds: ["00000000-0000-0000-0000-000000000001"],
            regionIds: ["44444444-4444-4444-8444-444444444444"],
            storeIds: [assignedStoreId, requestStoreId],
          },
          actionScope: {
            assignedStoreIds: [assignedStoreId],
          },
          assignedStoreIds: [assignedStoreId],
        })),
      },
      databaseService: {
        query,
        withTransaction: async <T>(work: (client: { query: typeof query }) => Promise<T>) =>
          work({ query }),
      },
    });

    const response = await request(app.getHttpServer())
      .patch(`/api/target-distributions/requests/${requestId}/approve`)
      .send({});

    expect(response.status).toBe(403);
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("FROM ops.target_distribution_request"),
      [requestId],
    );
    expect(query).not.toHaveBeenCalledWith(
      expect.stringContaining("UPDATE ops.target_distribution_request"),
      expect.anything(),
    );

    await app.close();
  });

  it("rejects checklist acknowledgement outside assigned action stores", async () => {
    const assignedStoreId = "11111111-1111-4111-8111-111111111111";
    const checklistStoreId = "22222222-2222-4222-8222-222222222222";
    const checklistInstanceId = "33333333-3333-4333-8333-333333333333";
    const query = jest.fn(async (sql: string) => {
      if (sql.includes("FROM ops.checklist_instance")) {
        return {
          rowCount: 1,
          rows: [
            {
              checklist_instance_id: checklistInstanceId,
              store_id: checklistStoreId,
            },
          ],
        };
      }

      if (sql.includes("INSERT INTO ops.checklist_acknowledgement")) {
        return {
          rowCount: 1,
          rows: [
            {
              checklist_acknowledgement_id: "44444444-4444-4444-8444-444444444444",
              acknowledged_by_user_id: "user-1",
              acknowledgement_note: null,
              acknowledged_at: "2026-04-01T00:00:00.000Z",
            },
          ],
        };
      }

      return { rowCount: 0, rows: [] };
    });
    const app = await createIntegrationApp({
      authContextService: {
        resolveUser: jest.fn(async () => ({
          userId: "user-1",
          roleCodes: ["STORE_MANAGER"],
          scope: {
            companyIds: ["00000000-0000-0000-0000-000000000001"],
            regionIds: ["55555555-5555-4555-8555-555555555555"],
            storeIds: [assignedStoreId, checklistStoreId],
          },
          readScope: {
            companyIds: ["00000000-0000-0000-0000-000000000001"],
            regionIds: ["55555555-5555-4555-8555-555555555555"],
            storeIds: [assignedStoreId, checklistStoreId],
          },
          actionScope: {
            assignedStoreIds: [assignedStoreId],
          },
          assignedStoreIds: [assignedStoreId],
        })),
      },
      databaseService: {
        query,
        withTransaction: async <T>(work: (client: { query: typeof query }) => Promise<T>) =>
          work({ query }),
      },
    });

    const response = await request(app.getHttpServer())
      .post(`/api/checklists/instances/${checklistInstanceId}/acknowledge`)
      .send({});

    expect(response.status).toBe(403);
    expect(query).not.toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO ops.checklist_acknowledgement"),
      expect.anything(),
    );

    await app.close();
  });
});
