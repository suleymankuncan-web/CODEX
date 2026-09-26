import { RegionManagerDirectoryService } from "./region-manager-directory.service";
import { BadRequestException, ForbiddenException, Injectable } from "@nestjs/common";
import type { AuthenticatedUser } from "../../auth/auth-context.service";
import { parseTargetDistributionAllocations } from "../infrastructure/target-distribution-contract";
import {
  TargetWorkspaceReadRepository,
  type TargetWorkspaceHierarchyRow,
  type TargetWorkspaceMonthStatusRow,
  type TargetWorkspacePersonnelRow,
  type TargetWorkspaceStoreRow,
} from "../infrastructure/target-workspace-read.repository";
import {
  TARGET_WORKSPACE_TIMEZONE,
  type TargetWorkspaceCompany,
  type TargetWorkspaceMonthStatus,
  type TargetWorkspacePersonnel,
  type TargetWorkspaceRequest,
  type TargetWorkspaceResult,
  type TargetWorkspaceStatus,
  type TargetWorkspaceStore,
  type TargetWorkspaceWarning,
} from "./target-workspace.contract";
import { resolveTargetWorkspaceScope } from "./target-workspace-scope";

@Injectable()
export class TargetWorkspaceReadService {
  constructor(private readonly repository: TargetWorkspaceReadRepository, private readonly directory: RegionManagerDirectoryService) {}

  async getWorkspace(input: {
    actor: AuthenticatedUser;
    regionManagerUserId?: string;
    periodKey?: string;
    historyYear?: number;
    limit?: number;
    offset?: number;
  }): Promise<TargetWorkspaceResult> {
    const scope = resolveTargetWorkspaceScope({
      actorRoleCodes: input.actor.roleCodes,
      actorReadScope: input.actor.readScope,
      actorActionScope: input.actor.actionScope,
      roleScopes: input.actor.roleScopes,
    });
    if (!scope) throw new ForbiddenException("Targets workspace is not available for this role");

    const period = monthlyBounds(input.periodKey ?? currentPeriod());
    const historyYear = input.historyYear ?? Number(period.period.slice(0, 4));
    if (!Number.isInteger(historyYear) || historyYear < 2000 || historyYear > 2100) {
      throw new BadRequestException("Targets history year is outside the supported range");
    }
    const limit = Math.min(Math.max(input.limit ?? 50, 1), 100);
    const offset = Math.max(input.offset ?? 0, 0);

    if (scope.readScope.companyIds.length + scope.readScope.regionIds.length + scope.readScope.storeIds.length === 0) {
      return emptyWorkspace({ period, historyYear, view: scope.view, capabilities: scope.capabilities, limit, offset });
    }

    if (input.regionManagerUserId) {
      if (scope.view !== "report_viewer") throw new ForbiddenException("Manager selection requires company reporting access");
      const directory = await this.directory.list(input.actor);
      const selected = directory.items.find(item => item.userId === input.regionManagerUserId);
      if (!selected?.storeIds.length) {
        return emptyWorkspace({ period, historyYear, view: scope.view, capabilities: scope.capabilities, limit, offset });
      }
      scope.readScope = { ...scope.readScope, storeIds: selected.storeIds };
    }

    const page = await this.repository.listStorePage({
      scope: scope.readScope,
      periodStart: period.periodStart,
      periodEnd: period.periodEnd,
      limit,
      offset,
    });
    const storeIds = page.items.map((row) => row.store_id);
    const [hierarchyResult, summaryResult, personnelResult, monthResult] = await Promise.allSettled([
      this.repository.listHierarchy({
        scope: scope.readScope,
        periodEnd: period.periodEnd,
        ...(scope.view === "region_manager"
          ? { managerUserId: input.actor.userId }
          : input.regionManagerUserId
            ? { managerUserId: input.regionManagerUserId }
            : {}),
      }),
      this.repository.summarizeScope({ scope: scope.readScope, periodStart: period.periodStart }),
      this.repository.listPersonnel({ storeIds, periodEnd: period.periodEnd }),
      this.repository.listMonthStatuses({
        storeIds,
        yearStart: `${historyYear}-01-01`,
        yearEnd: `${historyYear}-12-31`,
      }),
    ]);
    const warnings: TargetWorkspaceWarning[] = [];
    const hierarchyRows = hierarchyResult.status === "fulfilled" ? hierarchyResult.value : [];
    if (hierarchyResult.status === "rejected") warnings.push("hierarchy_unavailable");
    const summary = summaryResult.status === "fulfilled" ? summaryResult.value : null;
    if (summaryResult.status === "rejected") warnings.push("summary_unavailable");
    const personnelRows = personnelResult.status === "fulfilled" ? personnelResult.value : [];
    if (personnelResult.status === "rejected") warnings.push("personnel_unavailable");
    const monthRows = monthResult.status === "fulfilled" ? monthResult.value : [];
    if (monthResult.status === "rejected") warnings.push("month_statuses_unavailable");
    if (monthRows.some((row) => row.approved_source_count > 1)) warnings.push("approval_basis_conflict");
    const personnelByStore = groupBy(personnelRows, (row) => row.store_id);
    const monthsByStore = groupBy(monthRows, (row) => row.store_id);
    const actionable = new Set(scope.actionableStoreIds);
    const stores = page.items.map((row) => toStore({
      row,
      view: scope.view,
      canAct: actionable.has(row.store_id),
      personnelRows: personnelByStore.get(row.store_id) ?? [],
      monthRows: monthsByStore.get(row.store_id) ?? [],
      historyYear,
    }));
    const companies = buildHierarchy(hierarchyRows, stores);

    return {
      ...period,
      periodTimezone: TARGET_WORKSPACE_TIMEZONE,
      historyYear,
      view: scope.view,
      capabilities: scope.capabilities,
      pagination: {
        total: page.total,
        limit: page.limit,
        offset: page.offset,
        hasMore: page.offset + page.items.length < page.total,
      },
      sections: {
        hierarchy: { status: hierarchyResult.status === "fulfilled" ? "available" : "unavailable" },
        summary: { status: summaryResult.status === "fulfilled" ? "available" : "unavailable" },
        personnel: { status: personnelResult.status === "fulfilled" ? "available" : "unavailable" },
        monthStatuses: { status: monthResult.status === "fulfilled" ? "available" : "unavailable" },
      },
      warnings,
      summary,
      companies,
    };
  }
}

type HierarchyStore = {
  companyId: string;
  companyName: string | null;
  regionId: string;
  regionName: string | null;
  regionManagerName: string | null;
  store: TargetWorkspaceStore;
};

function toStore(input: {
  row: TargetWorkspaceStoreRow;
  view: "report_viewer" | "region_manager" | "store_manager";
  canAct: boolean;
  personnelRows: TargetWorkspacePersonnelRow[];
  monthRows: TargetWorkspaceMonthStatusRow[];
  historyYear: number;
}): HierarchyStore {
  const parsedAllocations = parseTargetDistributionAllocations(input.row.allocation_json);
  const allocationByEmployee = new Map(parsedAllocations.map((allocation) => [allocation.employeeId, allocation]));
  const personnel: TargetWorkspacePersonnel[] = input.personnelRows.map((row) => {
    const allocation = allocationByEmployee.get(row.employee_id);
    allocationByEmployee.delete(row.employee_id);
    return {
      employeeId: row.employee_id,
      displayName: row.display_name,
      positionCode: row.position_code,
      positionLabel: row.position_name,
      actualSales: row.actual_sales ?? null,
      hireDate: row.hire_date ?? null,
      terminationDate: row.termination_date ?? null,
      targetValue: allocation ? formatDecimal(allocation.targetValue) : null,
      eligibilityStatus: row.is_historical ? "historical_allocation" as const : "targetable" as const,
    };
  });
  for (const allocation of allocationByEmployee.values()) {
    personnel.push({
      employeeId: allocation.employeeId,
      displayName: allocation.assigneeLabel,
      positionCode: null,
      positionLabel: null,
      targetValue: formatDecimal(allocation.targetValue),
          ...(allocation.distributionDays === undefined ? {} : { distributionDays: allocation.distributionDays }),
      eligibilityStatus: "historical_allocation" as const,
    });
  }
  const approvalMode = classifyWorkspaceApprovalEvidence(
    input.row.approval_evidence_json,
    input.row.request_status === "approved",
  );
  const request = input.row.request_id && input.row.request_status && input.row.target_label
    && input.row.total_target_value !== null && input.row.created_at && input.row.updated_at
    ? {
        requestId: input.row.request_id,
        status: normalizeRequestStatus(input.row.request_status),
        targetLabel: input.row.target_label,
        totalTargetValue: input.row.total_target_value,
        allocationCount: input.row.allocation_count ?? parsedAllocations.length,
        requestReason: input.row.request_reason,
        approvalMode,
        approvedAt: input.row.approved_at,
        approvalNote: input.row.approval_note,
        createdAt: input.row.created_at,
        updatedAt: input.row.updated_at,
        allocations: parsedAllocations.map((allocation) => ({
          employeeId: allocation.employeeId,
          displayName: allocation.assigneeLabel,
          targetValue: formatDecimal(allocation.targetValue),
          ...(allocation.distributionDays === undefined ? {} : { distributionDays: allocation.distributionDays }),
          note: allocation.note ?? null,
        })),
      }
    : null;
  return {
    companyId: input.row.company_id,
    companyName: input.row.company_name,
    regionId: input.row.region_id,
    regionName: input.row.region_name,
    regionManagerName: input.row.region_manager_name,
    store: {
      storeId: input.row.store_id,
      storeCode: input.row.store_code,
      storeName: input.row.store_name,
      city: null,
      storeStatus: input.row.store_status,
      status: resolveStatus(input.row, approvalMode),
      capabilities: {
        canCreateRequest: input.view === "store_manager" && input.canAct,
        canApproveRequest: input.view === "region_manager" && input.canAct,
      },
      request,
      personnel,
      monthStatuses: buildMonthStatuses(input.historyYear, input.monthRows),
    },
  };
}

function buildHierarchy(metadataRows: TargetWorkspaceHierarchyRow[], stores: HierarchyStore[]): TargetWorkspaceCompany[] {
  const companies = new Map<string, TargetWorkspaceCompany>();
  for (const row of metadataRows) {
    const company = companies.get(row.company_id) ?? {
      companyId: row.company_id, companyName: row.company_name, regions: [],
    };
    if (row.region_id === null) {
      companies.set(row.company_id, company);
      continue;
    }
    let region = company.regions.find((item) => item.regionId === row.region_id);
    if (!region) {
      region = {
        regionId: row.region_id,
        regionName: row.region_name,
        regionManager: {
          displayName: row.region_manager_name,
          identityStatus: row.region_manager_name
            ? "resolved"
            : row.manager_assignment_exists ? "unavailable" : "unassigned",
        },
        stores: [],
      };
      company.regions.push(region);
    }
    companies.set(row.company_id, company);
  }
  for (const row of stores) {
    const company = companies.get(row.companyId) ?? {
      companyId: row.companyId, companyName: row.companyName, regions: [],
    };
    let region = company.regions.find((item) => item.regionId === row.regionId);
    if (!region) {
      region = {
        regionId: row.regionId,
        regionName: row.regionName,
        regionManager: {
          displayName: row.regionManagerName,
          identityStatus: row.regionManagerName ? "resolved" : "unavailable",
        },
        stores: [],
      };
      company.regions.push(region);
    }
    region.stores.push(row.store);
    companies.set(row.companyId, company);
  }
  return [...companies.values()];
}

function buildMonthStatuses(year: number, rows: TargetWorkspaceMonthStatusRow[]): TargetWorkspaceMonthStatus[] {
  const persisted = new Map(rows.map((row) => [String(row.request_month).slice(0, 7), row]));
  return Array.from({ length: 12 }, (_, index) => {
    const period = `${year}-${String(index + 1).padStart(2, "0")}`;
    const row = persisted.get(period);
    const status = row ? resolveMonthStatus(row) : "unknown";
    const approvalStatus = row && row.approved_source_count === 1 && row.approved_source_status === "approved"
      ? classifyWorkspaceApprovalEvidence(row.approved_source_evidence_json, true) === "adjusted"
        ? "adjusted_approved" as const
        : "approved" as const
      : null;
    return { period, status, approvalStatus, isApproved: approvalStatus !== null };
  });
}

function resolveMonthStatus(row: TargetWorkspaceMonthStatusRow): TargetWorkspaceMonthStatus["status"] {
  if (row.request_status === "pending_region_approval") return "pending";
  if (row.request_status === "rejected") return "returned";
  if (row.request_status === "approved") {
    return classifyWorkspaceApprovalEvidence(row.approval_evidence_json, true) === "adjusted"
      ? "adjusted_approved"
      : "approved";
  }
  return "unknown";
}

function resolveStatus(row: TargetWorkspaceStoreRow, approvalMode: "direct" | "adjusted" | null): TargetWorkspaceStatus {
  if (row.has_revision_conflict) return "revision_conflict";
  if (row.has_stale_reference) return "stale_reference";
  if (!row.request_id || !row.request_status) return "missing";
  if (row.request_status === "pending_region_approval") return "pending";
  if (row.request_status === "rejected") return "returned";
  if (row.request_status === "approved") return approvalMode === "adjusted" ? "adjusted_approved" : "approved";
  return "unknown";
}

function normalizeRequestStatus(status: string): TargetWorkspaceRequest["status"] {
  return status === "pending_region_approval" || status === "approved" || status === "rejected"
    ? status
    : "unknown" as const;
}

function monthlyBounds(period: string) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) throw new BadRequestException("Invalid Targets period");
  const [year, month] = period.split("-").map(Number);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return { period, periodStart: `${period}-01`, periodEnd: `${period}-${String(lastDay).padStart(2, "0")}` };
}

function currentPeriod() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TARGET_WORKSPACE_TIMEZONE, year: "numeric", month: "2-digit",
  }).formatToParts(new Date());
  return `${parts.find((part) => part.type === "year")?.value}-${parts.find((part) => part.type === "month")?.value}`;
}

function emptyWorkspace(input: {
  period: { period: string; periodStart: string; periodEnd: string };
  historyYear: number;
  view: "report_viewer" | "region_manager" | "store_manager";
  capabilities: TargetWorkspaceResult["capabilities"];
  limit: number;
  offset: number;
}): TargetWorkspaceResult {
  return {
    ...input.period,
    periodTimezone: TARGET_WORKSPACE_TIMEZONE,
    historyYear: input.historyYear,
    view: input.view,
    capabilities: input.capabilities,
    pagination: { total: 0, limit: input.limit, offset: input.offset, hasMore: false },
    sections: {
      hierarchy: { status: "available" }, summary: { status: "available" },
      personnel: { status: "available" }, monthStatuses: { status: "available" },
    },
    warnings: [],
    summary: {
      totalStores: 0, pendingStores: 0, approvedStores: 0,
      adjustedApprovedStores: 0, returnedStores: 0, missingStores: 0,
      totalTargetValue: "0",
    },
    companies: [],
  };
}

function groupBy<T>(rows: T[], key: (row: T) => string) {
  const grouped = new Map<string, T[]>();
  for (const row of rows) grouped.set(key(row), [...(grouped.get(key(row)) ?? []), row]);
  return grouped;
}

function formatDecimal(value: number) {
  return Number.isInteger(value) ? String(value) : String(value);
}

function classifyWorkspaceApprovalEvidence(value: unknown, isApprovedRequest: boolean): "direct" | "adjusted" | null {
  if (!isApprovedRequest) return null;
  if (!value || typeof value !== "object" || Array.isArray(value)) return "direct";
  const evidence = value as Record<string, unknown>;
  const isStrictAdjusted = evidence.approvalMode === "adjusted"
    && Object.prototype.hasOwnProperty.call(evidence, "originalTotalTargetValue")
    && Object.prototype.hasOwnProperty.call(evidence, "approvedTotalTargetValue")
    && Array.isArray(evidence.originalAllocations)
    && Array.isArray(evidence.approvedAllocations);
  return isStrictAdjusted ? "adjusted" : "direct";
}
