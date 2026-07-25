import { useMemo, useRef, useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { AlertTriangle, CheckCircle2, Clock3, RefreshCcw, Search, Undo2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { AuthSessionSummary } from '../features/auth/api'
import { canListTargetDistributionRequests } from '../features/auth/authorization'
import { useLocalization } from '../features/localization/useLocalization'
import { getRequestCenterWorkspace } from '../features/store-approvals/request-center-api'
import {
  CommandCanvasDataList,
  CommandCanvasFilterBar,
  CommandCanvasMetricFilter,
  CommandCanvasMetricRail,
  CommandCanvasPage,
  CommandCanvasPageHeader,
} from '../features/store-command-canvas/primitives'
import { getUserFacingErrorMessage } from '../lib/format'
import type { AppLocale } from '../lib/i18n'
import { buildRequestCenterRows, createPeriodOptions, filterAndSortRequestCenterRows, formatCopy, PAGE_SIZE, requestCenterCopy, type RequestCenterCopy, type RequestCenterRow, type RequestCenterSort, type RequestCenterStatus, type RequestCenterTab, type RequestCenterType } from './store-approvals-request-center-model'
import { RequestCenterDrawer, RequestCenterMobileCard, RequestCenterSelect, RequestCenterTableRow } from './store-approvals-request-center-sections'
import { resolveStoreApprovalsPersona, type StoreApprovalsPersona } from './store-approvals-model'
import { StoreEmptyState, StoreErrorState, StoreLoadingState, StoreSurfacePage } from './store-surface-primitives'
import './store-approvals-command-canvas.css'

export function StoreApprovalsPage({ authSummary }: { authSummary: AuthSessionSummary | null }) {
  const { locale } = useLocalization()
  const persona = resolveStoreApprovalsPersona(authSummary)
  const scopeKey = [persona, authSummary?.user.userId ?? 'anonymous', authSummary?.user.roleCodes.join('|') ?? '', authSummary?.user.readScope.companyIds.join('|') ?? '', authSummary?.user.readScope.regionIds.join('|') ?? '', authSummary?.user.readScope.storeIds.join('|') ?? '', authSummary?.user.actionScope.assignedStoreIds.join('|') ?? ''].join(':')
  return <RequestCenterSurface key={scopeKey} canRead={canListTargetDistributionRequests(authSummary)} copy={requestCenterCopy[locale]} locale={locale} persona={persona} scopeKey={scopeKey} />
}

function RequestCenterSurface(input: { canRead: boolean; copy: RequestCenterCopy; locale: AppLocale; persona: StoreApprovalsPersona; scopeKey: string }) {
  const [activeTab, setActiveTab] = useState<RequestCenterTab>('open')
  const [page, setPage] = useState(1)
  const [query, setQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState<RequestCenterType>('all')
  const [statusFilter, setStatusFilter] = useState<RequestCenterStatus>('all')
  const [periodFilter, setPeriodFilter] = useState('all')
  const [sort, setSort] = useState<RequestCenterSort>('updatedDesc')
  const [selectedRow, setSelectedRow] = useState<RequestCenterRow | null>(null)
  const drawerTriggerRef = useRef<HTMLElement | null>(null)
  const workspaceQuery = useQuery({ queryKey: ['request-center-workspace', input.scopeKey], queryFn: getRequestCenterWorkspace, enabled: input.canRead, placeholderData: keepPreviousData })
  const allRows = useMemo(() => buildRequestCenterRows({ copy: input.copy, locale: input.locale, persona: input.persona, items: workspaceQuery.data?.items ?? [] }), [input.copy, input.locale, input.persona, workspaceQuery.data?.items])
  const visibleRows = useMemo(() => filterAndSortRequestCenterRows({ rows: allRows, tab: activeTab, query, type: typeFilter, status: statusFilter, period: periodFilter, sort }), [activeTab, allRows, periodFilter, query, sort, statusFilter, typeFilter])
  const periodOptions = useMemo(() => createPeriodOptions(allRows.map((row) => row.updatedAt.slice(0, 7)), input.locale), [allRows, input.locale])
  const totalPages = Math.max(1, Math.ceil(visibleRows.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const pageRows = visibleRows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)
  const pageGroups = useMemo(() => groupRequestRows(pageRows, input.copy.managerUnknown), [input.copy.managerUnknown, pageRows])
  const from = visibleRows.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1
  const to = Math.min(safePage * PAGE_SIZE, visibleRows.length)
  const counts = useMemo(() => ({ open: allRows.filter((row) => row.bucket === 'open').length, done: allRows.filter((row) => row.bucket === 'done').length, returned: allRows.filter((row) => row.status === 'rejected').length, overdue: allRows.filter((row) => row.isOverdue).length }), [allRows])

  const resetFilters = () => { setQuery(''); setTypeFilter('all'); setStatusFilter('all'); setPeriodFilter('all'); setSort('updatedDesc'); setPage(1) }
  const chooseMetric = (metric: RequestCenterStatus | 'open' | 'done') => { if (metric === 'open' || metric === 'done') { setActiveTab(metric); setStatusFilter('all') } else { setActiveTab(metric === 'returned' || metric === 'overdue' ? 'open' : activeTab); setStatusFilter(metric) }; setPage(1) }
  const openRow = (row: RequestCenterRow, trigger: HTMLElement) => { drawerTriggerRef.current = trigger; setSelectedRow(row) }
  const closeDrawer = () => { setSelectedRow(null); window.setTimeout(() => drawerTriggerRef.current?.focus(), 0) }
  const metricActive: RequestCenterStatus | 'open' | 'done' = statusFilter === 'returned' || statusFilter === 'overdue' ? statusFilter : activeTab

  if (!input.canRead) return <StoreSurfacePage ariaLabel={input.copy.aria}><StoreErrorState title={input.copy.errorTitle} description="Bu görünüm için okuma yetkiniz bulunmuyor." /></StoreSurfacePage>
  if (workspaceQuery.isLoading && !workspaceQuery.data) return <StoreLoadingState title={input.copy.loadingTitle} description={input.copy.loadingCopy} />
  if (workspaceQuery.isError && !workspaceQuery.data) return <StoreSurfacePage ariaLabel={input.copy.aria}><StoreErrorState title={input.copy.errorTitle} description={getUserFacingErrorMessage(workspaceQuery.error, 'Talep merkezi verisi alınamadı. Tekrar deneyin.')} /></StoreSurfacePage>

  return <CommandCanvasPage ariaLabelledBy="store-approvals-request-center-title" className="approvals-command-page" testId="store-approvals-ledger">
    <CommandCanvasPageHeader
      title={input.copy.title}
      titleId="store-approvals-request-center-title"
      eyebrow={input.persona === 'reportViewer' ? 'Şirket görünümü · Salt okunur' : input.persona === 'storeManager' ? 'Mağaza görünümü' : 'Bölge görünümü'}
      description="Hedef, personel kodu ve ayrılış taleplerini tek akışta izleyin."
      actions={<RequestCenterSelect ariaLabel={input.copy.periodAll} value={periodFilter} onChange={(value) => { setPeriodFilter(value); setPage(1) }} items={[{ value: 'all', label: input.copy.periodAll }, ...periodOptions]} />}
    />
    {workspaceQuery.isError && workspaceQuery.data ? (
      <div className="approvals-command-partial-error" role="alert">
        <span>Son alınan kayıtlar gösteriliyor; güncel veriler alınamadı.</span>
        <Button type="button" variant="outline" onClick={() => void workspaceQuery.refetch()}>Tekrar dene</Button>
      </div>
    ) : null}
    <CommandCanvasMetricRail ariaLabel="Talep merkezi özetleri">
      <CommandCanvasMetricFilter label={input.copy.openMetric} note="İşlem bekliyor" value={String(counts.open)} icon={<Clock3 size={16} />} tone="amber" active={metricActive === 'open'} onClick={() => chooseMetric('open')} />
      <CommandCanvasMetricFilter label={input.copy.completedMetric} note="Bu dönem" value={String(counts.done)} icon={<CheckCircle2 size={16} />} tone="mint" active={metricActive === 'done'} onClick={() => chooseMetric('done')} />
      <CommandCanvasMetricFilter label={input.copy.returnedMetric} note="Düzeltme bekliyor" value={String(counts.returned)} icon={<Undo2 size={16} />} tone="rose" active={metricActive === 'returned'} onClick={() => chooseMetric('returned')} />
      <CommandCanvasMetricFilter label={input.copy.overdueMetric} note="Müdahale gerekli" value={String(counts.overdue)} icon={<AlertTriangle size={16} />} tone="rose" active={metricActive === 'overdue'} onClick={() => chooseMetric('overdue')} />
    </CommandCanvasMetricRail>
    <CommandCanvasFilterBar
      updatingLabel="Talep görünümü güncelleniyor"
      isUpdating={workspaceQuery.isFetching}
      search={<label className="approvals-command-search"><Search aria-hidden="true" size={15} /><span className="tw:sr-only">{input.copy.searchPlaceholder}</span><Input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1) }} placeholder={input.copy.searchPlaceholder} /></label>}
      controls={<>
        <RequestCenterSelect ariaLabel={input.copy.allTypes} value={typeFilter} onChange={(value) => { setTypeFilter(value as RequestCenterType); setPage(1) }} items={[{ value: 'all', label: input.copy.allTypes }, { value: 'target', label: input.copy.targetType }, { value: 'sellerCode', label: input.copy.sellerCodeType }, { value: 'offboarding', label: input.copy.offboardingType }]} />
        <RequestCenterSelect ariaLabel={input.copy.allStatuses} value={statusFilter} onChange={(value) => { setStatusFilter(value as RequestCenterStatus); setPage(1) }} items={[{ value: 'all', label: input.copy.allStatuses }, { value: 'pending', label: input.copy.pendingHrStatus }, { value: 'returned', label: input.copy.rejectedStatus }, { value: 'overdue', label: input.copy.overdueMetric }, { value: 'approved', label: input.copy.approvedStatus }]} />
        <RequestCenterSelect ariaLabel={input.copy.allSorts} value={sort} onChange={(value) => setSort(value as RequestCenterSort)} items={[
          { value: 'updatedDesc', label: `${input.copy.updatedColumn} · Yeni-eski` },
          { value: 'updatedAsc', label: `${input.copy.updatedColumn} · Eski-yeni` },
          { value: 'waitingDesc', label: `${input.copy.waitingColumn} · Uzun-kısa` },
          { value: 'waitingAsc', label: `${input.copy.waitingColumn} · Kısa-uzun` },
          { value: 'storeAsc', label: `${input.copy.storeSort} · A-Z` },
          { value: 'storeDesc', label: `${input.copy.storeSort} · Z-A` },
          { value: 'typeAsc', label: `${input.copy.typeSort} · A-Z` },
          { value: 'typeDesc', label: `${input.copy.typeSort} · Z-A` },
        ]} />
        <Button type="button" variant="outline" onClick={resetFilters} className="approvals-command-reset"><RefreshCcw size={14} />{input.copy.resetFilters}</Button>
      </>}
    />
    <div className="approvals-command-list-title">
      <div><h2>{input.persona === 'reportViewer' ? input.copy.viewerTableTitle : input.persona === 'regionManager' ? input.copy.regionTableTitle : input.copy.storeTableTitle}</h2><span>{formatCopy(activeTab === 'open' ? input.copy.countOpen : input.copy.countDone, { count: String(visibleRows.length) })}</span></div>
      <div className="approvals-command-tabs" role="radiogroup" aria-label="Talep görünümü">
        <button type="button" role="radio" aria-checked={activeTab === 'open'} onClick={() => { setActiveTab('open'); setStatusFilter('all'); setPage(1) }}>{input.copy.openTab}</button>
        <button type="button" role="radio" aria-checked={activeTab === 'done'} onClick={() => { setActiveTab('done'); setStatusFilter('all'); setPage(1) }}>{input.copy.doneTab}</button>
      </div>
    </div>
    <CommandCanvasDataList ariaLabel={input.locale === 'tr' ? 'Talep akışı' : 'Request flow'} className="approvals-command-list">
      {visibleRows.length === 0 ? <div className="tw:p-4"><StoreEmptyState title={allRows.length === 0 ? 'Henüz talep kaydı yok' : input.copy.emptyTitle} description={allRows.length === 0 ? 'Yetkili kapsamınızda bir talep oluştuğunda burada görünecek.' : input.copy.emptyCopy} {...(allRows.length > 0 ? { action: { label: input.copy.resetFilters, onClick: resetFilters, variant: 'outline' as const } } : {})} /></div> : <><div className="approvals-command-desktop"><Table><TableHeader><TableRow><SortableHead label={input.copy.requestColumn} sort={sort} sortKey="type" onSort={setSort} /><SortableHead label={input.persona === 'storeManager' ? input.copy.scopeColumnStore : input.copy.scopeColumnRegion} sort={sort} sortKey="store" onSort={setSort} /><TableHead>{input.copy.statusColumn}</TableHead><SortableHead label={input.copy.waitingColumn} sort={sort} sortKey="waiting" onSort={setSort} /><TableHead>{input.copy.ownerColumn}</TableHead><SortableHead label={input.copy.updatedColumn} sort={sort} sortKey="updated" onSort={setSort} /></TableRow></TableHeader>{pageGroups.map((group) => <TableBody key={group.key}>{input.persona === 'reportViewer' ? <TableRow className="approvals-command-manager-row"><TableCell colSpan={6}><strong>{group.managerLabel}</strong><span>{group.regionName} · {formatCopy(input.copy.groupCount, { count: String(group.rows.length) })}</span></TableCell></TableRow> : null}{group.rows.map((row) => <RequestCenterTableRow key={row.id} row={row} onOpen={openRow} />)}</TableBody>)}</Table></div><div className="approvals-command-mobile">{pageGroups.map((group) => <section key={group.key}>{input.persona === 'reportViewer' ? <h3>{group.managerLabel}<span>{group.regionName} · {formatCopy(input.copy.groupCount, { count: String(group.rows.length) })}</span></h3> : null}{group.rows.map((row) => <RequestCenterMobileCard key={row.id} row={row} onOpen={openRow} />)}</section>)}</div></>}
      <div className="approvals-command-pager"><span>{formatCopy(input.copy.pager, { from: String(from), to: String(to), total: String(visibleRows.length) })}</span><div>{Array.from({ length: totalPages }, (_, index) => index + 1).slice(Math.max(0, safePage - 2), safePage + 1).map((pageNumber) => <Button key={pageNumber} type="button" size="icon" variant={pageNumber === safePage ? 'secondary' : 'outline'} onClick={() => setPage(pageNumber)} aria-label={`Sayfa ${pageNumber}`}>{pageNumber}</Button>)}</div></div>
    </CommandCanvasDataList>
    <RequestCenterDrawer copy={input.copy} row={selectedRow} onOpenChange={(open) => { if (!open) closeDrawer() }} />
  </CommandCanvasPage>
}

function SortableHead(input: {
  label: string
  onSort: (sort: RequestCenterSort) => void
  sort: RequestCenterSort
  sortKey: 'type' | 'store' | 'waiting' | 'updated'
}) {
  const active = input.sort.startsWith(input.sortKey)
  const direction = active && input.sort.endsWith('Desc') ? 'descending' : active ? 'ascending' : 'none'
  return <TableHead aria-sort={direction} className="tw:px-4"><button type="button" onClick={() => input.onSort(`${input.sortKey}${active && direction === 'descending' ? 'Asc' : 'Desc'}` as RequestCenterSort)} className="tw:min-h-11 tw:text-[11px] tw:font-medium tw:uppercase tw:tracking-[0.02em]">{input.label}{active ? direction === 'descending' ? ' ↓' : ' ↑' : ''}</button></TableHead>
}

function groupRequestRows(rows: RequestCenterRow[], managerUnknown: string) {
  const groups = new Map<string, { key: string; regionName: string; managerLabel: string; rows: RequestCenterRow[] }>()
  for (const row of rows) {
    const key = row.regionId
    const current = groups.get(key) ?? { key, regionName: row.regionName, managerLabel: row.regionManagerNames.length > 0 ? row.regionManagerNames.join(', ') : managerUnknown, rows: [] }
    current.rows.push(row)
    groups.set(key, current)
  }
  return [...groups.values()]
}
