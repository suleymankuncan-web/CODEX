import { useDeferredValue, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowRight, DatabaseZap, ListChecks, ShieldCheck, UserCheck } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import {
  EmptyState,
  KeyValue,
  MetricAccent,
  MetricCard,
  ScreenState,
  StatusPill,
} from '../components/dashboard-primitives'
import {
  getMasterDataBootstrapBatches,
  getMasterDataBootstrapBatchDetail,
  getMasterDataBootstrapPromotionReadiness,
  promoteMasterDataBootstrapPersonnel,
  promoteMasterDataBootstrapStores,
  validateMasterDataBootstrapBatch,
} from '../features/integrations/api'
import type {
  MasterDataBootstrapBatchDetail,
  MasterDataBootstrapBatchItem,
  MasterDataBootstrapEntity,
  MasterDataBootstrapPromotionReadinessResponse,
  MasterDataBootstrapPromotionResponse,
  MasterDataBootstrapRow,
} from '../features/integrations/api'
import { formatDateTime, getErrorMessage } from '../lib/format'

const PAGE_SIZE = 20

export function MasterDataBootstrapPage() {
  const params = useParams()
  const batchId = params.batchId ?? null
  const [search, setSearch] = useState('')
  const [entityFilter, setEntityFilter] = useState<'all' | MasterDataBootstrapEntity>('all')
  const [readinessFilter, setReadinessFilter] = useState<
    'all' | 'needs_validation' | 'needs_review' | 'ready_to_promote' | 'closed'
  >('all')
  const [feedback, setFeedback] = useState<string | null>(null)
  const [promotionResult, setPromotionResult] =
    useState<MasterDataBootstrapPromotionResponse['data'] | null>(null)
  const deferredSearch = useDeferredValue(search)
  const queryClient = useQueryClient()

  const batchesQuery = useQuery({
    queryKey: ['master-data-bootstrap-batches', entityFilter, readinessFilter, deferredSearch],
    queryFn: () =>
      getMasterDataBootstrapBatches({
        bootstrapEntity: entityFilter === 'all' ? undefined : entityFilter,
        readiness: readinessFilter === 'all' ? undefined : readinessFilter,
        q: deferredSearch || undefined,
        limit: PAGE_SIZE,
        offset: 0,
      }),
  })
  const detailQuery = useQuery({
    queryKey: ['master-data-bootstrap-detail', batchId],
    queryFn: () => getMasterDataBootstrapBatchDetail(batchId ?? ''),
    enabled: Boolean(batchId),
  })
  const readinessQuery = useQuery({
    queryKey: ['master-data-bootstrap-readiness', batchId],
    queryFn: () => getMasterDataBootstrapPromotionReadiness(batchId ?? ''),
    enabled: Boolean(batchId),
  })
  const validateMutation = useMutation({
    mutationFn: validateMasterDataBootstrapBatch,
    onSuccess: async (response) => {
      setFeedback(response.command.message)
      setPromotionResult(null)
      await invalidateMasterDataQueries(queryClient, batchId)
    },
    onError: (error) => {
      setFeedback(getErrorMessage(error))
    },
  })
  const promoteMutation = useMutation({
    mutationFn: (input: { batchId: string; entity: MasterDataBootstrapEntity }) =>
      input.entity === 'store'
        ? promoteMasterDataBootstrapStores(input.batchId)
        : promoteMasterDataBootstrapPersonnel(input.batchId),
    onSuccess: async (response) => {
      setFeedback(response.command.message)
      setPromotionResult(response.data)
      await invalidateMasterDataQueries(queryClient, batchId)
    },
    onError: (error) => {
      setFeedback(getErrorMessage(error))
    },
  })

  const batches = useMemo(() => batchesQuery.data?.items ?? [], [batchesQuery.data?.items])
  const summary = detailQuery.data?.summary ?? null
  const readiness = readinessQuery.data?.summary ?? null
  const readinessRows = readinessQuery.data?.rows.items ?? []
  const rows = detailQuery.data?.rows.items ?? []
  const selectedBatch = useMemo(() => {
    if (summary) {
      return summary
    }

    return batches.find((item) => item.batchId === batchId) ?? batches[0] ?? null
  }, [batchId, batches, summary])

  if (batchesQuery.isLoading) {
    return <ScreenState title="Loading master data" copy="Pulling bootstrap batches and review state." />
  }

  if (batchesQuery.isError) {
    return <ScreenState title="Master data bootstrap unavailable" copy={getErrorMessage(batchesQuery.error)} tone="error" />
  }

  return (
    <section className="page-stack">
      <section className="hero-panel">
        <div>
          <div className="eyebrow">Master Data</div>
          <h2 className="hero-title">Master data bootstrap</h2>
          <p className="hero-copy">
            Review staged store and personnel baseline files before they become live master data.
            Row evidence and sanitized promotion evidence stay visible after the command runs.
          </p>
        </div>
        <div className="hero-metrics">
          <MetricAccent label="Batches" value={String(batchesQuery.data?.meta.total ?? 0)} />
          <MetricAccent label="Selected" value={selectedBatch?.bootstrapEntity ?? 'none'} />
          <MetricAccent label="Readiness" value={selectedBatch?.readiness ?? selectedBatch?.batchStatus ?? 'none'} />
        </div>
      </section>

      {feedback ? (
        <section className="panel">
          <div className="inline-state inline-state-accent">{feedback}</div>
          {promotionResult?.promotedRows.length ? (
            <div className="lineage-chip-list" aria-label="Promotion command result">
              {promotionResult.promotedRows.map((row) => (
                <div className="lineage-chip" key={row.rowId}>
                  <span>Promoted row</span>
                  <code className="lineage-code">
                    {row.rowId} / {row.promotedEntityId}
                    {row.assignmentId ? ` / ${row.assignmentId}` : ''}
                  </code>
                </div>
              ))}
            </div>
          ) : null}
        </section>
      ) : null}

      <section className="panel">
        <div className="panel-heading panel-heading-spread">
          <div>
            <div className="eyebrow">Review queue</div>
            <h3>Bootstrap batches</h3>
            <p className="panel-copy">
              Open a batch to inspect row evidence, dry-run evidence, readiness counters, and promotion state.
            </p>
          </div>
          <div className="toolbar-cluster">
            <label className="search-field">
              <span className="sr-only">Search bootstrap batches</span>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search source, file, batch"
              />
            </label>
            <label className="control-select">
              <span className="sr-only">Entity filter</span>
              <select
                value={entityFilter}
                onChange={(event) =>
                  setEntityFilter(event.target.value as 'all' | MasterDataBootstrapEntity)
                }
              >
                <option value="all">All entities</option>
                <option value="store">Stores</option>
                <option value="personnel">Personnel</option>
              </select>
            </label>
            <label className="control-select">
              <span className="sr-only">Readiness filter</span>
              <select
                value={readinessFilter}
                onChange={(event) =>
                  setReadinessFilter(
                    event.target.value as
                      | 'all'
                      | 'needs_validation'
                      | 'needs_review'
                      | 'ready_to_promote'
                      | 'closed',
                  )
                }
              >
                <option value="all">All readiness</option>
                <option value="needs_validation">Needs validation</option>
                <option value="needs_review">Needs review</option>
                <option value="ready_to_promote">Ready to promote</option>
                <option value="closed">Closed</option>
              </select>
            </label>
          </div>
        </div>

        {batches.length === 0 ? (
          <EmptyState
            title="No bootstrap batches found."
            copy="Stage a store or personnel baseline batch before using this review surface."
          />
        ) : (
          <div className="queue-list">
            {batches.map((batch) => (
              <Link
                className="queue-row"
                key={batch.batchId}
                to={`/admin/master-data/${batch.batchId}`}
              >
                <div className="queue-row-head">
                  <div>
                    <div className="queue-title">{batch.sourceLabel}</div>
                    <div className="queue-subtitle">{batch.batchId}</div>
                  </div>
                  <StatusPill tone={mapReadinessTone(batch.readiness ?? batch.batchStatus)}>
                    {batch.readiness ?? batch.batchStatus}
                  </StatusPill>
                </div>
                <div className="queue-meta">
                  <span>{batch.bootstrapEntity}</span>
                  <span>{batch.rowCount} rows</span>
                  <span>{batch.fileReference ?? 'No file reference'}</span>
                  <span>{formatDateTime(getBatchDisplayTimestamp(batch))}</span>
                </div>
                <div className="queue-footer">
                  <span>
                    valid {batch.validCount} / review {batch.needsReviewCount} / invalid{' '}
                    {batch.invalidCount} / promoted {batch.promotedCount}
                  </span>
                  <ArrowRight size={16} />
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {batchId ? (
        <BatchDetailPanel
          batchId={batchId}
          detailLoading={detailQuery.isLoading}
          detailError={detailQuery.error}
          detailIsError={detailQuery.isError}
          readinessLoading={readinessQuery.isLoading}
          readinessError={readinessQuery.error}
          readinessIsError={readinessQuery.isError}
          summary={summary}
          readiness={readiness}
          readinessRows={readinessRows}
          rows={rows}
          validating={validateMutation.isPending}
          promoting={promoteMutation.isPending}
          onValidate={() => validateMutation.mutate(batchId)}
          onPromote={() => {
            if (!summary) {
              return
            }
            promoteMutation.mutate({
              batchId,
              entity: summary.bootstrapEntity,
            })
          }}
        />
      ) : null}
    </section>
  )
}

function getBatchDisplayTimestamp(batch: MasterDataBootstrapBatchItem) {
  return batch.updatedAt ?? batch.promotedAt ?? batch.validatedAt ?? batch.createdAt
}

function BatchDetailPanel(input: {
  batchId: string
  detailLoading: boolean
  detailError: unknown
  detailIsError: boolean
  readinessLoading: boolean
  readinessError: unknown
  readinessIsError: boolean
  summary: MasterDataBootstrapBatchDetail['summary'] | null
  readiness: MasterDataBootstrapPromotionReadinessResponse['summary'] | null
  readinessRows: MasterDataBootstrapPromotionReadinessResponse['rows']['items']
  rows: MasterDataBootstrapRow[]
  validating: boolean
  promoting: boolean
  onValidate: () => void
  onPromote: () => void
}) {
  if (input.detailLoading || input.readinessLoading) {
    return <ScreenState title="Loading bootstrap batch" copy="Pulling row evidence and promotion readiness." />
  }

  if (input.detailIsError) {
    return <ScreenState title="Bootstrap batch unavailable" copy={getErrorMessage(input.detailError)} tone="error" />
  }

  if (input.readinessIsError) {
    return <ScreenState title="Promotion readiness unavailable" copy={getErrorMessage(input.readinessError)} tone="error" />
  }

  if (!input.summary || !input.readiness) {
    return <ScreenState title="Bootstrap batch unavailable" copy="The API did not return batch summary or readiness evidence." tone="error" />
  }

  const promoteLabel =
    input.summary.bootstrapEntity === 'store' ? 'Promote stores' : 'Promote personnel'
  const promotedLabel = `${input.summary.promotedCount} / ${input.summary.rowCount}`

  return (
    <>
      <section className="metric-grid">
        <MetricCard
          title="Ready rows"
          value={input.readiness.readyCount}
          note={`Next action: ${input.readiness.nextAction}`}
          icon={<ListChecks size={18} />}
          tone="accent"
        />
        <MetricCard
          title="Promoted rows"
          value={input.summary.promotedCount}
          note={promotedLabel}
          icon={<ShieldCheck size={18} />}
          tone="calm"
        />
        <MetricCard
          title="Needs validation"
          value={input.readiness.needsValidationCount}
          note="Run validation before promotion"
          icon={<DatabaseZap size={18} />}
          tone="warning"
        />
        <MetricCard
          title="Blocked rows"
          value={input.readiness.blockedCount + input.readiness.needsReviewCount}
          note="Review issue codes before promotion"
          icon={<UserCheck size={18} />}
          tone={input.readiness.blockedCount + input.readiness.needsReviewCount > 0 ? 'danger' : 'neutral'}
        />
      </section>

      <section className="two-up-grid">
        <article className="panel">
          <div className="panel-heading">
            <div>
              <div className="eyebrow">Selected batch</div>
              <h3>{input.summary.sourceLabel}</h3>
            </div>
            <StatusPill tone={mapReadinessTone(input.readiness.nextAction)}>
              {input.readiness.nextAction}
            </StatusPill>
          </div>
          <div className="key-grid">
            <KeyValue label="Batch" value={input.batchId} />
            <KeyValue label="Entity" value={input.summary.bootstrapEntity} />
            <KeyValue label="Status" value={input.summary.batchStatus} />
            <KeyValue label="Readiness" value={input.readiness.canPromote ? 'can promote' : 'blocked'} />
            <KeyValue label="Promoted rows" value={promotedLabel} />
            <KeyValue label="File" value={input.summary.fileReference ?? 'No file reference'} />
          </div>
        </article>

        <article className="panel">
          <div className="panel-heading">
            <div>
              <div className="eyebrow">Actions</div>
              <h3>Backend-owned decisions</h3>
            </div>
          </div>
          <p className="panel-copy">
            This page does not calculate eligibility. It renders backend readiness, row evidence,
            and dry-run evidence before calling the existing command endpoint for the selected entity type.
          </p>
          <div className="toolbar-cluster">
            <button
              className="control-button"
              type="button"
              disabled={input.validating}
              onClick={input.onValidate}
            >
              {input.validating ? 'Validating...' : 'Validate batch'}
            </button>
            <button
              className="control-button"
              type="button"
              disabled={!input.readiness.canPromote || input.promoting}
              onClick={input.onPromote}
            >
              {input.promoting ? 'Promoting...' : promoteLabel}
            </button>
            {!input.readiness.canPromote ? (
              <span className="inline-state inline-state-warning">
                Promotion is disabled until readiness is clean.
              </span>
            ) : null}
          </div>
        </article>
      </section>

      <section className="panel" aria-label="Master data promotion dry-run evidence">
        <div className="panel-heading">
          <div>
            <div className="eyebrow">Dry-run</div>
            <h3>Promotion dry-run evidence</h3>
            <p className="panel-copy">
              Dry-run evidence only. No rows are promoted from this panel; promotion still requires the explicit command.
            </p>
          </div>
        </div>
        {input.readinessRows.length === 0 ? (
          <EmptyState copy="No promotion readiness rows returned for this bootstrap batch." />
        ) : (
          <div className="stacked-table">
            {input.readinessRows.map((row) => (
              <div className="stacked-row" key={row.rowId}>
                <div className="stacked-row-head">
                  <strong>#{row.rowNumber} {resolveDryRunRowLabel(row)}</strong>
                  <StatusPill tone={mapPromotionReadinessTone(row.promotionReadiness)}>
                    {row.promotionReadiness}
                  </StatusPill>
                </div>
                <div className="lineage-chip-list">
                  <EvidenceChip label="Store code" value={row.sourceStoreCode} />
                  <EvidenceChip label="Employee code" value={row.sourceEmployeeCode} />
                  <EvidenceChip label="Promoted entity" value={row.promotedEntityId} />
                  <EvidenceChip label="Block reason" value={row.blockReason} />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="panel" aria-label="Master data bootstrap row evidence">
        <div className="panel-heading">
          <div>
            <div className="eyebrow">Row evidence</div>
            <h3>Resolved and promoted rows</h3>
          </div>
        </div>
        {input.rows.length === 0 ? (
          <EmptyState copy="No staged rows returned for this bootstrap batch." />
        ) : (
          <div className="stacked-table">
            {input.rows.map((row) => (
              <div className="stacked-row" key={row.rowId}>
                <div className="stacked-row-head">
                  <strong>
                    #{row.rowNumber} {resolveRowName(row)}
                  </strong>
                  <StatusPill tone={mapValidationTone(row.validationStatus)}>
                    {row.validationStatus}
                  </StatusPill>
                  {row.issueCode ? (
                    <span className="status-pill status-pill-warning">{row.issueCode}</span>
                  ) : null}
                </div>
                {row.issueMessage ? <p>{row.issueMessage}</p> : null}
                <div className="lineage-chip-list">
                  <EvidenceChip label="Store code" value={row.sourceStoreCode} />
                  <EvidenceChip label="Employee code" value={row.sourceEmployeeCode} />
                  <EvidenceChip label="Resolved store" value={row.resolvedStoreId} />
                  <EvidenceChip label="Resolved employee" value={row.resolvedEmployeeId} />
                  <EvidenceChip label="Resolved position" value={row.resolvedPositionId} />
                  <EvidenceChip label="Promoted entity" value={row.promotedEntityId} />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  )
}

function EvidenceChip(input: { label: string; value: string | null | undefined }) {
  return (
    <div className="lineage-chip">
      <span>{input.label}</span>
      <code className="lineage-code">{input.value ?? 'not resolved'}</code>
    </div>
  )
}

function resolveRowName(row: MasterDataBootstrapRow) {
  const firstName = readPayloadString(row.normalizedPayload, 'normalizedFirstName')
  const lastName = readPayloadString(row.normalizedPayload, 'normalizedLastName')
  const storeName = readPayloadString(row.normalizedPayload, 'normalizedStoreName')
  const parts = [firstName, lastName].filter(Boolean)

  return parts.length > 0 ? parts.join(' ') : storeName ?? row.sourceStoreCode ?? row.rowId
}

function readPayloadString(payload: Record<string, unknown>, key: string) {
  const value = payload[key]
  return typeof value === 'string' && value.trim() ? value : null
}

function resolveDryRunRowLabel(
  row: MasterDataBootstrapPromotionReadinessResponse['rows']['items'][number],
) {
  return row.sourceEmployeeCode ?? row.sourceStoreCode ?? row.rowId
}

function mapPromotionReadinessTone(value: string) {
  if (value === 'ready') {
    return 'accent'
  }
  if (value === 'already_promoted') {
    return 'calm'
  }
  if (value === 'needs_validation' || value === 'needs_review' || value === 'waiting_batch') {
    return 'warning'
  }
  if (value === 'blocked') {
    return 'danger'
  }

  return 'neutral'
}

function mapReadinessTone(value: string) {
  if (value === 'ready_to_promote' || value === 'promote_ready_rows' || value === 'can promote') {
    return 'accent'
  }
  if (value === 'closed' || value === 'promoted' || value === 'already_closed') {
    return 'calm'
  }
  if (value === 'needs_review' || value === 'review_rows' || value === 'needs_validation') {
    return 'warning'
  }
  if (value === 'blocked') {
    return 'danger'
  }

  return 'neutral'
}

function mapValidationTone(value: string) {
  if (value === 'promoted' || value === 'valid') {
    return 'calm'
  }
  if (value === 'needs_review' || value === 'pending') {
    return 'warning'
  }
  if (value === 'invalid') {
    return 'danger'
  }

  return 'neutral'
}

async function invalidateMasterDataQueries(
  queryClient: ReturnType<typeof useQueryClient>,
  batchId: string | null,
) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ['master-data-bootstrap-batches'] }),
    batchId
      ? queryClient.invalidateQueries({ queryKey: ['master-data-bootstrap-detail', batchId] })
      : Promise.resolve(),
    batchId
      ? queryClient.invalidateQueries({ queryKey: ['master-data-bootstrap-readiness', batchId] })
      : Promise.resolve(),
  ])
}
