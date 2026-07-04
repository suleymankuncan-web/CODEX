import type { CSSProperties } from 'react'
import {
  ChartNoAxesColumnIncreasing,
  CircleCheck,
  Database,
  LineChart,
  ListChecks,
  Package,
  ShoppingBag,
  Target,
} from 'lucide-react'
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

type ChartPoint = {
  key: string
  label: string
  scoreLabel: string
  x: number
  y: number
}

const chartWidth = 720
const chartHeight = 292
const chartTop = 64
const chartBottom = 198
const chartLeft = 92
const chartRight = 628

const actionIconById: Record<TodayAction['icon'], typeof ListChecks> = {
  data: Database,
  metric: ChartNoAxesColumnIncreasing,
  rhythm: LineChart,
  target: Target,
}

const metricIconByCode: Record<string, typeof Target> = {
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
  if (trimmed.length <= 11) {
    return trimmed
  }

  return trimmed.replace(/\s+20\d{2}$/u, '').slice(0, 11)
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
  const scores = chartRows.map((row) => row.scoreValue ?? 0)
  const minScore = Math.min(...scores, 0)
  const maxScore = Math.max(...scores, 100)
  const scoreRange = Math.max(1, maxScore - minScore)
  const points: ChartPoint[] = chartRows.map((row, index) => {
    const x =
      chartRows.length === 1
        ? chartWidth / 2
        : chartLeft + ((chartRight - chartLeft) * index) / (chartRows.length - 1)
    const normalized = ((row.scoreValue ?? 0) - minScore) / scoreRange

    return {
      key: row.key,
      label: compactChartLabel(row.label),
      scoreLabel: row.scoreLabel,
      x: Math.round(x),
      y: Math.round(chartBottom - normalized * (chartBottom - chartTop)),
    }
  })
  const linePath = points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ')
  const areaPath = `${linePath} L ${points[points.length - 1]?.x ?? chartRight} ${chartBottom + 16} L ${points[0]?.x ?? chartLeft} ${chartBottom + 16} Z`
  const firstChartRow = chartRows[0]!
  const bestRow = chartRows.reduce((best, row) => ((row.scoreValue ?? 0) > (best.scoreValue ?? 0) ? row : best), firstChartRow)
  const currentRow = chartRows[chartRows.length - 1]!

  return {
    areaPath,
    bestRow,
    currentRow,
    linePath,
    points,
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

  return (
    <article
      className={`store-me-plum-card store-me-kpi-card store-me-kpi-${metric.tone}`}
      data-testid="store-me-metric-card"
    >
      <div className="store-me-card-topline">
        <span className="store-me-icon-bubble" aria-hidden="true">
          <Icon />
        </span>
        <Badge variant="secondary">{metric.statusLabel}</Badge>
      </div>
      <div className="store-me-kpi-body">
        <h2>{metric.label}</h2>
        <strong>{metric.displayValue}</strong>
        <p>{metric.delta ?? t('storeMe.noTrendData')}</p>
      </div>
      <KpiProgress label={metric.label} value={metric.progressPercent} />
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
  gradeLabel,
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
  const targetMetric = getMetric(metricCards, 'TARGET_ACHIEVEMENT')
  const targetMetricLabel = targetMetric?.label ?? t('storeMe.metric.hgShort')
  const displayMetrics = ['UPT', 'ATV']
    .map((code) => getMetric(metricCards, code))
    .filter((metric): metric is MetricCard => metric !== null)
  const chart = buildTrendChart(monthlyDetailRows, scoreValue, t('storeMe.currentPeriod'))
  const breakdownRows = metricCards.map((metric) => ({
    ...metric,
    scorePointsLabel: t('storeMe.scorePoints', { value: scorePointLabel(metric.contributionValue) }),
  }))
  const totalContribution = breakdownRows.reduce((total, metric) => total + Math.max(0, metric.contributionValue), 0)
  const scoreBadgeLabel = isPartial ? t('storeMe.incompleteData') : gradeLabel

  return (
    <section className="store-me-plum-dashboard" aria-label={t('storeMe.performanceSummary')}>
      <section className="store-me-kpi-grid" aria-label={t('storeMe.kpiDetails')}>
        <article className="store-me-plum-card store-me-kpi-card store-me-kpi-score">
          <div className="store-me-card-topline">
            <span className="store-me-icon-bubble" aria-hidden="true">
              <ChartNoAxesColumnIncreasing />
            </span>
            <Badge variant={isPartial ? 'destructive' : 'secondary'}>{scoreBadgeLabel}</Badge>
          </div>
          <div className="store-me-kpi-body">
            <h2>{t('storeMe.performanceScore')}</h2>
            <strong>{scoreValue}</strong>
            <p>{scoreConfidence}</p>
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
        >
          <div className="store-me-card-topline">
            <span className="store-me-icon-bubble" aria-hidden="true">
              <Target />
            </span>
            <Badge variant="secondary">{targetStatusLabel}</Badge>
          </div>
          <div className="store-me-target-metric-frame" data-testid="store-me-metric-card">
            <div className="store-me-kpi-body">
              <h2>{t('storeMe.targetProgress')}</h2>
              <strong>%{formatWholePercent(targetProgressPercent)}</strong>
              <p>
                {targetMetricLabel} · {targetMetric?.statusLabel ?? targetStatusLabel} ·{' '}
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
            <svg
              className="store-me-line-chart"
              viewBox={`0 0 ${chartWidth} ${chartHeight}`}
              role="img"
              aria-label={t('storeMe.progressLine')}
            >
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
              {[0, 1, 2, 3].map((line) => {
                const y = chartTop + ((chartBottom - chartTop) * line) / 3

                return <line key={line} x1={chartLeft - 20} x2={chartRight + 20} y1={y} y2={y} />
              })}
              <path d={chart.areaPath} fill="url(#storeMePlumArea)" />
              <path d={chart.linePath} fill="none" stroke="rgba(124, 58, 237, 0.16)" strokeLinecap="round" strokeWidth="14" />
              <path d={chart.linePath} fill="none" stroke="url(#storeMePlumLine)" strokeLinecap="round" strokeWidth="8" />
              {chart.points.map((point) => (
                <g key={point.key}>
                  <circle cx={point.x} cy={point.y} r="9" />
                  <text className="checkpoint-value" x={point.x} y={point.y - 16}>
                    {point.scoreLabel}
                  </text>
                  <text className="checkpoint-label" x={point.x} y="262">
                    {point.label}
                  </text>
                </g>
              ))}
            </svg>
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
            {todayActions.map((action) => {
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
            })}
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
