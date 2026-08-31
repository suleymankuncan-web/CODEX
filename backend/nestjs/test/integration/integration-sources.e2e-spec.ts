import * as request from "supertest";
import { createIntegrationApp } from "./test-app";

describe("Integration sources", () => {
  it("lists integration sources with filters and pagination metadata", async () => {
    const query = jest.fn(async (sql: string, params?: unknown[]) => {
      if (sql.includes("FROM ops.user_account ua") && sql.includes("INNER JOIN ops.user_role_assignment")) {
        return { rowCount: 0, rows: [] };
      }

      if (sql.includes("COUNT(*)::text AS total_count") && sql.includes("FROM stg.integration_source")) {
        expect(params).toEqual(["employee", true]);
        return { rowCount: 1, rows: [{ total_count: "1" }] };
      }

      if (sql.includes("FROM stg.integration_source")) {
        expect(params).toEqual(["employee", true, 20, 0]);
        return {
          rowCount: 1,
          rows: [
            {
              integration_source_id: "source-managed-1",
              source_code: "HRIS_EMP",
              source_name: "Employee HRIS",
              entity_type: "employee",
              is_active: true,
            },
          ],
        };
      }

      return { rowCount: 0, rows: [] };
    });

    const app = await createIntegrationApp({ databaseService: { query } });

    const response = await request(app.getHttpServer())
      .get("/api/integrations/sources?limit=20&offset=0&entityType=employee&isActive=true")
      .set("x-user-id", "admin-1")
      .set("x-role-codes", "INTEGRATION_ADMIN");

    expect(response.status).toBe(200);
    expect(response.body.items).toEqual([
      {
        sourceId: "source-managed-1",
        sourceCode: "HRIS_EMP",
        sourceName: "Employee HRIS",
        entityType: "employee",
        isActive: true,
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

  it("creates an integration source", async () => {
    const query = jest.fn(async (sql: string, params?: unknown[]) => {
      if (sql.includes("FROM ops.user_account ua") && sql.includes("INNER JOIN ops.user_role_assignment")) {
        return { rowCount: 0, rows: [] };
      }

      if (sql.includes("FROM stg.integration_source") && sql.includes("WHERE source_code = $1")) {
        return { rowCount: 0, rows: [] };
      }

      if (sql.includes("INSERT INTO stg.integration_source")) {
        expect(params).toEqual([
          "HRIS_ASSIGN",
          "Assignment HRIS",
          "assignment",
          "manual",
          "latest_state",
          false,
          30,
          "10:30",
          "00:00",
          "Europe/Istanbul",
        ]);
        return {
          rowCount: 1,
          rows: [
            {
              integration_source_id: "source-managed-2",
              source_code: "HRIS_ASSIGN",
              source_name: "Assignment HRIS",
              entity_type: "assignment",
              source_system: "manual",
              state_model: "latest_state",
              poll_enabled: false,
              poll_interval_minutes: 30,
              poll_window_start_local: "10:30",
              poll_window_end_local: "00:00",
              poll_timezone: "Europe/Istanbul",
              is_active: true,
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
      .post("/api/integrations/sources")
      .set("x-user-id", "admin-1")
      .set("x-role-codes", "INTEGRATION_ADMIN")
      .send({
        sourceCode: "HRIS_ASSIGN",
        sourceName: "Assignment HRIS",
        entityType: "assignment",
      });

    expect(response.status).toBe(201);
    expect(response.body.command).toEqual({
      status: "created",
      message: "Integration source created",
    });
    expect(response.body.data.source).toEqual({
      sourceId: "source-managed-2",
      sourceCode: "HRIS_ASSIGN",
      sourceName: "Assignment HRIS",
      entityType: "assignment",
      sourceSystem: "manual",
      stateModel: "latest_state",
      pollEnabled: false,
      pollIntervalMinutes: 30,
      pollWindowStartLocal: "10:30",
      pollWindowEndLocal: "00:00",
      pollTimezone: "Europe/Istanbul",
      isActive: true,
    });

    await app.close();
  });

  it("deactivates and reactivates an integration source", async () => {
    const query = jest.fn(async (sql: string) => {
      if (sql.includes("FROM ops.user_account ua") && sql.includes("INNER JOIN ops.user_role_assignment")) {
        return { rowCount: 0, rows: [] };
      }

      if (sql.includes("FROM stg.integration_source") && sql.includes("WHERE integration_source_id = $1::uuid")) {
        return {
          rowCount: 1,
          rows: [
            {
              integration_source_id: "source-managed-3",
              source_code: "ERP_STORE",
              source_name: "Store ERP",
              entity_type: "store",
              is_active: true,
            },
          ],
        };
      }

      if (sql.includes("UPDATE stg.integration_source") && sql.includes("SET is_active = FALSE")) {
        return {
          rowCount: 1,
          rows: [
            {
              integration_source_id: "source-managed-3",
              source_code: "ERP_STORE",
              source_name: "Store ERP",
              entity_type: "store",
              is_active: false,
            },
          ],
        };
      }

      if (sql.includes("UPDATE stg.integration_source") && sql.includes("SET is_active = TRUE")) {
        return {
          rowCount: 1,
          rows: [
            {
              integration_source_id: "source-managed-3",
              source_code: "ERP_STORE",
              source_name: "Store ERP",
              entity_type: "store",
              is_active: true,
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

    const deactivateResponse = await request(app.getHttpServer())
      .patch("/api/integrations/sources/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/deactivate")
      .set("x-user-id", "admin-1")
      .set("x-role-codes", "INTEGRATION_ADMIN");

    expect(deactivateResponse.status).toBe(200);
    expect(deactivateResponse.body.data.source.isActive).toBe(false);

    const reactivateResponse = await request(app.getHttpServer())
      .patch("/api/integrations/sources/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/reactivate")
      .set("x-user-id", "admin-1")
      .set("x-role-codes", "INTEGRATION_ADMIN");

    expect(reactivateResponse.status).toBe(200);
    expect(reactivateResponse.body.data.source.isActive).toBe(true);

    await app.close();
  });

  it("returns integration lookups", async () => {
    const query = jest.fn(async (sql: string) => {
      if (sql.includes("FROM ops.user_account ua") && sql.includes("INNER JOIN ops.user_role_assignment")) {
        return { rowCount: 0, rows: [] };
      }

      if (sql.includes("FROM stg.integration_source") && sql.includes("WHERE is_active = TRUE")) {
        return {
          rowCount: 2,
          rows: [
            {
              integration_source_id: "source-managed-1",
              source_code: "HRIS_EMP",
              source_name: "Employee HRIS",
              entity_type: "employee",
              source_system: "manual",
              state_model: "latest_state",
              is_active: true,
            },
            {
              integration_source_id: "source-managed-2",
              source_code: "ERP_STORE",
              source_name: "Store ERP",
              entity_type: "store",
              source_system: "manual",
              state_model: "latest_state",
              is_active: true,
            },
          ],
        };
      }

      return { rowCount: 0, rows: [] };
    });

    const app = await createIntegrationApp({ databaseService: { query } });

    const response = await request(app.getHttpServer())
      .get("/api/integrations/lookups")
      .set("x-user-id", "admin-1")
      .set("x-role-codes", "INTEGRATION_ADMIN");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      entityTypes: ["employee", "store", "kpi", "assignment", "position", "company", "region"],
      sourceStats: {
        totalActiveSources: 2,
      },
      activeSources: [
          {
            sourceId: "source-managed-1",
            sourceCode: "HRIS_EMP",
            sourceName: "Employee HRIS",
            entityType: "employee",
            sourceSystem: "manual",
            stateModel: "latest_state",
          },
          {
            sourceId: "source-managed-2",
            sourceCode: "ERP_STORE",
            sourceName: "Store ERP",
            entityType: "store",
            sourceSystem: "manual",
            stateModel: "latest_state",
          },
        ],
      sourcesByEntityType: {
        employee: [
          {
            sourceId: "source-managed-1",
            sourceCode: "HRIS_EMP",
            sourceName: "Employee HRIS",
          },
        ],
        store: [
          {
            sourceId: "source-managed-2",
            sourceCode: "ERP_STORE",
            sourceName: "Store ERP",
          },
        ],
      },
      optionGroups: {
        entityTypes: [
          { value: "employee", label: "employee" },
          { value: "store", label: "store" },
          { value: "kpi", label: "kpi" },
          { value: "assignment", label: "assignment" },
          { value: "position", label: "position" },
          { value: "company", label: "company" },
          { value: "region", label: "region" },
        ],
        sources: [
          {
            value: "source-managed-1",
            label: "HRIS_EMP - Employee HRIS",
            entityType: "employee",
            sourceCode: "HRIS_EMP",
            sourceSystem: "manual",
            stateModel: "latest_state",
          },
          {
            value: "source-managed-2",
            label: "ERP_STORE - Store ERP",
            entityType: "store",
            sourceCode: "ERP_STORE",
            sourceSystem: "manual",
            stateModel: "latest_state",
          },
        ],
        sourceSystems: [
          { value: "nebim_v3", label: "nebim_v3" },
          { value: "power_bi", label: "power_bi" },
          { value: "manual", label: "manual" },
          { value: "other", label: "other" },
        ],
        stateModels: [
          { value: "latest_state", label: "latest_state" },
          { value: "closed_period", label: "closed_period" },
        ],
      },
      meta: {
        totalEntityTypes: 7,
        totalActiveSources: 2,
      },
    });

    await app.close();
  });

  it("returns integration source audit events", async () => {
    const query = jest.fn(async (sql: string) => {
      if (sql.includes("FROM ops.user_account ua") && sql.includes("INNER JOIN ops.user_role_assignment")) {
        return { rowCount: 0, rows: [] };
      }

      if (sql.includes("FROM stg.integration_source") && sql.includes("WHERE integration_source_id = $1::uuid")) {
        return {
          rowCount: 1,
          rows: [
            {
              integration_source_id: "source-managed-3",
              source_code: "ERP_STORE",
              source_name: "Store ERP",
              entity_type: "store",
              is_active: true,
            },
          ],
        };
      }

      if (sql.includes("FROM audit.event_log")) {
        return {
          rowCount: 2,
          rows: [
            {
              event_log_id: "evt-source-1",
              occurred_at: "2026-04-18T08:00:00.000Z",
              actor_user_id: "admin-1",
              event_type: "integration_source.created",
              metadata_json: { sourceCode: "ERP_STORE", entityType: "store" },
            },
            {
              event_log_id: "evt-source-2",
              occurred_at: "2026-04-18T09:00:00.000Z",
              actor_user_id: "admin-1",
              event_type: "integration_source.deactivated",
              metadata_json: { sourceCode: "ERP_STORE", isActive: false },
            },
          ],
        };
      }

      return { rowCount: 0, rows: [] };
    });

    const app = await createIntegrationApp({ databaseService: { query } });

    const response = await request(app.getHttpServer())
      .get("/api/integrations/sources/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/audit")
      .set("x-user-id", "admin-1")
      .set("x-role-codes", "INTEGRATION_ADMIN");

    expect(response.status).toBe(200);
    expect(response.body.meta).toEqual({
      count: 2,
      total: 2,
      limit: 50,
      offset: 0,
    });
    expect(response.body.items).toEqual([
      {
        eventLogId: "evt-source-1",
        occurredAt: "2026-04-18T08:00:00.000Z",
        actorUserId: "admin-1",
        correlationId: null,
        eventType: "integration_source.created",
        metadata: { sourceCode: "ERP_STORE", entityType: "store" },
      },
      {
        eventLogId: "evt-source-2",
        occurredAt: "2026-04-18T09:00:00.000Z",
        actorUserId: "admin-1",
        correlationId: null,
        eventType: "integration_source.deactivated",
        metadata: { sourceCode: "ERP_STORE", isActive: false },
      },
    ]);

    await app.close();
  });

  it("allows reusing source code across different entity types but rejects duplicate source code within the same entity type", async () => {
    const query = jest.fn(async (sql: string, params?: unknown[]) => {
      if (sql.includes("FROM ops.user_account ua") && sql.includes("INNER JOIN ops.user_role_assignment")) {
        return { rowCount: 0, rows: [] };
      }

      if (
        sql.includes("FROM stg.integration_source") &&
        sql.includes("WHERE source_code = $1") &&
        sql.includes("entity_type = $2")
      ) {
        if (Array.isArray(params) && params[1] === "employee") {
          return {
            rowCount: 1,
            rows: [
              {
                integration_source_id: "source-dup-1",
                source_code: "HRIS_SHARED",
                source_name: "Existing Employee HRIS",
                entity_type: "employee",
                is_active: true,
              },
            ],
          };
        }

        return { rowCount: 0, rows: [] };
      }

      if (sql.includes("INSERT INTO stg.integration_source")) {
        return {
          rowCount: 1,
          rows: [
            {
              integration_source_id: "source-shared-assignment",
              source_code: "HRIS_SHARED",
              source_name: "Shared Assignment HRIS",
              entity_type: "assignment",
              is_active: true,
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

    const allowedResponse = await request(app.getHttpServer())
      .post("/api/integrations/sources")
      .set("x-user-id", "admin-1")
      .set("x-role-codes", "INTEGRATION_ADMIN")
      .send({
        sourceCode: "HRIS_SHARED",
        sourceName: "Shared Assignment HRIS",
        entityType: "assignment",
      });

    expect(allowedResponse.status).toBe(201);
    expect(allowedResponse.body.data.source.entityType).toBe("assignment");

    const duplicateResponse = await request(app.getHttpServer())
      .post("/api/integrations/sources")
      .set("x-user-id", "admin-1")
      .set("x-role-codes", "INTEGRATION_ADMIN")
      .send({
        sourceCode: "HRIS_SHARED",
        sourceName: "Duplicate Employee HRIS",
        entityType: "employee",
      });

    expect(duplicateResponse.status).toBe(409);
    expect(duplicateResponse.body.message).toBe(
      "Integration source already exists for HRIS_SHARED/employee",
    );

    await app.close();
  });

  it("fails import creation with a clear error when the integration source is inactive", async () => {
    const query = jest.fn(async (sql: string, params?: unknown[]) => {
      if (sql.includes("FROM ops.user_account ua") && sql.includes("INNER JOIN ops.user_role_assignment")) {
        return { rowCount: 0, rows: [] };
      }

      if (
        sql.includes("SELECT integration_source_id") &&
        sql.includes("AND is_active = TRUE")
      ) {
        return { rowCount: 0, rows: [] };
      }

      if (
        sql.includes("FROM stg.integration_source") &&
        sql.includes("WHERE source_code = $1") &&
        sql.includes("entity_type = $2")
      ) {
        return {
          rowCount: 1,
          rows: [
            {
              integration_source_id: "source-inactive-1",
              source_code: "HRIS_INACTIVE",
              source_name: "Inactive HRIS",
              entity_type: "employee",
              is_active: false,
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
      .post("/api/integrations/import-batches")
      .set("x-user-id", "user-1")
      .set("x-role-codes", "INTEGRATION_ADMIN")
      .send({
        sourceCode: "HRIS_INACTIVE",
        entityType: "employee",
        fileReference: "employees.csv",
        rows: [],
      });

    expect(response.status).toBe(409);
    expect(response.body.message).toBe("Integration source is inactive for HRIS_INACTIVE/employee");

    await app.close();
  });

  it("rejects deactivating an integration source when active import batches exist", async () => {
    const query = jest.fn(async (sql: string, params?: unknown[]) => {
      if (sql.includes("FROM ops.user_account ua") && sql.includes("INNER JOIN ops.user_role_assignment")) {
        return { rowCount: 0, rows: [] };
      }

      if (sql.includes("FROM stg.integration_source") && sql.includes("WHERE integration_source_id = $1::uuid")) {
        return {
          rowCount: 1,
          rows: [
            {
              integration_source_id: "source-busy-1",
              source_code: "ERP_BUSY",
              source_name: "Busy ERP",
              entity_type: "store",
              is_active: true,
            },
          ],
        };
      }

      if (
        sql.includes("COUNT(*)::text AS active_batch_count") &&
        Array.isArray(params) &&
        params[0] === "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
      ) {
        return {
          rowCount: 1,
          rows: [{ active_batch_count: "2" }],
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
      .patch("/api/integrations/sources/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/deactivate")
      .set("x-user-id", "admin-1")
      .set("x-role-codes", "INTEGRATION_ADMIN");

    expect(response.status).toBe(409);
    expect(response.body.message).toBe(
      "Integration source bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb cannot be deactivated while active import batches exist",
    );

    await app.close();
  });

  it("rejects malformed source UUIDs before invoking the source service or database", async () => {
    const deactivateIntegrationSource = jest.fn();
    const query = jest.fn(async () => ({ rowCount: 0, rows: [] }));
    const app = await createIntegrationApp({
      databaseService: { query },
      integrationService: { deactivateIntegrationSource },
      authContextService: {
        resolveUser: jest.fn(async () => ({
          userId: "admin-1",
          roleCodes: ["INTEGRATION_ADMIN"],
          scope: {
            companyIds: ["00000000-0000-0000-0000-000000000001"],
            regionIds: [],
            storeIds: [],
          },
        })),
      },
    });

    const response = await request(app.getHttpServer())
      .patch("/api/integrations/sources/not-a-uuid/deactivate")
      .set("x-user-id", "admin-1")
      .set("x-role-codes", "INTEGRATION_ADMIN");

    expect(response.status).toBe(400);
    expect(deactivateIntegrationSource).not.toHaveBeenCalled();
    expect(query).not.toHaveBeenCalled();

    await app.close();
  });
});
