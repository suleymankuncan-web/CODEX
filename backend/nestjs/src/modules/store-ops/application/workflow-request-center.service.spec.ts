import { WorkflowInboxService } from "./workflow-inbox.service";

function createService(requestCenterReadRepository: { listRequests: jest.Mock }) {
  return new WorkflowInboxService(
    { listRequests: jest.fn() } as never,
    { listChecklistAcknowledgements: jest.fn() } as never,
    { getLatestCompletedSnapshotRun: jest.fn() } as never,
    { listWorkflowInboxPlans: jest.fn() } as never,
    requestCenterReadRepository as never,
  );
}

describe("WorkflowInboxService request center", () => {
  it("keeps a store manager ledger on assigned stores and maps the read envelope", async () => {
    const requestCenterReadRepository = {
      listRequests: jest.fn(async () => ({
        items: [
          {
            request_id: "request-1",
            request_type: "target",
            store_id: "store-1",
            store_name: "Assigned Store",
            request_status: "pending_region_approval",
            updated_at: "2026-07-10T09:00:00.000Z",
            target_label: "July target",
            request_month: "2026-07-01",
            allocation_count: 4,
            approval_mode: null,
            person_display_name: null,
            national_id_last4: null,
            external_employee_ref: null,
          },
        ],
        total: 31,
        summary: { open: 20, done: 11, returned: 2, periods: ["2026-07"] },
        limit: 15,
        offset: 15,
      })),
    };
    const service = createService(requestCenterReadRepository);

    const result = await service.listRequestCenter({
      actorRoles: ["STORE_MANAGER"],
      actorScope: {
        companyIds: ["company-1"],
        regionIds: ["region-1"],
        storeIds: ["legacy-store"],
      },
      actorActionScope: { assignedStoreIds: ["store-1"] },
      bucket: "open",
      type: "all",
      status: "pending",
      period: "2026-07",
      limit: 15,
      offset: 15,
    });

    expect(requestCenterReadRepository.listRequests).toHaveBeenCalledWith({
      companyIds: [],
      regionIds: [],
      storeIds: ["store-1"],
      bucket: "open",
      type: "all",
      status: "pending",
      period: "2026-07",
      limit: 15,
      offset: 15,
    });
    expect(result).toEqual({
      items: [
        expect.objectContaining({
          requestId: "request-1",
          requestType: "target",
          storeId: "store-1",
          status: "pending_region_approval",
          targetLabel: "July target",
        }),
      ],
      meta: {
        count: 1,
        total: 31,
        limit: 15,
        offset: 15,
      },
      summary: { open: 20, done: 11, returned: 2, periods: ["2026-07"] },
    });
  });

  it("uses region read scope without falling back to assigned action stores", async () => {
    const requestCenterReadRepository = {
      listRequests: jest.fn(async () => ({
        items: [],
        total: 0,
        summary: { open: 0, done: 0, returned: 0, periods: [] },
        limit: 15,
        offset: 0,
      })),
    };
    const service = createService(requestCenterReadRepository);

    await service.listRequestCenter({
      actorRoles: ["REGION_MANAGER"],
      actorScope: {
        companyIds: [],
        regionIds: ["region-1"],
        storeIds: [],
      },
      actorActionScope: { assignedStoreIds: ["action-store-1"] },
      bucket: "open",
      type: "all",
      status: "all",
      limit: 15,
      offset: 0,
    });

    expect(requestCenterReadRepository.listRequests).toHaveBeenCalledWith(
      expect.objectContaining({
        companyIds: [],
        regionIds: ["region-1"],
        storeIds: [],
      }),
    );
  });
});
