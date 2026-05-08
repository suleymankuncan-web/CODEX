import { ReportingController } from "./reporting.controller";

describe("ReportingController", () => {
  const createController = () => {
    const reportingService = {
      getStoreKpiHighlights: jest.fn(async () => ({ ok: true })),
      getStoreMonthlyScoreBreakdown: jest.fn(async () => ({ ok: true })),
    };
    const rankingService = {};

    return {
      controller: new ReportingController(
        reportingService as never,
        rankingService as never,
      ),
      reportingService,
    };
  };

  it("keeps store manager live KPI highlights limited to assigned stores", async () => {
    const { controller, reportingService } = createController();

    await controller.getStoreKpiHighlights(
      {
        user: {
          roleCodes: ["STORE_MANAGER"],
          scope: {
            companyIds: ["company-1"],
            regionIds: ["region-1"],
            storeIds: [],
          },
          actionScope: {
            assignedStoreIds: ["store-1"],
          },
        },
      },
      {
        periodType: "monthly",
        periodStart: "2026-04-01",
      },
    );

    expect(reportingService.getStoreKpiHighlights).toHaveBeenCalledWith({
      companyIds: [],
      regionIds: [],
      storeIds: ["store-1"],
      periodType: "monthly",
      periodStart: "2026-04-01",
    });
  });

  it("keeps store manager score breakdown limited to assigned stores", async () => {
    const { controller, reportingService } = createController();

    await controller.getStoreScoreBreakdown(
      {
        user: {
          roleCodes: ["STORE_MANAGER"],
          scope: {
            companyIds: ["company-1"],
            regionIds: ["region-1"],
            storeIds: [],
          },
          actionScope: {
            assignedStoreIds: ["store-1"],
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
