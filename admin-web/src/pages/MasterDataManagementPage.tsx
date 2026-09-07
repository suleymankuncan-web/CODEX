import { useDeferredValue, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  BadgePlus,
  BriefcaseBusiness,
  Building2,
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet,
  LogOut,
  PencilLine,
  Plus,
  Search,
  Store,
  UserRound,
  UsersRound,
} from 'lucide-react'
import { Button } from '../components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs'
import { ToggleGroup, ToggleGroupItem } from '../components/ui/toggle-group'
import { StatusBadge as SemanticStatusBadge } from '../components/ui/status-badge'
import {
  createPersonnelMasterData,
  createStoreMasterData,
  downloadPersonnelMasterData,
  getPersonnelMasterData,
  getPersonnelMasterLookups,
  getStoreMasterData,
  getStoreMasterLookups,
  terminatePersonnelMasterData,
  updateStoreMasterData,
  updatePersonnelMasterData,
  type PersonnelMasterItem,
  type StoreMasterItem,
} from '../features/integrations/api'
import { actionToast } from '../lib/action-toast'
import { AdminStatePanel, AdminSurfaceHeader, AdminSurfacePage } from './admin-surface-primitives'
import { resolveStoreRegionManager, type RegionManagerOption } from './master-data-region-manager'
import { MasterDataStoreCombobox } from './master-data-store-combobox'

import { PersonnelObservationsSection } from './personnel-observations-section'

type Workspace = 'stores' | 'personnel'
type PersonnelStatus = 'active' | 'inactive' | 'terminated'

const today = formatBusinessDate(new Date())
const pageSize = 20

export function MasterDataManagementPage() {
  const queryClient = useQueryClient()
  const [workspace, setWorkspace] = useState<Workspace>('stores')
  const [search, setSearch] = useState('')
  const [storePage, setStorePage] = useState(0)
  const [personnelPage, setPersonnelPage] = useState(0)
  const [personnelStatus, setPersonnelStatus] = useState<PersonnelStatus>('active')
  const [storeEditor, setStoreEditor] = useState<StoreMasterItem | 'new' | null>(null)
  const [personnelEntryOpen, setPersonnelEntryOpen] = useState(false)
  const [personnelEditor, setPersonnelEditor] = useState<PersonnelMasterItem | null>(null)
  const [personnelExit, setPersonnelExit] = useState<PersonnelMasterItem | null>(null)
  const deferredSearch = useDeferredValue(search.trim())

  const storesQuery = useQuery({
    queryKey: ['admin-management', 'stores', deferredSearch, storePage],
    queryFn: () => getStoreMasterData({
      ...(deferredSearch ? { q: deferredSearch } : {}),
      limit: pageSize,
      offset: storePage * pageSize,
    }),
  })
  const storeLookupsQuery = useQuery({
    queryKey: ['admin-management', 'store-lookups'],
    queryFn: getStoreMasterLookups,
  })
  const personnelQuery = useQuery({
    queryKey: ['admin-management', 'personnel', deferredSearch, personnelPage, personnelStatus],
    queryFn: () => getPersonnelMasterData({
      ...(deferredSearch ? { q: deferredSearch } : {}),
      status: personnelStatus,
      limit: pageSize,
      offset: personnelPage * pageSize,
    }),
  })
  const personnelLookupsQuery = useQuery({
    queryKey: ['admin-management', 'personnel-lookups'],
    queryFn: getPersonnelMasterLookups,
  })

  const invalidateMasterData = async () => {
    await queryClient.invalidateQueries({ queryKey: ['admin-management'] })
  }

  const saveStore = useMutation({
    mutationFn: async (draft: StoreDraft) => {
      const manager = storeLookupsQuery.data?.regionManagers.find(
        (item) => item.userId === draft.regionManagerUserId,
      )
      if (!manager) throw new Error('Bölge müdürü seçin.')
      if (storeEditor === 'new') {
        return createStoreMasterData({
          storeCode: draft.storeCode,
          storeName: draft.storeName,
          storeType: draft.storeType,
          regionId: manager.regionId,
          regionManagerUserId: manager.userId,
          status: draft.status,
          kpiImportEnabled: draft.kpiImportEnabled,
        })
      }
      if (!storeEditor) throw new Error('Mağaza seçilemedi.')
      return updateStoreMasterData({
        storeId: storeEditor.storeId,
        storeType: draft.storeType,
        regionId: storeEditor.regionId ?? manager.regionId,
        regionManagerUserId: manager.userId,
        status: draft.status,
        kpiImportEnabled: draft.kpiImportEnabled,
        ...(storeEditor.updatedAt ? { expectedUpdatedAt: storeEditor.updatedAt } : {}),
      })
    },
    onSuccess: async () => {
      await invalidateMasterData()
      setStoreEditor(null)
      actionToast.success(storeEditor === 'new' ? 'Mağaza eklendi.' : 'Mağaza güncellendi.')
    },
    onError: (error) => actionToast.error(error, 'Mağaza kaydedilemedi.'),
  })

  const createPersonnel = useMutation({
    mutationFn: createPersonnelMasterData,
    onSuccess: async () => {
      await invalidateMasterData()
      setPersonnelEntryOpen(false)
      actionToast.success('Personel girişi tamamlandı.')
    },
    onError: (error) => actionToast.error(error, 'Personel girişi tamamlanamadı.'),
  })

  const terminatePersonnel = useMutation({
    mutationFn: ({ employeeId, ...input }: PersonnelExitDraft & { employeeId: string }) =>
      terminatePersonnelMasterData(employeeId, input),
    onSuccess: async () => {
      await invalidateMasterData()
      setPersonnelExit(null)
      actionToast.success('Personel çıkışı ve bağlı erişim kapatma işlemi tamamlandı.')
    },
    onError: (error) => actionToast.error(error, 'Personel çıkışı tamamlanamadı.'),
  })

  const updatePersonnel = useMutation({
    mutationFn: (draft: PersonnelEditDraft) => updatePersonnelMasterData(draft),
    onSuccess: async () => {
      await invalidateMasterData()
      setPersonnelEditor(null)
      actionToast.success('Personel bilgileri güncellendi.')
    },
    onError: (error) => actionToast.error(error, 'Personel bilgileri güncellenemedi.'),
  })

  const exportPersonnel = useMutation({
    mutationFn: downloadPersonnelMasterData,
    onSuccess: (blob) => {
      downloadBrowserBlob(blob, `personel-listesi-${today}.xlsx`)
      actionToast.success('Aktif, pasif ve işten çıkan personel Excel dosyasına aktarıldı.')
    },
    onError: (error) => actionToast.error(error, 'Personel Excel dosyası indirilemedi.'),
  })

  const storeTotal = storesQuery.data?.meta.total ?? 0
  const personnelTotal = personnelQuery.data?.meta.total ?? 0
  const actionLabel = workspace === 'stores' ? 'Mağaza ekle' : 'Personel girişi'

  return (
    <AdminSurfacePage ariaLabel="Mağaza ve personel yönetimi" className="tw:gap-5 tw:pb-8">
      <AdminSurfaceHeader
        title="Mağaza ve personel"
        description="Mağaza sorumlularını yönetin, personel giriş ve çıkışlarını tamamlayın."
        variant="flat"
        actions={<div className="tw:flex tw:w-full tw:flex-col tw:gap-2 tw:sm:w-auto tw:sm:flex-row">
          {workspace === 'personnel' ? <Button className="tw:w-full tw:sm:w-auto" disabled={exportPersonnel.isPending} onClick={() => exportPersonnel.mutate()} variant="outline"><FileSpreadsheet aria-hidden="true" />{exportPersonnel.isPending ? 'Hazırlanıyor' : 'Excel indir'}</Button> : null}
          <Button className="tw:w-full tw:sm:w-auto" onClick={() => (workspace === 'stores' ? setStoreEditor('new') : setPersonnelEntryOpen(true))}><Plus aria-hidden="true" />{actionLabel}</Button>
        </div>}
      />

      <Tabs
        onValueChange={(value) => setWorkspace(value as Workspace)}
        value={workspace}
      >
        <section className="tw:overflow-hidden tw:rounded-xl tw:border tw:border-border tw:bg-card tw:shadow-sm" data-testid="master-data-management-surface">
          <TabsList aria-label="Ana veri alanları">
            <TabsTrigger value="stores">
              <Building2 className="tw:size-4" aria-hidden="true" />
              Mağazalar
            </TabsTrigger>
            <TabsTrigger value="personnel">
              <UsersRound className="tw:size-4" aria-hidden="true" />
              Personel
            </TabsTrigger>
          </TabsList>

          <div className="tw:flex tw:flex-col tw:gap-4 tw:border-b tw:border-border tw:px-4 tw:py-4 tw:sm:flex-row tw:sm:items-end tw:sm:justify-between tw:sm:px-5">
            <div className="tw:min-w-0">
              <h2 className="tw:m-0 tw:text-lg tw:leading-6 tw:font-semibold tw:text-foreground">
                {workspace === 'stores' ? 'Mağazalar' : 'Personel'}
              </h2>
              <p className="tw:mt-1 tw:text-sm tw:leading-5 tw:text-muted-foreground">
                {workspace === 'stores'
                  ? 'Sorumlu bölge müdürünü görüntüleyin veya değiştirin.'
                  : personnelStatus === 'active'
                    ? 'Aktif personeli ve mevcut mağaza atamalarını yönetin.'
                    : personnelStatus === 'inactive'
                      ? 'Pasif personel kayıtlarını inceleyin.'
                      : 'İşten çıkan personelin tarih ve iletişim kayıtlarını inceleyin.'}
              </p>
            </div>
            <span className="tw:shrink-0 tw:text-sm tw:font-medium tw:text-muted-foreground">
              {workspace === 'stores' ? storeTotal : personnelTotal} kayıt
            </span>
          </div>

          <div className="tw:flex tw:flex-col tw:gap-3 tw:border-b tw:border-border tw:bg-muted/35 tw:px-4 tw:py-3 tw:sm:px-5 tw:lg:flex-row tw:lg:items-center tw:lg:justify-between">
            <div className="tw:relative tw:w-full tw:max-w-lg">
              <Search className="tw:absolute tw:top-1/2 tw:left-3 tw:size-4 tw:-translate-y-1/2 tw:text-muted-foreground" aria-hidden="true" />
              <Input
                aria-label={workspace === 'stores' ? 'Mağaza ara' : 'Personel ara'}
                className="tw:bg-card tw:pl-9"
                onChange={(event) => {
                  setSearch(event.target.value)
                  setStorePage(0)
                  setPersonnelPage(0)
                }}
                placeholder={workspace === 'stores' ? 'Mağaza, kod veya bölge müdürü ara' : 'Ad, sicil, telefon veya mağaza ara'}
                value={search}
              />
            </div>
            {workspace === 'personnel' ? (
              <ToggleGroup
                aria-label="Personel durumu"
                className="tw:grid tw:w-full tw:grid-cols-[minmax(0,0.8fr)_minmax(0,0.8fr)_minmax(0,1.4fr)] tw:gap-1 tw:rounded-xl tw:border tw:border-border/80 tw:bg-accent/55 tw:p-1 tw:shadow-[inset_0_1px_0_rgba(255,255,255,0.75)] tw:lg:flex tw:lg:w-auto"
                onValueChange={(value) => {
                  if (!value) return
                  setPersonnelStatus(value as PersonnelStatus)
                  setPersonnelPage(0)
                }}
                spacing={1}
                type="single"
                value={personnelStatus}
              >
                <ToggleGroupItem className="tw:h-9 tw:min-w-0 tw:appearance-none tw:rounded-lg tw:border-0 tw:px-3 tw:text-[0.8125rem] tw:font-semibold tw:text-accent-foreground/70 tw:shadow-none tw:hover:bg-card/70 tw:hover:text-foreground tw:focus-visible:outline-none tw:focus-visible:ring-2 tw:focus-visible:ring-primary/30 tw:data-[state=on]:bg-primary tw:data-[state=on]:text-primary-foreground tw:data-[state=on]:shadow-[0_4px_12px_rgba(50,93,175,0.24)] tw:lg:min-w-20" value="active">Aktif</ToggleGroupItem>
                <ToggleGroupItem className="tw:h-9 tw:min-w-0 tw:appearance-none tw:rounded-lg tw:border-0 tw:px-3 tw:text-[0.8125rem] tw:font-semibold tw:text-accent-foreground/70 tw:shadow-none tw:hover:bg-card/70 tw:hover:text-foreground tw:focus-visible:outline-none tw:focus-visible:ring-2 tw:focus-visible:ring-primary/30 tw:data-[state=on]:bg-primary tw:data-[state=on]:text-primary-foreground tw:data-[state=on]:shadow-[0_4px_12px_rgba(50,93,175,0.24)] tw:lg:min-w-20" value="inactive">Pasif</ToggleGroupItem>
                <ToggleGroupItem className="tw:h-9 tw:min-w-0 tw:appearance-none tw:rounded-lg tw:border-0 tw:px-3 tw:text-[0.8125rem] tw:font-semibold tw:text-accent-foreground/70 tw:shadow-none tw:hover:bg-card/70 tw:hover:text-foreground tw:focus-visible:outline-none tw:focus-visible:ring-2 tw:focus-visible:ring-primary/30 tw:data-[state=on]:bg-primary tw:data-[state=on]:text-primary-foreground tw:data-[state=on]:shadow-[0_4px_12px_rgba(50,93,175,0.24)] tw:lg:min-w-32" value="terminated">İşten çıkanlar</ToggleGroupItem>
              </ToggleGroup>
            ) : null}
          </div>

          <TabsContent value="stores">
            <RecordArea loading={storesQuery.isLoading} error={storesQuery.error}>
              <>
                <StoreList
                  items={storesQuery.data?.items ?? []}
                  managers={storeLookupsQuery.data?.regionManagers ?? []}
                  onEdit={setStoreEditor}
                />
                <PaginationFooter
                  label="mağaza"
                  offset={storePage * pageSize}
                  onPageChange={setStorePage}
                  page={storePage}
                  total={storeTotal}
                />
              </>
            </RecordArea>
          </TabsContent>
          <TabsContent value="personnel">
            <RecordArea loading={personnelQuery.isLoading} error={personnelQuery.error}>
              <>
                <PersonnelList
                  items={personnelQuery.data?.items ?? []}
                  onEdit={setPersonnelEditor}
                  onExit={setPersonnelExit}
                />
                <PaginationFooter
                  label="personel"
                  offset={personnelPage * pageSize}
                  onPageChange={setPersonnelPage}
                  page={personnelPage}
                  total={personnelTotal}
                />
              </>
            </RecordArea>
            <PersonnelObservationsSection />
          </TabsContent>
        </section>
      </Tabs>

      <StoreEditorDialog
        key={storeEditor === 'new' ? 'new' : storeEditor?.storeId ?? 'closed'}
        item={storeEditor}
        managers={storeLookupsQuery.data?.regionManagers ?? []}
        onOpenChange={(open) => !open && setStoreEditor(null)}
        onSave={(draft) => saveStore.mutate(draft)}
        pending={saveStore.isPending}
      />
      <PersonnelEntryDialog
        key={personnelEntryOpen ? 'open' : 'closed'}
        open={personnelEntryOpen}
        stores={personnelLookupsQuery.data?.stores ?? []}
        positions={personnelLookupsQuery.data?.positions ?? []}
        onOpenChange={setPersonnelEntryOpen}
        onSave={(draft) => createPersonnel.mutate(draft)}
        pending={createPersonnel.isPending}
      />
      <PersonnelExitDialog
        key={personnelExit?.employeeId ?? 'closed'}
        item={personnelExit}
        onOpenChange={(open) => !open && setPersonnelExit(null)}
        onSave={(draft) => personnelExit && terminatePersonnel.mutate({ employeeId: personnelExit.employeeId, ...draft })}
        pending={terminatePersonnel.isPending}
      />
      <PersonnelEditorDialog
        key={personnelEditor?.employeeId ?? 'closed'}
        item={personnelEditor}
        stores={personnelLookupsQuery.data?.stores ?? []}
        positions={personnelLookupsQuery.data?.positions ?? []}
        onOpenChange={(open) => !open && setPersonnelEditor(null)}
        onSave={(draft) => updatePersonnel.mutate(draft)}
        pending={updatePersonnel.isPending}
      />
    </AdminSurfacePage>
  )
}

function RecordArea({ children, error, loading }: { children: React.ReactNode; error: unknown; loading: boolean }) {
  if (loading) {
    return <div className="tw:p-4 tw:sm:p-5"><AdminStatePanel isLoading title="Kayıtlar yükleniyor" /></div>
  }
  if (error) {
    return (
      <div className="tw:p-4 tw:sm:p-5">
        <AdminStatePanel
          tone="danger"
          title="Kayıtlar alınamadı"
          description="Bağlantınızı kontrol edip yeniden deneyin."
        />
      </div>
    )
  }
  return children
}

function PaginationFooter({ label, offset, onPageChange, page, total }: {
  label: string
  offset: number
  onPageChange: (page: number) => void
  page: number
  total: number
}) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize))
  const from = total === 0 ? 0 : offset + 1
  const to = Math.min(offset + pageSize, total)

  return (
    <footer className="tw:flex tw:items-center tw:justify-between tw:gap-3 tw:border-t tw:border-border tw:bg-muted/25 tw:px-4 tw:py-3 tw:sm:px-5">
      <span className="tw:text-xs tw:font-medium tw:text-muted-foreground">
        {from}-{to} / {total} {label}
      </span>
      <div className="tw:flex tw:items-center tw:gap-2">
        <span className="tw:min-w-10 tw:text-center tw:text-xs tw:text-muted-foreground">{page + 1} / {pageCount}</span>
        <Button
          aria-label={`Önceki ${label} sayfası`}
          disabled={page === 0}
          onClick={() => onPageChange(Math.max(0, page - 1))}
          size="icon-sm"
          variant="outline"
        >
          <ChevronLeft aria-hidden="true" />
        </Button>
        <Button
          aria-label={`Sonraki ${label} sayfası`}
          disabled={page + 1 >= pageCount}
          onClick={() => onPageChange(Math.min(pageCount - 1, page + 1))}
          size="icon-sm"
          variant="outline"
        >
          <ChevronRight aria-hidden="true" />
        </Button>
      </div>
    </footer>
  )
}

function StoreList({ items, managers, onEdit }: {
  items: StoreMasterItem[]
  managers: RegionManagerOption[]
  onEdit: (item: StoreMasterItem) => void
}) {
  if (!items.length) {
    return <div className="tw:p-4 tw:sm:p-5"><AdminStatePanel title="Mağaza bulunamadı" description="Aramayı temizleyin veya yeni mağaza ekleyin." /></div>
  }

  return (
    <>
      <div className="tw:hidden tw:md:block">
        <Table aria-label="Mağazalar">
          <TableHeader className="tw:bg-muted/45">
            <TableRow className="tw:hover:bg-transparent">
              <TableHead className="tw:pl-5">Mağaza</TableHead>
              <TableHead>Bölge müdürü</TableHead>
              <TableHead>Tür</TableHead>
              <TableHead>Durum</TableHead>
              <TableHead className="tw:pr-5 tw:text-right"><span className="tw:sr-only">İşlem</span></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => {
              const manager = resolveStoreRegionManager(item, managers)
              return (
                <TableRow className="tw:h-16" key={item.storeId}>
                  <TableCell className="tw:pl-5">
                    <div className="tw:font-semibold tw:text-foreground">{item.storeName}</div>
                    <div className="tw:mt-0.5 tw:text-xs tw:text-muted-foreground">{item.storeCode}</div>
                  </TableCell>
                  <TableCell>
                    <div className={manager.assigned ? 'tw:font-medium tw:text-foreground' : 'tw:text-muted-foreground'}>{manager.displayName}</div>
                    {manager.email ? <div className="tw:mt-0.5 tw:text-xs tw:text-muted-foreground">{manager.email}</div> : null}
                  </TableCell>
                  <TableCell className="tw:text-muted-foreground">{storeTypeLabel(item.storeType)}</TableCell>
                  <TableCell><StatusBadge status={item.status} /></TableCell>
                  <TableCell className="tw:pr-5 tw:text-right">
                    <Button aria-label={`${item.storeName} mağazasını düzenle`} onClick={() => onEdit(item)} size="sm" variant="ghost">
                      <PencilLine aria-hidden="true" /> Düzenle
                    </Button>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      <div className="tw:divide-y tw:divide-border tw:md:hidden">
        {items.map((item) => {
          const manager = resolveStoreRegionManager(item, managers)
          return (
            <button
              className="tw:flex tw:min-h-20 tw:w-full tw:appearance-none tw:items-center tw:gap-3 tw:border-0 tw:bg-card tw:px-4 tw:py-3 tw:text-left tw:transition-colors tw:hover:bg-muted/45 tw:focus-visible:outline-none tw:focus-visible:ring-2 tw:focus-visible:ring-ring tw:focus-visible:ring-inset"
              key={item.storeId}
              onClick={() => onEdit(item)}
              type="button"
            >
              <span className="tw:grid tw:size-10 tw:shrink-0 tw:place-items-center tw:rounded-lg tw:bg-secondary tw:text-secondary-foreground">
                <Store className="tw:size-4" aria-hidden="true" />
              </span>
              <span className="tw:min-w-0 tw:flex-1">
                <span className="tw:block tw:truncate tw:font-semibold">{item.storeName}</span>
                <span className="tw:mt-0.5 tw:block tw:truncate tw:text-xs tw:text-muted-foreground">{item.storeCode} · {manager.displayName}</span>
              </span>
              <StatusBadge status={item.status} />
            </button>
          )
        })}
      </div>
    </>
  )
}

function PersonnelList({ items, onEdit, onExit }: {
  items: PersonnelMasterItem[]
  onEdit: (item: PersonnelMasterItem) => void
  onExit: (item: PersonnelMasterItem) => void
}) {
  if (!items.length) {
    return <div className="tw:p-4 tw:sm:p-5"><AdminStatePanel title="Personel bulunamadı" description="Aramayı temizleyin veya personel girişi yapın." /></div>
  }

  return (
    <>
      <div className="tw:hidden tw:xl:block">
        <Table aria-label="Personel">
          <TableHeader className="tw:bg-muted/45">
            <TableRow className="tw:hover:bg-transparent">
              <TableHead className="tw:pl-5">Personel</TableHead>
              <TableHead>T.C.</TableHead>
              <TableHead>Telefon</TableHead>
              <TableHead>Mağaza / Pozisyon</TableHead>
              <TableHead>İşe giriş</TableHead>
              <TableHead>Çıkış</TableHead>
              <TableHead>Durum</TableHead>
              <TableHead className="tw:pr-5 tw:text-right"><span className="tw:sr-only">İşlem</span></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => (
              <TableRow className="tw:h-[68px]" key={item.employeeId}>
                <TableCell className="tw:pl-5">
                  <div className="tw:font-semibold tw:text-foreground">{item.displayName}</div>
                  <div className="tw:mt-0.5 tw:text-xs tw:text-muted-foreground">{item.externalEmployeeRef ?? 'Sicil bilgisi yok'}</div>
                </TableCell>
                <TableCell className="tw:font-mono tw:text-xs tw:text-muted-foreground">{formatMaskedNationalId(item.nationalIdLast4)}</TableCell>
                <TableCell className="tw:whitespace-nowrap tw:text-sm">{item.phoneNumber ?? '—'}</TableCell>
                <TableCell>
                  <div className="tw:font-medium tw:text-foreground">{item.storeName ?? 'Mağaza atanmamış'}</div>
                  <div className="tw:mt-0.5 tw:text-xs tw:text-muted-foreground">{item.positionName ?? 'Pozisyon atanmamış'}</div>
                </TableCell>
                <TableCell className="tw:whitespace-nowrap tw:text-muted-foreground">{formatDisplayDate(item.hireDate)}</TableCell>
                <TableCell className="tw:whitespace-nowrap tw:text-muted-foreground">{formatDisplayDate(item.terminationDate)}</TableCell>
                <TableCell><StatusBadge status={item.employmentStatus} /></TableCell>
                <TableCell className="tw:pr-5 tw:text-right">
                  {item.employmentStatus !== 'terminated' ? (
                    <div className="tw:flex tw:items-center tw:justify-end tw:gap-1">
                      <Button aria-label={`${item.displayName} personelini düzenle`} onClick={() => onEdit(item)} size="icon-sm" variant="ghost"><PencilLine aria-hidden="true" /></Button>
                      <Button onClick={() => onExit(item)} size="sm" variant="ghost"><LogOut aria-hidden="true" /> Çıkış yap</Button>
                    </div>
                  ) : null}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="tw:grid tw:gap-px tw:bg-border tw:sm:grid-cols-2 tw:xl:hidden">
        {items.map((item) => (
          <article className="tw:bg-card tw:px-4 tw:py-4 tw:sm:px-5" key={item.employeeId}>
            <div className="tw:flex tw:items-start tw:gap-3">
              <span className="tw:grid tw:size-10 tw:shrink-0 tw:place-items-center tw:rounded-lg tw:bg-secondary tw:text-secondary-foreground">
                <UserRound className="tw:size-4" aria-hidden="true" />
              </span>
              <div className="tw:min-w-0 tw:flex-1">
                <div className="tw:flex tw:items-start tw:justify-between tw:gap-2">
                  <div className="tw:min-w-0">
                    <div className="tw:truncate tw:font-semibold">{item.displayName}</div>
                    <div className="tw:mt-0.5 tw:truncate tw:text-xs tw:text-muted-foreground">{item.externalEmployeeRef ?? 'Sicil bilgisi yok'}</div>
                  </div>
                  <StatusBadge status={item.employmentStatus} />
                </div>
                <div className="tw:mt-4 tw:grid tw:grid-cols-2 tw:gap-x-4 tw:gap-y-3 tw:text-sm">
                  <PersonnelFact label="T.C." value={formatMaskedNationalId(item.nationalIdLast4)} />
                  <PersonnelFact label="Telefon" value={item.phoneNumber ?? '—'} />
                  <PersonnelFact label="Mağaza" value={item.storeName ?? 'Atanmamış'} />
                  <PersonnelFact label="Pozisyon" value={item.positionName ?? 'Atanmamış'} />
                  <PersonnelFact label="İşe giriş" value={formatDisplayDate(item.hireDate)} />
                  <PersonnelFact label="Çıkış" value={formatDisplayDate(item.terminationDate)} />
                </div>
                {item.employmentStatus !== 'terminated' ? (
                  <div className="tw:mt-3 tw:grid tw:grid-cols-2 tw:gap-2">
                    <Button onClick={() => onEdit(item)} size="sm" variant="outline"><PencilLine aria-hidden="true" /> Düzenle</Button>
                    <Button onClick={() => onExit(item)} size="sm" variant="outline"><LogOut aria-hidden="true" /> Personel çıkışı</Button>
                  </div>
                ) : null}
              </div>
            </div>
          </article>
        ))}
      </div>
    </>
  )
}

function PersonnelFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="tw:min-w-0">
      <div className="tw:text-[11px] tw:font-semibold tw:tracking-wide tw:text-muted-foreground tw:uppercase">{label}</div>
      <div className="tw:mt-0.5 tw:break-words tw:font-medium tw:text-foreground">{value}</div>
    </div>
  )
}

type StoreDraft = {
  storeCode: string
  storeName: string
  storeType: 'company' | 'franchise' | 'operator'
  regionManagerUserId: string
  status: 'active' | 'inactive' | 'closed'
  kpiImportEnabled: boolean
}

function StoreEditorDialog({ item, managers, onOpenChange, onSave, pending }: {
  item: StoreMasterItem | 'new' | null
  managers: Array<{ userId: string; displayName: string; email: string; regionId: string; regionName: string }>
  onOpenChange: (open: boolean) => void
  onSave: (draft: StoreDraft) => void
  pending: boolean
}) {
  const initialManager = item && item !== 'new'
    ? managers.find((manager) => manager.userId === item.regionManagerUserId)?.userId
      ?? ''
    : ''
  const [draft, setDraft] = useState<StoreDraft>({
    storeCode: item && item !== 'new' ? item.storeCode : '',
    storeName: item && item !== 'new' ? item.storeName : '',
    storeType: item && item !== 'new' ? item.storeType as StoreDraft['storeType'] : 'company',
    regionManagerUserId: initialManager,
    status: item && item !== 'new' ? item.status as StoreDraft['status'] : 'active',
    kpiImportEnabled: item && item !== 'new' ? item.kpiImportEnabled : true,
  })
  const valid = draft.storeCode.trim() && draft.storeName.trim() && draft.regionManagerUserId
  return (
    <Dialog open={item !== null} onOpenChange={onOpenChange}>
      <DialogContent className="tw:gap-0 tw:overflow-hidden tw:p-0 tw:sm:max-w-xl" closeLabel="Kapat">
        <DialogHeader className="tw:border-b tw:border-border tw:bg-muted/35 tw:px-5 tw:py-4 tw:pr-14"><DialogTitle>{item === 'new' ? 'Mağaza ekle' : 'Mağazayı düzenle'}</DialogTitle><DialogDescription>Mağaza bilgilerini ve sorumlu bölge müdürünü yönetin.</DialogDescription></DialogHeader>
        <div className="tw:grid tw:gap-4 tw:p-5 tw:sm:grid-cols-2">
          <Field label="Mağaza adı"><Input aria-label="Mağaza adı" disabled={item !== 'new'} value={draft.storeName} onChange={(e) => setDraft({ ...draft, storeName: e.target.value })} /></Field>
          <Field label="Mağaza kodu"><Input aria-label="Mağaza kodu" disabled={item !== 'new'} value={draft.storeCode} onChange={(e) => setDraft({ ...draft, storeCode: e.target.value })} /></Field>
          <Field className="tw:sm:col-span-2" label="Bölge müdürü">
            <Select value={draft.regionManagerUserId} onValueChange={(value) => setDraft({ ...draft, regionManagerUserId: value })}>
              <SelectTrigger aria-label="Bölge müdürü" className="tw:w-full"><SelectValue placeholder="Bölge müdürü seçin" /></SelectTrigger>
              <SelectContent>{managers.map((manager) => <SelectItem key={`${manager.userId}-${manager.regionId}`} value={manager.userId}>{manager.displayName} · {manager.email}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Mağaza türü"><Select value={draft.storeType} onValueChange={(value) => setDraft({ ...draft, storeType: value as StoreDraft['storeType'] })}><SelectTrigger aria-label="Mağaza türü" className="tw:w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="company">Şirket mağazası</SelectItem><SelectItem value="franchise">Franchise</SelectItem><SelectItem value="operator">Operatör</SelectItem></SelectContent></Select></Field>
          <Field label="Durum"><Select value={draft.status} onValueChange={(value) => setDraft({ ...draft, status: value as StoreDraft['status'] })}><SelectTrigger aria-label="Mağaza durumu" className="tw:w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="active">Aktif</SelectItem><SelectItem value="inactive">Pasif</SelectItem><SelectItem value="closed">Kapalı</SelectItem></SelectContent></Select></Field>
        </div>
        <DialogFooter className="tw:border-t tw:border-border tw:bg-muted/35 tw:px-5 tw:py-4"><Button variant="outline" onClick={() => onOpenChange(false)}>Vazgeç</Button><Button disabled={!valid || pending} onClick={() => onSave(draft)}><BadgePlus aria-hidden="true" /> {pending ? 'Kaydediliyor' : 'Kaydet'}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function PersonnelEntryDialog({ open, stores, positions, onOpenChange, onSave, pending }: {
  open: boolean
  stores: Array<{ storeId: string; storeName: string; storeCode: string }>
  positions: Array<{ positionId: string; positionName: string; positionCode: string }>
  onOpenChange: (open: boolean) => void
  onSave: (draft: { firstName: string; lastName: string; externalEmployeeRef?: string; nationalId: string; phoneNumber: string; employmentType: 'full_time' | 'part_time' | 'temporary'; hireDate: string; storeId: string; positionId: string }) => void
  pending: boolean
}) {
  const [draft, setDraft] = useState({ firstName: '', lastName: '', externalEmployeeRef: '', nationalId: '', phoneNumber: '', employmentType: 'full_time' as const, hireDate: today, storeId: '', positionId: '' })
  const nationalIdValid = /^[0-9]{11}$/.test(draft.nationalId)
  const phoneNumberValid = /^[0-9+() -]{10,20}$/.test(draft.phoneNumber.trim())
  const valid = Boolean(draft.firstName.trim() && draft.lastName.trim() && nationalIdValid && phoneNumberValid && draft.hireDate && draft.storeId && draft.positionId)
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="tw:max-h-[calc(100dvh-2rem)] tw:gap-0 tw:overflow-y-auto tw:p-0 tw:sm:max-w-2xl" closeLabel="Kapat">
        <DialogHeader className="tw:border-b tw:border-border tw:bg-muted/35 tw:px-5 tw:py-3 tw:pr-14"><DialogTitle>Personel girişi</DialogTitle><DialogDescription className="tw:sr-only">Personel kaydı ve ilk mağaza ataması.</DialogDescription></DialogHeader>
        <div className="tw:grid tw:gap-3 tw:px-5 tw:pt-3 tw:pb-4 tw:sm:grid-cols-2">
          <Field label="Ad"><Input aria-label="Ad" value={draft.firstName} onChange={(e) => setDraft({ ...draft, firstName: e.target.value })} /></Field>
          <Field label="Soyad"><Input aria-label="Soyad" value={draft.lastName} onChange={(e) => setDraft({ ...draft, lastName: e.target.value })} /></Field>
          <Field label="T.C. kimlik numarası">
            <Input
              aria-invalid={draft.nationalId.length > 0 && !nationalIdValid}
              aria-label="T.C. kimlik numarası"
              autoComplete="off"
              inputMode="numeric"
              maxLength={11}
              onChange={(e) => setDraft({ ...draft, nationalId: e.target.value.replace(/\D/g, '').slice(0, 11) })}
              placeholder="11 hane"
              value={draft.nationalId}
            />
          </Field>
          <Field label="Telefon numarası">
            <Input
              aria-invalid={draft.phoneNumber.length > 0 && !phoneNumberValid}
              aria-label="Telefon numarası"
              autoComplete="tel"
              inputMode="tel"
              maxLength={20}
              onChange={(e) => setDraft({ ...draft, phoneNumber: e.target.value })}
              placeholder="+90 5xx xxx xx xx"
              value={draft.phoneNumber}
            />
          </Field>
          <Field label="Sicil numarası"><Input aria-label="Sicil numarası" value={draft.externalEmployeeRef} onChange={(e) => setDraft({ ...draft, externalEmployeeRef: e.target.value })} /></Field>
          <Field label="İşe giriş tarihi"><Input aria-label="İşe giriş tarihi" max={today} type="date" value={draft.hireDate} onChange={(e) => setDraft({ ...draft, hireDate: e.target.value })} /></Field>
          <Field label="Mağaza"><MasterDataStoreCombobox stores={stores} value={draft.storeId} onValueChange={(value) => setDraft({ ...draft, storeId: value })} /></Field>
          <Field label="Pozisyon"><Select value={draft.positionId} onValueChange={(value) => setDraft({ ...draft, positionId: value })}><SelectTrigger aria-label="Pozisyon" className="tw:w-full"><SelectValue placeholder="Pozisyon seçin" /></SelectTrigger><SelectContent>{positions.map((position) => <SelectItem key={position.positionId} value={position.positionId}>{position.positionName}</SelectItem>)}</SelectContent></Select></Field>
        </div>
        <DialogFooter className="tw:border-t tw:border-border tw:bg-muted/35 tw:px-5 tw:py-3"><Button variant="outline" onClick={() => onOpenChange(false)}>Vazgeç</Button><Button disabled={!valid || pending} onClick={() => {
          const { externalEmployeeRef, ...requiredDraft } = draft
          onSave({
            ...requiredDraft,
            phoneNumber: draft.phoneNumber.trim(),
            ...(externalEmployeeRef.trim() ? { externalEmployeeRef: externalEmployeeRef.trim() } : {}),
          })
        }}><BriefcaseBusiness aria-hidden="true" /> {pending ? 'Kaydediliyor' : 'Girişi tamamla'}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

type PersonnelEditDraft = {
  employeeId: string
  firstName: string
  lastName: string
  externalEmployeeRef?: string
  phoneNumber: string
  employmentStatus: 'active' | 'inactive'
  employmentType: 'full_time' | 'part_time' | 'temporary'
  hireDate: string
  storeId: string
  positionId: string
  assignmentStartDate: string
  expectedUpdatedAt?: string
}

function PersonnelEditorDialog({ item, stores, positions, onOpenChange, onSave, pending }: {
  item: PersonnelMasterItem | null
  stores: Array<{ storeId: string; storeName: string; storeCode: string }>
  positions: Array<{ positionId: string; positionName: string; positionCode: string }>
  onOpenChange: (open: boolean) => void
  onSave: (draft: PersonnelEditDraft) => void
  pending: boolean
}) {
  const [draft, setDraft] = useState({
    firstName: item?.firstName ?? '',
    lastName: item?.lastName ?? '',
    externalEmployeeRef: item?.externalEmployeeRef ?? '',
    phoneNumber: item?.phoneNumber ?? '',
    employmentStatus: (item?.employmentStatus === 'inactive' ? 'inactive' : 'active') as 'active' | 'inactive',
    employmentType: (['full_time', 'part_time', 'temporary'].includes(item?.employmentType ?? '')
      ? item?.employmentType
      : 'full_time') as 'full_time' | 'part_time' | 'temporary',
    hireDate: item?.hireDate?.slice(0, 10) ?? today,
    storeId: item?.storeId ?? '',
    positionId: item?.positionId ?? '',
    assignmentStartDate: item?.assignmentStartDate?.slice(0, 10) ?? item?.hireDate?.slice(0, 10) ?? today,
  })
  const phoneNumberValid = /^[0-9+() -]{10,20}$/.test(draft.phoneNumber.trim())
  const valid = Boolean(
    item
    && draft.firstName.trim()
    && draft.lastName.trim()
    && phoneNumberValid
    && draft.hireDate
    && draft.storeId
    && draft.positionId
    && draft.assignmentStartDate,
  )

  return (
    <Dialog open={item !== null} onOpenChange={onOpenChange}>
      <DialogContent className="tw:max-h-[calc(100dvh-2rem)] tw:gap-0 tw:overflow-y-auto tw:p-0 tw:sm:max-w-2xl" closeLabel="Kapat">
        <DialogHeader className="tw:border-b tw:border-border tw:bg-muted/35 tw:px-5 tw:py-3 tw:pr-14">
          <DialogTitle>Personel bilgilerini düzenle</DialogTitle>
          <DialogDescription className="tw:sr-only">Personel bilgileri ve mağaza ataması.</DialogDescription>
        </DialogHeader>
        <div className="tw:grid tw:gap-3 tw:px-5 tw:pt-3 tw:pb-4 tw:sm:grid-cols-2">
          <Field label="Ad"><Input aria-label="Ad" value={draft.firstName} onChange={(event) => setDraft({ ...draft, firstName: event.target.value })} /></Field>
          <Field label="Soyad"><Input aria-label="Soyad" value={draft.lastName} onChange={(event) => setDraft({ ...draft, lastName: event.target.value })} /></Field>
          <Field label="T.C. (değiştirilemez)"><Input aria-label="T.C. (değiştirilemez)" disabled value={formatMaskedNationalId(item?.nationalIdLast4 ?? null)} /></Field>
          <Field label="Telefon numarası"><Input aria-invalid={draft.phoneNumber.length > 0 && !phoneNumberValid} aria-label="Telefon numarası" autoComplete="tel" inputMode="tel" maxLength={20} value={draft.phoneNumber} onChange={(event) => setDraft({ ...draft, phoneNumber: event.target.value })} /></Field>
          <Field label="Sicil numarası"><Input aria-label="Sicil numarası" value={draft.externalEmployeeRef} onChange={(event) => setDraft({ ...draft, externalEmployeeRef: event.target.value })} /></Field>
          <Field label="Personel durumu"><Select value={draft.employmentStatus} onValueChange={(value) => setDraft({ ...draft, employmentStatus: value as 'active' | 'inactive' })}><SelectTrigger aria-label="Personel durumu" className="tw:w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="active">Aktif</SelectItem><SelectItem value="inactive">Pasif</SelectItem></SelectContent></Select></Field>
          <Field label="Çalışma tipi"><Select value={draft.employmentType} onValueChange={(value) => setDraft({ ...draft, employmentType: value as PersonnelEditDraft['employmentType'] })}><SelectTrigger aria-label="Çalışma tipi" className="tw:w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="full_time">Tam zamanlı</SelectItem><SelectItem value="part_time">Yarı zamanlı</SelectItem><SelectItem value="temporary">Geçici</SelectItem></SelectContent></Select></Field>
          <Field label="İşe giriş tarihi"><Input aria-label="İşe giriş tarihi" max={today} type="date" value={draft.hireDate} onChange={(event) => setDraft({ ...draft, hireDate: event.target.value })} /></Field>
          <Field label="Mağaza"><MasterDataStoreCombobox stores={stores} value={draft.storeId} onValueChange={(value) => setDraft({ ...draft, storeId: value })} /></Field>
          <Field label="Pozisyon"><Select value={draft.positionId} onValueChange={(value) => setDraft({ ...draft, positionId: value })}><SelectTrigger aria-label="Pozisyon" className="tw:w-full"><SelectValue placeholder="Pozisyon seçin" /></SelectTrigger><SelectContent>{positions.map((position) => <SelectItem key={position.positionId} value={position.positionId}>{position.positionName}</SelectItem>)}</SelectContent></Select></Field>
          <Field className="tw:sm:col-span-2" label="Mağaza atama başlangıcı"><Input aria-label="Mağaza atama başlangıcı" max={today} type="date" value={draft.assignmentStartDate} onChange={(event) => setDraft({ ...draft, assignmentStartDate: event.target.value })} /></Field>
        </div>
        <DialogFooter className="tw:border-t tw:border-border tw:bg-muted/35 tw:px-5 tw:py-3">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Vazgeç</Button>
          <Button disabled={!valid || pending} onClick={() => {
            if (!item) return
            onSave({
              employeeId: item.employeeId,
              firstName: draft.firstName.trim(),
              lastName: draft.lastName.trim(),
              phoneNumber: draft.phoneNumber.trim(),
              employmentStatus: draft.employmentStatus,
              employmentType: draft.employmentType,
              hireDate: draft.hireDate,
              storeId: draft.storeId,
              positionId: draft.positionId,
              assignmentStartDate: draft.assignmentStartDate,
              ...(draft.externalEmployeeRef.trim() ? { externalEmployeeRef: draft.externalEmployeeRef.trim() } : {}),
              ...(item.updatedAt ? { expectedUpdatedAt: item.updatedAt } : {}),
            })
          }}><PencilLine aria-hidden="true" /> {pending ? 'Kaydediliyor' : 'Değişiklikleri kaydet'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

type PersonnelExitDraft = { terminationDate: string; reason: string; expectedUpdatedAt?: string }

function PersonnelExitDialog({ item, onOpenChange, onSave, pending }: { item: PersonnelMasterItem | null; onOpenChange: (open: boolean) => void; onSave: (draft: PersonnelExitDraft) => void; pending: boolean }) {
  const [terminationDate, setTerminationDate] = useState(today)
  const [reason, setReason] = useState('')
  return (
    <Dialog open={item !== null} onOpenChange={onOpenChange}>
      <DialogContent className="tw:gap-0 tw:overflow-hidden tw:p-0 tw:sm:max-w-md" closeLabel="Kapat">
        <DialogHeader className="tw:border-b tw:border-border tw:bg-muted/35 tw:px-5 tw:py-4 tw:pr-14"><DialogTitle>Personel çıkışı</DialogTitle><DialogDescription>{item?.displayName} için çıkış tamamlandığında bağlı kullanıcı erişimi ve aktif yetkiler de kapatılır.</DialogDescription></DialogHeader>
        <div className="tw:grid tw:gap-4 tw:p-5">
          <Field label="Çıkış tarihi"><Input aria-label="Çıkış tarihi" max={today} type="date" value={terminationDate} onChange={(e) => setTerminationDate(e.target.value)} /></Field>
          <Field label="Çıkış nedeni"><Input aria-label="Çıkış nedeni" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Kısa ve denetlenebilir bir açıklama" /></Field>
        </div>
        <DialogFooter className="tw:border-t tw:border-border tw:bg-muted/35 tw:px-5 tw:py-4"><Button variant="outline" onClick={() => onOpenChange(false)}>Vazgeç</Button><Button disabled={reason.trim().length < 2 || pending} onClick={() => onSave({ terminationDate, reason: reason.trim(), ...(item?.updatedAt ? { expectedUpdatedAt: item.updatedAt } : {}) })} variant="destructive"><LogOut aria-hidden="true" /> {pending ? 'Kapatılıyor' : 'Çıkışı tamamla'}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function Field({ children, className, label }: { children: React.ReactNode; className?: string; label: string }) {
  return <div className={className}><Label className="tw:mb-1.5">{label}</Label>{children}</div>
}

function StatusBadge({ status }: { status: string }) {
  const active = status === 'active'
  const terminated = status === 'terminated' || status === 'closed'
  return (
    <SemanticStatusBadge tone={active ? 'success' : terminated ? 'danger' : 'warning'}>
      {active ? 'Aktif' : status === 'terminated' ? 'Çıkış yapıldı' : status === 'closed' ? 'Kapalı' : 'Pasif'}
    </SemanticStatusBadge>
  )
}

function formatBusinessDate(value: Date) {
  const parts = new Intl.DateTimeFormat('en', {
    day: '2-digit',
    month: '2-digit',
    timeZone: 'Europe/Istanbul',
    year: 'numeric',
  }).formatToParts(value)
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? ''
  return `${part('year')}-${part('month')}-${part('day')}`
}

function downloadBrowserBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

function formatDisplayDate(value: string | null) {
  if (!value) return '—'
  const date = new Date(`${value.slice(0, 10)}T12:00:00+03:00`)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('tr-TR', {
    day: 'numeric',
    month: 'short',
    timeZone: 'Europe/Istanbul',
    year: 'numeric',
  }).format(date)
}

function formatMaskedNationalId(last4: string | null) {
  return last4 ? `•••••••${last4}` : '—'
}

function storeTypeLabel(value: string) {
  if (value === 'franchise') return 'Franchise'
  if (value === 'operator') return 'Operatör'
  return 'Şirket mağazası'
}
