import { Body, Controller, Get, Param, Patch, Post, Query, Req } from "@nestjs/common";
import { IntegrationService } from "../application/integration.service";
import { RequireRoles } from "../../auth/decorators/roles.decorator";
import { RequireScope } from "../../auth/decorators/scope.decorator";
import { CreateImportBatchDto } from "./dto/create-import-batch.dto";
import { CreateIntegrationSourceDto } from "./dto/create-integration-source.dto";
import { ListImportBatchErrorsQueryDto } from "./dto/list-import-batch-errors.query";
import { ListImportBatchesQueryDto } from "./dto/list-import-batches.query";
import { ListIntegrationSourcesQueryDto } from "./dto/list-integration-sources.query";

@Controller("integrations")
export class IntegrationController {
  constructor(private readonly integrationService: IntegrationService) {}

  @Get("sources")
  @RequireScope("company")
  @RequireRoles("INTEGRATION_ADMIN")
  async listIntegrationSources(@Query() query: ListIntegrationSourcesQueryDto) {
    return this.integrationService.listIntegrationSources({
      limit: query.limit,
      offset: query.offset,
      entityType: query.entityType,
      isActive: query.isActive,
    });
  }

  @Post("sources")
  @RequireScope("company")
  @RequireRoles("INTEGRATION_ADMIN")
  async createIntegrationSource(
    @Body() body: CreateIntegrationSourceDto,
    @Req()
    request: {
      user: {
        userId: string;
      };
    },
  ) {
    return this.integrationService.createIntegrationSource({
      ...body,
      actorUserId: request.user.userId,
    });
  }

  @Patch("sources/:sourceId/deactivate")
  @RequireScope("company")
  @RequireRoles("INTEGRATION_ADMIN")
  async deactivateIntegrationSource(
    @Param("sourceId") sourceId: string,
    @Req()
    request: {
      user: {
        userId: string;
      };
    },
  ) {
    return this.integrationService.deactivateIntegrationSource(sourceId, request.user.userId);
  }

  @Patch("sources/:sourceId/reactivate")
  @RequireScope("company")
  @RequireRoles("INTEGRATION_ADMIN")
  async reactivateIntegrationSource(
    @Param("sourceId") sourceId: string,
    @Req()
    request: {
      user: {
        userId: string;
      };
    },
  ) {
    return this.integrationService.reactivateIntegrationSource(sourceId, request.user.userId);
  }

  @Get("lookups")
  @RequireScope("company")
  @RequireRoles("INTEGRATION_ADMIN")
  async getIntegrationLookups() {
    return this.integrationService.getIntegrationLookups();
  }

  @Get("sources/:sourceId/audit")
  @RequireScope("company")
  @RequireRoles("INTEGRATION_ADMIN")
  async getIntegrationSourceAudit(@Param("sourceId") sourceId: string) {
    return this.integrationService.getIntegrationSourceAudit(sourceId);
  }

  @Post("import-batches")
  @RequireScope("company")
  @RequireRoles("INTEGRATION_ADMIN")
  async createImportBatch(
    @Req()
    request: {
      user: {
        userId: string;
      };
    },
    @Body() body: CreateImportBatchDto,
  ) {
    return this.integrationService.createImportBatch({
      ...body,
      actorUserId: request.user.userId,
    });
  }

  @Get("import-batches")
  @RequireScope("company")
  @RequireRoles("INTEGRATION_ADMIN")
  async listImportBatches(@Query() query: ListImportBatchesQueryDto) {
    return this.integrationService.listImportBatches({
      limit: query.limit,
      offset: query.offset,
      status: query.status,
      entityType: query.entityType,
      sourceCode: query.sourceCode,
      startedFrom: query.startedFrom,
      startedTo: query.startedTo,
    });
  }

  @Get("import-batches/summary")
  @RequireScope("company")
  @RequireRoles("INTEGRATION_ADMIN")
  async getImportBatchSummary(@Query() query: ListImportBatchesQueryDto) {
    return this.integrationService.getImportBatchSummary({
      status: query.status,
      entityType: query.entityType,
      sourceCode: query.sourceCode,
      startedFrom: query.startedFrom,
      startedTo: query.startedTo,
    });
  }

  @Get("import-batches/overview")
  @RequireScope("company")
  @RequireRoles("INTEGRATION_ADMIN")
  async getImportBatchOverview(@Query() query: ListImportBatchesQueryDto) {
    return this.integrationService.getImportBatchOverview({
      status: query.status,
      entityType: query.entityType,
      sourceCode: query.sourceCode,
      startedFrom: query.startedFrom,
      startedTo: query.startedTo,
    });
  }

  @Get("import-batches/needs-action")
  @RequireScope("company")
  @RequireRoles("INTEGRATION_ADMIN")
  async getImportBatchNeedsAction(@Query() query: ListImportBatchesQueryDto) {
    return this.integrationService.getImportBatchNeedsAction({
      limit: query.limit,
      offset: query.offset,
      status: query.status,
      entityType: query.entityType,
      sourceCode: query.sourceCode,
      startedFrom: query.startedFrom,
      startedTo: query.startedTo,
    });
  }

  @Get("import-batches/:batchId/errors")
  @RequireScope("company")
  @RequireRoles("INTEGRATION_ADMIN")
  async getImportBatchErrors(
    @Param("batchId") batchId: string,
    @Query() query: ListImportBatchErrorsQueryDto,
  ) {
    return this.integrationService.getImportBatchErrors({
      batchId,
      limit: query.limit,
      offset: query.offset,
    });
  }

  @Get("import-batch-audit/:batchId")
  @RequireScope("company")
  @RequireRoles("INTEGRATION_ADMIN")
  async getImportBatchAudit(@Param("batchId") batchId: string) {
    return this.integrationService.getImportBatchAudit(batchId);
  }

  @Get("import-batches/:batchId/audit")
  @RequireScope("company")
  @RequireRoles("INTEGRATION_ADMIN")
  async getImportBatchAuditNested(@Param("batchId") batchId: string) {
    return this.integrationService.getImportBatchAudit(batchId);
  }

  @Post("import-batches/:batchId/retry")
  @RequireScope("company")
  @RequireRoles("INTEGRATION_ADMIN")
  async retryImportBatch(
    @Param("batchId") batchId: string,
    @Req()
    request: {
      user: {
        userId: string;
      };
    },
  ) {
    return this.integrationService.retryImportBatch(batchId, request.user.userId);
  }

  @Get("import-batches/:batchId")
  @RequireScope("company")
  @RequireRoles("INTEGRATION_ADMIN")
  async getImportBatch(@Param("batchId") batchId: string) {
    return this.integrationService.getImportBatch(batchId);
  }
}
