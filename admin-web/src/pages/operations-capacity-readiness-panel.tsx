import type { TranslateFunction, TranslationKey } from '../features/localization/dictionary'
import {
  getCapacityReadinessSnapshot,
  type CapacityDecisionImpact,
  type CapacityEvidenceStatus,
  type CapacityReadinessItem,
} from './operations-capacity-readiness-model'
import {
  OperationsInlineState,
  OperationsPanel,
  OperationsQueueList,
  OperationsStatusBadge,
} from './operations-surface-primitives'

function OperationsCapacityReadinessPanel({ t }: { t: TranslateFunction }) {
  const items = getCapacityReadinessSnapshot()
  const panelStatus = resolvePanelStatus(items)

  return (
    <OperationsPanel
      title={t('operations.capacity.title')}
      description={t('operations.capacity.description')}
      testId="operations-capacity-readiness"
      badge={<OperationsStatusBadge tone={panelStatus.tone}>{t(panelStatus.labelKey)}</OperationsStatusBadge>}
    >
      <OperationsInlineState tone="warning">
        <span className="tw:block">{t('operations.capacity.decision.pilot_allowed_with_limits')}</span>
        <span className="tw:mt-1 tw:block">{t('operations.capacity.decision.broad_launch_blocked')}</span>
      </OperationsInlineState>
      <OperationsQueueList
        items={items.map((item) => ({
          body: <CapacityReadinessBody item={item} t={t} />,
          footer: t(getDecisionKey(item.decisionImpact)),
          id: item.id,
          meta: t('operations.capacity.lastVerified', { date: item.lastVerifiedAt }),
          reason: t(item.summaryKey),
          status: t(getStatusKey(item.status)),
          title: t(item.labelKey),
          tone: item.tone,
        }))}
      />
    </OperationsPanel>
  )
}

function CapacityReadinessBody({
  item,
  t,
}: {
  item: CapacityReadinessItem
  t: TranslateFunction
}) {
  return (
    <div className="tw:grid tw:gap-1 tw:text-xs tw:leading-5 tw:text-muted-foreground">
      <span>{t(item.nextActionKey)}</span>
      <span>
        {t('operations.capacity.source', { path: item.sourcePath })}
      </span>
      {item.staleOnOrAfter ? (
        <span>{t('operations.capacity.staleOnOrAfter', { date: item.staleOnOrAfter })}</span>
      ) : null}
    </div>
  )
}

function resolvePanelStatus(items: CapacityReadinessItem[]): {
  labelKey: TranslationKey
  tone: CapacityReadinessItem['tone']
} {
  if (items.some((item) => item.status === 'stale')) {
    return {
      labelKey: 'operations.capacity.status.stale',
      tone: 'warning',
    }
  }

  if (items.some((item) => item.status === 'blocked')) {
    return {
      labelKey: 'operations.capacity.status.blocked',
      tone: 'warning',
    }
  }

  return {
    labelKey: 'operations.capacity.status.passed',
    tone: 'calm',
  }
}

function getStatusKey(status: CapacityEvidenceStatus): TranslationKey {
  if (status === 'passed') return 'operations.capacity.status.passed'
  if (status === 'stale') return 'operations.capacity.status.stale'
  return 'operations.capacity.status.blocked'
}

function getDecisionKey(decisionImpact: CapacityDecisionImpact): TranslationKey {
  if (decisionImpact === 'pilot_allowed_with_limits') {
    return 'operations.capacity.decision.pilot_allowed_with_limits'
  }

  return 'operations.capacity.decision.broad_launch_blocked'
}

export { OperationsCapacityReadinessPanel }
