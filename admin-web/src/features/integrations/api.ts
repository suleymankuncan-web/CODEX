import { fetchBlob, sendJson } from '../../lib/api'
import {
  fetchOpenApiJson,
  sendOpenApiJson,
  type ApiGetResponse,
  type ApiMutationBody,
  type ApiMutationResponse,
} from '../../lib/openapi-client'

export type ImportOverview = ApiGetResponse<'/api/integrations/import-batches/overview'>

export type ImportPayloadTemplate =
  ApiGetResponse<'/api/integrations/import-payload-templates'>

export type IntegrationLookups = ApiGetResponse<'/api/integrations/lookups'>

export async function downloadPersonnelMasterData() {
  return fetchBlob('/integrations/personnel-master.xlsx')
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

export type NeedsActionList =
  ApiGetResponse<'/api/integrations/import-batches/needs-action'>
export type NeedsActionItem = NeedsActionList['items'][number]

export type ListResponse<T> = {
  items: T[]
  meta: {
    count: number
    total: number
    limit: number
    offset: number
  }
}

export type ImportBatchDetail =
  ApiGetResponse<'/api/integrations/import-batches/{batchId}'>

export type ImportBatchReconciliation =
  ApiGetResponse<'/api/integrations/import-batches/{batchId}/reconciliation'>

export type ImportBatchErrors =
  ApiGetResponse<'/api/integrations/import-batches/{batchId}/errors'>
export type ImportBatchError = ImportBatchErrors['items'][number]

export type ExternalIdMapCandidates =
  ApiGetResponse<'/api/integrations/external-id-map-candidates'>
export type ExternalIdMapCandidate = ExternalIdMapCandidates['items'][number]

export type StoreMasterList = ApiGetResponse<'/api/integrations/store-master'>
export type StoreMasterItem = StoreMasterList['items'][number]

export type StoreMasterLookups = ApiGetResponse<'/api/integrations/store-master-lookups'>
export type StoreMasterUpdateResponse = ApiMutationResponse<'/api/integrations/store-master/{storeId}', 'PATCH'>
export type StoreMasterCreateInput = ApiMutationBody<'/api/integrations/store-master', 'POST'>
export type StoreMasterCreateResponse = ApiMutationResponse<'/api/integrations/store-master', 'POST'>

export type PersonnelMasterList = ApiGetResponse<'/api/integrations/personnel-master'>
export type PersonnelMasterItem = PersonnelMasterList['items'][number]

export type PersonnelMasterLookups =
  ApiGetResponse<'/api/integrations/personnel-master-lookups'>
export type PersonnelMasterUpdateResponse = ApiMutationResponse<'/api/integrations/personnel-master/{employeeId}', 'PATCH'>
export type PersonnelMasterCreateInput = ApiMutationBody<'/api/integrations/personnel-master', 'POST'>
export type PersonnelMasterCreateResponse = ApiMutationResponse<'/api/integrations/personnel-master', 'POST'>
export type PersonnelMasterTerminateInput = ApiMutationBody<
  '/api/integrations/personnel-master/{employeeId}/terminate',
  'PATCH'
>

export type MasterDataQualityIssues =
  ApiGetResponse<'/api/integrations/master-data-quality/issues'>
export type MasterDataQualityIssueItem = MasterDataQualityIssues['items'][number]
export type MasterDataQualityAudit =
  ApiGetResponse<'/api/integrations/master-data-quality/audit'>
export type MasterDataQualityAuditItem = MasterDataQualityAudit['items'][number]

export type MasterDataBootstrapEntity = 'store' | 'personnel'

export type MasterDataBootstrapReadiness =
  | 'needs_validation'
  | 'needs_review'
  | 'ready_to_promote'
  | 'closed'

export type MasterDataBootstrapBatchList =
  ApiGetResponse<'/api/integrations/master-data-bootstrap/batches'>
export type MasterDataBootstrapBatchItem = MasterDataBootstrapBatchList['items'][number]

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

export type MasterDataBootstrapBatchDetail =
  ApiGetResponse<'/api/integrations/master-data-bootstrap/batches/{batchId}'>

export type MasterDataBootstrapPromotionReadinessResponse =
  ApiGetResponse<'/api/integrations/master-data-bootstrap/batches/{batchId}/promotion-readiness'>

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

export type ImportBatchAudit =
  ApiGetResponse<'/api/integrations/import-batches/{batchId}/audit'>
export type AuditEvent = ImportBatchAudit['items'][number]

export type CommandResponse<T> = {
  command: {
    status: string
    message: string
  }
  data: T
}

export type CreateImportBatchBody = {
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
  return fetchOpenApiJson('/api/integrations/lookups')
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

  return fetchOpenApiJson('/api/integrations/import-batches/needs-action', {
    query: params,
  })
}

export async function getImportBatchDetail(batchId: string) {
  return fetchOpenApiJson('/api/integrations/import-batches/{batchId}', {
    params: { batchId },
  })
}

export async function getImportBatchReconciliation(batchId: string) {
  return fetchOpenApiJson(
    '/api/integrations/import-batches/{batchId}/reconciliation',
    { params: { batchId } },
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

  return fetchOpenApiJson('/api/integrations/import-batches/{batchId}/errors', {
    params: { batchId },
    query: params,
  })
}

export async function getImportBatchAudit(batchId: string) {
  return fetchOpenApiJson('/api/integrations/import-batches/{batchId}/audit', {
    params: { batchId },
    query: new URLSearchParams({ limit: '20', offset: '0' }),
  })
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

  return fetchOpenApiJson('/api/integrations/external-id-map-candidates', {
    query: params,
  })
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

  return fetchOpenApiJson('/api/integrations/store-master', { query: params })
}

export async function getStoreMasterLookups() {
  return fetchOpenApiJson('/api/integrations/store-master-lookups')
}

export async function createStoreMasterData(
  input: StoreMasterCreateInput,
): Promise<StoreMasterCreateResponse> {
  return sendOpenApiJson('/api/integrations/store-master', {
    method: 'POST',
    body: input,
  })
}

export async function getMasterDataQualityIssues(input?: {
  q?: string
  entityType?: 'store' | 'personnel' | 'assignment' | 'import'
  severity?: 'critical' | 'warning' | 'info'
  issueCode?: string
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
  if (input?.entityType) {
    params.set('entityType', input.entityType)
  }
  if (input?.severity) {
    params.set('severity', input.severity)
  }
  if (input?.issueCode) {
    params.set('issueCode', input.issueCode)
  }

  return fetchOpenApiJson('/api/integrations/master-data-quality/issues', { query: params })
}

export async function getMasterDataQualityAudit(input?: {
  entityType?: 'store' | 'personnel' | 'import'
  entityId?: string
  limit?: number
  offset?: number
}) {
  const params = new URLSearchParams({
    limit: String(input?.limit ?? 30),
    offset: String(input?.offset ?? 0),
  })
  if (input?.entityType) {
    params.set('entityType', input.entityType)
  }
  if (input?.entityId) {
    params.set('entityId', input.entityId)
  }

  return fetchOpenApiJson('/api/integrations/master-data-quality/audit', { query: params })
}

export async function updateStoreMasterData(input: {
  storeId: string
  storeType: 'company' | 'franchise' | 'operator'
  regionId: string
  regionManagerUserId?: string
  status: 'active' | 'inactive' | 'closed'
  kpiImportEnabled: boolean
  expectedUpdatedAt?: string
}): Promise<StoreMasterUpdateResponse> {
  return sendOpenApiJson('/api/integrations/store-master/{storeId}', {
    method: 'PATCH',
    params: { storeId: input.storeId },
    body: {
      storeType: input.storeType,
      regionId: input.regionId,
      ...(input.regionManagerUserId ? { regionManagerUserId: input.regionManagerUserId } : {}),
      status: input.status,
      kpiImportEnabled: input.kpiImportEnabled,
      ...(input.expectedUpdatedAt ? { expectedUpdatedAt: input.expectedUpdatedAt } : {}),
    },
  })
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

  return fetchOpenApiJson('/api/integrations/personnel-master', { query: params })
}

export async function getPersonnelMasterLookups() {
  return fetchOpenApiJson('/api/integrations/personnel-master-lookups')
}

export async function createPersonnelMasterData(
  input: PersonnelMasterCreateInput,
): Promise<PersonnelMasterCreateResponse> {
  return sendOpenApiJson('/api/integrations/personnel-master', {
    method: 'POST',
    body: input,
  })
}

export async function terminatePersonnelMasterData(
  employeeId: string,
  input: PersonnelMasterTerminateInput,
) {
  return sendOpenApiJson('/api/integrations/personnel-master/{employeeId}/terminate', {
    method: 'PATCH',
    params: { employeeId },
    body: input,
  })
}

export async function updatePersonnelMasterData(input: {
  employeeId: string
  firstName: string
  lastName: string
  externalEmployeeRef?: string
  phoneNumber?: string
  employmentStatus: 'active' | 'inactive'
  employmentType: 'full_time' | 'part_time' | 'temporary'
  hireDate: string
  storeId: string
  positionId: string
  assignmentStartDate?: string
  expectedUpdatedAt?: string
}): Promise<PersonnelMasterUpdateResponse> {
  return sendOpenApiJson('/api/integrations/personnel-master/{employeeId}', {
    method: 'PATCH',
    params: { employeeId: input.employeeId },
    body: {
      firstName: input.firstName,
      lastName: input.lastName,
      ...(input.externalEmployeeRef !== undefined ? { externalEmployeeRef: input.externalEmployeeRef } : {}),
      ...(input.phoneNumber !== undefined ? { phoneNumber: input.phoneNumber } : {}),
      employmentStatus: input.employmentStatus,
      employmentType: input.employmentType,
      hireDate: input.hireDate,
      storeId: input.storeId,
      positionId: input.positionId,
      ...(input.assignmentStartDate !== undefined ? { assignmentStartDate: input.assignmentStartDate } : {}),
      ...(input.expectedUpdatedAt ? { expectedUpdatedAt: input.expectedUpdatedAt } : {}),
    },
  })
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

  return fetchOpenApiJson('/api/integrations/master-data-bootstrap/batches', { query: params })
}

export async function getMasterDataBootstrapBatchDetail(batchId: string) {
  return fetchOpenApiJson('/api/integrations/master-data-bootstrap/batches/{batchId}', {
    params: { batchId },
  })
}

export async function getMasterDataBootstrapPromotionReadiness(batchId: string) {
  return fetchOpenApiJson(
    '/api/integrations/master-data-bootstrap/batches/{batchId}/promotion-readiness',
    { params: { batchId } },
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

export { createImportBatch, getImportPayloadTemplate, uploadPowerBiExport } from './import-api'
