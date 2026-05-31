import type { TranslateFunction } from '../features/localization/dictionary'
import { formatDateTime, formatNumber } from '../lib/format'
import type { AppLocale } from '../lib/i18n'
import type { OperationsSignalFreshnessItem } from './operations-signal-freshness-model'
import {
  OperationsKeyValue,
  OperationsKeyValueGrid,
  OperationsPanel,
  OperationsQueueList,
  OperationsStatusBadge,
  type OperationsTone,
} from './operations-surface-primitives'

export function SignalFreshnessPanel(input: {
  items: OperationsSignalFreshnessItem[]
  locale: AppLocale
  t: TranslateFunction
}) {
  const headerStatus = resolveHeaderStatus(input.items)

  return (
    <OperationsPanel
      eyebrow={input.t('adminOperations.freshnessEyebrow')}
      title={input.t('adminOperations.freshnessTitle')}
      description={input.t('adminOperations.freshnessCopy')}
      testId="operations-signal-freshness"
      badge={<OperationsStatusBadge tone={headerStatus.tone}>{input.t(headerStatus.labelKey)}</OperationsStatusBadge>}
    >
      <OperationsQueueList
        items={input.items.map((item) => ({
          body: (
            <OperationsKeyValueGrid className="tw:sm:grid-cols-2 tw:lg:grid-cols-2">
              <OperationsKeyValue
                label={input.t('adminOperations.freshnessOpenSignals')}
                value={
                  item.count === null
                    ? input.t(statusLabelKey[item.status])
                    : input.t('adminOperations.freshnessOpenValue', {
                        count: formatNumber(item.count, input.locale),
                      })
                }
              />
              <OperationsKeyValue
                label={input.t('adminOperations.freshnessLastObserved')}
                value={
                  item.lastObservedAt
                    ? formatDateTime(item.lastObservedAt, input.locale)
                    : input.t('adminOperations.freshnessNoObservation')
                }
              />
            </OperationsKeyValueGrid>
          ),
          href: item.href,
          id: item.family,
          meta: input.t(familySourceKey[item.family]),
          status: input.t(statusLabelKey[item.status]),
          title: input.t(familyTitleKey[item.family]),
          tone: freshnessTone(item.status),
        }))}
      />
    </OperationsPanel>
  )
}

type FreshnessFamily = OperationsSignalFreshnessItem['family']
type FreshnessStatus = OperationsSignalFreshnessItem['status']
type TranslationKey = Parameters<TranslateFunction>[0]

type HeaderStatus = {
  labelKey: TranslationKey
  tone: OperationsTone
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

function freshnessTone(status: FreshnessStatus): OperationsTone {
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
