import { Link } from 'react-router-dom'
import {
  KeyValue,
  StatusPill,
} from '../components/dashboard-primitives'
import type { TranslateFunction } from '../features/localization/dictionary'
import type { KpiConfigResponse, RankingSummary } from '../features/reports/api'
import { getErrorMessage } from '../lib/format'
import type { AppLocale } from '../lib/i18n'
import type { KpiRankingReadiness } from './operations-kpi-ranking-signal-model'

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
    <article className="panel">
      <div className="panel-heading panel-heading-spread">
        <div>
          <div className="eyebrow">{input.t('adminOperations.kpiRankingsEyebrow')}</div>
          <h3>{input.t('adminOperations.kpiRankingsTitle')}</h3>
          <p className="panel-copy">{input.t('adminOperations.kpiRankingsCopy')}</p>
        </div>
        <StatusPill tone={tone}>
          {input.isLoading
            ? input.t('adminOperations.loading')
            : input.isError
            ? input.t('adminOperations.unavailable')
            : input.readiness.issueCount > 0
              ? input.t('adminOperations.needsAttention')
              : input.t('adminOperations.ready')}
        </StatusPill>
      </div>

      {input.isLoading ? (
        <div className="inline-state">{input.t('adminOperations.signalLoadingCopy')}</div>
      ) : input.isError ? (
        <div className="inline-state inline-state-warning">{getErrorMessage(input.error)}</div>
      ) : (
        <div className="key-grid">
          <KeyValue
            label={input.t('adminOperations.kpiConfigVersion')}
            value={formatKpiConfigVersion(input.config, input.t)}
          />
          <KeyValue
            label={input.t('adminOperations.kpiPublishedAt')}
            value={formatKpiPublishedAt(input.config, input.locale, input.t)}
          />
          <KeyValue
            label={input.t('adminOperations.rankingPeriod')}
            value={formatRankingPeriod(input.rankings, input.locale, input.t)}
          />
          <KeyValue
            label={input.t('adminOperations.rankingPopulation')}
            value={input.t('adminOperations.rankingPopulationValue', {
              personnel: input.readiness.personnelPopulation,
              stores: input.readiness.storePopulation,
            })}
          />
          <KeyValue
            label={input.t('adminOperations.availableRankingPeriods')}
            value={String(input.readiness.availablePeriodCount)}
          />
        </div>
      )}

      <p className="queue-reason">{input.t('adminOperations.kpiRankingsSourceCopy')}</p>

      <div className="toolbar-cluster">
        <Link className="back-link" to="/admin/reports">
          <span>{input.t('adminOperations.openReports')}</span>
        </Link>
        <Link className="back-link" to="/admin/kpi-config">
          <span>{input.t('adminOperations.openKpiConfig')}</span>
        </Link>
        <Link className="back-link" to="/store/rankings">
          <span>{input.t('adminOperations.openStoreRankings')}</span>
        </Link>
      </div>
    </article>
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
  return formatDate(config.metadata.publishedAt, locale)
}

function formatRankingPeriod(
  rankings: RankingSummary | undefined,
  locale: AppLocale,
  t: TranslateFunction,
) {
  if (!rankings?.source.periodStart || !rankings.source.periodEnd) {
    return t('adminOperations.notCaptured')
  }

  return `${formatDate(rankings.source.periodStart, locale)} - ${formatDate(rankings.source.periodEnd, locale)}`
}

function formatDate(input: string, locale: AppLocale) {
  const normalized = input.includes('T') ? input : `${input}T00:00:00.000Z`
  const date = new Date(normalized)
  if (Number.isNaN(date.getTime())) return input

  return new Intl.DateTimeFormat(locale).format(date)
}
