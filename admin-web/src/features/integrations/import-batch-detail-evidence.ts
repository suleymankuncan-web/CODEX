import type {
  AuditEvent,
  ImportBatchDetail,
  ImportBatchError,
  ImportBatchReconciliation,
} from './api'
import type { TranslateFunction } from '../localization/dictionary'
import type { AdminSurfaceTone } from '../../pages/admin-surface-primitives'

export function formatRowCount(count: number, t: TranslateFunction) {
  return t(
    count === 1
      ? 'importBatchDetail.rowCountSingular'
      : 'importBatchDetail.rowCountPlural',
    { count },
  )
}

export type ImportDecisionEvidence = {
  label: string
  tone: AdminSurfaceTone
  summary: string
  factors: [string, string][]
}

export type KpiReviewCategory =
  | 'employee_match'
  | 'store_match'
  | 'suspicious_row'
  | 'system_retry'

export type KpiReviewItem = {
  rowId: string
  sourceRef: string
  category: KpiReviewCategory
  categoryLabel: string
  actionLabel: string
  tone: AdminSurfaceTone
  externalRef: string | null
  issueCode: string | null
  message: string
  rawRowReference: string | null
  rowHash: string | null
}

export type KpiReviewEvidence = {
  label: string
  tone: AdminSurfaceTone
  summary: string
  employeeMatchRows: number
  storeMatchRows: number
  suspiciousRows: number
  visibleErrorRows: number
  totalErrorRows: number
  items: KpiReviewItem[]
}

export function buildImportDecisionEvidence(input: {
  detail: ImportBatchDetail
  reconciliation?: ImportBatchReconciliation
  errors: ImportBatchError[]
  t: TranslateFunction
}): ImportDecisionEvidence {
  const { detail, reconciliation, errors, t } = input
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
  const rowAccounting = getRowAccountingStatus(reconciliation, t)
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

  let label = t('importBatchDetail.go')
  let tone: AdminSurfaceTone = 'success'
  let summary = t('importBatchDetail.goSummary')

  if (!reconciliation) {
    label = t('importBatchDetail.conditionalGo')
    tone = 'warning'
    summary = t('importBatchDetail.conditionalWaitingSummary')
  } else if (hasRowAccountingFailure || hasPendingRows || blockedByEntityTypes.length > 0 || isStoppedState) {
    label = t('importBatchDetail.noGo')
    tone = 'danger'
    summary = t('importBatchDetail.noGoSummary')
  } else if (hasConditionalEvidence) {
    label = t('importBatchDetail.conditionalGo')
    tone = 'warning'
    summary = t('importBatchDetail.conditionalReviewSummary')
  }

  return {
    label,
    tone,
    summary,
    factors: [
      [t('importBatchDetail.rowAccounting'), rowAccounting],
      [t('importBatchDetail.qualityGuard'), formatQualityGuardStatus(highSeverityRows, totalIssueRows, t)],
      [t('importBatchDetail.retryEvidence'), formatRetryEvidenceStatus(retryableRows, detail.canRetryNow, t)],
      [t('importBatchDetail.dependencyMapping'), formatDependencyMappingStatus(blockedByEntityTypes, mappingRows, t)],
    ],
  }
}

export function buildKpiReviewEvidence(input: {
  errors: ImportBatchError[]
  totalErrorRows: number
  t: TranslateFunction
}): KpiReviewEvidence {
  const items = input.errors.flatMap((error) => {
    const item = toKpiReviewItem(error, input.t)
    return item ? [item] : []
  })
  const employeeMatchRows = items.filter(
    (item) => item.category === 'employee_match',
  ).length
  const storeMatchRows = items.filter((item) => item.category === 'store_match').length
  const suspiciousRows = items.filter(
    (item) => item.category === 'suspicious_row',
  ).length
  const mappingRows = employeeMatchRows + storeMatchRows
  const totalReviewRows = mappingRows + suspiciousRows
  const hiddenErrorRows = Math.max(input.totalErrorRows - input.errors.length, 0)

  if (mappingRows > 0) {
    return {
      label: input.t('importBatchDetail.reviewRequired'),
      tone: 'danger',
      summary:
        hiddenErrorRows > 0
          ? input.t('importBatchDetail.kpiReviewRequiredHidden', {
              visible: input.errors.length,
              total: input.totalErrorRows,
            })
          : input.t('importBatchDetail.kpiReviewRequired'),
      employeeMatchRows,
      storeMatchRows,
      suspiciousRows,
      visibleErrorRows: input.errors.length,
      totalErrorRows: input.totalErrorRows,
      items,
    }
  }

  if (totalReviewRows > 0) {
    return {
      label: input.t('importBatchDetail.needsCheck'),
      tone: 'warning',
      summary:
        hiddenErrorRows > 0
          ? input.t('importBatchDetail.kpiNeedsCheckHidden', {
              visible: input.errors.length,
              total: input.totalErrorRows,
            })
          : input.t('importBatchDetail.kpiNeedsCheck'),
      employeeMatchRows,
      storeMatchRows,
      suspiciousRows,
      visibleErrorRows: input.errors.length,
      totalErrorRows: input.totalErrorRows,
      items,
    }
  }

  return {
    label: input.t('importBatchDetail.clear'),
    tone: 'success',
    summary: input.t('importBatchDetail.kpiClear'),
    employeeMatchRows,
    storeMatchRows,
    suspiciousRows,
    visibleErrorRows: input.errors.length,
    totalErrorRows: input.totalErrorRows,
    items,
  }
}

export function buildKpiReviewExportRows(errors: ImportBatchError[], t: TranslateFunction) {
  return buildKpiReviewEvidence({ errors, totalErrorRows: errors.length, t }).items.map((item) => [
    item.rowId,
    item.categoryLabel,
    item.sourceRef,
    item.externalRef ?? '',
    item.issueCode ?? '',
    item.message,
    item.rawRowReference ?? '',
    item.rowHash ?? '',
  ])
}

export function buildErrorExportRows(errors: ImportBatchError[]) {
  return errors.map((error) => [
    error.rowId,
    error.sourceRef,
    error.normalizedStatus,
    error.errorCategory,
    error.qualityIssueCode ?? '',
    error.mappingCandidate?.externalId ?? '',
    error.validationError,
    error.processedAt,
  ])
}

export function buildAuditExportRows(auditItems: AuditEvent[]) {
  return auditItems.map((event) => [
    event.eventLogId,
    event.occurredAt,
    event.actorUserId,
    event.correlationId,
    event.eventType,
  ])
}

function toKpiReviewItem(error: ImportBatchError, t: TranslateFunction): KpiReviewItem | null {
  const issueCode = error.qualityIssueCode ?? null
  const externalRef = error.mappingCandidate?.externalId ?? null

  if (error.mappingCandidate?.entityType === 'employee' || issueCode === 'unmapped_employee') {
    return {
      rowId: error.rowId,
      sourceRef: error.sourceRef,
      category: 'employee_match',
      categoryLabel: t('importBatchDetail.employeeMatch'),
      actionLabel: t('importBatchDetail.mapEmployee'),
      tone: 'danger',
      externalRef,
      issueCode,
      message: error.validationError ?? t('importBatchDetail.employeeReferenceUnresolved'),
      rawRowReference: error.rawRowReference ?? null,
      rowHash: error.rowHash ?? null,
    }
  }

  if (error.mappingCandidate?.entityType === 'store' || issueCode === 'unmapped_store') {
    return {
      rowId: error.rowId,
      sourceRef: error.sourceRef,
      category: 'store_match',
      categoryLabel: t('importBatchDetail.storeMatch'),
      actionLabel: t('importBatchDetail.mapStore'),
      tone: 'danger',
      externalRef,
      issueCode,
      message: error.validationError ?? t('importBatchDetail.storeReferenceUnresolved'),
      rawRowReference: error.rawRowReference ?? null,
      rowHash: error.rowHash ?? null,
    }
  }

  if (isSuspiciousKpiIssue(issueCode)) {
    return {
      rowId: error.rowId,
      sourceRef: error.sourceRef,
      category: 'suspicious_row',
      categoryLabel: t('importBatchDetail.suspiciousRow'),
      actionLabel: t('importBatchDetail.manualCheck'),
      tone: 'warning',
      externalRef,
      issueCode,
      message: error.validationError ?? t('importBatchDetail.kpiManualCheckRequired'),
      rawRowReference: error.rawRowReference ?? null,
      rowHash: error.rowHash ?? null,
    }
  }

  if (error.errorCategory === 'write_failure' || error.normalizedStatus === 'retryable_error') {
    return {
      rowId: error.rowId,
      sourceRef: error.sourceRef,
      category: 'system_retry',
      categoryLabel: t('importBatchDetail.retryRow'),
      actionLabel: t('importBatchDetail.retryBatch'),
      tone: 'danger',
      externalRef,
      issueCode,
      message: error.validationError ?? t('importBatchDetail.systemRetryRequired'),
      rawRowReference: error.rawRowReference ?? null,
      rowHash: error.rowHash ?? null,
    }
  }

  return null
}

function isSuspiciousKpiIssue(issueCode: string | null) {
  return (
    issueCode === 'duplicate_source_row' ||
    issueCode === 'late_correction_candidate' ||
    issueCode === 'schema_mismatch' ||
    issueCode === 'invalid_metric' ||
    issueCode === 'missing_identity'
  )
}

function getRowAccountingStatus(
  reconciliation: ImportBatchReconciliation | undefined,
  t: TranslateFunction,
) {
  if (!reconciliation) return t('importBatchDetail.waitingForReconciliation')
  if (reconciliation.totals.unaccountedRows > 0) {
    return t('importBatchDetail.unaccountedRows', {
      count: reconciliation.totals.unaccountedRows,
    })
  }
  if (!reconciliation.totals.countsMatchRecordCount) return t('importBatchDetail.recordCountMismatch')
  return t('importBatchDetail.accountedAndMatched')
}

function formatQualityGuardStatus(
  highSeverityRows: number,
  totalIssueRows: number,
  t: TranslateFunction,
) {
  if (highSeverityRows > 0) {
    return t('importBatchDetail.highSeverityRows', { count: highSeverityRows })
  }
  if (totalIssueRows > 0) return t('importBatchDetail.classifiedRows', { count: totalIssueRows })
  return t('importBatchDetail.noClassifiedIssues')
}

function formatRetryEvidenceStatus(
  retryableRows: number,
  canRetryNow: boolean,
  t: TranslateFunction,
) {
  if (retryableRows === 0) return t('importBatchDetail.noRetryNeeded')
  return canRetryNow ? t('importBatchDetail.retryAvailable') : t('importBatchDetail.retryBlocked')
}

function formatDependencyMappingStatus(
  blockedByEntityTypes: string[],
  mappingRows: number,
  t: TranslateFunction,
) {
  if (blockedByEntityTypes.length > 0) {
    return t('importBatchDetail.blockedByValue', {
      entities: blockedByEntityTypes.map((entity) => formatEntityType(entity, t)).join(', '),
    })
  }
  if (mappingRows > 0) return t('importBatchDetail.mappingRowsPending', { count: mappingRows })
  return t('importBatchDetail.noDependencyBlock')
}

export function formatQualityIssueLabel(code: string, fallback: string, t: TranslateFunction) {
  if (code === 'unmapped_store') return t('importBatchDetail.qualityIssue.unmapped_store.label')
  if (code === 'unmapped_employee') return t('importBatchDetail.qualityIssue.unmapped_employee.label')
  return fallback
}

export function formatQualityIssueDescription(code: string, fallback: string, t: TranslateFunction) {
  if (code === 'unmapped_store') return t('importBatchDetail.qualityIssue.unmapped_store.description')
  if (code === 'unmapped_employee') return t('importBatchDetail.qualityIssue.unmapped_employee.description')
  return fallback
}

export function formatIssueOwner(owner: string, t: TranslateFunction) {
  if (owner === 'mapping') return t('importBatchDetail.issueOwner.mapping')
  if (owner === 'data') return t('importBatchDetail.issueOwner.data')
  if (owner === 'system') return t('importBatchDetail.issueOwner.system')
  return owner
}

export function formatQualitySeverity(severity: string, t: TranslateFunction) {
  if (severity === 'high') return t('importBatchDetail.severity.high')
  if (severity === 'medium') return t('importBatchDetail.severity.medium')
  if (severity === 'low') return t('importBatchDetail.severity.low')
  return severity
}

export function formatEntityType(entityType: string, t: TranslateFunction) {
  if (entityType === 'employee') return t('importBatchDetail.entity.employee')
  if (entityType === 'store') return t('importBatchDetail.entity.store')
  if (entityType === 'position') return t('importBatchDetail.entity.position')
  if (entityType === 'region') return t('importBatchDetail.entity.region')
  if (entityType === 'company') return t('importBatchDetail.entity.company')
  if (entityType === 'manager') return t('importBatchDetail.entity.manager')
  return entityType.replaceAll('_', ' ')
}

export function formatStateLabel(state: string, t: TranslateFunction) {
  if (state === 'completed_with_errors') return t('importBatchDetail.state.completed_with_errors')
  if (state === 'retry_ready') return t('importBatchDetail.state.retry_ready')
  if (state === 'completed') return t('importBatchDetail.state.completed')
  if (state === 'failed') return t('importBatchDetail.state.failed')
  if (state === 'stuck') return t('importBatchDetail.state.stuck')
  if (state === 'pending') return t('importBatchDetail.state.pending')
  if (state === 'queued') return t('importBatchDetail.state.queued')
  if (state === 'processing') return t('importBatchDetail.state.processing')
  if (state === 'healthy') return t('importBatchDetail.state.healthy')
  if (state === 'blocked') return t('importBatchDetail.state.blocked')
  if (state === 'needs_action') return t('importBatchDetail.state.needs_action')
  return state.replaceAll('_', ' ')
}

export function formatErrorCategory(category: string, t: TranslateFunction) {
  if (category === 'validation') return t('importBatchDetail.errorCategory.validation')
  if (category === 'missing_dependency') return t('importBatchDetail.errorCategory.missing_dependency')
  if (category === 'write_failure') return t('importBatchDetail.errorCategory.write_failure')
  return category.replaceAll('_', ' ')
}
