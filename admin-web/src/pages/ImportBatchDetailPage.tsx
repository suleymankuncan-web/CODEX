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
  type Tone,
} from '../components/dashboard-primitives'
import { downloadCsv } from '../lib/download-csv'
import {
  approveExternalIdMap,
  getExternalIdMapCandidates,
  getImportBatchAudit,
  getImportBatchDetail,
  getImportBatchErrors,
  getImportBatchReconciliation,
  type ImportBatchDetail,
  type ImportBatchError,
  type ImportBatchReconciliation,
  retryImportBatch,
} from '../features/integrations/api'
import { formatDateTime, getErrorMessage, mapHealthTone } from '../lib/format'

export function ImportBatchDetailPage() {
  const params = useParams()
  const batchId = params.batchId ?? ''
  const [feedback, setFeedback] = useState<string | null>(null)
  const [mappingInputs, setMappingInputs] = useState<Record<string, string>>({})
  const [mappingSearchInputs, setMappingSearchInputs] = useState({
    employee: '',
    store: '',
  })
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
  const errorItems = errorsQuery.data?.items ?? []
  const hasStoreMapping = errorItems.some(
    (error) => error.mappingCandidate?.entityType === 'store',
  )
  const hasEmployeeMapping = errorItems.some(
    (error) => error.mappingCandidate?.entityType === 'employee',
  )
  const storeCandidateSearch = mappingSearchInputs.store.trim()
  const employeeCandidateSearch = mappingSearchInputs.employee.trim()
  const storeCandidatesQuery = useQuery({
    queryKey: ['external-id-map-candidates', 'store', storeCandidateSearch],
    queryFn: () =>
      getExternalIdMapCandidates({
        entityType: 'store',
        q: storeCandidateSearch || undefined,
        limit: 25,
      }),
    enabled: hasStoreMapping,
  })
  const employeeCandidatesQuery = useQuery({
    queryKey: ['external-id-map-candidates', 'employee', employeeCandidateSearch],
    queryFn: () =>
      getExternalIdMapCandidates({
        entityType: 'employee',
        q: employeeCandidateSearch || undefined,
        limit: 25,
      }),
    enabled: hasEmployeeMapping,
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
  const mappingMutation = useMutation({
    mutationFn: (input: {
      rowId: string
      integrationSourceId: string
      entityType: 'employee' | 'store'
      externalId: string
      internalId: string
      internalTableName?: string
    }) =>
      approveExternalIdMap({
        integrationSourceId: input.integrationSourceId,
        entityType: input.entityType,
        externalId: input.externalId,
        internalId: input.internalId,
        internalTableName: input.internalTableName,
      }),
    onSuccess: async (response, variables) => {
      setFeedback(response.command.message)
      setMappingInputs((current) => {
        const next = { ...current }
        delete next[variables.rowId]
        return next
      })
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['import-batch-detail', batchId] }),
        queryClient.invalidateQueries({ queryKey: ['import-batch-reconciliation', batchId] }),
        queryClient.invalidateQueries({ queryKey: ['import-batch-errors', batchId] }),
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
  const errors = errorItems
  const auditItems = auditQuery.data?.items ?? []
  const qualityIssueItems = detail.qualityIssueSummary?.items ?? []
  const importDecision = buildImportDecisionEvidence({ detail, reconciliation, errors })

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

      <section className="panel" aria-label="Import decision evidence">
        <div className="panel-heading">
          <div>
            <div className="eyebrow">Operator gate</div>
            <h3>Operator decision evidence</h3>
          </div>
          <span className={`status-pill status-pill-${importDecision.tone}`}>
            {importDecision.label}
          </span>
        </div>
        <p className="panel-copy">{importDecision.summary}</p>
        <div className="reconciliation-grid">
          {importDecision.factors.map(([label, value]) => (
            <ReconciliationStat key={label} label={label} value={value} />
          ))}
        </div>
      </section>

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
                    'mappingExternalId',
                    'validationError',
                    'processedAt',
                  ],
                  rows: errors.map((error) => [
                    error.rowId,
                    error.sourceRef,
                    error.normalizedStatus,
                    error.errorCategory,
                    error.qualityIssueCode ?? '',
                    error.mappingCandidate?.externalId ?? '',
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
                  {error.mappingCandidate ? (
                    <div className="mapping-action" aria-label="External ID mapping approval">
                      {(() => {
                        const entityType = error.mappingCandidate.entityType
                        const candidateQuery =
                          entityType === 'store' ? storeCandidatesQuery : employeeCandidatesQuery
                        const candidates = candidateQuery.data?.items ?? []

                        return (
                          <>
                      <div className="mapping-targets">
                        <div className="lineage-chip">
                          <span>External {error.mappingCandidate.entityType}</span>
                          <code className="lineage-code">{error.mappingCandidate.externalId}</code>
                        </div>
                        <div className="lineage-chip">
                          <span>Target table</span>
                          <code className="lineage-code">{error.mappingCandidate.internalTableName}</code>
                        </div>
                      </div>
                      <div className="mapping-controls">
                        <input
                          className="control-input mapping-input"
                          type="text"
                          aria-label={`Search internal ${entityType} candidates`}
                          value={mappingSearchInputs[entityType]}
                          placeholder={`Search internal ${entityType} candidates`}
                          onChange={(event) =>
                            setMappingSearchInputs((current) => ({
                              ...current,
                              [entityType]: event.target.value,
                            }))
                          }
                        />
                        <select
                          className="control-input mapping-select"
                          aria-label={`Map to internal ${entityType}`}
                          value={mappingInputs[error.rowId] ?? ''}
                          disabled={candidateQuery.isLoading || candidates.length === 0}
                          onChange={(event) =>
                            setMappingInputs((current) => ({
                              ...current,
                              [error.rowId]: event.target.value,
                            }))
                          }
                        >
                          <option value="">Select internal {entityType}</option>
                          {candidates.map((candidate) => (
                            <option key={candidate.internalId} value={candidate.internalId}>
                              {candidate.label} - {candidate.secondaryLabel}
                            </option>
                          ))}
                        </select>
                        <button
                          className="control-button"
                          type="button"
                          disabled={
                            !mappingInputs[error.rowId]?.trim() ||
                            (mappingMutation.isPending &&
                              mappingMutation.variables?.rowId === error.rowId)
                          }
                          onClick={() =>
                            mappingMutation.mutate({
                              rowId: error.rowId,
                              integrationSourceId: error.mappingCandidate!.integrationSourceId,
                              entityType: error.mappingCandidate!.entityType,
                              externalId: error.mappingCandidate!.externalId,
                              internalTableName: error.mappingCandidate!.internalTableName,
                              internalId: mappingInputs[error.rowId]?.trim() ?? '',
                            })
                          }
                        >
                          {mappingMutation.isPending && mappingMutation.variables?.rowId === error.rowId
                            ? 'Approving...'
                            : 'Approve mapping'}
                        </button>
                        {candidateQuery.isLoading ? (
                          <span className="mapping-helper">Loading internal candidates...</span>
                        ) : null}
                        {candidateQuery.isError ? (
                          <span className="mapping-helper mapping-helper-error">
                            Candidate list unavailable: {getErrorMessage(candidateQuery.error)}
                          </span>
                        ) : null}
                        {!candidateQuery.isLoading && !candidateQuery.isError && candidates.length === 0 ? (
                          <span className="mapping-helper">No candidates found for this search.</span>
                        ) : null}
                      </div>
                          </>
                        )
                      })()}
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

type ImportDecisionLabel = 'Go' | 'Conditional Go' | 'No-Go'

type ImportDecisionEvidence = {
  label: ImportDecisionLabel
  tone: Tone
  summary: string
  factors: [string, string][]
}

function buildImportDecisionEvidence(input: {
  detail: ImportBatchDetail
  reconciliation?: ImportBatchReconciliation
  errors: ImportBatchError[]
}): ImportDecisionEvidence {
  const { detail, reconciliation, errors } = input
  const highSeverityRows = detail.qualityIssueSummary?.highSeverityRows ?? 0
  const totalIssueRows = detail.qualityIssueSummary?.totalIssueRows ?? 0
  const retryableRows = Math.max(
    detail.rowStatusSummary.retryableError,
    reconciliation?.rowStatusSummary.retryableError ?? 0,
  )
  const mappingRows = errors.filter((error) => error.mappingCandidate).length
  const blockedByEntityTypes = Array.from(
    new Set([
      ...detail.blockedByEntityTypes,
      ...(reconciliation?.reconciliation.blockedByEntityTypes ?? []),
    ]),
  )
  const rowAccounting = getRowAccountingStatus(reconciliation)
  const hasRowAccountingFailure =
    reconciliation !== undefined &&
    (!reconciliation.totals.countsMatchRecordCount || reconciliation.totals.unaccountedRows > 0)
  const hasPendingRows =
    detail.rowStatusSummary.pending > 0 || (reconciliation?.reconciliation.hasPendingRows ?? false)
  const isStoppedState =
    detail.batch.status === 'failed' ||
    detail.batch.healthState === 'stuck' ||
    detail.healthState === 'stuck'
  const hasFailures = reconciliation?.reconciliation.hasFailures ?? detail.batch.errorCount > 0
  const hasConditionalEvidence =
    highSeverityRows > 0 ||
    totalIssueRows > 0 ||
    retryableRows > 0 ||
    mappingRows > 0 ||
    hasFailures

  let label: ImportDecisionLabel = 'Go'
  let tone: Tone = 'calm'
  let summary = 'Batch evidence is clean: accounted rows match, no quality issues, no retryable rows.'

  if (!reconciliation) {
    label = 'Conditional Go'
    tone = 'warning'
    summary = 'Waiting for reconciliation evidence before treating this batch as clean.'
  } else if (hasRowAccountingFailure || hasPendingRows || blockedByEntityTypes.length > 0 || isStoppedState) {
    label = 'No-Go'
    tone = 'danger'
    summary = 'Stop: fix row accounting, pending rows, blocked dependencies, or stuck status before proceeding.'
  } else if (hasConditionalEvidence) {
    label = 'Conditional Go'
    tone = 'warning'
    summary = 'Fix quality issues, unresolved mappings, or retryable rows before treating this batch as clean.'
  }

  return {
    label,
    tone,
    summary,
    factors: [
      ['Row accounting', rowAccounting],
      ['Quality guard', formatQualityGuardStatus(highSeverityRows, totalIssueRows)],
      ['Retry evidence', formatRetryEvidenceStatus(retryableRows, detail.canRetryNow)],
      ['Dependency mapping', formatDependencyMappingStatus(blockedByEntityTypes, mappingRows)],
    ],
  }
}

function getRowAccountingStatus(reconciliation?: ImportBatchReconciliation) {
  if (!reconciliation) return 'Waiting for reconciliation'
  if (reconciliation.totals.unaccountedRows > 0) {
    return `${formatRowCount(reconciliation.totals.unaccountedRows)} unaccounted`
  }
  if (!reconciliation.totals.countsMatchRecordCount) return 'Record count mismatch'
  return 'Accounted and matched'
}

function formatQualityGuardStatus(highSeverityRows: number, totalIssueRows: number) {
  if (highSeverityRows > 0) return `${highSeverityRows} high severity ${highSeverityRows === 1 ? 'row' : 'rows'}`
  if (totalIssueRows > 0) return `${formatRowCount(totalIssueRows)} classified`
  return 'No classified issues'
}

function formatRetryEvidenceStatus(retryableRows: number, canRetryNow: boolean) {
  if (retryableRows === 0) return 'No retry needed'
  return canRetryNow ? 'Retry available' : 'Retry blocked'
}

function formatDependencyMappingStatus(blockedByEntityTypes: string[], mappingRows: number) {
  if (blockedByEntityTypes.length > 0) return `Blocked by ${blockedByEntityTypes.join(', ')}`
  if (mappingRows > 0) return `${mappingRows} mapping ${mappingRows === 1 ? 'row' : 'rows'} pending`
  return 'No dependency block'
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
