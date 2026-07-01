import {
  useDeferredValue,
  useMemo,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'
import {
  AlertTriangle,
  Building2,
  Clock3,
  RefreshCw,
  Save,
  Search,
  UploadCloud,
  UsersRound,
} from 'lucide-react'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select'
import {
  getMasterDataBootstrapBatches,
  getMasterDataBootstrapBatchDetail,
  getMasterDataBootstrapPromotionReadiness,
  getMasterDataQualityAudit,
  getMasterDataQualityIssues,
  getPersonnelMasterData,
  getPersonnelMasterLookups,
  getStoreMasterData,
  getStoreMasterLookups,
  promoteMasterDataBootstrapPersonnel,
  promoteMasterDataBootstrapStores,
  updatePersonnelMasterData,
  updateStoreMasterData,
  validateMasterDataBootstrapBatch,
  type MasterDataBootstrapEntity,
  type MasterDataBootstrapReadiness,
} from '../features/integrations/api'
import {
  dateInputValue,
  mergePersonnelPatch,
  mergeStoreMasterPatch,
  normalizeEmploymentType,
  normalizePersonnelStatus,
  normalizeStoreStatus,
  normalizeStoreType,
  type PersonnelMasterPatch,
  type StoreMasterPatch,
} from './master-data-bootstrap-model'
import {
  findMasterDataConflict,
  invalidateMasterDataImportFamily,
  invalidatePersonnelMasterDataFamily,
  invalidateStoreMasterDataFamily,
  mapMasterDataAuditToRow,
  mapMasterDataIssueToRow,
  mapPersonnelMasterToWorkbenchRow,
  mapStoreMasterToWorkbenchRow,
  masterDataQueryKeys,
  type MasterDataAuditEntityFilter,
  type MasterDataIssueEntityFilter,
  type MasterDataIssueSeverityFilter,
  type MasterDataWorkbenchTab,
} from './master-data-control-center-model'
import { MasterDataDetailPanel } from './master-data-control-center-detail'
import { MasterDataWorkbenchTable } from './master-data-control-center-tables'

const PAGE_SIZE = 50

type FilterValue =
  | 'all'
  | MasterDataIssueSeverityFilter
  | MasterDataIssueEntityFilter
  | MasterDataAuditEntityFilter
  | MasterDataBootstrapReadiness
  | MasterDataBootstrapEntity
  | 'active'
  | 'inactive'
  | 'closed'
  | 'terminated'
  | 'company'
  | 'franchise'
  | 'operator'
  | 'kpi-on'
  | 'kpi-off'

type Feedback = {
  message: string
  tone: 'success' | 'warning' | 'danger' | 'info'
}

type SortValue = 'priority' | 'newest' | 'name'

const tabLabels: Record<MasterDataWorkbenchTab, string> = {
  issues: 'Düzeltilecekler',
  stores: 'Mağazalar',
  personnel: 'Personel',
  imports: 'İçe Aktarım',
  history: 'Geçmiş',
}

export function MasterDataControlCenterPage() {
  const params = useParams()
  const queryClient = useQueryClient()
  const routeBatchId = params.batchId ?? null
  const [activeTab, setActiveTab] = useState<MasterDataWorkbenchTab>(
    routeBatchId ? 'imports' : 'issues',
  )
  const [query, setQuery] = useState('')
  const deferredQuery = useDeferredValue(query)
  const [filterValue, setFilterValue] = useState<FilterValue>('all')
  const [sortValue, setSortValue] = useState<SortValue>('priority')
  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(null)
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null)
  const [selectedPersonnelId, setSelectedPersonnelId] = useState<string | null>(null)
  const [selectedImportId, setSelectedImportId] = useState<string | null>(routeBatchId)
  const [selectedAuditId, setSelectedAuditId] = useState<string | null>(null)
  const [storeDrafts, setStoreDrafts] = useState<Record<string, StoreMasterPatch>>({})
  const [personnelDrafts, setPersonnelDrafts] = useState<Record<string, PersonnelMasterPatch>>(
    {},
  )
  const [feedback, setFeedback] = useState<Feedback | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const effectiveFilterValue = getFilterOptions(activeTab).some((option) => option.value === filterValue)
    ? filterValue
    : 'all'

  const issueFilter = getIssueFilters(effectiveFilterValue)
  const issuesQuery = useQuery({
    queryKey: masterDataQueryKeys.issues({
      activeTab,
      search: deferredQuery,
      entityType: issueFilter.entityType,
      severity: issueFilter.severity,
      limit: PAGE_SIZE,
      offset: 0,
    }),
    queryFn: () =>
      getMasterDataQualityIssues({
        ...(deferredQuery ? { q: deferredQuery } : {}),
        ...(issueFilter.entityType === 'all' ? {} : { entityType: issueFilter.entityType }),
        ...(issueFilter.severity === 'all' ? {} : { severity: issueFilter.severity }),
        limit: PAGE_SIZE,
        offset: 0,
      }),
    staleTime: 30_000,
  })

  const issuesSummaryQuery = useQuery({
    queryKey: masterDataQueryKeys.issues({
      activeTab: 'issues',
      entityType: 'all',
      severity: 'all',
      limit: 1,
      offset: 0,
    }),
    queryFn: () => getMasterDataQualityIssues({ limit: 1, offset: 0 }),
    staleTime: 30_000,
  })

  const storeApiFilter = getStoreApiFilter(effectiveFilterValue)
  const storesQuery = useQuery({
    queryKey: masterDataQueryKeys.storeList({
      activeTab,
      search: deferredQuery,
      enabledFilter: storeApiFilter.enabled,
      statusFilter: storeApiFilter.status,
      limit: PAGE_SIZE,
      offset: 0,
    }),
    queryFn: () =>
      getStoreMasterData({
        ...(deferredQuery && activeTab === 'stores' ? { q: deferredQuery } : {}),
        ...(storeApiFilter.enabled === 'all' ? {} : { enabled: storeApiFilter.enabled === 'enabled' }),
        ...(storeApiFilter.status === 'all' ? {} : { status: storeApiFilter.status }),
        limit: PAGE_SIZE,
        offset: 0,
      }),
    staleTime: 30_000,
  })

  const storeTotalsQuery = useQuery({
    queryKey: masterDataQueryKeys.storeList({
      activeTab: 'stores',
      search: '',
      enabledFilter: 'all',
      statusFilter: 'all',
      limit: 1,
      offset: 0,
    }),
    queryFn: () => getStoreMasterData({ limit: 1, offset: 0 }),
    staleTime: 30_000,
  })

  const storeLookupsQuery = useQuery({
    queryKey: ['master-data-store-master-lookups'],
    queryFn: getStoreMasterLookups,
    staleTime: 60_000,
  })

  const personnelApiFilter = getPersonnelApiFilter(effectiveFilterValue)
  const personnelQuery = useQuery({
    queryKey: masterDataQueryKeys.personnelList({
      activeTab,
      search: deferredQuery,
      statusFilter: personnelApiFilter.status,
      storeFilter: 'all',
      limit: PAGE_SIZE,
      offset: 0,
    }),
    queryFn: () =>
      getPersonnelMasterData({
        ...(deferredQuery && activeTab === 'personnel' ? { q: deferredQuery } : {}),
        ...(personnelApiFilter.status === 'all' ? {} : { status: personnelApiFilter.status }),
        limit: PAGE_SIZE,
        offset: 0,
      }),
    staleTime: 30_000,
  })

  const personnelTotalsQuery = useQuery({
    queryKey: masterDataQueryKeys.personnelList({
      activeTab: 'personnel',
      search: '',
      statusFilter: 'all',
      storeFilter: 'all',
      limit: 1,
      offset: 0,
    }),
    queryFn: () => getPersonnelMasterData({ limit: 1, offset: 0 }),
    staleTime: 30_000,
  })

  const personnelLookupsQuery = useQuery({
    queryKey: ['master-data-personnel-master-lookups'],
    queryFn: getPersonnelMasterLookups,
    staleTime: 60_000,
  })

  const importFilter = getImportFilter(effectiveFilterValue)
  const importsQuery = useQuery({
    queryKey: masterDataQueryKeys.imports({
      activeTab,
      search: deferredQuery,
      entityFilter: importFilter.entity,
      readinessFilter: importFilter.readiness,
      limit: PAGE_SIZE,
      offset: 0,
    }),
    queryFn: () =>
      getMasterDataBootstrapBatches({
        ...(deferredQuery && activeTab === 'imports' ? { q: deferredQuery } : {}),
        ...(importFilter.entity === 'all' ? {} : { bootstrapEntity: importFilter.entity }),
        ...(importFilter.readiness === 'all' ? {} : { readiness: importFilter.readiness }),
        limit: PAGE_SIZE,
        offset: 0,
      }),
    staleTime: 30_000,
  })

  const selectedImportBatchId = selectedImportId ?? routeBatchId
  const importDetailQuery = useQuery({
    queryKey: masterDataQueryKeys.importDetail(selectedImportBatchId),
    queryFn: () => getMasterDataBootstrapBatchDetail(selectedImportBatchId ?? ''),
    enabled: Boolean(selectedImportBatchId),
  })
  const importReadinessQuery = useQuery({
    queryKey: masterDataQueryKeys.importReadiness(selectedImportBatchId),
    queryFn: () => getMasterDataBootstrapPromotionReadiness(selectedImportBatchId ?? ''),
    enabled: Boolean(selectedImportBatchId),
  })

  const auditFilter = getAuditFilter(effectiveFilterValue)
  const auditQuery = useQuery({
    queryKey: masterDataQueryKeys.audit({
      activeTab,
      entityType: auditFilter,
      limit: 30,
      offset: 0,
    }),
    queryFn: () =>
      getMasterDataQualityAudit({
        ...(auditFilter === 'all' ? {} : { entityType: auditFilter }),
        limit: 30,
        offset: 0,
      }),
    staleTime: 30_000,
  })

  const validateMutation = useMutation({
    mutationFn: validateMasterDataBootstrapBatch,
    onSuccess: async () => {
      setFeedback({ tone: 'success', message: 'Aktarım kontrol edildi.' })
      await invalidateMasterDataImportFamily(queryClient, selectedImportBatchId)
    },
    onError: () => setFeedback({ tone: 'danger', message: 'Aktarım kontrol edilemedi.' }),
  })

  const promoteMutation = useMutation({
    mutationFn: (input: { batchId: string; entity: MasterDataBootstrapEntity }) =>
      input.entity === 'store'
        ? promoteMasterDataBootstrapStores(input.batchId)
        : promoteMasterDataBootstrapPersonnel(input.batchId),
    onSuccess: async () => {
      setFeedback({ tone: 'success', message: 'Hazır kayıtlar kayda işlendi.' })
      await invalidateMasterDataImportFamily(queryClient, selectedImportBatchId)
    },
    onError: () => setFeedback({ tone: 'danger', message: 'Kayıt işleme tamamlanamadı.' }),
  })

  const issueRows = useMemo(
    () => (issuesQuery.data?.items ?? []).map(mapMasterDataIssueToRow),
    [issuesQuery.data?.items],
  )
  const storeRows = useMemo(() => {
    const rows = (storesQuery.data?.items ?? []).map(mapStoreMasterToWorkbenchRow)
    return sortStores(filterStoreRows(rows, effectiveFilterValue), sortValue)
  }, [effectiveFilterValue, sortValue, storesQuery.data?.items])
  const personnelRows = useMemo(() => {
    const rows = (personnelQuery.data?.items ?? []).map(mapPersonnelMasterToWorkbenchRow)
    return sortPersonnel(rows, sortValue)
  }, [personnelQuery.data?.items, sortValue])
  const importRows = useMemo(
    () =>
      (importsQuery.data?.items ?? [])
        .map((batch) => ({
          id: batch.batchId,
          title: batch.sourceLabel,
          subtitle: batch.fileReference ?? 'İçe aktarım',
          entityLabel: batch.bootstrapEntity === 'store' ? 'Mağaza' : 'Personel',
          statusLabel: formatReadiness(batch.readiness),
          readinessLabel: formatReadiness(batch.nextAction),
          updatedAt: batch.updatedAt ?? batch.promotedAt ?? batch.validatedAt ?? batch.createdAt,
          record: batch,
        }))
        .sort((a, b) => compareBySort(a.title, a.updatedAt, b.title, b.updatedAt, sortValue)),
    [importsQuery.data?.items, sortValue],
  )
  const auditRows = useMemo(
    () =>
      (auditQuery.data?.items ?? [])
        .map(mapMasterDataAuditToRow)
        .sort((a, b) => compareBySort(a.title, a.occurredAt, b.title, b.occurredAt, sortValue)),
    [auditQuery.data?.items, sortValue],
  )

  const selectedIssue = issueRows.find((row) => row.id === selectedIssueId) ?? issueRows[0] ?? null
  const selectedStore = storeRows.find((row) => row.id === selectedStoreId) ?? storeRows[0] ?? null
  const selectedPersonnel =
    personnelRows.find((row) => row.id === selectedPersonnelId) ?? personnelRows[0] ?? null
  const selectedImport = selectedImportBatchId
    ? importRows.find((row) => row.id === selectedImportBatchId) ?? null
    : importRows[0] ?? null
  const selectedAudit = auditRows.find((row) => row.id === selectedAuditId) ?? auditRows[0] ?? null

  const unsavedCount = Object.keys(storeDrafts).length + Object.keys(personnelDrafts).length
  const issueSummary = issuesSummaryQuery.data?.summary
  const pendingIssues =
    (issueSummary?.severity.critical ?? 0) + (issueSummary?.severity.warning ?? 0)

  async function saveAllDrafts() {
    if (unsavedCount === 0) return

    const storesById = new Map((storesQuery.data?.items ?? []).map((store) => [store.storeId, store]))
    const personnelById = new Map(
      (personnelQuery.data?.items ?? []).map((personnel) => [personnel.employeeId, personnel]),
    )
    const storeEntries = Object.entries(storeDrafts).filter(([storeId]) => storesById.has(storeId))
    const personnelEntries = Object.entries(personnelDrafts).filter(([employeeId]) =>
      personnelById.has(employeeId),
    )
    const hiddenDraftCount =
      Object.keys(storeDrafts).filter((storeId) => !storesById.has(storeId)).length +
      Object.keys(personnelDrafts).filter((employeeId) => !personnelById.has(employeeId)).length

    if (hiddenDraftCount > 0) {
      setFeedback({
        tone: 'warning',
        message: 'Filtre dışında kaydedilmemiş değişiklik var. Kaydetmeden önce filtreleri sıfırlayın.',
      })
      return
    }

    if (
      storeEntries.some(([storeId, patch]) => !mergeStoreMasterPatch(storesById.get(storeId)!, patch, storeLookupsQuery.data).regionId) ||
      personnelEntries.some(([employeeId, patch]) => {
        const merged = mergePersonnelPatch(personnelById.get(employeeId)!, patch)
        return !merged.storeId || !merged.positionId || !merged.hireDate
      })
    ) {
      setFeedback({ tone: 'warning', message: 'Zorunlu alanları tamamlayın.' })
      return
    }

    setIsSaving(true)
    setFeedback(null)
    try {
      const storeResults = await Promise.allSettled(
        storeEntries.map(([storeId, patch]) => {
          const record = storesById.get(storeId)!
          const effective = mergeStoreMasterPatch(record, patch, storeLookupsQuery.data)
          return updateStoreMasterData({
            storeId,
            storeType: normalizeStoreType(effective.storeType),
            regionId: effective.regionId!,
            status: normalizeStoreStatus(effective.status),
            kpiImportEnabled: effective.kpiImportEnabled,
            ...(record.updatedAt ? { expectedUpdatedAt: record.updatedAt } : {}),
          })
        }),
      )
      const personnelResults = await Promise.allSettled(
        personnelEntries.map(([employeeId, patch]) => {
          const record = personnelById.get(employeeId)!
          const effective = mergePersonnelPatch(record, patch)
          return updatePersonnelMasterData({
            employeeId,
            firstName: effective.firstName,
            lastName: effective.lastName,
            externalEmployeeRef: effective.externalEmployeeRef,
            employmentStatus: normalizePersonnelStatus(effective.employmentStatus),
            employmentType: normalizeEmploymentType(effective.employmentType),
            hireDate: dateInputValue(effective.hireDate),
            storeId: effective.storeId,
            positionId: effective.positionId,
            assignmentStartDate: effective.assignmentStartDate,
            ...(record.updatedAt ? { expectedUpdatedAt: record.updatedAt } : {}),
          })
        }),
      )

      clearSuccessfulDrafts(storeEntries, storeResults, setStoreDrafts)
      clearSuccessfulDrafts(personnelEntries, personnelResults, setPersonnelDrafts)

      const conflict = findMasterDataConflict([...storeResults, ...personnelResults])
      if (conflict) {
        setFeedback({ tone: 'warning', message: conflict.message })
      } else if ([...storeResults, ...personnelResults].some((result) => result.status === 'rejected')) {
        setFeedback({ tone: 'danger', message: 'Bazı değişiklikler kaydedilemedi.' })
      } else {
        setFeedback({ tone: 'success', message: 'Değişiklikler kaydedildi.' })
      }

      await Promise.all([
        invalidateStoreMasterDataFamily(queryClient),
        invalidatePersonnelMasterDataFamily(queryClient),
      ])
    } finally {
      setIsSaving(false)
    }
  }

  function updateStoreDraft(storeId: string, patch: StoreMasterPatch) {
    setStoreDrafts((current) => ({
      ...current,
      [storeId]: { ...(current[storeId] ?? {}), ...patch },
    }))
  }

  function updatePersonnelDraft(employeeId: string, patch: PersonnelMasterPatch) {
    setPersonnelDrafts((current) => ({
      ...current,
      [employeeId]: { ...(current[employeeId] ?? {}), ...patch },
    }))
  }

  function openIssueTarget() {
    if (!selectedIssue) return
    if (selectedIssue.entityType === 'personnel') {
      setActiveTab('personnel')
      setSelectedPersonnelId(selectedIssue.entityId)
    } else if (selectedIssue.entityType === 'import') {
      setActiveTab('imports')
      setSelectedImportId(selectedIssue.entityId)
    } else {
      setActiveTab('stores')
      setSelectedStoreId(selectedIssue.entityId)
    }
  }

  function resetFilters() {
    setQuery('')
    setFilterValue('all')
    setSortValue('priority')
  }

  return (
    <section className="master-data-control-center" aria-labelledby="master-data-control-center-title">
      <header className="master-data-control-center__hero">
        <div>
          <div className="master-data-control-center__pills">
            <span className="master-data-control-center__pill master-data-control-center__pill--primary">Ana Veri</span>
            <span className="master-data-control-center__pill">Canlı kayıtlar</span>
            <span className="master-data-control-center__pill master-data-control-center__pill--warning">
              {unsavedCount} kaydedilmedi
            </span>
          </div>
          <h1 id="master-data-control-center-title">Ana Veri Kontrolü</h1>
          <p>Mağaza, personel, rol ve bölge ilişkilerini temizleyip kaydedin.</p>
        </div>
        <div className="master-data-control-center__actions">
          <Button
            variant="outline"
            onClick={() =>
              void queryClient.invalidateQueries({
                predicate: (query) =>
                  typeof query.queryKey[0] === 'string' && query.queryKey[0].startsWith('master-data'),
              })
            }
          >
            <RefreshCw data-icon="inline-start" aria-hidden="true" />
            Yenile
          </Button>
          <Button variant="outline" onClick={() => setActiveTab('imports')}>
            <UploadCloud data-icon="inline-start" aria-hidden="true" />
            İçe aktar
          </Button>
          <Button disabled={unsavedCount === 0 || isSaving} onClick={() => void saveAllDrafts()}>
            <Save data-icon="inline-start" aria-hidden="true" />
            Değişiklikleri kaydet
          </Button>
        </div>
      </header>

      <div className="master-data-control-center__metrics" aria-label="Ana veri özeti">
        <Metric icon={<AlertTriangle aria-hidden="true" />} label="Aksiyon bekleyen" note="Dönem hesaplarını etkiler" tone="rose" value={pendingIssues} />
        <Metric icon={<Building2 aria-hidden="true" />} label="Mağaza" note="Aktif portföy" tone="plum" value={storeTotalsQuery.data?.meta.total ?? storesQuery.data?.meta.total ?? 0} />
        <Metric icon={<UsersRound aria-hidden="true" />} label="Personel" note="Atama ve rol kayıtları" tone="cyan" value={personnelTotalsQuery.data?.meta.total ?? personnelQuery.data?.meta.total ?? 0} />
        <Metric icon={<Clock3 aria-hidden="true" />} label="Kaydedilmemiş" note="Kaydetme bekler" tone="amber" value={unsavedCount} />
      </div>

      <section className="master-data-control-center__board" aria-label="Ana veri karar özeti">
        <article className="master-data-control-center__priority">
          <span>Öncelik</span>
          <strong>{pendingIssues} kayıt aksiyon bekliyor</strong>
          <p>Bölge, satıcı kodu ve pozisyon eşleşmeleri tamamlanmadan dönem hesapları güvenilir sayılmaz.</p>
        </article>
        <div className="master-data-control-center__impact-map" aria-label="Etkilenen alanlar">
          <ImpactCard title="KPI" copy="Mağaza ve personel eşleşmesi" tone="info" />
          <ImpactCard title="Prim" copy="Şirket mağazası ve satıcı kodu" tone="success" />
          <ImpactCard title="Hedef" copy="Mağaza müdürü ve bölge müdürü" tone="warning" />
          <ImpactCard title="Norm Kadro" copy="Aktif personel ve pozisyon" tone="neutral" />
        </div>
      </section>

      <section className="master-data-control-center__workbench" aria-label="Ana veri çalışma alanı">
        <div className="master-data-control-center__workbench-head">
          <div className="master-data-control-center__tabs" role="tablist" aria-label="Ana veri sekmeleri">
            {(Object.keys(tabLabels) as MasterDataWorkbenchTab[]).map((tab) => (
              <Button
                aria-selected={activeTab === tab}
                className="master-data-control-center__tab"
                data-active={activeTab === tab}
                key={tab}
                role="tab"
                variant={activeTab === tab ? 'default' : 'outline'}
                onClick={() => setActiveTab(tab)}
              >
                {tabLabels[tab]}
                <span>{getTabCount(tab, issueRows.length, storesQuery.data?.meta.total, personnelQuery.data?.meta.total, importsQuery.data?.meta.total, auditQuery.data?.meta.total)}</span>
              </Button>
            ))}
          </div>
          <div className="master-data-control-center__filterbar">
            <label className="master-data-control-center__search">
              <Search aria-hidden="true" />
              <span className="sr-only">Ana veride ara</span>
              <Input value={query} placeholder={getSearchPlaceholder(activeTab)} onChange={(event) => setQuery(event.target.value)} />
            </label>
            <Select value={effectiveFilterValue} onValueChange={(value) => setFilterValue(value as FilterValue)}>
              <SelectTrigger className="master-data-control-center__select" aria-label="Durum filtresi">
                <SelectValue placeholder="Tümü" />
              </SelectTrigger>
              <SelectContent>
                {getFilterOptions(activeTab).map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={sortValue} onValueChange={(value) => setSortValue(value as SortValue)}>
              <SelectTrigger className="master-data-control-center__select" aria-label="Sıralama">
                <SelectValue placeholder="Öncelik" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="priority">Öncelik</SelectItem>
                <SelectItem value="newest">Son değişiklik</SelectItem>
                <SelectItem value="name">Ada göre</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={resetFilters}>Sıfırla</Button>
          </div>
        </div>

        {feedback ? (
          <div className={`master-data-control-center__feedback master-data-control-center__feedback--${feedback.tone}`}>
            {feedback.message}
          </div>
        ) : null}

        <div className="master-data-control-center__grid">
          <MasterDataWorkbenchTable
            activeTab={activeTab}
            auditRows={auditRows}
            importRows={importRows}
            issueRows={issueRows}
            isLoading={isTabLoading(activeTab, issuesQuery.isLoading, storesQuery.isLoading, personnelQuery.isLoading, importsQuery.isLoading, auditQuery.isLoading)}
            personnelRows={personnelRows}
            selectedAuditId={selectedAudit?.id ?? null}
            selectedImportId={selectedImport?.id ?? null}
            selectedIssueId={selectedIssue?.id ?? null}
            selectedPersonnelId={selectedPersonnel?.id ?? null}
            selectedStoreId={selectedStore?.id ?? null}
            storeRows={storeRows}
            onSelectAudit={setSelectedAuditId}
            onSelectImport={setSelectedImportId}
            onSelectIssue={setSelectedIssueId}
            onSelectPersonnel={setSelectedPersonnelId}
            onSelectStore={setSelectedStoreId}
          />

          <MasterDataDetailPanel
            activeTab={activeTab}
            audit={selectedAudit}
            conflictMessage={feedback?.tone === 'warning' ? feedback.message : null}
            importDetail={importDetailQuery.data ?? null}
            importReadiness={importReadinessQuery.data ?? null}
            importRow={selectedImport}
            isImportProcessing={validateMutation.isPending || promoteMutation.isPending}
            isSaving={isSaving}
            issue={selectedIssue}
            personnel={selectedPersonnel}
            personnelDraft={selectedPersonnel ? personnelDrafts[selectedPersonnel.id] ?? {} : {}}
            personnelLookups={personnelLookupsQuery.data}
            store={selectedStore}
            storeDraft={selectedStore ? storeDrafts[selectedStore.id] ?? {} : {}}
            storeLookups={storeLookupsQuery.data}
            unsavedCount={unsavedCount}
            onIssueEdit={openIssueTarget}
            onProcessImport={() => {
              if (selectedImport) {
                promoteMutation.mutate({ batchId: selectedImport.id, entity: selectedImport.record.bootstrapEntity })
              }
            }}
            onSave={() => void saveAllDrafts()}
            onUpdatePersonnelDraft={updatePersonnelDraft}
            onUpdateStoreDraft={updateStoreDraft}
            onValidateImport={() => {
              if (selectedImport) validateMutation.mutate(selectedImport.id)
            }}
          />
        </div>
      </section>
    </section>
  )
}

function Metric(input: {
  icon: ReactNode
  label: string
  note: string
  tone: 'plum' | 'cyan' | 'amber' | 'rose'
  value: number
}) {
  return (
    <article className="master-data-control-center__metric">
      <span className={`master-data-control-center__metric-icon master-data-control-center__metric-icon--${input.tone}`}>
        {input.icon}
      </span>
      <span>{input.label}</span>
      <strong>{input.value.toLocaleString('tr-TR')}</strong>
      <small>{input.note}</small>
    </article>
  )
}

function ImpactCard(input: { title: string; copy: string; tone: string }) {
  return (
    <div className="master-data-control-center__impact-card">
      <span className={`master-data-control-center__status master-data-control-center__status--${input.tone}`}>{input.title}</span>
      <p>{input.copy}</p>
    </div>
  )
}

function getFilterOptions(tab: MasterDataWorkbenchTab): Array<{ value: FilterValue; label: string }> {
  if (tab === 'issues') {
    return [
      { value: 'all', label: 'Tümü' },
      { value: 'critical', label: 'Kritik' },
      { value: 'warning', label: 'Uyarı' },
      { value: 'info', label: 'Bilgi' },
      { value: 'store', label: 'Mağaza' },
      { value: 'personnel', label: 'Personel' },
      { value: 'import', label: 'İçe aktarım' },
    ]
  }
  if (tab === 'stores') {
    return [
      { value: 'all', label: 'Tümü' },
      { value: 'active', label: 'Aktif' },
      { value: 'inactive', label: 'Pasif' },
      { value: 'closed', label: 'Kapalı' },
      { value: 'company', label: 'Şirket' },
      { value: 'franchise', label: 'Bayi' },
      { value: 'operator', label: 'İşletme' },
      { value: 'kpi-on', label: 'KPI açık' },
      { value: 'kpi-off', label: 'KPI kapalı' },
    ]
  }
  if (tab === 'personnel') {
    return [
      { value: 'all', label: 'Tümü' },
      { value: 'active', label: 'Aktif' },
      { value: 'inactive', label: 'Pasif' },
      { value: 'terminated', label: 'Ayrıldı' },
    ]
  }
  if (tab === 'imports') {
    return [
      { value: 'all', label: 'Tümü' },
      { value: 'store', label: 'Mağaza' },
      { value: 'personnel', label: 'Personel' },
      { value: 'needs_validation', label: 'Kontrol bekliyor' },
      { value: 'needs_review', label: 'İnceleme' },
      { value: 'ready_to_promote', label: 'Kayda hazır' },
      { value: 'closed', label: 'Kapalı' },
    ]
  }
  return [
    { value: 'all', label: 'Tümü' },
    { value: 'store', label: 'Mağaza' },
    { value: 'personnel', label: 'Personel' },
    { value: 'import', label: 'İçe aktarım' },
  ]
}

function getSearchPlaceholder(tab: MasterDataWorkbenchTab) {
  if (tab === 'issues') return 'Sorun, mağaza veya personel ara'
  if (tab === 'stores') return 'Mağaza, kod veya bölge ara'
  if (tab === 'personnel') return 'Personel, satıcı kodu veya mağaza ara'
  if (tab === 'imports') return 'Aktarım partisi ara'
  return 'Geçmişte ara'
}

function getIssueFilters(value: FilterValue): {
  entityType: MasterDataIssueEntityFilter
  severity: MasterDataIssueSeverityFilter
} {
  if (value === 'critical' || value === 'warning' || value === 'info') {
    return { entityType: 'all', severity: value }
  }
  if (value === 'store' || value === 'personnel' || value === 'assignment' || value === 'import') {
    return { entityType: value, severity: 'all' }
  }
  return { entityType: 'all', severity: 'all' }
}

function getStoreApiFilter(value: FilterValue) {
  return {
    enabled: value === 'kpi-on' ? 'enabled' : value === 'kpi-off' ? 'disabled' : 'all',
    status: value === 'active' || value === 'inactive' || value === 'closed' ? value : 'all',
  } as const
}

function getPersonnelApiFilter(value: FilterValue) {
  return {
    status:
      value === 'active' || value === 'inactive' || value === 'terminated' ? value : 'all',
  } as const
}

function getImportFilter(value: FilterValue) {
  return {
    entity: value === 'store' || value === 'personnel' ? value : 'all',
    readiness:
      value === 'needs_validation' ||
      value === 'needs_review' ||
      value === 'ready_to_promote' ||
      value === 'closed'
        ? value
        : 'all',
  } as const
}

function getAuditFilter(value: FilterValue): MasterDataAuditEntityFilter {
  return value === 'store' || value === 'personnel' || value === 'import' ? value : 'all'
}

function filterStoreRows(rows: ReturnType<typeof mapStoreMasterToWorkbenchRow>[], value: FilterValue) {
  if (value === 'company' || value === 'franchise' || value === 'operator') {
    return rows.filter((row) => normalizeStoreType(row.record.storeType) === value)
  }
  return rows
}

function sortStores(rows: ReturnType<typeof mapStoreMasterToWorkbenchRow>[], sort: SortValue) {
  return [...rows].sort((a, b) => compareBySort(a.title, a.updatedAt, b.title, b.updatedAt, sort))
}

function sortPersonnel(rows: ReturnType<typeof mapPersonnelMasterToWorkbenchRow>[], sort: SortValue) {
  return [...rows].sort((a, b) => compareBySort(a.title, a.updatedAt, b.title, b.updatedAt, sort))
}

function compareBySort(aTitle: string, aDate: string | null, bTitle: string, bDate: string | null, sort: SortValue) {
  if (sort === 'name') return aTitle.localeCompare(bTitle, 'tr-TR')
  if (sort === 'newest') return String(bDate ?? '').localeCompare(String(aDate ?? ''))
  return 0
}

function clearSuccessfulDrafts<TPatch>(
  entries: Array<[string, TPatch]>,
  results: PromiseSettledResult<unknown>[],
  setDrafts: Dispatch<SetStateAction<Record<string, TPatch>>>,
) {
  const successfulIds = new Set(entries.filter((_, index) => results[index]?.status === 'fulfilled').map(([id]) => id))
  if (successfulIds.size === 0) return
  setDrafts((current) => {
    const next = { ...current }
    for (const id of successfulIds) delete next[id]
    return next
  })
}

function formatReadiness(value: string) {
  switch (value) {
    case 'ready_to_promote':
    case 'ready':
    case 'promote_ready_rows':
      return 'Kayda hazır'
    case 'needs_review':
    case 'review_rows':
      return 'İnceleme gerekli'
    case 'needs_validation':
    case 'pending':
      return 'Kontrol bekliyor'
    case 'closed':
    case 'promoted':
    case 'already_promoted':
    case 'already_closed':
      return 'Kapalı'
    case 'blocked':
      return 'Bekliyor'
    default:
      return value
  }
}

function getTabCount(
  tab: MasterDataWorkbenchTab,
  issues: number,
  stores?: number,
  personnel?: number,
  imports?: number,
  history?: number,
) {
  if (tab === 'issues') return issues
  if (tab === 'stores') return stores ?? 0
  if (tab === 'personnel') return personnel ?? 0
  if (tab === 'imports') return imports ?? 0
  return history ?? 0
}

function isTabLoading(
  activeTab: MasterDataWorkbenchTab,
  issues: boolean,
  stores: boolean,
  personnel: boolean,
  imports: boolean,
  history: boolean,
) {
  if (activeTab === 'issues') return issues
  if (activeTab === 'stores') return stores
  if (activeTab === 'personnel') return personnel
  if (activeTab === 'imports') return imports
  return history
}
