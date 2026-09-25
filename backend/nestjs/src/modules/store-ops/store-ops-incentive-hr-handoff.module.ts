import { Module } from "@nestjs/common";
import { IncentiveHrHandoffService } from "./application/incentive-hr-handoff.service";
import { IncentiveHrHandoffRepository } from "./infrastructure/incentive-hr-handoff.repository";
import { IncentiveHrMailer } from "./infrastructure/incentive-hr-mailer";
import { IncentiveHrHandoffController } from "./web/incentive-hr-handoff.controller";

@Module({
  controllers: [IncentiveHrHandoffController],
  providers: [IncentiveHrHandoffService, IncentiveHrHandoffRepository, IncentiveHrMailer],
})
export class StoreOpsIncentiveHrHandoffModule {}
