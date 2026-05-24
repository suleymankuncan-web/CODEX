import { Injectable } from "@nestjs/common";
import IORedis from "ioredis";
import { AppConfigService } from "./app-config.service";
import { DatabaseService } from "./database/database.service";
import { ObservabilityService } from "./observability/observability.service";

type DependencyCheck = {
  status: "ok" | "error" | "skipped";
  latencyMs: number;
  message?: string;
};

type QueueHealth = {
  backend: "in-memory" | "bullmq";
  durable: boolean;
  redisRequired: boolean;
  status: "process-local" | "durable" | "error";
  message: string;
};

@Injectable()
export class HealthService {
  constructor(
    private readonly appConfigService: AppConfigService,
    private readonly databaseService: DatabaseService,
    private readonly observabilityService: ObservabilityService,
  ) {}

  getLiveHealth() {
    return {
      status: "ok",
      service: this.appConfigService.appName,
    };
  }

  async getHealth() {
    const [database, redis] = await Promise.all([
      this.checkDatabase(),
      this.checkRedis(),
    ]);

    const failedChecks = [database, redis].filter((check) => check.status === "error");

    return {
      status: failedChecks.length === 0 ? "ok" : "error",
      service: this.appConfigService.appName,
      timestamp: new Date().toISOString(),
      queueBackend: this.appConfigService.queueBackend,
      queue: this.buildQueueHealth(redis),
      observability: this.observabilityService.getStatus(),
      checks: {
        database,
        redis,
      },
    };
  }

  private async checkDatabase(): Promise<DependencyCheck> {
    const startedAt = Date.now();

    try {
      await this.databaseService.query("SELECT 1");
      return {
        status: "ok",
        latencyMs: Date.now() - startedAt,
      };
    } catch (error) {
      return {
        status: "error",
        latencyMs: Date.now() - startedAt,
        message: sanitizeDependencyErrorMessage(error),
      };
    }
  }

  private async checkRedis(): Promise<DependencyCheck> {
    const queueRequiresRedis = this.appConfigService.queueBackend === "bullmq";
    const rateLimitRequiresRedis = this.appConfigService.rateLimitBackend === "redis";

    if (!queueRequiresRedis && !rateLimitRequiresRedis) {
      return {
        status: "skipped",
        latencyMs: 0,
        message:
          "Redis health check skipped because queue backend is not bullmq and rate limit backend is not redis",
      };
    }

    const startedAt = Date.now();
    const connection = new IORedis(this.appConfigService.redisUrl, {
      maxRetriesPerRequest: 1,
      enableReadyCheck: false,
      lazyConnect: true,
    });

    try {
      await connection.connect();
      const pong = await connection.ping();

      if (pong !== "PONG") {
        throw new Error(`Unexpected Redis ping response: ${pong}`);
      }

      return {
        status: "ok",
        latencyMs: Date.now() - startedAt,
      };
    } catch (error) {
      return {
        status: "error",
        latencyMs: Date.now() - startedAt,
        message: sanitizeDependencyErrorMessage(error),
      };
    } finally {
      if (connection.status !== "end") {
        try {
          await connection.quit();
        } catch {
          // Cleanup failure must not mask the actual dependency health result.
        }
      }
    }
  }

  private buildQueueHealth(redis: DependencyCheck): QueueHealth {
    const backend = this.appConfigService.queueBackend;

    if (backend !== "bullmq") {
      return {
        backend,
        durable: false,
        redisRequired: false,
        status: "process-local",
        message:
          "In-memory queue is process-local; acceptable for local or controlled pilot only.",
      };
    }

    if (redis.status === "ok") {
      return {
        backend,
        durable: true,
        redisRequired: true,
        status: "durable",
        message: "BullMQ queue is using Redis-backed durable dispatch.",
      };
    }

    return {
      backend,
      durable: true,
      redisRequired: true,
      status: "error",
      message: "BullMQ queue requires Redis health to be ok.",
    };
  }
}

function sanitizeDependencyErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message
    .replace(/\b(?:postgres(?:ql)?|rediss?):\/\/[^\s"'<>]+/gi, "[redacted-url]")
    .replace(/\b([a-z0-9-]+\.)+[a-z]{2,}(?::\d+)?\b/gi, "[redacted-host]")
    .replace(/\b(?:\d{1,3}\.){3}\d{1,3}(?::\d+)?\b/g, "[redacted-host]")
    .replace(/\b(password|pwd)=([^;\s]+)/gi, "$1=[redacted]");
}
