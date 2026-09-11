import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
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
      <AlertTitle>{t('storeMe.missingDataExists')}</AlertTitle>
      <AlertDescription>
        <p>{t('storeMe.partialTitle')}</p>
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
