import { Body, Controller, Get, Param, Patch, Post, Query, Req } from "@nestjs/common";
import { WorkforceService } from "../application/workforce.service";
import { RequireRoles } from "../../auth/decorators/roles.decorator";
import { RequireActionScope } from "../../auth/decorators/scope.decorator";
import { HeadcountGapQueryDto } from "./dto/headcount-gap.query";
import { SellerCodeReferenceQueryDto } from "./dto/seller-code-reference.query";
import { CreateSellerCodeRequestDto } from "./dto/create-seller-code-request.dto";
import { ApproveSellerCodeRequestDto } from "./dto/approve-seller-code-request.dto";
import { ListSellerCodeRequestsQueryDto } from "./dto/list-seller-code-requests.query";
import { ListPositionOptionsQueryDto } from "./dto/list-position-options.query";
import { ListStoreEmployeesQueryDto } from "./dto/list-store-employees.query";
import { CreateOffboardingRequestDto } from "./dto/create-offboarding-request.dto";
import { ApproveOffboardingRequestDto } from "./dto/approve-offboarding-request.dto";
import { ListOffboardingRequestsQueryDto } from "./dto/list-offboarding-requests.query";
import { RejectWorkforceRequestDto } from "./dto/reject-workforce-request.dto";
import { ResubmitSellerCodeRequestDto } from "./dto/resubmit-seller-code-request.dto";
import { ResubmitOffboardingRequestDto } from "./dto/resubmit-offboarding-request.dto";
import { resolveReportViewerCompanyScope } from "../application/report-viewer-company-scope";
import { resolveRegionManagerAssignedStoreIds } from "../application/region-manager-assigned-stores";

type WorkforceActorRequest = {
  user: {
    userId: string;
    roleCodes: string[];
    scope: {
      companyIds: string[];
      regionIds: string[];
      storeIds: string[];
    };
  };
};

@Controller("workforce")
export class WorkforceController {
  constructor(private readonly workforceService: WorkforceService) {}

  @Get("headcount-gap")
  @RequireRoles("STORE_MANAGER", "REGION_MANAGER", "HR_ADMIN", "SUPER_ADMIN", "REPORT_VIEWER")
  async getHeadcountGap(
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
    @Query() query: HeadcountGapQueryDto,
  ) {
    const actorReadScope = request.user.roleCodes.includes("REPORT_VIEWER")
      ? resolveReportViewerCompanyScope({
          actorRoleCodes: request.user.roleCodes,
          actorScope: request.user.scope,
          roleScopes: request.user.roleScopes,
        })
      : undefined;

    return this.workforceService.getStoreHeadcountGap({
      actorScope: request.user.scope,
      actorActionScope: { assignedStoreIds: resolveRegionManagerAssignedStoreIds({ roleCodes: request.user.roleCodes, roleScopes: request.user.roleScopes, assignedStoreIds: request.user.actionScope.assignedStoreIds }) },
      actorRoleCodes: request.user.roleCodes,
      ...(actorReadScope ? { actorReadScope } : {}),
      storeId: query.storeId,
      periodStart: query.periodStart,
      periodEnd: query.periodEnd,
    });
  }

  @Get("seller-code-reference")
  @RequireRoles("HR_ADMIN", "SUPER_ADMIN")
  async getSellerCodeReference(@Query() query: SellerCodeReferenceQueryDto) {
    return this.workforceService.getSellerCodeReference(query.storeType);
  }

  @Get("seller-code-requests")
  @RequireRoles("HR_ADMIN", "SUPER_ADMIN", "STORE_MANAGER")
  async listSellerCodeRequests(
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
      };
    },
    @Query() query: ListSellerCodeRequestsQueryDto,
  ) {
    return this.workforceService.listSellerCodeRequests({
      actorScope: request.user.scope,
      actorActionScope: request.user.actionScope,
      actorRoleCodes: request.user.roleCodes,
      status: query.status,
      storeId: query.storeId,
      limit: query.limit,
      offset: query.offset,
    });
  }

  @Get("position-options")
  @RequireActionScope("store")
  @RequireRoles("STORE_MANAGER", "SUPER_ADMIN")
  async listPositionOptions(
    @Req()
    request: {
      user: {
        scope: {
          storeIds: string[];
        };
        actionScope: {
          assignedStoreIds: string[];
        };
      };
    },
    @Query() query: ListPositionOptionsQueryDto,
  ) {
    return this.workforceService.listPositionOptions({
      actorScope: request.user.scope,
      actorActionScope: request.user.actionScope,
      storeId: query.storeId,
    });
  }

  @Get("store-employees")
  @RequireRoles("STORE_MANAGER", "REGION_MANAGER", "HR_ADMIN", "SUPER_ADMIN", "REPORT_VIEWER")
  async listStoreEmployees(
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
    @Query() query: ListStoreEmployeesQueryDto,
  ) {
    const actorReadScope = request.user.roleCodes.includes("REPORT_VIEWER")
      ? resolveReportViewerCompanyScope({
          actorRoleCodes: request.user.roleCodes,
          actorScope: request.user.scope,
          roleScopes: request.user.roleScopes,
        })
      : undefined;

    return this.workforceService.listActiveStoreEmployees({
      actorScope: request.user.scope,
      actorActionScope: { assignedStoreIds: resolveRegionManagerAssignedStoreIds({ roleCodes: request.user.roleCodes, roleScopes: request.user.roleScopes, assignedStoreIds: request.user.actionScope.assignedStoreIds }) },
      actorRoleCodes: request.user.roleCodes,
      ...(actorReadScope ? { actorReadScope } : {}),
      storeId: query.storeId,
    });
  }

  @Post("seller-code-requests")
  @RequireActionScope("store")
  @RequireRoles("STORE_MANAGER", "SUPER_ADMIN")
  async createSellerCodeRequest(
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
    @Body() body: CreateSellerCodeRequestDto,
  ) {
    return this.workforceService.createSellerCodeRequest({
      actorUserId: request.user.userId,
      actorScope: request.user.scope,
      actorActionScope: request.user.actionScope,
      ...body,
    });
  }

  @Get("offboarding-requests")
  @RequireRoles("HR_ADMIN", "SUPER_ADMIN", "STORE_MANAGER")
  async listOffboardingRequests(
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
      };
    },
    @Query() query: ListOffboardingRequestsQueryDto,
  ) {
    return this.workforceService.listOffboardingRequests({
      actorScope: request.user.scope,
      actorActionScope: request.user.actionScope,
      actorRoleCodes: request.user.roleCodes,
      status: query.status,
      storeId: query.storeId,
      limit: query.limit,
      offset: query.offset,
    });
  }

  @Post("offboarding-requests")
  @RequireActionScope("store")
  @RequireRoles("STORE_MANAGER", "SUPER_ADMIN")
  async createOffboardingRequest(
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
    @Body() body: CreateOffboardingRequestDto,
  ) {
    return this.workforceService.createOffboardingRequest({
      actorUserId: request.user.userId,
      actorScope: request.user.scope,
      actorActionScope: request.user.actionScope,
      ...body,
    });
  }

  @Patch("seller-code-requests/:requestId/approve")
  @RequireRoles("HR_ADMIN", "SUPER_ADMIN")
  async approveSellerCodeRequest(
    @Param("requestId") requestId: string,
    @Req()
    request: WorkforceActorRequest,
    @Body() body: ApproveSellerCodeRequestDto,
  ) {
    return this.workforceService.approveSellerCodeRequest({
      actorUserId: request.user.userId,
      actorScope: request.user.scope,
      actorRoleCodes: request.user.roleCodes,
      requestId,
      sellerCode: body.sellerCode,
      reviewNote: body.reviewNote,
    });
  }

  @Patch("seller-code-requests/:requestId/reject")
  @RequireRoles("HR_ADMIN", "SUPER_ADMIN")
  async rejectSellerCodeRequest(
    @Param("requestId") requestId: string,
    @Req()
    request: WorkforceActorRequest,
    @Body() body: RejectWorkforceRequestDto,
  ) {
    return this.workforceService.rejectSellerCodeRequest({
      actorUserId: request.user.userId,
      actorScope: request.user.scope,
      actorRoleCodes: request.user.roleCodes,
      requestId,
      reviewNote: body.reviewNote,
    });
  }

  @Patch("seller-code-requests/:requestId/resubmit")
  @RequireRoles("STORE_MANAGER", "SUPER_ADMIN")
  async resubmitSellerCodeRequest(
    @Param("requestId") requestId: string,
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
    @Body() body: ResubmitSellerCodeRequestDto,
  ) {
    return this.workforceService.resubmitSellerCodeRequest({
      actorUserId: request.user.userId,
      actorScope: request.user.scope,
      actorActionScope: request.user.actionScope,
      requestId,
      ...body,
    });
  }

  @Patch("offboarding-requests/:requestId/approve")
  @RequireRoles("HR_ADMIN", "SUPER_ADMIN")
  async approveOffboardingRequest(
    @Param("requestId") requestId: string,
    @Req()
    request: WorkforceActorRequest,
    @Body() body: ApproveOffboardingRequestDto,
  ) {
    return this.workforceService.approveOffboardingRequest({
      actorUserId: request.user.userId,
      actorScope: request.user.scope,
      actorRoleCodes: request.user.roleCodes,
      requestId,
      reviewNote: body.reviewNote,
    });
  }

  @Patch("offboarding-requests/:requestId/reject")
  @RequireRoles("HR_ADMIN", "SUPER_ADMIN")
  async rejectOffboardingRequest(
    @Param("requestId") requestId: string,
    @Req()
    request: WorkforceActorRequest,
    @Body() body: RejectWorkforceRequestDto,
  ) {
    return this.workforceService.rejectOffboardingRequest({
      actorUserId: request.user.userId,
      actorScope: request.user.scope,
      actorRoleCodes: request.user.roleCodes,
      requestId,
      reviewNote: body.reviewNote,
    });
  }

  @Patch("offboarding-requests/:requestId/resubmit")
  @RequireRoles("STORE_MANAGER", "SUPER_ADMIN")
  async resubmitOffboardingRequest(
    @Param("requestId") requestId: string,
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
    @Body() body: ResubmitOffboardingRequestDto,
  ) {
    return this.workforceService.resubmitOffboardingRequest({
      actorUserId: request.user.userId,
      actorScope: request.user.scope,
      actorActionScope: request.user.actionScope,
      requestId,
      ...body,
    });
  }
}
