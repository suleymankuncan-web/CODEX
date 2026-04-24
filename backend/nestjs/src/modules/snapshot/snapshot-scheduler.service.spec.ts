import { SnapshotSchedulerService } from "./snapshot-scheduler.service";

describe("SnapshotSchedulerService", () => {
  it("marks yesterday as ready when no daily closure exists", async () => {
    const service = new SnapshotSchedulerService(
      {
        enqueueSnapshotRun: jest.fn(),
      } as never,
      {
        findLatestSnapshotRunByTypeAndPeriod: jest.fn(async () => null),
      } as never,
      {
        dailyClosureAutomationEnabled: false,
        dailyClosurePollMinutes: 15,
      } as never,
    );

    const result = await service.getDailyClosureStatus("2026-04-22T09:00:00.000Z");

    expect(result.closureDate).toBe("2026-04-21");
    expect(result.healthState).toBe("ready");
    expect(result.canQueue).toBe(true);
  });

  it("reuses completed daily closure as noop", async () => {
    const enqueueSnapshotRun = jest.fn();
    const service = new SnapshotSchedulerService(
      {
        enqueueSnapshotRun,
      } as never,
      {
        findLatestSnapshotRunByTypeAndPeriod: jest.fn(async () => ({
          snapshot_run_id: "snapshot-1",
          run_status: "completed",
          failure_reason: null,
          generated_at: "2026-04-22T00:10:00.000Z",
        })),
      } as never,
      {
        dailyClosureAutomationEnabled: false,
        dailyClosurePollMinutes: 15,
      } as never,
    );

    const result = await service.scheduleDailySnapshot({
      actorUserId: "user-1",
      closureDate: "2026-04-21",
    });

    expect(result.command.status).toBe("noop");
    expect(enqueueSnapshotRun).not.toHaveBeenCalled();
  });

  it("blocks queueing when the previous daily closure failed", async () => {
    const enqueueSnapshotRun = jest.fn();
    const service = new SnapshotSchedulerService(
      {
        enqueueSnapshotRun,
      } as never,
      {
        findLatestSnapshotRunByTypeAndPeriod: jest.fn(async () => ({
          snapshot_run_id: "snapshot-2",
          run_status: "failed",
          failure_reason: "db timeout",
          generated_at: "2026-04-22T00:10:00.000Z",
        })),
      } as never,
      {
        dailyClosureAutomationEnabled: false,
        dailyClosurePollMinutes: 15,
      } as never,
    );

    const result = await service.scheduleDailySnapshot({
      actorUserId: "user-1",
      closureDate: "2026-04-21",
    });

    expect(result.command.status).toBe("blocked");
    expect(enqueueSnapshotRun).not.toHaveBeenCalled();
  });
});
