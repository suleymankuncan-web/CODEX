import { sendJson } from '../../lib/api'
import { fetchOpenApiJson, type ApiGetResponse } from '../../lib/openapi-client'
import type { StagePresetCode } from './stage-presets'

type CommandResponse<TData> = {
  command: {
    status: string
    message: string
  }
  data: TData
}

export type CompetitionList = ApiGetResponse<'/api/competitions'>
export type CompetitionSummary = CompetitionList['items'][number]
export type CompetitionDetail = ApiGetResponse<'/api/competitions/{competitionId}'>
export type CompetitionStageSummary = CompetitionDetail['stages'][number]
export type CompetitionStoreContribution = CompetitionDetail['storeContributions'][number]

export type CompetitionTeamTemplateList =
  ApiGetResponse<'/api/competitions/team-templates'>
export type CompetitionTeamTemplate = CompetitionTeamTemplateList['items'][number]

export type CompetitionWarning = CompetitionDetail['warnings'][number]

export type CreateCompetitionStagePayload = {
  stagePresetCode?: StagePresetCode
  stageCode: string
  stageName: string
  stageOrder: number
  stageType: CompetitionStageSummary['stageType']
  startsOn: string
  endsOn: string
  teams: Array<{
    teamCode: string
    teamName: string
    sourceTemplateId?: string
    storeIds: string[]
  }>
}

export type CompetitionStagePackageCode = 'league_then_final'

export type CreateCompetitionStagePackagePayload = {
  packageCode: CompetitionStagePackageCode
  stages: CreateCompetitionStagePayload[]
}

export type CompetitionStagePackagePlanList =
  ApiGetResponse<'/api/competitions/{competitionId}/stage-package-plans'>
export type CompetitionStagePackagePlan = CompetitionStagePackagePlanList['items'][number]

export type CreateCompetitionStagePackagePlanPayload = CreateCompetitionStagePackagePayload & {
  planName: string
}

export type UpdateCompetitionStagePackagePlanPayload = CreateCompetitionStagePackagePlanPayload

export type CompetitionStagePackagePlanAudit =
  ApiGetResponse<'/api/competitions/stage-package-plans/{planId}/audit'>
export type CompetitionStagePackagePlanAuditEvent =
  CompetitionStagePackagePlanAudit['items'][number]

export type ReviewCompetitionStagePackagePlanPayload = {
  reviewNote?: string
}

export type CreateCompetitionTeamTemplatePayload = {
  templateCode: string
  templateName: string
  description?: string
  storeIds: string[]
}

export type UpdateCompetitionTeamTemplatePayload = CreateCompetitionTeamTemplatePayload

export type CloneCompetitionTeamTemplatePayload = {
  templateCode: string
  templateName: string
  description?: string
}

export async function listCompetitions() {
  return fetchOpenApiJson('/api/competitions')
}

export async function listCompetitionTeamTemplates(input?: { activeOnly?: boolean }) {
  const params = new URLSearchParams()

  if (input?.activeOnly !== undefined) {
    params.set('activeOnly', String(input.activeOnly))
  }

  return fetchOpenApiJson('/api/competitions/team-templates', {
    query: params,
  })
}

export async function getCompetition(competitionId: string) {
  return fetchOpenApiJson('/api/competitions/{competitionId}', {
    params: { competitionId },
  })
}

export async function createCompetition(payload: {
  competitionCode: string
  competitionName: string
  description?: string
  competitionType: CompetitionSummary['competitionType']
  startsOn: string
  endsOn: string
}) {
  return sendJson<CommandResponse<{ competition: CompetitionSummary }>>('/competitions', {
    method: 'POST',
    body: payload,
  })
}

export async function createCompetitionTeamTemplate(payload: CreateCompetitionTeamTemplatePayload) {
  return sendJson<CommandResponse<{ template: CompetitionTeamTemplate }>>(
    '/competitions/team-templates',
    {
      method: 'POST',
      body: payload,
    },
  )
}

export async function deactivateCompetitionTeamTemplate(templateId: string) {
  return sendJson<CommandResponse<{ template: CompetitionTeamTemplate }>>(
    `/competitions/team-templates/${templateId}/deactivate`,
    {
      method: 'PATCH',
    },
  )
}

export async function updateCompetitionTeamTemplate(
  templateId: string,
  payload: UpdateCompetitionTeamTemplatePayload,
) {
  return sendJson<CommandResponse<{ template: CompetitionTeamTemplate }>>(
    `/competitions/team-templates/${templateId}`,
    {
      method: 'PUT',
      body: payload,
    },
  )
}

export async function cloneCompetitionTeamTemplate(
  templateId: string,
  payload: CloneCompetitionTeamTemplatePayload,
) {
  return sendJson<CommandResponse<{ template: CompetitionTeamTemplate }>>(
    `/competitions/team-templates/${templateId}/clone`,
    {
      method: 'POST',
      body: payload,
    },
  )
}

export async function createCompetitionStage(
  competitionId: string,
  payload: CreateCompetitionStagePayload,
) {
  return sendJson<CommandResponse<{ stage: CompetitionStageSummary }>>(
    `/competitions/${competitionId}/stages`,
    {
      method: 'POST',
      body: payload,
    },
  )
}

export async function createCompetitionStagePackage(
  competitionId: string,
  payload: CreateCompetitionStagePackagePayload,
) {
  return sendJson<CommandResponse<{ stages: CompetitionStageSummary[] }>>(
    `/competitions/${competitionId}/stage-packages`,
    {
      method: 'POST',
      body: payload,
    },
  )
}

export async function listCompetitionStagePackagePlans(competitionId: string) {
  return fetchOpenApiJson('/api/competitions/{competitionId}/stage-package-plans', {
    params: { competitionId },
  })
}

export async function createCompetitionStagePackagePlan(
  competitionId: string,
  payload: CreateCompetitionStagePackagePlanPayload,
) {
  return sendJson<CommandResponse<{ plan: CompetitionStagePackagePlan }>>(
    `/competitions/${competitionId}/stage-package-plans`,
    {
      method: 'POST',
      body: payload,
    },
  )
}

export async function updateCompetitionStagePackagePlan(
  planId: string,
  payload: UpdateCompetitionStagePackagePlanPayload,
) {
  return sendJson<CommandResponse<{ plan: CompetitionStagePackagePlan }>>(
    `/competitions/stage-package-plans/${planId}`,
    {
      method: 'PUT',
      body: payload,
    },
  )
}

export async function executeCompetitionStagePackagePlan(planId: string) {
  return sendJson<
    CommandResponse<{
      plan: CompetitionStagePackagePlan
      stages: CompetitionStageSummary[]
    }>
  >(`/competitions/stage-package-plans/${planId}/execute`, {
    method: 'POST',
  })
}

export async function submitCompetitionStagePackagePlan(planId: string) {
  return sendJson<CommandResponse<{ plan: CompetitionStagePackagePlan }>>(
    `/competitions/stage-package-plans/${planId}/submit`,
    {
      method: 'POST',
    },
  )
}

export async function approveCompetitionStagePackagePlan(
  planId: string,
  payload: ReviewCompetitionStagePackagePlanPayload,
) {
  return sendJson<CommandResponse<{ plan: CompetitionStagePackagePlan }>>(
    `/competitions/stage-package-plans/${planId}/approve`,
    {
      method: 'POST',
      body: payload,
    },
  )
}

export async function rejectCompetitionStagePackagePlan(
  planId: string,
  payload: ReviewCompetitionStagePackagePlanPayload,
) {
  return sendJson<CommandResponse<{ plan: CompetitionStagePackagePlan }>>(
    `/competitions/stage-package-plans/${planId}/reject`,
    {
      method: 'POST',
      body: payload,
    },
  )
}

export async function cloneCompetitionStagePackagePlan(planId: string) {
  return sendJson<CommandResponse<{ plan: CompetitionStagePackagePlan }>>(
    `/competitions/stage-package-plans/${planId}/clone`,
    {
      method: 'POST',
    },
  )
}

export async function cancelCompetitionStagePackagePlan(planId: string) {
  return sendJson<CommandResponse<{ plan: CompetitionStagePackagePlan }>>(
    `/competitions/stage-package-plans/${planId}/cancel`,
    {
      method: 'PATCH',
    },
  )
}

export async function listCompetitionStagePackagePlanAudit(planId: string) {
  return fetchOpenApiJson('/api/competitions/stage-package-plans/{planId}/audit', {
    params: { planId },
  })
}

export async function recalculateStage(stageId: string) {
  return sendJson<CommandResponse<{ stageId: string }>>(
    `/competitions/stages/${stageId}/recalculate`,
    {
      method: 'POST',
    },
  )
}

export async function finalizeStage(
  stageId: string,
  payload: {
    allowOverride: boolean
    overrideJustification?: string
  },
) {
  return sendJson<CommandResponse<{ stage: CompetitionStageSummary }>>(
    `/competitions/stages/${stageId}/finalize`,
    {
      method: 'PATCH',
      body: payload,
    },
  )
}
