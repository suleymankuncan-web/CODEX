import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Clock3, GitBranch, RefreshCcw, Sparkles } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import {
  EmptyState,
  MetricAccent,
  ScreenState,
  StatusBar,
  StatusPill,
} from '../components/dashboard-primitives'
import { downloadCsv } from '../lib/download-csv'
import {
  getSnapshotRunAudit,
  getSnapshotRunDependencies,
  getSnapshotRunDetail,
  getSnapshotRunLineage,
  rerunSnapshotRun,
} from '../features/snapshots/api'
import { formatDate, formatDateTime, formatState, getErrorMessage, mapHealthTone } from '../lib/format'

export function SnapshotRunDetailPage() {
  const params = useParams()
  const snapshotRunId = params.snapshotRunId ?? ''
  const [feedback, setFeedback] = useState<string | null>(null)
  const queryClient = useQueryClient()

  const detailQuery = useQuery({
    queryKey: ['snapshot-run-detail', snapshotRunId],
    queryFn: () => getSnapshotRunDetail(snapshotRunId),
    enabled: Boolean(snapshotRunId),
  })
  const dependenciesQuery = useQuery({
    queryKey: ['snapshot-run-dependencies', snapshotRunId],
    queryFn: () => getSnapshotRunDependencies(snapshotRunId),
    enabled: Boolean(snapshotRunId),
  })
  const lineageQuery = useQuery({
    queryKey: ['snapshot-run-lineage', snapshotRunId],
    queryFn: () => getSnapshotRunLineage(snapshotRunId),
    enabled: Boolean(snapshotRunId),
  })
  const auditQuery = useQuery({
    queryKey: ['snapshot-run-audit', snapshotRunId],
    queryFn: () => getSnapshotRunAudit(snapshotRunId),
    enabled: Boolean(snapshotRunId),
  })
  const rerunMutation = useMutation({
    mutationFn: rerunSnapshotRun,
    onSuccess: async (response) => {
      setFeedback(response.command.message)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['snapshot-run-detail', snapshotRunId] }),
        queryClient.invalidateQueries({ queryKey: ['snapshot-run-dependencies', snapshotRunId] }),
        queryClient.invalidateQueries({ queryKey: ['snapshot-run-lineage', snapshotRunId] }),
        queryClient.invalidateQueries({ queryKey: ['snapshot-run-audit', snapshotRunId] }),
        queryClient.invalidateQueries({ queryKey: ['snapshot-needs-action'] }),
        queryClient.invalidateQueries({ queryKey: ['snapshot-overview'] }),
      ])
    },
  })

  if (!snapshotRunId) {
    return <ScreenState title="Snapshot run id missing" copy="Open this screen from the snapshot queue or overview." />
  }

  if (detailQuery.isLoading) {
    return <ScreenState title="Loading snapshot run" copy="Pulling cards, rerun governance, lineage, and audit context." />
  }

  if (detailQuery.isError || !detailQuery.data) {
    return <ScreenState title="Snapshot run unavailable" copy={getErrorMessage(detailQuery.error)} tone="error" />
  }

  const detail = detailQuery.data
  const dependencies = dependenciesQuery.data
  const lineage = lineageQuery.data
  const auditItems = auditQuery.data?.items ?? []
  const totalRows =
    detail.cards.workforceRows +
    detail.cards.kpiRows +
    detail.cards.checklistRows +
    detail.cards.turnoverRows

  return (
    <section className="page-stack">
      <Link className="back-link" to="/admin/snapshots">
        <ArrowLeft size={16} />
        Back to snapshot operations
      </Link>

      <section className="hero-panel hero-panel-detail">
        <div>
          <div className="eyebrow">Snapshot Run Detail</div>
          <h2 className="hero-title">{detail.snapshotRun.snapshotType} snapshot run</h2>
          <p className="hero-copy">
            Run <code>{detail.snapshotRun.snapshotRunId}</code> with health state{' '}
            <span className={`inline-state inline-state-${mapHealthTone(detail.snapshotRun.healthState)}`}>
              {formatState(detail.snapshotRun.healthState)}
            </span>
          </p>
        </div>
        <div className="hero-metrics">
          <MetricAccent label="Total report rows" value={String(totalRows)} />
          <MetricAccent label="Can rerun" value={detail.canRerun ? 'Yes' : 'No'} />
          <MetricAccent label="Rerun allowed" value={detail.rerunAllowed ? 'Yes' : 'No'} />
          <MetricAccent
            label="KPI config"
            value={formatSnapshotKpiConfigVersion(detail.snapshotRun.kpiConfigVersion)}
          />
        </div>
      </section>

      {feedback ? (
        <section className="panel">
          <div className="inline-state inline-state-accent">{feedback}</div>
        </section>
      ) : null}

      <section className="two-up-grid">
        <article className="panel">
          <div className="panel-heading">
            <div>
              <div className="eyebrow">Execution state</div>
              <h3>Run summary</h3>
            </div>
          </div>
          <div className="detail-list">
            {[
              ['Run status', detail.snapshotRun.runStatus],
              ['Health state', detail.snapshotRun.healthState],
              ['Period', `${formatDate(detail.snapshotRun.periodStart)} -> ${formatDate(detail.snapshotRun.periodEnd)}`],
              ['KPI config version', formatSnapshotKpiConfigVersion(detail.snapshotRun.kpiConfigVersion)],
              ['Generated at', formatDateTime(detail.snapshotRun.generatedAt)],
              ['Started at', detail.snapshotRun.startedAt ? formatDateTime(detail.snapshotRun.startedAt) : 'Not started'],
              ['Finished at', detail.snapshotRun.finishedAt ? formatDateTime(detail.snapshotRun.finishedAt) : 'Not finished'],
            ].map(([label, value]) => (
              <div className="detail-row" key={label}>
                <span>{label}</span>
                <strong>{value}</strong>
              </div>
            ))}
          </div>
        </article>

        <article className="panel">
          <div className="panel-heading">
            <div>
              <div className="eyebrow">Rerun governance</div>
              <h3>Dependencies and checks</h3>
            </div>
            <div className="toolbar-cluster">
              <button
                className="control-button"
                type="button"
                onClick={() => rerunMutation.mutate(snapshotRunId)}
                disabled={!detail.canRerun || rerunMutation.isPending}
              >
                {rerunMutation.isPending ? 'Rerunning...' : 'Rerun snapshot'}
              </button>
              <button
                className="control-button"
                type="button"
                onClick={() =>
                  downloadCsv({
                    filename: `snapshot-dependency-checks-${snapshotRunId}.csv`,
                    columns: ['code', 'status', 'message'],
                    rows: (dependencies?.checks ?? []).map((check) => [
                      check.code,
                      check.status,
                      check.message,
                    ]),
                  })
                }
                disabled={!dependencies?.checks.length}
              >
                Export checks
              </button>
            </div>
          </div>
          {dependencies ? (
            <div className="stacked-table">
              {dependencies.checks.map((check) => (
                <div className="stacked-row" key={check.code}>
                  <div className="stacked-row-head">
                    <strong>{check.code}</strong>
                    <StatusPill tone={check.status === 'pass' ? 'calm' : 'danger'}>
                      {check.status}
                    </StatusPill>
                  </div>
                  <p>{check.message}</p>
                </div>
              ))}
              {dependencies.rerunBlockedReason ? (
                <div className="empty-card">
                  <strong>Rerun blocked</strong>
                  <p>{dependencies.rerunBlockedReason}</p>
                </div>
              ) : null}
            </div>
          ) : (
            <EmptyState copy="Dependency checks are still loading." />
          )}
        </article>
      </section>

      <section className="two-up-grid">
        <article className="panel">
          <div className="panel-heading">
            <div>
              <div className="eyebrow">Output volume</div>
              <h3>Materialized report slices</h3>
            </div>
          </div>
          <StatusBar label="Workforce rows" value={detail.cards.workforceRows} total={Math.max(totalRows, 1)} tone="calm" />
          <StatusBar label="KPI rows" value={detail.cards.kpiRows} total={Math.max(totalRows, 1)} tone="accent" />
          <StatusBar label="Checklist rows" value={detail.cards.checklistRows} total={Math.max(totalRows, 1)} tone="warning" />
          <StatusBar label="Turnover rows" value={detail.cards.turnoverRows} total={Math.max(totalRows, 1)} tone="danger" />
        </article>

        <article className="panel">
          <div className="panel-heading">
            <div>
              <div className="eyebrow">Lineage</div>
              <h3>Parent and children</h3>
            </div>
          </div>
          {lineage ? (
            <div className="stacked-table">
              <div className="stacked-row">
                <div className="stacked-row-head">
                  <strong>Parent</strong>
                  <GitBranch size={16} />
                </div>
                <p>
                  {lineage.parent
                    ? `${lineage.parent.snapshotType} · ${lineage.parent.runStatus} · ${lineage.parent.snapshotRunId}`
                    : 'No parent run'}
                </p>
              </div>
              <div className="stacked-row">
                <div className="stacked-row-head">
                  <strong>Children</strong>
                  <Sparkles size={16} />
                </div>
                {lineage.children.length ? (
                  <div className="queue-meta">
                    {lineage.children.map((child) => (
                      <span key={child.snapshotRunId}>
                        {child.snapshotType} · {child.runStatus} · {child.snapshotRunId}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p>No rerun children yet.</p>
                )}
              </div>
            </div>
          ) : (
            <EmptyState copy="Lineage data is still loading." />
          )}
        </article>
      </section>

      <section className="two-up-grid detail-bottom-grid">
        <article className="panel">
          <div className="panel-heading">
            <div>
              <div className="eyebrow">Failure posture</div>
              <h3>Reason and rerun state</h3>
            </div>
          </div>
          <div className="stacked-table">
            <div className="stacked-row">
              <div className="stacked-row-head">
                <strong>Failure reason</strong>
                <Clock3 size={16} />
              </div>
              <p>{detail.failureReason ?? 'No failure reason recorded'}</p>
            </div>
            <div className="stacked-row">
              <div className="stacked-row-head">
                <strong>Latest rerun</strong>
                <RefreshCcw size={16} />
              </div>
              <p>{detail.latestRerunSnapshotRunId ?? 'No rerun has been created yet'}</p>
              <span className="queue-subtitle">rerun count {detail.rerunCount}</span>
            </div>
          </div>
        </article>

        <article className="panel">
          <div className="panel-heading">
            <div>
              <div className="eyebrow">Audit timeline</div>
              <h3>Operator-visible trace</h3>
            </div>
            <button
              className="control-button"
              type="button"
              onClick={() =>
                downloadCsv({
                  filename: `snapshot-audit-${snapshotRunId}.csv`,
                  columns: ['eventLogId', 'occurredAt', 'actorUserId', 'correlationId', 'eventType'],
                  rows: auditItems.map((event) => [
                    event.eventLogId,
                    event.occurredAt,
                    event.actorUserId,
                    event.correlationId,
                    event.eventType,
                  ]),
                })
              }
              disabled={auditItems.length === 0}
            >
              Export audit
            </button>
          </div>
          {auditItems.length === 0 ? (
            <EmptyState copy="No audit entries returned yet." />
          ) : (
            <div className="timeline">
              {auditItems.map((event) => (
                <div className="timeline-item" key={event.eventLogId}>
                  <div className="timeline-dot" />
                  <div>
                    <strong>{event.eventType}</strong>
                    <p>{formatDateTime(event.occurredAt)}</p>
                    <span>actor {event.actorUserId ?? 'system'} · correlation {event.correlationId ?? 'n/a'}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </article>
      </section>
    </section>
  )
}

function formatSnapshotKpiConfigVersion(input: {
  versionNo: number | null
  state: 'versioned' | 'pre_governance'
} | null | undefined) {
  if (input?.state === 'versioned' && input.versionNo) {
    return `v${input.versionNo}`
  }

  return 'Pre-governance snapshot'
}
