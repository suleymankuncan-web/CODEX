import { Logger } from "@nestjs/common";
import { WorkflowInboxService } from "./workflow-inbox.service";

function createEmptyStoreActionPlanRepository() {
  return {
    listWorkflowInboxPlans: jest.fn(async () => []),
  };
}

describe("WorkflowInboxService", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

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
      snapshotReportingReadRepository as never,
      createEmptyStoreActionPlanRepository() as never,
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
      snapshotReportingReadRepository as never,
      createEmptyStoreActionPlanRepository() as never,
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

  it("adds active store action plans as assigned-store workflow tasks", async () => {
    const targetDistributionRepository = {
      listRequests: jest.fn(),
    };
    const checklistAcknowledgementRepository = {
      listChecklistAcknowledgements: jest.fn(async () => []),
    };
    const snapshotReportingReadRepository = {
      getLatestCompletedSnapshotRun: jest.fn(async () => null),
    };
    const storeActionPlanRepository = {
      listWorkflowInboxPlans: jest.fn(async () => [
        {
          actionPlanId: "action-plan-1",
          companyId: "company-1",
          regionId: "region-1",
          storeId: "store-1",
          ownerUserId: "user-1",
          createdByUserId: "user-1",
          sourceType: "kpi_exception",
          sourceId: "snapshot-1:store-1:kpi-1",
          sourceDeepLink: "/store/kpis",
          sourceSnapshotRunId: null,
          sourceKpiId: null,
          title: "Net sales follow-up",
          summary: "Call the team and plan the shift recovery",
          priority: "high",
          status: "open",
          dueOn: "2026-05-24",
          resolutionNote: null,
          closedByUserId: null,
          closedAt: null,
          cancelReason: null,
          cancelledByUserId: null,
          cancelledAt: null,
          createdAt: "2026-05-22T08:00:00.000Z",
          updatedAt: "2026-05-22T09:00:00.000Z",
        },
      ]),
    };
    const service = new WorkflowInboxService(
      targetDistributionRepository as never,
      checklistAcknowledgementRepository as never,
      snapshotReportingReadRepository as never,
      storeActionPlanRepository as never,
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

    expect(storeActionPlanRepository.listWorkflowInboxPlans).toHaveBeenCalledWith({
      storeIds: ["store-1"],
      statuses: ["open", "in_progress", "blocked"],
      limit: 20,
    });
    expect(result.items).toEqual([
      expect.objectContaining({
        itemType: "task",
        sourceType: "store_action_plan",
        sourceId: "action-plan-1",
        title: "Net sales follow-up",
        inboxStatus: "needs_attention",
        urgency: "high",
        needsAttentionAt: "2026-05-24T12:00:00.000Z",
        deepLink: "/store/tasks?actionPlan=action-plan-1",
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
      snapshotReportingReadRepository as never,
      createEmptyStoreActionPlanRepository() as never,
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

  it("redacts secret-like material from skipped inbox warning logs", async () => {
    const warnSpy = jest.spyOn(Logger.prototype, "warn").mockImplementation(() => undefined);
    const targetDistributionRepository = {
      listRequests: jest.fn(async () => {
        throw new Error("database failed password=secret token=abc123");
      }),
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
      snapshotReportingReadRepository as never,
      createEmptyStoreActionPlanRepository() as never,
    );

    await service.listInbox({
      actorRoles: ["SUPER_ADMIN"],
      actorScope: {
        companyIds: ["company-1"],
        regionIds: [],
        storeIds: [],
      },
      actorActionScope: {
        assignedStoreIds: [],
      },
    });

    const warning = String(warnSpy.mock.calls.at(-1)?.[0]);
    expect(warning).toContain("password=[redacted]");
    expect(warning).toContain("token=[redacted]");
    expect(warning).not.toContain("secret");
    expect(warning).not.toContain("abc123");
  });
});
