import { Body, Controller, Post, Req } from "@nestjs/common";
import { RequireRoles } from "../../auth/decorators/roles.decorator";
import { ChecklistService } from "../application/checklist.service";
import { RequireScope } from "../../auth/decorators/scope.decorator";
import { CreateChecklistInstanceDto } from "./dto/create-checklist-instance.dto";
import { AddChecklistResponseDto } from "./dto/add-checklist-response.dto";
import { CompleteChecklistInstanceDto } from "./dto/complete-checklist-instance.dto";

@Controller("checklists")
export class ChecklistController {
  constructor(private readonly checklistService: ChecklistService) {}

  @Post("instances")
  @RequireScope("store")
  @RequireRoles("AUDITOR")
  async createChecklistInstance(
    @Req()
    request: {
      user: {
        userId: string;
      };
    },
    @Body() body: CreateChecklistInstanceDto,
  ) {
    return this.checklistService.createChecklistInstance({
      ...body,
      actorUserId: request.user.userId,
    });
  }

  @Post("instances/:checklistInstanceId/responses")
  @RequireScope("store")
  @RequireRoles("AUDITOR")
  async addChecklistResponse(
    @Req()
    request: {
      user: {
        userId: string;
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
    });
  }

  @Post("instances/:checklistInstanceId/complete")
  @RequireScope("store")
  @RequireRoles("AUDITOR")
  async completeChecklistInstance(
    @Req()
    request: {
      user: {
        userId: string;
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
    });
  }
}
