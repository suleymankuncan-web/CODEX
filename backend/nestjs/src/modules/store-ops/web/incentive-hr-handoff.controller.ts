import { Body, Controller, Get, Post, Query, Req } from "@nestjs/common";
import type { AuthenticatedUser } from "../../auth/auth-context.service";
import { RequireRoles } from "../../auth/decorators/roles.decorator";
import { RequireScope } from "../../auth/decorators/scope.decorator";
import { IncentiveHrHandoffService } from "../application/incentive-hr-handoff.service";
import { resolveSalesTargetIncentivePeriodKey } from "../application/sales-target-incentive-admin-package-workflow.service";
import { GetSalesTargetIncentiveQueryDto } from "./dto/get-sales-target-incentive.query";
import { SendIncentiveHrDto } from "./dto/send-incentive-hr.dto";

@Controller("store/incentives/hr-handoff")
@RequireScope("authenticated")
@RequireRoles("REPORT_VIEWER")
export class IncentiveHrHandoffController {
  constructor(private readonly service: IncentiveHrHandoffService) {}

  @Get()
  preview(@Req() request: { user: AuthenticatedUser }, @Query() query: GetSalesTargetIncentiveQueryDto) {
    return this.service.preview(request.user, resolveSalesTargetIncentivePeriodKey(query.period));
  }

  @Post()
  send(@Req() request: { user: AuthenticatedUser }, @Body() body: SendIncentiveHrDto) {
    return this.service.send(request.user, body.period, body.version);
  }
}
