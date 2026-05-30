import { Injectable, Logger } from "@nestjs/common";
import {
  KpiMaterializationService,
  type MaterializationStats,
} from "./kpi-materialization.service";
import { logStructuredMessage } from "../../../shared/structured-log";
import { MaterializationBatchRepository } from "../infrastructure/materialization-batch.repository";
import { EmployeeMaterializationService } from "./employee-materialization.service";
import { StoreMaterializationService } from "./store-materialization.service";
import { AssignmentMaterializationService } from "./assignment-materialization.service";
import { PositionMaterializationService } from "./position-materialization.service";
import { CompanyMaterializationService } from "./company-materialization.service";
import { RegionMaterializationService } from "./region-materialization.service";

@Injectable()
export class MaterializationService {
  private readonly logger = new Logger(MaterializationService.name);

  constructor(
    private readonly materializationBatchRepository: MaterializationBatchRepository,
    private readonly kpiMaterializationService: KpiMaterializationService,
    private readonly employeeMaterializationService: EmployeeMaterializationService,
    private readonly storeMaterializationService: StoreMaterializationService,
    private readonly assignmentMaterializationService: AssignmentMaterializationService,
    private readonly positionMaterializationService: PositionMaterializationService,
    private readonly companyMaterializationService: CompanyMaterializationService,
    private readonly regionMaterializationService: RegionMaterializationService,
  ) {}

  async materializeBatch(batchId: string): Promise<void> {
    const batch = await this.materializationBatchRepository.findImportBatchForMaterialization(
      batchId,
    );

    if (!batch) {
      throw new Error(`Import batch not found: ${batchId}`);
    }

    logStructuredMessage(this.logger, "import_batch.materialization.started", {
      batchId,
      entityType: batch.entityType,
    });
    await this.materializationBatchRepository.recordImportBatchAuditEvent(
      batchId,
      "import_batch.started",
      {
        entityType: batch.entityType,
      },
    );

    let stats: MaterializationStats = {
      processedCount: 0,
      errorCount: 0,
      hasRetryableFailure: false,
    };

    if (batch.entityType === "employee") {
      stats = await this.materializeEmployees(batch.importBatchId, batch.integrationSourceId);
    }

    if (batch.entityType === "store") {
      stats = await this.materializeStores(batch.importBatchId, batch.integrationSourceId);
    }

    if (batch.entityType === "kpi") {
      stats = await this.kpiMaterializationService.materializeKpis({
        batchId: batch.importBatchId,
        integrationSourceId: batch.integrationSourceId,
        batchEnvelope: {
          sourceBatchId: batch.sourceBatchId,
          sourcePayloadHash: batch.sourcePayloadHash,
          sourceCapturedAt: batch.sourceCapturedAt,
        },
      });
    }

    if (batch.entityType === "assignment") {
      stats = await this.materializeAssignments(
        batch.importBatchId,
        batch.integrationSourceId,
      );
    }

    if (batch.entityType === "position") {
      stats = await this.materializePositions(batch.importBatchId, batch.integrationSourceId);
    }

    if (batch.entityType === "company") {
      stats = await this.materializeCompanies(batch.importBatchId, batch.integrationSourceId);
    }

    if (batch.entityType === "region") {
      stats = await this.materializeRegions(batch.importBatchId, batch.integrationSourceId);
    }

    const batchStatus = stats.hasRetryableFailure
      ? "failed"
      : stats.errorCount > 0
        ? "completed_with_errors"
        : "completed";

    await this.materializationBatchRepository.markImportBatchFinished({
      batchId,
      status: batchStatus,
      errorCount: stats.errorCount,
    });

    await this.materializationBatchRepository.recordImportBatchAuditEvent(
      batchId,
      `import_batch.${batchStatus}`,
      {
        entityType: batch.entityType,
        processedCount: stats.processedCount,
        errorCount: stats.errorCount,
        hasRetryableFailure: stats.hasRetryableFailure,
      },
    );

    logStructuredMessage(this.logger, "import_batch.materialization.completed", {
      batchId,
      entityType: batch.entityType,
      status: batchStatus,
      processedCount: stats.processedCount,
      errorCount: stats.errorCount,
      hasRetryableFailure: stats.hasRetryableFailure,
    });
  }

  private async materializeEmployees(
    batchId: string,
    integrationSourceId: string,
  ): Promise<MaterializationStats> {
    return this.employeeMaterializationService.materializeEmployees({
      batchId,
      integrationSourceId,
    });
  }

  private async materializeStores(
    batchId: string,
    integrationSourceId: string,
  ): Promise<MaterializationStats> {
    return this.storeMaterializationService.materializeStores({
      batchId,
      integrationSourceId,
    });
  }

  private async materializeAssignments(
    batchId: string,
    integrationSourceId: string,
  ): Promise<MaterializationStats> {
    return this.assignmentMaterializationService.materializeAssignments({
      batchId,
      integrationSourceId,
    });
  }

  private async materializePositions(
    batchId: string,
    integrationSourceId: string,
  ): Promise<MaterializationStats> {
    return this.positionMaterializationService.materializePositions({
      batchId,
      integrationSourceId,
    });
  }

  private async materializeCompanies(
    batchId: string,
    integrationSourceId: string,
  ): Promise<MaterializationStats> {
    return this.companyMaterializationService.materializeCompanies({
      batchId,
      integrationSourceId,
    });
  }

  private async materializeRegions(
    batchId: string,
    integrationSourceId: string,
  ): Promise<MaterializationStats> {
    return this.regionMaterializationService.materializeRegions({
      batchId,
      integrationSourceId,
    });
  }
}
