import { ConflictException, ForbiddenException, Injectable } from "@nestjs/common";
import { createHash } from "node:crypto";
import type { AuthReadScope } from "../../auth/auth-context.service";
import { ChecklistVisitPlanRepository } from "../infrastructure/checklist-visit-plan.repository";
import type { SaveChecklistVisitPlanItem } from "./checklist-visit-plan.contract";
import { resolveChecklistVisitPlanScope } from "./checklist-visit-plan-scope";

type Actor = {
  actorUserId: string;
  actorRoleCodes: string[];
  actorReadScope: AuthReadScope;
  roleScopes?: Record<string, AuthReadScope>;
};

type WeeklyPlanInput = Actor & { regionId: string; weekStart: string };
type SaveWeeklyPlanInput = WeeklyPlanInput & {
  expectedRevision: number;
  idempotencyKey: string;
  items: SaveChecklistVisitPlanItem[];
};

@Injectable()
export class ChecklistVisitPlanService {
  constructor(private readonly repository: ChecklistVisitPlanRepository) {}

  async getWeeklyPlan(input: WeeklyPlanInput) {
    assertPlanWeek(input.weekStart);
    const scope = this.resolveScope(input);
    this.assertRegionAccess(scope, input.regionId);
    const result = await this.repository.getWeeklyPlan({
      regionId: input.regionId,
      weekStart: input.weekStart,
      companyIds: scope.companyIds,
      regionIds: scope.regionIds,
      storeIds: scope.storeIds,
    });
    return {
      ...result,
      view: scope.view,
      capabilities: { canMaintainWeeklyVisitPlan: scope.canMaintain },
    };
  }

  async saveWeeklyPlan(input: SaveWeeklyPlanInput) {
    assertPlanWeek(input.weekStart);
    const scope = this.resolveScope(input);
    if (!scope.canMaintain || scope.view !== "region_manager") {
      throw new ForbiddenException("Weekly visit planning is available only to the assigned Region Manager");
    }
    this.assertRegionAccess(scope, input.regionId);
    const duplicateKeys = new Set<string>();
    for (const item of input.items) {
      assertPlannedDate(input.weekStart, item.plannedDate);
      const key = `${item.storeId}:${item.plannedDate}`;
      if (duplicateKeys.has(key)) {
        throw new ConflictException("A store can be planned only once on the same date");
      }
      duplicateKeys.add(key);
    }
    const canonicalItems = [...input.items].sort((left, right) =>
      left.plannedDate.localeCompare(right.plannedDate) ||
      left.displayOrder - right.displayOrder ||
      left.storeId.localeCompare(right.storeId),
    );
    const requestSha256 = createHash("sha256")
      .update(JSON.stringify({ regionId: input.regionId, weekStart: input.weekStart, items: canonicalItems }))
      .digest("hex");
    const result = await this.repository.saveWeeklyPlan({
      regionId: input.regionId,
      weekStart: input.weekStart,
      actorUserId: input.actorUserId,
      expectedRevision: input.expectedRevision,
      idempotencyKey: input.idempotencyKey,
      requestSha256,
      items: canonicalItems,
    });
    return {
      ...result,
      view: scope.view,
      capabilities: { canMaintainWeeklyVisitPlan: true },
    };
  }

  private resolveScope(input: Actor) {
    const scope = resolveChecklistVisitPlanScope(input);
    if (!scope) throw new ForbiddenException("Weekly visit plans are not available for this role");
    return scope;
  }

  private assertRegionAccess(scope: ReturnType<typeof resolveChecklistVisitPlanScope> & {}, regionId: string) {
    if (scope.view === "region_manager" && !scope.regionIds.includes(regionId)) {
      throw new ForbiddenException("Weekly visit plan is outside the assigned region scope");
    }
  }
}

function assertPlanWeek(weekStart: string) {
  const date = parseIsoDate(weekStart);
  if (!date || date.getUTCDay() !== 1) {
    throw new ConflictException("Weekly visit plan must start on Monday");
  }
}

function assertPlannedDate(weekStart: string, plannedDate: string) {
  const start = parseIsoDate(weekStart);
  const planned = parseIsoDate(plannedDate);
  if (!start || !planned) throw new ConflictException("Weekly visit plan contains an invalid date");
  const day = Math.round((planned.getTime() - start.getTime()) / 86_400_000);
  if (day < 0 || day > 5) {
    throw new ConflictException("Visits can be planned only from Monday through Saturday of the selected week");
  }
}

function parseIsoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value ? null : date;
}
