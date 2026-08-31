import { useRef, useState } from 'react'
import { ArrowRight, Search } from 'lucide-react'
import { Link } from 'react-router'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { actionToast } from '../../lib/action-toast'
import { downloadCsv } from '../../lib/download-csv'
import { formatState, mapHealthTone } from '../../lib/format'
import {
  fetchAllPaginated,
  isPaginatedExportError,
  PAGINATED_EXPORT_PAGE_SIZE,
} from '../../lib/paginated-export'
import {
  AdminActionRow,
  AdminSurfaceBadge,
  AdminSurfaceEmpty,
  AdminSurfaceSection,
} from '../../pages/admin-surface-primitives'
import type { TranslateFunction } from '../localization/dictionary'
import { getNeedsAction, type NeedsActionItem } from './api'
import {
  IntegrationSelect,
} from './integration-dashboard-surface-controls'
import type {
  IntegrationDispatch,
  IntegrationListMeta,
  IntegrationSortValue,
  RetryMutationState,
} from './integration-dashboard-surface-types'
import {
  PAGE_SIZE,
  SEARCH_MAX_LENGTH,
  sortNeedsActionItems,
} from './integration-dashboard-list-model'
import { toAdminTone } from './integration-surface-tone'

type IntegrationErrorsPanelProps = {
  canGoBack: boolean
  canGoForward: boolean
  dispatchPageState: IntegrationDispatch
  entityTypeFilter: string
  isFetching: boolean
  meta: IntegrationListMeta | undefined
  offset: number
  retryMutation: RetryMutationState
  search: string
  sortBy: IntegrationSortValue
  sortedItems: NeedsActionItem[]
  statusFilter: string
  t: TranslateFunction
}

function IntegrationErrorsPanel(input: IntegrationErrorsPanelProps) {
  const {
    canGoBack,
    canGoForward,
    dispatchPageState,
    entityTypeFilter,
    isFetching,
    meta,
    offset,
    retryMutation,
    search,
    sortBy,
    sortedItems,
    statusFilter,
    t,
  } = input
  const [isExporting, setIsExporting] = useState(false)
  const exportInFlightRef = useRef(false)
  const canExport = (meta?.total ?? sortedItems.length) > 0
  const handleExport = async () => {
    if (exportInFlightRef.current || !canExport) {
      return
    }

    exportInFlightRef.current = true
    setIsExporting(true)
    try {
      const allItems = await fetchAllPaginated(
        ({ limit, offset }) =>
          getNeedsAction({
            limit,
            offset,
            q: search.trim().slice(0, SEARCH_MAX_LENGTH),
            ...(entityTypeFilter ? { entityType: entityTypeFilter } : {}),
            ...(statusFilter ? { status: statusFilter } : {}),
          }),
        {
          pageSize: PAGINATED_EXPORT_PAGE_SIZE,
          requireRevision: true,
          getStableKey: (item) => item.batchId,
        },
      )

      downloadCsv({
        filename: 'integration-needs-action.csv',
        columns: ['batchId', 'sourceCode', 'sourceName', 'entityType', 'healthState', 'recordCount', 'errorCount', 'retryCount', 'actionReason', 'recommendedAction'],
        rows: sortNeedsActionItems(allItems, sortBy).map((item) => [
          item.batchId,
          item.sourceCode,
          item.sourceName,
          item.entityType,
          item.healthState,
          item.recordCount,
          item.errorCount,
          item.retryCount,
          item.actionReason,
          item.recommendedAction,
        ]),
      })
    } catch (error) {
      actionToast.error(
        error,
        isPaginatedExportError(error) && error.reason === 'too_many_rows'
          ? t('adminIntegrations.exportTooLarge')
          : t('adminIntegrations.exportFailed'),
      )
    } finally {
      exportInFlightRef.current = false
      setIsExporting(false)
    }
  }

  return (
    <AdminSurfaceSection
      ariaLabel={t('adminIntegrations.errorsTabAria')}
      actions={
        <AdminActionRow className="tw:justify-start tw:sm:justify-end">
          <IntegrationSelect
            aria-label={t('adminIntegrations.sortPriority')}
            value={sortBy}
            onChange={(event) =>
              dispatchPageState({ type: 'setSortBy', value: event.target.value as IntegrationSortValue })
            }
          >
            <option value="priority">{t('adminIntegrations.sortPriority')}</option>
            <option value="errors">{t('adminIntegrations.sortErrors')}</option>
            <option value="records">{t('adminIntegrations.sortRecords')}</option>
            <option value="entity">{t('adminIntegrations.sortEntity')}</option>
          </IntegrationSelect>
          <Button
            type="button"
            variant="outline"
            onClick={handleExport}
            disabled={isExporting || !canExport}
            aria-busy={isExporting}
          >
            {isExporting ? t('adminIntegrations.exportPreparing') : t('adminIntegrations.exportQueue')}
          </Button>
        </AdminActionRow>
      }
      description={t('adminIntegrations.errorsPanelCopy')}
      eyebrow={t('adminIntegrations.tabErrors')}
      title={t('adminIntegrations.errorsPanelTitle')}
    >
      <div className="tw:grid tw:grid-cols-1 tw:gap-2 tw:lg:grid-cols-[minmax(16rem,1fr)_12rem_12rem_auto]">
        <label className="tw:relative tw:block">
          <Search
            aria-hidden="true"
            className="tw:pointer-events-none tw:absolute tw:left-3 tw:top-1/2 tw:size-4 tw:-translate-y-1/2 tw:text-muted-foreground"
          />
          <span className="tw:sr-only">{t('adminIntegrations.filterQueue')}</span>
          <Input
            className="tw:pl-9"
            maxLength={SEARCH_MAX_LENGTH}
            value={search}
            onChange={(event) =>
              dispatchPageState({ type: 'setSearch', value: event.target.value })
            }
            placeholder={t('adminIntegrations.searchQueuePlaceholder')}
          />
        </label>
        <IntegrationSelect
          aria-label={t('adminIntegrations.filterEntityType')}
          value={entityTypeFilter}
          onChange={(event) =>
            dispatchPageState({
              type: 'setQueueFilter',
              field: 'entityTypeFilter',
              value: event.target.value,
            })
          }
        >
          <option value="">{t('adminIntegrations.allEntities')}</option>
          {['employee', 'store', 'kpi', 'assignment', 'position', 'company', 'region'].map((entity) => (
            <option key={entity} value={entity}>{entity}</option>
          ))}
        </IntegrationSelect>
        <IntegrationSelect
          aria-label={t('adminIntegrations.filterStatus')}
          value={statusFilter}
          onChange={(event) =>
            dispatchPageState({
              type: 'setQueueFilter',
              field: 'statusFilter',
              value: event.target.value,
            })
          }
        >
          <option value="">{t('adminIntegrations.allStatuses')}</option>
          {['pending', 'queued', 'processing', 'completed', 'completed_with_errors', 'failed'].map((status) => (
            <option key={status} value={status}>{status}</option>
          ))}
        </IntegrationSelect>
        <Button
          type="button"
          variant="outline"
          onClick={() => dispatchPageState({ type: 'clearQueueFilters' })}
        >
          {t('adminIntegrations.clearFilters')}
        </Button>
      </div>

      {sortedItems.length === 0 ? (
        <AdminSurfaceEmpty
          title={t('adminIntegrations.noQueueItemsTitle')}
          copy={t('adminIntegrations.noQueueItemsCopy')}
        />
      ) : (
        <div className="tw:grid tw:gap-2">
          {sortedItems.map((item) => (
            <article
              className="tw:grid tw:gap-3 tw:rounded-xl tw:border tw:border-border tw:bg-background/70 tw:p-3 tw:shadow-sm tw:lg:grid-cols-[minmax(0,1fr)_auto] tw:lg:items-center"
              key={item.batchId}
            >
              <Link
                className="tw:block tw:min-w-0 tw:no-underline"
                to={`/admin/integrations/${item.batchId}`}
              >
                <div className="tw:flex tw:min-w-0 tw:flex-wrap tw:items-center tw:gap-2">
                  <div className="tw:min-w-0 tw:font-medium tw:text-foreground">
                    {item.sourceCode} / {item.entityType}
                  </div>
                  <AdminSurfaceBadge tone={toAdminTone(mapHealthTone(item.healthState))}>
                    {formatState(item.healthState)}
                  </AdminSurfaceBadge>
                </div>
                <div className="tw:mt-1 tw:break-all tw:text-xs tw:text-muted-foreground">{item.batchId}</div>
                <p className="tw:mt-2 tw:text-sm tw:leading-6 tw:text-muted-foreground">
                  {item.actionReason}
                </p>
                <div className="tw:mt-3 tw:flex tw:flex-wrap tw:gap-2 tw:text-xs tw:text-muted-foreground">
                  <AdminSurfaceBadge tone="neutral">
                    {t('adminIntegrations.records', { count: item.recordCount })}
                  </AdminSurfaceBadge>
                  <AdminSurfaceBadge tone={item.errorCount > 0 ? 'danger' : 'neutral'}>
                    {t('adminIntegrations.errors', { count: item.errorCount })}
                  </AdminSurfaceBadge>
                  <AdminSurfaceBadge tone="neutral">
                    {t('adminIntegrations.retryCount', { count: item.retryCount })}
                  </AdminSurfaceBadge>
                  {item.recommendedNextEntityType ? (
                    <AdminSurfaceBadge tone="warning">
                      {t('adminIntegrations.nextImport', { entity: item.recommendedNextEntityType })}
                    </AdminSurfaceBadge>
                  ) : null}
                </div>
                <div className="tw:mt-3 tw:flex tw:items-center tw:gap-2 tw:text-sm tw:font-medium tw:text-primary">
                  <span>{item.recommendedAction}</span>
                  <ArrowRight className="tw:size-4" aria-hidden="true" />
                </div>
              </Link>
              {item.canRetryNow ? (
                <AdminActionRow className="tw:lg:justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => retryMutation.mutate(item.batchId)}
                    disabled={retryMutation.isPending}
                  >
                    {retryMutation.isPending ? t('adminIntegrations.retrying') : t('adminIntegrations.retryBatch')}
                  </Button>
                </AdminActionRow>
              ) : null}
            </article>
          ))}
        </div>
      )}

      <AdminActionRow className="tw:justify-between">
        <Button
          type="button"
          variant="outline"
          onClick={() =>
            dispatchPageState({ type: 'setOffset', value: Math.max(0, offset - PAGE_SIZE) })
          }
          disabled={!canGoBack || isFetching}
        >
          {t('adminIntegrations.previous')}
        </Button>
        <AdminSurfaceBadge tone="neutral">
          {meta
            ? `${meta.total === 0 ? 0 : meta.offset + 1}-${Math.min(meta.offset + meta.count, meta.total)} / ${meta.total}`
            : t('adminIntegrations.zeroResults')}
        </AdminSurfaceBadge>
        <Button
          type="button"
          variant="outline"
          onClick={() => dispatchPageState({ type: 'setOffset', value: offset + PAGE_SIZE })}
          disabled={!canGoForward || isFetching}
        >
          {t('adminIntegrations.next')}
        </Button>
      </AdminActionRow>
    </AdminSurfaceSection>
  )
}

export { IntegrationErrorsPanel }
