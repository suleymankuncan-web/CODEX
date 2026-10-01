import { Module } from '@nestjs/common';
import { StoreOpsRankingCacheModule } from './store-ops-ranking-cache.module';
import { StoreOpsReturnsReadModule } from './store-ops-returns-read.module';

/** Ranking reuses the existing cache and prim V2 read owners, without duplicating providers. */
@Module({
  imports: [StoreOpsRankingCacheModule, StoreOpsReturnsReadModule],
  exports: [StoreOpsRankingCacheModule, StoreOpsReturnsReadModule],
})
export class StoreOpsRankingReadDependenciesModule {}
