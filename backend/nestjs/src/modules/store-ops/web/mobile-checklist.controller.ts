import { Body, Controller, Post, Req } from "@nestjs/common";
import { AuthenticatedUser } from "../../auth/auth-context.service";
import { RequireRoles } from "../../auth/decorators/roles.decorator";
import {
  RequireActionScope,
  RequireScope,
} from "../../auth/decorators/scope.decorator";
import { ChecklistService } from "../application/checklist.service";
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
}
