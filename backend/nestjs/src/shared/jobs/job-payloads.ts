export interface ImportBatchJobPayload {
  batchId: string;
}

export interface SnapshotRunJobPayload {
  snapshotRunId: string;
  periodStart: string;
  periodEnd: string;
}

export interface VisualComparisonShadowJobPayload {
  comparisonRunId: string;
}
