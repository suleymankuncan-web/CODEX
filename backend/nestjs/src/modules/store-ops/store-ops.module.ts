import { Module } from "@nestjs/common";
import { OrgController } from "./web/org.controller";
import { WorkforceController } from "./web/workforce.controller";
import { ChecklistController } from "./web/checklist.controller";
import { AdminChecklistTemplateController } from "./web/admin-checklist-template.controller";
import { MobileChecklistController } from "./web/mobile-checklist.controller";
import { SnapshotController } from "./web/snapshot.controller";
import { ReportingController } from "./web/reporting.controller";
import { TargetDistributionController } from "./web/target-distribution.controller";
import { WorkflowInboxController } from "./web/workflow-inbox.controller";
import { CompetitionController } from "./web/competition.controller";
import { FeedController } from "./web/feed.controller";
import { OrgService } from "./application/org.service";
import { WorkforceService } from "./application/workforce.service";
import { ChecklistService } from "./application/checklist.service";
import { SnapshotService } from "./application/snapshot.service";
import { RankingService } from "./application/ranking.service";
import { ReportingService } from "./application/reporting.service";
import { ClosedRankingService } from "./application/closed-ranking.service";
import { TargetDistributionService } from "./application/target-distribution.service";
import { WorkflowInboxService } from "./application/workflow-inbox.service";
import { CompetitionService } from "./application/competition.service";
import { FeedService } from "./application/feed.service";
import { StoreOpsRepository } from "./infrastructure/store-ops.repository";
import { WorkforceRequestRepository } from "./infrastructure/workforce-request.repository";
import { ChecklistRepository } from "./infrastructure/checklist.repository";
import { ReportingRepository } from "./infrastructure/reporting.repository";
import { SnapshotOperationsRepository } from "./infrastructure/snapshot-operations.repository";
import { TargetDistributionRepository } from "./infrastructure/target-distribution.repository";
import { ChecklistAcknowledgementRepository } from "./infrastructure/checklist-acknowledgement.repository";
import { KpiConfigRepository } from "./infrastructure/kpi-config.repository";
import { CompetitionRepository } from "./infrastructure/competition.repository";
import { FeedRepository } from "./infrastructure/feed.repository";

@Module({
  controllers: [
    OrgController,
    WorkforceController,
    ChecklistController,
    AdminChecklistTemplateController,
    MobileChecklistController,
    SnapshotController,
    ReportingController,
    TargetDistributionController,
    WorkflowInboxController,
    CompetitionController,
    FeedController,
  ],
  providers: [
    OrgService,
    WorkforceService,
    ChecklistService,
    SnapshotService,
    RankingService,
    ReportingService,
    ClosedRankingService,
    TargetDistributionService,
    WorkflowInboxService,
    CompetitionService,
    FeedService,
    StoreOpsRepository,
    WorkforceRequestRepository,
    ChecklistRepository,
    ChecklistAcknowledgementRepository,
    KpiConfigRepository,
    ReportingRepository,
    SnapshotOperationsRepository,
    TargetDistributionRepository,
    CompetitionRepository,
    FeedRepository,
  ],
  exports: [
    OrgService,
    WorkforceService,
    ChecklistService,
    SnapshotService,
    RankingService,
    ReportingService,
    ClosedRankingService,
    TargetDistributionService,
    WorkflowInboxService,
    CompetitionService,
    FeedService,
    StoreOpsRepository,
    WorkforceRequestRepository,
    ChecklistRepository,
    ChecklistAcknowledgementRepository,
    KpiConfigRepository,
    ReportingRepository,
    SnapshotOperationsRepository,
    TargetDistributionRepository,
    CompetitionRepository,
    FeedRepository,
  ],
})
export class StoreOpsModule {}
