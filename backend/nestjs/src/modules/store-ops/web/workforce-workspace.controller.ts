import { Controller, Get, Query, Req } from "@nestjs/common";
import type { AuthenticatedUser } from "../../auth/auth-context.service";
import { RequireRoles } from "../../auth/decorators/roles.decorator";
import { RequireScope } from "../../auth/decorators/scope.decorator";
import { WorkforceWorkspaceReadService } from "../application/workforce-workspace-read.service";
import { GetWorkforceWorkspaceQueryDto } from "./dto/get-workforce-workspace.query";

@Controller("store/workforce/workspace")
export class WorkforceWorkspaceController {
  constructor(private readonly service: WorkforceWorkspaceReadService) {}

  @Get()
  @RequireScope("authenticated")
  @RequireRoles("REPORT_VIEWER", "REGION_MANAGER", "STORE_MANAGER")
  async getWorkspace(
    @Req() request: { user: AuthenticatedUser },
    @Query() query: GetWorkforceWorkspaceQueryDto,
  ) {
    return {
      data: await this.service.getWorkspace({
        actor: request.user,
        regionManagerUserId: query.regionManagerUserId,
        limit: query.limit,
        offset: query.offset,
        historyStoreId: query.historyStoreId,
        historyLimit: query.historyLimit,
        historyOffset: query.historyOffset,
        personnelStoreId: query.personnelStoreId,
        personnelLimit: query.personnelLimit,
        personnelOffset: query.personnelOffset,
        query: query.q,
        status: query.status,
        sort: query.sort,
        direction: query.direction,
      }),
    };
  }
}
