import { Controller, Get, Query, Req } from "@nestjs/common";
import { OrgService } from "../application/org.service";
import { RequireScope } from "../../auth/decorators/scope.decorator";
import { ListStoresQueryDto } from "./dto/list-stores.query";

@Controller("org")
export class OrgController {
  constructor(private readonly orgService: OrgService) {}

  @Get("stores")
  @RequireScope("authenticated")
  async listStores(
    @Req()
    request: {
      user: {
        scope: {
          companyIds: string[];
          regionIds: string[];
          storeIds: string[];
        };
      };
    },
    @Query() query: ListStoresQueryDto,
  ) {
    return this.orgService.listStoresByScope({
      companyIds: request.user.scope.companyIds,
      regionIds: request.user.scope.regionIds,
      storeIds: request.user.scope.storeIds,
      companyId: query.companyId,
      regionId: query.regionId,
      storeId: query.storeId,
    });
  }
}
