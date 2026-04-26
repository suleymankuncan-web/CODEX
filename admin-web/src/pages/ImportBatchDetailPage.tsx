import type { ReactNode } from 'react'
import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, CircleDashed, Network, RefreshCw } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import {
  EmptyState,
  MetricAccent,
  ScreenState,
  StatusBar,
} from '../components/dashboard-primitives'
import { downloadCsv } from '../lib/download-csv'
import {
  getImportBatchAudit,
  getImportBatchDetail,
  getImportBatchErrors,
  getImportBatchReconciliation,
  retryImportBatch,
} from '../features/integrations/api'
import { formatDateTime, getErrorMessage, mapHealthTone } from '../lib/format'

export function ImportBatchDetailPage() {
  const params = useParams()
  const batchId = params.batchId ?? ''
  const [feedback, setFeedback] = useState<string | null>(null)
  const queryClient = useQueryClient()

  const detailQuery = useQuery({
    queryKey: ['import-batch-detail', batchId],
    queryFn: () => getImportBatchDetail(batchId),
    enabled: Boolean(batchId),
  })
  const reconciliationQuery = useQuery({
    queryKey: ['import-batch-reconciliation', batchId],
    queryFn: () => getImportBatchReconciliation(batchId),
    enabled: Boolean(batchId),
  })
  const errorsQuery = useQuery({
    queryKey: ['import-batch-errors', batchId],
    queryFn: () => getImportBatchErrors(batchId),
    enabled: Boolean(batchId),
  })
  const auditQuery = useQuery({
    queryKey: ['import-batch-audit', batchId],
    queryFn: () => getImportBatchAudit(batchId),
    enabled: Boolean(batchId),
  })
  const retryMutation = useMutation({
    mutationFn: retryImportBatch,
    onSuccess: async (response) => {
      setFeedback(response.command.message)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['import-batch-detail', batchId] }),
        queryClient.invalidateQueries({ queryKey: ['import-batch-reconciliation', batchId] }),
        queryClient.invalidateQueries({ queryKey: ['import-batch-errors', batchId] }),
        queryClient.invalidateQueries({ queryKey: ['import-batch-audit', batchId] }),
        queryClient.invalidateQueries({ queryKey: ['integration-needs-action'] }),
        queryClient.invalidateQueries({ queryKey: ['integration-overview'] }),
      ])
    },
  })

  if (!batchId) {
    return <ScreenState title="Batch id missing" copy="Open this screen from the queue to inspect a concrete batch." />
  }

  if (detailQuery.isLoading) {
    return <ScreenState title="Loading batch detail" copy="Pulling detail, reconciliation, errors, and audit context." />
  }

  if (detailQuery.isError || !detailQuery.data) {
    return <ScreenState title="Batch detail unavailable" copy={getErrorMessage(detailQuery.error)} tone="error" />
  }

  const detail = detailQuery.data
  const reconciliation = reconciliationQuery.data
  const errors = errorsQuery.data?.items ?? []
  const auditItems = auditQuery.data?.items ?? []
  const qualityIssueItems = detail.qualityIssueSummary?.items ?? []

  return (
    <section className="page-stack">
      <Link className="back-link" to="/admin/integrations">
        <ArrowLeft size={16} />
        Back to integration queue
      </Link>

      <section className="hero-panel hero-panel-detail">
        <div>
          <div className="eyebrow">Import Batch Detail</div>
          <h2 className="hero-title">{detail.batch.sourceCode} / {detail.batch.entityType}</h2>
          <p className="hero-copy">
            Batch <code>{detail.batch.batchId}</code> with current health state{' '}
            <span className={`inline-state inline-state-${mapHealthTone(detail.healthState)}`}>
              {detail.healthState.replaceAll('_', ' ')}
            </span>
          </p>
        </div>
        <div className="hero-metrics">
          <MetricAccent label="Records" value={String(detail.batch.recordCount)} />
          <MetricAccent label="Errors" value={String(detail.batch.errorCount)} />
          <MetricAccent label="Retry now" value={detail.canRetryNow ? 'Yes' : 'No'} />
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
              <h3>Batch summary</h3>
            </div>
          </div>
          <DetailList
            items={[
              ['Status', detail.batch.status],
              ['Health state', detail.batch.healthState],
              ['Started at', formatDateTime(detail.batch.startedAt)],
              ['Finished at', detail.batch.finishedAt ? formatDateTime(detail.batch.finishedAt) : 'Not finished'],
              ['Retry count', String(detail.batch.retryCount)],
              ['File reference', detail.batch.fileReference ?? 'N/A'],
            ]}
          />
        </article>

        <article className="panel">
          <div className="panel-heading">
            <div>
              <div className="eyebrow">Dependency guidance</div>
              <h3>What blocks progress</h3>
            </div>
            <button
              className="control-button"
              type="button"
              onClick={() => retryMutation.mutate(batchId)}
              disabled={!detail.canRetryNow || retryMutation.isPending}
            >
              {retryMutation.isPending ? 'Retrying...' : 'Retry batch'}
            </button>
          </div>
          <div className="dependency-list">
            <DependencyCard
              icon={<Network size={18} />}
              label="Blocked by"
              value={detail.blockedByEntityTypes.length ? detail.blockedByEntityTypes.join(', ') : 'Nothing blocking'}
            />
            <DependencyCard
              icon={<RefreshCw size={18} />}
              label="Recommended next import"
              value={detail.recommendedNextEntityType ?? 'No dependency import needed'}
            />
            <DependencyCard
              icon={<CircleDashed size={18} />}
              label="Recommended order"
              value={detail.recommendedImportOrder.join(' -> ')}
            />
          </div>
        </article>
      </section>

      <section className="panel" aria-label="Import data quality summary">
        <div className="panel-heading">
          <div>
            <div className="eyebrow">Quality guard</div>
            <h3>Data quality summary</h3>
          </div>
        </div>
        <p className="panel-copy">
          Failed rows are grouped by stable quality issue codes so operators can see the dominant cleanup work before opening every row.
        </p>
        <div className="reconciliation-grid">
          <ReconciliationStat
            label="Issue rows"
            value={String(detail.qualityIssueSummary?.totalIssueRows ?? 0)}
          />
          <ReconciliationStat
            label="High severity rows"
            value={String(detail.qualityIssueSummary?.highSeverityRows ?? 0)}
          />
        </div>
        {qualityIssueItems.length === 0 ? (
          <EmptyState copy="No data quality issues were classified for this batch." />
        ) : (
          <div className="stacked-table">
            {qualityIssueItems.map((issue) => (
              <div className="stacked-row" key={issue.code}>
                <div className="stacked-row-head">
                  <strong>{issue.label}</strong>
                  <span className={`status-pill status-pill-${mapQualitySeverityTone(issue.severity)}`}>
                    {issue.code}
                  </span>
                </div>
                <p>{issue.description}</p>
                <span>
                  {issue.owner} / {issue.severity} / {formatRowCount(issue.count)}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="panel" aria-label="Import row lineage evidence">
        <div className="panel-heading">
          <div>
            <div className="eyebrow">Source evidence</div>
            <h3>Source row lineage</h3>
          </div>
        </div>
        {detail.lineageSummary?.supported ? (
          <>
            <p className="panel-copy">
              KPI rows keep a stable hash and a readable source reference for future reconciliation.
            </p>
            <div className="reconciliation-grid">
              <ReconciliationStat
                label="Trace-ready rows"
                value={`${detail.lineageSummary.rowHashCount} / ${detail.batch.recordCount}`}
              />
              <ReconciliationStat
                label="Readable references"
                value={`${detail.lineageSummary.rawRowReferenceCount} / ${detail.batch.recordCount}`}
              />
            </div>
            <DetailList
              items={[
                ['Sample row hash', detail.lineageSummary.sampleRowHash ?? 'No sample yet'],
                [
                  'Sample raw row reference',
                  detail.lineageSummary.sampleRawRowReference ?? 'No sample yet',
                ],
              ]}
            />
          </>
        ) : (
          <EmptyState copy="Source row lineage is currently available for KPI raw rows." />
        )}
      </section>

      <section className="two-up-grid">
        <article className="panel">
          <div className="panel-heading">
            <div>
              <div className="eyebrow">Row status</div>
              <h3>Batch accounting</h3>
            </div>
          </div>

          {reconciliation ? (
            <>
              <div className="reconciliation-grid">
                <ReconciliationStat label="Accounted rows" value={String(reconciliation.totals.accountedRows)} />
                <ReconciliationStat label="Unaccounted rows" value={String(reconciliation.totals.unaccountedRows)} />
                <ReconciliationStat
                  label="Record count match"
                  value={reconciliation.totals.countsMatchRecordCount ? 'Match' : 'Mismatch'}
                />
              </div>
              <StatusBar label="Processed" value={reconciliation.rowStatusSummary.processed} rate={reconciliation.rates.processedRate} tone="calm" />
              <StatusBar label="Validation failures" value={reconciliation.rowStatusSummary.validationFailed} rate={reconciliation.rates.validationFailureRate} tone="warning" />
              <StatusBar label="Retryable errors" value={reconciliation.rowStatusSummary.retryableError} rate={reconciliation.rates.retryableErrorRate} tone="danger" />
              <StatusBar label="Pending" value={reconciliation.rowStatusSummary.pending} rate={reconciliation.rates.pendingRate} tone="neutral" />
            </>
          ) : (
            <EmptyState copy="Reconciliation data is still loading." />
          )}
        </article>

        <article className="panel">
          <div className="panel-heading">
            <div>
              <div className="eyebrow">Dependency counts</div>
              <h3>Unresolved references</h3>
            </div>
          </div>
          <DetailList
            items={[
              ['Employee', String(detail.dependencySummary.employee)],
              ['Store', String(detail.dependencySummary.store)],
              ['Position', String(detail.dependencySummary.position)],
              ['Region', String(detail.dependencySummary.region)],
              ['Company', String(detail.dependencySummary.company)],
              ['Manager', String(detail.dependencySummary.manager)],
            ]}
          />
        </article>
      </section>

      <section className="two-up-grid detail-bottom-grid">
        <article className="panel">
          <div className="panel-heading">
            <div>
              <div className="eyebrow">Error rows</div>
              <h3>Why rows failed</h3>
            </div>
            <button
              className="control-button"
              type="button"
              onClick={() =>
                downloadCsv({
                  filename: `import-batch-errors-${batchId}.csv`,
                  columns: [
                    'rowId',
                    'sourceRef',
                    'normalizedStatus',
                    'errorCategory',
                    'qualityIssueCode',
                    'validationError',
                    'processedAt',
                  ],
                  rows: errors.map((error) => [
                    error.rowId,
                    error.sourceRef,
                    error.normalizedStatus,
                    error.errorCategory,
                    error.qualityIssueCode ?? '',
                    error.validationError,
                    error.processedAt,
                  ]),
                })
              }
              disabled={errors.length === 0}
            >
              Export errors
            </button>
          </div>
          {errors.length === 0 ? (
            <EmptyState copy="No row-level errors returned for this batch." />
          ) : (
            <div className="stacked-table">
              {errors.map((error) => (
                <div className="stacked-row" key={error.rowId}>
                  <div className="stacked-row-head">
                    <strong>{error.sourceRef}</strong>
                    <span className={`status-pill status-pill-${mapErrorTone(error.errorCategory)}`}>
                      {error.errorCategory.replaceAll('_', ' ')}
                    </span>
                    {error.qualityIssueCode ? (
                      <span className="status-pill status-pill-accent">
                        quality issue {error.qualityIssueCode}
                      </span>
                    ) : null}
                  </div>
                  <p>{error.validationError ?? 'No validation message available'}</p>
                  {error.rawRowReference || error.rowHash ? (
                    <div className="lineage-chip-list" aria-label="Row lineage evidence">
                      {error.rawRowReference ? (
                        <div className="lineage-chip">
                          <span>Raw reference</span>
                          <code className="lineage-code">{error.rawRowReference}</code>
                        </div>
                      ) : null}
                      {error.rowHash ? (
                        <div className="lineage-chip">
                          <span>Row hash</span>
                          <code className="lineage-code">{error.rowHash}</code>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          )}
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
                  filename: `import-batch-audit-${batchId}.csv`,
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

function DetailList(input: { items: [string, string][] }) {
  return (
    <div className="detail-list">
      {input.items.map(([label, value]) => (
        <div className="detail-row" key={label}>
          <span>{label}</span>
          <strong>{value}</strong>
        </div>
      ))}
    </div>
  )
}

function DependencyCard(input: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="dependency-card">
      <div className="dependency-icon">{input.icon}</div>
      <span>{input.label}</span>
      <strong>{input.value}</strong>
    </div>
  )
}

function ReconciliationStat(input: { label: string; value: string }) {
  return (
    <div className="reconciliation-stat">
      <span>{input.label}</span>
      <strong>{input.value}</strong>
    </div>
  )
}

function formatRowCount(count: number) {
  return `${count} ${count === 1 ? 'row' : 'rows'}`
}

function mapQualitySeverityTone(severity: string) {
  if (severity === 'high') return 'danger'
  if (severity === 'medium') return 'warning'
  return 'accent'
}

function mapErrorTone(category: string) {
  if (category === 'validation') return 'warning'
  if (category === 'missing_dependency') return 'accent'
  return 'danger'
}
