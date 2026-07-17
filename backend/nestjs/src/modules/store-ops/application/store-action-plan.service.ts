import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { buildCommandResponse, buildListResponse } from "../../../shared/http/response-builders";
import {
  canTransitionStoreActionPlanStatus,
  StoreActionPlanPriority,
  StoreActionPlanSourceType,
  StoreActionPlanStatus,
} from "./store-action-plan.contract";
import {
  StoreActionPlan,
  StoreActionPlanRepository,
  StoreActionPlanTransitionConflictError,
} from "../infrastructure/store-action-plan.repository";
import { StoreOpsRepository } from "../infrastructure/store-ops.repository";

type StoreActionPlanActorInput = {
  actorUserId: string;
  actorDisplayName?: string;
  actorRoleLabel?: string;
} & StoreActionPlanActionScopeInput;

type StoreActionPlanActionScopeInput = {
  actorActionScope?: {
    assignedStoreIds: readonly string[];
  };
  actorReadScope?: {
    companyIds: readonly string[];
    regionIds: readonly string[];
    storeIds: readonly string[];
  };
  actorRoleCodes?: readonly string[];
};

type StoreActionPlanActorScope = {
  companyIds: readonly string[];
  regionIds: readonly string[];
  storeIds: readonly string[];
};

@Injectable()
export class StoreActionPlanService {
  constructor(
    private readonly storeActionPlanRepository: StoreActionPlanRepository,
    private readonly storeOpsRepository: StoreOpsRepository,
  ) {}

  async listPlans(input: {
    actorActionScope?: {
      assignedStoreIds: readonly string[];
    };
    actorReadScope?: {
      companyIds: readonly string[];
      regionIds: readonly string[];
      storeIds: readonly string[];
    };
    actorRoleCodes?: readonly string[];
    storeId?: string;
    status?: StoreActionPlanStatus;
    statuses?: StoreActionPlanStatus[];
    periodStart?: string;
    periodEnd?: string;
    limit?: number;
    offset?: number;
  }) {
    const limit = this.normalizeLimit(input.limit);
    const offset = this.normalizeOffset(input.offset);
    const statuses = this.normalizeStatuses(input.status, input.statuses);
    const period = this.normalizePeriodFilter(input.periodStart, input.periodEnd);
    const isReportViewer = input.actorRoleCodes?.includes("REPORT_VIEWER") ?? false;
    const storeIds = isReportViewer
      ? input.storeId
        ? [input.storeId]
        : []
      : this.resolveAssignedStoreFilter(input.actorActionScope, input.storeId);
    const companyIds = isReportViewer ? input.actorReadScope?.companyIds ?? [] : [];

    if (storeIds.length === 0 && companyIds.length === 0) {
      return buildListResponse([], {
        total: 0,
        limit,
        offset,
      });
    }

    const result = await this.storeActionPlanRepository.listPlans({
      ...(isReportViewer ? { companyIds } : {}),
      storeIds,
      statuses,
      periodStart: period?.periodStart,
      periodEnd: period?.periodEnd,
      limit,
      offset,
    });

    return buildListResponse(result.items, {
      total: result.total,
      limit,
      offset,
    });
  }

  async getPlan(input: StoreActionPlanActionScopeInput & { actionPlanId: string }) {
    const plan =
      input.actorRoleCodes?.includes("REPORT_VIEWER") && input.actorReadScope
        ? await this.storeActionPlanRepository.getPlanByIdInCompanyScope({
            actionPlanId: input.actionPlanId,
            companyIds: input.actorReadScope.companyIds,
          })
        : await this.storeActionPlanRepository.getPlanById(input.actionPlanId);
    if (!plan) {
      throw new NotFoundException("Store action plan was not found");
    }

    if (!input.actorRoleCodes?.includes("REPORT_VIEWER")) {
      this.assertAssignedActionStore(input.actorActionScope, plan.storeId);
    }

    return {
      data: {
        plan,
      },
    };
  }

  async createPlan(input: StoreActionPlanActorInput & {
    actorScope: StoreActionPlanActorScope;
    storeId: string;
    sourceType: StoreActionPlanSourceType;
    sourceId: string;
    sourceDeepLink?: string;
    sourceSnapshotRunId?: string;
    sourceKpiId?: string;
    title: string;
    summary?: string;
    priority: StoreActionPlanPriority;
    dueOn?: string;
  }) {
    this.assertAssignedActionStore(input.actorActionScope, input.storeId);
    const dueOn = normalizeRequiredText(input.dueOn);
    if (!dueOn) {
      throw new BadRequestException("Due date is required to create a store action plan");
    }

    const storeScope = await this.resolveStoreScope(input.storeId);

    try {
      const plan = await this.storeActionPlanRepository.createPlan({
        companyId: storeScope.companyId,
        regionId: storeScope.regionId,
        storeId: input.storeId,
        ownerUserId: input.actorUserId,
        createdByUserId: input.actorUserId,
        sourceType: input.sourceType,
        sourceId: input.sourceId,
        sourceDeepLink: input.sourceDeepLink,
        sourceSnapshotRunId: input.sourceSnapshotRunId,
        sourceKpiId: input.sourceKpiId,
        title: input.title,
        summary: input.summary,
        priority: input.priority,
        dueOn,
        ...(input.actorDisplayName ? { actorDisplayName: input.actorDisplayName } : {}),
        ...(input.actorRoleLabel ? { actorRoleLabel: input.actorRoleLabel } : {}),
      });

      return buildCommandResponse({
        status: "created",
        message: "Store action plan created",
        data: { plan },
      });
    } catch (error) {
      if (isActiveSourceUniqueConflict(error)) {
        throw new ConflictException("Active store action plan already exists for this source");
      }
      throw error;
    }
  }

  async updateStatus(input: StoreActionPlanActorInput & {
    actionPlanId: string;
    status: StoreActionPlanStatus;
    note?: string;
  }) {
    const status = input.status;
    if (status === "closed" || status === "cancelled") {
      throw new BadRequestException("Use close or cancel commands for terminal statuses");
    }
    const nextStatus: Exclude<StoreActionPlanStatus, "closed" | "cancelled"> = status;

    const existingPlan = await this.getWritablePlan(input);
    this.assertTransition(existingPlan, nextStatus);

    const plan = await this.executeLifecycleWrite(() =>
      this.storeActionPlanRepository.updateStatus({
        actionPlanId: input.actionPlanId,
        actorUserId: input.actorUserId,
        expectedStatus: existingPlan.status,
        status: nextStatus,
        note: normalizeOptionalText(input.note),
        ...(input.actorDisplayName ? { actorDisplayName: input.actorDisplayName } : {}),
        ...(input.actorRoleLabel ? { actorRoleLabel: input.actorRoleLabel } : {}),
      }),
    );

    return buildCommandResponse({
      status: "updated",
      message: "Store action plan status updated",
      data: { plan },
    });
  }

  async closePlan(input: StoreActionPlanActorInput & {
    actionPlanId: string;
    resolutionNote: string;
  }) {
    const resolutionNote = normalizeRequiredText(input.resolutionNote);
    if (!resolutionNote) {
      throw new BadRequestException("Resolution note is required to close a store action plan");
    }

    const existingPlan = await this.getWritablePlan(input);
    this.assertTransition(existingPlan, "closed");

    const plan = await this.executeLifecycleWrite(() =>
      this.storeActionPlanRepository.closePlan({
        actionPlanId: input.actionPlanId,
        actorUserId: input.actorUserId,
        expectedStatus: existingPlan.status,
        resolutionNote,
        ...(input.actorDisplayName ? { actorDisplayName: input.actorDisplayName } : {}),
        ...(input.actorRoleLabel ? { actorRoleLabel: input.actorRoleLabel } : {}),
      }),
    );

    return buildCommandResponse({
      status: "closed",
      message: "Store action plan closed",
      data: { plan },
    });
  }

  async cancelPlan(input: StoreActionPlanActorInput & {
    actionPlanId: string;
    cancelReason: string;
  }) {
    const cancelReason = normalizeRequiredText(input.cancelReason);
    if (!cancelReason) {
      throw new BadRequestException("Cancel reason is required to cancel a store action plan");
    }

    const existingPlan = await this.getWritablePlan(input);
    this.assertTransition(existingPlan, "cancelled");

    const plan = await this.executeLifecycleWrite(() =>
      this.storeActionPlanRepository.cancelPlan({
        actionPlanId: input.actionPlanId,
        actorUserId: input.actorUserId,
        expectedStatus: existingPlan.status,
        cancelReason,
        ...(input.actorDisplayName ? { actorDisplayName: input.actorDisplayName } : {}),
        ...(input.actorRoleLabel ? { actorRoleLabel: input.actorRoleLabel } : {}),
      }),
    );

    return buildCommandResponse({
      status: "cancelled",
      message: "Store action plan cancelled",
      data: { plan },
    });
  }

  private async getWritablePlan(input: StoreActionPlanActorInput & { actionPlanId: string }) {
    const plan = await this.storeActionPlanRepository.getPlanById(input.actionPlanId);
    if (!plan) {
      throw new NotFoundException("Store action plan was not found");
    }

    this.assertAssignedActionStore(input.actorActionScope, plan.storeId);
    return plan;
  }

  private assertAssignedActionStore(
    actionScope: { assignedStoreIds: readonly string[] } | undefined,
    storeId: string,
  ) {
    if (!actionScope?.assignedStoreIds.includes(storeId)) {
      throw new ForbiddenException("Store action plan is outside assigned action stores");
    }
  }

  private resolveAssignedStoreFilter(
    actionScope: { assignedStoreIds: readonly string[] } | undefined,
    storeId: string | undefined,
  ) {
    if (storeId) {
      this.assertAssignedActionStore(actionScope, storeId);
      return [storeId];
    }

    return [...new Set(actionScope?.assignedStoreIds ?? [])];
  }

  private assertTransition(plan: StoreActionPlan, status: StoreActionPlanStatus) {
    if (!canTransitionStoreActionPlanStatus(plan.status, status)) {
      throw new ConflictException("Store action plan status transition is not allowed");
    }
  }

  private async executeLifecycleWrite<T>(write: () => Promise<T>) {
    try {
      return await write();
    } catch (error) {
      if (error instanceof StoreActionPlanTransitionConflictError) {
        throw new ConflictException("Store action plan status transition is not allowed");
      }
      throw error;
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
      throw new ForbiddenException("Store action plan is outside assigned action stores");
    }

    return {
      companyId: store.company_id,
      regionId: store.region_id,
    };
  }

  private normalizeLimit(limit?: number) {
    if (!limit || Number.isNaN(limit)) {
      return 50;
    }

    return Math.min(Math.max(Math.trunc(limit), 1), 100);
  }

  private normalizeOffset(offset?: number) {
    if (!offset || Number.isNaN(offset)) {
      return 0;
    }

    return Math.max(Math.trunc(offset), 0);
  }

  private normalizeStatuses(
    status?: StoreActionPlanStatus,
    statuses?: StoreActionPlanStatus[],
  ) {
    const values = statuses?.length ? statuses : status ? [status] : [];
    return [...new Set(values)];
  }

  private normalizePeriodFilter(periodStart?: string, periodEnd?: string) {
    if (!periodStart && !periodEnd) {
      return undefined;
    }

    if (!periodStart || !periodEnd) {
      throw new BadRequestException("Both periodStart and periodEnd are required");
    }

    if (periodStart > periodEnd) {
      throw new BadRequestException("periodStart must be before periodEnd");
    }

    return { periodStart, periodEnd };
  }
}

function normalizeOptionalText(value: string | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function normalizeRequiredText(value: string | undefined) {
  const normalized = value?.trim();
  return normalized || null;
}

function isActiveSourceUniqueConflict(error: unknown) {
  if (!error || typeof error !== "object") {
    return false;
  }

  const candidate = error as { code?: unknown; constraint?: unknown };
  return (
    candidate.code === "23505" &&
    candidate.constraint === "idx_store_action_plan_active_source_unique"
  );
}
