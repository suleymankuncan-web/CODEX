import { NotFoundException } from "@nestjs/common";
import { buildAuthenticatedUser } from "../../auth/auth-context.service";
import { SalesTargetIncentiveApiService } from "./sales-target-incentive-api.service";

const companyId = "00000000-0000-4000-8000-000000000001";
const regionId = "00000000-0000-4000-8000-000000000101";
const storeId = "00000000-0000-4000-8000-000000000201";
const otherStoreId = "00000000-0000-4000-8000-000000000202";
const employeeId = "00000000-0000-4000-8000-000000000501";

const eligibleProjection = {
  periodKey: "2026-05",
  periodStart: "2026-05-01",
  periodEnd: "2026-05-31",
  timezone: "Europe/Istanbul",
  stores: [
    {
      companyId,
      regionId,
      storeId,
      storeName: "Marmara Park",
      storeType: "company",
      storeTargetRequestId: "target-request-1",
      storeTargetAmount: "1000000.0000",
      storeNetSalesAmount: "1150000.0000",
      storeNetSalesSourceBatchId: "batch-store-1",
      storeNetSalesLastSyncedAt: "2026-05-31T21:00:00.000Z",
      manager: {
        participantType: "store_manager",
        employeeId: "00000000-0000-4000-8000-000000000401",
        displayName: "Ada Yilmaz",
        positionCode: "STORE_MANAGER",
        normalizedFromPositionCode: null,
        targetReferenceId: null,
        targetAmount: "1000000.0000",
        actualAmount: "1150000.0000",
        source: {
          storeTargetRequestId: "target-request-1",
          storeNetSalesSourceBatchId: "batch-store-1",
          personnelSalesSourceBatchId: null,
        },
        calculation: {
          status: "projected",
          blockedReason: null,
          excludedReason: null,
          ruleVersionCode: "sales-target-incentive-v1.0.0",
          rateTableVersion: "manager-sales-target-v1.0.0",
          positionCode: "STORE_MANAGER",
          normalizedFromPositionCode: null,
          storeAchievementPct: null,
          storeGatePassed: null,
          achievementPct: "115.0000",
          personalRateBeforeGate: null,
          rate: "0.0100",
          rawEarnedAmount: "11500.000000",
          payableAmount: "11500.00",
        },
      },
      personnel: [
        {
          participantType: "personnel",
          employeeId,
          displayName: "Ali Can",
          positionCode: "SALES_ASSOCIATE",
          normalizedFromPositionCode: null,
          targetReferenceId: "target-ref-1",
          targetAmount: "200000.0000",
          actualAmount: "240000.0000",
          source: {
            storeTargetRequestId: "target-request-1",
            storeNetSalesSourceBatchId: "batch-store-1",
            personnelSalesSourceBatchId: "batch-personnel-1",
          },
          calculation: {
            status: "projected",
            blockedReason: null,
            excludedReason: null,
            ruleVersionCode: "sales-target-incentive-v1.0.0",
            rateTableVersion: "personnel-sales-target-v1.0.0",
            positionCode: "SALES_ASSOCIATE",
            normalizedFromPositionCode: null,
            storeAchievementPct: "115.0000",
            storeGatePassed: true,
            achievementPct: "120.0000",
            personalRateBeforeGate: "0.0165",
            rate: "0.0165",
            rawEarnedAmount: "3960.000000",
            payableAmount: "3960.00",
          },
        },
      ],
    },
  ],
};

function createService(projection = eligibleProjection) {
  const readModelService = {
    buildCurrentProjection: jest.fn(async () => projection),
  };
  const service = new SalesTargetIncentiveApiService(readModelService as never);

  return { readModelService, service };
}

describe("SalesTargetIncentiveApiService", () => {
  it("returns only the current employee incentive row for Store Me", async () => {
    const { readModelService, service } = createService();
    const result = await service.getOwnStoreMeProjection({
      actor: buildAuthenticatedUser({
        userId: "user-1",
        employeeId,
        roleCodes: ["STORE_PERSONNEL"],
        readScope: { companyIds: [companyId], regionIds: [regionId], storeIds: [storeId] },
      }),
      periodKey: "2026-05",
    });

    expect(readModelService.buildCurrentProjection).toHaveBeenCalledWith({
      periodKey: "2026-05",
      companyIds: [companyId],
      regionIds: [],
      storeIds: [storeId],
    });
    expect(result.data.roleScope).toBe("own");
    expect(result.data.projections).toHaveLength(1);
    expect(result.data.projections[0].rows).toEqual([
      expect.objectContaining({
        employeeId,
        participantType: "personnel",
        actualPositiveSales: "240000.0000",
        payableAmount: "3960.00",
      }),
    ]);
  });

  it("keeps cashier or otherwise ineligible personnel invisible behind a generic 404", async () => {
    const { service } = createService({
      ...eligibleProjection,
      stores: [{ ...eligibleProjection.stores[0], personnel: [] }],
    });

    await expect(
      service.getOwnStoreMeProjection({
        actor: buildAuthenticatedUser({
          userId: "cashier-user",
          employeeId: "cashier-employee",
          roleCodes: ["STORE_PERSONNEL"],
          readScope: { companyIds: [companyId], regionIds: [regionId], storeIds: [storeId] },
        }),
        periodKey: "2026-05",
      }),
    ).rejects.toThrow(NotFoundException);

    await expect(
      service.getOwnStoreMeProjection({
        actor: buildAuthenticatedUser({
          userId: "cashier-user",
          employeeId: "cashier-employee",
          roleCodes: ["STORE_PERSONNEL"],
          readScope: { companyIds: [companyId], regionIds: [regionId], storeIds: [storeId] },
        }),
        periodKey: "2026-05",
      }),
    ).rejects.not.toThrow(/240000|3960|cashier/i);
  });

  it("does not expose franchise or operator rows when read model returns no company-store projection", async () => {
    const { service } = createService({ ...eligibleProjection, stores: [] });

    await expect(
      service.getOwnStoreMeProjection({
        actor: buildAuthenticatedUser({
          userId: "operator-user",
          employeeId,
          roleCodes: ["STORE_PERSONNEL"],
          readScope: { companyIds: [companyId], regionIds: [regionId], storeIds: [storeId] },
        }),
        periodKey: "2026-05",
      }),
    ).rejects.toThrow("Incentive projection is not available");
  });

  it("limits store manager reads to assigned stores", async () => {
    const { readModelService, service } = createService();

    await service.getStoreProjection({
      actor: buildAuthenticatedUser({
        userId: "manager-user",
        employeeId: "manager-employee",
        roleCodes: ["STORE_MANAGER"],
        readScope: { companyIds: [companyId], regionIds: [regionId], storeIds: [otherStoreId] },
        actionScope: { assignedStoreIds: [storeId] },
      }),
      periodKey: "2026-05",
    });

    expect(readModelService.buildCurrentProjection).toHaveBeenCalledWith({
      periodKey: "2026-05",
      companyIds: [],
      regionIds: [],
      storeIds: [storeId],
    });
  });

  it("limits region manager reads to assigned stores instead of broad region scope", async () => {
    const { readModelService, service } = createService();

    await service.getStoreProjection({
      actor: buildAuthenticatedUser({
        userId: "region-user",
        roleCodes: ["REGION_MANAGER"],
        readScope: { companyIds: [companyId], regionIds: [regionId], storeIds: [otherStoreId] },
        actionScope: { assignedStoreIds: [storeId] },
      }),
      periodKey: "2026-05",
    });

    expect(readModelService.buildCurrentProjection).toHaveBeenCalledWith({
      periodKey: "2026-05",
      companyIds: [],
      regionIds: [],
      storeIds: [storeId],
    });
  });

  it("allows super admin reads across company scope and only as company-store projections", async () => {
    const { readModelService, service } = createService();
    const result = await service.getAdminProjection({
      actor: buildAuthenticatedUser({
        userId: "admin-user",
        roleCodes: ["SUPER_ADMIN"],
        readScope: { companyIds: [companyId], regionIds: [], storeIds: [] },
      }),
      periodKey: "2026-05",
    });

    expect(readModelService.buildCurrentProjection).toHaveBeenCalledWith({
      periodKey: "2026-05",
      companyIds: [companyId],
      regionIds: [],
      storeIds: [],
      allowGlobalScope: false,
    });
    expect(result.data.roleScope).toBe("admin");
    expect(result.data.projections[0].storeOwnershipType).toBe("company");
  });
});
