import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import type { INestApplicationContext } from "@nestjs/common";
import { SyntheticQueueProbeModule } from "./synthetic-queue-probe.module";
import {
  getSyntheticQueueProbeFailureDetails,
  getSyntheticQueueProbeFailureReason,
  type ProbeMode,
  type SyntheticQueueProbeFailureReason,
  sanitizeSyntheticQueueProbeFailureDetails,
  SyntheticQueueProbeService,
} from "./synthetic-queue-probe.service";

const ALLOWED_MODES = new Set<ProbeMode>([
  "enqueue",
  "process",
  "snapshot",
  "status",
]);
const UNKNOWN_MODE = "unknown" as const;
const FAILED_EVENT = "onprem.synthetic_queue_probe.failed" as const;
const INVALID_MODE_EVENT = "onprem.synthetic_queue_probe.invalid_mode" as const;

export type SyntheticQueueProbeFailureDiagnostic = {
  event: string;
  mode: ProbeMode | typeof UNKNOWN_MODE;
  reason: SyntheticQueueProbeFailureReason;
  preflightState?: string;
  timeoutState?: string;
  preflightMarker?: string;
  timeoutMarker?: string;
};

export function formatFailureDiagnostic(
  requestedMode: string | undefined,
  reason: SyntheticQueueProbeFailureReason,
  event: string = FAILED_EVENT,
  details: ReturnType<typeof getSyntheticQueueProbeFailureDetails> = {},
): SyntheticQueueProbeFailureDiagnostic {
  return {
    event: event === INVALID_MODE_EVENT ? INVALID_MODE_EVENT : FAILED_EVENT,
    mode: parseMode(requestedMode) ?? UNKNOWN_MODE,
    reason,
    ...sanitizeSyntheticQueueProbeFailureDetails(details),
  };
}

function parseMode(value: string | undefined): ProbeMode | undefined {
  return value && ALLOWED_MODES.has(value as ProbeMode)
    ? (value as ProbeMode)
    : undefined;
}

export async function bootstrap(): Promise<void> {
  const requestedMode = process.argv[2];
  const mode = parseMode(requestedMode);
  if (!mode) {
    process.stderr.write(
      `${JSON.stringify(
        formatFailureDiagnostic(requestedMode, "unexpected", INVALID_MODE_EVENT),
      )}\n`,
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
    const result = await context.get(SyntheticQueueProbeService).run(mode);
    process.stdout.write(
      `${JSON.stringify({ event: "onprem.synthetic_queue_probe.completed", ...result })}\n`,
    );
  } catch (error) {
    process.stderr.write(
      `${JSON.stringify(
        formatFailureDiagnostic(
          mode,
          getSyntheticQueueProbeFailureReason(error),
          FAILED_EVENT,
          getSyntheticQueueProbeFailureDetails(error),
        ),
      )}\n`,
    );
    process.exitCode = 1;
  } finally {
    await context?.close();
  }
}

if (require.main === module) {
  void bootstrap();
}
