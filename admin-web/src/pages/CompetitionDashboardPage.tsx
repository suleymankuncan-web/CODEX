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
} from '../features/competitions/api'
import type { AuthSessionSummary } from '../features/auth/api'
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

function formatScore(value: number | null) {
  return value === null ? 'Partial' : value.toFixed(2)
}

export function CompetitionDashboardPage(input: { authSummary: AuthSessionSummary | null }) {
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
        title="Competitions are loading"
        copy="The admin competition surface is checking current stages."
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

  const warningCount = detailQuery.data?.warnings.length ?? 0
  const activeStage = detailQuery.data?.stages[0] ?? null

  return (
    <section className="page-stack">
      <section className="hero-panel">
        <div>
          <div className="eyebrow">Competition Control</div>
          <h2 className="hero-title">Region challenge stages</h2>
          <p className="hero-copy">
            HR-owned challenge setup, live standing review, and finalization checks share one
            controlled admin surface.
          </p>
        </div>
        <div className="hero-metrics">
          <MetricAccent label="Route" value="/admin/competitions" />
          <MetricAccent label="Competitions" value={String(competitions.length)} />
          <MetricAccent label="Warnings" value={String(warningCount)} />
        </div>
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <div className="eyebrow">Competition List</div>
            <h3>Active and draft containers</h3>
          </div>
          {canManage ? (
            <button
              className="control-button"
              type="button"
              disabled={createMutation.isPending}
              onClick={() => createMutation.mutate()}
            >
              <Trophy size={16} />
              New draft
            </button>
          ) : (
            <StatusPill tone="neutral">Read only</StatusPill>
          )}
        </div>

        {createMutation.isError ? (
          <ScreenState
            title="Draft could not be created"
            copy={getErrorMessage(createMutation.error)}
            tone="error"
          />
        ) : null}

        {competitions.length === 0 ? (
          <EmptyState title="No competitions yet" copy="The first draft will appear here." />
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
                      {formatState(competition.lifecycleState)}
                    </StatusPill>
                    <button
                      className="control-button"
                      type="button"
                      onClick={() => setSelectedCompetitionId(competition.competitionId)}
                    >
                      Review
                    </button>
                  </div>
                </div>
                <div className="key-grid">
                  <KeyValue label="Type" value={formatState(competition.competitionType)} />
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
              <div className="eyebrow">Live Standing</div>
              <h3>{selectedCompetition.competitionName}</h3>
            </div>
            <StatusPill tone={warningCount > 0 ? 'warning' : 'calm'}>
              {warningCount > 0 ? `${warningCount} warnings` : 'Clean'}
            </StatusPill>
          </div>

          {detailQuery.isLoading ? (
            <ScreenState title="Standing is loading" copy="Stage scores and warnings are loading." />
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
              <div className="metric-grid">
                {detailQuery.data.latestScores.length === 0 ? (
                  <EmptyState
                    title="No score snapshot"
                    copy="Scores appear after a stage recalculation."
                  />
                ) : (
                  detailQuery.data.latestScores.map((score) => (
                    <article className="metric-card metric-card-accent" key={`${score.teamId}-${score.snapshotDate}`}>
                      <div className="metric-icon">
                        <Trophy size={18} />
                      </div>
                      <div className="metric-value">{formatScore(score.scoreValue)}</div>
                      <h3>{score.teamName}</h3>
                      <p>
                        Rank {score.rankPosition ?? '-'} / {score.rankingPopulation} on{' '}
                        {formatDate(score.snapshotDate)}
                      </p>
                      <p>
                        Coverage {score.validStoreCount}/{score.totalStoreCount}
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
                      Recalculate {stage.stageCode}
                    </button>
                  ))}
                </div>
              ) : null}

              <ScopedContributionSection contributions={detailQuery.data.storeContributions} />

              <section className="stacked-table">
                {detailQuery.data.warnings.length === 0 ? (
                  <EmptyState title="No open warnings" copy="Stage data quality is clean." />
                ) : (
                  detailQuery.data.warnings.map((warning) => (
                    <article className="stacked-row" key={warning.warningId}>
                      <div className="stacked-row-head">
                        <div>
                          <strong>
                            <ShieldAlert size={16} /> {formatState(warning.warningCode)}
                          </strong>
                          <p className="queue-subtitle">{warning.message}</p>
                        </div>
                        <StatusPill tone={warning.warningLevel === 'blocker' ? 'danger' : 'warning'}>
                          {formatState(warning.warningLevel)}
                        </StatusPill>
                      </div>
                      <div className="key-grid">
                        <KeyValue label="Period start" value={formatDate(warning.periodStart)} />
                        <KeyValue label="Period end" value={formatDate(warning.periodEnd)} />
                        <KeyValue label="Store" value={warning.storeId ?? 'Team level'} />
                      </div>
                    </article>
                  ))
                )}
              </section>

              {canManage && activeStage ? (
                <article className="stacked-row">
                  <div className="panel-heading">
                    <div>
                      <div className="eyebrow">Finalization</div>
                      <h3>{activeStage.stageName}</h3>
                    </div>
                    <StatusPill tone={stateTone(activeStage.lifecycleState)}>
                      {formatState(activeStage.lifecycleState)}
                    </StatusPill>
                  </div>
                  <div className="form-grid">
                    <label>
                      Override justification
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
                      Finalize {activeStage.stageCode}
                    </button>
                  </div>
                  {finalizeMutation.isError ? (
                    <ScreenState
                      title="Stage could not be finalized"
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

function ScopedContributionSection(input: { contributions: CompetitionStoreContribution[] }) {
  return (
    <section className="stacked-table" aria-label="Scoped competition store contributions">
      <div className="panel-heading">
        <div>
          <div className="eyebrow">Read Scope</div>
          <h3>Scoped contributions</h3>
        </div>
        <StatusPill tone={input.contributions.length > 0 ? 'accent' : 'neutral'}>
          {`${input.contributions.length} rows`}
        </StatusPill>
      </div>
      {input.contributions.length === 0 ? (
        <EmptyState
          title="No scoped contribution rows"
          copy="This session can see the competition, but no store contribution snapshot is available inside its read scope."
        />
      ) : (
        input.contributions.map((contribution) => (
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
              <StatusPill tone={contribution.hasDailyData ? 'calm' : 'warning'}>
                {formatScore(contribution.scoreValue)}
              </StatusPill>
            </div>
            <div className="key-grid">
              <KeyValue label="Snapshot" value={formatDate(contribution.snapshotDate)} />
              <KeyValue
                label="Reported weight"
                value={`${contribution.reportedWeightPercent}/${contribution.expectedWeightPercent}`}
              />
              <KeyValue
                label="Missing KPIs"
                value={
                  contribution.missingKpiCodes.length > 0
                    ? contribution.missingKpiCodes.map(formatState).join(', ')
                    : 'None'
                }
              />
              <KeyValue label="Team" value={contribution.teamCode} />
            </div>
          </article>
        ))
      )}
    </section>
  )
}
