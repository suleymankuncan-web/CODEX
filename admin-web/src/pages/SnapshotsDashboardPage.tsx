import { useDeferredValue, useMemo, useReducer } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Activity, ArrowRight, Clock3, RefreshCcw, Rocket } from 'lucide-react'
import { Link } from 'react-router-dom'
import {
  EmptyState,
  KeyValue,
  MetricAccent,
  MetricCard,
  ScreenState,
  StatusBar,
  StatusPill,
} from '../components/dashboard-primitives'
import { ReportingToolbar } from '../components/reporting-tools'
import { downloadCsv } from '../lib/download-csv'
import {
  getDailyClosureStatus,
  getSnapshotNeedsAction,
  getSnapshotOverview,
  runDailyClosure,
  rerunSnapshotRun,
} from '../features/snapshots/api'
import type { TranslateFunction } from '../features/localization/dictionary'
import { useLocalization } from '../features/localization/useLocalization'
import { formatDate, getErrorMessage, mapHealthTone } from '../lib/format'

const PAGE_SIZE = 12

const snapshotTypes = ['daily', 'weekly', 'monthly', 'payroll', 'compliance'] as const
const runStatuses = ['queued', 'running', 'completed', 'failed'] as const

type SnapshotSortValue = 'priority' | 'generated-desc' | 'reruns' | 'type'
type SnapshotTypeFilter = '' | (typeof snapshotTypes)[number]
type SnapshotRunStatusFilter = '' | (typeof runStatuses)[number]

type SnapshotsDashboardPageState = {
  search: string
  sortBy: SnapshotSortValue
  offset: number
  snapshotTypeFilter: SnapshotTypeFilter
  runStatusFilter: SnapshotRunStatusFilter
  feedback: string | null
}

type SnapshotsDashboardPageAction =
  | { type: 'setSearch'; value: string }
  | { type: 'setSortBy'; value: SnapshotSortValue }
  | { type: 'setSnapshotTypeFilter'; value: SnapshotTypeFilter }
  | { type: 'setRunStatusFilter'; value: SnapshotRunStatusFilter }
  | { type: 'setFeedback'; value: string | null }
  | { type: 'previousPage' }
  | { type: 'nextPage' }
  | { type: 'clearFilters' }

const initialSnapshotsDashboardPageState: SnapshotsDashboardPageState = {
  search: '',
  sortBy: 'priority',
  offset: 0,
  snapshotTypeFilter: '',
  runStatusFilter: '',
  feedback: null,
}

function snapshotsDashboardPageReducer(
  state: SnapshotsDashboardPageState,
  action: SnapshotsDashboardPageAction,
): SnapshotsDashboardPageState {
  switch (action.type) {
    case 'setSearch':
      return { ...state, search: action.value }
    case 'setSortBy':
      return { ...state, sortBy: action.value }
    case 'setSnapshotTypeFilter':
      return { ...state, offset: 0, snapshotTypeFilter: action.value }
    case 'setRunStatusFilter':
      return { ...state, offset: 0, runStatusFilter: action.value }
    case 'setFeedback':
      return { ...state, feedback: action.value }
    case 'previousPage':
      return { ...state, offset: Math.max(0, state.offset - PAGE_SIZE) }
    case 'nextPage':
      return { ...state, offset: state.offset + PAGE_SIZE }
    case 'clearFilters':
      return {
        ...state,
        search: '',
        offset: 0,
        snapshotTypeFilter: '',
        runStatusFilter: '',
      }
    default:
      return state
  }
}

function formatSnapshotType(input: string, t: TranslateFunction) {
  if (input === 'daily') return t('adminSnapshots.type.daily')
  if (input === 'weekly') return t('adminSnapshots.type.weekly')
  if (input === 'monthly') return t('adminSnapshots.type.monthly')
  if (input === 'payroll') return t('adminSnapshots.type.payroll')
  if (input === 'compliance') return t('adminSnapshots.type.compliance')
  return input.replaceAll('_', ' ')
}

function formatSnapshotState(input: string, t: TranslateFunction) {
  if (input === 'queued') return t('adminSnapshots.status.queued')
  if (input === 'running') return t('adminSnapshots.status.running')
  if (input === 'completed') return t('adminSnapshots.status.completed')
  if (input === 'failed') return t('adminSnapshots.status.failed')
  if (input === 'healthy') return t('adminSnapshots.health.healthy')
  if (input === 'in_progress') return t('adminSnapshots.health.inProgress')
  if (input === 'retry_ready') return t('adminSnapshots.health.retryReady')
  if (input === 'needs_action') return t('adminSnapshots.health.needsAction')
  if (input === 'stuck') return t('adminSnapshots.health.stuck')
  return input.replaceAll('_', ' ')
}

export function SnapshotsDashboardPage() {
  const { locale, t } = useLocalization()
  const [pageState, dispatchPageState] = useReducer(
    snapshotsDashboardPageReducer,
    initialSnapshotsDashboardPageState,
  )
  const { search, sortBy, offset, snapshotTypeFilter, runStatusFilter, feedback } = pageState
  const deferredSearch = useDeferredValue(search)
  const queryClient = useQueryClient()

  const overviewQuery = useQuery({
    queryKey: ['snapshot-overview'],
    queryFn: getSnapshotOverview,
  })
  const dailyClosureQuery = useQuery({
    queryKey: ['snapshot-daily-closure'],
    queryFn: getDailyClosureStatus,
  })
  const needsActionQuery = useQuery({
    queryKey: ['snapshot-needs-action', offset, snapshotTypeFilter, runStatusFilter],
    queryFn: () =>
      getSnapshotNeedsAction({
        limit: PAGE_SIZE,
        offset,
        snapshotType: snapshotTypeFilter || undefined,
        runStatus: runStatusFilter || undefined,
      }),
  })
  const rerunMutation = useMutation({
    mutationFn: rerunSnapshotRun,
    onSuccess: async (response) => {
      dispatchPageState({ type: 'setFeedback', value: response.command.message })
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['snapshot-needs-action'] }),
        queryClient.invalidateQueries({ queryKey: ['snapshot-overview'] }),
      ])
    },
  })
  const dailyClosureMutation = useMutation({
    mutationFn: runDailyClosure,
    onSuccess: async (response) => {
      dispatchPageState({ type: 'setFeedback', value: response.command.message })
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['snapshot-daily-closure'] }),
        queryClient.invalidateQueries({ queryKey: ['snapshot-needs-action'] }),
        queryClient.invalidateQueries({ queryKey: ['snapshot-overview'] }),
      ])
    },
  })

  const filteredItems = useMemo(() => {
    const input = deferredSearch.trim().toLowerCase()
    const items = needsActionQuery.data?.items ?? []

    if (!input) {
      return items
    }

    return items.filter((item) =>
      [
        item.snapshotRunId,
        item.snapshotType,
        formatSnapshotType(item.snapshotType, t),
        item.runStatus,
        formatSnapshotState(item.runStatus, t),
        item.healthState,
        formatSnapshotState(item.healthState, t),
        item.actionReason,
        item.recommendedAction,
      ]
        .join(' ')
        .toLowerCase()
        .includes(input),
    )
  }, [deferredSearch, needsActionQuery.data?.items, t])

  const sortedItems = useMemo(() => {
    const items = [...filteredItems]
    if (sortBy === 'generated-desc') {
      return items.sort((left, right) => right.generatedAt.localeCompare(left.generatedAt))
    }
    if (sortBy === 'reruns') {
      return items.sort((left, right) => right.rerunCount - left.rerunCount)
    }
    if (sortBy === 'type') {
      return items.sort((left, right) => left.snapshotType.localeCompare(right.snapshotType))
    }

    const priority = (state: string) => {
      if (state === 'stuck') return 4
      if (state === 'needs_action') return 3
      if (state === 'retry_ready') return 2
      if (state === 'in_progress') return 1
      return 0
    }

    return items.sort((left, right) => priority(right.healthState) - priority(left.healthState))
  }, [filteredItems, sortBy])

  if (overviewQuery.isLoading || needsActionQuery.isLoading || dailyClosureQuery.isLoading) {
    return <ScreenState title={t('adminSnapshots.loadingTitle')} copy={t('adminSnapshots.loadingCopy')} />
  }

  if (overviewQuery.isError) {
    return <ScreenState title={t('adminSnapshots.overviewUnavailableTitle')} copy={getErrorMessage(overviewQuery.error)} tone="error" />
  }

  if (needsActionQuery.isError) {
    return <ScreenState title={t('adminSnapshots.queueUnavailableTitle')} copy={getErrorMessage(needsActionQuery.error)} tone="error" />
  }
  if (dailyClosureQuery.isError) {
    return <ScreenState title={t('adminSnapshots.dailyClosureUnavailableTitle')} copy={getErrorMessage(dailyClosureQuery.error)} tone="error" />
  }

  const overview = overviewQuery.data
  const dailyClosure = dailyClosureQuery.data
  if (!overview) {
    return <ScreenState title={t('adminSnapshots.overviewUnavailableTitle')} copy={t('adminSnapshots.overviewMissingCopy')} tone="error" />
  }
  if (!dailyClosure) {
    return <ScreenState title={t('adminSnapshots.dailyClosureUnavailableTitle')} copy={t('adminSnapshots.dailyClosureMissingCopy')} tone="error" />
  }

  const meta = needsActionQuery.data?.meta
  const canGoBack = offset > 0
  const canGoForward = meta ? offset + PAGE_SIZE < meta.total : false

  return (
    <section className="page-stack">
      <section className="hero-panel">
        <div>
          <div className="eyebrow">{t('adminSnapshots.heroEyebrow')}</div>
          <h2 className="hero-title">{t('adminSnapshots.heroTitle')}</h2>
          <p className="hero-copy">{t('adminSnapshots.heroCopy')}</p>
        </div>
        <div className="hero-metrics">
          <MetricAccent label={t('adminSnapshots.allRuns')} value={String(overview.totals.all)} />
          <MetricAccent label={t('adminSnapshots.inProgress')} value={String(overview.healthTotals.inProgress)} />
          <MetricAccent label={t('adminSnapshots.retryReady')} value={String(overview.healthTotals.retryReady)} />
        </div>
      </section>

      {feedback ? (
        <section className="panel">
          <div className="inline-state inline-state-accent">{feedback}</div>
        </section>
      ) : null}

      <section className="two-up-grid">
        <article className="panel">
          <div className="panel-heading panel-heading-spread">
            <div>
              <div className="eyebrow">{t('adminSnapshots.dailyClosureEyebrow')}</div>
              <h3>{t('adminSnapshots.dailyClosureTitle')}</h3>
              <p className="panel-copy">{t('adminSnapshots.dailyClosureCopy')}</p>
            </div>
            <StatusPill tone={mapHealthTone(dailyClosure.healthState)}>
              {formatSnapshotState(dailyClosure.healthState, t)}
            </StatusPill>
          </div>
          <div className="key-grid">
            <KeyValue label={t('adminSnapshots.closureDate')} value={formatDate(dailyClosure.closureDate, locale)} />
            <KeyValue label={t('adminSnapshots.localDate')} value={formatDate(dailyClosure.localDate, locale)} />
            <KeyValue label={t('adminSnapshots.timezone')} value={dailyClosure.timezone} />
            <KeyValue label={t('adminSnapshots.existingRun')} value={dailyClosure.existingSnapshotRunId ?? t('adminSnapshots.noRunYet')} />
            <KeyValue label={t('adminSnapshots.automation')} value={dailyClosure.automationEnabled ? t('adminSnapshots.enabled') : t('adminSnapshots.disabled')} />
            <KeyValue label={t('adminSnapshots.pollCadence')} value={t('adminSnapshots.minutes', { count: dailyClosure.automationPollMinutes })} />
          </div>
          <p className="queue-reason">{dailyClosure.recommendedAction}</p>
          {dailyClosure.existingFailureReason ? (
            <div className="inline-state inline-state-danger">{dailyClosure.existingFailureReason}</div>
          ) : null}
          <div className="toolbar-cluster">
            <button
              className="control-button"
              type="button"
              onClick={() => dailyClosureMutation.mutate()}
              disabled={!dailyClosure.canQueue || dailyClosureMutation.isPending}
            >
              {dailyClosureMutation.isPending ? t('adminSnapshots.queuing') : t('adminSnapshots.queueDailyClosure')}
            </button>
            {dailyClosure.existingSnapshotRunId ? (
              <Link className="back-link" to={`/admin/snapshots/${dailyClosure.existingSnapshotRunId}`}>
                <span>{t('adminSnapshots.openSnapshotRun')}</span>
              </Link>
            ) : null}
          </div>
        </article>

        <article className="panel">
          <div className="panel-heading">
            <div>
              <div className="eyebrow">{t('adminSnapshots.closureRuleEyebrow')}</div>
              <h3>{t('adminSnapshots.closureRuleTitle')}</h3>
            </div>
          </div>
          <div className="key-grid">
            <KeyValue label={t('adminSnapshots.sourceModel')} value={t('adminSnapshots.sourceModelValue')} />
            <KeyValue label={t('adminSnapshots.automaticTarget')} value={t('adminSnapshots.automaticTargetValue')} />
            <KeyValue label={t('adminSnapshots.queueBehavior')} value={dailyClosure.canQueue ? t('adminSnapshots.readyToQueue') : t('adminSnapshots.waitingOrClosed')} />
            <KeyValue label={t('adminSnapshots.retryPath')} value={dailyClosure.canRerun ? t('adminSnapshots.useRerunOnFailed') : t('adminSnapshots.notNeeded')} />
          </div>
        </article>
      </section>

      <section className="metric-grid snapshot-metric-grid">
        <MetricCard title={t('adminSnapshots.healthy')} value={overview.healthTotals.healthy} note={t('adminSnapshots.healthyNote', { count: overview.totals.completed })} icon={<Rocket size={18} />} tone="calm" />
        <MetricCard title={t('adminSnapshots.inProgress')} value={overview.healthTotals.inProgress} note={t('adminSnapshots.inProgressNote', { count: overview.totals.queued + overview.totals.running })} icon={<Activity size={18} />} tone="neutral" />
        <MetricCard title={t('adminSnapshots.retryReady')} value={overview.healthTotals.retryReady} note={t('adminSnapshots.retryReadyNote')} icon={<RefreshCcw size={18} />} tone="accent" />
        <MetricCard title={t('adminSnapshots.stuck')} value={overview.healthTotals.stuck} note={t('adminSnapshots.stuckNote')} icon={<Clock3 size={18} />} tone="danger" />
      </section>

      <section className="two-up-grid">
        <article className="panel">
          <div className="panel-heading">
            <div>
              <div className="eyebrow">{t('adminSnapshots.latestPointers')}</div>
              <h3>{t('adminSnapshots.runTransitions')}</h3>
            </div>
          </div>
          <div className="key-grid">
            <KeyValue label={t('adminSnapshots.latestCompleted')} value={overview.latest.completedSnapshotRunId ?? t('adminSnapshots.noCompletedRun')} />
            <KeyValue label={t('adminSnapshots.latestFailed')} value={overview.latest.failedSnapshotRunId ?? t('adminSnapshots.noFailedRun')} />
            <KeyValue label={t('adminSnapshots.latestInProgress')} value={overview.latest.inProgressSnapshotRunId ?? t('adminSnapshots.noActiveRun')} />
            <KeyValue label={t('adminSnapshots.latestStuck')} value={overview.latest.stuckSnapshotRunId ?? t('adminSnapshots.noStuckRun')} />
          </div>
        </article>

        <article className="panel">
          <div className="panel-heading">
            <div>
              <div className="eyebrow">{t('adminSnapshots.healthReading')}</div>
              <h3>{t('adminSnapshots.runStateBalance')}</h3>
            </div>
          </div>
          <StatusBar label={t('adminSnapshots.healthy')} value={overview.healthTotals.healthy} total={overview.totals.all} tone="calm" />
          <StatusBar label={t('adminSnapshots.inProgress')} value={overview.healthTotals.inProgress} total={overview.totals.all} tone="neutral" />
          <StatusBar label={t('adminSnapshots.retryReady')} value={overview.healthTotals.retryReady} total={overview.totals.all} tone="accent" />
          <StatusBar label={t('adminSnapshots.stuck')} value={overview.healthTotals.stuck} total={overview.totals.all} tone="danger" />
        </article>
      </section>

      <section className="panel">
        <div className="panel-heading panel-heading-spread">
          <div>
            <div className="eyebrow">{t('adminSnapshots.actionQueueEyebrow')}</div>
            <h3>{t('adminSnapshots.actionQueueTitle')}</h3>
            <p className="panel-copy">{t('adminSnapshots.actionQueueCopy')}</p>
          </div>
          <ReportingToolbar
            sortValue={sortBy}
            onSortChange={(value) =>
              dispatchPageState({ type: 'setSortBy', value: value as SnapshotSortValue })
            }
            sortOptions={[
              { value: 'priority', label: t('adminSnapshots.sort.priority') },
              { value: 'generated-desc', label: t('adminSnapshots.sort.generatedDesc') },
              { value: 'reruns', label: t('adminSnapshots.sort.reruns') },
              { value: 'type', label: t('adminSnapshots.sort.type') },
            ]}
            sortAriaLabel={t('adminSnapshots.sortRows')}
            exportLabel={t('adminSnapshots.exportCsv')}
            onExport={() =>
              downloadCsv({
                filename: 'snapshot-needs-action.csv',
                columns: ['snapshotRunId', 'snapshotType', 'runStatus', 'healthState', 'generatedAt', 'periodStart', 'periodEnd', 'rerunCount', 'actionReason', 'recommendedAction'],
                rows: sortedItems.map((item) => [
                  item.snapshotRunId,
                  item.snapshotType,
                  item.runStatus,
                  item.healthState,
                  item.generatedAt,
                  item.periodStart,
                  item.periodEnd,
                  item.rerunCount,
                  item.actionReason,
                  item.recommendedAction,
                ]),
              })
            }
          >
            <label className="search-field">
              <span className="sr-only">{t('adminSnapshots.filterQueue')}</span>
              <input
                value={search}
                onChange={(event) =>
                  dispatchPageState({ type: 'setSearch', value: event.target.value })
                }
                placeholder={t('adminSnapshots.searchPlaceholder')}
              />
            </label>
          </ReportingToolbar>
        </div>

        <div className="toolbar-cluster">
          <label className="control-select">
            <span className="sr-only">{t('adminSnapshots.filterSnapshotType')}</span>
            <select
              value={snapshotTypeFilter}
              onChange={(event) =>
                dispatchPageState({
                  type: 'setSnapshotTypeFilter',
                  value: event.target.value as SnapshotTypeFilter,
                })
              }
            >
              <option value="">{t('adminSnapshots.allSnapshotTypes')}</option>
              {snapshotTypes.map((type) => (
                <option key={type} value={type}>
                  {formatSnapshotType(type, t)}
                </option>
              ))}
            </select>
          </label>
          <label className="control-select">
            <span className="sr-only">{t('adminSnapshots.filterRunStatus')}</span>
            <select
              value={runStatusFilter}
              onChange={(event) =>
                dispatchPageState({
                  type: 'setRunStatusFilter',
                  value: event.target.value as SnapshotRunStatusFilter,
                })
              }
            >
              <option value="">{t('adminSnapshots.allRunStatuses')}</option>
              {runStatuses.map((status) => (
                <option key={status} value={status}>
                  {formatSnapshotState(status, t)}
                </option>
              ))}
            </select>
          </label>
          <button
            className="control-button"
            type="button"
            onClick={() => dispatchPageState({ type: 'clearFilters' })}
          >
            {t('adminSnapshots.clearFilters')}
          </button>
        </div>

        {sortedItems.length === 0 ? (
          <EmptyState
            title={t('adminSnapshots.emptyQueueTitle')}
            copy={t('adminSnapshots.emptyQueueCopy')}
          />
        ) : (
          <div className="queue-list">
            {sortedItems.map((item) => (
              <div className="queue-row" key={item.snapshotRunId}>
                <Link to={`/admin/snapshots/${item.snapshotRunId}`}>
                  <div className="queue-row-head">
                    <div>
                      <div className="queue-title">
                        {t('adminSnapshots.snapshotTitle', { type: formatSnapshotType(item.snapshotType, t) })}
                      </div>
                      <div className="queue-subtitle">{item.snapshotRunId}</div>
                    </div>
                    <StatusPill tone={mapHealthTone(item.healthState)}>{formatSnapshotState(item.healthState, t)}</StatusPill>
                  </div>

                  <p className="queue-reason">{item.actionReason}</p>

                  <div className="queue-meta">
                    <span>{formatSnapshotState(item.runStatus, t)}</span>
                    <span>{`${formatDate(item.periodStart, locale)} - ${formatDate(item.periodEnd, locale)}`}</span>
                    <span>{t('adminSnapshots.reruns', { count: item.rerunCount })}</span>
                    {item.latestRerunSnapshotRunId ? (
                      <span>{t('adminSnapshots.latestRerun', { id: item.latestRerunSnapshotRunId })}</span>
                    ) : null}
                  </div>

                  <div className="queue-footer">
                    <span>{item.recommendedAction}</span>
                    <ArrowRight size={16} />
                  </div>
                </Link>
                {item.canRerun ? (
                  <div className="action-cluster">
                    <button
                      className="control-button"
                      type="button"
                      onClick={() => rerunMutation.mutate(item.snapshotRunId)}
                      disabled={rerunMutation.isPending}
                    >
                      {rerunMutation.isPending ? t('adminSnapshots.rerunning') : t('adminSnapshots.rerunSnapshot')}
                    </button>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )}

        <div className="toolbar-cluster">
          <button
            className="control-button"
            type="button"
            onClick={() => dispatchPageState({ type: 'previousPage' })}
            disabled={!canGoBack}
          >
            {t('adminSnapshots.previous')}
          </button>
          <span className="inline-state inline-state-neutral">
            {meta ? `${offset + 1}-${Math.min(offset + PAGE_SIZE, meta.total)} / ${meta.total}` : t('adminSnapshots.zeroResults')}
          </span>
          <button
            className="control-button"
            type="button"
            onClick={() => dispatchPageState({ type: 'nextPage' })}
            disabled={!canGoForward}
          >
            {t('adminSnapshots.next')}
          </button>
        </div>
      </section>
    </section>
  )
}
