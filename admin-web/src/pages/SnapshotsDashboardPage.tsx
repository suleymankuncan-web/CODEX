import { useDeferredValue, useMemo, useState } from 'react'
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
import { formatDate, formatState, getErrorMessage, mapHealthTone } from '../lib/format'

const PAGE_SIZE = 12

export function SnapshotsDashboardPage() {
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState<'priority' | 'generated-desc' | 'reruns' | 'type'>('priority')
  const [offset, setOffset] = useState(0)
  const [snapshotTypeFilter, setSnapshotTypeFilter] = useState('')
  const [runStatusFilter, setRunStatusFilter] = useState('')
  const [feedback, setFeedback] = useState<string | null>(null)
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
      setFeedback(response.command.message)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['snapshot-needs-action'] }),
        queryClient.invalidateQueries({ queryKey: ['snapshot-overview'] }),
      ])
    },
  })
  const dailyClosureMutation = useMutation({
    mutationFn: runDailyClosure,
    onSuccess: async (response) => {
      setFeedback(response.command.message)
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
        item.runStatus,
        item.healthState,
        item.actionReason,
        item.recommendedAction,
      ]
        .join(' ')
        .toLowerCase()
        .includes(input),
    )
  }, [deferredSearch, needsActionQuery.data?.items])

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
    return <ScreenState title="Loading snapshot operations" copy="Pulling run overview and rerun pressure." />
  }

  if (overviewQuery.isError) {
    return <ScreenState title="Snapshot overview unavailable" copy={getErrorMessage(overviewQuery.error)} tone="error" />
  }

  if (needsActionQuery.isError) {
    return <ScreenState title="Snapshot queue unavailable" copy={getErrorMessage(needsActionQuery.error)} tone="error" />
  }
  if (dailyClosureQuery.isError) {
    return <ScreenState title="Daily closure unavailable" copy={getErrorMessage(dailyClosureQuery.error)} tone="error" />
  }

  const overview = overviewQuery.data
  const dailyClosure = dailyClosureQuery.data
  if (!overview) {
    return <ScreenState title="Snapshot overview unavailable" copy="No overview payload was returned." tone="error" />
  }
  if (!dailyClosure) {
    return <ScreenState title="Daily closure unavailable" copy="No daily closure payload was returned." tone="error" />
  }

  const meta = needsActionQuery.data?.meta
  const canGoBack = offset > 0
  const canGoForward = meta ? offset + PAGE_SIZE < meta.total : false

  return (
    <section className="page-stack">
      <section className="hero-panel">
        <div>
          <div className="eyebrow">Snapshot Operations</div>
          <h2 className="hero-title">Immutable runs need visibility before they need reruns.</h2>
          <p className="hero-copy">
            This surface shows queue pressure, stuck runs, and rerun posture so operators can decide
            whether to wait, inspect, or request another immutable run.
          </p>
        </div>
        <div className="hero-metrics">
          <MetricAccent label="All runs" value={String(overview.totals.all)} />
          <MetricAccent label="In progress" value={String(overview.healthTotals.inProgress)} />
          <MetricAccent label="Retry ready" value={String(overview.healthTotals.retryReady)} />
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
              <div className="eyebrow">Daily closure</div>
              <h3>Yesterday should become immutable history</h3>
              <p className="panel-copy">
                Close the previous local day into an immutable snapshot before day/week/month historical reads depend on it.
              </p>
            </div>
            <StatusPill tone={mapHealthTone(dailyClosure.healthState)}>
              {formatState(dailyClosure.healthState)}
            </StatusPill>
          </div>
          <div className="key-grid">
            <KeyValue label="Closure date" value={formatDate(dailyClosure.closureDate)} />
            <KeyValue label="Local date" value={formatDate(dailyClosure.localDate)} />
            <KeyValue label="Timezone" value={dailyClosure.timezone} />
            <KeyValue label="Existing run" value={dailyClosure.existingSnapshotRunId ?? 'No run yet'} />
            <KeyValue label="Automation" value={dailyClosure.automationEnabled ? 'Enabled' : 'Disabled'} />
            <KeyValue label="Poll cadence" value={`${dailyClosure.automationPollMinutes} min`} />
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
              {dailyClosureMutation.isPending ? 'Queuing...' : 'Queue daily closure'}
            </button>
            {dailyClosure.existingSnapshotRunId ? (
              <Link className="back-link" to={`/admin/snapshots/${dailyClosure.existingSnapshotRunId}`}>
                <span>Open snapshot run</span>
              </Link>
            ) : null}
          </div>
        </article>

        <article className="panel">
          <div className="panel-heading">
            <div>
              <div className="eyebrow">Closure rule</div>
              <h3>What happens now</h3>
            </div>
          </div>
          <div className="key-grid">
            <KeyValue label="Source model" value="Live state + daily closed snapshot" />
            <KeyValue label="Automatic target" value="Yesterday in Europe/Istanbul" />
            <KeyValue label="Queue behavior" value={dailyClosure.canQueue ? 'Ready to queue' : 'Waiting / already closed'} />
            <KeyValue label="Retry path" value={dailyClosure.canRerun ? 'Use rerun on failed run' : 'Not needed'} />
          </div>
        </article>
      </section>

      <section className="metric-grid snapshot-metric-grid">
        <MetricCard title="Healthy" value={overview.healthTotals.healthy} note={`${overview.totals.completed} completed runs`} icon={<Rocket size={18} />} tone="calm" />
        <MetricCard title="In progress" value={overview.healthTotals.inProgress} note={`${overview.totals.queued + overview.totals.running} active queue items`} icon={<Activity size={18} />} tone="neutral" />
        <MetricCard title="Retry ready" value={overview.healthTotals.retryReady} note="Failed runs can likely be rerun" icon={<RefreshCcw size={18} />} tone="accent" />
        <MetricCard title="Stuck" value={overview.healthTotals.stuck} note="Exceeded snapshot threshold" icon={<Clock3 size={18} />} tone="danger" />
      </section>

      <section className="two-up-grid">
        <article className="panel">
          <div className="panel-heading">
            <div>
              <div className="eyebrow">Latest pointers</div>
              <h3>Run transitions</h3>
            </div>
          </div>
          <div className="key-grid">
            <KeyValue label="Latest completed" value={overview.latest.completedSnapshotRunId ?? 'No completed run yet'} />
            <KeyValue label="Latest failed" value={overview.latest.failedSnapshotRunId ?? 'No failed run yet'} />
            <KeyValue label="Latest in progress" value={overview.latest.inProgressSnapshotRunId ?? 'No active run'} />
            <KeyValue label="Latest stuck" value={overview.latest.stuckSnapshotRunId ?? 'No stuck run'} />
          </div>
        </article>

        <article className="panel">
          <div className="panel-heading">
            <div>
              <div className="eyebrow">Health reading</div>
              <h3>Run-state balance</h3>
            </div>
          </div>
          <StatusBar label="Healthy" value={overview.healthTotals.healthy} total={overview.totals.all} tone="calm" />
          <StatusBar label="In progress" value={overview.healthTotals.inProgress} total={overview.totals.all} tone="neutral" />
          <StatusBar label="Retry ready" value={overview.healthTotals.retryReady} total={overview.totals.all} tone="accent" />
          <StatusBar label="Stuck" value={overview.healthTotals.stuck} total={overview.totals.all} tone="danger" />
        </article>
      </section>

      <section className="panel">
        <div className="panel-heading panel-heading-spread">
          <div>
            <div className="eyebrow">Action queue</div>
            <h3>Runs needing operator attention</h3>
            <p className="panel-copy">
              Filter the queue by snapshot type or run status, then rerun safe candidates without leaving the dashboard.
            </p>
          </div>
          <ReportingToolbar
            sortValue={sortBy}
            onSortChange={(value) => setSortBy(value as typeof sortBy)}
            sortOptions={[
              { value: 'priority', label: 'Priority state' },
              { value: 'generated-desc', label: 'Newest first' },
              { value: 'reruns', label: 'Most reruns' },
              { value: 'type', label: 'Snapshot type' },
            ]}
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
              <span className="sr-only">Filter snapshot queue</span>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search by run, type, reason, or state"
              />
            </label>
          </ReportingToolbar>
        </div>

        <div className="toolbar-cluster">
          <label className="control-select">
            <span className="sr-only">Filter snapshot type</span>
            <select
              value={snapshotTypeFilter}
              onChange={(event) => {
                setOffset(0)
                setSnapshotTypeFilter(event.target.value)
              }}
            >
              <option value="">All snapshot types</option>
              {['daily', 'weekly', 'monthly', 'payroll', 'compliance'].map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </label>
          <label className="control-select">
            <span className="sr-only">Filter run status</span>
            <select
              value={runStatusFilter}
              onChange={(event) => {
                setOffset(0)
                setRunStatusFilter(event.target.value)
              }}
            >
              <option value="">All run statuses</option>
              {['queued', 'running', 'completed', 'failed'].map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </label>
          <button
            className="control-button"
            type="button"
            onClick={() => {
              setOffset(0)
              setSnapshotTypeFilter('')
              setRunStatusFilter('')
              setSearch('')
            }}
          >
            Clear filters
          </button>
        </div>

        {sortedItems.length === 0 ? (
          <EmptyState
            title="No snapshot runs matched your filter."
            copy="Clear the search to review the full needs-action queue."
          />
        ) : (
          <div className="queue-list">
            {sortedItems.map((item) => (
              <div className="queue-row" key={item.snapshotRunId}>
                <Link to={`/admin/snapshots/${item.snapshotRunId}`}>
                  <div className="queue-row-head">
                    <div>
                      <div className="queue-title">{item.snapshotType} snapshot</div>
                      <div className="queue-subtitle">{item.snapshotRunId}</div>
                    </div>
                    <StatusPill tone={mapHealthTone(item.healthState)}>{formatState(item.healthState)}</StatusPill>
                  </div>

                  <p className="queue-reason">{item.actionReason}</p>

                  <div className="queue-meta">
                    <span>{item.runStatus}</span>
                    <span>{`${formatDate(item.periodStart)} -> ${formatDate(item.periodEnd)}`}</span>
                    <span>reruns {item.rerunCount}</span>
                    {item.latestRerunSnapshotRunId ? (
                      <span>latest rerun {item.latestRerunSnapshotRunId}</span>
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
                      {rerunMutation.isPending ? 'Rerunning...' : 'Rerun snapshot'}
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
            onClick={() => setOffset((current) => Math.max(0, current - PAGE_SIZE))}
            disabled={!canGoBack}
          >
            Previous
          </button>
          <span className="inline-state inline-state-neutral">
            {meta ? `${offset + 1}-${Math.min(offset + PAGE_SIZE, meta.total)} / ${meta.total}` : '0 results'}
          </span>
          <button
            className="control-button"
            type="button"
            onClick={() => setOffset((current) => current + PAGE_SIZE)}
            disabled={!canGoForward}
          >
            Next
          </button>
        </div>
      </section>
    </section>
  )
}
