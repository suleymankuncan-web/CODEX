import { ForbiddenException } from "@nestjs/common";
import { SalesTargetIncentiveWorkspaceReadService } from "./sales-target-incentive-workspace-read.service";
import type { SalesTargetIncentiveRegionCorrectionRow } from "../infrastructure/sales-target-incentive-approval.repository";

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
  it("keeps the core workspace visible when optional store metadata is unavailable", async () => {
    const { service, readModel, corrections, repository } = harness();
    readModel.buildCurrentProjection.mockResolvedValue({
      periodKey: "2026-05", periodStart: "2026-05-01", periodEnd: "2026-05-31", timezone: "Europe/Istanbul",
      stores: [projectionStore("store-a", "region-a")],
    });
    repository.listStoreMetadata.mockRejectedValue(new Error("metadata unavailable"));
    corrections.listApprovedAdjustmentSummaries.mockResolvedValue([]);
    const warn = jest.fn();
    (service as unknown as { logger: { warn: jest.Mock } }).logger.warn = warn;

    const result = await service.getWorkspace({
      actor: actor(["REPORT_VIEWER"], {
        REPORT_VIEWER: { companyIds: ["company-a"], regionIds: [], storeIds: [] },
      }) as never,
      periodKey: "2026-05",
    });

    expect(result.regions[0]?.stores[0]?.storeName).toBe("store-a");
    expect(result.sections.storeMetadata).toEqual({ status: "unavailable" });
    expect(result.sections.core).toEqual({ status: "complete" });
    expect(warn).toHaveBeenCalledWith(JSON.stringify({
      event: "sales_target_incentive.workspace_optional_section.unavailable",
      section: "store_metadata",
    }));
    expect(warn.mock.calls.flat().join(" ")).not.toContain("metadata unavailable");
  });

  it("keeps corrections visible with unavailable actor metadata when actor lookup fails", async () => {
    const { service, readModel, corrections, repository } = harness();
    readModel.buildCurrentProjection.mockResolvedValue({
      periodKey: "2026-05", periodStart: "2026-05-01", periodEnd: "2026-05-31", timezone: "Europe/Istanbul",
      stores: [projectionStore("store-a", "region-a")],
    });
    repository.listWorkflowAudit.mockResolvedValue({
      reviews: [], packages: [], corrections: [{
        sales_target_incentive_region_correction_id: "correction-a", region_package_id: null,
        company_id: "company-a", region_id: "region-a", store_id: "store-a",
        employee_id: "employee-a", participant_type: "personnel", final_row_id: "final-a",
        period_key: "2026-05", before_amount: "10.00", final_amount: "12.00",
        adjustment_amount: "2.00", reason_note: "Dogrulanmis duzeltme notu.",
        correction_status: "submitted", created_by_user_id: "private-user",
        submitted_by_user_id: null, submitted_at: null, reviewed_by_user_id: null,
        reviewed_at: null, review_note: null, approved_adjustment_id: null,
        created_at: "2026-06-01T10:00:00.000Z", updated_at: "2026-06-01T10:00:00.000Z",
      }],
    });
    repository.listCorrectionActors.mockRejectedValue(new Error("actor directory unavailable"));
    corrections.listApprovedAdjustmentSummaries.mockResolvedValue([{
      store_id: "store-a", employee_id: "employee-a", participant_type: "personnel",
      employee_display_name: "Derya Uslu", position_code: "SALES_ASSOCIATE",
      target_amount: "100.00", actual_sales_amount: "110.00", achievement_pct: "110.0000",
      applied_rate: "0.0150", payable_amount: "1.65", final_amount: "12.00",
      adjustment_amount: "0.00", calculation_status: "projected",
    }]);

    const result = await service.getWorkspace({
      actor: actor(["REPORT_VIEWER"], {
        REPORT_VIEWER: { companyIds: ["company-a"], regionIds: [], storeIds: [] },
      }) as never,
      periodKey: "2026-05",
    });

    expect(result.regions[0]?.stores[0]?.rows[0]?.correction?.correctionId).toBe("correction-a");
    expect(result.regions[0]?.stores[0]?.rows[0]?.correction?.actor.identityStatus).toBe("unavailable");
    expect(result.sections.correctionActors).toEqual({ status: "unavailable" });
    expect(JSON.stringify(result)).not.toContain("private-user");
  });

  it("marks only rate metadata unavailable when the optional exact-rate lookup fails", async () => {
    const { service, readModel, corrections, repository } = harness();
    readModel.buildCurrentProjection.mockResolvedValue({
      periodKey: "2026-05", periodStart: "2026-05-01", periodEnd: "2026-05-31", timezone: "Europe/Istanbul",
      stores: [projectionStore("store-a", "region-a")],
    });
    repository.listExactRateTables.mockRejectedValue(new Error("rate metadata unavailable"));
    corrections.listApprovedAdjustmentSummaries.mockResolvedValue([]);

    const result = await service.getWorkspace({
      actor: actor(["REPORT_VIEWER"], {
        REPORT_VIEWER: { companyIds: ["company-a"], regionIds: [], storeIds: [] },
      }) as never,
      periodKey: "2026-05",
    });

    expect(result.regions).toHaveLength(1);
    expect(result.rateMetadata.status).toBe("unresolved");
    expect(result.sections.rateMetadata).toEqual({ status: "unavailable" });
  });

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
    repository.listClosedRateSnapshots.mockResolvedValue([
      closedSnapshot("store-actionable"),
      closedSnapshot("store-read-only"),
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
      canVoidCorrection: false,
      canSubmitPackage: true,
    });
    expect(result.regions[0].capabilities).toEqual({ canSubmitPackage: true });
    expect(result.regions[0].stores.map((store) => [store.storeId, store.capabilities])).toEqual([
      ["store-actionable", { canMarkStoreReview: true, canCreateCorrection: true, canVoidCorrection: false }],
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

  it("keeps projection-only and submitted-package stores read-only", async () => {
    const { service, readModel, corrections, repository } = harness();
    readModel.buildCurrentProjection.mockResolvedValue({
      periodKey: "2026-05", periodStart: "2026-05-01", periodEnd: "2026-05-31", timezone: "Europe/Istanbul",
      stores: [projectionStore("store-open", "region-a"), projectionStore("store-locked", "region-b")],
    });
    repository.listStoreMetadata.mockResolvedValue([
      storeMetadata("store-open", "region-a"),
      storeMetadata("store-locked", "region-b"),
    ]);
    repository.listClosedRateSnapshots.mockResolvedValue([closedSnapshot("store-locked")]);
    repository.listWorkflowAudit.mockResolvedValue({
      reviews: [], corrections: [], packages: [{
        region_id: "region-b", package_status: "submitted", submitted_at: "2026-06-01T10:00:00.000Z",
        reviewed_at: null, review_note: null,
      }],
    });
    corrections.listApprovedAdjustmentSummaries.mockResolvedValue([]);

    const result = await service.getWorkspace({
      actor: actor(["REGION_MANAGER"], {
        REGION_MANAGER: { companyIds: [], regionIds: ["region-a", "region-b"], storeIds: ["store-open", "store-locked"] },
      }, ["store-open", "store-locked"]) as never,
      periodKey: "2026-05",
    });

    expect(result.regions.flatMap((region) => region.stores).map((store) => [store.storeId, store.capabilities])).toEqual([
      ["store-open", { canMarkStoreReview: false, canCreateCorrection: false, canVoidCorrection: false }],
      ["store-locked", { canMarkStoreReview: false, canCreateCorrection: false, canVoidCorrection: false }],
    ]);
    expect(result.regions.map((region) => [region.regionId, region.capabilities.canSubmitPackage])).toEqual([
      ["region-a", true],
      ["region-b", false],
    ]);
    expect(result.capabilities).toEqual({
      canMarkStoreReview: false,
      canCreateCorrection: false,
      canVoidCorrection: false,
      canSubmitPackage: true,
    });
  });

  it("keeps an active Region Manager correction after a closed row is refetched", async () => {
    const { service, readModel, corrections, repository } = harness();
    readModel.buildCurrentProjection.mockResolvedValue(projectionWithPersonnel());
    repository.listStoreMetadata.mockResolvedValue([storeMetadata("store-a", "region-a")]);
    repository.listClosedRateSnapshots.mockResolvedValue([closedSnapshot("store-a")]);
    repository.listWorkflowAudit.mockResolvedValue({
      reviews: [], packages: [], corrections: [correctionRow({ finalAmount: "12.00" })],
    });
    corrections.listApprovedAdjustmentSummaries.mockResolvedValue([
      adjustmentSummary({ finalAmount: "9.07", adjustmentAmount: "0.00" }),
    ]);

    const result = await service.getWorkspace(regionManagerWorkspaceInput());
    const row = result.regions[0]?.stores[0]?.rows[0];

    // Traceability: INC-FR-001/002/004/005, AC-INC-001, EC-014/015.
    expect(row?.finalAmount).toBe("12.00");
    expect(row?.signedDifferenceAmount).toBe("2.93");
    expect(row?.correction).toEqual(expect.objectContaining({
      finalAmount: "12.00",
      reasonNote: "Donem ici magaza destegi dogrulandi.",
      status: "draft",
    }));
  });

  it("uses the newest active correction amount and note when correction history contains a replacement", async () => {
    const { service, readModel, corrections, repository } = harness();
    readModel.buildCurrentProjection.mockResolvedValue(projectionWithPersonnel());
    repository.listStoreMetadata.mockResolvedValue([storeMetadata("store-a", "region-a")]);
    repository.listClosedRateSnapshots.mockResolvedValue([closedSnapshot("store-a")]);
    repository.listWorkflowAudit.mockResolvedValue({
      reviews: [], packages: [], corrections: [correctionRow({
        correctionId: "correction-replaced",
        finalAmount: "13.00",
        reasonNote: "Yeni duzeltme.",
        createdAt: "2026-06-01T09:00:00.000Z",
        updatedAt: "2026-06-01T10:00:00.000Z",
      })],
    });
    corrections.listApprovedAdjustmentSummaries.mockResolvedValue([
      adjustmentSummary({ finalAmount: "9.07", adjustmentAmount: "0.00" }),
    ]);

    const row = (await service.getWorkspace(regionManagerWorkspaceInput()))
      .regions[0]?.stores[0]?.rows[0];

    // Traceability: INC-FR-001/002, AC-INC-001, EC-014.
    expect(row?.finalAmount).toBe("13.00");
    expect(row?.correction).toEqual(expect.objectContaining({
      correctionId: "correction-replaced",
      finalAmount: "13.00",
      reasonNote: "Yeni duzeltme.",
    }));
  });

  it.each(["submitted", "admin_returned"] as const)(
    "keeps a %s Region Manager correction as the open readback truth",
    async (status) => {
      const { service, readModel, corrections, repository } = harness();
      readModel.buildCurrentProjection.mockResolvedValue(projectionWithPersonnel());
      repository.listStoreMetadata.mockResolvedValue([storeMetadata("store-a", "region-a")]);
      repository.listClosedRateSnapshots.mockResolvedValue([closedSnapshot("store-a")]);
      repository.listWorkflowAudit.mockResolvedValue({
        reviews: [], packages: [], corrections: [correctionRow({ status, finalAmount: "12.00" })],
      });
      corrections.listApprovedAdjustmentSummaries.mockResolvedValue([
        adjustmentSummary({ finalAmount: "9.07", adjustmentAmount: "0.00" }),
      ]);

      const row = (await service.getWorkspace(regionManagerWorkspaceInput()))
        .regions[0]?.stores[0]?.rows[0];

      // Traceability: INC-FR-001/002, AC-INC-001, EC-014.
      expect(row?.finalAmount).toBe("12.00");
      expect(row?.correction?.status).toBe(status);
    },
  );

  it("keeps an approved admin adjustment authoritative over an active Region Manager correction", async () => {
    const { service, readModel, corrections, repository } = harness();
    readModel.buildCurrentProjection.mockResolvedValue(projectionWithPersonnel());
    repository.listStoreMetadata.mockResolvedValue([storeMetadata("store-a", "region-a")]);
    repository.listClosedRateSnapshots.mockResolvedValue([closedSnapshot("store-a")]);
    repository.listWorkflowAudit.mockResolvedValue({
      reviews: [], packages: [], corrections: [correctionRow({ finalAmount: "12.00" })],
    });
    corrections.listApprovedAdjustmentSummaries.mockResolvedValue([
      adjustmentSummary({ finalAmount: "9.07", adjustmentAmount: "1.00" }),
    ]);

    const row = (await service.getWorkspace(regionManagerWorkspaceInput()))
      .regions[0]?.stores[0]?.rows[0];

    // Traceability: INC-FR-001/005, AC-INC-003, EC-014.
    expect(row?.finalAmount).toBe("10.07");
    expect(row?.signedDifferenceAmount).toBe("1.00");
  });

  it("lets a new draft supersede an older approved admin adjustment", async () => {
    const { service, readModel, corrections, repository } = harness();
    readModel.buildCurrentProjection.mockResolvedValue(projectionWithPersonnel());
    repository.listStoreMetadata.mockResolvedValue([storeMetadata("store-a", "region-a")]);
    repository.listClosedRateSnapshots.mockResolvedValue([closedSnapshot("store-a")]);
    repository.listWorkflowAudit.mockResolvedValue({
      reviews: [], packages: [], corrections: [correctionRow({
        finalAmount: "12.00",
        updatedAt: "2026-06-01T11:00:00.000Z",
      })],
    });
    corrections.listApprovedAdjustmentSummaries.mockResolvedValue([adjustmentSummary({
      finalAmount: "9.07",
      adjustmentAmount: "1.00",
      approvedAdjustmentCount: 1,
      latestApprovedAdjustmentAt: "2026-06-01T10:00:00.000Z",
    })]);

    const row = (await service.getWorkspace(regionManagerWorkspaceInput()))
      .regions[0]?.stores[0]?.rows[0];

    // Traceability: INC-FR-001/002/005, AC-INC-001/003, EC-014.
    expect(row?.finalAmount).toBe("12.00");
  });

  it("lets a newer approved admin adjustment supersede an open correction", async () => {
    const { service, readModel, corrections, repository } = harness();
    readModel.buildCurrentProjection.mockResolvedValue(projectionWithPersonnel());
    repository.listStoreMetadata.mockResolvedValue([storeMetadata("store-a", "region-a")]);
    repository.listClosedRateSnapshots.mockResolvedValue([closedSnapshot("store-a")]);
    repository.listWorkflowAudit.mockResolvedValue({
      reviews: [], packages: [], corrections: [correctionRow({
        finalAmount: "12.00",
        updatedAt: "2026-06-01T10:00:00.000Z",
      })],
    });
    corrections.listApprovedAdjustmentSummaries.mockResolvedValue([adjustmentSummary({
      finalAmount: "9.07",
      adjustmentAmount: "1.00",
      approvedAdjustmentCount: 1,
      latestApprovedAdjustmentAt: "2026-06-01T11:00:00.000Z",
    })]);

    const row = (await service.getWorkspace(regionManagerWorkspaceInput()))
      .regions[0]?.stores[0]?.rows[0];

    // Traceability: INC-FR-001/005, AC-INC-003, EC-014.
    expect(row?.finalAmount).toBe("10.07");
  });

  it("keeps a newer net-zero approved adjustment sequence authoritative", async () => {
    const { service, readModel, corrections, repository } = harness();
    readModel.buildCurrentProjection.mockResolvedValue(projectionWithPersonnel());
    repository.listStoreMetadata.mockResolvedValue([storeMetadata("store-a", "region-a")]);
    repository.listClosedRateSnapshots.mockResolvedValue([closedSnapshot("store-a")]);
    repository.listWorkflowAudit.mockResolvedValue({
      reviews: [], packages: [], corrections: [correctionRow({
        finalAmount: "12.00",
        updatedAt: "2026-06-01T10:00:00.000Z",
      })],
    });
    corrections.listApprovedAdjustmentSummaries.mockResolvedValue([adjustmentSummary({
      finalAmount: "9.07",
      adjustmentAmount: "0.00",
      approvedAdjustmentCount: 2,
      latestApprovedAdjustmentAt: "2026-06-01T11:00:00.000Z",
    })]);

    const row = (await service.getWorkspace(regionManagerWorkspaceInput()))
      .regions[0]?.stores[0]?.rows[0];

    // Traceability: INC-FR-001/005, AC-INC-003, EC-014.
    expect(row?.finalAmount).toBe("9.07");
  });

  it("does not let a voided correction replace the persisted closed final", async () => {
    const { service, readModel, corrections, repository } = harness();
    readModel.buildCurrentProjection.mockResolvedValue(projectionWithPersonnel());
    repository.listStoreMetadata.mockResolvedValue([storeMetadata("store-a", "region-a")]);
    repository.listClosedRateSnapshots.mockResolvedValue([closedSnapshot("store-a")]);
    repository.listWorkflowAudit.mockResolvedValue({
      reviews: [], packages: [], corrections: [correctionRow({ status: "voided", finalAmount: "12.00" })],
    });
    corrections.listApprovedAdjustmentSummaries.mockResolvedValue([
      adjustmentSummary({ finalAmount: "9.07", adjustmentAmount: "0.00" }),
    ]);

    const row = (await service.getWorkspace(regionManagerWorkspaceInput()))
      .regions[0]?.stores[0]?.rows[0];

    // Traceability: INC-FR-001/005, AC-INC-002, EC-014.
    expect(row?.finalAmount).toBe("9.07");
    expect(row?.correction).toBeNull();
  });

  it("applies active correction precedence to final-only workspace rows", async () => {
    const { service, readModel, corrections, repository } = harness();
    readModel.buildCurrentProjection.mockResolvedValue({
      ...projectionWithPersonnel(),
      stores: [projectionStore("store-a", "region-a")],
    });
    repository.listStoreMetadata.mockResolvedValue([storeMetadata("store-a", "region-a")]);
    repository.listClosedRateSnapshots.mockResolvedValue([closedSnapshot("store-a")]);
    repository.listWorkflowAudit.mockResolvedValue({
      reviews: [], packages: [], corrections: [correctionRow({ finalAmount: "12.00" })],
    });
    corrections.listApprovedAdjustmentSummaries.mockResolvedValue([
      adjustmentSummary({ finalAmount: "9.07", adjustmentAmount: "0.00" }),
    ]);

    const row = (await service.getWorkspace(regionManagerWorkspaceInput()))
      .regions[0]?.stores[0]?.rows[0];

    // Traceability: INC-FR-001/002, AC-INC-001, EC-014.
    expect(row?.finalAmount).toBe("12.00");
    expect(row?.correction?.finalAmount).toBe("12.00");
  });

  it.each([
    {
      label: "voided history",
      correction: correctionRow({ status: "voided", finalAmount: "12.00" }),
      summary: adjustmentSummary({ finalAmount: "9.07", adjustmentAmount: "0.00" }),
      expectedFinal: "9.07",
      expectedCorrection: null,
    },
    {
      label: "newer approved admin adjustment",
      correction: correctionRow({ finalAmount: "12.00", updatedAt: "2026-06-01T10:00:00.000Z" }),
      summary: adjustmentSummary({
        finalAmount: "9.07",
        adjustmentAmount: "1.00",
        approvedAdjustmentCount: 1,
        latestApprovedAdjustmentAt: "2026-06-01T11:00:00.000Z",
      }),
      expectedFinal: "10.07",
      expectedCorrection: "correction-a",
    },
  ])("keeps final-only rows correct for $label", async ({ correction, summary, expectedFinal, expectedCorrection }) => {
    const { service, readModel, corrections, repository } = harness();
    readModel.buildCurrentProjection.mockResolvedValue({
      ...projectionWithPersonnel(),
      stores: [projectionStore("store-a", "region-a")],
    });
    repository.listStoreMetadata.mockResolvedValue([storeMetadata("store-a", "region-a")]);
    repository.listClosedRateSnapshots.mockResolvedValue([closedSnapshot("store-a")]);
    repository.listWorkflowAudit.mockResolvedValue({ reviews: [], packages: [], corrections: [correction] });
    corrections.listApprovedAdjustmentSummaries.mockResolvedValue([summary]);

    const row = (await service.getWorkspace(regionManagerWorkspaceInput()))
      .regions[0]?.stores[0]?.rows[0];

    // Traceability: INC-FR-001/002/005, AC-INC-001..003, EC-014.
    expect(row?.finalAmount).toBe(expectedFinal);
    expect(row?.correction?.correctionId ?? null).toBe(expectedCorrection);
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
    corrections.listApprovedAdjustmentSummaries.mockResolvedValue([adjustmentSummary({
      finalAmount: "9.07",
      adjustmentAmount: "2.93",
      approvedAdjustmentCount: 1,
      latestApprovedAdjustmentAt: "2026-06-02T12:00:00.000Z",
    })]);

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

    const approvedWorkflow = await repository.listWorkflowAudit.mock.results[0]!.value;
    repository.listWorkflowAudit.mockResolvedValueOnce({
      ...approvedWorkflow,
      corrections: approvedWorkflow.corrections.map((correction: SalesTargetIncentiveRegionCorrectionRow) => ({
        ...correction,
        correction_status: "voided" as const,
      })),
    });
    corrections.listApprovedAdjustmentSummaries.mockResolvedValueOnce([adjustmentSummary({
      finalAmount: "9.07",
      adjustmentAmount: "0.00",
    })]);
    const voidedOnlyResult = await service.getWorkspace({
      actor: actor(["REPORT_VIEWER"], {
        REPORT_VIEWER: { companyIds: ["company-a"], regionIds: [], storeIds: [] },
      }) as never,
      periodKey: "2026-05",
    });
    const voidedOnlyRow = voidedOnlyResult.regions[0].stores[0].rows[0];
    expect(voidedOnlyRow.correction).toBeNull();
    expect(voidedOnlyRow.finalAmount).toBe("9.07");
    expect(voidedOnlyRow.signedDifferenceAmount).toBe("0.00");
    expect(voidedOnlyRow.correctionRecords).toEqual([
      expect.objectContaining({ correctionId: "correction-a", status: "voided" }),
    ]);
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

function closedSnapshot(storeId: string) {
  return {
    store_id: storeId,
    final_snapshot_id: `final-${storeId}`,
    rule_version_code: "sales-target-incentive-v1.0.0",
    period_timezone: "Europe/Istanbul",
    rate_table_versions: [],
    rate_brackets_json: [],
  };
}

function projectionWithPersonnel() {
  return {
    periodKey: "2026-05",
    periodStart: "2026-05-01",
    periodEnd: "2026-05-31",
    timezone: "Europe/Istanbul",
    stores: [{
      ...projectionStore("store-a", "region-a"),
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
        source: {
          storeTargetRequestId: "request-a",
          storeNetSalesSourceBatchId: "batch-a",
          storeNetSalesImportBatchId: "import-a",
          personnelSalesSourceBatchId: "personnel-batch-a",
          personnelSalesImportBatchId: "personnel-import-a",
        },
      }],
    }],
  };
}

function correctionRow(input: {
  correctionId?: string;
  finalAmount: string;
  reasonNote?: string;
  status?: SalesTargetIncentiveRegionCorrectionRow["correction_status"];
  createdAt?: string;
  updatedAt?: string;
}): SalesTargetIncentiveRegionCorrectionRow {
  return {
    sales_target_incentive_region_correction_id: input.correctionId ?? "correction-a",
    region_package_id: null,
    company_id: "company-a",
    region_id: "region-a",
    store_id: "store-a",
    employee_id: "employee-a",
    participant_type: "personnel",
    final_row_id: "final-store-a",
    period_key: "2026-05",
    before_amount: "9.07",
    final_amount: input.finalAmount,
    adjustment_amount: "2.93",
    reason_note: input.reasonNote ?? "Donem ici magaza destegi dogrulandi.",
    correction_status: input.status ?? "draft",
    created_by_user_id: "actor-a",
    submitted_by_user_id: null,
    submitted_at: null,
    reviewed_by_user_id: null,
    reviewed_at: null,
    review_note: null,
    approved_adjustment_id: null,
    created_at: input.createdAt ?? "2026-06-01T10:00:00.000Z",
    updated_at: input.updatedAt ?? input.createdAt ?? "2026-06-01T10:00:00.000Z",
  };
}

function adjustmentSummary(input: {
  finalAmount: string;
  adjustmentAmount: string;
  approvedAdjustmentCount?: number;
  latestApprovedAdjustmentAt?: string;
}) {
  return {
    store_id: "store-a",
    employee_id: "employee-a",
    participant_type: "personnel" as const,
    employee_display_name: "Derya Uslu",
    position_code: "SALES_ASSOCIATE",
    target_amount: "500.00",
    actual_sales_amount: "550.00",
    achievement_pct: "110.0000",
    applied_rate: "0.0165",
    payable_amount: "9.07",
    final_amount: input.finalAmount,
    adjustment_amount: input.adjustmentAmount,
    approved_adjustment_count: input.approvedAdjustmentCount ?? 0,
    latest_approved_adjustment_at: input.latestApprovedAdjustmentAt ?? null,
    calculation_status: "projected",
  };
}

function regionManagerWorkspaceInput() {
  return {
    actor: actor(["REGION_MANAGER"], {
      REGION_MANAGER: { companyIds: [], regionIds: ["region-a"], storeIds: ["store-a"] },
    }, ["store-a"]) as never,
    periodKey: "2026-05",
  };
}
