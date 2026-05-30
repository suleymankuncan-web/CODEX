import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { IntegrationRepository } from "../infrastructure/integration.repository";
import { ImportBatchReadRepository } from "../infrastructure/import-batch-read.repository";
import { ExternalIdMappingReadRepository } from "../infrastructure/external-id-mapping-read.repository";
import { KpiImportStoreReadRepository } from "../infrastructure/kpi-import-store-read.repository";
import { PersonnelMasterReadRepository } from "../infrastructure/personnel-master-read.repository";
import { IntegrationSourceRepository } from "../infrastructure/integration-source.repository";
import { IntegrationSchedulerService } from "./integration-scheduler.service";
import {
  buildCommandResponse,
  buildListResponse,
} from "../../../shared/http/response-builders";
import { mapAuditEvent } from "../../../shared/audit/audit-event.mapper";
import { logStructuredMessage } from "../../../shared/structured-log";
import {
  mapImportBatchListItem,
  mapImportBatchNeedsActionItem,
} from "./import-batch-read-model.mapper";
import {
  getBlockedByEntityTypes,
  getImportStuckBeforeIso,
  getListHealthState,
} from "./import-batch-health";
import {
  buildIntegrationLookups,
  mapIntegrationSource,
  mapPersonnelMaster,
  mapStoreMaster,
} from "./integration-read-model.helpers";
import {
  assertCompanyScope,
  normalizeCompanyScope,
} from "./integration-company-scope";
import { getExternalIdInternalTableName } from "./external-id-mapping.helpers";
import {
  buildImportBatchDetailModel,
  buildImportBatchErrorItem,
  buildImportBatchReconciliationModel,
} from "./import-batch-detail.helpers";
import {
  buildImportPayloadTemplate,
  type SupportedEntityType,
  type SupportedSourceSystem,
} from "./integration-payload-template.helpers";
import {
  type ApproveExternalIdMappingInput,
  type CreateIntegrationImportBatchInput,
  IntegrationImportCommandService,
  type RetryImportBatchInput,
} from "./integration-import-command.service";

@Injectable()
export class IntegrationService {
  private readonly logger = new Logger(IntegrationService.name);

  constructor(
    private readonly integrationRepository: IntegrationRepository,
    private readonly importBatchReadRepository: ImportBatchReadRepository,
    private readonly externalIdMappingReadRepository: ExternalIdMappingReadRepository,
    private readonly kpiImportStoreReadRepository: KpiImportStoreReadRepository,
    private readonly personnelMasterReadRepository: PersonnelMasterReadRepository,
    private readonly integrationSourceRepository: IntegrationSourceRepository,
    private readonly integrationSchedulerService: IntegrationSchedulerService,
    private readonly importCommandService: IntegrationImportCommandService,
  ) {}

  async createImportBatch(input: CreateIntegrationImportBatchInput) {
    return this.importCommandService.createImportBatch(input);
  }

  async listIntegrationSources(input: {
    limit?: number;
    offset?: number;
    entityType?: string;
    sourceSystem?: string;
    isActive?: boolean;
  }) {
    const result =
      await this.integrationSourceRepository.listIntegrationSources(input);

    return buildListResponse(
      result.rows.map((item) => mapIntegrationSource(item)),
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
    const existing =
      await this.integrationSourceRepository.getIntegrationSourceByCodeAndEntity(
        input.sourceCode,
        input.entityType,
      );
    if (existing) {
      throw new ConflictException(
        `Integration source already exists for ${input.sourceCode}/${input.entityType}`,
      );
    }

    const source =
      await this.integrationSourceRepository.createIntegrationSource(input);

    return buildCommandResponse({
      status: "created",
      message: "Integration source created",
      data: {
        source: mapIntegrationSource(source),
      },
    });
  }

  async deactivateIntegrationSource(sourceId: string, actorUserId: string) {
    const activeBatchCount =
      await this.integrationSourceRepository.countActiveImportBatchesForSource(
        sourceId,
      );
    if (activeBatchCount > 0) {
      throw new ConflictException(
        `Integration source ${sourceId} cannot be deactivated while active import batches exist`,
      );
    }

    const source =
      await this.integrationSourceRepository.updateIntegrationSourceActiveState(
        {
          sourceId,
          isActive: false,
          actorUserId,
        },
      );

    if (!source) {
      throw new NotFoundException(`Integration source not found: ${sourceId}`);
    }

    return buildCommandResponse({
      status: "updated",
      message: "Integration source deactivated",
      data: {
        source: mapIntegrationSource(source),
      },
    });
  }

  async reactivateIntegrationSource(sourceId: string, actorUserId: string) {
    const source =
      await this.integrationSourceRepository.updateIntegrationSourceActiveState(
        {
          sourceId,
          isActive: true,
          actorUserId,
        },
      );

    if (!source) {
      throw new NotFoundException(`Integration source not found: ${sourceId}`);
    }

    return buildCommandResponse({
      status: "updated",
      message: "Integration source reactivated",
      data: {
        source: mapIntegrationSource(source),
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
    const source =
      await this.integrationSourceRepository.updateIntegrationSourceSchedule({
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
        source: mapIntegrationSource(source),
      },
    });
  }

  async listDueIntegrationSources(referenceAt?: string) {
    const rows =
      await this.integrationSchedulerService.listDueSources(referenceAt);
    return buildListResponse(rows, { total: rows.length });
  }

  async getImportPayloadTemplate(input?: {
    entityType?: SupportedEntityType;
    sourceSystem?: SupportedSourceSystem;
  }) {
    return buildImportPayloadTemplate(input);
  }

  async getIntegrationLookups() {
    const activeSources =
      await this.integrationSourceRepository.listActiveIntegrationSources();
    return buildIntegrationLookups(activeSources);
  }

  async listExternalIdMapCandidates(input: {
    actorCompanyIds: string[];
    entityType: "employee" | "store";
    q?: string;
    limit?: number;
  }) {
    this.assertCompanyScope(input.actorCompanyIds);
    const limit = input.limit ?? 10;
    const result =
      await this.externalIdMappingReadRepository.listExternalIdMapCandidates({
        actorCompanyIds: input.actorCompanyIds,
        entityType: input.entityType,
        q: input.q,
        limit,
      });
    const internalTableName = this.getExternalIdInternalTableName(
      input.entityType,
    );

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
    const result =
      await this.kpiImportStoreReadRepository.listKpiImportStoreScope(input);

    return buildListResponse(
      result.rows.map((item) => mapStoreMaster(item)),
      { total: result.total, limit: input.limit, offset: input.offset },
    );
  }

  async getStoreMasterLookups(input: { actorCompanyIds: string[] }) {
    const regions =
      await this.kpiImportStoreReadRepository.listStoreMasterRegions({
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
    const storeScope =
      await this.integrationRepository.updateKpiImportStoreScope(input);

    if (!storeScope) {
      throw new NotFoundException(
        `Store or region not found: ${input.storeId}`,
      );
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
        storeMaster: mapStoreMaster(storeScope),
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
    const result = await this.personnelMasterReadRepository.listPersonnelMaster(
      {
        ...input,
        actorCompanyIds,
      },
    );

    return buildListResponse(
      result.rows.map((item) => mapPersonnelMaster(item)),
      { total: result.total, limit: input.limit, offset: input.offset },
    );
  }

  async getPersonnelMasterLookups(input: { actorCompanyIds: string[] }) {
    const actorCompanyIds = this.normalizeCompanyScope(input.actorCompanyIds);
    this.assertCompanyScope(actorCompanyIds);
    const lookups =
      await this.personnelMasterReadRepository.listPersonnelMasterLookups({
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
      throw new NotFoundException(
        `Personnel master record not found: ${input.employeeId}`,
      );
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
        personnelMaster: mapPersonnelMaster(personnel),
      },
    });
  }

  async getIntegrationSourceAudit(sourceId: string) {
    const source =
      await this.integrationSourceRepository.getIntegrationSourceById(sourceId);

    if (!source) {
      throw new NotFoundException(`Integration source not found: ${sourceId}`);
    }

    const events =
      await this.integrationSourceRepository.getIntegrationSourceAudit(
        sourceId,
      );

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

    const result = await this.importBatchReadRepository.listImportBatches({
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

    const summary =
      await this.importBatchReadRepository.getImportBatchSummary(scopedInput);
    const [completedBatchId, failedBatchId, inProgressBatchId] =
      await Promise.all([
        this.importBatchReadRepository.getLatestImportBatchIdByStatus({
          ...scopedInput,
          status: "completed",
        }),
        this.importBatchReadRepository.getLatestImportBatchIdByStatus({
          ...scopedInput,
          status: "failed",
        }),
        this.importBatchReadRepository.getLatestImportBatchIdByStatus({
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
    const [
      summary,
      actionCounts,
      completedBatchId,
      failedBatchId,
      inProgressBatchId,
      stuckBatchId,
    ] = await Promise.all([
      this.importBatchReadRepository.getImportBatchSummary(scopedInput),
      this.importBatchReadRepository.getImportBatchActionCounts({
        ...scopedInput,
        stuckBefore,
      }),
      this.importBatchReadRepository.getLatestImportBatchIdByStatus({
        ...scopedInput,
        status: "completed",
      }),
      this.importBatchReadRepository.getLatestImportBatchIdByStatus({
        ...scopedInput,
        status: "failed",
      }),
      this.importBatchReadRepository.getLatestImportBatchIdByStatus({
        ...scopedInput,
        status: "processing",
      }),
      this.importBatchReadRepository.getLatestStuckImportBatchId({
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
        inProgress: Math.max(
          summary.pending +
            summary.queued +
            summary.processing -
            actionCounts.stuck,
          0,
        ),
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

    const result =
      await this.importBatchReadRepository.listImportBatchesNeedingAction({
        ...input,
        actorCompanyIds,
        stuckBefore: getImportStuckBeforeIso(),
      });

    const items = await Promise.all(
      result.rows.map(async (batch) => {
        let blockedByEntityTypes: string[] = [];

        if (batch.health_state === "blocked") {
          const dependencySummaryRow =
            await this.importBatchReadRepository.getImportBatchDependencySummary(
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
    const batch = await this.importBatchReadRepository.getImportBatch({
      actorCompanyIds,
      batchId: input.batchId,
    });

    if (!batch) {
      throw new NotFoundException(`Import batch not found: ${input.batchId}`);
    }

    const summaryRows =
      await this.importBatchReadRepository.getImportBatchRowStatusSummary(
        batch.import_batch_id,
        batch.entity_type,
      );
    const dependencySummaryRow =
      await this.importBatchReadRepository.getImportBatchDependencySummary(
        batch.import_batch_id,
        batch.entity_type,
      );
    const lineageSummaryRow =
      batch.entity_type === "kpi"
        ? await this.importBatchReadRepository.getImportBatchLineageSummary(
            batch.import_batch_id,
          )
        : null;
    const qualityIssueRows =
      await this.importBatchReadRepository.getImportBatchQualityIssueRows(
        batch.import_batch_id,
        batch.entity_type,
      );

    return buildImportBatchDetailModel({
      batch,
      summaryRows,
      dependencySummaryRow,
      lineageSummaryRow,
      qualityIssueRows,
    });
  }

  async getImportBatchReconciliation(input: {
    actorCompanyIds: string[];
    batchId: string;
  }) {
    const detail = await this.getImportBatch(input);
    return buildImportBatchReconciliationModel(detail);
  }

  async getImportBatchErrors(input: {
    actorCompanyIds: string[];
    batchId: string;
    limit?: number;
    offset?: number;
  }) {
    const actorCompanyIds = this.normalizeCompanyScope(input.actorCompanyIds);
    this.assertCompanyScope(actorCompanyIds);
    const batch = await this.importBatchReadRepository.getImportBatch({
      actorCompanyIds,
      batchId: input.batchId,
    });

    if (!batch) {
      throw new NotFoundException(`Import batch not found: ${input.batchId}`);
    }

    const result = await this.importBatchReadRepository.getImportBatchErrors({
      batchId: input.batchId,
      entityType: batch.entity_type,
      limit: input.limit,
      offset: input.offset,
    });

    return buildListResponse(
      result.rows.map((row) =>
        buildImportBatchErrorItem({
          integrationSourceId: batch.integration_source_id,
          row,
        }),
      ),
      { total: result.total, limit: input.limit, offset: input.offset },
    );
  }

  async approveExternalIdMapping(input: ApproveExternalIdMappingInput) {
    return this.importCommandService.approveExternalIdMapping(input);
  }

  async getImportBatchAudit(input: {
    actorCompanyIds: string[];
    batchId: string;
  }) {
    const actorCompanyIds = this.normalizeCompanyScope(input.actorCompanyIds);
    this.assertCompanyScope(actorCompanyIds);
    const batch = await this.importBatchReadRepository.getImportBatch({
      actorCompanyIds,
      batchId: input.batchId,
    });

    if (!batch) {
      throw new NotFoundException(`Import batch not found: ${input.batchId}`);
    }

    const events = await this.importBatchReadRepository.getImportBatchAudit(
      input.batchId,
    );

    return buildListResponse(
      events.map((event) => mapAuditEvent(event)),
      { total: events.length },
    );
  }

  async retryImportBatch(input: RetryImportBatchInput) {
    return this.importCommandService.retryImportBatch(input);
  }

  private getExternalIdInternalTableName(entityType: "employee" | "store") {
    return getExternalIdInternalTableName(entityType);
  }

  private normalizeCompanyScope(companyIds: string[]) {
    return normalizeCompanyScope(companyIds);
  }

  private assertCompanyScope(companyIds: string[]) {
    assertCompanyScope(companyIds);
  }
}
