import { ForbiddenException } from "@nestjs/common";
import { buildAuthenticatedUser } from "../../auth/auth-context.service";
import { SalesTargetIncentiveAdminPackageWorkflowService } from "./sales-target-incentive-admin-package-workflow.service";

const companyId = "00000000-0000-4000-8000-000000000001";
const regionId = "00000000-0000-4000-8000-000000000101";
const storeId = "00000000-0000-4000-8000-000000000201";
const packageId = "00000000-0000-4000-8000-000000000961";

function createService() {
  const adminPackageReadRepository = {
    listRegionPackageSummaries: jest.fn(async (): Promise<unknown[]> => [
      {
        company_id: companyId,
        region_id: regionId,
        region_name: "Eda Doganay Bolgesi",
        region_manager_user_id: "region-user",
        region_manager_name: "Eda Doganay",
        region_package_id: packageId,
        package_status: "submitted",
        submitted_by_user_id: "region-user",
        submitted_by_name: "Eda Doganay",
        submitted_at: "2026-06-01T08:00:00.000Z",
        reviewed_by_user_id: null,
        reviewed_by_name: null,
        reviewed_at: null,
        review_note: null,
        store_count: "4",
        reviewed_store_count: "4",
        submitted_store_count: "4",
        draft_correction_count: "0",
        submitted_correction_count: "2",
      },
    ]),
  };
  const approvalRepository = {
    reviewRegionPackage: jest.fn(async () => ({
      sales_target_incentive_region_package_id: packageId,
      company_id: companyId,
      region_id: regionId,
      period_key: "2026-05",
      package_status: "admin_approved",
      submitted_by_user_id: "region-user",
      submitted_at: "2026-06-01T08:00:00.000Z",
      submission_note: null,
      reviewed_by_user_id: "admin-user",
      reviewed_at: "2026-06-01T09:00:00.000Z",
      review_note: null,
    })),
  };
  const service = new SalesTargetIncentiveAdminPackageWorkflowService(
    adminPackageReadRepository as never,
    approvalRepository as never,
  );
  return { adminPackageReadRepository, approvalRepository, service };
}

function admin() {
  return buildAuthenticatedUser({
    userId: "admin-user",
    roleCodes: ["SUPER_ADMIN"],
    readScope: { companyIds: [companyId], regionIds: [], storeIds: [storeId] },
  });
}

describe("SalesTargetIncentiveAdminPackageWorkflowService", () => {
  it("lists admin-visible region package summaries from read scope", async () => {
    const { adminPackageReadRepository, service } = createService();

    const result = await service.listRegionPackages({
      actor: admin(),
      periodKey: "2026-05",
    });

    expect(adminPackageReadRepository.listRegionPackageSummaries).toHaveBeenCalledWith({
      periodKey: "2026-05",
      companyIds: [companyId],
      regionIds: [],
      storeIds: [storeId],
      allowGlobalScope: false,
    });
    expect(result).toEqual([
      expect.objectContaining({
        regionId,
        regionName: "Eda Doganay Bolgesi",
        status: "submitted",
        storeCount: 4,
        submittedCorrectionCount: 2,
      }),
    ]);
  });

  it("maps missing package rows to not submitted without persisting rows", async () => {
    const { adminPackageReadRepository, service } = createService();
    adminPackageReadRepository.listRegionPackageSummaries.mockResolvedValueOnce([
      {
        company_id: companyId,
        region_id: regionId,
        region_name: "Eda Doganay Bolgesi",
        region_manager_user_id: "region-user",
        region_manager_name: "Eda Doganay",
        region_package_id: null,
        package_status: null,
        submitted_by_user_id: null,
        submitted_by_name: null,
        submitted_at: null,
        reviewed_by_user_id: null,
        reviewed_by_name: null,
        reviewed_at: null,
        review_note: null,
        store_count: "4",
        reviewed_store_count: "2",
        submitted_store_count: "0",
        draft_correction_count: "1",
        submitted_correction_count: "0",
      },
    ]);

    const result = await service.listRegionPackages({
      actor: admin(),
      periodKey: "2026-05",
    });

    expect(result[0]).toMatchObject({
      status: "not_submitted",
      storeCount: 4,
      reviewedStoreCount: 2,
      draftCorrectionCount: 1,
    });
  });

  it("approves a submitted Region Manager package", async () => {
    const { approvalRepository, service } = createService();

    const result = await service.reviewRegionPackage({
      actor: admin(),
      periodKey: "2026-05",
      regionId,
      decision: "approve",
    });

    expect(approvalRepository.reviewRegionPackage).toHaveBeenCalledWith({
      periodKey: "2026-05",
      regionId,
      actorUserId: "admin-user",
      packageStatus: "admin_approved",
      reviewNote: null,
    });
    expect(result.data).toMatchObject({
      regionId,
      status: "admin_approved",
      reviewedByUserId: "admin-user",
    });
  });

  it("requires a note before returning a package", async () => {
    const { approvalRepository, service } = createService();

    await expect(
      service.reviewRegionPackage({
        actor: admin(),
        periodKey: "2026-05",
        regionId,
        decision: "return",
        reviewNote: " ",
      }),
    ).rejects.toThrow("Return note is required");
    expect(approvalRepository.reviewRegionPackage).not.toHaveBeenCalled();
  });

  it("rejects non-admin actors", async () => {
    const { service } = createService();

    await expect(
      service.listRegionPackages({
        actor: buildAuthenticatedUser({
          userId: "region-user",
          roleCodes: ["REGION_MANAGER"],
          readScope: { companyIds: [companyId], regionIds: [regionId], storeIds: [] },
        }),
        periodKey: "2026-05",
      }),
    ).rejects.toThrow(ForbiddenException);
  });
});
