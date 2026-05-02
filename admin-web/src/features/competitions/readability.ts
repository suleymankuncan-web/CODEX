import type {
  CompetitionDetail,
  CompetitionStoreContribution,
  CompetitionWarning,
} from './api'
import { defaultAppLocale, type AppLocale } from '../../lib/i18n'
import { translate, type TranslationKey } from '../localization/dictionary'

type ReadTone = 'calm' | 'warning' | 'accent' | 'danger' | 'neutral'

const kpiLabelKeyByCode: Record<string, TranslationKey> = {
  BM_CHECKLIST: 'competition.kpi.bmChecklist',
  VM_CHECKLIST: 'competition.kpi.vmChecklist',
  TARGET_ACHIEVEMENT: 'competition.kpi.targetAchievement',
  ATV: 'competition.kpi.atv',
  UPT: 'competition.kpi.upt',
  CR: 'competition.kpi.cr',
}

const warningTitleKeyByCode: Record<CompetitionWarning['warningCode'], TranslationKey> = {
  missing_daily_store_data: 'competition.warning.missingDailyStoreData',
  missing_bm_checklist: 'competition.warning.missingBmChecklist',
  missing_vm_checklist: 'competition.warning.missingVmChecklist',
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

export function buildCompetitionReadSummary(
  detail: CompetitionDetail,
  locale: AppLocale = defaultAppLocale,
): CompetitionReadSummary {
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
    (contribution) =>
      describeCompetitionContribution(contribution, locale).statusLabel !==
      translate(locale, 'competition.contribution.complete'),
  ).length
  const attentionCount = detail.warnings.length + partialContributionCount

  return {
    bestRankLabel: bestRank
      ? `${bestRank.rankPosition}/${bestRank.rankingPopulation}`
      : translate(locale, 'competition.read.noRankedTeam'),
    teamCoverageLabel:
      averageTeamCoverage === null
        ? translate(locale, 'competition.read.noTeamCoverage')
        : `${Math.round(averageTeamCoverage * 100)}% ${translate(locale, 'competition.read.teamCoverageSuffix')}`,
    contributionCoverageLabel:
      contributionCoverage === null
        ? translate(locale, 'competition.read.noContributionRows')
        : `${contributionCoverage}% ${translate(locale, 'competition.read.contributionCoverageSuffix')}`,
    attentionLabel:
      attentionCount > 0
        ? `${attentionCount} ${translate(locale, 'competition.read.attentionItemsSuffix')}`
        : translate(locale, 'competition.read.cleanRead'),
    explanation:
      attentionCount > 0
        ? translate(locale, 'competition.read.reviewBeforeFinal')
        : translate(locale, 'competition.read.completeContributionCoverage'),
    tone: attentionCount > 0 ? 'warning' : 'calm',
  }
}

export function describeCompetitionContribution(
  contribution: CompetitionStoreContribution,
  locale: AppLocale = defaultAppLocale,
): CompetitionContributionReadability {
  const coveragePercent =
    contribution.expectedWeightPercent > 0
      ? Math.round((contribution.reportedWeightPercent / contribution.expectedWeightPercent) * 100)
      : 0
  const missingLabels = contribution.missingKpiCodes.map((code) =>
    formatCompetitionKpiCode(code, locale),
  )

  if (!contribution.hasDailyData) {
    return {
      statusLabel: translate(locale, 'competition.contribution.missingDailyData'),
      tone: 'warning',
      coverageLabel: formatContributionCoverage(coveragePercent, locale),
      missingLabel:
        missingLabels.length > 0
          ? missingLabels.join(', ')
          : translate(locale, 'competition.contribution.dailyData'),
      explanation: translate(locale, 'competition.contribution.partialDailyExplanation'),
    }
  }

  if (missingLabels.length > 0 || contribution.scoreValue === null || coveragePercent < 100) {
    return {
      statusLabel: translate(locale, 'competition.contribution.partial'),
      tone: 'warning',
      coverageLabel: formatContributionCoverage(coveragePercent, locale),
      missingLabel:
        missingLabels.length > 0
          ? missingLabels.join(', ')
          : translate(locale, 'competition.contribution.someExpectedInputs'),
      explanation:
        missingLabels.length > 0
          ? formatPartialUntilMissing(locale, missingLabels)
          : translate(locale, 'competition.contribution.partialUntilInputs'),
    }
  }

  return {
    statusLabel: translate(locale, 'competition.contribution.complete'),
    tone: 'calm',
    coverageLabel: formatContributionCoverage(coveragePercent, locale),
    missingLabel: translate(locale, 'competition.contribution.none'),
    explanation: translate(locale, 'competition.contribution.completeExplanation'),
  }
}

export function describeCompetitionWarning(
  warning: CompetitionWarning,
  locale: AppLocale = defaultAppLocale,
): CompetitionWarningReadability {
  if (warning.warningCode === 'missing_daily_store_data') {
    return {
      title: translate(locale, warningTitleKeyByCode[warning.warningCode]),
      explanation: translate(locale, 'competition.warning.missingDailyStoreDataExplanation'),
      tone: warning.warningLevel === 'blocker' ? 'danger' : 'warning',
    }
  }

  if (warning.warningCode === 'missing_bm_checklist') {
    return {
      title: translate(locale, warningTitleKeyByCode[warning.warningCode]),
      explanation: translate(locale, 'competition.warning.missingBmChecklistExplanation'),
      tone: warning.warningLevel === 'blocker' ? 'danger' : 'warning',
    }
  }

  return {
    title: translate(locale, warningTitleKeyByCode[warning.warningCode]),
    explanation: translate(locale, 'competition.warning.missingVmChecklistExplanation'),
    tone: warning.warningLevel === 'blocker' ? 'danger' : 'warning',
  }
}

export function formatCompetitionKpiCode(code: string, locale: AppLocale = defaultAppLocale) {
  const key = kpiLabelKeyByCode[code]

  return key ? translate(locale, key) : code.replaceAll('_', ' ').toLowerCase()
}

function formatContributionCoverage(coveragePercent: number, locale: AppLocale) {
  return `${coveragePercent}% ${translate(locale, 'competition.read.contributionCoverageSuffix')}`
}

function formatPartialUntilMissing(locale: AppLocale, missingLabels: string[]) {
  if (locale === 'tr') {
    return `${missingLabels.join(', ')} gelene kadar skor kısmi.`
  }

  return `Score is partial until ${missingLabels.join(', ')} arrives.`
}
