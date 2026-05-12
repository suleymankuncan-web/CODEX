import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { CalendarDays, Medal, Trophy } from 'lucide-react'
import {
  EmptyState,
  KeyValue,
  MetricAccent,
  MetricCard,
  ScreenState,
  StatusPill,
} from '../components/dashboard-primitives'
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
import { useLocalization } from '../features/localization/useLocalization'
import { formatDate, formatState, getErrorMessage } from '../lib/format'
import { transientQueryRetryOptions } from '../lib/query-retry'

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
  const primaryStoreId = input.authSummary?.user.scope.storeIds[0] ?? t('storeCompetitions.noStoreScope')
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
      <ScreenState
        title={t('storeCompetitions.unavailableTitle')}
        copy={t('storeCompetitions.unavailableCopy')}
        tone="error"
      />
    )
  }

  if (competitionsQuery.isLoading) {
    return (
      <ScreenState
        title={t('storeCompetitions.loadingTitle')}
        copy={t('storeCompetitions.loadingCopy')}
      />
    )
  }

  if (competitionsQuery.isError) {
    return (
      <ScreenState
        title={t('storeCompetitions.errorTitle')}
        copy={getErrorMessage(competitionsQuery.error)}
        tone="error"
      />
    )
  }

  const contributionCount = detailQuery.data?.storeContributions.length ?? 0

  return (
    <section className="page-stack">
      <section className="hero-panel store-hero-panel">
        <div>
          <div className="eyebrow">{t('storeCompetitions.heroEyebrow')}</div>
          <h2 className="hero-title">{t('storeCompetitions.title')}</h2>
          <p className="hero-copy">{t('storeCompetitions.heroCopy')}</p>
        </div>
        <div className="hero-metrics">
          <MetricAccent label={t('storeCompetitions.route')} value="/store/competitions" />
          <MetricAccent label={t('storeCompetitions.storeScope')} value={primaryStoreId} />
          <MetricAccent label={t('storeCompetitions.competitions')} value={String(competitions.length)} />
          <MetricAccent label={t('storeCompetitions.contributions')} value={String(contributionCount)} />
        </div>
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <div className="eyebrow">{t('storeCompetitions.competitionList')}</div>
            <h3>{t('storeCompetitions.visibleChallenges')}</h3>
          </div>
          <StatusPill tone="neutral">{t('storeCompetitions.readOnly')}</StatusPill>
        </div>

        {competitions.length === 0 ? (
          <EmptyState
            title={t('storeCompetitions.noVisibleTitle')}
            copy={t('storeCompetitions.noVisibleCopy')}
          />
        ) : (
          <div className="stacked-table">
            {competitions.map((competition) => (
              <article className="stacked-row" key={competition.competitionId}>
                <div className="stacked-row-head">
                  <div>
                    <strong>{competition.competitionName}</strong>
                    <p className="queue-subtitle">{competition.competitionCode}</p>
                  </div>
                  <button
                    className="control-button"
                    type="button"
                    onClick={() => setSelectedCompetitionId(competition.competitionId)}
                  >
                    {t('storeCompetitions.review')}
                  </button>
                </div>
                <div className="key-grid">
                  <KeyValue label={t('storeCompetitions.type')} value={formatState(competition.competitionType)} />
                  <KeyValue label={t('storeCompetitions.state')} value={formatState(competition.lifecycleState)} />
                  <KeyValue label={t('storeCompetitions.starts')} value={formatDate(competition.startsOn, locale)} />
                  <KeyValue label={t('storeCompetitions.ends')} value={formatDate(competition.endsOn, locale)} />
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {selectedCompetition ? (
        <section className="panel">
          <div className="panel-heading">
            <div>
              <div className="eyebrow">{t('storeCompetitions.standing')}</div>
              <h3>{selectedCompetition.competitionName}</h3>
            </div>
            <StatusPill tone={detailQuery.data?.warnings.length ? 'warning' : 'calm'}>
              {detailQuery.data?.warnings.length
                ? t('storeCompetitions.warningCount', { count: detailQuery.data.warnings.length })
                : t('competition.clean')}
            </StatusPill>
          </div>

          {detailQuery.isLoading ? (
            <ScreenState
              title={t('storeCompetitions.standingLoadingTitle')}
              copy={t('storeCompetitions.standingLoadingCopy')}
            />
          ) : null}

          {detailQuery.isError ? (
            <ScreenState
              title={t('storeCompetitions.standingErrorTitle')}
              copy={getErrorMessage(detailQuery.error)}
              tone="error"
            />
          ) : null}

          {detailQuery.data ? (
            <div className="page-stack">
              <CompetitionReadSummaryPanel summary={buildCompetitionReadSummary(detailQuery.data, locale)} />

              <section className="metric-grid store-metric-grid">
                <MetricCard
                  title={t('storeCompetitions.teams')}
                  value={detailQuery.data.latestScores.length}
                  note={t('storeCompetitions.teamsNote')}
                  icon={<Trophy size={18} />}
                  tone="accent"
                />
                <MetricCard
                  title={t('storeCompetitions.contributionRows')}
                  value={detailQuery.data.storeContributions.length}
                  note={t('storeCompetitions.contributionRowsNote')}
                  icon={<Medal size={18} />}
                  tone={detailQuery.data.storeContributions.length > 0 ? 'calm' : 'neutral'}
                />
                <MetricCard
                  title={t('storeCompetitions.warnings')}
                  value={detailQuery.data.warnings.length}
                  note={t('storeCompetitions.warningsNote')}
                  icon={<CalendarDays size={18} />}
                  tone={detailQuery.data.warnings.length > 0 ? 'warning' : 'neutral'}
                />
              </section>

              <section className="stacked-table">
                <div className="panel-heading">
                  <div>
                    <div className="eyebrow">{t('storeCompetitions.teamStanding')}</div>
                    <h3>{t('storeCompetitions.latestScores')}</h3>
                  </div>
                </div>
                {detailQuery.data.latestScores.length === 0 ? (
                  <EmptyState copy={t('storeCompetitions.noTeamSnapshot')} />
                ) : (
                  detailQuery.data.latestScores.map((score) => (
                    <article className="stacked-row" key={`${score.teamId}-${score.snapshotDate}`}>
                      <div className="stacked-row-head">
                        <div>
                          <strong>{score.teamName}</strong>
                          <p className="queue-subtitle">{formatDate(score.snapshotDate, locale)}</p>
                        </div>
                        <StatusPill tone="accent">
                          {formatRank(score.rankPosition, score.rankingPopulation)}
                        </StatusPill>
                      </div>
                      <div className="key-grid">
                        <KeyValue
                          label={t('storeCompetitions.score')}
                          value={formatScore(score.scoreValue, t('storeCompetitions.partialScore'))}
                        />
                        <KeyValue
                          label={t('storeCompetitions.coverage')}
                          value={`${score.validStoreCount}/${score.totalStoreCount}`}
                        />
                        <KeyValue label={t('storeCompetitions.teamCode')} value={score.teamCode} />
                      </div>
                    </article>
                  ))
                )}
              </section>

              <ScopedContributionSection contributions={detailQuery.data.storeContributions} />
              <ScopedWarningsSection warnings={detailQuery.data.warnings} />
            </div>
          ) : null}
        </section>
      ) : null}
    </section>
  )
}

function CompetitionReadSummaryPanel(input: { summary: CompetitionReadSummary }) {
  const { t } = useLocalization()

  return (
    <section className="stacked-table" aria-label={t('storeCompetitions.readSummaryAria')}>
      <div className="panel-heading">
        <div>
          <div className="eyebrow">{t('competition.readScope')}</div>
          <h3>{t('competition.readSummary')}</h3>
        </div>
        <StatusPill tone={input.summary.tone}>{input.summary.attentionLabel}</StatusPill>
      </div>
      <article className="stacked-row">
        <p className="queue-subtitle">{input.summary.explanation}</p>
        <div className="key-grid">
          <KeyValue label={t('competition.bestVisibleRank')} value={input.summary.bestRankLabel} />
          <KeyValue label={t('competition.teamCoverage')} value={input.summary.teamCoverageLabel} />
          <KeyValue label={t('competition.contributionCoverage')} value={input.summary.contributionCoverageLabel} />
        </div>
      </article>
    </section>
  )
}

function ScopedContributionSection(input: { contributions: CompetitionStoreContribution[] }) {
  const { locale, t } = useLocalization()

  return (
    <section className="stacked-table" aria-label={t('storeCompetitions.scopedContributionsAria')}>
      <div className="panel-heading">
        <div>
          <div className="eyebrow">{t('competition.readScope')}</div>
          <h3>{t('competition.scopedContributions')}</h3>
        </div>
      </div>
      {input.contributions.length === 0 ? (
        <EmptyState copy={t('competition.noScopedStoreContributionRowsCopy')} />
      ) : (
        input.contributions.map((contribution) => {
          const readability = describeCompetitionContribution(contribution, locale)

          return (
            <article
              className="stacked-row"
              key={`${contribution.stageId}-${contribution.storeId}-${contribution.snapshotDate}`}
            >
              <div className="stacked-row-head">
                <div>
                  <strong>{contribution.storeName}</strong>
                  <p className="queue-subtitle">
                    {contribution.teamName} / {contribution.storeCode}
                  </p>
                </div>
                <div className="action-cluster">
                  <StatusPill tone={contribution.hasDailyData ? 'calm' : 'warning'}>
                    {formatScore(contribution.scoreValue, t('storeCompetitions.partialScore'))}
                  </StatusPill>
                  <StatusPill tone={readability.tone}>{readability.statusLabel}</StatusPill>
                </div>
              </div>
              <div className="key-grid">
                <KeyValue
                  label={t('competition.snapshot')}
                  value={formatDate(contribution.snapshotDate, locale)}
                />
                <KeyValue label={t('competition.contributionHealth')} value={readability.statusLabel} />
                <KeyValue label={t('competition.coverage')} value={readability.coverageLabel} />
                <KeyValue label={t('competition.missingKpis')} value={readability.missingLabel} />
                <KeyValue label={t('competition.whyItMatters')} value={readability.explanation} />
              </div>
            </article>
          )
        })
      )}
    </section>
  )
}

function ScopedWarningsSection(input: { warnings: CompetitionWarning[] }) {
  const { locale, t } = useLocalization()

  return (
    <section className="stacked-table" aria-label={t('storeCompetitions.scopedWarningsAria')}>
      <div className="panel-heading">
        <div>
          <div className="eyebrow">{t('competition.dataQuality')}</div>
          <h3>{t('competition.scopedWarnings')}</h3>
        </div>
        <StatusPill tone={input.warnings.length > 0 ? 'warning' : 'calm'}>
          {input.warnings.length > 0
            ? t('storeCompetitions.warningCount', { count: input.warnings.length })
            : t('competition.clean')}
        </StatusPill>
      </div>
      {input.warnings.length === 0 ? (
        <EmptyState title={t('competition.noOpenWarnings')} copy={t('competition.noScopedWarningsCopy')} />
      ) : (
        input.warnings.map((warning) => {
          const readability = describeCompetitionWarning(warning, locale)

          return (
            <article className="stacked-row" key={warning.warningId}>
              <div className="stacked-row-head">
                <div>
                  <strong>{readability.title}</strong>
                  <p className="queue-subtitle">{readability.explanation}</p>
                </div>
                <StatusPill tone={readability.tone}>{formatState(warning.warningLevel)}</StatusPill>
              </div>
              <div className="key-grid">
                <KeyValue label={t('competition.warningCode')} value={formatState(warning.warningCode)} />
                <KeyValue label={t('competition.periodStart')} value={formatDate(warning.periodStart, locale)} />
                <KeyValue label={t('competition.periodEnd')} value={formatDate(warning.periodEnd, locale)} />
              </div>
            </article>
          )
        })
      )}
    </section>
  )
}
