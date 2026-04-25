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

export type CreateCompetitionTeamTemplatePayload = {
  templateCode: string
  templateName: string
  description?: string
  storeIds: string[]
}

export async function listCompetitions() {
  return fetchJson<ListResponse<CompetitionSummary>>('/competitions')
}

export async function listCompetitionTeamTemplates() {
  return fetchJson<ListResponse<CompetitionTeamTemplate>>('/competitions/team-templates')
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
