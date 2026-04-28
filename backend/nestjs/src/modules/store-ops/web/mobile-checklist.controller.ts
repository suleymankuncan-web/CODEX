import { Body, Controller, Param, Patch, Post, Req } from "@nestjs/common";
import { AuthenticatedUser } from "../../auth/auth-context.service";
import { RequireRoles } from "../../auth/decorators/roles.decorator";
import {
  RequireActionScope,
  RequireScope,
} from "../../auth/decorators/scope.decorator";
import { ChecklistService } from "../application/checklist.service";
import { MobileChecklistInstanceParamsDto } from "./dto/mobile-checklist-instance-params.dto";
import { SaveMobileChecklistResponseDto } from "./dto/save-mobile-checklist-response.dto";
import { StartMobileChecklistInstanceDto } from "./dto/start-mobile-checklist-instance.dto";

@Controller("mobile/checklists")
export class MobileChecklistController {
  constructor(private readonly checklistService: ChecklistService) {}

  @Post("instances")
  @RequireScope("store")
  @RequireActionScope("store")
  @RequireRoles("REGION_MANAGER", "SUPER_ADMIN")
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
      actorActionScope: request.user.actionScope,
    });
  }

  @Patch("instances/:checklistInstanceId/responses")
  @RequireScope("authenticated")
  @RequireRoles("REGION_MANAGER", "SUPER_ADMIN")
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
      actorActionScope: request.user.actionScope,
    });
  }

  @Post("instances/:checklistInstanceId/complete")
  @RequireScope("authenticated")
  @RequireRoles("REGION_MANAGER", "SUPER_ADMIN")
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
      actorActionScope: request.user.actionScope,
    });
  }
}
