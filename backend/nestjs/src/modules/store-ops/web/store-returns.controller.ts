import { Controller, Get, Query, Req } from "@nestjs/common";
import type { AuthenticatedUser } from "../../auth/auth-context.service";
import { RequireRoles } from "../../auth/decorators/roles.decorator";
import { RequireScope } from "../../auth/decorators/scope.decorator";
import { StoreReturnsReadService } from "../application/store-returns-read.service";
import { GetStoreReturnsQueryDto } from "./dto/get-store-returns.query";

@Controller("reports/store-returns")
export class StoreReturnsController {
  constructor(private readonly service: StoreReturnsReadService) {}

  @Get()
  @RequireScope("authenticated")
  @RequireRoles("REPORT_VIEWER", "SUPER_ADMIN", "REGION_MANAGER", "STORE_MANAGER")
  async getLedger(@Req() request: { user: AuthenticatedUser }, @Query() query: GetStoreReturnsQueryDto) {
    return { data: await this.service.getLedger({ actor: request.user, ...query }) };
  }
}
