import { ForbiddenException } from "@nestjs/common";
import { buildAuthenticatedUser } from "../../auth/auth-context.service";
import { WorkforceWorkspaceReadService } from "./workforce-workspace-read.service";

const storeId = "11111111-1111-4111-8111-111111111111";

describe("WorkforceWorkspaceReadService", () => {
  it("returns one bounded Store Manager workspace with mutation capabilities", async () => {
    const repository = {
      listStorePage: jest.fn().mockResolvedValue({ items: [{
        company_id: "company", company_name: "Company", region_id: "region", region_name: "Region",
        region_manager_name: "Manager", store_id: storeId, store_code: "S1", store_name: "Store",
        store_status: "active", planned_headcount: "5", active_headcount: "1", average_tenure_days: "365",
        shortage_started_on: null, shortage_days: null, total_count: "1",
      }], total: 1, limit: 50, offset: 0 }),
      summarizeScope: jest.fn().mockResolvedValue({
        total_stores: "1", active_personnel: "1", shortage_stores: "1",
        open_positions: "4", average_tenure_days: "365",
      }),
      listActivePersonnel: jest.fn().mockResolvedValue({ items: [{ store_id: storeId, employee_id: "employee",
        display_name: "Person", position_id: "position", position_code: "SALES", position_name: "Satış",
        assignment_start_date: "2025-01-01", employment_status: "active" }], total: 1 }),
      isStoreInScope: jest.fn().mockResolvedValue(true),
      listHistory: jest.fn(),
    };
    const service = new WorkforceWorkspaceReadService(repository as never, {} as never);
    const result = await service.getWorkspace({
      query: "Person",
      actor: buildAuthenticatedUser({
        userId: "user", roleCodes: ["STORE_MANAGER"],
        readScope: { companyIds: [], regionIds: [], storeIds: [storeId] },
        actionScope: { assignedStoreIds: [storeId] },
        roleScopes: { STORE_MANAGER: { companyIds: [], regionIds: [], storeIds: [storeId] } },
      }),
    });

    expect(result.view).toBe("store_manager");
    expect(result.stores.items[0]).toMatchObject({ norm: 5, active: 1, gap: 4, personnelTotal: 1 });
    expect(result.capabilities).toEqual({ canCreateSellerCodeRequest: true, canCreateOffboardingRequest: true });
    expect(repository.listStorePage).toHaveBeenCalledWith({
      scope: { companyIds: [], regionIds: [], storeIds: [storeId] },
      limit: 50, offset: 0, query: "", status: "all", sort: "store", direction: "ascending",
    });
    expect(repository.listActivePersonnel).toHaveBeenCalledWith({
      scope: { companyIds: [], regionIds: [], storeIds: [storeId] }, storeId, limit: 50, offset: 0,
    });
  });

  it("rejects a history store outside the resolved scope", async () => {
    const repository = {
      listStorePage: jest.fn().mockResolvedValue({ items: [], total: 0, limit: 50, offset: 0 }),
      summarizeScope: jest.fn().mockResolvedValue({ total_stores: "0", active_personnel: "0", shortage_stores: "0", open_positions: "0", average_tenure_days: null }),
      listActivePersonnel: jest.fn().mockResolvedValue({ items: [], total: 0 }),
      isStoreInScope: jest.fn().mockResolvedValue(false),
    };
    const service = new WorkforceWorkspaceReadService(repository as never, {} as never);
    await expect(service.getWorkspace({
      actor: buildAuthenticatedUser({
        userId: "viewer", roleCodes: ["REPORT_VIEWER"],
        roleScopes: { REPORT_VIEWER: { companyIds: ["company"], regionIds: [], storeIds: [] } },
      }),
      historyStoreId: storeId,
    })).rejects.toBeInstanceOf(ForbiddenException);
  });
  it("filters the viewer store page and summary by the selected manager assignment", async () => {
    const repository = {
      listStorePage: jest.fn().mockResolvedValue({ items: [], total: 0, limit: 50, offset: 0 }),
      summarizeScope: jest.fn().mockResolvedValue({ total_stores: "10", active_personnel: "60", shortage_stores: "0", open_positions: "0", average_tenure_days: null, turnover_rate: "12.5" }),
    };
    const managerDirectory = { list: jest.fn().mockResolvedValue({ items: [{ userId: "manager", storeIds: [storeId] }] }) };
    const service = new WorkforceWorkspaceReadService(repository as never, managerDirectory as never);
    const result = await service.getWorkspace({ actor: buildAuthenticatedUser({ userId: "viewer", roleCodes: ["REPORT_VIEWER"], roleScopes: { REPORT_VIEWER: { companyIds: ["company"], regionIds: [], storeIds: [] } } }), regionManagerUserId: "manager" });
    expect(repository.listStorePage).toHaveBeenCalledWith(expect.objectContaining({ regionManagerUserId: "manager" }));
    expect(repository.summarizeScope).toHaveBeenCalledWith({ scope: { companyIds: [], regionIds: [], storeIds: [storeId] }, regionManagerUserId: "manager" });
    expect(result.summary.turnoverRate).toBe(12.5);
  });

  it("denies selected-manager personnel and history drilldowns outside assigned stores", async () => {
    const repository = {
      listStorePage: jest.fn().mockResolvedValue({ items: [], total: 0, limit: 50, offset: 0 }),
      summarizeScope: jest.fn().mockResolvedValue({ total_stores: "0", active_personnel: "0", shortage_stores: "0", open_positions: "0", average_tenure_days: null, turnover_rate: null }),
      isStoreInScope: jest.fn(async ({ scope, storeId: requestedStoreId }: { scope: { storeIds: string[] }; storeId: string }) => scope.storeIds.includes(requestedStoreId)),
      listActivePersonnel: jest.fn(),
      listHistory: jest.fn(),
    };
    const managerDirectory = { list: jest.fn().mockResolvedValue({ items: [{ userId: "manager", storeIds: [storeId] }] }) };
    const service = new WorkforceWorkspaceReadService(repository as never, managerDirectory as never);
    const actor = buildAuthenticatedUser({ userId: "viewer", roleCodes: ["REPORT_VIEWER"], roleScopes: { REPORT_VIEWER: { companyIds: ["company"], regionIds: [], storeIds: [] } } });

    await expect(service.getWorkspace({ actor, regionManagerUserId: "manager", personnelStoreId: "other-store" })).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.getWorkspace({ actor, regionManagerUserId: "manager", historyStoreId: "other-store" })).rejects.toBeInstanceOf(ForbiddenException);
    expect(repository.listActivePersonnel).not.toHaveBeenCalled();
    expect(repository.listHistory).not.toHaveBeenCalled();
  });

});
