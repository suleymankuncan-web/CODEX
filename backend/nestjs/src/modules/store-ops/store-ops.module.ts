import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { StoreOpsChecklistModule } from "./store-ops-checklist.module";
import { StoreOpsChecklistResultPdfModule } from "./store-ops-checklist-result-pdf.module";
import { StoreOpsCompetitionModule } from "./store-ops-competition.module";
import { StoreOpsIncentiveModule } from "./store-ops-incentive.module";
import { StoreOpsReportingModule } from "./store-ops-reporting.module";
import { StoreOpsTargetsModule } from "./store-ops-targets.module";
import { StoreOpsTaskCommandReadModule } from "./store-ops-task-command-read.module";
import { StoreOpsPhotoMediaModule } from "./store-ops-photo-media.module";
import { StoreOpsStoreActionModule } from "./store-ops-store-action.module";
import { StoreOpsTargetWorkspaceModule } from "./store-ops-target-workspace.module";
import { StoreOpsVmReferenceModule } from "./store-ops-vm-reference.module";

const storeOpsInternalModules = [
  StoreOpsReportingModule,
  StoreOpsChecklistModule,
  StoreOpsTargetsModule,
  StoreOpsCompetitionModule,
  StoreOpsIncentiveModule,
];

@Module({
  imports: [
    AuthModule,
    ...storeOpsInternalModules,
    StoreOpsChecklistResultPdfModule,
    StoreOpsStoreActionModule,
    StoreOpsTargetWorkspaceModule,
    StoreOpsTaskCommandReadModule,
    StoreOpsPhotoMediaModule,
    StoreOpsVmReferenceModule,
  ],
  exports: storeOpsInternalModules,
})
export class StoreOpsModule {}
