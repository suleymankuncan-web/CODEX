import { Module } from "@nestjs/common";
import { WorkforceWorkspaceReadService } from "./application/workforce-workspace-read.service";
import { WorkforceWorkspaceReadRepository } from "./infrastructure/workforce-workspace-read.repository";
import { WorkforceWorkspaceController } from "./web/workforce-workspace.controller";

@Module({
  controllers: [WorkforceWorkspaceController],
  providers: [WorkforceWorkspaceReadRepository, WorkforceWorkspaceReadService],
})
export class StoreOpsWorkforceWorkspaceReadModule {}
