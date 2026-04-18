import * as request from "supertest";
import { createIntegrationApp } from "./test-app";

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

  it("lists snapshot runs with health state and pagination metadata", async () => {
    const query = jest.fn(async (sql: string) => {
      if (sql.includes("COUNT(*)::text AS total_count") && sql.includes("FROM rpt.snapshot_run")) {
        return {
          rowCount: 1,
          rows: [{ total_count: "2" }],
        };
      }

      if (sql.includes("FROM rpt.snapshot_run")) {
        return {
          rowCount: 2,
          rows: [
            {
              snapshot_run_id: "snapshot-1",
              snapshot_date: "2026-04-17",
              snapshot_type: "monthly",
              period_start: "2026-04-01",
              period_end: "2026-04-30",
              run_status: "completed",
              generated_at: "2026-04-17T00:00:00.000Z",
              generated_by: "user-1",
              started_at: "2026-04-17T00:00:01.000Z",
              finished_at: "2026-04-17T00:00:10.000Z",
              failure_reason: null,
              rerun_of_snapshot_run_id: null,
            },
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

      return { rowCount: 0, rows: [] };
    });

    const app = await createIntegrationApp({
      databaseService: { query },
    });

    const response = await request(app.getHttpServer()).get(
      "/api/snapshots/runs?limit=20&offset=0&runStatus=failed&snapshotType=monthly",
    );

    expect(response.status).toBe(200);
    expect(response.body.items).toEqual([
      expect.objectContaining({
        snapshotRunId: "snapshot-1",
        runStatus: "completed",
        healthState: "healthy",
      }),
      expect.objectContaining({
        snapshotRunId: "snapshot-2",
        runStatus: "failed",
        healthState: "retry_ready",
      }),
    ]);
    expect(response.body.meta).toEqual({
      count: 2,
      total: 2,
      limit: 20,
      offset: 0,
    });

    await app.close();
  });

  it("returns snapshot run detail with cards and rerun state", async () => {
    const query = jest.fn(async (sql: string) => {
      if (sql.includes("FROM rpt.snapshot_run") && sql.includes("WHERE snapshot_run_id = $1::uuid")) {
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

      if (sql.includes("WHERE snapshot_run_id = $1::uuid") && sql.includes("store_workforce_snapshot")) {
        return { rowCount: 1, rows: [{ row_count: "4" }] };
      }

      if (sql.includes("WHERE snapshot_run_id = $1::uuid") && sql.includes("store_kpi_snapshot")) {
        return { rowCount: 1, rows: [{ row_count: "5" }] };
      }

      if (sql.includes("WHERE snapshot_run_id = $1::uuid") && sql.includes("store_checklist_snapshot")) {
        return { rowCount: 1, rows: [{ row_count: "3" }] };
      }

      if (sql.includes("WHERE snapshot_run_id = $1::uuid") && sql.includes("turnover_snapshot")) {
        return { rowCount: 1, rows: [{ row_count: "2" }] };
      }

      if (sql.includes("COUNT(*)::text AS rerun_count")) {
        return { rowCount: 1, rows: [{ rerun_count: "1" }] };
      }

      if (sql.includes("FROM rpt.snapshot_run") && sql.includes("rerun_of_snapshot_run_id = $1::uuid")) {
        return {
          rowCount: 1,
          rows: [{ snapshot_run_id: "snapshot-3" }],
        };
      }

      return { rowCount: 0, rows: [] };
    });

    const app = await createIntegrationApp({
      databaseService: { query },
    });

    const response = await request(app.getHttpServer()).get("/api/snapshots/runs/snapshot-2");

    expect(response.status).toBe(200);
    expect(response.body.snapshotRun.snapshotRunId).toBe("snapshot-2");
    expect(response.body.snapshotRun.healthState).toBe("retry_ready");
    expect(response.body.cards).toEqual({
      workforceRows: 4,
      kpiRows: 5,
      checklistRows: 3,
      turnoverRows: 2,
    });
    expect(response.body.canRerun).toBe(true);
    expect(response.body.rerunCount).toBe(1);
    expect(response.body.latestRerunSnapshotRunId).toBe("snapshot-3");
    expect(response.body.failureReason).toBe("db timeout");

    await app.close();
  });

  it("returns snapshot run audit events", async () => {
    const query = jest.fn(async (sql: string) => {
      if (sql.includes("FROM rpt.snapshot_run") && sql.includes("WHERE snapshot_run_id = $1::uuid")) {
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

      if (sql.includes("FROM audit.event_log")) {
        return {
          rowCount: 3,
          rows: [
            {
              event_log_id: "evt-1",
              occurred_at: "2026-04-17T01:00:00.000Z",
              actor_user_id: "user-1",
              event_type: "snapshot_run.created",
              metadata_json: { snapshotType: "monthly" },
            },
            {
              event_log_id: "evt-2",
              occurred_at: "2026-04-17T01:00:01.000Z",
              actor_user_id: null,
              event_type: "snapshot_run.started",
              metadata_json: {},
            },
            {
              event_log_id: "evt-3",
              occurred_at: "2026-04-17T01:00:10.000Z",
              actor_user_id: null,
              event_type: "snapshot_run.failed",
              metadata_json: { failureReason: "db timeout" },
            },
          ],
        };
      }

      return { rowCount: 0, rows: [] };
    });

    const app = await createIntegrationApp({
      databaseService: { query },
    });

    const response = await request(app.getHttpServer()).get("/api/snapshots/runs/snapshot-2/audit");

    expect(response.status).toBe(200);
    expect(response.body.meta).toEqual({
      count: 3,
      total: 3,
      limit: 50,
      offset: 0,
    });
    expect(response.body.items).toEqual([
      {
        eventLogId: "evt-1",
        occurredAt: "2026-04-17T01:00:00.000Z",
        actorUserId: "user-1",
        eventType: "snapshot_run.created",
        metadata: { snapshotType: "monthly" },
      },
      {
        eventLogId: "evt-2",
        occurredAt: "2026-04-17T01:00:01.000Z",
        actorUserId: null,
        eventType: "snapshot_run.started",
        metadata: {},
      },
      {
        eventLogId: "evt-3",
        occurredAt: "2026-04-17T01:00:10.000Z",
        actorUserId: null,
        eventType: "snapshot_run.failed",
        metadata: { failureReason: "db timeout" },
      },
    ]);

    await app.close();
  });

  it("returns snapshot run summary with latest critical pointers", async () => {
    const query = jest.fn(async (sql: string, params?: unknown[]) => {
      if (sql.includes("GROUP BY run_status")) {
        return {
          rowCount: 3,
          rows: [
            { run_status: "completed", run_count: "4" },
            { run_status: "failed", run_count: "2" },
            { run_status: "running", run_count: "1" },
          ],
        };
      }

      if (sql.includes("COUNT(*)::text AS total_count")) {
        return {
          rowCount: 1,
          rows: [{ total_count: "7" }],
        };
      }

      if (
        sql.includes("ORDER BY generated_at DESC") &&
        Array.isArray(params) &&
        params[1] === "completed"
      ) {
        return { rowCount: 1, rows: [{ snapshot_run_id: "snapshot-latest-completed" }] };
      }

      if (
        sql.includes("ORDER BY generated_at DESC") &&
        Array.isArray(params) &&
        params[1] === "failed"
      ) {
        return { rowCount: 1, rows: [{ snapshot_run_id: "snapshot-latest-failed" }] };
      }

      if (
        sql.includes("ORDER BY generated_at DESC") &&
        Array.isArray(params) &&
        params[1] === "running"
      ) {
        return { rowCount: 1, rows: [{ snapshot_run_id: "snapshot-latest-running" }] };
      }

      return { rowCount: 0, rows: [] };
    });

    const app = await createIntegrationApp({
      databaseService: { query },
    });

    const response = await request(app.getHttpServer()).get(
      "/api/snapshots/runs/summary?snapshotType=monthly",
    );

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      totals: {
        all: 7,
        queued: 0,
        running: 1,
        completed: 4,
        failed: 2,
      },
      healthTotals: {
        healthy: 4,
        inProgress: 1,
        retryReady: 2,
        needsAction: 0,
      },
      latest: {
        completedSnapshotRunId: "snapshot-latest-completed",
        failedSnapshotRunId: "snapshot-latest-failed",
        inProgressSnapshotRunId: "snapshot-latest-running",
      },
    });

    await app.close();
  });

  it("returns snapshot run overview with action totals and stuck pointers", async () => {
    const query = jest.fn(async (sql: string, params?: unknown[]) => {
      if (sql.includes("GROUP BY run_status")) {
        return {
          rowCount: 3,
          rows: [
            { run_status: "completed", run_count: "4" },
            { run_status: "failed", run_count: "2" },
            { run_status: "running", run_count: "1" },
          ],
        };
      }

      if (
        sql.includes("COUNT(*)::text AS total_count") &&
        sql.includes("FROM rpt.snapshot_run") &&
        !sql.includes("action_totals")
      ) {
        return {
          rowCount: 1,
          rows: [{ total_count: "7" }],
        };
      }

      if (sql.includes("action_totals")) {
        return {
          rowCount: 1,
          rows: [
            {
              retry_ready_count: "2",
              stuck_count: "1",
            },
          ],
        };
      }

      if (
        sql.includes("ORDER BY generated_at DESC") &&
        Array.isArray(params) &&
        params[1] === "completed"
      ) {
        return { rowCount: 1, rows: [{ snapshot_run_id: "snapshot-latest-completed" }] };
      }

      if (
        sql.includes("ORDER BY generated_at DESC") &&
        Array.isArray(params) &&
        params[1] === "failed"
      ) {
        return { rowCount: 1, rows: [{ snapshot_run_id: "snapshot-latest-failed" }] };
      }

      if (
        sql.includes("ORDER BY generated_at DESC") &&
        Array.isArray(params) &&
        params[1] === "running"
      ) {
        return { rowCount: 1, rows: [{ snapshot_run_id: "snapshot-latest-running" }] };
      }

      if (sql.includes("latest_stuck_snapshot_run")) {
        return { rowCount: 1, rows: [{ snapshot_run_id: "snapshot-stuck-1" }] };
      }

      return { rowCount: 0, rows: [] };
    });

    const app = await createIntegrationApp({
      databaseService: { query },
    });

    const response = await request(app.getHttpServer()).get(
      "/api/snapshots/runs/overview?snapshotType=monthly",
    );

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      totals: {
        all: 7,
        queued: 0,
        running: 1,
        completed: 4,
        failed: 2,
      },
      healthTotals: {
        healthy: 4,
        inProgress: 0,
        retryReady: 2,
        needsAction: 0,
        stuck: 1,
      },
      actionTotals: {
        retryReady: 2,
        stuck: 1,
      },
      latest: {
        completedSnapshotRunId: "snapshot-latest-completed",
        failedSnapshotRunId: "snapshot-latest-failed",
        inProgressSnapshotRunId: "snapshot-latest-running",
        stuckSnapshotRunId: "snapshot-stuck-1",
      },
    });

    await app.close();
  });

  it("returns snapshot needs-action queue with retry-ready and stuck runs", async () => {
    const query = jest.fn(async (sql: string) => {
      if (sql.includes("COUNT(*)::text AS total_count") && sql.includes("action_queue")) {
        return {
          rowCount: 1,
          rows: [{ total_count: "2" }],
        };
      }

      if (sql.includes("FROM action_queue") && sql.includes("ORDER BY generated_at DESC")) {
        return {
          rowCount: 2,
          rows: [
            {
              snapshot_run_id: "snapshot-failed-1",
              snapshot_date: "2026-04-17",
              snapshot_type: "monthly",
              period_start: "2026-04-01",
              period_end: "2026-04-30",
              run_status: "failed",
              generated_at: "2026-04-17T10:00:00.000Z",
              generated_by: "user-1",
              started_at: "2026-04-17T10:00:10.000Z",
              finished_at: "2026-04-17T10:01:10.000Z",
              failure_reason: "db timeout",
              rerun_of_snapshot_run_id: null,
              health_state: "retry_ready",
              action_reason: "Snapshot run failed and can be rerun",
              recommended_action: "Trigger a rerun after verifying the failure cause",
              is_stuck: false,
            },
            {
              snapshot_run_id: "snapshot-stuck-1",
              snapshot_date: "2026-04-17",
              snapshot_type: "monthly",
              period_start: "2026-04-01",
              period_end: "2026-04-30",
              run_status: "running",
              generated_at: "2026-04-17T00:00:00.000Z",
              generated_by: "user-1",
              started_at: "2026-04-17T00:00:10.000Z",
              finished_at: null,
              failure_reason: null,
              rerun_of_snapshot_run_id: null,
              health_state: "stuck",
              action_reason: "Snapshot run has exceeded the in-progress time threshold",
              recommended_action: "Inspect worker execution before requesting another rerun",
              is_stuck: true,
            },
          ],
        };
      }

      if (sql.includes("COUNT(*)::text AS rerun_count")) {
        return { rowCount: 1, rows: [{ rerun_count: "1" }] };
      }

      if (sql.includes("rerun_of_snapshot_run_id = $1::uuid")) {
        return { rowCount: 1, rows: [{ snapshot_run_id: "snapshot-rerun-1" }] };
      }

      return { rowCount: 0, rows: [] };
    });

    const app = await createIntegrationApp({
      databaseService: { query },
    });

    const response = await request(app.getHttpServer()).get(
      "/api/snapshots/runs/needs-action?limit=20&offset=0",
    );

    expect(response.status).toBe(200);
    expect(response.body.meta).toEqual({
      count: 2,
      total: 2,
      limit: 20,
      offset: 0,
    });
    expect(response.body.items).toEqual([
      {
        snapshotRunId: "snapshot-failed-1",
        snapshotDate: "2026-04-17",
        snapshotType: "monthly",
        periodStart: "2026-04-01",
        periodEnd: "2026-04-30",
        runStatus: "failed",
        generatedAt: "2026-04-17T10:00:00.000Z",
        generatedBy: "user-1",
        startedAt: "2026-04-17T10:00:10.000Z",
        finishedAt: "2026-04-17T10:01:10.000Z",
        failureReason: "db timeout",
        rerunOfSnapshotRunId: null,
        healthState: "retry_ready",
        actionReason: "Snapshot run failed and can be rerun",
        recommendedAction: "Trigger a rerun after verifying the failure cause",
        canRerun: true,
        rerunCount: 1,
        latestRerunSnapshotRunId: "snapshot-rerun-1",
        isStuck: false,
      },
      {
        snapshotRunId: "snapshot-stuck-1",
        snapshotDate: "2026-04-17",
        snapshotType: "monthly",
        periodStart: "2026-04-01",
        periodEnd: "2026-04-30",
        runStatus: "running",
        generatedAt: "2026-04-17T00:00:00.000Z",
        generatedBy: "user-1",
        startedAt: "2026-04-17T00:00:10.000Z",
        finishedAt: null,
        failureReason: null,
        rerunOfSnapshotRunId: null,
        healthState: "stuck",
        actionReason: "Snapshot run has exceeded the in-progress time threshold",
        recommendedAction: "Inspect worker execution before requesting another rerun",
        canRerun: false,
        rerunCount: 1,
        latestRerunSnapshotRunId: "snapshot-rerun-1",
        isStuck: true,
      },
    ]);

    await app.close();
  });

  it("reruns a failed snapshot by creating a new snapshot run", async () => {
    const query = jest.fn(async (sql: string) => {
      if (sql.includes("FROM rpt.snapshot_run") && sql.includes("WHERE snapshot_run_id = $1::uuid")) {
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

  it("returns snapshot lookups", async () => {
    const query = jest.fn(async (sql: string) => {
      if (sql.includes("FROM ops.user_account ua") && sql.includes("INNER JOIN ops.user_role_assignment")) {
        return { rowCount: 0, rows: [] };
      }

      if (sql.includes("FROM rpt.snapshot_run") && sql.includes("WHERE run_status = 'failed'")) {
        return {
          rowCount: 1,
          rows: [
            {
              snapshot_run_id: "snapshot-failed-lookup-1",
              snapshot_date: "2026-04-17",
              snapshot_type: "monthly",
              period_start: "2026-04-01",
              period_end: "2026-04-30",
              run_status: "failed",
              generated_at: "2026-04-17T10:00:00.000Z",
              generated_by: "user-1",
              started_at: "2026-04-17T10:00:10.000Z",
              finished_at: "2026-04-17T10:01:10.000Z",
              failure_reason: "db timeout",
              rerun_of_snapshot_run_id: null,
            },
          ],
        };
      }

      if (sql.includes("COUNT(*)::text AS active_rerun_count")) {
        return { rowCount: 1, rows: [{ active_rerun_count: "0" }] };
      }

      return { rowCount: 0, rows: [] };
    });

    const app = await createIntegrationApp({ databaseService: { query } });

    const response = await request(app.getHttpServer())
      .get("/api/snapshots/lookups")
      .set("x-user-id", "user-1")
      .set("x-role-codes", "SNAPSHOT_OPERATOR");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      snapshotTypes: ["daily", "weekly", "monthly", "custom"],
      governanceSummary: {
        rerunnableCount: 1,
        blockedCount: 0,
      },
      rerunnableRuns: [
        {
          snapshotRunId: "snapshot-failed-lookup-1",
          snapshotType: "monthly",
          periodStart: "2026-04-01",
          periodEnd: "2026-04-30",
          rerunAllowed: true,
          rerunBlockedReason: null,
        },
      ],
      optionGroups: {
        snapshotTypes: [
          { value: "daily", label: "daily" },
          { value: "weekly", label: "weekly" },
          { value: "monthly", label: "monthly" },
          { value: "custom", label: "custom" },
        ],
        rerunnableRuns: [
          {
            value: "snapshot-failed-lookup-1",
            label: "monthly 2026-04-01..2026-04-30",
            rerunAllowed: true,
          },
        ],
      },
      meta: {
        totalSnapshotTypes: 4,
        totalRerunnableRuns: 1,
      },
    });

    await app.close();
  });

  it("returns rerun governance in snapshot detail and blocks duplicate active reruns", async () => {
    const query = jest.fn(async (sql: string) => {
      if (sql.includes("FROM rpt.snapshot_run") && sql.includes("WHERE snapshot_run_id = $1::uuid")) {
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

      if (sql.includes("WHERE snapshot_run_id = $1::uuid") && sql.includes("store_workforce_snapshot")) {
        return { rowCount: 1, rows: [{ row_count: "0" }] };
      }

      if (sql.includes("WHERE snapshot_run_id = $1::uuid") && sql.includes("store_kpi_snapshot")) {
        return { rowCount: 1, rows: [{ row_count: "0" }] };
      }

      if (sql.includes("WHERE snapshot_run_id = $1::uuid") && sql.includes("store_checklist_snapshot")) {
        return { rowCount: 1, rows: [{ row_count: "0" }] };
      }

      if (sql.includes("WHERE snapshot_run_id = $1::uuid") && sql.includes("turnover_snapshot")) {
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
      if (sql.includes("FROM rpt.snapshot_run") && sql.includes("WHERE snapshot_run_id = $1::uuid")) {
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

  it("returns snapshot run dependencies", async () => {
    const query = jest.fn(async (sql: string) => {
      if (sql.includes("FROM rpt.snapshot_run") && sql.includes("WHERE snapshot_run_id = $1::uuid")) {
        return {
          rowCount: 1,
          rows: [
            {
              snapshot_run_id: "snapshot-deps-1",
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

    const app = await createIntegrationApp({ databaseService: { query } });

    const response = await request(app.getHttpServer())
      .get("/api/snapshots/runs/snapshot-deps-1/dependencies")
      .set("x-user-id", "user-1")
      .set("x-role-codes", "SNAPSHOT_OPERATOR");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      snapshotRunId: "snapshot-deps-1",
      runStatus: "failed",
      rerunAllowed: false,
      rerunBlockedReason: "An active rerun already exists for this snapshot run",
      checks: [
        {
          code: "run_failed",
          status: "pass",
          message: "Snapshot run is in failed status",
        },
        {
          code: "active_rerun_absent",
          status: "fail",
          message: "An active rerun already exists for this snapshot run",
        },
      ],
    });

    await app.close();
  });

  it("returns snapshot run lineage", async () => {
    const query = jest.fn(async (sql: string, params?: unknown[]) => {
      if (
        sql.includes("FROM rpt.snapshot_run") &&
        sql.includes("WHERE snapshot_run_id = $1::uuid") &&
        !sql.includes("rerun_of_snapshot_run_id = $1::uuid") &&
        (!Array.isArray(params) || params[0] !== "snapshot-lineage-1")
      ) {
        return {
          rowCount: 1,
          rows: [
            {
              snapshot_run_id: "snapshot-lineage-2",
              snapshot_date: "2026-04-18",
              snapshot_type: "monthly",
              period_start: "2026-04-01",
              period_end: "2026-04-30",
              run_status: "failed",
              generated_at: "2026-04-18T01:00:00.000Z",
              generated_by: "user-2",
              started_at: "2026-04-18T01:00:01.000Z",
              finished_at: "2026-04-18T01:00:10.000Z",
              failure_reason: "db timeout",
              rerun_of_snapshot_run_id: "snapshot-lineage-1",
            },
          ],
        };
      }

      if (
        sql.includes("FROM rpt.snapshot_run") &&
        sql.includes("rerun_of_snapshot_run_id = $1::uuid") &&
        Array.isArray(params) &&
        params[0] === "snapshot-lineage-2"
      ) {
        return {
          rowCount: 1,
          rows: [
            {
              snapshot_run_id: "snapshot-lineage-3",
              snapshot_date: "2026-04-18",
              snapshot_type: "monthly",
              period_start: "2026-04-01",
              period_end: "2026-04-30",
              run_status: "queued",
              generated_at: "2026-04-18T02:00:00.000Z",
              generated_by: "user-3",
              started_at: null,
              finished_at: null,
              failure_reason: null,
              rerun_of_snapshot_run_id: "snapshot-lineage-2",
            },
          ],
        };
      }

      if (
        sql.includes("FROM rpt.snapshot_run") &&
        sql.includes("WHERE snapshot_run_id = $1::uuid") &&
        Array.isArray(params) &&
        params[0] === "snapshot-lineage-1"
      ) {
        return {
          rowCount: 1,
          rows: [
            {
              snapshot_run_id: "snapshot-lineage-1",
              snapshot_date: "2026-04-17",
              snapshot_type: "monthly",
              period_start: "2026-04-01",
              period_end: "2026-04-30",
              run_status: "completed",
              generated_at: "2026-04-17T01:00:00.000Z",
              generated_by: "user-1",
              started_at: "2026-04-17T01:00:01.000Z",
              finished_at: "2026-04-17T01:00:10.000Z",
              failure_reason: null,
              rerun_of_snapshot_run_id: null,
            },
          ],
        };
      }

      return { rowCount: 0, rows: [] };
    });

    const app = await createIntegrationApp({ databaseService: { query } });

    const response = await request(app.getHttpServer())
      .get("/api/snapshots/runs/snapshot-lineage-2/lineage")
      .set("x-user-id", "user-1")
      .set("x-role-codes", "SNAPSHOT_OPERATOR");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      snapshotRunId: "snapshot-lineage-2",
      parent: {
        snapshotRunId: "snapshot-lineage-1",
        runStatus: "completed",
        snapshotType: "monthly",
      },
      children: [
        {
          snapshotRunId: "snapshot-lineage-3",
          runStatus: "queued",
          snapshotType: "monthly",
        },
      ],
    });

    await app.close();
  });
});
