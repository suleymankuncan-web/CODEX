import { buildAuthenticatedUser } from "../../auth/auth-context.service";
import { REQUIRED_ROLES_KEY } from "../../auth/decorators/roles.decorator";
import { REQUIRED_SCOPE_KEY } from "../../auth/decorators/scope.decorator";
import { AdminSalesTargetIncentiveController } from "./admin-sales-target-incentive.controller";
import { StoreSalesTargetIncentiveController } from "./store-sales-target-incentive.controller";

function createHarness() {
  const apiService = {
    getOwnStoreMeProjection: jest.fn(async () => ({ data: { projections: [] } })),
    getStoreProjection: jest.fn(async () => ({ data: { projections: [] } })),
    getAdminProjection: jest.fn(async () => ({ data: { projections: [] } })),
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
        AdminSalesTargetIncentiveController.prototype.createAdminIncentiveCorrection,
      ),
    ).toBe("authenticated");
  });
});
