import { useEffect, useState } from 'react'
import type { ApiFailureDiagnostic } from '../lib/api-diagnostics'
import type { TranslateFunction } from '../features/localization/dictionary'
import { formatDateTime } from '../lib/format'
import type { AppLocale } from '../lib/i18n'
import {
  OperationsInlineState,
  OperationsKeyValue,
  OperationsKeyValueGrid,
  OperationsPanel,
  OperationsQueueList,
  OperationsStatusBadge,
  type OperationsTone,
} from './operations-surface-primitives'

const API_FAILURE_EVENT_NAME = 'store-ops-api-failure'
const API_FAILURE_PREVIEW_LIMIT = 5

export function OperationsApiFailureSnapshotPanel({
  locale,
  t,
}: {
  locale: AppLocale
  t: TranslateFunction
}) {
  const failures = useApiFailureDiagnostics()
  const visibleFailures = failures.slice(-API_FAILURE_PREVIEW_LIMIT).reverse()

  return (
    <OperationsPanel
      eyebrow={t('adminOperations.apiFailureEyebrow')}
      title={t('adminOperations.apiFailureTitle')}
      description={t('adminOperations.apiFailureCopy')}
      testId="operations-api-failure-snapshot"
      badge={
        <OperationsStatusBadge tone={visibleFailures.length > 0 ? 'warning' : 'calm'}>
          {visibleFailures.length > 0
            ? t('adminOperations.apiFailureCount', { count: visibleFailures.length })
            : t('adminOperations.queueClear')}
        </OperationsStatusBadge>
      }
    >
      <OperationsKeyValueGrid>
        <OperationsKeyValue
          label={t('adminOperations.apiFailureStored')}
          value={String(failures.length)}
        />
        <OperationsKeyValue
          label={t('adminOperations.apiFailureSource')}
          value={t('adminOperations.apiFailureSourceValue')}
        />
        <OperationsKeyValue
          label={t('adminOperations.apiFailurePersistence')}
          value={t('adminOperations.apiFailureLocalOnly')}
        />
      </OperationsKeyValueGrid>

      <OperationsInlineState>
        {t('adminOperations.apiFailureBoundaryCopy')}
      </OperationsInlineState>

      <OperationsQueueList
        emptyCopy={t('adminOperations.apiFailureEmpty')}
        header={t('adminOperations.apiFailureQueueTitle')}
        items={visibleFailures.map((failure) => ({
          id: `${failure.occurredAt}-${failure.method}-${failure.path}-${failure.requestAttempt}`,
          meta: t('adminOperations.apiFailureMeta', {
            category: failure.errorCategory,
            method: failure.method,
            status: formatStatus(failure.status, t),
          }),
          reason: formatFailureReason(failure, locale, t),
          status: failure.retryable
            ? t('adminOperations.apiFailureRetryable')
            : t('adminOperations.apiFailureNotRetryable'),
          title: failure.path,
          tone: resolveFailureTone(failure),
        }))}
      />
    </OperationsPanel>
  )
}

function useApiFailureDiagnostics() {
  const [failures, setFailures] = useState<ApiFailureDiagnostic[]>(() => readDiagnostics())

  useEffect(() => {
    const syncDiagnostics = () => setFailures(readDiagnostics())
    window.addEventListener(API_FAILURE_EVENT_NAME, syncDiagnostics)

    return () => {
      window.removeEventListener(API_FAILURE_EVENT_NAME, syncDiagnostics)
    }
  }, [])

  return failures
}

function readDiagnostics() {
  if (typeof window === 'undefined') {
    return []
  }

  return window.__STORE_OPS_API_FAILURES__ ?? []
}

function formatStatus(status: number | null, t: TranslateFunction) {
  return status === null ? t('adminOperations.apiFailureNetwork') : String(status)
}

function formatFailureReason(
  failure: ApiFailureDiagnostic,
  locale: AppLocale,
  t: TranslateFunction,
) {
  const queryCopy =
    failure.queryKeys.length > 0
      ? t('adminOperations.apiFailureQueryKeys', { keys: failure.queryKeys.join(', ') })
      : t('adminOperations.apiFailureNoQueryKeys')
  const requestCopy = failure.requestId
    ? t('adminOperations.apiFailureRequestId', { requestId: failure.requestId })
    : t('adminOperations.apiFailureNoRequestId')

  return t('adminOperations.apiFailureReason', {
    duration: failure.durationMs,
    message: failure.errorMessage,
    query: queryCopy,
    request: requestCopy,
    route: failure.route || t('adminOperations.unknown'),
    time: formatDateTime(failure.occurredAt, locale),
  })
}

function resolveFailureTone(failure: ApiFailureDiagnostic): OperationsTone {
  if (failure.status === null || failure.retryable) {
    return 'warning'
  }

  if (failure.status >= 500) {
    return 'danger'
  }

  return 'neutral'
}
