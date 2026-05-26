import { CalendarDays, ChevronDown } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
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
  StoreMyPerformanceTopbar,
} from './store-my-performance-navigation'

type StorePerformanceSourceMode = 'live' | 'closed'
type LivePeriodType = 'monthly' | 'daily'

type LiveDayPeriod = {
  periodEnd: string
  periodStart: string
  periodType: string
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

type StoreMyPerformancePartialAlertProps = {
  isPartial: boolean
  missingMetricLabels: string[]
  pendingNormalizationLabels: string[]
  t: TranslateFunction
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
