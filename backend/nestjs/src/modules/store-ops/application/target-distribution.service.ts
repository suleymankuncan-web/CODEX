import { ForbiddenException, Injectable } from "@nestjs/common";
import { buildCommandResponse, buildListResponse } from "../../../shared/http/response-builders";
import { TargetDistributionRepository } from "../infrastructure/target-distribution.repository";
import { StoreOpsRepository } from "../infrastructure/store-ops.repository";

@Injectable()
export class TargetDistributionService {
  constructor(
    private readonly targetDistributionRepository: TargetDistributionRepository,
    private readonly storeOpsRepository: StoreOpsRepository,
  ) {}

  async createRequest(input: {
    actorUserId: string;
    actorScope: {
      companyIds: string[];
      regionIds: string[];
      storeIds: string[];
    };
    actorActionScope?: {
      assignedStoreIds: string[];
    };
    storeId: string;
    requestMonth: string;
    targetLabel: string;
    totalTargetValue: number;
    requestReason?: string;
    allocations: Array<{
      employeeId: string;
      assigneeLabel: string;
      targetValue: number;
      note?: string;
    }>;
  }) {
    if (!this.canActOnStore(input.actorActionScope, input.actorScope, input.storeId)) {
      throw new ForbiddenException("Requested store is outside assigned action stores");
    }

    await this.assertAllocationsBelongToStore({
      storeId: input.storeId,
      allocations: input.allocations,
    });

    const storeScope = await this.resolveStoreScope(input.storeId);

    return buildCommandResponse({
      status: "submitted",
      message: "Target distribution request submitted for region approval",
      data: {
        request: await this.targetDistributionRepository.createRequest({
          companyId: storeScope.companyId,
          regionId: storeScope.regionId,
          storeId: input.storeId,
          requestMonth: input.requestMonth,
          targetLabel: input.targetLabel,
          totalTargetValue: input.totalTargetValue,
          requestReason: input.requestReason,
          allocations: input.allocations,
          submittedByUserId: input.actorUserId,
        }),
      },
    });
  }

  async listRequests(input: {
    actorScope: {
      companyIds: string[];
      regionIds: string[];
      storeIds: string[];
    };
    actorActionScope?: {
      assignedStoreIds: string[];
    };
    actorRoleCodes: string[];
    statuses?: string[];
  }) {
    const listScope = this.resolveTargetReadScope(input);
    const items = await this.targetDistributionRepository.listRequests({
      companyIds: listScope.companyIds,
      regionIds: listScope.regionIds,
      storeIds: listScope.storeIds,
      statuses: input.statuses,
    });

    return buildListResponse(items, {
      total: items.length,
      limit: 50,
      offset: 0,
    });
  }

  async getTargetCoverage(input: {
    actorScope: {
      companyIds: string[];
      regionIds: string[];
      storeIds: string[];
    };
    actorActionScope?: {
      assignedStoreIds: string[];
    };
    actorRoleCodes: string[];
    requestMonth: string;
    storeId?: string;
  }) {
    const listScope = this.resolveTargetReadScope(input);
    const rows = await this.targetDistributionRepository.listTargetCoverage({
      companyIds: listScope.companyIds,
      regionIds: listScope.regionIds,
      storeIds: listScope.storeIds,
      requestMonth: input.requestMonth,
      storeId: input.storeId,
    });
    const items = rows.map((row) => ({
      storeId: row.store_id,
      storeName: row.store_name,
      employeeId: row.employee_id,
      displayName: `${row.first_name} ${row.last_name}`.trim(),
      externalEmployeeRef: row.external_employee_ref,
      targetReferenceId: row.personnel_target_reference_id,
      targetValue: row.target_value !== null ? Number(row.target_value) : null,
      pendingRequestId: row.pending_request_id,
      pendingTargetValue:
        row.pending_target_value !== null ? Number(row.pending_target_value) : null,
      staleTargetReferenceId: row.stale_target_reference_id,
      targetStatus: row.target_status,
    }));
    const coveredEmployees = items.filter(
      (item) => item.targetReferenceId !== null,
    ).length;
    const pendingEmployees = items.filter(
      (item) => item.targetStatus === "pending_region_approval",
    ).length;
    const conflictEmployees = items.filter(
      (item) => item.targetStatus === "pending_change_conflict",
    ).length;
    const staleEmployees = items.filter(
      (item) => item.targetStatus === "stale_reference",
    ).length;
    const missingEmployees = items.filter(
      (item) => item.targetStatus === "missing",
    ).length;
    const totalEmployees = items.length;

    return {
      ...buildListResponse(items, {
        total: totalEmployees,
        limit: 50,
        offset: 0,
      }),
      summary: {
        requestMonth: input.requestMonth,
        totalEmployees,
        coveredEmployees,
        missingEmployees,
        pendingEmployees,
        conflictEmployees,
        staleEmployees,
        uncoveredEmployees: totalEmployees - coveredEmployees,
        coverageRate:
          totalEmployees > 0
            ? Number((coveredEmployees / totalEmployees).toFixed(4))
            : 0,
      },
    };
  }

  async approveRequest(input: {
    actorUserId: string;
    actorActionScope?: {
      assignedStoreIds: string[];
    };
    requestId: string;
    approvalNote?: string;
  }) {
    const requestScope = await this.targetDistributionRepository.getRequestScope(
      input.requestId,
    );

    if (
      !requestScope ||
      !input.actorActionScope?.assignedStoreIds.includes(requestScope.storeId)
    ) {
      throw new ForbiddenException("Target distribution request is outside assigned action stores");
    }

    return buildCommandResponse({
      status: "approved",
      message: "Target distribution request approved",
      data: {
        request: await this.targetDistributionRepository.approveRequest({
          requestId: input.requestId,
          approverUserId: input.actorUserId,
          approvalNote: input.approvalNote,
        }),
      },
    });
  }

  async listStorePersonnel(input: {
    actorScope: {
      companyIds: string[];
      regionIds: string[];
      storeIds: string[];
    };
    actorActionScope?: {
      assignedStoreIds: string[];
    };
    storeId: string;
  }) {
    if (!this.canActOnStore(input.actorActionScope, input.actorScope, input.storeId)) {
      throw new ForbiddenException("Requested store is outside assigned action stores");
    }

    const rows = await this.storeOpsRepository.listStorePersonnelTargetingRows({
      storeId: input.storeId,
    });

    return buildListResponse(
      rows.map((row) => ({
        employeeId: row.employee_id,
        displayName: `${row.first_name} ${row.last_name}`.trim(),
        externalEmployeeRef: row.external_employee_ref,
        periodStart: row.period_start,
        periodEnd: row.period_end,
        netSalesValue: row.net_sales_value !== null ? Number(row.net_sales_value) : null,
      })),
      {
        total: rows.length,
        limit: rows.length || 50,
        offset: 0,
      },
    );
  }

  private canActOnStore(
    actionScope: { assignedStoreIds: string[] } | undefined,
    legacyScope: { storeIds: string[] },
    storeId: string,
  ) {
    const assignedStoreIds = actionScope?.assignedStoreIds ?? legacyScope.storeIds;
    return assignedStoreIds.includes(storeId);
  }

  private resolveTargetReadScope(input: {
    actorScope: {
      companyIds: string[];
      regionIds: string[];
      storeIds: string[];
    };
    actorActionScope?: {
      assignedStoreIds: string[];
    };
    actorRoleCodes: string[];
  }) {
    const canUseBroadReadScope = input.actorRoleCodes.some((roleCode) =>
      ["HR_ADMIN", "REGION_MANAGER", "REPORT_VIEWER", "SUPER_ADMIN"].includes(roleCode),
    );
    const storeIds = input.actorActionScope?.assignedStoreIds.length
      ? input.actorActionScope.assignedStoreIds
      : input.actorScope.storeIds;

    if (!canUseBroadReadScope) {
      return {
        companyIds: [],
        regionIds: [],
        storeIds,
      };
    }

    return {
      companyIds: input.actorScope.companyIds,
      regionIds: input.actorScope.regionIds,
      storeIds:
        input.actorScope.companyIds.length > 0 || input.actorScope.regionIds.length > 0
          ? []
          : storeIds,
    };
  }

  private async assertAllocationsBelongToStore(input: {
    storeId: string;
    allocations: Array<{ employeeId: string }>;
  }) {
    const personnelRows = await this.storeOpsRepository.listStorePersonnelTargetingRows({
      storeId: input.storeId,
    });
    const activeEmployeeIds = new Set(personnelRows.map((row) => row.employee_id));
    const hasOutOfStoreEmployee = input.allocations.some(
      (allocation) => !activeEmployeeIds.has(allocation.employeeId),
    );

    if (hasOutOfStoreEmployee) {
      throw new ForbiddenException(
        "Target allocation contains employees outside the requested store",
      );
    }
  }

  private async resolveStoreScope(storeId: string) {
    const stores = await this.storeOpsRepository.listStoresByScope({
      companyIds: [],
      regionIds: [],
      storeIds: [storeId],
      requestedStoreId: storeId,
    });
    const store = stores[0];

    if (!store) {
      throw new ForbiddenException("Requested store is outside assigned action stores");
    }

    return {
      companyId: store.company_id,
      regionId: store.region_id,
    };
  }
}
