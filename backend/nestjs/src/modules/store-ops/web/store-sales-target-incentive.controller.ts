import { Controller, Get, Query, Req } from "@nestjs/common";
import { AuthenticatedUser } from "../../auth/auth-context.service";
import { RequireRoles } from "../../auth/decorators/roles.decorator";
import { RequireScope } from "../../auth/decorators/scope.decorator";
import { SalesTargetIncentiveApiService } from "../application/sales-target-incentive-api.service";
import { GetSalesTargetIncentiveQueryDto } from "./dto/get-sales-target-incentive.query";

type SalesTargetIncentiveRequest = {
  user: AuthenticatedUser;
};

@Controller("store")
export class StoreSalesTargetIncentiveController {
  constructor(
    private readonly salesTargetIncentiveApiService: SalesTargetIncentiveApiService,
  ) {}

  @Get("me/incentives")
  @RequireScope("authenticated")
  @RequireRoles("STORE_PERSONNEL")
  async getOwnIncentiveProjection(
    @Req() request: SalesTargetIncentiveRequest,
    @Query() query: GetSalesTargetIncentiveQueryDto,
  ) {
    return this.salesTargetIncentiveApiService.getOwnStoreMeProjection({
      actor: request.user,
      periodKey: query.period,
    });
  }

  @Get("incentives")
  @RequireScope("authenticated")
  @RequireRoles("STORE_MANAGER", "REGION_MANAGER")
  async getStoreIncentiveProjection(
    @Req() request: SalesTargetIncentiveRequest,
    @Query() query: GetSalesTargetIncentiveQueryDto,
  ) {
    return this.salesTargetIncentiveApiService.getStoreProjection({
      actor: request.user,
      periodKey: query.period,
    });
  }
}
