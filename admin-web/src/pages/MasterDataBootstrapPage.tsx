import { useDeferredValue, useMemo, useState, type ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  DatabaseZap,
  History,
  ListChecks,
  Save,
  Search,
  ShieldCheck,
  UserRound,
} from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { EmptyState, ScreenState } from '../components/dashboard-primitives'
import {
  getMasterDataBootstrapBatches,
  getMasterDataBootstrapBatchDetail,
  getMasterDataBootstrapPromotionReadiness,
  getPersonnelMasterData,
  getPersonnelMasterLookups,
  getStoreMasterData,
  getStoreMasterLookups,
  promoteMasterDataBootstrapPersonnel,
  promoteMasterDataBootstrapStores,
  updatePersonnelMasterData,
  updateStoreMasterData,
  validateMasterDataBootstrapBatch,
} from '../features/integrations/api'
import type {
  ListResponse,
  MasterDataBootstrapBatchDetail,
  MasterDataBootstrapBatchItem,
  MasterDataBootstrapEntity,
  MasterDataBootstrapPromotionReadinessResponse,
  MasterDataBootstrapPromotionResponse,
  MasterDataBootstrapReadiness,
  MasterDataBootstrapRow,
  PersonnelMasterItem,
  StoreMasterItem,
} from '../features/integrations/api'
import type { TranslateFunction } from '../features/localization/dictionary'
import { useLocalization } from '../features/localization/useLocalization'
import { formatDateTime, getErrorMessage } from '../lib/format'

const PAGE_SIZE = 50

type MasterDataTab = 'batches' | 'stores' | 'personnel' | 'history'
type MasterDataBootstrapEntityFilter = 'all' | MasterDataBootstrapEntity
type MasterDataBootstrapReadinessFilter =
  | 'all'
  | 'needs_validation'
  | 'needs_review'
  | 'ready_to_promote'
  | 'closed'
type StoreMasterType = 'company' | 'franchise' | 'operator'
type StoreMasterStatus = 'active' | 'inactive' | 'closed'
type PersonnelStatus = 'active' | 'inactive' | 'terminated'
type PersonnelEmploymentType = 'full_time' | 'part_time' | 'temporary'

type StoreMasterPatch = {
  storeType?: StoreMasterType
  regionId?: string
  status?: StoreMasterStatus
  kpiImportEnabled?: boolean
}

type PersonnelMasterPatch = Partial<{
  firstName: string
  lastName: string
  externalEmployeeRef: string
  employmentStatus: PersonnelStatus
  employmentType: PersonnelEmploymentType
  hireDate: string
  storeId: string
  positionId: string
  assignmentStartDate: string
}>

function normalizeStoreType(value: string): StoreMasterType {
  if (value === 'franchise' || value === 'operator') {
    return value
  }

  return 'company'
}

function normalizeStoreStatus(value: string): StoreMasterStatus {
  if (value === 'inactive' || value === 'closed') {
    return value
  }

  return 'active'
}

function normalizePersonnelStatus(value: string): PersonnelStatus {
  if (value === 'inactive' || value === 'terminated') {
    return value
  }

  return 'active'
}

function normalizeEmploymentType(value: string): PersonnelEmploymentType {
  if (value === 'part_time' || value === 'temporary') {
    return value
  }

  return 'full_time'
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('tr-TR').format(value)
}

function dateInputValue(value: string | null | undefined) {
  return value ? value.slice(0, 10) : ''
}

export function MasterDataBootstrapPage() {
  const { locale, t } = useLocalization()
  const params = useParams()
  const batchId = params.batchId ?? null
  const queryClient = useQueryClient()

  const [activeTab, setActiveTab] = useState<MasterDataTab>('batches')
  const [batchSearch, setBatchSearch] = useState('')
  const [entityFilter, setEntityFilter] = useState<MasterDataBootstrapEntityFilter>('all')
  const [readinessFilter, setReadinessFilter] = useState<MasterDataBootstrapReadinessFilter>('all')
  const [feedback, setFeedback] = useState<string | null>(null)
  const [promotionResult, setPromotionResult] =
    useState<MasterDataBootstrapPromotionResponse['data'] | null>(null)

  const [storeSearch, setStoreSearch] = useState('')
  const [storeEnabledFilter, setStoreEnabledFilter] = useState<'all' | 'enabled' | 'disabled'>('all')
  const [storeStatusFilter, setStoreStatusFilter] = useState<'all' | StoreMasterStatus>('all')
  const [storeOffset, setStoreOffset] = useState(0)
  const [storeFeedback, setStoreFeedback] = useState<string | null>(null)
  const [storeDrafts, setStoreDrafts] = useState<Record<string, StoreMasterPatch>>({})
  const [savingStoreIds, setSavingStoreIds] = useState<ReadonlySet<string>>(() => new Set())

  const [personnelSearch, setPersonnelSearch] = useState('')
  const [personnelStatusFilter, setPersonnelStatusFilter] = useState<'all' | PersonnelStatus>('all')
  const [personnelStoreFilter, setPersonnelStoreFilter] = useState('all')
  const [personnelOffset, setPersonnelOffset] = useState(0)
  const [personnelFeedback, setPersonnelFeedback] = useState<string | null>(null)
  const [personnelDrafts, setPersonnelDrafts] = useState<Record<string, PersonnelMasterPatch>>({})
  const [savingPersonnelIds, setSavingPersonnelIds] = useState<ReadonlySet<string>>(() => new Set())

  const deferredBatchSearch = useDeferredValue(batchSearch)
  const deferredStoreSearch = useDeferredValue(storeSearch)
  const deferredPersonnelSearch = useDeferredValue(personnelSearch)

  const batchesQuery = useQuery({
    queryKey: ['master-data-bootstrap-batches', entityFilter, readinessFilter, deferredBatchSearch],
    queryFn: () =>
      getMasterDataBootstrapBatches({
        bootstrapEntity: entityFilter === 'all' ? undefined : entityFilter,
        readiness: readinessFilter === 'all' ? undefined : readinessFilter,
        q: deferredBatchSearch || undefined,
        limit: PAGE_SIZE,
        offset: 0,
      }),
  })
  const detailQuery = useQuery({
    queryKey: ['master-data-bootstrap-detail', batchId],
    queryFn: () => getMasterDataBootstrapBatchDetail(batchId ?? ''),
    enabled: Boolean(batchId),
  })
  const readinessQuery = useQuery({
    queryKey: ['master-data-bootstrap-readiness', batchId],
    queryFn: () => getMasterDataBootstrapPromotionReadiness(batchId ?? ''),
    enabled: Boolean(batchId),
  })
  const storeMasterQuery = useQuery({
    queryKey: [
      'master-data-store-master',
      deferredStoreSearch,
      storeEnabledFilter,
      storeStatusFilter,
      storeOffset,
    ],
    queryFn: () =>
      getStoreMasterData({
        q: deferredStoreSearch || undefined,
        enabled: storeEnabledFilter === 'all' ? undefined : storeEnabledFilter === 'enabled',
        status: storeStatusFilter === 'all' ? undefined : storeStatusFilter,
        limit: PAGE_SIZE,
        offset: storeOffset,
      }),
    enabled: activeTab === 'stores',
  })
  const storeMasterLookupsQuery = useQuery({
    queryKey: ['master-data-store-master-lookups'],
    queryFn: getStoreMasterLookups,
    enabled: activeTab === 'stores',
  })
  const personnelMasterQuery = useQuery({
    queryKey: [
      'master-data-personnel-master',
      deferredPersonnelSearch,
      personnelStatusFilter,
      personnelStoreFilter,
      personnelOffset,
    ],
    queryFn: () =>
      getPersonnelMasterData({
        q: deferredPersonnelSearch || undefined,
        status: personnelStatusFilter === 'all' ? undefined : personnelStatusFilter,
        storeId: personnelStoreFilter === 'all' ? undefined : personnelStoreFilter,
        limit: PAGE_SIZE,
        offset: personnelOffset,
      }),
    enabled: activeTab === 'personnel',
  })
  const personnelMasterLookupsQuery = useQuery({
    queryKey: ['master-data-personnel-master-lookups'],
    queryFn: getPersonnelMasterLookups,
    enabled: activeTab === 'personnel',
  })

  const validateMutation = useMutation({
    mutationFn: validateMasterDataBootstrapBatch,
    onSuccess: async (response) => {
      setFeedback(response.command.message)
      setPromotionResult(null)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['master-data-bootstrap-batches'] }),
        batchId
          ? queryClient.invalidateQueries({ queryKey: ['master-data-bootstrap-detail', batchId] })
          : Promise.resolve(),
        batchId
          ? queryClient.invalidateQueries({ queryKey: ['master-data-bootstrap-readiness', batchId] })
          : Promise.resolve(),
      ])
    },
    onError: (error) => {
      setFeedback(getErrorMessage(error))
      setPromotionResult(null)
    },
  })
  const promoteMutation = useMutation({
    mutationFn: (input: { batchId: string; entity: MasterDataBootstrapEntity }) =>
      input.entity === 'store'
        ? promoteMasterDataBootstrapStores(input.batchId)
        : promoteMasterDataBootstrapPersonnel(input.batchId),
    onSuccess: async (response) => {
      const resultRows = response.data.promotedRows.length
        ? response.data.promotedRows
        : response.data.batch.promotedRows ?? []
      const promotedTrail = resultRows
        .map((row) => [row.rowId, row.promotedEntityId, row.assignmentId].filter(Boolean).join(' / '))
        .join(' · ')
      setFeedback([response.command.message, promotedTrail].filter(Boolean).join(' — '))
      setPromotionResult(response.data)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['master-data-bootstrap-batches'] }),
        batchId
          ? queryClient.invalidateQueries({ queryKey: ['master-data-bootstrap-detail', batchId] })
          : Promise.resolve(),
        batchId
          ? queryClient.invalidateQueries({ queryKey: ['master-data-bootstrap-readiness', batchId] })
          : Promise.resolve(),
      ])
    },
    onError: (error) => {
      setFeedback(getErrorMessage(error))
      setPromotionResult(null)
    },
  })
  const batches = useMemo(() => batchesQuery.data?.items ?? [], [batchesQuery.data?.items])
  const summary = detailQuery.data?.summary ?? null
  const readiness = readinessQuery.data?.summary ?? null
  const readinessRows = readinessQuery.data?.rows.items ?? []
  const rows = detailQuery.data?.rows.items ?? []
  const storeMasterItems = storeMasterQuery.data?.items ?? []
  const personnelMasterItems = personnelMasterQuery.data?.items ?? []
  const pendingStoreCount = storeMasterItems.filter((store) => Boolean(storeDrafts[store.storeId])).length
  const pendingPersonnelCount = personnelMasterItems.filter((personnel) =>
    Boolean(personnelDrafts[personnel.employeeId]),
  ).length
  const isSavingStores = savingStoreIds.size > 0
  const isSavingPersonnel = savingPersonnelIds.size > 0

  function resolveRegionName(regionId: string | null, fallback: string | null) {
    if (!regionId) {
      return fallback
    }

    return storeMasterLookupsQuery.data?.regions.find((region) => region.regionId === regionId)?.regionName ?? fallback
  }

  function mergeStoreMasterPatch(store: StoreMasterItem, patch: StoreMasterPatch): StoreMasterItem {
    const regionId = patch.regionId ?? store.regionId

    return {
      ...store,
      storeType: patch.storeType ?? normalizeStoreType(store.storeType),
      regionId,
      regionName: patch.regionId === undefined ? store.regionName : resolveRegionName(regionId, store.regionName),
      status: patch.status ?? normalizeStoreStatus(store.status),
      kpiImportEnabled: patch.kpiImportEnabled ?? store.kpiImportEnabled,
    }
  }

  function getEffectiveStoreMaster(store: StoreMasterItem) {
    return mergeStoreMasterPatch(store, storeDrafts[store.storeId] ?? {})
  }

  function setStoreSaving(storeId: string, isSaving: boolean) {
    setSavingStoreIds((current) => {
      const next = new Set(current)
      if (isSaving) {
        next.add(storeId)
      } else {
        next.delete(storeId)
      }
      return next
    })
  }

  function clearStoreDraft(storeId: string) {
    setStoreDrafts((current) => {
      const next = { ...current }
      delete next[storeId]
      return next
    })
  }

  function updateStoreDraft(storeId: string, patch: StoreMasterPatch) {
    setStoreDrafts((current) => ({
      ...current,
      [storeId]: {
        ...(current[storeId] ?? {}),
        ...patch,
      },
    }))
  }

  function updateStoreMasterCache(updatedStore: StoreMasterItem) {
    queryClient.setQueriesData<ListResponse<StoreMasterItem>>(
      { queryKey: ['master-data-store-master'] },
      (current) => {
        if (!current) {
          return current
        }

        return {
          ...current,
          items: current.items.map((item) => (item.storeId === updatedStore.storeId ? updatedStore : item)),
        }
      },
    )
  }

  async function submitStoreDrafts() {
    const changedStores = storeMasterItems.filter((store) => Boolean(storeDrafts[store.storeId]))
    if (changedStores.length === 0 || isSavingStores) {
      return
    }

    const invalidStore = changedStores.find((store) => !getEffectiveStoreMaster(store).regionId)
    if (invalidStore) {
      setStoreFeedback(t('adminMasterData.storeRegionRequired'))
      return
    }

    setStoreFeedback(null)
    const results = await Promise.allSettled(
      changedStores.map(async (store) => {
        const nextStore = getEffectiveStoreMaster(store)
        setStoreSaving(store.storeId, true)
        try {
          const response = await updateStoreMasterData({
            storeId: store.storeId,
            storeType: normalizeStoreType(nextStore.storeType),
            regionId: nextStore.regionId ?? '',
            status: normalizeStoreStatus(nextStore.status),
            kpiImportEnabled: nextStore.kpiImportEnabled,
          })
          updateStoreMasterCache(response.data.storeMaster)
          clearStoreDraft(store.storeId)
          return response
        } finally {
          setStoreSaving(store.storeId, false)
        }
      }),
    )
    const failedCount = results.filter((result) => result.status === 'rejected').length
    const savedCount = changedStores.length - failedCount

    setStoreFeedback(
      failedCount > 0
        ? t('adminMasterData.bulkSavePartial', { saved: savedCount, failed: failedCount })
        : t('adminMasterData.bulkSaveSuccess', { count: savedCount }),
    )
    void queryClient.invalidateQueries({ queryKey: ['master-data-store-master'] })
  }

  function mergePersonnelPatch(personnel: PersonnelMasterItem, patch: PersonnelMasterPatch) {
    return {
      ...personnel,
      firstName: patch.firstName ?? personnel.firstName,
      lastName: patch.lastName ?? personnel.lastName,
      externalEmployeeRef: patch.externalEmployeeRef ?? personnel.externalEmployeeRef ?? '',
      employmentStatus: patch.employmentStatus ?? normalizePersonnelStatus(personnel.employmentStatus),
      employmentType: patch.employmentType ?? normalizeEmploymentType(personnel.employmentType),
      hireDate: patch.hireDate ?? dateInputValue(personnel.hireDate),
      storeId: patch.storeId ?? personnel.storeId ?? '',
      positionId: patch.positionId ?? personnel.positionId ?? '',
      assignmentStartDate: patch.assignmentStartDate ?? dateInputValue(personnel.assignmentStartDate ?? personnel.hireDate),
    }
  }

  function getEffectivePersonnel(personnel: PersonnelMasterItem) {
    return mergePersonnelPatch(personnel, personnelDrafts[personnel.employeeId] ?? {})
  }

  function setPersonnelSaving(employeeId: string, isSaving: boolean) {
    setSavingPersonnelIds((current) => {
      const next = new Set(current)
      if (isSaving) {
        next.add(employeeId)
      } else {
        next.delete(employeeId)
      }
      return next
    })
  }

  function clearPersonnelDraft(employeeId: string) {
    setPersonnelDrafts((current) => {
      const next = { ...current }
      delete next[employeeId]
      return next
    })
  }

  function updatePersonnelDraft(employeeId: string, patch: PersonnelMasterPatch) {
    setPersonnelDrafts((current) => ({
      ...current,
      [employeeId]: {
        ...(current[employeeId] ?? {}),
        ...patch,
      },
    }))
  }

  function updatePersonnelMasterCache(updatedPersonnel: PersonnelMasterItem) {
    queryClient.setQueriesData<ListResponse<PersonnelMasterItem>>(
      { queryKey: ['master-data-personnel-master'] },
      (current) => {
        if (!current) {
          return current
        }

        return {
          ...current,
          items: current.items.map((item) =>
            item.employeeId === updatedPersonnel.employeeId ? updatedPersonnel : item,
          ),
        }
      },
    )
  }

  async function submitPersonnelDrafts() {
    const changedPersonnel = personnelMasterItems.filter((personnel) =>
      Boolean(personnelDrafts[personnel.employeeId]),
    )
    if (changedPersonnel.length === 0 || isSavingPersonnel) {
      return
    }

    const missingStore = changedPersonnel.find((personnel) => !getEffectivePersonnel(personnel).storeId)
    if (missingStore) {
      setPersonnelFeedback(t('adminMasterData.personnelStoreRequired'))
      return
    }
    const missingPosition = changedPersonnel.find((personnel) => !getEffectivePersonnel(personnel).positionId)
    if (missingPosition) {
      setPersonnelFeedback(t('adminMasterData.personnelPositionRequired'))
      return
    }

    setPersonnelFeedback(null)
    const results = await Promise.allSettled(
      changedPersonnel.map(async (personnel) => {
        const nextPersonnel = getEffectivePersonnel(personnel)
        setPersonnelSaving(personnel.employeeId, true)
        try {
          const response = await updatePersonnelMasterData({
            employeeId: personnel.employeeId,
            firstName: nextPersonnel.firstName,
            lastName: nextPersonnel.lastName,
            externalEmployeeRef: nextPersonnel.externalEmployeeRef || undefined,
            employmentStatus: normalizePersonnelStatus(nextPersonnel.employmentStatus),
            employmentType: normalizeEmploymentType(nextPersonnel.employmentType),
            hireDate: nextPersonnel.hireDate,
            storeId: nextPersonnel.storeId,
            positionId: nextPersonnel.positionId,
            assignmentStartDate: nextPersonnel.assignmentStartDate || undefined,
          })
          updatePersonnelMasterCache(response.data.personnelMaster)
          clearPersonnelDraft(personnel.employeeId)
          return response
        } finally {
          setPersonnelSaving(personnel.employeeId, false)
        }
      }),
    )
    const failedCount = results.filter((result) => result.status === 'rejected').length
    const savedCount = changedPersonnel.length - failedCount

    setPersonnelFeedback(
      failedCount > 0
        ? t('adminMasterData.bulkSavePartial', { saved: savedCount, failed: failedCount })
        : t('adminMasterData.bulkSaveSuccess', { count: savedCount }),
    )
    void queryClient.invalidateQueries({ queryKey: ['master-data-personnel-master'] })
  }

  if (batchesQuery.isLoading) {
    return <ScreenState title={t('adminMasterData.loadingTitle')} copy={t('adminMasterData.loadingCopy')} />
  }

  if (batchesQuery.isError) {
    return (
      <ScreenState
        title={t('adminMasterData.errorTitle')}
        copy={getErrorMessage(batchesQuery.error)}
        tone="error"
      />
    )
  }

  const tabs: Array<{ id: MasterDataTab; label: string; count?: number }> = [
    { id: 'batches', label: t('adminMasterData.tabBatches'), count: batchesQuery.data?.meta.total },
    { id: 'stores', label: t('adminMasterData.tabStores'), count: storeMasterQuery.data?.meta.total },
    { id: 'personnel', label: t('adminMasterData.tabPersonnel'), count: personnelMasterQuery.data?.meta.total },
    { id: 'history', label: t('adminMasterData.tabHistory') },
  ]
  const promotedRows =
    promotionResult?.promotedRows.length
      ? promotionResult.promotedRows
      : promotionResult?.batch.promotedRows ?? []

  return (
    <section className="master-data-command-page">
      <header className="master-data-command-hero">
        <div>
          <div className="eyebrow">{t('adminMasterData.heroEyebrow')}</div>
          <h2 className="master-data-command-title">{t('adminMasterData.title')}</h2>
          <p className="master-data-command-copy">{t('adminMasterData.heroCopy')}</p>
        </div>
        <div className="master-data-command-hero-actions">
          <span className="master-data-command-chip">{t('adminMasterData.liveMaster')}</span>
          <span className="master-data-command-chip">{t('adminMasterData.backendControlled')}</span>
          <button className="control-button master-data-command-primary-button" type="button">
            {t('adminMasterData.newBatch')}
          </button>
        </div>
      </header>

      <section className="master-data-command-metrics" aria-label={t('adminMasterData.summaryAria')}>
        <MasterDataMetric
          icon={<DatabaseZap size={18} />}
          title={t('adminMasterData.batchMetric')}
          value={formatNumber(batchesQuery.data?.meta.total ?? 0)}
          note={t('adminMasterData.batchMetricNote')}
          tone="primary"
        />
        <MasterDataMetric
          icon={<Building2 size={18} />}
          title={t('adminMasterData.storeMetric')}
          value={
            storeMasterQuery.data?.meta.total === undefined
              ? '—'
              : formatNumber(storeMasterQuery.data.meta.total)
          }
          note={
            storeMasterQuery.data?.meta.total === undefined
              ? t('adminMasterData.openTabForCount')
              : t('adminMasterData.storeMetricNote')
          }
        />
        <MasterDataMetric
          icon={<UserRound size={18} />}
          title={t('adminMasterData.personnelMetric')}
          value={
            personnelMasterQuery.data?.meta.total === undefined
              ? '—'
              : formatNumber(personnelMasterQuery.data.meta.total)
          }
          note={
            personnelMasterQuery.data?.meta.total === undefined
              ? t('adminMasterData.openTabForCount')
              : t('adminMasterData.personnelMetricNote')
          }
        />
        <MasterDataMetric
          icon={<History size={18} />}
          title={t('adminMasterData.auditMetric')}
          value="Audit"
          note={t('adminMasterData.auditMetricNote')}
        />
      </section>

      {feedback ? (
        <section className="master-data-command-feedback">
          <div className="inline-state inline-state-accent">{feedback}</div>
          {promotedRows.length ? (
            <div className="master-data-command-evidence-meta" aria-label={t('adminMasterData.promotionCommandResultAria')}>
              {promotedRows.map((row) => (
                <span className="master-data-command-chip" key={row.rowId}>
                  {t('adminMasterData.promotedRow')}: {row.rowId} / {row.promotedEntityId}
                  {row.assignmentId ? ` / ${row.assignmentId}` : ''}
                </span>
              ))}
            </div>
          ) : null}
        </section>
      ) : null}

      <nav className="master-data-command-tabs" aria-label={t('adminMasterData.tabsAria')}>
        {tabs.map((tab) => (
          <button
            className={`master-data-command-tab${activeTab === tab.id ? ' master-data-command-tab-active' : ''}`}
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
          >
            <strong>{tab.label}</strong>
            {tab.count !== undefined ? <span>{formatNumber(tab.count)}</span> : null}
          </button>
        ))}
      </nav>

      {activeTab === 'batches' ? (
        <section className="master-data-command-panel" aria-label={t('adminMasterData.batchesTabAria')}>
          <div className="master-data-command-panel-head">
            <div>
              <div className="eyebrow">{t('adminMasterData.reviewQueue')}</div>
              <h3>{t('adminMasterData.bootstrapBatches')}</h3>
              <p className="master-data-command-panel-copy">{t('adminMasterData.reviewQueueCopy')}</p>
            </div>
            <div className="master-data-command-toolbar">
              <label className="search-field master-data-command-search">
                <Search size={16} />
                <span className="sr-only">{t('adminMasterData.searchBatches')}</span>
                <input
                  value={batchSearch}
                  onChange={(event) => setBatchSearch(event.target.value)}
                  placeholder={t('adminMasterData.searchPlaceholder')}
                />
              </label>
              <label className="control-select">
                <span className="sr-only">{t('adminMasterData.entityFilter')}</span>
                <select
                  value={entityFilter}
                  onChange={(event) => setEntityFilter(event.target.value as MasterDataBootstrapEntityFilter)}
                >
                  <option value="all">{t('adminMasterData.allEntities')}</option>
                  <option value="store">{t('adminMasterData.stores')}</option>
                  <option value="personnel">{t('adminMasterData.personnel')}</option>
                </select>
              </label>
              <label className="control-select">
                <span className="sr-only">{t('adminMasterData.readinessFilter')}</span>
                <select
                  value={readinessFilter}
                  onChange={(event) =>
                    setReadinessFilter(event.target.value as MasterDataBootstrapReadinessFilter)
                  }
                >
                  <option value="all">{t('adminMasterData.allReadiness')}</option>
                  <option value="needs_validation">{t('adminMasterData.needsValidation')}</option>
                  <option value="needs_review">{t('adminMasterData.needsReview')}</option>
                  <option value="ready_to_promote">{t('adminMasterData.readyToPromote')}</option>
                  <option value="closed">{t('adminMasterData.closed')}</option>
                </select>
              </label>
            </div>
          </div>

          {batches.length === 0 ? (
            <EmptyState
              title={t('adminMasterData.emptyBatchesTitle')}
              copy={t('adminMasterData.emptyBatchesCopy')}
            />
          ) : (
            <div className="master-data-command-list">
              {batches.map((batch) => (
                <Link className="master-data-command-row-link" key={batch.batchId} to={`/admin/master-data/${batch.batchId}`}>
                  <div>
                    <strong>{batch.sourceLabel}</strong>
                    <small>{batch.batchId}</small>
                  </div>
                  <span>{formatMasterDataEntity(batch.bootstrapEntity, t)}</span>
                  <span>{t('adminMasterData.rowsSuffix', { count: batch.rowCount })}</span>
                  <MasterDataPill tone={mapReadinessTone(batch.readiness ?? batch.batchStatus)}>
                    {formatMasterDataState(batch.readiness ?? batch.batchStatus, t)}
                  </MasterDataPill>
                  <span>{batch.fileReference ?? t('adminMasterData.noFileReference')}</span>
                  <span>{formatDateTime(getBatchDisplayTimestamp(batch), locale)}</span>
                  <span className="master-data-command-row-action">
                    {t('adminMasterData.openEvidence')} <ArrowRight size={15} />
                  </span>
                </Link>
              ))}
            </div>
          )}

          {batchId ? (
            <BatchDetailPanel
              batchId={batchId}
              detailLoading={detailQuery.isLoading}
              detailError={detailQuery.error}
              detailIsError={detailQuery.isError}
              readinessLoading={readinessQuery.isLoading}
              readinessError={readinessQuery.error}
              readinessIsError={readinessQuery.isError}
              summary={summary}
              readiness={readiness}
              readinessRows={readinessRows}
              rows={rows}
              validating={validateMutation.isPending}
              promoting={promoteMutation.isPending}
              onValidate={() => validateMutation.mutate(batchId)}
              onPromote={() => {
                if (!summary) {
                  return
                }
                promoteMutation.mutate({
                  batchId,
                  entity: summary.bootstrapEntity,
                })
              }}
            />
          ) : null}
        </section>
      ) : null}

      {activeTab === 'stores' ? (
        <section className="master-data-command-panel" aria-label={t('adminMasterData.storeTabAria')}>
          <div className="master-data-command-panel-head">
            <div>
              <div className="eyebrow">{t('adminMasterData.tabStores')}</div>
              <h3>{t('adminMasterData.storePanelTitle')}</h3>
              <p className="master-data-command-panel-copy">{t('adminMasterData.storePanelCopy')}</p>
            </div>
            <div className="master-data-command-toolbar">
              <label className="search-field master-data-command-search">
                <Search size={16} />
                <span className="sr-only">{t('adminMasterData.searchStores')}</span>
                <input
                  value={storeSearch}
                  onChange={(event) => {
                    setStoreSearch(event.target.value)
                    setStoreOffset(0)
                  }}
                  placeholder={t('adminMasterData.searchStoreOrManager')}
                />
              </label>
              <label className="control-select">
                <span className="sr-only">{t('adminMasterData.filterStoreImportScope')}</span>
                <select
                  value={storeEnabledFilter}
                  onChange={(event) => {
                    setStoreEnabledFilter(event.target.value as 'all' | 'enabled' | 'disabled')
                    setStoreOffset(0)
                  }}
                >
                  <option value="all">{t('adminMasterData.allStores')}</option>
                  <option value="enabled">{t('adminMasterData.included')}</option>
                  <option value="disabled">{t('adminMasterData.excluded')}</option>
                </select>
              </label>
              <label className="control-select">
                <span className="sr-only">{t('adminMasterData.filterStoreStatus')}</span>
                <select
                  value={storeStatusFilter}
                  onChange={(event) => {
                    setStoreStatusFilter(event.target.value as 'all' | StoreMasterStatus)
                    setStoreOffset(0)
                  }}
                >
                  <option value="all">{t('adminMasterData.allStatuses')}</option>
                  <option value="active">{t('adminMasterData.storeStatus.active')}</option>
                  <option value="inactive">{t('adminMasterData.storeStatus.inactive')}</option>
                  <option value="closed">{t('adminMasterData.storeStatus.closed')}</option>
                </select>
              </label>
            </div>
          </div>

          {storeFeedback ? <div className="master-data-command-feedback">{storeFeedback}</div> : null}
          {storeMasterQuery.isLoading || storeMasterLookupsQuery.isLoading ? (
            <div className="inline-state inline-state-neutral">{t('adminMasterData.loadingStoreMaster')}</div>
          ) : storeMasterQuery.isError ? (
            <ScreenState title={t('adminMasterData.errorTitle')} copy={getErrorMessage(storeMasterQuery.error)} tone="error" />
          ) : storeMasterItems.length === 0 ? (
            <EmptyState title={t('adminMasterData.noStoresTitle')} copy={t('adminMasterData.noStoresCopy')} />
          ) : (
            <>
              <MasterDataBulkSaveBar
                disabled={pendingStoreCount === 0 || isSavingStores}
                isSaving={isSavingStores}
                pendingCount={pendingStoreCount}
                t={t}
                onSave={() => void submitStoreDrafts()}
              />
              <div className="master-data-command-table-wrap">
                <table className="master-data-command-table">
                  <thead>
                    <tr>
                      <th>{t('adminMasterData.store')}</th>
                      <th>{t('adminMasterData.type')}</th>
                      <th>{t('adminMasterData.regionalManager')}</th>
                      <th>{t('adminMasterData.status')}</th>
                      <th>{t('adminMasterData.kpiImport')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {storeMasterItems.map((store) => {
                      const effectiveStore = getEffectiveStoreMaster(store)
                      const saving = savingStoreIds.has(store.storeId)
                      return (
                        <tr key={store.storeId}>
                          <td>
                            <strong>{store.storeName}</strong>
                            <small>{store.storeCode}</small>
                          </td>
                          <td>
                            <select
                              aria-label={t('adminMasterData.storeTypeAria', { storeName: store.storeName })}
                              className="master-data-command-row-control"
                              disabled={saving}
                              value={normalizeStoreType(effectiveStore.storeType)}
                              onChange={(event) =>
                                updateStoreDraft(store.storeId, { storeType: normalizeStoreType(event.target.value) })
                              }
                            >
                              <option value="company">{t('adminMasterData.storeType.company')}</option>
                              <option value="franchise">{t('adminMasterData.storeType.franchise')}</option>
                              <option value="operator">{t('adminMasterData.storeType.operator')}</option>
                            </select>
                          </td>
                          <td>
                            <select
                              aria-label={t('adminMasterData.storeRegionalManagerAria', { storeName: store.storeName })}
                              className="master-data-command-row-control"
                              disabled={saving}
                              value={effectiveStore.regionId ?? ''}
                              onChange={(event) => updateStoreDraft(store.storeId, { regionId: event.target.value })}
                            >
                              {storeMasterLookupsQuery.data?.regions.length === 0 ? (
                                <option value="">{t('adminMasterData.noActiveRegionalManagers')}</option>
                              ) : null}
                              {storeMasterLookupsQuery.data?.regions.map((region) => (
                                <option key={region.regionId} value={region.regionId}>
                                  {region.regionName}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td>
                            <select
                              aria-label={t('adminMasterData.storeStatusAria', { storeName: store.storeName })}
                              className="master-data-command-row-control"
                              disabled={saving}
                              value={normalizeStoreStatus(effectiveStore.status)}
                              onChange={(event) =>
                                updateStoreDraft(store.storeId, { status: normalizeStoreStatus(event.target.value) })
                              }
                            >
                              <option value="active">{t('adminMasterData.storeStatus.active')}</option>
                              <option value="inactive">{t('adminMasterData.storeStatus.inactive')}</option>
                              <option value="closed">{t('adminMasterData.storeStatus.closed')}</option>
                            </select>
                          </td>
                          <td>
                            <label className="master-data-command-toggle">
                              <input
                                aria-label={t('adminMasterData.storeKpiImportEnabledAria', { storeName: store.storeName })}
                                checked={effectiveStore.kpiImportEnabled}
                                disabled={saving}
                                type="checkbox"
                                onChange={(event) =>
                                  updateStoreDraft(store.storeId, {
                                    kpiImportEnabled: event.target.checked,
                                  })
                                }
                              />
                              <span>
                                {effectiveStore.kpiImportEnabled
                                  ? t('adminMasterData.included')
                                  : t('adminMasterData.excluded')}
                              </span>
                            </label>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              <MasterDataPager
                offset={storeOffset}
                total={storeMasterQuery.data?.meta.total ?? 0}
                onPrevious={() => setStoreOffset(Math.max(0, storeOffset - PAGE_SIZE))}
                onNext={() => setStoreOffset(storeOffset + PAGE_SIZE)}
              />
            </>
          )}
        </section>
      ) : null}

      {activeTab === 'personnel' ? (
        <section className="master-data-command-panel" aria-label={t('adminMasterData.personnelTabAria')}>
          <div className="master-data-command-panel-head">
            <div>
              <div className="eyebrow">{t('adminMasterData.tabPersonnel')}</div>
              <h3>{t('adminMasterData.personnelPanelTitle')}</h3>
              <p className="master-data-command-panel-copy">{t('adminMasterData.personnelPanelCopy')}</p>
            </div>
            <div className="master-data-command-toolbar">
              <label className="search-field master-data-command-search">
                <Search size={16} />
                <span className="sr-only">{t('adminMasterData.searchPersonnel')}</span>
                <input
                  value={personnelSearch}
                  onChange={(event) => {
                    setPersonnelSearch(event.target.value)
                    setPersonnelOffset(0)
                  }}
                  placeholder={t('adminMasterData.searchPersonnelPlaceholder')}
                />
              </label>
              <label className="control-select">
                <span className="sr-only">{t('adminMasterData.filterPersonnelStatus')}</span>
                <select
                  value={personnelStatusFilter}
                  onChange={(event) => {
                    setPersonnelStatusFilter(event.target.value as 'all' | PersonnelStatus)
                    setPersonnelOffset(0)
                  }}
                >
                  <option value="all">{t('adminMasterData.allStatuses')}</option>
                  <option value="active">{t('adminMasterData.employmentStatus.active')}</option>
                  <option value="inactive">{t('adminMasterData.employmentStatus.inactive')}</option>
                  <option value="terminated">{t('adminMasterData.employmentStatus.terminated')}</option>
                </select>
              </label>
              <label className="control-select">
                <span className="sr-only">{t('adminMasterData.filterPersonnelStore')}</span>
                <select
                  value={personnelStoreFilter}
                  onChange={(event) => {
                    setPersonnelStoreFilter(event.target.value)
                    setPersonnelOffset(0)
                  }}
                >
                  <option value="all">{t('adminMasterData.allStores')}</option>
                  {personnelMasterLookupsQuery.data?.stores.map((store) => (
                    <option key={store.storeId} value={store.storeId}>
                      {store.storeName}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          {personnelFeedback ? <div className="master-data-command-feedback">{personnelFeedback}</div> : null}
          {personnelMasterQuery.isLoading || personnelMasterLookupsQuery.isLoading ? (
            <div className="inline-state inline-state-neutral">{t('adminMasterData.loadingPersonnelMaster')}</div>
          ) : personnelMasterQuery.isError ? (
            <ScreenState title={t('adminMasterData.errorTitle')} copy={getErrorMessage(personnelMasterQuery.error)} tone="error" />
          ) : personnelMasterItems.length === 0 ? (
            <EmptyState title={t('adminMasterData.noPersonnelTitle')} copy={t('adminMasterData.noPersonnelCopy')} />
          ) : (
            <>
              <MasterDataBulkSaveBar
                disabled={pendingPersonnelCount === 0 || isSavingPersonnel}
                isSaving={isSavingPersonnel}
                pendingCount={pendingPersonnelCount}
                t={t}
                onSave={() => void submitPersonnelDrafts()}
              />
              <div className="master-data-command-table-wrap">
                <table className="master-data-command-table master-data-command-personnel-table">
                  <thead>
                    <tr>
                      <th>{t('adminMasterData.employee')}</th>
                      <th>{t('adminMasterData.sellerCode')}</th>
                      <th>{t('adminMasterData.store')}</th>
                      <th>{t('adminMasterData.position')}</th>
                      <th>{t('adminMasterData.employment')}</th>
                      <th>{t('adminMasterData.assignmentStart')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {personnelMasterItems.map((personnel) => {
                      const effectivePersonnel = getEffectivePersonnel(personnel)
                      const saving = savingPersonnelIds.has(personnel.employeeId)
                      return (
                        <tr key={personnel.employeeId}>
                          <td>
                            <div className="master-data-command-name-grid">
                              <input
                                aria-label={t('adminMasterData.firstName')}
                                className="master-data-command-row-control"
                                disabled={saving}
                                value={effectivePersonnel.firstName}
                                onChange={(event) =>
                                  updatePersonnelDraft(personnel.employeeId, { firstName: event.target.value })
                                }
                              />
                              <input
                                aria-label={t('adminMasterData.lastName')}
                                className="master-data-command-row-control"
                                disabled={saving}
                                value={effectivePersonnel.lastName}
                                onChange={(event) =>
                                  updatePersonnelDraft(personnel.employeeId, { lastName: event.target.value })
                                }
                              />
                            </div>
                          </td>
                          <td>
                            <input
                              aria-label={t('adminMasterData.sellerCode')}
                              className="master-data-command-row-control"
                              disabled={saving}
                              value={effectivePersonnel.externalEmployeeRef ?? ''}
                              onChange={(event) =>
                                updatePersonnelDraft(personnel.employeeId, {
                                  externalEmployeeRef: event.target.value,
                                })
                              }
                            />
                          </td>
                          <td>
                            <select
                              className="master-data-command-row-control"
                              disabled={saving}
                              value={effectivePersonnel.storeId}
                              onChange={(event) =>
                                updatePersonnelDraft(personnel.employeeId, { storeId: event.target.value })
                              }
                            >
                              <option value="">{t('adminMasterData.allStores')}</option>
                              {personnelMasterLookupsQuery.data?.stores.map((store) => (
                                <option key={store.storeId} value={store.storeId}>
                                  {store.storeName}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td>
                            <select
                              className="master-data-command-row-control"
                              disabled={saving}
                              value={effectivePersonnel.positionId}
                              onChange={(event) =>
                                updatePersonnelDraft(personnel.employeeId, { positionId: event.target.value })
                              }
                            >
                              <option value="">{t('adminMasterData.position')}</option>
                              {personnelMasterLookupsQuery.data?.positions.map((position) => (
                                <option key={position.positionId} value={position.positionId}>
                                  {position.positionName}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td>
                            <div className="master-data-command-name-grid">
                              <select
                                className="master-data-command-row-control"
                                disabled={saving}
                                value={normalizePersonnelStatus(effectivePersonnel.employmentStatus)}
                                onChange={(event) =>
                                  updatePersonnelDraft(personnel.employeeId, {
                                    employmentStatus: normalizePersonnelStatus(event.target.value),
                                  })
                                }
                              >
                                <option value="active">{t('adminMasterData.employmentStatus.active')}</option>
                                <option value="inactive">{t('adminMasterData.employmentStatus.inactive')}</option>
                                <option value="terminated">{t('adminMasterData.employmentStatus.terminated')}</option>
                              </select>
                              <select
                                className="master-data-command-row-control"
                                disabled={saving}
                                value={normalizeEmploymentType(effectivePersonnel.employmentType)}
                                onChange={(event) =>
                                  updatePersonnelDraft(personnel.employeeId, {
                                    employmentType: normalizeEmploymentType(event.target.value),
                                  })
                                }
                              >
                                <option value="full_time">{t('adminMasterData.employmentType.full_time')}</option>
                                <option value="part_time">{t('adminMasterData.employmentType.part_time')}</option>
                                <option value="temporary">{t('adminMasterData.employmentType.temporary')}</option>
                              </select>
                            </div>
                          </td>
                          <td>
                            <div className="master-data-command-name-grid">
                              <input
                                aria-label={t('adminMasterData.hireDate')}
                                className="master-data-command-row-control"
                                disabled={saving}
                                type="date"
                                value={dateInputValue(effectivePersonnel.hireDate)}
                                onChange={(event) =>
                                  updatePersonnelDraft(personnel.employeeId, { hireDate: event.target.value })
                                }
                              />
                              <input
                                aria-label={t('adminMasterData.assignmentStart')}
                                className="master-data-command-row-control"
                                disabled={saving}
                                type="date"
                                value={dateInputValue(effectivePersonnel.assignmentStartDate)}
                                onChange={(event) =>
                                  updatePersonnelDraft(personnel.employeeId, {
                                    assignmentStartDate: event.target.value,
                                  })
                                }
                              />
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              <MasterDataPager
                offset={personnelOffset}
                total={personnelMasterQuery.data?.meta.total ?? 0}
                onPrevious={() => setPersonnelOffset(Math.max(0, personnelOffset - PAGE_SIZE))}
                onNext={() => setPersonnelOffset(personnelOffset + PAGE_SIZE)}
              />
            </>
          )}
        </section>
      ) : null}

      {activeTab === 'history' ? (
        <section className="master-data-command-panel" aria-label={t('adminMasterData.historyTabAria')}>
          <div className="master-data-command-panel-head">
            <div>
              <div className="eyebrow">{t('adminMasterData.tabHistory')}</div>
              <h3>{t('adminMasterData.historyPanelTitle')}</h3>
              <p className="master-data-command-panel-copy">{t('adminMasterData.historyPanelCopy')}</p>
            </div>
          </div>
          <div className="master-data-command-history">
            <MasterDataHistoryRow label={t('adminMasterData.historyStoreEvent')} eventType="store_master_data.updated" />
            <MasterDataHistoryRow label={t('adminMasterData.historyPersonnelEvent')} eventType="personnel_master_data.updated" />
            <MasterDataHistoryRow label={t('adminMasterData.historyBootstrapEvent')} eventType="master_data_bootstrap.promoted" />
          </div>
        </section>
      ) : null}
    </section>
  )
}

function MasterDataMetric(input: {
  icon: ReactNode
  title: string
  value: string
  note: string
  tone?: 'primary'
}) {
  return (
    <article className={`master-data-command-metric${input.tone === 'primary' ? ' master-data-command-metric-primary' : ''}`}>
      <div className="master-data-command-metric-icon">{input.icon}</div>
      <span>{input.title}</span>
      <strong>{input.value}</strong>
      <p>{input.note}</p>
    </article>
  )
}

function MasterDataPill(input: { children: ReactNode; tone?: 'accent' | 'calm' | 'warning' | 'danger' | 'neutral' }) {
  return (
    <span className={`master-data-command-pill master-data-command-pill-${input.tone ?? 'neutral'}`}>
      {input.children}
    </span>
  )
}

function MasterDataPager(input: {
  offset: number
  total: number
  onPrevious: () => void
  onNext: () => void
}) {
  const { t } = useLocalization()
  const from = input.total === 0 ? 0 : input.offset + 1
  const to = Math.min(input.offset + PAGE_SIZE, input.total)

  return (
    <div className="master-data-command-pager">
      <span>
        {formatNumber(from)}-{formatNumber(to)} / {formatNumber(input.total)}
      </span>
      <div>
        <button className="control-button" type="button" disabled={input.offset === 0} onClick={input.onPrevious}>
          {t('adminIntegrations.previous')}
        </button>
        <button
          className="control-button"
          type="button"
          disabled={input.offset + PAGE_SIZE >= input.total}
          onClick={input.onNext}
        >
          {t('adminIntegrations.next')}
        </button>
      </div>
    </div>
  )
}

function MasterDataBulkSaveBar(input: {
  disabled: boolean
  isSaving: boolean
  pendingCount: number
  t: TranslateFunction
  onSave: () => void
}) {
  return (
    <div className="master-data-command-bulk-actions">
      <span>{input.t('adminMasterData.pendingChanges', { count: input.pendingCount })}</span>
      <button
        className="control-button master-data-command-primary-button"
        disabled={input.disabled}
        type="button"
        onClick={input.onSave}
      >
        <Save size={16} />
        {input.isSaving ? input.t('adminMasterData.saving') : input.t('adminMasterData.saveChanges')}
      </button>
    </div>
  )
}

function MasterDataHistoryRow(input: { label: string; eventType: string }) {
  return (
    <div className="master-data-command-history-row">
      <span>Audit</span>
      <strong>{input.label}</strong>
      <MasterDataPill tone="accent">{input.eventType}</MasterDataPill>
    </div>
  )
}

function getBatchDisplayTimestamp(batch: MasterDataBootstrapBatchItem) {
  return batch.updatedAt ?? batch.promotedAt ?? batch.validatedAt ?? batch.createdAt
}

function BatchDetailPanel(input: {
  batchId: string
  detailLoading: boolean
  detailError: unknown
  detailIsError: boolean
  readinessLoading: boolean
  readinessError: unknown
  readinessIsError: boolean
  summary: MasterDataBootstrapBatchDetail['summary'] | null
  readiness: MasterDataBootstrapPromotionReadinessResponse['summary'] | null
  readinessRows: MasterDataBootstrapPromotionReadinessResponse['rows']['items']
  rows: MasterDataBootstrapRow[]
  validating: boolean
  promoting: boolean
  onValidate: () => void
  onPromote: () => void
}) {
  const { t } = useLocalization()

  if (input.detailLoading || input.readinessLoading) {
    return (
      <ScreenState
        title={t('adminMasterData.detailLoadingTitle')}
        copy={t('adminMasterData.detailLoadingCopy')}
      />
    )
  }

  if (input.detailIsError) {
    return (
      <ScreenState
        title={t('adminMasterData.batchUnavailableTitle')}
        copy={getErrorMessage(input.detailError)}
        tone="error"
      />
    )
  }

  if (input.readinessIsError) {
    return (
      <ScreenState
        title={t('adminMasterData.readinessUnavailableTitle')}
        copy={getErrorMessage(input.readinessError)}
        tone="error"
      />
    )
  }

  if (!input.summary || !input.readiness) {
    return (
      <ScreenState
        title={t('adminMasterData.batchUnavailableTitle')}
        copy={t('adminMasterData.missingEvidenceCopy')}
        tone="error"
      />
    )
  }

  const promoteLabel =
    input.summary.bootstrapEntity === 'store'
      ? t('adminMasterData.promoteStores')
      : t('adminMasterData.promotePersonnel')
  const promotedLabel = `${input.summary.promotedCount} / ${input.summary.rowCount}`

  return (
    <section className="master-data-command-detail">
      <div className="master-data-command-metrics master-data-command-detail-metrics">
        <MasterDataMetric
          title={t('adminMasterData.readyRows')}
          value={formatNumber(input.readiness.readyCount)}
          note={t('adminMasterData.nextAction', {
            action: formatMasterDataState(input.readiness.nextAction, t),
          })}
          icon={<ListChecks size={18} />}
          tone="primary"
        />
        <MasterDataMetric
          title={t('adminMasterData.promotedRows')}
          value={formatNumber(input.summary.promotedCount)}
          note={promotedLabel}
          icon={<ShieldCheck size={18} />}
        />
        <MasterDataMetric
          title={t('adminMasterData.needsValidationMetric')}
          value={formatNumber(input.readiness.needsValidationCount)}
          note={formatMasterDataState(input.readiness.nextAction, t)}
          icon={<DatabaseZap size={18} />}
        />
        <MasterDataMetric
          title={t('adminMasterData.blockedRows')}
          value={formatNumber(input.readiness.blockedCount + input.readiness.needsReviewCount)}
          note={formatMasterDataState(input.readiness.nextAction, t)}
          icon={<CheckCircle2 size={18} />}
        />
      </div>

      <section className="master-data-command-split">
        <article className="master-data-command-card">
          <div className="master-data-command-card-head">
            <div>
              <div className="eyebrow">{t('adminMasterData.selectedBatch')}</div>
              <h4>{input.summary.sourceLabel}</h4>
            </div>
            <MasterDataPill tone={mapReadinessTone(input.readiness.nextAction)}>
              {formatMasterDataState(input.readiness.nextAction, t)}
            </MasterDataPill>
          </div>
          <div className="master-data-command-key-grid">
            <KeyTile label={t('adminMasterData.batch')} value={input.batchId} />
            <KeyTile label={t('adminMasterData.entity')} value={formatMasterDataEntity(input.summary.bootstrapEntity, t)} />
            <KeyTile label={t('adminMasterData.status')} value={formatMasterDataState(input.summary.batchStatus, t)} />
            <KeyTile
              label={t('adminMasterData.readiness')}
              value={input.readiness.canPromote ? t('adminMasterData.canPromote') : t('adminMasterData.blocked')}
            />
            <KeyTile label={t('adminMasterData.promotedRows')} value={promotedLabel} />
            <KeyTile label={t('adminMasterData.file')} value={input.summary.fileReference ?? t('adminMasterData.noFileReference')} />
          </div>
        </article>

        <article className="master-data-command-card">
          <div className="master-data-command-card-head">
            <div>
              <div className="eyebrow">{t('adminMasterData.actions')}</div>
              <h4>{t('adminMasterData.commandPanelTitle')}</h4>
            </div>
          </div>
          <p>{t('adminMasterData.commandPanelCopy')}</p>
          <div className="master-data-command-toolbar">
            <button
              className="control-button master-data-command-primary-button"
              type="button"
              disabled={input.validating}
              onClick={input.onValidate}
            >
              {input.validating ? t('adminMasterData.validating') : t('adminMasterData.validateBatch')}
            </button>
            <button
              className="control-button master-data-command-primary-button"
              type="button"
              disabled={!input.readiness.canPromote || input.promoting}
              onClick={input.onPromote}
            >
              {input.promoting ? t('adminMasterData.promoting') : promoteLabel}
            </button>
          </div>
          {!input.readiness.canPromote ? (
            <div className="inline-state inline-state-warning">
              {t('adminMasterData.promotionDisabled')}
            </div>
          ) : null}
        </article>
      </section>

      <EvidenceList
        ariaLabel={t('adminMasterData.promotionDryRunEvidenceAria')}
        eyebrow={t('adminMasterData.dryRun')}
        title={t('adminMasterData.dryRunTitle')}
        copy={t('adminMasterData.dryRunCopy')}
        emptyCopy={t('adminMasterData.dryRunEmpty')}
        rows={input.readinessRows.map((row) => ({
          key: row.rowId,
          title: `#${row.rowNumber} ${resolveDryRunRowLabel(row)}`,
          pill: formatMasterDataState(row.promotionReadiness, t),
          tone: mapPromotionReadinessTone(row.promotionReadiness),
          chips: [
            [t('adminMasterData.storeCode'), row.sourceStoreCode],
            [t('adminMasterData.employeeCode'), row.sourceEmployeeCode],
            [t('adminMasterData.promotedEntity'), row.promotedEntityId],
            [t('adminMasterData.blockReason'), row.blockReason],
          ],
        }))}
      />

      <EvidenceList
        ariaLabel={t('adminMasterData.bootstrapRowEvidenceAria')}
        eyebrow={t('adminMasterData.rowEvidence')}
        title={t('adminMasterData.rowEvidenceTitle')}
        emptyCopy={t('adminMasterData.rowEvidenceEmpty')}
        rows={input.rows.map((row) => ({
          key: row.rowId,
          title: `#${row.rowNumber} ${resolveRowName(row)}`,
          pill: formatMasterDataState(row.validationStatus, t),
          tone: mapValidationTone(row.validationStatus),
          copy: row.issueMessage,
          chips: [
            [t('adminMasterData.storeCode'), row.sourceStoreCode],
            [t('adminMasterData.employeeCode'), row.sourceEmployeeCode],
            [t('adminMasterData.resolvedStore'), row.resolvedStoreId],
            [t('adminMasterData.resolvedEmployee'), row.resolvedEmployeeId],
            [t('adminMasterData.resolvedPosition'), row.resolvedPositionId],
            [t('adminMasterData.promotedEntity'), row.promotedEntityId],
          ],
        }))}
      />
    </section>
  )
}

function KeyTile(input: { label: string; value: string }) {
  return (
    <div className="master-data-command-key-tile">
      <span>{input.label}</span>
      <strong>{input.value}</strong>
    </div>
  )
}

function EvidenceList(input: {
  ariaLabel: string
  eyebrow: string
  title: string
  copy?: string
  emptyCopy: string
  rows: Array<{
    key: string
    title: string
    pill: string
    tone: 'accent' | 'calm' | 'warning' | 'danger' | 'neutral'
    copy?: string | null
    chips: Array<[string, string | null | undefined]>
  }>
}) {
  const { t } = useLocalization()

  return (
    <section className="master-data-command-card" aria-label={input.ariaLabel}>
      <div className="master-data-command-card-head">
        <div>
          <div className="eyebrow">{input.eyebrow}</div>
          <h4>{input.title}</h4>
          {input.copy ? <p>{input.copy}</p> : null}
        </div>
      </div>
      {input.rows.length === 0 ? (
        <EmptyState copy={input.emptyCopy} />
      ) : (
        <div className="master-data-command-evidence-list">
          {input.rows.map((row) => (
            <div className="master-data-command-evidence-row" key={row.key}>
              <div className="master-data-command-evidence-row-head">
                <strong>{row.title}</strong>
                <MasterDataPill tone={row.tone}>{row.pill}</MasterDataPill>
              </div>
              {row.copy ? <p>{row.copy}</p> : null}
              <div className="master-data-command-evidence-meta">
                {row.chips.map(([label, value]) => (
                  <span className="master-data-command-chip" key={`${row.key}-${label}`}>
                    {label}: <code>{value ?? t('adminMasterData.notResolved')}</code>
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

function resolveRowName(row: MasterDataBootstrapRow) {
  const firstName = readPayloadString(row.normalizedPayload, 'normalizedFirstName')
  const lastName = readPayloadString(row.normalizedPayload, 'normalizedLastName')
  const storeName = readPayloadString(row.normalizedPayload, 'normalizedStoreName')
  const parts = [firstName, lastName].filter(Boolean)

  return parts.length > 0 ? parts.join(' ') : storeName ?? row.sourceStoreCode ?? row.rowId
}

function readPayloadString(payload: Record<string, unknown>, key: string) {
  const value = payload[key]
  return typeof value === 'string' && value.trim() ? value : null
}

function resolveDryRunRowLabel(
  row: MasterDataBootstrapPromotionReadinessResponse['rows']['items'][number],
) {
  return row.sourceEmployeeCode ?? row.sourceStoreCode ?? row.rowId
}

function formatMasterDataEntity(entity: MasterDataBootstrapEntity, t: TranslateFunction) {
  switch (entity) {
    case 'store':
      return t('adminMasterData.entity.store')
    case 'personnel':
      return t('adminMasterData.entity.personnel')
    default:
      return entity
  }
}

function formatMasterDataState(value: string, t: TranslateFunction) {
  switch (value) {
    case 'ready_to_promote':
      return t('adminMasterData.status.ready_to_promote')
    case 'promote_ready_rows':
      return t('adminMasterData.status.promote_ready_rows')
    case 'closed':
      return t('adminMasterData.status.closed')
    case 'promoted':
      return t('adminMasterData.status.promoted')
    case 'already_closed':
      return t('adminMasterData.status.already_closed')
    case 'needs_review':
      return t('adminMasterData.status.needs_review')
    case 'review_rows':
      return t('adminMasterData.status.review_rows')
    case 'needs_validation':
      return t('adminMasterData.status.needs_validation')
    case 'blocked':
      return t('adminMasterData.status.blocked')
    case 'ready':
      return t('adminMasterData.status.ready')
    case 'already_promoted':
      return t('adminMasterData.status.already_promoted')
    case 'waiting_batch':
      return t('adminMasterData.status.waiting_batch')
    case 'valid':
      return t('adminMasterData.status.valid')
    case 'pending':
      return t('adminMasterData.status.pending')
    case 'invalid':
      return t('adminMasterData.status.invalid')
    default:
      return value
  }
}

function mapPromotionReadinessTone(value: string) {
  if (value === 'ready') {
    return 'accent'
  }
  if (value === 'already_promoted') {
    return 'calm'
  }
  if (value === 'needs_validation' || value === 'needs_review' || value === 'waiting_batch') {
    return 'warning'
  }
  if (value === 'blocked') {
    return 'danger'
  }

  return 'neutral'
}

function mapReadinessTone(value: MasterDataBootstrapReadiness | string) {
  if (value === 'ready_to_promote' || value === 'promote_ready_rows' || value === 'can promote') {
    return 'accent'
  }
  if (value === 'closed' || value === 'promoted' || value === 'already_closed') {
    return 'calm'
  }
  if (value === 'needs_review' || value === 'review_rows' || value === 'needs_validation') {
    return 'warning'
  }
  if (value === 'blocked') {
    return 'danger'
  }

  return 'neutral'
}

function mapValidationTone(value: string) {
  if (value === 'promoted' || value === 'valid') {
    return 'calm'
  }
  if (value === 'needs_review' || value === 'pending') {
    return 'warning'
  }
  if (value === 'invalid') {
    return 'danger'
  }

  return 'neutral'
}
