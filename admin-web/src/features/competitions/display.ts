import { formatState } from '../../lib/format'
import type { TranslateFunction, TranslationKey } from '../localization/dictionary'
import type {
  CompetitionStagePackageCode,
  CompetitionStagePackagePlan,
  CompetitionStageSummary,
  CompetitionSummary,
} from './api'
import type { StagePresetCode } from './stage-presets'

type CompetitionLifecycleState = CompetitionSummary['lifecycleState']
type CompetitionType = CompetitionSummary['competitionType']
type CompetitionStageLifecycleState = CompetitionStageSummary['lifecycleState']
type CompetitionFinalizationState = NonNullable<CompetitionStageSummary['finalizationState']>
export type CompetitionDisplayTone = 'calm' | 'accent' | 'warning' | 'danger' | 'neutral'

const competitionLifecycleLabelKeys: Record<CompetitionLifecycleState, TranslationKey> = {
  draft: 'competition.admin.state.draft',
  published: 'competition.admin.state.published',
  active: 'competition.admin.state.active',
  completed: 'competition.admin.state.completed',
  cancelled: 'competition.admin.state.cancelled',
}

const competitionTypeLabelKeys: Record<CompetitionType, TranslationKey> = {
  region_challenge: 'competition.type.regionChallenge',
  region_league: 'competition.type.regionLeague',
  campaign: 'competition.type.campaign',
}

const competitionStageLifecycleLabelKeys: Record<CompetitionStageLifecycleState, TranslationKey> = {
  draft: 'competition.admin.state.draft',
  scheduled: 'competition.admin.state.scheduled',
  active: 'competition.admin.state.active',
  awaiting_review: 'competition.admin.state.awaitingReview',
  finalized: 'competition.admin.state.finalized',
  cancelled: 'competition.admin.state.cancelled',
}

const competitionFinalizationLabelKeys: Record<CompetitionFinalizationState, TranslationKey> = {
  clean: 'competition.admin.state.clean',
  warnings_present: 'competition.admin.state.warningsPresent',
  overridden: 'competition.admin.state.overridden',
}

export function competitionStateTone(state: string): CompetitionDisplayTone {
  if (state === 'active' || state === 'completed' || state === 'finalized' || state === 'clean') {
    return 'calm'
  }
  if (state === 'draft' || state === 'published' || state === 'scheduled') {
    return 'accent'
  }
  if (state === 'awaiting_review' || state === 'warnings_present' || state === 'overridden') {
    return 'warning'
  }
  if (state === 'cancelled') {
    return 'danger'
  }
  return 'neutral'
}

export function formatCompetitionLifecycleState(
  state: CompetitionLifecycleState,
  t: TranslateFunction,
) {
  return t(competitionLifecycleLabelKeys[state])
}

export function formatCompetitionStageState(
  state: CompetitionStageLifecycleState | CompetitionFinalizationState | string,
  t: TranslateFunction,
) {
  const key =
    competitionStageLifecycleLabelKeys[state as CompetitionStageLifecycleState] ??
    competitionFinalizationLabelKeys[state as CompetitionFinalizationState]

  return key ? t(key) : formatState(state)
}

export function formatCompetitionType(type: CompetitionType, t: TranslateFunction) {
  return t(competitionTypeLabelKeys[type])
}

export const stageTypeOptions: CompetitionStageSummary['stageType'][] = [
  'qualifier',
  'league',
  'quarter_final',
  'semi_final',
  'final',
  'custom',
]

const stageTypeLabelKeys: Record<CompetitionStageSummary['stageType'], TranslationKey> = {
  qualifier: 'competition.stageBuilder.stageType.qualifier',
  league: 'competition.stageBuilder.stageType.league',
  quarter_final: 'competition.stageBuilder.stageType.quarterFinal',
  semi_final: 'competition.stageBuilder.stageType.semiFinal',
  final: 'competition.stageBuilder.stageType.final',
  custom: 'competition.stageBuilder.stageType.custom',
}

export const stagePresetLabelKeys: Record<StagePresetCode, TranslationKey> = {
  region_league: 'competition.stageBuilder.preset.regionLeague',
  first_half_qualifier: 'competition.stageBuilder.preset.firstHalfQualifier',
  final_showdown: 'competition.stageBuilder.preset.finalShowdown',
}

export const stagePackageLabelKeys: Record<CompetitionStagePackageCode, TranslationKey> = {
  league_then_final: 'competition.stageBuilder.package.leagueThenFinal',
}

const planStatusLabelKeys: Record<CompetitionStagePackagePlan['planStatus'], TranslationKey> = {
  draft: 'competition.stageBuilder.status.draft',
  submitted: 'competition.stageBuilder.status.submitted',
  approved: 'competition.stageBuilder.status.approved',
  rejected: 'competition.stageBuilder.status.rejected',
  executed: 'competition.stageBuilder.status.executed',
  cancelled: 'competition.stageBuilder.status.cancelled',
}

export function formatStageType(stageType: CompetitionStageSummary['stageType'], t: TranslateFunction) {
  return t(stageTypeLabelKeys[stageType])
}

export function formatStagePreset(presetCode: StagePresetCode | undefined, t: TranslateFunction) {
  return presetCode ? t(stagePresetLabelKeys[presetCode]) : ''
}

export function formatStagePackage(packageCode: CompetitionStagePackageCode, t: TranslateFunction) {
  return t(stagePackageLabelKeys[packageCode])
}

export function formatPlanStatus(status: CompetitionStagePackagePlan['planStatus'], t: TranslateFunction) {
  return t(planStatusLabelKeys[status])
}

export function formatCount(
  value: number,
  singularKey: TranslationKey,
  pluralKey: TranslationKey,
  t: TranslateFunction,
) {
  return `${value} ${t(value === 1 ? singularKey : pluralKey)}`
}
