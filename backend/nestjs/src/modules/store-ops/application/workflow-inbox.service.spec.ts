import { WorkflowInboxService } from "./workflow-inbox.service";

describe("WorkflowInboxService", () => {
  it("keeps store manager acknowledgement inbox items limited to assigned stores even when company scope is present", async () => {
    const targetDistributionRepository = {
      listRequests: jest.fn(),
    };
    const checklistAcknowledgementRepository = {
      listChecklistAcknowledgements: jest.fn(async () => []),
    };
    const snapshotReportingReadRepository = {
      getLatestCompletedSnapshotRun: jest.fn(async () => null),
    };
    const service = new WorkflowInboxService(
      targetDistributionRepository as never,
      checklistAcknowledgementRepository as never,
      {} as never,
      snapshotReportingReadRepository as never,
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
    const snapshotReportingReadRepository = {
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
      {} as never,
      snapshotReportingReadRepository as never,
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

    expect(snapshotReportingReadRepository.getKpiReport).toHaveBeenCalledWith({
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

  it("deep-links pending checklist acknowledgements to the exact checklist receipt", async () => {
    const targetDistributionRepository = {
      listRequests: jest.fn(),
    };
    const checklistAcknowledgementRepository = {
      listChecklistAcknowledgements: jest.fn(async () => [
        {
          checklistInstanceId: "checklist-instance-1",
          checklistTemplateId: "checklist-template-1",
          templateName: "BM Result",
          category: "BM",
          storeId: "store-1",
          storeName: "Assigned Store",
          completedAt: "2026-05-14T09:00:00.000Z",
          status: "completed",
          totalScore: 82,
          complianceRate: 0.82,
          acknowledgement: null,
        },
      ]),
    };
    const snapshotReportingReadRepository = {
      getLatestCompletedSnapshotRun: jest.fn(async () => null),
    };
    const service = new WorkflowInboxService(
      targetDistributionRepository as never,
      checklistAcknowledgementRepository as never,
      {} as never,
      snapshotReportingReadRepository as never,
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

    expect(result.items).toEqual([
      expect.objectContaining({
        sourceType: "checklist_receipt",
        sourceId: "checklist-instance-1",
        deepLink: "/store/checklists?tab=inbox&result=checklist-instance-1",
      }),
    ]);
  });
});
