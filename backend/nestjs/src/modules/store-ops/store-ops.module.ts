import { Module } from "@nestjs/common";
import { OrgController } from "./web/org.controller";
import { WorkforceController } from "./web/workforce.controller";
import { ChecklistController } from "./web/checklist.controller";
import { SnapshotController } from "./web/snapshot.controller";
import { ReportingController } from "./web/reporting.controller";
import { TargetDistributionController } from "./web/target-distribution.controller";
import { WorkflowInboxController } from "./web/workflow-inbox.controller";
import { OrgService } from "./application/org.service";
import { WorkforceService } from "./application/workforce.service";
import { ChecklistService } from "./application/checklist.service";
import { SnapshotService } from "./application/snapshot.service";
import { ReportingService } from "./application/reporting.service";
import { ClosedRankingService } from "./application/closed-ranking.service";
import { TargetDistributionService } from "./application/target-distribution.service";
import { WorkflowInboxService } from "./application/workflow-inbox.service";
import { StoreOpsRepository } from "./infrastructure/store-ops.repository";
import { ReportingRepository } from "./infrastructure/reporting.repository";
import { SnapshotOperationsRepository } from "./infrastructure/snapshot-operations.repository";
import { TargetDistributionRepository } from "./infrastructure/target-distribution.repository";
import { ChecklistAcknowledgementRepository } from "./infrastructure/checklist-acknowledgement.repository";
import { KpiConfigRepository } from "./infrastructure/kpi-config.repository";

@Module({
  controllers: [
    OrgController,
    WorkforceController,
    ChecklistController,
    SnapshotController,
    ReportingController,
    TargetDistributionController,
    WorkflowInboxController,
  ],
  providers: [
    OrgService,
    WorkforceService,
    ChecklistService,
    SnapshotService,
    ReportingService,
    ClosedRankingService,
    TargetDistributionService,
    WorkflowInboxService,
    StoreOpsRepository,
    ChecklistAcknowledgementRepository,
    KpiConfigRepository,
    ReportingRepository,
    SnapshotOperationsRepository,
    TargetDistributionRepository,
  ],
  exports: [
    OrgService,
    WorkforceService,
    ChecklistService,
    SnapshotService,
    ReportingService,
    ClosedRankingService,
    TargetDistributionService,
    WorkflowInboxService,
    StoreOpsRepository,
    ChecklistAcknowledgementRepository,
    KpiConfigRepository,
    ReportingRepository,
    SnapshotOperationsRepository,
    TargetDistributionRepository,
  ],
})
export class StoreOpsModule {}
