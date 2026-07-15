import { Module } from "@nestjs/common";
import { TargetWorkspaceReadService } from "./application/target-workspace-read.service";
import { TargetWorkspaceReadRepository } from "./infrastructure/target-workspace-read.repository";
import { TargetWorkspaceController } from "./web/target-workspace.controller";

@Module({
  controllers: [TargetWorkspaceController],
  providers: [TargetWorkspaceReadRepository, TargetWorkspaceReadService],
})
export class StoreOpsTargetWorkspaceModule {}
