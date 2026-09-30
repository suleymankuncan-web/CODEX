import { Module } from "@nestjs/common";
import { StoreReturnsReadService } from "./application/store-returns-read.service";
import { StoreReturnsReadRepository } from "./infrastructure/store-returns-read.repository";
import { StorePositiveSellersReadRepository } from "./infrastructure/store-positive-sellers-read.repository";
import { StoreReturnsController } from "./web/store-returns.controller";

@Module({
  controllers: [StoreReturnsController],
  providers: [StoreReturnsReadRepository, StorePositiveSellersReadRepository, StoreReturnsReadService],
  exports: [StorePositiveSellersReadRepository],
})
export class StoreOpsReturnsReadModule {}
