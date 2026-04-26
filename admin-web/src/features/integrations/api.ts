import { fetchJson, sendFormData, sendJson } from '../../lib/api'

export type ImportOverview = {
  totals: {
    all: number
    completed: number
    failed: number
    completedWithErrors: number
    pending: number
    queued: number
    processing: number
  }
  healthTotals: {
    healthy: number
    inProgress: number
    blocked: number
    retryReady: number
    needsAction: number
    stuck: number
  }
  actionTotals: {
    blocked: number
    retryReady: number
    needsAction: number
    stuck: number
  }
  latest: {
    completedBatchId: string | null
    failedBatchId: string | null
    inProgressBatchId: string | null
    stuckBatchId: string | null
  }
}

export type ImportPayloadTemplate = {
  entityType: string
  sourceSystem: string
  canonicalContract?: {
    envelopeFields: string[]
    canonicalKpiRowFields: string[]
    importedMetricCodes: string[]
    derivedMetricCodes: string[]
    checklistMetricCodes: string[]
    dataQualityIssueCodes: string[]
    rules: string[]
  }
  normalizedBehavior?: string[]
  note?: string
  requestBody: Record<string, unknown>
}

export type IntegrationLookups = {
  activeSources: Array<{
    sourceId: string
    sourceCode: string
    sourceName: string
    entityType: string
    sourceSystem: string
    stateModel: string
  }>
  meta: {
    totalEntityTypes: number
    totalActiveSources: number
  }
}

export type PowerBiExportUploadResponse = {
  command: {
    status: string
    message: string
  }
  data: {
    batch: {
      batchId: string
      status: string
    }
    summary: {
      periodMonth: string
      personnelRowsRead: number
      storeRowsRead: number
      canonicalRowCount: number
      ignoredPersonnelRows: number
      ignoredStoreRows: number
      temporaryMappingMode: string
    }
  }
  job?: {
    jobType: string
    backend: string
    jobId?: string | null
    queueName?: string | null
  }
}

export type NeedsActionItem = {
  batchId: string
  integrationSourceId: string
  sourceCode: string
  sourceName: string
  entityType: string
  startedAt: string
  finishedAt: string | null
  status: string
  fileReference: string | null
  recordCount: number
  errorCount: number
  retryCount: number
  lastRetriedAt: string | null
  healthState: string
  actionReason: string
  recommendedAction: string
  blockedByEntityTypes: string[]
  recommendedNextEntityType: string | null
  canRetryNow: boolean
  isStuck: boolean
}

export type ListResponse<T> = {
  items: T[]
  meta: {
    count: number
    total: number
    limit: number
    offset: number
  }
}

export type ImportBatchDetail = {
  batch: {
    batchId: string
    integrationSourceId: string
    sourceCode: string
    sourceName: string
    entityType: string
    startedAt: string
    finishedAt: string | null
    status: string
    fileReference: string | null
    recordCount: number
    errorCount: number
    retryCount: number
    lastRetriedAt: string | null
    healthState: string
  }
  rowStatusSummary: {
    processed: number
    validationFailed: number
    retryableError: number
    pending: number
  }
  dependencySummary: {
    employee: number
    store: number
    position: number
    region: number
    company: number
    manager: number
  }
  qualityIssueSummary?: {
    totalIssueRows: number
    highSeverityRows: number
    items: Array<{
      code: string
      label: string
      owner: string
      severity: string
      description: string
      count: number
    }>
  }
  blockedByEntityTypes: string[]
  recommendedImportOrder: string[]
  recommendedNextEntityType: string | null
  canRetryNow: boolean
  healthState: string
  lineageSummary?: {
    supported: boolean
    rowHashCount: number
    rawRowReferenceCount: number
    sampleRowHash: string | null
    sampleRawRowReference: string | null
  }
}

export type ImportBatchReconciliation = {
  totals: {
    recordCount: number
    accountedRows: number
    unaccountedRows: number
    countsMatchRecordCount: boolean
  }
  rowStatusSummary: {
    processed: number
    validationFailed: number
    retryableError: number
    pending: number
  }
  rates: {
    processedRate: number
    validationFailureRate: number
    retryableErrorRate: number
    pendingRate: number
    accountedRate: number
  }
  reconciliation: {
    hasFailures: boolean
    hasPendingRows: boolean
    hasUnaccountedRows: boolean
    canRetryNow: boolean
    blockedByEntityTypes: string[]
    recommendedNextEntityType: string | null
  }
}

export type ImportBatchError = {
  rowId: string
  sourceRef: string
  rowHash?: string | null
  rawRowReference?: string | null
  normalizedStatus: string
  errorCategory: 'validation' | 'missing_dependency' | 'write_failure'
  qualityIssueCode?: string
  validationError: string | null
  processedAt: string | null
}

export type AuditEvent = {
  eventLogId: string
  occurredAt: string
  actorUserId: string | null
  correlationId: string | null
  eventType: string
  metadata: Record<string, unknown>
}

type CommandResponse<T> = {
  command: {
    status: string
    message: string
  }
  data: T
}

type CreateImportBatchBody = {
  sourceCode: string
  entityType: string
  fileReference: string
  idempotencyKey?: string
  sourceBatchId?: string
  sourcePayloadHash?: string
  sourceCapturedAt?: string
  sourceWindowStartedAt?: string
  sourceWindowEndedAt?: string
  rows?: Record<string, unknown>[]
}

export async function getImportOverview() {
  return fetchJson<ImportOverview>('/integrations/import-batches/overview')
}

export async function getIntegrationLookups() {
  return fetchJson<IntegrationLookups>('/integrations/lookups')
}

export async function getNeedsAction(input?: {
  limit?: number
  offset?: number
  entityType?: string
  status?: string
  sourceCode?: string
}) {
  const params = new URLSearchParams({
    limit: String(input?.limit ?? 12),
    offset: String(input?.offset ?? 0),
  })

  if (input?.entityType) {
    params.set('entityType', input.entityType)
  }
  if (input?.status) {
    params.set('status', input.status)
  }
  if (input?.sourceCode) {
    params.set('sourceCode', input.sourceCode)
  }

  return fetchJson<ListResponse<NeedsActionItem>>(
    `/integrations/import-batches/needs-action?${params.toString()}`,
  )
}

export async function getImportBatchDetail(batchId: string) {
  return fetchJson<ImportBatchDetail>(`/integrations/import-batches/${batchId}`)
}

export async function getImportBatchReconciliation(batchId: string) {
  return fetchJson<ImportBatchReconciliation>(
    `/integrations/import-batches/${batchId}/reconciliation`,
  )
}

export async function getImportBatchErrors(batchId: string) {
  return fetchJson<ListResponse<ImportBatchError>>(
    `/integrations/import-batches/${batchId}/errors?limit=20&offset=0`,
  )
}

export async function getImportBatchAudit(batchId: string) {
  return fetchJson<ListResponse<AuditEvent>>(
    `/integrations/import-batches/${batchId}/audit?limit=20&offset=0`,
  )
}

export async function retryImportBatch(batchId: string) {
  return sendJson<CommandResponse<{ batch: { batchId: string; status: string; retryCount: number } }>>(
    `/integrations/import-batches/${batchId}/retry`,
    { method: 'POST' },
  )
}

export async function getImportPayloadTemplate(input?: {
  entityType?: string
  sourceSystem?: string
}) {
  const params = new URLSearchParams()
  if (input?.entityType) {
    params.set('entityType', input.entityType)
  }
  if (input?.sourceSystem) {
    params.set('sourceSystem', input.sourceSystem)
  }

  const suffix = params.toString() ? `?${params.toString()}` : ''
  return fetchJson<ImportPayloadTemplate>(`/integrations/import-payload-templates${suffix}`)
}

export async function createImportBatch(input: CreateImportBatchBody) {
  return sendJson<CommandResponse<{ batch: { batchId: string; status: string } }>>(
    '/integrations/import-batches',
    {
      method: 'POST',
      body: input,
    },
  )
}

export async function uploadPowerBiExport(input: {
  sourceCode: string
  periodMonth: string
  personnelFile?: File | null
  storeFile?: File | null
}) {
  const formData = new FormData()
  formData.set('sourceCode', input.sourceCode)
  formData.set('periodMonth', input.periodMonth)

  if (input.personnelFile) {
    formData.set('personnelFile', input.personnelFile)
  }
  if (input.storeFile) {
    formData.set('storeFile', input.storeFile)
  }

  return sendFormData<PowerBiExportUploadResponse>('/integrations/power-bi-export-upload', {
    method: 'POST',
    body: formData,
  })
}
