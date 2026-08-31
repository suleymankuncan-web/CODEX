/* eslint-disable react-refresh/only-export-components */
import { useRef, useState } from 'react'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import {
  getImportBatchAudit,
  getImportBatchErrors,
  type AuditEvent,
  type ExternalIdMapCandidate,
  type ImportBatchError,
} from './api'
import {
  LineageChip,
  LineageChipList,
} from './import-batch-detail-surface-primitives'
import {
  buildAuditExportRows,
  buildErrorExportRows,
  formatEntityType,
  formatErrorCategory,
} from './import-batch-detail-evidence'
import { mapErrorTone } from './integration-surface-tone'
import type { TranslateFunction } from '../localization/dictionary'
import { formatDateTime, getErrorMessage } from '../../lib/format'
import { actionToast } from '../../lib/action-toast'
import { downloadCsv } from '../../lib/download-csv'
import {
  fetchAllPaginated,
  isPaginatedExportError,
  PAGINATED_EXPORT_PAGE_SIZE,
} from '../../lib/paginated-export'
import type { AppLocale } from '../../lib/i18n'
import {
  AdminActionRow,
  AdminSurfaceBadge,
  AdminSurfaceEmpty,
  AdminSurfaceSection,
} from '../../pages/admin-surface-primitives'

export type MappingEntityType = 'employee' | 'store'

export type MappingApprovalInput = {
  rowId: string
  integrationSourceId: string
  entityType: MappingEntityType
  externalId: string
  internalId: string
  internalTableName?: string
}

export type CandidateQueryState = {
  data: { items: ExternalIdMapCandidate[] } | undefined
  isLoading: boolean
  isError: boolean
  error: unknown
}

export type PaginationMeta = {
  count: number
  total: number
  limit: number
  offset: number
}

export function ErrorRowsPanel(input: {
  batchId: string
  candidateQueries: Record<MappingEntityType, CandidateQueryState>
  errors: ImportBatchError[]
  errorMeta: PaginationMeta | undefined
  errorIsFetching: boolean
  errorOffset: number
  mappingInputs: Record<string, string>
  mappingState: {
    isPending: boolean
    variables: MappingApprovalInput | undefined
  }
  searchInputs: Record<MappingEntityType, string>
  onApproveMapping: (input: MappingApprovalInput) => void
  onMappingInputChange: (rowId: string, value: string) => void
  onSearchInputChange: (entityType: MappingEntityType, value: string) => void
  onErrorOffsetChange: (offset: number) => void
  t: TranslateFunction
}) {
  const {
    batchId,
    candidateQueries,
    errors,
    errorMeta,
    errorIsFetching,
    errorOffset,
    mappingInputs,
    mappingState,
    searchInputs,
    onApproveMapping,
    onErrorOffsetChange,
    onMappingInputChange,
    onSearchInputChange,
    t,
  } = input
  const [isExporting, setIsExporting] = useState(false)
  const exportInFlightRef = useRef(false)
  const canExport = (errorMeta?.total ?? errors.length) > 0
  const handleExport = async () => {
    if (exportInFlightRef.current || !canExport) {
      return
    }

    exportInFlightRef.current = true
    setIsExporting(true)
    try {
      const allErrors = await fetchAllPaginated(
        ({ limit, offset }) => getImportBatchErrors(batchId, { limit, offset }),
        {
          pageSize: PAGINATED_EXPORT_PAGE_SIZE,
          requireRevision: true,
          getStableKey: (item) => item.rowId,
        },
      )

      downloadCsvForErrors(batchId, allErrors)
    } catch (error) {
      actionToast.error(
        error,
        isPaginatedExportError(error) && error.reason === 'too_many_rows'
          ? t('importBatchDetail.exportTooLarge')
          : t('importBatchDetail.exportFailed'),
      )
    } finally {
      exportInFlightRef.current = false
      setIsExporting(false)
    }
  }

  return (
    <AdminSurfaceSection
      actions={
        <Button
          variant="outline"
          type="button"
          onClick={handleExport}
          disabled={isExporting || !canExport}
          aria-busy={isExporting}
        >
          {isExporting ? t('importBatchDetail.exportPreparing') : t('importBatchDetail.exportErrors')}
        </Button>
      }
      eyebrow={t('importBatchDetail.errorRows')}
      title={t('importBatchDetail.whyRowsFailed')}
    >
      {errors.length === 0 ? (
        <AdminSurfaceEmpty copy={t('importBatchDetail.noRowErrors')} />
      ) : (
        <div className="tw:grid tw:gap-2">
          {errors.map((error) => (
            <ImportBatchErrorRow
              candidateQueries={candidateQueries}
              error={error}
              key={error.rowId}
              mappingInputs={mappingInputs}
              mappingState={mappingState}
              searchInputs={searchInputs}
              onApproveMapping={onApproveMapping}
              onMappingInputChange={onMappingInputChange}
              onSearchInputChange={onSearchInputChange}
              t={t}
            />
          ))}
        </div>
      )}
      <AuditPagination
        isFetching={errorIsFetching}
        meta={errorMeta}
        offset={errorOffset}
        onOffsetChange={onErrorOffsetChange}
        nextLabel={t('adminIntegrations.next')}
        previousLabel={t('adminIntegrations.previous')}
      />
    </AdminSurfaceSection>
  )
}

function downloadCsvForErrors(batchId: string, errors: ImportBatchError[]) {
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
    rows: buildErrorExportRows(errors),
  })
}

export function useScopedOffset(scopeKey: string) {
  const [page, setPage] = useState({ scopeKey, offset: 0 })
  const offset = page.scopeKey === scopeKey ? page.offset : 0
  const setOffset = (nextOffset: number) => setPage({ scopeKey, offset: nextOffset })

  return [offset, setOffset] as const
}

function ImportBatchErrorRow(input: {
  candidateQueries: Record<MappingEntityType, CandidateQueryState>
  error: ImportBatchError
  mappingInputs: Record<string, string>
  mappingState: {
    isPending: boolean
    variables: MappingApprovalInput | undefined
  }
  searchInputs: Record<MappingEntityType, string>
  onApproveMapping: (input: MappingApprovalInput) => void
  onMappingInputChange: (rowId: string, value: string) => void
  onSearchInputChange: (entityType: MappingEntityType, value: string) => void
  t: TranslateFunction
}) {
  const { candidateQueries, error, mappingInputs, mappingState, searchInputs, onApproveMapping, onMappingInputChange, onSearchInputChange, t } = input
  const isApproving = mappingState.isPending && mappingState.variables?.rowId === error.rowId

  return (
    <article className="tw:rounded-lg tw:border tw:border-border tw:bg-background/60 tw:p-3">
      <div className="tw:flex tw:flex-wrap tw:items-center tw:gap-2">
        <strong className="tw:text-sm tw:font-medium tw:text-foreground">{error.sourceRef}</strong>
        <AdminSurfaceBadge tone={mapErrorTone(error.errorCategory)}>
          {formatErrorCategory(error.errorCategory, t)}
        </AdminSurfaceBadge>
        {error.qualityIssueCode ? (
          <AdminSurfaceBadge tone="accent">
            {t('importBatchDetail.qualityIssuePrefix', { code: error.qualityIssueCode })}
          </AdminSurfaceBadge>
        ) : null}
      </div>
      <p className="tw:mt-2 tw:text-sm tw:leading-6 tw:text-muted-foreground">
        {error.validationError ?? t('importBatchDetail.noValidationMessage')}
      </p>
      <ErrorLineageChips error={error} t={t} />
      {error.mappingCandidate ? (
        <MappingAction
          candidateQuery={candidateQueries[error.mappingCandidate.entityType]}
          error={error}
          isApproving={isApproving}
          mappingValue={mappingInputs[error.rowId] ?? ''}
          searchValue={searchInputs[error.mappingCandidate.entityType]}
          onApproveMapping={onApproveMapping}
          onMappingInputChange={onMappingInputChange}
          onSearchInputChange={onSearchInputChange}
          t={t}
        />
      ) : null}
    </article>
  )
}

function ErrorLineageChips(input: { error: ImportBatchError; t: TranslateFunction }) {
  const { error, t } = input

  if (!error.rawRowReference && !error.rowHash) {
    return null
  }

  return (
    <LineageChipList ariaLabel={t('importBatchDetail.rowLineageAria')}>
      {error.rawRowReference ? (
        <LineageChip label={t('importBatchDetail.rawReference')} value={error.rawRowReference} />
      ) : null}
      {error.rowHash ? (
        <LineageChip label={t('importBatchDetail.rowHash')} value={error.rowHash} />
      ) : null}
    </LineageChipList>
  )
}

function MappingAction(input: {
  candidateQuery: CandidateQueryState
  error: ImportBatchError
  isApproving: boolean
  mappingValue: string
  searchValue: string
  onApproveMapping: (input: MappingApprovalInput) => void
  onMappingInputChange: (rowId: string, value: string) => void
  onSearchInputChange: (entityType: MappingEntityType, value: string) => void
  t: TranslateFunction
}) {
  const { candidateQuery, error, isApproving, mappingValue, searchValue, onApproveMapping, onMappingInputChange, onSearchInputChange, t } = input
  const mappingCandidate = error.mappingCandidate

  if (!mappingCandidate) {
    return null
  }

  const entityType = mappingCandidate.entityType
  const entityLabel = formatEntityType(entityType, t)
  const candidates = candidateQuery.data?.items ?? []

  return (
    <div
      className="tw:mt-3 tw:grid tw:gap-3 tw:rounded-lg tw:border tw:border-border tw:bg-card/70 tw:p-3"
      aria-label={t('importBatchDetail.mappingAria')}
    >
      <div className="tw:flex tw:flex-wrap tw:gap-2">
        <LineageChip
          label={t('importBatchDetail.externalEntity', { entity: entityLabel })}
          value={mappingCandidate.externalId}
        />
        <LineageChip
          label={t('importBatchDetail.targetTable')}
          value={mappingCandidate.internalTableName}
        />
      </div>
      <div className="tw:grid tw:grid-cols-1 tw:gap-2 tw:lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] tw:lg:items-start">
        <Input
          type="text"
          aria-label={t('importBatchDetail.searchInternalCandidatesForExternal', {
            entity: entityLabel,
            externalId: mappingCandidate.externalId,
          })}
          value={searchValue}
          placeholder={t('importBatchDetail.searchInternalCandidates', { entity: entityLabel })}
          onChange={(event) => onSearchInputChange(entityType, event.target.value)}
        />
        <select
          className="tw:h-8 tw:min-w-0 tw:rounded-lg tw:border tw:border-border tw:bg-background tw:px-2.5 tw:text-sm tw:font-medium tw:text-foreground tw:shadow-sm tw:outline-none focus-visible:tw:border-ring focus-visible:tw:ring-3 focus-visible:tw:ring-ring/50 disabled:tw:opacity-50"
          aria-label={t('importBatchDetail.mapToInternalForExternal', {
            entity: entityLabel,
            externalId: mappingCandidate.externalId,
          })}
          value={mappingValue}
          disabled={candidateQuery.isLoading || candidates.length === 0}
          onChange={(event) => onMappingInputChange(error.rowId, event.target.value)}
        >
          <option value="">{t('importBatchDetail.selectInternal', { entity: entityLabel })}</option>
          {candidates.map((candidate) => (
            <option key={candidate.internalId} value={candidate.internalId}>
              {candidate.label} - {candidate.secondaryLabel}
            </option>
          ))}
        </select>
        <Button
          type="button"
          aria-label={t(
            isApproving
              ? 'importBatchDetail.approvingMappingForExternal'
              : 'importBatchDetail.approveMappingForExternal',
            {
              externalId: mappingCandidate.externalId,
            },
          )}
          aria-busy={isApproving}
          disabled={!mappingValue.trim() || isApproving}
          onClick={() =>
            onApproveMapping({
              rowId: error.rowId,
              integrationSourceId: mappingCandidate.integrationSourceId,
              entityType: mappingCandidate.entityType,
              externalId: mappingCandidate.externalId,
              internalTableName: mappingCandidate.internalTableName,
              internalId: mappingValue.trim(),
            })
          }
        >
          {isApproving ? t('importBatchDetail.approving') : t('importBatchDetail.approveMapping')}
        </Button>
        <MappingCandidateState candidateQuery={candidateQuery} candidateCount={candidates.length} t={t} />
      </div>
    </div>
  )
}

function MappingCandidateState(input: {
  candidateQuery: CandidateQueryState
  candidateCount: number
  t: TranslateFunction
}) {
  const { candidateQuery, candidateCount, t } = input

  if (candidateQuery.isLoading) {
    return <span className="tw:text-xs tw:text-muted-foreground">{t('importBatchDetail.loadingInternalCandidates')}</span>
  }

  if (candidateQuery.isError) {
    return (
      <span className="tw:text-xs tw:text-destructive">
        {t('importBatchDetail.candidateListUnavailable', { message: getErrorMessage(candidateQuery.error) })}
      </span>
    )
  }

  if (candidateCount === 0) {
    return <span className="tw:text-xs tw:text-muted-foreground">{t('importBatchDetail.noCandidatesFound')}</span>
  }

  return null
}

export function AuditTimelinePanel(input: {
  auditIsFetching: boolean
  auditMeta: PaginationMeta | undefined
  auditOffset: number
  auditItems: AuditEvent[]
  batchId: string
  locale: AppLocale
  onAuditOffsetChange: (offset: number) => void
  t: TranslateFunction
}) {
  const {
    auditIsFetching,
    auditMeta,
    auditOffset,
    auditItems,
    batchId,
    locale,
    onAuditOffsetChange,
    t,
  } = input
  const [isExporting, setIsExporting] = useState(false)
  const exportInFlightRef = useRef(false)
  const canExport = (auditMeta?.total ?? auditItems.length) > 0
  const handleExport = async () => {
    if (exportInFlightRef.current || !canExport) {
      return
    }

    exportInFlightRef.current = true
    setIsExporting(true)
    try {
      const allAuditItems = await fetchAllPaginated(
        ({ limit, offset }) => getImportBatchAudit(batchId, { limit, offset }),
        {
          pageSize: PAGINATED_EXPORT_PAGE_SIZE,
          getStableKey: (item) => item.eventLogId,
        },
      )

      downloadCsvForAudit(batchId, allAuditItems)
    } catch (error) {
      actionToast.error(
        error,
        isPaginatedExportError(error) && error.reason === 'too_many_rows'
          ? t('importBatchDetail.exportTooLarge')
          : t('importBatchDetail.exportFailed'),
      )
    } finally {
      exportInFlightRef.current = false
      setIsExporting(false)
    }
  }

  return (
    <AdminSurfaceSection
      actions={
        <Button
          variant="outline"
          type="button"
          onClick={handleExport}
          disabled={isExporting || !canExport}
          aria-busy={isExporting}
        >
          {isExporting ? t('importBatchDetail.exportPreparing') : t('importBatchDetail.exportAudit')}
        </Button>
      }
      eyebrow={t('importBatchDetail.auditTimeline')}
      title={t('importBatchDetail.operatorTrace')}
    >
      {auditItems.length === 0 ? (
        <AdminSurfaceEmpty copy={t('importBatchDetail.noAuditEntries')} />
      ) : (
        <div className="tw:grid tw:gap-3">
          {auditItems.map((event) => (
            <article
              className="tw:grid tw:grid-cols-[auto_minmax(0,1fr)] tw:gap-3 tw:rounded-lg tw:border tw:border-border tw:bg-background/60 tw:p-3"
              key={event.eventLogId}
            >
              <span className="tw:mt-1 tw:size-2 tw:rounded-full tw:bg-primary" />
              <div className="tw:min-w-0">
                <strong className="tw:text-sm tw:font-medium tw:text-foreground">{event.eventType}</strong>
                <p className="tw:mt-1 tw:text-xs tw:text-muted-foreground">{formatDateTime(event.occurredAt, locale)}</p>
                <span className="tw:mt-1 tw:block tw:break-words tw:text-xs tw:text-muted-foreground">
                  {t('importBatchDetail.auditActorLine', {
                    actor: event.actorUserId ?? t('importBatchDetail.system'),
                    correlation: event.correlationId ?? t('importBatchDetail.none'),
                  })}
                </span>
              </div>
            </article>
          ))}
        </div>
      )}
      <AuditPagination
        isFetching={auditIsFetching}
        meta={auditMeta}
        offset={auditOffset}
        onOffsetChange={onAuditOffsetChange}
        nextLabel={t('adminIntegrations.next')}
        previousLabel={t('adminIntegrations.previous')}
      />
    </AdminSurfaceSection>
  )
}

function downloadCsvForAudit(batchId: string, auditItems: AuditEvent[]) {
  downloadCsv({
    filename: `import-batch-audit-${batchId}.csv`,
    columns: ['eventLogId', 'occurredAt', 'actorUserId', 'correlationId', 'eventType'],
    rows: buildAuditExportRows(auditItems),
  })
}

function AuditPagination(input: {
  isFetching: boolean
  meta: PaginationMeta | undefined
  nextLabel: string
  offset: number
  onOffsetChange: (offset: number) => void
  previousLabel: string
}) {
  if (!input.meta) {
    return null
  }

  const pageOffset = input.meta.offset
  const pageLimit = Math.max(input.meta.limit, 1)
  const firstItem = input.meta.total === 0 ? 0 : pageOffset + 1
  const lastItem = Math.min(input.meta.total, pageOffset + input.meta.count)
  const canGoPrevious = pageOffset > 0
  const canGoNext = pageOffset + input.meta.count < input.meta.total

  return (
    <AdminActionRow className="tw:justify-between">
      <Button
        type="button"
        variant="outline"
        aria-label={input.previousLabel}
        disabled={input.isFetching || !canGoPrevious}
        onClick={() => input.onOffsetChange(Math.max(0, pageOffset - pageLimit))}
      >
        {input.previousLabel}
      </Button>
      <AdminSurfaceBadge tone="neutral">
        {firstItem}-{lastItem} / {input.meta.total}
      </AdminSurfaceBadge>
      <Button
        type="button"
        variant="outline"
        aria-label={input.nextLabel}
        disabled={input.isFetching || !canGoNext}
        onClick={() => input.onOffsetChange(pageOffset + pageLimit)}
      >
        {input.nextLabel}
      </Button>
    </AdminActionRow>
  )
}
