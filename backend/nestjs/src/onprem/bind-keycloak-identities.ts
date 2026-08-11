import "reflect-metadata";
import { Logger } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { KeycloakIdentityBinderModule } from "./keycloak-identity-binder.module";
import { KeycloakIdentityBinderService } from "./keycloak-identity-binder.service";

async function bootstrap(): Promise<void> {
  const logger = new Logger("KeycloakIdentityBinderCli");
  const context = await NestFactory.createApplicationContext(
    KeycloakIdentityBinderModule,
    { logger: ["error", "warn", "log"] },
  );

  try {
    const result = await context.get(KeycloakIdentityBinderService).run();
    logger.log(
      JSON.stringify({ event: "onprem.keycloak_identity_binding.completed", ...result }),
    );
  } catch {
    logger.error(JSON.stringify({ event: "onprem.keycloak_identity_binding.failed" }));
    process.exitCode = 1;
  } finally {
    await context.close();
  }
}

void bootstrap();
