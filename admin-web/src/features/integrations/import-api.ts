import { sendFormData, sendJson } from '../../lib/api'
import { fetchOpenApiJson } from '../../lib/openapi-client'
import type { CommandResponse, CreateImportBatchBody, PowerBiExportUploadResponse } from './api'

export async function getImportPayloadTemplate(input?: {
  entityType?: string
  sourceSystem?: string
}) {
  const params = new URLSearchParams()
  if (input?.entityType) params.set('entityType', input.entityType)
  if (input?.sourceSystem) params.set('sourceSystem', input.sourceSystem)

  return fetchOpenApiJson('/api/integrations/import-payload-templates', { query: params })
}

export async function createImportBatch(input: CreateImportBatchBody) {
  return sendJson<CommandResponse<{ batch: { batchId: string; status: string } }>>(
    '/integrations/import-batches',
    { method: 'POST', body: input },
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
  if (input.periodMonth) formData.set('periodMonth', input.periodMonth)
  if (input.periodType) formData.set('periodType', input.periodType)
  if (input.periodStart) formData.set('periodStart', input.periodStart)
  if (input.periodEnd) formData.set('periodEnd', input.periodEnd)
  if (input.personnelFile) formData.set('personnelFile', input.personnelFile)
  if (input.storeFile) formData.set('storeFile', input.storeFile)

  return sendFormData<PowerBiExportUploadResponse>('/integrations/power-bi-export-upload', {
    method: 'POST',
    body: formData,
  })
}
