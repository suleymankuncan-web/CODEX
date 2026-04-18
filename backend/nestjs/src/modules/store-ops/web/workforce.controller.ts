import { Controller, Get, Query } from "@nestjs/common";
import { WorkforceService } from "../application/workforce.service";
import { RequireScope } from "../../auth/decorators/scope.decorator";
import { HeadcountGapQueryDto } from "./dto/headcount-gap.query";

@Controller("workforce")
export class WorkforceController {
  constructor(private readonly workforceService: WorkforceService) {}

  @Get("headcount-gap")
  @RequireScope("store")
  async getHeadcountGap(
    @Query() query: HeadcountGapQueryDto,
  ) {
    return this.workforceService.getStoreHeadcountGap({
      storeId: query.storeId,
      periodStart: query.periodStart,
      periodEnd: query.periodEnd,
    });
  }
}
