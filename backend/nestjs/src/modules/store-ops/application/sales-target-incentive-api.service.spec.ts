import { NotFoundException } from "@nestjs/common";
import { buildAuthenticatedUser } from "../../auth/auth-context.service";
import {
  SalesTargetIncentiveClosedPeriodTargetError,
  type SalesTargetIncentiveAdjustmentSummaryRow,
  type SalesTargetIncentiveCorrectionResult,
} from "../infrastructure/sales-target-incentive-correction.repository";
import { SalesTargetIncentiveApiService } from "./sales-target-incentive-api.service";
import type { SalesTargetIncentiveProjectionReadModel } from "./sales-target-incentive-read-model.service";

const companyId = "00000000-0000-4000-8000-000000000001";
const regionId = "00000000-0000-4000-8000-000000000101";
const storeId = "00000000-0000-4000-8000-000000000201";
const otherStoreId = "00000000-0000-4000-8000-000000000202";
const employeeId = "00000000-0000-4000-8000-000000000501";
const finalOnlyEmployeeId = "00000000-0000-4000-8000-000000000599";
const correctionId = "00000000-0000-4000-8000-000000000951";
const createAdminActor = () => buildAuthenticatedUser({
  userId: "admin-user",
  roleCodes: ["SUPER_ADMIN"],
  readScope: { companyIds: [companyId], regionIds: [], storeIds: [] },
});

const eligibleProjection: SalesTargetIncentiveProjectionReadModel = {
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
      storeNetSalesImportBatchId: "00000000-0000-4000-8000-000000000901",
      storeNetSalesLastSyncedAt: "2026-05-31T21:00:00.000Z",
      manager: {
        participantType: "store_manager",
        employeeId: "00000000-0000-4000-8000-000000000401",
        userId: "00000000-0000-4000-8000-000000000601",
        assignmentId: "00000000-0000-4000-8000-000000000701",
        assignmentStartedOn: "2026-05-01",
        assignmentEndedOn: null,
        positionId: "00000000-0000-4000-8000-000000000801",
        displayName: "Ada Yilmaz",
        positionCode: "STORE_MANAGER",
        normalizedFromPositionCode: null,
        targetReferenceId: null,
        targetAmount: "1000000.0000",
        actualAmount: "1150000.0000",
        source: {
          storeTargetRequestId: "target-request-1",
          storeNetSalesSourceBatchId: "batch-store-1",
          storeNetSalesImportBatchId: "00000000-0000-4000-8000-000000000901",
          personnelSalesSourceBatchId: null,
          personnelSalesImportBatchId: null,
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
          userId: "00000000-0000-4000-8000-000000000602",
          assignmentId: "00000000-0000-4000-8000-000000000702",
          assignmentStartedOn: "2026-05-01",
          assignmentEndedOn: null,
          positionId: "00000000-0000-4000-8000-000000000802",
          displayName: "Ali Can",
          positionCode: "SALES_ASSOCIATE",
          normalizedFromPositionCode: null,
          targetReferenceId: "target-ref-1",
          targetAmount: "200000.0000",
          actualAmount: "240000.0000",
          source: {
            storeTargetRequestId: "target-request-1",
            storeNetSalesSourceBatchId: "batch-store-1",
            storeNetSalesImportBatchId: "00000000-0000-4000-8000-000000000901",
            personnelSalesSourceBatchId: "batch-personnel-1",
            personnelSalesImportBatchId: "00000000-0000-4000-8000-000000000902",
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

function createService(projection: SalesTargetIncentiveProjectionReadModel = eligibleProjection) {
  const readModelService = {
    buildCurrentProjection: jest.fn(async () => projection),
    getCloseReadiness: jest.fn(async (): Promise<unknown> => ({
      periodKey: "2026-05",
      periodStart: "2026-05-01",
      periodEnd: "2026-05-31",
      canClose: true,
      status: "ready",
      blockingImports: [],
      blockingTargetRevisions: [],
    })),
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
  const closeRepository = {
    listCloseRuns: jest.fn(async (): Promise<unknown[]> => []),
    createSucceededCloseRun: jest.fn(async (): Promise<unknown> => ({
      closeRunId: "00000000-0000-4000-8000-000000000901",
      companyId,
      periodKey: "2026-05",
      periodStart: "2026-05-01",
      periodEnd: "2026-05-31",
      closeCutoffAt: "2026-06-01T02:00:00.000+03:00",
      status: "succeeded",
      startedAt: "2026-06-01T02:00:00.000+03:00",
      completedAt: "2026-06-01T02:00:01.000+03:00",
      failedReason: null,
      sourceImportBatchIds: [],
      finalSnapshotCount: 1,
      finalRowCount: 2,
    })),
  };
  const regionWorkflowService = {
    getWorkflowContext: jest.fn(async (): Promise<unknown> => ({
      regionWorkflow: null,
      reviewsByStoreId: new Map(),
      correctionsByRowKey: new Map(),
    })),
    markStoreReview: jest.fn(async () => ({ data: { reviewStatus: "reviewed" } })),
    createRegionCorrection: jest.fn(async () => ({ data: { correctionId } })),
    voidRegionCorrection: jest.fn(async () => ({ data: { correctionId, status: "voided" } })),
    submitRegionPackage: jest.fn(async () => ({ data: { regionPackageStatus: "submitted" } })),
  };
  const adminPackageWorkflowService = {
    listRegionPackages: jest.fn(async (): Promise<unknown[]> => []),
    reviewRegionPackage: jest.fn(async () => ({ data: { status: "admin_approved" } })),
  };
  const service = new SalesTargetIncentiveApiService(
    readModelService as never,
    correctionRepository as never,
    closeRepository as never,
    regionWorkflowService as never,
    adminPackageWorkflowService as never,
  );

  return {
    adminPackageWorkflowService,
    closeRepository,
    correctionRepository,
    readModelService,
    regionWorkflowService,
    service,
  };
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
        roleScopes: { REGION_MANAGER: { companyIds: [], regionIds: [], storeIds: [storeId] } },
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

  it("adds Region Manager workflow state without exposing it as store-period state", async () => {
    const { correctionRepository, regionWorkflowService, service } = createService();
    regionWorkflowService.getWorkflowContext.mockResolvedValueOnce({
      regionWorkflow: {
        regionId,
        regionPackageStatus: "not_submitted",
        regionPackageId: null,
        submittedAt: null,
        reviewedAt: null,
        workflowLockedReason: null,
      },
      reviewsByStoreId: new Map([
        [
          storeId,
          {
            storeReviewStatus: "reviewed",
            reviewedByUserId: "region-user",
            reviewedAt: "2026-06-01T08:00:00.000Z",
            periodCloseStatus: "closed",
            workflowLockedReason: null,
          },
        ],
      ]),
      correctionsByRowKey: new Map([
        [
          `${storeId}:${employeeId}:personnel`,
          {
            correctionId,
            status: "draft",
            targetScope: "final_snapshot",
            beforeAmount: "3960.00",
            adjustmentAmount: "40.00",
            finalAmount: "4000.00",
            reasonNote: "Bolge kontrol duzeltmesi",
            createdByUserId: "region-user",
            createdAt: "2026-06-01T08:05:00.000Z",
            submittedAt: null,
            reviewedAt: null,
            reviewNote: null,
          },
        ],
      ]),
    });

    const result = await service.getStoreProjection({
      actor: buildAuthenticatedUser({
        userId: "region-user",
        roleCodes: ["REGION_MANAGER"],
        readScope: { companyIds: [companyId], regionIds: [regionId], storeIds: [otherStoreId] },
        actionScope: { assignedStoreIds: [storeId] },
        roleScopes: { REGION_MANAGER: { companyIds: [], regionIds: [], storeIds: [storeId] } },
      }),
      periodKey: "2026-05",
    });

    expect(correctionRepository.listApprovedAdjustmentSummaries).toHaveBeenCalledWith({
      periodKey: "2026-05",
      storeIds: [storeId],
      includeFinalRows: true,
    });
    expect(regionWorkflowService.getWorkflowContext).toHaveBeenCalledWith({
      periodKey: "2026-05",
      stores: eligibleProjection.stores,
      roleScope: "region",
      managerUserId: "region-user",
    });
    expect(result.data.regionWorkflow).toEqual(
      expect.objectContaining({ regionPackageStatus: "not_submitted" }),
    );
    expect(result.data.projections[0].review).toEqual(
      expect.objectContaining({ storeReviewStatus: "reviewed", periodCloseStatus: "closed" }),
    );
    expect(result.data.projections[0].rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          employeeId,
          regionCorrection: expect.objectContaining({
            correctionId,
            finalAmount: "4000.00",
          }),
        }),
      ]),
    );
  });

  it("allows super admin reads across company scope and only as company-store projections", async () => {
    const {
      adminPackageWorkflowService,
      correctionRepository,
      readModelService,
      service,
    } = createService();
    const result = await service.getAdminProjection({
      actor: createAdminActor(),
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
    expect(result.data.regionPackages).toEqual([]);
    expect(adminPackageWorkflowService.listRegionPackages).toHaveBeenCalledWith({
      actor: expect.objectContaining({ userId: "admin-user" }),
      periodKey: "2026-05",
    });
    expect(correctionRepository.listApprovedAdjustmentSummaries).toHaveBeenCalledWith({
      periodKey: "2026-05",
      storeIds: [storeId],
      includeFinalRows: true,
    });
  });

  it("returns admin close readiness and close-run history for a company scope", async () => {
    const { closeRepository, readModelService, service } = createService();
    closeRepository.listCloseRuns.mockResolvedValueOnce([
      {
        closeRunId: "00000000-0000-4000-8000-000000000901",
        companyId,
        periodKey: "2026-05",
        periodStart: "2026-05-01",
        periodEnd: "2026-05-31",
        closeCutoffAt: "2026-06-01T02:00:00.000+03:00",
        status: "succeeded",
        startedAt: "2026-06-01T02:00:00.000+03:00",
        completedAt: "2026-06-01T02:00:01.000+03:00",
        failedReason: null,
        sourceImportBatchIds: [],
        finalSnapshotCount: 1,
        finalRowCount: 2,
      },
    ]);

    const result = await service.getAdminCloseStatus({
      actor: createAdminActor(),
      periodKey: "2026-05",
      closeCutoffAt: "2026-06-01T02:00:00.000+03:00",
    });

    expect(readModelService.getCloseReadiness).toHaveBeenCalledWith({
      periodKey: "2026-05",
      companyIds: [companyId],
      nowIso: expect.any(String),
      closeCutoffAt: "2026-06-01T02:00:00.000+03:00",
    });
    expect(closeRepository.listCloseRuns).toHaveBeenCalledWith({
      periodKey: "2026-05",
      companyIds: [companyId],
    });
    expect(result.data).toMatchObject({
      period: "2026-05",
      closeCutoffAt: "2026-06-01T02:00:00.000+03:00",
      readiness: expect.objectContaining({ status: "ready" }),
      closeRuns: [expect.objectContaining({ status: "succeeded" })],
    });
  });

  it("runs admin close only after readiness passes and freezes period-end assignments", async () => {
    const { closeRepository, readModelService, service } = createService();

    const result = await service.runAdminClose({
      actor: buildAuthenticatedUser({
        userId: "00000000-0000-4000-8000-000000000901",
        roleCodes: ["SUPER_ADMIN"],
        readScope: { companyIds: [companyId], regionIds: [], storeIds: [] },
      }),
      periodKey: "2026-05",
      closeCutoffAt: "2026-06-01T02:00:00.000+03:00",
    });

    expect(readModelService.getCloseReadiness).toHaveBeenCalledWith({
      periodKey: "2026-05",
      companyIds: [companyId],
      nowIso: expect.any(String),
      closeCutoffAt: "2026-06-01T02:00:00.000+03:00",
    });
    expect(readModelService.buildCurrentProjection).toHaveBeenCalledWith({
      periodKey: "2026-05",
      companyIds: [companyId],
      regionIds: [],
      storeIds: [],
      assignmentAsOfDate: "2026-05-31",
      closeCutoffAt: "2026-06-01T02:00:00.000+03:00",
    });
    expect(closeRepository.createSucceededCloseRun).toHaveBeenCalledWith({
      companyId,
      periodKey: "2026-05",
      periodStart: "2026-05-01",
      periodEnd: "2026-05-31",
      closeCutoffAt: "2026-06-01T02:00:00.000+03:00",
      actorUserId: "00000000-0000-4000-8000-000000000901",
      sourceType: "admin_period_close",
      stores: eligibleProjection.stores,
    });
    expect(result.data).toMatchObject({
      finalSnapshotCount: 1,
      finalRowCount: 2,
    });
  });

  it("closes an eligible company automatically with a system source", async () => {
    const { closeRepository, readModelService, service } = createService();
    const result = await service.runAutomaticClose({ periodKey: "2026-05", companyId });
    expect(result).toEqual({ closed: true, status: "closed" });
    expect(readModelService.getCloseReadiness).toHaveBeenCalledWith(expect.objectContaining({ salesSource: "daily" }));
    expect(readModelService.buildCurrentProjection).toHaveBeenCalledWith(expect.objectContaining({ salesSource: "daily" }));
    expect(closeRepository.createSucceededCloseRun).toHaveBeenCalledWith(expect.objectContaining({
      companyId, periodKey: "2026-05", actorUserId: null,
      sourceType: "automatic_period_close", stores: eligibleProjection.stores,
    }));
  });

  it("does not write an automatic close when readiness is blocked", async () => {
    const { closeRepository, readModelService, service } = createService();
    readModelService.getCloseReadiness.mockResolvedValueOnce({
      periodKey: "2026-05", periodStart: "2026-05-01", periodEnd: "2026-05-31",
      canClose: false, status: "blocked_by_imports",
      blockingImports: [], blockingTargetRevisions: [],
    });
    await expect(service.runAutomaticClose({ periodKey: "2026-05", companyId })).resolves.toEqual({
      closed: false, status: "blocked_by_imports",
    });
    expect(closeRepository.createSucceededCloseRun).not.toHaveBeenCalled();
  });

  it("blocks admin close before final snapshot persistence when readiness is not ready", async () => {
    const { closeRepository, readModelService, service } = createService();
    readModelService.getCloseReadiness.mockResolvedValueOnce({
      periodKey: "2026-05",
      periodStart: "2026-05-01",
      periodEnd: "2026-05-31",
      canClose: false,
      status: "blocked_by_imports",
      blockingImports: [{ import_batch_id: "batch-1" }],
      blockingTargetRevisions: [],
    });

    await expect(
      service.runAdminClose({
        actor: createAdminActor(),
        periodKey: "2026-05",
        closeCutoffAt: "2026-06-01T02:00:00.000+03:00",
      }),
    ).rejects.toThrow("Incentive close is blocked_by_imports");

    expect(readModelService.buildCurrentProjection).not.toHaveBeenCalled();
    expect(closeRepository.createSucceededCloseRun).not.toHaveBeenCalled();
  });

  it("does not let a future cutoff make an unfinished month eligible", async () => {
    const { closeRepository, readModelService, service } = createService();
    await expect(service.runAdminClose({
      actor: createAdminActor(),
      periodKey: "2099-12", closeCutoffAt: "2100-01-01T02:00:00.000+03:00",
    })).rejects.toThrow("Incentive close cutoff cannot be in the future");
    expect(readModelService.getCloseReadiness).not.toHaveBeenCalled();
    expect(closeRepository.createSucceededCloseRun).not.toHaveBeenCalled();
  });

  it("requires company scope for admin close because close runs are company-scoped", async () => {
    const { closeRepository, readModelService, service } = createService();

    await expect(
      service.getAdminCloseStatus({
        actor: buildAuthenticatedUser({
          userId: "admin-user",
          roleCodes: ["SUPER_ADMIN"],
          readScope: { companyIds: [], regionIds: [regionId], storeIds: [] },
        }),
        periodKey: "2026-05",
      }),
    ).rejects.toThrow("Incentive close requires company scope");

    expect(readModelService.getCloseReadiness).not.toHaveBeenCalled();
    expect(closeRepository.listCloseRuns).not.toHaveBeenCalled();
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
      actor: createAdminActor(),
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

  it("does not turn non-payable current rows into payable rows through old corrections", async () => {
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
      actor: createAdminActor(),
      periodKey: "2026-05",
    });

    const row = result.data.projections[0].rows.find((candidate) => candidate.employeeId === employeeId);
    expect(row).toMatchObject({
      correctionAmount: "125.25",
      finalAmount: null,
      payableAmount: null,
      status: "blocked",
      blockedReason: "current source is incomplete",
    });
  });

  it("includes admin-visible final snapshot adjustment rows that are absent from the current projection", async () => {
    const { correctionRepository, service } = createService();
    correctionRepository.listApprovedAdjustmentSummaries.mockResolvedValueOnce([
      {
        store_id: storeId,
        employee_id: finalOnlyEmployeeId,
        participant_type: "personnel",
        employee_display_name: "Zeynep Kaya",
        position_code: "SALES_ASSOCIATE",
        normalized_from_position_code: null,
        rate_table_version: "personnel-sales-target-v1.0.0",
        target_amount: "200000.0000",
        actual_sales_amount: "240000.0000",
        achievement_pct: "120.0000",
        applied_rate: "0.0165",
        raw_earned_amount: "3960.0000000000",
        payable_amount: "3960.00",
        calculation_status: "finalized",
        correction_amount: "0",
        adjustment_amount: "-50.00",
        final_amount: "3960.00",
      },
    ]);

    const result = await service.getAdminProjection({
      actor: createAdminActor(),
      periodKey: "2026-05",
    });

    expect(result.data.projections[0].rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          employeeId: finalOnlyEmployeeId,
          displayName: "Zeynep Kaya",
          adjustmentAmount: "-50.00",
          finalAmount: "3910.00",
          status: "adjusted",
        }),
      ]),
    );
  });

  it("includes admin-visible unadjusted final snapshot rows for first post-close corrections", async () => {
    const { correctionRepository, service } = createService();
    correctionRepository.listApprovedAdjustmentSummaries.mockResolvedValueOnce([
      {
        store_id: storeId,
        employee_id: finalOnlyEmployeeId,
        participant_type: "personnel",
        employee_display_name: "Zeynep Kaya",
        position_code: "SALES_ASSOCIATE",
        normalized_from_position_code: null,
        rate_table_version: "personnel-sales-target-v1.0.0",
        target_amount: "200000.0000",
        actual_sales_amount: "240000.0000",
        achievement_pct: "120.0000",
        applied_rate: "0.0165",
        raw_earned_amount: "3960.0000000000",
        payable_amount: "3960.00",
        calculation_status: "finalized",
        correction_amount: "0",
        adjustment_amount: "0",
        final_amount: "3960.00",
      },
    ]);

    const result = await service.getAdminProjection({
      actor: createAdminActor(),
      periodKey: "2026-05",
    });

    expect(result.data.projections[0].rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          employeeId: finalOnlyEmployeeId,
          displayName: "Zeynep Kaya",
          adjustmentAmount: null,
          finalAmount: "3960.00",
          status: "projected",
        }),
      ]),
    );
  });

  it("keeps frozen final amounts when final rows also carry projection corrections", async () => {
    const { correctionRepository, service } = createService();
    correctionRepository.listApprovedAdjustmentSummaries.mockResolvedValueOnce([
      {
        store_id: storeId,
        employee_id: finalOnlyEmployeeId,
        participant_type: "personnel",
        employee_display_name: "Zeynep Kaya",
        position_code: "SALES_ASSOCIATE",
        normalized_from_position_code: null,
        rate_table_version: "personnel-sales-target-v1.0.0",
        target_amount: "200000.0000",
        actual_sales_amount: "240000.0000",
        achievement_pct: "120.0000",
        applied_rate: "0.0165",
        raw_earned_amount: "3960.0000000000",
        payable_amount: "3960.00",
        calculation_status: "finalized",
        correction_amount: "125.25",
        adjustment_amount: "0",
        final_amount: "4100.00",
      },
    ]);

    const result = await service.getAdminProjection({
      actor: createAdminActor(),
      periodKey: "2026-05",
    });

    expect(result.data.projections[0].rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          employeeId: finalOnlyEmployeeId,
          correctionAmount: "125.25",
          finalAmount: "4100.00",
          status: "corrected",
        }),
      ]),
    );
  });

  it("uses final snapshot values for visible current rows when a final amount exists", async () => {
    const blockedCurrentProjection: SalesTargetIncentiveProjectionReadModel = {
      ...eligibleProjection,
      stores: [
        {
          ...eligibleProjection.stores[0],
          personnel: [
            {
              ...eligibleProjection.stores[0].personnel[0],
              calculation: {
                ...eligibleProjection.stores[0].personnel[0].calculation,
                status: "blocked" as const,
                blockedReason: "missing_store_sales_source" as const,
                payableAmount: null,
              },
            },
          ],
        },
      ],
    };
    const { correctionRepository, service } = createService(blockedCurrentProjection);
    correctionRepository.listApprovedAdjustmentSummaries.mockResolvedValueOnce([
      {
        store_id: storeId,
        employee_id: employeeId,
        participant_type: "personnel",
        employee_display_name: "Ali Can",
        position_code: "SALES_ASSOCIATE",
        normalized_from_position_code: null,
        rate_table_version: "personnel-sales-target-v1.0.0",
        target_amount: "210000.0000",
        actual_sales_amount: "230000.0000",
        achievement_pct: "109.5238",
        applied_rate: "0.0150",
        raw_earned_amount: "3450.0000000000",
        payable_amount: "3450.00",
        calculation_status: "finalized",
        correction_amount: "0",
        adjustment_amount: "0",
        final_amount: "3450.00",
      },
    ]);

    const result = await service.getAdminProjection({
      actor: createAdminActor(),
      periodKey: "2026-05",
    });

    const row = result.data.projections[0].rows.find((candidate) => candidate.employeeId === employeeId);
    expect(row).toMatchObject({
      target: "210000.0000",
      actualPositiveSales: "230000.0000",
      achievementPct: "109.5238",
      rate: "0.0150",
      rawEarnedAmount: "3450.0000000000",
      payableAmount: "3450.00",
      finalAmount: "3450.00",
      status: "projected",
      blockedReason: null,
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
      includeFinalRows: false,
    });
    expect(result.data.projections[0].rows[0]).toMatchObject({
      payableAmount: "3960.00",
      correctionAmount: "125.25",
      finalAmount: "4085.25",
      status: "corrected",
    });
  });

  it("does not add final snapshot-only rows to Store Me reads", async () => {
    const { correctionRepository, service } = createService();
    correctionRepository.listApprovedAdjustmentSummaries.mockResolvedValueOnce([
      {
        store_id: storeId,
        employee_id: finalOnlyEmployeeId,
        participant_type: "personnel",
        employee_display_name: "Zeynep Kaya",
        position_code: "SALES_ASSOCIATE",
        normalized_from_position_code: null,
        rate_table_version: "personnel-sales-target-v1.0.0",
        target_amount: "200000.0000",
        actual_sales_amount: "240000.0000",
        achievement_pct: "120.0000",
        applied_rate: "0.0165",
        raw_earned_amount: "3960.0000000000",
        payable_amount: "3960.00",
        calculation_status: "finalized",
        correction_amount: "0",
        adjustment_amount: "-50.00",
        final_amount: "3960.00",
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

    expect(result.data.projections[0].rows).toHaveLength(1);
    expect(result.data.projections[0].rows[0].employeeId).toBe(employeeId);
  });

  it("applies admin corrections only for eligible visible incentive rows", async () => {
    const { correctionRepository, readModelService, service } = createService();
    const actor = createAdminActor();

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
        readScope: {
          companyIds: [companyId],
          regionIds: [],
          storeIds: [],
          allowGlobalScope: false,
        },
      }),
    );
    expect(correctionRepository.applyAdminFinalRowCorrection).not.toHaveBeenCalled();
    expect(result.data.afterAmount).toBe("4085.25");
  });

  it("maps closed-period projection correction targets to a safe bad request", async () => {
    const { correctionRepository, service } = createService();
    correctionRepository.applyAdminCorrection.mockRejectedValueOnce(
      new SalesTargetIncentiveClosedPeriodTargetError(),
    );

    await expect(
      service.applyAdminCorrection({
        actor: createAdminActor(),
        periodKey: "2026-05",
        storeId,
        employeeId,
        participantType: "personnel",
        adjustmentAmount: "125.25",
        reasonCode: "manual_review",
        reasonNote: "Admin onayli duzeltme",
      }),
    ).rejects.toThrow("Correction target is closed for this period");
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
      actor: createAdminActor(),
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
        actor: createAdminActor(),
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
        actor: createAdminActor(),
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
        actor: createAdminActor(),
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
