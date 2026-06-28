import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, RefreshCw, ShieldAlert, Trophy } from 'lucide-react'
import {
  createCompetition,
  finalizeStage,
  getCompetition,
  listCompetitions,
  recalculateStage,
  type CompetitionStageSummary,
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
import {
  competitionStateTone,
  formatCompetitionLifecycleState,
  formatCompetitionStageState,
  formatCompetitionType,
} from '../features/competitions/display'
import { StageBuilderForm } from '../features/competitions/StageBuilderForm'
import type { AuthSessionSummary } from '../features/auth/api'
import type { TranslateFunction } from '../features/localization/dictionary'
import { useLocalization } from '../features/localization/useLocalization'
import { formatDate, formatState, getErrorMessage } from '../lib/format'
import { normalizeDisplayLabel } from '../lib/display-labels'
import { transientQueryRetryOptions } from '../lib/query-retry'
import {
  AdminMetricStrip,
  AdminSurfaceHeader,
  AdminSurfacePage,
  AdminSurfaceSection,
} from './admin-surface-primitives'
import {
  CompetitionActionRow,
  CompetitionButton,
  CompetitionEmptyState,
  CompetitionFieldGrid,
  CompetitionKeyValue,
  CompetitionKeyValueGrid,
  CompetitionRow,
  CompetitionRowHeader,
  CompetitionRowList,
  CompetitionStatePanel,
  CompetitionStatusBadge,
  CompetitionSubtleText,
  CompetitionTextareaField,
} from '../features/competitions/competition-admin-surface-primitives'

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

function canManageCompetitions(authSummary: AuthSessionSummary | null) {
  const roles = authSummary?.user.roleCodes ?? []
  return roles.includes('SUPER_ADMIN') || roles.includes('HR_ADMIN')
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
    queryKey: ['competition-detail', selectedCompetition?.competitionId],
    queryFn: () => getCompetition(selectedCompetition!.competitionId),
    enabled: Boolean(selectedCompetition),
    staleTime: 15_000,
    ...transientQueryRetryOptions,
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
        ...(overrideJustification.trim()
          ? { overrideJustification: overrideJustification.trim() }
          : {}),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['competition-detail'] }),
  })

  if (competitionsQuery.isLoading) {
    return (
      <AdminSurfacePage ariaLabel={t('competition.admin.loadingTitle')}>
        <CompetitionStatePanel
          title={t('competition.admin.loadingTitle')}
          copy={t('competition.admin.loadingCopy')}
          isLoading
        />
      </AdminSurfacePage>
    )
  }

  if (competitionsQuery.isError) {
    return (
      <AdminSurfacePage ariaLabel={t('competition.admin.errorTitle')}>
        <CompetitionStatePanel
          title={t('competition.admin.errorTitle')}
          copy={getErrorMessage(competitionsQuery.error)}
          tone="error"
          action={
            <CompetitionButton
              type="button"
              variant="outline"
              disabled={competitionsQuery.isFetching}
              onClick={() => void competitionsQuery.refetch()}
            >
              <RefreshCw data-icon="inline-start" />
              {competitionsQuery.isFetching
                ? t('competition.admin.retryingAction')
                : t('competition.admin.retryAction')}
            </CompetitionButton>
          }
        />
      </AdminSurfacePage>
    )
  }

  const warningCount = detailQuery.data?.warnings.length ?? 0
  const activeStage = detailQuery.data?.stages[0] ?? null

  return (
    <AdminSurfacePage ariaLabel={t('competition.admin.heroTitle')}>
      <AdminSurfaceHeader
        eyebrow={t('competition.admin.heroEyebrow')}
        title={t('competition.admin.heroTitle')}
        description={t('competition.admin.heroCopy')}
        icon={<Trophy aria-hidden="true" />}
        meta={
          <>
            <CompetitionStatusBadge tone="accent">
              {`${competitions.length} ${t('competition.admin.competitions')}`}
            </CompetitionStatusBadge>
            <CompetitionStatusBadge tone={warningCount > 0 ? 'warning' : 'calm'}>
              {warningCount > 0 ? t('competition.admin.warningCount', { count: warningCount }) : t('competition.clean')}
            </CompetitionStatusBadge>
            <CompetitionStatusBadge tone={canManage ? 'accent' : 'neutral'}>
              {canManage ? t('competition.admin.newDraft') : t('competition.admin.readOnly')}
            </CompetitionStatusBadge>
          </>
        }
      />

      <CompetitionListPanel
        canManage={canManage}
        competitions={competitions}
        createError={createMutation.error}
        createPending={createMutation.isPending}
        onCreate={() => createMutation.mutate()}
        onSelect={setSelectedCompetitionId}
        selectedCompetitionId={selectedCompetition?.competitionId ?? null}
      />

      {selectedCompetition ? (
        <AdminSurfaceSection
          eyebrow={t('competition.admin.liveEyebrow')}
          title={selectedCompetition.competitionName}
          badge={
            <CompetitionStatusBadge tone={warningCount > 0 ? 'warning' : 'calm'}>
              {warningCount > 0 ? t('competition.admin.warningCount', { count: warningCount }) : t('competition.clean')}
            </CompetitionStatusBadge>
          }
        >

          {detailQuery.isLoading ? (
            <CompetitionStatePanel
              title={t('competition.admin.standingLoadingTitle')}
              copy={t('competition.admin.standingLoadingCopy')}
              isLoading
            />
          ) : null}

          {detailQuery.isError ? (
            <CompetitionStatePanel
              title={t('competition.admin.standingErrorTitle')}
              copy={getErrorMessage(detailQuery.error)}
              tone="error"
              action={
                <CompetitionButton
                  type="button"
                  variant="outline"
                  disabled={detailQuery.isFetching}
                  onClick={() => void detailQuery.refetch()}
                >
                  <RefreshCw data-icon="inline-start" />
                  {detailQuery.isFetching
                    ? t('competition.admin.retryingAction')
                    : t('competition.admin.retryAction')}
                </CompetitionButton>
              }
            />
          ) : null}

          {detailQuery.data ? (
            <div className="tw:grid tw:gap-4">
              <CompetitionDecisionBrief
                activeStage={activeStage}
                canManage={canManage}
                competition={selectedCompetition}
                warningCount={warningCount}
              />
              <CompetitionReadSummaryPanel summary={buildCompetitionReadSummary(detailQuery.data, locale)} />

              {detailQuery.data.latestScores.length === 0 ? (
                <CompetitionEmptyState
                  title={t('competition.admin.noScoreTitle')}
                  copy={t('competition.admin.noScoreCopy')}
                />
              ) : (
                <AdminMetricStrip
                  items={detailQuery.data.latestScores.map((score) => ({
                    id: `${score.teamId}-${score.snapshotDate}`,
                    label: score.teamName,
                    value: formatScore(score.scoreValue, t),
                    description: t('competition.admin.rankLine', {
                      rank: score.rankPosition ?? '-',
                      population: score.rankingPopulation,
                      date: formatDate(score.snapshotDate, locale),
                    }),
                    trend: t('competition.admin.coverageFraction', {
                      valid: score.validStoreCount,
                      total: score.totalStoreCount,
                    }),
                    icon: <Trophy aria-hidden="true" />,
                    tone: 'accent',
                  }))}
                />
              )}

              {canManage ? (
                <CompetitionActionRow>
                  {detailQuery.data.stages.map((stage) => (
                    <CompetitionButton
                      key={`recalc-${stage.competitionStageId}`}
                      type="button"
                      variant="outline"
                      disabled={recalcMutation.isPending}
                      onClick={() => recalcMutation.mutate(stage.competitionStageId)}
                    >
                      <RefreshCw data-icon="inline-start" />
                      {t('competition.admin.recalculateStage', { stageCode: stage.stageCode })}
                    </CompetitionButton>
                  ))}
                </CompetitionActionRow>
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
                <CompetitionRow>
                  <CompetitionRowHeader
                    title={activeStage.stageName}
                    description={t('competition.admin.finalizationEyebrow')}
                    badge={
                      <CompetitionStatusBadge tone={competitionStateTone(activeStage.lifecycleState)}>
                      {formatCompetitionStageState(activeStage.lifecycleState, t)}
                      </CompetitionStatusBadge>
                    }
                  />
                  <CompetitionFieldGrid className="tw:xl:grid-cols-[1fr_auto]">
                    <CompetitionTextareaField
                      label={t('competition.admin.overrideJustification')}
                      value={overrideJustification}
                      onChange={(event) => setOverrideJustification(event.target.value)}
                    />
                    <CompetitionButton
                      className="tw:self-end"
                      type="button"
                      disabled={finalizeMutation.isPending}
                      onClick={() => finalizeMutation.mutate(activeStage.competitionStageId)}
                    >
                      <CheckCircle2 data-icon="inline-start" />
                      {t('competition.admin.finalizeStage', { stageCode: activeStage.stageCode })}
                    </CompetitionButton>
                  </CompetitionFieldGrid>
                  {finalizeMutation.isError ? (
                    <CompetitionStatePanel
                      title={t('competition.admin.finalizationErrorTitle')}
                      copy={getErrorMessage(finalizeMutation.error)}
                      tone="error"
                    />
                  ) : null}
                </CompetitionRow>
              ) : null}
            </div>
          ) : null}
        </AdminSurfaceSection>
      ) : null}
    </AdminSurfacePage>
  )
}

function CompetitionListPanel(input: {
  canManage: boolean
  competitions: CompetitionSummary[]
  createError: Error | null
  createPending: boolean
  onCreate: () => void
  onSelect: (competitionId: string) => void
  selectedCompetitionId: string | null
}) {
  const { locale, t } = useLocalization()

  return (
    <AdminSurfaceSection
      eyebrow={t('competition.admin.listEyebrow')}
      title={t('competition.admin.listTitle')}
      actions={
        input.canManage ? (
          <CompetitionButton
            type="button"
            disabled={input.createPending}
            onClick={input.onCreate}
          >
            <Trophy data-icon="inline-start" />
            {t('competition.admin.newDraft')}
          </CompetitionButton>
        ) : (
          <CompetitionStatusBadge tone="neutral">{t('competition.admin.readOnly')}</CompetitionStatusBadge>
        )
      }
    >

      {input.createError ? (
        <CompetitionStatePanel
          title={t('competition.admin.draftErrorTitle')}
          copy={getErrorMessage(input.createError)}
          tone="error"
        />
      ) : null}

      {input.competitions.length === 0 ? (
        <CompetitionEmptyState title={t('competition.admin.emptyTitle')} copy={t('competition.admin.emptyCopy')} />
      ) : (
        <CompetitionRowList className="tw:xl:grid-cols-2">
          {input.competitions.map((competition: CompetitionSummary) => (
            <CompetitionRow
              key={competition.competitionId}
              {...(competition.competitionId === input.selectedCompetitionId
                ? { className: 'tw:border-primary/35 tw:bg-primary/5' }
                : {})}
            >
              <CompetitionRowHeader
                title={competition.competitionName}
                description={competition.competitionCode}
                actions={
                  <>
                    <CompetitionStatusBadge tone={competitionStateTone(competition.lifecycleState)}>
                    {formatCompetitionLifecycleState(competition.lifecycleState, t)}
                    </CompetitionStatusBadge>
                    <CompetitionButton
                      size="sm"
                      type="button"
                      variant="outline"
                      onClick={() => input.onSelect(competition.competitionId)}
                    >
                      {t('competition.admin.review')}
                    </CompetitionButton>
                  </>
                }
              />
              <CompetitionKeyValueGrid>
                <CompetitionKeyValue
                  label={t('competition.admin.type')}
                  value={formatCompetitionType(competition.competitionType, t)}
                />
                <CompetitionKeyValue label={t('competition.admin.starts')} value={formatDate(competition.startsOn, locale)} />
                <CompetitionKeyValue label={t('competition.admin.ends')} value={formatDate(competition.endsOn, locale)} />
              </CompetitionKeyValueGrid>
            </CompetitionRow>
          ))}
        </CompetitionRowList>
      )}
    </AdminSurfaceSection>
  )
}

function CompetitionDecisionBrief(input: {
  activeStage: CompetitionStageSummary | null
  canManage: boolean
  competition: CompetitionSummary
  warningCount: number
}) {
  const { locale, t } = useLocalization()
  const lifecycleLabel = formatCompetitionLifecycleState(input.competition.lifecycleState, t)
  const activeStageLabel = input.activeStage
    ? `${input.activeStage.stageCode} / ${formatCompetitionStageState(input.activeStage.lifecycleState, t)}`
    : t('competition.admin.noActiveStage')

  return (
    <CompetitionRow className="tw:border-primary/20 tw:bg-gradient-to-r tw:from-primary/5 tw:to-cyan-500/5">
      <CompetitionRowHeader
        title={t('competition.admin.decisionBriefTitle')}
        description={t('competition.admin.decisionBriefCopy', {
          competition: input.competition.competitionName,
          status: lifecycleLabel,
        })}
        badge={
          <CompetitionStatusBadge tone={input.warningCount > 0 ? 'warning' : 'calm'}>
            {input.warningCount > 0
              ? t('competition.admin.warningCount', { count: input.warningCount })
              : t('competition.clean')}
          </CompetitionStatusBadge>
        }
      />
      <CompetitionKeyValueGrid>
        <CompetitionKeyValue label={t('competition.admin.selectedCompetition')} value={input.competition.competitionCode} />
        <CompetitionKeyValue label={t('competition.admin.activeStage')} value={activeStageLabel} />
        <CompetitionKeyValue label={t('competition.admin.operatorMode')} value={input.canManage ? t('competition.admin.newDraft') : t('competition.admin.readOnly')} />
        <CompetitionKeyValue label={t('competition.admin.ends')} value={formatDate(input.competition.endsOn, locale)} />
      </CompetitionKeyValueGrid>
    </CompetitionRow>
  )
}

function CompetitionReadSummaryPanel(input: { summary: CompetitionReadSummary }) {
  const { t } = useLocalization()

  return (
    <AdminSurfaceSection
      ariaLabel={t('competition.readSummaryAria')}
      eyebrow={t('competition.readScope')}
      title={t('competition.readSummary')}
      badge={<CompetitionStatusBadge tone={input.summary.tone}>{input.summary.attentionLabel}</CompetitionStatusBadge>}
    >
      <CompetitionSubtleText>{input.summary.explanation}</CompetitionSubtleText>
      <CompetitionKeyValueGrid>
        <CompetitionKeyValue label={t('competition.bestVisibleRank')} value={input.summary.bestRankLabel} />
        <CompetitionKeyValue label={t('competition.teamCoverage')} value={input.summary.teamCoverageLabel} />
        <CompetitionKeyValue label={t('competition.contributionCoverage')} value={input.summary.contributionCoverageLabel} />
      </CompetitionKeyValueGrid>
    </AdminSurfaceSection>
  )
}

function ScopedContributionSection(input: { contributions: CompetitionStoreContribution[] }) {
  const { locale, t } = useLocalization()

  return (
    <AdminSurfaceSection
      ariaLabel={t('competition.scopedContributionsAria')}
      eyebrow={t('competition.readScope')}
      title={t('competition.scopedContributions')}
      badge={
        <CompetitionStatusBadge tone={input.contributions.length > 0 ? 'accent' : 'neutral'}>
          {`${input.contributions.length} ${t('competition.rowsSuffix')}`}
        </CompetitionStatusBadge>
      }
    >
      {input.contributions.length === 0 ? (
        <CompetitionEmptyState
          title={t('competition.noScopedContributionRowsTitle')}
          copy={t('competition.noScopedContributionRowsCopy')}
        />
      ) : (
        <CompetitionRowList>
          {input.contributions.map((contribution) => {
          const readability = describeCompetitionContribution(contribution, locale)

          return (
            <CompetitionRow
              key={`${contribution.stageId}-${contribution.storeId}-${contribution.snapshotDate}`}
            >
              <CompetitionRowHeader
                title={contribution.storeName}
                description={
                  <>
                    {contribution.teamName} / {contribution.storeCode}
                  </>
                }
                actions={
                  <>
                  <CompetitionStatusBadge tone={contribution.hasDailyData ? 'calm' : 'warning'}>
                    {formatScore(contribution.scoreValue, t)}
                  </CompetitionStatusBadge>
                  <CompetitionStatusBadge tone={readability.tone}>{readability.statusLabel}</CompetitionStatusBadge>
                  </>
                }
              />
              <CompetitionKeyValueGrid>
                <CompetitionKeyValue label={t('competition.snapshot')} value={formatDate(contribution.snapshotDate, locale)} />
                <CompetitionKeyValue label={t('competition.contributionHealth')} value={readability.statusLabel} />
                <CompetitionKeyValue label={t('competition.coverage')} value={readability.coverageLabel} />
                <CompetitionKeyValue label={t('competition.missingKpis')} value={readability.missingLabel} />
                <CompetitionKeyValue label={t('competition.whyItMatters')} value={readability.explanation} />
                <CompetitionKeyValue label={t('competition.team')} value={contribution.teamCode} />
              </CompetitionKeyValueGrid>
            </CompetitionRow>
          )
        })}
        </CompetitionRowList>
      )}
    </AdminSurfaceSection>
  )
}

function ScopedWarningsSection(input: { warnings: CompetitionWarning[] }) {
  const { locale, t } = useLocalization()

  return (
    <AdminSurfaceSection
      ariaLabel={t('competition.scopedWarningsAria')}
      eyebrow={t('competition.dataQuality')}
      title={t('competition.scopedWarnings')}
      badge={
        <CompetitionStatusBadge tone={input.warnings.length > 0 ? 'warning' : 'calm'}>
          {input.warnings.length > 0
            ? t('competition.admin.warningCount', { count: input.warnings.length })
            : t('competition.clean')}
        </CompetitionStatusBadge>
      }
    >
      {input.warnings.length === 0 ? (
        <CompetitionEmptyState title={t('competition.noOpenWarnings')} copy={t('competition.stageDataCleanCopy')} />
      ) : (
        <CompetitionRowList>
          {input.warnings.map((warning) => {
          const readability = describeCompetitionWarning(warning, locale)

          return (
            <CompetitionRow key={warning.warningId}>
              <CompetitionRowHeader
                title={
                  <span className="tw:inline-flex tw:items-center tw:gap-2">
                    <ShieldAlert aria-hidden="true" />
                    {readability.title}
                  </span>
                }
                description={readability.explanation}
                badge={<CompetitionStatusBadge tone={readability.tone}>{formatState(warning.warningLevel)}</CompetitionStatusBadge>}
              />
              <CompetitionKeyValueGrid>
                <CompetitionKeyValue label={t('competition.warningCode')} value={formatState(warning.warningCode)} />
                <CompetitionKeyValue label={t('competition.periodStart')} value={formatDate(warning.periodStart, locale)} />
                <CompetitionKeyValue label={t('competition.periodEnd')} value={formatDate(warning.periodEnd, locale)} />
                <CompetitionKeyValue
                  label={t('competition.store')}
                  value={normalizeDisplayLabel(warning.storeName ?? warning.storeId, t('competition.teamLevel'))}
                />
              </CompetitionKeyValueGrid>
            </CompetitionRow>
          )
        })}
        </CompetitionRowList>
      )}
    </AdminSurfaceSection>
  )
}
