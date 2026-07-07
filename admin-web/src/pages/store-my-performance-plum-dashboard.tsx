import type { CSSProperties } from 'react'
import {
  ChartNoAxesColumnIncreasing,
  CircleCheck,
  Database,
  LineChart,
  Package,
  ShoppingBag,
  Target,
  type LucideIcon,
} from 'lucide-react'
import { Area, AreaChart, CartesianGrid, LabelList, ResponsiveContainer, XAxis, YAxis } from 'recharts'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { TranslateFunction } from '../features/localization/dictionary'

type TodayAction = {
  badge: string
  copy: string
  icon: 'data' | 'metric' | 'rhythm' | 'target'
  id: string
  title: string
  variant: 'default' | 'secondary' | 'outline' | 'destructive'
}

type MetricCard = {
  code: string
  contributionValue: number
  delta: string | null
  displayValue: string
  label: string
  progressPercent: number
  regionPopulationLabel: string
  regionRankLabel: string
  statusLabel: string
  storePopulationLabel: string
  storeRankLabel: string
  tone: string
  turkeyPopulationLabel: string
  turkeyRankLabel: string
  weightPercent: number
}

type MonthlyDetailRow = {
  key: string
  label: string
  scoreLabel: string
  scoreValue: number | null
  trendLabel: string | null
}

type StoreMyPerformancePlumDashboardProps = {
  actualSalesLabel: string
  gradeLabel: string
  isPartial: boolean
  metricCards: MetricCard[]
  monthlyDetailRows: MonthlyDetailRow[]
  onOpenKpiDetails: () => void
  remainingTargetLabel: string
  samePeriodScoreDelta: string | null
  scoreConfidence: string
  scoreFocus: string
  scoreSummary: string
  scoreValue: number
  regionPopulationLabel: string
  regionRankLabel: string
  storePopulationLabel: string
  storeRankLabel: string
  t: TranslateFunction
  targetProgressPercent: number
  targetSalesLabel: string
  targetStatusLabel: string
  todayActions: TodayAction[]
  turkeyPopulationLabel: string
  turkeyRankLabel: string
}

type StoreMeTrendChartPoint = {
  key: string
  label: string
  scoreLabel: string
  scoreValue: number
  trendLabel: string | null
}

const actionIconById: Record<TodayAction['icon'], LucideIcon> = {
  data: Database,
  metric: ChartNoAxesColumnIncreasing,
  rhythm: LineChart,
  target: Target,
}

const metricIconByCode: Record<string, LucideIcon> = {
  ATV: ShoppingBag,
  TARGET_ACHIEVEMENT: Target,
  UPT: Package,
}
const donutSegmentColors = [
  'var(--store-me-purple)',
  'var(--store-me-teal)',
  'var(--store-me-blue)',
  'var(--store-me-purple-soft)',
]

function clampBarPercent(value: number) {
  if (!Number.isFinite(value)) {
    return 0
  }

  return Math.min(100, Math.max(0, Math.round(value)))
}

function formatWholePercent(value: number) {
  if (!Number.isFinite(value)) {
    return '0'
  }

  return String(Math.max(0, Math.round(value)))
}

function progressStyle(value: number): CSSProperties {
  return { '--store-me-progress': `${clampBarPercent(value)}%` } as CSSProperties
}

function contributionStyle(value: number): CSSProperties {
  return { '--store-me-contribution': `${clampBarPercent(value)}%` } as CSSProperties
}

function donutStyle(metrics: MetricCard[]): CSSProperties {
  const totalWeight = metrics.reduce((total, metric) => total + Math.max(0, metric.weightPercent), 0)
  const weightBase = totalWeight > 0 ? totalWeight : 100
  let cursor = 0
  const segments = metrics.map((metric, index) => {
    const start = cursor
    cursor += (Math.max(0, metric.weightPercent) / weightBase) * 100
    const color = donutSegmentColors[index % donutSegmentColors.length]

    return `${color} ${start.toFixed(2)}% ${cursor.toFixed(2)}%`
  })
  const conicGradient = segments.length
    ? `conic-gradient(${segments.join(', ')})`
    : 'conic-gradient(var(--store-me-purple) 0% 100%)'

  return {
    background: `radial-gradient(circle at center, var(--store-me-surface-strong) 0 52%, transparent 53%), ${conicGradient}`,
  }
}

function scorePointLabel(value: number) {
  if (!Number.isFinite(value)) {
    return '0'
  }

  return Number.isInteger(value) ? value.toString() : value.toFixed(1)
}

function getMetric(metricCards: MetricCard[], code: string) {
  return metricCards.find((metric) => metric.code === code) ?? null
}

function compactChartLabel(label: string) {
  const trimmed = label.trim()
  const monthYearMatch = trimmed.match(/^(\S+)\s+20\d{2}$/u)

  if (monthYearMatch?.[1]) {
    return monthYearMatch[1].slice(0, 3)
  }

  if (trimmed.length <= 8) {
    return trimmed
  }

  return trimmed.slice(0, 8)
}

function buildTrendChart(rows: MonthlyDetailRow[], fallbackScore: number, fallbackLabel: string) {
  const usableRows = rows.filter((row) => row.scoreValue !== null).slice(-7)
  const chartRows = usableRows.length
    ? usableRows
    : [{
        key: 'current',
        label: fallbackLabel,
        scoreLabel: String(fallbackScore),
        scoreValue: fallbackScore,
        trendLabel: null,
      }]
  const chartPoints: StoreMeTrendChartPoint[] = chartRows.map((row) => ({
    key: row.key,
    label: compactChartLabel(row.label),
    scoreLabel: row.scoreLabel,
    scoreValue: row.scoreValue ?? 0,
    trendLabel: row.trendLabel,
  }))
  const firstChartRow = chartRows[0]!
  const bestRow = chartRows.reduce((best, row) => ((row.scoreValue ?? 0) > (best.scoreValue ?? 0) ? row : best), firstChartRow)
  const currentRow = chartRows[chartRows.length - 1]!

  return {
    bestRow,
    chartPoints,
    currentRow,
  }
}

function KpiProgress({
  displayValue,
  label,
  value,
}: {
  displayValue?: string
  label: string
  value: number
}) {
  const hasCustomDisplay = displayValue !== undefined
  const displayPercent = displayValue ?? `${clampBarPercent(value)}%`
  const ariaValue = hasCustomDisplay
    ? Math.max(0, Math.round(Number.isFinite(value) ? value : 0))
    : clampBarPercent(value)

  return (
    <div
      className="store-me-kpi-progress"
      style={progressStyle(value)}
      role="progressbar"
      aria-label={label}
      aria-valuenow={ariaValue}
      aria-valuemin={0}
      aria-valuemax={hasCustomDisplay ? Math.max(100, ariaValue) : 100}
    >
      <div className="store-me-progress-track" aria-hidden="true">
        <span />
      </div>
      <strong>{displayPercent}</strong>
    </div>
  )
}

function StoreMeTrendChart({ points }: { points: StoreMeTrendChartPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={296}>
      <AreaChart data={points} margin={{ top: 44, right: 30, bottom: 18, left: 34 }}>
        <defs>
          <linearGradient id="storeMePlumLine" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stopColor="var(--store-me-purple)" />
            <stop offset="52%" stopColor="var(--store-me-blue)" />
            <stop offset="100%" stopColor="var(--store-me-teal)" />
          </linearGradient>
          <linearGradient id="storeMePlumArea" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="var(--store-me-teal)" stopOpacity="0.28" />
            <stop offset="100%" stopColor="var(--store-me-purple)" stopOpacity="0.04" />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="rgba(92, 86, 116, 0.18)" strokeDasharray="6 8" vertical={false} />
        <XAxis dataKey="label" axisLine={false} tickLine={false} interval={0} padding={{ left: 22, right: 18 }} />
        <YAxis hide domain={['dataMin - 8', 'dataMax + 8']} />
        <Area
          type="monotone"
          dataKey="scoreValue"
          stroke="url(#storeMePlumLine)"
          strokeWidth={4}
          fill="url(#storeMePlumArea)"
          dot={{ r: 5, stroke: 'url(#storeMePlumLine)', strokeWidth: 3, fill: 'var(--store-me-surface-strong)' }}
          activeDot={{ r: 7, stroke: 'var(--store-me-purple)', strokeWidth: 3, fill: 'var(--store-me-surface-strong)' }}
        >
          <LabelList dataKey="scoreLabel" position="top" offset={12} className="store-me-chart-value" />
        </Area>
      </AreaChart>
    </ResponsiveContainer>
  )
}

function KpiCardHead({
  Icon,
  label,
  value,
}: {
  Icon: LucideIcon
  label: string
  value: string | number
}) {
  return (
    <div className="store-me-kpi-head">
      <span className="store-me-icon-bubble" aria-hidden="true">
        <Icon />
      </span>
      <span>
        <small>{label}</small>
        <strong>{value}</strong>
      </span>
    </div>
  )
}

function RankStrip({
  regionPopulationLabel,
  regionRankLabel,
  storePopulationLabel,
  storeRankLabel,
  t,
  turkeyPopulationLabel,
  turkeyRankLabel,
}: {
  regionPopulationLabel: string
  regionRankLabel: string
  storePopulationLabel: string
  storeRankLabel: string
  t: TranslateFunction
  turkeyPopulationLabel: string
  turkeyRankLabel: string
}) {
  return (
    <div className="store-me-rank-strip">
      <div className="store-me-strip-title">
        <span>{t('storeMe.periodPerformance')}</span>
      </div>
      <div className="store-me-rank-items">
        <span>
          <small>{t('storeMe.store')}</small>
          <strong>{storeRankLabel}</strong>
          <em>{storePopulationLabel}</em>
        </span>
        <span>
          <small>{t('storeMe.region')}</small>
          <strong>{regionRankLabel}</strong>
          <em>{regionPopulationLabel}</em>
        </span>
        <span>
          <small>{t('storeMe.turkey')}</small>
          <strong>{turkeyRankLabel}</strong>
          <em>{turkeyPopulationLabel}</em>
        </span>
      </div>
    </div>
  )
}

function MetricKpiCard({
  metric,
  t,
}: {
  metric: MetricCard
  t: TranslateFunction
}) {
  const Icon = metricIconByCode[metric.code] ?? ChartNoAxesColumnIncreasing
  const progressDisplay =
    metric.progressPercent > 100
      ? t('storeMe.progressOverTarget')
      : metric.progressPercent >= 100
        ? t('storeMe.progressFullContribution')
        : metric.progressPercent > 0
          ? t('storeMe.progressUnderAverage')
          : undefined

  return (
    <article
      className={`store-me-plum-card store-me-kpi-card store-me-kpi-${metric.tone}`}
      data-testid="store-me-metric-card"
    >
      <KpiCardHead Icon={Icon} label={metric.label} value={metric.displayValue} />
      <div className="store-me-kpi-body store-me-kpi-copy">
        <p>
          {metric.delta
            ? t('storeMe.previousMonthDeltaValue', { value: metric.delta })
            : t('storeMe.noTrendData')}
        </p>
      </div>
      <KpiProgress
        {...(progressDisplay ? { displayValue: progressDisplay } : {})}
        label={metric.label}
        value={metric.progressPercent}
      />
      <RankStrip
        regionPopulationLabel={metric.regionPopulationLabel}
        regionRankLabel={metric.regionRankLabel}
        storePopulationLabel={metric.storePopulationLabel}
        storeRankLabel={metric.storeRankLabel}
        t={t}
        turkeyPopulationLabel={metric.turkeyPopulationLabel}
        turkeyRankLabel={metric.turkeyRankLabel}
      />
    </article>
  )
}

export function StoreMyPerformancePlumDashboard({
  actualSalesLabel,
  isPartial,
  metricCards,
  monthlyDetailRows,
  onOpenKpiDetails,
  remainingTargetLabel,
  samePeriodScoreDelta,
  scoreConfidence,
  scoreFocus,
  scoreSummary,
  scoreValue,
  regionPopulationLabel,
  regionRankLabel,
  storePopulationLabel,
  storeRankLabel,
  t,
  targetProgressPercent,
  targetSalesLabel,
  targetStatusLabel,
  todayActions,
  turkeyPopulationLabel,
  turkeyRankLabel,
}: StoreMyPerformancePlumDashboardProps) {
  const displayMetrics = ['UPT', 'ATV']
    .map((code) => getMetric(metricCards, code))
    .filter((metric): metric is MetricCard => metric !== null)
  const chart = buildTrendChart(monthlyDetailRows, scoreValue, t('storeMe.currentPeriod'))
  const breakdownRows = metricCards.map((metric) => ({
    ...metric,
    scorePointsLabel: t('storeMe.scorePoints', { value: scorePointLabel(metric.contributionValue) }),
  }))
  const totalContribution = breakdownRows.reduce((total, metric) => total + Math.max(0, metric.contributionValue), 0)

  return (
    <section className="store-me-plum-dashboard" aria-label={t('storeMe.performanceSummary')}>
      <section className="store-me-kpi-grid" aria-label={t('storeMe.kpiDetails')}>
        <article className="store-me-plum-card store-me-kpi-card store-me-kpi-score">
          <KpiCardHead Icon={ChartNoAxesColumnIncreasing} label={t('storeMe.performanceScore')} value={scoreValue} />
          <div className="store-me-kpi-body store-me-kpi-copy">
            <p>{isPartial ? `${t('storeMe.incompleteData')} · ${scoreConfidence}` : scoreConfidence}</p>
          </div>
          <KpiProgress label={t('storeMe.performanceScore')} value={scoreValue} />
          <RankStrip
            regionPopulationLabel={regionPopulationLabel}
            regionRankLabel={regionRankLabel}
            storePopulationLabel={storePopulationLabel}
            storeRankLabel={storeRankLabel}
            t={t}
            turkeyPopulationLabel={turkeyPopulationLabel}
            turkeyRankLabel={turkeyRankLabel}
          />
        </article>

        <article
          className="store-me-plum-card store-me-kpi-card store-me-kpi-target"
          data-testid="store-me-target-progress-card"
          aria-label={`${targetStatusLabel} ${t('storeMe.targetProgress')}`}
        >
          <div className="store-me-target-metric-frame" data-testid="store-me-metric-card">
            <KpiCardHead
              Icon={Target}
              label={t('storeMe.targetProgress')}
              value={`%${formatWholePercent(targetProgressPercent)}`}
            />
            <div className="store-me-kpi-body store-me-kpi-copy">
              <p>
                {t('storeMe.targetProgressPercent', { value: formatWholePercent(targetProgressPercent) })}
              </p>
            </div>
            <KpiProgress
              displayValue={`${formatWholePercent(targetProgressPercent)}%`}
              label={t('storeMe.targetProgress')}
              value={targetProgressPercent}
            />
            <div className="store-me-target-strip">
              <span>
                <small>{t('storeMe.target')}</small>
                <strong>{targetSalesLabel}</strong>
              </span>
              <span>
                <small>{t('storeMe.actual')}</small>
                <strong>{actualSalesLabel}</strong>
              </span>
              <span>
                <small>{t('storeMe.remaining')}</small>
                <strong>{remainingTargetLabel}</strong>
              </span>
            </div>
          </div>
        </article>

        {displayMetrics.map((metric) => (
          <MetricKpiCard
            key={metric.code}
            metric={metric}
            t={t}
          />
        ))}
      </section>

      <section className="store-me-main-grid">
        <article className="store-me-plum-card store-me-trend-card" aria-label={t('storeMe.progressLine')}>
          <div className="store-me-section-head">
            <div>
              <h2>{t('storeMe.progressLine')}</h2>
              <p>{t('storeMe.progressLineCopy')}</p>
            </div>
            <div className="store-me-trend-actions">
              <Badge variant="outline">
                {samePeriodScoreDelta
                  ? t('storeMe.samePeriodSummary', { value: samePeriodScoreDelta })
                  : t('storeMe.noTrendData')}
              </Badge>
              <Button type="button" size="sm" variant="outline" onClick={onOpenKpiDetails}>
                <LineChart data-icon="inline-start" />
                {t('storeMe.kpiDetails')}
              </Button>
            </div>
          </div>

          <div className="store-me-chart-frame">
            <StoreMeTrendChart points={chart.chartPoints} />
          </div>

          <div className="store-me-summary-strip">
            <span>
              <small>{t('storeMe.highestScore')}</small>
              <strong>{chart.bestRow?.scoreLabel ?? t('storeMe.noData')}</strong>
              <em>{chart.bestRow?.label ?? t('storeMe.noData')}</em>
            </span>
            <span>
              <small>{t('storeMe.currentScore')}</small>
              <strong>{chart.currentRow?.scoreLabel ?? String(scoreValue)}</strong>
              <em>{chart.currentRow?.trendLabel ?? t('storeMe.noTrendData')}</em>
            </span>
            <span>
              <small>{t('storeMe.samePeriodDifference')}</small>
              <strong>{samePeriodScoreDelta ?? t('storeMe.noData')}</strong>
              <em>{t('storeMe.previousComparablePeriod')}</em>
            </span>
          </div>
        </article>

        <article id="store-me-actions" className="store-me-plum-card store-me-actions-card" aria-label={t('storeMe.todayCoaching')}>
          <div className="store-me-section-head">
            <div>
              <h2>{t('storeMe.todayCoaching')}</h2>
              <p>{t('storeMe.todayCoachingCopy')}</p>
            </div>
          </div>
          <div className="store-me-action-list">
            {todayActions.length > 0 ? (
              todayActions.map((action) => {
                const Icon = actionIconById[action.icon]

                return (
                  <div className="store-me-action-row" key={action.id}>
                    <span className="store-me-action-icon" aria-hidden="true">
                      <Icon />
                    </span>
                    <span>
                      <strong>{action.title}</strong>
                      <small>{action.copy}</small>
                    </span>
                    <Badge variant={action.variant}>{action.badge}</Badge>
                  </div>
                )
              })
            ) : (
              <div className="store-me-action-empty">
                <strong>{t('storeMe.todayActionsEmptyTitle')}</strong>
                <small>{t('storeMe.todayActionsEmptyCopy')}</small>
              </div>
            )}
          </div>
        </article>
      </section>

      <section className="store-me-bottom-grid">
        <article className="store-me-plum-card store-me-breakdown-card store-me-score-breakdown">
          <div className="store-me-donut" style={donutStyle(breakdownRows)} aria-label={t('storeMe.performanceScore')}>
            <span>
              <strong>{scoreValue}</strong>
              <small>{t('storeMe.performanceScore')}</small>
            </span>
          </div>
          <div className="store-me-breakdown-body">
            <div className="store-me-section-head">
              <div>
                <h2>{t('storeMe.scoreBreakdown')}</h2>
                <p>{t('storeMe.scoreBreakdownCopy')}</p>
              </div>
            </div>
            <div className="store-me-score-meta">
              <span>
                <small>{t('storeMe.model')}</small>
                <strong>{t('storeMe.personnelModel')}</strong>
              </span>
              <span>
                <small>{t('storeMe.weight')}</small>
                <strong>%{breakdownRows.reduce((total, row) => total + clampBarPercent(row.weightPercent), 0)}</strong>
              </span>
              <span>
                <small>{t('storeMe.scored')}</small>
                <strong>{scoreValue}</strong>
              </span>
            </div>
            <div className="store-me-contribution-list">
              {breakdownRows.map((metric) => (
                <div
                  className="store-me-contribution-row"
                  key={metric.code}
                  style={contributionStyle(totalContribution > 0 ? (Math.max(0, metric.contributionValue) / totalContribution) * 100 : 0)}
                >
                  <span className="store-me-contribution-dot" />
                  <strong>{metric.label}</strong>
                  <span>{metric.weightPercent}%</span>
                  <span>{metric.scorePointsLabel}</span>
                  <div className="store-me-contribution-track" aria-hidden="true">
                    <span />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </article>

        <article className="store-me-plum-card store-me-quote-card">
          <div>
            <CircleCheck aria-hidden="true" />
            <p>{scoreSummary}</p>
            <strong>{scoreFocus}</strong>
          </div>
          <svg viewBox="0 0 360 130" aria-hidden="true">
            <path d="M0 130h360V58l-45 18-34 26-44-19-41 33-58-54-52 46-43-20L0 118z" fill="var(--store-me-teal-soft)" />
            <path d="M78 130h282V88l-52 15-30 18-58-45-39 27-33-11-44 28z" fill="var(--store-me-purple-soft)" />
            <path d="M151 130h209v-27l-37 10-38-26-38 29-51-13z" fill="var(--store-me-blue-soft)" />
          </svg>
        </article>
      </section>
    </section>
  )
}
