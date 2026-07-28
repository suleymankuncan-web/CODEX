import { Module } from "@nestjs/common";
import { FeedController } from "./web/feed.controller";
import { PilotFeedbackController } from "./web/pilot-feedback.controller";
import { TargetDistributionController } from "./web/target-distribution.controller";
import { WorkflowInboxController } from "./web/workflow-inbox.controller";
import { FeedService } from "./application/feed.service";
import { PilotFeedbackService } from "./application/pilot-feedback.service";
import { TargetDistributionService } from "./application/target-distribution.service";
import { WorkflowInboxService } from "./application/workflow-inbox.service";
import { ChecklistAcknowledgementRepository } from "./infrastructure/checklist-acknowledgement.repository";
import { FeedRepository } from "./infrastructure/feed.repository";
import { PilotFeedbackRepository } from "./infrastructure/pilot-feedback.repository";
import { SnapshotReportingReadRepository } from "./infrastructure/snapshot-reporting-read.repository";
import { StoreOpsRepository } from "./infrastructure/store-ops.repository";
import { TargetDistributionRepository } from "./infrastructure/target-distribution.repository";
import { RequestCenterReadRepository } from "./infrastructure/request-center-read.repository";
import { StoreOpsStoreActionModule } from "./store-ops-store-action.module";

@Module({
  imports: [StoreOpsStoreActionModule],
  controllers: [
    TargetDistributionController,
    WorkflowInboxController,
    FeedController,
    PilotFeedbackController,
  ],
  providers: [
    TargetDistributionService,
    WorkflowInboxService,
    FeedService,
    PilotFeedbackService,
    TargetDistributionRepository,
    ChecklistAcknowledgementRepository,
    SnapshotReportingReadRepository,
    FeedRepository,
    PilotFeedbackRepository,
    StoreOpsRepository,
    RequestCenterReadRepository,
  ],
  exports: [
    TargetDistributionService,
    WorkflowInboxService,
    FeedService,
    PilotFeedbackService,
  ],
})
export class StoreOpsTargetsModule {}
