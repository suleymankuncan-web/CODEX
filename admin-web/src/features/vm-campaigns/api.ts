import {
  fetchOpenApiJson,
  sendOpenApiJson,
  type ApiGetResponse,
  type ApiMutationBody,
} from '../../lib/openapi-client'
import { fetchBlob, sendFormData } from '../../lib/api'

export type VmReferenceList = ApiGetResponse<'/api/visual-merchandising/references'>
export type VmCampaignList = ApiGetResponse<'/api/mobile/visual-campaigns'>
export type VmCampaignAssignment = VmCampaignList['items'][number]
export type CreateVmReferenceInput = ApiMutationBody<'/api/visual-merchandising/references', 'POST'>
export type VmReferencePublisherOptions = ApiGetResponse<'/api/visual-merchandising/references/options'>

export function getVmReferences(companyId: string) {
  return fetchOpenApiJson('/api/visual-merchandising/references', {
    query: new URLSearchParams({ companyId, limit: '50', offset: '0' }),
  })
}

export function getVmReferenceOptions(companyId: string) {
  return fetchOpenApiJson('/api/visual-merchandising/references/options', {
    query: new URLSearchParams({ companyId }),
  })
}

export function getVmReviewerCampaigns(companyId: string) {
  return fetchOpenApiJson('/api/visual-merchandising/references/campaigns', {
    query: new URLSearchParams({ companyId, limit: '50', offset: '0' }),
  })
}

export function getVmManagedCampaigns(companyId: string) {
  return fetchOpenApiJson('/api/visual-merchandising/references/managed-campaigns', {
    query: new URLSearchParams({ companyId, limit: '100', offset: '0' }),
  })
}

export function reviseVmCampaign(input: {
  referenceSetId: string
  companyId: string
  command: 'extend' | 'reopen' | 'scope_add'
  expectedRevision: number
  reason: string
  startsOn: string
  endsOn: string
  storeIds: string[]
}) {
  return sendOpenApiJson('/api/visual-merchandising/references/{referenceSetId}/revisions', {
    method: 'POST', params: { referenceSetId: input.referenceSetId }, body: {
      companyId: input.companyId, command: input.command,
      expectedRevision: input.expectedRevision, idempotencyKey: crypto.randomUUID(),
      reason: input.reason, startsOn: input.startsOn, endsOn: input.endsOn,
      storeIds: input.storeIds,
    },
  })
}

export function changeVmAssignmentState(input: {
  referenceSetId: string
  assignmentId: string
  companyId: string
  command: 'withdraw' | 'exempt' | 'hold' | 'reconcile'
  expectedVersion: number
  reason: string
}) {
  return sendOpenApiJson('/api/visual-merchandising/references/{referenceSetId}/assignments/{assignmentId}/commands', {
    method: 'POST', params: { referenceSetId: input.referenceSetId, assignmentId: input.assignmentId },
    body: { companyId: input.companyId, command: input.command,
      expectedVersion: input.expectedVersion, idempotencyKey: crypto.randomUUID(), reason: input.reason },
  })
}

export function retireVmReference(input: {
  referenceSetId: string
  companyId: string
  expectedRevision: number
  reason: string
}) {
  return sendOpenApiJson('/api/visual-merchandising/references/{referenceSetId}/retire', {
    method: 'POST', params: { referenceSetId: input.referenceSetId }, body: {
      companyId: input.companyId, expectedRevision: input.expectedRevision,
      idempotencyKey: crypto.randomUUID(), reason: input.reason,
    },
  })
}

export function createVmReference(input: CreateVmReferenceInput) {
  return sendOpenApiJson('/api/visual-merchandising/references', { method: 'POST', body: input })
}

export async function configureAndPublishVmReference(input: {
  companyId: string
  referenceSetId: string
  expectedRevision: number
  startsOn: string
  endsOn: string
  reason: string
  storeIds: string[]
  items: Array<{
    templateId: string
    templateItemId: string
    itemOrder: number
    expectedVisualIntent: string
    reviewInstructions: string
    rubricVersion: string
    file: File
  }>
}) {
  let revision = input.expectedRevision
  for (const item of input.items) {
    const draftItem = await sendOpenApiJson(
      '/api/visual-merchandising/references/{referenceSetId}/draft/items/{templateItemId}',
      { method: 'POST', params: { referenceSetId: input.referenceSetId, templateItemId: item.templateItemId }, body: {
        companyId: input.companyId,
        templateId: item.templateId,
        templateItemId: item.templateItemId,
        itemOrder: item.itemOrder,
        expectedVisualIntent: item.expectedVisualIntent,
        reviewInstructions: item.reviewInstructions,
        rubricVersion: item.rubricVersion,
        expectedRevision: revision,
      } },
    ) as { draftItemId: string; version: number }
    revision = draftItem.version
    const form = new FormData()
    form.append('file', item.file)
    const upload = await sendFormData<{ mediaAssetId: string }>(
      `/visual-merchandising/references/${encodeURIComponent(input.referenceSetId)}/draft/items/${encodeURIComponent(draftItem.draftItemId)}/uploads?companyId=${encodeURIComponent(input.companyId)}`,
      { method: 'POST', body: form },
    )
    await sendOpenApiJson(
      '/api/visual-merchandising/references/{referenceSetId}/draft/items/{draftItemId}/uploads/{mediaAssetId}/finalize',
      { method: 'POST', params: { referenceSetId: input.referenceSetId,
        draftItemId: draftItem.draftItemId, mediaAssetId: upload.mediaAssetId },
        query: new URLSearchParams({ companyId: input.companyId }) },
    )
  }
  return sendOpenApiJson('/api/visual-merchandising/references/{referenceSetId}/publish', {
    method: 'POST', params: { referenceSetId: input.referenceSetId }, body: {
      companyId: input.companyId, expectedRevision: revision,
      idempotencyKey: crypto.randomUUID(), startsOn: input.startsOn,
      endsOn: input.endsOn, storeIds: input.storeIds, reason: input.reason,
    },
  })
}

export function getVmCampaigns() {
  return fetchOpenApiJson('/api/mobile/visual-campaigns', {
    query: new URLSearchParams({ limit: '50', offset: '0' }),
  })
}

export async function getVmReferenceReadUrl(input: { assignmentId: string; referenceItemId: string }) {
  const blob = await fetchBlob(`/mobile/visual-campaigns/${encodeURIComponent(input.assignmentId)}/items/${encodeURIComponent(input.referenceItemId)}/reference-content/thumbnail`)
  return { url: URL.createObjectURL(blob) }
}

export async function uploadSyntheticVmEvidence(input: {
  assignmentId: string
  referenceItemId: string
  file: File
}) {
  const form = new FormData()
  form.append('file', input.file)
  const upload = await sendFormData<{ mediaAssetId: string }>(
    `/mobile/visual-campaigns/${encodeURIComponent(input.assignmentId)}/items/${encodeURIComponent(input.referenceItemId)}/uploads`,
    { method: 'POST', body: form },
  )
  await sendOpenApiJson(
    '/api/mobile/visual-campaigns/{assignmentId}/items/{referenceItemId}/uploads/{mediaAssetId}/finalize',
    { method: 'POST', params: {
      assignmentId: input.assignmentId,
      referenceItemId: input.referenceItemId,
      mediaAssetId: upload.mediaAssetId,
    } },
  )
  return { referenceItemId: input.referenceItemId, mediaAssetId: upload.mediaAssetId }
}

export function submitVmCampaign(input: {
  assignmentId: string
  expectedVersion: number
  items: Array<{ referenceItemId: string; mediaAssetId: string }>
}) {
  return sendOpenApiJson('/api/mobile/visual-campaigns/{assignmentId}/submissions', {
    method: 'POST', params: { assignmentId: input.assignmentId }, body: {
      expectedVersion: input.expectedVersion,
      idempotencyKey: crypto.randomUUID(),
      items: input.items,
    },
  })
}
