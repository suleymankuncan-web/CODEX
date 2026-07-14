import { ForbiddenException, Injectable } from "@nestjs/common";
import type { AuthReadScope } from "../../auth/auth-context.service";
import { ChecklistCommandReadRepository } from "../infrastructure/checklist-command-read.repository";
import type {
  ChecklistCommandReadResult,
  ChecklistCommandSort,
  ChecklistCommandStatus,
} from "./checklist-command-read.contract";
import {
  resolveChecklistCommandReadScope,
  type ChecklistCommandReadScope,
} from "./checklist-command-read-scope";

type ListChecklistCommandInput = {
  actorRoleCodes: string[];
  actorReadScope: AuthReadScope;
  roleScopes?: Record<string, AuthReadScope>;
  period?: string;
  regionId?: string;
  query?: string;
  status?: ChecklistCommandStatus;
  sort?: ChecklistCommandSort;
  limit?: number;
  offset?: number;
};

@Injectable()
export class ChecklistCommandReadService {
  constructor(private readonly repository: ChecklistCommandReadRepository) {}

  async list(input: ListChecklistCommandInput): Promise<ChecklistCommandReadResult> {
    const scope = resolveChecklistCommandReadScope({
      actorRoleCodes: input.actorRoleCodes,
      actorReadScope: input.actorReadScope,
      roleScopes: input.roleScopes,
    });

    if (!scope) {
      throw new ForbiddenException("Checklist command view is not available for this role");
    }

    const limit = input.limit ?? 30;
    const offset = input.offset ?? 0;
    if (!hasReadScope(scope)) {
      return emptyResult(scope, input.period ?? currentIstanbulMonth(), limit, offset);
    }

    const result = await this.repository.list({
      companyIds: scope.companyIds,
      regionIds: scope.regionIds,
      storeIds: scope.storeIds,
      allowedTemplateTypes: scope.allowedTemplateTypes,
      period: input.period,
      regionId: input.regionId,
      query: input.query,
      status: input.status ?? "all",
      sort: input.sort ?? "store_asc",
      limit,
      offset,
    });

    return {
      period: result.period,
      view: scope.view,
      capabilities: readOnlyCapabilities(),
      metrics: result.metrics,
      items: result.items,
      page: {
        total: result.total,
        limit,
        offset,
        hasMore: offset + result.items.length < result.total,
      },
    };
  }
}

function hasReadScope(scope: ChecklistCommandReadScope) {
  return scope.companyIds.length + scope.regionIds.length + scope.storeIds.length > 0;
}

function readOnlyCapabilities() {
  return {
    weeklyVisitPlanningAvailable: false,
    canMaintainWeeklyVisitPlan: false,
  };
}

function emptyResult(
  scope: ChecklistCommandReadScope,
  period: string,
  limit: number,
  offset: number,
): ChecklistCommandReadResult {
  return {
    period,
    view: scope.view,
    capabilities: readOnlyCapabilities(),
    metrics: {
      totalStores: 0,
      needsVisit: 0,
      active: 0,
      pending: 0,
      completed: 0,
    },
    items: [],
    page: { total: 0, limit, offset, hasMore: false },
  };
}

function currentIstanbulMonth() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(new Date());
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  return `${year}-${month}`;
}
