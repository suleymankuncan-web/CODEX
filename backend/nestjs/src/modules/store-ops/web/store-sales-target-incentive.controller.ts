import { Body, Controller, Get, Post, Query, Req } from "@nestjs/common";
import { AuthenticatedUser } from "../../auth/auth-context.service";
import { RequireRoles } from "../../auth/decorators/roles.decorator";
import { RequireScope } from "../../auth/decorators/scope.decorator";
import { SalesTargetIncentiveApiService } from "../application/sales-target-incentive-api.service";
import { CreateSalesTargetIncentiveRegionCorrectionDto } from "./dto/create-sales-target-incentive-region-correction.dto";
import { GetSalesTargetIncentiveQueryDto } from "./dto/get-sales-target-incentive.query";
import { MarkSalesTargetIncentiveStoreReviewDto } from "./dto/mark-sales-target-incentive-store-review.dto";
import { SubmitSalesTargetIncentiveRegionPackageDto } from "./dto/submit-sales-target-incentive-region-package.dto";
import { VoidSalesTargetIncentiveRegionCorrectionDto } from "./dto/void-sales-target-incentive-region-correction.dto";

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

  @Post("incentives/store-reviews")
  @RequireScope("authenticated")
  @RequireRoles("REGION_MANAGER")
  async markStoreReview(
    @Req() request: SalesTargetIncentiveRequest,
    @Body() body: MarkSalesTargetIncentiveStoreReviewDto,
  ) {
    return this.salesTargetIncentiveApiService.markStoreReview({
      actor: request.user,
      periodKey: body.period,
      storeId: body.storeId,
      reviewStatus: body.reviewStatus,
    });
  }

  @Post("incentives/corrections")
  @RequireScope("authenticated")
  @RequireRoles("REGION_MANAGER")
  async createRegionCorrection(
    @Req() request: SalesTargetIncentiveRequest,
    @Body() body: CreateSalesTargetIncentiveRegionCorrectionDto,
  ) {
    return this.salesTargetIncentiveApiService.createRegionCorrection({
      actor: request.user,
      periodKey: body.period,
      storeId: body.storeId,
      employeeId: body.employeeId,
      participantType: body.participantType,
      finalAmount: body.finalAmount,
      reasonNote: body.reasonNote,
    });
  }

  @Post("incentives/corrections/void")
  @RequireScope("authenticated")
  @RequireRoles("REGION_MANAGER")
  async voidRegionCorrection(
    @Req() request: SalesTargetIncentiveRequest,
    @Body() body: VoidSalesTargetIncentiveRegionCorrectionDto,
  ) {
    return this.salesTargetIncentiveApiService.voidRegionCorrection({
      actor: request.user,
      periodKey: body.period,
      correctionId: body.correctionId,
    });
  }

  @Post("incentives/submissions")
  @RequireScope("authenticated")
  @RequireRoles("REGION_MANAGER")
  async submitRegionPackage(
    @Req() request: SalesTargetIncentiveRequest,
    @Body() body: SubmitSalesTargetIncentiveRegionPackageDto,
  ) {
    return this.salesTargetIncentiveApiService.submitRegionPackage({
      actor: request.user,
      periodKey: body.period,
      regionId: body.regionId,
      submissionNote: body.submissionNote,
    });
  }
}
