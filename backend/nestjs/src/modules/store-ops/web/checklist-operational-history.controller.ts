import { Controller, Get, Param, Query, Req } from "@nestjs/common";
import type { AuthenticatedUser } from "../../auth/auth-context.service";
import { RequireRoles } from "../../auth/decorators/roles.decorator";
import { RequireScope } from "../../auth/decorators/scope.decorator";
import { ChecklistOperationalHistoryService } from "../application/checklist-operational-history.service";
import { GetChecklistOperationalHistoryParamsDto } from "./dto/get-checklist-operational-history.params";
import { GetChecklistOperationalHistoryQueryDto } from "./dto/get-checklist-operational-history.query";

@Controller("checklists/command-canvas/stores")
export class ChecklistOperationalHistoryController {
  constructor(private readonly service: ChecklistOperationalHistoryService) {}

  @Get(":storeId/operational-history")
  @RequireScope("authenticated")
  @RequireRoles("REPORT_VIEWER", "REGION_MANAGER", "STORE_MANAGER")
  async read(
    @Req() request: { user: AuthenticatedUser },
    @Param() params: GetChecklistOperationalHistoryParamsDto,
    @Query() query: GetChecklistOperationalHistoryQueryDto,
  ) {
    return {
      data: await this.service.read({
        actorRoleCodes: request.user.roleCodes,
        roleScopes: request.user.roleScopes,
        storeId: params.storeId,
        range: query.range,
        kinds: query.kinds,
        cursor: query.cursor,
      }),
    };
  }
}
