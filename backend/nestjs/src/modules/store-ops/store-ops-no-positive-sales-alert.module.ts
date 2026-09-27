import { Module } from "@nestjs/common";
import { NoPositiveSalesAlertService } from "./application/no-positive-sales-alert.service";
import { NoPositiveSalesAlertMailer } from "./infrastructure/no-positive-sales-alert.mailer";
import { NoPositiveSalesAlertRepository } from "./infrastructure/no-positive-sales-alert.repository";

@Module({
  providers: [NoPositiveSalesAlertService, NoPositiveSalesAlertMailer, NoPositiveSalesAlertRepository],
})
export class StoreOpsNoPositiveSalesAlertModule {}
