import { Controller, Get, Query, Req } from "@nestjs/common";
import type { AuthenticatedUser } from "../../auth/auth-context.service";
import { RequireRoles } from "../../auth/decorators/roles.decorator";
import { RequireScope } from "../../auth/decorators/scope.decorator";
import { TargetWorkspaceReadService } from "../application/target-workspace-read.service";
import { GetTargetWorkspaceQueryDto } from "./dto/get-target-workspace.query";

@Controller("store/targets/workspace")
export class TargetWorkspaceController {
  constructor(private readonly service: TargetWorkspaceReadService) {}

  @Get()
  @RequireScope("authenticated")
  @RequireRoles("REPORT_VIEWER", "REGION_MANAGER", "STORE_MANAGER")
  async getWorkspace(
    @Req() request: { user: AuthenticatedUser },
    @Query() query: GetTargetWorkspaceQueryDto,
  ) {
    return {
      data: await this.service.getWorkspace({
        actor: request.user,
        periodKey: query.period,
        historyYear: query.historyYear,
        limit: query.limit,
        offset: query.offset,
      }),
    };
  }
}
