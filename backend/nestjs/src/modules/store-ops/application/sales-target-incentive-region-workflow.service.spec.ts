import { ForbiddenException } from "@nestjs/common";
import { buildAuthenticatedUser } from "../../auth/auth-context.service";
import type { SalesTargetIncentiveRegionCorrectionRow } from "../infrastructure/sales-target-incentive-approval.repository";
import { SalesTargetIncentiveRegionWorkflowService } from "./sales-target-incentive-region-workflow.service";
import type { SalesTargetIncentiveProjectionReadModel } from "./sales-target-incentive-read-model.service";

const companyId = "00000000-0000-4000-8000-000000000001";
const regionId = "00000000-0000-4000-8000-000000000101";
const storeId = "00000000-0000-4000-8000-000000000201";
const otherStoreId = "00000000-0000-4000-8000-000000000202";
const employeeId = "00000000-0000-4000-8000-000000000501";
const correctionId = "00000000-0000-4000-8000-000000000951";
const packageId = "00000000-0000-4000-8000-000000000961";
const finalRowId = "00000000-0000-4000-8000-000000000971";

const projection: SalesTargetIncentiveProjectionReadModel = {
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
      storeTargetRequestId: null,
      storeTargetAmount: "1000000.0000",
      storeNetSalesAmount: "1150000.0000",
      storeNetSalesSourceBatchId: null,
      storeNetSalesImportBatchId: null,
      storeNetSalesLastSyncedAt: null,
      manager: null,
      personnel: [],
    },
  ],
};

function actor() {
  return buildAuthenticatedUser({
    userId: "region-user",
    roleCodes: ["REGION_MANAGER"],
    actionScope: { assignedStoreIds: [storeId] },
    roleScopes: { REGION_MANAGER: { companyIds: [], regionIds: [], storeIds: [storeId] } },
  });
}

function createService(input?: {
  closedStoreIds?: string[];
  closedSnapshotIds?: Record<string, string>;
  reviewStatus?: "pending_review" | "reviewed";
  packageStatus?: "submitted" | "admin_approved" | "admin_returned" | null;
  workflowCorrections?: SalesTargetIncentiveRegionCorrectionRow[];
}) {
  const closedStoreIds = new Set(input?.closedStoreIds ?? [storeId]);
  const draftCorrection: SalesTargetIncentiveRegionCorrectionRow = {
    sales_target_incentive_region_correction_id: correctionId,
    region_package_id: null,
    company_id: companyId,
    region_id: regionId,
    store_id: storeId,
    employee_id: employeeId,
    participant_type: "personnel",
    final_row_id: finalRowId,
    period_key: "2026-05",
    before_amount: "3960.00",
    final_amount: "4000.00",
    adjustment_amount: "40.00",
    reason_note: "Bolge kontrol duzeltmesi",
    correction_status: "draft",
    created_by_user_id: "region-user",
    submitted_by_user_id: null,
    submitted_at: null,
    reviewed_by_user_id: null,
    reviewed_at: null,
    review_note: null,
    approved_adjustment_id: null,
    created_at: "2026-06-01T08:05:00.000Z",
    updated_at: "2026-06-01T08:05:00.000Z",
  };
  const readModelService = {
    buildCurrentProjection: jest.fn(async () => projection),
  };
  const approvalRepository = {
    listClosedFinalSnapshotStores: jest.fn(async ({ storeIds }: { storeIds: string[] }) =>
      storeIds
        .filter((candidate) => closedStoreIds.has(candidate))
        .map((candidate) => ({
          store_id: candidate,
          final_snapshot_id: input?.closedSnapshotIds?.[candidate] ?? "snapshot-1",
        })),
    ),
    listClosedFinalSnapshotTargets: jest.fn(async ({ storeIds }: { storeIds: string[] }) =>
      storeIds.map((candidate) => ({
        final_row_id: finalRowId,
        company_id: companyId,
        region_id: regionId,
        store_id: candidate,
        store_name: "Marmara Park",
        employee_id: employeeId,
        user_id: null,
        participant_type: "personnel",
        position_code: "SALES_ASSOCIATE",
        target_amount: "200000.0000",
        actual_sales_amount: "240000.0000",
        achievement_pct: "120.0000",
        applied_rate: "0.0165",
        payable_amount: "3960.00",
        final_amount: "3960.00",
        approved_adjustment_amount: "0.00",
        current_amount: "3960.00",
      })),
    ),
    listWorkflowState: jest.fn(async () => ({
      reviews: input?.reviewStatus
        ? [
            {
              sales_target_incentive_store_review_id: "review-1",
              company_id: companyId,
              region_id: regionId,
              store_id: storeId,
              final_snapshot_id: "snapshot-1",
              period_key: "2026-05",
              review_status: input.reviewStatus,
              reviewed_by_user_id: input.reviewStatus === "reviewed" ? "region-user" : null,
              reviewed_at: input.reviewStatus === "reviewed" ? "2026-06-01T08:00:00.000Z" : null,
              updated_at: "2026-06-01T08:00:00.000Z",
            },
          ]
        : [],
      corrections: input?.workflowCorrections ?? [draftCorrection],
      packages: [],
    })),
    markStoreReview: jest.fn(async () => ({
      sales_target_incentive_store_review_id: "review-1",
      company_id: companyId,
      region_id: regionId,
      store_id: storeId,
      final_snapshot_id: "snapshot-1",
      period_key: "2026-05",
      review_status: "reviewed",
      reviewed_by_user_id: "region-user",
      reviewed_at: "2026-06-01T08:00:00.000Z",
      updated_at: "2026-06-01T08:00:00.000Z",
    })),
    createOrReplaceDraftCorrection: jest.fn(async () => draftCorrection),
    voidDraftCorrection: jest.fn(async () => ({
      ...draftCorrection,
      correction_status: "voided",
    })),
  };
  const packageRow = {
      sales_target_incentive_region_package_id: packageId,
      company_id: companyId,
      region_id: null,
      package_scope: "manager_assignment",
      manager_user_id: "region-user",
      period_key: "2026-05",
      package_status: input?.packageStatus ?? "submitted",
      submitted_by_user_id: "region-user",
      submitted_at: "2026-06-01T08:10:00.000Z",
      submission_note: null,
      reviewed_by_user_id: null,
      reviewed_at: null,
      review_note: null,
  };
  const managerPackageRepository = {
    findOwnerPackage: jest.fn(async () => input?.packageStatus ? packageRow : null),
    submit: jest.fn(async () => packageRow),
  };
  const service = new SalesTargetIncentiveRegionWorkflowService(
    readModelService as never,
    approvalRepository as never,
    managerPackageRepository as never,
  );
  return { approvalRepository, managerPackageRepository, readModelService, service };
}

describe("SalesTargetIncentiveRegionWorkflowService", () => {
  it("marks an assigned company store reviewed only after a closed final snapshot exists", async () => {
    const { approvalRepository, service } = createService({ closedStoreIds: [storeId] });

    const result = await service.markStoreReview({
      actor: actor(),
      periodKey: "2026-05",
      storeId,
      reviewStatus: "reviewed",
    });

    expect(approvalRepository.markStoreReview).toHaveBeenCalledWith({
      periodKey: "2026-05",
      store: expect.objectContaining({ companyId, regionId, storeId }),
      actorUserId: "region-user",
      reviewStatus: "reviewed",
    });
    expect(approvalRepository.listClosedFinalSnapshotStores).toHaveBeenCalledWith({
      periodKey: "2026-05",
      storeIds: [storeId],
    });
    expect(approvalRepository.listClosedFinalSnapshotTargets).not.toHaveBeenCalled();
    expect(result.data).toMatchObject({ storeId, reviewStatus: "reviewed" });
  });

  it("rejects store review before the period has a final snapshot", async () => {
    const { service } = createService({ closedStoreIds: [] });

    await expect(
      service.markStoreReview({
        actor: actor(),
        periodKey: "2026-05",
        storeId,
        reviewStatus: "reviewed",
      }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        missingStoreCount: 1,
        missingStoreIds: [storeId],
      }),
    });
  });

  it("blocks Region Manager mutations for stores outside assigned action scope", async () => {
    const { service } = createService();

    await expect(
      service.createRegionCorrection({
        actor: actor(),
        periodKey: "2026-05",
        storeId: otherStoreId,
        employeeId,
        participantType: "personnel",
        finalAmount: "4000.00",
        reasonNote: "Bolge kontrol duzeltmesi",
      }),
    ).rejects.toThrow(ForbiddenException);
  });

  it("rejects package submission with missing reviewed stores and reports store ids", async () => {
    const { managerPackageRepository, service } = createService({
      closedStoreIds: [storeId],
      reviewStatus: "pending_review",
    });

    await expect(
      service.submitRegionPackage({
        actor: actor(),
        periodKey: "2026-05",
      }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        missingStoreCount: 1,
        missingStoreIds: [storeId],
      }),
    });
    expect(managerPackageRepository.submit).not.toHaveBeenCalled();
  });

  it("voids the requested correction id rather than any current row correction", async () => {
    const { approvalRepository, service } = createService();

    await service.voidRegionCorrection({
      actor: actor(),
      periodKey: "2026-05",
      correctionId,
    });

    expect(approvalRepository.voidDraftCorrection).toHaveBeenCalledWith(
      expect.objectContaining({
        periodKey: "2026-05",
        correctionId,
        storeId,
        employeeId,
        participantType: "personnel",
      }),
    );
  });

  it("keeps submitted package retries idempotent", async () => {
    const { managerPackageRepository, service } = createService({
      closedStoreIds: [storeId],
      reviewStatus: "reviewed",
      packageStatus: "submitted",
    });

    const result = await service.submitRegionPackage({
      actor: actor(),
      periodKey: "2026-05",
      submissionNote: "Tekrar gonderim",
    });

    expect(result.data).toMatchObject({
      regionPackageId: packageId,
      regionPackageStatus: "submitted",
    });
    expect(managerPackageRepository.submit).not.toHaveBeenCalled();
  });

  it("requires a Region Manager role for workflow commands", async () => {
    const { service } = createService();

    await expect(
      service.submitRegionPackage({
        actor: buildAuthenticatedUser({
          userId: "manager-user",
          roleCodes: ["STORE_MANAGER"],
          actionScope: { assignedStoreIds: [storeId] },
          roleScopes: { REGION_MANAGER: { companyIds: [], regionIds: [], storeIds: [storeId] } },
        }),
        periodKey: "2026-05",
      }),
    ).rejects.toThrow(ForbiddenException);
  });

  it("surfaces Region Manager workflow context for closed stores and draft corrections", async () => {
    const { service } = createService({
      closedStoreIds: [storeId],
      reviewStatus: "reviewed",
    });

    const context = await service.getWorkflowContext({
      periodKey: "2026-05",
      stores: projection.stores,
      roleScope: "region",
      managerUserId: "region-user",
    });

    expect(context.regionWorkflow).toMatchObject({
      managerUserId: "region-user",
      regionPackageStatus: "not_submitted",
    });
    expect(context.reviewsByStoreId.get(storeId)).toMatchObject({
      storeReviewStatus: "reviewed",
      periodCloseStatus: "closed",
    });
    expect(context.correctionsByRowKey.get(`${storeId}:${employeeId}:personnel`)).toMatchObject({
      correctionId,
      finalAmount: "4000.00",
    });
  });

  it("prefers the current open correction over approved history for the same row", async () => {
    const approvedCorrection: SalesTargetIncentiveRegionCorrectionRow = {
      sales_target_incentive_region_correction_id: "approved-correction",
      region_package_id: packageId,
      company_id: companyId,
      region_id: regionId,
      store_id: storeId,
      employee_id: employeeId,
      participant_type: "personnel",
      final_row_id: finalRowId,
      period_key: "2026-05",
      before_amount: "3960.00",
      final_amount: "3980.00",
      adjustment_amount: "20.00",
      reason_note: "Onceki admin onayi",
      correction_status: "admin_approved",
      created_by_user_id: "region-user",
      submitted_by_user_id: "region-user",
      submitted_at: "2026-06-01T08:10:00.000Z",
      reviewed_by_user_id: "admin-user",
      reviewed_at: "2026-06-01T09:00:00.000Z",
      review_note: null,
      approved_adjustment_id: "approved-adjustment",
      created_at: "2026-06-01T08:05:00.000Z",
      updated_at: "2026-06-01T09:00:00.000Z",
    };
    const currentDraft: SalesTargetIncentiveRegionCorrectionRow = {
      ...approvedCorrection,
      sales_target_incentive_region_correction_id: correctionId,
      region_package_id: null,
      final_amount: "4100.00",
      adjustment_amount: "140.00",
      reason_note: "Yeni BM duzeltmesi",
      correction_status: "draft",
      submitted_by_user_id: null,
      submitted_at: null,
      reviewed_by_user_id: null,
      reviewed_at: null,
      approved_adjustment_id: null,
      created_at: "2026-06-02T08:05:00.000Z",
      updated_at: "2026-06-02T08:05:00.000Z",
    };
    const { service } = createService({
      closedStoreIds: [storeId],
      workflowCorrections: [currentDraft, approvedCorrection],
    });

    const context = await service.getWorkflowContext({
      periodKey: "2026-05",
      stores: projection.stores,
      roleScope: "region",
    });

    expect(context.correctionsByRowKey.get(`${storeId}:${employeeId}:personnel`)).toMatchObject({
      correctionId,
      status: "draft",
      finalAmount: "4100.00",
    });
  });

  it("treats reviews from older final snapshots as pending", async () => {
    const { service } = createService({
      closedStoreIds: [storeId],
      closedSnapshotIds: { [storeId]: "snapshot-2" },
      reviewStatus: "reviewed",
    });

    const context = await service.getWorkflowContext({
      periodKey: "2026-05",
      stores: projection.stores,
      roleScope: "region",
    });

    expect(context.reviewsByStoreId.get(storeId)).toMatchObject({
      storeReviewStatus: "pending_review",
      reviewedByUserId: null,
      reviewedAt: null,
      periodCloseStatus: "closed",
    });
  });

  it("loads only submitted or reviewed corrections for admin context", async () => {
    const submittedCorrection: SalesTargetIncentiveRegionCorrectionRow = {
      sales_target_incentive_region_correction_id: "submitted-correction",
      region_package_id: packageId,
      company_id: companyId,
      region_id: regionId,
      store_id: storeId,
      employee_id: employeeId,
      participant_type: "personnel",
      final_row_id: finalRowId,
      period_key: "2026-05",
      before_amount: "3960.00",
      final_amount: "4000.00",
      adjustment_amount: "40.00",
      reason_note: "BM onaya gonderdi",
      correction_status: "submitted",
      created_by_user_id: "region-user",
      submitted_by_user_id: "region-user",
      submitted_at: "2026-06-01T08:10:00.000Z",
      reviewed_by_user_id: null,
      reviewed_at: null,
      review_note: null,
      approved_adjustment_id: null,
      created_at: "2026-06-01T08:05:00.000Z",
      updated_at: "2026-06-01T08:10:00.000Z",
    };
    const draftCorrection: SalesTargetIncentiveRegionCorrectionRow = {
      ...submittedCorrection,
      sales_target_incentive_region_correction_id: "draft-correction",
      region_package_id: null,
      correction_status: "draft",
      submitted_by_user_id: null,
      submitted_at: null,
      created_at: "2026-06-02T08:05:00.000Z",
      updated_at: "2026-06-02T08:05:00.000Z",
    };
    const { service } = createService({
      workflowCorrections: [draftCorrection, submittedCorrection],
    });

    const context = await service.getWorkflowContext({
      periodKey: "2026-05",
      stores: projection.stores,
      roleScope: "admin",
    });

    expect(context.regionWorkflow).toBeNull();
    expect(context.reviewsByStoreId.size).toBe(0);
    expect(context.correctionsByRowKey.get(`${storeId}:${employeeId}:personnel`)).toMatchObject({
      correctionId: "submitted-correction",
      status: "submitted",
      submittedByUserId: "region-user",
    });
  });

  it("does not load workflow state for non-region and non-admin scopes", async () => {
    const { approvalRepository, service } = createService();

    const context = await service.getWorkflowContext({
      periodKey: "2026-05",
      stores: projection.stores,
      roleScope: "store",
    });

    expect(context.regionWorkflow).toBeNull();
    expect(context.reviewsByStoreId.size).toBe(0);
    expect(approvalRepository.listWorkflowState).not.toHaveBeenCalled();
  });
});
