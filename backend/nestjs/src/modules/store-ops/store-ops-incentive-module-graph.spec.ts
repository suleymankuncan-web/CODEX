import { Test } from "@nestjs/testing";
import { AppConfigModule } from "../../shared/app-config.module";
import { AppConfigService } from "../../shared/app-config.service";
import { PG_POOL } from "../../shared/database/database.constants";
import { DatabaseModule } from "../../shared/database/database.module";
import { StoreOpsIncentiveModule } from "./store-ops-incentive.module";

describe("incentive module graph", () => {
  it("resolves manager-package and HR handoff dependencies", async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppConfigModule, DatabaseModule, StoreOpsIncentiveModule],
    })
      .overrideProvider(AppConfigService)
      .useValue({ queueBackend: "memory" })
      .overrideProvider(PG_POOL)
      .useValue({ connect: jest.fn(), end: jest.fn(), query: jest.fn() })
      .compile();

    await moduleRef.close();
  });
});
