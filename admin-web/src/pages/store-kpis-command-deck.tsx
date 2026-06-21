import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  BadgeCheck,
  CalendarDays,
  ClipboardCheck,
  ClipboardX,
  MousePointerClick,
  PackagePlus,
  Receipt,
  RefreshCw,
  Target,
} from 'lucide-react'
import { useQueries, useQuery, type UseQueryResult } from '@tanstack/react-query'
import { Button } from '../components/ui/button'
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
import { StoreEmptyState, StoreErrorState, StoreLoadingState, StoreStatusBadge, StoreSurfacePage } from './store-surface-primitives'

type MetricTone = 'good' | 'warn' | 'danger' | 'neutral'

const metricColors: Record<string, string> = {
  TARGET_ACHIEVEMENT: '#18bfd0',
  UPT: '#6d4df7',
  ATV: '#f59e0b',
  CR: '#f43f72',
  gsm_approval: '#18bfd0',
  BM_CHECKLIST: '#3878ff',
  VM_CHECKLIST: '#13a779',
}

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
  const [activeDot, setActiveDot] = useState<string | null>(null)
  const storeId = model.effectiveStoreId ?? ''
  const periodStart = model.liveSummary?.period?.periodStart ?? model.livePeriodStart
  const personnelRankingQuery = useQuery({
    queryKey: ['store-kpis-personnel-ranking', storeId || 'no-store', periodStart || 'latest-monthly'],
    queryFn: () =>
      getRankings({
        periodType: 'monthly',
        ...(periodStart ? { periodStart } : {}),
        ...(storeId ? { storeId } : {}),
        limit: 100,
        offset: 0,
      }),
    enabled: model.reportingAllowed && model.viewMode === 'live' && Boolean(storeId),
    ...transientQueryRetryOptions,
  })
  const personnelLeaderboard = personnelRankingQuery.data?.personnelLeaderboard
  const storeFilteredPersonnelRows = personnelLeaderboard?.items ?? []
  const managedPersonnelRows = personnelLeaderboard?.managedStorePersonnel ?? []
  const personnelRows =
    model.viewMode === 'live'
      ? model.storeKpiSurfaceMode === 'regionStoreDetail'
        ? storeFilteredPersonnelRows
        : managedPersonnelRows
      : []
  const scoreValue = Math.round(model.weightedScore.scoreValue * 1000) / 10
  const storeRows = useMemo(
    () => storeMetricOrder.map((code) => findMetricRow(model.rows, code)).filter(Boolean) as DisplayKpiRow[],
    [model.rows],
  )
  const missingChecklistCodes = storeMetricOrder.filter((code) => {
    if (!code.includes('CHECKLIST')) return false
    const row = findMetricRow(model.rows, code)
    return !row || row.scoreStatus !== 'scored'
  })

  return (
    <StoreSurfacePage ariaLabel={model.t('storeKpis.title')}>
      <StoreKpisCommandDeckHeader
        activeTab={activeTab}
        controls={<CommandDeckControls model={model} />}
        model={model}
        personnelCount={personnelRows.length}
        setActiveTab={setActiveTab}
        storeKpiCount={storeRows.length}
      />

      {activeTab === 'store' ? (
        <div className="tw:grid tw:gap-4 tw:xl:grid-cols-[390px_minmax(0,1fr)]">
          <ScoreOrbit
            model={model}
            scoreValue={scoreValue}
            activeDot={activeDot}
            setActiveDot={setActiveDot}
          />
          <StoreKpiTiles model={model} />
          <KpiContributionTable model={model} rows={storeRows} className="tw:xl:col-span-2" />
          <MonthlyTrend model={model} className="tw:xl:col-span-2" />
        </div>
      ) : (
        <div className="tw:grid tw:gap-4 tw:xl:grid-cols-[minmax(0,1fr)_320px]">
          <PersonnelKpiRows
            model={model}
            queryState={personnelRankingQuery}
            rows={personnelRows}
          />
          <ScoreSourceCard model={model} missingChecklistCodes={missingChecklistCodes} />
        </div>
      )}
    </StoreSurfacePage>
  )
}

function CommandDeckControls({ model }: { model: StoreKpiHighlightsPageModel }) {
  return (
    <>
      <PeriodControls model={model} />
      <Button
        type="button"
        variant="default"
        className="tw:h-10 tw:rounded-xl tw:bg-[#6d4df7] tw:px-4 tw:text-sm tw:font-medium"
        onClick={() => (model.viewMode === 'live' ? model.liveKpiQuery.refetch() : model.closedKpiQuery.refetch())}
      >
        <RefreshCw className="tw:mr-2 tw:size-4" />
        {model.t('storeKpis.refreshData')}
      </Button>
    </>
  )
}

function PeriodControls({ model }: { model: StoreKpiHighlightsPageModel }) {
  const livePeriods = model.liveSummary?.availablePeriods.filter((period) => period.periodType === 'monthly') ?? []

  return (
    <div className="tw:flex tw:flex-wrap tw:items-center tw:gap-2">
      {model.closedSnapshotModeAllowed ? (
        <div className="tw:flex tw:rounded-xl tw:border tw:border-border tw:bg-white tw:p-1">
          {(['live', 'closed'] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              className={`tw:h-8 tw:rounded-lg tw:px-3 tw:text-xs tw:font-medium ${model.viewMode === mode ? 'tw:bg-[#6d4df7] tw:text-white' : 'tw:text-[#56627e]'}`}
              onClick={() => model.setViewMode(mode)}
            >
              {mode === 'live' ? model.t('storeKpis.livePeriod') : model.t('storeKpis.closedDay')}
            </button>
          ))}
        </div>
      ) : null}
      {model.viewMode === 'live' ? (
        <select
          aria-label={model.t('storeKpis.livePeriodSelect')}
          className="tw:h-10 tw:rounded-xl tw:border tw:border-border tw:bg-white tw:px-3 tw:text-sm tw:font-medium tw:text-[#071332]"
          value={model.livePeriodStart}
          onChange={(event) => model.setLivePeriodStart(event.target.value)}
        >
          <option value="">{model.t('storeKpis.latestMonthlyPeriod')}</option>
          {livePeriods.map((period) => (
            <option key={`${period.periodType}:${period.periodStart}`} value={period.periodStart}>
              {formatMonthLabel(period.periodStart, model.locale)}
            </option>
          ))}
        </select>
      ) : (
        <select
          aria-label={model.t('storeKpis.closedRecordSelect')}
          className="tw:h-10 tw:rounded-xl tw:border tw:border-border tw:bg-white tw:px-3 tw:text-sm tw:font-medium tw:text-[#071332]"
          value={model.selectedSnapshotRunId}
          onChange={(event) => model.setSelectedSnapshotRunId(event.target.value)}
        >
          {model.availableSnapshotRuns.map((run) => (
            <option key={run.snapshotRunId} value={run.snapshotRunId}>
              {run.snapshotDate ?? run.periodStart}
            </option>
          ))}
        </select>
      )}
    </div>
  )
}

function ScoreOrbit(input: {
  model: StoreKpiHighlightsPageModel
  scoreValue: number
  activeDot: string | null
  setActiveDot: (value: string | null) => void
}) {
  const gradient = buildScoreGradient(input.model)
  const activeContribution = input.activeDot
    ? findContribution(input.model, input.activeDot)
    : null

  return (
    <section className="tw:rounded-3xl tw:border tw:border-white/80 tw:bg-white/[0.82] tw:p-5 tw:shadow-[0_20px_60px_rgba(83,95,130,0.14)]">
      <div className="tw:mx-auto tw:grid tw:size-72 tw:place-items-center tw:rounded-full tw:p-4 tw:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.9),0_24px_60px_rgba(91,72,230,0.16)]" style={{ background: gradient }}>
        <div className="tw:grid tw:size-48 tw:place-items-center tw:rounded-full tw:bg-white tw:text-center tw:shadow-inner">
          <div>
            <strong className="tw:block tw:text-5xl tw:font-semibold tw:text-[#071332]">
              {formatNumber(input.model.locale, input.scoreValue, 1)}
            </strong>
            <span className="tw:text-sm tw:font-medium tw:text-[#7a839f]">{input.model.t('storeKpis.storeScore')}</span>
          </div>
        </div>
      </div>
      <div className="tw:mt-4 tw:flex tw:justify-center tw:gap-2" aria-label={input.model.t('storeKpis.commandScoreLegend')}>
        {input.model.weightedScore.contributions.map((item) => {
          const code = item.metric.code
          const contribution = item.weightedContribution * 100
          const label = `${formatKpiMetricLabel(input.model.t, code, item.metric.label)} - ${Number.isFinite(contribution) ? formatNumber(input.model.locale, contribution, 1) : input.model.t('storeKpis.noContribution')}`
          return (
            <button
              key={code}
              type="button"
              className="tw:size-7 tw:rounded-full tw:border tw:border-white tw:shadow-sm tw:ring-offset-2 focus-visible:tw:outline-none focus-visible:tw:ring-2 focus-visible:tw:ring-[#6d4df7]"
              style={{ backgroundColor: metricColors[code] ?? '#94a3b8' }}
              title={label}
              aria-label={label}
              onMouseEnter={() => input.setActiveDot(code)}
              onFocus={() => input.setActiveDot(code)}
              onClick={() => input.setActiveDot(input.activeDot === code ? null : code)}
            />
          )
        })}
      </div>
      <div className="tw:mt-3 tw:min-h-8 tw:text-center tw:text-sm tw:font-medium tw:text-[#56627e]">
        {activeContribution
          ? `${formatKpiMetricLabel(input.model.t, activeContribution.metric.code, activeContribution.metric.label)}: ${formatNumber(input.model.locale, activeContribution.weightedContribution * 100, 1)}`
          : input.model.t('storeKpis.commandScoreLegendHint')}
      </div>
    </section>
  )
}

function StoreKpiTiles({ model }: { model: StoreKpiHighlightsPageModel }) {
  return (
    <section className="tw:grid tw:gap-3 tw:sm:grid-cols-2 tw:xl:grid-cols-3">
      {storeMetricOrder.map((code) => (
        <MetricTile key={code} model={model} code={code} row={findMetricRow(model.rows, code)} />
      ))}
    </section>
  )
}

function MetricTile({ model, code, row }: { model: StoreKpiHighlightsPageModel; code: string; row: DisplayKpiRow | undefined }) {
  const Icon = metricIcons[code] ?? Target
  const checklistMissing = code.includes('CHECKLIST') && (!row || row.scoreStatus !== 'scored')
  const tone = checklistMissing ? 'danger' : getMetricTone(row)
  const title = formatKpiMetricLabel(model.t, code, row?.kpiName ?? code)
  const value = checklistMissing ? model.t('storeKpis.commandNotDone') : formatMetricValue(model.locale, model.t, row?.actualValue ?? null, code)

  return (
    <article className="tw:rounded-3xl tw:border tw:border-white/80 tw:bg-white/[0.86] tw:p-4 tw:shadow-[0_18px_48px_rgba(83,95,130,0.12)]">
      <div className="tw:flex tw:items-start tw:justify-between tw:gap-3">
        <div className={`tw:grid tw:size-11 tw:place-items-center tw:rounded-2xl ${iconToneClass(tone)}`}>
          <Icon className="tw:size-5" />
        </div>
        <StatusPill tone={tone} label={checklistMissing ? model.t('storeKpis.commandPassive') : formatStatus(row, model)} />
      </div>
      <p className="tw:mt-4 tw:text-xs tw:font-semibold tw:text-[#65708d]">{title}</p>
      <strong className="tw:mt-1 tw:block tw:text-2xl tw:font-semibold tw:text-[#071332]">{value}</strong>
      {code === 'TARGET_ACHIEVEMENT' ? <TargetProgress model={model} row={row} /> : (
        <p className="tw:mt-2 tw:text-sm tw:font-normal tw:text-[#65708d]">
          {checklistMissing ? model.t('storeKpis.commandChecklistPassiveCopy') : formatReference(model, row)}
        </p>
      )}
    </article>
  )
}

function TargetProgress({ model, row }: { model: StoreKpiHighlightsPageModel; row: DisplayKpiRow | undefined }) {
  const ratio = parseRatio(row?.achievementRate)
  const pct = Math.max(0, Math.min(100, ratio * 100))
  return (
    <div className="tw:mt-3">
      <div className="tw:h-2 tw:overflow-hidden tw:rounded-full tw:bg-[#e6eaf3]">
        <div className="tw:h-full tw:rounded-full tw:bg-[linear-gradient(90deg,#6d4df7,#18bfd0)]" style={{ width: `${pct}%` }} />
      </div>
      <p className="tw:mt-2 tw:text-sm tw:font-normal tw:text-[#65708d]">
        {ratio > 0
          ? model.t('storeKpis.commandTargetProgress', { value: formatNumber(model.locale, ratio * 100, 0) })
          : formatReference(model, row)}
      </p>
    </div>
  )
}

function KpiContributionTable({ model, rows, className = '' }: { model: StoreKpiHighlightsPageModel; rows: DisplayKpiRow[]; className?: string }) {
  return (
    <section className={`tw:overflow-hidden tw:rounded-3xl tw:border tw:border-border/80 tw:bg-white/[0.88] tw:shadow-sm ${className}`}>
      <div className="tw:flex tw:flex-col tw:gap-2 tw:border-b tw:border-border/70 tw:p-4 tw:sm:flex-row tw:sm:items-center tw:sm:justify-between">
        <div>
          <h2 className="tw:text-lg tw:font-semibold tw:text-[#071332]">{model.t('storeKpis.commandContributionTitle')}</h2>
          <p className="tw:text-sm tw:font-normal tw:text-[#65708d]">{model.t('storeKpis.commandContributionCopy')}</p>
          <div className="tw:mt-2 tw:flex tw:flex-wrap tw:gap-3 tw:text-xs tw:font-medium tw:text-[#65708d]">
            <span className="tw:inline-flex tw:items-center tw:gap-1"><span className="tw:size-2 tw:rounded-full tw:bg-[#15a675]" />{model.t('storeKpis.commandToneGood')}</span>
            <span className="tw:inline-flex tw:items-center tw:gap-1"><span className="tw:size-2 tw:rounded-full tw:bg-[#f59e0b]" />{model.t('storeKpis.commandToneWarn')}</span>
            <span className="tw:inline-flex tw:items-center tw:gap-1"><span className="tw:size-2 tw:rounded-full tw:bg-[#f43f72]" />{model.t('storeKpis.commandToneProblem')}</span>
          </div>
        </div>
        <StoreStatusBadge tone="calm">{model.t('storeKpis.commandStoreTab')}</StoreStatusBadge>
      </div>
      {rows.length > 0 ? (
        <div className="tw:overflow-x-auto">
          <table className="tw:min-w-[860px] tw:w-full tw:border-collapse tw:text-left">
            <thead className="tw:bg-[#f7f8fc] tw:text-xs tw:font-semibold tw:uppercase tw:text-[#63708f]">
              <tr>
                {['KPI', model.t('storeKpis.actual'), model.t('storeKpis.reference.default'), model.t('storeKpis.commandRatio'), model.t('storeKpis.weightedContribution'), model.t('storeKpis.kpiContribution'), model.t('storeKpis.status')].map((label) => (
                  <th key={label} className="tw:px-4 tw:py-3">{label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {storeMetricOrder.map((code) => {
                const row = findMetricRow(rows, code)
                return <ContributionRow key={code} model={model} code={code} row={row} />
              })}
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

  return (
    <tr className="tw:border-t tw:border-border/70">
      <td className="tw:px-4 tw:py-3">
        <div className="tw:flex tw:items-center tw:gap-3">
          <span className="tw:grid tw:size-9 tw:place-items-center tw:rounded-xl tw:bg-[#efe9ff] tw:text-[#6d4df7]"><Icon className="tw:size-4" /></span>
          <div><strong className="tw:block tw:text-sm tw:font-semibold tw:text-[#071332]">{formatKpiMetricLabel(model.t, code, row?.kpiName ?? code)}</strong><span className="tw:text-xs tw:text-[#65708d]">{row?.kpiCode ?? model.t('storeKpis.kpiRowWaiting')}</span></div>
        </div>
      </td>
      <td className="tw:px-4 tw:py-3 tw:text-sm tw:font-medium">{checklistMissing ? model.t('storeKpis.commandNotDone') : formatMetricValue(model.locale, model.t, row?.actualValue ?? null, code)}</td>
      <td className="tw:px-4 tw:py-3 tw:text-sm tw:text-[#65708d]">{formatReference(model, row)}</td>
      <td className="tw:px-4 tw:py-3"><span className={ratioClass(getMetricTone(row), checklistMissing)}>{checklistMissing ? model.t('storeKpis.commandNotDone') : formatAchievementValue(model.locale, model.t, row ?? emptyRow(code))}</span></td>
      <td className="tw:px-4 tw:py-3 tw:text-sm tw:font-medium">{contribution ? `${contribution.metric.weightPercent}%` : model.t('storeKpis.noData')}</td>
      <td className="tw:px-4 tw:py-3 tw:text-sm tw:font-semibold">{contribution ? formatNumber(model.locale, contribution.weightedContribution * 100, 1) : model.t('storeKpis.noContribution')}</td>
      <td className="tw:px-4 tw:py-3"><StatusPill tone={checklistMissing ? 'danger' : getMetricTone(row)} label={checklistMissing ? model.t('storeKpis.commandPassive') : formatStatus(row, model)} /></td>
    </tr>
  )
}

function MonthlyTrend({ model, className = '' }: { model: StoreKpiHighlightsPageModel; className?: string }) {
  const currentMonth = model.liveSummary?.period?.periodStart?.slice(0, 7)
  const trendYear = (model.livePeriodStart || model.liveSummary?.period?.periodStart || new Date().toISOString()).slice(0, 4)
  const months = (model.liveSummary?.availablePeriods ?? [])
    .filter((period) => period.periodType === 'monthly' && period.periodStart.slice(0, 4) === trendYear)
    .sort((left, right) => left.periodStart.localeCompare(right.periodStart))
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
  const trendItems = months.map((period, index) => {
    const queryState = trendQueries[index]
    const summary =
      queryState?.data ??
      (model.liveSummary?.period?.periodStart === period.periodStart
        ? model.liveSummary
        : undefined)
    const scoreValue = calculateStoreScoreFromHighlights(model, summary)

    return {
      isCurrent: period.periodStart.slice(0, 7) === currentMonth,
      isError: queryState?.isError ?? false,
      isLoading: queryState?.isLoading ?? false,
      label: formatShortMonth(period.periodStart, model.locale),
      periodStart: period.periodStart,
      scoreValue,
    }
  })
  const validTrendItems = trendItems.filter((item) => !item.isLoading && !item.isError && item.scoreValue !== null)
  const scoreValues = validTrendItems.map((item) => (item.scoreValue ?? 0) * 100)
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
          : 82 - ((((item.scoreValue ?? 0) * 100) - minScore) / (maxScore - minScore)) * 58,
  }))
  const linePath = chartPoints
    .filter((item): item is typeof item & { y: number } => item.y !== null)
    .map((item) => `${item.x},${item.y}`)
    .join(' ')

  return (
    <section className={`tw:rounded-3xl tw:border tw:border-border/80 tw:bg-white/[0.88] tw:p-4 tw:shadow-sm ${className}`}>
      <div className="tw:flex tw:items-center tw:justify-between tw:gap-3">
        <div>
          <h2 className="tw:text-lg tw:font-semibold tw:text-[#071332]">{model.t('storeKpis.commandTrendTitle')}</h2>
          <p className="tw:text-sm tw:font-normal tw:text-[#65708d]">{model.t('storeKpis.commandTrendCopy')}</p>
        </div>
        <details className="tw:relative">
          <summary className="tw:flex tw:h-9 tw:cursor-pointer tw:items-center tw:gap-2 tw:rounded-xl tw:border tw:border-border tw:bg-white tw:px-3 tw:text-sm tw:font-medium"><CalendarDays className="tw:size-4" />{currentMonth?.slice(0, 4) ?? new Date().getFullYear()}</summary>
        </details>
      </div>
      <div className="tw:mt-5 tw:overflow-x-auto tw:rounded-2xl tw:bg-[#f7f8fc] tw:p-4">
        {trendItems.length > 0 ? (
          <div className="tw:relative tw:min-h-40 tw:min-w-[520px] tw:pt-3">
            <div className="tw:relative tw:h-[112px]">
              <svg className="tw:absolute tw:inset-0 tw:h-full tw:w-full tw:overflow-visible" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                <defs>
                  <linearGradient id="store-kpi-monthly-trend-line" x1="0" x2="1" y1="0" y2="0">
                    <stop offset="0%" stopColor="#20bfd3" />
                    <stop offset="55%" stopColor="#6d4df7" />
                    <stop offset="100%" stopColor="#f59e0b" />
                  </linearGradient>
                </defs>
                {linePath ? (
                  <polyline
                    fill="none"
                    points={linePath}
                    stroke="url(#store-kpi-monthly-trend-line)"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="3.2"
                    vectorEffect="non-scaling-stroke"
                  />
                ) : null}
              </svg>
              {chartPoints.map((item) => (
                <div
                  key={item.periodStart}
                  className="tw:absolute tw:z-10 tw:-translate-x-1/2 tw:-translate-y-1/2"
                  style={{ left: `${item.x}%`, top: `${item.y ?? 50}%` }}
                >
                  <div
                    className={[
                      'tw:size-4 tw:rounded-full tw:border-2 tw:border-[#f7f8fc] tw:shadow-[0_8px_18px_rgba(104,71,255,0.18)]',
                      item.y === null
                        ? 'tw:bg-white tw:ring-1 tw:ring-border'
                        : item.isCurrent
                          ? 'tw:bg-[#6d4df7]'
                          : 'tw:bg-[#20bfd3]',
                    ].join(' ')}
                  />
                </div>
              ))}
            </div>
            <div className="tw:grid" style={{ gridTemplateColumns: `repeat(${trendItems.length}, minmax(64px, 1fr))` }}>
              {chartPoints.map((item) => (
                <div key={item.periodStart} className="tw:flex tw:min-w-16 tw:flex-col tw:items-center tw:gap-2">
                  <span className="tw:text-xs tw:font-medium tw:text-[#65708d]">{item.label}</span>
                  <strong className="tw:text-xs tw:font-semibold tw:text-[#071332]">
                    {item.isLoading
                      ? '...'
                      : item.scoreValue === null || item.isError
                        ? model.t('storeKpis.noData')
                        : formatNumber(model.locale, item.scoreValue * 100, 1)}
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
  model: StoreKpiHighlightsPageModel,
  summary: StoreKpiHighlightsSummary | undefined,
) {
  if (!summary) return null

  return (model.storeKpiScoreProfile?.metrics ?? []).reduce((total, metric) => {
    const row = summary.metrics.find((item) => item.code.toUpperCase() === metric.code.toUpperCase())
    if (!row) return total
    if (row.scoreContribution !== null && row.scoreContribution !== undefined) {
      return total + Number(row.scoreContribution) / 100
    }

    const achievementRate = toFiniteNumber(row.achievementRate)
    return total + (achievementRate === null ? 0 : (Math.max(0, Math.min(achievementRate, 1.2)) * metric.weightPercent) / 100)
  }, 0)
}

function PersonnelKpiRows(input: {
  model: StoreKpiHighlightsPageModel
  queryState: UseQueryResult<Awaited<ReturnType<typeof getRankings>>, unknown>
  rows: PersonnelRankingRow[]
}) {
  if (input.queryState.isLoading) return <StoreLoadingState title={input.model.t('storeKpis.loadingTitle')} description={input.model.t('storeKpis.loadingCopy')} />
  if (input.queryState.isError) return <StoreErrorState title={input.model.t('storeKpis.rowsErrorTitle')} description={input.model.t('storeKpis.personnelKpiUnavailableCopy')} />

  return (
    <section className="tw:overflow-hidden tw:rounded-3xl tw:border tw:border-border/80 tw:bg-white/[0.88] tw:shadow-sm">
      <div className="tw:flex tw:items-center tw:justify-between tw:border-b tw:border-border/70 tw:p-4">
        <div><h2 className="tw:text-lg tw:font-semibold tw:text-[#071332]">{input.model.t('storeKpis.commandPeopleTab')}</h2><p className="tw:text-sm tw:font-normal tw:text-[#65708d]">{input.model.t('storeKpis.commandPeopleCopy')}</p></div>
        <StoreStatusBadge tone="calm">{input.model.t('storeKpis.commandPeopleCount', { count: input.rows.length })}</StoreStatusBadge>
      </div>
      {input.rows.length > 0 ? (
        <div className="tw:overflow-x-auto">
          <table className="tw:min-w-[780px] tw:w-full tw:border-collapse tw:text-left">
            <thead className="tw:bg-[#f7f8fc] tw:text-xs tw:font-semibold tw:uppercase tw:text-[#63708f]">
              <tr>{['Personel', 'Skor', 'Katkı', 'UPT', 'ATV', 'HG%', 'Durum', 'Aksiyon'].map((label) => <th key={label} className="tw:px-4 tw:py-3">{label}</th>)}</tr>
            </thead>
            <tbody>{input.rows.map((row) => <PersonnelRow key={row.employeeId} model={input.model} row={row} />)}</tbody>
          </table>
        </div>
      ) : (
        <div className="tw:p-4"><StoreEmptyState title={input.model.t('storeKpis.personnelKpiEmptyTitle')} description={input.model.t('storeKpis.personnelKpiEmptyCopy')} /></div>
      )}
    </section>
  )
}

function PersonnelRow({ model, row }: { model: StoreKpiHighlightsPageModel; row: PersonnelRankingRow }) {
  const getMetric = (code: string) => row.metrics?.find((metric) => metric.code === code)
  const target = getMetric('TARGET_ACHIEVEMENT')
  const statusTone: MetricTone = row.scoreValue >= 85 ? 'good' : row.scoreValue >= 75 ? 'warn' : 'danger'
  const employeeId = row.employeeId ?? ''
  const profilePath = `/store/personnel/${encodeURIComponent(employeeId)}?mode=live&periodType=monthly${model.liveSummary?.period?.periodStart ? `&periodStart=${encodeURIComponent(model.liveSummary.period.periodStart)}` : ''}`

  return (
    <tr className="tw:border-t tw:border-border/70">
      <td className="tw:px-4 tw:py-3"><strong className="tw:block tw:text-sm tw:font-semibold tw:text-[#071332]">{row.displayName}</strong></td>
      <td className="tw:px-4 tw:py-3 tw:text-sm tw:font-semibold">{formatNumber(model.locale, row.scoreValue, 1)}</td>
      <td className="tw:px-4 tw:py-3 tw:text-sm tw:font-semibold">{formatNumber(model.locale, row.metrics?.reduce((sum, metric) => sum + Number(metric.contributionValue ?? 0), 0) ?? 0, 1)}</td>
      <td className="tw:px-4 tw:py-3 tw:text-sm">{formatRankingMetric(model.locale, getMetric('UPT')?.actualValue)}</td>
      <td className="tw:px-4 tw:py-3 tw:text-sm">{formatCurrency(model.locale, getMetric('ATV')?.actualValue)}</td>
      <td className="tw:px-4 tw:py-3 tw:text-sm">{formatPersonnelTargetAchievement(model, target)}</td>
      <td className="tw:px-4 tw:py-3"><StatusPill tone={statusTone} label={statusTone === 'good' ? model.t('storeKpis.commandStrong') : statusTone === 'warn' ? model.t('storeKpis.commandWatch') : model.t('storeKpis.commandBehind')} /></td>
      <td className="tw:px-4 tw:py-3">{row.canOpenProfile && employeeId ? <Link className="tw:inline-flex tw:h-8 tw:items-center tw:gap-2 tw:rounded-full tw:border tw:border-[#b8a7ff] tw:px-3 tw:text-sm tw:font-semibold tw:text-[#6d4df7]" to={profilePath}>{model.t('storeKpis.commandProfile')}<ArrowRight className="tw:size-4" /></Link> : <span className="tw:text-sm tw:text-[#65708d]">{model.t('storeKpis.noData')}</span>}</td>
    </tr>
  )
}

function ScoreSourceCard({ model, missingChecklistCodes }: { model: StoreKpiHighlightsPageModel; missingChecklistCodes: string[] }) {
  const kpiContribution = model.weightedScore.contributions.filter((item) => !item.metric.code.includes('CHECKLIST')).reduce((sum, item) => sum + item.weightedContribution * 100, 0)
  const bmContribution = findContribution(model, 'BM_CHECKLIST')?.weightedContribution ?? null
  const vmContribution = findContribution(model, 'VM_CHECKLIST')?.weightedContribution ?? null

  return (
    <aside className="tw:rounded-3xl tw:border tw:border-border/80 tw:bg-white/[0.88] tw:p-4 tw:shadow-sm">
      <h2 className="tw:text-lg tw:font-semibold tw:text-[#071332]">{model.t('storeKpis.commandScoreSourceTitle')}</h2>
      <p className="tw:mt-1 tw:text-sm tw:font-normal tw:text-[#65708d]">{model.t('storeKpis.commandScoreSourceCopy')}</p>
      <div className="tw:mt-5 tw:space-y-3">
        <SourceLine label={model.t('storeKpis.commandPersonnelImpact')} value={formatNumber(model.locale, kpiContribution, 1)} tone="good" />
        <SourceLine label="BM Checklist" value={bmContribution === null ? model.t('storeKpis.commandPassive') : formatNumber(model.locale, bmContribution * 100, 1)} tone={bmContribution === null ? 'warn' : 'good'} />
        <SourceLine label="VM Checklist" value={vmContribution === null ? model.t('storeKpis.commandPassive') : formatNumber(model.locale, vmContribution * 100, 1)} tone={vmContribution === null ? 'warn' : 'good'} />
      </div>
      {missingChecklistCodes.length > 0 ? (
        <div className="tw:mt-5 tw:rounded-2xl tw:bg-[#fff7ed] tw:p-3 tw:text-sm tw:font-normal tw:text-[#9a4b00]">
          {model.t('storeKpis.commandPassiveRedistribution', {
            value: missingChecklistCodes.map((code) => formatKpiMetricLabel(model.t, code, code)).join(', '),
          })}
        </div>
      ) : null}
    </aside>
  )
}

function SourceLine({ label, value, tone }: { label: string; value: string; tone: MetricTone }) {
  return <div className="tw:flex tw:items-center tw:justify-between tw:gap-3 tw:rounded-2xl tw:border tw:border-border tw:p-3"><span className="tw:text-sm tw:font-medium tw:text-[#56627e]">{label}</span><StatusPill tone={tone} label={value} /></div>
}

function StatusPill({ tone, label }: { tone: MetricTone; label: string }) {
  return <span className={`tw:inline-flex tw:min-w-20 tw:items-center tw:justify-center tw:rounded-full tw:px-3 tw:py-1 tw:text-xs tw:font-semibold ${statusToneClass(tone)}`}>{label}</span>
}

function findMetricRow(rows: DisplayKpiRow[], code: string) {
  return rows.find((row) => normalizeKpiCode(row.kpiCode) === normalizeKpiCode(code))
}

function findContribution(model: StoreKpiHighlightsPageModel, code: string) {
  return model.weightedScore.contributions.find(
    (item) => normalizeKpiCode(item.metric.code) === normalizeKpiCode(code),
  )
}

function normalizeKpiCode(input: string) {
  return input.trim().toLowerCase()
}

function emptyRow(code: string): DisplayKpiRow {
  return { storeId: '', kpiCode: code, kpiName: code, periodStart: '', periodEnd: '', targetValue: null, actualValue: null, achievementRate: null, benchmarkValue: null, benchmarkSource: undefined, actualRatio: null, scoredRatio: null, capRatio: null, isCapped: false, scoreContribution: null, missingReason: null, statusBand: null, scoreStatus: 'missing' }
}

function buildScoreGradient(model: StoreKpiHighlightsPageModel) {
  let cursor = 0
  const segments = model.weightedScore.contributions.map((item) => {
    const start = cursor
    cursor += Math.max(0, item.metric.weightPercent)
    return `${metricColors[item.metric.code] ?? '#94a3b8'} ${start}% ${cursor}%`
  })
  return `conic-gradient(${segments.join(', ')})`
}

function getMetricTone(row?: DisplayKpiRow): MetricTone {
  if (!row || row.scoreStatus !== 'scored') return 'neutral'
  if (row.statusBand === 'exceeded' || row.statusBand === 'on_track') return 'good'
  if (row.statusBand === 'at_risk') return 'warn'
  return 'danger'
}

function formatStatus(row: DisplayKpiRow | undefined, model: StoreKpiHighlightsPageModel) {
  const tone = getMetricTone(row)
  if (tone === 'good') return model.t('storeKpis.commandStrong')
  if (tone === 'warn') return model.t('storeKpis.commandWatch')
  if (tone === 'danger') return model.t('storeKpis.commandBehind')
  return model.t('storeKpis.noData')
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

function parseRatio(input?: string | null) {
  const value = Number(input)
  return Number.isFinite(value) ? value : 0
}

function formatNumber(locale: string, input: number, maximumFractionDigits = 0) {
  return new Intl.NumberFormat(locale, { maximumFractionDigits }).format(input)
}

function formatCurrency(locale: string, input: unknown) {
  const value = Number(input)
  if (!Number.isFinite(value)) return '-'
  return new Intl.NumberFormat(locale, { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 }).format(value)
}

function formatRankingMetric(locale: string, input: unknown) {
  const value = Number(input)
  return Number.isFinite(value) ? formatNumber(locale, value, 1) : '-'
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
  const value = Number(input)
  return Number.isFinite(value) ? value : null
}

function formatMonthLabel(input: string, locale: string) {
  return new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(new Date(input))
}

function formatShortMonth(input: string, locale: string) {
  return new Intl.DateTimeFormat(locale, { month: 'short' }).format(new Date(input))
}

function iconToneClass(tone: MetricTone) {
  if (tone === 'good') return 'tw:bg-[#dcfce7] tw:text-[#13a779]'
  if (tone === 'warn') return 'tw:bg-[#fff7ed] tw:text-[#c96b00]'
  if (tone === 'danger') return 'tw:bg-[#ffe4ed] tw:text-[#e83f68]'
  return 'tw:bg-[#efe9ff] tw:text-[#6d4df7]'
}

function statusToneClass(tone: MetricTone) {
  if (tone === 'good') return 'tw:bg-[#dcfce7] tw:text-[#047857]'
  if (tone === 'warn') return 'tw:bg-[#fff3df] tw:text-[#b45309]'
  if (tone === 'danger') return 'tw:bg-[#ffe4ed] tw:text-[#be123c]'
  return 'tw:bg-[#eef2ff] tw:text-[#4f46e5]'
}

function ratioClass(tone: MetricTone, danger = false) {
  return `tw:inline-flex tw:min-w-24 tw:items-center tw:justify-center tw:rounded-full tw:px-3 tw:py-1 tw:text-xs tw:font-semibold ${danger ? statusToneClass('danger') : statusToneClass(tone)}`
}
