import { Module } from "@nestjs/common";
import { WorkforceService } from "./application/workforce.service";
import { StoreOpsRepository } from "./infrastructure/store-ops.repository";
import { WorkforceRequestRepository } from "./infrastructure/workforce-request.repository";
import { WorkforceController } from "./web/workforce.controller";

@Module({
  controllers: [WorkforceController],
  providers: [
    WorkforceService,
    StoreOpsRepository,
    WorkforceRequestRepository,
  ],
  exports: [WorkforceService],
})
export class StoreOpsWorkforceModule {}
