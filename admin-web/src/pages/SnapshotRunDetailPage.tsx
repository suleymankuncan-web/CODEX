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
import type { TranslateFunction } from '../features/localization/dictionary'
import { useLocalization } from '../features/localization/useLocalization'
import { formatDate, formatDateTime, getErrorMessage, mapHealthTone } from '../lib/format'

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

function formatCheckStatus(input: 'pass' | 'fail', t: TranslateFunction) {
  return input === 'pass' ? t('adminSnapshots.check.pass') : t('adminSnapshots.check.fail')
}

export function SnapshotRunDetailPage() {
  const { locale, t } = useLocalization()
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
    return <ScreenState title={t('adminSnapshots.detailMissingTitle')} copy={t('adminSnapshots.detailMissingCopy')} />
  }

  if (detailQuery.isLoading) {
    return <ScreenState title={t('adminSnapshots.detailLoadingTitle')} copy={t('adminSnapshots.detailLoadingCopy')} />
  }

  if (detailQuery.isError || !detailQuery.data) {
    return <ScreenState title={t('adminSnapshots.detailUnavailableTitle')} copy={getErrorMessage(detailQuery.error)} tone="error" />
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
        {t('adminSnapshots.backToOperations')}
      </Link>

      <section className="hero-panel hero-panel-detail">
        <div>
          <div className="eyebrow">{t('adminSnapshots.detailEyebrow')}</div>
          <h2 className="hero-title">
            {t('adminSnapshots.detailTitle', { type: formatSnapshotType(detail.snapshotRun.snapshotType, t) })}
          </h2>
          <p className="hero-copy">
            {t('adminSnapshots.detailCopy', {
              runId: detail.snapshotRun.snapshotRunId,
              state: formatSnapshotState(detail.snapshotRun.healthState, t),
            })}{' '}
            <span className={`inline-state inline-state-${mapHealthTone(detail.snapshotRun.healthState)}`}>
              {formatSnapshotState(detail.snapshotRun.healthState, t)}
            </span>
          </p>
        </div>
        <div className="hero-metrics">
          <MetricAccent label={t('adminSnapshots.totalReportRows')} value={String(totalRows)} />
          <MetricAccent label={t('adminSnapshots.canRerun')} value={detail.canRerun ? t('adminSnapshots.yes') : t('adminSnapshots.no')} />
          <MetricAccent label={t('adminSnapshots.rerunAllowed')} value={detail.rerunAllowed ? t('adminSnapshots.yes') : t('adminSnapshots.no')} />
          <MetricAccent
            label={t('adminSnapshots.kpiConfig')}
            value={formatSnapshotKpiConfigVersion(detail.snapshotRun.kpiConfigVersion, t)}
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
              <div className="eyebrow">{t('adminSnapshots.executionStateEyebrow')}</div>
              <h3>{t('adminSnapshots.runSummary')}</h3>
            </div>
          </div>
          <div className="detail-list">
            {[
              [t('adminSnapshots.runStatus'), formatSnapshotState(detail.snapshotRun.runStatus, t)],
              [t('adminSnapshots.healthState'), formatSnapshotState(detail.snapshotRun.healthState, t)],
              [t('adminSnapshots.period'), `${formatDate(detail.snapshotRun.periodStart, locale)} - ${formatDate(detail.snapshotRun.periodEnd, locale)}`],
              [t('adminSnapshots.kpiConfigVersion'), formatSnapshotKpiConfigVersion(detail.snapshotRun.kpiConfigVersion, t)],
              [t('adminSnapshots.generatedAt'), formatDateTime(detail.snapshotRun.generatedAt, locale)],
              [t('adminSnapshots.startedAt'), detail.snapshotRun.startedAt ? formatDateTime(detail.snapshotRun.startedAt, locale) : t('adminSnapshots.notStarted')],
              [t('adminSnapshots.finishedAt'), detail.snapshotRun.finishedAt ? formatDateTime(detail.snapshotRun.finishedAt, locale) : t('adminSnapshots.notFinished')],
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
              <div className="eyebrow">{t('adminSnapshots.rerunGovernanceEyebrow')}</div>
              <h3>{t('adminSnapshots.dependenciesTitle')}</h3>
            </div>
            <div className="toolbar-cluster">
              <button
                className="control-button"
                type="button"
                onClick={() => rerunMutation.mutate(snapshotRunId)}
                disabled={!detail.canRerun || rerunMutation.isPending}
              >
                {rerunMutation.isPending ? t('adminSnapshots.rerunning') : t('adminSnapshots.rerunSnapshot')}
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
                {t('adminSnapshots.exportChecks')}
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
                      {formatCheckStatus(check.status, t)}
                    </StatusPill>
                  </div>
                  <p>{check.message}</p>
                </div>
              ))}
              {dependencies.rerunBlockedReason ? (
                <div className="empty-card">
                  <strong>{t('adminSnapshots.rerunBlocked')}</strong>
                  <p>{dependencies.rerunBlockedReason}</p>
                </div>
              ) : null}
            </div>
          ) : (
            <EmptyState copy={t('adminSnapshots.dependencyLoading')} />
          )}
        </article>
      </section>

      <section className="two-up-grid">
        <article className="panel">
          <div className="panel-heading">
            <div>
              <div className="eyebrow">{t('adminSnapshots.outputVolumeEyebrow')}</div>
              <h3>{t('adminSnapshots.materializedSlices')}</h3>
            </div>
          </div>
          <StatusBar label={t('adminSnapshots.workforceRows')} value={detail.cards.workforceRows} total={Math.max(totalRows, 1)} tone="calm" />
          <StatusBar label={t('adminSnapshots.kpiRows')} value={detail.cards.kpiRows} total={Math.max(totalRows, 1)} tone="accent" />
          <StatusBar label={t('adminSnapshots.checklistRows')} value={detail.cards.checklistRows} total={Math.max(totalRows, 1)} tone="warning" />
          <StatusBar label={t('adminSnapshots.turnoverRows')} value={detail.cards.turnoverRows} total={Math.max(totalRows, 1)} tone="danger" />
        </article>

        <article className="panel">
          <div className="panel-heading">
            <div>
              <div className="eyebrow">{t('adminSnapshots.lineageEyebrow')}</div>
              <h3>{t('adminSnapshots.lineageTitle')}</h3>
            </div>
          </div>
          {lineage ? (
            <div className="stacked-table">
              <div className="stacked-row">
                <div className="stacked-row-head">
                  <strong>{t('adminSnapshots.parent')}</strong>
                  <GitBranch size={16} />
                </div>
                <p>
                  {lineage.parent
                    ? `${formatSnapshotType(lineage.parent.snapshotType, t)} · ${formatSnapshotState(lineage.parent.runStatus, t)} · ${lineage.parent.snapshotRunId}`
                    : t('adminSnapshots.noParentRun')}
                </p>
              </div>
              <div className="stacked-row">
                <div className="stacked-row-head">
                  <strong>{t('adminSnapshots.children')}</strong>
                  <Sparkles size={16} />
                </div>
                {lineage.children.length ? (
                  <div className="queue-meta">
                    {lineage.children.map((child) => (
                      <span key={child.snapshotRunId}>
                        {formatSnapshotType(child.snapshotType, t)} · {formatSnapshotState(child.runStatus, t)} · {child.snapshotRunId}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p>{t('adminSnapshots.noRerunChildren')}</p>
                )}
              </div>
            </div>
          ) : (
            <EmptyState copy={t('adminSnapshots.dependencyLoading')} />
          )}
        </article>
      </section>

      <section className="two-up-grid detail-bottom-grid">
        <article className="panel">
          <div className="panel-heading">
            <div>
              <div className="eyebrow">{t('adminSnapshots.failurePostureEyebrow')}</div>
              <h3>{t('adminSnapshots.failurePostureTitle')}</h3>
            </div>
          </div>
          <div className="stacked-table">
            <div className="stacked-row">
              <div className="stacked-row-head">
                <strong>{t('adminSnapshots.failureReason')}</strong>
                <Clock3 size={16} />
              </div>
              <p>{detail.failureReason ?? t('adminSnapshots.noFailureReason')}</p>
            </div>
            <div className="stacked-row">
              <div className="stacked-row-head">
                <strong>{t('adminSnapshots.latestRerunTitle')}</strong>
                <RefreshCcw size={16} />
              </div>
              <p>{detail.latestRerunSnapshotRunId ?? t('adminSnapshots.noRerunCreated')}</p>
              <span className="queue-subtitle">{t('adminSnapshots.rerunCount', { count: detail.rerunCount })}</span>
            </div>
          </div>
        </article>

        <article className="panel">
          <div className="panel-heading">
            <div>
              <div className="eyebrow">{t('adminSnapshots.auditTimelineEyebrow')}</div>
              <h3>{t('adminSnapshots.auditTimelineTitle')}</h3>
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
              {t('adminSnapshots.exportAudit')}
            </button>
          </div>
          {auditItems.length === 0 ? (
            <EmptyState copy={t('adminSnapshots.noAuditEntries')} />
          ) : (
            <div className="timeline">
              {auditItems.map((event) => (
                <div className="timeline-item" key={event.eventLogId}>
                  <div className="timeline-dot" />
                  <div>
                    <strong>{event.eventType}</strong>
                    <p>{formatDateTime(event.occurredAt, locale)}</p>
                    <span>
                      {t('adminSnapshots.actor', { actor: event.actorUserId ?? t('adminSnapshots.system') })} ·{' '}
                      {t('adminSnapshots.correlation', { correlation: event.correlationId ?? t('adminSnapshots.notAvailable') })}
                    </span>
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
} | null | undefined, t: TranslateFunction) {
  if (input?.state === 'versioned' && input.versionNo) {
    return `v${input.versionNo}`
  }

  return t('adminSnapshots.preGovernanceSnapshot')
}
