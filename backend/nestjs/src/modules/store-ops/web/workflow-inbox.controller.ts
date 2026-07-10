import { Controller, Get, Query, Req } from "@nestjs/common";
import { RequireRoles } from "../../auth/decorators/roles.decorator";
import { RequireScope } from "../../auth/decorators/scope.decorator";
import { WorkflowInboxService } from "../application/workflow-inbox.service";
import { ListRequestCenterQueryDto } from "./dto/list-request-center.query";

@Controller("workflow")
export class WorkflowInboxController {
  constructor(private readonly workflowInboxService: WorkflowInboxService) {}

  @Get("inbox")
  @RequireScope("authenticated")
  @RequireRoles("STORE_MANAGER", "SUPER_ADMIN", "REPORT_VIEWER", "REGION_MANAGER")
  async listInbox(
    @Req()
    request: {
      user: {
        roleCodes: string[];
        scope: {
          companyIds: string[];
          regionIds: string[];
          storeIds: string[];
        };
        actionScope: {
          assignedStoreIds: string[];
        };
      };
    },
  ) {
    return this.workflowInboxService.listInbox({
      actorRoles: request.user.roleCodes,
      actorScope: request.user.scope,
      actorActionScope: request.user.actionScope,
    });
  }

  @Get("request-center")
  @RequireScope("authenticated")
  @RequireRoles("STORE_MANAGER", "SUPER_ADMIN", "REPORT_VIEWER", "REGION_MANAGER")
  async listRequestCenter(
    @Req()
    request: {
      user: {
        roleCodes: string[];
        scope: {
          companyIds: string[];
          regionIds: string[];
          storeIds: string[];
        };
        actionScope: {
          assignedStoreIds: string[];
        };
      };
    },
    @Query() query: ListRequestCenterQueryDto,
  ) {
    return this.workflowInboxService.listRequestCenter({
      actorRoles: request.user.roleCodes,
      actorScope: request.user.scope,
      actorActionScope: request.user.actionScope,
      bucket: query.bucket ?? "open",
      type: query.type ?? "all",
      status: query.status ?? "all",
      period: query.period,
      storeId: query.storeId,
      query: query.q,
      limit: query.limit ?? 15,
      offset: query.offset ?? 0,
    });
  }
}
