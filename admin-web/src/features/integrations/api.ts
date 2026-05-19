import { fetchJson, sendFormData, sendJson } from '../../lib/api'
import { fetchOpenApiJson, type ApiGetResponse } from '../../lib/openapi-client'

export type ImportOverview = ApiGetResponse<'/api/integrations/import-batches/overview'>

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
      periodMonth: string | null
      periodType: 'daily' | 'weekly' | 'monthly' | 'custom'
      periodStart: string
      periodEnd: string
      personnelRowsRead: number
      storeRowsRead: number
      canonicalRowCount: number
      personnelGrossSalesRows: number
      negativePersonnelRowsIgnored: number
      ignoredPersonnelRows: number
      ignoredStoreRows: number
      scopeExcludedPersonnelRows: number
      scopeExcludedStoreRows: number
      reconciliation: {
        comparedStoreCount: number
        balancedStoreCount: number
        warningStoreCount: number
        items: Array<{
          storeExternalRef: string
          storeNetSales: number
          personnelPositiveSales: number
          personnelNegativeMovements: number
          personnelNetMovement: number
          reconciliationDelta: number
          status: 'balanced' | 'warning'
        }>
      }
      mappingMode: string
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
  mappingCandidate?: {
    integrationSourceId: string
    entityType: 'employee' | 'store'
    externalId: string
    internalTableName: string
  }
  validationError: string | null
  processedAt: string | null
}

export type ExternalIdMapCandidate = {
  entityType: 'employee' | 'store'
  internalId: string
  label: string
  secondaryLabel: string
  internalTableName: string
}

export type StoreMasterItem = {
  storeId: string
  storeCode: string
  storeName: string
  storeType: 'company' | 'franchise' | 'operator' | string
  status: 'active' | 'inactive' | 'closed' | string
  kpiImportEnabled: boolean
  regionId: string | null
  regionName: string | null
}

export type StoreMasterLookups = {
  storeTypes: Array<{ value: 'company' | 'franchise' | 'operator'; label: string }>
  statuses: Array<{ value: 'active' | 'inactive' | 'closed'; label: string }>
  regions: Array<{
    regionId: string
    regionCode: string
    regionName: string
  }>
}

export type PersonnelMasterItem = {
  employeeId: string
  externalEmployeeRef: string | null
  firstName: string
  lastName: string
  displayName: string
  hireDate: string
  terminationDate: string | null
  employmentStatus: 'active' | 'inactive' | 'terminated' | string
  employmentType: 'full_time' | 'part_time' | 'temporary' | string
  assignmentId: string | null
  assignmentStartDate: string | null
  storeId: string | null
  storeCode: string | null
  storeName: string | null
  regionId: string | null
  regionName: string | null
  positionId: string | null
  positionCode: string | null
  positionName: string | null
}

export type PersonnelMasterLookups = {
  stores: Array<{
    storeId: string
    storeCode: string
    storeName: string
    regionId: string
    regionName: string
  }>
  positions: Array<{
    positionId: string
    positionCode: string
    positionName: string
    isManagerial: boolean
  }>
  employmentStatuses: Array<{ value: 'active' | 'inactive' | 'terminated'; label: string }>
  employmentTypes: Array<{ value: 'full_time' | 'part_time' | 'temporary'; label: string }>
}

export type MasterDataBootstrapEntity = 'store' | 'personnel'

type MasterDataBootstrapBatchStatus =
  | 'uploaded'
  | 'validated'
  | 'ready_to_promote'
  | 'promoted'
  | 'rejected'

export type MasterDataBootstrapReadiness =
  | 'needs_validation'
  | 'needs_review'
  | 'ready_to_promote'
  | 'closed'

type MasterDataBootstrapPromotionReadiness =
  | 'needs_validation'
  | 'needs_review'
  | 'blocked'
  | 'waiting_batch'
  | 'ready'
  | 'already_promoted'

export type MasterDataBootstrapBatchItem = {
  batchId: string
  companyId: string
  bootstrapEntity: MasterDataBootstrapEntity
  sourceLabel: string
  fileReference: string | null
  batchStatus: MasterDataBootstrapBatchStatus | string
  rowCount: number
  pendingCount: number
  validCount: number
  needsReviewCount: number
  invalidCount: number
  promotedCount: number
  createdByUserId?: string | null
  uploadedByUserId?: string | null
  createdAt: string
  updatedAt?: string | null
  validatedAt?: string | null
  promotedAt: string | null
  readiness?: MasterDataBootstrapReadiness
  nextAction?: string
}

export type MasterDataBootstrapRow = {
  rowId: string
  batchId?: string
  rowNumber: number
  sourceStoreCode: string | null
  sourceEmployeeCode: string | null
  validationStatus: 'pending' | 'valid' | 'needs_review' | 'invalid' | 'promoted' | string
  issueCode: string | null
  issueMessage: string | null
  resolvedCompanyId: string | null
  resolvedRegionId: string | null
  resolvedStoreId: string | null
  resolvedEmployeeId: string | null
  resolvedPositionId: string | null
  promotedEntityId: string | null
  rawPayload: Record<string, unknown>
  normalizedPayload: Record<string, unknown>
  updatedAt?: string
}

export type MasterDataBootstrapBatchDetail = {
  summary: MasterDataBootstrapBatchItem & {
    statusCounts: {
      pending: number
      valid: number
      needsReview: number
      invalid: number
      promoted: number
    }
  }
  rows: ListResponse<MasterDataBootstrapRow>
}

export type MasterDataBootstrapPromotionReadinessResponse = {
  summary: {
    batchId: string
    bootstrapEntity: MasterDataBootstrapEntity
    batchStatus: string
    rowCount: number
    readyCount: number
    waitingBatchCount: number
    needsValidationCount: number
    needsReviewCount: number
    blockedCount: number
    alreadyPromotedCount: number
    canPromote: boolean
    nextAction: string
  }
  rows: ListResponse<
    Pick<
      MasterDataBootstrapRow,
      | 'rowId'
      | 'rowNumber'
      | 'sourceStoreCode'
      | 'sourceEmployeeCode'
      | 'validationStatus'
      | 'promotedEntityId'
    > & {
      promotionReadiness: MasterDataBootstrapPromotionReadiness
      blockReason: string | null
    }
  >
}

export type MasterDataBootstrapPromotionResponse = CommandResponse<{
  batch: MasterDataBootstrapBatchItem & {
    promotedRows?: Array<{
      rowId: string
      promotedEntityId: string
      assignmentId?: string
    }>
  }
  promotedRows: Array<{
    rowId: string
    promotedEntityId: string
    assignmentId?: string
  }>
}>

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
  return fetchOpenApiJson('/api/integrations/import-batches/overview')
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

export async function getImportBatchErrors(
  batchId: string,
  input?: { limit?: number; offset?: number },
) {
  const params = new URLSearchParams({
    limit: String(input?.limit ?? 20),
    offset: String(input?.offset ?? 0),
  })

  return fetchJson<ListResponse<ImportBatchError>>(
    `/integrations/import-batches/${batchId}/errors?${params.toString()}`,
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

export async function getExternalIdMapCandidates(input: {
  entityType: 'employee' | 'store'
  q?: string
  limit?: number
}) {
  const params = new URLSearchParams({
    entityType: input.entityType,
    limit: String(input.limit ?? 25),
  })
  const search = input.q?.trim()
  if (search) {
    params.set('q', search)
  }

  return fetchJson<ListResponse<ExternalIdMapCandidate>>(
    `/integrations/external-id-map-candidates?${params.toString()}`,
  )
}

export async function approveExternalIdMap(input: {
  integrationSourceId: string
  entityType: 'employee' | 'store'
  externalId: string
  internalId: string
  internalTableName?: string
}) {
  return sendJson<
    CommandResponse<{
      mapping: {
        integrationSourceId: string
        entityType: 'employee' | 'store'
        externalId: string
        internalId: string
        internalTableName: string
      }
    }>
  >('/integrations/external-id-maps', {
    method: 'POST',
    body: input,
  })
}

export async function getStoreMasterData(input?: {
  q?: string
  enabled?: boolean
  status?: 'active' | 'inactive' | 'closed'
  limit?: number
  offset?: number
}) {
  const params = new URLSearchParams({
    limit: String(input?.limit ?? 50),
    offset: String(input?.offset ?? 0),
  })
  const search = input?.q?.trim()
  if (search) {
    params.set('q', search)
  }
  if (typeof input?.enabled === 'boolean') {
    params.set('enabled', String(input.enabled))
  }
  if (input?.status) {
    params.set('status', input.status)
  }

  return fetchJson<ListResponse<StoreMasterItem>>(
    `/integrations/store-master?${params.toString()}`,
  )
}

export async function getStoreMasterLookups() {
  return fetchJson<StoreMasterLookups>('/integrations/store-master-lookups')
}

export async function updateStoreMasterData(input: {
  storeId: string
  storeType: 'company' | 'franchise' | 'operator'
  regionId: string
  status: 'active' | 'inactive' | 'closed'
  kpiImportEnabled: boolean
}) {
  return sendJson<CommandResponse<{ storeMaster: StoreMasterItem }>>(
    `/integrations/store-master/${input.storeId}`,
    {
      method: 'PATCH',
      body: {
        storeType: input.storeType,
        regionId: input.regionId,
        status: input.status,
        kpiImportEnabled: input.kpiImportEnabled,
      },
    },
  )
}

export async function getPersonnelMasterData(input?: {
  q?: string
  status?: 'active' | 'inactive' | 'terminated'
  storeId?: string
  limit?: number
  offset?: number
}) {
  const params = new URLSearchParams({
    limit: String(input?.limit ?? 50),
    offset: String(input?.offset ?? 0),
  })
  const search = input?.q?.trim()
  if (search) {
    params.set('q', search)
  }
  if (input?.status) {
    params.set('status', input.status)
  }
  if (input?.storeId) {
    params.set('storeId', input.storeId)
  }

  return fetchJson<ListResponse<PersonnelMasterItem>>(
    `/integrations/personnel-master?${params.toString()}`,
  )
}

export async function getPersonnelMasterLookups() {
  return fetchJson<PersonnelMasterLookups>('/integrations/personnel-master-lookups')
}

export async function updatePersonnelMasterData(input: {
  employeeId: string
  firstName: string
  lastName: string
  externalEmployeeRef?: string
  employmentStatus: 'active' | 'inactive' | 'terminated'
  employmentType: 'full_time' | 'part_time' | 'temporary'
  hireDate: string
  storeId: string
  positionId: string
  assignmentStartDate?: string
}) {
  return sendJson<CommandResponse<{ personnelMaster: PersonnelMasterItem }>>(
    `/integrations/personnel-master/${input.employeeId}`,
    {
      method: 'PATCH',
      body: {
        firstName: input.firstName,
        lastName: input.lastName,
        externalEmployeeRef: input.externalEmployeeRef,
        employmentStatus: input.employmentStatus,
        employmentType: input.employmentType,
        hireDate: input.hireDate,
        storeId: input.storeId,
        positionId: input.positionId,
        assignmentStartDate: input.assignmentStartDate,
      },
    },
  )
}

export async function getMasterDataBootstrapBatches(input?: {
  bootstrapEntity?: MasterDataBootstrapEntity
  batchStatus?: string
  readiness?: MasterDataBootstrapReadiness
  q?: string
  limit?: number
  offset?: number
}) {
  const params = new URLSearchParams({
    limit: String(input?.limit ?? 20),
    offset: String(input?.offset ?? 0),
  })
  if (input?.bootstrapEntity) {
    params.set('bootstrapEntity', input.bootstrapEntity)
  }
  if (input?.batchStatus) {
    params.set('batchStatus', input.batchStatus)
  }
  if (input?.readiness) {
    params.set('readiness', input.readiness)
  }
  const search = input?.q?.trim()
  if (search) {
    params.set('q', search)
  }

  return fetchJson<ListResponse<MasterDataBootstrapBatchItem>>(
    `/integrations/master-data-bootstrap/batches?${params.toString()}`,
  )
}

export async function getMasterDataBootstrapBatchDetail(batchId: string) {
  return fetchJson<MasterDataBootstrapBatchDetail>(
    `/integrations/master-data-bootstrap/batches/${batchId}`,
  )
}

export async function getMasterDataBootstrapPromotionReadiness(batchId: string) {
  return fetchJson<MasterDataBootstrapPromotionReadinessResponse>(
    `/integrations/master-data-bootstrap/batches/${batchId}/promotion-readiness`,
  )
}

export async function validateMasterDataBootstrapBatch(batchId: string) {
  return sendJson<CommandResponse<{ batch: MasterDataBootstrapBatchItem }>>(
    `/integrations/master-data-bootstrap/batches/${batchId}/validate`,
    { method: 'POST' },
  )
}

export async function promoteMasterDataBootstrapStores(batchId: string) {
  return sendJson<MasterDataBootstrapPromotionResponse>(
    `/integrations/master-data-bootstrap/batches/${batchId}/promote-stores`,
    { method: 'POST' },
  )
}

export async function promoteMasterDataBootstrapPersonnel(batchId: string) {
  return sendJson<MasterDataBootstrapPromotionResponse>(
    `/integrations/master-data-bootstrap/batches/${batchId}/promote-personnel`,
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
  periodMonth?: string
  periodType?: 'daily' | 'weekly' | 'monthly' | 'custom'
  periodStart?: string
  periodEnd?: string
  personnelFile?: File | null
  storeFile?: File | null
}) {
  const formData = new FormData()
  formData.set('sourceCode', input.sourceCode)
  if (input.periodMonth) {
    formData.set('periodMonth', input.periodMonth)
  }
  if (input.periodType) {
    formData.set('periodType', input.periodType)
  }
  if (input.periodStart) {
    formData.set('periodStart', input.periodStart)
  }
  if (input.periodEnd) {
    formData.set('periodEnd', input.periodEnd)
  }

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
