import { Link } from 'react-router-dom'
import { KeyValue, StatusPill, type Tone } from '../components/dashboard-primitives'
import type { TranslateFunction } from '../features/localization/dictionary'
import { formatDateTime, formatNumber } from '../lib/format'
import type { AppLocale } from '../lib/i18n'
import type { OperationsSignalFreshnessItem } from './operations-signal-freshness-model'

export function SignalFreshnessPanel(input: {
  items: OperationsSignalFreshnessItem[]
  locale: AppLocale
  t: TranslateFunction
}) {
  const headerStatus = resolveHeaderStatus(input.items)

  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <div className="eyebrow">{input.t('adminOperations.freshnessEyebrow')}</div>
          <h3>{input.t('adminOperations.freshnessTitle')}</h3>
          <p>{input.t('adminOperations.freshnessCopy')}</p>
        </div>
        <StatusPill tone={headerStatus.tone}>{input.t(headerStatus.labelKey)}</StatusPill>
      </div>
      <div className="stacked-table">
        {input.items.map((item) => (
          <Link className="queue-row" key={item.family} to={item.href}>
            <div className="queue-row-head">
              <strong>{input.t(familyTitleKey[item.family])}</strong>
              <StatusPill tone={freshnessTone(item.status)}>
                {input.t(statusLabelKey[item.status])}
              </StatusPill>
            </div>
            <span className="queue-subtitle">{input.t(familySourceKey[item.family])}</span>
            <div className="key-grid">
              <KeyValue
                label={input.t('adminOperations.freshnessOpenSignals')}
                value={
                  item.count === null
                    ? input.t(statusLabelKey[item.status])
                    : input.t('adminOperations.freshnessOpenValue', {
                        count: formatNumber(item.count, input.locale),
                      })
                }
              />
              <KeyValue
                label={input.t('adminOperations.freshnessLastObserved')}
                value={
                  item.lastObservedAt
                    ? formatDateTime(item.lastObservedAt, input.locale)
                    : input.t('adminOperations.freshnessNoObservation')
                }
              />
            </div>
          </Link>
        ))}
      </div>
    </section>
  )
}

type FreshnessFamily = OperationsSignalFreshnessItem['family']
type FreshnessStatus = OperationsSignalFreshnessItem['status']
type TranslationKey = Parameters<TranslateFunction>[0]

type HeaderStatus = {
  labelKey: TranslationKey
  tone: Tone
}

const familyTitleKey: Record<FreshnessFamily, TranslationKey> = {
  import: 'adminOperations.freshness.importTitle',
  snapshot: 'adminOperations.freshness.snapshotTitle',
  workforce: 'adminOperations.freshness.workforceTitle',
  workflow: 'adminOperations.freshness.workflowTitle',
  kpi: 'adminOperations.freshness.kpiTitle',
}

const familySourceKey: Record<FreshnessFamily, TranslationKey> = {
  import: 'adminOperations.freshness.importSource',
  snapshot: 'adminOperations.freshness.snapshotSource',
  workforce: 'adminOperations.freshness.workforceSource',
  workflow: 'adminOperations.freshness.workflowSource',
  kpi: 'adminOperations.freshness.kpiSource',
}

const statusLabelKey: Record<FreshnessStatus, TranslationKey> = {
  attention: 'adminOperations.needsAttention',
  loading: 'adminOperations.loading',
  ready: 'adminOperations.ready',
  unavailable: 'adminOperations.unavailable',
}

function freshnessTone(status: FreshnessStatus): Tone {
  if (status === 'loading') return 'neutral'
  return status === 'attention' || status === 'unavailable' ? 'warning' : 'calm'
}

function resolveHeaderStatus(items: OperationsSignalFreshnessItem[]): HeaderStatus {
  if (items.some((item) => item.status === 'unavailable')) {
    return { labelKey: 'adminOperations.unavailable', tone: 'warning' }
  }

  if (items.some((item) => item.status === 'loading')) {
    return { labelKey: 'adminOperations.loading', tone: 'neutral' }
  }

  if (items.some((item) => item.status === 'attention')) {
    return { labelKey: 'adminOperations.needsAttention', tone: 'warning' }
  }

  return { labelKey: 'adminOperations.coverage.live', tone: 'calm' }
}
