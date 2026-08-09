import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import type { INestApplicationContext } from "@nestjs/common";
import { SyntheticQueueProbeModule } from "./synthetic-queue-probe.module";
import { SyntheticQueueProbeService } from "./synthetic-queue-probe.service";

const ALLOWED_MODES = new Set(["enqueue", "process", "status"]);

async function bootstrap(): Promise<void> {
  const mode = process.argv[2];
  if (!mode || !ALLOWED_MODES.has(mode)) {
    process.stderr.write(
      `${JSON.stringify({ event: "onprem.synthetic_queue_probe.invalid_mode" })}\n`,
    );
    process.exitCode = 2;
    return;
  }

  let context: INestApplicationContext | undefined;
  try {
    context = await NestFactory.createApplicationContext(
      SyntheticQueueProbeModule,
      { logger: false },
    );
    const result = await context
      .get(SyntheticQueueProbeService)
      .run(mode as "enqueue" | "process" | "status");
    process.stdout.write(
      `${JSON.stringify({ event: "onprem.synthetic_queue_probe.completed", ...result })}\n`,
    );
  } catch {
    process.stderr.write(
      `${JSON.stringify({ event: "onprem.synthetic_queue_probe.failed" })}\n`,
    );
    process.exitCode = 1;
  } finally {
    await context?.close();
  }
}

void bootstrap();
