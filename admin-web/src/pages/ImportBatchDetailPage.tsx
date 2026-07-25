import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, CircleDashed, Network, RefreshCw } from 'lucide-react'
import { Link, useParams } from 'react-router'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { downloadCsv } from '../lib/download-csv'
import {
  approveExternalIdMap,
  getExternalIdMapCandidates,
  getImportBatchAudit,
  getImportBatchDetail,
  getImportBatchErrors,
  getImportBatchReconciliation,
  retryImportBatch,
  type AuditEvent,
  type ExternalIdMapCandidate,
  type ImportBatchDetail,
  type ImportBatchError,
  type ImportBatchReconciliation,
} from '../features/integrations/api'
import {
  DependencyCard,
  DetailList,
  DetailProgressRow,
  LineageChip,
  LineageChipList,
  ReconciliationStat,
} from '../features/integrations/import-batch-detail-surface-primitives'
import { mapErrorTone, mapQualitySeverityTone, toAdminTone } from '../features/integrations/integration-surface-tone'
import { useLocalization } from '../features/localization/useLocalization'
import type { TranslateFunction } from '../features/localization/dictionary'
import { formatDateTime, getErrorMessage, mapHealthTone } from '../lib/format'
import type { AppLocale } from '../lib/i18n'
import {
  AdminActionRow,
  AdminKeyValueGrid,
  AdminStatePanel,
  AdminSurfaceBadge,
  AdminSurfaceEmpty,
  AdminSurfacePage,
  AdminSurfaceSection,
  type AdminMetricStripItem,
  type AdminSurfaceTone,
} from './admin-surface-primitives'
import { AdminOperationalHeader, AdminOperationalMetrics, AdminOperationalPage } from './admin-operational-primitives'

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
  const { locale, t } = useLocalization()

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
    queryKey: ['import-batch-errors', batchId, { limit: 200 }],
    queryFn: () => getImportBatchErrors(batchId, { limit: 200, offset: 0 }),
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
        ...(storeCandidateSearch ? { q: storeCandidateSearch } : {}),
        limit: 25,
      }),
    enabled: hasStoreMapping,
  })
  const employeeCandidatesQuery = useQuery({
    queryKey: ['external-id-map-candidates', 'employee', employeeCandidateSearch],
    queryFn: () =>
      getExternalIdMapCandidates({
        entityType: 'employee',
        ...(employeeCandidateSearch ? { q: employeeCandidateSearch } : {}),
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
        ...(input.internalTableName === undefined ? {} : { internalTableName: input.internalTableName }),
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
    return (
      <AdminSurfacePage>
        <AdminStatePanel
          title={t('importBatchDetail.batchIdMissingTitle')}
          description={t('importBatchDetail.batchIdMissingCopy')}
          tone="warning"
        />
      </AdminSurfacePage>
    )
  }

  if (detailQuery.isLoading) {
    return (
      <AdminSurfacePage>
        <AdminStatePanel
          title={t('importBatchDetail.loadingTitle')}
          description={t('importBatchDetail.loadingCopy')}
          isLoading
        />
      </AdminSurfacePage>
    )
  }

  if (detailQuery.isError || !detailQuery.data) {
    return (
      <AdminSurfacePage>
        <AdminStatePanel
          title={t('importBatchDetail.unavailableTitle')}
          description={getErrorMessage(detailQuery.error)}
          tone="danger"
        />
      </AdminSurfacePage>
    )
  }

  const detail = detailQuery.data
  const reconciliation = reconciliationQuery.data
  const errors = errorItems
  const auditItems = auditQuery.data?.items ?? []
  const qualityIssueItems = detail.qualityIssueSummary?.items ?? []
  const importDecision = buildImportDecisionEvidence({
    detail,
    ...(reconciliation === undefined ? {} : { reconciliation }),
    errors,
    t,
  })
  const kpiReviewEvidence = buildKpiReviewEvidence({
    errors,
    totalErrorRows: errorsQuery.data?.meta.total ?? errors.length,
    t,
  })

  return (
    <AdminOperationalPage ariaLabel={t('importBatchDetail.heroEyebrow')}>
      <AdminActionRow>
        <Button asChild variant="outline">
          <Link to="/admin/integrations">
            <ArrowLeft aria-hidden="true" />
            {t('importBatchDetail.backToQueue')}
          </Link>
        </Button>
      </AdminActionRow>

      <ImportBatchHero detail={detail} t={t} />
      <FeedbackPanel feedback={feedback} />
      <ImportDecisionPanel evidence={importDecision} t={t} />
      <BatchSummaryGrid
        detail={detail}
        isRetrying={retryMutation.isPending}
        locale={locale}
        onRetry={() => retryMutation.mutate(batchId)}
        t={t}
      />

      <QualitySummaryPanel
        detail={detail}
        qualityIssueItems={qualityIssueItems}
        t={t}
      />
      <KpiReviewPanel
        batchId={batchId}
        entityType={detail.batch.entityType}
        evidence={kpiReviewEvidence}
        t={t}
      />

      <LineagePanel detail={detail} t={t} />
      <ReconciliationGrid detail={detail} reconciliation={reconciliation} t={t} />

      <div className="tw:grid tw:grid-cols-1 tw:gap-4 tw:xl:grid-cols-[minmax(0,1.4fr)_minmax(20rem,0.8fr)]">
        <ErrorRowsPanel
          batchId={batchId}
          candidateQueries={{
            employee: employeeCandidatesQuery,
            store: storeCandidatesQuery,
          }}
          errors={errors}
          mappingInputs={mappingInputs}
          mappingState={{
            isPending: mappingMutation.isPending,
            variables: mappingMutation.variables,
          }}
          searchInputs={mappingSearchInputs}
          onApproveMapping={(input) => mappingMutation.mutate(input)}
          onMappingInputChange={(rowId, value) =>
            setMappingInputs((current) => ({
              ...current,
              [rowId]: value,
            }))
          }
          onSearchInputChange={(entityType, value) =>
            setMappingSearchInputs((current) => ({
              ...current,
              [entityType]: value,
            }))
          }
          t={t}
        />

        <AuditTimelinePanel
          auditItems={auditItems}
          batchId={batchId}
          locale={locale}
          t={t}
        />
      </div>
    </AdminOperationalPage>
  )
}

type QualityIssueItem = NonNullable<ImportBatchDetail['qualityIssueSummary']>['items'][number]
type MappingEntityType = 'employee' | 'store'
type MappingApprovalInput = {
  rowId: string
  integrationSourceId: string
  entityType: MappingEntityType
  externalId: string
  internalId: string
  internalTableName?: string
}
type CandidateQueryState = {
  data: { items: ExternalIdMapCandidate[] } | undefined
  isLoading: boolean
  isError: boolean
  error: unknown
}

function ImportBatchHero(input: { detail: ImportBatchDetail; t: TranslateFunction }) {
  const { detail, t } = input
  const metrics: AdminMetricStripItem[] = [
    {
      id: 'records',
      label: t('importBatchDetail.records'),
      value: String(detail.batch.recordCount),
      description: t('importBatchDetail.batchPrefix'),
      tone: 'neutral',
    },
    {
      id: 'errors',
      label: t('importBatchDetail.errors'),
      value: String(detail.batch.errorCount),
      description: formatStateLabel(detail.batch.status, t),
      tone: detail.batch.errorCount > 0 ? 'danger' : 'success',
    },
    {
      id: 'retry-now',
      label: t('importBatchDetail.retryNow'),
      value: detail.canRetryNow ? t('importBatchDetail.yes') : t('importBatchDetail.no'),
      description: formatStateLabel(detail.batch.healthState, t),
      tone: detail.canRetryNow ? 'warning' : 'neutral',
    },
  ]

  return (
    <>
      <AdminOperationalHeader
        eyebrow={t('importBatchDetail.heroEyebrow')}
        title={`${detail.batch.sourceCode} / ${detail.batch.entityType}`}
        description={
          <>
            {t('importBatchDetail.batchPrefix')} <code>{detail.batch.batchId}</code>{' '}
            {t('importBatchDetail.currentHealthState')}{' '}
            <AdminSurfaceBadge tone={toAdminTone(mapHealthTone(detail.healthState))}>
              {formatStateLabel(detail.healthState, t)}
            </AdminSurfaceBadge>
          </>
        }
        icon={<Network size={18} aria-hidden="true" />}
        meta={
          <AdminSurfaceBadge tone={toAdminTone(mapHealthTone(detail.batch.healthState))}>
            {formatStateLabel(detail.batch.healthState, t)}
          </AdminSurfaceBadge>
        }
      />
      <AdminOperationalMetrics className="tw:xl:grid-cols-3" items={metrics} />
    </>
  )
}

function FeedbackPanel(input: { feedback: string | null }) {
  if (!input.feedback) {
    return null
  }

  return (
    <AdminStatePanel title={input.feedback} tone="success" />
  )
}

function ImportDecisionPanel(input: { evidence: ImportDecisionEvidence; t: TranslateFunction }) {
  const { evidence, t } = input

  return (
    <AdminSurfaceSection
      ariaLabel={t('importBatchDetail.decisionAria')}
      badge={
        <AdminSurfaceBadge tone={evidence.tone}>
          {evidence.label}
        </AdminSurfaceBadge>
      }
      description={t('importBatchDetail.operatorDecisionCopy')}
      eyebrow={t('importBatchDetail.operatorGate')}
      title={t('importBatchDetail.operatorDecisionEvidence')}
    >
      <p className="tw:text-sm tw:leading-6 tw:text-muted-foreground">{evidence.summary}</p>
      <AdminKeyValueGrid>
        {evidence.factors.map(([label, value]) => (
          <ReconciliationStat key={label} label={label} value={value} />
        ))}
      </AdminKeyValueGrid>
    </AdminSurfaceSection>
  )
}

function BatchSummaryGrid(input: {
  detail: ImportBatchDetail
  isRetrying: boolean
  locale: AppLocale
  onRetry: () => void
  t: TranslateFunction
}) {
  const { detail, isRetrying, locale, onRetry, t } = input

  return (
    <div className="tw:grid tw:grid-cols-1 tw:gap-4 tw:xl:grid-cols-2">
      <AdminSurfaceSection
        eyebrow={t('importBatchDetail.executionState')}
        title={t('importBatchDetail.batchSummary')}
      >
        <DetailList
          items={[
            [t('importBatchDetail.status'), formatStateLabel(detail.batch.status, t)],
            [t('importBatchDetail.healthState'), formatStateLabel(detail.batch.healthState, t)],
            [t('importBatchDetail.startedAt'), formatDateTime(detail.batch.startedAt, locale)],
            [
              t('importBatchDetail.finishedAt'),
              detail.batch.finishedAt ? formatDateTime(detail.batch.finishedAt, locale) : t('importBatchDetail.notFinished'),
            ],
            [t('importBatchDetail.retryCount'), String(detail.batch.retryCount)],
            [t('importBatchDetail.fileReference'), detail.batch.fileReference ?? t('importBatchDetail.notAvailable')],
          ]}
        />
      </AdminSurfaceSection>

      <AdminSurfaceSection
        actions={
          <Button
            variant="outline"
            type="button"
            onClick={onRetry}
            disabled={!detail.canRetryNow || isRetrying}
          >
            {isRetrying ? t('importBatchDetail.retrying') : t('importBatchDetail.retryBatch')}
          </Button>
        }
        eyebrow={t('importBatchDetail.dependencyGuidance')}
        title={t('importBatchDetail.whatBlocksProgress')}
      >
        <div className="tw:grid tw:grid-cols-1 tw:gap-2 tw:md:grid-cols-3">
          <DependencyCard
            icon={<Network size={18} />}
            label={t('importBatchDetail.blockedBy')}
            value={detail.blockedByEntityTypes.length ? detail.blockedByEntityTypes.map((entity) => formatEntityType(entity, t)).join(', ') : t('importBatchDetail.nothingBlocking')}
          />
          <DependencyCard
            icon={<RefreshCw size={18} />}
            label={t('importBatchDetail.recommendedNextImport')}
            value={detail.recommendedNextEntityType ? formatEntityType(detail.recommendedNextEntityType, t) : t('importBatchDetail.noDependencyImportNeeded')}
          />
          <DependencyCard
            icon={<CircleDashed size={18} />}
            label={t('importBatchDetail.recommendedOrder')}
            value={detail.recommendedImportOrder.map((entity) => formatEntityType(entity, t)).join(' -> ')}
          />
        </div>
      </AdminSurfaceSection>
    </div>
  )
}

function QualitySummaryPanel(input: {
  detail: ImportBatchDetail
  qualityIssueItems: QualityIssueItem[]
  t: TranslateFunction
}) {
  const { detail, qualityIssueItems, t } = input

  return (
    <AdminSurfaceSection
      ariaLabel={t('importBatchDetail.qualityAria')}
      description={t('importBatchDetail.dataQualityCopy')}
      eyebrow={t('importBatchDetail.qualityGuard')}
      title={t('importBatchDetail.dataQualitySummary')}
    >
      <AdminKeyValueGrid>
        <ReconciliationStat
          label={t('importBatchDetail.issueRows')}
          value={String(detail.qualityIssueSummary?.totalIssueRows ?? 0)}
        />
        <ReconciliationStat
          label={t('importBatchDetail.highSeverityRowsLabel')}
          value={String(detail.qualityIssueSummary?.highSeverityRows ?? 0)}
        />
      </AdminKeyValueGrid>
      {qualityIssueItems.length === 0 ? (
        <AdminSurfaceEmpty copy={t('importBatchDetail.noDataQualityIssues')} />
      ) : (
        <div className="tw:grid tw:gap-2">
          {qualityIssueItems.map((issue) => (
            <article className="tw:rounded-lg tw:border tw:border-border tw:bg-background/60 tw:p-3" key={issue.code}>
              <div className="tw:flex tw:flex-wrap tw:items-center tw:gap-2">
                <strong className="tw:text-sm tw:font-medium tw:text-foreground">{formatQualityIssueLabel(issue.code, issue.label, t)}</strong>
                <AdminSurfaceBadge tone={mapQualitySeverityTone(issue.severity)}>
                  {issue.code}
                </AdminSurfaceBadge>
              </div>
              <p className="tw:mt-2 tw:text-sm tw:leading-6 tw:text-muted-foreground">{formatQualityIssueDescription(issue.code, issue.description, t)}</p>
              <span className="tw:text-xs tw:text-muted-foreground">
                {formatIssueOwner(issue.owner, t)} / {formatQualitySeverity(issue.severity, t)} / {formatRowCount(issue.count, t)}
              </span>
            </article>
          ))}
        </div>
      )}
    </AdminSurfaceSection>
  )
}

function KpiReviewPanel(input: {
  batchId: string
  entityType: string
  evidence: KpiReviewEvidence
  t: TranslateFunction
}) {
  const { batchId, entityType, evidence, t } = input

  if (entityType !== 'kpi') {
    return null
  }

  return (
    <AdminSurfaceSection
      ariaLabel={t('importBatchDetail.kpiReviewAria')}
      actions={
        <AdminActionRow className="tw:justify-start tw:sm:justify-end">
          <AdminSurfaceBadge tone={evidence.tone}>
            {evidence.label}
          </AdminSurfaceBadge>
          <Button
            variant="outline"
            type="button"
            onClick={() =>
              downloadCsv({
                filename: `kpi-review-rows-${batchId}.csv`,
                columns: [
                  'rowId',
                  'category',
                  'sourceRef',
                  'externalRef',
                  'qualityIssueCode',
                  'validationError',
                  'rawRowReference',
                  'rowHash',
                ],
                rows: evidence.items.map((item) => [
                  item.rowId,
                  item.categoryLabel,
                  item.sourceRef,
                  item.externalRef ?? '',
                  item.issueCode ?? '',
                  item.message,
                  item.rawRowReference ?? '',
                  item.rowHash ?? '',
                ]),
              })
            }
            disabled={evidence.items.length === 0}
          >
            {t('importBatchDetail.exportReviewRows')}
          </Button>
        </AdminActionRow>
      }
      description={evidence.summary}
      eyebrow={t('importBatchDetail.kpiReviewEyebrow')}
      title={t('importBatchDetail.kpiReviewTitle')}
    >
      <AdminKeyValueGrid>
        <ReconciliationStat
          label={t('importBatchDetail.employeeMatch')}
          value={formatRowCount(evidence.employeeMatchRows, t)}
        />
        <ReconciliationStat
          label={t('importBatchDetail.storeMatch')}
          value={formatRowCount(evidence.storeMatchRows, t)}
        />
        <ReconciliationStat
          label={t('importBatchDetail.suspiciousRow')}
          value={formatRowCount(evidence.suspiciousRows, t)}
        />
        <ReconciliationStat
          label={t('importBatchDetail.visibleTotalErrors')}
          value={`${evidence.visibleErrorRows} / ${evidence.totalErrorRows}`}
        />
      </AdminKeyValueGrid>
      {evidence.items.length === 0 ? (
        <AdminSurfaceEmpty copy={t('importBatchDetail.noKpiReviewRows')} />
      ) : (
        <div className="tw:grid tw:gap-2">
          {evidence.items.map((item) => (
            <article className="tw:rounded-lg tw:border tw:border-border tw:bg-background/60 tw:p-3" key={item.rowId}>
              <div className="tw:flex tw:flex-wrap tw:items-center tw:gap-2">
                <strong className="tw:text-sm tw:font-medium tw:text-foreground">{item.sourceRef}</strong>
                <AdminSurfaceBadge tone={item.tone}>
                  {item.categoryLabel}
                </AdminSurfaceBadge>
                <AdminSurfaceBadge tone="neutral">
                  {item.actionLabel}
                </AdminSurfaceBadge>
              </div>
              <p className="tw:mt-2 tw:text-sm tw:leading-6 tw:text-muted-foreground">{item.message}</p>
              <LineageChipList ariaLabel={t('importBatchDetail.kpiRowEvidenceAria')}>
                {item.externalRef ? (
                  <LineageChip label={t('importBatchDetail.externalRef')} value={item.externalRef} />
                ) : null}
                {item.issueCode ? (
                  <LineageChip label={t('importBatchDetail.issue')} value={item.issueCode} />
                ) : null}
                {item.rawRowReference ? (
                  <LineageChip label={t('importBatchDetail.rawReference')} value={item.rawRowReference} />
                ) : null}
                {item.rowHash ? (
                  <LineageChip label={t('importBatchDetail.rowHash')} value={item.rowHash} />
                ) : null}
              </LineageChipList>
            </article>
          ))}
        </div>
      )}
    </AdminSurfaceSection>
  )
}

function LineagePanel(input: { detail: ImportBatchDetail; t: TranslateFunction }) {
  const { detail, t } = input

  return (
    <AdminSurfaceSection
      ariaLabel={t('importBatchDetail.lineageAria')}
      eyebrow={t('importBatchDetail.sourceEvidence')}
      title={t('importBatchDetail.sourceRowLineage')}
    >
      {detail.lineageSummary?.supported ? (
        <>
          <p className="tw:text-sm tw:leading-6 tw:text-muted-foreground">{t('importBatchDetail.lineageCopy')}</p>
          <AdminKeyValueGrid>
            <ReconciliationStat
              label={t('importBatchDetail.traceReadyRows')}
              value={`${detail.lineageSummary.rowHashCount} / ${detail.batch.recordCount}`}
            />
            <ReconciliationStat
              label={t('importBatchDetail.readableReferences')}
              value={`${detail.lineageSummary.rawRowReferenceCount} / ${detail.batch.recordCount}`}
            />
          </AdminKeyValueGrid>
          <DetailList
            items={[
              [t('importBatchDetail.sampleRowHash'), detail.lineageSummary.sampleRowHash ?? t('importBatchDetail.noSampleYet')],
              [
                t('importBatchDetail.sampleRawRowReference'),
                detail.lineageSummary.sampleRawRowReference ?? t('importBatchDetail.noSampleYet'),
              ],
            ]}
          />
        </>
      ) : (
        <AdminSurfaceEmpty copy={t('importBatchDetail.lineageOnlyKpi')} />
      )}
    </AdminSurfaceSection>
  )
}

function ReconciliationGrid(input: {
  detail: ImportBatchDetail
  reconciliation: ImportBatchReconciliation | undefined
  t: TranslateFunction
}) {
  const { detail, reconciliation, t } = input

  return (
    <div className="tw:grid tw:grid-cols-1 tw:gap-4 tw:xl:grid-cols-2">
      <AdminSurfaceSection
        eyebrow={t('importBatchDetail.rowStatus')}
        title={t('importBatchDetail.batchAccounting')}
      >

        {reconciliation ? (
          <>
            <AdminKeyValueGrid className="tw:lg:grid-cols-3">
              <ReconciliationStat label={t('importBatchDetail.accountedRows')} value={String(reconciliation.totals.accountedRows)} />
              <ReconciliationStat label={t('importBatchDetail.unaccountedRowsLabel')} value={String(reconciliation.totals.unaccountedRows)} />
              <ReconciliationStat
                label={t('importBatchDetail.recordCountMatch')}
                value={reconciliation.totals.countsMatchRecordCount ? t('importBatchDetail.match') : t('importBatchDetail.mismatch')}
              />
            </AdminKeyValueGrid>
            <DetailProgressRow label={t('importBatchDetail.processed')} value={reconciliation.rowStatusSummary.processed} rate={reconciliation.rates.processedRate} tone="success" />
            <DetailProgressRow label={t('importBatchDetail.validationFailures')} value={reconciliation.rowStatusSummary.validationFailed} rate={reconciliation.rates.validationFailureRate} tone="warning" />
            <DetailProgressRow label={t('importBatchDetail.retryableErrors')} value={reconciliation.rowStatusSummary.retryableError} rate={reconciliation.rates.retryableErrorRate} tone="danger" />
            <DetailProgressRow label={t('importBatchDetail.pending')} value={reconciliation.rowStatusSummary.pending} rate={reconciliation.rates.pendingRate} tone="neutral" />
          </>
        ) : (
          <AdminSurfaceEmpty copy={t('importBatchDetail.reconciliationLoading')} />
        )}
      </AdminSurfaceSection>

      <AdminSurfaceSection
        eyebrow={t('importBatchDetail.dependencyCounts')}
        title={t('importBatchDetail.unresolvedReferences')}
      >
        <DetailList
          items={[
            [t('importBatchDetail.employee'), String(detail.dependencySummary.employee)],
            [t('importBatchDetail.store'), String(detail.dependencySummary.store)],
            [t('importBatchDetail.position'), String(detail.dependencySummary.position)],
            [t('importBatchDetail.region'), String(detail.dependencySummary.region)],
            [t('importBatchDetail.company'), String(detail.dependencySummary.company)],
            [t('importBatchDetail.manager'), String(detail.dependencySummary.manager)],
          ]}
        />
      </AdminSurfaceSection>
    </div>
  )
}

function ErrorRowsPanel(input: {
  batchId: string
  candidateQueries: Record<MappingEntityType, CandidateQueryState>
  errors: ImportBatchError[]
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
  const { batchId, candidateQueries, errors, mappingInputs, mappingState, searchInputs, onApproveMapping, onMappingInputChange, onSearchInputChange, t } = input

  return (
    <AdminSurfaceSection
      actions={
        <Button
          variant="outline"
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
          {t('importBatchDetail.exportErrors')}
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
    </AdminSurfaceSection>
  )
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

function AuditTimelinePanel(input: {
  auditItems: AuditEvent[]
  batchId: string
  locale: AppLocale
  t: TranslateFunction
}) {
  const { auditItems, batchId, locale, t } = input

  return (
    <AdminSurfaceSection
      actions={
        <Button
          variant="outline"
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
          {t('importBatchDetail.exportAudit')}
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
    </AdminSurfaceSection>
  )
}

function formatRowCount(count: number, t: TranslateFunction) {
  return t(
    count === 1
      ? 'importBatchDetail.rowCountSingular'
      : 'importBatchDetail.rowCountPlural',
    { count },
  )
}

type ImportDecisionEvidence = {
  label: string
  tone: AdminSurfaceTone
  summary: string
  factors: [string, string][]
}

type KpiReviewCategory =
  | 'employee_match'
  | 'store_match'
  | 'suspicious_row'
  | 'system_retry'

type KpiReviewItem = {
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

type KpiReviewEvidence = {
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

function buildImportDecisionEvidence(input: {
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

function buildKpiReviewEvidence(input: {
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

function formatQualityIssueLabel(code: string, fallback: string, t: TranslateFunction) {
  if (code === 'unmapped_store') return t('importBatchDetail.qualityIssue.unmapped_store.label')
  if (code === 'unmapped_employee') return t('importBatchDetail.qualityIssue.unmapped_employee.label')
  return fallback
}

function formatQualityIssueDescription(code: string, fallback: string, t: TranslateFunction) {
  if (code === 'unmapped_store') return t('importBatchDetail.qualityIssue.unmapped_store.description')
  if (code === 'unmapped_employee') return t('importBatchDetail.qualityIssue.unmapped_employee.description')
  return fallback
}

function formatIssueOwner(owner: string, t: TranslateFunction) {
  if (owner === 'mapping') return t('importBatchDetail.issueOwner.mapping')
  if (owner === 'data') return t('importBatchDetail.issueOwner.data')
  if (owner === 'system') return t('importBatchDetail.issueOwner.system')
  return owner
}

function formatQualitySeverity(severity: string, t: TranslateFunction) {
  if (severity === 'high') return t('importBatchDetail.severity.high')
  if (severity === 'medium') return t('importBatchDetail.severity.medium')
  if (severity === 'low') return t('importBatchDetail.severity.low')
  return severity
}

function formatEntityType(entityType: string, t: TranslateFunction) {
  if (entityType === 'employee') return t('importBatchDetail.entity.employee')
  if (entityType === 'store') return t('importBatchDetail.entity.store')
  if (entityType === 'position') return t('importBatchDetail.entity.position')
  if (entityType === 'region') return t('importBatchDetail.entity.region')
  if (entityType === 'company') return t('importBatchDetail.entity.company')
  if (entityType === 'manager') return t('importBatchDetail.entity.manager')
  return entityType.replaceAll('_', ' ')
}

function formatStateLabel(state: string, t: TranslateFunction) {
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

function formatErrorCategory(category: string, t: TranslateFunction) {
  if (category === 'validation') return t('importBatchDetail.errorCategory.validation')
  if (category === 'missing_dependency') return t('importBatchDetail.errorCategory.missing_dependency')
  if (category === 'write_failure') return t('importBatchDetail.errorCategory.write_failure')
  return category.replaceAll('_', ' ')
}
