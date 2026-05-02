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
          "FF",
          "UPT",
          "ATV",
          "CR",
        ]),
        derivedMetricCodes: expect.arrayContaining(["TARGET_ACHIEVEMENT"]),
        dataQualityIssueCodes: expect.arrayContaining([
          "missing_identity",
          "unmapped_store",
          "unmapped_employee",
          "invalid_metric",
          "duplicate_source_row",
          "late_correction_candidate",
          "schema_mismatch",
        ]),
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

  it("stages KPI import row lineage as first-class raw columns", async () => {
    const query = jest.fn(async (sql: string, params?: unknown[]) => {
      if (
        sql.includes("FROM stg.integration_source") &&
        sql.includes("WHERE source_code = $1") &&
        sql.includes("entity_type = $2")
      ) {
        return {
          rowCount: 1,
          rows: [
            {
              integration_source_id: "source-kpi-1",
              source_code: "kpi-feed",
              source_name: "KPI Feed",
              entity_type: "kpi",
              source_system: "other",
              state_model: "latest_state",
              is_active: true,
            },
          ],
        };
      }

      if (sql.includes("SELECT integration_source_id") && sql.includes("AND is_active = TRUE")) {
        return {
          rowCount: 1,
          rows: [{ integration_source_id: "source-kpi-1" }],
        };
      }

      if (sql.includes("INSERT INTO stg.import_batch")) {
        return {
          rowCount: 1,
          rows: [
            {
              import_batch_id: "batch-kpi-lineage-1",
              started_at: "2026-04-17T00:00:00.000Z",
              status: "pending",
              source_batch_id: null,
              source_payload_hash: null,
              source_captured_at: null,
              source_window_started_at: null,
              source_window_ended_at: null,
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
      jobId: "job-kpi-lineage-1",
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
      .set("x-role-codes", "INTEGRATION_ADMIN")
      .send({
        sourceCode: "kpi-feed",
        entityType: "kpi",
        fileReference: "kpis.json",
        rows: [
          {
            kpiCode: "UPT",
            actualValue: 3.2,
            storeExternalRef: "M-10",
            employeeExternalRef: "S-100",
            periodStart: "2026-04-22",
            periodEnd: "2026-04-22",
          },
        ],
      });

    expect(response.status).toBe(201);
    const kpiRawInsert = query.mock.calls.find(
      ([sql]) => typeof sql === "string" && sql.includes("INSERT INTO stg.kpi_raw"),
    );
    expect(kpiRawInsert?.[0]).toContain(
      "payload_json,\n                  row_hash,\n                  raw_row_reference",
    );
    expect(kpiRawInsert?.[0]).toContain("row_hash");
    expect(kpiRawInsert?.[0]).toContain("raw_row_reference");
    expect(kpiRawInsert?.[1]).toEqual([
      "batch-kpi-lineage-1",
      "UPT",
      "M-10",
      "S-100",
      "2026-04-22",
      "2026-04-22",
      expect.stringContaining('"rowHash"'),
      expect.stringMatching(/^[a-f0-9]{64}$/),
      "other:UPT:daily:2026-04-22:2026-04-22:M-10:S-100",
    ]);

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
});
