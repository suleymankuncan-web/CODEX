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
import { StoreActionPlanController } from "./web/store-action-plan.controller";
import { PilotFeedbackController } from "./web/pilot-feedback.controller";
import { OrgService } from "./application/org.service";
import { WorkforceService } from "./application/workforce.service";
import { ChecklistService } from "./application/checklist.service";
import { SnapshotService } from "./application/snapshot.service";
import { RankingService } from "./application/ranking.service";
import { ReportingService } from "./application/reporting.service";
import { ClosedRankingService } from "./application/closed-ranking.service";
import { LiveMonthlyLeaderboardService } from "./application/live-monthly-leaderboard.service";
import { TargetDistributionService } from "./application/target-distribution.service";
import { WorkflowInboxService } from "./application/workflow-inbox.service";
import { CompetitionService } from "./application/competition.service";
import { FeedService } from "./application/feed.service";
import { StoreActionPlanService } from "./application/store-action-plan.service";
import { PilotFeedbackService } from "./application/pilot-feedback.service";
import { StoreOpsRepository } from "./infrastructure/store-ops.repository";
import { WorkforceRequestRepository } from "./infrastructure/workforce-request.repository";
import { ChecklistRepository } from "./infrastructure/checklist.repository";
import { ClosedRankingRepository } from "./infrastructure/closed-ranking.repository";
import { RankingReportingReadRepository } from "./infrastructure/ranking-reporting-read.repository";
import { ReportingRepository } from "./infrastructure/reporting.repository";
import { StoreScoreReportingReadRepository } from "./infrastructure/store-score-reporting-read.repository";
import { SnapshotReportingReadRepository } from "./infrastructure/snapshot-reporting-read.repository";
import { StorePerformanceReportingReadRepository } from "./infrastructure/store-performance-reporting-read.repository";
import { SnapshotOperationsRepository } from "./infrastructure/snapshot-operations.repository";
import { TargetDistributionRepository } from "./infrastructure/target-distribution.repository";
import { ChecklistAcknowledgementRepository } from "./infrastructure/checklist-acknowledgement.repository";
import { KpiConfigRepository } from "./infrastructure/kpi-config.repository";
import { CompetitionRepository } from "./infrastructure/competition.repository";
import { CompetitionReadRepository } from "./infrastructure/competition-read.repository";
import { CompetitionStagePackagePlanReadRepository } from "./infrastructure/competition-stage-package-plan-read.repository";
import { CompetitionTeamTemplateReadRepository } from "./infrastructure/competition-team-template-read.repository";
import { FeedRepository } from "./infrastructure/feed.repository";
import { StoreActionPlanRepository } from "./infrastructure/store-action-plan.repository";
import { PilotFeedbackRepository } from "./infrastructure/pilot-feedback.repository";

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
    StoreActionPlanController,
    PilotFeedbackController,
  ],
  providers: [
    OrgService,
    WorkforceService,
    ChecklistService,
    SnapshotService,
    RankingService,
    ReportingService,
    ClosedRankingService,
    LiveMonthlyLeaderboardService,
    TargetDistributionService,
    WorkflowInboxService,
    CompetitionService,
    FeedService,
    StoreActionPlanService,
    PilotFeedbackService,
    StoreOpsRepository,
    WorkforceRequestRepository,
    ChecklistRepository,
    ChecklistAcknowledgementRepository,
    KpiConfigRepository,
    ClosedRankingRepository,
    RankingReportingReadRepository,
    ReportingRepository,
    StoreScoreReportingReadRepository,
    SnapshotReportingReadRepository,
    StorePerformanceReportingReadRepository,
    SnapshotOperationsRepository,
    TargetDistributionRepository,
    CompetitionReadRepository,
    CompetitionStagePackagePlanReadRepository,
    CompetitionTeamTemplateReadRepository,
    CompetitionRepository,
    FeedRepository,
    StoreActionPlanRepository,
    PilotFeedbackRepository,
  ],
  exports: [
    OrgService,
    WorkforceService,
    ChecklistService,
    SnapshotService,
    RankingService,
    ReportingService,
    ClosedRankingService,
    LiveMonthlyLeaderboardService,
    TargetDistributionService,
    WorkflowInboxService,
    CompetitionService,
    FeedService,
    StoreActionPlanService,
    PilotFeedbackService,
    StoreOpsRepository,
    WorkforceRequestRepository,
    ChecklistRepository,
    ChecklistAcknowledgementRepository,
    KpiConfigRepository,
    ClosedRankingRepository,
    RankingReportingReadRepository,
    ReportingRepository,
    StoreScoreReportingReadRepository,
    SnapshotReportingReadRepository,
    StorePerformanceReportingReadRepository,
    SnapshotOperationsRepository,
    TargetDistributionRepository,
    CompetitionReadRepository,
    CompetitionStagePackagePlanReadRepository,
    CompetitionTeamTemplateReadRepository,
    CompetitionRepository,
    FeedRepository,
    StoreActionPlanRepository,
    PilotFeedbackRepository,
  ],
})
export class StoreOpsModule {}
