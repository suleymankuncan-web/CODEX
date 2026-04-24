import { ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import { AppModule } from "../../src/app.module";
import { AuthContextService } from "../../src/modules/auth/auth-context.service";
import { DatabaseService } from "../../src/shared/database/database.service";
import { AppConfigService } from "../../src/shared/app-config.service";
import { BullMqJobDispatcherService } from "../../src/shared/jobs/bullmq-job-dispatcher.service";
import { JOB_DISPATCHER } from "../../src/shared/jobs/jobs.constants";

function configureDefaultAuthMode() {
  const explicitJwtTest =
    process.env.AUTH_MODE === "jwt" && Boolean(process.env.JWT_SECRET);

  if (explicitJwtTest) {
    return;
  }

  process.env.AUTH_MODE = "mock";
  delete process.env.JWT_JWKS_URL;
}

export async function createIntegrationApp(overrides?: {
  databaseService?: object;
  jobDispatcher?: object;
  authContextService?: object;
  appConfigService?: object;
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
      .useValue(overrides.appConfigService);
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

  await app.init();

  return app;
}
