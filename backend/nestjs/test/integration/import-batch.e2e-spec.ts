import * as request from "supertest";
import { createIntegrationApp } from "./test-app";

describe("POST /api/integrations/import-batches", () => {
  it("returns a source-agnostic canonical KPI payload contract template", async () => {
    const app = await createIntegrationApp({
      databaseService: {
        query: jest.fn(async () => ({ rowCount: 0, rows: [] })),
      },
    });

    const response = await request(app.getHttpServer())
      .get("/api/integrations/import-payload-templates?entityType=kpi&sourceSystem=other")
      .set("x-user-id", "admin-1")
      .set("x-role-codes", "INTEGRATION_ADMIN");

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      entityType: "kpi",
      sourceSystem: "other",
      canonicalContract: {
        envelopeFields: expect.arrayContaining([
          "sourceCode",
          "sourceBatchId",
          "sourcePayloadHash",
          "sourceCapturedAt",
          "sourceWindowStartedAt",
          "sourceWindowEndedAt",
        ]),
        canonicalKpiRowFields: expect.arrayContaining([
          "kpiCode",
          "sourceMetricId",
          "scopeType",
          "storeExternalRef",
          "employeeExternalRef",
          "actualValue",
          "periodStart",
          "periodEnd",
          "rowHash",
          "rawRowReference",
        ]),
        importedMetricCodes: expect.arrayContaining([
          "NET_SALES",
          "TICKET_COUNT",
          "ITEM_COUNT",
          "UPT",
          "ATV",
          "CR",
        ]),
        derivedMetricCodes: expect.arrayContaining(["TARGET_ACHIEVEMENT"]),
        rules: expect.arrayContaining([
          "employeeExternalRef can be empty only for store-scoped metrics",
          "source adapters map external fields into canonical rows before scoring",
        ]),
      },
    });

    await app.close();
  });

  it("lists import batches with pagination metadata and filters", async () => {
    const query = jest.fn(async (sql: string) => {
      if (sql.includes("COUNT(*)::text AS total_count") && sql.includes("FROM stg.import_batch")) {
        return {
          rowCount: 1,
          rows: [{ total_count: "2" }],
        };
      }

      if (sql.includes("FROM stg.import_batch")) {
        return {
          rowCount: 2,
          rows: [
            {
              import_batch_id: "batch-l1",
              integration_source_id: "source-1",
              source_code: "HRIS",
              source_name: "Corporate HRIS",
              entity_type: "employee",
              started_at: "2026-04-17T09:00:00.000Z",
              finished_at: "2026-04-17T09:05:00.000Z",
              status: "completed",
              raw_file_name: "employees.csv",
              record_count: 10,
              error_count: 0,
              retry_count: 0,
              last_retried_at: null,
            },
            {
              import_batch_id: "batch-l2",
              integration_source_id: "source-2",
              source_code: "HRIS",
              source_name: "Corporate HRIS",
              entity_type: "assignment",
              started_at: "2026-04-17T10:00:00.000Z",
              finished_at: null,
              status: "failed",
              raw_file_name: "assignments.csv",
              record_count: 8,
              error_count: 2,
              retry_count: 2,
              last_retried_at: "2026-04-17T10:10:00.000Z",
            },
          ],
        };
      }

      return { rowCount: 0, rows: [] };
    });

    const app = await createIntegrationApp({
      databaseService: { query },
    });

    const response = await request(app.getHttpServer()).get(
      "/api/integrations/import-batches?limit=20&offset=0&status=failed&entityType=assignment&sourceCode=HRIS&startedFrom=2026-04-17T00:00:00.000Z&startedTo=2026-04-18T00:00:00.000Z",
    );

    expect(response.status).toBe(200);
    expect(response.body.items).toEqual([
      {
        batchId: "batch-l1",
        integrationSourceId: "source-1",
        sourceCode: "HRIS",
        sourceName: "Corporate HRIS",
        entityType: "employee",
        startedAt: "2026-04-17T09:00:00.000Z",
        finishedAt: "2026-04-17T09:05:00.000Z",
        status: "completed",
        fileReference: "employees.csv",
        recordCount: 10,
        errorCount: 0,
        retryCount: 0,
        lastRetriedAt: null,
        healthState: "healthy",
      },
      {
        batchId: "batch-l2",
        integrationSourceId: "source-2",
        sourceCode: "HRIS",
        sourceName: "Corporate HRIS",
        entityType: "assignment",
        startedAt: "2026-04-17T10:00:00.000Z",
        finishedAt: null,
        status: "failed",
        fileReference: "assignments.csv",
        recordCount: 8,
        errorCount: 2,
        retryCount: 2,
        lastRetriedAt: "2026-04-17T10:10:00.000Z",
        healthState: "needs_action",
      },
    ]);
    expect(response.body.meta).toEqual({
      count: 2,
      total: 2,
      limit: 20,
      offset: 0,
    });
    expect(
      query.mock.calls.some(
        (call) =>
          typeof call[0] === "string" &&
          call[0].includes(
            "WHERE stg.import_batch.status = $1 AND stg.import_batch.entity_type = $2 AND src.source_code = $3 AND stg.import_batch.started_at >= $4::timestamptz AND stg.import_batch.started_at <= $5::timestamptz",
          ) &&
          JSON.stringify((call as any[])[1]) ===
            JSON.stringify([
              "failed",
              "assignment",
              "HRIS",
              "2026-04-17T00:00:00.000Z",
              "2026-04-18T00:00:00.000Z",
            ]),
      ),
    ).toBe(true);

    await app.close();
  });

  it("returns import batch summary counts with filters", async () => {
    const query = jest.fn(async (sql: string, params?: unknown[]) => {
      if (sql.includes("GROUP BY status")) {
        return {
          rowCount: 3,
          rows: [
            { status: "completed", batch_count: "5" },
            { status: "failed", batch_count: "2" },
            { status: "completed_with_errors", batch_count: "1" },
          ],
        };
      }

      if (sql.includes("COUNT(*)::text AS total_count")) {
        return {
          rowCount: 1,
          rows: [{ total_count: "8" }],
        };
      }

      if (
        sql.includes("ORDER BY started_at DESC") &&
        Array.isArray(params) &&
        params.includes("failed")
      ) {
        return {
          rowCount: 1,
          rows: [{ import_batch_id: "batch-latest-failed" }],
        };
      }

      if (
        sql.includes("ORDER BY started_at DESC") &&
        Array.isArray(params) &&
        params.includes("completed")
      ) {
        return {
          rowCount: 1,
          rows: [{ import_batch_id: "batch-latest-completed" }],
        };
      }

      return { rowCount: 0, rows: [] };
    });

    const app = await createIntegrationApp({
      databaseService: { query },
    });

    const response = await request(app.getHttpServer()).get(
      "/api/integrations/import-batches/summary?entityType=assignment&sourceCode=HRIS&startedFrom=2026-04-17T00:00:00.000Z&startedTo=2026-04-18T00:00:00.000Z",
    );

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      totals: {
        all: 8,
        completed: 5,
        failed: 2,
        completedWithErrors: 1,
        pending: 0,
        queued: 0,
        processing: 0,
      },
      healthTotals: {
        healthy: 5,
        inProgress: 0,
        blocked: 0,
        retryReady: 2,
        needsAction: 1,
      },
      latest: {
        completedBatchId: "batch-latest-completed",
        failedBatchId: "batch-latest-failed",
        inProgressBatchId: null,
      },
    });
    expect(
      query.mock.calls.some(
        (call) =>
          typeof call[0] === "string" &&
          call[0].includes(
            "WHERE stg.import_batch.entity_type = $1 AND src.source_code = $2 AND stg.import_batch.started_at >= $3::timestamptz AND stg.import_batch.started_at <= $4::timestamptz",
          ) &&
          JSON.stringify((call as any[])[1]) ===
            JSON.stringify([
              "assignment",
              "HRIS",
              "2026-04-17T00:00:00.000Z",
              "2026-04-18T00:00:00.000Z",
            ]),
      ),
    ).toBe(true);

    await app.close();
  });

  it("returns import admin overview with health totals, action totals, and stuck pointers", async () => {
    const query = jest.fn(async (sql: string, params?: unknown[]) => {
      if (sql.includes("GROUP BY status")) {
        return {
          rowCount: 4,
          rows: [
            { status: "completed", batch_count: "5" },
            { status: "failed", batch_count: "2" },
            { status: "completed_with_errors", batch_count: "1" },
            { status: "processing", batch_count: "1" },
          ],
        };
      }

      if (
        sql.includes("COUNT(*)::text AS total_count") &&
        sql.includes("FROM stg.import_batch") &&
        !sql.includes("action_totals")
      ) {
        return {
          rowCount: 1,
          rows: [{ total_count: "9" }],
        };
      }

      if (sql.includes("action_totals")) {
        return {
          rowCount: 1,
          rows: [
            {
              blocked_count: "1",
              retry_ready_count: "1",
              needs_action_count: "1",
              stuck_count: "1",
            },
          ],
        };
      }

      if (
        sql.includes("ORDER BY started_at DESC") &&
        Array.isArray(params) &&
        params.includes("completed")
      ) {
        return { rowCount: 1, rows: [{ import_batch_id: "batch-latest-completed" }] };
      }

      if (
        sql.includes("ORDER BY started_at DESC") &&
        Array.isArray(params) &&
        params.includes("failed")
      ) {
        return { rowCount: 1, rows: [{ import_batch_id: "batch-latest-failed" }] };
      }

      if (
        sql.includes("ORDER BY started_at DESC") &&
        Array.isArray(params) &&
        params.includes("processing")
      ) {
        return { rowCount: 1, rows: [{ import_batch_id: "batch-latest-processing" }] };
      }

      if (sql.includes("latest_stuck_batch")) {
        return { rowCount: 1, rows: [{ import_batch_id: "batch-stuck-1" }] };
      }

      return { rowCount: 0, rows: [] };
    });

    const app = await createIntegrationApp({
      databaseService: { query },
    });

    const response = await request(app.getHttpServer()).get(
      "/api/integrations/import-batches/overview?entityType=assignment&sourceCode=HRIS",
    );

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      totals: {
        all: 9,
        completed: 5,
        failed: 2,
        completedWithErrors: 1,
        pending: 0,
        queued: 0,
        processing: 1,
      },
      healthTotals: {
        healthy: 5,
        inProgress: 0,
        blocked: 1,
        retryReady: 1,
        needsAction: 1,
        stuck: 1,
      },
      actionTotals: {
        blocked: 1,
        retryReady: 1,
        needsAction: 1,
        stuck: 1,
      },
      latest: {
        completedBatchId: "batch-latest-completed",
        failedBatchId: "batch-latest-failed",
        inProgressBatchId: "batch-latest-processing",
        stuckBatchId: "batch-stuck-1",
      },
    });

    await app.close();
  });

  it("returns import needs-action queue with blocked, retry-ready, needs-action, and stuck items", async () => {
    const query = jest.fn(async (sql: string, params?: unknown[]) => {
      if (sql.includes("COUNT(*)::text AS total_count") && sql.includes("action_queue")) {
        return {
          rowCount: 1,
          rows: [{ total_count: "3" }],
        };
      }

      if (sql.includes("FROM action_queue") && sql.includes("ORDER BY started_at DESC")) {
        return {
          rowCount: 3,
          rows: [
            {
              import_batch_id: "batch-blocked-1",
              integration_source_id: "source-1",
              source_code: "HRIS",
              source_name: "Corporate HRIS",
              entity_type: "assignment",
              started_at: "2026-04-17T08:00:00.000Z",
              finished_at: "2026-04-17T08:05:00.000Z",
              status: "failed",
              raw_file_name: "assignments-blocked.csv",
              record_count: 12,
              error_count: 5,
              retry_count: 1,
              last_retried_at: "2026-04-17T08:10:00.000Z",
              health_state: "blocked",
              action_reason: "Missing dependency mappings detected",
              recommended_action: "Import the missing dependency entity types before retrying",
              is_stuck: false,
            },
            {
              import_batch_id: "batch-retry-1",
              integration_source_id: "source-1",
              source_code: "HRIS",
              source_name: "Corporate HRIS",
              entity_type: "employee",
              started_at: "2026-04-17T09:00:00.000Z",
              finished_at: "2026-04-17T09:02:00.000Z",
              status: "failed",
              raw_file_name: "employees-retry.csv",
              record_count: 20,
              error_count: 3,
              retry_count: 0,
              last_retried_at: null,
              health_state: "retry_ready",
              action_reason: "Retryable write errors remain",
              recommended_action: "Retry the batch now",
              is_stuck: false,
            },
            {
              import_batch_id: "batch-stuck-1",
              integration_source_id: "source-2",
              source_code: "ERP",
              source_name: "ERP Feed",
              entity_type: "store",
              started_at: "2026-04-17T00:00:00.000Z",
              finished_at: null,
              status: "processing",
              raw_file_name: "stores.csv",
              record_count: 6,
              error_count: 0,
              retry_count: 0,
              last_retried_at: null,
              health_state: "stuck",
              action_reason: "Batch has exceeded the in-progress time threshold",
              recommended_action: "Inspect worker execution and consider retrying after the root cause is fixed",
              is_stuck: true,
            },
          ],
        };
      }

      if (
        sql.includes("SUM(CASE WHEN validation_error ILIKE '%employee reference could not be resolved%'")
      ) {
        return {
          rowCount: 1,
          rows: [
            {
              employee_count: "0",
              store_count: "0",
              position_count: "2",
              region_count: "0",
              company_count: "0",
              manager_count: "1",
            },
          ],
        };
      }

      return { rowCount: 0, rows: [] };
    });

    const app = await createIntegrationApp({
      databaseService: { query },
    });

    const response = await request(app.getHttpServer()).get(
      "/api/integrations/import-batches/needs-action?limit=20&offset=0",
    );

    expect(response.status).toBe(200);
    expect(response.body.meta).toEqual({
      count: 3,
      total: 3,
      limit: 20,
      offset: 0,
    });
    expect(response.body.items).toEqual([
      {
        batchId: "batch-blocked-1",
        integrationSourceId: "source-1",
        sourceCode: "HRIS",
        sourceName: "Corporate HRIS",
        entityType: "assignment",
        startedAt: "2026-04-17T08:00:00.000Z",
        finishedAt: "2026-04-17T08:05:00.000Z",
        status: "failed",
        fileReference: "assignments-blocked.csv",
        recordCount: 12,
        errorCount: 5,
        retryCount: 1,
        lastRetriedAt: "2026-04-17T08:10:00.000Z",
        healthState: "blocked",
        actionReason: "Missing dependency mappings detected",
        recommendedAction: "Import the missing dependency entity types before retrying",
        blockedByEntityTypes: ["position", "employee"],
        recommendedNextEntityType: "position",
        canRetryNow: false,
        isStuck: false,
      },
      {
        batchId: "batch-retry-1",
        integrationSourceId: "source-1",
        sourceCode: "HRIS",
        sourceName: "Corporate HRIS",
        entityType: "employee",
        startedAt: "2026-04-17T09:00:00.000Z",
        finishedAt: "2026-04-17T09:02:00.000Z",
        status: "failed",
        fileReference: "employees-retry.csv",
        recordCount: 20,
        errorCount: 3,
        retryCount: 0,
        lastRetriedAt: null,
        healthState: "retry_ready",
        actionReason: "Retryable write errors remain",
        recommendedAction: "Retry the batch now",
        blockedByEntityTypes: [],
        recommendedNextEntityType: null,
        canRetryNow: true,
        isStuck: false,
      },
      {
        batchId: "batch-stuck-1",
        integrationSourceId: "source-2",
        sourceCode: "ERP",
        sourceName: "ERP Feed",
        entityType: "store",
        startedAt: "2026-04-17T00:00:00.000Z",
        finishedAt: null,
        status: "processing",
        fileReference: "stores.csv",
        recordCount: 6,
        errorCount: 0,
        retryCount: 0,
        lastRetriedAt: null,
        healthState: "stuck",
        actionReason: "Batch has exceeded the in-progress time threshold",
        recommendedAction:
          "Inspect worker execution and consider retrying after the root cause is fixed",
        blockedByEntityTypes: [],
        recommendedNextEntityType: null,
        canRetryNow: false,
        isStuck: true,
      },
    ]);

    await app.close();
  });

  it("creates an import batch, writes staging rows, and dispatches async work", async () => {
    const query = jest.fn(async (sql: string) => {
      if (sql.includes("SELECT integration_source_id")) {
        return {
          rowCount: 1,
          rows: [{ integration_source_id: "source-1" }],
        };
      }

      if (sql.includes("INSERT INTO stg.import_batch")) {
        return {
          rowCount: 1,
          rows: [
            {
              import_batch_id: "batch-1",
              started_at: "2026-04-17T00:00:00.000Z",
              status: "pending",
            },
          ],
        };
      }

      return { rowCount: 1, rows: [] };
    });
    const dispatch = jest.fn(async () => ({
      status: "queued" as const,
      jobType: "import-batch" as const,
      backend: "test",
      jobId: "job-import-1",
      queueName: "store-ops-import",
    }));

    const app = await createIntegrationApp({
      databaseService: {
        query,
        withTransaction: async <T>(work: (client: { query: typeof query }) => Promise<T>) =>
          work({ query }),
      },
      jobDispatcher: { dispatch },
    });

    const response = await request(app.getHttpServer())
      .post("/api/integrations/import-batches")
      .set("x-user-id", "user-1")
      .send({
        sourceCode: "hris",
        entityType: "employee",
        fileReference: "employees.csv",
        rows: [
          {
            sourceEmployeeId: "EMP-1",
            companyId: "00000000-0000-0000-0000-000000000001",
          },
        ],
      });

    expect(response.status).toBe(201);
    expect(response.body.command).toEqual({
      status: "queued",
      message: "Import batch accepted for async processing",
    });
    expect(response.body.data.batch.batchId).toBe("batch-1");
    expect(response.body.job).toEqual({
      jobType: "import-batch",
      backend: "test",
      jobId: "job-import-1",
      queueName: "store-ops-import",
    });
    expect(dispatch).toHaveBeenCalledWith(
      "import-batch",
      { batchId: "batch-1" },
      expect.any(Function),
    );

    await app.close();
  });

  it("accepts assignment import batches and stages assignment rows", async () => {
    const query = jest.fn(async (sql: string) => {
      if (sql.includes("SELECT integration_source_id")) {
        return {
          rowCount: 1,
          rows: [{ integration_source_id: "source-1" }],
        };
      }

      if (sql.includes("INSERT INTO stg.import_batch")) {
        return {
          rowCount: 1,
          rows: [
            {
              import_batch_id: "batch-2",
              started_at: "2026-04-17T00:00:00.000Z",
              status: "pending",
            },
          ],
        };
      }

      return { rowCount: 1, rows: [] };
    });
    const dispatch = jest.fn(async () => ({
      status: "queued" as const,
      jobType: "import-batch" as const,
      backend: "test",
      jobId: "job-import-assignment-1",
      queueName: "store-ops-import",
    }));

    const app = await createIntegrationApp({
      databaseService: {
        query,
        withTransaction: async <T>(work: (client: { query: typeof query }) => Promise<T>) =>
          work({ query }),
      },
      jobDispatcher: { dispatch },
    });

    const response = await request(app.getHttpServer())
      .post("/api/integrations/import-batches")
      .set("x-user-id", "user-1")
      .send({
        sourceCode: "hris-assignment",
        entityType: "assignment",
        fileReference: "assignments.csv",
        rows: [
          {
            sourceAssignmentId: "ASN-1",
            sourceEmployeeId: "EMP-1",
            sourceStoreId: "STORE-1",
            sourcePositionId: "POS-1",
            startDate: "2026-04-01",
          },
        ],
      });

    expect(response.status).toBe(201);
    expect(response.body.command).toEqual({
      status: "queued",
      message: "Import batch accepted for async processing",
    });
    expect(response.body.data.batch.batchId).toBe("batch-2");
    expect(response.body.job).toEqual({
      jobType: "import-batch",
      backend: "test",
      jobId: "job-import-assignment-1",
      queueName: "store-ops-import",
    });
    expect(dispatch).toHaveBeenCalledWith(
      "import-batch",
      { batchId: "batch-2" },
      expect.any(Function),
    );

    await app.close();
  });

  it("accepts position import batches and stages position rows", async () => {
    const query = jest.fn(async (sql: string) => {
      if (sql.includes("SELECT integration_source_id")) {
        return {
          rowCount: 1,
          rows: [{ integration_source_id: "source-1" }],
        };
      }

      if (sql.includes("INSERT INTO stg.import_batch")) {
        return {
          rowCount: 1,
          rows: [
            {
              import_batch_id: "batch-2b",
              started_at: "2026-04-17T00:00:00.000Z",
              status: "pending",
            },
          ],
        };
      }

      return { rowCount: 1, rows: [] };
    });
    const dispatch = jest.fn(async () => ({
      status: "queued" as const,
      jobType: "import-batch" as const,
      backend: "test",
      jobId: "job-import-position-1",
      queueName: "store-ops-import",
    }));

    const app = await createIntegrationApp({
      databaseService: {
        query,
        withTransaction: async <T>(work: (client: { query: typeof query }) => Promise<T>) =>
          work({ query }),
      },
      jobDispatcher: { dispatch },
    });

    const response = await request(app.getHttpServer())
      .post("/api/integrations/import-batches")
      .set("x-user-id", "user-1")
      .send({
        sourceCode: "hris-position",
        entityType: "position",
        fileReference: "positions.csv",
        rows: [
          {
            sourcePositionId: "POS-1",
            companyId: "00000000-0000-0000-0000-000000000001",
            positionCode: "SHIFT_LEAD",
            positionName: "Shift Lead",
          },
        ],
      });

    expect(response.status).toBe(201);
    expect(response.body.command).toEqual({
      status: "queued",
      message: "Import batch accepted for async processing",
    });
    expect(response.body.data.batch.batchId).toBe("batch-2b");
    expect(response.body.job).toEqual({
      jobType: "import-batch",
      backend: "test",
      jobId: "job-import-position-1",
      queueName: "store-ops-import",
    });
    expect(dispatch).toHaveBeenCalledWith(
      "import-batch",
      { batchId: "batch-2b" },
      expect.any(Function),
    );

    await app.close();
  });

  it("accepts company import batches and stages company rows", async () => {
    const query = jest.fn(async (sql: string) => {
      if (sql.includes("SELECT integration_source_id")) {
        return { rowCount: 1, rows: [{ integration_source_id: "source-1" }] };
      }

      if (sql.includes("INSERT INTO stg.import_batch")) {
        return {
          rowCount: 1,
          rows: [
            {
              import_batch_id: "batch-2c",
              started_at: "2026-04-17T00:00:00.000Z",
              status: "pending",
            },
          ],
        };
      }

      return { rowCount: 1, rows: [] };
    });
    const dispatch = jest.fn(async () => ({
      status: "queued" as const,
      jobType: "import-batch" as const,
      backend: "test",
      jobId: "job-import-company-1",
      queueName: "store-ops-import",
    }));

    const app = await createIntegrationApp({
      databaseService: {
        query,
        withTransaction: async <T>(work: (client: { query: typeof query }) => Promise<T>) =>
          work({ query }),
      },
      jobDispatcher: { dispatch },
    });

    const response = await request(app.getHttpServer())
      .post("/api/integrations/import-batches")
      .set("x-user-id", "user-1")
      .send({
        sourceCode: "erp-company",
        entityType: "company",
        fileReference: "companies.csv",
        rows: [{ sourceCompanyId: "COMP-1", companyCode: "ACME", companyName: "Acme Retail" }],
      });

    expect(response.status).toBe(201);
    expect(response.body.command).toEqual({
      status: "queued",
      message: "Import batch accepted for async processing",
    });
    expect(response.body.data.batch.batchId).toBe("batch-2c");
    expect(response.body.job).toEqual({
      jobType: "import-batch",
      backend: "test",
      jobId: "job-import-company-1",
      queueName: "store-ops-import",
    });
    await app.close();
  });

  it("accepts region import batches and stages region rows", async () => {
    const query = jest.fn(async (sql: string) => {
      if (sql.includes("SELECT integration_source_id")) {
        return { rowCount: 1, rows: [{ integration_source_id: "source-1" }] };
      }

      if (sql.includes("INSERT INTO stg.import_batch")) {
        return {
          rowCount: 1,
          rows: [
            {
              import_batch_id: "batch-2d",
              started_at: "2026-04-17T00:00:00.000Z",
              status: "pending",
            },
          ],
        };
      }

      return { rowCount: 1, rows: [] };
    });
    const dispatch = jest.fn(async () => ({
      status: "queued" as const,
      jobType: "import-batch" as const,
      backend: "test",
      jobId: "job-import-region-1",
      queueName: "store-ops-import",
    }));

    const app = await createIntegrationApp({
      databaseService: {
        query,
        withTransaction: async <T>(work: (client: { query: typeof query }) => Promise<T>) =>
          work({ query }),
      },
      jobDispatcher: { dispatch },
    });

    const response = await request(app.getHttpServer())
      .post("/api/integrations/import-batches")
      .set("x-user-id", "user-1")
      .send({
        sourceCode: "erp-region",
        entityType: "region",
        fileReference: "regions.csv",
        rows: [
          {
            sourceRegionId: "REG-1",
            sourceCompanyId: "COMP-1",
            regionCode: "MARMARA",
            regionName: "Marmara",
          },
        ],
      });

    expect(response.status).toBe(201);
    expect(response.body.command).toEqual({
      status: "queued",
      message: "Import batch accepted for async processing",
    });
    expect(response.body.data.batch.batchId).toBe("batch-2d");
    expect(response.body.job).toEqual({
      jobType: "import-batch",
      backend: "test",
      jobId: "job-import-region-1",
      queueName: "store-ops-import",
    });
    await app.close();
  });

  it("returns import batch detail with row status summary", async () => {
    const query = jest.fn(async (sql: string) => {
      if (sql.includes("FROM stg.import_batch")) {
        return {
          rowCount: 1,
          rows: [
            {
              import_batch_id: "batch-3",
              integration_source_id: "source-1",
              source_code: "HRIS",
              source_name: "Corporate HRIS",
              entity_type: "assignment",
              started_at: "2026-04-17T10:00:00.000Z",
              finished_at: "2026-04-17T10:05:00.000Z",
              status: "completed_with_errors",
              raw_file_name: "assignments.csv",
              record_count: 3,
              error_count: 1,
              retry_count: 1,
              last_retried_at: "2026-04-17T10:06:00.000Z",
            },
          ],
        };
      }

      if (sql.includes("FROM stg.assignment_raw")) {
        if (sql.includes("SUM(CASE")) {
          return {
            rowCount: 1,
            rows: [
              {
                employee_count: "1",
                store_count: "0",
                position_count: "1",
                region_count: "0",
                company_count: "0",
                manager_count: "0",
              },
            ],
          };
        }

        return {
          rowCount: 3,
          rows: [
            { normalized_status: "processed", row_count: "2" },
            { normalized_status: "validation_failed", row_count: "1" },
          ],
        };
      }

      return { rowCount: 0, rows: [] };
    });

    const app = await createIntegrationApp({
      databaseService: { query },
    });

    const response = await request(app.getHttpServer()).get(
      "/api/integrations/import-batches/batch-3",
    );

    expect(response.status).toBe(200);
    expect(response.body.batch).toEqual({
      batchId: "batch-3",
      integrationSourceId: "source-1",
      sourceCode: "HRIS",
      sourceName: "Corporate HRIS",
      entityType: "assignment",
      startedAt: "2026-04-17T10:00:00.000Z",
      finishedAt: "2026-04-17T10:05:00.000Z",
      status: "completed_with_errors",
      fileReference: "assignments.csv",
      recordCount: 3,
      errorCount: 1,
      retryCount: 1,
      lastRetriedAt: "2026-04-17T10:06:00.000Z",
      healthState: "blocked",
    });
    expect(response.body.rowStatusSummary).toEqual({
      processed: 2,
      validationFailed: 1,
      retryableError: 0,
      pending: 0,
    });
    expect(response.body.dependencySummary).toEqual({
      employee: 1,
      store: 0,
      position: 1,
      region: 0,
      company: 0,
      manager: 0,
    });
    expect(response.body.blockedByEntityTypes).toEqual(["position", "employee"]);
    expect(response.body.recommendedImportOrder).toEqual([
      "company",
      "region",
      "store",
      "position",
      "employee",
      "assignment",
      "kpi",
    ]);
    expect(response.body.recommendedNextEntityType).toBe("position");
    expect(response.body.canRetryNow).toBe(false);
    expect(response.body.healthState).toBe("blocked");

    await app.close();
  });

  it("returns import batch reconciliation totals and rates", async () => {
    const query = jest.fn(async (sql: string) => {
      if (sql.includes("FROM stg.import_batch")) {
        return {
          rowCount: 1,
          rows: [
            {
              import_batch_id: "batch-rec-1",
              integration_source_id: "source-1",
              source_code: "HRIS",
              source_name: "Corporate HRIS",
              entity_type: "assignment",
              started_at: "2026-04-17T09:00:00.000Z",
              finished_at: "2026-04-17T09:05:00.000Z",
              status: "completed_with_errors",
              raw_file_name: "assignments.csv",
              record_count: 10,
              error_count: 2,
              retry_count: 1,
              last_retried_at: "2026-04-17T09:10:00.000Z",
            },
          ],
        };
      }

      if (sql.includes("GROUP BY normalized_status") && sql.includes("FROM stg.assignment_raw")) {
        return {
          rowCount: 4,
          rows: [
            { normalized_status: "processed", row_count: "6" },
            { normalized_status: "validation_failed", row_count: "2" },
            { normalized_status: "retryable_error", row_count: "1" },
            { normalized_status: "pending", row_count: "1" },
          ],
        };
      }

      if (sql.includes("SUM(CASE") && sql.includes("FROM stg.assignment_raw")) {
        return {
          rowCount: 1,
          rows: [
            {
              employee_count: "0",
              store_count: "0",
              position_count: "1",
              region_count: "0",
              company_count: "0",
              manager_count: "0",
            },
          ],
        };
      }

      return { rowCount: 0, rows: [] };
    });

    const app = await createIntegrationApp({
      databaseService: { query },
    });

    const response = await request(app.getHttpServer()).get(
      "/api/integrations/import-batches/batch-rec-1/reconciliation",
    );

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      batch: {
        batchId: "batch-rec-1",
        integrationSourceId: "source-1",
        sourceCode: "HRIS",
        sourceName: "Corporate HRIS",
        entityType: "assignment",
        startedAt: "2026-04-17T09:00:00.000Z",
        finishedAt: "2026-04-17T09:05:00.000Z",
        status: "completed_with_errors",
        fileReference: "assignments.csv",
        recordCount: 10,
        errorCount: 2,
        retryCount: 1,
        lastRetriedAt: "2026-04-17T09:10:00.000Z",
        healthState: "blocked",
      },
      totals: {
        recordCount: 10,
        accountedRows: 10,
        unaccountedRows: 0,
        countsMatchRecordCount: true,
      },
      rowStatusSummary: {
        processed: 6,
        validationFailed: 2,
        retryableError: 1,
        pending: 1,
      },
      rates: {
        processedRate: 0.6,
        validationFailureRate: 0.2,
        retryableErrorRate: 0.1,
        pendingRate: 0.1,
        accountedRate: 1,
      },
      reconciliation: {
        hasFailures: true,
        hasPendingRows: true,
        hasUnaccountedRows: false,
        canRetryNow: false,
        blockedByEntityTypes: ["position"],
        recommendedNextEntityType: "position",
      },
    });

    await app.close();
  });

  it("returns import batch error rows with pagination metadata", async () => {
    const query = jest.fn(async (sql: string) => {
      if (sql.includes("FROM stg.import_batch")) {
        return {
          rowCount: 1,
          rows: [{ entity_type: "assignment" }],
        };
      }

      if (sql.includes("COUNT(*)::text AS total_count") && sql.includes("FROM stg.assignment_raw")) {
        return {
          rowCount: 1,
          rows: [{ total_count: "2" }],
        };
      }

      if (sql.includes("FROM stg.assignment_raw")) {
        return {
          rowCount: 2,
          rows: [
            {
              row_id: "row-1",
              source_ref: "ASN-1",
              normalized_status: "validation_failed",
              validation_error: "position reference is required",
              processed_at: "2026-04-17T10:01:00.000Z",
            },
            {
              row_id: "row-2",
              source_ref: "ASN-2",
              normalized_status: "retryable_error",
              validation_error: "employee reference could not be resolved",
              processed_at: null,
            },
          ],
        };
      }

      return { rowCount: 0, rows: [] };
    });

    const app = await createIntegrationApp({
      databaseService: { query },
    });

    const response = await request(app.getHttpServer()).get(
      "/api/integrations/import-batches/batch-3/errors?limit=20&offset=0",
    );

    expect(response.status).toBe(200);
    expect(response.body.items).toEqual([
      {
        rowId: "row-1",
        sourceRef: "ASN-1",
        normalizedStatus: "validation_failed",
        errorCategory: "validation",
        validationError: "position reference is required",
        processedAt: "2026-04-17T10:01:00.000Z",
      },
      {
        rowId: "row-2",
        sourceRef: "ASN-2",
        normalizedStatus: "retryable_error",
        errorCategory: "missing_dependency",
        validationError: "employee reference could not be resolved",
        processedAt: null,
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

  it("returns import batch audit events", async () => {
    const query = jest.fn(async (sql: string) => {
      if (sql.includes("FROM stg.import_batch")) {
        return {
          rowCount: 1,
          rows: [
            {
              import_batch_id: "batch-3",
              integration_source_id: "source-1",
              source_code: "HRIS",
              source_name: "Corporate HRIS",
              entity_type: "assignment",
              started_at: "2026-04-17T10:00:00.000Z",
              finished_at: "2026-04-17T10:05:00.000Z",
              status: "completed_with_errors",
              raw_file_name: "assignments.csv",
              record_count: 3,
              error_count: 1,
              retry_count: 1,
              last_retried_at: "2026-04-17T10:06:00.000Z",
            },
          ],
        };
      }

      if (sql.includes("FROM audit.event_log")) {
        return {
          rowCount: 2,
          rows: [
            {
              event_log_id: "evt-1",
              occurred_at: "2026-04-17T10:00:00.000Z",
              actor_user_id: "user-1",
              event_type: "import_batch.created",
              metadata_json: {
                sourceCode: "HRIS",
                entityType: "assignment",
                fileReference: "assignments.csv",
              },
            },
            {
              event_log_id: "evt-2",
              occurred_at: "2026-04-17T10:06:00.000Z",
              actor_user_id: "user-1",
              event_type: "import_batch.retried",
              metadata_json: {
                entityType: "assignment",
                retryCount: 2,
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

    const response = await request(app.getHttpServer()).get(
      "/api/integrations/import-batch-audit/batch-3",
    );

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
        occurredAt: "2026-04-17T10:00:00.000Z",
        actorUserId: "user-1",
        correlationId: null,
        eventType: "import_batch.created",
        metadata: {
          sourceCode: "HRIS",
          entityType: "assignment",
          fileReference: "assignments.csv",
        },
      },
      {
        eventLogId: "evt-2",
        occurredAt: "2026-04-17T10:06:00.000Z",
        actorUserId: "user-1",
        correlationId: null,
        eventType: "import_batch.retried",
        metadata: {
          entityType: "assignment",
          retryCount: 2,
        },
      },
    ]);

    await app.close();
  });

  it("returns import batch audit events from the nested audit route", async () => {
    const query = jest.fn(async (sql: string) => {
      if (sql.includes("FROM stg.import_batch")) {
        return {
          rowCount: 1,
          rows: [
            {
              import_batch_id: "batch-3",
              integration_source_id: "source-1",
              source_code: "HRIS",
              source_name: "Corporate HRIS",
              entity_type: "assignment",
              started_at: "2026-04-17T10:00:00.000Z",
              finished_at: "2026-04-17T10:05:00.000Z",
              status: "completed_with_errors",
              raw_file_name: "assignments.csv",
              record_count: 3,
              error_count: 1,
              retry_count: 1,
              last_retried_at: "2026-04-17T10:06:00.000Z",
            },
          ],
        };
      }

      if (sql.includes("FROM audit.event_log")) {
        return {
          rowCount: 2,
          rows: [
            {
              event_log_id: "evt-1",
              occurred_at: "2026-04-17T10:00:00.000Z",
              actor_user_id: "user-1",
              event_type: "import_batch.created",
              metadata_json: {
                sourceCode: "HRIS",
                entityType: "assignment",
                fileReference: "assignments.csv",
              },
            },
            {
              event_log_id: "evt-2",
              occurred_at: "2026-04-17T10:06:00.000Z",
              actor_user_id: "user-1",
              event_type: "import_batch.retried",
              metadata_json: {
                entityType: "assignment",
                retryCount: 2,
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

    const response = await request(app.getHttpServer()).get(
      "/api/integrations/import-batches/batch-3/audit",
    );

    expect(response.status).toBe(200);
    expect(response.body.meta).toEqual({
      count: 2,
      total: 2,
      limit: 50,
      offset: 0,
    });

    await app.close();
  });

  it("requeues import batches that no longer have blocking dependencies", async () => {
    const query = jest.fn(async (sql: string) => {
      if (sql.includes("FROM stg.import_batch") && sql.includes("LIMIT 1")) {
        return {
          rowCount: 1,
          rows: [
            {
              import_batch_id: "batch-r1",
              integration_source_id: "source-1",
              source_code: "HRIS",
              source_name: "Corporate HRIS",
              entity_type: "assignment",
              started_at: "2026-04-17T10:00:00.000Z",
              finished_at: "2026-04-17T10:05:00.000Z",
              status: "failed",
              raw_file_name: "assignments.csv",
              record_count: 3,
              error_count: 1,
              retry_count: 1,
              last_retried_at: "2026-04-17T10:06:00.000Z",
            },
          ],
        };
      }

      if (sql.includes("COUNT(*)::text AS row_count") || sql.includes("GROUP BY normalized_status")) {
        return {
          rowCount: 1,
          rows: [{ normalized_status: "retryable_error", row_count: "1" }],
        };
      }

      if (sql.includes("SUM(CASE") && sql.includes("FROM stg.assignment_raw")) {
        return {
          rowCount: 1,
          rows: [
            {
              employee_count: "0",
              store_count: "0",
              position_count: "0",
              region_count: "0",
              company_count: "0",
              manager_count: "0",
            },
          ],
        };
      }

      return { rowCount: 1, rows: [] };
    });
    const dispatch = jest.fn(async () => ({
      status: "queued" as const,
      jobType: "import-batch" as const,
      backend: "test",
      jobId: "job-import-retry-1",
      queueName: "store-ops-import",
    }));

    const app = await createIntegrationApp({
      databaseService: { query },
      jobDispatcher: { dispatch },
    });

    const response = await request(app.getHttpServer())
      .post("/api/integrations/import-batches/batch-r1/retry")
      .set("x-user-id", "user-1");

    expect(response.status).toBe(201);
    expect(response.body.command).toEqual({
      status: "queued",
      message: "Import batch requeued for retry",
    });
    expect(response.body.data.batch.batchId).toBe("batch-r1");
    expect(response.body.data.batch.retryCount).toBe(2);
    expect(response.body.data.batch.lastRetriedAt).toBeNull();
    expect(response.body.job).toEqual({
      jobType: "import-batch",
      backend: "test",
      jobId: "job-import-retry-1",
      queueName: "store-ops-import",
    });
    expect(dispatch).toHaveBeenCalledWith(
      "import-batch",
      { batchId: "batch-r1" },
      expect.any(Function),
    );

    await app.close();
  });

  it("does not requeue import batches with unresolved blocking dependencies", async () => {
    const query = jest.fn(async (sql: string) => {
      if (sql.includes("FROM stg.import_batch") && sql.includes("LIMIT 1")) {
        return {
          rowCount: 1,
          rows: [
            {
              import_batch_id: "batch-r2",
              integration_source_id: "source-1",
              source_code: "HRIS",
              source_name: "Corporate HRIS",
              entity_type: "assignment",
              started_at: "2026-04-17T10:00:00.000Z",
              finished_at: "2026-04-17T10:05:00.000Z",
              status: "failed",
              raw_file_name: "assignments.csv",
              record_count: 3,
              error_count: 1,
              retry_count: 0,
              last_retried_at: null,
            },
          ],
        };
      }

      if (sql.includes("GROUP BY normalized_status")) {
        return {
          rowCount: 1,
          rows: [{ normalized_status: "retryable_error", row_count: "1" }],
        };
      }

      if (sql.includes("SUM(CASE") && sql.includes("FROM stg.assignment_raw")) {
        return {
          rowCount: 1,
          rows: [
            {
              employee_count: "1",
              store_count: "0",
              position_count: "0",
              region_count: "0",
              company_count: "0",
              manager_count: "0",
            },
          ],
        };
      }

      return { rowCount: 1, rows: [] };
    });
    const dispatch = jest.fn();

    const app = await createIntegrationApp({
      databaseService: { query },
      jobDispatcher: { dispatch },
    });

    const response = await request(app.getHttpServer())
      .post("/api/integrations/import-batches/batch-r2/retry")
      .set("x-user-id", "user-1");

    expect(response.status).toBe(409);
    expect(dispatch).not.toHaveBeenCalled();

    await app.close();
  });

  it("does not requeue completed import batches without retryable rows", async () => {
    const query = jest.fn(async (sql: string) => {
      if (sql.includes("FROM stg.import_batch") && sql.includes("LIMIT 1")) {
        return {
          rowCount: 1,
          rows: [
            {
              import_batch_id: "batch-r3",
              integration_source_id: "source-1",
              source_code: "HRIS",
              source_name: "Corporate HRIS",
              entity_type: "assignment",
              started_at: "2026-04-17T10:00:00.000Z",
              finished_at: "2026-04-17T10:05:00.000Z",
              status: "completed",
              raw_file_name: "assignments.csv",
              record_count: 3,
              error_count: 0,
              retry_count: 0,
              last_retried_at: null,
            },
          ],
        };
      }

      if (sql.includes("GROUP BY normalized_status")) {
        return {
          rowCount: 1,
          rows: [{ normalized_status: "processed", row_count: "3" }],
        };
      }

      if (sql.includes("SUM(CASE") && sql.includes("FROM stg.assignment_raw")) {
        return {
          rowCount: 1,
          rows: [
            {
              employee_count: "0",
              store_count: "0",
              position_count: "0",
              region_count: "0",
              company_count: "0",
              manager_count: "0",
            },
          ],
        };
      }

      return { rowCount: 1, rows: [] };
    });
    const dispatch = jest.fn();

    const app = await createIntegrationApp({
      databaseService: { query },
      jobDispatcher: { dispatch },
    });

    const response = await request(app.getHttpServer())
      .post("/api/integrations/import-batches/batch-r3/retry")
      .set("x-user-id", "user-1");

    expect(response.status).toBe(409);
    expect(dispatch).not.toHaveBeenCalled();

    await app.close();
  });

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
      .patch("/api/integrations/sources/source-managed-3/deactivate")
      .set("x-user-id", "admin-1")
      .set("x-role-codes", "INTEGRATION_ADMIN");

    expect(deactivateResponse.status).toBe(200);
    expect(deactivateResponse.body.data.source.isActive).toBe(false);

    const reactivateResponse = await request(app.getHttpServer())
      .patch("/api/integrations/sources/source-managed-3/reactivate")
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
      .get("/api/integrations/sources/source-managed-3/audit")
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
        params[0] === "source-busy-1"
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
      .patch("/api/integrations/sources/source-busy-1/deactivate")
      .set("x-user-id", "admin-1")
      .set("x-role-codes", "INTEGRATION_ADMIN");

    expect(response.status).toBe(409);
    expect(response.body.message).toBe(
      "Integration source source-busy-1 cannot be deactivated while active import batches exist",
    );

    await app.close();
  });
});
