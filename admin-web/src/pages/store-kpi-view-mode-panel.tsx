import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import type { TranslateFunction } from '../features/localization/dictionary'
import type { ReportingSnapshotRun } from '../features/reports/api'
import { formatSnapshotOptionLabel } from '../features/reports/snapshot-labels'
import { formatDate, formatState } from '../lib/format'
import type { AppLocale } from '../lib/i18n'
import { StoreSectionCard } from './store-surface-primitives'

const latestLivePeriodSelectValue = '__latest_live_period__'
const noClosedRecordSelectValue = '__no_closed_record__'

type StoreKpiViewMode = 'live' | 'closed'

type StoreKpiPeriodOption = {
  periodType: string
  periodStart: string
  periodEnd: string
}

type StoreKpiViewModePanelModel = {
  activeSnapshotRun: ReportingSnapshotRun | null | undefined
  availableSnapshotRuns: ReportingSnapshotRun[]
  latestLivePeriodLabel: string
  livePeriodStart: string
  liveSummary: { availablePeriods?: StoreKpiPeriodOption[] } | null | undefined
  locale: AppLocale
  selectedSnapshotRunId: string
  setLivePeriodStart: (value: string) => void
  setSelectedSnapshotRunId: (value: string) => void
  setViewMode: (value: StoreKpiViewMode) => void
  t: TranslateFunction
  viewMode: StoreKpiViewMode
}

export function StoreKpiViewModePanel({ model }: { model: StoreKpiViewModePanelModel }) {
  const {
    activeSnapshotRun,
    availableSnapshotRuns,
    latestLivePeriodLabel,
    livePeriodStart,
    liveSummary,
    locale,
    selectedSnapshotRunId,
    setLivePeriodStart,
    setSelectedSnapshotRunId,
    setViewMode,
    t,
    viewMode,
  } = model

  return (
    <StoreSectionCard title={t('storeKpis.viewModeTitle')} description={t('storeKpis.viewModeEyebrow')}>
      <div className="tw:flex tw:flex-col tw:gap-3">
        <ToggleGroup
          type="single"
          value={viewMode}
          onValueChange={(nextValue) => {
            if (nextValue === 'live' || nextValue === 'closed') setViewMode(nextValue)
          }}
          aria-label={t('storeKpis.viewModeEyebrow')}
          className="tw:flex tw:w-fit tw:flex-wrap tw:justify-start tw:rounded-lg tw:border tw:bg-card tw:p-1"
        >
          <ToggleGroupItem value="live" aria-label={t('storeKpis.livePeriod')}>
            {t('storeKpis.livePeriod')}
          </ToggleGroupItem>
          <ToggleGroupItem value="closed" aria-label={t('storeKpis.closedDay')}>
            {t('storeKpis.closedDay')}
          </ToggleGroupItem>
        </ToggleGroup>
        {viewMode === 'live' ? (
          <div className="tw:flex tw:flex-col tw:gap-2 tw:sm:flex-row tw:sm:items-center">
            <Select
              value={livePeriodStart || latestLivePeriodSelectValue}
              onValueChange={(nextValue) =>
                setLivePeriodStart(nextValue === latestLivePeriodSelectValue ? '' : nextValue)
              }
            >
              <SelectTrigger aria-label={t('storeKpis.livePeriodSelect')} className="tw:w-full tw:sm:min-w-80">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={latestLivePeriodSelectValue}>{latestLivePeriodLabel}</SelectItem>
                {(liveSummary?.availablePeriods ?? []).map((period) => (
                  <SelectItem key={`${period.periodType}:${period.periodStart}`} value={period.periodStart}>
                    {t('storeKpis.periodOption', {
                      start: formatDate(period.periodStart, locale),
                      end: formatDate(period.periodEnd, locale),
                      periodType: formatPeriodTypeLabel(t, period.periodType),
                    })}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button type="button" variant="outline" onClick={() => setLivePeriodStart('')} disabled={!livePeriodStart}>
              {t('storeKpis.clearFilter')}
            </Button>
          </div>
        ) : (
          <div className="tw:flex tw:flex-col tw:gap-2 tw:sm:flex-row tw:sm:items-center">
            <Select
              value={activeSnapshotRun?.snapshotRunId ?? noClosedRecordSelectValue}
              onValueChange={(nextValue) =>
                setSelectedSnapshotRunId(nextValue === noClosedRecordSelectValue ? '' : nextValue)
              }
            >
              <SelectTrigger aria-label={t('storeKpis.closedRecordSelect')} className="tw:w-full tw:sm:min-w-80">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {activeSnapshotRun ? null : (
                  <SelectItem value={noClosedRecordSelectValue}>{t('storeKpis.noRecord')}</SelectItem>
                )}
                {availableSnapshotRuns.map((run) => (
                  <SelectItem key={run.snapshotRunId} value={run.snapshotRunId}>
                    {formatSnapshotOptionLabel(run, locale)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button type="button" variant="outline" onClick={() => setSelectedSnapshotRunId('')} disabled={!selectedSnapshotRunId}>
              {t('storeKpis.returnLatestClosedDay')}
            </Button>
          </div>
        )}
      </div>
    </StoreSectionCard>
  )
}

function formatPeriodTypeLabel(t: TranslateFunction, input: string) {
  switch (input) {
    case 'monthly':
      return t('storeKpis.periodType.monthly')
    case 'daily':
      return t('storeKpis.periodType.daily')
    default:
      return formatState(input)
  }
}
