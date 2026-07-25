import { Link } from 'react-router'
import { Button } from '../components/ui/button'
import type { TranslateFunction } from '../features/localization/dictionary'
import type { KpiConfigResponse, RankingSummary } from '../features/reports/api'
import { formatDateTime, getErrorMessage } from '../lib/format'
import { getIntlLocale, type AppLocale } from '../lib/i18n'
import type { KpiRankingReadiness } from './operations-kpi-ranking-signal-model'
import {
  OperationsInlineState,
  OperationsKeyValue,
  OperationsKeyValueGrid,
  OperationsPanel,
  OperationsStatusBadge,
} from './operations-surface-primitives'

export function KpiRankingSignalPanel(input: {
  config: KpiConfigResponse | undefined
  error: unknown
  isError: boolean
  isLoading: boolean
  locale: AppLocale
  rankings: RankingSummary | undefined
  readiness: KpiRankingReadiness
  t: TranslateFunction
}) {
  const tone = input.isLoading
    ? 'neutral'
    : input.isError
      ? 'warning'
      : input.readiness.issueCount > 0
        ? 'warning'
        : 'calm'

  return (
    <OperationsPanel
      eyebrow={input.t('adminOperations.kpiRankingsEyebrow')}
      title={input.t('adminOperations.kpiRankingsTitle')}
      description={input.t('adminOperations.kpiRankingsCopy')}
      testId="operations-kpi-ranking-signal"
      badge={
        <OperationsStatusBadge tone={tone}>
          {input.isLoading
            ? input.t('adminOperations.loading')
            : input.isError
            ? input.t('adminOperations.unavailable')
            : input.readiness.issueCount > 0
              ? input.t('adminOperations.needsAttention')
              : input.t('adminOperations.ready')}
        </OperationsStatusBadge>
      }
      actions={
        <>
          <Button asChild size="sm" variant="outline">
            <Link to="/admin/reports">{input.t('adminOperations.openReports')}</Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link to="/admin/kpi-config">{input.t('adminOperations.openKpiConfig')}</Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link to="/store/rankings">{input.t('adminOperations.openStoreRankings')}</Link>
          </Button>
        </>
      }
    >

      {input.isLoading ? (
        <OperationsInlineState>{input.t('adminOperations.signalLoadingCopy')}</OperationsInlineState>
      ) : input.isError ? (
        <OperationsInlineState tone="warning">{getErrorMessage(input.error)}</OperationsInlineState>
      ) : (
        <OperationsKeyValueGrid>
          <OperationsKeyValue
            label={input.t('adminOperations.kpiConfigVersion')}
            value={formatKpiConfigVersion(input.config, input.t)}
          />
          <OperationsKeyValue
            label={input.t('adminOperations.kpiPublishedAt')}
            value={formatKpiPublishedAt(input.config, input.locale, input.t)}
          />
          <OperationsKeyValue
            label={input.t('adminOperations.rankingPeriod')}
            value={formatRankingPeriod(input.rankings, input.locale, input.t)}
          />
          <OperationsKeyValue
            label={input.t('adminOperations.rankingPopulation')}
            value={input.t('adminOperations.rankingPopulationValue', {
              personnel: input.readiness.personnelPopulation,
              stores: input.readiness.storePopulation,
            })}
          />
          <OperationsKeyValue
            label={input.t('adminOperations.availableRankingPeriods')}
            value={String(input.readiness.availablePeriodCount)}
          />
        </OperationsKeyValueGrid>
      )}

      <p className="tw:m-0 tw:text-sm tw:text-muted-foreground">
        {input.t('adminOperations.kpiRankingsSourceCopy')}
      </p>
    </OperationsPanel>
  )
}

function formatKpiConfigVersion(config: KpiConfigResponse | undefined, t: TranslateFunction) {
  if (!config?.metadata.versionNo) return t('adminOperations.notCaptured')
  return t('adminOperations.kpiVersionValue', { version: config.metadata.versionNo })
}

function formatKpiPublishedAt(
  config: KpiConfigResponse | undefined,
  locale: AppLocale,
  t: TranslateFunction,
) {
  if (!config?.metadata.publishedAt) return t('adminOperations.notCaptured')
  return formatDateTime(config.metadata.publishedAt, locale)
}

function formatRankingPeriod(
  rankings: RankingSummary | undefined,
  locale: AppLocale,
  t: TranslateFunction,
) {
  if (!rankings?.source.periodStart || !rankings.source.periodEnd) {
    return t('adminOperations.notCaptured')
  }

  return `${formatBusinessDate(rankings.source.periodStart, locale)} - ${formatBusinessDate(rankings.source.periodEnd, locale)}`
}

function formatBusinessDate(input: string, locale: AppLocale) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(input)
  const date = match
    ? new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])))
    : new Date(input)
  if (Number.isNaN(date.getTime())) return input

  return new Intl.DateTimeFormat(getIntlLocale(locale), {
    dateStyle: 'medium',
    timeZone: 'UTC',
  }).format(date)
}
