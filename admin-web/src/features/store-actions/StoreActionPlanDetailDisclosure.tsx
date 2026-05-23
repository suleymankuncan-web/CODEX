import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Eye, EyeOff, RefreshCw } from 'lucide-react'
import {
  EmptyState,
  KeyValue,
} from '../../components/dashboard-primitives'
import { formatDateTime, getErrorMessage } from '../../lib/format'
import type { AppLocale } from '../../lib/i18n'
import { transientQueryRetryOptions } from '../../lib/query-retry'
import type { TranslateFunction } from '../localization/dictionary'
import {
  getStoreActionPlan,
  type StoreActionPlan,
} from './api'

export function StoreActionPlanDetailDisclosure(input: {
  plan: StoreActionPlan
  locale: AppLocale
  t: TranslateFunction
}) {
  const [isOpen, setIsOpen] = useState(false)
  const detailQuery = useQuery({
    queryKey: ['store-action-plans', 'store-tasks', 'detail', input.plan.actionPlanId],
    queryFn: () => getStoreActionPlan({ actionPlanId: input.plan.actionPlanId }),
    enabled: isOpen,
    ...transientQueryRetryOptions,
  })

  return (
    <>
      <div className="action-cluster">
        <button
          type="button"
          className="control-button"
          aria-expanded={isOpen}
          onClick={() => setIsOpen((current) => !current)}
        >
          {isOpen ? <EyeOff size={16} /> : <Eye size={16} />}
          {isOpen
            ? input.t('storeTasks.actionPlansHideDetailAction')
            : input.t('storeTasks.actionPlansDetailAction')}
        </button>
      </div>
      {isOpen ? (
        <StoreActionPlanDetailBody
          plan={input.plan}
          detailPlan={detailQuery.data?.data.plan}
          isLoading={detailQuery.isLoading}
          isError={detailQuery.isError}
          isFetching={detailQuery.isFetching}
          error={detailQuery.error}
          locale={input.locale}
          t={input.t}
          onRetry={() => void detailQuery.refetch()}
        />
      ) : null}
    </>
  )
}

function StoreActionPlanDetailBody(input: {
  plan: StoreActionPlan
  detailPlan: StoreActionPlan | undefined
  isLoading: boolean
  isError: boolean
  isFetching: boolean
  error: unknown
  locale: AppLocale
  t: TranslateFunction
  onRetry: () => void
}) {
  if (input.isLoading) {
    return (
      <div className="stacked-row">
        <EmptyState
          title={input.t('storeTasks.actionPlansDetailLoadingTitle')}
          copy={input.t('storeTasks.actionPlansDetailLoadingCopy')}
        />
      </div>
    )
  }

  if (input.isError) {
    return (
      <div className="stacked-row">
        <div className="stacked-row-head">
          <strong>{input.t('storeTasks.actionPlansDetailErrorTitle')}</strong>
          <button
            type="button"
            className="control-button"
            disabled={input.isFetching}
            onClick={input.onRetry}
          >
            <RefreshCw size={16} />
            {input.isFetching ? input.t('storeTasks.retryingAction') : input.t('storeTasks.retryAction')}
          </button>
        </div>
        <p>{getErrorMessage(input.error)}</p>
      </div>
    )
  }

  const plan = input.detailPlan ?? input.plan

  return (
    <div className="stacked-row" aria-label={input.t('storeTasks.actionPlansDetailRegion')}>
      <div className="stacked-row-head">
        <strong>{input.t('storeTasks.actionPlansDetailTitle')}</strong>
        <span className="queue-subtitle">{input.t('storeTasks.actionPlansLifecycleSnapshot')}</span>
      </div>
      <div className="key-grid">
        <KeyValue label={input.t('storeTasks.actionPlansOwner')} value={plan.ownerUserId} />
        <KeyValue label={input.t('storeTasks.actionPlansCreatedBy')} value={plan.createdByUserId} />
        <KeyValue
          label={input.t('storeTasks.actionPlansCreatedAt')}
          value={formatDateTime(plan.createdAt, input.locale)}
        />
        <KeyValue
          label={input.t('storeTasks.actionPlansUpdatedAt')}
          value={formatDateTime(plan.updatedAt, input.locale)}
        />
        <KeyValue label={input.t('storeTasks.actionPlansSourceId')} value={plan.sourceId} />
        <KeyValue
          label={input.t('storeTasks.actionPlansSourceSnapshot')}
          value={formatOptionalValue(plan.sourceSnapshotRunId, input.t)}
        />
        <KeyValue
          label={input.t('storeTasks.actionPlansSourceKpi')}
          value={formatOptionalValue(plan.sourceKpiId, input.t)}
        />
        <KeyValue
          label={input.t('storeTasks.actionPlansClosedAt')}
          value={formatOptionalDateTime(plan.closedAt, input.locale, input.t)}
        />
        <KeyValue
          label={input.t('storeTasks.actionPlansCancelledAt')}
          value={formatOptionalDateTime(plan.cancelledAt, input.locale, input.t)}
        />
        <KeyValue
          label={input.t('storeTasks.actionPlansResolutionEvidence')}
          value={formatOptionalValue(plan.resolutionNote, input.t)}
        />
        <KeyValue
          label={input.t('storeTasks.actionPlansCancelEvidence')}
          value={formatOptionalValue(plan.cancelReason, input.t)}
        />
      </div>
    </div>
  )
}

function formatOptionalDateTime(input: string | null, locale: AppLocale, t: TranslateFunction) {
  return input ? formatDateTime(input, locale) : t('storeTasks.actionPlansNotAvailable')
}

function formatOptionalValue(input: string | null, t: TranslateFunction) {
  const normalized = input?.trim()
  return normalized ? normalized : t('storeTasks.actionPlansNotAvailable')
}
