import { ReportingController } from "./reporting.controller";

describe("ReportingController store score breakdown", () => {
  it("passes snapshot, store, and store scope to the reporting service", async () => {
    const reportingService = {
      getStoreMonthlyScoreBreakdown: jest.fn(async () => ({
        totalScore: 100,
      })),
    };
    const controller = new ReportingController(
      reportingService as never,
      { getRankings: jest.fn() } as never,
    );

    await controller.getStoreScoreBreakdown(
      {
        user: {
          scope: {
            storeIds: ["store-1"],
          },
        },
      },
      {
        snapshotRunId: "snapshot-1",
        storeId: "store-1",
      },
    );

    expect(reportingService.getStoreMonthlyScoreBreakdown).toHaveBeenCalledWith({
      snapshotRunId: "snapshot-1",
      storeId: "store-1",
      storeIds: ["store-1"],
    });
  });
});
