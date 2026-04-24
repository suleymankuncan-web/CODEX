import { sendJson } from '../../lib/api'

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
