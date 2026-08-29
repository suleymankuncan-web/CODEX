import { Controller, Get, Query, Req } from "@nestjs/common";
import type { AuthenticatedUser } from "../../auth/auth-context.service";
import { RequireRoles } from "../../auth/decorators/roles.decorator";
import { RequireScope } from "../../auth/decorators/scope.decorator";
import { ChecklistCommandReadService } from "../application/checklist-command-read.service";
import { ListChecklistCommandQueryDto } from "./dto/list-checklist-command.query";
import { ListChecklistCommandRegionsQueryDto } from "./dto/list-checklist-command-regions.query";

@Controller("checklists/command-canvas")
export class ChecklistCommandController {
  constructor(private readonly service: ChecklistCommandReadService) {}

  @Get("regions")
  @RequireScope("authenticated")
  @RequireRoles("REPORT_VIEWER")
  async listRegions(
    @Req() request: { user: AuthenticatedUser },
    @Query() query: ListChecklistCommandRegionsQueryDto,
  ) {
    return {
      data: await this.service.listRegions({
        actorRoleCodes: request.user.roleCodes,
        actorReadScope: request.user.readScope,
        roleScopes: request.user.roleScopes,
        period: query.period,
        signal: query.signal,
        sort: query.sort,
        limit: query.limit,
        offset: query.offset,
      }),
    };
  }

  @Get()
  @RequireScope("authenticated")
  @RequireRoles(
    "STORE_MANAGER",
    "SUPER_ADMIN",
    "REPORT_VIEWER",
    "REGION_MANAGER",
    "VISUAL_MERCHANDISER",
  )
  async list(
    @Req() request: { user: AuthenticatedUser },
    @Query() query: ListChecklistCommandQueryDto,
  ) {
    return {
      data: await this.service.list({
        actorRoleCodes: request.user.roleCodes,
        actorReadScope: request.user.readScope,
        roleScopes: request.user.roleScopes,
        period: query.period,
        managerUserId: query.managerUserId,
        regionId: query.regionId,
        query: query.query,
        status: query.status,
        signal: query.signal,
        sort: query.sort,
        limit: query.limit,
        offset: query.offset,
      }),
    };
  }
}
