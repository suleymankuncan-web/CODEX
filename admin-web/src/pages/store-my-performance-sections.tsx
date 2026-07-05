import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Progress } from '@/components/ui/progress'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { TranslateFunction } from '../features/localization/dictionary'
import type { AppLocale } from '../lib/i18n'
import { MonthYearPeriodPicker } from './store-month-year-period-picker'

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

export function StoreMyPerformanceDateFilter({
  availableLiveMonthOptions,
  locale,
  onSelectLiveMonth,
  selectedLivePeriodStart,
  t,
}: StoreMyPerformanceDateFilterProps) {
  const selectedMonthKey =
    getMonthKey(selectedLivePeriodStart) || availableLiveMonthOptions[0]?.key || ''
  const availableMonthValues = availableLiveMonthOptions.map((month) => month.key)

  return (
    <MonthYearPeriodPicker
      ariaLabel={t('storeMe.dateFilter')}
      availableValues={availableMonthValues}
      locale={locale}
      onValueChange={onSelectLiveMonth}
      title={t('storeMe.dateFilter')}
      triggerClassName="tw:h-10 tw:w-full tw:justify-between tw:rounded-xl tw:border-border tw:bg-white/75 tw:px-3 tw:text-sm tw:font-medium"
      value={selectedMonthKey}
    />
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
        className="tw:max-h-[min(46rem,calc(100vh-2rem))] tw:w-[calc(100vw-2rem)] tw:max-w-[72rem] tw:overflow-auto tw:sm:max-w-[72rem]"
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
