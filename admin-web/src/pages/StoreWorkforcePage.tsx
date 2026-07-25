import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import {
  BriefcaseBusiness,
  ChevronLeft,
  ChevronRight,
  Clock3,
  History,
  Search,
  Store,
  UserMinus,
  UserPlus,
  UsersRound,
} from 'lucide-react'
import type { AuthSessionSummary } from '../features/auth/api'
import { getStoreQueryScopeSignature, retainScopedPlaceholder } from '../features/auth/store-query-scope'
import {
  CommandCanvasDataList,
  CommandCanvasFilterBar,
  CommandCanvasMetricFilter,
  CommandCanvasMetricRail,
  CommandCanvasOperationalDrawerContent,
  CommandCanvasPage,
  CommandCanvasPageHeader,
  CommandCanvasSortableHeading,
} from '../features/store-command-canvas/primitives'
import {
  getWorkforceCommandWorkspace,
  type WorkforceCommandStore,
} from '../features/workforce/api'
import {
  filterAndSortPersonnel,
  filterAndSortStores,
  type SortDirection,
  type WorkforcePersonSort,
  type WorkforceRail,
  type WorkforceStoreSort,
  workforceWorkspaceQueryKey,
  workforceStoreStatus,
} from '../features/workforce/workforce-command-model'
import {
  WorkforceRequestDialogs,
  type WorkforceRequestDialog,
} from '../features/workforce/workforce-request-dialogs'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select'
import { Sheet, SheetDescription, SheetHeader, SheetTitle } from '../components/ui/sheet'
import { getUserFacingErrorMessage } from '../lib/format'
import './store-workforce-command-canvas.css'

const STORE_PAGE_SIZE = 50
const PERSON_PAGE_SIZE = 8
const HISTORY_PAGE_SIZE = 20

export function StoreWorkforcePage(input: { authSummary: AuthSessionSummary | null }) {
  const scopeSignature = getStoreQueryScopeSignature(input.authSummary)
  const previousScopeSignature = useRef(scopeSignature)
  const [searchParams] = useSearchParams()
  const [offset, setOffset] = useState(0)
  const [query, setQuery] = useState('')
  const deferredQuery = useDeferredValue(query)
  const [status, setStatus] = useState<'all' | 'shortage' | 'balanced' | 'surplus' | 'unconfigured'>('all')
  const [rail, setRail] = useState<WorkforceRail>('all')
  const [storeSort, setStoreSort] = useState<WorkforceStoreSort>('store')
  const [storeDirection, setStoreDirection] = useState<SortDirection>('ascending')
  const [personSort, setPersonSort] = useState<WorkforcePersonSort>('person')
  const [personDirection, setPersonDirection] = useState<SortDirection>('ascending')
  const [position, setPosition] = useState('all')
  const [personPage, setPersonPage] = useState(0)
  const [personnelOffset, setPersonnelOffset] = useState(0)
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null)
  const [historyStoreId, setHistoryStoreId] = useState<string | null>(null)
  const [historyOffset, setHistoryOffset] = useState(0)
  const requestType = searchParams.get('requestType')
  const requestId = searchParams.get('requestId')
  const [requestDialog, setRequestDialog] = useState<WorkforceRequestDialog>(() => requestId && requestType === 'sellerCode' ? 'seller' : requestId && requestType === 'offboarding' ? 'offboarding' : null)

  useEffect(() => {
    if (previousScopeSignature.current === scopeSignature) return
    previousScopeSignature.current = scopeSignature
    setOffset(0)
    setPersonnelOffset(0)
    setPersonPage(0)
    setSelectedStoreId(null)
    setHistoryStoreId(null)
    setHistoryOffset(0)
    setRequestDialog(null)
  }, [scopeSignature])

  const workspaceQuery = useQuery({
    queryKey: workforceWorkspaceQueryKey({
      scopeSignature,
      offset,
      personnelOffset,
      query: deferredQuery,
      status,
      sort: storeSort,
      direction: storeDirection,
      rail,
    }),
    queryFn: () => getWorkforceCommandWorkspace({
      limit: STORE_PAGE_SIZE,
      offset,
      personnelLimit: 50,
      personnelOffset,
      q: deferredQuery,
      status: rail === 'gap' ? 'shortage' : status,
      sort: storeSort,
      direction: storeDirection,
    }),
    placeholderData: (previousData, previousQuery) => retainScopedPlaceholder(previousData, previousQuery?.queryKey, scopeSignature),
  })
  const workspace = workspaceQuery.data
  const directStore = workspace?.view === 'store_manager' ? workspace.stores.items[0] ?? null : null
  const selectedStoreSummary = workspace?.stores.items.find((item) => item.storeId === selectedStoreId) ?? null
  const detailQuery = useQuery({
    queryKey: ['store-workforce-command-detail', scopeSignature, selectedStoreId, offset, personnelOffset, deferredQuery, status, storeSort, storeDirection, rail],
    queryFn: () => getWorkforceCommandWorkspace({
      limit: STORE_PAGE_SIZE,
      offset,
      personnelStoreId: selectedStoreId!,
      personnelLimit: 50,
      personnelOffset,
      q: deferredQuery,
      status: rail === 'gap' ? 'shortage' : status,
      sort: storeSort,
      direction: storeDirection,
    }),
    enabled: Boolean(selectedStoreId),
    placeholderData: (previousData, previousQuery) => retainScopedPlaceholder(previousData, previousQuery?.queryKey, scopeSignature),
  })
  const selectedStore = detailQuery.data?.stores.items.find((item) => item.storeId === selectedStoreId) ?? selectedStoreSummary
  const personnelStore = directStore ?? selectedStore
  const now = useMemo(() => new Date(), [])

  const visibleStores = useMemo(() => filterAndSortStores({
    stores: workspace?.stores.items ?? [], query, status, rail, sort: storeSort, direction: storeDirection,
  }), [workspace?.stores.items, query, status, rail, storeSort, storeDirection])
  const visiblePersonnel = useMemo(() => filterAndSortPersonnel({
    personnel: personnelStore?.personnel ?? [], query, position, sort: personSort,
    direction: personDirection, now,
  }), [personnelStore?.personnel, query, position, personSort, personDirection, now])
  const positions = useMemo(() => [...new Set((personnelStore?.personnel ?? []).map((item) => item.positionName))].sort(), [personnelStore?.personnel])
  const personPageCount = Math.max(1, Math.ceil(visiblePersonnel.length / PERSON_PAGE_SIZE))
  const safePersonPage = Math.min(personPage, personPageCount - 1)
  const pagedPersonnel = visiblePersonnel.slice(safePersonPage * PERSON_PAGE_SIZE, (safePersonPage + 1) * PERSON_PAGE_SIZE)
  const selectedHistoryStore = directStore?.storeId === historyStoreId ? directStore : selectedStore?.storeId === historyStoreId ? selectedStore : null
  const historyQuery = useQuery({
    queryKey: ['store-workforce-command-history', scopeSignature, historyStoreId, historyOffset],
    queryFn: () => getWorkforceCommandWorkspace({ historyStoreId: historyStoreId!, historyLimit: HISTORY_PAGE_SIZE, historyOffset, limit: 1, offset: 0 }),
    enabled: Boolean(historyStoreId),
  })

  if (workspaceQuery.isLoading && !workspace) return <WorkforceState title="Norm Kadro hazırlanıyor" description="Yetkili mağaza ve personel kapsamı yükleniyor." />
  if (workspaceQuery.isError && !workspace) {
    return <WorkforceState title="Norm Kadro açılamadı" description={getUserFacingErrorMessage(workspaceQuery.error, 'Veriler alınamadı.')} onRetry={() => void workspaceQuery.refetch()} />
  }
  if (!workspace) return null

  const isStoreManager = workspace.view === 'store_manager'
  const canManageRequests = workspace.capabilities.canCreateSellerCodeRequest
    || workspace.capabilities.canCreateOffboardingRequest
  const totalLabel = isStoreManager ? 'Mağaza' : 'Toplam mağaza'
  const averageTenure = formatTenure(workspace.summary.averageTenureDays)
  const openRequestDialog = (dialog: Exclude<WorkforceRequestDialog, null>) => setRequestDialog(dialog)
  const requestStoreId = directStore?.storeId ?? ''

  const chooseStoreSort = (next: WorkforceStoreSort) => {
    if (storeSort === next) setStoreDirection((value) => value === 'ascending' ? 'descending' : 'ascending')
    else { setStoreSort(next); setStoreDirection('ascending') }
    setOffset(0)
  }
  const choosePersonSort = (next: WorkforcePersonSort) => {
    if (personSort === next) setPersonDirection((value) => value === 'ascending' ? 'descending' : 'ascending')
    else { setPersonSort(next); setPersonDirection('ascending') }
    setPersonPage(0)
  }
  const loadNextPersonnelBatch = () => {
    setPersonnelOffset((value) => value + 50)
    setPersonPage(0)
  }
  const loadPreviousPersonnelBatch = () => {
    setPersonnelOffset((value) => Math.max(0, value - 50))
    setPersonPage(0)
  }

  return (
    <CommandCanvasPage ariaLabelledBy="workforce-command-title" className="workforce-command-page" testId="store-workforce-page">
      <CommandCanvasPageHeader
        title="Norm Kadro"
        titleId="workforce-command-title"
        eyebrow={workspace.view === 'report_viewer' ? 'Şirket görünümü · Salt okunur' : isStoreManager ? 'Mağaza görünümü' : 'Bölge görünümü'}
        description={isStoreManager ? 'Personel durumunuzu ve açık hareketleri yönetin.' : 'Mağaza kadro dengesini ve eksik sürelerini izleyin.'}
        actions={isStoreManager && canManageRequests ? (
          <>
            <Button variant="ghost" onClick={() => openRequestDialog('returned')}>İade edilen talepler</Button>
            {workspace.capabilities.canCreateOffboardingRequest ? <Button variant="outline" onClick={() => openRequestDialog('offboarding')}><UserMinus /> İşten ayrılma talebi</Button> : null}
            {workspace.capabilities.canCreateSellerCodeRequest ? <Button onClick={() => openRequestDialog('seller')}><UserPlus /> Personel sicil talebi</Button> : null}
          </>
        ) : undefined}
      />
      {workspaceQuery.isError && workspace ? (
        <div className="workforce-partial-error" role="alert">
          <span>Son alınan kadro verileri gösteriliyor; güncel veriler alınamadı.</span>
          <Button variant="outline" onClick={() => void workspaceQuery.refetch()}>Tekrar dene</Button>
        </div>
      ) : null}

      <CommandCanvasMetricRail ariaLabel="Norm Kadro özeti">
        <CommandCanvasMetricFilter label={totalLabel} value={String(workspace.summary.totalStores)} note="Aktif görünüm" icon={<Store size={16} />} active={rail === 'all'} onClick={() => { setRail('all'); setStatus('all'); setPosition('all'); setQuery(''); setOffset(0); setPersonPage(0) }} />
        <CommandCanvasMetricFilter label="Aktif personel" value={String(workspace.summary.activePersonnel)} note="Toplam çalışan" icon={<UsersRound size={16} />} tone="cyan" active={rail === 'active'} onClick={() => { setRail('active'); if (isStoreManager) { setPersonSort('person'); setPersonDirection('ascending'); setPersonPage(0) } else { setStoreSort('active'); setStoreDirection('descending'); setOffset(0) } }} />
        <CommandCanvasMetricFilter label={isStoreManager ? 'Eksik kadro' : 'Eksik mağaza'} value={String(isStoreManager ? workspace.summary.openPositions : workspace.summary.shortageStores)} note={`${workspace.summary.openPositions} açık pozisyon`} icon={<UserMinus size={16} />} tone="rose" active={rail === 'gap'} onClick={() => { setRail(rail === 'gap' ? 'all' : 'gap'); setOffset(0) }} />
        <CommandCanvasMetricFilter label="Ortalama kıdem" value={averageTenure} note="Aktif personel" icon={<Clock3 size={16} />} tone="amber" active={rail === 'tenure'} onClick={() => { setRail('tenure'); if (isStoreManager) { setPersonSort('tenure'); setPersonDirection('descending'); setPersonPage(0) } else { setStoreSort('tenure'); setStoreDirection('descending'); setOffset(0) } }} />
      </CommandCanvasMetricRail>

      {isStoreManager && rail === 'gap' ? <div className="workforce-gap-notice"><strong>{workspace.summary.openPositions} açık pozisyon</strong><span>{workspace.summary.openPositions > 0 ? 'Norm ile aktif personel arasındaki güncel fark.' : 'Mağaza kadrosu güncel normla dengede.'}</span></div> : null}

      <CommandCanvasFilterBar
        updatingLabel="Norm Kadro güncelleniyor"
        isUpdating={workspaceQuery.isFetching}
        search={<label className="workforce-search"><Search aria-hidden="true" size={15} /><Input aria-label={isStoreManager ? 'Personel veya pozisyon ara' : 'Mağaza veya müdür ara'} placeholder={isStoreManager ? 'Personel veya pozisyon ara' : 'Mağaza veya müdür ara'} value={query} onChange={(event) => { setQuery(event.target.value); setOffset(0); setPersonPage(0) }} /></label>}
        controls={isStoreManager ? (
          <>
            <Select value={position} onValueChange={(value) => { setPosition(value); setPersonPage(0) }}>
              <SelectTrigger aria-label="Pozisyon"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tüm pozisyonlar</SelectItem>
                {positions.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={personSort} onValueChange={(value) => choosePersonSort(value as WorkforcePersonSort)}>
              <SelectTrigger aria-label="Personel sıralaması"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="person">Ad</SelectItem>
                <SelectItem value="position">Pozisyon</SelectItem>
                <SelectItem value="start">İşe giriş</SelectItem>
                <SelectItem value="tenure">Çalışma süresi</SelectItem>
              </SelectContent>
            </Select>
          </>
        ) : (
          <>
            <Select value={status} onValueChange={(value) => { setStatus(value as typeof status); setOffset(0) }}>
              <SelectTrigger aria-label="Kadro durumu"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tüm durumlar</SelectItem>
                <SelectItem value="shortage">Eksik</SelectItem>
                <SelectItem value="balanced">Tam</SelectItem>
                <SelectItem value="surplus">Fazla</SelectItem>
                <SelectItem value="unconfigured">Tanımsız</SelectItem>
              </SelectContent>
            </Select>
            <Select value={storeSort} onValueChange={(value) => chooseStoreSort(value as WorkforceStoreSort)}>
              <SelectTrigger aria-label="Mağaza sıralaması"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="store">Mağaza</SelectItem>
                <SelectItem value="active">Aktif</SelectItem>
                <SelectItem value="norm">Norm</SelectItem>
                <SelectItem value="status">Durum</SelectItem>
                <SelectItem value="shortage">Eksik süre</SelectItem>
                <SelectItem value="tenure">Ortalama kıdem</SelectItem>
              </SelectContent>
            </Select>
          </>
        )}
        actions={<Button variant="outline" onClick={() => { if (isStoreManager) setPersonDirection((value) => value === 'ascending' ? 'descending' : 'ascending'); else { setStoreDirection((value) => value === 'ascending' ? 'descending' : 'ascending'); setOffset(0) } }}>Yön: {(isStoreManager ? personDirection : storeDirection) === 'ascending' ? 'Artan' : 'Azalan'}</Button>}
      />

      {workspace.stores.items.length === 0 ? (
        <WorkforceInlineEmpty title="Kapsamda mağaza yok" description="Bu rol için görüntülenebilir aktif mağaza bulunamadı." />
      ) : isStoreManager && directStore ? (
        <div data-testid="store-workforce-personnel-list">
          <PersonnelList store={directStore} rows={pagedPersonnel} sort={personSort} direction={personDirection} onSort={choosePersonSort} onHistory={() => { setHistoryOffset(0); setHistoryStoreId(directStore.storeId) }} page={safePersonPage} pageCount={personPageCount} total={directStore.personnelTotal} onPage={setPersonPage} onNextBatch={loadNextPersonnelBatch} onPreviousBatch={loadPreviousPersonnelBatch} />
        </div>
      ) : (
        <StoreList stores={visibleStores} view={workspace.view} sort={storeSort} direction={storeDirection} onSort={chooseStoreSort} onSelect={(store) => { setSelectedStoreId(store.storeId); setPersonPage(0); setPersonnelOffset(0); setQuery('') }} pagination={workspace.stores} onOffset={setOffset} />
      )}

      <Sheet open={Boolean(selectedStore)} onOpenChange={(open) => { if (!open) setSelectedStoreId(null) }}>
        <CommandCanvasOperationalDrawerContent data-testid="store-workforce-region-detail-dialog">
          {selectedStore ? (
            <div className="workforce-drawer">
              <SheetHeader><SheetTitle>{selectedStore.storeName} kadro dosyası</SheetTitle><SheetDescription>Aktif personel ve norm dengesi.</SheetDescription></SheetHeader>
              <div className="workforce-drawer-facts"><Fact label="Norm / Fiili" value={selectedStore.norm === null ? `Tanımsız / ${selectedStore.active}` : `${selectedStore.norm} / ${selectedStore.active}`} /><Fact label="Kadro farkı" value={formatGap(selectedStore.gap)} /><Fact label="Eksik süre" value={formatShortage(selectedStore)} /></div>
              {detailQuery.isError ? <WorkforceInlineEmpty title="Mağaza dosyası alınamadı" description="Personel ayrıntıları yüklenemedi." action={() => void detailQuery.refetch()} /> : detailQuery.isFetching && selectedStore.personnel.length === 0 ? <WorkforceInlineEmpty title="Mağaza dosyası hazırlanıyor" description="Aktif personel bilgileri yükleniyor." /> : <PersonnelList compact store={selectedStore} rows={pagedPersonnel} sort={personSort} direction={personDirection} onSort={choosePersonSort} onHistory={() => { setHistoryOffset(0); setHistoryStoreId(selectedStore.storeId) }} page={safePersonPage} pageCount={personPageCount} total={selectedStore.personnelTotal} onPage={setPersonPage} onNextBatch={loadNextPersonnelBatch} onPreviousBatch={loadPreviousPersonnelBatch} />}
            </div>
          ) : null}
        </CommandCanvasOperationalDrawerContent>
      </Sheet>

      <Sheet open={Boolean(historyStoreId)} onOpenChange={(open) => { if (!open) setHistoryStoreId(null) }}>
        <CommandCanvasOperationalDrawerContent>
          <div className="workforce-drawer">
            <SheetHeader><SheetTitle>{selectedHistoryStore?.storeName ?? 'Mağaza'} · Personel geçmişi</SheetTitle><SheetDescription>Yalnız işe giriş, işten çıkış ve toplam çalışma süresi.</SheetDescription></SheetHeader>
            <HistoryList query={historyQuery} onOffset={setHistoryOffset} />
          </div>
        </CommandCanvasOperationalDrawerContent>
      </Sheet>

      {isStoreManager && canManageRequests ? <WorkforceRequestDialogs dialog={requestDialog} onDialogChange={setRequestDialog} storeId={requestStoreId} handoffRequestId={requestId} handoffRequestType={requestType} /> : null}
    </CommandCanvasPage>
  )
}

function StoreList(input: { stores: WorkforceCommandStore[]; view: 'report_viewer' | 'region_manager' | 'store_manager'; sort: WorkforceStoreSort; direction: SortDirection; onSort: (sort: WorkforceStoreSort) => void; onSelect: (store: WorkforceCommandStore) => void; pagination: { total: number; limit: number; offset: number; hasMore: boolean }; onOffset: (offset: number) => void }) {
  const stores = input.view === 'report_viewer'
    ? [...input.stores].sort((left, right) => left.regionId.localeCompare(right.regionId))
    : input.stores
  return (
    <CommandCanvasDataList ariaLabel="Mağaza kadro dengesi" header={<div className="workforce-store-grid workforce-list-head"><CommandCanvasSortableHeading semantic={false} label="Mağaza" direction={input.sort === 'store' ? input.direction : 'none'} onClick={() => input.onSort('store')} /><CommandCanvasSortableHeading semantic={false} label="Aktif" direction={input.sort === 'active' ? input.direction : 'none'} onClick={() => input.onSort('active')} /><CommandCanvasSortableHeading semantic={false} label="Norm / Fiili" direction={input.sort === 'norm' ? input.direction : 'none'} onClick={() => input.onSort('norm')} /><CommandCanvasSortableHeading semantic={false} label="Durum" direction={input.sort === 'status' ? input.direction : 'none'} onClick={() => input.onSort('status')} /><CommandCanvasSortableHeading semantic={false} label="Eksik süre" direction={input.sort === 'shortage' ? input.direction : 'none'} onClick={() => input.onSort('shortage')} /><CommandCanvasSortableHeading semantic={false} label="Ortalama kıdem" direction={input.sort === 'tenure' ? input.direction : 'none'} onClick={() => input.onSort('tenure')} /></div>} footer={<Pager offset={input.pagination.offset} limit={input.pagination.limit} total={input.pagination.total} hasMore={input.pagination.hasMore} onOffset={input.onOffset} />}>
      {stores.length === 0 ? <WorkforceInlineEmpty title="Sonuç bulunamadı" description="Filtreleri değiştirerek tekrar deneyin." /> : stores.map((store, index) => {
        const showRegion = input.view === 'report_viewer' && (index === 0 || stores[index - 1]?.regionId !== store.regionId)
        return <div key={store.storeId}>{showRegion ? <div className="workforce-region-divider"><strong>{store.regionManagerName ?? 'Bölge müdürü tanımlı değil'}</strong><span>{store.regionName ?? 'Bölge bilgisi yok'}</span></div> : null}<button className="workforce-store-grid workforce-store-row" data-testid="store-workforce-region-row" onClick={() => input.onSelect(store)} type="button"><span><strong>{store.storeName}</strong><small>{input.view === 'report_viewer' ? (store.regionManagerName ?? 'Bölge müdürü yok') : (store.regionName ?? store.storeCode)}</small></span><b>{store.active}</b><span>{store.norm === null ? `Tanımsız / ${store.active}` : `${store.norm} / ${store.active}`}</span><Status value={workforceStoreStatus(store)} /><span>{formatShortage(store)}</span><span>{formatTenure(store.averageTenureDays)}</span></button></div>
      })}
    </CommandCanvasDataList>
  )
}

function PersonnelList(input: { store: WorkforceCommandStore; rows: WorkforceCommandStore['personnel']; sort: WorkforcePersonSort; direction: SortDirection; onSort: (sort: WorkforcePersonSort) => void; onHistory: () => void; page: number; pageCount: number; total: number; onPage: (page: number) => void; onNextBatch: () => void; onPreviousBatch: () => void; compact?: boolean }) {
  return <CommandCanvasDataList className={input.compact ? 'workforce-personnel-list compact' : 'workforce-personnel-list'} ariaLabel={`${input.store.storeName} personel listesi`} header={<div className="workforce-list-title"><strong>{input.store.storeName} personel listesi</strong><span>{input.total} personel</span><Button variant="outline" onClick={input.onHistory}><History /> Mağaza personel geçmişi</Button></div>} footer={input.pageCount > 1 || input.store.personnelHasMore ? <PersonnelPager {...input} /> : undefined}>
    <div className="workforce-person-grid workforce-list-head"><CommandCanvasSortableHeading semantic={false} label="Personel" direction={input.sort === 'person' ? input.direction : 'none'} onClick={() => input.onSort('person')} /><CommandCanvasSortableHeading semantic={false} label="Pozisyon" direction={input.sort === 'position' ? input.direction : 'none'} onClick={() => input.onSort('position')} /><CommandCanvasSortableHeading semantic={false} label="İşe giriş" direction={input.sort === 'start' ? input.direction : 'none'} onClick={() => input.onSort('start')} /><CommandCanvasSortableHeading semantic={false} label="Çalışma süresi" direction={input.sort === 'tenure' ? input.direction : 'none'} onClick={() => input.onSort('tenure')} /><CommandCanvasSortableHeading semantic={false} label="Durum" direction={input.sort === 'status' ? input.direction : 'none'} onClick={() => input.onSort('status')} /></div>
    {input.rows.length === 0 ? <WorkforceInlineEmpty title="Personel bulunamadı" description="Bu filtrede aktif personel yok." /> : input.rows.map((person) => <div className="workforce-person-grid workforce-person-row" key={person.employeeId}><strong data-label="Personel">{person.displayName}</strong><span data-label="Pozisyon">{person.positionName}</span><span data-label="İşe giriş">{formatDate(person.assignmentStartDate)}</span><span data-label="Çalışma süresi">{formatTenureFromDate(person.assignmentStartDate)}</span><span className="workforce-active-pill">Aktif</span></div>)}
  </CommandCanvasDataList>
}

function HistoryList(input: { query: ReturnType<typeof useQuery<Awaited<ReturnType<typeof getWorkforceCommandWorkspace>>>>; onOffset: (offset: number) => void }) {
  if (input.query.isLoading) return <WorkforceInlineEmpty title="Geçmiş hazırlanıyor" description="Personel dönemleri yükleniyor." />
  if (input.query.isError) return <WorkforceInlineEmpty title="Geçmiş alınamadı" description="Tekrar deneyin." action={() => void input.query.refetch()} />
  const rows = input.query.data?.history?.items ?? []
  if (rows.length === 0) return <WorkforceInlineEmpty title="Geçmiş bulunamadı" description="Bu mağaza için giriş veya çıkış dönemi yok." />
  const history = input.query.data?.history
  return <><div className="workforce-history-list">{rows.map((row, index) => <article key={`${row.employeeId}-${row.entryDate}-${index}`}><div><strong>{row.displayName}</strong><span>{row.exitDate ? 'İşten çıkış kaydı' : 'Aktif çalışma dönemi'}</span></div><dl><div><dt>İşe giriş</dt><dd>{formatDate(row.entryDate)}</dd></div><div><dt>İşten çıkış</dt><dd>{formatDate(row.exitDate)}</dd></div><div><dt>Toplam çalışma</dt><dd>{formatTenure(row.totalWorkingDays)}</dd></div></dl></article>)}</div>{history ? <div className="command-canvas-list-footer"><Pager offset={history.offset} limit={history.limit} total={history.total} hasMore={history.hasMore} onOffset={input.onOffset} /></div> : null}</>
}

function Pager(input: { offset: number; limit: number; total: number; hasMore: boolean; onOffset: (offset: number) => void }) { return <><span className="workforce-pager-count">{input.total === 0 ? 0 : input.offset + 1}-{Math.min(input.offset + input.limit, input.total)} / {input.total}</span><Button size="sm" variant="outline" disabled={input.offset === 0} onClick={() => input.onOffset(Math.max(0, input.offset - input.limit))}><ChevronLeft /> Önceki</Button><Button size="sm" variant="outline" disabled={!input.hasMore} onClick={() => input.onOffset(input.offset + input.limit)}>Sonraki <ChevronRight /></Button></> }
function PersonnelPager(input: { store: WorkforceCommandStore; page: number; pageCount: number; total: number; onPage: (page: number) => void; onNextBatch: () => void; onPreviousBatch: () => void }) { const atBatchEnd = input.page + 1 >= input.pageCount; const atStart = input.page === 0; return <><span className="workforce-pager-count">{input.store.personnelOffset + input.page * PERSON_PAGE_SIZE + 1}-{Math.min(input.store.personnelOffset + (input.page + 1) * PERSON_PAGE_SIZE, input.total)} / {input.total}</span><Button size="sm" variant="outline" disabled={atStart && input.store.personnelOffset === 0} onClick={() => atStart ? input.onPreviousBatch() : input.onPage(input.page - 1)}><ChevronLeft /> Önceki</Button><Button size="sm" variant="outline" disabled={atBatchEnd && !input.store.personnelHasMore} onClick={() => atBatchEnd ? input.onNextBatch() : input.onPage(input.page + 1)}>Sonraki <ChevronRight /></Button></> }
function WorkforceState(input: { title: string; description: string; onRetry?: () => void }) { return <CommandCanvasPage ariaLabelledBy="workforce-state-title"><CommandCanvasPageHeader title="Norm Kadro" titleId="workforce-state-title" description="Personel ve kadro görünümü" /><WorkforceInlineEmpty title={input.title} description={input.description} {...(input.onRetry ? { action: input.onRetry } : {})} /></CommandCanvasPage> }
function WorkforceInlineEmpty(input: { title: string; description: string; action?: () => void }) { return <div className="workforce-empty"><BriefcaseBusiness aria-hidden="true" /><strong>{input.title}</strong><p>{input.description}</p>{input.action ? <Button variant="outline" onClick={input.action}>Tekrar dene</Button> : null}</div> }
function Status(input: { value: ReturnType<typeof workforceStoreStatus> }) { const copy = { shortage: 'Eksik', balanced: 'Tam', surplus: 'Fazla', unconfigured: 'Tanımsız' }[input.value]; return <span className="workforce-status" data-status={input.value}>{copy}</span> }
function Fact(input: { label: string; value: string }) { return <div><span>{input.label}</span><strong>{input.value}</strong></div> }
function formatGap(value: number | null) { if (value === null) return 'Tanımsız'; if (value > 0) return `${value} açık`; if (value < 0) return `${Math.abs(value)} fazla`; return 'Dengede' }
function formatShortage(store: WorkforceCommandStore) { if ((store.gap ?? 0) <= 0) return 'Yok'; return store.shortageDays === null ? 'Bilgi yok' : `${store.shortageDays} gündür` }
function formatDate(value: string | null) { if (!value) return 'Bilgi yok'; return new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(`${value}T00:00:00`)) }
function formatTenureFromDate(value: string | null) { if (!value) return 'Bilgi yok'; return formatTenure(Math.max(0, Math.floor((Date.now() - new Date(`${value}T00:00:00`).getTime()) / 86_400_000))) }
function formatTenure(days: number | null) { if (days === null) return 'Bilgi yok'; const years = Math.floor(days / 365); const months = Math.floor((days % 365) / 30); if (years > 0 && months > 0) return `${years} yıl ${months} ay`; if (years > 0) return `${years} yıl`; if (months > 0) return `${months} ay`; return `${days} gün` }
