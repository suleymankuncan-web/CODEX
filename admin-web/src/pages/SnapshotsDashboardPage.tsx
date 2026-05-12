import { useDeferredValue, useMemo, useReducer, type Dispatch } from 'react'
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
  type DailyClosureStatus,
  type SnapshotNeedsActionItem,
  type SnapshotOverview,
} from '../features/snapshots/api'
import type { TranslateFunction } from '../features/localization/dictionary'
import { useLocalization } from '../features/localization/useLocalization'
import { formatDate, getErrorMessage, mapHealthTone } from '../lib/format'
import type { AppLocale } from '../lib/i18n'

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
      <SnapshotsHero overview={overview} t={t} />
      <SnapshotFeedbackPanel feedback={feedback} />
      <DailyClosurePanels
        dailyClosure={dailyClosure}
        isQueuing={dailyClosureMutation.isPending}
        locale={locale}
        onQueue={() => dailyClosureMutation.mutate()}
        t={t}
      />
      <SnapshotHealthMetricGrid overview={overview} t={t} />
      <SnapshotHealthSummaryPanels overview={overview} t={t} />
      <SnapshotActionQueuePanel
        dispatchPageState={dispatchPageState}
        filters={{ search, snapshotTypeFilter, runStatusFilter }}
        isRerunning={rerunMutation.isPending}
        locale={locale}
        meta={meta}
        offset={offset}
        pagination={{ canGoBack, canGoForward }}
        sortedItems={sortedItems}
        sortBy={sortBy}
        onRerun={(snapshotRunId) => rerunMutation.mutate(snapshotRunId)}
        t={t}
      />
    </section>
  )
}

type SnapshotNeedsActionMeta = {
  total: number
}

function SnapshotsHero(input: { overview: SnapshotOverview; t: TranslateFunction }) {
  return (
    <section className="hero-panel">
      <div>
        <div className="eyebrow">{input.t('adminSnapshots.heroEyebrow')}</div>
        <h2 className="hero-title">{input.t('adminSnapshots.heroTitle')}</h2>
        <p className="hero-copy">{input.t('adminSnapshots.heroCopy')}</p>
      </div>
      <div className="hero-metrics">
        <MetricAccent label={input.t('adminSnapshots.allRuns')} value={String(input.overview.totals.all)} />
        <MetricAccent
          label={input.t('adminSnapshots.inProgress')}
          value={String(input.overview.healthTotals.inProgress)}
        />
        <MetricAccent
          label={input.t('adminSnapshots.retryReady')}
          value={String(input.overview.healthTotals.retryReady)}
        />
      </div>
    </section>
  )
}

function SnapshotFeedbackPanel(input: { feedback: string | null }) {
  return input.feedback ? (
    <section className="panel">
      <div className="inline-state inline-state-accent">{input.feedback}</div>
    </section>
  ) : null
}

function DailyClosurePanels(input: {
  dailyClosure: DailyClosureStatus
  isQueuing: boolean
  locale: AppLocale
  onQueue: () => void
  t: TranslateFunction
}) {
  return (
    <section className="two-up-grid">
      <article className="panel">
        <div className="panel-heading panel-heading-spread">
          <div>
            <div className="eyebrow">{input.t('adminSnapshots.dailyClosureEyebrow')}</div>
            <h3>{input.t('adminSnapshots.dailyClosureTitle')}</h3>
            <p className="panel-copy">{input.t('adminSnapshots.dailyClosureCopy')}</p>
          </div>
          <StatusPill tone={mapHealthTone(input.dailyClosure.healthState)}>
            {formatSnapshotState(input.dailyClosure.healthState, input.t)}
          </StatusPill>
        </div>
        <div className="key-grid">
          <KeyValue
            label={input.t('adminSnapshots.closureDate')}
            value={formatDate(input.dailyClosure.closureDate, input.locale)}
          />
          <KeyValue
            label={input.t('adminSnapshots.localDate')}
            value={formatDate(input.dailyClosure.localDate, input.locale)}
          />
          <KeyValue label={input.t('adminSnapshots.timezone')} value={input.dailyClosure.timezone} />
          <KeyValue
            label={input.t('adminSnapshots.existingRun')}
            value={input.dailyClosure.existingSnapshotRunId ?? input.t('adminSnapshots.noRunYet')}
          />
          <KeyValue
            label={input.t('adminSnapshots.automation')}
            value={
              input.dailyClosure.automationEnabled
                ? input.t('adminSnapshots.enabled')
                : input.t('adminSnapshots.disabled')
            }
          />
          <KeyValue
            label={input.t('adminSnapshots.pollCadence')}
            value={input.t('adminSnapshots.minutes', {
              count: input.dailyClosure.automationPollMinutes,
            })}
          />
        </div>
        <p className="queue-reason">{input.dailyClosure.recommendedAction}</p>
        {input.dailyClosure.existingFailureReason ? (
          <div className="inline-state inline-state-danger">
            {input.dailyClosure.existingFailureReason}
          </div>
        ) : null}
        <div className="toolbar-cluster">
          <button
            className="control-button"
            type="button"
            onClick={input.onQueue}
            disabled={!input.dailyClosure.canQueue || input.isQueuing}
          >
            {input.isQueuing
              ? input.t('adminSnapshots.queuing')
              : input.t('adminSnapshots.queueDailyClosure')}
          </button>
          {input.dailyClosure.existingSnapshotRunId ? (
            <Link className="back-link" to={`/admin/snapshots/${input.dailyClosure.existingSnapshotRunId}`}>
              <span>{input.t('adminSnapshots.openSnapshotRun')}</span>
            </Link>
          ) : null}
        </div>
      </article>

      <article className="panel">
        <div className="panel-heading">
          <div>
            <div className="eyebrow">{input.t('adminSnapshots.closureRuleEyebrow')}</div>
            <h3>{input.t('adminSnapshots.closureRuleTitle')}</h3>
          </div>
        </div>
        <div className="key-grid">
          <KeyValue
            label={input.t('adminSnapshots.sourceModel')}
            value={input.t('adminSnapshots.sourceModelValue')}
          />
          <KeyValue
            label={input.t('adminSnapshots.automaticTarget')}
            value={input.t('adminSnapshots.automaticTargetValue')}
          />
          <KeyValue
            label={input.t('adminSnapshots.queueBehavior')}
            value={
              input.dailyClosure.canQueue
                ? input.t('adminSnapshots.readyToQueue')
                : input.t('adminSnapshots.waitingOrClosed')
            }
          />
          <KeyValue
            label={input.t('adminSnapshots.retryPath')}
            value={
              input.dailyClosure.canRerun
                ? input.t('adminSnapshots.useRerunOnFailed')
                : input.t('adminSnapshots.notNeeded')
            }
          />
        </div>
      </article>
    </section>
  )
}

function SnapshotHealthMetricGrid(input: { overview: SnapshotOverview; t: TranslateFunction }) {
  return (
    <section className="metric-grid snapshot-metric-grid">
      <MetricCard
        title={input.t('adminSnapshots.healthy')}
        value={input.overview.healthTotals.healthy}
        note={input.t('adminSnapshots.healthyNote', { count: input.overview.totals.completed })}
        icon={<Rocket size={18} />}
        tone="calm"
      />
      <MetricCard
        title={input.t('adminSnapshots.inProgress')}
        value={input.overview.healthTotals.inProgress}
        note={input.t('adminSnapshots.inProgressNote', {
          count: input.overview.totals.queued + input.overview.totals.running,
        })}
        icon={<Activity size={18} />}
        tone="neutral"
      />
      <MetricCard
        title={input.t('adminSnapshots.retryReady')}
        value={input.overview.healthTotals.retryReady}
        note={input.t('adminSnapshots.retryReadyNote')}
        icon={<RefreshCcw size={18} />}
        tone="accent"
      />
      <MetricCard
        title={input.t('adminSnapshots.stuck')}
        value={input.overview.healthTotals.stuck}
        note={input.t('adminSnapshots.stuckNote')}
        icon={<Clock3 size={18} />}
        tone="danger"
      />
    </section>
  )
}

function SnapshotHealthSummaryPanels(input: { overview: SnapshotOverview; t: TranslateFunction }) {
  return (
    <section className="two-up-grid">
      <article className="panel">
        <div className="panel-heading">
          <div>
            <div className="eyebrow">{input.t('adminSnapshots.latestPointers')}</div>
            <h3>{input.t('adminSnapshots.runTransitions')}</h3>
          </div>
        </div>
        <div className="key-grid">
          <KeyValue
            label={input.t('adminSnapshots.latestCompleted')}
            value={input.overview.latest.completedSnapshotRunId ?? input.t('adminSnapshots.noCompletedRun')}
          />
          <KeyValue
            label={input.t('adminSnapshots.latestFailed')}
            value={input.overview.latest.failedSnapshotRunId ?? input.t('adminSnapshots.noFailedRun')}
          />
          <KeyValue
            label={input.t('adminSnapshots.latestInProgress')}
            value={input.overview.latest.inProgressSnapshotRunId ?? input.t('adminSnapshots.noActiveRun')}
          />
          <KeyValue
            label={input.t('adminSnapshots.latestStuck')}
            value={input.overview.latest.stuckSnapshotRunId ?? input.t('adminSnapshots.noStuckRun')}
          />
        </div>
      </article>

      <article className="panel">
        <div className="panel-heading">
          <div>
            <div className="eyebrow">{input.t('adminSnapshots.healthReading')}</div>
            <h3>{input.t('adminSnapshots.runStateBalance')}</h3>
          </div>
        </div>
        <StatusBar
          label={input.t('adminSnapshots.healthy')}
          value={input.overview.healthTotals.healthy}
          total={input.overview.totals.all}
          tone="calm"
        />
        <StatusBar
          label={input.t('adminSnapshots.inProgress')}
          value={input.overview.healthTotals.inProgress}
          total={input.overview.totals.all}
          tone="neutral"
        />
        <StatusBar
          label={input.t('adminSnapshots.retryReady')}
          value={input.overview.healthTotals.retryReady}
          total={input.overview.totals.all}
          tone="accent"
        />
        <StatusBar
          label={input.t('adminSnapshots.stuck')}
          value={input.overview.healthTotals.stuck}
          total={input.overview.totals.all}
          tone="danger"
        />
      </article>
    </section>
  )
}

function SnapshotActionQueuePanel(input: {
  dispatchPageState: Dispatch<SnapshotsDashboardPageAction>
  filters: {
    search: string
    snapshotTypeFilter: SnapshotTypeFilter
    runStatusFilter: SnapshotRunStatusFilter
  }
  isRerunning: boolean
  locale: AppLocale
  meta: SnapshotNeedsActionMeta | undefined
  offset: number
  onRerun: (snapshotRunId: string) => void
  pagination: {
    canGoBack: boolean
    canGoForward: boolean
  }
  sortedItems: SnapshotNeedsActionItem[]
  sortBy: SnapshotSortValue
  t: TranslateFunction
}) {
  return (
    <section className="panel">
      <div className="panel-heading panel-heading-spread">
        <div>
          <div className="eyebrow">{input.t('adminSnapshots.actionQueueEyebrow')}</div>
          <h3>{input.t('adminSnapshots.actionQueueTitle')}</h3>
          <p className="panel-copy">{input.t('adminSnapshots.actionQueueCopy')}</p>
        </div>
        <ReportingToolbar
          sortValue={input.sortBy}
          onSortChange={(value) =>
            input.dispatchPageState({ type: 'setSortBy', value: value as SnapshotSortValue })
          }
          sortOptions={[
            { value: 'priority', label: input.t('adminSnapshots.sort.priority') },
            { value: 'generated-desc', label: input.t('adminSnapshots.sort.generatedDesc') },
            { value: 'reruns', label: input.t('adminSnapshots.sort.reruns') },
            { value: 'type', label: input.t('adminSnapshots.sort.type') },
          ]}
          sortAriaLabel={input.t('adminSnapshots.sortRows')}
          exportLabel={input.t('adminSnapshots.exportCsv')}
          onExport={() =>
            downloadCsv({
              filename: 'snapshot-needs-action.csv',
              columns: [
                'snapshotRunId',
                'snapshotType',
                'runStatus',
                'healthState',
                'generatedAt',
                'periodStart',
                'periodEnd',
                'rerunCount',
                'actionReason',
                'recommendedAction',
              ],
              rows: input.sortedItems.map((item) => [
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
            <span className="sr-only">{input.t('adminSnapshots.filterQueue')}</span>
            <input
              value={input.filters.search}
              onChange={(event) =>
                input.dispatchPageState({ type: 'setSearch', value: event.target.value })
              }
              placeholder={input.t('adminSnapshots.searchPlaceholder')}
            />
          </label>
        </ReportingToolbar>
      </div>

      <SnapshotQueueFilters
        dispatchPageState={input.dispatchPageState}
        runStatusFilter={input.filters.runStatusFilter}
        snapshotTypeFilter={input.filters.snapshotTypeFilter}
        t={input.t}
      />

      {input.sortedItems.length === 0 ? (
        <EmptyState
          title={input.t('adminSnapshots.emptyQueueTitle')}
          copy={input.t('adminSnapshots.emptyQueueCopy')}
        />
      ) : (
        <div className="queue-list">
          {input.sortedItems.map((item) => (
            <SnapshotActionQueueRow
              isRerunning={input.isRerunning}
              item={item}
              key={item.snapshotRunId}
              locale={input.locale}
              onRerun={input.onRerun}
              t={input.t}
            />
          ))}
        </div>
      )}

      <SnapshotQueuePagination
        dispatchPageState={input.dispatchPageState}
        meta={input.meta}
        offset={input.offset}
        pagination={input.pagination}
        t={input.t}
      />
    </section>
  )
}

function SnapshotQueueFilters(input: {
  dispatchPageState: Dispatch<SnapshotsDashboardPageAction>
  runStatusFilter: SnapshotRunStatusFilter
  snapshotTypeFilter: SnapshotTypeFilter
  t: TranslateFunction
}) {
  return (
    <div className="toolbar-cluster">
      <label className="control-select">
        <span className="sr-only">{input.t('adminSnapshots.filterSnapshotType')}</span>
        <select
          value={input.snapshotTypeFilter}
          onChange={(event) =>
            input.dispatchPageState({
              type: 'setSnapshotTypeFilter',
              value: event.target.value as SnapshotTypeFilter,
            })
          }
        >
          <option value="">{input.t('adminSnapshots.allSnapshotTypes')}</option>
          {snapshotTypes.map((type) => (
            <option key={type} value={type}>
              {formatSnapshotType(type, input.t)}
            </option>
          ))}
        </select>
      </label>
      <label className="control-select">
        <span className="sr-only">{input.t('adminSnapshots.filterRunStatus')}</span>
        <select
          value={input.runStatusFilter}
          onChange={(event) =>
            input.dispatchPageState({
              type: 'setRunStatusFilter',
              value: event.target.value as SnapshotRunStatusFilter,
            })
          }
        >
          <option value="">{input.t('adminSnapshots.allRunStatuses')}</option>
          {runStatuses.map((status) => (
            <option key={status} value={status}>
              {formatSnapshotState(status, input.t)}
            </option>
          ))}
        </select>
      </label>
      <button
        className="control-button"
        type="button"
        onClick={() => input.dispatchPageState({ type: 'clearFilters' })}
      >
        {input.t('adminSnapshots.clearFilters')}
      </button>
    </div>
  )
}

function SnapshotActionQueueRow(input: {
  isRerunning: boolean
  item: SnapshotNeedsActionItem
  locale: AppLocale
  onRerun: (snapshotRunId: string) => void
  t: TranslateFunction
}) {
  return (
    <div className="queue-row">
      <Link to={`/admin/snapshots/${input.item.snapshotRunId}`}>
        <div className="queue-row-head">
          <div>
            <div className="queue-title">
              {input.t('adminSnapshots.snapshotTitle', {
                type: formatSnapshotType(input.item.snapshotType, input.t),
              })}
            </div>
            <div className="queue-subtitle">{input.item.snapshotRunId}</div>
          </div>
          <StatusPill tone={mapHealthTone(input.item.healthState)}>
            {formatSnapshotState(input.item.healthState, input.t)}
          </StatusPill>
        </div>

        <p className="queue-reason">{input.item.actionReason}</p>

        <div className="queue-meta">
          <span>{formatSnapshotState(input.item.runStatus, input.t)}</span>
          <span>{`${formatDate(input.item.periodStart, input.locale)} - ${formatDate(input.item.periodEnd, input.locale)}`}</span>
          <span>{input.t('adminSnapshots.reruns', { count: input.item.rerunCount })}</span>
          {input.item.latestRerunSnapshotRunId ? (
            <span>
              {input.t('adminSnapshots.latestRerun', { id: input.item.latestRerunSnapshotRunId })}
            </span>
          ) : null}
        </div>

        <div className="queue-footer">
          <span>{input.item.recommendedAction}</span>
          <ArrowRight size={16} />
        </div>
      </Link>
      {input.item.canRerun ? (
        <div className="action-cluster">
          <button
            className="control-button"
            type="button"
            onClick={() => input.onRerun(input.item.snapshotRunId)}
            disabled={input.isRerunning}
          >
            {input.isRerunning
              ? input.t('adminSnapshots.rerunning')
              : input.t('adminSnapshots.rerunSnapshot')}
          </button>
        </div>
      ) : null}
    </div>
  )
}

function SnapshotQueuePagination(input: {
  dispatchPageState: Dispatch<SnapshotsDashboardPageAction>
  meta: SnapshotNeedsActionMeta | undefined
  offset: number
  pagination: {
    canGoBack: boolean
    canGoForward: boolean
  }
  t: TranslateFunction
}) {
  return (
    <div className="toolbar-cluster">
      <button
        className="control-button"
        type="button"
        onClick={() => input.dispatchPageState({ type: 'previousPage' })}
        disabled={!input.pagination.canGoBack}
      >
        {input.t('adminSnapshots.previous')}
      </button>
      <span className="inline-state inline-state-neutral">
        {input.meta
          ? `${input.offset + 1}-${Math.min(input.offset + PAGE_SIZE, input.meta.total)} / ${input.meta.total}`
          : input.t('adminSnapshots.zeroResults')}
      </span>
      <button
        className="control-button"
        type="button"
        onClick={() => input.dispatchPageState({ type: 'nextPage' })}
        disabled={!input.pagination.canGoForward}
      >
        {input.t('adminSnapshots.next')}
      </button>
    </div>
  )
}
