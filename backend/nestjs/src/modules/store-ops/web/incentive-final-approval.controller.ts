import { Body, Controller, Get, Post, Query, Req } from "@nestjs/common";
import type { AuthenticatedUser } from "../../auth/auth-context.service";
import { RequireRoles } from "../../auth/decorators/roles.decorator";
import { RequireScope } from "../../auth/decorators/scope.decorator";
import { SalesTargetIncentiveAdminPackageWorkflowService, resolveSalesTargetIncentivePeriodKey } from "../application/sales-target-incentive-admin-package-workflow.service";
import { ApproveFinalIncentivePackageDto } from "./dto/approve-final-incentive-package.dto";
import { GetSalesTargetIncentiveQueryDto } from "./dto/get-sales-target-incentive.query";

@Controller("store/incentives/final-approval")
@RequireScope("authenticated")
@RequireRoles("REPORT_VIEWER")
export class IncentiveFinalApprovalController {
  constructor(private readonly service: SalesTargetIncentiveAdminPackageWorkflowService) {}

  @Get()
  async list(@Req() request: { user: AuthenticatedUser }, @Query() query: GetSalesTargetIncentiveQueryDto) {
    return { items: await this.service.listFinalApprovalPackages({ actor: request.user, periodKey: resolveSalesTargetIncentivePeriodKey(query.period) }) };
  }

  @Post()
  async approve(@Req() request: { user: AuthenticatedUser }, @Body() body: ApproveFinalIncentivePackageDto) {
    return this.service.approveFinalPackage({ actor: request.user, periodKey: body.period, regionPackageId: body.regionPackageId, submittedAt: body.submittedAt, decision: body.decision, reviewNote: body.reviewNote });
  }
}
