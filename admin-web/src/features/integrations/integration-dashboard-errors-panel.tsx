import { useRef, useState } from 'react'
import { ArrowRight, Search } from 'lucide-react'
import { Link } from 'react-router'
import { Button } from '../../components/ui/button'
import { InputGroup, InputGroupAddon, InputGroupInput } from '../../components/ui/input-group'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table'
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
            onValueChange={(value) =>
              dispatchPageState({ type: 'setSortBy', value: value as IntegrationSortValue })
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
      title={t('adminIntegrations.errorsPanelTitle')}
    >
      <div className="tw:grid tw:grid-cols-1 tw:gap-2 tw:xl:grid-cols-[minmax(0,1fr)_10rem_11rem_auto]">
        <InputGroup className="integration-search">
          <InputGroupAddon><Search aria-hidden="true" /></InputGroupAddon>
          <InputGroupInput
            aria-label={t('adminIntegrations.filterQueue')}
            maxLength={SEARCH_MAX_LENGTH}
            value={search}
            onChange={(event) =>
              dispatchPageState({ type: 'setSearch', value: event.target.value })
            }
            placeholder={t('adminIntegrations.searchQueuePlaceholder')}
          />
        </InputGroup>
        <IntegrationSelect
          aria-label={t('adminIntegrations.filterEntityType')}
          value={entityTypeFilter}
          onValueChange={(value) =>
            dispatchPageState({
              type: 'setQueueFilter',
              field: 'entityTypeFilter',
              value: value,
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
          onValueChange={(value) =>
            dispatchPageState({
              type: 'setQueueFilter',
              field: 'statusFilter',
              value: value,
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
        <Table className="integration-issues-table" aria-label={t('adminIntegrations.errorsPanelTitle')} aria-busy={isFetching}>
          <TableHeader><TableRow>
            <TableHead>{t('adminIntegrations.source')}</TableHead>
            <TableHead>{t('adminIntegrations.status')}</TableHead>
            <TableHead>{t('adminIntegrations.uploadDecisionEyebrow')}</TableHead>
            <TableHead>{t('adminIntegrations.issueReason')}</TableHead>
            <TableHead><span className="tw:sr-only">{t('adminIntegrations.openBatchDetail')}</span></TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {sortedItems.map((item) => (
              <TableRow key={item.batchId}>
                <TableCell className="integration-issue-source">
                  <Link to={`/admin/integrations/${item.batchId}`} className="tw:font-medium tw:text-primary tw:underline-offset-4 hover:tw:underline">
                    {item.sourceCode}
                  </Link>
                  <span className="tw:mt-1 tw:block tw:text-xs tw:text-muted-foreground">{item.sourceName} / {formatState(item.entityType)}</span>
                  <span className="tw:mt-1 tw:block tw:break-all tw:text-xs tw:text-muted-foreground">{item.batchId}</span>
                </TableCell>
                <TableCell>
                  <AdminSurfaceBadge tone={toAdminTone(mapHealthTone(item.healthState))}>{formatState(item.healthState)}</AdminSurfaceBadge>
                </TableCell>
                <TableCell className="integration-issue-counts">
                  <span>{t('adminIntegrations.records', { count: item.recordCount })}</span>
                  <span>{t('adminIntegrations.errors', { count: item.errorCount })}</span>
                  <span>{t('adminIntegrations.retryCount', { count: item.retryCount })}</span>
                </TableCell>
                <TableCell className="integration-issue-reason">
                  <p>{item.actionReason}</p>
                  <p className="tw:mt-1 tw:text-xs tw:text-muted-foreground">{item.recommendedAction}</p>
                  {item.recommendedNextEntityType ? (
                    <AdminSurfaceBadge tone="warning">{t('adminIntegrations.nextImport', { entity: item.recommendedNextEntityType })}</AdminSurfaceBadge>
                  ) : null}
                </TableCell>
                <TableCell className="integration-issue-actions">
                  <Button asChild variant="outline" size="sm">
                    <Link to={`/admin/integrations/${item.batchId}`}>
                      {t('adminIntegrations.openBatchDetail')}<ArrowRight data-icon="inline-end" aria-hidden="true" />
                    </Link>
                  </Button>
                  {item.canRetryNow ? (
                    <Button type="button" variant="outline" size="sm" onClick={() => retryMutation.mutate(item.batchId)} disabled={retryMutation.isPending}>
                      {retryMutation.isPending ? t('adminIntegrations.retrying') : t('adminIntegrations.retryBatch')}
                    </Button>
                  ) : null}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
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
