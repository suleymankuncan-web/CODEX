import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { buildCommandResponse } from "../../../shared/http/response-builders";
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
  actorActionScope?: {
    assignedStoreIds: readonly string[];
  };
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
