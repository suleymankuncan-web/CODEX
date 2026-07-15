import "reflect-metadata";
import { plainToInstance } from "class-transformer";
import { validateSync } from "class-validator";
import { ListChecklistVisitPlanCandidatesQueryDto } from "./list-checklist-visit-plan-candidates.query";
import { ListChecklistVisitPlanPeriodQueryDto } from "./list-checklist-visit-plan-period.query";
import { ListChecklistVisitPlanRegionsQueryDto } from "./list-checklist-visit-plan-regions.query";

describe("checklist visit plan period DTOs", () => {
  it("caps region option pages and validates their bounded search", () => {
    expect(validateSync(plainToInstance(ListChecklistVisitPlanRegionsQueryDto, {
      query: "Marmara", limit: "50", offset: "200",
    }))).toHaveLength(0);
    expect(validateSync(plainToInstance(ListChecklistVisitPlanRegionsQueryDto, {
      limit: "51", offset: "-1",
    }))).toHaveLength(2);
  });
  it("accepts bounded period filters and candidate paging", () => {
    expect(validateSync(plainToInstance(ListChecklistVisitPlanPeriodQueryDto, {
      regionId: "11111111-1111-4111-8111-111111111111",
      period: "2026-07",
      query: "Merkez",
      risk: "medium",
      reason: "watch_checklist_result",
      planStatus: "planned",
      sort: "next_plan_asc",
      limit: 100,
      offset: 0,
    }))).toHaveLength(0);
    expect(validateSync(plainToInstance(ListChecklistVisitPlanCandidatesQueryDto, {
      regionId: "11111111-1111-4111-8111-111111111111",
      query: "%_\\",
      limit: 50,
      offset: 0,
    }))).toHaveLength(0);
  });

  it("rejects unknown semantics and unbounded candidate reads", () => {
    expect(validateSync(plainToInstance(ListChecklistVisitPlanPeriodQueryDto, {
      regionId: "x",
      period: "07-2026",
      risk: "critical",
      reason: "invented_reason",
      planStatus: "late",
      sort: "score_magic",
      limit: 101,
      offset: -1,
    }))).not.toHaveLength(0);
    expect(validateSync(plainToInstance(ListChecklistVisitPlanCandidatesQueryDto, {
      regionId: "11111111-1111-4111-8111-111111111111",
      query: "x".repeat(121),
      limit: 51,
    }))).not.toHaveLength(0);
  });
});
