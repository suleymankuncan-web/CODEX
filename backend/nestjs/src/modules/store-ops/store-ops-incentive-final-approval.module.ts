import { Module } from "@nestjs/common";
import { StoreOpsIncentiveAdminPackageWorkflowModule } from "./store-ops-incentive-admin-package-workflow.module";
import { IncentiveFinalApprovalController } from "./web/incentive-final-approval.controller";
import { IncentiveHrHandoffController } from "./web/incentive-hr-handoff.controller";
import { IncentiveHrHandoffService } from "./application/incentive-hr-handoff.service";
import { IncentiveHrHandoffRepository } from "./infrastructure/incentive-hr-handoff.repository";
import { IncentiveHrMailer } from "./infrastructure/incentive-hr-mailer";

@Module({
  imports: [StoreOpsIncentiveAdminPackageWorkflowModule],
  controllers: [IncentiveFinalApprovalController, IncentiveHrHandoffController],
  providers: [IncentiveHrHandoffService, IncentiveHrHandoffRepository, IncentiveHrMailer],
})
export class StoreOpsIncentiveFinalApprovalModule {}
