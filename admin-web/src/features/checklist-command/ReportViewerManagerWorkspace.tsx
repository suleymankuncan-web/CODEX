import { useRef, useState, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ArrowDown, ArrowUp, ChevronsUpDown, ChevronLeft, ChevronRight, ClipboardCheck, LoaderCircle, Search, Store } from 'lucide-react'
import { Button } from '../../components/ui/button'
import { ChecklistSearchField } from './ChecklistSearchField'
import { StatusBadge } from '../../components/ui/status-badge'
import { getUserFacingErrorMessage } from '../../lib/format'
import { ApiError } from '../../lib/api'
import { transientQueryRetryOptions } from '../../lib/query-retry'
import type { AuthSessionSummary } from '../auth/api'
import { getStoreQueryScopeSignature, retainScopedPlaceholder, storeChecklistCommandQueryKey } from '../auth/store-query-scope'
import { getChecklistCommandCanvas, type ChecklistCommandRow } from './api'
import { ChecklistOperationalHistoryDrawer } from './ChecklistOperationalHistoryDrawer'
import { getChecklistCommandTruthFacts, resolveChecklistCommandStatus, toggleChecklistCommandSort, type ChecklistCommandSort, type ChecklistCommandSortKey } from './model'

const STORE_PAGE_SIZE = 20

export function ReportViewerManagerWorkspace(input: {
  authSummary: AuthSessionSummary | null
  locale: 'tr' | 'en'
  managerName: string
  managerUserId: string
  onOpenResult: (checklistInstanceId: string, trigger: HTMLElement | null) => void
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
        previousFilters?.managerUserId === input.managerUserId
          && previousFilters?.period === input.period,
      )
    },
    ...transientQueryRetryOptions,
  })
  const copy = input.locale === 'tr' ? trCopy : enCopy
  const protectedFailure = storesQuery.error instanceof ApiError && (storesQuery.error.status === 401 || storesQuery.error.status === 403)
  const data = protectedFailure ? undefined : storesQuery.data?.data
  const pageNumber = Math.floor(offset / STORE_PAGE_SIZE) + 1
  const pageCount = Math.max(1, Math.ceil((data?.page.total ?? 0) / STORE_PAGE_SIZE))

  return (
    <section className="tw:@container tw:min-w-0 tw:overflow-hidden tw:rounded-2xl tw:border tw:border-border tw:bg-card tw:shadow-sm" aria-busy={storesQuery.isFetching} aria-labelledby="report-viewer-active-manager">
      <header className="tw:flex tw:flex-col tw:gap-2.5 tw:border-b tw:border-border tw:px-3 tw:py-3 tw:sm:px-4 tw:@min-[600px]:flex-row tw:@min-[600px]:items-center tw:@min-[600px]:justify-between">
        <div className="tw:min-w-0"><h2 id="report-viewer-active-manager" data-testid="report-viewer-active-manager" className="tw:m-0 tw:truncate tw:text-lg tw:font-semibold tw:tracking-[-0.02em]">{input.managerName}</h2><p className="tw:mt-0.5 tw:mb-0 tw:flex tw:items-center tw:gap-1.5 tw:text-[11px] tw:text-muted-foreground"><span>{data ? `${data.metrics.totalStores} ${copy.assignedStores}` : copy.storesTitle}</span><LoaderCircle aria-hidden className={`tw:size-3 tw:text-primary ${storesQuery.isFetching && data ? 'tw:animate-spin tw:opacity-100' : 'tw:opacity-0'}`} /></p></div>
        <div className="tw:w-full tw:@min-[600px]:max-w-[240px]"><ChecklistSearchField label={copy.search} value={search} count={data?.page.total} onChange={value => setFilterState({ workspaceKey, search: value, offset: 0, sort })} /></div>
      </header>

      {storesQuery.isLoading && !data ? <WorkspaceMessage icon={<Store />} title={copy.loading} /> : null}
      {storesQuery.isError && !data ? <WorkspaceMessage icon={<Store />} title={protectedFailure ? copy.forbidden : copy.error} copy={protectedFailure ? copy.forbiddenCopy : getUserFacingErrorMessage(storesQuery.error, copy.errorCopy)} action={protectedFailure ? undefined : <Button size="sm" variant="outline" onClick={() => void storesQuery.refetch()}>{copy.retry}</Button>} /> : null}
      {data && data.items.length === 0 ? <WorkspaceMessage icon={<Search />} title={copy.empty} copy={copy.emptyCopy} /> : null}

      {data && data.items.length > 0 ? (
        <div role="table" aria-label={copy.storesTitle}>
          <div role="row" className="checklist-search-heading tw:hidden tw:min-h-11 tw:grid-cols-[minmax(90px,1.35fr)_minmax(40px,.65fr)_28px_minmax(44px,.7fr)_minmax(76px,1fr)_minmax(48px,.75fr)_80px_96px] tw:items-center tw:gap-1.5 tw:border-b tw:border-border tw:px-3 tw:text-[9px] tw:font-bold tw:uppercase tw:tracking-[0.11em] tw:text-muted-foreground tw:@min-[600px]:grid">
            <SortableHeader label={copy.store} sort={sort} sortKey="store" onSort={(sortKey) => setFilterState({ workspaceKey, search, offset: 0, sort: toggleChecklistCommandSort(sort, sortKey) })} />
            <SortableHeader label={copy.bmScore} sort={sort} sortKey="bm" onSort={(sortKey) => setFilterState({ workspaceKey, search, offset: 0, sort: toggleChecklistCommandSort(sort, sortKey) })} />
            <SortableHeader label={copy.vmScore} sort={sort} sortKey="vm" onSort={(sortKey) => setFilterState({ workspaceKey, search, offset: 0, sort: toggleChecklistCommandSort(sort, sortKey) })} />
            <SortableHeader label={copy.openTasks} sort={sort} sortKey="open_actions" onSort={(sortKey) => setFilterState({ workspaceKey, search, offset: 0, sort: toggleChecklistCommandSort(sort, sortKey) })} />
            <SortableHeader label={copy.lastVisit} sort={sort} sortKey="last_visit" onSort={(sortKey) => setFilterState({ workspaceKey, search, offset: 0, sort: toggleChecklistCommandSort(sort, sortKey) })} />
            <SortableHeader label={copy.elapsed} sort={sort} sortKey="elapsed" onSort={(sortKey) => setFilterState({ workspaceKey, search, offset: 0, sort: toggleChecklistCommandSort(sort, sortKey) })} />
            <SortableHeader label={copy.status} sort={sort} sortKey="status" onSort={(sortKey) => setFilterState({ workspaceKey, search, offset: 0, sort: toggleChecklistCommandSort(sort, sortKey) })} />
            <span role="columnheader"><span className="tw:sr-only">{copy.actions}</span></span>
          </div>
          {data.items.map((row) => (
            <div role="row" key={row.storeId} className="tw:grid tw:min-h-12 tw:grid-cols-[minmax(0,1fr)_auto] tw:items-center tw:gap-x-3 tw:gap-y-1.5 tw:border-b tw:border-border/80 tw:px-3 tw:py-2 tw:last:border-b-0 tw:hover:bg-muted/30 tw:@min-[600px]:grid-cols-[minmax(90px,1.35fr)_minmax(40px,.65fr)_28px_minmax(44px,.7fr)_minmax(76px,1fr)_minmax(48px,.75fr)_80px_96px] tw:@min-[600px]:gap-1.5 tw:@min-[600px]:px-3">
              {(() => {
                const facts = getChecklistCommandTruthFacts(row)
                return <>
              <span role="cell" className="tw:min-w-0"><strong className="tw:block tw:break-words tw:text-[13px] tw:leading-snug tw:font-semibold tw:text-foreground">{row.storeName}</strong></span>
              <span role="cell" className="tw:col-start-1 tw:row-start-2 tw:text-[11px] tw:font-semibold tw:tabular-nums tw:@min-[600px]:col-auto tw:@min-[600px]:row-auto tw:@min-[600px]:text-center"><small className="tw:mr-1 tw:text-[10px] tw:font-semibold tw:@min-[600px]:hidden">{copy.bmScore}:</small>{formatScore(facts.bmScore)}</span>
              <span role="cell" className="tw:col-start-1 tw:row-start-3 tw:text-[11px] tw:font-semibold tw:tabular-nums tw:@min-[600px]:col-auto tw:@min-[600px]:row-auto tw:@min-[600px]:text-center"><small className="tw:mr-1 tw:text-[10px] tw:font-semibold tw:@min-[600px]:hidden">{copy.vmScore}:</small>{formatScore(facts.vmScore)}</span>
              <span role="cell" className="tw:col-start-1 tw:row-start-4 tw:text-[11px] tw:font-semibold tw:tabular-nums tw:@min-[600px]:col-auto tw:@min-[600px]:row-auto tw:@min-[600px]:text-center"><small className="tw:mr-1 tw:text-[10px] tw:font-semibold tw:@min-[600px]:hidden">{copy.openTasks}:</small>{facts.openTaskCount}</span>
              <span role="cell" className="tw:col-start-1 tw:row-start-6 tw:text-[11px] tw:text-muted-foreground tw:@min-[600px]:col-auto tw:@min-[600px]:row-auto tw:@min-[600px]:text-center"><small className="tw:mr-1 tw:text-[10px] tw:font-semibold tw:text-foreground tw:@min-[600px]:hidden">{copy.lastVisit}:</small>{formatVisit(row.lastCompletedVisitAt, input.locale, copy.noVisit)}</span>
              <span role="cell" className="tw:col-start-2 tw:row-start-6 tw:justify-self-end tw:text-[11px] tw:text-muted-foreground tw:tabular-nums tw:@min-[600px]:col-auto tw:@min-[600px]:row-auto tw:@min-[600px]:justify-self-stretch tw:@min-[600px]:text-center"><small className="tw:mr-1 tw:text-[10px] tw:font-semibold tw:text-foreground tw:@min-[600px]:hidden">{copy.elapsed}:</small>{formatElapsed(row.elapsedDaysSinceLastVisit, copy.days)}</span>
              <span role="cell" className="tw:col-start-2 tw:row-start-2 tw:justify-self-end tw:@min-[600px]:col-auto tw:@min-[600px]:row-auto tw:@min-[600px]:justify-self-center"><StoreStatus locale={input.locale} row={row} /></span>
              <span role="cell" className="tw:col-start-2 tw:row-start-1 tw:justify-self-end tw:@min-[600px]:col-auto tw:@min-[600px]:row-auto tw:@min-[600px]:justify-self-stretch"><Button className="checklist-record-history-result-action tw:w-full" size="xs" onClick={(event) => { historyTriggerRef.current = event.currentTarget; setSelectedStore(row) }}><ClipboardCheck aria-hidden /> {copy.results}</Button></span>
                </>
              })()}
            </div>
          ))}
        </div>
      ) : null}

      {data ? <footer className="tw:flex tw:items-center tw:justify-between tw:border-t tw:border-border tw:px-3 tw:py-2 tw:sm:px-4"><span className="tw:text-[11px] tw:font-medium tw:text-muted-foreground">{data.page.total} {copy.storeCount}</span><div className="tw:flex tw:items-center tw:gap-1"><Button size="icon-xs" variant="ghost" aria-label={copy.previous} disabled={offset === 0 || storesQuery.isFetching} onClick={() => setFilterState({ workspaceKey, search, offset: Math.max(0, offset - STORE_PAGE_SIZE), sort })}><ChevronLeft /></Button><span className="tw:min-w-9 tw:text-center tw:text-[11px] tw:font-semibold">{pageNumber} / {pageCount}</span><Button size="icon-xs" variant="ghost" aria-label={copy.next} disabled={!data.page.hasMore || storesQuery.isFetching} onClick={() => setFilterState({ workspaceKey, search, offset: offset + STORE_PAGE_SIZE, sort })}><ChevronRight /></Button></div></footer> : null}

      <ChecklistOperationalHistoryDrawer authSummary={input.authSummary} open={Boolean(selectedStore)} storeId={selectedStore?.storeId ?? null} storeName={selectedStore?.storeName ?? null} returnFocusRef={historyTriggerRef} onClose={() => setSelectedStore(null)} onOpenResult={(checklistInstanceId) => { setSelectedStore(null); input.onOpenResult(checklistInstanceId, historyTriggerRef.current) }} />
    </section>
  )
}

function SortableHeader(input: { label: string; onSort: (key: ChecklistCommandSortKey) => void; sort: ChecklistCommandSort; sortKey: ChecklistCommandSortKey }) {
  const active = input.sortKey === 'bm'
    ? input.sort.startsWith('bm_score_')
    : input.sortKey === 'vm'
      ? input.sort.startsWith('vm_score_')
    : input.sort.startsWith(`${input.sortKey}_`)
  const direction = active ? (input.sort.endsWith('_asc') ? 'ascending' : 'descending') : 'none'
  const SortIcon = direction === 'ascending' ? ArrowUp : direction === 'descending' ? ArrowDown : ChevronsUpDown
  const centered = input.sortKey !== 'store'
  return <span role="columnheader" aria-sort={direction} className={centered ? 'tw:flex tw:justify-center' : undefined}>
    <Button className={`tw:!h-6 tw:max-w-full tw:!gap-1 tw:overflow-hidden tw:!rounded-none tw:!border-transparent tw:!bg-transparent tw:!px-0 tw:!text-[10px] tw:font-bold tw:text-inherit tw:!shadow-none tw:hover:!bg-transparent tw:hover:text-primary tw:focus-visible:!bg-transparent ${centered ? 'tw:!justify-center' : 'tw:!justify-start'}`} size="xs" type="button" variant="ghost" onClick={() => input.onSort(input.sortKey)}>
      <span className="tw:min-w-0 tw:whitespace-normal tw:leading-tight">{input.label}</span><SortIcon aria-hidden className={`tw:size-3 tw:shrink-0 ${active ? 'tw:text-primary' : 'tw:opacity-50'}`} />
    </Button>
  </span>
}

function StoreStatus({ locale, row }: { locale: 'tr' | 'en'; row: ChecklistCommandRow }) {
  const status = resolveChecklistCommandStatus(row)
  if (status === 'active') return <StatusBadge tone="info">{locale === 'tr' ? 'Aktif taslak' : 'Active draft'}</StatusBadge>
  if (status === 'needs_visit') return <StatusBadge tone="danger">{locale === 'tr' ? 'Ziyaret eksik' : 'Visit missing'}</StatusBadge>
  if (status === 'pending') return <StatusBadge tone="warning">{locale === 'tr' ? 'Onay bekliyor' : 'Awaiting review'}</StatusBadge>
  return <StatusBadge tone="success">{locale === 'tr' ? 'Güncel' : 'Current'}</StatusBadge>
}

function formatScore(value: number | null) {
  return value === null ? '—' : Math.round(value)
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

const trCopy = { actions: 'İşlemler', assignedStores: 'sorumlu mağaza', bmScore: 'Puan (BM)', blockedTasks: 'Bloke görev', days: 'gün', elapsed: 'Geçen süre', empty: 'Mağaza bulunamadı', emptyCopy: 'Aramayı değiştirerek yeniden deneyin.', error: 'Mağazalar açılamadı', errorCopy: 'Mağaza verileri şu anda okunamıyor.', forbidden: 'Mağazalara erişilemiyor', forbiddenCopy: 'Bu mağazalar yetkili okuma kapsamınızda değil.', lastVisit: 'Son ziyaret', loading: 'Mağazalar yükleniyor', next: 'Sonraki sayfa', noVisit: 'Henüz ziyaret yok', openTasks: 'Açık görev', previous: 'Önceki sayfa', results: 'Sonuçlar', retry: 'Tekrar dene', search: 'Mağaza ara', status: 'Durum', store: 'Mağaza', storeCount: 'mağaza', storesTitle: 'Sorumlu mağazalar', vmScore: 'VM' } as const
const enCopy = { actions: 'Actions', assignedStores: 'assigned stores', bmScore: 'BM score', blockedTasks: 'Blocked tasks', days: 'days', elapsed: 'Elapsed', empty: 'No stores found', emptyCopy: 'Change your search and try again.', error: 'Stores unavailable', errorCopy: 'Store data cannot be read right now.', forbidden: 'Stores unavailable', forbiddenCopy: 'These stores are outside your authorized read scope.', lastVisit: 'Last visit', loading: 'Loading stores', next: 'Next page', noVisit: 'No visit yet', openTasks: 'Open tasks', previous: 'Previous page', results: 'Results', retry: 'Retry', search: 'Search stores', status: 'Status', store: 'Store', storeCount: 'stores', storesTitle: 'Assigned stores', vmScore: 'VM score' } as const
