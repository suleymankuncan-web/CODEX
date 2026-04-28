import { Body, Controller, Param, Post, Req } from "@nestjs/common";
import { AuthenticatedUser } from "../../auth/auth-context.service";
import { RequireRoles } from "../../auth/decorators/roles.decorator";
import { RequireScope } from "../../auth/decorators/scope.decorator";
import { ChecklistService } from "../application/checklist.service";
import { ChecklistTemplateParamsDto } from "./dto/checklist-template-params.dto";
import { CreateChecklistTemplateDto } from "./dto/create-checklist-template.dto";
import { PublishChecklistTemplateDto } from "./dto/publish-checklist-template.dto";

@Controller("admin/checklist-templates")
@RequireScope("authenticated")
@RequireRoles("HR_ADMIN", "SUPER_ADMIN")
export class AdminChecklistTemplateController {
  constructor(private readonly checklistService: ChecklistService) {}

  @Post()
  async createChecklistTemplate(
    @Req()
    request: {
      user: AuthenticatedUser;
    },
    @Body() body: CreateChecklistTemplateDto,
  ) {
    return this.checklistService.createChecklistTemplate({
      ...body,
      actorUserId: request.user.userId,
      actorRoleCodes: request.user.roleCodes,
      actorReadScope: request.user.readScope,
    });
  }

  @Post(":checklistTemplateId/publish")
  async publishChecklistTemplate(
    @Param() params: ChecklistTemplateParamsDto,
    @Req()
    request: {
      user: AuthenticatedUser;
    },
    @Body() body: PublishChecklistTemplateDto,
  ) {
    return this.checklistService.publishChecklistTemplate({
      checklistTemplateId: params.checklistTemplateId,
      actorUserId: request.user.userId,
      actorRoleCodes: request.user.roleCodes,
      actorReadScope: request.user.readScope,
      effectiveFrom: body?.effectiveFrom,
      effectiveTo: body?.effectiveTo,
    });
  }
}
