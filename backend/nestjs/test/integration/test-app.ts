import { ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import { AppModule } from "../../src/app.module";
import { AuthContextService } from "../../src/modules/auth/auth-context.service";
import { DatabaseService } from "../../src/shared/database/database.service";
import { AppConfigService } from "../../src/shared/app-config.service";
import { BullMqJobDispatcherService } from "../../src/shared/jobs/bullmq-job-dispatcher.service";
import { JOB_DISPATCHER } from "../../src/shared/jobs/jobs.constants";
import { StandardErrorFilter } from "../../src/shared/http/standard-error.filter";
import { IntegrationService } from "../../src/modules/integration/application/integration.service";

function configureDefaultAuthMode() {
  const explicitJwtTest =
    process.env.AUTH_MODE === "jwt" && Boolean(process.env.JWT_SECRET);

  if (explicitJwtTest) {
    return;
  }

  process.env.AUTH_MODE = "mock";
  delete process.env.JWT_JWKS_URL;
}

const DEFAULT_TEST_DATABASE_CONFIG = {
  databaseTransportStatus: "disabled",
  databaseUrl: "postgres://postgres:postgres@localhost:5432/store_ops",
  dbConnectionTimeoutMs: 5_000,
  dbIdleTimeoutMs: 30_000,
  dbPoolMax: 20,
  dbQueryTimeoutMs: 65_000,
  dbSslCa: undefined,
  dbSslMode: "disable",
  dbStatementTimeoutMs: 60_000,
  photoMediaStorageConfiguration: {
    enabled: false,
    syntheticOnly: true,
    provider: "r2",
    jurisdiction: "eu",
    primaryBucket: "",
    recoveryBucket: "",
    primaryEndpoint: "",
    recoveryEndpoint: "",
    publicDeliveryEnabled: false,
    aggregateBytesHardLimit: 8 * 1024 * 1024 * 1024,
    monthlyClassAHardLimit: 750_000,
    monthlyClassBHardLimit: 7_500_000,
    signedReadTtlSeconds: 120,
    lockSafetyDays: 30,
    perUserDailyBytesHardLimit: 100 * 1024 * 1024,
    perStoreDailyBytesHardLimit: 250 * 1024 * 1024,
    concurrentProcessingHardLimit: 2,
  },
};

export async function createIntegrationApp(overrides?: {
  databaseService?: object;
  jobDispatcher?: object;
  authContextService?: object;
  appConfigService?: object;
  integrationService?: object;
  standardErrorFilter?: boolean;
}) {
  configureDefaultAuthMode();

  const testingModuleBuilder = Test.createTestingModule({
    imports: [AppModule],
  });

  if (overrides?.databaseService) {
    testingModuleBuilder
      .overrideProvider(DatabaseService)
      .useValue(overrides.databaseService);
  }

  if (overrides?.jobDispatcher) {
    testingModuleBuilder
      .overrideProvider(JOB_DISPATCHER)
      .useValue(overrides.jobDispatcher);
  }

  if (overrides?.appConfigService) {
    testingModuleBuilder
      .overrideProvider(AppConfigService)
      .useValue({
        ...DEFAULT_TEST_DATABASE_CONFIG,
        ...overrides.appConfigService,
      });
  }

  if (overrides?.integrationService) {
    testingModuleBuilder
      .overrideProvider(IntegrationService)
      .useValue(overrides.integrationService);
  }

  testingModuleBuilder.overrideProvider(BullMqJobDispatcherService).useValue({
    dispatch: jest.fn(),
  });

  if (overrides?.authContextService) {
    testingModuleBuilder
      .overrideProvider(AuthContextService)
      .useValue(overrides.authContextService);
  }

  const moduleRef = await testingModuleBuilder.compile();
  const app: INestApplication = moduleRef.createNestApplication();

  app.setGlobalPrefix("api");
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  if (overrides?.standardErrorFilter) {
    app.useGlobalFilters(new StandardErrorFilter());
  }

  await app.init();

  return app;
}
