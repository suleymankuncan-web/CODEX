import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import {
  ArrowRight,
  BadgeCheck,
  BarChart3,
  CalendarDays,
  ClipboardCheck,
  ClipboardX,
  MousePointerClick,
  PackagePlus,
  Receipt,
  Target,
} from 'lucide-react'
import { useQueries, useQuery, type UseQueryResult } from '@tanstack/react-query'
import {
  getRankings,
  getStoreKpiHighlights,
  type PersonnelRankingRow,
  type RankingMetricValue,
  type StoreKpiHighlightsSummary,
} from '../features/reports/api'
import { transientQueryRetryOptions } from '../lib/query-retry'
import {
  formatAchievementValue,
  formatKpiMetricLabel,
  formatMetricValue,
  resolveLocalizedKpiScoreReference,
} from './store-kpi-highlights-formatters'
import type { DisplayKpiRow, StoreKpiHighlightsPageModel } from './store-kpi-highlights-model'
import { StoreKpisCommandDeckHeader, type StoreKpiCommandTab } from './store-kpis-command-deck-header'
import { StoreKpisPeriodPicker } from './store-kpis-period-picker'
import { StoreEmptyState, StoreErrorState, StoreLoadingState, StoreStatusBadge, StoreSurfacePage } from './store-surface-primitives'
import {
  buildKpiMonthlyHistory,
  classifyKpiReference,
  classifyPersonnelPerformance,
  toHundredPointLiveStoreScore,
} from './store-kpis-command-contract'

type MetricTone = 'good' | 'warn' | 'danger' | 'neutral'
type KpiDecisionFocus = 'all' | 'TARGET_ACHIEVEMENT' | 'UPT' | 'CHECKLIST'

const metricIcons: Record<string, typeof Target> = {
  TARGET_ACHIEVEMENT: Target,
  UPT: PackagePlus,
  ATV: Receipt,
  CR: MousePointerClick,
  gsm_approval: BadgeCheck,
  BM_CHECKLIST: ClipboardCheck,
  VM_CHECKLIST: ClipboardX,
}

const storeMetricOrder = ['TARGET_ACHIEVEMENT', 'UPT', 'ATV', 'CR', 'gsm_approval', 'BM_CHECKLIST', 'VM_CHECKLIST']

export function StoreKpisCommandDeck({ model }: { model: StoreKpiHighlightsPageModel }) {
  const [activeTab, setActiveTab] = useState<StoreKpiCommandTab>('store')
  const [decisionFocus, setDecisionFocus] = useState<KpiDecisionFocus>('all')
  const [personnelPageState, setPersonnelPageState] = useState({ page: 0, scopeKey: '' })
  const personnelPageSize = 50
  const storeId = model.effectiveStoreId ?? ''
  const periodStart = model.liveSummary?.period?.periodStart ?? model.livePeriodStart
  const personnelScopeKey = `${storeId}|${periodStart || 'latest-monthly'}`
  const personnelPage = personnelPageState.scopeKey === personnelScopeKey ? personnelPageState.page : 0
  const setPersonnelPage = (page: number) => setPersonnelPageState({ page, scopeKey: personnelScopeKey })
  const personnelRankingQuery = useQuery({
    queryKey: ['store-kpis-personnel-ranking', storeId || 'no-store', periodStart || 'latest-monthly', personnelPage, personnelPageSize],
    queryFn: () =>
      getRankings({
        periodType: 'monthly',
        ...(periodStart ? { periodStart } : {}),
        ...(storeId ? { storeId } : {}),
        limit: personnelPageSize,
        offset: personnelPage * personnelPageSize,
        managedPersonnelLimit: personnelPageSize,
        managedPersonnelOffset: personnelPage * personnelPageSize,
      }),
    enabled: model.reportingAllowed && model.viewMode === 'live' && Boolean(storeId),
    ...transientQueryRetryOptions,
    placeholderData: (previous) => previous,
  })
  const personnelLeaderboard = personnelRankingQuery.data?.personnelLeaderboard
  const storeFilteredPersonnelRows = personnelLeaderboard?.items ?? []
  const managedPersonnelRows = personnelLeaderboard?.managedStorePersonnel ?? []
  const useServerPersonnelPage =
    model.storeKpiSurfaceMode === 'regionStoreDetail' || model.isReportViewerStoreDetail
  const personnelRows =
    model.viewMode === 'live'
      ? useServerPersonnelPage
        ? storeFilteredPersonnelRows
        : managedPersonnelRows
      : []
  const personnelTotal = useServerPersonnelPage
    ? personnelLeaderboard?.meta.total ?? 0
    : personnelLeaderboard?.managedStorePersonnelMeta?.total ?? managedPersonnelRows.length
  const storeRows = useMemo(
    () => storeMetricOrder.map((code) => findMetricRow(model.rows, code) ?? emptyRow(code)),
    [model.rows],
  )
  const visibleStoreRows = useMemo(() => {
    if (decisionFocus === 'all') return storeRows
    if (decisionFocus === 'CHECKLIST') return storeRows.filter((row) => normalizeKpiCode(row.kpiCode).includes('checklist'))
    return storeRows.filter((row) => normalizeKpiCode(row.kpiCode) === normalizeKpiCode(decisionFocus))
  }, [decisionFocus, storeRows])
  const missingChecklistCodes = storeMetricOrder.filter((code) => {
    if (!code.includes('CHECKLIST')) return false
    const row = findMetricRow(model.rows, code)
    return !row || row.scoreStatus !== 'scored'
  })
  const failedRetainedQueries = [model.configQuery, model.liveKpiQuery, model.dailySnapshotQuery, model.closedKpiQuery]
    .filter((query) => query.isError && Boolean(query.data))

  return (
    <StoreSurfacePage ariaLabel={model.t('storeKpis.title')}>
      <StoreKpisCommandDeckHeader
        activeTab={activeTab}
        controls={<PeriodControls model={model} />}
        model={model}
        personnelCount={personnelRows.length}
        setActiveTab={setActiveTab}
        storeKpiCount={storeRows.length}
      />
      {failedRetainedQueries.length > 0 ? (
        <InlineBackgroundError
          model={model}
          onRetry={() => void Promise.all(failedRetainedQueries.map((query) => query.refetch()))}
        />
      ) : null}

      {activeTab === 'store' ? (
        <div className="tw:grid tw:gap-4">
          <StoreKpiDecisionRail focus={decisionFocus} model={model} onFocus={setDecisionFocus} />
          <KpiContributionTable model={model} rows={visibleStoreRows} />
          <MonthlyTrend model={model} />
        </div>
      ) : (
        <div className="tw:grid tw:gap-4 tw:xl:grid-cols-[minmax(0,1fr)_320px]">
          <PersonnelKpiRows
            model={model}
            onPageChange={setPersonnelPage}
            page={personnelPage}
            pageSize={personnelPageSize}
            queryState={personnelRankingQuery}
            rows={personnelRows}
            total={personnelTotal}
          />
          <ScoreSourceCard model={model} missingChecklistCodes={missingChecklistCodes} />
        </div>
      )}
    </StoreSurfacePage>
  )
}

function PeriodControls({ model }: { model: StoreKpiHighlightsPageModel }) {
  const livePeriods = model.liveSummary?.availablePeriods.filter((period) => period.periodType === 'monthly') ?? []
  const activeLivePeriodStart = model.livePeriodStart || model.liveSummary?.period?.periodStart || livePeriods[0]?.periodStart || ''
  const snapshotPeriodStart = model.activeSnapshotRun?.snapshotDate ?? model.activeSnapshotRun?.periodStart ?? ''
  const snapshotPeriodStarts = model.availableSnapshotRuns
    .map((run) => run.snapshotDate ?? run.periodStart)
    .filter((value): value is string => Boolean(value))

  return (
    <div className="tw:flex tw:flex-wrap tw:items-center tw:gap-2">
      {model.closedSnapshotModeAllowed ? (
        <div className="tw:flex tw:rounded-xl tw:border tw:border-border tw:bg-white tw:p-1">
          {(['live', 'closed'] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              className={`tw:h-8 tw:rounded-lg tw:px-3 tw:text-xs tw:font-medium ${model.viewMode === mode ? 'tw:bg-[var(--store-command-plum)] tw:text-white' : 'tw:text-[var(--store-command-muted)]'}`}
              onClick={() => model.setViewMode(mode)}
            >
              {mode === 'live' ? model.t('storeKpis.livePeriod') : model.t('storeKpis.closedDay')}
            </button>
          ))}
        </div>
      ) : null}
      {model.viewMode === 'live' ? (
        <StoreKpisPeriodPicker
          ariaLabel={model.t('storeKpis.livePeriodSelect')}
          availablePeriodStarts={livePeriods.map((period) => period.periodStart)}
          locale={model.locale}
          onPeriodStartChange={model.setLivePeriodStart}
          periodStart={activeLivePeriodStart}
          triggerClassName="tw:h-10 tw:rounded-xl tw:border-border tw:bg-white tw:px-3 tw:text-sm tw:font-medium tw:text-[var(--store-command-ink)]"
        />
      ) : (
        <StoreKpisPeriodPicker
          ariaLabel={model.t('storeKpis.closedRecordSelect')}
          availablePeriodStarts={snapshotPeriodStarts}
          locale={model.locale}
          onPeriodStartChange={(periodStart) => {
            const selectedMonth = periodStart.slice(0, 7)
            const matchingRun = model.availableSnapshotRuns.find((run) =>
              (run.snapshotDate ?? run.periodStart ?? '').slice(0, 7) === selectedMonth,
            )
            if (matchingRun) model.setSelectedSnapshotRunId(matchingRun.snapshotRunId)
          }}
          periodStart={snapshotPeriodStart}
          triggerClassName="tw:h-10 tw:rounded-xl tw:border-border tw:bg-white tw:px-3 tw:text-sm tw:font-medium tw:text-[var(--store-command-ink)]"
        />
      )}
    </div>
  )
}

function StoreKpiDecisionRail(input: {
  focus: KpiDecisionFocus
  model: StoreKpiHighlightsPageModel
  onFocus: (focus: KpiDecisionFocus) => void
}) {
  const target = findMetricRow(input.model.rows, 'TARGET_ACHIEVEMENT')
  const upt = findMetricRow(input.model.rows, 'UPT')
  const checklistRows = ['BM_CHECKLIST', 'VM_CHECKLIST']
    .map((code) => findMetricRow(input.model.rows, code))
    .filter((row): row is DisplayKpiRow => Boolean(row && row.scoreStatus === 'scored'))
  const checklistValues = checklistRows.map((row) => toFiniteNumber(row.actualValue))
  const checklistAverage = checklistValues.length === 2 && checklistValues.every((value) => value !== null)
    ? checklistValues.reduce((sum, value) => sum + (value ?? 0), 0) / 2
    : null
  const score = input.model.liveSummary?.score.matchedMetrics
    ? toHundredPointLiveStoreScore(toFiniteNumber(input.model.liveSummary.score.value))
    : input.model.weightedScore.coveredWeight > 0
      ? input.model.weightedScore.scoreValue * 100
      : null

  return (
    <section className="tw:grid tw:overflow-hidden tw:rounded-[1.45rem] tw:border tw:border-[var(--store-command-line)] tw:bg-white/[0.9] tw:shadow-[0_14px_38px_var(--store-command-line)] tw:sm:grid-cols-2 tw:xl:grid-cols-4" aria-label={input.model.t('storeKpis.commandDecisionRail')}>
      <DecisionRailButton active={input.focus === 'all'} icon={BarChart3} label={input.model.t('storeKpis.storeScore')} onClick={() => input.onFocus('all')} value={score === null ? input.model.t('storeKpis.noData') : formatNumber(input.model.locale, score, 1)} />
      <DecisionRailButton active={input.focus === 'TARGET_ACHIEVEMENT'} icon={Target} label={input.model.t('storeKpis.metric.targetAchievement')} onClick={() => input.onFocus('TARGET_ACHIEVEMENT')} value={target ? formatAchievementValue(input.model.locale, input.model.t, target) : input.model.t('storeKpis.noData')} />
      <DecisionRailButton active={input.focus === 'UPT'} icon={PackagePlus} label={input.model.t('storeKpis.metric.upt')} onClick={() => input.onFocus('UPT')} value={formatMetricValue(input.model.locale, input.model.t, upt?.actualValue ?? null, 'UPT')} />
      <DecisionRailButton active={input.focus === 'CHECKLIST'} icon={ClipboardCheck} label={input.model.t('storeKpis.commandChecklistAverage')} onClick={() => input.onFocus('CHECKLIST')} value={checklistAverage === null ? input.model.t('storeKpis.noData') : `%${formatNumber(input.model.locale, checklistAverage, 1)}`} />
    </section>
  )
}

function DecisionRailButton(input: {
  active: boolean
  icon: typeof Target
  label: string
  onClick: () => void
  value: string
}) {
  const Icon = input.icon
  return (
    <button type="button" aria-pressed={input.active} className={`tw:flex tw:min-h-[82px] tw:items-center tw:gap-3 tw:border-b tw:border-[var(--store-command-line)] tw:p-4 tw:text-left tw:transition tw:sm:border-r tw:xl:border-b-0 tw:last:border-r-0 ${input.active ? 'tw:bg-[linear-gradient(135deg,var(--store-command-plum-soft),var(--store-command-cyan-soft))]' : 'tw:bg-white/80 tw:hover:bg-[var(--store-command-surface-soft)]'}`} onClick={input.onClick}>
      <span className="tw:grid tw:size-10 tw:shrink-0 tw:place-items-center tw:rounded-xl tw:bg-[var(--store-command-plum-soft)] tw:text-[var(--store-command-plum-deep)]"><Icon className="tw:size-5" /></span>
      <span className="tw:min-w-0 tw:flex-1"><span className="tw:block tw:text-xs tw:text-[var(--store-command-muted)]">{input.label}</span><strong className="tw:mt-1 tw:block tw:text-2xl tw:font-semibold tw:text-[var(--store-command-ink)]">{input.value}</strong></span>
    </button>
  )
}

function KpiContributionTable({ model, rows, className = '' }: { model: StoreKpiHighlightsPageModel; rows: DisplayKpiRow[]; className?: string }) {
  return (
    <section className={`tw:overflow-hidden tw:rounded-3xl tw:border tw:border-border/80 tw:bg-white/[0.88] tw:shadow-sm ${className}`}>
      <div className="tw:flex tw:flex-col tw:gap-2 tw:border-b tw:border-border/70 tw:p-4 tw:sm:flex-row tw:sm:items-center tw:sm:justify-between">
        <div>
          <h2 className="tw:text-lg tw:font-semibold tw:text-[var(--store-command-ink)]">{model.t('storeKpis.commandContributionTitle')}</h2>
          <div className="tw:mt-2 tw:flex tw:flex-wrap tw:gap-3 tw:text-xs tw:font-medium tw:text-[var(--store-command-muted)]">
            <span className="tw:inline-flex tw:items-center tw:gap-1"><span className="tw:size-2 tw:rounded-full tw:bg-[var(--store-command-mint)]" />{model.t('storeKpis.commandReferenceGood')}</span>
            <span className="tw:inline-flex tw:items-center tw:gap-1"><span className="tw:size-2 tw:rounded-full tw:bg-[var(--store-command-warning)]" />{model.t('storeKpis.commandReferenceWatch')}</span>
            <span className="tw:inline-flex tw:items-center tw:gap-1"><span className="tw:size-2 tw:rounded-full tw:bg-[var(--store-command-danger)]" />{model.t('storeKpis.commandReferenceAction')}</span>
          </div>
        </div>
        <StoreStatusBadge tone="calm">{model.t('storeKpis.commandStoreTab')}</StoreStatusBadge>
      </div>
      {rows.length > 0 ? (
        <div className="tw:overflow-x-auto">
          <table className="tw:min-w-[860px] tw:w-full tw:border-collapse tw:text-left">
            <thead className="tw:bg-[var(--store-command-surface-soft)] tw:text-xs tw:font-semibold tw:uppercase tw:text-[var(--store-command-muted)]">
              <tr>
                {['KPI', model.t('storeKpis.actual'), model.t('storeKpis.reference.default'), model.t('storeKpis.commandRatio'), model.t('storeKpis.weightedContribution'), model.t('storeKpis.kpiContribution'), model.t('storeKpis.status')].map((label) => (
                  <th key={label} className="tw:px-4 tw:py-3">{label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => <ContributionRow key={row.kpiCode} model={model} code={row.kpiCode} row={row} />)}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="tw:p-4">
          <StoreEmptyState title={model.t('storeKpis.noScorableRows')} description={model.t('storeKpis.noTopSignalCopy')} />
        </div>
      )}
    </section>
  )
}

function ContributionRow({ model, code, row }: { model: StoreKpiHighlightsPageModel; code: string; row: DisplayKpiRow | undefined }) {
  const Icon = metricIcons[code] ?? Target
  const contribution = findContribution(model, code)
  const checklistMissing = code.includes('CHECKLIST') && (!row || row.scoreStatus !== 'scored')
  const displayLabel = formatKpiMetricLabel(model.t, code, row?.kpiName ?? row?.kpiCode ?? code)
  const secondaryLabel = row ? getSafeKpiSecondaryLabel(row.kpiCode ?? code) : model.t('storeKpis.kpiRowWaiting')

  return (
    <tr className="tw:border-t tw:border-border/70">
      <td className="tw:px-4 tw:py-3">
        <div className="tw:flex tw:items-center tw:gap-3">
          <span className="tw:grid tw:size-9 tw:place-items-center tw:rounded-xl tw:bg-[var(--store-command-plum-soft)] tw:text-[var(--store-command-plum)]"><Icon className="tw:size-4" /></span>
          <div>
            <strong className="tw:block tw:text-sm tw:font-semibold tw:text-[var(--store-command-ink)]">{displayLabel}</strong>
            {secondaryLabel ? <span className="tw:text-xs tw:text-[var(--store-command-muted)]">{secondaryLabel}</span> : null}
          </div>
        </div>
      </td>
      <td className="tw:px-4 tw:py-3 tw:text-sm tw:font-medium">{checklistMissing ? model.t('storeKpis.commandNotDone') : formatMetricValue(model.locale, model.t, row?.actualValue ?? null, code)}</td>
      <td className="tw:px-4 tw:py-3 tw:text-sm tw:text-[var(--store-command-muted)]">{formatReference(model, row)}</td>
      <td className="tw:px-4 tw:py-3"><span className={ratioClass(getMetricTone(row), checklistMissing)}>{formatReferenceRatio(model, row, code, checklistMissing)}</span></td>
      <td className="tw:px-4 tw:py-3 tw:text-sm tw:font-medium">{contribution ? `${contribution.metric.weightPercent}%` : model.t('storeKpis.noData')}</td>
      <td className="tw:px-4 tw:py-3 tw:text-sm tw:font-semibold">{contribution?.weightedContribution !== null && contribution?.weightedContribution !== undefined ? formatNumber(model.locale, contribution.weightedContribution * 100, 1) : model.t('storeKpis.noContribution')}</td>
      <td className="tw:px-4 tw:py-3"><StatusPill tone={checklistMissing ? 'danger' : getMetricTone(row)} label={checklistMissing ? model.t('storeKpis.commandPassive') : formatStatus(row, model)} /></td>
    </tr>
  )
}

function MonthlyTrend({ model, className = '' }: { model: StoreKpiHighlightsPageModel; className?: string }) {
  const currentMonth = model.liveSummary?.period?.periodStart?.slice(0, 7)
  const trendYear = (model.livePeriodStart || model.liveSummary?.period?.periodStart || new Date().toISOString()).slice(0, 4)
  const months = [...new Map((model.liveSummary?.availablePeriods ?? [])
    .filter((period) => period.periodType === 'monthly' && period.periodStart.slice(0, 4) === trendYear)
    .map((period) => [period.periodStart.slice(0, 7), period] as const)).values()]
    .sort((left, right) => left.periodStart.localeCompare(right.periodStart))
    .slice(0, 12)
  const trendQueries = useQueries({
    queries: months.map((period) => ({
      queryKey: [
        'store-kpis-live-trend',
        model.selectedStoreId || model.primaryStoreId || 'no-selected-store',
        period.periodStart,
      ],
      queryFn: () =>
        getStoreKpiHighlights({
          periodType: 'monthly',
          periodStart: period.periodStart,
          ...(model.selectedStoreId ? { storeId: model.selectedStoreId } : {}),
        }),
      enabled: model.reportingAllowed && model.viewMode === 'live' && Boolean(model.liveSummary),
      ...transientQueryRetryOptions,
    })),
  })
  const loadedTrendItems = months.map((period, index) => {
    const queryState = trendQueries[index]
    const summary =
      queryState?.data ??
      (model.liveSummary?.period?.periodStart === period.periodStart
        ? model.liveSummary
        : undefined)
    const scoreValue = calculateStoreScoreFromHighlights(summary)

    return {
      isCurrent: period.periodStart.slice(0, 7) === currentMonth,
      isError: queryState?.isError ?? false,
      isLoading: queryState?.isLoading ?? false,
      label: formatShortMonth(period.periodStart, model.locale),
      periodStart: period.periodStart,
      scoreValue,
    }
  })
  const history = buildKpiMonthlyHistory({
    year: Number(trendYear),
    rows: loadedTrendItems.map((item) => ({ periodStart: item.periodStart, score: item.scoreValue })),
  })
  const loadedByPeriod = new Map(loadedTrendItems.map((item) => [item.periodStart.slice(0, 7), item]))
  const trendItems = history.map((item) => {
    const loaded = loadedByPeriod.get(item.periodStart.slice(0, 7))
    return {
      isCurrent: item.periodStart.slice(0, 7) === currentMonth,
      isError: loaded?.isError ?? false,
      isLoading: loaded?.isLoading ?? false,
      label: formatShortMonth(item.periodStart, model.locale),
      periodStart: item.periodStart,
      scoreValue: item.score,
    }
  })
  const validTrendItems = trendItems.filter((item) => !item.isLoading && !item.isError && item.scoreValue !== null)
  const hasTrendError = trendItems.some((item) => item.isError)
  const scoreValues = validTrendItems.map((item) => item.scoreValue ?? 0)
  const minScore = Math.min(...scoreValues)
  const maxScore = Math.max(...scoreValues)
  const chartPoints = trendItems.map((item, index) => ({
    ...item,
    x: trendItems.length === 0 ? 50 : ((index + 0.5) * 100) / trendItems.length,
    y:
      item.scoreValue === null || item.isLoading || item.isError || scoreValues.length === 0
        ? null
        : maxScore === minScore
          ? 50
          : 82 - (((item.scoreValue ?? 0) - minScore) / (maxScore - minScore)) * 58,
  }))
  const lineSegments = chartPoints.reduce<Array<Array<(typeof chartPoints)[number] & { y: number }>>>((segments, item) => {
    if (item.y === null) {
      if (segments.at(-1)?.length) segments.push([])
      return segments
    }
    if (segments.length === 0) segments.push([])
    segments.at(-1)?.push(item as (typeof chartPoints)[number] & { y: number })
    return segments
  }, []).filter((segment) => segment.length > 0)

  return (
    <section aria-label={model.t('storeKpis.commandTrendTitle')} className={`tw:rounded-3xl tw:border tw:border-border/80 tw:bg-white/[0.88] tw:p-4 tw:shadow-sm ${className}`}>
      <div className="tw:flex tw:items-center tw:justify-between tw:gap-3">
        <div>
          <h2 className="tw:text-lg tw:font-semibold tw:text-[var(--store-command-ink)]">{model.t('storeKpis.commandTrendTitle')}</h2>
          <p className="tw:text-sm tw:font-normal tw:text-[var(--store-command-muted)]">{model.t('storeKpis.commandTrendCopy')}</p>
        </div>
        <details className="tw:relative">
          <summary className="tw:flex tw:h-9 tw:cursor-pointer tw:items-center tw:gap-2 tw:rounded-xl tw:border tw:border-border tw:bg-white tw:px-3 tw:text-sm tw:font-medium"><CalendarDays className="tw:size-4" />{currentMonth?.slice(0, 4) ?? new Date().getFullYear()}</summary>
        </details>
      </div>
      {hasTrendError ? (
        <div role="alert" className="tw:mt-4 tw:flex tw:flex-wrap tw:items-center tw:justify-between tw:gap-3 tw:rounded-2xl tw:border tw:border-destructive/25 tw:bg-destructive/5 tw:p-3 tw:text-sm">
          <strong>{model.t('storeKpis.commandTrendErrorTitle')}</strong>
          <button type="button" className="tw:min-h-11 tw:rounded-xl tw:border tw:border-border tw:bg-white tw:px-3 tw:font-semibold" onClick={() => void Promise.all(trendQueries.filter((query) => query.isError).map((query) => query.refetch()))}>{model.t('storeKpis.retry')}</button>
        </div>
      ) : null}
      <div className="tw:mt-5 tw:overflow-x-auto tw:rounded-2xl tw:bg-[var(--store-command-surface-soft)] tw:p-4">
        {trendItems.length > 0 ? (
          <div className="tw:relative tw:min-h-40 tw:min-w-[520px] tw:pt-3">
            <div className="tw:relative tw:h-[112px]">
              <svg className="tw:absolute tw:inset-0 tw:h-full tw:w-full tw:overflow-visible" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                <defs>
                  <linearGradient id="store-kpi-monthly-trend-line" x1="0" x2="1" y1="0" y2="0">
                    <stop offset="0%" stopColor="var(--store-command-cyan)" />
                    <stop offset="55%" stopColor="var(--store-command-plum)" />
                    <stop offset="100%" stopColor="var(--store-command-warning)" />
                  </linearGradient>
                </defs>
                {lineSegments.map((segment) => (
                  <polyline
                    key={segment.map((item) => item.periodStart).join('|')}
                    fill="none"
                    points={segment.map((item) => `${item.x},${item.y}`).join(' ')}
                    stroke="url(#store-kpi-monthly-trend-line)"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="3.2"
                    vectorEffect="non-scaling-stroke"
                  />
                ))}
              </svg>
              {chartPoints.map((item) => (
                <div
                  key={item.periodStart}
                  className="tw:absolute tw:z-10 tw:-translate-x-1/2 tw:-translate-y-1/2"
                  style={{ left: `${item.x}%`, top: `${item.y ?? 50}%` }}
                >
                  <div
                    className={[
                      'tw:size-4 tw:rounded-full tw:border-2 tw:border-[var(--store-command-surface-soft)] tw:shadow-[0_8px_18px_var(--store-command-focus)]',
                      item.y === null
                        ? 'tw:bg-white tw:ring-1 tw:ring-border'
                        : item.isCurrent
                          ? 'tw:bg-[var(--store-command-plum)]'
                          : 'tw:bg-[var(--store-command-cyan)]',
                    ].join(' ')}
                  />
                </div>
              ))}
            </div>
            <div className="tw:grid" style={{ gridTemplateColumns: `repeat(${trendItems.length}, minmax(64px, 1fr))` }}>
              {chartPoints.map((item) => (
                <div key={item.periodStart} className="tw:flex tw:min-w-16 tw:flex-col tw:items-center tw:gap-2">
                  <span className="tw:text-xs tw:font-medium tw:text-[var(--store-command-muted)]">{item.label}</span>
                  <strong className="tw:text-xs tw:font-semibold tw:text-[var(--store-command-ink)]">
                    {item.isLoading
                      ? '...'
                      : item.isError
                        ? model.t('storeKpis.commandTrendErrorItem')
                        : item.scoreValue === null
                          ? model.t('storeKpis.noData')
                        : formatNumber(model.locale, item.scoreValue, 1)}
                  </strong>
                </div>
              ))}
            </div>
          </div>
        ) : <StoreEmptyState title={model.t('storeKpis.commandTrendEmptyTitle')} description={model.t('storeKpis.commandTrendEmptyCopy')} />}
      </div>
    </section>
  )
}

function calculateStoreScoreFromHighlights(
  summary: StoreKpiHighlightsSummary | undefined,
) {
  if (!summary || summary.score.matchedMetrics <= 0) return null
  const score = toFiniteNumber(summary.score.value)
  return toHundredPointLiveStoreScore(score)
}

function PersonnelKpiRows(input: {
  model: StoreKpiHighlightsPageModel
  onPageChange: (page: number) => void
  page: number
  pageSize: number
  queryState: UseQueryResult<Awaited<ReturnType<typeof getRankings>>, unknown>
  rows: PersonnelRankingRow[]
  total: number
}) {
  if (input.queryState.isLoading && !input.queryState.data) return <StoreLoadingState title={input.model.t('storeKpis.loadingTitle')} description={input.model.t('storeKpis.loadingCopy')} />
  if (input.queryState.isError && !input.queryState.data) return <StoreErrorState title={input.model.t('storeKpis.rowsErrorTitle')} description={input.model.t('storeKpis.personnelKpiUnavailableCopy')} action={{ label: input.model.t('storeKpis.retry'), onClick: () => void input.queryState.refetch() }} />

  return (
    <section className="tw:overflow-hidden tw:rounded-3xl tw:border tw:border-border/80 tw:bg-white/[0.88] tw:shadow-sm">
      {input.queryState.isError ? <InlineBackgroundError model={input.model} onRetry={() => void input.queryState.refetch()} /> : null}
      <div className="tw:flex tw:items-center tw:justify-between tw:border-b tw:border-border/70 tw:p-4">
        <div><h2 className="tw:text-lg tw:font-semibold tw:text-[var(--store-command-ink)]">{input.model.t('storeKpis.commandPeopleTab')}</h2><p className="tw:text-sm tw:font-normal tw:text-[var(--store-command-muted)]">{input.model.t('storeKpis.commandPeopleCopy')}</p></div>
        <StoreStatusBadge tone="calm">{input.model.t('storeKpis.commandPeopleCount', { count: input.rows.length })}</StoreStatusBadge>
      </div>
      {input.rows.length > 0 ? (
        <><div className="tw:overflow-x-auto">
          <table className="tw:min-w-[780px] tw:w-full tw:border-collapse tw:text-left">
            <thead className="tw:bg-[var(--store-command-surface-soft)] tw:text-xs tw:font-semibold tw:uppercase tw:text-[var(--store-command-muted)]">
              <tr>{['Personel', 'Skor', 'Katkı', 'UPT', 'ATV', 'HG%', 'Durum', 'Aksiyon'].map((label) => <th key={label} className="tw:px-4 tw:py-3">{label}</th>)}</tr>
            </thead>
            <tbody>{input.rows.map((row) => <PersonnelRow key={row.employeeId} model={input.model} row={row} />)}</tbody>
          </table>
        </div>
        {input.page > 0 || (input.page + 1) * input.pageSize < input.total ? (
          <nav aria-label={input.model.t('storeKpis.personnelPaginationLabel')} className="tw:flex tw:items-center tw:justify-between tw:gap-3 tw:border-t tw:border-border/70 tw:p-4">
            <button type="button" disabled={input.page === 0} className="tw:min-h-11 tw:rounded-xl tw:border tw:border-[var(--store-command-line)] tw:bg-white tw:px-4 tw:text-sm tw:font-semibold tw:disabled:opacity-40" onClick={() => input.onPageChange(Math.max(0, input.page - 1))}>{input.model.t('storeKpis.companyPrevious')}</button>
            <span className="tw:text-xs tw:text-[var(--store-command-muted)]">{input.model.t('storeKpis.companyPageSummary', { current: input.page + 1, total: Math.max(1, Math.ceil(input.total / input.pageSize)) })}</span>
            <button type="button" disabled={(input.page + 1) * input.pageSize >= input.total} className="tw:min-h-11 tw:rounded-xl tw:border tw:border-[var(--store-command-line)] tw:bg-white tw:px-4 tw:text-sm tw:font-semibold tw:disabled:opacity-40" onClick={() => input.onPageChange(input.page + 1)}>{input.model.t('storeKpis.companyNext')}</button>
          </nav>
        ) : null}</>
      ) : (
        <div className="tw:p-4"><StoreEmptyState title={input.model.t('storeKpis.personnelKpiEmptyTitle')} description={input.model.t('storeKpis.personnelKpiEmptyCopy')} /></div>
      )}
    </section>
  )
}

function PersonnelRow({ model, row }: { model: StoreKpiHighlightsPageModel; row: PersonnelRankingRow }) {
  const getMetric = (code: string) => row.metrics?.find((metric) => metric.code === code)
  const target = getMetric('TARGET_ACHIEVEMENT')
  const contribution = calculatePersonnelPrimaryContribution(model, target)
  const personnelStatus = classifyPersonnelPerformance(toFiniteNumber(row.scoreValue))
  const statusTone: MetricTone = personnelStatus === 'strong' ? 'good' : personnelStatus === 'watch' ? 'warn' : personnelStatus === 'behind' ? 'danger' : 'neutral'
  const employeeId = row.employeeId ?? ''
  const activePeriodStart = model.livePeriodStart || model.liveSummary?.period?.periodStart || model.routePeriodStart
  const profilePath = `/store/personnel/${encodeURIComponent(employeeId)}?mode=live&periodType=monthly${activePeriodStart ? `&periodStart=${encodeURIComponent(activePeriodStart)}` : ''}`

  return (
    <tr className="tw:border-t tw:border-border/70">
      <td className="tw:px-4 tw:py-3"><strong className="tw:block tw:text-sm tw:font-semibold tw:text-[var(--store-command-ink)]">{row.displayName}</strong></td>
      <td className="tw:px-4 tw:py-3 tw:text-sm tw:font-semibold">{formatNumber(model.locale, row.scoreValue, 1)}</td>
      <td className="tw:px-4 tw:py-3 tw:text-sm tw:font-semibold">{contribution === null ? model.t('storeKpis.noData') : formatNumber(model.locale, contribution, 1)}</td>
      <td className="tw:px-4 tw:py-3 tw:text-sm">{formatRankingMetric(model.locale, getMetric('UPT')?.actualValue)}</td>
      <td className="tw:px-4 tw:py-3 tw:text-sm">{formatCurrency(model.locale, getMetric('ATV')?.actualValue)}</td>
      <td className="tw:px-4 tw:py-3 tw:text-sm">{formatPersonnelTargetAchievement(model, target)}</td>
      <td className="tw:px-4 tw:py-3"><StatusPill tone={statusTone} label={personnelStatus === 'strong' ? model.t('storeKpis.commandStrong') : personnelStatus === 'watch' ? model.t('storeKpis.commandWatch') : personnelStatus === 'behind' ? model.t('storeKpis.commandBehind') : model.t('storeKpis.noData')} /></td>
      <td className="tw:px-4 tw:py-3">{row.canOpenProfile && employeeId ? <Link className="tw:inline-flex tw:h-8 tw:items-center tw:gap-2 tw:rounded-full tw:border tw:border-[var(--store-command-focus)] tw:px-3 tw:text-sm tw:font-semibold tw:text-[var(--store-command-plum)]" to={profilePath}>{model.t('storeKpis.commandProfile')}<ArrowRight className="tw:size-4" /></Link> : <span className="tw:text-sm tw:text-[var(--store-command-muted)]">{model.t('storeKpis.noData')}</span>}</td>
    </tr>
  )
}

function calculatePersonnelPrimaryContribution(
  model: StoreKpiHighlightsPageModel,
  metric: RankingMetricValue | undefined,
) {
  const profileMetric = model.personnelKpiScoreProfile?.metrics.find((item) =>
    item.code.toUpperCase() === 'TARGET_ACHIEVEMENT' ||
    (item.aliases ?? []).some((alias) => alias.toUpperCase() === 'TARGET_ACHIEVEMENT'),
  )
  const weight = toFiniteNumber(profileMetric?.weightPercent)
  const directContribution = toFiniteNumber(metric?.contributionValue)

  if (directContribution !== null && (weight === null || directContribution <= weight * 1.2 + 0.001)) {
    return directContribution
  }

  if (weight === null) return null

  const actualValue = toFiniteNumber(metric?.actualValue)
  const referenceValue = toFiniteNumber(metric?.targetValue) ?? toFiniteNumber(metric?.benchmarkValue)
  if (actualValue === null || referenceValue === null || referenceValue === 0) return null

  return Math.min(actualValue / Math.abs(referenceValue), 1.2) * weight
}

function ScoreSourceCard({ model, missingChecklistCodes }: { model: StoreKpiHighlightsPageModel; missingChecklistCodes: string[] }) {
  const kpiContributionItems = model.weightedScore.contributions
    .filter((item) => !isChecklistMetric(item.metric.code) && !isGsmMetric(item.metric.code))
    .map((item) => item.weightedContribution)
    .filter((value): value is number => value !== null)
  const kpiContribution = kpiContributionItems.length > 0
    ? kpiContributionItems.reduce((sum, value) => sum + value * 100, 0)
    : null
  const gsmContribution = findContribution(model, 'GSM_ONAY')?.weightedContribution ?? null
  const bmContribution = findContribution(model, 'BM_CHECKLIST')?.weightedContribution ?? null
  const vmContribution = findContribution(model, 'VM_CHECKLIST')?.weightedContribution ?? null

  return (
    <aside className="tw:rounded-3xl tw:border tw:border-border/80 tw:bg-white/[0.88] tw:p-4 tw:shadow-sm">
      <h2 className="tw:text-lg tw:font-semibold tw:text-[var(--store-command-ink)]">{model.t('storeKpis.commandScoreSourceTitle')}</h2>
      <p className="tw:mt-1 tw:text-sm tw:font-normal tw:text-[var(--store-command-muted)]">{model.t('storeKpis.commandScoreSourceCopy')}</p>
      <div className="tw:mt-5 tw:space-y-3">
        <SourceLine label={model.t('storeKpis.commandPersonnelImpact')} value={kpiContribution === null ? model.t('storeKpis.noData') : formatNumber(model.locale, kpiContribution, 1)} tone={kpiContribution === null ? 'warn' : 'good'} />
        <SourceLine label={model.t('storeKpis.metric.gsmOnay')} value={gsmContribution === null ? model.t('storeKpis.commandPassive') : formatNumber(model.locale, gsmContribution * 100, 1)} tone={gsmContribution === null ? 'warn' : 'good'} />
        <SourceLine label="BM Checklist" value={bmContribution === null ? model.t('storeKpis.commandPassive') : formatNumber(model.locale, bmContribution * 100, 1)} tone={bmContribution === null ? 'warn' : 'good'} />
        <SourceLine label="VM Checklist" value={vmContribution === null ? model.t('storeKpis.commandPassive') : formatNumber(model.locale, vmContribution * 100, 1)} tone={vmContribution === null ? 'warn' : 'good'} />
      </div>
      {missingChecklistCodes.length > 0 ? (
        <div className="tw:mt-5 tw:rounded-2xl tw:bg-[var(--store-command-warning-soft)] tw:p-3 tw:text-sm tw:font-normal tw:text-[var(--store-command-warning-ink)]">
          {model.t('storeKpis.commandPassiveRedistribution', {
            value: missingChecklistCodes.map((code) => formatKpiMetricLabel(model.t, code, code)).join(', '),
          })}
        </div>
      ) : null}
    </aside>
  )
}

function SourceLine({ label, value, tone }: { label: string; value: string; tone: MetricTone }) {
  return <div className="tw:flex tw:items-center tw:justify-between tw:gap-3 tw:rounded-2xl tw:border tw:border-border tw:p-3"><span className="tw:text-sm tw:font-medium tw:text-[var(--store-command-muted)]">{label}</span><StatusPill tone={tone} label={value} /></div>
}

function StatusPill({ tone, label }: { tone: MetricTone; label: string }) {
  return <span className={`tw:inline-flex tw:min-w-20 tw:items-center tw:justify-center tw:rounded-full tw:px-3 tw:py-1 tw:text-xs tw:font-semibold ${statusToneClass(tone)}`}>{label}</span>
}

function findMetricRow(rows: DisplayKpiRow[], code: string) {
  return rows.find((row) => normalizeKpiCode(row.kpiCode) === normalizeKpiCode(code))
}

function getSafeKpiSecondaryLabel(code: string) {
  const normalized = normalizeKpiCode(code)
  if (normalized === 'upt' || normalized === 'atv' || normalized === 'cr') {
    return normalized.toUpperCase()
  }

  return null
}

function findContribution(model: StoreKpiHighlightsPageModel, code: string) {
  return model.weightedScore.contributions.find(
    (item) => normalizeKpiCode(item.metric.code) === normalizeKpiCode(code),
  )
}

function normalizeKpiCode(input: string) {
  const normalized = input.trim().toLowerCase()
  if (normalized === 'gsm_onay' || normalized === 'gsm_approval') {
    return 'gsm_approval'
  }
  return normalized
}

function isChecklistMetric(code: string) {
  return normalizeKpiCode(code).includes('checklist')
}

function isGsmMetric(code: string) {
  return normalizeKpiCode(code) === 'gsm_approval'
}

function emptyRow(code: string): DisplayKpiRow {
  return { storeId: '', kpiCode: code, kpiName: code, periodStart: '', periodEnd: '', targetValue: null, actualValue: null, achievementRate: null, benchmarkValue: null, benchmarkSource: undefined, actualRatio: null, scoredRatio: null, capRatio: null, isCapped: false, scoreContribution: null, missingReason: null, statusBand: null, scoreStatus: 'missing' }
}

function getMetricTone(row?: DisplayKpiRow): MetricTone {
  const classification = getKpiReferenceClassification(row)
  if (classification.kind === 'good') return 'good'
  if (classification.kind === 'watch') return 'warn'
  if (classification.kind === 'action') return 'danger'
  return 'neutral'
}

function InlineBackgroundError(input: { model: StoreKpiHighlightsPageModel; onRetry: () => void }) {
  return <div role="alert" className="tw:flex tw:flex-wrap tw:items-center tw:justify-between tw:gap-3 tw:border-b tw:border-destructive/20 tw:bg-destructive/5 tw:p-3 tw:text-sm"><span>{input.model.t('storeKpis.backgroundError')}</span><button type="button" className="tw:min-h-11 tw:rounded-xl tw:border tw:border-border tw:bg-white tw:px-3 tw:font-semibold" onClick={input.onRetry}>{input.model.t('storeKpis.retry')}</button></div>
}

function formatStatus(row: DisplayKpiRow | undefined, model: StoreKpiHighlightsPageModel) {
  const classification = getKpiReferenceClassification(row)
  if (classification.label === 'good') return model.t('storeKpis.commandReferenceGood')
  if (classification.label === 'watch') return model.t('storeKpis.commandReferenceWatch')
  if (classification.label === 'action') return model.t('storeKpis.commandReferenceAction')
  return model.t('storeKpis.commandReferenceUnavailable')
}

function getKpiReferenceClassification(row?: DisplayKpiRow) {
  if (!row) return classifyKpiReference({ actual: null, reference: null })
  return classifyKpiReference({
    actual: toFiniteNumber(row.actualValue),
    reference: toFiniteNumber(row.targetValue) ?? toFiniteNumber(row.benchmarkValue),
  })
}

function formatReference(model: StoreKpiHighlightsPageModel, row?: DisplayKpiRow) {
  if (!row) return model.t('storeKpis.noData')
  const reference = resolveLocalizedKpiScoreReference(model.t, {
    targetValue: row.targetValue,
    ...(row.benchmarkValue === undefined ? {} : { benchmarkValue: row.benchmarkValue }),
    benchmarkSource: row.benchmarkSource ?? null,
  })
  return formatMetricValue(model.locale, model.t, reference.value === null ? null : String(reference.value), row.kpiCode)
}

function formatNumber(locale: string, input: number, maximumFractionDigits = 0) {
  return new Intl.NumberFormat(locale, { maximumFractionDigits }).format(input)
}

function formatCurrency(locale: string, input: unknown) {
  const value = toFiniteNumber(input)
  if (value === null) return '-'
  return new Intl.NumberFormat(locale, { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 }).format(value)
}

function formatRankingMetric(locale: string, input: unknown) {
  const value = toFiniteNumber(input)
  return value === null ? '-' : formatNumber(locale, value, 1)
}

function formatPersonnelTargetAchievement(
  model: StoreKpiHighlightsPageModel,
  metric: RankingMetricValue | undefined,
) {
  const actualValue = toFiniteNumber(metric?.actualValue)
  if (actualValue === null) return model.t('storeKpis.noData')

  const targetValue = toFiniteNumber(metric?.targetValue) ?? toFiniteNumber(metric?.benchmarkValue)
  if (targetValue === null || targetValue === 0) return model.t('storeKpis.targetWaiting')

  const ratio = targetValue !== null && targetValue !== 0
    ? actualValue / Math.abs(targetValue)
    : actualValue

  return `${formatNumber(model.locale, ratio * 100, 0)}%`
}

function toFiniteNumber(input: unknown) {
  if (input === null || input === undefined || input === '') return null
  const value = Number(input)
  return Number.isFinite(value) ? value : null
}

function formatReferenceRatio(
  model: StoreKpiHighlightsPageModel,
  row: DisplayKpiRow | undefined,
  code: string,
  checklistMissing: boolean,
) {
  if (checklistMissing) return model.t('storeKpis.commandNotDone')
  if (getKpiReferenceClassification(row).ratio === null) return model.t('storeKpis.noData')
  return formatAchievementValue(model.locale, model.t, row ?? emptyRow(code))
}

function formatShortMonth(input: string, locale: string) {
  return new Intl.DateTimeFormat(locale, { month: 'long' }).format(new Date(`${input.slice(0, 10)}T00:00:00Z`))
}

function statusToneClass(tone: MetricTone) {
  if (tone === 'good') return 'tw:bg-[var(--store-command-mint-soft)] tw:text-[var(--store-command-success-ink)]'
  if (tone === 'warn') return 'tw:bg-[var(--store-command-warning-soft)] tw:text-[var(--store-command-warning-ink)]'
  if (tone === 'danger') return 'tw:bg-[var(--store-command-danger-soft)] tw:text-[var(--store-command-danger)]'
  return 'tw:bg-[var(--store-command-plum-soft)] tw:text-[var(--store-command-plum)]'
}

function ratioClass(tone: MetricTone, danger = false) {
  return `tw:inline-flex tw:min-w-24 tw:items-center tw:justify-center tw:rounded-full tw:px-3 tw:py-1 tw:text-xs tw:font-semibold ${danger ? statusToneClass('danger') : statusToneClass(tone)}`
}
