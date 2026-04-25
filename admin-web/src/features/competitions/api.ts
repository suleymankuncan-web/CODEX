import { fetchJson, sendJson } from '../../lib/api'
import type { StagePresetCode } from './stage-presets'

type ListResponse<T> = {
  items: T[]
  meta: {
    count: number
    total: number
    limit: number
    offset: number
  }
}

type CommandResponse<TData> = {
  command: {
    status: string
    message: string
  }
  data: TData
}

export type CompetitionSummary = {
  competitionId: string
  competitionCode: string
  competitionName: string
  description: string | null
  competitionType: 'region_challenge' | 'region_league' | 'campaign'
  lifecycleState: 'draft' | 'published' | 'active' | 'completed' | 'cancelled'
  startsOn: string
  endsOn: string
}

export type CompetitionStageSummary = {
  competitionStageId: string
  competitionId: string
  stageCode: string
  stageName: string
  stageOrder: number
  stageType: 'qualifier' | 'league' | 'quarter_final' | 'semi_final' | 'final' | 'custom'
  startsOn: string
  endsOn: string
  lifecycleState: 'draft' | 'scheduled' | 'active' | 'awaiting_review' | 'finalized' | 'cancelled'
  finalizationState: 'clean' | 'warnings_present' | 'overridden' | null
}

export type CompetitionTeamScore = {
  stageId: string
  teamId: string
  teamCode: string
  teamName: string
  snapshotDate: string
  scoreValue: number | null
  validStoreCount: number
  totalStoreCount: number
  coverageRate: number
  rankPosition: number | null
  rankingPopulation: number
}

export type CompetitionStoreContribution = {
  stageId: string
  teamId: string
  teamCode: string
  teamName: string
  storeId: string
  storeCode: string
  storeName: string
  regionId: string
  snapshotDate: string
  scoreValue: number | null
  reportedWeightPercent: number
  expectedWeightPercent: number
  hasDailyData: boolean
  missingKpiCodes: string[]
}

export type CompetitionTeamTemplate = {
  templateId: string
  templateCode: string
  templateName: string
  description: string | null
  isActive: boolean
  stores: Array<{
    storeId: string
    storeCode: string
    storeName: string
    regionId: string
  }>
}

export type CompetitionWarning = {
  warningId: string
  stageId: string
  teamId: string | null
  storeId: string | null
  warningCode: 'missing_daily_store_data' | 'missing_bm_checklist' | 'missing_vm_checklist'
  warningLevel: 'info' | 'warning' | 'blocker'
  periodStart: string
  periodEnd: string
  message: string
  resolvedAt: string | null
}

export type CompetitionDetail = {
  competition: CompetitionSummary
  stages: CompetitionStageSummary[]
  teams: Array<{
    competitionTeamId: string
    teamCode: string
    teamName: string
    teamOrder: number
    stores: Array<{
      storeId: string
      storeCode: string
      storeName: string
      regionId: string
    }>
  }>
  latestScores: CompetitionTeamScore[]
  warnings: CompetitionWarning[]
  storeContributions: CompetitionStoreContribution[]
}

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

export type CompetitionStagePackagePlanStatus = 'draft' | 'executed' | 'cancelled'

export type CompetitionStagePackagePlan = {
  planId: string
  competitionId: string
  packageCode: CompetitionStagePackageCode
  planName: string
  planStatus: CompetitionStagePackagePlanStatus
  stageDrafts: CreateCompetitionStagePayload[]
  createdStageIds: string[]
  createdAt: string
  updatedAt: string
  executedAt: string | null
}

export type CreateCompetitionStagePackagePlanPayload = CreateCompetitionStagePackagePayload & {
  planName: string
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
  return fetchJson<ListResponse<CompetitionSummary>>('/competitions')
}

export async function listCompetitionTeamTemplates(input?: { activeOnly?: boolean }) {
  const params = new URLSearchParams()

  if (input?.activeOnly !== undefined) {
    params.set('activeOnly', String(input.activeOnly))
  }

  const query = params.toString()
  return fetchJson<ListResponse<CompetitionTeamTemplate>>(
    `/competitions/team-templates${query ? `?${query}` : ''}`,
  )
}

export async function getCompetition(competitionId: string) {
  return fetchJson<CompetitionDetail>(`/competitions/${competitionId}`)
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
  return fetchJson<ListResponse<CompetitionStagePackagePlan>>(
    `/competitions/${competitionId}/stage-package-plans`,
  )
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
