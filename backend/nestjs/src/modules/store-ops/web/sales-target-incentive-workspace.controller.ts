import { Body, Controller, Get, Post, Query, Req } from "@nestjs/common";
import type { AuthenticatedUser } from "../../auth/auth-context.service";
import { RequireRoles } from "../../auth/decorators/roles.decorator";
import { RequireScope } from "../../auth/decorators/scope.decorator";
import { SalesTargetIncentiveWorkspaceReadService } from "../application/sales-target-incentive-workspace-read.service";
import { GetSalesTargetIncentiveQueryDto } from "./dto/get-sales-target-incentive.query";
import { SetIncentiveParticipationDto } from "./dto/set-incentive-participation.dto";
import { SalesTargetIncentiveParticipationService } from "../application/sales-target-incentive-participation.service";

@Controller("store/incentives/workspace")
export class SalesTargetIncentiveWorkspaceController {
  constructor(private readonly service: SalesTargetIncentiveWorkspaceReadService, private readonly participation: SalesTargetIncentiveParticipationService) {}

  @Post("participation")
  @RequireScope("authenticated")
  @RequireRoles("REGION_MANAGER")
  setParticipation(@Req() request: { user: AuthenticatedUser }, @Body() body: SetIncentiveParticipationDto) {
    return this.participation.setParticipation({ ...body, actor: request.user });
  }

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
