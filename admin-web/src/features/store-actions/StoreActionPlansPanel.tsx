import { RefreshCw } from 'lucide-react'
import { Link } from 'react-router-dom'
import {
  EmptyState,
  KeyValue,
  StatusPill,
  type Tone,
} from '../../components/dashboard-primitives'
import { formatDate, formatDateTime, getErrorMessage } from '../../lib/format'
import type { AppLocale } from '../../lib/i18n'
import type { TranslateFunction } from '../localization/dictionary'
import type {
  StoreActionPlan,
  StoreActionPlanPriority,
  StoreActionPlanStatus,
} from './api'

export function StoreActionPlansPanel(input: {
  plans: readonly StoreActionPlan[]
  isLoading: boolean
  isError: boolean
  isFetching: boolean
  error: unknown
  locale: AppLocale
  t: TranslateFunction
  onRetry: () => void
}) {
  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <div className="eyebrow">{input.t('storeTasks.actionPlansEyebrow')}</div>
          <h3>{input.t('storeTasks.actionPlansTitle')}</h3>
        </div>
        <StatusPill tone={input.plans.length > 0 ? 'warning' : 'neutral'}>
          {input.t('storeTasks.actionPlansCount', { count: input.plans.length })}
        </StatusPill>
      </div>

      {renderPanelBody(input)}
    </section>
  )
}

function renderPanelBody(input: {
  plans: readonly StoreActionPlan[]
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
      <EmptyState
        title={input.t('storeTasks.actionPlansLoadingTitle')}
        copy={input.t('storeTasks.actionPlansLoadingCopy')}
      />
    )
  }

  if (input.isError) {
    return (
      <div className="stacked-row">
        <div className="stacked-row-head">
          <strong>{input.t('storeTasks.actionPlansErrorTitle')}</strong>
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

  if (input.plans.length === 0) {
    return (
      <EmptyState
        title={input.t('storeTasks.actionPlansEmptyTitle')}
        copy={input.t('storeTasks.actionPlansEmptyCopy')}
      />
    )
  }

  return (
    <div className="stacked-table">
      {input.plans.map((plan) => (
        <StoreActionPlanRow
          key={plan.actionPlanId}
          plan={plan}
          locale={input.locale}
          t={input.t}
        />
      ))}
    </div>
  )
}

function StoreActionPlanRow(input: {
  plan: StoreActionPlan
  locale: AppLocale
  t: TranslateFunction
}) {
  return (
    <article className="stacked-row">
      <div className="stacked-row-head">
        <div>
          <strong>{input.plan.title}</strong>
          <p className="queue-subtitle">
            {input.plan.summary ?? input.t('storeTasks.actionPlansNoSummary')}
          </p>
        </div>
        <div className="action-cluster">
          <StatusPill tone={mapStoreActionPlanStatusTone(input.plan.status)}>
            {formatStoreActionPlanStatus(input.t, input.plan.status)}
          </StatusPill>
          <StatusPill tone={mapStoreActionPlanPriorityTone(input.plan.priority)}>
            {formatStoreActionPlanPriority(input.t, input.plan.priority)}
          </StatusPill>
        </div>
      </div>

      <div className="key-grid">
        <KeyValue label={input.t('storeTasks.actionPlansStore')} value={input.plan.storeId} />
        <KeyValue
          label={input.t('storeTasks.actionPlansDueOn')}
          value={formatActionPlanDate(input.plan.dueOn, input.locale)}
        />
        <KeyValue
          label={input.t('storeTasks.actionPlansUpdatedAt')}
          value={formatDateTime(input.plan.updatedAt, input.locale)}
        />
        <KeyValue
          label={input.t('storeTasks.actionPlansSource')}
          value={formatStoreActionPlanSource(input.t, input.plan.sourceType)}
        />
      </div>

      <div className="action-cluster">
        {input.plan.sourceDeepLink ? (
          <Link className="control-button store-shell-link" to={input.plan.sourceDeepLink}>
            {input.t('storeTasks.actionPlansOpenSource')}
          </Link>
        ) : (
          <span className="queue-subtitle">{input.t('storeTasks.actionPlansNoSourceLink')}</span>
        )}
      </div>
    </article>
  )
}

function mapStoreActionPlanStatusTone(status: StoreActionPlanStatus): Tone {
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

function mapStoreActionPlanPriorityTone(priority: StoreActionPlanPriority): Tone {
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
