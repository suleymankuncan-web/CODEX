import { Module } from "@nestjs/common";
import { OrgController } from "./web/org.controller";
import { WorkforceController } from "./web/workforce.controller";
import { ChecklistController } from "./web/checklist.controller";
import { SnapshotController } from "./web/snapshot.controller";
import { ReportingController } from "./web/reporting.controller";
import { OrgService } from "./application/org.service";
import { WorkforceService } from "./application/workforce.service";
import { ChecklistService } from "./application/checklist.service";
import { SnapshotService } from "./application/snapshot.service";
import { ReportingService } from "./application/reporting.service";
import { StoreOpsRepository } from "./infrastructure/store-ops.repository";
import { ReportingRepository } from "./infrastructure/reporting.repository";
import { SnapshotOperationsRepository } from "./infrastructure/snapshot-operations.repository";

@Module({
  controllers: [
    OrgController,
    WorkforceController,
    ChecklistController,
    SnapshotController,
    ReportingController,
  ],
  providers: [
    OrgService,
    WorkforceService,
    ChecklistService,
    SnapshotService,
    ReportingService,
    StoreOpsRepository,
    ReportingRepository,
    SnapshotOperationsRepository,
  ],
  exports: [
    OrgService,
    WorkforceService,
    ChecklistService,
    SnapshotService,
    ReportingService,
    StoreOpsRepository,
    ReportingRepository,
    SnapshotOperationsRepository,
  ],
})
export class StoreOpsModule {}
