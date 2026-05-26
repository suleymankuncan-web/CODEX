import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Eye, EyeOff, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  StoreEmptyState,
  StoreInfoGrid,
  StoreStackedRow,
} from '../../pages/store-surface-primitives'
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
      <div className="tw:flex tw:flex-wrap tw:gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          aria-expanded={isOpen}
          onClick={() => setIsOpen((current) => !current)}
        >
          {isOpen ? <EyeOff data-icon="inline-start" /> : <Eye data-icon="inline-start" />}
          {isOpen
            ? input.t('storeTasks.actionPlansHideDetailAction')
            : input.t('storeTasks.actionPlansDetailAction')}
        </Button>
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
      <StoreStackedRow>
        <StoreEmptyState
          title={input.t('storeTasks.actionPlansDetailLoadingTitle')}
          description={input.t('storeTasks.actionPlansDetailLoadingCopy')}
        />
      </StoreStackedRow>
    )
  }

  if (input.isError) {
    return (
      <StoreStackedRow tone="danger">
        <div className="tw:flex tw:flex-col tw:gap-3 tw:sm:flex-row tw:sm:items-start tw:sm:justify-between">
          <strong className="tw:text-sm tw:text-foreground">{input.t('storeTasks.actionPlansDetailErrorTitle')}</strong>
          <Button
            type="button"
            variant="outline"
            disabled={input.isFetching}
            onClick={input.onRetry}
          >
            <RefreshCw data-icon="inline-start" />
            {input.isFetching ? input.t('storeTasks.retryingAction') : input.t('storeTasks.retryAction')}
          </Button>
        </div>
        <p className="tw:mt-2 tw:text-sm tw:text-muted-foreground">{getErrorMessage(input.error)}</p>
      </StoreStackedRow>
    )
  }

  const plan = input.detailPlan ?? input.plan

  return (
    <StoreStackedRow ariaLabel={input.t('storeTasks.actionPlansDetailRegion')}>
      <div className="tw:flex tw:flex-col tw:gap-3">
        <div className="tw:flex tw:flex-col tw:gap-1">
          <strong className="tw:text-sm tw:text-foreground">{input.t('storeTasks.actionPlansDetailTitle')}</strong>
          <span className="tw:text-sm tw:text-muted-foreground">{input.t('storeTasks.actionPlansLifecycleSnapshot')}</span>
        </div>
        <StoreInfoGrid
          items={[
            { label: input.t('storeTasks.actionPlansOwner'), value: plan.ownerUserId },
            { label: input.t('storeTasks.actionPlansCreatedBy'), value: plan.createdByUserId },
            { label: input.t('storeTasks.actionPlansCreatedAt'), value: formatDateTime(plan.createdAt, input.locale) },
            { label: input.t('storeTasks.actionPlansUpdatedAt'), value: formatDateTime(plan.updatedAt, input.locale) },
            { label: input.t('storeTasks.actionPlansSourceId'), value: plan.sourceId },
            {
              label: input.t('storeTasks.actionPlansSourceSnapshot'),
              value: formatOptionalValue(plan.sourceSnapshotRunId, input.t),
            },
            { label: input.t('storeTasks.actionPlansSourceKpi'), value: formatOptionalValue(plan.sourceKpiId, input.t) },
            {
              label: input.t('storeTasks.actionPlansClosedAt'),
              value: formatOptionalDateTime(plan.closedAt, input.locale, input.t),
            },
            {
              label: input.t('storeTasks.actionPlansCancelledAt'),
              value: formatOptionalDateTime(plan.cancelledAt, input.locale, input.t),
            },
            {
              label: input.t('storeTasks.actionPlansResolutionEvidence'),
              value: formatOptionalValue(plan.resolutionNote, input.t),
            },
            {
              label: input.t('storeTasks.actionPlansCancelEvidence'),
              value: formatOptionalValue(plan.cancelReason, input.t),
            },
          ]}
        />
      </div>
    </StoreStackedRow>
  )
}

function formatOptionalDateTime(input: string | null, locale: AppLocale, t: TranslateFunction) {
  return input ? formatDateTime(input, locale) : t('storeTasks.actionPlansNotAvailable')
}

function formatOptionalValue(input: string | null, t: TranslateFunction) {
  const normalized = input?.trim()
  return normalized ? normalized : t('storeTasks.actionPlansNotAvailable')
}
