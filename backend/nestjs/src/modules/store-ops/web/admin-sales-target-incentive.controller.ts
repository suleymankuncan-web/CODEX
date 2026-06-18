import { Body, Controller, Get, Post, Query, Req } from "@nestjs/common";
import { AuthenticatedUser } from "../../auth/auth-context.service";
import { RequireRoles } from "../../auth/decorators/roles.decorator";
import { RequireScope } from "../../auth/decorators/scope.decorator";
import { SalesTargetIncentiveApiService } from "../application/sales-target-incentive-api.service";
import { CreateSalesTargetIncentiveCorrectionDto } from "./dto/create-sales-target-incentive-correction.dto";
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

  @Post("corrections")
  @RequireScope("authenticated")
  @RequireRoles("SUPER_ADMIN")
  async createAdminIncentiveCorrection(
    @Req() request: SalesTargetIncentiveRequest,
    @Body() body: CreateSalesTargetIncentiveCorrectionDto,
  ) {
    return this.salesTargetIncentiveApiService.applyAdminCorrection({
      actor: request.user,
      periodKey: body.period,
      storeId: body.storeId,
      employeeId: body.employeeId,
      participantType: body.participantType,
      adjustmentAmount: body.adjustmentAmount,
      reasonCode: body.reasonCode,
      reasonNote: body.reasonNote,
    });
  }
}
