import { Controller, Get, Query, Req } from "@nestjs/common";
import { ApiQuery } from "@nestjs/swagger";
import { RequireRoles } from "../../auth/decorators/roles.decorator";
import { RequireScope } from "../../auth/decorators/scope.decorator";
import { MasterDataQualityService } from "../application/master-data-quality.service";
import { ListMasterDataQualityAuditQueryDto } from "./dto/list-master-data-quality-audit.query";
import { ListMasterDataQualityIssuesQueryDto } from "./dto/list-master-data-quality-issues.query";

type CompanyScopedRequest = {
  user: {
    scope: {
      companyIds: string[];
    };
  };
};

@Controller("integrations/master-data-quality")
export class IntegrationMasterDataQualityController {
  constructor(private readonly masterDataQualityService: MasterDataQualityService) {}

  @Get("issues")
  @ApiQuery({ name: "q", required: false, type: String })
  @ApiQuery({
    name: "entityType",
    required: false,
    enum: ["store", "personnel", "assignment", "import"],
  })
  @ApiQuery({
    name: "severity",
    required: false,
    enum: ["critical", "warning", "info"],
  })
  @ApiQuery({ name: "issueCode", required: false, type: String })
  @ApiQuery({ name: "limit", required: false, type: Number })
  @ApiQuery({ name: "offset", required: false, type: Number })
  @RequireScope("company")
  @RequireRoles("HR_ADMIN", "SUPER_ADMIN", "INTEGRATION_ADMIN")
  async listIssues(
    @Query() query: ListMasterDataQualityIssuesQueryDto,
    @Req() request: CompanyScopedRequest,
  ) {
    return this.masterDataQualityService.listIssues({
      actorCompanyIds: request.user.scope.companyIds,
      q: query.q,
      entityType: query.entityType,
      severity: query.severity,
      issueCode: query.issueCode,
      limit: query.limit,
      offset: query.offset,
    });
  }

  @Get("audit")
  @ApiQuery({
    name: "entityType",
    required: false,
    enum: ["store", "personnel", "import"],
  })
  @ApiQuery({ name: "entityId", required: false, type: String })
  @ApiQuery({ name: "limit", required: false, type: Number })
  @ApiQuery({ name: "offset", required: false, type: Number })
  @RequireScope("company")
  @RequireRoles("HR_ADMIN", "SUPER_ADMIN", "INTEGRATION_ADMIN")
  async listAudit(
    @Query() query: ListMasterDataQualityAuditQueryDto,
    @Req() request: CompanyScopedRequest,
  ) {
    return this.masterDataQualityService.listAudit({
      actorCompanyIds: request.user.scope.companyIds,
      entityType: query.entityType,
      entityId: query.entityId,
      limit: query.limit,
      offset: query.offset,
    });
  }
}
