import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import type { INestApplicationContext } from "@nestjs/common";
import { RuntimeReadinessService } from "./runtime-readiness.service";
import { WorkerHealthModule } from "./worker-health.module";

async function bootstrap(): Promise<void> {
  let context: INestApplicationContext | undefined;

  try {
    context = await NestFactory.createApplicationContext(WorkerHealthModule, {
      logger: false,
    });
    const result = await context.get(RuntimeReadinessService).assertReady("health");
    process.stdout.write(
      `${JSON.stringify({ event: "onprem.worker_health.ready", ...result })}\n`,
    );
  } catch {
    process.stderr.write(
      `${JSON.stringify({ event: "onprem.worker_health.not_ready" })}\n`,
    );
    process.exitCode = 1;
  } finally {
    await context?.close();
  }
}

void bootstrap();
