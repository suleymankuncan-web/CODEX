import { validate } from "class-validator";
import { buildAuthenticatedUser } from "../../auth/auth-context.service";
import { REQUIRED_ROLES_KEY } from "../../auth/decorators/roles.decorator";
import { REQUIRED_SCOPE_KEY } from "../../auth/decorators/scope.decorator";
import { AdminSalesTargetIncentiveController } from "./admin-sales-target-incentive.controller";
import { CreateSalesTargetIncentiveCloseRunDto } from "./dto/create-sales-target-incentive-close-run.dto";
import { CreateSalesTargetIncentiveCorrectionDto } from "./dto/create-sales-target-incentive-correction.dto";
import { StoreSalesTargetIncentiveController } from "./store-sales-target-incentive.controller";

function createHarness() {
  const apiService = {
    getOwnStoreMeProjection: jest.fn(async () => ({ data: { projections: [] } })),
    getStoreProjection: jest.fn(async () => ({ data: { projections: [] } })),
    getAdminProjection: jest.fn(async () => ({ data: { projections: [] } })),
    getAdminCloseStatus: jest.fn(async () => ({ data: { closeRuns: [] } })),
    runAdminClose: jest.fn(async () => ({ data: { closeRuns: [] } })),
    applyAdminCorrection: jest.fn(async () => ({ data: { adjustmentId: "adjustment-1" } })),
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
  });
});
