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
import type { TranslateFunction } from '../features/localization/dictionary'
import { useLocalization } from '../features/localization/useLocalization'
import { formatDateTime, getErrorMessage } from '../lib/format'

const PAGE_SIZE = 20

export function MasterDataBootstrapPage() {
  const { locale, t } = useLocalization()
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
    return <ScreenState title={t('adminMasterData.loadingTitle')} copy={t('adminMasterData.loadingCopy')} />
  }

  if (batchesQuery.isError) {
    return (
      <ScreenState
        title={t('adminMasterData.errorTitle')}
        copy={getErrorMessage(batchesQuery.error)}
        tone="error"
      />
    )
  }

  return (
    <section className="page-stack">
      <section className="hero-panel">
        <div>
          <div className="eyebrow">{t('adminMasterData.heroEyebrow')}</div>
          <h2 className="hero-title">{t('adminMasterData.title')}</h2>
          <p className="hero-copy">{t('adminMasterData.heroCopy')}</p>
        </div>
        <div className="hero-metrics">
          <MetricAccent label={t('adminMasterData.batches')} value={String(batchesQuery.data?.meta.total ?? 0)} />
          <MetricAccent
            label={t('adminMasterData.selected')}
            value={selectedBatch ? formatMasterDataEntity(selectedBatch.bootstrapEntity, t) : t('adminMasterData.none')}
          />
          <MetricAccent
            label={t('adminMasterData.readiness')}
            value={
              selectedBatch
                ? formatMasterDataState(selectedBatch.readiness ?? selectedBatch.batchStatus, t)
                : t('adminMasterData.none')
            }
          />
        </div>
      </section>

      {feedback ? (
        <section className="panel">
          <div className="inline-state inline-state-accent">{feedback}</div>
          {promotionResult?.promotedRows.length ? (
            <div className="lineage-chip-list" aria-label={t('adminMasterData.promotionCommandResultAria')}>
              {promotionResult.promotedRows.map((row) => (
                <div className="lineage-chip" key={row.rowId}>
                  <span>{t('adminMasterData.promotedRow')}</span>
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
            <div className="eyebrow">{t('adminMasterData.reviewQueue')}</div>
            <h3>{t('adminMasterData.bootstrapBatches')}</h3>
            <p className="panel-copy">{t('adminMasterData.reviewQueueCopy')}</p>
          </div>
          <div className="toolbar-cluster">
            <label className="search-field">
              <span className="sr-only">{t('adminMasterData.searchBatches')}</span>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={t('adminMasterData.searchPlaceholder')}
              />
            </label>
            <label className="control-select">
              <span className="sr-only">{t('adminMasterData.entityFilter')}</span>
              <select
                value={entityFilter}
                onChange={(event) =>
                  setEntityFilter(event.target.value as 'all' | MasterDataBootstrapEntity)
                }
              >
                <option value="all">{t('adminMasterData.allEntities')}</option>
                <option value="store">{t('adminMasterData.stores')}</option>
                <option value="personnel">{t('adminMasterData.personnel')}</option>
              </select>
            </label>
            <label className="control-select">
              <span className="sr-only">{t('adminMasterData.readinessFilter')}</span>
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
                <option value="all">{t('adminMasterData.allReadiness')}</option>
                <option value="needs_validation">{t('adminMasterData.needsValidation')}</option>
                <option value="needs_review">{t('adminMasterData.needsReview')}</option>
                <option value="ready_to_promote">{t('adminMasterData.readyToPromote')}</option>
                <option value="closed">{t('adminMasterData.closed')}</option>
              </select>
            </label>
          </div>
        </div>

        {batches.length === 0 ? (
          <EmptyState
            title={t('adminMasterData.emptyBatchesTitle')}
            copy={t('adminMasterData.emptyBatchesCopy')}
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
                    {formatMasterDataState(batch.readiness ?? batch.batchStatus, t)}
                  </StatusPill>
                </div>
                <div className="queue-meta">
                  <span>{formatMasterDataEntity(batch.bootstrapEntity, t)}</span>
                  <span>{t('adminMasterData.rowsSuffix', { count: batch.rowCount })}</span>
                  <span>{batch.fileReference ?? t('adminMasterData.noFileReference')}</span>
                  <span>{formatDateTime(getBatchDisplayTimestamp(batch), locale)}</span>
                </div>
                <div className="queue-footer">
                  <span>
                    {t('adminMasterData.queueFooter', {
                      valid: batch.validCount,
                      review: batch.needsReviewCount,
                      invalid: batch.invalidCount,
                      promoted: batch.promotedCount,
                    })}
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
  const { t } = useLocalization()

  if (input.detailLoading || input.readinessLoading) {
    return (
      <ScreenState
        title={t('adminMasterData.detailLoadingTitle')}
        copy={t('adminMasterData.detailLoadingCopy')}
      />
    )
  }

  if (input.detailIsError) {
    return (
      <ScreenState
        title={t('adminMasterData.batchUnavailableTitle')}
        copy={getErrorMessage(input.detailError)}
        tone="error"
      />
    )
  }

  if (input.readinessIsError) {
    return (
      <ScreenState
        title={t('adminMasterData.readinessUnavailableTitle')}
        copy={getErrorMessage(input.readinessError)}
        tone="error"
      />
    )
  }

  if (!input.summary || !input.readiness) {
    return (
      <ScreenState
        title={t('adminMasterData.batchUnavailableTitle')}
        copy={t('adminMasterData.missingEvidenceCopy')}
        tone="error"
      />
    )
  }

  const promoteLabel =
    input.summary.bootstrapEntity === 'store'
      ? t('adminMasterData.promoteStores')
      : t('adminMasterData.promotePersonnel')
  const promotedLabel = `${input.summary.promotedCount} / ${input.summary.rowCount}`

  return (
    <>
      <section className="metric-grid">
        <MetricCard
          title={t('adminMasterData.readyRows')}
          value={input.readiness.readyCount}
          note={t('adminMasterData.nextAction', {
            action: formatMasterDataState(input.readiness.nextAction, t),
          })}
          icon={<ListChecks size={18} />}
          tone="accent"
        />
        <MetricCard
          title={t('adminMasterData.promotedRows')}
          value={input.summary.promotedCount}
          note={promotedLabel}
          icon={<ShieldCheck size={18} />}
          tone="calm"
        />
        <MetricCard
          title={t('adminMasterData.needsValidationMetric')}
          value={input.readiness.needsValidationCount}
          note={t('adminMasterData.needsValidationNote')}
          icon={<DatabaseZap size={18} />}
          tone="warning"
        />
        <MetricCard
          title={t('adminMasterData.blockedRows')}
          value={input.readiness.blockedCount + input.readiness.needsReviewCount}
          note={t('adminMasterData.blockedRowsNote')}
          icon={<UserCheck size={18} />}
          tone={input.readiness.blockedCount + input.readiness.needsReviewCount > 0 ? 'danger' : 'neutral'}
        />
      </section>

      <section className="two-up-grid">
        <article className="panel">
          <div className="panel-heading">
            <div>
              <div className="eyebrow">{t('adminMasterData.selectedBatch')}</div>
              <h3>{input.summary.sourceLabel}</h3>
            </div>
            <StatusPill tone={mapReadinessTone(input.readiness.nextAction)}>
              {formatMasterDataState(input.readiness.nextAction, t)}
            </StatusPill>
          </div>
          <div className="key-grid">
            <KeyValue label={t('adminMasterData.batch')} value={input.batchId} />
            <KeyValue label={t('adminMasterData.entity')} value={formatMasterDataEntity(input.summary.bootstrapEntity, t)} />
            <KeyValue label={t('adminMasterData.status')} value={formatMasterDataState(input.summary.batchStatus, t)} />
            <KeyValue
              label={t('adminMasterData.readiness')}
              value={input.readiness.canPromote ? t('adminMasterData.canPromote') : t('adminMasterData.blocked')}
            />
            <KeyValue label={t('adminMasterData.promotedRows')} value={promotedLabel} />
            <KeyValue label={t('adminMasterData.file')} value={input.summary.fileReference ?? t('adminMasterData.noFileReference')} />
          </div>
        </article>

        <article className="panel">
          <div className="panel-heading">
            <div>
              <div className="eyebrow">{t('adminMasterData.actions')}</div>
              <h3>{t('adminMasterData.backendDecisions')}</h3>
            </div>
          </div>
          <p className="panel-copy">{t('adminMasterData.backendDecisionsCopy')}</p>
          <div className="toolbar-cluster">
            <button
              className="control-button"
              type="button"
              disabled={input.validating}
              onClick={input.onValidate}
            >
              {input.validating ? t('adminMasterData.validating') : t('adminMasterData.validateBatch')}
            </button>
            <button
              className="control-button"
              type="button"
              disabled={!input.readiness.canPromote || input.promoting}
              onClick={input.onPromote}
            >
              {input.promoting ? t('adminMasterData.promoting') : promoteLabel}
            </button>
            {!input.readiness.canPromote ? (
              <span className="inline-state inline-state-warning">
                {t('adminMasterData.promotionDisabled')}
              </span>
            ) : null}
          </div>
        </article>
      </section>

      <section className="panel" aria-label={t('adminMasterData.promotionDryRunEvidenceAria')}>
        <div className="panel-heading">
          <div>
            <div className="eyebrow">{t('adminMasterData.dryRun')}</div>
            <h3>{t('adminMasterData.dryRunTitle')}</h3>
            <p className="panel-copy">{t('adminMasterData.dryRunCopy')}</p>
          </div>
        </div>
        {input.readinessRows.length === 0 ? (
          <EmptyState copy={t('adminMasterData.dryRunEmpty')} />
        ) : (
          <div className="stacked-table">
            {input.readinessRows.map((row) => (
              <div className="stacked-row" key={row.rowId}>
                <div className="stacked-row-head">
                  <strong>#{row.rowNumber} {resolveDryRunRowLabel(row)}</strong>
                  <StatusPill tone={mapPromotionReadinessTone(row.promotionReadiness)}>
                    {formatMasterDataState(row.promotionReadiness, t)}
                  </StatusPill>
                </div>
                <div className="lineage-chip-list">
                  <EvidenceChip label={t('adminMasterData.storeCode')} value={row.sourceStoreCode} />
                  <EvidenceChip label={t('adminMasterData.employeeCode')} value={row.sourceEmployeeCode} />
                  <EvidenceChip label={t('adminMasterData.promotedEntity')} value={row.promotedEntityId} />
                  <EvidenceChip label={t('adminMasterData.blockReason')} value={row.blockReason} />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="panel" aria-label={t('adminMasterData.bootstrapRowEvidenceAria')}>
        <div className="panel-heading">
          <div>
            <div className="eyebrow">{t('adminMasterData.rowEvidence')}</div>
            <h3>{t('adminMasterData.rowEvidenceTitle')}</h3>
          </div>
        </div>
        {input.rows.length === 0 ? (
          <EmptyState copy={t('adminMasterData.rowEvidenceEmpty')} />
        ) : (
          <div className="stacked-table">
            {input.rows.map((row) => (
              <div className="stacked-row" key={row.rowId}>
                <div className="stacked-row-head">
                  <strong>
                    #{row.rowNumber} {resolveRowName(row)}
                  </strong>
                  <StatusPill tone={mapValidationTone(row.validationStatus)}>
                    {formatMasterDataState(row.validationStatus, t)}
                  </StatusPill>
                  {row.issueCode ? (
                    <span className="status-pill status-pill-warning">{row.issueCode}</span>
                  ) : null}
                </div>
                {row.issueMessage ? <p>{row.issueMessage}</p> : null}
                <div className="lineage-chip-list">
                  <EvidenceChip label={t('adminMasterData.storeCode')} value={row.sourceStoreCode} />
                  <EvidenceChip label={t('adminMasterData.employeeCode')} value={row.sourceEmployeeCode} />
                  <EvidenceChip label={t('adminMasterData.resolvedStore')} value={row.resolvedStoreId} />
                  <EvidenceChip label={t('adminMasterData.resolvedEmployee')} value={row.resolvedEmployeeId} />
                  <EvidenceChip label={t('adminMasterData.resolvedPosition')} value={row.resolvedPositionId} />
                  <EvidenceChip label={t('adminMasterData.promotedEntity')} value={row.promotedEntityId} />
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
  const { t } = useLocalization()

  return (
    <div className="lineage-chip">
      <span>{input.label}</span>
      <code className="lineage-code">{input.value ?? t('adminMasterData.notResolved')}</code>
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

function formatMasterDataEntity(entity: MasterDataBootstrapEntity, t: TranslateFunction) {
  switch (entity) {
    case 'store':
      return t('adminMasterData.entity.store')
    case 'personnel':
      return t('adminMasterData.entity.personnel')
    default:
      return entity
  }
}

function formatMasterDataState(value: string, t: TranslateFunction) {
  switch (value) {
    case 'ready_to_promote':
      return t('adminMasterData.status.ready_to_promote')
    case 'promote_ready_rows':
      return t('adminMasterData.status.promote_ready_rows')
    case 'closed':
      return t('adminMasterData.status.closed')
    case 'promoted':
      return t('adminMasterData.status.promoted')
    case 'already_closed':
      return t('adminMasterData.status.already_closed')
    case 'needs_review':
      return t('adminMasterData.status.needs_review')
    case 'review_rows':
      return t('adminMasterData.status.review_rows')
    case 'needs_validation':
      return t('adminMasterData.status.needs_validation')
    case 'blocked':
      return t('adminMasterData.status.blocked')
    case 'ready':
      return t('adminMasterData.status.ready')
    case 'already_promoted':
      return t('adminMasterData.status.already_promoted')
    case 'waiting_batch':
      return t('adminMasterData.status.waiting_batch')
    case 'valid':
      return t('adminMasterData.status.valid')
    case 'pending':
      return t('adminMasterData.status.pending')
    case 'invalid':
      return t('adminMasterData.status.invalid')
    default:
      return value
  }
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
