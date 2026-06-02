import { RefreshCw } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import {
  StoreEmptyState,
  StoreInfoGrid,
  StoreSectionCard,
  StoreStackedList,
  StoreStackedRow,
  StoreStatusBadge,
  type StoreSurfaceTone,
} from '../../pages/store-surface-primitives'
import { formatDate, formatDateTime, getErrorMessage } from '../../lib/format'
import type { AppLocale } from '../../lib/i18n'
import type { TranslateFunction } from '../localization/dictionary'
import type {
  StoreActionPlan,
  StoreActionPlanList,
  StoreActionPlanPriority,
  StoreActionPlanStatus,
} from './api'
import { StoreActionPlanCancelControl } from './StoreActionPlanCancelControl'
import { StoreActionPlanCloseControl } from './StoreActionPlanCloseControl'
import { StoreActionPlanDetailDisclosure } from './StoreActionPlanDetailDisclosure'
import { StoreActionPlanStatusControl } from './StoreActionPlanStatusControl'

type StoreActionPlanListMeta = StoreActionPlanList['meta']

export function StoreActionPlansPanel(input: {
  plans: readonly StoreActionPlan[]
  meta: StoreActionPlanListMeta | undefined
  isLoading: boolean
  isError: boolean
  isFetching: boolean
  error: unknown
  locale: AppLocale
  t: TranslateFunction
  onRetry: () => void
  onPreviousPage: () => void
  onNextPage: () => void
}) {
  const displayedCount = input.meta?.total ?? input.plans.length

  return (
    <StoreSectionCard
      testId="store-action-plans-panel"
      title={input.t('storeTasks.actionPlansTitle')}
      description={input.t('storeTasks.actionPlansEyebrow')}
      badge={{
        label: input.t('storeTasks.actionPlansCount', { count: displayedCount }),
        tone: input.plans.length > 0 ? 'warning' : 'neutral',
      }}
    >
      {renderPanelBody(input)}
      {renderPagination(input)}
    </StoreSectionCard>
  )
}

function renderPanelBody(input: {
  plans: readonly StoreActionPlan[]
  meta: StoreActionPlanListMeta | undefined
  isLoading: boolean
  isError: boolean
  isFetching: boolean
  error: unknown
  locale: AppLocale
  t: TranslateFunction
  onRetry: () => void
  onPreviousPage: () => void
  onNextPage: () => void
}) {
  if (input.isLoading) {
    return (
      <StoreEmptyState
        title={input.t('storeTasks.actionPlansLoadingTitle')}
        description={input.t('storeTasks.actionPlansLoadingCopy')}
      />
    )
  }

  if (input.isError) {
    return (
      <StoreStackedRow tone="danger" testId="store-action-plans-error-row">
        <div className="tw:flex tw:flex-col tw:gap-3 tw:sm:flex-row tw:sm:items-start tw:sm:justify-between">
          <strong className="tw:text-sm tw:text-foreground">{input.t('storeTasks.actionPlansErrorTitle')}</strong>
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

  if (input.plans.length === 0 && (input.meta?.total ?? 0) > 0) {
    return (
      <StoreEmptyState
        title={input.t('storeTasks.actionPlansPageStaleTitle')}
        description={input.t('storeTasks.actionPlansPageStaleCopy')}
      />
    )
  }

  if (input.plans.length === 0) {
    return (
      <StoreEmptyState
        title={input.t('storeTasks.actionPlansEmptyTitle')}
        description={input.t('storeTasks.actionPlansEmptyCopy')}
      />
    )
  }

  return (
    <StoreStackedList>
      {input.plans.map((plan) => (
        <StoreActionPlanRow
          key={plan.actionPlanId}
          plan={plan}
          locale={input.locale}
          t={input.t}
        />
      ))}
    </StoreStackedList>
  )
}

function renderPagination(input: {
  plans: readonly StoreActionPlan[]
  meta: StoreActionPlanListMeta | undefined
  isLoading: boolean
  isError: boolean
  isFetching: boolean
  t: TranslateFunction
  onPreviousPage: () => void
  onNextPage: () => void
}) {
  if (input.isLoading || input.isError || input.plans.length === 0 || !input.meta || input.meta.total === 0) {
    return null
  }

  const start = input.meta.offset + 1
  const end = input.meta.offset + input.meta.count
  const canGoPrevious = input.meta.offset > 0
  const canGoNext = end < input.meta.total

  return (
    <div className="tw:mt-3 tw:flex tw:flex-col tw:gap-2 tw:text-sm tw:text-muted-foreground tw:sm:flex-row tw:sm:items-center tw:sm:justify-between">
      <span>
        {input.t('storeTasks.actionPlansRange', {
          start,
          end,
          total: input.meta.total,
        })}
      </span>
      <div className="tw:flex tw:flex-wrap tw:gap-2">
        <Button
          type="button"
          variant="outline"
          disabled={!canGoPrevious || input.isFetching}
          onClick={input.onPreviousPage}
        >
          {input.t('storeTasks.actionPlansPrevious')}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={!canGoNext || input.isFetching}
          onClick={input.onNextPage}
        >
          {input.t('storeTasks.actionPlansNext')}
        </Button>
      </div>
    </div>
  )
}

function StoreActionPlanRow(input: {
  plan: StoreActionPlan
  locale: AppLocale
  t: TranslateFunction
}) {
  const safeSourceDeepLink = getSafeSourceDeepLink(input.plan.sourceDeepLink)
  const summary = input.plan.summary?.trim()

  return (
    <StoreStackedRow testId="store-action-plan-row">
      <div className="tw:flex tw:flex-col tw:gap-3">
        <div className="tw:flex tw:flex-col tw:gap-3 tw:md:flex-row tw:md:items-start tw:md:justify-between">
          <div className="tw:min-w-0">
            <strong className="tw:block tw:text-sm tw:text-foreground">{input.plan.title}</strong>
            <p className="tw:mt-1 tw:text-sm tw:leading-6 tw:text-muted-foreground">
              {summary ? summary : input.t('storeTasks.actionPlansNoSummary')}
            </p>
          </div>
          <div className="tw:flex tw:flex-wrap tw:gap-2">
            <StoreStatusBadge tone={mapStoreActionPlanStatusTone(input.plan.status)}>
              {formatStoreActionPlanStatus(input.t, input.plan.status)}
            </StoreStatusBadge>
            <StoreStatusBadge tone={mapStoreActionPlanPriorityTone(input.plan.priority)}>
              {formatStoreActionPlanPriority(input.t, input.plan.priority)}
            </StoreStatusBadge>
          </div>
        </div>

        <StoreInfoGrid
          items={[
            { label: input.t('storeTasks.actionPlansStore'), value: input.plan.storeId },
            {
              label: input.t('storeTasks.actionPlansDueOn'),
              value: formatActionPlanDate(input.plan.dueOn, input.locale),
            },
            {
              label: input.t('storeTasks.actionPlansUpdatedAt'),
              value: formatDateTime(input.plan.updatedAt, input.locale),
            },
            {
              label: input.t('storeTasks.actionPlansSource'),
              value: formatStoreActionPlanSource(input.t, input.plan.sourceType),
            },
          ]}
        />

        <div className="tw:flex tw:flex-wrap tw:gap-2">
          {safeSourceDeepLink ? (
            <Button asChild size="sm" variant="outline">
              <Link to={safeSourceDeepLink}>{input.t('storeTasks.actionPlansOpenSource')}</Link>
            </Button>
          ) : (
            <span className="tw:text-sm tw:text-muted-foreground">{input.t('storeTasks.actionPlansNoSourceLink')}</span>
          )}
          <StoreActionPlanStatusControl plan={input.plan} t={input.t} />
          <StoreActionPlanCloseControl plan={input.plan} t={input.t} />
          <StoreActionPlanCancelControl plan={input.plan} t={input.t} />
        </div>

        <StoreActionPlanDetailDisclosure plan={input.plan} locale={input.locale} t={input.t} />
      </div>
    </StoreStackedRow>
  )
}

function getSafeSourceDeepLink(input: string | null) {
  if (!input || !input.startsWith('/') || input.startsWith('//')) {
    return null
  }

  for (let index = 0; index < input.length; index += 1) {
    const codePoint = input.charCodeAt(index)
    if (codePoint <= 31 || codePoint === 127) {
      return null
    }
  }

  return input
}

function mapStoreActionPlanStatusTone(status: StoreActionPlanStatus): StoreSurfaceTone {
  switch (status) {
    case 'open':
      return 'warning'
    case 'in_progress':
      return 'accent'
    case 'blocked':
      return 'danger'
    case 'closed':
      return 'calm'
    case 'cancelled':
      return 'neutral'
    default:
      return 'neutral'
  }
}

function mapStoreActionPlanPriorityTone(priority: StoreActionPlanPriority): StoreSurfaceTone {
  switch (priority) {
    case 'high':
      return 'danger'
    case 'medium':
      return 'warning'
    case 'low':
      return 'accent'
    default:
      return 'neutral'
  }
}

function formatStoreActionPlanStatus(t: TranslateFunction, status: StoreActionPlanStatus) {
  switch (status) {
    case 'open':
      return t('storeTasks.actionPlanStatus.open')
    case 'in_progress':
      return t('storeTasks.actionPlanStatus.in_progress')
    case 'blocked':
      return t('storeTasks.actionPlanStatus.blocked')
    case 'closed':
      return t('storeTasks.actionPlanStatus.closed')
    case 'cancelled':
      return t('storeTasks.actionPlanStatus.cancelled')
    default:
      return status
  }
}

function formatStoreActionPlanPriority(t: TranslateFunction, priority: StoreActionPlanPriority) {
  switch (priority) {
    case 'high':
      return t('storeTasks.actionPlanPriority.high')
    case 'medium':
      return t('storeTasks.actionPlanPriority.medium')
    case 'low':
      return t('storeTasks.actionPlanPriority.low')
    default:
      return priority
  }
}

function formatStoreActionPlanSource(t: TranslateFunction, sourceType: StoreActionPlan['sourceType']) {
  switch (sourceType) {
    case 'kpi_exception':
      return t('storeTasks.sourceType.kpi_exception')
    case 'checklist_remediation':
      return t('storeTasks.sourceType.checklist_remediation')
    default:
      return sourceType
  }
}

function formatActionPlanDate(input: string, locale: AppLocale) {
  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(input)
    ? `${input}T12:00:00.000Z`
    : input

  return formatDate(normalized, locale)
}
