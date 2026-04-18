import { SnapshotService } from "./snapshot.service";

describe("SnapshotService", () => {
  it("queues snapshot work without generating snapshots inline during enqueue", async () => {
    const query = jest.fn(async (sql: string) => {
      if (sql.includes("SELECT snapshot_run_id")) {
        return { rowCount: 0, rows: [] };
      }

      if (sql.includes("generate_")) {
        throw new Error("snapshot generation should not run during enqueue");
      }

      return { rowCount: 1, rows: [] };
    });

    const databaseService = {
      query,
      withTransaction: async <T>(work: (client: { query: typeof query }) => Promise<T>) =>
        work({ query }),
    };
    const dispatch = jest.fn(async (_type, _payload, _handler) => ({
      status: "queued" as const,
      jobType: "snapshot-run" as const,
      backend: "bullmq",
    }));
    const snapshotOperationsRepository = {
      createSnapshotRun: jest.fn(async () => ({
        snapshot_run_id: "snapshot-1",
        snapshot_date: "2026-04-17",
        generated_at: "2026-04-17T00:00:00.000Z",
        run_status: "queued",
        started_at: null,
        finished_at: null,
        failure_reason: null,
        rerun_of_snapshot_run_id: null,
      })),
      recordSnapshotAuditEvent: jest.fn(async () => undefined),
    };

    const service = new SnapshotService(
      databaseService as never,
      { dispatch } as never,
      snapshotOperationsRepository as never,
    );

    const result = await service.enqueueSnapshotRun({
      snapshotType: "monthly",
      periodStart: "2026-04-01",
      periodEnd: "2026-04-30",
      actorUserId: "user-1",
    });

    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch).toHaveBeenCalledWith(
      "snapshot-run",
      {
        snapshotRunId: "snapshot-1",
        periodStart: "2026-04-01",
        periodEnd: "2026-04-30",
      },
      expect.any(Function),
    );
    expect(result.command.status).toBe("queued");
    expect(result.data.snapshotRun.snapshot_run_id).toBe("snapshot-1");
    expect(snapshotOperationsRepository.createSnapshotRun).toHaveBeenCalledTimes(1);
  });

  it("creates a new snapshot run when rerunning a failed run", async () => {
    const query = jest.fn(async () => ({ rowCount: 1, rows: [] }));
    const databaseService = {
      query,
      withTransaction: async <T>(work: (client: { query: typeof query }) => Promise<T>) =>
        work({ query }),
    };
    const dispatch = jest.fn(async () => ({
      status: "queued" as const,
      jobType: "snapshot-run" as const,
      backend: "bullmq",
    }));
    const snapshotOperationsRepository = {
      findSnapshotRunById: jest.fn(async () => ({
        snapshot_run_id: "snapshot-old",
        snapshot_date: "2026-04-17",
        snapshot_type: "monthly",
        period_start: "2026-04-01",
        period_end: "2026-04-30",
        run_status: "failed",
        generated_at: "2026-04-17T00:00:00.000Z",
        generated_by: "user-1",
        started_at: "2026-04-17T00:00:00.000Z",
        finished_at: "2026-04-17T00:03:00.000Z",
        failure_reason: "db timeout",
        rerun_of_snapshot_run_id: null,
      })),
      countActiveReruns: jest.fn(async () => 0),
      createSnapshotRun: jest.fn(async () => ({
        snapshot_run_id: "snapshot-new",
        snapshot_date: "2026-04-17",
        generated_at: "2026-04-17T00:10:00.000Z",
        run_status: "queued",
        started_at: null,
        finished_at: null,
        failure_reason: null,
        rerun_of_snapshot_run_id: "snapshot-old",
      })),
      recordSnapshotAuditEvent: jest.fn(async () => undefined),
    };

    const service = new SnapshotService(
      databaseService as never,
      { dispatch } as never,
      snapshotOperationsRepository as never,
    );

    const result = await service.rerunSnapshotRun("snapshot-old", "user-2");

    expect(result.command.status).toBe("queued");
    expect(result.data.snapshotRun.snapshot_run_id).toBe("snapshot-new");
    expect(result.data.snapshotRun.rerun_of_snapshot_run_id).toBe("snapshot-old");
    expect(dispatch).toHaveBeenCalledWith(
      "snapshot-run",
      {
        snapshotRunId: "snapshot-new",
        periodStart: "2026-04-01",
        periodEnd: "2026-04-30",
      },
      expect.any(Function),
    );
  });
});
