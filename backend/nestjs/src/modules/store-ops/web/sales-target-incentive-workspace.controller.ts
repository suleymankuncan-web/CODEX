import { Controller, Get, Query, Req } from "@nestjs/common";
import type { AuthenticatedUser } from "../../auth/auth-context.service";
import { RequireRoles } from "../../auth/decorators/roles.decorator";
import { RequireScope } from "../../auth/decorators/scope.decorator";
import { SalesTargetIncentiveWorkspaceReadService } from "../application/sales-target-incentive-workspace-read.service";
import { GetSalesTargetIncentiveQueryDto } from "./dto/get-sales-target-incentive.query";

@Controller("store/incentives/workspace")
export class SalesTargetIncentiveWorkspaceController {
  constructor(private readonly service: SalesTargetIncentiveWorkspaceReadService) {}

  @Get()
  @RequireScope("authenticated")
  @RequireRoles("REPORT_VIEWER", "REGION_MANAGER")
  async getWorkspace(
    @Req() request: { user: AuthenticatedUser },
    @Query() query: GetSalesTargetIncentiveQueryDto,
  ) {
    return {
      data: await this.service.getWorkspace({
        actor: request.user,
        periodKey: query.period,
        throughDate: query.throughDate,
      }),
    };
  }
}
