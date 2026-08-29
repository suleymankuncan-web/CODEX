import "reflect-metadata";
import { plainToInstance } from "class-transformer";
import { validateSync } from "class-validator";
import { GetChecklistVisitPlanQueryDto } from "./get-checklist-visit-plan.query";
import { SaveChecklistVisitPlanDto } from "./save-checklist-visit-plan.dto";

describe("checklist visit plan DTOs", () => {
  it("accepts a typed weekly snapshot without imposing a 30-store cap", () => {
    const dto = plainToInstance(SaveChecklistVisitPlanDto, {
      expectedRevision: 0,
      idempotencyKey: "11111111-1111-4111-8111-111111111111",
      items: Array.from({ length: 35 }, (_, index) => ({
        storeId: `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
        plannedDate: "2026-07-14",
        displayOrder: index,
      })),
    });
    expect(validateSync(dto)).toHaveLength(0);
  });

  it("rejects malformed region, date and nested plan items", () => {
    expect(validateSync(plainToInstance(GetChecklistVisitPlanQueryDto, { regionId: "x", weekStart: "14-07-2026" }))).not.toHaveLength(0);
    expect(validateSync(plainToInstance(SaveChecklistVisitPlanDto, {
      expectedRevision: -1,
      idempotencyKey: "x",
      items: [{ storeId: "x", plannedDate: "Sunday", displayOrder: -1 }],
    }))).not.toHaveLength(0);
  });

  it("accepts manager identity as the weekly Report Viewer selector", () => {
    expect(validateSync(plainToInstance(GetChecklistVisitPlanQueryDto, {
      managerUserId: "11111111-1111-4111-8111-111111111111",
      weekStart: "2026-07-13",
    }))).toHaveLength(0);
  });
});
