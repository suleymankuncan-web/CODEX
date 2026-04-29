import { ReportingService } from "./reporting.service";

describe("ReportingService store monthly score breakdown", () => {
  it("returns KPI plus BM checklist contribution for a monthly snapshot", async () => {
    const reportingRepository = {
      getStoreKpiSnapshotRowsForScore: jest.fn(async () => [
        { kpi_code: "TARGET_ACHIEVEMENT", achievement_rate: "1.10" },
        { kpi_code: "CR", achievement_rate: "1.00" },
      ]),
      getStoreChecklistSnapshotForScore: jest.fn(async () => ({
        checklist_template_id: "checklist-template-1",
        audit_count: 2,
        avg_score: "80",
      })),
    };
    const service = new ReportingService(
      reportingRepository as never,
      {
        getKpiConfigRows: jest.fn(async () => []),
        getLatestPublishedKpiConfigVersion: jest.fn(async () => null),
      } as never,
      {} as never,
    );

    const result = await service.getStoreMonthlyScoreBreakdown({
      snapshotRunId: "snapshot-1",
      storeId: "store-1",
      storeIds: ["store-1"],
    });

    expect(result.components.bmChecklist.status).toBe("included");
    expect(result.components.bmChecklist.visitCount).toBe(2);
    expect(result.components.bmChecklist.contribution).toBe(4);
    expect(result.components.vmChecklist.status).toBe("future_inactive");
  });

  it("rejects store score breakdown outside store scope", async () => {
    const service = new ReportingService(
      {} as never,
      { getKpiConfigRows: jest.fn(async () => []) } as never,
      {} as never,
    );

    await expect(
      service.getStoreMonthlyScoreBreakdown({
        snapshotRunId: "snapshot-1",
        storeId: "store-2",
        storeIds: ["store-1"],
      }),
    ).rejects.toThrow("Store score breakdown is outside current store scope.");
  });
});
