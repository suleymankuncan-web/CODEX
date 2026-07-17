import { Module } from "@nestjs/common";
import { TaskCommandWorkspaceReadService } from "./application/task-command-workspace-read.service";
import { TaskCommandWorkspaceReadRepository } from "./infrastructure/task-command-workspace-read.repository";
import { TaskCommandWorkspaceController } from "./web/task-command-workspace.controller";

@Module({
  controllers: [TaskCommandWorkspaceController],
  providers: [TaskCommandWorkspaceReadRepository, TaskCommandWorkspaceReadService],
})
export class StoreOpsTaskCommandReadModule {}
