import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import type { AuthenticatedUser } from "../../auth/auth-context.service";
import { TaskCommandWorkspaceReadRepository } from "../infrastructure/task-command-workspace-read.repository";
import type { StoreActionPlanStatus } from "./store-action-plan.contract";
import type { TaskCommandWorkspace } from "./task-command-workspace.contract";
import { resolveTaskCommandWorkspaceScope } from "./task-command-workspace-scope";

const resultStatuses: StoreActionPlanStatus[] = ["closed", "cancelled"];
const regionStatuses: StoreActionPlanStatus[] = ["solution_review_pending", "closed", "cancelled"];
const allStatuses: StoreActionPlanStatus[] = ["open", "in_progress", "blocked", "solution_review_pending", "correction_required", "closed", "cancelled"];

@Injectable()
export class TaskCommandWorkspaceReadService {
  constructor(private readonly repository: TaskCommandWorkspaceReadRepository) {}

  async getWorkspace(input: {
    actor: AuthenticatedUser; periodStart: string; periodEnd: string; limit?: number; offset?: number;
  }): Promise<TaskCommandWorkspace> {
    const scope = this.resolveScope(input.actor);
    const period = normalizePeriod(input.periodStart, input.periodEnd);
    const limit = clamp(input.limit ?? 20, 1, 100);
    const offset = Math.max(Math.trunc(input.offset ?? 0), 0);
    const page = await this.repository.readPage({
      companyIds: scope.companyIds, regionIds: scope.regionIds, storeIds: scope.storeIds,
      statuses: scope.view === "store_manager" ? allStatuses : scope.view === "region_manager" ? regionStatuses : resultStatuses,
      periodStart: period.periodStart, periodEnd: period.periodEnd,
      limit, offset, eventLimit: 3,
    });
    const items = page.items;
    return {
      view: scope.view,
      capabilities: scope.capabilities,
      items,
      summary: {
        retained: items.length,
        actionable: items.filter((item) => ["open", "in_progress", "blocked"].includes(item.status)).length,
        completed: items.filter((item) => item.status === "closed").length,
        cancelled: items.filter((item) => item.status === "cancelled").length,
        checklist: items.filter((item) => item.source.type === "checklist_remediation").length,
      },
      page: { total: page.total, limit, offset, count: items.length, hasMore: offset + items.length < page.total },
    };
  }

  async getEvents(input: {
    actor: AuthenticatedUser; actionPlanId: string; limit?: number; offset?: number;
  }) {
    const scope = this.resolveScope(input.actor);
    const limit = clamp(input.limit ?? 20, 1, 100);
    const offset = Math.max(Math.trunc(input.offset ?? 0), 0);
    const result = await this.repository.readEvents({
      actionPlanId: input.actionPlanId,
      companyIds: scope.companyIds, regionIds: scope.regionIds, storeIds: scope.storeIds,
      statuses: scope.view === "store_manager" ? allStatuses : scope.view === "region_manager" ? regionStatuses : resultStatuses,
      limit, offset,
    });
    if (!result) throw new NotFoundException("Task result was not found");
    return result;
  }

  private resolveScope(actor: AuthenticatedUser) {
    const scope = resolveTaskCommandWorkspaceScope({
      actorRoleCodes: actor.roleCodes, actorReadScope: actor.readScope,
      actorActionScope: actor.actionScope, roleScopes: actor.roleScopes,
    });
    if (!scope) throw new ForbiddenException("Task workspace is not available for this role");
    return scope;
  }
}

function normalizePeriod(periodStart: string, periodEnd: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(periodStart) || !/^\d{4}-\d{2}-\d{2}$/.test(periodEnd)) {
    throw new BadRequestException("periodStart and periodEnd must use YYYY-MM-DD");
  }
  if (periodStart > periodEnd) throw new BadRequestException("periodStart must be before periodEnd");
  return { periodStart, periodEnd };
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(Math.trunc(value), minimum), maximum);
}
