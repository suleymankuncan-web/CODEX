import { useEffect, useMemo, useReducer, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  buildNeedsActionQueryKey,
  createImportBatch,
  getImportOverview,
  getIntegrationLookups,
  getNeedsAction,
  getImportPayloadTemplate,
  retryImportBatch,
  uploadPowerBiExport,
} from '../features/integrations/api'
import {
  PAGE_SIZE,
  SEARCH_DEBOUNCE_MS,
  SEARCH_MAX_LENGTH,
  createInitialIntegrationDashboardState,
  integrationDashboardReducer,
  sortNeedsActionItems,
} from '../features/integrations/integration-dashboard-list-model'
import { IntegrationDashboardLoadedContent } from '../features/integrations/integration-dashboard-loaded-content'
import { useLocalization } from '../features/localization/useLocalization'
import { actionToast } from '../lib/action-toast'
import { getErrorMessage } from '../lib/format'
import { AdminStatePanel, AdminSurfacePage } from './admin-surface-primitives'

export function IntegrationDashboardPage() {
  const { t } = useLocalization()
  const [pageState, dispatchPageState] = useReducer(
    integrationDashboardReducer,
    undefined,
    createInitialIntegrationDashboardState,
  )
  const {
    activeTab,
    search,
    sortBy,
    offset,
    entityTypeFilter,
    statusFilter,
    createdBatchId,
    uploadedBatchId,
    templateSourceSystem,
    selectedTemplateSourceCode,
    powerBiSourceCode,
    powerBiPeriodType,
    powerBiPeriodMonth,
    powerBiPeriodStart,
    powerBiPeriodEnd,
    personnelFile,
    storeFile,
  } = pageState
  const [debouncedSearch, setDebouncedSearch] = useState(search)
  const queryClient = useQueryClient()

  useEffect(() => {
    const timeoutId = window.setTimeout(() => setDebouncedSearch(search), SEARCH_DEBOUNCE_MS)
    return () => window.clearTimeout(timeoutId)
  }, [search])

  const queueSearch = debouncedSearch.trim().slice(0, SEARCH_MAX_LENGTH)
  const needsActionInput = {
    limit: PAGE_SIZE,
    offset,
    q: queueSearch,
    ...(entityTypeFilter ? { entityType: entityTypeFilter } : {}),
    ...(statusFilter ? { status: statusFilter } : {}),
  }

  const overviewQuery = useQuery({
    queryKey: ['integration-overview'],
    queryFn: getImportOverview,
    staleTime: 30_000,
  })
  const needsActionQuery = useQuery({
    queryKey: buildNeedsActionQueryKey(needsActionInput),
    queryFn: () => getNeedsAction(needsActionInput),
    staleTime: 30_000,
  })
  const importTemplateQuery = useQuery({
    queryKey: ['integration-import-template', templateSourceSystem],
    queryFn: () =>
      getImportPayloadTemplate({
        entityType: 'kpi',
        sourceSystem: templateSourceSystem,
      }),
    staleTime: 30_000,
  })
  const lookupsQuery = useQuery({
    queryKey: ['integration-lookups'],
    queryFn: getIntegrationLookups,
    staleTime: 30_000,
  })
  const retryMutation = useMutation({
    mutationFn: retryImportBatch,
    onSuccess: async (response) => {
      actionToast.success(response.command.message)
      dispatchPageState({ type: 'retrySucceeded' })
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['integration-needs-action'] }),
        queryClient.invalidateQueries({ queryKey: ['integration-overview'] }),
      ])
    },
    onError: (error) => actionToast.error(error, 'Tekrar deneme başlatılamadı.'),
  })
  const createBatchMutation = useMutation({
    mutationFn: createImportBatch,
    onSuccess: async (response) => {
      actionToast.success(response.command.message)
      dispatchPageState({
        type: 'batchCreated',
        batchId: response.data.batch.batchId,
      })
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['integration-needs-action'] }),
        queryClient.invalidateQueries({ queryKey: ['integration-overview'] }),
      ])
    },
    onError: (error) => actionToast.error(error, 'Aktarım partisi oluşturulamadı.'),
  })
  const uploadPowerBiMutation = useMutation({
    mutationFn: uploadPowerBiExport,
    onSuccess: async (response) => {
      actionToast.success(response.command.message)
      dispatchPageState({
        type: 'uploadSucceeded',
        batchId: response.data.batch.batchId,
      })
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['integration-needs-action'] }),
        queryClient.invalidateQueries({ queryKey: ['integration-overview'] }),
      ])
    },
    onError: (error) => {
      actionToast.error(error, 'Dosya yüklenemedi.')
      dispatchPageState({ type: 'uploadFailed' })
    },
  })

  const compatibleSources = useMemo(() => {
    return (lookupsQuery.data?.activeSources ?? []).filter(
      (item) => item.entityType === 'kpi' && item.sourceSystem === templateSourceSystem,
    )
  }, [lookupsQuery.data?.activeSources, templateSourceSystem])
  const powerBiSources = useMemo(() => {
    return (lookupsQuery.data?.activeSources ?? []).filter(
      (item) => item.entityType === 'kpi' && item.sourceSystem === 'power_bi',
    )
  }, [lookupsQuery.data?.activeSources])

  const resolvedTemplateSourceCode =
    selectedTemplateSourceCode || compatibleSources[0]?.sourceCode || ''
  const resolvedPowerBiSourceCode = powerBiSourceCode || powerBiSources[0]?.sourceCode || ''

  const submitSampleImport = () => {
    if (!resolvedTemplateSourceCode || !importTemplateQuery.data) {
      return
    }

    const timestamp = new Date().toISOString()
    const requestBody = importTemplateQuery.data.requestBody
    createBatchMutation.mutate({
      sourceCode: resolvedTemplateSourceCode,
      entityType: String(requestBody.entityType ?? 'kpi'),
      fileReference: `sample-${templateSourceSystem}-${timestamp}.json`,
      sourceBatchId: `${resolvedTemplateSourceCode}-${timestamp}`,
      sourceCapturedAt: String(requestBody.sourceCapturedAt ?? timestamp),
      sourceWindowStartedAt: String(requestBody.sourceWindowStartedAt ?? timestamp),
      sourceWindowEndedAt: String(requestBody.sourceWindowEndedAt ?? timestamp),
      rows: Array.isArray(requestBody.rows)
        ? (requestBody.rows as Record<string, unknown>[])
        : [],
    })
  }

  const sortedItems = useMemo(
    () => sortNeedsActionItems(needsActionQuery.data?.items ?? [], sortBy),
    [needsActionQuery.data?.items, sortBy],
  )

  if (overviewQuery.isLoading || needsActionQuery.isLoading || lookupsQuery.isLoading) {
    return (
      <AdminSurfacePage>
        <AdminStatePanel
          title={t('adminIntegrations.loadingTitle')}
          description={t('adminIntegrations.loadingCopy')}
          isLoading
        />
      </AdminSurfacePage>
    )
  }

  if (overviewQuery.isError) {
    return (
      <AdminSurfacePage>
        <AdminStatePanel
          title={t('adminIntegrations.dashboardUnavailableTitle')}
          description={getErrorMessage(overviewQuery.error)}
          tone="danger"
        />
      </AdminSurfacePage>
    )
  }

  if (needsActionQuery.isError) {
    return (
      <AdminSurfacePage>
        <AdminStatePanel
          title={t('adminIntegrations.needsActionUnavailableTitle')}
          description={getErrorMessage(needsActionQuery.error)}
          tone="danger"
        />
      </AdminSurfacePage>
    )
  }

  if (lookupsQuery.isError) {
    return (
      <AdminSurfacePage>
        <AdminStatePanel
          title={t('adminIntegrations.lookupsUnavailableTitle')}
          description={getErrorMessage(lookupsQuery.error)}
          tone="danger"
        />
      </AdminSurfacePage>
    )
  }

  const overview = overviewQuery.data
  if (!overview) {
    return (
      <AdminSurfacePage>
        <AdminStatePanel
          title={t('adminIntegrations.overviewUnavailableTitle')}
          description={t('adminIntegrations.overviewUnavailableCopy')}
          tone="danger"
        />
      </AdminSurfacePage>
    )
  }

  const meta = needsActionQuery.data?.meta
  const pageOffset = meta?.offset ?? offset
  const canGoBack = pageOffset > 0
  const canGoForward = meta ? meta.offset + meta.count < meta.total : false
  const isPowerBiPeriodValid =
    powerBiPeriodType === 'monthly'
      ? Boolean(powerBiPeriodMonth)
      : Boolean(powerBiPeriodStart && powerBiPeriodEnd && powerBiPeriodEnd >= powerBiPeriodStart)
  const powerBiUploadBlockers = [
    powerBiSources.length === 0 ? t('adminIntegrations.noPowerBiSource') : null,
    !personnelFile && !storeFile ? t('adminIntegrations.choosePersonnelOrStoreFile') : null,
    powerBiSources.length > 0 && !resolvedPowerBiSourceCode
      ? t('adminIntegrations.choosePowerBiSource')
      : null,
    !isPowerBiPeriodValid ? t('adminIntegrations.invalidPeriod') : null,
  ].filter((item): item is string => Boolean(item))
  const isPowerBiUploadDisabled =
    uploadPowerBiMutation.isPending || powerBiUploadBlockers.length > 0
  const actionCount = overview.healthTotals.blocked + overview.healthTotals.needsAction + overview.healthTotals.stuck
  const evidenceState = overview.latest.completedBatchId ? t('adminIntegrations.ready') : t('adminIntegrations.waiting')

  return (
    <IntegrationDashboardLoadedContent
      activeTab={activeTab}
      actionCount={actionCount}
      canGoBack={canGoBack}
      canGoForward={canGoForward}
      compatibleSources={compatibleSources}
      createBatchMutation={createBatchMutation}
      createdBatchId={createdBatchId}
      dispatchPageState={dispatchPageState}
      entityTypeFilter={entityTypeFilter}
      isFetching={needsActionQuery.isFetching}
      evidenceState={evidenceState}
      importTemplateQuery={importTemplateQuery}
      isPowerBiUploadDisabled={isPowerBiUploadDisabled}
      meta={meta}
      offset={offset}
      overview={overview}
      personnelFile={personnelFile}
      powerBiPeriodEnd={powerBiPeriodEnd}
      powerBiPeriodMonth={powerBiPeriodMonth}
      powerBiPeriodStart={powerBiPeriodStart}
      powerBiPeriodType={powerBiPeriodType}
      powerBiSources={powerBiSources}
      powerBiUploadBlockers={powerBiUploadBlockers}
      resolvedPowerBiSourceCode={resolvedPowerBiSourceCode}
      resolvedTemplateSourceCode={resolvedTemplateSourceCode}
      retryMutation={retryMutation}
      search={search}
      sortBy={sortBy}
      sortedItems={sortedItems}
      statusFilter={statusFilter}
      storeFile={storeFile}
      submitSampleImport={submitSampleImport}
      t={t}
      templateSourceSystem={templateSourceSystem}
      uploadedBatchId={uploadedBatchId}
      uploadPowerBiMutation={uploadPowerBiMutation}
    />
  )
}
