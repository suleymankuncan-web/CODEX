import { sendJson } from '../../lib/api'
import { fetchOpenApiJson, type ApiGetResponse } from '../../lib/openapi-client'

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

export type ChecklistTemplateResponseType = 'score' | 'yes_no' | 'partial' | 'text'

type AdminChecklistTemplateItemInput = {
  sectionName: string
  itemNo: number
  itemText: string
  responseType: ChecklistTemplateResponseType
  weight: number
  maxScore: number
  expectedValue?: string
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

export type MobileChecklistTodayResponse = ApiGetResponse<'/api/mobile/checklists/today'>
export type MobileChecklistToday = MobileChecklistTodayResponse['data']
export type MobileChecklistInstanceStatus =
  MobileChecklistToday['activeInstances'][number]['status']

export type MobileChecklistInstance = {
  checklist_instance_id: string
  status: MobileChecklistInstanceStatus
  created_at: string
}

export async function getMobileChecklistToday() {
  return fetchOpenApiJson('/api/mobile/checklists/today')
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
  commentText?: string
}) {
  return sendJson<CommandResponse<{ checklistResponse: { response_id: string; responded_at: string } }>>(
    `/mobile/checklists/instances/${input.checklistInstanceId}/responses`,
    {
      method: 'PATCH',
      body: {
        templateItemId: input.templateItemId,
        scoreValue: input.scoreValue,
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

export async function getChecklistAcknowledgements() {
  return sendJson<ListResponse<ChecklistAcknowledgementItem>>('/checklists/acknowledgements/list', {
    method: 'POST',
    body: {},
  })
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
  return sendJson<CommandResponse<{ acknowledgement: ChecklistAcknowledgementItem['acknowledgement'] }>>(
    `/checklists/instances/${input.checklistInstanceId}/acknowledge`,
    {
      method: 'POST',
      body: {
        acknowledgementNote: input.acknowledgementNote,
      },
    },
  )
}
