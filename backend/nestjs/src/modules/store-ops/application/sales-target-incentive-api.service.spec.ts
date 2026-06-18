import { NotFoundException } from "@nestjs/common";
import { buildAuthenticatedUser } from "../../auth/auth-context.service";
import type {
  SalesTargetIncentiveAdjustmentSummaryRow,
  SalesTargetIncentiveCorrectionResult,
} from "../infrastructure/sales-target-incentive-correction.repository";
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
  const correctionRepository = {
    applyAdminCorrection: jest.fn(async () => ({
      adjustmentId: "00000000-0000-4000-8000-000000000801",
      phase: "pre_close",
      adjustmentScope: "projection",
      adjustmentType: "correction",
      periodKey: "2026-05",
      storeId,
      employeeId,
      participantType: "personnel",
      beforeAmount: "3960.00",
      adjustmentAmount: "125.25",
      afterAmount: "4085.25",
      status: "approved",
    })),
    applyAdminFinalRowCorrection: jest.fn(
      async (): Promise<SalesTargetIncentiveCorrectionResult | null> => null,
    ),
    listApprovedAdjustmentSummaries: jest.fn(
      async (): Promise<SalesTargetIncentiveAdjustmentSummaryRow[]> => [],
    ),
  };
  const service = new SalesTargetIncentiveApiService(
    readModelService as never,
    correctionRepository as never,
  );

  return { correctionRepository, readModelService, service };
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
    const { correctionRepository, readModelService, service } = createService();
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
    expect(correctionRepository.listApprovedAdjustmentSummaries).toHaveBeenCalledWith({
      periodKey: "2026-05",
      storeIds: [storeId],
    });
  });

  it("limits admin reads to the actor's SUPER_ADMIN role scope when mixed roles widen read scope", async () => {
    const { readModelService, service } = createService();

    await service.getAdminProjection({
      actor: buildAuthenticatedUser({
        userId: "mixed-admin-user",
        roleCodes: ["SUPER_ADMIN", "REGION_MANAGER"],
        readScope: {
          companyIds: [companyId, "00000000-0000-4000-8000-000000000099"],
          regionIds: [regionId, "00000000-0000-4000-8000-000000000199"],
          storeIds: [storeId, otherStoreId],
        },
        roleScopes: {
          SUPER_ADMIN: {
            companyIds: [companyId],
            regionIds: [],
            storeIds: [],
          },
          REGION_MANAGER: {
            companyIds: ["00000000-0000-4000-8000-000000000099"],
            regionIds: ["00000000-0000-4000-8000-000000000199"],
            storeIds: [otherStoreId],
          },
        },
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
  });

  it("overlays approved admin projection corrections without mutating calculated payable amount", async () => {
    const { correctionRepository, service } = createService();
    correctionRepository.listApprovedAdjustmentSummaries.mockResolvedValueOnce([
      {
        store_id: storeId,
        employee_id: employeeId,
        participant_type: "personnel",
        correction_amount: "125.25",
        adjustment_amount: "0",
        final_amount: null,
      },
    ]);

    const result = await service.getAdminProjection({
      actor: buildAuthenticatedUser({
        userId: "admin-user",
        roleCodes: ["SUPER_ADMIN"],
        readScope: { companyIds: [companyId], regionIds: [], storeIds: [] },
      }),
      periodKey: "2026-05",
    });

    const row = result.data.projections[0].rows.find((candidate) => candidate.employeeId === employeeId);
    expect(row).toMatchObject({
      payableAmount: "3960.00",
      correctionAmount: "125.25",
      adjustmentAmount: null,
      finalAmount: "4085.25",
      status: "corrected",
    });
  });

  it("overlays approved corrections on Store Me reads for visible personnel", async () => {
    const { correctionRepository, service } = createService();
    correctionRepository.listApprovedAdjustmentSummaries.mockResolvedValueOnce([
      {
        store_id: storeId,
        employee_id: employeeId,
        participant_type: "personnel",
        correction_amount: "125.25",
        adjustment_amount: "0",
        final_amount: null,
      },
    ]);

    const result = await service.getOwnStoreMeProjection({
      actor: buildAuthenticatedUser({
        userId: "personnel-user",
        employeeId,
        roleCodes: ["STORE_PERSONNEL"],
        readScope: { companyIds: [companyId], regionIds: [regionId], storeIds: [storeId] },
      }),
      periodKey: "2026-05",
    });

    expect(correctionRepository.listApprovedAdjustmentSummaries).toHaveBeenCalledWith({
      periodKey: "2026-05",
      storeIds: [storeId],
    });
    expect(result.data.projections[0].rows[0]).toMatchObject({
      payableAmount: "3960.00",
      correctionAmount: "125.25",
      finalAmount: "4085.25",
      status: "corrected",
    });
  });

  it("applies admin corrections only for eligible visible incentive rows", async () => {
    const { correctionRepository, readModelService, service } = createService();
    const actor = buildAuthenticatedUser({
      userId: "admin-user",
      roleCodes: ["SUPER_ADMIN"],
      readScope: { companyIds: [companyId], regionIds: [], storeIds: [] },
    });

    const result = await service.applyAdminCorrection({
      actor,
      periodKey: "2026-05",
      storeId,
      employeeId,
      participantType: "personnel",
      adjustmentAmount: "125.25",
      reasonCode: "manual_review",
      reasonNote: "Admin onayli duzeltme",
    });

    expect(readModelService.buildCurrentProjection).toHaveBeenCalledWith({
      periodKey: "2026-05",
      companyIds: [companyId],
      regionIds: [],
      storeIds: [],
      allowGlobalScope: false,
    });
    expect(correctionRepository.applyAdminCorrection).toHaveBeenCalledWith(
      expect.objectContaining({
        periodKey: "2026-05",
        store: expect.objectContaining({ storeId }),
        participant: expect.objectContaining({ employeeId }),
        adjustmentAmount: "125.25",
        reasonCode: "manual_review",
        reasonNote: "Admin onayli duzeltme",
        actorUserId: "admin-user",
      }),
    );
    expect(correctionRepository.applyAdminFinalRowCorrection).not.toHaveBeenCalled();
    expect(result.data.afterAmount).toBe("4085.25");
  });

  it("allows post-close final-row corrections when the current projection is no longer payable", async () => {
    const blockedProjection = {
      ...eligibleProjection,
      stores: [
        {
          ...eligibleProjection.stores[0],
          personnel: [
            {
              ...eligibleProjection.stores[0].personnel[0],
              calculation: {
                ...eligibleProjection.stores[0].personnel[0].calculation,
                status: "blocked",
                payableAmount: null,
                blockedReason: "current source is incomplete",
              },
            },
          ],
        },
      ],
    } as unknown as typeof eligibleProjection;
    const { correctionRepository, service } = createService(blockedProjection);
    correctionRepository.applyAdminFinalRowCorrection.mockResolvedValueOnce({
      adjustmentId: "00000000-0000-4000-8000-000000000802",
      phase: "post_close",
      adjustmentScope: "final_snapshot",
      adjustmentType: "manual_adjustment",
      periodKey: "2026-05",
      storeId,
      employeeId,
      participantType: "personnel",
      beforeAmount: "4085.25",
      adjustmentAmount: "-50.00",
      afterAmount: "4035.25",
      status: "approved",
    });

    const result = await service.applyAdminCorrection({
      actor: buildAuthenticatedUser({
        userId: "admin-user",
        roleCodes: ["SUPER_ADMIN"],
        readScope: { companyIds: [companyId], regionIds: [], storeIds: [] },
      }),
      periodKey: "2026-05",
      storeId,
      employeeId,
      participantType: "personnel",
      adjustmentAmount: "-50.00",
      reasonCode: "post_close_review",
      reasonNote: "Kapanis sonrasi duzeltme",
    });

    expect(correctionRepository.applyAdminCorrection).not.toHaveBeenCalled();
    expect(correctionRepository.applyAdminFinalRowCorrection).toHaveBeenCalledWith({
      periodKey: "2026-05",
      storeId,
      employeeId,
      participantType: "personnel",
      adjustmentAmount: "-50.00",
      reasonCode: "post_close_review",
      reasonNote: "Kapanis sonrasi duzeltme",
      actorUserId: "admin-user",
      readScope: {
        companyIds: [companyId],
        regionIds: [],
        storeIds: [],
        allowGlobalScope: false,
      },
    });
    expect(result.data).toMatchObject({
      phase: "post_close",
      afterAmount: "4035.25",
    });
  });

  it("rejects admin corrections for hidden or unavailable incentive rows", async () => {
    const { correctionRepository, service } = createService({
      ...eligibleProjection,
      stores: [],
    });

    await expect(
      service.applyAdminCorrection({
        actor: buildAuthenticatedUser({
          userId: "admin-user",
          roleCodes: ["SUPER_ADMIN"],
          readScope: { companyIds: [companyId], regionIds: [], storeIds: [] },
        }),
        periodKey: "2026-05",
        storeId,
        employeeId,
        participantType: "personnel",
        adjustmentAmount: "125.25",
        reasonCode: "manual_review",
        reasonNote: "Admin onayli duzeltme",
      }),
    ).rejects.toThrow("Incentive projection is not available");

    await expect(
      service.applyAdminCorrection({
        actor: buildAuthenticatedUser({
          userId: "admin-user",
          roleCodes: ["SUPER_ADMIN"],
          readScope: { companyIds: [companyId], regionIds: [], storeIds: [] },
        }),
        periodKey: "2026-05",
        storeId,
        employeeId,
        participantType: "personnel",
        adjustmentAmount: "125.25",
        reasonCode: "manual_review",
        reasonNote: "Admin onayli duzeltme",
      }),
    ).rejects.not.toThrow(/Ali|240000|3960|125\.25/i);

    expect(correctionRepository.applyAdminCorrection).not.toHaveBeenCalled();
  });

  it("rejects zero admin corrections before persistence", async () => {
    const { correctionRepository, service } = createService();

    await expect(
      service.applyAdminCorrection({
        actor: buildAuthenticatedUser({
          userId: "admin-user",
          roleCodes: ["SUPER_ADMIN"],
          readScope: { companyIds: [companyId], regionIds: [], storeIds: [] },
        }),
        periodKey: "2026-05",
        storeId,
        employeeId,
        participantType: "personnel",
        adjustmentAmount: "0.00",
        reasonCode: "manual_review",
        reasonNote: "Admin onayli duzeltme",
      }),
    ).rejects.toThrow("Correction amount must not be zero");

    expect(correctionRepository.applyAdminCorrection).not.toHaveBeenCalled();
  });
});
