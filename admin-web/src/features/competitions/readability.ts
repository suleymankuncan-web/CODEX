import type {
  CompetitionDetail,
  CompetitionStoreContribution,
  CompetitionWarning,
} from './api'

type ReadTone = 'calm' | 'warning' | 'accent' | 'danger' | 'neutral'

const kpiLabelByCode: Record<string, string> = {
  BM_CHECKLIST: 'BM checklist',
  VM_CHECKLIST: 'VM checklist',
  TARGET_ACHIEVEMENT: 'Target achievement',
  ATV: 'ATV',
  UPT: 'UPT',
  CR: 'CR',
}

const warningTitleByCode: Record<CompetitionWarning['warningCode'], string> = {
  missing_daily_store_data: 'Missing daily store data',
  missing_bm_checklist: 'Missing BM checklist',
  missing_vm_checklist: 'Missing VM checklist',
}

export type CompetitionReadSummary = {
  bestRankLabel: string
  teamCoverageLabel: string
  contributionCoverageLabel: string
  attentionLabel: string
  explanation: string
  tone: ReadTone
}

export type CompetitionContributionReadability = {
  statusLabel: string
  tone: ReadTone
  coverageLabel: string
  missingLabel: string
  explanation: string
}

export type CompetitionWarningReadability = {
  title: string
  explanation: string
  tone: ReadTone
}

export function buildCompetitionReadSummary(detail: CompetitionDetail): CompetitionReadSummary {
  const rankedScores = detail.latestScores
    .filter((score) => score.rankPosition !== null)
    .sort((left, right) => (left.rankPosition ?? 0) - (right.rankPosition ?? 0))
  const bestRank = rankedScores[0] ?? null
  const averageTeamCoverage =
    detail.latestScores.length > 0
      ? detail.latestScores.reduce((sum, score) => sum + score.coverageRate, 0) /
        detail.latestScores.length
      : null
  const expectedContributionWeight = detail.storeContributions.reduce(
    (sum, contribution) => sum + contribution.expectedWeightPercent,
    0,
  )
  const reportedContributionWeight = detail.storeContributions.reduce(
    (sum, contribution) => sum + contribution.reportedWeightPercent,
    0,
  )
  const contributionCoverage =
    expectedContributionWeight > 0
      ? Math.round((reportedContributionWeight / expectedContributionWeight) * 100)
      : null
  const partialContributionCount = detail.storeContributions.filter(
    (contribution) => describeCompetitionContribution(contribution).statusLabel !== 'Complete contribution',
  ).length
  const attentionCount = detail.warnings.length + partialContributionCount

  return {
    bestRankLabel: bestRank
      ? `${bestRank.rankPosition}/${bestRank.rankingPopulation}`
      : 'No ranked team yet',
    teamCoverageLabel:
      averageTeamCoverage === null
        ? 'No team coverage'
        : `${Math.round(averageTeamCoverage * 100)}% team coverage`,
    contributionCoverageLabel:
      contributionCoverage === null
        ? 'No contribution rows'
        : `${contributionCoverage}% contribution coverage`,
    attentionLabel: attentionCount > 0 ? `${attentionCount} attention items` : 'Clean read',
    explanation:
      attentionCount > 0
        ? 'Review warning and partial rows before treating this standing as final.'
        : 'Visible scores have complete contribution coverage.',
    tone: attentionCount > 0 ? 'warning' : 'calm',
  }
}

export function describeCompetitionContribution(
  contribution: CompetitionStoreContribution,
): CompetitionContributionReadability {
  const coveragePercent =
    contribution.expectedWeightPercent > 0
      ? Math.round((contribution.reportedWeightPercent / contribution.expectedWeightPercent) * 100)
      : 0
  const missingLabels = contribution.missingKpiCodes.map(formatCompetitionKpiCode)

  if (!contribution.hasDailyData) {
    return {
      statusLabel: 'Missing daily data',
      tone: 'warning',
      coverageLabel: `${coveragePercent}% contribution coverage`,
      missingLabel: missingLabels.length > 0 ? missingLabels.join(', ') : 'Daily data',
      explanation: 'Daily store data is missing for this snapshot; score remains partial.',
    }
  }

  if (missingLabels.length > 0 || contribution.scoreValue === null || coveragePercent < 100) {
    return {
      statusLabel: 'Partial contribution',
      tone: 'warning',
      coverageLabel: `${coveragePercent}% contribution coverage`,
      missingLabel: missingLabels.length > 0 ? missingLabels.join(', ') : 'Some expected inputs',
      explanation:
        missingLabels.length > 0
          ? `Score is partial until ${missingLabels.join(', ')} arrives.`
          : 'Score is partial until every expected input is reported.',
    }
  }

  return {
    statusLabel: 'Complete contribution',
    tone: 'calm',
    coverageLabel: `${coveragePercent}% contribution coverage`,
    missingLabel: 'None',
    explanation: 'All expected inputs are present for this snapshot.',
  }
}

export function describeCompetitionWarning(
  warning: CompetitionWarning,
): CompetitionWarningReadability {
  if (warning.warningCode === 'missing_daily_store_data') {
    return {
      title: warningTitleByCode[warning.warningCode],
      explanation: 'Daily store data is missing for this period; scores may stay partial.',
      tone: warning.warningLevel === 'blocker' ? 'danger' : 'warning',
    }
  }

  if (warning.warningCode === 'missing_bm_checklist') {
    return {
      title: warningTitleByCode[warning.warningCode],
      explanation: 'BM checklist is missing for this period; review before finalizing.',
      tone: warning.warningLevel === 'blocker' ? 'danger' : 'warning',
    }
  }

  return {
    title: warningTitleByCode[warning.warningCode],
    explanation: 'VM checklist is missing for this period; review before finalizing.',
    tone: warning.warningLevel === 'blocker' ? 'danger' : 'warning',
  }
}

export function formatCompetitionKpiCode(code: string) {
  return kpiLabelByCode[code] ?? code.replaceAll('_', ' ').toLowerCase()
}
