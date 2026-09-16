import { Module } from "@nestjs/common";
import { RankingFactsCache } from "./infrastructure/ranking-facts-cache";

// Kept local to ranking reads: unrelated ReportingRepository consumers stay uncached.
@Module({ providers: [RankingFactsCache], exports: [RankingFactsCache] })
export class StoreOpsRankingCacheModule {}
