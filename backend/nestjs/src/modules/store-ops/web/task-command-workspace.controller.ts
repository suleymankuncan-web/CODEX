import { Controller, Get, Param, Query, Req } from "@nestjs/common";
import type { AuthenticatedUser } from "../../auth/auth-context.service";
import { RequireRoles } from "../../auth/decorators/roles.decorator";
import { RequireScope } from "../../auth/decorators/scope.decorator";
import { TaskCommandWorkspaceReadService } from "../application/task-command-workspace-read.service";
import {
  GetTaskCommandEventsQueryDto,
  GetTaskCommandWorkspaceQueryDto,
} from "./dto/get-task-command-workspace.query";

@Controller("store/tasks")
export class TaskCommandWorkspaceController {
  constructor(private readonly service: TaskCommandWorkspaceReadService) {}

  @Get("workspace")
  @RequireScope("authenticated")
  @RequireRoles("REPORT_VIEWER", "REGION_MANAGER", "STORE_MANAGER", "SUPER_ADMIN")
  async getWorkspace(
    @Req() request: { user: AuthenticatedUser },
    @Query() query: GetTaskCommandWorkspaceQueryDto,
  ) {
    return {
      data: await this.service.getWorkspace({
        actor: request.user,
        periodStart: query.periodStart,
        periodEnd: query.periodEnd,
        limit: query.limit,
        offset: query.offset,
      }),
    };
  }

  @Get(":actionPlanId/events")
  @RequireScope("authenticated")
  @RequireRoles("REPORT_VIEWER", "REGION_MANAGER", "STORE_MANAGER", "SUPER_ADMIN")
  async getEvents(
    @Req() request: { user: AuthenticatedUser },
    @Param("actionPlanId") actionPlanId: string,
    @Query() query: GetTaskCommandEventsQueryDto,
  ) {
    return {
      data: await this.service.getEvents({
        actor: request.user,
        actionPlanId,
        limit: query.limit,
        offset: query.offset,
      }),
    };
  }
}
