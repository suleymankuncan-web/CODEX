import { Module } from "@nestjs/common";
import { WorkforceWorkspaceReadService } from "./application/workforce-workspace-read.service";
import { WorkforceWorkspaceReadRepository } from "./infrastructure/workforce-workspace-read.repository";
import { WorkforceWorkspaceController } from "./web/workforce-workspace.controller";
import { StoreOpsRegionManagerDirectoryModule } from "./store-ops-region-manager-directory.module";

@Module({
  imports: [StoreOpsRegionManagerDirectoryModule],
  controllers: [WorkforceWorkspaceController],
  providers: [WorkforceWorkspaceReadRepository, WorkforceWorkspaceReadService],
})
export class StoreOpsWorkforceWorkspaceReadModule {}
