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
import type { AppLocale } from '../lib/i18n'

function canUseStoreCompetitions(authSummary: AuthSessionSummary | null) {
  const roles = authSummary?.user.roleCodes ?? []
  return roles.includes('STORE_MANAGER') || roles.includes('STORE_PERSONNEL')
}

function formatScore(value: number | null, locale: AppLocale) {
  return value === null ? (locale === 'tr' ? 'Kısmi' : 'Partial') : value.toFixed(2)
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
  const primaryStoreId = input.authSummary?.user.scope.storeIds[0] ?? 'No store scope'
  const competitionsQuery = useQuery({
    queryKey: ['store-competitions'],
    queryFn: listCompetitions,
    enabled,
    retry: false,
    staleTime: 30_000,
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
    retry: false,
    staleTime: 15_000,
  })

  if (!enabled) {
    return (
      <ScreenState
        title="Competition surface unavailable"
        copy="This store route requires a store manager or store personnel session."
        tone="error"
      />
    )
  }

  if (competitionsQuery.isLoading) {
    return (
      <ScreenState
        title="Store competitions are loading"
        copy="The store shell is checking scoped competition standings."
      />
    )
  }

  if (competitionsQuery.isError) {
    return (
      <ScreenState
        title="Competition surface could not load"
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
          <div className="eyebrow">Store Competitions</div>
          <h2 className="hero-title">Store competitions and scoped contribution scores.</h2>
          <p className="hero-copy">
            Store users see active competition standings and the contribution rows that belong to
            their resolved read scope.
          </p>
        </div>
        <div className="hero-metrics">
          <MetricAccent label="Route" value="/store/competitions" />
          <MetricAccent label="Store scope" value={primaryStoreId} />
          <MetricAccent label="Competitions" value={String(competitions.length)} />
          <MetricAccent label="Contributions" value={String(contributionCount)} />
        </div>
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <div className="eyebrow">Competition List</div>
            <h3>Visible challenges</h3>
          </div>
          <StatusPill tone="neutral">Read only</StatusPill>
        </div>

        {competitions.length === 0 ? (
          <EmptyState
            title="No visible competitions"
            copy="Competitions appear here when at least one scoped store participates."
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
                    Review
                  </button>
                </div>
                <div className="key-grid">
                  <KeyValue label="Type" value={formatState(competition.competitionType)} />
                  <KeyValue label="State" value={formatState(competition.lifecycleState)} />
                  <KeyValue label="Starts" value={formatDate(competition.startsOn)} />
                  <KeyValue label="Ends" value={formatDate(competition.endsOn)} />
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
              <div className="eyebrow">Standing</div>
              <h3>{selectedCompetition.competitionName}</h3>
            </div>
            <StatusPill tone={detailQuery.data?.warnings.length ? 'warning' : 'calm'}>
              {detailQuery.data?.warnings.length
                ? `${detailQuery.data.warnings.length} warnings`
                : t('competition.clean')}
            </StatusPill>
          </div>

          {detailQuery.isLoading ? (
            <ScreenState title="Standing is loading" copy="Scoped competition detail is loading." />
          ) : null}

          {detailQuery.isError ? (
            <ScreenState
              title="Standing could not load"
              copy={getErrorMessage(detailQuery.error)}
              tone="error"
            />
          ) : null}

          {detailQuery.data ? (
            <div className="page-stack">
              <CompetitionReadSummaryPanel summary={buildCompetitionReadSummary(detailQuery.data, locale)} />

              <section className="metric-grid store-metric-grid">
                <MetricCard
                  title="Teams"
                  value={detailQuery.data.latestScores.length}
                  note="Current team standing rows visible for this competition."
                  icon={<Trophy size={18} />}
                  tone="accent"
                />
                <MetricCard
                  title="Contribution rows"
                  value={detailQuery.data.storeContributions.length}
                  note="Store contribution rows inside the current read scope."
                  icon={<Medal size={18} />}
                  tone={detailQuery.data.storeContributions.length > 0 ? 'calm' : 'neutral'}
                />
                <MetricCard
                  title="Warnings"
                  value={detailQuery.data.warnings.length}
                  note="Data quality warnings filtered by this session scope."
                  icon={<CalendarDays size={18} />}
                  tone={detailQuery.data.warnings.length > 0 ? 'warning' : 'neutral'}
                />
              </section>

              <section className="stacked-table">
                <div className="panel-heading">
                  <div>
                    <div className="eyebrow">Team Standing</div>
                    <h3>Latest scores</h3>
                  </div>
                </div>
                {detailQuery.data.latestScores.length === 0 ? (
                  <EmptyState copy="No team score snapshot is available yet." />
                ) : (
                  detailQuery.data.latestScores.map((score) => (
                    <article className="stacked-row" key={`${score.teamId}-${score.snapshotDate}`}>
                      <div className="stacked-row-head">
                        <div>
                          <strong>{score.teamName}</strong>
                          <p className="queue-subtitle">{formatDate(score.snapshotDate)}</p>
                        </div>
                        <StatusPill tone="accent">
                          {formatRank(score.rankPosition, score.rankingPopulation)}
                        </StatusPill>
                      </div>
                      <div className="key-grid">
                        <KeyValue label="Score" value={formatScore(score.scoreValue, locale)} />
                        <KeyValue
                          label="Coverage"
                          value={`${score.validStoreCount}/${score.totalStoreCount}`}
                        />
                        <KeyValue label="Team code" value={score.teamCode} />
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
    <section className="stacked-table" aria-label="Store competition read summary">
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
    <section className="stacked-table" aria-label="Scoped store competition contributions">
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
                    {formatScore(contribution.scoreValue, locale)}
                  </StatusPill>
                  <StatusPill tone={readability.tone}>{readability.statusLabel}</StatusPill>
                </div>
              </div>
              <div className="key-grid">
                <KeyValue label={t('competition.snapshot')} value={formatDate(contribution.snapshotDate)} />
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
    <section className="stacked-table" aria-label="Scoped store competition warnings">
      <div className="panel-heading">
        <div>
          <div className="eyebrow">{t('competition.dataQuality')}</div>
          <h3>{t('competition.scopedWarnings')}</h3>
        </div>
        <StatusPill tone={input.warnings.length > 0 ? 'warning' : 'calm'}>
          {input.warnings.length > 0 ? `${input.warnings.length} warnings` : t('competition.clean')}
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
                <KeyValue label={t('competition.periodStart')} value={formatDate(warning.periodStart)} />
                <KeyValue label={t('competition.periodEnd')} value={formatDate(warning.periodEnd)} />
              </div>
            </article>
          )
        })
      )}
    </section>
  )
}
