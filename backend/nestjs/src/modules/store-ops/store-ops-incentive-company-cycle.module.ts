import { Module } from "@nestjs/common";
import { IncentiveCompanyCycleService } from "./application/incentive-company-cycle.service";
import { IncentiveCompanyCycleRepository } from "./infrastructure/incentive-company-cycle.repository";
import { IncentiveCompanyCycleController } from "./web/incentive-company-cycle.controller";

@Module({ controllers: [IncentiveCompanyCycleController], providers: [IncentiveCompanyCycleService, IncentiveCompanyCycleRepository] })
export class StoreOpsIncentiveCompanyCycleModule {}
