import { Controller, Get, Query, Req } from "@nestjs/common";
import { OrgService } from "../application/org.service";
import { RequireScope } from "../../auth/decorators/scope.decorator";
import { ListStoresQueryDto } from "./dto/list-stores.query";
import { resolveReportViewerCompanyScope } from "../application/report-viewer-company-scope";
import { resolveRegionManagerAssignedStoreIds } from "../application/region-manager-assigned-stores";

@Controller("org")
export class OrgController {
  constructor(private readonly orgService: OrgService) {}

  @Get("stores")
  @RequireScope("authenticated")
  async listStores(
    @Req()
    request: {
      user: {
        roleCodes: string[];
        scope: {
          companyIds: string[];
          regionIds: string[];
          storeIds: string[];
        };
        roleScopes?: Record<string, {
          companyIds: string[];
          regionIds: string[];
          storeIds: string[];
        }>;
        actionScope?: {
          assignedStoreIds: string[];
        };
      };
    },
    @Query() query: ListStoresQueryDto,
  ) {
    const storeReadScope = this.resolveStoreReadScope({
      actorRoleCodes: request.user.roleCodes,
      actorScope: request.user.scope,
      actorActionScope: request.user.actionScope,
      roleScopes: request.user.roleScopes,
    });

    return this.orgService.listStoresByScope({
      companyIds: storeReadScope.companyIds,
      regionIds: storeReadScope.regionIds,
      storeIds: storeReadScope.storeIds,
      companyId: query.companyId,
      regionId: query.regionId,
      storeId: query.storeId,
    });
  }

  private resolveStoreReadScope(input: {
    actorRoleCodes: string[];
    actorScope: {
      companyIds: string[];
      regionIds: string[];
      storeIds: string[];
    };
    actorActionScope?: {
      assignedStoreIds: string[];
    };
    roleScopes?: Record<string, {
      companyIds: string[];
      regionIds: string[];
      storeIds: string[];
    }>;
  }) {
    if (input.actorRoleCodes.includes("REPORT_VIEWER")) {
      return resolveReportViewerCompanyScope({
        actorRoleCodes: input.actorRoleCodes,
        actorScope: input.actorScope,
        roleScopes: input.roleScopes,
      });
    }

    if (input.actorRoleCodes.includes("REGION_MANAGER") &&
        !input.actorRoleCodes.some((roleCode) => ["AUDITOR", "HR_ADMIN", "INTEGRATION_ADMIN", "SNAPSHOT_OPERATOR", "SUPER_ADMIN"].includes(roleCode))) {
      return { companyIds: [], regionIds: [], storeIds: resolveRegionManagerAssignedStoreIds({ roleCodes: input.actorRoleCodes, roleScopes: input.roleScopes, assignedStoreIds: input.actorActionScope?.assignedStoreIds ?? [] }) };
    }

    const canUseBroadReadScope = input.actorRoleCodes.some((roleCode) =>
      [
        "AUDITOR",
        "HR_ADMIN",
        "INTEGRATION_ADMIN",
        "REPORT_VIEWER",
        "SNAPSHOT_OPERATOR",
        "SUPER_ADMIN",
      ].includes(roleCode),
    );
    const storeIds = input.actorActionScope?.assignedStoreIds.length
      ? input.actorActionScope.assignedStoreIds
      : input.actorScope.storeIds;

    if (!canUseBroadReadScope) {
      return {
        companyIds: [],
        regionIds: [],
        storeIds,
      };
    }

    return {
      companyIds: input.actorScope.companyIds,
      regionIds: input.actorScope.regionIds,
      storeIds:
        input.actorScope.companyIds.length > 0 || input.actorScope.regionIds.length > 0
          ? []
          : storeIds,
    };
  }
}
