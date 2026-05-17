import { MiddlewareConsumer, Module, NestModule } from "@nestjs/common";
import { StoreOpsModule } from "./modules/store-ops/store-ops.module";
import { AuthModule } from "./modules/auth/auth.module";
import { IntegrationModule } from "./modules/integration/integration.module";
import { SnapshotModule } from "./modules/snapshot/snapshot.module";
import { AppConfigModule } from "./shared/app-config.module";
import { HealthController } from "./shared/health.controller";
import { HealthService } from "./shared/health.service";
import { DatabaseModule } from "./shared/database/database.module";
import { RequestContextMiddleware } from "./shared/request-context.middleware";
import { ObservabilityModule } from "./shared/observability/observability.module";

@Module({
  imports: [
    AppConfigModule,
    DatabaseModule,
    ObservabilityModule,
    AuthModule,
    StoreOpsModule,
    IntegrationModule,
    SnapshotModule,
  ],
  controllers: [HealthController],
  providers: [HealthService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestContextMiddleware).forRoutes("*");
  }
}
