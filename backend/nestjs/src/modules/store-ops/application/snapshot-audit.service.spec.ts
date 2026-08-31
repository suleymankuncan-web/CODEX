import { SnapshotService } from "./snapshot.service";

describe("SnapshotService audit reads", () => {
  it("uses the repository total when the audit page is shorter than the filtered stream", async () => {
    const snapshotRunId = "00000000-0000-4000-8000-000000000001";
    const snapshotOperationsRepository = {
      findSnapshotRunById: jest.fn(async () => ({
        snapshot_run_id: snapshotRunId,
        snapshot_date: "2026-04-17",
        snapshot_type: "monthly",
        period_start: "2026-04-01",
        period_end: "2026-04-30",
        run_status: "completed",
        generated_at: "2026-04-17T00:00:00.000Z",
        generated_by: "user-1",
        started_at: null,
        finished_at: null,
        failure_reason: null,
        rerun_of_snapshot_run_id: null,
        kpi_config_version_id: null,
        kpi_config_version_no: null,
      })),
      getSnapshotRunAudit: jest.fn(async () => ({
        rows: [
          {
            event_log_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
            occurred_at: "2026-04-17T00:00:00.000Z",
            actor_user_id: null,
            event_type: "snapshot_run.started",
            metadata_json: {},
          },
        ],
        total: 3,
      })),
    };
    const service = new SnapshotService(
      { dispatch: jest.fn() } as never,
      snapshotOperationsRepository as never,
      {} as never,
      {} as never,
    );

    const result = await service.getSnapshotRunAudit(
      snapshotRunId,
      ["00000000-0000-4000-8000-000000000099"],
      { limit: 1, offset: 2 },
    );

    expect(snapshotOperationsRepository.getSnapshotRunAudit).toHaveBeenCalledWith({
      snapshotRunId,
      limit: 1,
      offset: 2,
    });
    expect(result.meta).toEqual({ count: 1, total: 3, limit: 1, offset: 2 });
    expect(result.items).toHaveLength(1);
  });
});

describe("SnapshotService snapshot needs-action reads", () => {
  it("uses repository rerun projections and propagates the revision without per-row queries", async () => {
    const snapshotRunId = "00000000-0000-4000-8000-000000000001";
    const rerunSnapshotRunId = "00000000-0000-4000-8000-000000000002";
    const actorCompanyId = "00000000-0000-4000-8000-000000000099";
    const revision = "a".repeat(64);
    const countReruns = jest.fn();
    const getLatestRerunSnapshotRunId = jest.fn();
    const snapshotOperationsRepository = {
      listSnapshotRunsNeedingAction: jest.fn(async () => ({
        rows: [
          {
            snapshot_run_id: snapshotRunId,
            company_ids: [actorCompanyId],
            snapshot_date: "2026-04-17",
            snapshot_type: "monthly",
            period_start: "2026-04-01",
            period_end: "2026-04-30",
            run_status: "failed",
            generated_at: "2026-04-17T20:00:00.000Z",
            generated_by: "user-1",
            started_at: "2026-04-17T20:00:01.000Z",
            finished_at: "2026-04-17T20:01:00.000Z",
            failure_reason: "db timeout",
            rerun_of_snapshot_run_id: null,
            kpi_config_version_id: null,
            kpi_config_version_no: null,
            health_state: "retry_ready",
            action_reason: "Snapshot run failed and can be rerun",
            recommended_action: "Trigger a rerun after verifying the failure cause",
            can_rerun: true,
            rerun_count: "2",
            latest_rerun_snapshot_run_id: rerunSnapshotRunId,
            is_stuck: false,
          },
        ],
        total: 3,
        revision,
      })),
      countReruns,
      getLatestRerunSnapshotRunId,
    };
    const service = new SnapshotService(
      { dispatch: jest.fn() } as never,
      snapshotOperationsRepository as never,
      {} as never,
      {} as never,
    );

    const result = await service.getSnapshotRunNeedsAction({
      actorCompanyIds: [actorCompanyId],
      limit: 1,
      offset: 1,
    });

    expect(snapshotOperationsRepository.listSnapshotRunsNeedingAction).toHaveBeenCalledWith(
      expect.objectContaining({
        actorCompanyIds: [actorCompanyId],
        limit: 1,
        offset: 1,
        stuckBefore: expect.any(String),
      }),
    );
    expect(countReruns).not.toHaveBeenCalled();
    expect(getLatestRerunSnapshotRunId).not.toHaveBeenCalled();
    expect(result.meta).toEqual({
      count: 1,
      total: 3,
      limit: 1,
      offset: 1,
      revision,
    });
    expect(result.items[0]).toMatchObject({
      snapshotRunId,
      healthState: "retry_ready",
      actionReason: "Snapshot run failed and can be rerun",
      recommendedAction: "Trigger a rerun after verifying the failure cause",
      canRerun: true,
      rerunCount: 2,
      latestRerunSnapshotRunId: rerunSnapshotRunId,
      isStuck: false,
    });
  });
});
