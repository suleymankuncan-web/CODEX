import {
  previousIncentivePeriod,
  SalesTargetIncentiveAutoCloseWorkerService,
} from "./sales-target-incentive-auto-close-worker.service";

const companyId = "00000000-0000-4000-8000-000000000001";

describe("SalesTargetIncentiveAutoCloseWorkerService", () => {
  it("resolves the previous Istanbul calendar month across year boundaries", () => {
    expect(previousIncentivePeriod(new Date("2026-01-01T00:30:00Z"))).toEqual({
      periodKey: "2025-12", finalDay: "2025-12-31",
    });
    expect(previousIncentivePeriod(new Date("2026-03-01T00:30:00Z"))).toEqual({
      periodKey: "2026-02", finalDay: "2026-02-28",
    });
  });

  it("only asks to close companies with a completed final-day import", async () => {
    jest.useFakeTimers().setSystemTime(new Date("2026-06-01T00:30:00Z"));
    try {
      const config = { incentiveAutoCloseEnabled: true };
      const closeRepository = {
        listAutomaticCloseCompanyIds: jest.fn().mockResolvedValue([companyId]),
      };
      const incentiveApi = {
        runAutomaticClose: jest.fn().mockResolvedValue({ closed: true, status: "closed" }),
      };
      const worker = new SalesTargetIncentiveAutoCloseWorkerService(
        config as never, closeRepository as never, incentiveApi as never,
      );
      await worker.runOnce();
      expect(closeRepository.listAutomaticCloseCompanyIds).toHaveBeenCalledWith({
        periodKey: "2026-05", finalDay: "2026-05-31",
      });
      expect(incentiveApi.runAutomaticClose).toHaveBeenCalledWith({
        periodKey: "2026-05", companyId,
      });
    } finally {
      jest.useRealTimers();
    }
  });

  it("does not attempt a close when automation is disabled", async () => {
    const closeRepository = { listAutomaticCloseCompanyIds: jest.fn() };
    const worker = new SalesTargetIncentiveAutoCloseWorkerService(
      { incentiveAutoCloseEnabled: false } as never,
      closeRepository as never,
      { runAutomaticClose: jest.fn() } as never,
    );
    await worker.runOnce();
    expect(closeRepository.listAutomaticCloseCompanyIds).not.toHaveBeenCalled();
  });
});
