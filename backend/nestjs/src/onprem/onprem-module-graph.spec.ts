import { Test } from "@nestjs/testing";
import { AppConfigService } from "../shared/app-config.service";
import { PG_POOL } from "../shared/database/database.constants";
import { KeycloakIdentityBinderModule } from "./keycloak-identity-binder.module";
import { OnPremMigrationModule } from "./migration.module";
import { SyntheticSeedModule } from "./synthetic-seed.module";
import { WorkerHealthModule } from "./worker-health.module";

describe("on-prem runtime module graphs", () => {
  it.each([
    ["migration", OnPremMigrationModule],
    ["synthetic seed", SyntheticSeedModule],
    ["Keycloak identity binder", KeycloakIdentityBinderModule],
    ["worker health", WorkerHealthModule],
  ])("compiles the real %s graph with external resources mocked", async (_name, moduleType) => {
    const moduleRef = await Test.createTestingModule({ imports: [moduleType] })
      .overrideProvider(AppConfigService)
      .useValue({})
      .overrideProvider(PG_POOL)
      .useValue({ connect: jest.fn(), end: jest.fn(), query: jest.fn() })
      .compile();

    await moduleRef.close();
  });
});
