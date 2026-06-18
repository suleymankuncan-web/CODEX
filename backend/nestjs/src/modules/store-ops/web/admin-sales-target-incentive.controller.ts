import { Controller, Get, Query, Req } from "@nestjs/common";
import { AuthenticatedUser } from "../../auth/auth-context.service";
import { RequireRoles } from "../../auth/decorators/roles.decorator";
import { RequireScope } from "../../auth/decorators/scope.decorator";
import { SalesTargetIncentiveApiService } from "../application/sales-target-incentive-api.service";
import { GetSalesTargetIncentiveQueryDto } from "./dto/get-sales-target-incentive.query";

type SalesTargetIncentiveRequest = {
  user: AuthenticatedUser;
};

@Controller("admin/incentives")
export class AdminSalesTargetIncentiveController {
  constructor(
    private readonly salesTargetIncentiveApiService: SalesTargetIncentiveApiService,
  ) {}

  @Get()
  @RequireScope("authenticated")
  @RequireRoles("SUPER_ADMIN")
  async getAdminIncentiveProjection(
    @Req() request: SalesTargetIncentiveRequest,
    @Query() query: GetSalesTargetIncentiveQueryDto,
  ) {
    return this.salesTargetIncentiveApiService.getAdminProjection({
      actor: request.user,
      periodKey: query.period,
    });
  }
}
