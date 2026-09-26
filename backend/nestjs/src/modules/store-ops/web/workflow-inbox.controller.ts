import { Controller, Get, Query, Req } from "@nestjs/common";
import { RequireRoles } from "../../auth/decorators/roles.decorator";
import { RequireScope } from "../../auth/decorators/scope.decorator";
import { WorkflowInboxService } from "../application/workflow-inbox.service";
import { ListRequestCenterQueryDto } from "./dto/list-request-center.query";
import { resolveReportViewerCompanyScope } from "../application/report-viewer-company-scope";
import { resolveRegionManagerAssignedStoreIds } from "../application/region-manager-assigned-stores";

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
        roleScopes?: Record<string, {
          companyIds: string[];
          regionIds: string[];
          storeIds: string[];
        }>;
      };
    },
  ) {
    const actorReadScope = request.user.roleCodes.includes("REPORT_VIEWER")
      ? resolveReportViewerCompanyScope({
          actorRoleCodes: request.user.roleCodes,
          actorScope: request.user.scope,
          roleScopes: request.user.roleScopes,
        })
      : undefined;

    return this.workflowInboxService.listInbox({
      actorRoles: request.user.roleCodes,
      actorScope: request.user.scope,
      actorActionScope: { assignedStoreIds: resolveRegionManagerAssignedStoreIds({ roleCodes: request.user.roleCodes, roleScopes: request.user.roleScopes, assignedStoreIds: request.user.actionScope.assignedStoreIds }) },
      ...(actorReadScope ? { actorReadScope } : {}),
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
        roleScopes?: Record<string, {
          companyIds: string[];
          regionIds: string[];
          storeIds: string[];
        }>;
      };
    },
    @Query() query: ListRequestCenterQueryDto,
  ) {
    const actorReadScope = request.user.roleCodes.includes("REPORT_VIEWER")
      ? resolveReportViewerCompanyScope({
          actorRoleCodes: request.user.roleCodes,
          actorScope: request.user.scope,
          roleScopes: request.user.roleScopes,
        })
      : undefined;

    return this.workflowInboxService.listRequestCenter({
      actorRoles: request.user.roleCodes,
      actorScope: request.user.scope,
      actorActionScope: { assignedStoreIds: resolveRegionManagerAssignedStoreIds({ roleCodes: request.user.roleCodes, roleScopes: request.user.roleScopes, assignedStoreIds: request.user.actionScope.assignedStoreIds }) },
      ...(actorReadScope ? { actorReadScope } : {}),
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
