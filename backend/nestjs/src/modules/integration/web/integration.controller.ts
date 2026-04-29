import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UploadedFiles,
  UseInterceptors,
} from "@nestjs/common";
import { FileFieldsInterceptor } from "@nestjs/platform-express";
import { IntegrationService } from "../application/integration.service";
import { RequireRoles } from "../../auth/decorators/roles.decorator";
import { RequireScope } from "../../auth/decorators/scope.decorator";
import { PowerBiExportUploadService } from "../application/power-bi-export-upload.service";
import { MasterDataBootstrapService } from "../application/master-data-bootstrap.service";
import { ApproveExternalIdMapDto } from "./dto/approve-external-id-map.dto";
import { CreateImportBatchDto } from "./dto/create-import-batch.dto";
import { CreateMasterDataBootstrapBatchDto } from "./dto/create-master-data-bootstrap-batch.dto";
import { CreateIntegrationSourceDto } from "./dto/create-integration-source.dto";
import { GetImportPayloadTemplateQueryDto } from "./dto/get-import-payload-template.query";
import { ListDueIntegrationSourcesQueryDto } from "./dto/list-due-integration-sources.query";
import { ListExternalIdMapCandidatesQueryDto } from "./dto/list-external-id-map-candidates.query";
import { ListImportBatchErrorsQueryDto } from "./dto/list-import-batch-errors.query";
import { ListImportBatchesQueryDto } from "./dto/list-import-batches.query";
import { ListIntegrationSourcesQueryDto } from "./dto/list-integration-sources.query";
import { ListKpiImportStoreScopeQueryDto } from "./dto/list-kpi-import-store-scope.query";
import { UpdateIntegrationSourceScheduleDto } from "./dto/update-integration-source-schedule.dto";
import { UpdateKpiImportStoreScopeDto } from "./dto/update-kpi-import-store-scope.dto";
import { UploadPowerBiExportDto } from "./dto/upload-power-bi-export.dto";

@Controller("integrations")
export class IntegrationController {
  constructor(
    private readonly integrationService: IntegrationService,
    private readonly powerBiExportUploadService: PowerBiExportUploadService,
    private readonly masterDataBootstrapService: MasterDataBootstrapService,
  ) {}

  @Get("sources")
  @RequireScope("company")
  @RequireRoles("INTEGRATION_ADMIN")
  async listIntegrationSources(@Query() query: ListIntegrationSourcesQueryDto) {
    return this.integrationService.listIntegrationSources({
      limit: query.limit,
      offset: query.offset,
      entityType: query.entityType,
      sourceSystem: query.sourceSystem,
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

  @Patch("sources/:sourceId/schedule")
  @RequireScope("company")
  @RequireRoles("INTEGRATION_ADMIN")
  async updateIntegrationSourceSchedule(
    @Param("sourceId") sourceId: string,
    @Body() body: UpdateIntegrationSourceScheduleDto,
    @Req()
    request: {
      user: {
        userId: string;
      };
    },
  ) {
    return this.integrationService.updateIntegrationSourceSchedule(
      sourceId,
      body,
      request.user.userId,
    );
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

  @Get("external-id-map-candidates")
  @RequireScope("company")
  @RequireRoles("INTEGRATION_ADMIN")
  async listExternalIdMapCandidates(
    @Query() query: ListExternalIdMapCandidatesQueryDto,
  ) {
    return this.integrationService.listExternalIdMapCandidates({
      entityType: query.entityType,
      q: query.q,
      limit: query.limit,
    });
  }

  @Post("external-id-maps")
  @RequireScope("company")
  @RequireRoles("INTEGRATION_ADMIN")
  async approveExternalIdMap(
    @Body() body: ApproveExternalIdMapDto,
    @Req()
    request: {
      user: {
        userId: string;
      };
    },
  ) {
    return this.integrationService.approveExternalIdMapping({
      integrationSourceId: body.integrationSourceId,
      entityType: body.entityType,
      externalId: body.externalId,
      internalId: body.internalId,
      actorUserId: request.user.userId,
    });
  }

  @Get("kpi-import-store-scope")
  @RequireScope("company")
  @RequireRoles("INTEGRATION_ADMIN")
  async listKpiImportStoreScope(@Query() query: ListKpiImportStoreScopeQueryDto) {
    return this.integrationService.listStoreMaster({
      q: query.q,
      enabled: query.enabled,
      status: query.status,
      limit: query.limit,
      offset: query.offset,
    });
  }

  @Get("store-master")
  @RequireScope("company")
  @RequireRoles("INTEGRATION_ADMIN")
  async listStoreMaster(@Query() query: ListKpiImportStoreScopeQueryDto) {
    return this.integrationService.listStoreMaster({
      q: query.q,
      enabled: query.enabled,
      status: query.status,
      limit: query.limit,
      offset: query.offset,
    });
  }

  @Get("store-master-lookups")
  @RequireScope("company")
  @RequireRoles("INTEGRATION_ADMIN")
  async getStoreMasterLookups() {
    return this.integrationService.getStoreMasterLookups();
  }

  @Patch("kpi-import-store-scope/:storeId")
  @RequireScope("company")
  @RequireRoles("INTEGRATION_ADMIN")
  async updateKpiImportStoreScope(
    @Param("storeId") storeId: string,
    @Body() body: UpdateKpiImportStoreScopeDto,
    @Req()
    request: {
      user: {
        userId: string;
      };
    },
  ) {
    return this.integrationService.updateStoreMaster({
      storeId,
      storeType: body.storeType,
      regionId: body.regionId,
      status: body.status,
      kpiImportEnabled: body.kpiImportEnabled,
      actorUserId: request.user.userId,
    });
  }

  @Patch("store-master/:storeId")
  @RequireScope("company")
  @RequireRoles("INTEGRATION_ADMIN")
  async updateStoreMaster(
    @Param("storeId") storeId: string,
    @Body() body: UpdateKpiImportStoreScopeDto,
    @Req()
    request: {
      user: {
        userId: string;
      };
    },
  ) {
    return this.integrationService.updateStoreMaster({
      storeId,
      storeType: body.storeType,
      regionId: body.regionId,
      status: body.status,
      kpiImportEnabled: body.kpiImportEnabled,
      actorUserId: request.user.userId,
    });
  }

  @Post("master-data-bootstrap/batches")
  @RequireScope("company")
  @RequireRoles("HR_ADMIN", "SUPER_ADMIN", "INTEGRATION_ADMIN")
  async createMasterDataBootstrapBatch(
    @Req()
    request: {
      user: {
        userId: string;
        scope: {
          companyIds: string[];
        };
      };
    },
    @Body() body: CreateMasterDataBootstrapBatchDto,
  ) {
    return this.masterDataBootstrapService.createBootstrapBatch({
      actorUserId: request.user.userId,
      actorScope: {
        companyIds: request.user.scope.companyIds,
      },
      bootstrapEntity: body.bootstrapEntity,
      sourceLabel: body.sourceLabel,
      fileReference: body.fileReference,
      rows: body.rows,
    });
  }

  @Post("master-data-bootstrap/batches/:batchId/validate")
  @RequireScope("company")
  @RequireRoles("HR_ADMIN", "SUPER_ADMIN", "INTEGRATION_ADMIN")
  async validateMasterDataBootstrapBatch(
    @Param("batchId") batchId: string,
    @Req()
    request: {
      user: {
        scope: {
          companyIds: string[];
        };
      };
    },
  ) {
    return this.masterDataBootstrapService.validateBootstrapBatch({
      actorScope: {
        companyIds: request.user.scope.companyIds,
      },
      batchId,
    });
  }

  @Get("master-data-bootstrap/batches/:batchId")
  @RequireScope("company")
  @RequireRoles("HR_ADMIN", "SUPER_ADMIN", "INTEGRATION_ADMIN")
  async getMasterDataBootstrapBatch(
    @Param("batchId") batchId: string,
    @Req()
    request: {
      user: {
        scope: {
          companyIds: string[];
        };
      };
    },
  ) {
    return this.masterDataBootstrapService.getBootstrapBatchDetail({
      actorScope: {
        companyIds: request.user.scope.companyIds,
      },
      batchId,
    });
  }

  @Get("sources/due-schedule")
  @RequireScope("company")
  @RequireRoles("INTEGRATION_ADMIN")
  async listDueIntegrationSources(@Query() query: ListDueIntegrationSourcesQueryDto) {
    return this.integrationService.listDueIntegrationSources(query.referenceAt);
  }

  @Get("import-payload-templates")
  @RequireScope("company")
  @RequireRoles("INTEGRATION_ADMIN")
  async getImportPayloadTemplate(@Query() query: GetImportPayloadTemplateQueryDto) {
    return this.integrationService.getImportPayloadTemplate({
      entityType: query.entityType,
      sourceSystem: query.sourceSystem,
    });
  }

  @Post("power-bi-export-upload")
  @RequireScope("company")
  @RequireRoles("INTEGRATION_ADMIN")
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: "personnelFile", maxCount: 1 },
      { name: "storeFile", maxCount: 1 },
    ]),
  )
  async uploadPowerBiExport(
    @Body() body: UploadPowerBiExportDto,
    @UploadedFiles()
    files: {
      personnelFile?: Array<{ originalname: string; buffer: Buffer }>;
      storeFile?: Array<{ originalname: string; buffer: Buffer }>;
    },
    @Req()
    request: {
      user: {
        userId: string;
      };
    },
  ) {
    return this.powerBiExportUploadService.upload({
      sourceCode: body.sourceCode,
      periodMonth: body.periodMonth,
      periodType: body.periodType,
      periodStart: body.periodStart,
      periodEnd: body.periodEnd,
      actorUserId: request.user.userId,
      personnelFile: files?.personnelFile?.[0] ?? null,
      storeFile: files?.storeFile?.[0] ?? null,
    });
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

  @Get("import-batches/:batchId/reconciliation")
  @RequireScope("company")
  @RequireRoles("INTEGRATION_ADMIN")
  async getImportBatchReconciliation(@Param("batchId") batchId: string) {
    return this.integrationService.getImportBatchReconciliation(batchId);
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
