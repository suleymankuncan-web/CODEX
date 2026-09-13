import { TargetMonthPicker } from '../features/targets/command-workspace/target-month-picker'
import { TargetManagerDirectory as RequestManagerDirectory } from '../features/targets/command-workspace/target-manager-directory'
import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, CheckCircle2, Clock3, Inbox, Search, Undo2, RotateCcw, ArrowUpDown, ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Table, TableBody, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { AuthSessionSummary } from '../features/auth/api'
import { canListTargetDistributionRequests } from '../features/auth/authorization'
import { getStoreQueryScopeSignature } from '../features/auth/store-query-scope'
import { useLocalization } from '../features/localization/useLocalization'
import { getRequestCenterWorkspace } from '../features/store-approvals/request-center-api'
import { getRegionManagerDirectory } from '../features/org/region-manager-directory'
import { CommandCanvasPage } from '../features/store-command-canvas/primitives'
import { ApiError } from '../lib/api'
import { getUserFacingErrorMessage } from '../lib/format'
import type { AppLocale } from '../lib/i18n'
import { buildRequestCenterRows, requestBusinessMonth, filterAndSortRequestCenterRows, formatCopy, PAGE_SIZE, requestCenterCopy, type RequestCenterCopy, type RequestCenterRow, type RequestCenterSort, type RequestCenterStatus, type RequestCenterTab, type RequestCenterType } from './store-approvals-request-center-model'
import { RequestCenterMobileCard, RequestCenterSelect, RequestCenterTableRow } from './store-approvals-request-center-sections'
import { resolveStoreApprovalsPersona, type StoreApprovalsPersona } from './store-approvals-model'
import { OperationsMetrics, StoreOperationsHeader } from './store-operations-layout'
import { StoreEmptyState } from './store-surface-primitives'
import './store-approvals-command-canvas.css'

export function StoreApprovalsPage({ authSummary }: { authSummary: AuthSessionSummary | null }) {
  const { locale } = useLocalization()
  const scopeKey = getStoreQueryScopeSignature(authSummary)
  return <RequestCenterSurface key={scopeKey} canRead={canListTargetDistributionRequests(authSummary)} copy={requestCenterCopy[locale]} locale={locale} persona={resolveStoreApprovalsPersona(authSummary)} scopeKey={scopeKey} />
}

function RequestCenterSurface(input: { canRead: boolean; copy: RequestCenterCopy; locale: AppLocale; persona: StoreApprovalsPersona; scopeKey: string }) {
  const [activeTab, setActiveTab] = useState<RequestCenterTab>('open')
  const [page, setPage] = useState(1)
  const [query, setQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState<RequestCenterType>('all')
  const [statusFilter, setStatusFilter] = useState<RequestCenterStatus>('all')
  const [periodFilter, setPeriodFilter] = useState('all')
  const [managerUserId, setManagerUserId] = useState('all')
  const [sort, setSort] = useState<RequestCenterSort>('updatedDesc')
  const [selectedRow, setSelectedRow] = useState<RequestCenterRow | null>(null)
  const workspaceQuery = useQuery({ queryKey: ['request-center-workspace', input.scopeKey], queryFn: getRequestCenterWorkspace, enabled: input.canRead })
  const directoryQuery = useQuery({ queryKey:['region-manager-directory',input.scopeKey], queryFn:getRegionManagerDirectory, enabled:input.canRead && input.persona === 'reportViewer' })
  const denied = workspaceQuery.error instanceof ApiError && [401, 403].includes(workspaceQuery.error.status)
  const items = denied ? undefined : workspaceQuery.data?.items
  const allRows = useMemo(() => buildRequestCenterRows({ copy: input.copy, locale: input.locale, persona: input.persona, items: input.persona === 'reportViewer' ? (items ?? []).map(item => ({ ...item, regionName: '', regionManagerNames: (directoryQuery.data?.items ?? []).filter(manager => manager.storeIds.includes(item.storeId)).map(manager => manager.displayName) })) : items ?? [] }), [input.copy, input.locale, input.persona, items, directoryQuery.data])
  const scopedRows = useMemo(() => {
    if(managerUserId === 'all') return allRows
    const manager=directoryQuery.data?.items.find(item => item.userId === managerUserId)
    const storeIds=new Set(manager?.storeIds ?? [])
    const requestIds=new Set((items ?? []).filter(item => storeIds.has(item.storeId)).map(item => `${item.requestType}:${item.requestId}`))
    return allRows.filter(row => requestIds.has(row.id))
  }, [allRows, items, directoryQuery.data, managerUserId])
  const visibleRows = useMemo(() => filterAndSortRequestCenterRows({ rows: scopedRows, tab: activeTab, query, type: typeFilter, status: statusFilter, period: periodFilter, sort }), [activeTab, scopedRows, periodFilter, query, sort, statusFilter, typeFilter])
  const metricRows = scopedRows.filter(row => periodFilter === 'all' || requestBusinessMonth(row.updatedAt) === periodFilter)
  const counts = { open:metricRows.filter(row => row.bucket === 'open').length, done:metricRows.filter(row => row.bucket === 'done').length, returned:metricRows.filter(row => row.status === 'rejected' && row.bucket === 'open').length, overdue:metricRows.filter(row => row.isOverdue).length }
  const totalPages = Math.max(1, Math.ceil(visibleRows.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const pageRows = visibleRows.slice((safePage-1)*PAGE_SIZE, safePage*PAGE_SIZE)
  const tr = input.locale === 'tr'
  const resetFilters = () => { setQuery(''); setTypeFilter('all'); setStatusFilter('all'); setPeriodFilter('all'); setManagerUserId('all'); setSort('updatedDesc'); setPage(1) }
  const chooseMetric = (metric: RequestCenterStatus | 'open' | 'done') => { if (metric === 'open' || metric === 'done') { setActiveTab(metric); setStatusFilter('all') } else { setActiveTab('open'); setStatusFilter(metric) }; setPage(1) }
  const openRow = (row: RequestCenterRow) => setSelectedRow(current => current?.id === row.id ? null : row)
  const metricActive = statusFilter === 'returned' || statusFilter === 'overdue' ? statusFilter : activeTab
  const loading = workspaceQuery.isPending && input.canRead
  const unavailable = !input.canRead || denied || (workspaceQuery.isError && !workspaceQuery.data)
  return <CommandCanvasPage ariaLabelledBy="store-approvals-request-center-title" className="approvals-command-page" testId="store-approvals-ledger">
    <StoreOperationsHeader icon={Inbox} title={input.copy.title} titleId="store-approvals-request-center-title" eyebrow={input.persona === 'reportViewer' ? (tr ? 'Rapor görüntüleyici' : 'Report viewer') : input.persona === 'storeManager' ? (tr ? 'Mağaza müdürü' : 'Store manager') : (tr ? 'Bölge müdürü' : 'Region manager')} description={tr ? 'Hedef ve personel taleplerinin durumunu takip edin.' : 'Track target and personnel requests.'} actions={<TargetMonthPicker value={periodFilter} locale={input.locale} ariaLabel={tr ? 'Talep dönemi' : 'Request period'} triggerClassName="operations-period" allowAll onValueChange={value => { setPeriodFilter(value); setPage(1) }} />} />
    {unavailable ? <Alert variant="destructive"><AlertDescription>{!input.canRead || denied ? (tr ? 'Bu görünüm için erişim yetkiniz bulunmuyor.' : 'You do not have access to this view.') : getUserFacingErrorMessage(workspaceQuery.error,input.copy.errorTitle)}<Button variant="outline" onClick={() => void workspaceQuery.refetch()}>{tr ? 'Tekrar dene' : 'Retry'}</Button></AlertDescription></Alert> : loading ? <div aria-label={input.copy.loadingTitle} role="status" className="tw:grid tw:gap-4"><Skeleton className="tw:h-20" /><Skeleton className="tw:h-64" /></div> : <>
      {workspaceQuery.isError ? <Alert variant="destructive"><AlertDescription>{tr ? 'Güncelleme alınamadı. Son kayıtlar gösteriliyor.' : 'Refresh failed. Showing the last records.'}<Button variant="outline" onClick={() => void workspaceQuery.refetch()}>{tr ? 'Tekrar dene' : 'Retry'}</Button></AlertDescription></Alert> : null}
      <OperationsMetrics label={tr ? 'Talep merkezi özetleri' : 'Request summaries'} items={[
        {id:'open',label:input.copy.openMetric,value:counts.open,icon:Clock3,selected:metricActive === 'open',onClick:() => chooseMetric('open')},
        {id:'done',label:input.copy.completedMetric,value:counts.done,icon:CheckCircle2,selected:metricActive === 'done',onClick:() => chooseMetric('done')},
        {id:'returned',label:input.copy.returnedMetric,value:counts.returned,icon:Undo2,selected:metricActive === 'returned',onClick:() => chooseMetric('returned')},
        {id:'overdue',label:input.copy.overdueMetric,value:counts.overdue,icon:AlertTriangle,selected:metricActive === 'overdue',onClick:() => chooseMetric('overdue')},
      ]} />
      <div className={`operations-workspace${input.persona === 'reportViewer' ? ' operations-workspace-with-directory' : ''}`}>
        {input.persona === 'reportViewer' ? <RequestManagerDirectory locale={input.locale} selection={{ items: directoryQuery.data?.items ?? [], value: managerUserId, onChange: value => { setManagerUserId(value); setPage(1); setSelectedRow(null) }, loading: directoryQuery.isPending, error: directoryQuery.isError, onRetry: () => void directoryQuery.refetch() }} /> : null}
        <Tabs className="operations-board approvals-command-list" value={activeTab} onValueChange={value => {setActiveTab(value as RequestCenterTab);setStatusFilter('all');setPage(1)}}>
          <div className="operations-board-toolbar"><div className="operations-board-title"><h2>{input.persona === 'reportViewer' ? input.copy.viewerTableTitle : input.persona === 'regionManager' ? input.copy.regionTableTitle : input.copy.storeTableTitle}</h2><TabsList className="approvals-view-tabs" aria-label={tr ? 'Talep görünümü' : 'Request view'}><TabsTrigger value="open"><Clock3 size={16} aria-hidden="true"/>{input.copy.openTab}<Badge variant="secondary">{counts.open}</Badge></TabsTrigger><TabsTrigger value="done"><CheckCircle2 size={16} aria-hidden="true"/>{input.copy.doneTab}<Badge variant="secondary">{counts.done}</Badge></TabsTrigger></TabsList></div>
          <div className="operations-filters"><InputGroup><InputGroupAddon><Search aria-hidden="true" /></InputGroupAddon><InputGroupInput aria-label={input.copy.searchPlaceholder} value={query} onChange={event => {setQuery(event.target.value);setPage(1)}} placeholder={input.copy.searchPlaceholder} /><InputGroupAddon align="inline-end"><Badge variant="secondary">{visibleRows.length}</Badge></InputGroupAddon></InputGroup>
            <RequestCenterSelect ariaLabel={input.copy.allTypes} value={typeFilter} onChange={value => {setTypeFilter(value as RequestCenterType);setPage(1)}} items={[{value:'all',label:input.copy.allTypes},{value:'target',label:input.copy.targetType},{value:'sellerCode',label:input.copy.sellerCodeType},{value:'offboarding',label:input.copy.offboardingType},{value:'personnelCorrection',label:input.copy.correctionType}]} />
            <RequestCenterSelect ariaLabel={input.copy.allStatuses} value={statusFilter} onChange={value => {setStatusFilter(value as RequestCenterStatus);if(value === 'approved')setActiveTab('done');else if(value !== 'all')setActiveTab('open');setPage(1)}} items={[{value:'all',label:input.copy.allStatuses},{value:'pending',label:tr ? 'Onay bekliyor' : 'Awaiting approval'},{value:'returned',label:input.copy.rejectedStatus},{value:'overdue',label:input.copy.overdueMetric},{value:'approved',label:input.copy.approvedStatus}]} />
            <RequestCenterSelect ariaLabel={input.copy.allSorts} value={sort} onChange={value => setSort(value as RequestCenterSort)} items={[{value:'updatedDesc',label:input.copy.allSorts},{value:'updatedAsc',label:tr ? 'En eski güncelleme' : 'Oldest update'},{value:'waitingDesc',label:input.copy.waitingSort},{value:'storeAsc',label:input.copy.storeSort},{value:'typeAsc',label:input.copy.typeSort}]} />
            <Button variant="ghost" onClick={resetFilters}><RotateCcw data-icon="inline-start" aria-hidden="true" />{input.copy.resetFilters}</Button>
          </div></div>
          <TabsContent value={activeTab}>
            {!visibleRows.length ? <div className="tw:p-4"><StoreEmptyState title={allRows.length ? input.copy.emptyTitle : tr ? 'Henüz talep kaydı yok' : 'No requests yet'} description={input.copy.emptyCopy} action={{label:input.copy.resetFilters,onClick:resetFilters,variant:'outline'}} /></div> : <><div className="approvals-command-desktop"><Table><TableHeader><TableRow><SortableHead label={input.copy.requestColumn} sort={sort} sortKey="type" onSort={setSort} /><SortableHead label={input.copy.scopeColumnRegion} sort={sort} sortKey="store" onSort={setSort} /><TableHead>{input.copy.statusColumn}</TableHead><SortableHead label={input.copy.waitingColumn} sort={sort} sortKey="waiting" onSort={setSort} /><TableHead>{input.copy.ownerColumn}</TableHead><SortableHead label={input.copy.updatedColumn} sort={sort} sortKey="updated" onSort={setSort} /></TableRow></TableHeader><TableBody>{pageRows.map(row => <RequestCenterTableRow key={row.id} row={row} onOpen={openRow} inlineCopy={input.copy} expanded={selectedRow?.id === row.id} />)}</TableBody></Table></div><div className="approvals-command-mobile">{pageRows.map(row => <RequestCenterMobileCard key={row.id} row={row} onOpen={openRow} inlineCopy={input.copy} expanded={selectedRow?.id === row.id} />)}</div></>}
            <div className="operations-pager"><span>{formatCopy(input.copy.pager,{from:String(visibleRows.length ? (safePage-1)*PAGE_SIZE+1 : 0),to:String(Math.min(safePage*PAGE_SIZE,visibleRows.length)),total:String(visibleRows.length)})}</span><div><Button variant="outline" size="icon" aria-label={tr ? 'Önceki sayfa' : 'Previous page'} disabled={safePage === 1} onClick={() => setPage(safePage-1)}><ChevronLeft aria-hidden="true" /></Button><span>{safePage} / {totalPages}</span><Button variant="outline" size="icon" aria-label={tr ? 'Sonraki sayfa' : 'Next page'} disabled={safePage === totalPages} onClick={() => setPage(safePage+1)}><ChevronRight aria-hidden="true" /></Button></div></div>
          </TabsContent>
        </Tabs>
      </div>
    </>}
  </CommandCanvasPage>
}

function SortableHead(input:{label:string;onSort:(sort:RequestCenterSort)=>void;sort:RequestCenterSort;sortKey:'type'|'store'|'waiting'|'updated'}) {
  const active=input.sort.startsWith(input.sortKey)
  const direction=active && input.sort.endsWith('Desc') ? 'descending' : active ? 'ascending' : 'none'
  return <TableHead aria-sort={direction}><Button variant="ghost" size="sm" onClick={() => input.onSort(`${input.sortKey}${direction === 'descending' ? 'Asc' : 'Desc'}` as RequestCenterSort)}>{input.label}<ArrowUpDown data-icon="inline-end" aria-hidden="true" /></Button></TableHead>
}
