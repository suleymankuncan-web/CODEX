import { PersonnelCorrectionButton } from '../features/workforce/personnel-corrections'
import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import {
  BriefcaseBusiness,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Clock3,
  History,
  Search,
  UserMinus,
  UserPlus,
  UsersRound,
} from 'lucide-react'
import type { AuthSessionSummary } from '../features/auth/api'
import { getStoreQueryScopeSignature, retainScopedPlaceholder } from '../features/auth/store-query-scope'
import {
  CommandCanvasDataList,
  CommandCanvasOperationalDrawerContent,
  CommandCanvasPage,
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
import { InputGroup, InputGroupAddon, InputGroupInput } from '../components/ui/input-group'
import { Badge } from '../components/ui/badge'
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from '../components/ui/empty'
import { Alert, AlertDescription } from '../components/ui/alert'
import { OperationsDirectory, OperationsMetrics, StoreOperationsHeader } from './store-operations-layout'
import { getRegionManagerDirectory, type RegionManagerDirectoryItem } from '../features/org/region-manager-directory'
import { transientQueryRetryOptions } from '../lib/query-retry'
import { Sheet, SheetDescription, SheetHeader, SheetTitle } from '../components/ui/sheet'
import { getUserFacingErrorMessage } from '../lib/format'
import './store-workforce-command-canvas.css'
import './workforce-polish.css'

const STORE_PAGE_SIZE = 50
const PERSON_PAGE_SIZE = 50
const HISTORY_PAGE_SIZE = 20

export function StoreWorkforcePage(input: { authSummary: AuthSessionSummary | null }) {
  const scopeSignature = getStoreQueryScopeSignature(input.authSummary)
  const previousScopeSignature = useRef(scopeSignature)
  const [searchParams] = useSearchParams()
  const [offset, setOffset] = useState(0)
  const [managerUserId, setManagerUserId] = useState('all')
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
    setManagerUserId('all')
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
      regionManagerUserId: managerUserId === 'all' ? undefined : managerUserId,
      offset,
      personnelOffset,
      query: deferredQuery,
      status,
      sort: storeSort,
      direction: storeDirection,
      rail,
    }),
    queryFn: () => getWorkforceCommandWorkspace({
      regionManagerUserId: managerUserId === 'all' ? undefined : managerUserId,
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
  const managerDirectory = useQuery({
    queryKey: ['org-region-manager-directory', scopeSignature],
    queryFn: getRegionManagerDirectory,
    ...transientQueryRetryOptions,
    enabled: workspace?.view === 'report_viewer',
  })
  const managers = managerDirectory.data?.items ?? []
  const selectedManager = managers.find(manager => manager.userId === managerUserId)
  const isStoreManager = workspace?.view === 'store_manager'
  const directStore = workspace?.view === 'store_manager' ? workspace.stores.items[0] ?? null : null
  const selectedStoreSummary = workspace?.stores.items.find((item) => item.storeId === selectedStoreId) ?? null
  const detailQuery = useQuery({
    queryKey: ['store-workforce-command-detail', scopeSignature, selectedStoreId, offset, personnelOffset, deferredQuery, status, storeSort, storeDirection, rail, managerUserId],
    queryFn: () => getWorkforceCommandWorkspace({
      regionManagerUserId: managerUserId === 'all' ? undefined : managerUserId,
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
    personnel: personnelStore?.personnel ?? [], query: isStoreManager ? query : '', position, sort: personSort,
    direction: personDirection, now,
  }), [personnelStore?.personnel, query, position, personSort, personDirection, now, isStoreManager])
  const personPageCount = Math.max(1, Math.ceil(visiblePersonnel.length / PERSON_PAGE_SIZE))
  const safePersonPage = Math.min(personPage, personPageCount - 1)
  const pagedPersonnel = visiblePersonnel.slice(safePersonPage * PERSON_PAGE_SIZE, (safePersonPage + 1) * PERSON_PAGE_SIZE)
  const selectedHistoryStore = directStore?.storeId === historyStoreId ? directStore : selectedStore?.storeId === historyStoreId ? selectedStore : null
  const historyQuery = useQuery({
    queryKey: ['store-workforce-command-history', scopeSignature, historyStoreId, historyOffset],
    queryFn: () => getWorkforceCommandWorkspace({ historyStoreId: historyStoreId!, historyLimit: HISTORY_PAGE_SIZE, historyOffset, limit: 1, offset: 0 }),
    enabled: Boolean(historyStoreId),
  })

  if (workspaceQuery.isLoading && !workspace) return <WorkforceState loading title="Norm Kadro hazırlanıyor" description="Mağaza ve personel bilgileri hazırlanıyor." />
  if (workspaceQuery.isError && !workspace) {
    return <WorkforceState title="Norm Kadro açılamadı" description={getUserFacingErrorMessage(workspaceQuery.error, 'Veriler alınamadı.')} onRetry={() => void workspaceQuery.refetch()} />
  }
  if (!workspace) return null

  const canManageRequests = workspace.capabilities.canCreateSellerCodeRequest
    || workspace.capabilities.canCreateOffboardingRequest
  const totalLabel = 'Aktif Personel'
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
      <StoreOperationsHeader
        icon={UsersRound}
        title="Norm Kadro"
        titleId="workforce-command-title"
        eyebrow={workspace.view === 'report_viewer' ? 'Şirket görünümü · Salt okunur' : isStoreManager ? directStore?.storeName ?? 'Mağaza görünümü' : 'Bölge görünümü'}
        description={isStoreManager ? 'Personel durumunuzu ve açık hareketleri yönetin.' : 'Mağaza kadro dengesini ve eksik sürelerini izleyin.'}
        actions={isStoreManager && canManageRequests ? (
          <>
            <Button variant="outline" onClick={() => openRequestDialog('returned')}>İade edilen talepler</Button>
            {workspace.capabilities.canCreateOffboardingRequest ? <Button variant="outline" onClick={() => openRequestDialog('offboarding')}><UserMinus /> İşten ayrılma talebi</Button> : null}
            {workspace.capabilities.canCreateSellerCodeRequest ? <Button onClick={() => openRequestDialog('seller')}><UserPlus /> Personel sicil talebi</Button> : null}
          </>
        ) : undefined}
      />
      {workspaceQuery.isError && workspace ? (
        <Alert variant="destructive" className="workforce-partial-error">
          <AlertDescription>Son alınan kadro verileri gösteriliyor; güncel veriler alınamadı.</AlertDescription>
          <Button variant="outline" onClick={() => void workspaceQuery.refetch()}>Tekrar dene</Button>
        </Alert>
      ) : null}

      <OperationsMetrics label="Norm Kadro özeti" items={[
        { id: 'all', label: totalLabel, value: workspace.summary.activePersonnel, icon: UsersRound, selected: rail === 'all', onClick: () => { setRail('all'); setStatus('all'); setPosition('all'); setQuery(''); setOffset(0); setPersonPage(0) } },
        { id: 'active', label: 'Turnover Oranı', value: workspace.summary.turnoverRate == null ? 'Veri yok' : `%${workspace.summary.turnoverRate.toLocaleString('tr-TR', { maximumFractionDigits: 1 })}`, icon: RefreshCw, selected: rail === 'active', onClick: () => setRail(rail === 'active' ? 'all' : 'active') },
        { id: 'gap', label: isStoreManager ? 'Eksik kadro' : 'Eksik mağaza', value: isStoreManager ? workspace.summary.openPositions : workspace.summary.shortageStores, icon: UserMinus, selected: rail === 'gap', onClick: () => { setRail(rail === 'gap' ? 'all' : 'gap'); setOffset(0) } },
        { id: 'tenure', label: 'Ortalama kıdem', value: averageTenure, icon: Clock3, selected: rail === 'tenure', onClick: () => { setRail('tenure'); if (isStoreManager) { setPersonSort('tenure'); setPersonDirection('descending'); setPersonPage(0) } else { setStoreSort('tenure'); setStoreDirection('descending'); setOffset(0) } } },
      ]} />

      {rail === 'active' ? <div className="workforce-gap-notice"><strong>Yılbaşından bugüne personel devir oranı</strong><span>İşten ayrılan personel sayısı / dönem başı ve güncel personel sayısının ortalaması × 100.</span></div> : null}

      {isStoreManager && rail === 'gap' ? <div className="workforce-gap-notice"><strong>{workspace.summary.openPositions} açık pozisyon</strong><span>{workspace.summary.openPositions > 0 ? 'Norm ile aktif personel arasındaki güncel fark.' : 'Mağaza kadrosu güncel normla dengede.'}</span></div> : null}

      <div className={workspace.view === 'report_viewer' ? 'operations-workspace operations-workspace-with-directory' : 'operations-workspace'}>
        {workspace.view === 'report_viewer' ? <div className="workforce-manager-directory">
          <OperationsDirectory avatars allLabel="Tüm Mağazalar" allDetail={`${workspace.summary.totalStores} mağaza`} locale="tr" items={managers.map(manager => ({ id: manager.userId, label: manager.displayName, detail: `${manager.storeIds.length} mağaza` }))} value={managerUserId} onChange={value => { setManagerUserId(value); setOffset(0); setPersonnelOffset(0); setPersonPage(0); setSelectedStoreId(null); setHistoryStoreId(null) }} />
          {managerDirectory.isLoading ? <p role="status">Bölge müdürleri yükleniyor.</p> : managerDirectory.isError ? <Alert variant="destructive"><AlertDescription>Bölge müdürleri alınamadı.</AlertDescription><Button variant="outline" size="sm" onClick={() => void managerDirectory.refetch()}>Tekrar dene</Button></Alert> : !managers.length ? <p>Tanımlı bölge müdürü bulunamadı.</p> : null}
        </div> : null}
        <section className="operations-board" aria-label="Kadro çalışma alanı" aria-busy={workspaceQuery.isFetching}>
          {workspaceQuery.isPlaceholderData ? <span className="workforce-refresh-status" role="status">Liste güncelleniyor…</span> : null}
          {!isStoreManager ? <div className="operations-board-toolbar"><div className="operations-board-title"><h2>{selectedManager?.displayName ?? 'Mağaza kadro dengesi'}</h2><Badge variant="secondary">{workspace.stores.total} mağaza</Badge></div></div> : null}
      {workspace.stores.items.length === 0 ? (
        <WorkforceInlineEmpty title={managerUserId !== 'all' ? 'Bu seçimde mağaza yok' : 'Kapsamda mağaza yok'} description={managerUserId !== 'all' ? 'Seçilen bölge müdürü ve filtrelerle eşleşen mağaza bulunamadı.' : 'Bu rol için görüntülenebilir aktif mağaza bulunamadı.'} />
      ) : isStoreManager && directStore ? (
        <div data-testid="store-workforce-personnel-list">
          <PersonnelList search={{ value: query, onChange: value => { setQuery(value); setPersonPage(0) } }} correctionScope={scopeSignature} store={directStore} rows={pagedPersonnel} sort={personSort} direction={personDirection} onSort={choosePersonSort} onHistory={() => { setHistoryOffset(0); setHistoryStoreId(directStore.storeId) }} page={safePersonPage} pageCount={personPageCount} total={directStore.personnelTotal} onPage={setPersonPage} onNextBatch={loadNextPersonnelBatch} onPreviousBatch={loadPreviousPersonnelBatch} />
        </div>
      ) : (
        <StoreList query={query} onQuery={value => { setQuery(value); setOffset(0) }} stores={visibleStores} managers={managers} view={workspace.view} sort={storeSort} direction={storeDirection} onSort={chooseStoreSort} onSelect={(store) => { if (workspaceQuery.isPlaceholderData) return; setSelectedStoreId(store.storeId); setPersonPage(0); setPersonnelOffset(0) }} pagination={workspace.stores} onOffset={setOffset} />
      )}

        </section>
      </div>

      <Sheet open={Boolean(selectedStore) && !historyStoreId} onOpenChange={(open) => { if (!open) setSelectedStoreId(null) }}>
        <CommandCanvasOperationalDrawerContent className="workforce-detail-sheet" data-testid="store-workforce-region-detail-dialog">
          {selectedStore ? (
            <div className="workforce-drawer">
              <SheetHeader className="workforce-drawer-heading"><SheetTitle>{selectedStore.storeName}</SheetTitle><SheetDescription>Aktif personel ve norm dengesi.</SheetDescription></SheetHeader>
              <div className="workforce-drawer-facts"><Fact label="Norm / Fiili" value={selectedStore.norm === null ? `Tanımsız / ${selectedStore.active}` : `${selectedStore.norm} / ${selectedStore.active}`} /><Fact label="Kadro farkı" value={formatGap(selectedStore.gap)} /><Fact label="Eksik süre" value={formatShortage(selectedStore)} /><Fact label="Turnover Oranı" value={selectedStore.turnoverRate == null ? detailQuery.isFetching ? 'Yükleniyor…' : 'Veri yok' : `%${selectedStore.turnoverRate.toLocaleString('tr-TR', { maximumFractionDigits: 1 })}`} /></div>
              {detailQuery.isError ? <WorkforceInlineEmpty title="Mağaza dosyası alınamadı" description="Personel ayrıntıları yüklenemedi." action={() => void detailQuery.refetch()} /> : detailQuery.isFetching && selectedStore.personnel.length === 0 ? <WorkforceInlineEmpty title="Mağaza dosyası hazırlanıyor" description="Aktif personel bilgileri yükleniyor." /> : <PersonnelList compact store={selectedStore} rows={pagedPersonnel} sort={personSort} direction={personDirection} onSort={choosePersonSort} onHistory={() => { setHistoryOffset(0); setHistoryStoreId(selectedStore.storeId) }} page={safePersonPage} pageCount={personPageCount} total={selectedStore.personnelTotal} onPage={setPersonPage} onNextBatch={loadNextPersonnelBatch} onPreviousBatch={loadPreviousPersonnelBatch} />}
            </div>
          ) : null}
        </CommandCanvasOperationalDrawerContent>
      </Sheet>

      <Sheet open={Boolean(historyStoreId)} onOpenChange={(open) => { if (!open) setHistoryStoreId(null) }}>
        <CommandCanvasOperationalDrawerContent className="workforce-detail-sheet">
          <div className="workforce-drawer">
            <SheetHeader className="workforce-drawer-heading"><Button variant="secondary" size="sm" className="workforce-back" onClick={() => setHistoryStoreId(null)}><ChevronLeft />Geri Git</Button><SheetTitle>{selectedHistoryStore?.storeName ?? 'Mağaza'} · Personel geçmişi</SheetTitle><SheetDescription>Yalnız işe giriş, işten çıkış ve toplam çalışma süresi.</SheetDescription></SheetHeader>
            <HistoryList query={historyQuery} onOffset={setHistoryOffset} />
          </div>
        </CommandCanvasOperationalDrawerContent>
      </Sheet>


      {isStoreManager && canManageRequests ? <WorkforceRequestDialogs dialog={requestDialog} onDialogChange={setRequestDialog} storeId={requestStoreId} storeName={directStore?.storeName ?? ''} handoffRequestId={requestId} handoffRequestType={requestType} /> : null}
    </CommandCanvasPage>
  )
}

function StoreList(input: { query: string; onQuery: (value: string) => void; managers: RegionManagerDirectoryItem[]; stores: WorkforceCommandStore[]; view: 'report_viewer' | 'region_manager' | 'store_manager'; sort: WorkforceStoreSort; direction: SortDirection; onSort: (sort: WorkforceStoreSort) => void; onSelect: (store: WorkforceCommandStore) => void; pagination: { total: number; limit: number; offset: number; hasMore: boolean }; onOffset: (offset: number) => void }) {
  const stores = input.stores
  return (
    <CommandCanvasDataList ariaLabel="Mağaza kadro dengesi" header={<div className="workforce-store-grid workforce-list-head"><InputGroup className="workforce-store-search"><InputGroupAddon><Search /></InputGroupAddon><InputGroupInput aria-label="Mağaza ara" placeholder="Mağaza ara" value={input.query} onChange={event => input.onQuery(event.target.value)} /><InputGroupAddon align="inline-end"><Badge variant="secondary">{input.pagination.total}</Badge></InputGroupAddon></InputGroup><CommandCanvasSortableHeading semantic={false} label="Aktif" direction={input.sort === 'active' ? input.direction : 'none'} onClick={() => input.onSort('active')} /><CommandCanvasSortableHeading semantic={false} label="Norm / Fiili" direction={input.sort === 'norm' ? input.direction : 'none'} onClick={() => input.onSort('norm')} /><CommandCanvasSortableHeading semantic={false} label="Durum" direction={input.sort === 'status' ? input.direction : 'none'} onClick={() => input.onSort('status')} /><CommandCanvasSortableHeading semantic={false} label="Eksik süre" direction={input.sort === 'shortage' ? input.direction : 'none'} onClick={() => input.onSort('shortage')} /><CommandCanvasSortableHeading semantic={false} label="Ortalama kıdem" direction={input.sort === 'tenure' ? input.direction : 'none'} onClick={() => input.onSort('tenure')} /></div>} footer={<Pager offset={input.pagination.offset} limit={input.pagination.limit} total={input.pagination.total} hasMore={input.pagination.hasMore} onOffset={input.onOffset} />}>
      {stores.length === 0 ? <WorkforceInlineEmpty title="Sonuç bulunamadı" description="Filtreleri değiştirerek tekrar deneyin." /> : stores.map((store) => {
        const managerNames = input.managers.filter(manager => manager.storeIds.includes(store.storeId)).map(manager => manager.displayName).join(', ')
        return <div key={store.storeId}><button className="workforce-store-grid workforce-store-row" data-testid="store-workforce-region-row" onClick={() => input.onSelect(store)} type="button"><span><strong>{store.storeName}</strong><small>{input.view === 'report_viewer' ? managerNames || store.storeCode : store.storeCode}</small></span><b data-label="Aktif personel">{store.active}</b><span data-label="Norm / Fiili">{store.norm === null ? `Tanımsız / ${store.active}` : `${store.norm} / ${store.active}`}</span><Status value={workforceStoreStatus(store)} /><span data-label="Eksik süre">{formatShortage(store)}</span><span data-label="Ortalama kıdem">{formatTenure(store.averageTenureDays)}</span></button></div>
      })}
    </CommandCanvasDataList>
  )
}

function PersonnelList(input: { search?: { value: string; onChange: (value: string) => void }; correctionScope?: string; store: WorkforceCommandStore; rows: WorkforceCommandStore['personnel']; sort: WorkforcePersonSort; direction: SortDirection; onSort: (sort: WorkforcePersonSort) => void; onHistory: () => void; page: number; pageCount: number; total: number; onPage: (page: number) => void; onNextBatch: () => void; onPreviousBatch: () => void; compact?: boolean }) {
  return <CommandCanvasDataList className={input.compact ? 'workforce-personnel-list compact' : 'workforce-personnel-list'} ariaLabel={`${input.store.storeName} personel listesi`} header={<div className="workforce-list-title">{input.search ? <InputGroup className="workforce-person-search"><InputGroupAddon><Search aria-hidden="true" /></InputGroupAddon><InputGroupInput aria-label="Personel ara" placeholder="Personel ara" value={input.search.value} onChange={event => input.search?.onChange(event.target.value)} /><InputGroupAddon align="inline-end"><Badge variant="secondary">{input.total}</Badge></InputGroupAddon></InputGroup> : <><strong>{input.store.storeName} personel listesi</strong><span>{input.total} personel</span></>}<Button size="sm" onClick={input.onHistory}><History /> Mağaza personel geçmişi</Button></div>} footer={input.pageCount > 1 || input.store.personnelHasMore || input.store.personnelOffset > 0 ? <PersonnelPager {...input} /> : undefined}>
    <div className="workforce-person-grid workforce-list-head"><CommandCanvasSortableHeading semantic={false} label="Personel" direction={input.sort === 'person' ? input.direction : 'none'} onClick={() => input.onSort('person')} /><CommandCanvasSortableHeading semantic={false} label="Pozisyon" direction={input.sort === 'position' ? input.direction : 'none'} onClick={() => input.onSort('position')} /><CommandCanvasSortableHeading semantic={false} label="İşe giriş" direction={input.sort === 'start' ? input.direction : 'none'} onClick={() => input.onSort('start')} /><CommandCanvasSortableHeading semantic={false} label="Çalışma süresi" direction={input.sort === 'tenure' ? input.direction : 'none'} onClick={() => input.onSort('tenure')} /><CommandCanvasSortableHeading semantic={false} label="Durum" direction={input.sort === 'status' ? input.direction : 'none'} onClick={() => input.onSort('status')} /></div>
    {input.rows.length === 0 ? <WorkforceInlineEmpty title="Personel bulunamadı" description="Bu filtrede aktif personel yok." /> : input.rows.map((person) => <div className="workforce-person-grid workforce-person-row" key={person.employeeId}><strong data-label="Personel">{person.displayName}</strong><span data-label="Pozisyon">{person.positionName}</span><span data-label="İşe giriş">{formatDate(person.assignmentStartDate)}</span><span data-label="Çalışma süresi">{formatTenureFromDate(person.assignmentStartDate)}</span><span><Badge variant="secondary">Aktif</Badge>{input.correctionScope ? <PersonnelCorrectionButton scopeKey={input.correctionScope} storeId={input.store.storeId} employeeId={person.employeeId} /> : null}</span></div>)}
  </CommandCanvasDataList>
}

function HistoryList(input: { query: ReturnType<typeof useQuery<Awaited<ReturnType<typeof getWorkforceCommandWorkspace>>>>; onOffset: (offset: number) => void }) {
  if (input.query.isLoading) return <WorkforceInlineEmpty title="Geçmiş hazırlanıyor" description="Personel dönemleri yükleniyor." />
  if (input.query.isError) return <WorkforceInlineEmpty title="Geçmiş alınamadı" description="Tekrar deneyin." action={() => void input.query.refetch()} />
  const rows = input.query.data?.history?.items ?? []
  if (rows.length === 0) return <WorkforceInlineEmpty title="Geçmiş bulunamadı" description="Bu mağaza için giriş veya çıkış dönemi yok." />
  const history = input.query.data?.history
  return <><div className="workforce-history-list">{rows.map((row, index) => <article key={`${row.employeeId}-${row.entryDate}-${index}`}><div><strong>{row.displayName}</strong><span>{row.positionName || 'Unvan bilgisi yok'}</span></div><dl><div><dt>İşe giriş</dt><dd>{formatDate(row.entryDate)}</dd></div><div><dt>İşten çıkış</dt><dd>{formatDate(row.exitDate)}</dd></div><div><dt>Toplam çalışma</dt><dd>{formatTenure(row.totalWorkingDays)}</dd></div></dl></article>)}</div>{history ? <div className="command-canvas-list-footer"><Pager offset={history.offset} limit={history.limit} total={history.total} hasMore={history.hasMore} onOffset={input.onOffset} /></div> : null}</>
}

function Pager(input: { offset: number; limit: number; total: number; hasMore: boolean; onOffset: (offset: number) => void }) { return <><span className="workforce-pager-count">{input.total === 0 ? 0 : input.offset + 1}-{Math.min(input.offset + input.limit, input.total)} / {input.total}</span><Button size="sm" variant="outline" disabled={input.offset === 0} onClick={() => input.onOffset(Math.max(0, input.offset - input.limit))}><ChevronLeft /> Önceki</Button><Button size="sm" variant="outline" disabled={!input.hasMore} onClick={() => input.onOffset(input.offset + input.limit)}>Sonraki <ChevronRight /></Button></> }
function PersonnelPager(input: { store: WorkforceCommandStore; page: number; pageCount: number; total: number; onPage: (page: number) => void; onNextBatch: () => void; onPreviousBatch: () => void }) { const atBatchEnd = input.page + 1 >= input.pageCount; const atStart = input.page === 0; return <><span className="workforce-pager-count">{input.store.personnelOffset + input.page * PERSON_PAGE_SIZE + 1}-{Math.min(input.store.personnelOffset + (input.page + 1) * PERSON_PAGE_SIZE, input.total)} / {input.total}</span><Button size="sm" variant="outline" disabled={atStart && input.store.personnelOffset === 0} onClick={() => atStart ? input.onPreviousBatch() : input.onPage(input.page - 1)}><ChevronLeft /> Önceki</Button><Button size="sm" variant="outline" disabled={atBatchEnd && !input.store.personnelHasMore} onClick={() => atBatchEnd ? input.onNextBatch() : input.onPage(input.page + 1)}>Sonraki <ChevronRight /></Button></> }
function WorkforceState(input: { title: string; description: string; onRetry?: () => void; loading?: boolean }) { return <CommandCanvasPage ariaLabelledBy="workforce-state-title" {...(input.loading ? { testId: 'store-workforce-loading' } : {})}><StoreOperationsHeader title="Norm Kadro" titleId="workforce-state-title" eyebrow="Personel ve kadro" description="Güncel mağaza kadro görünümü" icon={UsersRound} /><WorkforceInlineEmpty title={input.title} description={input.description} {...(input.onRetry ? { action: input.onRetry } : {})} /></CommandCanvasPage> }
function WorkforceInlineEmpty(input: { title: string; description: string; action?: () => void }) { return <Empty className="workforce-empty"><EmptyHeader><EmptyMedia variant="icon"><BriefcaseBusiness aria-hidden="true" /></EmptyMedia><EmptyTitle>{input.title}</EmptyTitle><EmptyDescription>{input.description}</EmptyDescription></EmptyHeader>{input.action ? <Button variant="outline" onClick={input.action}>Tekrar dene</Button> : null}</Empty> }
function Status(input: { value: ReturnType<typeof workforceStoreStatus> }) { const copy = { shortage: 'Eksik', balanced: 'Tam', surplus: 'Fazla', unconfigured: 'Tanımsız' }[input.value]; return <Badge variant={input.value === 'shortage' ? 'destructive' : 'secondary'}>{copy}</Badge> }
function Fact(input: { label: string; value: string }) { return <div><span>{input.label}</span><strong>{input.value}</strong></div> }
function formatGap(value: number | null) { if (value === null) return 'Tanımsız'; if (value > 0) return `${value} açık`; if (value < 0) return `${Math.abs(value)} fazla`; return 'Dengede' }
function formatShortage(store: WorkforceCommandStore) { if ((store.gap ?? 0) <= 0) return 'Yok'; return store.shortageDays === null ? 'Bilgi yok' : `${store.shortageDays} gündür` }
function formatDate(value: string | null) { if (!value) return 'Bilgi yok'; return new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(`${value}T00:00:00`)) }
function formatTenureFromDate(value: string | null) { if (!value) return 'Bilgi yok'; return formatTenure(Math.max(0, Math.floor((Date.now() - new Date(`${value}T00:00:00`).getTime()) / 86_400_000))) }
function formatTenure(days: number | null) { if (days === null) return 'Bilgi yok'; const years = Math.floor(days / 365); const months = Math.floor((days % 365) / 30); if (years > 0 && months > 0) return `${years} yıl ${months} ay`; if (years > 0) return `${years} yıl`; if (months > 0) return `${months} ay`; return `${days} gün` }
