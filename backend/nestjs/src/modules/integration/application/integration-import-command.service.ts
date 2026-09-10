import {
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { JobDispatcher } from "../../../shared/jobs/job-dispatcher.interface";
import { ImportBatchJobPayload } from "../../../shared/jobs/job-payloads";
import { JOB_DISPATCHER } from "../../../shared/jobs/jobs.constants";
import { buildCommandResponse } from "../../../shared/http/response-builders";
import { logStructuredMessage } from "../../../shared/structured-log";
import {
  getBlockedByEntityTypes,
  getDetailHealthState,
} from "./import-batch-health";
import { mapImportBatchDetailBatch } from "./import-batch-read-model.mapper";
import { MaterializationService } from "./materialization.service";
import { IntegrationRepository } from "../infrastructure/integration.repository";
import { ImportBatchReadRepository } from "../infrastructure/import-batch-read.repository";
import { ExternalIdMappingReadRepository } from "../infrastructure/external-id-mapping-read.repository";
import { IntegrationSourceRepository } from "../infrastructure/integration-source.repository";
import { KpiImportNormalizationService } from "./kpi-import-normalization.service";
import { ExternalIdMappingService } from "./external-id-mapping.service";
import { type ImportBatchEntityType } from "../infrastructure/import-batch-raw-writer.repository";
import {
  assertCompanyScope,
  normalizeCompanyScope,
} from "./integration-company-scope";
import { getExternalIdInternalTableName } from "./external-id-mapping.helpers";

type SupportedSourceSystem = "nebim_v3" | "power_bi" | "manual" | "other";

export type CreateIntegrationImportBatchInput = {
  actorCompanyIds: string[];
  sourceCode: string;
  entityType: ImportBatchEntityType;
  fileReference: string;
  actorUserId: string;
  idempotencyKey?: string;
  sourceBatchId?: string;
  sourcePayloadHash?: string;
  sourceCapturedAt?: string;
  sourceWindowStartedAt?: string;
  sourceWindowEndedAt?: string;
  rows?: Record<string, unknown>[];
};

export type ApproveExternalIdMappingInput = {
  actorCompanyIds: string[];
  integrationSourceId: string;
  entityType: "employee" | "store";
  externalId: string;
  internalId: string;
  actorUserId: string;
};

export type RetryImportBatchInput = {
  actorCompanyIds: string[];
  actorUserId: string;
  batchId: string;
};

@Injectable()
export class IntegrationImportCommandService {
  private readonly logger = new Logger(IntegrationImportCommandService.name);

  constructor(
    private readonly integrationRepository: IntegrationRepository,
    private readonly importBatchReadRepository: ImportBatchReadRepository,
    private readonly externalIdMappingReadRepository: ExternalIdMappingReadRepository,
    private readonly integrationSourceRepository: IntegrationSourceRepository,
    private readonly materializationService: MaterializationService,
    private readonly kpiImportNormalizationService: KpiImportNormalizationService,
    private readonly externalIdMappingService: ExternalIdMappingService,
    @Inject(JOB_DISPATCHER)
    private readonly jobDispatcher: JobDispatcher,
  ) {}

  async createImportBatch(input: CreateIntegrationImportBatchInput) {
    const actorCompanyIds = normalizeCompanyScope(input.actorCompanyIds);
    assertCompanyScope(actorCompanyIds);

    let rows = input.rows;
    if (input.entityType === "kpi" && input.rows?.length) {
      const source = await this.integrationSourceRepository.getIntegrationSourceByCodeAndEntity(
        input.sourceCode,
        input.entityType,
      );

      if (source) {
        rows = this.kpiImportNormalizationService.normalize({
          sourceSystem: source.source_system as SupportedSourceSystem,
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

    // A pending row is not proof of enqueue: retry the same deterministic job.
    const jobId = `import-batch-${batch.batchId}-initial`;
    const job = batch.reused && batch.status !== "pending"
      ? { status: batch.status, jobType: "import-batch" as const, backend: "reused", jobId: null, queueName: null }
      : await this.jobDispatcher.dispatch(
          "import-batch",
          { batchId: batch.batchId } satisfies ImportBatchJobPayload,
          async ({ batchId }: ImportBatchJobPayload) => {
            await this.materializationService.materializeBatch(batchId);
          },
          { jobId, strictLocalJobId: jobId },
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

  async approveExternalIdMapping(input: ApproveExternalIdMappingInput) {
    assertCompanyScope(input.actorCompanyIds);
    const source = await this.integrationSourceRepository.getIntegrationSourceById(
      input.integrationSourceId,
    );

    if (!source) {
      throw new NotFoundException(`Integration source not found: ${input.integrationSourceId}`);
    }

    if (!source.is_active) {
      throw new ConflictException(`Integration source ${input.integrationSourceId} is inactive`);
    }

    const internalTableName = getExternalIdInternalTableName(input.entityType);
    const mappingTarget =
      await this.externalIdMappingReadRepository.getScopedExternalIdMappingTarget({
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

  async retryImportBatch(input: RetryImportBatchInput) {
    const actorCompanyIds = normalizeCompanyScope(input.actorCompanyIds);
    assertCompanyScope(actorCompanyIds);
    const detail = await this.getRetryImportBatchDetail({
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
      {
        strictLocalJobId: `import-batch-${input.batchId}-retry-${detail.batch.retryCount + 1}`,
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

  private async getRetryImportBatchDetail(input: {
    actorCompanyIds: string[];
    batchId: string;
  }) {
    const batch = await this.importBatchReadRepository.getImportBatch(input);

    if (!batch) {
      throw new NotFoundException(`Import batch not found: ${input.batchId}`);
    }

    const summaryRows = await this.importBatchReadRepository.getImportBatchRowStatusSummary(
      batch.import_batch_id,
      batch.entity_type,
    );
    const dependencySummaryRow =
      await this.importBatchReadRepository.getImportBatchDependencySummary(
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
      canRetryNow,
    };
  }
}
