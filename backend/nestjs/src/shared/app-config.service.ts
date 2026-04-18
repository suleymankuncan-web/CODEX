import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

@Injectable()
export class AppConfigService {
  constructor(private readonly configService: ConfigService) {}

  get port(): number {
    return Number(this.configService.get<string>("APP_PORT", "3000"));
  }

  get appName(): string {
    return this.configService.get<string>("APP_NAME", "store-ops-backend");
  }

  get authMode(): string {
    return this.configService.get<string>("AUTH_MODE", "mock");
  }

  get databaseUrl(): string {
    return this.configService.get<string>(
      "DATABASE_URL",
      "postgres://postgres:postgres@localhost:5432/store_ops",
    );
  }

  get dbPoolMax(): number {
    return Number(this.configService.get<string>("DB_POOL_MAX", "20"));
  }

  get dbSslMode(): string {
    return this.configService.get<string>("DB_SSL_MODE", "disable");
  }

  get jwtAudience(): string {
    return this.configService.get<string>("JWT_AUDIENCE", "store-ops-api");
  }

  get jwtIssuer(): string {
    return this.configService.get<string>("JWT_ISSUER", "store-ops-auth");
  }

  get jwtSecret(): string {
    return this.configService.get<string>("JWT_SECRET", "change-me");
  }

  get jwtJwksUrl(): string | undefined {
    return this.configService.get<string>("JWT_JWKS_URL");
  }

  get queueBackend(): string {
    return this.configService.get<string>("QUEUE_BACKEND", "in-memory");
  }

  get redisUrl(): string {
    return this.configService.get<string>("REDIS_URL", "redis://localhost:6379");
  }

  get importQueueName(): string {
    return this.configService.get<string>("QUEUE_IMPORT_NAME", "store-ops-import");
  }

  get snapshotQueueName(): string {
    return this.configService.get<string>("QUEUE_SNAPSHOT_NAME", "store-ops-snapshot");
  }
}
