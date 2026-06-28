import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { CalendarDays, Eye, Medal, RefreshCw, Trophy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { AuthSessionSummary } from '../features/auth/api'
import {
  getCompetition,
  listCompetitions,
  type CompetitionStoreContribution,
  type CompetitionWarning,
} from '../features/competitions/api'
import {
  buildCompetitionReadSummary,
  describeCompetitionContribution,
  describeCompetitionWarning,
  type CompetitionReadSummary,
} from '../features/competitions/readability'
import {
  formatCompetitionLifecycleState,
  formatCompetitionType,
} from '../features/competitions/display'
import { useLocalization } from '../features/localization/useLocalization'
import { formatDate, formatState, getErrorMessage } from '../lib/format'
import { transientQueryRetryOptions } from '../lib/query-retry'
import {
  StoreEmptyState,
  StoreErrorState,
  StoreInfoGrid,
  StoreLoadingState,
  StoreMetricCard,
  StoreMetricGrid,
  StoreSectionCard,
  StoreStackedList,
  StoreStackedRow,
  StoreStatusBadge,
  StoreSurfaceHeader,
  StoreSurfacePage,
} from './store-surface-primitives'

function canUseStoreCompetitions(authSummary: AuthSessionSummary | null) {
  const roles = authSummary?.user.roleCodes ?? []
  return roles.includes('STORE_MANAGER') || roles.includes('STORE_PERSONNEL')
}

function formatScore(value: number | null, partialLabel: string) {
  return value === null ? partialLabel : value.toFixed(2)
}

function formatRank(rank: number | null, population: number) {
  return rank !== null ? `${rank}/${population}` : `-/${population}`
}

export function StoreCompetitionsPage(input: {
  authSummary: AuthSessionSummary | null
}) {
  const { locale, t } = useLocalization()
  const enabled = canUseStoreCompetitions(input.authSummary)
  const [selectedCompetitionId, setSelectedCompetitionId] = useState<string | null>(null)
  const storeScopeCount = input.authSummary?.user.scope.storeIds.length ?? 0
  const competitionsQuery = useQuery({
    queryKey: ['store-competitions'],
    queryFn: listCompetitions,
    enabled,
    staleTime: 30_000,
    ...transientQueryRetryOptions,
  })

  const competitions = useMemo(
    () => competitionsQuery.data?.items ?? [],
    [competitionsQuery.data?.items],
  )
  const selectedCompetition = useMemo(
    () =>
      competitions.find((item) => item.competitionId === selectedCompetitionId) ??
      competitions[0] ??
      null,
    [competitions, selectedCompetitionId],
  )
  const detailQuery = useQuery({
    queryKey: ['store-competition-detail', selectedCompetition?.competitionId],
    queryFn: () => getCompetition(selectedCompetition!.competitionId),
    enabled: enabled && Boolean(selectedCompetition),
    staleTime: 15_000,
    ...transientQueryRetryOptions,
  })

  if (!enabled) {
    return (
      <StoreSurfacePage ariaLabel={t('storeCompetitions.unavailableTitle')}>
        <StoreErrorState
          title={t('storeCompetitions.unavailableTitle')}
          description={t('storeCompetitions.unavailableCopy')}
        />
      </StoreSurfacePage>
    )
  }

  if (competitionsQuery.isLoading) {
    return (
      <StoreLoadingState
        title={t('storeCompetitions.loadingTitle')}
        description={t('storeCompetitions.loadingCopy')}
      />
    )
  }

  if (competitionsQuery.isError) {
    return (
      <StoreSurfacePage ariaLabel={t('storeCompetitions.errorTitle')}>
        <StoreErrorState
          title={t('storeCompetitions.errorTitle')}
          description={getErrorMessage(competitionsQuery.error)}
          action={{
            disabled: competitionsQuery.isFetching,
            icon: <RefreshCw data-icon="inline-start" />,
            label: competitionsQuery.isFetching
              ? t('storeCompetitions.retryingAction')
              : t('storeCompetitions.retryAction'),
            onClick: () => void competitionsQuery.refetch(),
            variant: 'outline',
          }}
        />
      </StoreSurfacePage>
    )
  }

  const contributionCount = detailQuery.data?.storeContributions.length ?? 0
  const selectedCompetitionKey = selectedCompetition?.competitionId ?? ''

  return (
    <StoreSurfacePage ariaLabel={t('storeCompetitions.title')}>
      <StoreSurfaceHeader
        eyebrow={t('storeCompetitions.heroEyebrow')}
        title={t('storeCompetitions.title')}
        description={t('storeCompetitions.heroCopy')}
        badges={[
          {
            label: `${t('storeCompetitions.storeScope')}: ${
              storeScopeCount > 0 ? t('storeCompetitions.storeScopeCount', { count: storeScopeCount }) : t('storeCompetitions.noStoreScope')
            }`,
            tone: 'accent',
          },
          { label: `${t('storeCompetitions.competitions')}: ${competitions.length}`, tone: 'neutral' },
          { label: `${t('storeCompetitions.contributions')}: ${contributionCount}`, tone: 'calm' },
        ]}
      />

      <StoreSectionCard
        title={t('storeCompetitions.visibleChallenges')}
        description={t('storeCompetitions.competitionList')}
        badge={{ label: t('storeCompetitions.readOnly'), tone: 'neutral' }}
      >
        {competitions.length === 0 ? (
          <StoreEmptyState
            title={t('storeCompetitions.noVisibleTitle')}
            description={t('storeCompetitions.noVisibleCopy')}
          />
        ) : (
          <StoreStackedList>
            {competitions.map((competition) => (
              <StoreStackedRow
                key={competition.competitionId}
                tone={competition.competitionId === selectedCompetitionKey ? 'accent' : 'neutral'}
              >
                <div className="tw:flex tw:flex-col tw:gap-3">
                  <div className="tw:flex tw:flex-col tw:gap-3 tw:sm:flex-row tw:sm:items-start tw:sm:justify-between">
                    <div className="tw:min-w-0">
                      <h3 className="tw:text-base tw:font-semibold tw:leading-snug tw:text-foreground">
                        {competition.competitionName}
                      </h3>
                      <p className="tw:mt-1 tw:text-xs tw:text-muted-foreground">
                        {competition.competitionCode}
                      </p>
                    </div>
                    <Button
                      className="tw:w-full tw:sm:w-auto"
                      type="button"
                      variant={competition.competitionId === selectedCompetitionKey ? 'default' : 'outline'}
                      onClick={() => setSelectedCompetitionId(competition.competitionId)}
                    >
                      <Eye data-icon="inline-start" />
                      {t('storeCompetitions.review')}
                    </Button>
                  </div>
                  <StoreInfoGrid
                    items={[
                      {
                        label: t('storeCompetitions.type'),
                        value: formatCompetitionType(competition.competitionType, t),
                      },
                      {
                        label: t('storeCompetitions.state'),
                        value: formatCompetitionLifecycleState(competition.lifecycleState, t),
                        tone: 'accent',
                      },
                      {
                        label: t('storeCompetitions.starts'),
                        value: formatDate(competition.startsOn, locale),
                      },
                      {
                        label: t('storeCompetitions.ends'),
                        value: formatDate(competition.endsOn, locale),
                      },
                    ]}
                  />
                </div>
              </StoreStackedRow>
            ))}
          </StoreStackedList>
        )}
      </StoreSectionCard>

      {selectedCompetition ? (
        <>
          <StoreSectionCard
            title={selectedCompetition.competitionName}
            description={t('storeCompetitions.standing')}
            ariaLabel={t('storeCompetitions.readSummaryAria')}
            badge={{
              label: detailQuery.data?.warnings.length
                ? t('storeCompetitions.warningCount', { count: detailQuery.data.warnings.length })
                : t('competition.clean'),
              tone: detailQuery.data?.warnings.length ? 'warning' : 'calm',
            }}
          >
            {detailQuery.isLoading ? (
              <StoreEmptyState
                title={t('storeCompetitions.standingLoadingTitle')}
                description={t('storeCompetitions.standingLoadingCopy')}
              />
            ) : null}

            {detailQuery.isError ? (
              <StoreErrorState
                title={t('storeCompetitions.standingErrorTitle')}
                description={getErrorMessage(detailQuery.error)}
                action={{
                  disabled: detailQuery.isFetching,
                  icon: <RefreshCw data-icon="inline-start" />,
                  label: detailQuery.isFetching
                    ? t('storeCompetitions.retryingAction')
                    : t('storeCompetitions.retryAction'),
                  onClick: () => void detailQuery.refetch(),
                  variant: 'outline',
                }}
              />
            ) : null}

            {detailQuery.data ? (
              <CompetitionReadSummaryPanel summary={buildCompetitionReadSummary(detailQuery.data, locale)} />
            ) : null}
          </StoreSectionCard>

          {detailQuery.data ? (
            <>
              <StoreMetricGrid ariaLabel={t('storeCompetitions.standing')}>
                <StoreMetricCard
                  title={t('storeCompetitions.teams')}
                  value={detailQuery.data.latestScores.length}
                  note={t('storeCompetitions.teamsNote')}
                  icon={<Trophy data-icon="inline-start" />}
                  tone="accent"
                />
                <StoreMetricCard
                  title={t('storeCompetitions.contributionRows')}
                  value={detailQuery.data.storeContributions.length}
                  note={t('storeCompetitions.contributionRowsNote')}
                  icon={<Medal data-icon="inline-start" />}
                  tone={detailQuery.data.storeContributions.length > 0 ? 'calm' : 'neutral'}
                />
                <StoreMetricCard
                  title={t('storeCompetitions.warnings')}
                  value={detailQuery.data.warnings.length}
                  note={t('storeCompetitions.warningsNote')}
                  icon={<CalendarDays data-icon="inline-start" />}
                  tone={detailQuery.data.warnings.length > 0 ? 'warning' : 'neutral'}
                />
              </StoreMetricGrid>

              <TeamStandingSection
                scores={detailQuery.data.latestScores}
                partialScoreLabel={t('storeCompetitions.partialScore')}
              />
              <ScopedContributionSection contributions={detailQuery.data.storeContributions} />
              <ScopedWarningsSection warnings={detailQuery.data.warnings} />
            </>
          ) : null}
        </>
      ) : null}
    </StoreSurfacePage>
  )
}

function CompetitionReadSummaryPanel(input: { summary: CompetitionReadSummary }) {
  const { t } = useLocalization()

  return (
    <div className="tw:flex tw:flex-col tw:gap-3">
      <div className="tw:flex tw:flex-col tw:gap-2 tw:sm:flex-row tw:sm:items-start tw:sm:justify-between">
        <div>
          <p className="tw:text-xs tw:font-medium tw:text-muted-foreground">
            {t('competition.readScope')}
          </p>
          <h3 className="tw:text-base tw:font-semibold tw:text-foreground">
            {t('competition.readSummary')}
          </h3>
        </div>
        <StoreStatusBadge tone={input.summary.tone}>{input.summary.attentionLabel}</StoreStatusBadge>
      </div>
      <p className="tw:text-sm tw:leading-6 tw:text-muted-foreground">{input.summary.explanation}</p>
      <StoreInfoGrid
        items={[
          { label: t('competition.bestVisibleRank'), value: input.summary.bestRankLabel, tone: 'accent' },
          { label: t('competition.teamCoverage'), value: input.summary.teamCoverageLabel },
          { label: t('competition.contributionCoverage'), value: input.summary.contributionCoverageLabel },
        ]}
        className="tw:xl:grid-cols-3"
      />
    </div>
  )
}

function TeamStandingSection(input: {
  partialScoreLabel: string
  scores: Array<{
    rankPosition: number | null
    rankingPopulation: number
    scoreValue: number | null
    snapshotDate: string
    teamCode: string
    teamId: string
    teamName: string
    totalStoreCount: number
    validStoreCount: number
  }>
}) {
  const { locale, t } = useLocalization()

  return (
    <StoreSectionCard
      title={t('storeCompetitions.latestScores')}
      description={t('storeCompetitions.teamStanding')}
    >
      {input.scores.length === 0 ? (
        <StoreEmptyState description={t('storeCompetitions.noTeamSnapshot')} />
      ) : (
        <StoreStackedList>
          {input.scores.map((score) => (
            <StoreStackedRow key={`${score.teamId}-${score.snapshotDate}`}>
              <div className="tw:flex tw:flex-col tw:gap-3">
                <div className="tw:flex tw:flex-col tw:gap-2 tw:sm:flex-row tw:sm:items-start tw:sm:justify-between">
                  <div>
                    <h3 className="tw:text-base tw:font-semibold tw:text-foreground">{score.teamName}</h3>
                    <p className="tw:mt-1 tw:text-xs tw:text-muted-foreground">
                      {formatDate(score.snapshotDate, locale)}
                    </p>
                  </div>
                  <StoreStatusBadge tone="accent">
                    {formatRank(score.rankPosition, score.rankingPopulation)}
                  </StoreStatusBadge>
                </div>
                <StoreInfoGrid
                  items={[
                    {
                      label: t('storeCompetitions.score'),
                      value: formatScore(score.scoreValue, input.partialScoreLabel),
                      tone: 'accent',
                    },
                    {
                      label: t('storeCompetitions.coverage'),
                      value: `${score.validStoreCount}/${score.totalStoreCount}`,
                    },
                    { label: t('storeCompetitions.teamCode'), value: score.teamCode },
                  ]}
                  className="tw:xl:grid-cols-3"
                />
              </div>
            </StoreStackedRow>
          ))}
        </StoreStackedList>
      )}
    </StoreSectionCard>
  )
}

function ScopedContributionSection(input: { contributions: CompetitionStoreContribution[] }) {
  const { locale, t } = useLocalization()

  return (
    <StoreSectionCard
      title={t('competition.scopedContributions')}
      description={t('competition.readScope')}
      ariaLabel={t('storeCompetitions.scopedContributionsAria')}
    >
      {input.contributions.length === 0 ? (
        <StoreEmptyState description={t('competition.noScopedStoreContributionRowsCopy')} />
      ) : (
        <StoreStackedList>
          {input.contributions.map((contribution) => {
            const readability = describeCompetitionContribution(contribution, locale)

            return (
              <StoreStackedRow
                key={`${contribution.stageId}-${contribution.storeId}-${contribution.snapshotDate}`}
                tone={readability.tone}
              >
                <div className="tw:flex tw:flex-col tw:gap-3">
                  <div className="tw:flex tw:flex-col tw:gap-2 tw:sm:flex-row tw:sm:items-start tw:sm:justify-between">
                    <div>
                      <h3 className="tw:text-base tw:font-semibold tw:text-foreground">
                        {contribution.storeName}
                      </h3>
                      <p className="tw:mt-1 tw:text-xs tw:text-muted-foreground">
                        {contribution.teamName} / {contribution.storeCode}
                      </p>
                    </div>
                    <div className="tw:flex tw:flex-wrap tw:gap-2">
                      <StoreStatusBadge tone={contribution.hasDailyData ? 'calm' : 'warning'}>
                        {formatScore(contribution.scoreValue, t('storeCompetitions.partialScore'))}
                      </StoreStatusBadge>
                      <StoreStatusBadge tone={readability.tone}>{readability.statusLabel}</StoreStatusBadge>
                    </div>
                  </div>
                  <StoreInfoGrid
                    items={[
                      {
                        label: t('competition.snapshot'),
                        value: formatDate(contribution.snapshotDate, locale),
                      },
                      { label: t('competition.contributionHealth'), value: readability.statusLabel },
                      { label: t('competition.coverage'), value: readability.coverageLabel },
                      { label: t('competition.missingKpis'), value: readability.missingLabel },
                      {
                        label: t('competition.whyItMatters'),
                        value: readability.explanation,
                        tone: readability.tone,
                      },
                    ]}
                  />
                </div>
              </StoreStackedRow>
            )
          })}
        </StoreStackedList>
      )}
    </StoreSectionCard>
  )
}

function ScopedWarningsSection(input: { warnings: CompetitionWarning[] }) {
  const { locale, t } = useLocalization()

  return (
    <StoreSectionCard
      title={t('competition.scopedWarnings')}
      description={t('competition.dataQuality')}
      ariaLabel={t('storeCompetitions.scopedWarningsAria')}
      badge={{
        label: input.warnings.length > 0
          ? t('storeCompetitions.warningCount', { count: input.warnings.length })
          : t('competition.clean'),
        tone: input.warnings.length > 0 ? 'warning' : 'calm',
      }}
    >
      {input.warnings.length === 0 ? (
        <StoreEmptyState
          title={t('competition.noOpenWarnings')}
          description={t('competition.noScopedWarningsCopy')}
        />
      ) : (
        <StoreStackedList>
          {input.warnings.map((warning) => {
            const readability = describeCompetitionWarning(warning, locale)

            return (
              <StoreStackedRow key={warning.warningId} tone={readability.tone}>
                <div className="tw:flex tw:flex-col tw:gap-3">
                  <div className="tw:flex tw:flex-col tw:gap-2 tw:sm:flex-row tw:sm:items-start tw:sm:justify-between">
                    <div>
                      <h3 className="tw:text-base tw:font-semibold tw:text-foreground">{readability.title}</h3>
                      <p className="tw:mt-1 tw:text-sm tw:leading-6 tw:text-muted-foreground">
                        {readability.explanation}
                      </p>
                    </div>
                    <StoreStatusBadge tone={readability.tone}>
                      {formatState(warning.warningLevel)}
                    </StoreStatusBadge>
                  </div>
                  <StoreInfoGrid
                    items={[
                      { label: t('competition.warningCode'), value: formatState(warning.warningCode) },
                      { label: t('competition.periodStart'), value: formatDate(warning.periodStart, locale) },
                      { label: t('competition.periodEnd'), value: formatDate(warning.periodEnd, locale) },
                    ]}
                    className="tw:xl:grid-cols-3"
                  />
                </div>
              </StoreStackedRow>
            )
          })}
        </StoreStackedList>
      )}
    </StoreSectionCard>
  )
}
