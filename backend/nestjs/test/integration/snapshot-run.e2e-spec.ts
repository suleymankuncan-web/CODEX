import * as request from "supertest";
import { createIntegrationApp } from "./test-app";

const hasSnapshotRunIdPredicate = (sql: string) =>
  sql.includes("WHERE snapshot_run_id = $1::uuid") ||
  sql.includes("WHERE rpt.snapshot_run.snapshot_run_id = $1::uuid");

describe("Snapshot run operations", () => {
  it("creates a snapshot run and dispatches snapshot generation", async () => {
    const query = jest.fn(async (sql: string) => {
      if (sql.includes("SELECT snapshot_run_id")) {
        return { rowCount: 0, rows: [] };
      }

      if (sql.includes("INSERT INTO rpt.snapshot_run")) {
        return {
          rowCount: 1,
          rows: [
            {
              snapshot_run_id: "snapshot-1",
              snapshot_date: "2026-04-17",
              generated_at: "2026-04-17T00:00:00.000Z",
              run_status: "queued",
              started_at: null,
              finished_at: null,
              failure_reason: null,
              rerun_of_snapshot_run_id: null,
            },
          ],
        };
      }

      if (sql.includes("generate_")) {
        throw new Error("snapshot generation should not run inline");
      }

      return { rowCount: 1, rows: [] };
    });
    const dispatch = jest.fn(async () => ({
      status: "queued" as const,
      jobType: "snapshot-run" as const,
      backend: "test",
      jobId: "job-snapshot-1",
      queueName: "store-ops-snapshot",
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
      .post("/api/snapshots/runs")
      .set("x-user-id", "user-1")
      .send({
        snapshotType: "monthly",
        periodStart: "2026-04-01",
        periodEnd: "2026-04-30",
      });

    expect(response.status).toBe(201);
    expect(response.body.command).toEqual({
      status: "queued",
      message: "Immutable snapshot generation has been queued",
    });
    expect(response.body.data.snapshotRun.snapshot_run_id).toBe("snapshot-1");
    expect(response.body.job).toEqual({
      jobType: "snapshot-run",
      backend: "test",
      jobId: "job-snapshot-1",
      queueName: "store-ops-snapshot",
    });
    expect(dispatch).toHaveBeenCalledWith(
      "snapshot-run",
      {
        snapshotRunId: "snapshot-1",
        periodStart: "2026-04-01",
        periodEnd: "2026-04-30",
      },
      expect.any(Function),
    );

    await app.close();
  });

  it("reruns a failed snapshot by creating a new snapshot run", async () => {
    const query = jest.fn(async (sql: string) => {
      if (sql.includes("FROM rpt.snapshot_run") && hasSnapshotRunIdPredicate(sql)) {
        return {
          rowCount: 1,
          rows: [
            {
              snapshot_run_id: "snapshot-2",
              snapshot_date: "2026-04-17",
              snapshot_type: "monthly",
              period_start: "2026-04-01",
              period_end: "2026-04-30",
              run_status: "failed",
              generated_at: "2026-04-17T01:00:00.000Z",
              generated_by: "user-1",
              started_at: "2026-04-17T01:00:01.000Z",
              finished_at: "2026-04-17T01:00:10.000Z",
              failure_reason: "db timeout",
              rerun_of_snapshot_run_id: null,
            },
          ],
        };
      }

      if (sql.includes("INSERT INTO rpt.snapshot_run")) {
        return {
          rowCount: 1,
          rows: [
            {
              snapshot_run_id: "snapshot-3",
              snapshot_date: "2026-04-17",
              generated_at: "2026-04-17T02:00:00.000Z",
              run_status: "queued",
              started_at: null,
              finished_at: null,
              failure_reason: null,
              rerun_of_snapshot_run_id: "snapshot-2",
            },
          ],
        };
      }

      if (sql.includes("INSERT INTO audit.event_log")) {
        return { rowCount: 1, rows: [] };
      }

      if (sql.includes("COUNT(*)::text AS rerun_count")) {
        return { rowCount: 1, rows: [{ rerun_count: "0" }] };
      }

      if (sql.includes("rerun_of_snapshot_run_id = $1::uuid")) {
        return { rowCount: 0, rows: [] };
      }

      if (sql.includes("store_workforce_snapshot") || sql.includes("store_kpi_snapshot") || sql.includes("store_checklist_snapshot") || sql.includes("turnover_snapshot")) {
        return { rowCount: 1, rows: [{ row_count: "0" }] };
      }

      return { rowCount: 0, rows: [] };
    });
    const dispatch = jest.fn(async () => ({
      status: "queued" as const,
      jobType: "snapshot-run" as const,
      backend: "test",
      jobId: "job-snapshot-rerun-1",
      queueName: "store-ops-snapshot",
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
      .post("/api/snapshots/runs/snapshot-2/rerun")
      .set("x-user-id", "user-2");

    expect(response.status).toBe(201);
    expect(response.body.command).toEqual({
      status: "queued",
      message: "Snapshot run rerun has been queued",
    });
    expect(response.body.data.snapshotRun.snapshot_run_id).toBe("snapshot-3");
    expect(response.body.data.snapshotRun.rerun_of_snapshot_run_id).toBe("snapshot-2");
    expect(response.body.job).toEqual({
      jobType: "snapshot-run",
      backend: "test",
      jobId: "job-snapshot-rerun-1",
      queueName: "store-ops-snapshot",
    });
    expect(dispatch).toHaveBeenCalledWith(
      "snapshot-run",
      {
        snapshotRunId: "snapshot-3",
        periodStart: "2026-04-01",
        periodEnd: "2026-04-30",
      },
      expect.any(Function),
    );

    await app.close();
  });

  it("returns rerun governance in snapshot detail and blocks duplicate active reruns", async () => {
    const query = jest.fn(async (sql: string) => {
      if (sql.includes("FROM rpt.snapshot_run") && hasSnapshotRunIdPredicate(sql)) {
        return {
          rowCount: 1,
          rows: [
            {
              snapshot_run_id: "snapshot-guarded-1",
              snapshot_date: "2026-04-17",
              snapshot_type: "monthly",
              period_start: "2026-04-01",
              period_end: "2026-04-30",
              run_status: "failed",
              generated_at: "2026-04-17T01:00:00.000Z",
              generated_by: "user-1",
              started_at: "2026-04-17T01:00:01.000Z",
              finished_at: "2026-04-17T01:00:10.000Z",
              failure_reason: "db timeout",
              rerun_of_snapshot_run_id: null,
            },
          ],
        };
      }

      if (sql.includes("COUNT(*)::text AS active_rerun_count")) {
        return { rowCount: 1, rows: [{ active_rerun_count: "1" }] };
      }

      if (hasSnapshotRunIdPredicate(sql) && sql.includes("store_workforce_snapshot")) {
        return { rowCount: 1, rows: [{ row_count: "0" }] };
      }

      if (hasSnapshotRunIdPredicate(sql) && sql.includes("store_kpi_snapshot")) {
        return { rowCount: 1, rows: [{ row_count: "0" }] };
      }

      if (hasSnapshotRunIdPredicate(sql) && sql.includes("store_checklist_snapshot")) {
        return { rowCount: 1, rows: [{ row_count: "0" }] };
      }

      if (hasSnapshotRunIdPredicate(sql) && sql.includes("turnover_snapshot")) {
        return { rowCount: 1, rows: [{ row_count: "0" }] };
      }

      if (sql.includes("COUNT(*)::text AS rerun_count")) {
        return { rowCount: 1, rows: [{ rerun_count: "1" }] };
      }

      if (sql.includes("rerun_of_snapshot_run_id = $1::uuid")) {
        return { rowCount: 1, rows: [{ snapshot_run_id: "snapshot-rerun-active-1" }] };
      }

      return { rowCount: 0, rows: [] };
    });

    const app = await createIntegrationApp({ databaseService: { query } });

    const detailResponse = await request(app.getHttpServer())
      .get("/api/snapshots/runs/snapshot-guarded-1")
      .set("x-user-id", "user-1")
      .set("x-role-codes", "SNAPSHOT_OPERATOR");

    expect(detailResponse.status).toBe(200);
    expect(detailResponse.body.rerunAllowed).toBe(false);
    expect(detailResponse.body.rerunBlockedReason).toBe(
      "An active rerun already exists for this snapshot run",
    );

    await app.close();
  });

  it("rejects rerun when an active rerun already exists", async () => {
    const query = jest.fn(async (sql: string) => {
      if (sql.includes("FROM rpt.snapshot_run") && hasSnapshotRunIdPredicate(sql)) {
        return {
          rowCount: 1,
          rows: [
            {
              snapshot_run_id: "snapshot-guarded-1",
              snapshot_date: "2026-04-17",
              snapshot_type: "monthly",
              period_start: "2026-04-01",
              period_end: "2026-04-30",
              run_status: "failed",
              generated_at: "2026-04-17T01:00:00.000Z",
              generated_by: "user-1",
              started_at: "2026-04-17T01:00:01.000Z",
              finished_at: "2026-04-17T01:00:10.000Z",
              failure_reason: "db timeout",
              rerun_of_snapshot_run_id: null,
            },
          ],
        };
      }

      if (sql.includes("COUNT(*)::text AS active_rerun_count")) {
        return { rowCount: 1, rows: [{ active_rerun_count: "1" }] };
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
      .post("/api/snapshots/runs/snapshot-guarded-1/rerun")
      .set("x-user-id", "user-2")
      .set("x-role-codes", "SNAPSHOT_OPERATOR");

    expect(response.status).toBe(409);
    expect(response.body.message).toBe("An active rerun already exists for snapshot run snapshot-guarded-1");

    await app.close();
  });
});
