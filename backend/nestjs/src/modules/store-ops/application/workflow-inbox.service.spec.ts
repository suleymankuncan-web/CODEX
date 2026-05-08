import { WorkflowInboxService } from "./workflow-inbox.service";

describe("WorkflowInboxService", () => {
  it("keeps store manager acknowledgement inbox items limited to assigned stores even when company scope is present", async () => {
    const targetDistributionRepository = {
      listRequests: jest.fn(),
    };
    const checklistAcknowledgementRepository = {
      listChecklistAcknowledgements: jest.fn(async () => []),
    };
    const reportingRepository = {
      getLatestCompletedSnapshotRun: jest.fn(async () => null),
    };
    const service = new WorkflowInboxService(
      targetDistributionRepository as never,
      checklistAcknowledgementRepository as never,
      reportingRepository as never,
    );

    await service.listInbox({
      actorRoles: ["STORE_MANAGER"],
      actorScope: {
        companyIds: ["company-1"],
        regionIds: ["region-1"],
        storeIds: ["store-1"],
      },
      actorActionScope: {
        assignedStoreIds: ["store-1"],
      },
    });

    expect(checklistAcknowledgementRepository.listChecklistAcknowledgements).toHaveBeenCalledWith({
      companyIds: [],
      regionIds: [],
      storeIds: ["store-1"],
    });
    expect(targetDistributionRepository.listRequests).not.toHaveBeenCalled();
  });

  it("keeps store manager KPI exception inbox items limited to assigned stores even when company scope is present", async () => {
    const targetDistributionRepository = {
      listRequests: jest.fn(),
    };
    const checklistAcknowledgementRepository = {
      listChecklistAcknowledgements: jest.fn(async () => []),
    };
    const reportingRepository = {
      getLatestCompletedSnapshotRun: jest.fn(async () => ({
        snapshot_run_id: "snapshot-1",
      })),
      getKpiReport: jest.fn(async () => ({
        rows: [
          {
            snapshot_run_id: "snapshot-1",
            store_id: "store-1",
            store_name: "Assigned Store",
            kpi_id: "kpi-1",
            kpi_code: "UPT",
            kpi_name: "UPT",
            period_start: "2026-05-01",
            period_end: "2026-05-08",
            target_value: "3.2",
            actual_value: "2.9",
            achievement_rate: "0.9",
            status_band: "at_risk",
          },
        ],
      })),
    };
    const service = new WorkflowInboxService(
      targetDistributionRepository as never,
      checklistAcknowledgementRepository as never,
      reportingRepository as never,
    );

    const result = await service.listInbox({
      actorRoles: ["STORE_MANAGER"],
      actorScope: {
        companyIds: ["company-1"],
        regionIds: ["region-1"],
        storeIds: ["legacy-store"],
      },
      actorActionScope: {
        assignedStoreIds: ["store-1"],
      },
    });

    expect(reportingRepository.getKpiReport).toHaveBeenCalledWith({
      snapshotRunId: "snapshot-1",
      companyIds: [],
      regionIds: [],
      storeIds: ["store-1"],
      limit: 20,
      offset: 0,
    });
    expect(result.items).toEqual([
      expect.objectContaining({
        sourceType: "kpi_exception",
        storeId: "store-1",
        deepLink: "/store/kpis",
      }),
    ]);
  });
});
