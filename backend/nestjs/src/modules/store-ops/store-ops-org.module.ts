import { Module } from "@nestjs/common";
import { OrgService } from "./application/org.service";
import { StoreOpsRepository } from "./infrastructure/store-ops.repository";
import { OrgController } from "./web/org.controller";

@Module({
  controllers: [OrgController],
  providers: [OrgService, StoreOpsRepository],
  exports: [OrgService],
})
export class StoreOpsOrgModule {}
