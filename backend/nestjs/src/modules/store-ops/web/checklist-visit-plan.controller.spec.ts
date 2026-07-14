import "reflect-metadata";
import { REQUIRED_ROLES_KEY } from "../../auth/decorators/roles.decorator";
import { REQUIRED_SCOPE_KEY } from "../../auth/decorators/scope.decorator";
import { ChecklistVisitPlanController } from "./checklist-visit-plan.controller";

describe("ChecklistVisitPlanController authorization metadata", () => {
  it("allows scoped reads for RV/RM/SM but writes only for RM", () => {
    const read = ChecklistVisitPlanController.prototype.getWeeklyPlan;
    const write = ChecklistVisitPlanController.prototype.saveWeeklyPlan;
    expect(Reflect.getMetadata(REQUIRED_SCOPE_KEY, read)).toBe("authenticated");
    expect(Reflect.getMetadata(REQUIRED_ROLES_KEY, read)).toEqual([
      "REPORT_VIEWER", "REGION_MANAGER", "STORE_MANAGER",
    ]);
    expect(Reflect.getMetadata(REQUIRED_SCOPE_KEY, write)).toBe("authenticated");
    expect(Reflect.getMetadata(REQUIRED_ROLES_KEY, write)).toEqual(["REGION_MANAGER"]);
  });

  it("keeps full-period planning and candidate search Region Manager-only", () => {
    const regions = ChecklistVisitPlanController.prototype.listRegionOptions;
    const period = ChecklistVisitPlanController.prototype.listPeriod;
    const candidates = ChecklistVisitPlanController.prototype.listCandidates;
    expect(Reflect.getMetadata(REQUIRED_SCOPE_KEY, period)).toBe("authenticated");
    expect(Reflect.getMetadata(REQUIRED_ROLES_KEY, period)).toEqual(["REGION_MANAGER"]);
    expect(Reflect.getMetadata(REQUIRED_SCOPE_KEY, candidates)).toBe("authenticated");
    expect(Reflect.getMetadata(REQUIRED_ROLES_KEY, candidates)).toEqual(["REGION_MANAGER"]);
    expect(Reflect.getMetadata(REQUIRED_SCOPE_KEY, regions)).toBe("authenticated");
    expect(Reflect.getMetadata(REQUIRED_ROLES_KEY, regions)).toEqual(["REGION_MANAGER"]);
  });
});
