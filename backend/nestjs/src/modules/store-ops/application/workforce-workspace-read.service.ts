import { ForbiddenException, Injectable } from "@nestjs/common";
import type { AuthenticatedUser } from "../../auth/auth-context.service";
import { WorkforceWorkspaceReadRepository } from "../infrastructure/workforce-workspace-read.repository";
import type {
  WorkforceSortDirection,
  WorkforceStoreSort,
  WorkforceStoreStatusFilter,
} from "../infrastructure/workforce-workspace-read.repository";
import type {
  WorkforceCommandWorkspace,
  WorkforceWorkspaceHistoryRow,
  WorkforceWorkspacePerson,
  WorkforceWorkspaceStore,
} from "./workforce-workspace.contract";
import { resolveWorkforceWorkspaceScope } from "./workforce-workspace-scope";

@Injectable()
export class WorkforceWorkspaceReadService {
  constructor(private readonly repository: WorkforceWorkspaceReadRepository) {}

  async getWorkspace(input: {
    actor: AuthenticatedUser;
    limit?: number;
    offset?: number;
    historyStoreId?: string;
    historyLimit?: number;
    historyOffset?: number;
    personnelStoreId?: string;
    personnelLimit?: number;
    personnelOffset?: number;
    query?: string;
    status?: WorkforceStoreStatusFilter;
    sort?: WorkforceStoreSort;
    direction?: WorkforceSortDirection;
  }): Promise<WorkforceCommandWorkspace> {
    const scope = resolveWorkforceWorkspaceScope({
      actorRoleCodes: input.actor.roleCodes,
      actorReadScope: input.actor.readScope,
      actorActionScope: input.actor.actionScope,
      roleScopes: input.actor.roleScopes,
    });
    if (!scope) throw new ForbiddenException("Workforce workspace is not available for this role");

    const limit = clamp(input.limit ?? 50, 1, 100);
    const offset = Math.max(input.offset ?? 0, 0);
    const historyLimit = clamp(input.historyLimit ?? 20, 1, 100);
    const historyOffset = Math.max(input.historyOffset ?? 0, 0);
    const personnelLimit = clamp(input.personnelLimit ?? 50, 1, 100);
    const personnelOffset = Math.max(input.personnelOffset ?? 0, 0);
    const query = input.query?.trim() ?? "";
    const status = input.status ?? "all";
    const sort = input.sort ?? "store";
    const direction = input.direction ?? "ascending";
    const hasScope = scope.readScope.companyIds.length
      + scope.readScope.regionIds.length
      + scope.readScope.storeIds.length > 0;

    if (!hasScope) {
      return emptyWorkspace(scope.view, scope.capabilities, limit, offset);
    }

    const [page, summaryRow] = await Promise.all([
      this.repository.listStorePage({ scope: scope.readScope, limit, offset, query, status, sort, direction }),
      this.repository.summarizeScope({ scope: scope.readScope }),
    ]);
    const personnelStoreId = input.personnelStoreId
      ?? (scope.view === "store_manager" ? page.items[0]?.store_id : undefined);
    if (personnelStoreId && !(await this.repository.isStoreInScope({ scope: scope.readScope, storeId: personnelStoreId }))) {
      throw new ForbiddenException("Requested personnel store is outside workforce read scope");
    }
    const personnelPage = personnelStoreId
      ? await this.repository.listActivePersonnel({
          scope: scope.readScope,
          storeId: personnelStoreId,
          limit: personnelLimit,
          offset: personnelOffset,
        })
      : { items: [], total: 0 };
    const personnelRows = personnelPage.items;
    const personnelByStore = groupBy(personnelRows, (row) => row.store_id);
    const stores = page.items.map((row): WorkforceWorkspaceStore => {
      const personnelRowsForStore = personnelByStore.get(row.store_id) ?? [];
      const norm = nullableNumber(row.planned_headcount);
      const active = Number(row.active_headcount);
      return {
        companyId: row.company_id,
        companyName: row.company_name,
        regionId: row.region_id,
        regionName: row.region_name,
        regionManagerName: row.region_manager_name,
        storeId: row.store_id,
        storeCode: row.store_code,
        storeName: row.store_name,
        storeStatus: row.store_status,
        norm,
        active,
        averageTenureDays: nullableNumber(row.average_tenure_days),
        gap: norm === null ? null : norm - active,
        shortageDays: row.shortage_days,
        personnel: personnelRowsForStore.map((person): WorkforceWorkspacePerson => ({
          employeeId: person.employee_id,
          displayName: person.display_name || "Personel adı mevcut değil",
          positionId: person.position_id,
          positionCode: person.position_code,
          positionName: person.position_name,
          assignmentStartDate: person.assignment_start_date,
          employmentStatus: person.employment_status,
        })),
        personnelTotal: row.store_id === personnelStoreId ? personnelPage.total : 0,
        personnelLimit,
        personnelOffset,
        personnelHasMore: personnelOffset + personnelRowsForStore.length
          < (row.store_id === personnelStoreId ? personnelPage.total : 0),
      };
    });

    let history: WorkforceCommandWorkspace["history"] = null;
    if (input.historyStoreId) {
      const allowed = await this.repository.isStoreInScope({
        scope: scope.readScope,
        storeId: input.historyStoreId,
      });
      if (!allowed) throw new ForbiddenException("Requested history store is outside workforce read scope");
      const historyPage = await this.repository.listHistory({
        scope: scope.readScope,
        storeId: input.historyStoreId,
        limit: historyLimit,
        offset: historyOffset,
      });
      history = {
        storeId: input.historyStoreId,
        items: historyPage.items.map((row): WorkforceWorkspaceHistoryRow => ({
          employeeId: row.employee_id,
          displayName: row.display_name || "Personel adı mevcut değil",
          entryDate: row.entry_date,
          exitDate: row.exit_date,
          totalWorkingDays: row.total_working_days,
        })),
        total: historyPage.total,
        limit: historyPage.limit,
        offset: historyPage.offset,
        hasMore: historyPage.offset + historyPage.items.length < historyPage.total,
      };
    }

    return {
      view: scope.view,
      summary: {
        totalStores: Number(summaryRow.total_stores),
        activePersonnel: Number(summaryRow.active_personnel),
        shortageStores: Number(summaryRow.shortage_stores),
        openPositions: Number(summaryRow.open_positions),
        averageTenureDays: nullableNumber(summaryRow.average_tenure_days),
      },
      stores: {
        items: stores,
        total: page.total,
        limit: page.limit,
        offset: page.offset,
        hasMore: page.offset + stores.length < page.total,
      },
      history,
      capabilities: scope.capabilities,
    };
  }
}

function emptyWorkspace(
  view: WorkforceCommandWorkspace["view"],
  capabilities: WorkforceCommandWorkspace["capabilities"],
  limit: number,
  offset: number,
): WorkforceCommandWorkspace {
  return {
    view,
    summary: {
      totalStores: 0,
      activePersonnel: 0,
      shortageStores: 0,
      openPositions: 0,
      averageTenureDays: null,
    },
    stores: { items: [], total: 0, limit, offset, hasMore: false },
    history: null,
    capabilities,
  };
}

function nullableNumber(value: string | null) {
  return value === null ? null : Number(value);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function groupBy<T, K>(items: T[], getKey: (item: T) => K) {
  const result = new Map<K, T[]>();
  for (const item of items) {
    const key = getKey(item);
    result.set(key, [...(result.get(key) ?? []), item]);
  }
  return result;
}
