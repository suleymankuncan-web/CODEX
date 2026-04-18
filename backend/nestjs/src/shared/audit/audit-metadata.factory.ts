import { RequestContextStore } from "../request-context";
import { buildAuditMetadata } from "./audit-metadata";

export function buildRequestAuditMetadata(input: {
  reason?: string | null;
  sourceContext: {
    module: string;
    operation: string;
  };
  changedFields?: string[];
  details?: Record<string, unknown>;
}) {
  return buildAuditMetadata({
    ...input,
    correlationId: RequestContextStore.getCorrelationId(),
  });
}
