import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { StoreOpsChecklistModule } from "./store-ops-checklist.module";
import { StoreOpsCompetitionModule } from "./store-ops-competition.module";
import { StoreOpsReportingModule } from "./store-ops-reporting.module";
import { StoreOpsTargetsModule } from "./store-ops-targets.module";

const storeOpsInternalModules = [
  StoreOpsReportingModule,
  StoreOpsChecklistModule,
  StoreOpsTargetsModule,
  StoreOpsCompetitionModule,
];

@Module({
  imports: [AuthModule, ...storeOpsInternalModules],
  exports: storeOpsInternalModules,
})
export class StoreOpsModule {}
