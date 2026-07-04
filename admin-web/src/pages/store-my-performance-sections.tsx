import { CalendarDays, ChevronDown } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
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
import type { AppLocale } from '../lib/i18n'
import { MonthYearPeriodPicker } from './store-month-year-period-picker'
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
  dataQualityLabel: string
  isDateFilterOpen: boolean
  isPartial: boolean
  locale: AppLocale
  loadedPeriodCount: number
  onChangeLivePeriodType: (periodType: LivePeriodType) => void
  onSelectClosedSnapshotRun: (snapshotRunId: string) => void
  onSelectLiveDay: (period: LiveDayPeriod) => void
  onSelectLiveMonth: (monthKey: string) => void
  onSelectSourceMode: (mode: StorePerformanceSourceMode) => void
  onToggleDateFilter: () => void
  scopedAvailableDailyPeriods: Array<{
    checked: boolean
    key: string
    label: string
    period: LiveDayPeriod
  }>
  selectedClosedSnapshotRunId: string
  selectedLivePeriodStart: string
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

function getDateKey(input: string | null | undefined) {
  const match = input?.trim().match(/^(\d{4})-(\d{2})-(\d{2})/)
  return match ? `${match[1]}-${match[2]}-${match[3]}` : ''
}

function getMonthKey(input: string | null | undefined) {
  return getDateKey(input).slice(0, 7)
}

function dateFromKey(input: string | null | undefined) {
  const dateKey = getDateKey(input)
  if (!dateKey) return undefined
  const [yearInput, monthInput, dayInput] = dateKey.split('-')
  const year = Number(yearInput)
  const month = Number(monthInput)
  const day = Number(dayInput)

  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return undefined
  }

  return new Date(year, month - 1, day)
}

function dateKeyFromDate(input: Date) {
  return [
    input.getFullYear(),
    String(input.getMonth() + 1).padStart(2, '0'),
    String(input.getDate()).padStart(2, '0'),
  ].join('-')
}

export function StoreMyPerformanceDateFilter({
  activeClosedSnapshotRunId,
  availableClosedSnapshotRuns,
  availableLiveMonthOptions,
  dataQualityLabel,
  isDateFilterOpen,
  isPartial,
  locale,
  loadedPeriodCount,
  onChangeLivePeriodType,
  onSelectClosedSnapshotRun,
  onSelectLiveDay,
  onSelectLiveMonth,
  onSelectSourceMode,
  onToggleDateFilter,
  scopedAvailableDailyPeriods,
  selectedClosedSnapshotRunId,
  selectedLivePeriodStart,
  selectedLivePeriodType,
  selectedPeriodLabel,
  sourceMode,
  t,
  usesClosedSnapshotMode,
}: StoreMyPerformanceDateFilterProps) {
  const selectedClosedValue =
    selectedClosedSnapshotRunId || activeClosedSnapshotRunId || LATEST_CLOSED_SNAPSHOT_VALUE
  const selectedDateKey = getDateKey(selectedLivePeriodStart)
  const selectedMonthKey =
    getMonthKey(selectedLivePeriodStart) || availableLiveMonthOptions[0]?.key || ''
  const availableMonthValues = availableLiveMonthOptions.map((month) => month.key)
  const availableDayEntries = scopedAvailableDailyPeriods.map((period) => ({
    dateKey: getDateKey(period.period.periodStart),
    period,
  }))
  const availableDayKeys = new Set(availableDayEntries.map((entry) => entry.dateKey).filter(Boolean))
  const selectedDayEntry =
    availableDayEntries.find((entry) => entry.dateKey === selectedDateKey) ?? availableDayEntries[0]
  const selectedDailyDate = dateFromKey(selectedDayEntry?.dateKey)

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

          {sourceMode === 'live' ? (
            selectedLivePeriodType === 'daily' ? (
              <div className="tw:grid tw:gap-2">
                <span className="tw:text-xs tw:font-medium tw:text-muted-foreground">{t('storeMe.liveDay')}</span>
                {availableDayEntries.length ? (
                  <Calendar
                    mode="single"
                    {...(selectedDailyDate
                      ? {
                          defaultMonth: selectedDailyDate,
                          selected: selectedDailyDate,
                        }
                      : {})}
                    captionLayout="dropdown"
                    className="tw:rounded-xl tw:border"
                    disabled={(date) => !availableDayKeys.has(dateKeyFromDate(date))}
                    onSelect={(date) => {
                      if (!date) return
                      const dateKey = dateKeyFromDate(date)
                      const match = availableDayEntries.find((entry) => entry.dateKey === dateKey)
                      if (match) {
                        onSelectLiveDay(match.period.period)
                        onToggleDateFilter()
                      }
                    }}
                  />
                ) : (
                  <span className="tw:text-sm tw:text-muted-foreground">{t('storeMe.noLoadedPeriods')}</span>
                )}
              </div>
            ) : (
              <div className="tw:grid tw:gap-2">
                <span className="tw:text-xs tw:font-medium tw:text-muted-foreground">{t('storeMe.liveMonth')}</span>
                {availableMonthValues.length ? (
                  <MonthYearPeriodPicker
                    ariaLabel={t('storeMe.loadedMonthSelect')}
                    availableValues={availableMonthValues}
                    locale={locale}
                    onValueChange={(value) => {
                      onSelectLiveMonth(value)
                      onToggleDateFilter()
                    }}
                    title={t('storeMe.liveMonth')}
                    triggerClassName="tw:w-full tw:justify-between"
                    value={selectedMonthKey}
                  />
                ) : (
                  <span className="tw:text-sm tw:text-muted-foreground">{t('storeMe.noLoadedPeriods')}</span>
                )}
              </div>
            )
          ) : null}

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
        className="tw:max-h-[min(46rem,calc(100vh-2rem))] tw:w-[min(72rem,calc(100vw-2rem))] tw:max-w-none tw:overflow-auto"
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
        <div className="tw:overflow-x-auto">
          <Table aria-label={t('storeMe.monthlyPerformanceTable')} className="tw:min-w-[52rem]">
            <TableHeader>
              <TableRow>
                <TableHead className="tw:min-w-44 tw:whitespace-nowrap">{t('storeMe.month')}</TableHead>
                <TableHead className="tw:whitespace-nowrap">{t('storeMe.score')}</TableHead>
                <TableHead className="tw:whitespace-nowrap">{t('storeMe.metric.uptShort')}</TableHead>
                <TableHead className="tw:whitespace-nowrap">{t('storeMe.metric.atvShort')}</TableHead>
                <TableHead className="tw:whitespace-nowrap">{t('storeMe.metric.hgShort')}</TableHead>
                <TableHead className="tw:min-w-48 tw:whitespace-nowrap">{t('storeMe.monthlyTrend')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {monthlyDetailRows.map((row) => (
                <TableRow key={row.key}>
                  <TableCell className="tw:min-w-44 tw:whitespace-nowrap">
                    <div className="tw:grid tw:gap-1">
                      <strong className="tw:font-medium">{row.label}</strong>
                      <span className="tw:text-xs tw:text-muted-foreground">{row.periodNote}</span>
                    </div>
                  </TableCell>
                  <TableCell className="tw:whitespace-nowrap">{row.scoreLabel}</TableCell>
                  <TableCell className="tw:whitespace-nowrap">{row.uptLabel}</TableCell>
                  <TableCell className="tw:whitespace-nowrap">{row.atvLabel}</TableCell>
                  <TableCell className="tw:whitespace-nowrap">{row.targetLabel}</TableCell>
                  <TableCell>
                    <div className="tw:grid tw:min-w-48 tw:gap-1">
                      <Progress value={progressFromWidth(row.trendWidth)} className="tw:h-2" />
                      <span className="tw:whitespace-nowrap tw:text-xs tw:text-muted-foreground">
                        {row.trendLabel ?? t('storeMe.noTrendData')}
                      </span>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </DialogContent>
    </Dialog>
  )
}
