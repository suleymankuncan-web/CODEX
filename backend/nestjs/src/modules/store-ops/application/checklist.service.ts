import { BadRequestException, ForbiddenException, Injectable } from "@nestjs/common";
import { StoreOpsRepository } from "../infrastructure/store-ops.repository";
import { buildCommandResponse } from "../../../shared/http/response-builders";
import { buildListResponse } from "../../../shared/http/response-builders";
import { ChecklistAcknowledgementRepository } from "../infrastructure/checklist-acknowledgement.repository";
import { ChecklistRepository } from "../infrastructure/checklist.repository";
import {
  ChecklistTemplateActorScope,
  CreateChecklistTemplateInput,
  PublishChecklistTemplateInput,
} from "./checklist.contract";

@Injectable()
export class ChecklistService {
  constructor(
    private readonly storeOpsRepository: StoreOpsRepository,
    private readonly checklistAcknowledgementRepository: ChecklistAcknowledgementRepository,
    private readonly checklistRepository: ChecklistRepository,
  ) {}

  async createChecklistTemplate(input: CreateChecklistTemplateInput) {
    this.assertCanManageTemplateCompany(input.companyId, input);
    this.assertValidEffectiveDateRange(input);

    return buildCommandResponse({
      status: "created",
      message: "Checklist template draft created",
      data: {
        checklistTemplate: await this.checklistRepository.createTemplate(input),
      },
    });
  }

  async publishChecklistTemplate(input: PublishChecklistTemplateInput) {
    const draftTemplate = await this.checklistRepository.getDraftTemplateForPublish(
      input.checklistTemplateId,
    );
    this.assertCanManageTemplateCompany(draftTemplate.companyId, input);

    const totalWeight = draftTemplate.items.reduce((sum, item) => sum + item.weight, 0);
    const totalWeightCents = Math.round(totalWeight * 100);

    if (totalWeightCents !== 10_000) {
      throw new BadRequestException("Checklist template item weights must total 100");
    }

    this.assertValidEffectiveDateRange({
      effectiveFrom: input.effectiveFrom ?? draftTemplate.effectiveFrom,
      effectiveTo: input.effectiveTo ?? draftTemplate.effectiveTo ?? undefined,
    });

    return buildCommandResponse({
      status: "published",
      message: "Checklist template published",
      data: {
        checklistTemplate: await this.checklistRepository.publishTemplate(input),
      },
    });
  }

  async startMobileChecklistInstance(input: {
    checklistTemplateId: string;
    storeId: string;
    actorUserId: string;
    actorActionScope?: {
      assignedStoreIds: string[];
    };
  }) {
    this.assertCanActOnStore(
      input.actorActionScope,
      input.storeId,
      "Requested store is outside assigned action stores",
    );

    return buildCommandResponse({
      status: "created",
      message: "Checklist visit started",
      data: {
        checklistInstance: await this.checklistRepository.startMobileChecklistInstance(input),
      },
    });
  }

  async createChecklistInstance(input: {
    templateId: string;
    storeId: string;
    assignedEmployeeId?: string;
    actorUserId: string;
    actorActionScope?: {
      assignedStoreIds: string[];
    };
  }) {
    this.assertCanActOnStore(
      input.actorActionScope,
      input.storeId,
      "Requested store is outside assigned action stores",
    );

    return buildCommandResponse({
      status: "created",
      message: "Checklist instance created",
      data: {
        checklistInstance: await this.storeOpsRepository.createChecklistInstance(input),
      },
    });
  }

  async addChecklistResponse(input: {
    checklistInstanceId: string;
    templateItemId: string;
    responseValue?: string;
    scoreValue?: number;
    isNonCompliant?: boolean;
    commentText?: string;
    actorUserId: string;
    actorActionScope?: {
      assignedStoreIds: string[];
    };
  }) {
    await this.assertCanActOnChecklistInstance(
      input.checklistInstanceId,
      input.actorActionScope,
    );

    return buildCommandResponse({
      status: "saved",
      message: "Checklist response saved",
      data: {
        checklistResponse: await this.storeOpsRepository.addChecklistResponse(input),
      },
    });
  }

  async completeChecklistInstance(input: {
    checklistInstanceId: string;
    auditorEmployeeId: string;
    actorUserId: string;
    actorActionScope?: {
      assignedStoreIds: string[];
    };
  }) {
    await this.assertCanActOnChecklistInstance(
      input.checklistInstanceId,
      input.actorActionScope,
    );

    return buildCommandResponse({
      status: "completed",
      message: "Checklist instance completed",
      data: {
        checklistInstance: await this.storeOpsRepository.completeChecklistInstance(input),
      },
    });
  }

  async listChecklistAcknowledgements(input: {
    actorScope: {
      companyIds: string[];
      regionIds: string[];
      storeIds: string[];
    };
  }) {
    const items = await this.checklistAcknowledgementRepository.listChecklistAcknowledgements({
      companyIds: input.actorScope.companyIds,
      regionIds: input.actorScope.regionIds,
      storeIds:
        input.actorScope.companyIds.length > 0 || input.actorScope.regionIds.length > 0
          ? []
          : input.actorScope.storeIds,
    });

    return buildListResponse(items, {
      total: items.length,
      limit: 50,
      offset: 0,
    });
  }

  async acknowledgeChecklist(input: {
    checklistInstanceId: string;
    actorUserId: string;
    actorActionScope?: {
      assignedStoreIds: string[];
    };
    acknowledgementNote?: string;
  }) {
    const instanceScope =
      await this.checklistAcknowledgementRepository.getChecklistInstanceScope(
        input.checklistInstanceId,
      );

    if (
      !instanceScope ||
      !input.actorActionScope?.assignedStoreIds.includes(instanceScope.storeId)
    ) {
      throw new ForbiddenException("Checklist instance is outside assigned action stores");
    }

    return buildCommandResponse({
      status: "acknowledged",
      message: "Checklist instance acknowledged",
      data: {
        acknowledgement: await this.checklistAcknowledgementRepository.acknowledgeChecklist({
          checklistInstanceId: input.checklistInstanceId,
          actorUserId: input.actorUserId,
          acknowledgementNote: input.acknowledgementNote,
        }),
      },
    });
  }

  private async assertCanActOnChecklistInstance(
    checklistInstanceId: string,
    actionScope: { assignedStoreIds: string[] } | undefined,
  ) {
    const instanceScope =
      await this.checklistAcknowledgementRepository.getChecklistInstanceScope(
        checklistInstanceId,
      );

    if (!instanceScope) {
      throw new ForbiddenException("Checklist instance is outside assigned action stores");
    }

    this.assertCanActOnStore(
      actionScope,
      instanceScope.storeId,
      "Checklist instance is outside assigned action stores",
    );
  }

  private assertCanActOnStore(
    actionScope: { assignedStoreIds: string[] } | undefined,
    storeId: string,
    message: string,
  ) {
    if (!actionScope?.assignedStoreIds.includes(storeId)) {
      throw new ForbiddenException(message);
    }
  }

  private assertCanManageTemplateCompany(
    companyId: string,
    actorScope: ChecklistTemplateActorScope,
  ) {
    if (actorScope.actorRoleCodes?.includes("SUPER_ADMIN")) {
      return;
    }

    if (!actorScope.actorReadScope?.companyIds.includes(companyId)) {
      throw new ForbiddenException("Checklist template company is outside actor scope");
    }
  }

  private assertValidEffectiveDateRange(input: {
    effectiveFrom?: string;
    effectiveTo?: string;
  }) {
    if (
      input.effectiveFrom &&
      input.effectiveTo &&
      new Date(input.effectiveTo).getTime() < new Date(input.effectiveFrom).getTime()
    ) {
      throw new BadRequestException(
        "Checklist template effectiveTo must be on or after effectiveFrom",
      );
    }
  }
}
