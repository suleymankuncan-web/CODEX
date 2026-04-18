import { Logger } from "@nestjs/common";
import { RequestContextStore } from "./request-context";

type StructuredLogFields = {
  actorUserId?: string | null;
  batchId?: string | null;
  jobId?: string | null;
  snapshotRunId?: string | null;
  [key: string]: unknown;
};

export function logStructuredMessage(
  logger: Logger,
  event: string,
  fields: StructuredLogFields = {},
): void {
  logger.log(
    JSON.stringify({
      event,
      correlationId: RequestContextStore.getCorrelationId(),
      actorUserId: RequestContextStore.get()?.actorUserId ?? null,
      batchId: null,
      jobId: null,
      snapshotRunId: null,
      ...fields,
    }),
  );
}

export function logStructuredError(
  logger: Logger,
  event: string,
  error: unknown,
  fields: StructuredLogFields = {},
): void {
  const message = error instanceof Error ? error.message : String(error);

  logger.error(
    JSON.stringify({
      event,
      correlationId: RequestContextStore.getCorrelationId(),
      actorUserId: RequestContextStore.get()?.actorUserId ?? null,
      batchId: null,
      jobId: null,
      snapshotRunId: null,
      errorMessage: message,
      ...fields,
    }),
  );
}
