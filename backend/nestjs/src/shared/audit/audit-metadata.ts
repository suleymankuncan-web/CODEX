export function buildAuditMetadata(input: {
  reason?: string | null;
  correlationId?: string | null;
  sourceContext: {
    module: string;
    operation: string;
  };
  changedFields?: string[];
  details?: Record<string, unknown>;
}) {
  return {
    reason: input.reason ?? null,
    correlationId: input.correlationId ?? null,
    sourceContext: input.sourceContext,
    changedFields: input.changedFields ?? [],
    details: input.details ?? {},
  };
}
