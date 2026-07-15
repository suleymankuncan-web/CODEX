import { Module } from "@nestjs/common";
import { FeedController } from "./web/feed.controller";
import { PilotFeedbackController } from "./web/pilot-feedback.controller";
import { StoreActionPlanController } from "./web/store-action-plan.controller";
import { TargetDistributionController } from "./web/target-distribution.controller";
import { WorkflowInboxController } from "./web/workflow-inbox.controller";
import { FeedService } from "./application/feed.service";
import { PilotFeedbackService } from "./application/pilot-feedback.service";
import { StoreActionPlanService } from "./application/store-action-plan.service";
import { TargetDistributionService } from "./application/target-distribution.service";
import { WorkflowInboxService } from "./application/workflow-inbox.service";
import { ChecklistAcknowledgementRepository } from "./infrastructure/checklist-acknowledgement.repository";
import { FeedRepository } from "./infrastructure/feed.repository";
import { PilotFeedbackRepository } from "./infrastructure/pilot-feedback.repository";
import { SnapshotReportingReadRepository } from "./infrastructure/snapshot-reporting-read.repository";
import { StoreActionPlanRepository } from "./infrastructure/store-action-plan.repository";
import { StoreOpsRepository } from "./infrastructure/store-ops.repository";
import { TargetDistributionRepository } from "./infrastructure/target-distribution.repository";
import { RequestCenterReadRepository } from "./infrastructure/request-center-read.repository";
import { StoreOpsTargetWorkspaceModule } from "./store-ops-target-workspace.module";

@Module({
  imports: [StoreOpsTargetWorkspaceModule],
  controllers: [
    TargetDistributionController,
    WorkflowInboxController,
    FeedController,
    StoreActionPlanController,
    PilotFeedbackController,
  ],
  providers: [
    TargetDistributionService,
    WorkflowInboxService,
    FeedService,
    StoreActionPlanService,
    PilotFeedbackService,
    TargetDistributionRepository,
    ChecklistAcknowledgementRepository,
    SnapshotReportingReadRepository,
    StoreActionPlanRepository,
    FeedRepository,
    PilotFeedbackRepository,
    StoreOpsRepository,
    RequestCenterReadRepository,
  ],
  exports: [
    TargetDistributionService,
    WorkflowInboxService,
    FeedService,
    StoreActionPlanService,
    PilotFeedbackService,
  ],
})
export class StoreOpsTargetsModule {}
