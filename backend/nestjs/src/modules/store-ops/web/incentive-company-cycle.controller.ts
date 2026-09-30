import { Body, Controller, Get, Post, Query, Req } from "@nestjs/common";
import { ApiOkResponse, ApiCreatedResponse, ApiQuery } from "@nestjs/swagger";
import type { AuthenticatedUser } from "../../auth/auth-context.service";
import { RequireRoles } from "../../auth/decorators/roles.decorator";
import { RequireScope } from "../../auth/decorators/scope.decorator";
import { IncentiveCompanyCycleService } from "../application/incentive-company-cycle.service";
import { resolveSalesTargetIncentivePeriodKey } from "../application/sales-target-incentive-admin-package-workflow.service";
import { GetSalesTargetIncentiveQueryDto } from "./dto/get-sales-target-incentive.query";
import { DecideIncentiveCompanyDto, SealIncentiveCompanyDto, IncentiveCompanyListDto, IncentiveCompanyCommandResultDto } from "./dto/incentive-company-cycle.dto";

@Controller("store/incentives/company-cycle")
@RequireScope("authenticated")
@RequireRoles("REPORT_VIEWER", "HR_ADMIN")
export class IncentiveCompanyCycleController {
  constructor(private readonly service: IncentiveCompanyCycleService) {}
  @Get() @ApiOkResponse({ type: IncentiveCompanyListDto })
  @ApiQuery({ name: "period", required: false, schema: { type: "string", pattern: "^[0-9]{4}-(0[1-9]|1[0-2])$" } })
  list(@Req() request: { user: AuthenticatedUser }, @Query() query: GetSalesTargetIncentiveQueryDto) {
    return this.service.list(request.user, resolveSalesTargetIncentivePeriodKey(query.period));
  }
  @Post("seal") @ApiCreatedResponse({ type: IncentiveCompanyCommandResultDto })
  seal(@Req() request: { user: AuthenticatedUser }, @Body() body: SealIncentiveCompanyDto) {
    return this.service.seal(request.user, body);
  }
  @Post("decisions") @ApiCreatedResponse({ type: IncentiveCompanyCommandResultDto })
  decide(@Req() request: { user: AuthenticatedUser }, @Body() body: DecideIncentiveCompanyDto) {
    return this.service.decide(request.user, body);
  }
}
