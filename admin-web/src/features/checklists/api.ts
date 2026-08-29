import { fetchBlob, sendFormData, sendJson } from '../../lib/api'
import { fetchOpenApiJson, sendOpenApiJson, type ApiGetResponse } from '../../lib/openapi-client'

type ListResponse<T> = {
  items: T[]
  meta: {
    count: number
    total: number
    limit: number
    offset: number
  }
}

type CommandResponse<T> = {
  command: {
    status: string
    message: string
  }
  data: T
}

export type ChecklistTemplateResponseType = 'score' | 'yes_no' | 'partial' | 'compliance' | 'text'
export type ChecklistComplianceResponseValue =
  | 'compliant'
  | 'partially_compliant'
  | 'non_compliant'
  | 'not_applicable'
export type ChecklistEvidencePolicy = 'none' | 'optional' | 'required'
export type ChecklistItemEvidenceProjection = {
  checklistInstanceId: string
  templateItemId: string
  evidenceVersion: number
  evidencePolicy: ChecklistEvidencePolicy
  maxEvidenceCount: number
  evidence: Array<{
    mediaAssetId: string
    displayOrder: number
    captureSource: 'camera' | 'gallery' | 'system_generated'
    thumbnailAvailable: boolean
  }>
  idempotent: boolean
}

type AdminChecklistTemplateItemInput = {
  sectionName: string
  itemNo: number
  itemText: string
  responseType: ChecklistTemplateResponseType
  weight: number
  maxScore: number
  expectedValue?: string
  evidencePolicy?: ChecklistEvidencePolicy
  maxEvidenceCount?: number
}

export type AdminChecklistTemplateSummary = {
  checklistTemplateId: string
  companyId?: string
  templateCode?: string
  templateType?: string
  templateName?: string
  category?: string
  versionNo?: number
  status: string
  effectiveFrom?: string
  effectiveTo?: string | null
  items?: Array<AdminChecklistTemplateItemInput & { templateItemId: string }>
}

export type CreateAdminChecklistTemplateInput = {
  companyId: string
  templateCode: string
  templateName: string
  templateType: string
  category: string
  effectiveFrom: string
  effectiveTo?: string
  items: AdminChecklistTemplateItemInput[]
}

export type PublishAdminChecklistTemplateInput = {
  checklistTemplateId: string
  effectiveFrom?: string
  effectiveTo?: string
}

export type ChecklistAcknowledgementItem = {
  checklistInstanceId: string
  checklistTemplateId: string
  templateName: string
  templateType: string
  category: string
  storeId: string
  storeName: string
  completedByUserId: string | null
  completedAt: string | null
  status: string
  totalScore: number | null
  complianceRate: number | null
  responses: Array<{
    templateItemId: string
    sectionName: string
    itemNo: number
    itemText: string
    responseType: string
    weight: number
    maxScore: number
    responseValue: string | null
    scoreValue: number | null
    commentText: string | null
  }>
  acknowledgement: {
    checklistAcknowledgementId: string
    acknowledgedByUserId: string
    acknowledgementNote: string | null
    acknowledgedAt: string
  } | null
}

export type ChecklistAcknowledgementListInput = {
  checklistInstanceId?: string
  includeResponses?: boolean
  limit?: number
  offset?: number
  period?: string
  status?: 'pending_acknowledgement' | 'acknowledged'
  storeId?: string
}

type GeneratedMobileChecklistTodayResponse = ApiGetResponse<'/api/mobile/checklists/today'>
type GeneratedMobileChecklistToday = GeneratedMobileChecklistTodayResponse['data']
export type MobileChecklistToday = Omit<GeneratedMobileChecklistToday, 'templates' | 'activeInstances'> & {
  evidenceCapabilities?: {
    captureAvailable: boolean
    syntheticFixtureOnly: boolean
    unavailableReason: 'feature_disabled' | 'storage_unavailable' | 'synthetic_fixture_unavailable' | null
  }
  templates: Array<GeneratedMobileChecklistToday['templates'][number] & {
    items: Array<GeneratedMobileChecklistToday['templates'][number]['items'][number] & {
      evidencePolicy: ChecklistEvidencePolicy
      maxEvidenceCount: number
    }>
  }>
  activeInstances: Array<GeneratedMobileChecklistToday['activeInstances'][number] & {
    evidenceVersion: number
    evidence: Array<{
      templateItemId: string
      mediaAssetId: string
      displayOrder: number
      captureSource: 'camera' | 'gallery' | 'system_generated'
      thumbnailAvailable: boolean
    }>
    responses: Array<
      GeneratedMobileChecklistToday['activeInstances'][number]['responses'][number] & {
        responseValue: string | null
      }
    >
  }>
}
export type MobileChecklistTodayResponse = Omit<GeneratedMobileChecklistTodayResponse, 'data'> & {
  data: MobileChecklistToday
}
export type MobileChecklistInstanceStatus =
  MobileChecklistToday['activeInstances'][number]['status']

export type MobileChecklistInstance = {
  checklist_instance_id: string
  status: MobileChecklistInstanceStatus
  created_at: string
}

export async function getMobileChecklistToday() {
  return fetchOpenApiJson('/api/mobile/checklists/today') as Promise<MobileChecklistTodayResponse>
}

export async function startMobileChecklistInstance(input: {
  checklistTemplateId: string
  storeId: string
}) {
  return sendJson<CommandResponse<{ checklistInstance: MobileChecklistInstance }>>(
    '/mobile/checklists/instances',
    {
      method: 'POST',
      body: input,
    },
  )
}

export async function saveMobileChecklistResponse(input: {
  checklistInstanceId: string
  templateItemId: string
  scoreValue: number
  responseValue?: ChecklistComplianceResponseValue
  commentText?: string
}) {
  return sendJson<CommandResponse<{ checklistResponse: { response_id: string; responded_at: string } }>>(
    `/mobile/checklists/instances/${input.checklistInstanceId}/responses`,
    {
      method: 'PATCH',
      body: {
        templateItemId: input.templateItemId,
        scoreValue: input.scoreValue,
        responseValue: input.responseValue,
        commentText: input.commentText,
      },
    },
  )
}

export async function completeMobileChecklistInstance(input: {
  checklistInstanceId: string
}) {
  return sendJson<
    CommandResponse<{
      checklistInstance: {
        checklist_instance_id: string
        completed_at?: string | null
        compliance_rate?: string | number | null
        locked_at?: string | null
        status: MobileChecklistInstanceStatus
        total_score?: string | number | null
      }
    }>
  >(`/mobile/checklists/instances/${input.checklistInstanceId}/complete`, {
    method: 'POST',
    body: {},
  })
}

export async function linkMobileChecklistItemEvidence(input: {
  checklistInstanceId: string
  templateItemId: string
  mediaAssetId: string
  expectedEvidenceVersion: number
  idempotencyKey: string
}) {
  return sendJson<CommandResponse<{ evidence: ChecklistItemEvidenceProjection }>>(`/mobile/checklists/instances/${input.checklistInstanceId}/items/${input.templateItemId}/evidence`, {
    method: 'POST',
    body: {
      mediaAssetId: input.mediaAssetId,
      expectedEvidenceVersion: input.expectedEvidenceVersion,
      idempotencyKey: input.idempotencyKey,
    },
  })
}

export async function uploadApprovedSyntheticMobileChecklistItemEvidence(input: {
  checklistInstanceId: string
  templateItemId: string
  file: File
}) {
  const body = new FormData()
  body.append('file', input.file)
  return sendFormData<{ mediaAssetId: string; state: 'uploaded' }>(
    `/mobile/checklists/instances/${input.checklistInstanceId}/items/${input.templateItemId}/evidence/uploads`,
    { method: 'POST', body },
  )
}

export async function finalizeApprovedSyntheticMobileChecklistItemEvidence(input: {
  checklistInstanceId: string
  templateItemId: string
  mediaAssetId: string
}) {
  return sendJson<{ mediaAssetId: string; state: 'ready'; rawDisposal: 'verified' | 'pending' }>(
    `/mobile/checklists/instances/${input.checklistInstanceId}/items/${input.templateItemId}/evidence/uploads/${input.mediaAssetId}/finalize`,
    { method: 'POST', body: {} },
  )
}

export async function unlinkMobileChecklistItemEvidence(input: {
  checklistInstanceId: string
  templateItemId: string
  mediaAssetId: string
  expectedEvidenceVersion: number
  idempotencyKey: string
  reason: string
}) {
  return sendJson<CommandResponse<{ evidence: ChecklistItemEvidenceProjection }>>(`/mobile/checklists/instances/${input.checklistInstanceId}/items/${input.templateItemId}/evidence/${input.mediaAssetId}`, {
    method: 'DELETE',
    body: {
      expectedEvidenceVersion: input.expectedEvidenceVersion,
      idempotencyKey: input.idempotencyKey,
      reason: input.reason,
    },
  })
}

export async function getMobileChecklistItemEvidenceReadUrl(input: {
  checklistInstanceId: string
  templateItemId: string
  mediaAssetId: string
  variant: 'canonical' | 'thumbnail'
}) {
  return sendJson<{ url: string; expiresInSeconds: number }>(
    `/mobile/checklists/instances/${input.checklistInstanceId}/items/${input.templateItemId}/evidence/${input.mediaAssetId}/read-url`,
    { method: 'POST', body: { variant: input.variant } },
  )
}

export async function getMobileChecklistItemEvidenceContent(input: {
  checklistInstanceId: string
  templateItemId: string
  mediaAssetId: string
  variant: 'canonical' | 'thumbnail'
}) {
  return fetchBlob(
    `/mobile/checklists/instances/${input.checklistInstanceId}/items/${input.templateItemId}/evidence/${input.mediaAssetId}/content/${input.variant}`,
  )
}

export async function getChecklistAcknowledgements(input: ChecklistAcknowledgementListInput = {}) {
  return sendJson<ListResponse<ChecklistAcknowledgementItem>>('/checklists/acknowledgements/list', {
    method: 'POST',
    body: {
      includeResponses: input.includeResponses ?? false,
      limit: input.limit ?? 50,
      offset: input.offset ?? 0,
      ...(input.checklistInstanceId ? { checklistInstanceId: input.checklistInstanceId } : {}),
      ...(input.period ? { period: input.period } : {}),
      ...(input.status ? { status: input.status } : {}),
      ...(input.storeId ? { storeId: input.storeId } : {}),
    },
  })
}

export async function getChecklistAcknowledgementDetail(checklistInstanceId: string) {
  const response = await getChecklistAcknowledgements({
    checklistInstanceId,
    includeResponses: true,
    limit: 1,
    offset: 0,
  })

  return response.items[0] ?? null
}

export async function createAdminChecklistTemplate(input: CreateAdminChecklistTemplateInput) {
  return sendJson<CommandResponse<{ checklistTemplate: AdminChecklistTemplateSummary }>>(
    '/admin/checklist-templates',
    {
      method: 'POST',
      body: input,
    },
  )
}

export async function publishAdminChecklistTemplate(input: PublishAdminChecklistTemplateInput) {
  return sendJson<CommandResponse<{ checklistTemplate: AdminChecklistTemplateSummary }>>(
    `/admin/checklist-templates/${input.checklistTemplateId}/publish`,
    {
      method: 'POST',
      body: {
        effectiveFrom: input.effectiveFrom,
        effectiveTo: input.effectiveTo,
      },
    },
  )
}

export async function acknowledgeChecklist(input: {
  checklistInstanceId: string
  acknowledgementNote?: string
}) {
  return sendOpenApiJson('/api/checklists/instances/{checklistInstanceId}/acknowledge', {
    method: 'POST',
    params: { checklistInstanceId: input.checklistInstanceId },
    body: input.acknowledgementNote === undefined
      ? {}
      : { acknowledgementNote: input.acknowledgementNote },
  })
}
