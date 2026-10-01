import { Module } from "@nestjs/common";
import { IncentiveApprovalMailService } from "./application/incentive-approval-mail.service";
import { IncentiveApprovalMailRepository } from "./infrastructure/incentive-approval-mail.repository";
import { IncentiveHrHandoffRepository } from "./infrastructure/incentive-hr-handoff.repository";
import { IncentiveHrMailer } from "./infrastructure/incentive-hr-mailer";

@Module({providers:[IncentiveApprovalMailService,IncentiveApprovalMailRepository,IncentiveHrHandoffRepository,IncentiveHrMailer]})
export class StoreOpsIncentiveApprovalMailModule {}
