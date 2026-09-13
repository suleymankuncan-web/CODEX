import {
  AlertTriangle,
  ArrowRight,
  ClipboardCheck,
  CheckCircle2,
  DatabaseZap,
  FileJson,
  RefreshCw,
  ShieldCheck,
  UploadCloud,
} from 'lucide-react'
import { Link } from 'react-router'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs'
import { AdminAzureHeader } from '../../pages/admin-azure-header'
import { Button } from '../../components/ui/button'
import type { ImportOverview, NeedsActionItem } from './api'
import type { TranslateFunction } from '../localization/dictionary'
import { getErrorMessage } from '../../lib/format'
import {
  IntegrationEvidenceValue,
  IntegrationSelect,
} from './integration-dashboard-surface-controls'
import {
  AdminActionRow,
  AdminMetricStrip,
  AdminSurfacePage,
  AdminKeyValue,
  AdminKeyValueGrid,
  AdminStatePanel,
  AdminSurfaceBadge,
  AdminSurfaceSection,
  type AdminMetricStripItem,
} from '../../pages/admin-surface-primitives'
import { IntegrationLifecycleStrip } from '../../pages/integration-lifecycle-strip'
import {
  formatNumber,
  formatOptionalBatch,
} from './integration-dashboard-list-model'
import type {
  CreateBatchMutationState,
  ImportTemplateQueryState,
  IntegrationDispatch,
  IntegrationListMeta,
  IntegrationSource,
  IntegrationSortValue,
  IntegrationTab,
  IntegrationTabOption,
  IntegrationTemplateSourceSystem,
  PowerBiPeriodType,
  PowerBiUploadMutationState,
  RetryMutationState,
} from './integration-dashboard-surface-types'
import { IntegrationErrorsPanel } from './integration-dashboard-errors-panel'
import { IntegrationUploadsPanel } from './integration-dashboard-upload-panels'

type IntegrationDashboardLoadedContentProps = {
  activeTab: IntegrationTab
  actionCount: number
  canGoBack: boolean
  canGoForward: boolean
  compatibleSources: IntegrationSource[]
  createBatchMutation: CreateBatchMutationState
  createdBatchId: string | null
  dispatchPageState: IntegrationDispatch
  entityTypeFilter: string
  evidenceState: string
  importTemplateQuery: ImportTemplateQueryState
  isFetching: boolean
  isPowerBiUploadDisabled: boolean
  meta: IntegrationListMeta | undefined
  offset: number
  overview: ImportOverview
  personnelFile: File | null
  powerBiPeriodEnd: string
  powerBiPeriodMonth: string
  powerBiPeriodStart: string
  powerBiPeriodType: PowerBiPeriodType
  powerBiSources: IntegrationSource[]
  powerBiUploadBlockers: string[]
  resolvedPowerBiSourceCode: string
  resolvedTemplateSourceCode: string
  retryMutation: RetryMutationState
  search: string
  sortBy: IntegrationSortValue
  sortedItems: NeedsActionItem[]
  statusFilter: string
  storeFile: File | null
  submitSampleImport: () => void
  t: TranslateFunction
  templateSourceSystem: IntegrationTemplateSourceSystem
  uploadedBatchId: string | null
  uploadPowerBiMutation: PowerBiUploadMutationState
}

function IntegrationDashboardLoadedContent(input: IntegrationDashboardLoadedContentProps) {
  const {
    activeTab,
    actionCount,
    canGoBack,
    canGoForward,
    compatibleSources,
    createBatchMutation,
    createdBatchId,
    dispatchPageState,
    entityTypeFilter,
    evidenceState,
    importTemplateQuery,
    isFetching,
    isPowerBiUploadDisabled,
    meta,
    offset,
    overview,
    personnelFile,
    powerBiPeriodEnd,
    powerBiPeriodMonth,
    powerBiPeriodStart,
    powerBiPeriodType,
    powerBiSources,
    powerBiUploadBlockers,
    resolvedPowerBiSourceCode,
    resolvedTemplateSourceCode,
    retryMutation,
    search,
    sortBy,
    sortedItems,
    statusFilter,
    storeFile,
    submitSampleImport,
    t,
    templateSourceSystem,
    uploadedBatchId,
    uploadPowerBiMutation,
  } = input

  const tabs: IntegrationTabOption[] = [
    { id: 'uploads', label: t('adminIntegrations.tabUploads') },
    { id: 'evidence', label: t('adminIntegrations.tabEvidence') },
    { id: 'errors', label: t('adminIntegrations.tabErrors'), count: actionCount },
  ]
  const metricItems: AdminMetricStripItem[] = [
    {
      id: 'status',
      icon: <DatabaseZap size={18} />,
      label: t('adminIntegrations.status'),
      value: actionCount === 0 ? t('adminIntegrations.controlled') : t('adminIntegrations.needsReview'),
      description:
        actionCount === 0
          ? t('adminIntegrations.noCriticalBlock')
          : t('adminIntegrations.actionCount', { count: actionCount }),
      tone: actionCount === 0 ? 'success' : 'warning',
    },
    {
      id: 'healthy',
      label: t('adminIntegrations.healthy'),
      value: formatNumber(overview.healthTotals.healthy),
      description: t('adminIntegrations.healthyNote', { count: overview.totals.completed }),
      icon: <CheckCircle2 size={18} />,
      tone: 'success',
    },
    {
      id: 'needs-action',
      label: t('adminIntegrations.needsAction'),
      value: formatNumber(actionCount),
      description: t('adminIntegrations.actionSummaryNote'),
      icon: <AlertTriangle size={18} />,
      tone: actionCount === 0 ? 'neutral' : 'danger',
    },
    {
      id: 'retry-ready',
      label: t('adminIntegrations.retryReady'),
      value: formatNumber(overview.healthTotals.retryReady),
      description: t('adminIntegrations.retryReadyNote'),
      icon: <RefreshCw size={18} />,
      tone: overview.healthTotals.retryReady > 0 ? 'warning' : 'neutral',
    },
    {
      id: 'evidence',
      label: t('adminIntegrations.evidence'),
      value: evidenceState,
      description: formatOptionalBatch(overview.latest.completedBatchId, t),
      icon: <ShieldCheck size={18} />,
      tone: overview.latest.completedBatchId ? 'cyan' : 'neutral',
    },
  ]

  return (
    <AdminSurfacePage className="integration-dashboard" ariaLabel={t('adminIntegrations.heroEyebrow')}>
      <AdminAzureHeader
        title={t('adminIntegrations.title')}
        icon={<DatabaseZap size={18} />}
        meta={
          <>
            <AdminSurfaceBadge tone="neutral">
              {t('adminIntegrations.totalBatches')}: {formatNumber(overview.totals.all)}
            </AdminSurfaceBadge>
            <AdminSurfaceBadge tone={actionCount === 0 ? 'success' : 'warning'}>
              {actionCount === 0
                ? t('adminIntegrations.controlled')
                : t('adminIntegrations.needsReview')}
            </AdminSurfaceBadge>
          </>
        }
        actions={
          <Button
            type="button"
            onClick={() => dispatchPageState({ type: 'setActiveTab', value: 'uploads' })}
          >
            <UploadCloud aria-hidden="true" />
            {t('adminIntegrations.newUpload')}
          </Button>
        }
      />

      <AdminMetricStrip
        className="integration-summary tw:xl:grid-cols-5"
        items={metricItems.map((item) => ({ ...item, tone: 'neutral' }))}
      />

      <IntegrationLifecycleStrip actionCount={actionCount} primaryItem={sortedItems[0]} t={t} onOpenIssues={() => dispatchPageState({ type: 'setActiveTab', value: 'errors' })} />
      {(createdBatchId || uploadedBatchId) ? (
        <div className="tw:grid tw:grid-cols-1 tw:gap-3 tw:lg:grid-cols-2">
          {createdBatchId ? (
            <Button asChild variant="outline">
              <Link to={`/admin/integrations/${createdBatchId}`}>
                {t('adminIntegrations.openBatchDetail')}
                <ArrowRight aria-hidden="true" />
              </Link>
            </Button>
          ) : null}
          {uploadedBatchId ? (
            <Button asChild variant="outline">
              <Link to={`/admin/integrations/${uploadedBatchId}`}>
                {t('adminIntegrations.openBatchDetail')}
                <ArrowRight aria-hidden="true" />
              </Link>
            </Button>
          ) : null}
        </div>
      ) : null}

      <Tabs value={activeTab} onValueChange={(value) => dispatchPageState({ type: 'setActiveTab', value: value as IntegrationTab })} className="integration-workspace">
        <TabsList aria-label={t('adminIntegrations.tabsAria')}>
          {tabs.map((tab) => (
            <TabsTrigger key={tab.id} value={tab.id}>
              {tab.label}
              {typeof tab.count === 'number' ? <AdminSurfaceBadge tone={tab.count > 0 ? 'warning' : 'neutral'}>{formatNumber(tab.count)}</AdminSurfaceBadge> : null}
            </TabsTrigger>
          ))}
        </TabsList>

      <TabsContent value="uploads">
        <IntegrationUploadsPanel
          dispatchPageState={dispatchPageState}
          isPowerBiUploadDisabled={isPowerBiUploadDisabled}
          overview={overview}
          personnelFile={personnelFile}
          powerBiPeriodEnd={powerBiPeriodEnd}
          powerBiPeriodMonth={powerBiPeriodMonth}
          powerBiPeriodStart={powerBiPeriodStart}
          powerBiPeriodType={powerBiPeriodType}
          powerBiSources={powerBiSources}
          powerBiUploadBlockers={powerBiUploadBlockers}
          resolvedPowerBiSourceCode={resolvedPowerBiSourceCode}
          storeFile={storeFile}
          t={t}
          uploadPowerBiMutation={uploadPowerBiMutation}
        />
      </TabsContent>

      <TabsContent value="evidence">
        <IntegrationEvidencePanel
          compatibleSources={compatibleSources}
          createBatchMutation={createBatchMutation}
          createdBatchId={createdBatchId}
          dispatchPageState={dispatchPageState}
          evidenceState={evidenceState}
          importTemplateQuery={importTemplateQuery}
          overview={overview}
          resolvedTemplateSourceCode={resolvedTemplateSourceCode}
          submitSampleImport={submitSampleImport}
          t={t}
          templateSourceSystem={templateSourceSystem}
        />
      </TabsContent>

      <TabsContent value="errors">
        <IntegrationErrorsPanel
          canGoBack={canGoBack}
          canGoForward={canGoForward}
          dispatchPageState={dispatchPageState}
          entityTypeFilter={entityTypeFilter}
          isFetching={isFetching}
          meta={meta}
          offset={offset}
          retryMutation={retryMutation}
          search={search}
          sortBy={sortBy}
          sortedItems={sortedItems}
          statusFilter={statusFilter}
          t={t}
        />
      </TabsContent>
      </Tabs>
    </AdminSurfacePage>
  )
}

type IntegrationEvidencePanelProps = {
  compatibleSources: IntegrationSource[]
  createBatchMutation: CreateBatchMutationState
  createdBatchId: string | null
  dispatchPageState: IntegrationDispatch
  evidenceState: string
  importTemplateQuery: ImportTemplateQueryState
  overview: ImportOverview
  resolvedTemplateSourceCode: string
  submitSampleImport: () => void
  t: TranslateFunction
  templateSourceSystem: IntegrationTemplateSourceSystem
}

function IntegrationEvidencePanel(input: IntegrationEvidencePanelProps) {
  const {
    compatibleSources,
    createBatchMutation,
    createdBatchId,
    dispatchPageState,
    evidenceState,
    importTemplateQuery,
    overview,
    resolvedTemplateSourceCode,
    submitSampleImport,
    t,
    templateSourceSystem,
  } = input

  return (
    <AdminSurfaceSection
      ariaLabel={t('adminIntegrations.evidenceTabAria')}
      actions={
        <IntegrationSelect
          aria-label={t('adminIntegrations.templateSourceSystem')}
          value={templateSourceSystem}
          onValueChange={(value) =>
            dispatchPageState({
              type: 'setTemplateSourceSystem',
              value: value as IntegrationTemplateSourceSystem,
            })
          }
        >
          <option value="power_bi">Power BI</option>
          <option value="nebim_v3">Nebim V3</option>
        </IntegrationSelect>
      }
      description={t('adminIntegrations.evidencePanelCopy')}
      title={t('adminIntegrations.evidencePanelTitle')}
    >
      <AdminKeyValueGrid className="tw:lg:grid-cols-3">
        <IntegrationEvidenceValue
          icon={<FileJson size={18} />}
          label={t('adminIntegrations.payloadEvidence')}
          description={t('adminIntegrations.payloadEvidenceCopy')}
          value={importTemplateQuery.data?.entityType ?? 'kpi'}
        />
        <IntegrationEvidenceValue
          icon={<ClipboardCheck size={18} />}
          label={t('adminIntegrations.auditEvidence')}
          description={t('adminIntegrations.auditEvidenceCopy')}
          value={formatOptionalBatch(overview.latest.completedBatchId, t)}
        />
        <IntegrationEvidenceValue
          icon={<DatabaseZap size={18} />}
          label={t('adminIntegrations.reconciliationEvidence')}
          description={t('adminIntegrations.reconciliationEvidenceCopy')}
          value={evidenceState}
        />
      </AdminKeyValueGrid>

      {importTemplateQuery.isLoading ? (
        <AdminStatePanel
          title={t('adminIntegrations.loadingTemplate')}
          isLoading
        />
      ) : importTemplateQuery.isError ? (
        <AdminStatePanel
          title={getErrorMessage(importTemplateQuery.error)}
          tone="danger"
        />
      ) : importTemplateQuery.data ? (
        <div className="tw:grid tw:gap-3">
          <AdminActionRow>
            <IntegrationSelect
              aria-label={t('adminIntegrations.executionSource')}
              value={resolvedTemplateSourceCode}
              onValueChange={(value) =>
                dispatchPageState({
                  type: 'setSelectedTemplateSourceCode',
                  value: value,
                })
              }
              disabled={compatibleSources.length === 0}
            >
              {compatibleSources.length === 0 ? (
                <option value="">{t('adminIntegrations.noActiveKpiSource')}</option>
              ) : null}
              {compatibleSources.map((item) => (
                <option key={item.sourceId} value={item.sourceCode}>
                  {item.sourceCode} - {item.sourceName}
                </option>
              ))}
            </IntegrationSelect>
            <Button
              type="button"
              disabled={compatibleSources.length === 0 || createBatchMutation.isPending}
              onClick={submitSampleImport}
            >
              {createBatchMutation.isPending
                ? t('adminIntegrations.running')
                : t('adminIntegrations.createEvidenceSample')}
            </Button>
          </AdminActionRow>

          {compatibleSources.length === 0 ? (
            <AdminStatePanel
              title={t('adminIntegrations.sourceSystemNeedsKpiSource')}
              tone="warning"
            />
          ) : null}

          <AdminKeyValueGrid className="tw:lg:grid-cols-3">
            <AdminKeyValue label={t('adminIntegrations.entity')} value={importTemplateQuery.data.entityType} />
            <AdminKeyValue label={t('adminIntegrations.source')} value={importTemplateQuery.data.sourceSystem} />
            <AdminKeyValue
              label={t('adminIntegrations.executionSource')}
              value={resolvedTemplateSourceCode || t('adminIntegrations.none')}
            />
          </AdminKeyValueGrid>

          {createdBatchId ? (
            <AdminStatePanel
              title={`${t('adminIntegrations.latestCreatedBatch')}: ${createdBatchId}`}
              tone="neutral"
            />
          ) : null}

          {importTemplateQuery.data.normalizedBehavior?.length ? (
            <ul className="tw:grid tw:gap-2 tw:rounded-lg tw:border tw:border-border tw:bg-background/60 tw:p-3 tw:text-sm tw:text-muted-foreground">
              {importTemplateQuery.data.normalizedBehavior.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          ) : null}

          <pre
            className="tw:max-h-96 tw:overflow-auto tw:rounded-lg tw:border tw:border-border tw:bg-muted tw:p-3 tw:text-xs tw:leading-5 tw:text-foreground"
            data-testid="integration-code-block"
          >
            {JSON.stringify(importTemplateQuery.data.requestBody, null, 2)}
          </pre>
        </div>
      ) : null}
    </AdminSurfaceSection>
  )
}

export { IntegrationDashboardLoadedContent }
