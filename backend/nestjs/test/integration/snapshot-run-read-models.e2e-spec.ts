import * as request from "supertest";
import { createIntegrationApp } from "./test-app";

const hasSnapshotRunIdPredicate = (sql: string) =>
  sql.includes("WHERE snapshot_run_id = $1::uuid") ||
  sql.includes("WHERE rpt.snapshot_run.snapshot_run_id = $1::uuid");

const hasGeneratedAtDescOrder = (sql: string) =>
  sql.includes("ORDER BY generated_at DESC") ||
  sql.includes("ORDER BY rpt.snapshot_run.generated_at DESC");

const hasFailedRunStatusPredicate = (sql: string) =>
  sql.includes("WHERE run_status = 'failed'") ||
  sql.includes("WHERE rpt.snapshot_run.run_status = 'failed'");

describe("Snapshot run read models", () => {
  it("lists snapshot runs with health state and pagination metadata", async () => {
    const companyId = "00000000-0000-0000-0000-000000000001";
    const query = jest.fn(async (sql: string, _params?: unknown[]) => {
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
    )
      .set("x-role-codes", "SNAPSHOT_OPERATOR")
      .set("x-company-ids", companyId);

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
    expect(
      query.mock.calls.some(
        ([sql, params]) =>
          sql.includes("rpt.snapshot_run.company_ids &&") &&
          Array.isArray(params) &&
          params.some((param: unknown) => Array.isArray(param) && param.includes(companyId)),
      ),
    ).toBe(true);

    await app.close();
  });

  it("returns snapshot run detail with cards and rerun state", async () => {
    const companyId = "00000000-0000-0000-0000-000000000001";
    const query = jest.fn(async (sql: string, _params?: unknown[]) => {
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

      if (hasSnapshotRunIdPredicate(sql) && sql.includes("store_workforce_snapshot")) {
        return { rowCount: 1, rows: [{ row_count: "4" }] };
      }

      if (hasSnapshotRunIdPredicate(sql) && sql.includes("store_kpi_snapshot")) {
        return { rowCount: 1, rows: [{ row_count: "5" }] };
      }

      if (hasSnapshotRunIdPredicate(sql) && sql.includes("store_checklist_snapshot")) {
        return { rowCount: 1, rows: [{ row_count: "3" }] };
      }

      if (hasSnapshotRunIdPredicate(sql) && sql.includes("turnover_snapshot")) {
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

    const response = await request(app.getHttpServer())
      .get("/api/snapshots/runs/snapshot-2")
      .set("x-role-codes", "SNAPSHOT_OPERATOR")
      .set("x-company-ids", companyId);

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
    const detailLookup = query.mock.calls.find(
      ([sql]) =>
        sql.includes("FROM rpt.snapshot_run") &&
        hasSnapshotRunIdPredicate(sql) &&
        sql.includes("rpt.snapshot_run.company_ids &&"),
    );
    expect(detailLookup?.[1]).toEqual(["snapshot-2", [companyId]]);

    await app.close();
  });

  it("returns snapshot run audit events", async () => {
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
        correlationId: null,
        eventType: "snapshot_run.created",
        metadata: { snapshotType: "monthly" },
      },
      {
        eventLogId: "evt-2",
        occurredAt: "2026-04-17T01:00:01.000Z",
        actorUserId: null,
        correlationId: null,
        eventType: "snapshot_run.started",
        metadata: {},
      },
      {
        eventLogId: "evt-3",
        occurredAt: "2026-04-17T01:00:10.000Z",
        actorUserId: null,
        correlationId: null,
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
        hasGeneratedAtDescOrder(sql) &&
        Array.isArray(params) &&
        params[1] === "completed"
      ) {
        return { rowCount: 1, rows: [{ snapshot_run_id: "snapshot-latest-completed" }] };
      }

      if (
        hasGeneratedAtDescOrder(sql) &&
        Array.isArray(params) &&
        params[1] === "failed"
      ) {
        return { rowCount: 1, rows: [{ snapshot_run_id: "snapshot-latest-failed" }] };
      }

      if (
        hasGeneratedAtDescOrder(sql) &&
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
        hasGeneratedAtDescOrder(sql) &&
        Array.isArray(params) &&
        params[1] === "completed"
      ) {
        return { rowCount: 1, rows: [{ snapshot_run_id: "snapshot-latest-completed" }] };
      }

      if (
        hasGeneratedAtDescOrder(sql) &&
        Array.isArray(params) &&
        params[1] === "failed"
      ) {
        return { rowCount: 1, rows: [{ snapshot_run_id: "snapshot-latest-failed" }] };
      }

      if (
        hasGeneratedAtDescOrder(sql) &&
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
        kpiConfigVersion: {
          kpiConfigVersionId: null,
          versionNo: null,
          state: "pre_governance",
        },
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
        kpiConfigVersion: {
          kpiConfigVersionId: null,
          versionNo: null,
          state: "pre_governance",
        },
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

  it("returns snapshot lookups", async () => {
    const query = jest.fn(async (sql: string) => {
      if (sql.includes("FROM ops.user_account ua") && sql.includes("INNER JOIN ops.user_role_assignment")) {
        return { rowCount: 0, rows: [] };
      }

      if (sql.includes("FROM rpt.snapshot_run") && hasFailedRunStatusPredicate(sql)) {
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

  it("returns snapshot run dependencies", async () => {
    const query = jest.fn(async (sql: string) => {
      if (sql.includes("FROM rpt.snapshot_run") && hasSnapshotRunIdPredicate(sql)) {
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
        hasSnapshotRunIdPredicate(sql) &&
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
        hasSnapshotRunIdPredicate(sql) &&
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
