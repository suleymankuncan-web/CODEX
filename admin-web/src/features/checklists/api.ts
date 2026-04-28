import { fetchJson, sendJson } from '../../lib/api'

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

export type ChecklistAcknowledgementItem = {
  checklistInstanceId: string
  checklistTemplateId: string
  templateName: string
  category: string
  storeId: string
  storeName: string
  completedAt: string | null
  status: string
  totalScore: number | null
  complianceRate: number | null
  acknowledgement: {
    checklistAcknowledgementId: string
    acknowledgedByUserId: string
    acknowledgementNote: string | null
    acknowledgedAt: string
  } | null
}

export type MobileChecklistToday = {
  stores: Array<{ storeId: string; storeName: string }>
  templates: Array<{
    checklistTemplateId: string
    templateCode: string
    templateType: string
    templateName: string
    versionNo: number
  }>
  activeInstances: Array<{
    checklistInstanceId: string
    checklistTemplateId: string
    storeId: string
    status: string
    startedAt: string | null
    updatedAt: string | null
  }>
  completedThisMonth: Array<{
    checklistInstanceId: string
    checklistTemplateId: string
    storeId: string
    completedAt: string
    totalScore: number
    acknowledgedAt: string | null
  }>
  pendingAcknowledgements: Array<{
    checklistInstanceId: string
    checklistTemplateId: string
    storeId: string
    completedAt: string
    totalScore: number
  }>
  monthlySummaries: Array<{
    storeId: string
    checklistTemplateId: string
    monthStart: string
    completedCount: number
    averageScore: number | null
  }>
}

export type MobileChecklistInstance = {
  checklist_instance_id: string
  status: string
  created_at: string
}

export async function getMobileChecklistToday() {
  return fetchJson<{ data: MobileChecklistToday }>('/mobile/checklists/today')
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

export async function getChecklistAcknowledgements() {
  return sendJson<ListResponse<ChecklistAcknowledgementItem>>('/checklists/acknowledgements/list', {
    method: 'POST',
    body: {},
  })
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
