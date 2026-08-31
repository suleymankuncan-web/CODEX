import * as request from "supertest";
import { createIntegrationApp } from "./test-app";

describe("Import batch pagination evidence", () => {
  it("returns import batch error rows with pagination metadata", async () => {
    const revision = "e".repeat(64);
    const query = jest.fn(async (sql: string) => {
      if (sql.includes("FROM stg.import_batch")) {
        return {
          rowCount: 1,
          rows: [{ entity_type: "assignment" }],
        };
      }

      if (sql.includes("COUNT(*)::text AS total_count") && sql.includes("filtered_errors")) {
        expect(query.mock.calls.filter(([calledSql]) =>
          typeof calledSql === "string" && calledSql.includes("filtered_errors"),
        )).toHaveLength(1);
        expect(sql).toContain("import-batch-errors:v1");
        expect(sql).toContain("revision_rows AS MATERIALIZED");
        expect(sql).toContain("jsonb_build_array");
        expect(sql).toContain("jsonb_agg");
        expect(sql).toContain("digest");
        expect(sql).toContain("convert_to");
        expect(sql).toContain("to_char(revision_row.processed_at AT TIME ZONE 'UTC'");
        expect(sql).toContain("ORDER BY revision_row.processed_at DESC NULLS LAST, revision_row.row_id ASC");
        for (const field of [
          "revision_row.row_id",
          "revision_row.source_ref",
          "revision_row.store_external_ref",
          "revision_row.employee_external_ref",
          "revision_row.payload_json",
          "revision_row.row_hash",
          "revision_row.raw_row_reference",
          "revision_row.normalized_status",
          "revision_row.validation_error",
          "revision_row.processed_at",
        ]) {
          expect(sql).toContain(field);
        }
        return {
          rowCount: 2,
          rows: [
            {
              row_kind: "item",
              total_count: "2",
              revision,
              row_id: "row-1",
              source_ref: "ASN-1",
              store_external_ref: null,
              employee_external_ref: null,
              payload_json: null,
              row_hash: null,
              raw_row_reference: null,
              normalized_status: "validation_failed",
              validation_error: "position reference is required",
              processed_at: "2026-04-17T10:01:00.000Z",
            },
            {
              row_kind: "item",
              total_count: "2",
              revision,
              row_id: "row-2",
              source_ref: "ASN-2",
              store_external_ref: null,
              employee_external_ref: null,
              payload_json: null,
              row_hash: null,
              raw_row_reference: null,
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
      "/api/integrations/import-batches/33333333-3333-4333-8333-333333333333/errors?limit=20&offset=0",
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
      revision,
    });

    await app.close();
  });


  it("returns KPI import batch error row lineage for reconciliation", async () => {
    const revision = "f".repeat(64);
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

      if (sql.includes("COUNT(*)::text AS total_count") && sql.includes("filtered_errors")) {
        return {
          rowCount: 1,
          rows: [
            {
              row_kind: "item",
              total_count: "1",
              revision,
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
      "/api/integrations/import-batches/44444444-4444-4444-8444-444444444444/errors?limit=20&offset=0",
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
    expect(response.body.meta).toEqual({
      count: 1,
      total: 1,
      limit: 20,
      offset: 0,
      revision,
    });
    await app.close();
  });


  it("keeps import error totals and revision on an out-of-range page", async () => {
    const revision = "1".repeat(64);
    const query = jest.fn(async (sql: string) => {
      if (sql.includes("FROM stg.import_batch")) {
        return {
          rowCount: 1,
          rows: [{ entity_type: "assignment" }],
        };
      }

      if (sql.includes("filtered_errors")) {
        expect(query.mock.calls.filter(([calledSql]) =>
          typeof calledSql === "string" && calledSql.includes("filtered_errors"),
        )).toHaveLength(1);
        return {
          rowCount: 1,
          rows: [
            {
              row_kind: "meta",
              total_count: "2",
              revision,
              row_id: null,
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
      "/api/integrations/import-batches/33333333-3333-4333-8333-333333333333/errors?limit=1&offset=5",
    );

    expect(response.status).toBe(200);
    expect(response.body.items).toEqual([]);
    expect(response.body.meta).toEqual({
      count: 0,
      total: 2,
      limit: 1,
      offset: 5,
      revision,
    });

    await app.close();
  });


  it("skips the import error digest over the bounded snapshot cap", async () => {
    const query = jest.fn(async (sql: string) => {
      if (sql.includes("FROM stg.import_batch")) {
        return {
          rowCount: 1,
          rows: [{ entity_type: "assignment" }],
        };
      }

      if (sql.includes("filtered_errors")) {
        expect(sql).toContain("CASE");
        expect(sql).toContain("total_count::bigint <= 10000");
        expect(sql).toContain("revision_rows AS MATERIALIZED");
        return {
          rowCount: 1,
          rows: [
            {
              row_kind: "meta",
              total_count: "10001",
              revision: null,
              row_id: null,
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
      "/api/integrations/import-batches/33333333-3333-4333-8333-333333333333/errors?limit=1&offset=10000",
    );

    expect(response.status).toBe(200);
    expect(response.body.items).toEqual([]);
    expect(response.body.meta).toEqual({
      count: 0,
      total: 10001,
      limit: 1,
      offset: 10000,
      revision: null,
    });

    await app.close();
  });


  it("keeps import-batch audit totals when pagination is beyond the last event", async () => {
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
          rowCount: 1,
          rows: [
            {
              row_kind: "meta",
              total_count: "3",
              event_log_id: null,
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
      "/api/integrations/import-batches/33333333-3333-4333-8333-333333333333/audit?limit=1&offset=3",
    );

    expect(response.status).toBe(200);
    expect(response.body.items).toEqual([]);
    expect(response.body.meta).toEqual({
      count: 0,
      total: 3,
      limit: 1,
      offset: 3,
    });
    expect(
      query.mock.calls.filter(
        ([sql]) => typeof sql === "string" && sql.includes("FROM audit.event_log"),
      ),
    ).toHaveLength(1);

    await app.close();
  });

});
