import { ReportingService } from "./reporting.service";

describe("ReportingService store monthly score breakdown", () => {
  const createService = (reportingRepository: Record<string, jest.Mock>) =>
    new ReportingService(
      reportingRepository as never,
      {
        getKpiConfigRows: jest.fn(async () => []),
        getLatestPublishedKpiConfigVersion: jest.fn(async () => null),
      } as never,
      {} as never,
      {} as never,
    );

  it("returns KPI plus BM and VM checklist contribution for a monthly snapshot", async () => {
    const reportingRepository = {
      getStoreKpiSnapshotRowsForScore: jest.fn(async () => [
        { kpi_code: "TARGET_ACHIEVEMENT", achievement_rate: "1.00" },
        { kpi_code: "CR", achievement_rate: "1.00" },
      ]),
      getStoreChecklistSnapshotForScore: jest
        .fn()
        .mockImplementation(async (input: { templateType: string }) => {
          if (input.templateType === "BM_STORE_VISIT") {
            return {
              checklist_template_id: "bm-template-1",
              audit_count: 1,
              avg_score: "80",
            };
          }

          if (input.templateType === "VM_STORE_VISIT") {
            return {
              checklist_template_id: "vm-template-1",
              audit_count: 1,
              avg_score: "100",
            };
          }

          return null;
        }),
    };
    const service = createService(reportingRepository);

    const result = await service.getStoreMonthlyScoreBreakdown({
      snapshotRunId: "snapshot-1",
      storeId: "store-1",
      storeIds: ["store-1"],
    });

    expect(reportingRepository.getStoreChecklistSnapshotForScore).toHaveBeenCalledWith({
      snapshotRunId: "snapshot-1",
      storeId: "store-1",
      templateType: "BM_STORE_VISIT",
    });
    expect(reportingRepository.getStoreChecklistSnapshotForScore).toHaveBeenCalledWith({
      snapshotRunId: "snapshot-1",
      storeId: "store-1",
      templateType: "VM_STORE_VISIT",
    });
    expect(result.configuredWeights).toEqual({
      kpiPerformanceWeight: 90,
      bmChecklistWeight: 5,
      vmChecklistWeight: 5,
    });
    expect(result.effectiveWeights).toEqual({
      kpiPerformanceWeight: 90,
      bmChecklistWeight: 5,
      vmChecklistWeight: 5,
    });
    expect(result.components.bmChecklist.status).toBe("included");
    expect(result.components.vmChecklist.status).toBe("included");
  });

  it("returns VM missing weight to KPI when no VM checklist snapshot exists", async () => {
    const reportingRepository = {
      getStoreKpiSnapshotRowsForScore: jest.fn(async () => [
        { kpi_code: "TARGET_ACHIEVEMENT", achievement_rate: "1.00" },
        { kpi_code: "CR", achievement_rate: "1.00" },
      ]),
      getStoreChecklistSnapshotForScore: jest
        .fn()
        .mockImplementation(async (input: { templateType: string }) =>
          input.templateType === "BM_STORE_VISIT"
            ? {
                checklist_template_id: "bm-template-1",
                audit_count: 1,
                avg_score: "80",
              }
            : null,
        ),
    };
    const service = createService(reportingRepository);

    const result = await service.getStoreMonthlyScoreBreakdown({
      snapshotRunId: "snapshot-1",
      storeId: "store-1",
      storeIds: ["store-1"],
    });

    expect(result.effectiveWeights).toEqual({
      kpiPerformanceWeight: 95,
      bmChecklistWeight: 5,
      vmChecklistWeight: 0,
    });
    expect(result.components.vmChecklist.status).toBe("not_included");
    expect(result.components.vmChecklist.missingReason).toBe(
      "vm_checklist_not_completed_for_period",
    );
  });

  it("rejects store score breakdown outside store scope", async () => {
    const service = createService({});

    await expect(
      service.getStoreMonthlyScoreBreakdown({
        snapshotRunId: "snapshot-1",
        storeId: "store-2",
        storeIds: ["store-1"],
      }),
    ).rejects.toThrow("Store score breakdown is outside current store scope.");
  });
});
