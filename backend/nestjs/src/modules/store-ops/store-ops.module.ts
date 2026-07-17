import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { StoreOpsChecklistModule } from "./store-ops-checklist.module";
import { StoreOpsCompetitionModule } from "./store-ops-competition.module";
import { StoreOpsIncentiveModule } from "./store-ops-incentive.module";
import { StoreOpsReportingModule } from "./store-ops-reporting.module";
import { StoreOpsTargetsModule } from "./store-ops-targets.module";
import { StoreOpsTaskCommandReadModule } from "./store-ops-task-command-read.module";

const storeOpsInternalModules = [
  StoreOpsReportingModule,
  StoreOpsChecklistModule,
  StoreOpsTargetsModule,
  StoreOpsCompetitionModule,
  StoreOpsIncentiveModule,
  StoreOpsTaskCommandReadModule,
];

@Module({
  imports: [AuthModule, ...storeOpsInternalModules],
  exports: storeOpsInternalModules,
})
export class StoreOpsModule {}
