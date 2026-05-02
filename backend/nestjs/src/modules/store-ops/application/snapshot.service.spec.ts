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
      { getKpiConfigRows: jest.fn(async () => []) } as never,
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
      { getKpiConfigRows: jest.fn(async () => []) } as never,
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

  it("anchors new snapshot runs to the latest KPI config version", async () => {
    const query = jest.fn(async () => ({ rowCount: 0, rows: [] }));
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
      createSnapshotRun: jest.fn(async () => ({
        snapshot_run_id: "snapshot-versioned",
        snapshot_date: "2026-04-26",
        generated_at: "2026-04-26T00:00:00.000Z",
        run_status: "queued",
        started_at: null,
        finished_at: null,
        failure_reason: null,
        rerun_of_snapshot_run_id: null,
        kpi_config_version_id: "11111111-1111-4111-8111-111111111111",
        kpi_config_version_no: 7,
      })),
      recordSnapshotAuditEvent: jest.fn(async () => undefined),
    };
    const kpiConfigRepository = {
      getLatestPublishedKpiConfigVersion: jest.fn(async () => ({
        kpi_config_version_id: "11111111-1111-4111-8111-111111111111",
        version_no: 7,
      })),
    };

    const service = new SnapshotService(
      databaseService as never,
      { dispatch } as never,
      snapshotOperationsRepository as never,
      kpiConfigRepository as never,
    );

    await service.enqueueSnapshotRun({
      snapshotType: "daily",
      periodStart: "2026-04-26",
      periodEnd: "2026-04-26",
      actorUserId: "user-1",
    });

    expect(snapshotOperationsRepository.createSnapshotRun).toHaveBeenCalledWith(
      expect.objectContaining({
        kpiConfigVersionId: "11111111-1111-4111-8111-111111111111",
      }),
      expect.anything(),
    );
    expect(snapshotOperationsRepository.recordSnapshotAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          kpiConfigVersionId: "11111111-1111-4111-8111-111111111111",
          versionNo: 7,
        }),
      }),
      expect.anything(),
    );
  });

  it("reruns failed snapshots with the parent KPI config version", async () => {
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
        snapshot_run_id: "snapshot-parent",
        snapshot_date: "2026-04-26",
        snapshot_type: "daily",
        period_start: "2026-04-26",
        period_end: "2026-04-26",
        run_status: "failed",
        generated_at: "2026-04-26T00:00:00.000Z",
        generated_by: "user-1",
        started_at: "2026-04-26T00:00:00.000Z",
        finished_at: "2026-04-26T00:01:00.000Z",
        failure_reason: "timeout",
        rerun_of_snapshot_run_id: null,
        kpi_config_version_id: "22222222-2222-4222-8222-222222222222",
        kpi_config_version_no: 8,
      })),
      countActiveReruns: jest.fn(async () => 0),
      createSnapshotRun: jest.fn(async () => ({
        snapshot_run_id: "snapshot-rerun",
        snapshot_date: "2026-04-26",
        generated_at: "2026-04-26T00:02:00.000Z",
        run_status: "queued",
        started_at: null,
        finished_at: null,
        failure_reason: null,
        rerun_of_snapshot_run_id: "snapshot-parent",
        kpi_config_version_id: "22222222-2222-4222-8222-222222222222",
        kpi_config_version_no: 8,
      })),
      recordSnapshotAuditEvent: jest.fn(async () => undefined),
    };

    const service = new SnapshotService(
      databaseService as never,
      { dispatch } as never,
      snapshotOperationsRepository as never,
      { getLatestPublishedKpiConfigVersion: jest.fn() } as never,
    );

    await service.rerunSnapshotRun("snapshot-parent", "user-2");

    expect(snapshotOperationsRepository.createSnapshotRun).toHaveBeenCalledWith(
      expect.objectContaining({
        kpiConfigVersionId: "22222222-2222-4222-8222-222222222222",
      }),
      expect.anything(),
    );
  });
});
