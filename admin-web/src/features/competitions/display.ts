import type { Tone } from '../../components/dashboard-primitives'
import { formatState } from '../../lib/format'
import type { TranslateFunction, TranslationKey } from '../localization/dictionary'
import type { CompetitionStageSummary, CompetitionSummary } from './api'

type CompetitionLifecycleState = CompetitionSummary['lifecycleState']
type CompetitionType = CompetitionSummary['competitionType']
type CompetitionStageLifecycleState = CompetitionStageSummary['lifecycleState']
type CompetitionFinalizationState = NonNullable<CompetitionStageSummary['finalizationState']>

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

export function competitionStateTone(state: string): Tone {
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
