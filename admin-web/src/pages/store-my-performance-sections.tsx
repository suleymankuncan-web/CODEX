import {
  CalendarDays,
  ChartNoAxesColumnIncreasing,
  ChevronDown,
  LineChart,
  ListChecks,
  Target,
} from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Progress } from '@/components/ui/progress'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import type { TranslateFunction } from '../features/localization/dictionary'
import { cn } from '../lib/utils'
export {
  StoreMyPerformanceMobileDock,
  StoreMyPerformanceRail,
  StoreMyPerformanceTopbar,
} from './store-my-performance-navigation'

type StorePerformanceSourceMode = 'live' | 'closed'
type LivePeriodType = 'monthly' | 'daily'

type LiveDayPeriod = {
  periodType: string
  periodStart: string
  periodEnd: string
}

type StoreMyPerformanceDateFilterProps = {
  activeClosedSnapshotRunId: string
  availableClosedSnapshotRuns: Array<{
    label: string
    snapshotRunId: string
  }>
  availableLiveMonthOptions: Array<{
    checked: boolean
    key: string
    label: string
  }>
  availableLiveYearOptions: Array<{
    checked: boolean
    key: string
  }>
  dataQualityLabel: string
  isDateFilterOpen: boolean
  isPartial: boolean
  loadedPeriodCount: number
  onChangeLivePeriodType: (periodType: LivePeriodType) => void
  onSelectClosedSnapshotRun: (snapshotRunId: string) => void
  onSelectSourceMode: (mode: StorePerformanceSourceMode) => void
  onToggleDateFilter: () => void
  onToggleLiveDay: (period: LiveDayPeriod) => void
  onToggleLiveMonth: (monthKey: string) => void
  onToggleLiveYear: (year: string) => void
  scopedAvailableDailyPeriods: Array<{
    checked: boolean
    key: string
    label: string
    period: LiveDayPeriod
  }>
  selectedClosedSnapshotRunId: string
  selectedLivePeriodType: LivePeriodType
  selectedPeriodLabel: string
  sourceMode: StorePerformanceSourceMode
  t: TranslateFunction
  usesClosedSnapshotMode: boolean
}

type SamePeriodMetric = {
  code: string
  delta: string | null
  label: string
  width: string
}

type StoreMyPerformanceScorePanelProps = {
  gradeLabel: string
  isPartial: boolean
  scoreConfidence: string
  scoreDeltaLabel: string
  scoreFocus: string
  scoreValue: number
  storePopulationLabel: string
  storeRankLabel: string
  t: TranslateFunction
  turkeyPopulationLabel: string
  turkeyRankLabel: string
}

type StoreMyPerformanceHeroPanelProps = {
  actualSalesLabel: string
  onOpenKpiDetails: () => void
  remainingTargetLabel: string
  samePeriodMetrics: SamePeriodMetric[]
  samePeriodScoreDelta: string | null
  scoreSummary: string
  t: TranslateFunction
  targetProgressPercent: number
  targetSalesLabel: string
  targetStatusLabel: string
}

type StoreMyPerformancePartialAlertProps = {
  isPartial: boolean
  missingMetricLabels: string[]
  pendingNormalizationLabels: string[]
  t: TranslateFunction
}

type MetricCard = {
  code: string
  displayValue: string
  label: string
  narrative: string
  progressPercent: number
  statusLabel: string
  tone: string
}

type StoreMyPerformanceMetricGridProps = {
  metricCards: MetricCard[]
  storeRankLabel: string
  t: TranslateFunction
  turkeyRankLabel: string
}

type StoreMyPerformanceLowerGridProps = {
  samePeriodScoreDelta: string | null
  t: TranslateFunction
  trendPoints: {
    area: string
    line: string
  }
}

type MonthlyDetailRow = {
  atvLabel: string
  key: string
  label: string
  periodNote: string
  scoreLabel: string
  targetLabel: string
  trendLabel: string | null
  trendWidth: string
  uptLabel: string
}

type StoreMyPerformanceKpiDialogProps = {
  employeeName: string
  isOpen: boolean
  monthlyDetailRows: MonthlyDetailRow[]
  onClose: () => void
  t: TranslateFunction
}

const LATEST_CLOSED_SNAPSHOT_VALUE = '__latest_closed_snapshot__'

function clampProgress(value: number) {
  if (!Number.isFinite(value)) {
    return 0
  }

  return Math.min(100, Math.max(0, Math.round(value)))
}

function progressFromWidth(width: string) {
  return clampProgress(Number.parseFloat(width.replace('%', '')))
}

function scoreBadgeVariant(isPartial: boolean): 'destructive' | 'secondary' {
  return isPartial ? 'destructive' : 'secondary'
}

function PeriodCheck({
  checked,
  children,
  disabled,
  onChange,
}: {
  checked: boolean
  children: string
  disabled: boolean
  onChange: () => void
}) {
  return (
    <label
      className={cn(
        'tw:inline-flex tw:min-h-8 tw:min-w-0 tw:items-center tw:gap-2 tw:rounded-lg tw:border tw:border-border tw:bg-background tw:px-2.5 tw:text-sm tw:font-medium tw:text-muted-foreground',
        checked && 'tw:bg-muted tw:text-foreground',
        disabled && 'tw:cursor-not-allowed tw:opacity-50',
      )}
    >
      <input
        className="tw:accent-primary"
        type="checkbox"
        checked={checked}
        onChange={onChange}
        disabled={disabled}
      />
      <span className="tw:truncate">{children}</span>
    </label>
  )
}

function RankCell({
  label,
  note,
  value,
}: {
  label: string
  note: string
  value: string
}) {
  return (
    <div className="tw:grid tw:min-w-0 tw:gap-1 tw:rounded-lg tw:border tw:border-border tw:bg-background tw:p-3">
      <span className="tw:text-xs tw:font-medium tw:text-muted-foreground">{label}</span>
      <strong className="tw:truncate tw:text-base tw:font-medium">{value}</strong>
      <small className="tw:truncate tw:text-xs tw:text-muted-foreground">{note}</small>
    </div>
  )
}

function MetricProgress({
  label,
  value,
}: {
  label: string
  value: number
}) {
  return (
    <div className="tw:grid tw:gap-1.5">
      <div className="tw:flex tw:items-center tw:justify-between tw:gap-2 tw:text-xs tw:text-muted-foreground">
        <span>{label}</span>
        <span>{clampProgress(value)}%</span>
      </div>
      <Progress value={clampProgress(value)} className="tw:h-2" />
    </div>
  )
}

export function StoreMyPerformanceDateFilter({
  activeClosedSnapshotRunId,
  availableClosedSnapshotRuns,
  availableLiveMonthOptions,
  availableLiveYearOptions,
  dataQualityLabel,
  isDateFilterOpen,
  isPartial,
  loadedPeriodCount,
  onChangeLivePeriodType,
  onSelectClosedSnapshotRun,
  onSelectSourceMode,
  onToggleDateFilter,
  onToggleLiveDay,
  onToggleLiveMonth,
  onToggleLiveYear,
  scopedAvailableDailyPeriods,
  selectedClosedSnapshotRunId,
  selectedLivePeriodType,
  selectedPeriodLabel,
  sourceMode,
  t,
  usesClosedSnapshotMode,
}: StoreMyPerformanceDateFilterProps) {
  const selectedClosedValue =
    selectedClosedSnapshotRunId || activeClosedSnapshotRunId || LATEST_CLOSED_SNAPSHOT_VALUE

  return (
    <section className="tw:relative tw:grid tw:gap-3" aria-label={t('storeMe.dateFilter')}>
      <Button
        className="tw:h-auto tw:w-full tw:justify-between tw:gap-3 tw:rounded-xl tw:p-3"
        type="button"
        variant="outline"
        aria-expanded={isDateFilterOpen}
        onClick={onToggleDateFilter}
      >
        <CalendarDays data-icon="inline-start" />
        <span className="tw:grid tw:min-w-0 tw:flex-1 tw:gap-0.5 tw:text-left">
          <span className="tw:text-xs tw:text-muted-foreground">{t('storeMe.dateFilter')}</span>
          <strong className="tw:truncate tw:text-sm tw:font-medium">{selectedPeriodLabel}</strong>
        </span>
        <span className="tw:hidden tw:items-center tw:gap-2 tw:md:flex">
          <Badge variant="outline">{t('storeMe.loadedPeriodCount', { count: loadedPeriodCount })}</Badge>
          <Badge variant={isPartial ? 'destructive' : 'secondary'}>{dataQualityLabel}</Badge>
        </span>
        <ChevronDown data-icon="inline-end" />
      </Button>

      {isDateFilterOpen ? (
        <div className="tw:grid tw:gap-3 tw:rounded-xl tw:border tw:border-border tw:bg-card tw:p-3 tw:text-card-foreground tw:shadow-sm">
          <div className="tw:flex tw:flex-wrap tw:gap-2 tw:md:hidden" aria-hidden="true">
            <Badge variant="outline">{t('storeMe.loadedPeriodCount', { count: loadedPeriodCount })}</Badge>
            <Badge variant={isPartial ? 'destructive' : 'secondary'}>{dataQualityLabel}</Badge>
          </div>

          <div className="tw:grid tw:gap-3 tw:lg:grid-cols-2">
            {usesClosedSnapshotMode ? (
              <div className="tw:grid tw:gap-2">
                <span className="tw:text-xs tw:font-medium tw:text-muted-foreground">{t('storeMe.view')}</span>
                <ToggleGroup
                  type="single"
                  value={sourceMode}
                  onValueChange={(value) => {
                    if (value === 'live' || value === 'closed') {
                      onSelectSourceMode(value)
                    }
                  }}
                  variant="outline"
                  size="sm"
                  className="tw:flex-wrap"
                >
                  <ToggleGroupItem value="live">{t('storeMe.liveStatus')}</ToggleGroupItem>
                  <ToggleGroupItem value="closed">{t('storeMe.closedDay')}</ToggleGroupItem>
                </ToggleGroup>
              </div>
            ) : null}

            <div className="tw:grid tw:gap-2">
              <span className="tw:text-xs tw:font-medium tw:text-muted-foreground">{t('storeMe.liveGranularity')}</span>
              <ToggleGroup
                type="single"
                value={selectedLivePeriodType}
                onValueChange={(value) => {
                  if (value === 'monthly' || value === 'daily') {
                    onChangeLivePeriodType(value)
                  }
                }}
                variant="outline"
                size="sm"
                className="tw:flex-wrap"
              >
                <ToggleGroupItem value="monthly" disabled={sourceMode !== 'live'}>
                  {t('storeMe.liveMonth')}
                </ToggleGroupItem>
                <ToggleGroupItem value="daily" disabled={sourceMode !== 'live'}>
                  {t('storeMe.liveDay')}
                </ToggleGroupItem>
              </ToggleGroup>
            </div>
          </div>

          <Separator />

          <div className="tw:grid tw:gap-3 tw:lg:grid-cols-3">
            <div className="tw:grid tw:gap-2">
              <span className="tw:text-xs tw:font-medium tw:text-muted-foreground">{t('storeMe.loadedYears')}</span>
              <div className="tw:flex tw:max-h-36 tw:flex-wrap tw:gap-2 tw:overflow-auto">
                {availableLiveYearOptions.length ? (
                  availableLiveYearOptions.map((year) => (
                    <PeriodCheck
                      key={year.key}
                      checked={year.checked}
                      disabled={sourceMode !== 'live'}
                      onChange={() => onToggleLiveYear(year.key)}
                    >
                      {year.key}
                    </PeriodCheck>
                  ))
                ) : (
                  <span className="tw:text-sm tw:text-muted-foreground">{t('storeMe.noLoadedPeriods')}</span>
                )}
              </div>
            </div>

            <div className="tw:grid tw:gap-2">
              <span className="tw:text-xs tw:font-medium tw:text-muted-foreground">{t('storeMe.loadedMonthBuckets')}</span>
              <div className="tw:flex tw:max-h-36 tw:flex-wrap tw:gap-2 tw:overflow-auto">
                {availableLiveMonthOptions.length ? (
                  availableLiveMonthOptions.map((month) => (
                    <PeriodCheck
                      key={month.key}
                      checked={month.checked}
                      disabled={sourceMode !== 'live'}
                      onChange={() => onToggleLiveMonth(month.key)}
                    >
                      {month.label}
                    </PeriodCheck>
                  ))
                ) : (
                  <span className="tw:text-sm tw:text-muted-foreground">{t('storeMe.noLoadedPeriods')}</span>
                )}
              </div>
            </div>

            {selectedLivePeriodType === 'daily' ? (
              <div className="tw:grid tw:gap-2">
                <span className="tw:text-xs tw:font-medium tw:text-muted-foreground">{t('storeMe.loadedDays')}</span>
                <div className="tw:flex tw:max-h-36 tw:flex-wrap tw:gap-2 tw:overflow-auto">
                  {scopedAvailableDailyPeriods.length ? (
                    scopedAvailableDailyPeriods.map((period) => (
                      <PeriodCheck
                        key={`${period.period.periodType}-${period.key}`}
                        checked={period.checked}
                        disabled={sourceMode !== 'live'}
                        onChange={() => onToggleLiveDay(period.period)}
                      >
                        {period.label}
                      </PeriodCheck>
                    ))
                  ) : (
                    <span className="tw:text-sm tw:text-muted-foreground">{t('storeMe.noLoadedPeriods')}</span>
                  )}
                </div>
              </div>
            ) : null}
          </div>

          {usesClosedSnapshotMode ? (
            <div className="tw:grid tw:gap-2">
              <span className="tw:text-xs tw:font-medium tw:text-muted-foreground">{t('storeMe.closedSnapshotSelect')}</span>
              <Select
                value={selectedClosedValue}
                onValueChange={(value) =>
                  onSelectClosedSnapshotRun(value === LATEST_CLOSED_SNAPSHOT_VALUE ? '' : value)
                }
                disabled={sourceMode !== 'closed' || availableClosedSnapshotRuns.length === 0}
              >
                <SelectTrigger className="tw:w-full">
                  <SelectValue placeholder={t('storeMe.latestClosedSnapshot')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value={LATEST_CLOSED_SNAPSHOT_VALUE}>
                      {t('storeMe.latestClosedSnapshot')}
                    </SelectItem>
                    {availableClosedSnapshotRuns.map((run) => (
                      <SelectItem key={run.snapshotRunId} value={run.snapshotRunId}>
                        {run.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}

export function StoreMyPerformanceScorePanel({
  gradeLabel,
  isPartial,
  scoreConfidence,
  scoreDeltaLabel,
  scoreFocus,
  scoreValue,
  storePopulationLabel,
  storeRankLabel,
  t,
  turkeyPopulationLabel,
  turkeyRankLabel,
}: StoreMyPerformanceScorePanelProps) {
  return (
    <Card aria-label={t('storeMe.performanceScore')} className="tw:min-h-full">
      <CardHeader>
        <CardTitle>{t('storeMe.personalScoreCard')}</CardTitle>
        <CardDescription>{t('storeMe.overallPerformance')}</CardDescription>
        <CardAction>
          <Badge variant={scoreBadgeVariant(isPartial)}>
            {isPartial ? t('storeMe.incompleteData') : gradeLabel}
          </Badge>
        </CardAction>
      </CardHeader>
      <CardContent className="tw:grid tw:gap-5">
        <div className="tw:grid tw:gap-3">
          <div className="tw:flex tw:items-end tw:gap-2">
            <strong className="tw:text-6xl tw:font-medium tw:leading-none tw:text-foreground">
              {scoreValue}
            </strong>
            <span className="tw:pb-2 tw:text-sm tw:text-muted-foreground">/100</span>
          </div>
          <MetricProgress label={scoreDeltaLabel} value={scoreValue} />
        </div>

        <div className="tw:grid tw:gap-2">
          <RankCell label={t('storeMe.store')} value={storeRankLabel} note={storePopulationLabel} />
          <RankCell label={t('storeMe.region')} value={t('storeMe.noData')} note={t('storeMe.regionRankPending')} />
          <RankCell label={t('storeMe.turkey')} value={turkeyRankLabel} note={turkeyPopulationLabel} />
        </div>

        <div className="tw:grid tw:gap-2 tw:rounded-lg tw:border tw:border-border tw:bg-muted/50 tw:p-3">
          <span className="tw:text-xs tw:font-medium tw:text-muted-foreground">{t('storeMe.coachingMode')}</span>
          <strong className="tw:text-sm tw:font-medium">{scoreFocus}</strong>
          <p className="tw:text-sm tw:leading-6 tw:text-muted-foreground">{scoreConfidence}</p>
        </div>
      </CardContent>
    </Card>
  )
}

export function StoreMyPerformanceHeroPanel({
  actualSalesLabel,
  onOpenKpiDetails,
  remainingTargetLabel,
  samePeriodMetrics,
  samePeriodScoreDelta,
  scoreSummary,
  t,
  targetProgressPercent,
  targetSalesLabel,
  targetStatusLabel,
}: StoreMyPerformanceHeroPanelProps) {
  return (
    <Card aria-label={t('storeMe.performanceSummary')} data-testid="store-me-target-progress-card">
      <CardHeader>
        <CardTitle>{t('storeMe.v2HeroTitle')}</CardTitle>
        <CardDescription>{scoreSummary}</CardDescription>
        <CardAction>
          <Badge variant="outline">{targetStatusLabel}</Badge>
        </CardAction>
      </CardHeader>
      <CardContent className="tw:grid tw:gap-5">
        <div className="tw:grid tw:gap-3">
          <span className="tw:text-sm tw:font-medium">{t('storeMe.targetProgress')}</span>
          <MetricProgress
            label={t('storeMe.targetProgressPercent', { value: targetProgressPercent })}
            value={targetProgressPercent}
          />
          <div className="tw:grid tw:gap-2 tw:md:grid-cols-3">
            <RankCell label={t('storeMe.target')} value={targetSalesLabel} note={t('storeMe.approvedTarget')} />
            <RankCell label={t('storeMe.actual')} value={actualSalesLabel} note={t('storeMe.currentPeriod')} />
            <RankCell label={t('storeMe.remaining')} value={remainingTargetLabel} note={t('storeMe.follow')} />
          </div>
        </div>

        <Separator />

        <div className="tw:grid tw:gap-3 tw:lg:grid-cols-[minmax(0,1fr)_minmax(17rem,0.55fr)]">
          <div className="tw:grid tw:gap-3">
            <span className="tw:text-sm tw:font-medium">{t('storeMe.samePeriodComparison')}</span>
            <div className="tw:grid tw:gap-2">
              {samePeriodMetrics.map((metric) => (
                <MetricProgress
                  key={metric.code}
                  label={`${metric.label}: ${metric.delta ?? t('storeMe.noData')}`}
                  value={progressFromWidth(metric.width)}
                />
              ))}
            </div>
          </div>
          <div className="tw:grid tw:content-between tw:gap-3 tw:rounded-lg tw:border tw:border-border tw:bg-muted/50 tw:p-3">
            <span className="tw:text-xs tw:font-medium tw:text-muted-foreground">
              {t('storeMe.samePeriodComparison')}
            </span>
            <strong className="tw:text-lg tw:font-medium">
              {samePeriodScoreDelta
                ? t('storeMe.samePeriodSummary', { value: samePeriodScoreDelta })
                : t('storeMe.noTrendData')}
            </strong>
          </div>
        </div>
      </CardContent>
      <div className="tw:flex tw:flex-wrap tw:gap-2 tw:px-4 tw:pb-4">
        <Button asChild>
          <a href="#store-me-actions">
            <ListChecks data-icon="inline-start" />
            {t('storeMe.todayFocus')}
          </a>
        </Button>
        <Button type="button" variant="outline" onClick={onOpenKpiDetails}>
          <LineChart data-icon="inline-start" />
          {t('storeMe.kpiDetails')}
        </Button>
      </div>
    </Card>
  )
}

export function StoreMyPerformancePartialAlert({
  isPartial,
  missingMetricLabels,
  pendingNormalizationLabels,
  t,
}: StoreMyPerformancePartialAlertProps) {
  if (!isPartial) {
    return null
  }

  return (
    <Alert variant="destructive" aria-label={t('storeMe.partialTitle')}>
      <AlertTitle>{t('storeMe.partialTitle')}</AlertTitle>
      <AlertDescription>
        <p>
          {t('storeMe.missingMetrics', {
            labels: missingMetricLabels.join(', ') || t('storeMe.noMetricDetail'),
          })}
        </p>
        {pendingNormalizationLabels.length ? (
          <p>
            {t('storeMe.pendingNormalization', {
              labels: pendingNormalizationLabels.join(', '),
            })}
          </p>
        ) : null}
      </AlertDescription>
    </Alert>
  )
}

export function StoreMyPerformanceMetricGrid({
  metricCards,
  storeRankLabel,
  t,
  turkeyRankLabel,
}: StoreMyPerformanceMetricGridProps) {
  return (
    <section id="metrics" className="tw:grid tw:gap-3 tw:lg:grid-cols-3" aria-label={t('storeMe.kpiDetails')}>
      {metricCards.map((card) => (
        <Card key={card.code} size="sm" data-testid="store-me-metric-card">
          <CardHeader>
            <CardTitle>{card.label}</CardTitle>
            <CardDescription>{card.narrative}</CardDescription>
            <CardAction>
              <Badge variant="secondary">{card.statusLabel}</Badge>
            </CardAction>
          </CardHeader>
          <CardContent className="tw:grid tw:gap-4">
            <div className="tw:grid tw:gap-2">
              <strong className="tw:text-3xl tw:font-medium tw:text-foreground">{card.displayValue}</strong>
              <MetricProgress label={t('storeMe.performanceScore')} value={card.progressPercent} />
            </div>
            <div className="tw:grid tw:gap-2">
              <RankCell label={t('storeMe.store')} value={storeRankLabel} note={t('storeMe.storeRank')} />
              <RankCell label={t('storeMe.region')} value={t('storeMe.noData')} note={t('storeMe.regionRankPending')} />
              <RankCell label={t('storeMe.turkey')} value={turkeyRankLabel} note={t('storeMe.turkeyRank')} />
            </div>
            <p className="tw:text-sm tw:leading-6 tw:text-muted-foreground">
              {t('storeMe.metricCardCopy', { metric: card.label })}
            </p>
          </CardContent>
        </Card>
      ))}
    </section>
  )
}

export function StoreMyPerformanceLowerGrid({
  samePeriodScoreDelta,
  t,
  trendPoints,
}: StoreMyPerformanceLowerGridProps) {
  return (
    <section className="tw:grid tw:gap-3 tw:xl:grid-cols-[minmax(0,1.15fr)_minmax(20rem,0.85fr)]">
      <Card aria-label={t('storeMe.progressLine')}>
        <CardHeader>
          <CardTitle>{t('storeMe.progressLine')}</CardTitle>
          <CardDescription>{t('storeMe.progressLineCopy')}</CardDescription>
          <CardAction>
            <Badge variant="outline">{samePeriodScoreDelta ?? t('storeMe.noTrendData')}</Badge>
          </CardAction>
        </CardHeader>
        <CardContent>
          <div className="tw:relative tw:min-h-64 tw:overflow-hidden tw:rounded-lg tw:border tw:border-border tw:bg-muted/50 tw:p-3">
            <svg className="tw:h-56 tw:w-full" viewBox="0 0 640 210" preserveAspectRatio="none" aria-hidden="true">
              <defs>
                <linearGradient id="storeMeShadcnArea" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.22" />
                  <stop offset="100%" stopColor="var(--primary)" stopOpacity="0" />
                </linearGradient>
              </defs>
              <polygon fill="url(#storeMeShadcnArea)" points={trendPoints.area} />
              <polyline
                fill="none"
                points={trendPoints.line}
                stroke="var(--primary)"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="5"
              />
            </svg>
            <div className="tw:flex tw:flex-wrap tw:gap-2 tw:text-xs tw:text-muted-foreground">
              <Badge variant="secondary">{t('storeMe.thisPeriod')}</Badge>
              <Badge variant="outline">{t('storeMe.previousComparablePeriod')}</Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card id="store-me-actions" aria-label={t('storeMe.todayCoaching')}>
        <CardHeader>
          <CardTitle>{t('storeMe.todayCoaching')}</CardTitle>
          <CardDescription>{t('storeMe.todayCoachingCopy')}</CardDescription>
        </CardHeader>
        <CardContent className="tw:grid tw:gap-2">
          <div className="tw:grid tw:grid-cols-[auto_minmax(0,1fr)_auto] tw:items-center tw:gap-3 tw:rounded-lg tw:border tw:border-border tw:bg-background tw:p-3">
            <ListChecks aria-hidden="true" />
            <div className="tw:grid tw:gap-1">
              <strong className="tw:text-sm tw:font-medium">{t('storeMe.action.keepRhythm.title')}</strong>
              <span className="tw:text-sm tw:text-muted-foreground">{t('storeMe.action.keepRhythm.copy')}</span>
            </div>
            <Badge variant="secondary">{t('storeMe.priorityOne')}</Badge>
          </div>
          <div className="tw:grid tw:grid-cols-[auto_minmax(0,1fr)_auto] tw:items-center tw:gap-3 tw:rounded-lg tw:border tw:border-border tw:bg-background tw:p-3">
            <ChartNoAxesColumnIncreasing aria-hidden="true" />
            <div className="tw:grid tw:gap-1">
              <strong className="tw:text-sm tw:font-medium">{t('storeMe.action.growBasket.title')}</strong>
              <span className="tw:text-sm tw:text-muted-foreground">{t('storeMe.action.growBasket.copy')}</span>
            </div>
            <Badge variant="outline">{t('storeMe.opportunity')}</Badge>
          </div>
          <div className="tw:grid tw:grid-cols-[auto_minmax(0,1fr)_auto] tw:items-center tw:gap-3 tw:rounded-lg tw:border tw:border-border tw:bg-background tw:p-3">
            <Target aria-hidden="true" />
            <div className="tw:grid tw:gap-1">
              <strong className="tw:text-sm tw:font-medium">{t('storeMe.action.trackTarget.title')}</strong>
              <span className="tw:text-sm tw:text-muted-foreground">{t('storeMe.action.trackTarget.copy')}</span>
            </div>
            <Badge variant="outline">{t('storeMe.follow')}</Badge>
          </div>
        </CardContent>
      </Card>
    </section>
  )
}

export function StoreMyPerformanceKpiDialog({
  employeeName,
  isOpen,
  monthlyDetailRows,
  onClose,
  t,
}: StoreMyPerformanceKpiDialogProps) {
  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          onClose()
        }
      }}
    >
      <DialogContent
        closeLabel={t('storeMe.closeKpiDetails')}
        className="tw:max-h-[min(44rem,calc(100vh-2rem))] tw:max-w-5xl tw:overflow-auto"
        data-testid="store-me-kpi-dialog"
      >
        <DialogHeader>
          <DialogTitle>
            {t('storeMe.monthlyPerformanceTitle', {
              name: employeeName,
            })}
          </DialogTitle>
          <DialogDescription>{t('storeMe.monthlyPerformanceCopy')}</DialogDescription>
        </DialogHeader>
        <Table aria-label={t('storeMe.monthlyPerformanceTable')}>
          <TableHeader>
            <TableRow>
              <TableHead>{t('storeMe.month')}</TableHead>
              <TableHead>{t('storeMe.score')}</TableHead>
              <TableHead>{t('storeMe.metric.uptShort')}</TableHead>
              <TableHead>{t('storeMe.metric.atvShort')}</TableHead>
              <TableHead>{t('storeMe.metric.hgShort')}</TableHead>
              <TableHead>{t('storeMe.monthlyTrend')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {monthlyDetailRows.map((row) => (
              <TableRow key={row.key}>
                <TableCell>
                  <div className="tw:grid tw:gap-1">
                    <strong className="tw:font-medium">{row.label}</strong>
                    <span className="tw:text-xs tw:text-muted-foreground">{row.periodNote}</span>
                  </div>
                </TableCell>
                <TableCell>{row.scoreLabel}</TableCell>
                <TableCell>{row.uptLabel}</TableCell>
                <TableCell>{row.atvLabel}</TableCell>
                <TableCell>{row.targetLabel}</TableCell>
                <TableCell>
                  <div className="tw:grid tw:min-w-40 tw:gap-1">
                    <Progress value={progressFromWidth(row.trendWidth)} className="tw:h-2" />
                    <span className="tw:text-xs tw:text-muted-foreground">
                      {row.trendLabel ?? t('storeMe.noTrendData')}
                    </span>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </DialogContent>
    </Dialog>
  )
}
