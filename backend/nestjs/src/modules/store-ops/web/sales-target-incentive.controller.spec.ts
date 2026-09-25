import { validate } from "class-validator";
import { buildAuthenticatedUser } from "../../auth/auth-context.service";
import { REQUIRED_ROLES_KEY } from "../../auth/decorators/roles.decorator";
import { REQUIRED_SCOPE_KEY } from "../../auth/decorators/scope.decorator";
import { AdminSalesTargetIncentiveController } from "./admin-sales-target-incentive.controller";
import { CreateSalesTargetIncentiveCloseRunDto } from "./dto/create-sales-target-incentive-close-run.dto";
import { CreateSalesTargetIncentiveCorrectionDto } from "./dto/create-sales-target-incentive-correction.dto";
import { CreateSalesTargetIncentiveRegionCorrectionDto } from "./dto/create-sales-target-incentive-region-correction.dto";
import { MarkSalesTargetIncentiveStoreReviewDto } from "./dto/mark-sales-target-incentive-store-review.dto";
import { ReviewSalesTargetIncentiveRegionPackageDto } from "./dto/review-sales-target-incentive-region-package.dto";
import { SubmitSalesTargetIncentiveRegionPackageDto } from "./dto/submit-sales-target-incentive-region-package.dto";
import { VoidSalesTargetIncentiveRegionCorrectionDto } from "./dto/void-sales-target-incentive-region-correction.dto";
import { StoreSalesTargetIncentiveController } from "./store-sales-target-incentive.controller";

function createHarness() {
  const apiService = {
    getOwnStoreMeProjection: jest.fn(async () => ({ data: { projections: [] } })),
    getStoreProjection: jest.fn(async () => ({ data: { projections: [] } })),
    getAdminProjection: jest.fn(async () => ({ data: { projections: [] } })),
    getAdminCloseStatus: jest.fn(async () => ({ data: { closeRuns: [] } })),
    runAdminClose: jest.fn(async () => ({ data: { closeRuns: [] } })),
    applyAdminCorrection: jest.fn(async () => ({ data: { adjustmentId: "adjustment-1" } })),
    reviewRegionPackage: jest.fn(async () => ({ data: { status: "admin_approved" } })),
    markStoreReview: jest.fn(async () => ({ data: { reviewStatus: "reviewed" } })),
    createRegionCorrection: jest.fn(async () => ({ data: { correctionId: "correction-1" } })),
    voidRegionCorrection: jest.fn(async () => ({ data: { correctionId: "correction-1" } })),
    submitRegionPackage: jest.fn(async () => ({ data: { regionPackageStatus: "submitted" } })),
  };

  return {
    apiService,
    storeController: new StoreSalesTargetIncentiveController(apiService as never),
    adminController: new AdminSalesTargetIncentiveController(apiService as never),
  };
}

const request = {
  user: buildAuthenticatedUser({
    userId: "00000000-0000-4000-8000-000000000901",
    employeeId: "00000000-0000-4000-8000-000000000501",
    roleCodes: ["STORE_PERSONNEL"],
    readScope: {
      companyIds: ["00000000-0000-4000-8000-000000000001"],
      regionIds: ["00000000-0000-4000-8000-000000000101"],
      storeIds: ["00000000-0000-4000-8000-000000000201"],
    },
  }),
};

describe("SalesTargetIncentive controllers", () => {
  it("delegates Store Me incentive reads with actor context and period", async () => {
    const { apiService, storeController } = createHarness();

    await storeController.getOwnIncentiveProjection(request, { period: "2026-05" });

    expect(apiService.getOwnStoreMeProjection).toHaveBeenCalledWith({
      actor: request.user,
      periodKey: "2026-05",
    });
  });

  it("delegates Store incentives reads with actor context and period", async () => {
    const { apiService, storeController } = createHarness();

    await storeController.getStoreIncentiveProjection(request, { period: "2026-05" });

    expect(apiService.getStoreProjection).toHaveBeenCalledWith({
      actor: request.user,
      periodKey: "2026-05",
    });
  });

  it("delegates admin incentive reads without enabling mutations", async () => {
    const { adminController, apiService } = createHarness();

    await adminController.getAdminIncentiveProjection(request, { period: "2026-05" });

    expect(apiService.getAdminProjection).toHaveBeenCalledWith({
      actor: request.user,
      periodKey: "2026-05",
    });
  });

  it("delegates admin incentive close status reads with cutoff context", async () => {
    const { adminController, apiService } = createHarness();

    await adminController.getAdminIncentiveCloseStatus(request, {
      period: "2026-05",
      closeCutoffAt: "2026-06-01T02:00:00.000+03:00",
    });

    expect(apiService.getAdminCloseStatus).toHaveBeenCalledWith({
      actor: request.user,
      periodKey: "2026-05",
      closeCutoffAt: "2026-06-01T02:00:00.000+03:00",
    });
  });

  it("delegates admin incentive close runs with actor context", async () => {
    const { adminController, apiService } = createHarness();
    const body = {
      period: "2026-05",
      closeCutoffAt: "2026-06-01T02:00:00.000+03:00",
    };

    await adminController.createAdminIncentiveCloseRun(request, body);

    expect(apiService.runAdminClose).toHaveBeenCalledWith({
      actor: request.user,
      periodKey: "2026-05",
      closeCutoffAt: "2026-06-01T02:00:00.000+03:00",
    });
  });

  it("delegates admin incentive corrections with actor context", async () => {
    const { adminController, apiService } = createHarness();
    const body = {
      period: "2026-05",
      storeId: "00000000-0000-4000-8000-000000000201",
      employeeId: "00000000-0000-4000-8000-000000000501",
      participantType: "personnel" as const,
      adjustmentAmount: "125.25",
      reasonCode: "manual_review",
      reasonNote: "Admin onayli duzeltme",
    };

    await adminController.createAdminIncentiveCorrection(request, body);

    expect(apiService.applyAdminCorrection).toHaveBeenCalledWith({
      actor: request.user,
      periodKey: "2026-05",
      storeId: body.storeId,
      employeeId: body.employeeId,
      participantType: body.participantType,
      adjustmentAmount: body.adjustmentAmount,
      reasonCode: body.reasonCode,
      reasonNote: body.reasonNote,
    });
  });

  it("delegates admin Region Manager package reviews with actor context", async () => {
    const { adminController, apiService } = createHarness();
    const body = {
      period: "2026-05",
      regionId: "00000000-0000-4000-8000-000000000101",
      decision: "return" as const,
      reviewNote: "Eksik kontrol notu",
    };

    await adminController.reviewRegionPackage(request, body);

    expect(apiService.reviewRegionPackage).toHaveBeenCalledWith({
      actor: request.user,
      periodKey: body.period,
      regionId: body.regionId,
      decision: body.decision,
      reviewNote: body.reviewNote,
    });
  });

  it("delegates Region Manager store review commands with actor context", async () => {
    const { apiService, storeController } = createHarness();
    const body = {
      period: "2026-05",
      storeId: "00000000-0000-4000-8000-000000000201",
      reviewStatus: "reviewed" as const,
    };

    await storeController.markStoreReview(request, body);

    expect(apiService.markStoreReview).toHaveBeenCalledWith({
      actor: request.user,
      periodKey: body.period,
      storeId: body.storeId,
      reviewStatus: body.reviewStatus,
    });
  });

  it("delegates Region Manager draft correction commands with actor context", async () => {
    const { apiService, storeController } = createHarness();
    const body = {
      period: "2026-05",
      storeId: "00000000-0000-4000-8000-000000000201",
      employeeId: "00000000-0000-4000-8000-000000000501",
      participantType: "personnel" as const,
      finalAmount: "4000.00",
      reasonNote: "Bolge kontrol duzeltmesi",
    };

    await storeController.createRegionCorrection(request, body);

    expect(apiService.createRegionCorrection).toHaveBeenCalledWith({
      actor: request.user,
      periodKey: body.period,
      storeId: body.storeId,
      employeeId: body.employeeId,
      participantType: body.participantType,
      finalAmount: body.finalAmount,
      reasonNote: body.reasonNote,
    });
  });

  it("delegates Region Manager correction void commands with actor context", async () => {
    const { apiService, storeController } = createHarness();
    const body = {
      period: "2026-05",
      correctionId: "00000000-0000-4000-8000-000000000951",
    };

    await storeController.voidRegionCorrection(request, body);

    expect(apiService.voidRegionCorrection).toHaveBeenCalledWith({
      actor: request.user,
      periodKey: body.period,
      correctionId: body.correctionId,
    });
  });

  it("delegates Region Manager package submissions with actor context", async () => {
    const { apiService, storeController } = createHarness();
    const body = {
      period: "2026-05",
      companyId: "00000000-0000-4000-8000-000000000001",
      submissionNote: "Kontrol tamamlandi",
    };

    await storeController.submitRegionPackage(request, body);

    expect(apiService.submitRegionPackage).toHaveBeenCalledWith({
      actor: request.user,
      periodKey: body.period,
      companyId: body.companyId,
      submissionNote: body.submissionNote,
    });
  });

  it("accepts PostgreSQL UUID target ids for admin incentive corrections", async () => {
    const body = Object.assign(new CreateSalesTargetIncentiveCorrectionDto(), {
      period: "2026-05",
      storeId: "00000000-0000-0000-0000-000000000201",
      employeeId: "00000000-0000-0000-0000-000000000501",
      participantType: "personnel",
      adjustmentAmount: "125.25",
      reasonCode: "manual_review",
      reasonNote: "Admin onayli duzeltme",
    });

    await expect(validate(body)).resolves.toHaveLength(0);
  });

  it("accepts ISO close cutoffs for admin incentive close runs", async () => {
    const body = Object.assign(new CreateSalesTargetIncentiveCloseRunDto(), {
      period: "2026-05",
      closeCutoffAt: "2026-06-01T02:00:00.000+03:00",
    });

    await expect(validate(body)).resolves.toHaveLength(0);
  });

  it("accepts Region Manager workflow DTO payloads", async () => {
    const reviewBody = Object.assign(new MarkSalesTargetIncentiveStoreReviewDto(), {
      period: "2026-05",
      storeId: "00000000-0000-0000-0000-000000000201",
      reviewStatus: "reviewed",
    });
    const correctionBody = Object.assign(new CreateSalesTargetIncentiveRegionCorrectionDto(), {
      period: "2026-05",
      storeId: "00000000-0000-0000-0000-000000000201",
      employeeId: "00000000-0000-0000-0000-000000000501",
      participantType: "personnel",
      finalAmount: "0.00",
      reasonNote: "Kontrol duzeltmesi",
    });
    const voidBody = Object.assign(new VoidSalesTargetIncentiveRegionCorrectionDto(), {
      period: "2026-05",
      correctionId: "00000000-0000-0000-0000-000000000951",
    });
    const submitBody = Object.assign(new SubmitSalesTargetIncentiveRegionPackageDto(), {
      period: "2026-05",
      companyId: "00000000-0000-0000-0000-000000000001",
      submissionNote: "Kontrol tamamlandi",
    });

    await expect(validate(reviewBody)).resolves.toHaveLength(0);
    await expect(validate(correctionBody)).resolves.toHaveLength(0);
    await expect(validate(voidBody)).resolves.toHaveLength(0);
    await expect(validate(submitBody)).resolves.toHaveLength(0);
  });

  it("accepts admin Region Manager package review DTO payloads", async () => {
    const approveBody = Object.assign(new ReviewSalesTargetIncentiveRegionPackageDto(), {
      period: "2026-05",
      regionId: "00000000-0000-0000-0000-000000000101",
      decision: "approve",
    });
    const returnBody = Object.assign(new ReviewSalesTargetIncentiveRegionPackageDto(), {
      period: "2026-05",
      regionId: "00000000-0000-0000-0000-000000000101",
      decision: "return",
      reviewNote: "Revizyon gerekli",
    });

    await expect(validate(approveBody)).resolves.toHaveLength(0);
    await expect(validate(returnBody)).resolves.toHaveLength(0);
  });

  it("rejects invalid Region Manager workflow DTO payloads", async () => {
    const invalidReview = Object.assign(new MarkSalesTargetIncentiveStoreReviewDto(), {
      period: "2026-99",
      storeId: "not-a-uuid",
      reviewStatus: "approved",
    });
    const invalidCorrection = Object.assign(new CreateSalesTargetIncentiveRegionCorrectionDto(), {
      period: "2026-00",
      storeId: "00000000-0000-0000-0000-000000000201",
      employeeId: "00000000-0000-0000-0000-000000000501",
      participantType: "cashier",
      finalAmount: "-1.00",
      reasonNote: " ",
    });

    await expect(validate(invalidReview)).resolves.toHaveLength(3);
    await expect(validate(invalidCorrection)).resolves.toHaveLength(4);
  });

  it("keeps role visibility narrow for V1 read endpoints", () => {
    expect(
      Reflect.getMetadata(
        REQUIRED_ROLES_KEY,
        StoreSalesTargetIncentiveController.prototype.getOwnIncentiveProjection,
      ),
    ).toEqual(["STORE_PERSONNEL"]);
    expect(
      Reflect.getMetadata(
        REQUIRED_ROLES_KEY,
        StoreSalesTargetIncentiveController.prototype.getStoreIncentiveProjection,
      ),
    ).toEqual(["STORE_MANAGER", "REGION_MANAGER"]);
    expect(
      Reflect.getMetadata(
        REQUIRED_ROLES_KEY,
        AdminSalesTargetIncentiveController.prototype.getAdminIncentiveProjection,
      ),
    ).toEqual(["SUPER_ADMIN"]);
    expect(
      Reflect.getMetadata(
        REQUIRED_ROLES_KEY,
        AdminSalesTargetIncentiveController.prototype.getAdminIncentiveCloseStatus,
      ),
    ).toEqual(["SUPER_ADMIN"]);
    expect(
      Reflect.getMetadata(
        REQUIRED_ROLES_KEY,
        AdminSalesTargetIncentiveController.prototype.createAdminIncentiveCloseRun,
      ),
    ).toEqual(["SUPER_ADMIN"]);
    expect(
      Reflect.getMetadata(
        REQUIRED_ROLES_KEY,
        AdminSalesTargetIncentiveController.prototype.createAdminIncentiveCorrection,
      ),
    ).toEqual(["SUPER_ADMIN"]);
    expect(
      Reflect.getMetadata(
        REQUIRED_ROLES_KEY,
        AdminSalesTargetIncentiveController.prototype.reviewRegionPackage,
      ),
    ).toEqual(["SUPER_ADMIN"]);
    for (const handler of [
      StoreSalesTargetIncentiveController.prototype.markStoreReview,
      StoreSalesTargetIncentiveController.prototype.createRegionCorrection,
      StoreSalesTargetIncentiveController.prototype.voidRegionCorrection,
      StoreSalesTargetIncentiveController.prototype.submitRegionPackage,
    ]) {
      expect(Reflect.getMetadata(REQUIRED_ROLES_KEY, handler)).toEqual(["REGION_MANAGER"]);
    }
  });

  it("requires authenticated scope on every incentive read endpoint", () => {
    expect(
      Reflect.getMetadata(
        REQUIRED_SCOPE_KEY,
        StoreSalesTargetIncentiveController.prototype.getOwnIncentiveProjection,
      ),
    ).toBe("authenticated");
    expect(
      Reflect.getMetadata(
        REQUIRED_SCOPE_KEY,
        StoreSalesTargetIncentiveController.prototype.getStoreIncentiveProjection,
      ),
    ).toBe("authenticated");
    expect(
      Reflect.getMetadata(
        REQUIRED_SCOPE_KEY,
        AdminSalesTargetIncentiveController.prototype.getAdminIncentiveProjection,
      ),
    ).toBe("authenticated");
    expect(
      Reflect.getMetadata(
        REQUIRED_SCOPE_KEY,
        AdminSalesTargetIncentiveController.prototype.getAdminIncentiveCloseStatus,
      ),
    ).toBe("authenticated");
    expect(
      Reflect.getMetadata(
        REQUIRED_SCOPE_KEY,
        AdminSalesTargetIncentiveController.prototype.createAdminIncentiveCloseRun,
      ),
    ).toBe("authenticated");
    expect(
      Reflect.getMetadata(
        REQUIRED_SCOPE_KEY,
        AdminSalesTargetIncentiveController.prototype.createAdminIncentiveCorrection,
      ),
    ).toBe("authenticated");
    expect(
      Reflect.getMetadata(
        REQUIRED_SCOPE_KEY,
        AdminSalesTargetIncentiveController.prototype.reviewRegionPackage,
      ),
    ).toBe("authenticated");
    for (const handler of [
      StoreSalesTargetIncentiveController.prototype.markStoreReview,
      StoreSalesTargetIncentiveController.prototype.createRegionCorrection,
      StoreSalesTargetIncentiveController.prototype.voidRegionCorrection,
      StoreSalesTargetIncentiveController.prototype.submitRegionPackage,
    ]) {
      expect(Reflect.getMetadata(REQUIRED_SCOPE_KEY, handler)).toBe("authenticated");
    }
  });
});
