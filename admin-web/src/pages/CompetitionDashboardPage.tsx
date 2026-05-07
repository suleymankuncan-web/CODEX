import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, RefreshCw, ShieldAlert, Trophy } from 'lucide-react'
import {
  EmptyState,
  KeyValue,
  MetricAccent,
  ScreenState,
  StatusPill,
} from '../components/dashboard-primitives'
import {
  createCompetition,
  finalizeStage,
  getCompetition,
  listCompetitions,
  recalculateStage,
  type CompetitionStoreContribution,
  type CompetitionSummary,
  type CompetitionWarning,
} from '../features/competitions/api'
import {
  buildCompetitionReadSummary,
  describeCompetitionContribution,
  describeCompetitionWarning,
  type CompetitionReadSummary,
} from '../features/competitions/readability'
import { StageBuilderForm } from '../features/competitions/StageBuilderForm'
import type { AuthSessionSummary } from '../features/auth/api'
import type { TranslateFunction, TranslationKey } from '../features/localization/dictionary'
import { useLocalization } from '../features/localization/useLocalization'
import { formatDate, formatState, getErrorMessage } from '../lib/format'

function nextDraftPayload() {
  const startsOn = new Date()
  const endsOn = new Date(startsOn.getTime() + 14 * 24 * 60 * 60 * 1000)
  const dateCode = startsOn.toISOString().slice(0, 10).replaceAll('-', '_')

  return {
    competitionCode: `REGION_CHALLENGE_${dateCode}`,
    competitionName: 'Region Challenge Draft',
    competitionType: 'region_challenge' as const,
    startsOn: startsOn.toISOString().slice(0, 10),
    endsOn: endsOn.toISOString().slice(0, 10),
  }
}

function stateTone(state: string) {
  if (state === 'active' || state === 'finalized' || state === 'clean') return 'calm'
  if (state === 'draft' || state === 'scheduled') return 'accent'
  if (state === 'awaiting_review' || state === 'warnings_present' || state === 'overridden') {
    return 'warning'
  }
  if (state === 'cancelled') return 'danger'
  return 'neutral'
}

function canManageCompetitions(authSummary: AuthSessionSummary | null) {
  const roles = authSummary?.user.roleCodes ?? []
  return roles.includes('SUPER_ADMIN') || roles.includes('HR_ADMIN')
}

const competitionStateLabels: Record<string, TranslationKey> = {
  active: 'competition.admin.state.active',
  finalized: 'competition.admin.state.finalized',
  clean: 'competition.admin.state.clean',
  draft: 'competition.admin.state.draft',
  scheduled: 'competition.admin.state.scheduled',
  awaiting_review: 'competition.admin.state.awaitingReview',
  warnings_present: 'competition.admin.state.warningsPresent',
  overridden: 'competition.admin.state.overridden',
  cancelled: 'competition.admin.state.cancelled',
  region_challenge: 'competition.admin.state.regionChallenge',
}

function formatCompetitionState(state: string, t: TranslateFunction) {
  const key = competitionStateLabels[state]
  return key ? t(key) : formatState(state)
}

function formatScore(value: number | null, t: TranslateFunction) {
  return value === null ? t('competition.admin.partialScore') : value.toFixed(2)
}

export function CompetitionDashboardPage(input: { authSummary: AuthSessionSummary | null }) {
  const { locale, t } = useLocalization()
  const queryClient = useQueryClient()
  const [selectedCompetitionId, setSelectedCompetitionId] = useState<string | null>(null)
  const [overrideJustification, setOverrideJustification] = useState('')
  const canManage = canManageCompetitions(input.authSummary)

  const competitionsQuery = useQuery({
    queryKey: ['competitions'],
    queryFn: listCompetitions,
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
    queryKey: ['competition-detail', selectedCompetition?.competitionId],
    queryFn: () => getCompetition(selectedCompetition!.competitionId),
    enabled: Boolean(selectedCompetition),
    staleTime: 15_000,
  })

  const createMutation = useMutation({
    mutationFn: () => createCompetition(nextDraftPayload()),
    onSuccess: (result) => {
      setSelectedCompetitionId(result.data.competition.competitionId)
      queryClient.invalidateQueries({ queryKey: ['competitions'] })
    },
  })

  const recalcMutation = useMutation({
    mutationFn: (stageId: string) => recalculateStage(stageId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['competition-detail'] }),
  })

  const finalizeMutation = useMutation({
    mutationFn: (stageId: string) =>
      finalizeStage(stageId, {
        allowOverride: overrideJustification.trim().length >= 12,
        overrideJustification: overrideJustification.trim() || undefined,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['competition-detail'] }),
  })

  if (competitionsQuery.isLoading) {
    return (
      <ScreenState
        title={t('competition.admin.loadingTitle')}
        copy={t('competition.admin.loadingCopy')}
      />
    )
  }

  if (competitionsQuery.isError) {
    return (
      <ScreenState
        title={t('competition.admin.errorTitle')}
        copy={getErrorMessage(competitionsQuery.error)}
        tone="error"
      />
    )
  }

  const warningCount = detailQuery.data?.warnings.length ?? 0
  const activeStage = detailQuery.data?.stages[0] ?? null

  return (
    <section className="page-stack">
      <section className="hero-panel">
        <div>
          <div className="eyebrow">{t('competition.admin.heroEyebrow')}</div>
          <h2 className="hero-title">{t('competition.admin.heroTitle')}</h2>
          <p className="hero-copy">{t('competition.admin.heroCopy')}</p>
        </div>
        <div className="hero-metrics">
          <MetricAccent label={t('competition.admin.route')} value="/admin/competitions" />
          <MetricAccent label={t('competition.admin.competitions')} value={String(competitions.length)} />
          <MetricAccent label={t('competition.admin.warnings')} value={String(warningCount)} />
        </div>
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <div className="eyebrow">{t('competition.admin.listEyebrow')}</div>
            <h3>{t('competition.admin.listTitle')}</h3>
          </div>
          {canManage ? (
            <button
              className="control-button"
              type="button"
              disabled={createMutation.isPending}
              onClick={() => createMutation.mutate()}
            >
              <Trophy size={16} />
              {t('competition.admin.newDraft')}
            </button>
          ) : (
            <StatusPill tone="neutral">{t('competition.admin.readOnly')}</StatusPill>
          )}
        </div>

        {createMutation.isError ? (
          <ScreenState
            title={t('competition.admin.draftErrorTitle')}
            copy={getErrorMessage(createMutation.error)}
            tone="error"
          />
        ) : null}

        {competitions.length === 0 ? (
          <EmptyState title={t('competition.admin.emptyTitle')} copy={t('competition.admin.emptyCopy')} />
        ) : (
          <div className="stacked-table">
            {competitions.map((competition: CompetitionSummary) => (
              <article className="stacked-row" key={competition.competitionId}>
                <div className="stacked-row-head">
                  <div>
                    <strong>{competition.competitionName}</strong>
                    <p className="queue-subtitle">{competition.competitionCode}</p>
                  </div>
                  <div className="action-cluster">
                    <StatusPill tone={stateTone(competition.lifecycleState)}>
                      {formatCompetitionState(competition.lifecycleState, t)}
                    </StatusPill>
                    <button
                      className="control-button"
                      type="button"
                      onClick={() => setSelectedCompetitionId(competition.competitionId)}
                    >
                      {t('competition.admin.review')}
                    </button>
                  </div>
                </div>
                <div className="key-grid">
                  <KeyValue
                    label={t('competition.admin.type')}
                    value={formatCompetitionState(competition.competitionType, t)}
                  />
                  <KeyValue label={t('competition.admin.starts')} value={formatDate(competition.startsOn, locale)} />
                  <KeyValue label={t('competition.admin.ends')} value={formatDate(competition.endsOn, locale)} />
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
              <div className="eyebrow">{t('competition.admin.liveEyebrow')}</div>
              <h3>{selectedCompetition.competitionName}</h3>
            </div>
            <StatusPill tone={warningCount > 0 ? 'warning' : 'calm'}>
              {warningCount > 0 ? t('competition.admin.warningCount', { count: warningCount }) : t('competition.clean')}
            </StatusPill>
          </div>

          {detailQuery.isLoading ? (
            <ScreenState
              title={t('competition.admin.standingLoadingTitle')}
              copy={t('competition.admin.standingLoadingCopy')}
            />
          ) : null}

          {detailQuery.isError ? (
            <ScreenState
              title={t('competition.admin.standingErrorTitle')}
              copy={getErrorMessage(detailQuery.error)}
              tone="error"
            />
          ) : null}

          {detailQuery.data ? (
            <div className="page-stack">
              <CompetitionReadSummaryPanel summary={buildCompetitionReadSummary(detailQuery.data, locale)} />

              <div className="metric-grid">
                {detailQuery.data.latestScores.length === 0 ? (
                  <EmptyState
                    title={t('competition.admin.noScoreTitle')}
                    copy={t('competition.admin.noScoreCopy')}
                  />
                ) : (
                  detailQuery.data.latestScores.map((score) => (
                    <article className="metric-card metric-card-accent" key={`${score.teamId}-${score.snapshotDate}`}>
                      <div className="metric-icon">
                        <Trophy size={18} />
                      </div>
                      <div className="metric-value">{formatScore(score.scoreValue, t)}</div>
                      <h3>{score.teamName}</h3>
                      <p>
                        {t('competition.admin.rankLine', {
                          rank: score.rankPosition ?? '-',
                          population: score.rankingPopulation,
                          date: formatDate(score.snapshotDate, locale),
                        })}
                      </p>
                      <p>
                        {t('competition.admin.coverageFraction', {
                          valid: score.validStoreCount,
                          total: score.totalStoreCount,
                        })}
                      </p>
                    </article>
                  ))
                )}
              </div>

              {canManage ? (
                <div className="action-cluster">
                  {detailQuery.data.stages.map((stage) => (
                    <button
                      className="control-button"
                      key={`recalc-${stage.competitionStageId}`}
                      type="button"
                      disabled={recalcMutation.isPending}
                      onClick={() => recalcMutation.mutate(stage.competitionStageId)}
                    >
                      <RefreshCw size={16} />
                      {t('competition.admin.recalculateStage', { stageCode: stage.stageCode })}
                    </button>
                  ))}
                </div>
              ) : null}

              {canManage ? (
                <StageBuilderForm
                  key={selectedCompetition.competitionId}
                  competitionId={selectedCompetition.competitionId}
                  competitionStartsOn={selectedCompetition.startsOn}
                  competitionEndsOn={selectedCompetition.endsOn}
                  onCreated={async () => {
                    await queryClient.invalidateQueries({ queryKey: ['competitions'] })
                    await queryClient.invalidateQueries({
                      queryKey: ['competition-detail', selectedCompetition.competitionId],
                    })
                  }}
                />
              ) : null}

              <ScopedContributionSection contributions={detailQuery.data.storeContributions} />

              <ScopedWarningsSection warnings={detailQuery.data.warnings} />

              {canManage && activeStage ? (
                <article className="stacked-row">
                  <div className="panel-heading">
                    <div>
                      <div className="eyebrow">{t('competition.admin.finalizationEyebrow')}</div>
                      <h3>{activeStage.stageName}</h3>
                    </div>
                    <StatusPill tone={stateTone(activeStage.lifecycleState)}>
                      {formatCompetitionState(activeStage.lifecycleState, t)}
                    </StatusPill>
                  </div>
                  <div className="form-grid">
                    <label>
                      {t('competition.admin.overrideJustification')}
                      <textarea
                        value={overrideJustification}
                        onChange={(event) => setOverrideJustification(event.target.value)}
                      />
                    </label>
                    <button
                      className="control-button"
                      type="button"
                      disabled={finalizeMutation.isPending}
                      onClick={() => finalizeMutation.mutate(activeStage.competitionStageId)}
                    >
                      <CheckCircle2 size={16} />
                      {t('competition.admin.finalizeStage', { stageCode: activeStage.stageCode })}
                    </button>
                  </div>
                  {finalizeMutation.isError ? (
                    <ScreenState
                      title={t('competition.admin.finalizationErrorTitle')}
                      copy={getErrorMessage(finalizeMutation.error)}
                      tone="error"
                    />
                  ) : null}
                </article>
              ) : null}
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
    <section className="stacked-table" aria-label="Admin competition read summary">
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
    <section className="stacked-table" aria-label="Scoped competition store contributions">
      <div className="panel-heading">
        <div>
          <div className="eyebrow">{t('competition.readScope')}</div>
          <h3>{t('competition.scopedContributions')}</h3>
        </div>
        <StatusPill tone={input.contributions.length > 0 ? 'accent' : 'neutral'}>
          {`${input.contributions.length} ${t('competition.rowsSuffix')}`}
        </StatusPill>
      </div>
      {input.contributions.length === 0 ? (
        <EmptyState
          title={t('competition.noScopedContributionRowsTitle')}
          copy={t('competition.noScopedContributionRowsCopy')}
        />
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
                    {formatScore(contribution.scoreValue, t)}
                  </StatusPill>
                  <StatusPill tone={readability.tone}>{readability.statusLabel}</StatusPill>
                </div>
              </div>
              <div className="key-grid">
                <KeyValue label={t('competition.snapshot')} value={formatDate(contribution.snapshotDate, locale)} />
                <KeyValue label={t('competition.contributionHealth')} value={readability.statusLabel} />
                <KeyValue label={t('competition.coverage')} value={readability.coverageLabel} />
                <KeyValue label={t('competition.missingKpis')} value={readability.missingLabel} />
                <KeyValue label={t('competition.whyItMatters')} value={readability.explanation} />
                <KeyValue label={t('competition.team')} value={contribution.teamCode} />
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
    <section className="stacked-table" aria-label="Scoped competition warnings">
      <div className="panel-heading">
        <div>
          <div className="eyebrow">{t('competition.dataQuality')}</div>
          <h3>{t('competition.scopedWarnings')}</h3>
        </div>
        <StatusPill tone={input.warnings.length > 0 ? 'warning' : 'calm'}>
          {input.warnings.length > 0
            ? t('competition.admin.warningCount', { count: input.warnings.length })
            : t('competition.clean')}
        </StatusPill>
      </div>
      {input.warnings.length === 0 ? (
        <EmptyState title={t('competition.noOpenWarnings')} copy={t('competition.stageDataCleanCopy')} />
      ) : (
        input.warnings.map((warning) => {
          const readability = describeCompetitionWarning(warning, locale)

          return (
            <article className="stacked-row" key={warning.warningId}>
              <div className="stacked-row-head">
                <div>
                  <strong>
                    <ShieldAlert size={16} /> {readability.title}
                  </strong>
                  <p className="queue-subtitle">{readability.explanation}</p>
                </div>
                <StatusPill tone={readability.tone}>{formatState(warning.warningLevel)}</StatusPill>
              </div>
              <div className="key-grid">
                <KeyValue label={t('competition.warningCode')} value={formatState(warning.warningCode)} />
                <KeyValue label={t('competition.periodStart')} value={formatDate(warning.periodStart, locale)} />
                <KeyValue label={t('competition.periodEnd')} value={formatDate(warning.periodEnd, locale)} />
                <KeyValue label={t('competition.store')} value={warning.storeId ?? t('competition.teamLevel')} />
              </div>
            </article>
          )
        })
      )}
    </section>
  )
}
