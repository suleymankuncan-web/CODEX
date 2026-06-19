import { Module } from "@nestjs/common";
import { SalesTargetIncentiveCalculatorService } from "./application/sales-target-incentive-calculator.service";
import { SalesTargetIncentiveReadModelService } from "./application/sales-target-incentive-read-model.service";
import { SalesTargetIncentiveReadRepository } from "./infrastructure/sales-target-incentive-read.repository";

@Module({
  providers: [
    SalesTargetIncentiveReadModelService,
    SalesTargetIncentiveCalculatorService,
    SalesTargetIncentiveReadRepository,
  ],
  exports: [SalesTargetIncentiveReadModelService],
})
export class StoreOpsIncentiveProjectionModule {}
