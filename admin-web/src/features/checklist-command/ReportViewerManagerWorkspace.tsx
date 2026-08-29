import { useRef, useState, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ArrowDown, ArrowUp, ChevronsUpDown, ChevronLeft, ChevronRight, ClipboardCheck, LoaderCircle, Search, Store } from 'lucide-react'
import { Badge } from '../../components/ui/badge'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { getUserFacingErrorMessage } from '../../lib/format'
import type { AuthSessionSummary } from '../auth/api'
import { getStoreQueryScopeSignature, retainScopedPlaceholder, storeChecklistCommandQueryKey } from '../auth/store-query-scope'
import { getChecklistCommandCanvas, type ChecklistCommandRow } from './api'
import { ChecklistOperationalHistoryDrawer } from './ChecklistOperationalHistoryDrawer'
import { toggleChecklistCommandSort, type ChecklistCommandSort, type ChecklistCommandSortKey } from './model'

const STORE_PAGE_SIZE = 20

export function ReportViewerManagerWorkspace(input: {
  authSummary: AuthSessionSummary | null
  locale: 'tr' | 'en'
  managerName: string
  managerUserId: string
  onOpenResult: (checklistInstanceId: string) => void
  period: string
}) {
  const workspaceKey = `${input.managerUserId}:${input.period}`
  const [filterState, setFilterState] = useState<{ workspaceKey: string; search: string; offset: number; sort: ChecklistCommandSort }>({ workspaceKey, search: '', offset: 0, sort: 'store_asc' })
  const search = filterState.workspaceKey === workspaceKey ? filterState.search : ''
  const offset = filterState.workspaceKey === workspaceKey ? filterState.offset : 0
  const sort = filterState.workspaceKey === workspaceKey ? filterState.sort : 'store_asc'
  const [selectedStore, setSelectedStore] = useState<ChecklistCommandRow | null>(null)
  const historyTriggerRef = useRef<HTMLElement | null>(null)
  const filters = { period: input.period, managerUserId: input.managerUserId, status: 'all' as const, sort, query: search.trim(), limit: STORE_PAGE_SIZE, offset }
  const scopeSignature = getStoreQueryScopeSignature(input.authSummary)
  const storesQuery = useQuery({
    queryKey: storeChecklistCommandQueryKey(input.authSummary, filters),
    queryFn: () => getChecklistCommandCanvas(filters),
    placeholderData: (previous, previousQuery) => {
      const previousFilters = previousQuery?.queryKey[2] as typeof filters | undefined
      return retainScopedPlaceholder(
        previous,
        previousQuery?.queryKey,
        scopeSignature,
        previousFilters?.managerUserId === input.managerUserId,
      )
    },
  })
  const copy = input.locale === 'tr' ? trCopy : enCopy
  const data = storesQuery.data?.data
  const pageNumber = Math.floor(offset / STORE_PAGE_SIZE) + 1
  const pageCount = Math.max(1, Math.ceil((data?.page.total ?? 0) / STORE_PAGE_SIZE))

  return (
    <section className="tw:min-w-0 tw:overflow-hidden tw:rounded-2xl tw:border tw:border-border tw:bg-card tw:shadow-sm" aria-busy={storesQuery.isFetching} aria-labelledby="report-viewer-active-manager">
      <header className="tw:flex tw:flex-col tw:gap-2.5 tw:border-b tw:border-border tw:px-3 tw:py-3 tw:sm:px-4 tw:lg:flex-row tw:lg:items-center tw:lg:justify-between">
        <div className="tw:min-w-0"><h2 id="report-viewer-active-manager" data-testid="report-viewer-active-manager" className="tw:m-0 tw:truncate tw:text-lg tw:font-semibold tw:tracking-[-0.02em]">{input.managerName}</h2><p className="tw:mt-0.5 tw:mb-0 tw:flex tw:items-center tw:gap-1.5 tw:text-[11px] tw:text-muted-foreground"><span>{data ? `${data.metrics.totalStores} ${copy.assignedStores}` : copy.storesTitle}</span><LoaderCircle aria-hidden className={`tw:size-3 tw:text-primary ${storesQuery.isFetching && data ? 'tw:animate-spin tw:opacity-100' : 'tw:opacity-0'}`} /></p></div>
        <label className="tw:relative tw:block tw:w-full tw:lg:max-w-[240px]"><Search aria-hidden className="tw:absolute tw:top-1/2 tw:left-2.5 tw:size-3.5 tw:-translate-y-1/2 tw:text-muted-foreground" /><span className="tw:sr-only">{copy.search}</span><Input className="tw:bg-muted/30 tw:pl-8 tw:text-xs tw:shadow-none" value={search} placeholder={copy.search} onChange={(event) => setFilterState({ workspaceKey, search: event.target.value, offset: 0, sort })} /></label>
      </header>

      {storesQuery.isLoading && !data ? <WorkspaceMessage icon={<Store />} title={copy.loading} /> : null}
      {storesQuery.isError && !data ? <WorkspaceMessage icon={<Store />} title={copy.error} copy={getUserFacingErrorMessage(storesQuery.error, copy.errorCopy)} action={<Button size="sm" variant="outline" onClick={() => void storesQuery.refetch()}>{copy.retry}</Button>} /> : null}
      {data && data.items.length === 0 ? <WorkspaceMessage icon={<Search />} title={copy.empty} copy={copy.emptyCopy} /> : null}

      {data && data.items.length > 0 ? (
        <div role="table" aria-label={copy.storesTitle}>
          <div role="row" className="tw:hidden tw:min-h-8 tw:grid-cols-[minmax(138px,1fr)_48px_104px_84px_96px_minmax(12px,0.4fr)_88px] tw:items-center tw:gap-3 tw:border-b tw:border-border tw:px-4 tw:text-[9px] tw:font-bold tw:uppercase tw:tracking-[0.11em] tw:text-muted-foreground tw:lg:grid">
            <SortableHeader label={copy.store} sort={sort} sortKey="store" onSort={(sortKey) => setFilterState({ workspaceKey, search, offset: 0, sort: toggleChecklistCommandSort(sort, sortKey) })} />
            <SortableHeader label={copy.score} sort={sort} sortKey="bm" onSort={(sortKey) => setFilterState({ workspaceKey, search, offset: 0, sort: toggleChecklistCommandSort(sort, sortKey) })} />
            <SortableHeader label={copy.lastVisit} sort={sort} sortKey="last_visit" onSort={(sortKey) => setFilterState({ workspaceKey, search, offset: 0, sort: toggleChecklistCommandSort(sort, sortKey) })} />
            <SortableHeader label={copy.elapsed} sort={sort} sortKey="elapsed" onSort={(sortKey) => setFilterState({ workspaceKey, search, offset: 0, sort: toggleChecklistCommandSort(sort, sortKey) })} />
            <SortableHeader label={copy.status} sort={sort} sortKey="status" onSort={(sortKey) => setFilterState({ workspaceKey, search, offset: 0, sort: toggleChecklistCommandSort(sort, sortKey) })} />
            <span role="columnheader" className="tw:col-start-7 tw:sr-only">{copy.actions}</span>
          </div>
          {data.items.map((row) => (
            <div role="row" key={row.storeId} className="tw:grid tw:min-h-12 tw:grid-cols-[minmax(0,1fr)_auto] tw:items-center tw:gap-x-3 tw:gap-y-1.5 tw:border-b tw:border-border/80 tw:px-3 tw:py-2 tw:last:border-b-0 tw:hover:bg-muted/30 tw:lg:grid-cols-[minmax(138px,1fr)_48px_104px_84px_96px_minmax(12px,0.4fr)_88px] tw:lg:gap-3 tw:lg:px-4">
              <span role="cell" className="tw:min-w-0"><strong className="tw:block tw:truncate tw:text-[13px] tw:font-semibold tw:text-foreground">{row.storeName}</strong></span>
              <span role="cell" className="tw:col-start-1 tw:row-start-2 tw:text-[11px] tw:font-semibold tw:tabular-nums tw:lg:col-auto tw:lg:row-auto tw:lg:text-center"><small className="tw:mr-1 tw:text-[10px] tw:font-semibold tw:lg:hidden">{copy.score}:</small>{row.bmScore === null ? '-' : Math.round(row.bmScore)}</span>
              <span role="cell" className="tw:col-start-1 tw:row-start-3 tw:text-[11px] tw:text-muted-foreground tw:lg:col-auto tw:lg:row-auto tw:lg:text-center"><small className="tw:mr-1 tw:text-[10px] tw:font-semibold tw:text-foreground tw:lg:hidden">{copy.lastVisit}:</small>{formatVisit(row.lastCompletedVisitAt, input.locale, copy.noVisit)}</span>
              <span role="cell" className="tw:col-start-2 tw:row-start-3 tw:justify-self-end tw:text-[11px] tw:text-muted-foreground tw:tabular-nums tw:lg:col-auto tw:lg:row-auto tw:lg:justify-self-stretch tw:lg:text-center"><small className="tw:mr-1 tw:text-[10px] tw:font-semibold tw:text-foreground tw:lg:hidden">{copy.elapsed}:</small>{formatElapsed(row.elapsedDaysSinceLastVisit, copy.days)}</span>
              <span role="cell" className="tw:col-start-2 tw:row-start-2 tw:justify-self-end tw:lg:col-auto tw:lg:row-auto tw:lg:justify-self-center"><StoreStatus locale={input.locale} row={row} /></span>
              <span role="cell" className="tw:col-start-2 tw:row-start-1 tw:justify-self-end tw:lg:col-start-7 tw:lg:row-auto"><Button className="checklist-record-history-result-action tw:w-full" size="xs" onClick={(event) => { historyTriggerRef.current = event.currentTarget; setSelectedStore(row) }}><ClipboardCheck aria-hidden /> {copy.results}</Button></span>
            </div>
          ))}
        </div>
      ) : null}

      {data ? <footer className="tw:flex tw:items-center tw:justify-between tw:border-t tw:border-border tw:px-3 tw:py-2 tw:sm:px-4"><span className="tw:text-[11px] tw:font-medium tw:text-muted-foreground">{data.page.total} {copy.storeCount}</span><div className="tw:flex tw:items-center tw:gap-1"><Button size="icon-xs" variant="ghost" aria-label={copy.previous} disabled={offset === 0 || storesQuery.isFetching} onClick={() => setFilterState({ workspaceKey, search, offset: Math.max(0, offset - STORE_PAGE_SIZE), sort })}><ChevronLeft /></Button><span className="tw:min-w-9 tw:text-center tw:text-[11px] tw:font-semibold">{pageNumber} / {pageCount}</span><Button size="icon-xs" variant="ghost" aria-label={copy.next} disabled={!data.page.hasMore || storesQuery.isFetching} onClick={() => setFilterState({ workspaceKey, search, offset: offset + STORE_PAGE_SIZE, sort })}><ChevronRight /></Button></div></footer> : null}

      <ChecklistOperationalHistoryDrawer authSummary={input.authSummary} open={Boolean(selectedStore)} storeId={selectedStore?.storeId ?? null} storeName={selectedStore?.storeName ?? null} returnFocusRef={historyTriggerRef} onClose={() => setSelectedStore(null)} onOpenResult={(checklistInstanceId) => { setSelectedStore(null); input.onOpenResult(checklistInstanceId) }} />
    </section>
  )
}

function SortableHeader(input: { label: string; onSort: (key: ChecklistCommandSortKey) => void; sort: ChecklistCommandSort; sortKey: ChecklistCommandSortKey }) {
  const active = input.sortKey === 'bm'
    ? input.sort.startsWith('bm_score_')
    : input.sort.startsWith(`${input.sortKey}_`)
  const direction = active ? (input.sort.endsWith('_asc') ? 'ascending' : 'descending') : 'none'
  const SortIcon = direction === 'ascending' ? ArrowUp : direction === 'descending' ? ArrowDown : ChevronsUpDown
  const centered = input.sortKey !== 'store'
  return <span role="columnheader" aria-sort={direction} className={centered ? 'tw:flex tw:justify-center' : undefined}>
    <Button className={`tw:!h-6 tw:max-w-full tw:!gap-1 tw:overflow-hidden tw:!rounded-none tw:!border-transparent tw:!bg-transparent tw:!px-0 tw:text-[9px] tw:font-bold tw:text-inherit tw:!shadow-none tw:hover:!bg-transparent tw:hover:text-primary tw:focus-visible:!bg-transparent ${centered ? 'tw:!justify-center' : 'tw:!justify-start'}`} size="xs" type="button" variant="ghost" onClick={() => input.onSort(input.sortKey)}>
      <span>{input.label}</span><SortIcon aria-hidden className={`tw:size-3 ${active ? 'tw:text-primary' : 'tw:opacity-50'}`} />
    </Button>
  </span>
}

function StoreStatus({ locale, row }: { locale: 'tr' | 'en'; row: ChecklistCommandRow }) {
  if (row.activeBmChecklistCount > 0) return <Badge className="tw:border-blue-200 tw:bg-blue-50 tw:text-blue-700">{locale === 'tr' ? 'Aktif taslak' : 'Active draft'}</Badge>
  if (row.status === 'needs_visit') return <Badge className="tw:border-rose-200 tw:bg-rose-50 tw:text-rose-700">{locale === 'tr' ? 'Ziyaret eksik' : 'Visit missing'}</Badge>
  if (row.pendingBmAcknowledgementCount > 0) return <Badge className="tw:border-amber-200 tw:bg-amber-50 tw:text-amber-800">{locale === 'tr' ? 'Onay bekliyor' : 'Awaiting review'}</Badge>
  return <Badge className="tw:border-emerald-200 tw:bg-emerald-50 tw:text-emerald-700">{locale === 'tr' ? 'Güncel' : 'Current'}</Badge>
}

function WorkspaceMessage(input: { action?: ReactNode; copy?: string; icon: ReactNode; title: string }) {
  return <div className="tw:flex tw:min-h-56 tw:items-center tw:justify-center tw:gap-3 tw:p-7 tw:text-muted-foreground"><span className="tw:text-primary">{input.icon}</span><div><strong className="tw:text-sm tw:text-foreground">{input.title}</strong>{input.copy ? <p className="tw:mt-1 tw:mb-3 tw:text-xs">{input.copy}</p> : null}{input.action}</div></div>
}

function formatVisit(value: string | null, locale: 'tr' | 'en', fallback: string) {
  if (!value) return fallback
  return new Intl.DateTimeFormat(locale === 'tr' ? 'tr-TR' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Europe/Istanbul' }).format(new Date(value))
}

function formatElapsed(value: number | null, days: string) {
  return value === null ? '-' : `${value} ${days}`
}

const trCopy = { actions: 'İşlemler', assignedStores: 'sorumlu mağaza', days: 'gün', elapsed: 'Geçen süre', empty: 'Mağaza bulunamadı', emptyCopy: 'Aramayı değiştirerek yeniden deneyin.', error: 'Mağazalar açılamadı', errorCopy: 'Mağaza verileri şu anda okunamıyor.', lastVisit: 'Son ziyaret', loading: 'Mağazalar yükleniyor', next: 'Sonraki sayfa', noVisit: 'Henüz ziyaret yok', previous: 'Önceki sayfa', results: 'Sonuçlar', retry: 'Tekrar dene', score: 'Puan', search: 'Mağaza ara', status: 'Durum', store: 'Mağaza', storeCount: 'mağaza', storesTitle: 'Sorumlu mağazalar' } as const
const enCopy = { actions: 'Actions', assignedStores: 'assigned stores', days: 'days', elapsed: 'Elapsed', empty: 'No stores found', emptyCopy: 'Change the search and try again.', error: 'Stores unavailable', errorCopy: 'Store data cannot be read right now.', lastVisit: 'Last visit', loading: 'Loading stores', next: 'Next page', noVisit: 'No visit yet', previous: 'Previous page', results: 'Results', retry: 'Retry', score: 'Score', search: 'Search stores', status: 'Status', store: 'Store', storeCount: 'stores', storesTitle: 'Assigned stores' } as const
