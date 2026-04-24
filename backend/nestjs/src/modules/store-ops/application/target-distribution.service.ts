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
      assigneeLabel: string;
      targetValue: number;
      note?: string;
    }>;
  }) {
    if (!this.canActOnStore(input.actorActionScope, input.actorScope, input.storeId)) {
      throw new ForbiddenException("Requested store is outside assigned action stores");
    }

    const companyId =
      input.actorScope.companyIds[0] ?? "00000000-0000-0000-0000-000000000001";
    const regionId =
      input.actorScope.regionIds[0] ?? "00000000-0000-0000-0000-000000000010";

    return buildCommandResponse({
      status: "submitted",
      message: "Target distribution request submitted for region approval",
      data: {
        request: await this.targetDistributionRepository.createRequest({
          companyId,
          regionId,
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
    statuses?: string[];
  }) {
    const items = await this.targetDistributionRepository.listRequests({
      companyIds: input.actorScope.companyIds,
      regionIds: input.actorScope.regionIds,
      storeIds: input.actorScope.companyIds.length > 0 || input.actorScope.regionIds.length > 0 ? [] : input.actorScope.storeIds,
      statuses: input.statuses,
    });

    return buildListResponse(items, {
      total: items.length,
      limit: 50,
      offset: 0,
    });
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
}
