import { Module } from "@nestjs/common";
import { OnPremDatabaseModule } from "./onprem-database.module";
import { SyntheticSeedService } from "./synthetic-seed.service";

@Module({
  imports: [OnPremDatabaseModule],
  providers: [SyntheticSeedService],
  exports: [SyntheticSeedService],
})
export class SyntheticSeedModule {}
