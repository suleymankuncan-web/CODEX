import * as request from "supertest";
import { createIntegrationApp } from "./test-app";

describe("GET /api/integrations/import-batches/needs-action", () => {
  it("keeps needs-action totals when pagination is beyond the last matching row", async () => {
    const revision = "b".repeat(64);
    const query = jest.fn(async (sql: string) => {
      if (sql.includes("COUNT(*)::text AS total_count") && sql.includes("action_queue")) {
        return {
          rowCount: 1,
          rows: [
            {
              row_kind: "meta",
              total_count: "3",
              revision,
              import_batch_id: null,
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
      "/api/integrations/import-batches/needs-action?limit=2&offset=5",
    );

    expect(response.status).toBe(200);
    expect(response.body.items).toEqual([]);
    expect(response.body.meta).toEqual({
      count: 0,
      total: 3,
      limit: 2,
      offset: 5,
      revision,
    });
    expect(
      query.mock.calls.filter(
        ([sql]) =>
          typeof sql === "string" &&
          sql.includes("COUNT(*)::text AS total_count") &&
          sql.includes("action_queue"),
      ),
    ).toHaveLength(1);

    await app.close();
  });

  it("returns a revision for an empty needs-action snapshot", async () => {
    const revision = "d".repeat(64);
    const query = jest.fn(async (sql: string) => {
      if (sql.includes("COUNT(*)::text AS total_count") && sql.includes("action_queue")) {
        return {
          rowCount: 1,
          rows: [
            {
              row_kind: "meta",
              total_count: "0",
              revision,
              import_batch_id: null,
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
      "/api/integrations/import-batches/needs-action",
    );

    expect(response.status).toBe(200);
    expect(response.body.items).toEqual([]);
    expect(response.body.meta).toEqual({
      count: 0,
      total: 0,
      limit: 50,
      offset: 0,
      revision,
    });

    await app.close();
  });

  it("skips the needs-action digest over the bounded snapshot cap", async () => {
    const query = jest.fn(async (sql: string) => {
      if (sql.includes("COUNT(*)::text AS total_count") && sql.includes("action_queue")) {
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
              import_batch_id: null,
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
      "/api/integrations/import-batches/needs-action?limit=2&offset=10000",
    );

    expect(response.status).toBe(200);
    expect(response.body.items).toEqual([]);
    expect(response.body.meta).toEqual({
      count: 0,
      total: 10001,
      limit: 2,
      offset: 10000,
      revision: null,
    });

    await app.close();
  });

  it("passes a trimmed needs-action query to the single repository round trip", async () => {
    const revision = "c".repeat(64);
    const query = jest.fn(async (sql: string, params?: unknown[]) => {
      if (sql.includes("COUNT(*)::text AS total_count") && sql.includes("action_queue")) {
        expect(sql).toContain("ILIKE");
        expect(sql.match(/ESCAPE/g)).toHaveLength(6);
        expect(params).toContain("%\\%\\_\\\\O'Reilly%");
        return {
          rowCount: 1,
          rows: [
            {
              row_kind: "item",
              total_count: "1",
              revision,
              import_batch_id: "batch-erp",
              integration_source_id: "source-erp",
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
              employee_dependency_count: "0",
              store_dependency_count: "0",
              position_dependency_count: "0",
              region_dependency_count: "0",
              company_dependency_count: "0",
              manager_dependency_count: "0",
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
      .get("/api/integrations/import-batches/needs-action")
      .query({ q: " %_\\O'Reilly " });

    expect(response.status).toBe(200);
    expect(response.body.meta).toMatchObject({ total: 1 });
    expect(response.body.meta.revision).toBe(revision);
    expect(response.body.items[0]).toMatchObject({
      sourceCode: "ERP",
      healthState: "stuck",
    });

    await app.close();
  });

  it("rejects an overlong needs-action query before hitting the repository", async () => {
    const query = jest.fn(async (_sql: string) => ({ rowCount: 0, rows: [] }));
    const app = await createIntegrationApp({
      databaseService: { query },
    });

    const response = await request(app.getHttpServer())
      .get("/api/integrations/import-batches/needs-action")
      .query({ q: "x".repeat(129) });

    expect(response.status).toBe(400);
    expect(
      query.mock.calls.some(
        ([sql]) => typeof sql === "string" && sql.includes("action_queue"),
      ),
    ).toBe(false);

    await app.close();
  });
});
