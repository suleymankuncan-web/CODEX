import { useEffect, useMemo, useState } from 'react'

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
  const [now, setNow] = useState(() => new Date())
  const items = useMemo(() => getCapacityReadinessSnapshot(now), [now])
  const panelStatus = resolvePanelStatus(items)

  useEffect(() => {
    const nextRefreshAt = getNextStaleBoundaryTime(items, now)
    if (!nextRefreshAt) return

    const timeoutId = window.setTimeout(() => {
      setNow(new Date())
    }, Math.max(0, nextRefreshAt - now.getTime()) + 100)

    return () => window.clearTimeout(timeoutId)
  }, [items, now])

  return (
    <OperationsPanel
      title={t('operations.capacity.title')}
      description={t('operations.capacity.description')}
      testId="operations-capacity-readiness"
      badge={<OperationsStatusBadge tone={panelStatus.tone}>{t(panelStatus.labelKey)}</OperationsStatusBadge>}
    >
      <OperationsInlineState tone="warning">
        <span className="tw:block">{t(resolvePilotDecisionKey(items))}</span>
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
  if (decisionImpact === 'pilot_refresh_required') {
    return 'operations.capacity.decision.pilot_refresh_required'
  }

  return 'operations.capacity.decision.broad_launch_blocked'
}

function resolvePilotDecisionKey(items: CapacityReadinessItem[]): TranslationKey {
  return items.some((item) => item.decisionImpact === 'pilot_refresh_required')
    ? 'operations.capacity.decision.pilot_refresh_required'
    : 'operations.capacity.decision.pilot_allowed_with_limits'
}

function getNextStaleBoundaryTime(items: CapacityReadinessItem[], now: Date): number | null {
  const nowTime = now.getTime()
  const nextBoundary = items
    .flatMap((item) => {
      if (item.status === 'stale' || !item.staleOnOrAfter) return []
      return [getUtcDateStartTime(item.staleOnOrAfter)]
    })
    .filter((time) => time > nowTime)
    .sort((left, right) => left - right)[0]

  return nextBoundary ?? null
}

function getUtcDateStartTime(utcDate: string): number {
  const [yearText, monthText, dayText] = utcDate.split('-')
  if (!yearText || !monthText || !dayText) {
    throw new Error(`Invalid UTC date: ${utcDate}`)
  }

  return Date.UTC(Number(yearText), Number(monthText) - 1, Number(dayText))
}

export { OperationsCapacityReadinessPanel }
