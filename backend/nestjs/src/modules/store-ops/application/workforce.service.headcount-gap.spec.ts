import { ForbiddenException } from "@nestjs/common";
import { WorkforceService } from "./workforce.service";

describe("WorkforceService headcount gap access", () => {
  const storeId = "00000000-0000-0000-0000-000000000100";
  const regionId = "00000000-0000-0000-0000-000000000010";
  const companyId = "00000000-0000-0000-0000-000000000001";

  function createService(input?: {
    storeRegionId?: string;
  }) {
    const storeOpsRepository = {
      getStoreHeadcountGap: jest.fn().mockResolvedValue({
        store_id: storeId,
        planned_headcount: "5.00",
        active_headcount: "3.00",
        headcount_gap: "2.00",
        planned_fte: "5.00",
        active_fte: "3.00",
        fte_gap: "2.00",
      }),
    };
    const workforceRequestRepository = {
      getStoreForSellerCodeRequest: jest.fn().mockResolvedValue({
        company_id: companyId,
        region_id: input?.storeRegionId ?? regionId,
        store_id: storeId,
      }),
      listSellerCodeRequests: jest.fn().mockResolvedValue({ items: [], total: 0 }),
      listOffboardingRequests: jest.fn().mockResolvedValue({ items: [], total: 0 }),
    };

    return {
      service: new WorkforceService(
        storeOpsRepository as never,
        workforceRequestRepository as never,
      ),
      storeOpsRepository,
      workforceRequestRepository,
    };
  }

  it("allows a Region Manager to read headcount gap for a directly assigned store", async () => {
    const { service, storeOpsRepository } = createService();

    await expect(service.getStoreHeadcountGap({
      actorScope: {
        companyIds: [],
        regionIds: [],
        storeIds: [],
      },
      actorActionScope: {
        assignedStoreIds: [storeId],
      },
      actorRoleCodes: ["REGION_MANAGER"],
      storeId,
      periodStart: "2026-06-01",
      periodEnd: "2026-06-30",
    })).resolves.toMatchObject({
      planned_headcount: "5.00",
      active_headcount: "3.00",
    });

    expect(storeOpsRepository.getStoreHeadcountGap).toHaveBeenCalledWith(
      expect.objectContaining({
        storeId,
        periodStart: "2026-06-01",
        periodEnd: "2026-06-30",
      }),
    );
  });

  it("blocks same-region headcount access without an active store assignment", async () => {
    const { service, storeOpsRepository } = createService();

    await expect(service.getStoreHeadcountGap({
      actorScope: {
        companyIds: [],
        regionIds: [regionId],
        storeIds: [],
      },
      actorActionScope: {
        assignedStoreIds: [],
      },
      actorRoleCodes: ["REGION_MANAGER"],
      storeId,
      periodStart: "2026-06-01",
      periodEnd: "2026-06-30",
    })).rejects.toBeInstanceOf(ForbiddenException);

    expect(storeOpsRepository.getStoreHeadcountGap).not.toHaveBeenCalled();
  });

  it("keeps workforce request lists limited to assigned stores even when read scope is broader", async () => {
    const assignedStoreId = "00000000-0000-0000-0000-000000000101";
    const broadReadStoreId = "00000000-0000-0000-0000-000000000102";
    const { service, workforceRequestRepository } = createService();
    const scopeInput = {
      actorScope: {
        companyIds: [],
        regionIds: [],
        storeIds: [broadReadStoreId],
      },
      actorActionScope: {
        assignedStoreIds: [assignedStoreId],
      },
      actorRoleCodes: ["STORE_MANAGER"],
      status: "pending_hr_approval" as const,
      storeId: assignedStoreId,
      limit: 500,
      offset: -2,
    };

    await service.listSellerCodeRequests(scopeInput);
    await service.listOffboardingRequests(scopeInput);

    expect(workforceRequestRepository.listSellerCodeRequests).toHaveBeenCalledWith({
      companyIds: [],
      regionIds: [],
      storeIds: [assignedStoreId],
      status: "pending_hr_approval",
      limit: 100,
      offset: 0,
    });
    expect(workforceRequestRepository.listOffboardingRequests).toHaveBeenCalledWith({
      companyIds: [],
      regionIds: [],
      storeIds: [assignedStoreId],
      status: "pending_hr_approval",
      limit: 100,
      offset: 0,
    });
  });

  it("allows Report Viewer headcount reads only inside assigned companies", async () => {
    const { service, storeOpsRepository } = createService();

    await expect(service.getStoreHeadcountGap({
      actorScope: {
        companyIds: ["company-from-manager"],
        regionIds: ["region-from-manager"],
        storeIds: ["store-from-manager"],
      },
      actorReadScope: {
        companyIds: [companyId],
        regionIds: [],
        storeIds: [],
      },
      actorActionScope: { assignedStoreIds: ["store-from-manager"] },
      actorRoleCodes: ["STORE_MANAGER", "REPORT_VIEWER"],
      storeId,
      periodStart: "2026-06-01",
      periodEnd: "2026-06-30",
    })).resolves.toBeDefined();

    expect(storeOpsRepository.getStoreHeadcountGap).toHaveBeenCalled();
  });

  it("fails closed for Report Viewer without a company scope", async () => {
    const { service, storeOpsRepository } = createService();

    await expect(service.getStoreHeadcountGap({
      actorScope: {
        companyIds: [companyId],
        regionIds: [regionId],
        storeIds: [storeId],
      },
      actorReadScope: {
        companyIds: [],
        regionIds: [],
        storeIds: [],
      },
      actorActionScope: { assignedStoreIds: [storeId] },
      actorRoleCodes: ["REPORT_VIEWER"],
      storeId,
      periodStart: "2026-06-01",
      periodEnd: "2026-06-30",
    })).rejects.toBeInstanceOf(ForbiddenException);

    expect(storeOpsRepository.getStoreHeadcountGap).not.toHaveBeenCalled();
  });
});
