import { ForbiddenException } from "@nestjs/common";
import { SalesTargetIncentiveWorkspaceReadService } from "./sales-target-incentive-workspace-read.service";

// Traceability: INC-FR-001..004/009, NFR-005..007, AC-INC-005..008, EC-001/002/012/013/014/017/022.

function harness() {
  const readModel = { buildCurrentProjection: jest.fn() };
  const corrections = { listApprovedAdjustmentSummaries: jest.fn() };
  const repository = {
    listStoreMetadata: jest.fn().mockResolvedValue([]),
    listClosedRateSnapshots: jest.fn().mockResolvedValue([]),
    listExactRateTables: jest.fn().mockResolvedValue([]),
    listWorkflowAudit: jest.fn().mockResolvedValue({ reviews: [], corrections: [], packages: [] }),
    listCorrectionActors: jest.fn().mockResolvedValue([]),
  };
  return {
    readModel,
    corrections,
    repository,
    service: new SalesTargetIncentiveWorkspaceReadService(
      readModel as never,
      corrections as never,
      repository as never,
    ),
  };
}

const actor = (roles: string[], roleScopes: Record<string, any>, assignedStoreIds: string[] = []) => ({
  roleCodes: roles,
  readScope: { companyIds: ["aggregate-company"], regionIds: ["aggregate-region"], storeIds: ["aggregate-store"] },
  roleScopes,
  actionScope: { assignedStoreIds },
  assignedStoreIds,
});

describe("SalesTargetIncentiveWorkspaceReadService", () => {
  it("returns a typed empty Report Viewer workspace without touching repositories when company scope is absent", async () => {
    const { service, readModel, repository } = harness();

    const result = await service.getWorkspace({
      actor: actor(["REPORT_VIEWER"], {}) as never,
      periodKey: "2026-05",
    });

    expect(result).toEqual(expect.objectContaining({ view: "report_viewer", regions: [] }));
    expect(result.capabilities).toEqual({
      canMarkStoreReview: false,
      canCreateCorrection: false,
      canVoidCorrection: false,
      canSubmitPackage: false,
    });
    expect(readModel.buildCurrentProjection).not.toHaveBeenCalled();
    expect(repository.listStoreMetadata).not.toHaveBeenCalled();
  });

  it("uses only the dedicated Report Viewer company scope in a mixed session", async () => {
    const { service, readModel, corrections, repository } = harness();
    readModel.buildCurrentProjection.mockResolvedValue({
      periodKey: "2026-05", periodStart: "2026-05-01", periodEnd: "2026-05-31", timezone: "Europe/Istanbul",
      stores: [],
    });
    repository.listStoreMetadata.mockResolvedValue([]);
    repository.listClosedRateSnapshots.mockResolvedValue([]);
    repository.listWorkflowAudit.mockResolvedValue({ reviews: [], corrections: [], packages: [] });
    corrections.listApprovedAdjustmentSummaries.mockResolvedValue([]);

    const result = await service.getWorkspace({
      actor: actor(
        ["REPORT_VIEWER", "REGION_MANAGER"],
        {
          REPORT_VIEWER: { companyIds: ["viewer-company"], regionIds: [], storeIds: [] },
          REGION_MANAGER: { companyIds: [], regionIds: [], storeIds: ["manager-store"] },
        },
        ["manager-store"],
      ) as never,
      periodKey: "2026-05",
    });

    expect(readModel.buildCurrentProjection).toHaveBeenCalledWith(expect.objectContaining({
      companyIds: ["viewer-company"], regionIds: [], storeIds: [], allowGlobalScope: false,
    }));
    expect(result.view).toBe("report_viewer");
    expect(Object.values(result.capabilities).every((value) => value === false)).toBe(true);
  });

  it("rejects personas outside the workspace", async () => {
    const { service } = harness();
    await expect(service.getWorkspace({
      actor: actor(["STORE_MANAGER"], {}) as never,
      periodKey: "2026-05",
    })).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("advertises write capabilities only for visible stores with an exact action assignment", async () => {
    const { service, readModel, corrections, repository } = harness();
    readModel.buildCurrentProjection.mockResolvedValue({
      periodKey: "2026-05", periodStart: "2026-05-01", periodEnd: "2026-05-31", timezone: "Europe/Istanbul",
      stores: [projectionStore("store-actionable", "region-a"), projectionStore("store-read-only", "region-a")],
    });
    repository.listStoreMetadata.mockResolvedValue([
      storeMetadata("store-actionable", "region-a"),
      storeMetadata("store-read-only", "region-a"),
    ]);
    corrections.listApprovedAdjustmentSummaries.mockResolvedValue([]);

    const result = await service.getWorkspace({
      actor: actor(["REGION_MANAGER"], {
        REGION_MANAGER: { companyIds: [], regionIds: ["region-a"], storeIds: ["store-actionable", "store-read-only"] },
      }, ["store-actionable"]) as never,
      periodKey: "2026-05",
    });

    expect(result.capabilities).toEqual({
      canMarkStoreReview: true,
      canCreateCorrection: true,
      canVoidCorrection: true,
      canSubmitPackage: true,
    });
    expect(result.regions[0].capabilities).toEqual({ canSubmitPackage: true });
    expect(result.regions[0].stores.map((store) => [store.storeId, store.capabilities])).toEqual([
      ["store-actionable", { canMarkStoreReview: true, canCreateCorrection: true, canVoidCorrection: true }],
      ["store-read-only", { canMarkStoreReview: false, canCreateCorrection: false, canVoidCorrection: false }],
    ]);

    const unrelated = await service.getWorkspace({
      actor: actor(["REGION_MANAGER"], {
        REGION_MANAGER: { companyIds: [], regionIds: ["region-a"], storeIds: ["store-actionable", "store-read-only"] },
      }, ["different-store"]) as never,
      periodKey: "2026-05",
    });
    expect(Object.values(unrelated.capabilities).every((value) => value === false)).toBe(true);
    expect(unrelated.regions[0].capabilities).toEqual({ canSubmitPackage: false });
    expect(unrelated.regions[0].stores.every((store) => Object.values(store.capabilities).every((value) => value === false))).toBe(true);
  });

  it("assembles region, store, row and sanitized correction audit without actor ids", async () => {
    const { service, readModel, corrections, repository } = harness();
    readModel.buildCurrentProjection.mockResolvedValue({
      periodKey: "2026-05",
      periodStart: "2026-05-01",
      periodEnd: "2026-05-31",
      timezone: "Europe/Istanbul",
      stores: [{
        companyId: "company-a",
        regionId: "region-a",
        storeId: "store-a",
        storeName: "Mall of Istanbul",
        storeType: "company",
        storeTargetRequestId: "request-a",
        storeTargetAmount: "1000.00",
        storeNetSalesAmount: "1100.00",
        storeNetSalesSourceBatchId: "batch-a",
        storeNetSalesImportBatchId: "import-a",
        storeNetSalesLastSyncedAt: "2026-05-31T20:00:00.000Z",
        manager: null,
        personnel: [{
          participantType: "personnel",
          employeeId: "employee-a",
          userId: null,
          assignmentId: "assignment-a",
          assignmentStartedOn: "2026-01-01",
          assignmentEndedOn: null,
          positionId: "position-a",
          displayName: "Derya Uslu",
          positionCode: "SALES_ASSOCIATE",
          normalizedFromPositionCode: null,
          targetReferenceId: "target-a",
          targetAmount: "500.00",
          actualAmount: "550.00",
          calculation: {
            status: "projected",
            blockedReason: null,
            excludedReason: null,
            ruleVersionCode: "sales-target-incentive-v1.0.0",
            rateTableVersion: "personnel-sales-target-v1.0.0",
            positionCode: "SALES_ASSOCIATE",
            normalizedFromPositionCode: null,
            storeAchievementPct: "110.0000",
            storeGatePassed: true,
            achievementPct: "110.0000",
            personalRateBeforeGate: "0.0165",
            rate: "0.0165",
            rawEarnedAmount: "9.075000",
            payableAmount: "9.07",
          },
          source: { storeTargetRequestId: "request-a", storeNetSalesSourceBatchId: "batch-a", storeNetSalesImportBatchId: "import-a", personnelSalesSourceBatchId: "p-batch", personnelSalesImportBatchId: "p-import" },
        }],
      }],
    });
    repository.listStoreMetadata.mockResolvedValue([{
      company_id: "company-a", region_id: "region-a", region_name: "Istanbul Avrupa",
      region_manager_name: "Suleyman Ozturk", store_id: "store-a", store_code: "MOI",
    }]);
    repository.listWorkflowAudit.mockResolvedValue({
      reviews: [],
      packages: [],
      corrections: [{
        sales_target_incentive_region_correction_id: "correction-a",
        region_package_id: null,
        company_id: "company-a",
        region_id: "region-a",
        store_id: "store-a",
        employee_id: "employee-a",
        participant_type: "personnel",
        final_row_id: "final-row-a",
        period_key: "2026-05",
        before_amount: "9.07",
        final_amount: "12.00",
        adjustment_amount: "2.93",
        reason_note: "Donem ici magaza degisimi dogrulandi.",
        correction_status: "admin_approved",
        created_by_user_id: "secret-user-id",
        submitted_by_user_id: null,
        submitted_at: null,
        reviewed_by_user_id: null,
        reviewed_at: "2026-06-02T12:00:00.000Z",
        review_note: "Onaylandi",
        approved_adjustment_id: "adjustment-a",
        created_at: "2026-06-01T10:00:00.000Z",
        updated_at: "2026-06-02T12:00:00.000Z",
      }],
    });
    repository.listCorrectionActors.mockResolvedValue([{
      correction_id: "correction-a",
      display_name: "Suleyman Ozturk",
      role_code: "REGION_MANAGER",
    }]);
    corrections.listApprovedAdjustmentSummaries.mockResolvedValue([]);

    const result = await service.getWorkspace({
      actor: actor(["REPORT_VIEWER"], {
        REPORT_VIEWER: { companyIds: ["company-a"], regionIds: [], storeIds: [] },
      }) as never,
      periodKey: "2026-05",
    });

    expect(result.regions[0]).toEqual(expect.objectContaining({
      regionId: "region-a",
      regionName: "Istanbul Avrupa",
      regionManager: { displayName: "Suleyman Ozturk" },
    }));
    expect(result.regions[0].stores[0]).toEqual(expect.objectContaining({
      storeCode: "MOI",
      storeName: "Mall of Istanbul",
      city: null,
    }));
    const row = result.regions[0].stores[0].rows[0];
    expect(row.finalAmount).toBe("12.00");
    expect(row.signedDifferenceAmount).toBe("2.93");
    expect(row.correction?.actor).toEqual({
      displayName: "Suleyman Ozturk",
      roleCode: "REGION_MANAGER",
      identityStatus: "resolved",
    });
    expect(JSON.stringify(result)).not.toContain("secret-user-id");

    repository.listCorrectionActors.mockResolvedValueOnce([]);
    const unresolvedActorResult = await service.getWorkspace({
      actor: actor(["REPORT_VIEWER"], {
        REPORT_VIEWER: { companyIds: ["company-a"], regionIds: [], storeIds: [] },
      }) as never,
      periodKey: "2026-05",
    });
    expect(unresolvedActorResult.regions[0].stores[0].rows[0].correction?.actor).toEqual({
      displayName: null,
      roleCode: null,
      identityStatus: "unavailable",
    });
    expect(JSON.stringify(unresolvedActorResult)).not.toContain("secret-user-id");
  });
});

function projectionStore(storeId: string, regionId: string) {
  return {
    companyId: "company-a", regionId, storeId, storeName: storeId, storeType: "company",
    storeTargetRequestId: null, storeTargetAmount: null, storeNetSalesAmount: null,
    storeNetSalesSourceBatchId: null, storeNetSalesImportBatchId: null, storeNetSalesLastSyncedAt: null,
    manager: null, personnel: [],
  };
}

function storeMetadata(storeId: string, regionId: string) {
  return {
    company_id: "company-a", region_id: regionId, region_name: "Region A",
    region_manager_name: "Region Manager", store_id: storeId, store_code: storeId,
  };
}
