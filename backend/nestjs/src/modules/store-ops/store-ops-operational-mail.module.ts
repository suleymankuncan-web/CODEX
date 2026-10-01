import { Module } from "@nestjs/common";
import { OperationalMailService } from "./application/operational-mail.service";
import { OperationalMailScheduler } from "./infrastructure/operational-mail-scheduler.repository";
import { OperationalMailRepository } from "./infrastructure/operational-mail.repository";
import { OperationalMailSource } from "./infrastructure/operational-mail-source";
import { OperationalMailer } from "./infrastructure/operational-mailer";
import { StoreOpsReportWorkbookModule } from "./store-ops-report-workbook.module";

@Module({imports:[StoreOpsReportWorkbookModule],providers:[OperationalMailService,OperationalMailScheduler,OperationalMailRepository,OperationalMailSource,OperationalMailer]})
export class StoreOpsOperationalMailModule {}
