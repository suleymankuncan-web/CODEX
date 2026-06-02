import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
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
import { extractChecklistRemediationFindings } from "./checklist-remediation-finding.extractor";
import { StoreActionPlanService } from "./store-action-plan.service";

@Injectable()
export class ChecklistService {
  constructor(
    private readonly storeOpsRepository: StoreOpsRepository,
    private readonly checklistAcknowledgementRepository: ChecklistAcknowledgementRepository,
    private readonly checklistRepository: ChecklistRepository,
    private readonly storeActionPlanService?: StoreActionPlanService,
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
    actorRoleCodes?: string[];
    actorActionScope?: {
      assignedStoreIds: string[];
    };
  }) {
    this.assertCanActOnStore(
      input.actorActionScope,
      input.storeId,
      "Requested store is outside assigned action stores",
    );

    const template = await this.checklistRepository.getPublishedTemplateForStore({
      checklistTemplateId: input.checklistTemplateId,
      storeId: input.storeId,
    });

    if (!template) {
      throw new BadRequestException("Checklist template is not available for this store");
    }

    this.assertCanMutateTemplateType(input.actorRoleCodes ?? [], template.templateType);

    return buildCommandResponse({
      status: "created",
      message: "Checklist visit started",
      data: {
        checklistInstance: await this.checklistRepository.startMobileChecklistInstance(input),
      },
    });
  }

  async getMobileChecklistToday(input: {
    actorUserId: string;
    actorScope: {
      companyIds?: string[];
      regionIds?: string[];
      storeIds: string[];
    };
    actorRoleCodes?: string[];
    actorActionScope?: {
      assignedStoreIds: string[];
    };
  }) {
    const allowedTemplateTypes = this.resolveReadableTemplateTypes(input.actorRoleCodes ?? []);

    return {
      data: await this.checklistRepository.getMobileChecklistToday({
        actorUserId: input.actorUserId,
        assignedStoreIds: input.actorActionScope?.assignedStoreIds ?? [],
        readStoreIds: input.actorScope.storeIds,
        readRegionIds: input.actorScope.regionIds ?? [],
        readCompanyIds: input.actorScope.companyIds ?? [],
        allowedTemplateTypes,
      }),
    };
  }

  async saveMobileChecklistResponse(input: {
    checklistInstanceId: string;
    templateItemId: string;
    scoreValue: number;
    commentText?: string;
    actorUserId: string;
    actorRoleCodes?: string[];
    actorActionScope?: {
      assignedStoreIds: string[];
    };
  }) {
    await this.assertCanActOnMobileChecklistInstance(
      input.checklistInstanceId,
      input.actorActionScope,
      input.actorRoleCodes ?? [],
    );

    return buildCommandResponse({
      status: "saved",
      message: "Checklist response saved",
      data: {
        checklistResponse: await this.checklistRepository.saveMobileChecklistResponse(input),
      },
    });
  }

  async completeMobileChecklistInstance(input: {
    checklistInstanceId: string;
    actorUserId: string;
    actorRoleCodes?: string[];
    actorActionScope?: {
      assignedStoreIds: string[];
    };
  }) {
    await this.assertCanActOnMobileChecklistInstance(
      input.checklistInstanceId,
      input.actorActionScope,
      input.actorRoleCodes ?? [],
    );

    return buildCommandResponse({
      status: "completed",
      message: "Checklist instance completed",
      data: {
        checklistInstance: await this.checklistRepository.completeMobileChecklistInstance({
          checklistInstanceId: input.checklistInstanceId,
          actorUserId: input.actorUserId,
        }),
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
    actorActionScope?: {
      assignedStoreIds: string[];
    };
    actorRoleCodes: string[];
  }) {
    const listScope = this.resolveChecklistAcknowledgementListScope(input);
    const allowedTemplateTypes = this.resolveReadableAcknowledgementTemplateTypes(
      input.actorRoleCodes,
    );
    const items = await this.checklistAcknowledgementRepository.listChecklistAcknowledgements({
      companyIds: listScope.companyIds,
      regionIds: listScope.regionIds,
      storeIds: listScope.storeIds,
      allowedTemplateTypes,
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

    const acknowledgement = await this.checklistAcknowledgementRepository.acknowledgeChecklist({
      checklistInstanceId: input.checklistInstanceId,
      actorUserId: input.actorUserId,
      acknowledgementNote: input.acknowledgementNote,
    });

    await this.createChecklistRemediationPlans({
      checklistInstanceId: input.checklistInstanceId,
      actorUserId: input.actorUserId,
      actorActionScope: input.actorActionScope,
      acknowledgedAt: acknowledgement.acknowledgedAt,
    });

    return buildCommandResponse({
      status: "acknowledged",
      message: "Checklist instance acknowledged",
      data: {
        acknowledgement,
      },
    });
  }

  private async createChecklistRemediationPlans(input: {
    checklistInstanceId: string;
    actorUserId: string;
    actorActionScope?: {
      assignedStoreIds: string[];
    };
    acknowledgedAt: string | Date;
  }) {
    if (!this.storeActionPlanService) {
      throw new Error("StoreActionPlanService is required for checklist remediation generation");
    }

    const source = await this.checklistAcknowledgementRepository.getChecklistRemediationSource(
      input.checklistInstanceId,
    );
    const extractionResult = extractChecklistRemediationFindings(source);
    const dueOn = this.calculateChecklistRemediationDueOn(input.acknowledgedAt);

    for (const finding of extractionResult.findings) {
      try {
        await this.storeActionPlanService.createPlan({
          actorUserId: input.actorUserId,
          actorScope: {
            companyIds: [],
            regionIds: [],
            storeIds: [finding.storeId],
          },
          actorActionScope: input.actorActionScope,
          storeId: finding.storeId,
          sourceType: finding.sourceType,
          sourceId: finding.sourceId,
          sourceDeepLink: finding.sourceDeepLink,
          title: finding.title,
          summary: finding.summary,
          priority: finding.priority,
          dueOn,
        });
      } catch (error) {
        if (isDuplicateStoreActionPlanConflict(error)) {
          continue;
        }

        throw error;
      }
    }
  }

  private calculateChecklistRemediationDueOn(acknowledgedAt: string | Date) {
    const dueDate = new Date(acknowledgedAt);
    if (Number.isNaN(dueDate.getTime())) {
      throw new BadRequestException("Checklist acknowledgement timestamp is invalid");
    }

    dueDate.setUTCDate(dueDate.getUTCDate() + 7);
    return dueDate.toISOString().slice(0, 10);
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

  private async assertCanActOnMobileChecklistInstance(
    checklistInstanceId: string,
    actionScope: { assignedStoreIds: string[] } | undefined,
    roleCodes: string[],
  ) {
    const instanceScope =
      await this.checklistRepository.getMobileChecklistInstanceScope(checklistInstanceId);

    if (!instanceScope) {
      throw new ForbiddenException("Checklist instance is outside assigned action stores");
    }

    this.assertNotCompleted(instanceScope.status);
    this.assertCanMutateTemplateType(roleCodes, instanceScope.templateType);
    this.assertCanActOnStore(
      actionScope,
      instanceScope.storeId,
      "Checklist instance is outside assigned action stores",
    );
  }

  private assertNotCompleted(status: string) {
    if (status === "completed") {
      throw new BadRequestException("Completed checklist instances are locked");
    }
  }

  private assertCanMutateTemplateType(roleCodes: string[], templateType: string) {
    if (roleCodes.includes("SUPER_ADMIN")) {
      return;
    }

    if (templateType === "BM_STORE_VISIT" && roleCodes.includes("REGION_MANAGER")) {
      return;
    }

    if (templateType === "VM_STORE_VISIT" && roleCodes.includes("VISUAL_MERCHANDISER")) {
      return;
    }

    throw new ForbiddenException("Checklist template type is not available for this role");
  }

  private resolveReadableTemplateTypes(roleCodes: string[]) {
    if (roleCodes.includes("SUPER_ADMIN")) {
      return ["BM_STORE_VISIT", "VM_STORE_VISIT"];
    }

    if (roleCodes.includes("VISUAL_MERCHANDISER")) {
      return ["VM_STORE_VISIT"];
    }

    if (roleCodes.includes("REGION_MANAGER")) {
      return ["BM_STORE_VISIT", "VM_STORE_VISIT"];
    }

    if (roleCodes.includes("STORE_MANAGER")) {
      return ["BM_STORE_VISIT", "VM_STORE_VISIT"];
    }

    return [];
  }

  private resolveReadableAcknowledgementTemplateTypes(roleCodes: string[]) {
    if (
      roleCodes.includes("SUPER_ADMIN") ||
      roleCodes.includes("REPORT_VIEWER")
    ) {
      return undefined;
    }

    if (
      roleCodes.includes("STORE_MANAGER") ||
      roleCodes.includes("REGION_MANAGER")
    ) {
      return ["BM_STORE_VISIT", "VM_STORE_VISIT"];
    }

    if (roleCodes.includes("VISUAL_MERCHANDISER")) {
      return ["VM_STORE_VISIT"];
    }

    return [];
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

  private resolveChecklistAcknowledgementListScope(input: {
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
      ["REPORT_VIEWER", "SUPER_ADMIN"].includes(roleCode),
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

function isDuplicateStoreActionPlanConflict(error: unknown) {
  return (
    error instanceof ConflictException &&
    error.message === "Active store action plan already exists for this source"
  );
}
