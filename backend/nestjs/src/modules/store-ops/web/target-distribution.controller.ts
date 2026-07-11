import { Body, Controller, Get, Patch, Post, Query, Req } from "@nestjs/common";
import { ApiExtraModels } from "@nestjs/swagger";
import { RequireRoles } from "../../auth/decorators/roles.decorator";
import { RequireActionScope } from "../../auth/decorators/scope.decorator";
import { TargetDistributionService } from "../application/target-distribution.service";
import { CreateTargetDistributionRequestDto } from "./dto/create-target-distribution-request.dto";
import {
  ApprovedTargetDistributionAllocationDto,
  ApproveTargetDistributionRequestDto,
} from "./dto/approve-target-distribution-request.dto";
import { ListTargetDistributionRequestsQueryDto } from "./dto/list-target-distribution-requests.query";
import { ListTargetCoverageQueryDto } from "./dto/list-target-coverage.query";
import { resolveReportViewerCompanyScope } from "../application/report-viewer-company-scope";

@ApiExtraModels(ApprovedTargetDistributionAllocationDto)
@Controller("target-distributions")
export class TargetDistributionController {
  constructor(private readonly targetDistributionService: TargetDistributionService) {}

  @Get("store-personnel")
  @RequireActionScope("store")
  @RequireRoles("STORE_MANAGER", "SUPER_ADMIN")
  async listStorePersonnel(
    @Req()
    request: {
      user: {
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
    @Query("storeId") storeId: string,
  ) {
    return this.targetDistributionService.listStorePersonnel({
      actorScope: request.user.scope,
      actorActionScope: request.user.actionScope,
      storeId,
    });
  }

  @Get("requests")
  @RequireRoles("STORE_MANAGER", "SUPER_ADMIN", "REPORT_VIEWER", "REGION_MANAGER")
  async listRequests(
    @Req()
    request: {
      user: {
        scope: {
          companyIds: string[];
          regionIds: string[];
          storeIds: string[];
        };
        actionScope: {
          assignedStoreIds: string[];
        };
        roleCodes: string[];
        roleScopes?: Record<string, {
          companyIds: string[];
          regionIds: string[];
          storeIds: string[];
        }>;
      };
    },
    @Query() query: ListTargetDistributionRequestsQueryDto,
  ) {
    return this.targetDistributionService.listRequests({
      actorScope: request.user.roleCodes.includes("REPORT_VIEWER")
        ? resolveReportViewerCompanyScope({
            actorRoleCodes: request.user.roleCodes,
            actorScope: request.user.scope,
            roleScopes: request.user.roleScopes,
          })
        : request.user.scope,
      actorActionScope: request.user.actionScope,
      actorRoleCodes: request.user.roleCodes,
      statuses: query.status ? [query.status] : undefined,
      requestMonth: query.requestMonth,
      storeId: query.storeId,
      limit: query.limit,
      offset: query.offset,
    });
  }

  @Get("coverage")
  @RequireRoles("STORE_MANAGER", "SUPER_ADMIN", "HR_ADMIN", "REPORT_VIEWER", "REGION_MANAGER")
  async getTargetCoverage(
    @Req()
    request: {
      user: {
        scope: {
          companyIds: string[];
          regionIds: string[];
          storeIds: string[];
        };
        actionScope: {
          assignedStoreIds: string[];
        };
        roleCodes: string[];
        roleScopes?: Record<string, {
          companyIds: string[];
          regionIds: string[];
          storeIds: string[];
        }>;
      };
    },
    @Query() query: ListTargetCoverageQueryDto,
  ) {
    return this.targetDistributionService.getTargetCoverage({
      actorScope: request.user.roleCodes.includes("REPORT_VIEWER")
        ? resolveReportViewerCompanyScope({
            actorRoleCodes: request.user.roleCodes,
            actorScope: request.user.scope,
            roleScopes: request.user.roleScopes,
          })
        : request.user.scope,
      actorActionScope: request.user.actionScope,
      actorRoleCodes: request.user.roleCodes,
      requestMonth: query.requestMonth,
      storeId: query.storeId,
    });
  }

  @Post("requests")
  @RequireActionScope("store")
  @RequireRoles("STORE_MANAGER", "SUPER_ADMIN")
  async createRequest(
    @Req()
    request: {
      user: {
        userId: string;
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
    @Body() body: CreateTargetDistributionRequestDto,
  ) {
    return this.targetDistributionService.createRequest({
      actorUserId: request.user.userId,
      actorScope: request.user.scope,
      actorActionScope: request.user.actionScope,
      ...body,
    });
  }

  @Patch("requests/:requestId/approve")
  @RequireRoles("SUPER_ADMIN", "REGION_MANAGER")
  async approveRequest(
    @Req()
    request: {
      user: {
        userId: string;
        actionScope: {
          assignedStoreIds: string[];
        };
      };
      params: {
        requestId: string;
      };
    },
    @Body() body: ApproveTargetDistributionRequestDto,
  ) {
    return this.targetDistributionService.approveRequest({
      actorUserId: request.user.userId,
      actorActionScope: request.user.actionScope,
      requestId: request.params.requestId,
      approvalNote: body.approvalNote,
      approvedTotalTargetValue: body.approvedTotalTargetValue,
      approvedAllocations: body.approvedAllocations,
    });
  }
}
