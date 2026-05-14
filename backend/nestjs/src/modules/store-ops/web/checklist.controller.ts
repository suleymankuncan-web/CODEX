import { Body, Controller, Post, Req } from "@nestjs/common";
import { RequireRoles } from "../../auth/decorators/roles.decorator";
import { ChecklistService } from "../application/checklist.service";
import { RequireActionScope, RequireScope } from "../../auth/decorators/scope.decorator";
import { CreateChecklistInstanceDto } from "./dto/create-checklist-instance.dto";
import { AddChecklistResponseDto } from "./dto/add-checklist-response.dto";
import { CompleteChecklistInstanceDto } from "./dto/complete-checklist-instance.dto";
import { AcknowledgeChecklistInstanceDto } from "./dto/acknowledge-checklist-instance.dto";

@Controller("checklists")
export class ChecklistController {
  constructor(private readonly checklistService: ChecklistService) {}

  @Post("instances")
  @RequireScope("store")
  @RequireActionScope("store")
  @RequireRoles("AUDITOR")
  async createChecklistInstance(
    @Req()
    request: {
      user: {
        userId: string;
        actionScope: {
          assignedStoreIds: string[];
        };
      };
    },
    @Body() body: CreateChecklistInstanceDto,
  ) {
    return this.checklistService.createChecklistInstance({
      ...body,
      actorUserId: request.user.userId,
      actorActionScope: request.user.actionScope,
    });
  }

  @Post("instances/:checklistInstanceId/responses")
  @RequireScope("authenticated")
  @RequireRoles("AUDITOR")
  async addChecklistResponse(
    @Req()
    request: {
      user: {
        userId: string;
        actionScope: {
          assignedStoreIds: string[];
        };
      };
      params: {
        checklistInstanceId: string;
      };
    },
    @Body() body: AddChecklistResponseDto,
  ) {
    return this.checklistService.addChecklistResponse({
      checklistInstanceId: request.params.checklistInstanceId,
      ...body,
      actorUserId: request.user.userId,
      actorActionScope: request.user.actionScope,
    });
  }

  @Post("instances/:checklistInstanceId/complete")
  @RequireScope("authenticated")
  @RequireRoles("AUDITOR")
  async completeChecklistInstance(
    @Req()
    request: {
      user: {
        userId: string;
        actionScope: {
          assignedStoreIds: string[];
        };
      };
      params: {
        checklistInstanceId: string;
      };
    },
    @Body() body: CompleteChecklistInstanceDto,
  ) {
    return this.checklistService.completeChecklistInstance({
      checklistInstanceId: request.params.checklistInstanceId,
      auditorEmployeeId: body.auditorEmployeeId,
      actorUserId: request.user.userId,
      actorActionScope: request.user.actionScope,
    });
  }

  @Post("instances/:checklistInstanceId/acknowledge")
  @RequireScope("authenticated")
  @RequireRoles("STORE_MANAGER", "SUPER_ADMIN")
  async acknowledgeChecklist(
    @Req()
    request: {
      user: {
        userId: string;
        actionScope: {
          assignedStoreIds: string[];
        };
      };
      params: {
        checklistInstanceId: string;
      };
    },
    @Body() body: AcknowledgeChecklistInstanceDto,
  ) {
    return this.checklistService.acknowledgeChecklist({
      checklistInstanceId: request.params.checklistInstanceId,
      actorUserId: request.user.userId,
      actorActionScope: request.user.actionScope,
      acknowledgementNote: body.acknowledgementNote,
    });
  }

  @Post("acknowledgements/list")
  @RequireScope("authenticated")
  @RequireRoles(
    "STORE_MANAGER",
    "SUPER_ADMIN",
    "REPORT_VIEWER",
    "REGION_MANAGER",
    "VISUAL_MERCHANDISER",
  )
  async listChecklistAcknowledgements(
    @Req()
    request: {
      user: {
        scope: {
          companyIds: string[];
          regionIds: string[];
          storeIds: string[];
        };
        actionScope: {
          assignedStoreIds: string[];
        };
        roleCodes: string[];
      };
    },
  ) {
    return this.checklistService.listChecklistAcknowledgements({
      actorScope: request.user.scope,
      actorActionScope: request.user.actionScope,
      actorRoleCodes: request.user.roleCodes,
    });
  }
}
