import { SnapshotService } from "./snapshot.service";

describe("SnapshotService", () => {
  it("queues snapshot work without generating snapshots inline during enqueue", async () => {
    const dispatch = jest.fn(async (_type, _payload, _handler) => ({
      status: "queued" as const,
      jobType: "snapshot-run" as const,
      backend: "bullmq",
    }));
    const snapshotRunCommandRepository = {
      createOrReuseSnapshotRun: jest.fn(async () => ({
        snapshot_run_id: "snapshot-1",
        snapshot_date: "2026-04-17",
        generated_at: "2026-04-17T00:00:00.000Z",
        run_status: "queued",
        started_at: null,
        finished_at: null,
        failure_reason: null,
        rerun_of_snapshot_run_id: null,
      })),
      executeSnapshotRun: jest.fn(),
    };

    const service = new SnapshotService(
      { dispatch } as never,
      {} as never,
      { getKpiConfigRows: jest.fn(async () => []) } as never,
      snapshotRunCommandRepository as never,
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
      { strictLocalJobId: "snapshot-run-snapshot-1" },
    );
    expect(result.command.status).toBe("queued");
    expect(result.data.snapshotRun.snapshot_run_id).toBe("snapshot-1");
    expect(snapshotRunCommandRepository.createOrReuseSnapshotRun).toHaveBeenCalledWith({
      snapshotType: "monthly",
      periodStart: "2026-04-01",
      periodEnd: "2026-04-30",
      actorUserId: "user-1",
      idempotencyKey: "monthly:2026-04-01:2026-04-30",
      actorCompanyIds: undefined,
    });
    expect(snapshotRunCommandRepository.executeSnapshotRun).not.toHaveBeenCalled();
  });

  it("reuses existing snapshot runs without dispatching duplicate work", async () => {
    const dispatch = jest.fn();
    const snapshotRunCommandRepository = {
      createOrReuseSnapshotRun: jest.fn(async () => ({
        snapshot_run_id: "snapshot-existing",
        company_ids: [],
        snapshot_date: "2026-04-17",
        generated_at: "2026-04-17T00:00:00.000Z",
        run_status: "queued",
        reused: true,
      })),
    };

    const service = new SnapshotService(
      { dispatch } as never,
      {} as never,
      { getKpiConfigRows: jest.fn(async () => []) } as never,
      snapshotRunCommandRepository as never,
    );

    const result = await service.enqueueSnapshotRun({
      snapshotType: "monthly",
      periodStart: "2026-04-01",
      periodEnd: "2026-04-30",
      actorUserId: "user-1",
    });

    expect(dispatch).not.toHaveBeenCalled();
    expect(result.command.status).toBe("queued");
    expect(result.job?.backend).toBe("reused");
  });

  it("creates a new snapshot run when rerunning a failed run", async () => {
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
    };
    const snapshotRunCommandRepository = {
      createRerunSnapshotRun: jest.fn(async () => ({
        snapshot_run_id: "snapshot-new",
        snapshot_date: "2026-04-17",
        generated_at: "2026-04-17T00:10:00.000Z",
        run_status: "queued",
        started_at: null,
        finished_at: null,
        failure_reason: null,
        rerun_of_snapshot_run_id: "snapshot-old",
      })),
    };

    const service = new SnapshotService(
      { dispatch } as never,
      snapshotOperationsRepository as never,
      { getKpiConfigRows: jest.fn(async () => []) } as never,
      snapshotRunCommandRepository as never,
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
      { strictLocalJobId: "snapshot-run-snapshot-new" },
    );
    expect(snapshotRunCommandRepository.createRerunSnapshotRun).toHaveBeenCalledWith({
      snapshotRunId: "snapshot-old",
      actorUserId: "user-2",
      actorCompanyIds: undefined,
      existing: expect.objectContaining({
        snapshot_run_id: "snapshot-old",
        run_status: "failed",
      }),
    });
  });

  it("delegates snapshot execution to the command repository", async () => {
    const snapshotOperationsRepository = {
      findSnapshotRunById: jest.fn(async () => ({
        snapshot_run_id: "snapshot-1",
        snapshot_type: "daily",
        kpi_config_version_id: null,
      })),
      markSnapshotRunStarted: jest.fn(async () => undefined),
      markSnapshotRunCompleted: jest.fn(async () => undefined),
      markSnapshotRunFailed: jest.fn(async () => undefined),
    };
    const snapshotRunCommandRepository = {
      executeSnapshotRun: jest.fn(async () => undefined),
    };

    const service = new SnapshotService(
      { dispatch: jest.fn() } as never,
      snapshotOperationsRepository as never,
      { getKpiConfigRows: jest.fn(async () => []) } as never,
      snapshotRunCommandRepository as never,
    );

    await service.executeSnapshotRun("snapshot-1", "2026-04-01", "2026-04-01");

    expect(snapshotOperationsRepository.markSnapshotRunStarted).toHaveBeenCalledWith(
      "snapshot-1",
    );
    expect(snapshotRunCommandRepository.executeSnapshotRun).toHaveBeenCalledWith({
      snapshotRunId: "snapshot-1",
      periodStart: "2026-04-01",
      periodEnd: "2026-04-01",
      personnelProfile: expect.objectContaining({ profileCode: "personnel" }),
    });
    expect(snapshotOperationsRepository.markSnapshotRunCompleted).toHaveBeenCalledWith(
      "snapshot-1",
    );
  });
});
