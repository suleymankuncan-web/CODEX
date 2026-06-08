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

  it("allows a region manager to read headcount gap for a store in their region", async () => {
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

  it("blocks a region manager from reading headcount gap outside their region", async () => {
    const { service, storeOpsRepository } = createService({
      storeRegionId: "00000000-0000-0000-0000-000000000099",
    });

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
});
