export type ImportBatchReadModelRow = {
  import_batch_id: string;
  integration_source_id: string;
  source_code: string;
  source_name: string;
  entity_type: string;
  source_batch_id: string | null;
  source_payload_hash: string | null;
  source_captured_at: string | null;
  source_window_started_at: string | null;
  source_window_ended_at: string | null;
  started_at: string;
  finished_at: string | null;
  status: string;
  raw_file_name: string | null;
  record_count: number;
  error_count: number;
  retry_count: number;
  last_retried_at: string | null;
};

export type ImportBatchNeedsActionRow = ImportBatchReadModelRow & {
  health_state: string;
  action_reason: string;
  recommended_action: string;
  is_stuck: boolean;
};

export function mapImportBatchReadModel(batch: ImportBatchReadModelRow) {
  return {
    batchId: batch.import_batch_id,
    integrationSourceId: batch.integration_source_id,
    sourceCode: batch.source_code,
    sourceName: batch.source_name,
    entityType: batch.entity_type,
    sourceBatchId: batch.source_batch_id,
    sourcePayloadHash: batch.source_payload_hash,
    sourceCapturedAt: batch.source_captured_at,
    sourceWindowStartedAt: batch.source_window_started_at,
    sourceWindowEndedAt: batch.source_window_ended_at,
    startedAt: batch.started_at,
    finishedAt: batch.finished_at,
    status: batch.status,
    fileReference: batch.raw_file_name,
    recordCount: batch.record_count,
    errorCount: batch.error_count,
    retryCount: batch.retry_count,
    lastRetriedAt: batch.last_retried_at,
  };
}

export function mapImportBatchListItem(
  batch: ImportBatchReadModelRow,
  healthState: string,
) {
  return {
    ...mapImportBatchReadModel(batch),
    healthState,
  };
}

export function mapImportBatchNeedsActionItem(
  batch: ImportBatchNeedsActionRow,
  blockedByEntityTypes: string[],
) {
  return {
    ...mapImportBatchReadModel(batch),
    healthState: batch.health_state,
    actionReason: batch.action_reason,
    recommendedAction: batch.recommended_action,
    blockedByEntityTypes,
    recommendedNextEntityType: blockedByEntityTypes[0] ?? null,
    canRetryNow: batch.health_state === "retry_ready",
    isStuck: batch.is_stuck,
  };
}

export function mapImportBatchDetailBatch(
  batch: ImportBatchReadModelRow,
  healthState: string,
) {
  return {
    ...mapImportBatchReadModel(batch),
    healthState,
  };
}
