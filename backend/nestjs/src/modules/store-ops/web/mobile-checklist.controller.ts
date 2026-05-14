import { Body, Controller, Get, Param, Patch, Post, Req } from "@nestjs/common";
import { AuthenticatedUser } from "../../auth/auth-context.service";
import { RequireRoles } from "../../auth/decorators/roles.decorator";
import {
  RequireActionScope,
  RequireScope,
} from "../../auth/decorators/scope.decorator";
import { ChecklistService } from "../application/checklist.service";
import { AcknowledgeChecklistInstanceDto } from "./dto/acknowledge-checklist-instance.dto";
import { MobileChecklistInstanceParamsDto } from "./dto/mobile-checklist-instance-params.dto";
import { SaveMobileChecklistResponseDto } from "./dto/save-mobile-checklist-response.dto";
import { StartMobileChecklistInstanceDto } from "./dto/start-mobile-checklist-instance.dto";

@Controller("mobile/checklists")
export class MobileChecklistController {
  constructor(private readonly checklistService: ChecklistService) {}

  @Get("today")
  @RequireScope("authenticated")
  @RequireRoles("REGION_MANAGER", "STORE_MANAGER", "VISUAL_MERCHANDISER", "SUPER_ADMIN")
  async getToday(
    @Req()
    request: {
      user: AuthenticatedUser;
    },
  ) {
    return this.checklistService.getMobileChecklistToday({
      actorUserId: request.user.userId,
      actorScope: request.user.scope,
      actorRoleCodes: request.user.roleCodes,
      actorActionScope: request.user.actionScope,
    });
  }

  @Post("instances")
  @RequireScope("authenticated")
  @RequireActionScope("store")
  @RequireRoles("REGION_MANAGER", "VISUAL_MERCHANDISER", "SUPER_ADMIN")
  async startInstance(
    @Req()
    request: {
      user: AuthenticatedUser;
    },
    @Body() body: StartMobileChecklistInstanceDto,
  ) {
    return this.checklistService.startMobileChecklistInstance({
      checklistTemplateId: body.checklistTemplateId,
      storeId: body.storeId,
      actorUserId: request.user.userId,
      actorRoleCodes: request.user.roleCodes,
      actorActionScope: request.user.actionScope,
    });
  }

  @Patch("instances/:checklistInstanceId/responses")
  @RequireScope("authenticated")
  @RequireRoles("REGION_MANAGER", "VISUAL_MERCHANDISER", "SUPER_ADMIN")
  async saveResponse(
    @Param() params: MobileChecklistInstanceParamsDto,
    @Req()
    request: {
      user: AuthenticatedUser;
    },
    @Body() body: SaveMobileChecklistResponseDto,
  ) {
    return this.checklistService.saveMobileChecklistResponse({
      checklistInstanceId: params.checklistInstanceId,
      templateItemId: body.templateItemId,
      scoreValue: body.scoreValue,
      commentText: body.commentText,
      actorUserId: request.user.userId,
      actorRoleCodes: request.user.roleCodes,
      actorActionScope: request.user.actionScope,
    });
  }

  @Post("instances/:checklistInstanceId/complete")
  @RequireScope("authenticated")
  @RequireRoles("REGION_MANAGER", "VISUAL_MERCHANDISER", "SUPER_ADMIN")
  async completeInstance(
    @Param() params: MobileChecklistInstanceParamsDto,
    @Req()
    request: {
      user: AuthenticatedUser;
    },
  ) {
    return this.checklistService.completeMobileChecklistInstance({
      checklistInstanceId: params.checklistInstanceId,
      actorUserId: request.user.userId,
      actorRoleCodes: request.user.roleCodes,
      actorActionScope: request.user.actionScope,
    });
  }

  @Post("instances/:checklistInstanceId/acknowledge")
  @RequireScope("authenticated")
  @RequireRoles("STORE_MANAGER", "SUPER_ADMIN")
  async acknowledge(
    @Param() params: MobileChecklistInstanceParamsDto,
    @Req()
    request: {
      user: AuthenticatedUser;
    },
    @Body() body: AcknowledgeChecklistInstanceDto,
  ) {
    return this.checklistService.acknowledgeChecklist({
      checklistInstanceId: params.checklistInstanceId,
      actorUserId: request.user.userId,
      actorActionScope: request.user.actionScope,
      acknowledgementNote: body.acknowledgementNote,
    });
  }
}
