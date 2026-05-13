import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { JobDispatcher } from "../../../shared/jobs/job-dispatcher.interface";
import { ImportBatchJobPayload } from "../../../shared/jobs/job-payloads";
import { JOB_DISPATCHER } from "../../../shared/jobs/jobs.constants";
import { MaterializationService } from "./materialization.service";
import { IntegrationRepository } from "../infrastructure/integration.repository";
import { IntegrationSourceRepository } from "../infrastructure/integration-source.repository";
import { KpiImportNormalizationService } from "./kpi-import-normalization.service";
import { IntegrationSchedulerService } from "./integration-scheduler.service";
import { ExternalIdMappingService } from "./external-id-mapping.service";
import {
  buildCommandResponse,
  buildListResponse,
} from "../../../shared/http/response-builders";
import { mapAuditEvent } from "../../../shared/audit/audit-event.mapper";
import { logStructuredMessage } from "../../../shared/structured-log";
import {
  type ImportDataQualityIssue,
  type ImportDataQualityIssueCode,
  classifyImportDataQualityIssue,
  getImportDataQualityIssue,
  IMPORT_DATA_QUALITY_ISSUES,
} from "./import-data-quality";
import {
  mapImportBatchDetailBatch,
  mapImportBatchListItem,
  mapImportBatchNeedsActionItem,
} from "./import-batch-read-model.mapper";
import {
  getBlockedByEntityTypes,
  getDetailHealthState,
  getImportStuckBeforeIso,
  getListHealthState,
  getRecommendedImportOrder,
} from "./import-batch-health";

type SupportedEntityType =
  | "employee"
  | "store"
  | "kpi"
  | "assignment"
  | "position"
  | "company"
  | "region";

type SupportedSourceSystem = "nebim_v3" | "power_bi" | "manual" | "other";

@Injectable()
export class IntegrationService {
  private readonly logger = new Logger(IntegrationService.name);

  constructor(
    private readonly integrationRepository: IntegrationRepository,
    private readonly integrationSourceRepository: IntegrationSourceRepository,
    private readonly materializationService: MaterializationService,
    private readonly kpiImportNormalizationService: KpiImportNormalizationService,
    private readonly integrationSchedulerService: IntegrationSchedulerService,
    private readonly externalIdMappingService: ExternalIdMappingService,
    @Inject(JOB_DISPATCHER)
    private readonly jobDispatcher: JobDispatcher,
  ) {}

  async createImportBatch(input: {
    actorCompanyIds: string[];
    sourceCode: string;
    entityType:
      | "employee"
      | "store"
      | "kpi"
      | "assignment"
      | "position"
      | "company"
      | "region";
    fileReference: string;
    actorUserId: string;
    idempotencyKey?: string;
    sourceBatchId?: string;
    sourcePayloadHash?: string;
    sourceCapturedAt?: string;
    sourceWindowStartedAt?: string;
    sourceWindowEndedAt?: string;
    rows?: Record<string, unknown>[];
  }) {
    const actorCompanyIds = this.normalizeCompanyScope(input.actorCompanyIds);
    this.assertCompanyScope(actorCompanyIds);

    let rows = input.rows;
    if (input.entityType === "kpi" && input.rows?.length) {
      const source = await this.integrationSourceRepository.getIntegrationSourceByCodeAndEntity(
        input.sourceCode,
        input.entityType,
      );

      if (source) {
        rows = this.kpiImportNormalizationService.normalize({
          sourceSystem: source.source_system as "nebim_v3" | "power_bi" | "manual" | "other",
          sourceCapturedAt: input.sourceCapturedAt,
          sourceWindowStartedAt: input.sourceWindowStartedAt,
          sourceWindowEndedAt: input.sourceWindowEndedAt,
          rows: input.rows,
        });
      }
    }

    const batch = await this.integrationRepository.createImportBatch({
      ...input,
      actorCompanyIds,
      rows,
    });

    const job = batch.reused
      ? { status: "queued" as const, jobType: "import-batch" as const, backend: "reused" }
      : await this.jobDispatcher.dispatch(
          "import-batch",
          { batchId: batch.batchId } satisfies ImportBatchJobPayload,
          async ({ batchId }: ImportBatchJobPayload) => {
            await this.materializationService.materializeBatch(batchId);
          },
        );

    logStructuredMessage(this.logger, "import_batch.command.accepted", {
      actorUserId: input.actorUserId,
      batchId: batch.batchId,
      jobId: job.jobId ?? null,
      sourceCode: input.sourceCode,
      entityType: input.entityType,
      sourceBatchId: input.sourceBatchId ?? null,
      sourceCapturedAt: input.sourceCapturedAt ?? null,
      queueBackend: job.backend,
      queueName: job.queueName ?? null,
      reused: batch.reused,
    });

    return buildCommandResponse({
      status: job.status,
      message: batch.reused
        ? "Existing import batch reused via idempotency key"
        : "Import batch accepted for async processing",
      data: {
        batch,
      },
      job: {
        jobType: job.jobType,
        backend: job.backend,
        jobId: job.jobId ?? null,
        queueName: job.queueName ?? null,
      },
    });
  }

  async listIntegrationSources(input: {
    limit?: number;
    offset?: number;
    entityType?: string;
    sourceSystem?: string;
    isActive?: boolean;
  }) {
    const result = await this.integrationSourceRepository.listIntegrationSources(input);

    return buildListResponse(
      result.rows.map((item) => this.mapIntegrationSource(item)),
      { total: result.total, limit: input.limit, offset: input.offset },
    );
  }

  async createIntegrationSource(input: {
    sourceCode: string;
    sourceName: string;
    entityType:
      | "employee"
      | "store"
      | "kpi"
      | "assignment"
      | "position"
      | "company"
      | "region";
    sourceSystem: "nebim_v3" | "power_bi" | "manual" | "other";
    stateModel: "latest_state" | "closed_period";
    pollEnabled?: boolean;
    pollIntervalMinutes?: number;
    pollWindowStartLocal?: string;
    pollWindowEndLocal?: string;
    pollTimezone?: string;
    actorUserId: string;
  }) {
    const existing = await this.integrationSourceRepository.getIntegrationSourceByCodeAndEntity(
      input.sourceCode,
      input.entityType,
    );
    if (existing) {
      throw new ConflictException(
        `Integration source already exists for ${input.sourceCode}/${input.entityType}`,
      );
    }

    const source = await this.integrationSourceRepository.createIntegrationSource(input);

    return buildCommandResponse({
      status: "created",
      message: "Integration source created",
      data: {
        source: this.mapIntegrationSource(source),
      },
    });
  }

  async deactivateIntegrationSource(sourceId: string, actorUserId: string) {
    const activeBatchCount = await this.integrationSourceRepository.countActiveImportBatchesForSource(
      sourceId,
    );
    if (activeBatchCount > 0) {
      throw new ConflictException(
        `Integration source ${sourceId} cannot be deactivated while active import batches exist`,
      );
    }

    const source = await this.integrationSourceRepository.updateIntegrationSourceActiveState({
      sourceId,
      isActive: false,
      actorUserId,
    });

    if (!source) {
      throw new NotFoundException(`Integration source not found: ${sourceId}`);
    }

    return buildCommandResponse({
      status: "updated",
      message: "Integration source deactivated",
      data: {
        source: this.mapIntegrationSource(source),
      },
    });
  }

  async reactivateIntegrationSource(sourceId: string, actorUserId: string) {
    const source = await this.integrationSourceRepository.updateIntegrationSourceActiveState({
      sourceId,
      isActive: true,
      actorUserId,
    });

    if (!source) {
      throw new NotFoundException(`Integration source not found: ${sourceId}`);
    }

    return buildCommandResponse({
      status: "updated",
      message: "Integration source reactivated",
      data: {
        source: this.mapIntegrationSource(source),
      },
    });
  }

  async updateIntegrationSourceSchedule(
    sourceId: string,
    input: {
      pollEnabled?: boolean;
      pollIntervalMinutes?: number;
      pollWindowStartLocal?: string;
      pollWindowEndLocal?: string;
      pollTimezone?: string;
    },
    actorUserId: string,
  ) {
    const source = await this.integrationSourceRepository.updateIntegrationSourceSchedule({
      sourceId,
      ...input,
      actorUserId,
    });

    if (!source) {
      throw new NotFoundException(`Integration source not found: ${sourceId}`);
    }

    return buildCommandResponse({
      status: "updated",
      message: "Integration source schedule updated",
      data: {
        source: this.mapIntegrationSource(source),
      },
    });
  }

  async listDueIntegrationSources(referenceAt?: string) {
    const rows = await this.integrationSchedulerService.listDueSources(referenceAt);
    return buildListResponse(rows, { total: rows.length });
  }

  async getImportPayloadTemplate(input?: {
    entityType?: SupportedEntityType;
    sourceSystem?: SupportedSourceSystem;
  }) {
    const entityType = input?.entityType ?? "kpi";
    const sourceSystem = input?.sourceSystem ?? "nebim_v3";

    if (entityType !== "kpi") {
      return {
        entityType,
        sourceSystem,
        canonicalContract: this.getCanonicalKpiContract(),
        note: "Sample payload templates are currently productized for KPI imports first.",
        requestBody: {
          sourceCode: `${sourceSystem}-${entityType}`,
          entityType,
          fileReference: `${sourceSystem}-${entityType}-sample.json`,
          sourceBatchId: `${sourceSystem}-${entityType}-2026-04-22T10:30`,
          sourceCapturedAt: "2026-04-22T10:30:00.000Z",
          sourceWindowStartedAt: "2026-04-22T10:00:00.000Z",
          sourceWindowEndedAt: "2026-04-22T10:30:00.000Z",
          rows: [],
        },
      };
    }

    const requestBody =
      sourceSystem === "power_bi"
        ? {
            sourceCode: "power-bi-kpi",
            entityType: "kpi",
            fileReference: "power-bi-kpi-sample.json",
            sourceBatchId: "power-bi-kpi-2026-04-22T10:30",
            sourceCapturedAt: "2026-04-22T10:30:00.000Z",
            sourceWindowStartedAt: "2026-04-22T10:00:00.000Z",
            sourceWindowEndedAt: "2026-04-22T10:30:00.000Z",
            rows: [
              {
                sellerCode: "S-100",
                storeCode: "M-10",
                atv: 5200,
                upt: 3.2,
                netSales: 25000,
              },
              {
                storeCode: "M-10",
                conversionRate: 0.15,
              },
            ],
          }
        : {
            sourceCode: "nebim-kpi",
            entityType: "kpi",
            fileReference: "nebim-kpi-sample.json",
            sourceBatchId: "nebim-kpi-2026-04-22T10:30",
            sourceCapturedAt: "2026-04-22T10:30:00.000Z",
            sourceWindowStartedAt: "2026-04-22T10:00:00.000Z",
            sourceWindowEndedAt: "2026-04-22T10:30:00.000Z",
            rows: [
              {
                saticiKodu: "S-100",
                magazaKodu: "M-10",
                atv: 5200,
                upt: 3.2,
                netTutar: 25000,
              },
              {
                magazaKodu: "M-10",
                cr: 0.15,
              },
            ],
          };

    return {
      entityType,
      sourceSystem,
      canonicalContract: this.getCanonicalKpiContract(),
      normalizedBehavior: [
        "ATV, UPT, NET_SALES employee scope olarak normalize edilir.",
        "CR store scope olarak normalize edilir.",
        "sourceBatchId aynı gelirse batch reuse edilir.",
        "Yeni veri aynı KPI/scope/donem icin gelirse live state overwrite edilir.",
      ],
      requestBody,
    };
  }

  private getCanonicalKpiContract() {
    return {
      envelopeFields: [
        "sourceCode",
        "entityType",
        "fileReference",
        "idempotencyKey",
        "sourceBatchId",
        "sourcePayloadHash",
        "sourceCapturedAt",
        "sourceWindowStartedAt",
        "sourceWindowEndedAt",
      ],
      canonicalKpiRowFields: [
        "kpiCode",
        "sourceMetricId",
        "scopeType",
        "storeExternalRef",
        "employeeExternalRef",
        "actualValue",
        "targetValue",
        "periodType",
        "periodStart",
        "periodEnd",
        "sourceCapturedAt",
        "rowHash",
        "rawRowReference",
        "sourceRow",
      ],
      importedMetricCodes: ["NET_SALES", "TICKET_COUNT", "ITEM_COUNT", "FF", "UPT", "ATV", "CR"],
      derivedMetricCodes: ["TARGET_ACHIEVEMENT", "WEIGHTED_PERSONNEL_SCORE", "WEIGHTED_STORE_SCORE"],
      checklistMetricCodes: ["BM_CHECKLIST", "VM_CHECKLIST"],
      dataQualityIssueCodes: IMPORT_DATA_QUALITY_ISSUES.map((issue) => issue.code),
      rules: [
        "employeeExternalRef can be empty only for store-scoped metrics",
        "source adapters map external fields into canonical rows before scoring",
        "rowHash is generated from the stable source row payload when the adapter does not provide one",
        "rawRowReference is a readable sourceSystem/metric/period/store/personnel trace key",
      ],
    };
  }

  async getIntegrationLookups() {
    const activeSources = await this.integrationSourceRepository.listActiveIntegrationSources();
    const entityTypes = this.getSupportedEntityTypes();
    const activeSourceOptions = activeSources.map((item) => ({
      sourceId: item.integration_source_id,
      sourceCode: item.source_code,
      sourceName: item.source_name,
      entityType: item.entity_type,
      sourceSystem: item.source_system,
      stateModel: item.state_model,
    }));
    const sourcesByEntityType = activeSources.reduce<
      Record<string, Array<{ sourceId: string; sourceCode: string; sourceName: string }>>
    >((acc, item) => {
      if (!acc[item.entity_type]) {
        acc[item.entity_type] = [];
      }

      acc[item.entity_type].push({
        sourceId: item.integration_source_id,
        sourceCode: item.source_code,
        sourceName: item.source_name,
      });

      return acc;
    }, {});

    return {
      entityTypes,
      sourceStats: {
        totalActiveSources: activeSources.length,
      },
      activeSources: activeSourceOptions,
      sourcesByEntityType,
      optionGroups: {
        entityTypes: entityTypes.map((entityType) => ({ value: entityType, label: entityType })),
        sources: activeSourceOptions.map((item) => ({
          value: item.sourceId,
          label: `${item.sourceCode} - ${item.sourceName}`,
          entityType: item.entityType,
          sourceCode: item.sourceCode,
          sourceSystem: item.sourceSystem,
          stateModel: item.stateModel,
        })),
        sourceSystems: this.getSupportedSourceSystems().map((sourceSystem) => ({
          value: sourceSystem,
          label: sourceSystem,
        })),
        stateModels: this.getSupportedStateModels().map((stateModel) => ({
          value: stateModel,
          label: stateModel,
        })),
      },
      meta: {
        totalEntityTypes: entityTypes.length,
        totalActiveSources: activeSourceOptions.length,
      },
    };
  }

  async listExternalIdMapCandidates(input: {
    actorCompanyIds: string[];
    entityType: "employee" | "store";
    q?: string;
    limit?: number;
  }) {
    this.assertCompanyScope(input.actorCompanyIds);
    const limit = input.limit ?? 10;
    const result = await this.integrationRepository.listExternalIdMapCandidates({
      actorCompanyIds: input.actorCompanyIds,
      entityType: input.entityType,
      q: input.q,
      limit,
    });
    const internalTableName = this.getExternalIdInternalTableName(input.entityType);

    return buildListResponse(
      result.map((item) => ({
        entityType: input.entityType,
        internalId: item.internal_id,
        label: item.label,
        secondaryLabel: item.secondary_label,
        internalTableName,
      })),
      { total: result.length, limit, offset: 0 },
    );
  }

  async listStoreMaster(input: {
    actorCompanyIds: string[];
    q?: string;
    enabled?: boolean;
    status?: "active" | "inactive" | "closed";
    limit?: number;
    offset?: number;
  }) {
    const result = await this.integrationRepository.listKpiImportStoreScope(input);

    return buildListResponse(
      result.rows.map((item) => this.mapStoreMaster(item)),
      { total: result.total, limit: input.limit, offset: input.offset },
    );
  }

  async getStoreMasterLookups(input: { actorCompanyIds: string[] }) {
    const regions = await this.integrationRepository.listStoreMasterRegions({
      actorCompanyIds: input.actorCompanyIds,
    });

    return {
      storeTypes: [
        { value: "company", label: "Company" },
        { value: "franchise", label: "Franchise" },
        { value: "operator", label: "Operator" },
      ],
      statuses: [
        { value: "active", label: "Active" },
        { value: "inactive", label: "Inactive" },
        { value: "closed", label: "Closed" },
      ],
      regions: regions.map((item) => ({
        regionId: item.region_id,
        regionCode: item.region_code,
        regionName: item.region_name,
      })),
    };
  }

  async updateStoreMaster(input: {
    actorCompanyIds: string[];
    storeId: string;
    storeType: "company" | "franchise" | "operator";
    regionId: string;
    status: "active" | "inactive" | "closed";
    kpiImportEnabled: boolean;
    actorUserId: string;
  }) {
    const storeScope = await this.integrationRepository.updateKpiImportStoreScope(input);

    if (!storeScope) {
      throw new NotFoundException(`Store or region not found: ${input.storeId}`);
    }

    logStructuredMessage(this.logger, "store_master_data.updated", {
      actorUserId: input.actorUserId,
      storeId: input.storeId,
      storeType: input.storeType,
      regionId: input.regionId,
      status: input.status,
      kpiImportEnabled: input.kpiImportEnabled,
    });

    return buildCommandResponse({
      status: "updated",
      message: "Store master data updated",
      data: {
        storeMaster: this.mapStoreMaster(storeScope),
      },
    });
  }

  async listPersonnelMaster(input: {
    actorCompanyIds: string[];
    q?: string;
    status?: "active" | "inactive" | "terminated";
    storeId?: string;
    limit?: number;
    offset?: number;
  }) {
    const actorCompanyIds = this.normalizeCompanyScope(input.actorCompanyIds);
    this.assertCompanyScope(actorCompanyIds);
    const result = await this.integrationRepository.listPersonnelMaster({
      ...input,
      actorCompanyIds,
    });

    return buildListResponse(
      result.rows.map((item) => this.mapPersonnelMaster(item)),
      { total: result.total, limit: input.limit, offset: input.offset },
    );
  }

  async getPersonnelMasterLookups(input: { actorCompanyIds: string[] }) {
    const actorCompanyIds = this.normalizeCompanyScope(input.actorCompanyIds);
    this.assertCompanyScope(actorCompanyIds);
    const lookups = await this.integrationRepository.listPersonnelMasterLookups({
      actorCompanyIds,
    });

    return {
      stores: lookups.stores.map((item) => ({
        storeId: item.store_id,
        storeCode: item.store_code,
        storeName: item.store_name,
        regionId: item.region_id,
        regionName: item.region_name,
      })),
      positions: lookups.positions.map((item) => ({
        positionId: item.position_id,
        positionCode: item.position_code,
        positionName: item.position_name,
        isManagerial: item.is_managerial,
      })),
      employmentStatuses: [
        { value: "active", label: "Active" },
        { value: "inactive", label: "Inactive" },
        { value: "terminated", label: "Terminated" },
      ],
      employmentTypes: [
        { value: "full_time", label: "Full time" },
        { value: "part_time", label: "Part time" },
        { value: "temporary", label: "Temporary" },
      ],
    };
  }

  async updatePersonnelMaster(input: {
    actorCompanyIds: string[];
    actorUserId: string;
    employeeId: string;
    firstName: string;
    lastName: string;
    externalEmployeeRef?: string;
    employmentStatus: "active" | "inactive" | "terminated";
    employmentType: "full_time" | "part_time" | "temporary";
    hireDate: string;
    storeId: string;
    positionId: string;
    assignmentStartDate?: string;
  }) {
    const actorCompanyIds = this.normalizeCompanyScope(input.actorCompanyIds);
    this.assertCompanyScope(actorCompanyIds);
    const personnel = await this.integrationRepository.updatePersonnelMaster({
      ...input,
      actorCompanyIds,
      firstName: input.firstName.trim(),
      lastName: input.lastName.trim(),
      externalEmployeeRef: input.externalEmployeeRef?.trim(),
      hireDate: input.hireDate.slice(0, 10),
      assignmentStartDate: input.assignmentStartDate?.slice(0, 10),
    });

    if (!personnel) {
      throw new NotFoundException(`Personnel master record not found: ${input.employeeId}`);
    }

    logStructuredMessage(this.logger, "personnel_master_data.updated", {
      actorUserId: input.actorUserId,
      employeeId: input.employeeId,
      storeId: input.storeId,
      positionId: input.positionId,
      employmentStatus: input.employmentStatus,
    });

    return buildCommandResponse({
      status: "updated",
      message: "Personnel master data updated",
      data: {
        personnelMaster: this.mapPersonnelMaster(personnel),
      },
    });
  }

  async getIntegrationSourceAudit(sourceId: string) {
    const source = await this.integrationSourceRepository.getIntegrationSourceById(sourceId);

    if (!source) {
      throw new NotFoundException(`Integration source not found: ${sourceId}`);
    }

    const events = await this.integrationSourceRepository.getIntegrationSourceAudit(sourceId);

    return buildListResponse(
      events.map((event) => mapAuditEvent(event)),
      { total: events.length },
    );
  }

  async listImportBatches(input: {
    actorCompanyIds: string[];
    limit?: number;
    offset?: number;
    status?: string;
    entityType?: string;
    sourceCode?: string;
    startedFrom?: string;
    startedTo?: string;
  }) {
    const actorCompanyIds = this.normalizeCompanyScope(input.actorCompanyIds);
    this.assertCompanyScope(actorCompanyIds);

    const result = await this.integrationRepository.listImportBatches({
      actorCompanyIds,
      limit: input.limit,
      offset: input.offset,
      status: input.status,
      entityType: input.entityType,
      sourceCode: input.sourceCode,
      startedFrom: input.startedFrom,
      startedTo: input.startedTo,
    });

    return buildListResponse(
      result.rows.map((batch) =>
        mapImportBatchListItem(
          batch,
          getListHealthState({
            status: batch.status,
            errorCount: Number(batch.error_count),
            startedAt: batch.started_at,
          }),
        ),
      ),
      { total: result.total, limit: input.limit, offset: input.offset },
    );
  }

  async getImportBatchSummary(input: {
    actorCompanyIds: string[];
    status?: string;
    entityType?: string;
    sourceCode?: string;
    startedFrom?: string;
    startedTo?: string;
  }) {
    const actorCompanyIds = this.normalizeCompanyScope(input.actorCompanyIds);
    this.assertCompanyScope(actorCompanyIds);
    const scopedInput = {
      ...input,
      actorCompanyIds,
    };

    const summary = await this.integrationRepository.getImportBatchSummary(scopedInput);
    const [completedBatchId, failedBatchId, inProgressBatchId] = await Promise.all([
      this.integrationRepository.getLatestImportBatchIdByStatus({
        ...scopedInput,
        status: "completed",
      }),
      this.integrationRepository.getLatestImportBatchIdByStatus({
        ...scopedInput,
        status: "failed",
      }),
      this.integrationRepository.getLatestImportBatchIdByStatus({
        ...scopedInput,
        status: "processing",
      }),
    ]);

    return {
      totals: {
        all: summary.all,
        completed: summary.completed,
        failed: summary.failed,
        completedWithErrors: summary.completedWithErrors,
        pending: summary.pending,
        queued: summary.queued,
        processing: summary.processing,
      },
      healthTotals: {
        healthy: summary.completed,
        inProgress: summary.pending + summary.queued + summary.processing,
        blocked: 0,
        retryReady: summary.failed,
        needsAction: summary.completedWithErrors,
      },
      latest: {
        completedBatchId,
        failedBatchId,
        inProgressBatchId,
      },
    };
  }

  async getImportBatchOverview(input: {
    actorCompanyIds: string[];
    status?: string;
    entityType?: string;
    sourceCode?: string;
    startedFrom?: string;
    startedTo?: string;
  }) {
    const actorCompanyIds = this.normalizeCompanyScope(input.actorCompanyIds);
    this.assertCompanyScope(actorCompanyIds);
    const scopedInput = {
      ...input,
      actorCompanyIds,
    };
    const stuckBefore = getImportStuckBeforeIso();
    const [summary, actionCounts, completedBatchId, failedBatchId, inProgressBatchId, stuckBatchId] =
      await Promise.all([
        this.integrationRepository.getImportBatchSummary(scopedInput),
        this.integrationRepository.getImportBatchActionCounts({
          ...scopedInput,
          stuckBefore,
        }),
        this.integrationRepository.getLatestImportBatchIdByStatus({
          ...scopedInput,
          status: "completed",
        }),
        this.integrationRepository.getLatestImportBatchIdByStatus({
          ...scopedInput,
          status: "failed",
        }),
        this.integrationRepository.getLatestImportBatchIdByStatus({
          ...scopedInput,
          status: "processing",
        }),
        this.integrationRepository.getLatestStuckImportBatchId({
          ...scopedInput,
          stuckBefore,
        }),
      ]);

    return {
      totals: {
        all: summary.all,
        completed: summary.completed,
        failed: summary.failed,
        completedWithErrors: summary.completedWithErrors,
        pending: summary.pending,
        queued: summary.queued,
        processing: summary.processing,
      },
      healthTotals: {
        healthy: summary.completed,
        inProgress: Math.max(summary.pending + summary.queued + summary.processing - actionCounts.stuck, 0),
        blocked: actionCounts.blocked,
        retryReady: actionCounts.retryReady,
        needsAction: actionCounts.needsAction,
        stuck: actionCounts.stuck,
      },
      actionTotals: actionCounts,
      latest: {
        completedBatchId,
        failedBatchId,
        inProgressBatchId,
        stuckBatchId,
      },
    };
  }

  async getImportBatchNeedsAction(input: {
    actorCompanyIds: string[];
    limit?: number;
    offset?: number;
    status?: string;
    entityType?: string;
    sourceCode?: string;
    startedFrom?: string;
    startedTo?: string;
  }) {
    const actorCompanyIds = this.normalizeCompanyScope(input.actorCompanyIds);
    this.assertCompanyScope(actorCompanyIds);

    const result = await this.integrationRepository.listImportBatchesNeedingAction({
      ...input,
      actorCompanyIds,
      stuckBefore: getImportStuckBeforeIso(),
    });

    const items = await Promise.all(
      result.rows.map(async (batch) => {
        let blockedByEntityTypes: string[] = [];

        if (batch.health_state === "blocked") {
          const dependencySummaryRow =
            await this.integrationRepository.getImportBatchDependencySummary(
              batch.import_batch_id,
              batch.entity_type as
                | "employee"
                | "store"
                | "kpi"
                | "assignment"
                | "position"
                | "company"
                | "region",
            );

          blockedByEntityTypes = getBlockedByEntityTypes({
            employee: Number(dependencySummaryRow?.employee_count ?? 0),
            store: Number(dependencySummaryRow?.store_count ?? 0),
            position: Number(dependencySummaryRow?.position_count ?? 0),
            region: Number(dependencySummaryRow?.region_count ?? 0),
            company: Number(dependencySummaryRow?.company_count ?? 0),
            manager: Number(dependencySummaryRow?.manager_count ?? 0),
          });
        }

        return mapImportBatchNeedsActionItem(batch, blockedByEntityTypes);
      }),
    );

    return buildListResponse(items, {
      total: result.total,
      limit: input.limit,
      offset: input.offset,
    });
  }

  async getImportBatch(input: { actorCompanyIds: string[]; batchId: string }) {
    const actorCompanyIds = this.normalizeCompanyScope(input.actorCompanyIds);
    this.assertCompanyScope(actorCompanyIds);
    const batch = await this.integrationRepository.getImportBatch({
      actorCompanyIds,
      batchId: input.batchId,
    });

    if (!batch) {
      throw new NotFoundException(`Import batch not found: ${input.batchId}`);
    }

    const summaryRows = await this.integrationRepository.getImportBatchRowStatusSummary(
      batch.import_batch_id,
      batch.entity_type,
    );
    const dependencySummaryRow =
      await this.integrationRepository.getImportBatchDependencySummary(
        batch.import_batch_id,
        batch.entity_type,
      );
    const lineageSummaryRow =
      batch.entity_type === "kpi"
        ? await this.integrationRepository.getImportBatchLineageSummary(batch.import_batch_id)
        : null;
    const qualityIssueRows = await this.integrationRepository.getImportBatchQualityIssueRows(
      batch.import_batch_id,
      batch.entity_type,
    );

    const rowStatusSummary = {
      processed: 0,
      validationFailed: 0,
      retryableError: 0,
      pending: 0,
    };

    for (const row of summaryRows) {
      if (row.normalized_status === "processed") rowStatusSummary.processed = Number(row.row_count);
      if (row.normalized_status === "validation_failed") {
        rowStatusSummary.validationFailed = Number(row.row_count);
      }
      if (row.normalized_status === "retryable_error") {
        rowStatusSummary.retryableError = Number(row.row_count);
      }
      if (row.normalized_status === "pending") rowStatusSummary.pending = Number(row.row_count);
    }

    const dependencySummary = {
      employee: Number(dependencySummaryRow?.employee_count ?? 0),
      store: Number(dependencySummaryRow?.store_count ?? 0),
      position: Number(dependencySummaryRow?.position_count ?? 0),
      region: Number(dependencySummaryRow?.region_count ?? 0),
      company: Number(dependencySummaryRow?.company_count ?? 0),
      manager: Number(dependencySummaryRow?.manager_count ?? 0),
    };
    const blockedByEntityTypes = getBlockedByEntityTypes(dependencySummary);
    const recommendedImportOrder = getRecommendedImportOrder();
    const recommendedNextEntityType = blockedByEntityTypes[0] ?? null;
    const canRetryNow = blockedByEntityTypes.length === 0;
    const healthState = getDetailHealthState({
      status: batch.status,
      rowStatusSummary,
      blockedByEntityTypes,
      canRetryNow,
    });

    return {
      batch: mapImportBatchDetailBatch(batch, healthState),
      rowStatusSummary,
      dependencySummary,
      blockedByEntityTypes,
      recommendedImportOrder,
      recommendedNextEntityType,
      canRetryNow,
      healthState,
      qualityIssueSummary: this.getQualityIssueSummary(qualityIssueRows),
      lineageSummary: {
        supported: batch.entity_type === "kpi",
        rowHashCount: Number(lineageSummaryRow?.row_hash_count ?? 0),
        rawRowReferenceCount: Number(lineageSummaryRow?.raw_row_reference_count ?? 0),
        sampleRowHash: lineageSummaryRow?.sample_row_hash ?? null,
        sampleRawRowReference: lineageSummaryRow?.sample_raw_row_reference ?? null,
      },
    };
  }

  async getImportBatchReconciliation(input: { actorCompanyIds: string[]; batchId: string }) {
    const detail = await this.getImportBatch(input);
    const totalRows =
      detail.rowStatusSummary.processed +
      detail.rowStatusSummary.validationFailed +
      detail.rowStatusSummary.retryableError +
      detail.rowStatusSummary.pending;
    const unaccountedRows = Math.max(detail.batch.recordCount - totalRows, 0);
    const safeDivide = (value: number, total: number) => (total > 0 ? value / total : 0);

    return {
      batch: detail.batch,
      totals: {
        recordCount: detail.batch.recordCount,
        accountedRows: totalRows,
        unaccountedRows,
        countsMatchRecordCount: totalRows === detail.batch.recordCount,
      },
      rowStatusSummary: detail.rowStatusSummary,
      rates: {
        processedRate: safeDivide(detail.rowStatusSummary.processed, detail.batch.recordCount),
        validationFailureRate: safeDivide(
          detail.rowStatusSummary.validationFailed,
          detail.batch.recordCount,
        ),
        retryableErrorRate: safeDivide(
          detail.rowStatusSummary.retryableError,
          detail.batch.recordCount,
        ),
        pendingRate: safeDivide(detail.rowStatusSummary.pending, detail.batch.recordCount),
        accountedRate: safeDivide(totalRows, detail.batch.recordCount),
      },
      reconciliation: {
        hasFailures:
          detail.rowStatusSummary.validationFailed > 0 ||
          detail.rowStatusSummary.retryableError > 0,
        hasPendingRows: detail.rowStatusSummary.pending > 0,
        hasUnaccountedRows: unaccountedRows > 0,
        canRetryNow: detail.canRetryNow,
        blockedByEntityTypes: detail.blockedByEntityTypes,
        recommendedNextEntityType: detail.recommendedNextEntityType,
      },
    };
  }

  async getImportBatchErrors(input: {
    actorCompanyIds: string[];
    batchId: string;
    limit?: number;
    offset?: number;
  }) {
    const actorCompanyIds = this.normalizeCompanyScope(input.actorCompanyIds);
    this.assertCompanyScope(actorCompanyIds);
    const batch = await this.integrationRepository.getImportBatch({
      actorCompanyIds,
      batchId: input.batchId,
    });

    if (!batch) {
      throw new NotFoundException(`Import batch not found: ${input.batchId}`);
    }

    const result = await this.integrationRepository.getImportBatchErrors({
      batchId: input.batchId,
      entityType: batch.entity_type,
      limit: input.limit,
      offset: input.offset,
    });

    return buildListResponse(
      result.rows.map((row) => {
        const qualityIssueCode = classifyImportDataQualityIssue({
          normalizedStatus: row.normalized_status,
          validationError: row.validation_error,
        });
        const lineage =
          row.row_hash || row.raw_row_reference
            ? {
                rowHash: row.row_hash ?? null,
                rawRowReference: row.raw_row_reference ?? null,
              }
            : {};
        const mappingCandidate = this.getMappingCandidate({
          integrationSourceId: batch.integration_source_id,
          qualityIssueCode,
          row,
        });

        return {
          rowId: row.row_id,
          sourceRef: row.source_ref,
          ...lineage,
          normalizedStatus: row.normalized_status,
          errorCategory: this.classifyErrorCategory(row.normalized_status, row.validation_error),
          qualityIssueCode,
          ...(mappingCandidate ? { mappingCandidate } : {}),
          validationError: row.validation_error,
          processedAt: row.processed_at,
        };
      }),
      { total: result.total, limit: input.limit, offset: input.offset },
    );
  }

  async approveExternalIdMapping(input: {
    actorCompanyIds: string[];
    integrationSourceId: string;
    entityType: "employee" | "store";
    externalId: string;
    internalId: string;
    actorUserId: string;
  }) {
    this.assertCompanyScope(input.actorCompanyIds);
    const source = await this.integrationSourceRepository.getIntegrationSourceById(input.integrationSourceId);

    if (!source) {
      throw new NotFoundException(`Integration source not found: ${input.integrationSourceId}`);
    }

    if (!source.is_active) {
      throw new ConflictException(`Integration source ${input.integrationSourceId} is inactive`);
    }

    const internalTableName = this.getExternalIdInternalTableName(input.entityType);
    const mappingTarget = await this.integrationRepository.getScopedExternalIdMappingTarget({
      actorCompanyIds: input.actorCompanyIds,
      entityType: input.entityType,
      internalId: input.internalId,
    });

    if (!mappingTarget) {
      throw new NotFoundException(
        `External ID mapping target not found in actor company scope: ${input.internalId}`,
      );
    }

    await this.externalIdMappingService.upsertMapping({
      integrationSourceId: input.integrationSourceId,
      entityType: input.entityType,
      externalId: input.externalId,
      internalId: input.internalId,
      internalTableName,
    });
    await this.integrationRepository.recordExternalIdMappingApproved({
      actorUserId: input.actorUserId,
      integrationSourceId: input.integrationSourceId,
      entityType: input.entityType,
      externalId: input.externalId,
      internalId: input.internalId,
      internalTableName,
    });

    logStructuredMessage(this.logger, "external_id_mapping.approved", {
      actorUserId: input.actorUserId,
      integrationSourceId: input.integrationSourceId,
      sourceCode: source.source_code,
      entityType: input.entityType,
      externalId: input.externalId,
      internalId: input.internalId,
      internalTableName,
    });

    return buildCommandResponse({
      status: "updated",
      message: "External ID mapping approved",
      data: {
        mapping: {
          integrationSourceId: input.integrationSourceId,
          entityType: input.entityType,
          externalId: input.externalId,
          internalId: input.internalId,
          internalTableName,
        },
      },
    });
  }

  async getImportBatchAudit(input: { actorCompanyIds: string[]; batchId: string }) {
    const actorCompanyIds = this.normalizeCompanyScope(input.actorCompanyIds);
    this.assertCompanyScope(actorCompanyIds);
    const batch = await this.integrationRepository.getImportBatch({
      actorCompanyIds,
      batchId: input.batchId,
    });

    if (!batch) {
      throw new NotFoundException(`Import batch not found: ${input.batchId}`);
    }

    const events = await this.integrationRepository.getImportBatchAudit(input.batchId);

    return buildListResponse(
      events.map((event) => mapAuditEvent(event)),
      { total: events.length },
    );
  }

  async retryImportBatch(input: {
    actorCompanyIds: string[];
    actorUserId: string;
    batchId: string;
  }) {
    const actorCompanyIds = this.normalizeCompanyScope(input.actorCompanyIds);
    this.assertCompanyScope(actorCompanyIds);
    const detail = await this.getImportBatch({
      actorCompanyIds,
      batchId: input.batchId,
    });

    if (!["failed", "completed_with_errors"].includes(detail.batch.status)) {
      throw new ConflictException(`Import batch ${input.batchId} is not in a retryable status`);
    }

    if (detail.rowStatusSummary.retryableError === 0) {
      throw new ConflictException(`Import batch ${input.batchId} has no retryable rows`);
    }

    if (!detail.canRetryNow) {
      throw new ConflictException(`Import batch ${input.batchId} still has unresolved dependencies`);
    }

    await this.integrationRepository.markImportBatchPending({
      actorCompanyIds,
      batchId: input.batchId,
    });
    await this.integrationRepository.recordImportBatchRetried({
      batchId: input.batchId,
      actorUserId: input.actorUserId,
      entityType: detail.batch.entityType,
      retryCount: detail.batch.retryCount + 1,
    });

    const job = await this.jobDispatcher.dispatch(
      "import-batch",
      { batchId: input.batchId } satisfies ImportBatchJobPayload,
      async ({ batchId: queuedBatchId }: ImportBatchJobPayload) => {
        await this.materializationService.materializeBatch(queuedBatchId);
      },
    );

    logStructuredMessage(this.logger, "import_batch.retry.accepted", {
      actorUserId: input.actorUserId,
      batchId: input.batchId,
      jobId: job.jobId ?? null,
      queueBackend: job.backend,
      queueName: job.queueName ?? null,
      retryCount: detail.batch.retryCount + 1,
    });

    return buildCommandResponse({
      status: job.status,
      message: "Import batch requeued for retry",
      data: {
        batch: {
          ...detail.batch,
          retryCount: detail.batch.retryCount + 1,
          lastRetriedAt: null,
        },
      },
      job: {
        jobType: job.jobType,
        backend: job.backend,
        jobId: job.jobId ?? null,
        queueName: job.queueName ?? null,
      },
    });
  }

  private classifyErrorCategory(
    normalizedStatus: string,
    validationError: string | null,
  ): "validation" | "missing_dependency" | "write_failure" {
    if (normalizedStatus === "validation_failed") {
      return "validation";
    }

    const errorMessage = (validationError ?? "").toLowerCase();
    if (
      errorMessage.includes("could not be resolved") ||
      errorMessage.includes("missing dependency")
    ) {
      return "missing_dependency";
    }

    return "write_failure";
  }

  private getMappingCandidate(input: {
    integrationSourceId: string;
    qualityIssueCode: ImportDataQualityIssueCode;
    row: {
      store_external_ref: string | null;
      employee_external_ref: string | null;
      payload_json: Record<string, unknown> | null;
    };
  }) {
    const payload = input.row.payload_json ?? {};
    if (input.qualityIssueCode === "unmapped_store") {
      const externalId = this.firstNonEmptyString([
        input.row.store_external_ref,
        payload["storeExternalRef"],
        payload["sourceStoreId"],
      ]);

      return externalId
        ? {
            integrationSourceId: input.integrationSourceId,
            entityType: "store" as const,
            externalId,
            internalTableName: this.getExternalIdInternalTableName("store"),
          }
        : null;
    }

    if (input.qualityIssueCode === "unmapped_employee") {
      const externalId = this.firstNonEmptyString([
        input.row.employee_external_ref,
        payload["employeeExternalRef"],
        payload["sourceEmployeeId"],
      ]);

      return externalId
        ? {
            integrationSourceId: input.integrationSourceId,
            entityType: "employee" as const,
            externalId,
            internalTableName: this.getExternalIdInternalTableName("employee"),
          }
        : null;
    }

    return null;
  }

  private getExternalIdInternalTableName(entityType: "employee" | "store") {
    return entityType === "employee" ? "ops.employee" : "ops.store";
  }

  private normalizeCompanyScope(companyIds: string[]) {
    return [...new Set(companyIds.filter((companyId) => companyId.trim().length > 0))].sort();
  }

  private assertCompanyScope(companyIds: string[]) {
    if (companyIds.length === 0) {
      throw new ForbiddenException("Integration operation requires company scope");
    }
  }

  private firstNonEmptyString(values: unknown[]) {
    for (const value of values) {
      if (typeof value === "string" && value.trim().length > 0) {
        return value;
      }
    }

    return null;
  }

  private getQualityIssueSummary(
    rows: Array<{
      normalized_status: string;
      validation_error: string | null;
      row_count: string;
    }>,
  ) {
    const issueCounts = new Map<ImportDataQualityIssueCode, number>();

    for (const row of rows) {
      const code = classifyImportDataQualityIssue({
        normalizedStatus: row.normalized_status,
        validationError: row.validation_error,
      });
      const count = Number(row.row_count ?? 0);
      issueCounts.set(code, (issueCounts.get(code) ?? 0) + count);
    }

    const items = Array.from(issueCounts.entries())
      .map(([code, count]) => {
        const issue = getImportDataQualityIssue(code) ?? getImportDataQualityIssue("unknown_quality_issue");
        return {
          code,
          label: issue?.label ?? "Unknown quality issue",
          owner: issue?.owner ?? "system",
          severity: issue?.severity ?? "low",
          description: issue?.description ?? "The row failed without a recognized data quality issue pattern.",
          count,
        };
      })
      .sort((left, right) => {
        const severityDelta = this.getSeverityRank(left) - this.getSeverityRank(right);
        if (severityDelta !== 0) return severityDelta;
        if (right.count !== left.count) return right.count - left.count;
        return left.code.localeCompare(right.code);
      });

    return {
      totalIssueRows: items.reduce((sum, item) => sum + item.count, 0),
      highSeverityRows: items
        .filter((item) => item.severity === "high")
        .reduce((sum, item) => sum + item.count, 0),
      items,
    };
  }

  private getSeverityRank(issue: Pick<ImportDataQualityIssue, "severity">) {
    if (issue.severity === "high") return 0;
    if (issue.severity === "medium") return 1;
    return 2;
  }

  private getSupportedEntityTypes() {
    return ["employee", "store", "kpi", "assignment", "position", "company", "region"];
  }

  private getSupportedSourceSystems() {
    return ["nebim_v3", "power_bi", "manual", "other"];
  }

  private getSupportedStateModels() {
    return ["latest_state", "closed_period"];
  }

  private mapIntegrationSource(item: {
    integration_source_id: string;
    source_code: string;
    source_name: string;
    entity_type: string;
    source_system: string;
    state_model: string;
    poll_enabled: boolean;
    poll_interval_minutes: number;
    poll_window_start_local: string;
    poll_window_end_local: string;
    poll_timezone: string;
    is_active: boolean;
  }) {
    return {
      sourceId: item.integration_source_id,
      sourceCode: item.source_code,
      sourceName: item.source_name,
      entityType: item.entity_type,
      sourceSystem: item.source_system,
      stateModel: item.state_model,
      pollEnabled: item.poll_enabled,
      pollIntervalMinutes: item.poll_interval_minutes,
      pollWindowStartLocal: item.poll_window_start_local,
      pollWindowEndLocal: item.poll_window_end_local,
      pollTimezone: item.poll_timezone,
      isActive: item.is_active,
    };
  }

  private mapStoreMaster(item: {
    store_id: string;
    store_code: string;
    store_name: string;
    store_type: string;
    status: string;
    kpi_import_enabled: boolean;
    region_id: string | null;
    region_name: string | null;
  }) {
    return {
      storeId: item.store_id,
      storeCode: item.store_code,
      storeName: item.store_name,
      storeType: item.store_type,
      status: item.status,
      kpiImportEnabled: item.kpi_import_enabled,
      regionId: item.region_id,
      regionName: item.region_name,
    };
  }

  private mapPersonnelMaster(item: {
    employee_id: string;
    external_employee_ref: string | null;
    first_name: string;
    last_name: string;
    hire_date: string;
    termination_date: string | null;
    employment_status: string;
    employment_type: string;
    assignment_id: string | null;
    assignment_start_date: string | null;
    store_id: string | null;
    store_code: string | null;
    store_name: string | null;
    region_id: string | null;
    region_name: string | null;
    position_id: string | null;
    position_code: string | null;
    position_name: string | null;
  }) {
    const firstName = item.first_name.trim();
    const lastName = item.last_name.trim();

    return {
      employeeId: item.employee_id,
      externalEmployeeRef: item.external_employee_ref,
      firstName,
      lastName,
      displayName: [firstName, lastName].filter(Boolean).join(" "),
      hireDate: item.hire_date,
      terminationDate: item.termination_date,
      employmentStatus: item.employment_status,
      employmentType: item.employment_type,
      assignmentId: item.assignment_id,
      assignmentStartDate: item.assignment_start_date,
      storeId: item.store_id,
      storeCode: item.store_code,
      storeName: item.store_name,
      regionId: item.region_id,
      regionName: item.region_name,
      positionId: item.position_id,
      positionCode: item.position_code,
      positionName: item.position_name,
    };
  }

}
