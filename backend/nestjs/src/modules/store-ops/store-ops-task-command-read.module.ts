import { Module } from "@nestjs/common";
import { StoreOpsRegionManagerDirectoryModule } from "./store-ops-region-manager-directory.module";
import { TaskCommandWorkspaceReadService } from "./application/task-command-workspace-read.service";
import { TaskCommandWorkspaceReadRepository } from "./infrastructure/task-command-workspace-read.repository";
import { TaskCommandWorkspaceController } from "./web/task-command-workspace.controller";

@Module({
  imports: [StoreOpsRegionManagerDirectoryModule],
  controllers: [TaskCommandWorkspaceController],
  providers: [TaskCommandWorkspaceReadRepository, TaskCommandWorkspaceReadService],
})
export class StoreOpsTaskCommandReadModule {}
