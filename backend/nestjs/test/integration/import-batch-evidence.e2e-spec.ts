import * as request from "supertest";
import { createIntegrationApp } from "./test-app";

describe("Import batch evidence", () => {
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

        if (sql.includes("validation_error") && sql.includes("COUNT(*)::text AS row_count")) {
          return {
            rowCount: 2,
            rows: [
              {
                normalized_status: "validation_failed",
                validation_error: "position reference is required",
                row_count: "1",
              },
              {
                normalized_status: "retryable_error",
                validation_error: "employee reference could not be resolved",
                row_count: "1",
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
    expect(response.body.qualityIssueSummary).toEqual({
      totalIssueRows: 2,
      highSeverityRows: 2,
      items: [
        {
          code: "missing_identity",
          label: "Missing identity",
          owner: "source_data",
          severity: "high",
          description: "A required source, business, or mapping identity is absent from the row.",
          count: 1,
        },
        {
          code: "unmapped_employee",
          label: "Unmapped employee",
          owner: "mapping",
          severity: "high",
          description: "The row references an employee that is not mapped to an internal employee.",
          count: 1,
        },
      ],
    });
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

  it("returns KPI import batch lineage summary for source evidence review", async () => {
    const query = jest.fn(async (sql: string) => {
      if (sql.includes("FROM stg.import_batch")) {
        return {
          rowCount: 1,
          rows: [
            {
              import_batch_id: "batch-kpi-lineage-detail-1",
              integration_source_id: "source-kpi-1",
              source_code: "KPI",
              source_name: "KPI Feed",
              entity_type: "kpi",
              started_at: "2026-04-22T10:00:00.000Z",
              finished_at: "2026-04-22T10:05:00.000Z",
              status: "completed",
              raw_file_name: "kpis.json",
              record_count: 2,
              error_count: 0,
              retry_count: 0,
              last_retried_at: null,
            },
          ],
        };
      }

      if (sql.includes("row_hash_count") && sql.includes("FROM stg.kpi_raw")) {
        return {
          rowCount: 1,
          rows: [
            {
              row_hash_count: "2",
              raw_row_reference_count: "2",
              sample_row_hash: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
              sample_raw_row_reference: "other:UPT:daily:2026-04-22:2026-04-22:M-10:S-100",
            },
          ],
        };
      }

      if (sql.includes("GROUP BY normalized_status") && sql.includes("FROM stg.kpi_raw")) {
        return {
          rowCount: 1,
          rows: [{ normalized_status: "processed", row_count: "2" }],
        };
      }

      if (sql.includes("SUM(CASE") && sql.includes("FROM stg.kpi_raw")) {
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

      return { rowCount: 0, rows: [] };
    });

    const app = await createIntegrationApp({
      databaseService: { query },
    });

    const response = await request(app.getHttpServer()).get(
      "/api/integrations/import-batches/batch-kpi-lineage-detail-1",
    );

    expect(response.status).toBe(200);
    expect(response.body.lineageSummary).toEqual({
      supported: true,
      rowHashCount: 2,
      rawRowReferenceCount: 2,
      sampleRowHash: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      sampleRawRowReference: "other:UPT:daily:2026-04-22:2026-04-22:M-10:S-100",
    });

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
        qualityIssueCode: "missing_identity",
        validationError: "position reference is required",
        processedAt: "2026-04-17T10:01:00.000Z",
      },
      {
        rowId: "row-2",
        sourceRef: "ASN-2",
        normalizedStatus: "retryable_error",
        errorCategory: "missing_dependency",
        qualityIssueCode: "unmapped_employee",
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

  it("returns KPI import batch error row lineage for reconciliation", async () => {
    const query = jest.fn(async (sql: string) => {
      if (sql.includes("FROM stg.import_batch")) {
        return {
          rowCount: 1,
          rows: [
            {
              integration_source_id: "11111111-1111-4111-8111-111111111111",
              entity_type: "kpi",
            },
          ],
        };
      }

      if (sql.includes("COUNT(*)::text AS total_count") && sql.includes("FROM stg.kpi_raw")) {
        return {
          rowCount: 1,
          rows: [{ total_count: "1" }],
        };
      }

      if (sql.includes("FROM stg.kpi_raw")) {
        return {
          rowCount: 1,
          rows: [
            {
              row_id: "kpi-row-1",
              source_ref: "UPT",
              store_external_ref: "powerbi:MARMARA PARK",
              employee_external_ref: "powerbi:AYSE DEMIR",
              payload_json: {
                storeExternalRef: "powerbi:MARMARA PARK",
                employeeExternalRef: "powerbi:AYSE DEMIR",
              },
              row_hash: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
              raw_row_reference: "other:UPT:daily:2026-04-22:2026-04-22:M-10:S-100",
              normalized_status: "retryable_error",
              validation_error: "store reference could not be resolved",
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
      "/api/integrations/import-batches/batch-kpi-lineage-errors-1/errors?limit=20&offset=0",
    );

    expect(response.status).toBe(200);
    expect(response.body.items).toEqual([
      {
        rowId: "kpi-row-1",
        sourceRef: "UPT",
        rowHash: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
        rawRowReference: "other:UPT:daily:2026-04-22:2026-04-22:M-10:S-100",
        normalizedStatus: "retryable_error",
        errorCategory: "missing_dependency",
        qualityIssueCode: "unmapped_store",
        mappingCandidate: {
          integrationSourceId: "11111111-1111-4111-8111-111111111111",
          entityType: "store",
          externalId: "powerbi:MARMARA PARK",
          internalTableName: "ops.store",
        },
        validationError: "store reference could not be resolved",
        processedAt: null,
      },
    ]);

    await app.close();
  });

  it("does not expose or retry import batches outside the actor company scope", async () => {
    const actorCompanyId = "00000000-0000-0000-0000-000000000001";
    const query = jest.fn(async (sql: string, params?: unknown[]) => {
      if (sql.includes("FROM stg.import_batch") && sql.includes("WHERE b.import_batch_id = $1")) {
        expect(sql).toContain("AND b.company_ids && $2::uuid[]");
        expect(params).toEqual(["batch-out-of-scope", [actorCompanyId]]);
        return { rowCount: 0, rows: [] };
      }

      return { rowCount: 0, rows: [] };
    });
    const dispatch = jest.fn();

    const app = await createIntegrationApp({
      databaseService: { query },
      jobDispatcher: { dispatch },
    });

    const detailResponse = await request(app.getHttpServer())
      .get("/api/integrations/import-batches/batch-out-of-scope")
      .set("x-user-id", "user-1")
      .set("x-role-codes", "INTEGRATION_ADMIN")
      .set("x-company-ids", actorCompanyId);

    const retryResponse = await request(app.getHttpServer())
      .post("/api/integrations/import-batches/batch-out-of-scope/retry")
      .set("x-user-id", "user-1")
      .set("x-role-codes", "INTEGRATION_ADMIN")
      .set("x-company-ids", actorCompanyId);

    expect(detailResponse.status).toBe(404);
    expect(retryResponse.status).toBe(404);
    expect(dispatch).not.toHaveBeenCalled();
    expect(query).toHaveBeenCalledTimes(2);

    await app.close();
  });

  it("approves an external employee mapping without accepting a client-supplied table name", async () => {
    const sourceId = "11111111-1111-4111-8111-111111111111";
    const employeeId = "22222222-2222-4222-8222-222222222222";
    const actorUserId = "33333333-3333-4333-8333-333333333333";
    const actorCompanyId = "00000000-0000-0000-0000-000000000001";
    const query = jest.fn(async (sql: string, params?: unknown[]) => {
      if (
        sql.includes("SELECT user_id") &&
        sql.includes("FROM ops.user_account") &&
        sql.includes("WHERE user_id = $1::uuid")
      ) {
        expect(params).toEqual([actorUserId]);
        return { rowCount: 1, rows: [{ user_id: actorUserId }] };
      }

      if (sql.includes("FROM stg.integration_source") && sql.includes("WHERE integration_source_id")) {
        return {
          rowCount: 1,
          rows: [
            {
              integration_source_id: sourceId,
              source_code: "power-bi-kpi",
              source_name: "Power BI KPI",
              entity_type: "kpi",
              source_system: "power_bi",
              state_model: "closed_period",
              poll_enabled: false,
              poll_interval_minutes: 30,
              poll_window_start_local: "10:30:00",
              poll_window_end_local: "00:00:00",
              poll_timezone: "Europe/Istanbul",
              is_active: true,
            },
          ],
        };
      }

      if (sql.includes("FROM ops.employee") && sql.includes("company_id = ANY($2::uuid[])")) {
        expect(params).toEqual([employeeId, [actorCompanyId]]);
        return {
          rowCount: 1,
          rows: [{ internal_id: employeeId }],
        };
      }

      if (sql.includes("INSERT INTO stg.external_id_map")) {
        expect(params).toEqual([
          sourceId,
          "employee",
          "powerbi:AYSE DEMIR",
          employeeId,
          "ops.employee",
        ]);
        return { rowCount: 1, rows: [] };
      }

      if (sql.includes("INSERT INTO audit.event_log")) {
        expect(params?.[0]).toBe(actorUserId);
        const metadata = JSON.parse(String(params?.[1]));
        expect(metadata).toMatchObject({
          requestedActorUserId: actorUserId,
          integrationSourceId: sourceId,
          entityType: "employee",
          externalId: "powerbi:AYSE DEMIR",
          internalId: employeeId,
          internalTableName: "ops.employee",
        });
        return { rowCount: 1, rows: [] };
      }

      return { rowCount: 0, rows: [] };
    });

    const app = await createIntegrationApp({
      databaseService: { query },
    });

    const response = await request(app.getHttpServer())
      .post("/api/integrations/external-id-maps")
      .set("x-user-id", actorUserId)
      .set("x-role-codes", "INTEGRATION_ADMIN")
      .set("x-company-ids", actorCompanyId)
      .send({
        integrationSourceId: sourceId,
        entityType: "employee",
        externalId: "powerbi:AYSE DEMIR",
        internalId: employeeId,
        internalTableName: "ops.store",
      });

    expect(response.status).toBe(201);
    expect(response.body.command).toEqual({
      status: "updated",
      message: "External ID mapping approved",
    });
    expect(response.body.data.mapping).toEqual({
      integrationSourceId: sourceId,
      entityType: "employee",
      externalId: "powerbi:AYSE DEMIR",
      internalId: employeeId,
      internalTableName: "ops.employee",
    });
    expect(
      query.mock.calls.some(
        (call) =>
          typeof call[0] === "string" &&
          call[0].includes("external_id_mapping.approved") &&
          call[0].includes("stg.external_id_map"),
      ),
    ).toBe(true);

    await app.close();
  });

  it("rejects external ID mapping approval outside the actor company scope", async () => {
    const sourceId = "11111111-1111-4111-8111-111111111111";
    const employeeId = "22222222-2222-4222-8222-222222222222";
    const actorCompanyId = "00000000-0000-0000-0000-000000000001";
    const query = jest.fn(async (sql: string) => {
      if (sql.includes("FROM stg.integration_source") && sql.includes("WHERE integration_source_id")) {
        return {
          rowCount: 1,
          rows: [
            {
              integration_source_id: sourceId,
              source_code: "power-bi-kpi",
              source_name: "Power BI KPI",
              entity_type: "kpi",
              source_system: "power_bi",
              state_model: "closed_period",
              poll_enabled: false,
              poll_interval_minutes: 30,
              poll_window_start_local: "10:30:00",
              poll_window_end_local: "00:00:00",
              poll_timezone: "Europe/Istanbul",
              is_active: true,
            },
          ],
        };
      }

      if (sql.includes("FROM ops.employee") && sql.includes("company_id = ANY($2::uuid[])")) {
        return { rowCount: 0, rows: [] };
      }

      if (sql.includes("INSERT INTO stg.external_id_map")) {
        throw new Error("out-of-scope mapping should not be persisted");
      }

      return { rowCount: 0, rows: [] };
    });

    const app = await createIntegrationApp({
      databaseService: { query },
    });

    const response = await request(app.getHttpServer())
      .post("/api/integrations/external-id-maps")
      .set("x-user-id", "33333333-3333-4333-8333-333333333333")
      .set("x-role-codes", "INTEGRATION_ADMIN")
      .set("x-company-ids", actorCompanyId)
      .send({
        integrationSourceId: sourceId,
        entityType: "employee",
        externalId: "powerbi:AYSE DEMIR",
        internalId: employeeId,
      });

    expect(response.status).toBe(404);
    expect(
      query.mock.calls.some(
        ([sql]) => typeof sql === "string" && sql.includes("INSERT INTO stg.external_id_map"),
      ),
    ).toBe(false);

    await app.close();
  });

  it("lists controlled store and employee candidates for external ID mapping", async () => {
    const actorCompanyId = "00000000-0000-0000-0000-000000000001";
    const storeId = "44444444-4444-4444-8444-444444444444";
    const employeeId = "55555555-5555-4555-8555-555555555555";
    const query = jest.fn(async (sql: string, params?: unknown[]) => {
      if (sql.includes("FROM ops.store")) {
        expect(params).toEqual([[actorCompanyId], "%Marmara%", 5]);
        return {
          rowCount: 1,
          rows: [
            {
              internal_id: storeId,
              label: "Marmara Park",
              secondary_label: "MP001 / active",
            },
          ],
        };
      }

      if (sql.includes("FROM ops.employee")) {
        expect(params).toEqual([[actorCompanyId], "%Ayse%", 5]);
        return {
          rowCount: 1,
          rows: [
            {
              internal_id: employeeId,
              label: "Ayse Demir",
              secondary_label: "S-100 / active",
            },
          ],
        };
      }

      return { rowCount: 0, rows: [] };
    });

    const app = await createIntegrationApp({
      databaseService: { query },
    });

    const storeResponse = await request(app.getHttpServer())
      .get("/api/integrations/external-id-map-candidates?entityType=store&q=Marmara&limit=5")
      .set("x-user-id", "33333333-3333-4333-8333-333333333333")
      .set("x-role-codes", "INTEGRATION_ADMIN")
      .set("x-company-ids", actorCompanyId);

    expect(storeResponse.status).toBe(200);
    expect(storeResponse.body).toEqual({
      items: [
        {
          entityType: "store",
          internalId: storeId,
          label: "Marmara Park",
          secondaryLabel: "MP001 / active",
          internalTableName: "ops.store",
        },
      ],
      meta: {
        count: 1,
        total: 1,
        limit: 5,
        offset: 0,
      },
    });

    const employeeResponse = await request(app.getHttpServer())
      .get("/api/integrations/external-id-map-candidates?entityType=employee&q=Ayse&limit=5")
      .set("x-user-id", "33333333-3333-4333-8333-333333333333")
      .set("x-role-codes", "INTEGRATION_ADMIN")
      .set("x-company-ids", actorCompanyId);

    expect(employeeResponse.status).toBe(200);
    expect(employeeResponse.body).toEqual({
      items: [
        {
          entityType: "employee",
          internalId: employeeId,
          label: "Ayse Demir",
          secondaryLabel: "S-100 / active",
          internalTableName: "ops.employee",
        },
      ],
      meta: {
        count: 1,
        total: 1,
        limit: 5,
        offset: 0,
      },
    });

    await app.close();
  });

  it("lists and updates store master data for import controls", async () => {
    const actorUserId = "33333333-3333-4333-8333-333333333333";
    const actorCompanyId = "00000000-0000-0000-0000-000000000001";
    const storeId = "44444444-4444-4444-8444-444444444444";
    const regionId = "22222222-2222-4222-8222-222222222222";
    const nextRegionId = "66666666-6666-4666-8666-666666666666";
    const query = jest.fn(async (sql: string, params?: unknown[]) => {
      if (sql.includes("FROM ops.region r") && sql.includes("ORDER BY r.region_name ASC")) {
        expect(params).toEqual([[actorCompanyId]]);
        return {
          rowCount: 2,
          rows: [
            {
              region_id: regionId,
              region_code: "MARMARA",
              region_name: "Marmara",
            },
            {
              region_id: nextRegionId,
              region_code: "KARADENIZ",
              region_name: "Karadeniz",
            },
          ],
        };
      }

      if (sql.includes("COUNT(*)::text AS total_count") && sql.includes("FROM ops.store s")) {
        expect(params).toEqual([[actorCompanyId], "%Marmara%", true, "active"]);
        return {
          rowCount: 1,
          rows: [{ total_count: "1" }],
        };
      }

      if (sql.includes("FROM ops.store s") && sql.includes("LEFT JOIN ops.region r")) {
        expect(params).toEqual([[actorCompanyId], "%Marmara%", true, "active", 10, 0]);
        return {
          rowCount: 1,
          rows: [
            {
              store_id: storeId,
              store_code: "MP001",
              store_name: "Marmara Park",
              store_type: "company",
              status: "active",
              kpi_import_enabled: true,
              region_id: regionId,
              region_name: "Marmara",
            },
          ],
        };
      }

      if (sql.includes("SELECT user_id") && sql.includes("FROM ops.user_account")) {
        return {
          rowCount: 1,
          rows: [{ user_id: actorUserId }],
        };
      }

      if (sql.includes("UPDATE ops.store")) {
        expect(sql).toContain("s.company_id = ANY($6::uuid[])");
        expect(sql).toContain("r.company_id = s.company_id");
        expect(params).toEqual([storeId, "franchise", nextRegionId, "inactive", false, [actorCompanyId]]);
        return {
          rowCount: 1,
          rows: [
            {
              store_id: storeId,
              store_code: "MP001",
              store_name: "Marmara Park",
              store_type: "franchise",
              status: "inactive",
              kpi_import_enabled: false,
              region_id: nextRegionId,
              region_name: "Karadeniz",
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

    const lookupsResponse = await request(app.getHttpServer())
      .get("/api/integrations/store-master-lookups")
      .set("x-user-id", actorUserId)
      .set("x-role-codes", "INTEGRATION_ADMIN")
      .set("x-company-ids", actorCompanyId);

    expect(lookupsResponse.status).toBe(200);
    expect(lookupsResponse.body).toEqual({
      storeTypes: [
        { value: "company", label: "Company" },
        { value: "franchise", label: "Franchise" },
        { value: "operator", label: "Operator" },
      ],
      statuses: [
        { value: "active", label: "Active" },
        { value: "inactive", label: "Inactive" },
        { value: "closed", label: "Closed" },
      ],
      regions: [
        {
          regionId,
          regionCode: "MARMARA",
          regionName: "Marmara",
        },
        {
          regionId: nextRegionId,
          regionCode: "KARADENIZ",
          regionName: "Karadeniz",
        },
      ],
    });

    const listResponse = await request(app.getHttpServer())
      .get("/api/integrations/store-master?q=Marmara&enabled=true&status=active&limit=10&offset=0")
      .set("x-user-id", actorUserId)
      .set("x-role-codes", "INTEGRATION_ADMIN")
      .set("x-company-ids", actorCompanyId);

    expect(listResponse.status).toBe(200);
    expect(listResponse.body).toEqual({
      items: [
        {
          storeId,
          storeCode: "MP001",
          storeName: "Marmara Park",
          storeType: "company",
          status: "active",
          kpiImportEnabled: true,
          regionId,
          regionName: "Marmara",
        },
      ],
      meta: {
        count: 1,
        total: 1,
        limit: 10,
        offset: 0,
      },
    });

    const updateResponse = await request(app.getHttpServer())
      .patch(`/api/integrations/store-master/${storeId}`)
      .set("x-user-id", actorUserId)
      .set("x-role-codes", "INTEGRATION_ADMIN")
      .set("x-company-ids", actorCompanyId)
      .send({
        storeType: "franchise",
        regionId: nextRegionId,
        status: "inactive",
        kpiImportEnabled: false,
      });

    expect(updateResponse.status).toBe(200);
    expect(updateResponse.body).toEqual({
      command: {
        status: "updated",
        message: "Store master data updated",
      },
      data: {
        storeMaster: {
          storeId,
          storeCode: "MP001",
          storeName: "Marmara Park",
          storeType: "franchise",
          status: "inactive",
          kpiImportEnabled: false,
          regionId: nextRegionId,
          regionName: "Karadeniz",
        },
      },
    });
    expect(
      query.mock.calls.some(
        (call) =>
          typeof call[0] === "string" &&
          call[0].includes("store_master_data.updated") &&
          call[0].includes("ops.store"),
      ),
    ).toBe(true);

    await app.close();
  });

  it("does not update store master data outside the actor company scope", async () => {
    const actorUserId = "33333333-3333-4333-8333-333333333333";
    const actorCompanyId = "00000000-0000-0000-0000-000000000001";
    const storeId = "99999999-9999-4999-8999-999999999999";
    const regionId = "88888888-8888-4888-8888-888888888888";
    const query = jest.fn(async (sql: string, params?: unknown[]) => {
      if (sql.includes("SELECT user_id") && sql.includes("FROM ops.user_account")) {
        return {
          rowCount: 1,
          rows: [{ user_id: actorUserId }],
        };
      }

      if (sql.includes("UPDATE ops.store")) {
        expect(sql).toContain("s.company_id = ANY($6::uuid[])");
        expect(sql).toContain("r.company_id = s.company_id");
        expect(params).toEqual([storeId, "operator", regionId, "active", true, [actorCompanyId]]);
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
      .patch(`/api/integrations/store-master/${storeId}`)
      .set("x-user-id", actorUserId)
      .set("x-role-codes", "INTEGRATION_ADMIN")
      .set("x-company-ids", actorCompanyId)
      .send({
        storeType: "operator",
        regionId,
        status: "active",
        kpiImportEnabled: true,
      });

    expect(response.status).toBe(404);
    expect(
      query.mock.calls.some(
        (call) =>
          typeof call[0] === "string" &&
          call[0].includes("store_master_data.updated"),
      ),
    ).toBe(false);

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
});
