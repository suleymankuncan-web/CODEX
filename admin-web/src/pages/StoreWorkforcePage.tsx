import { useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import {
  BriefcaseBusiness,
  ClipboardList,
  Clock3,
  LogOut,
  RotateCcw,
  Search,
  UserMinus,
  UserPlus,
  UsersRound,
} from 'lucide-react'
import type { AuthSessionSummary } from '../features/auth/api'
import { getActionStoreIds } from '../features/auth/authorization'
import { useLocalization } from '../features/localization/useLocalization'
import {
  createOffboardingRequest,
  createSellerCodeRequest,
  getOffboardingRequests,
  getPositionOptions,
  getSellerCodeRequests,
  getStoreEmployees,
  resubmitOffboardingRequest,
  resubmitSellerCodeRequest,
  type OffboardingRequest,
  type SellerCodeRequest,
} from '../features/workforce/api'
import { formatDateTime, formatNumber, getErrorMessage } from '../lib/format'
import { StoreRequestFeedback } from './store-approvals-atoms'
import { OffboardingRequestForm } from './store-approvals-offboarding-form'
import { ReturnedRequestsPanel } from './store-approvals-returned-panel'
import { SellerCodeRequestForm } from './store-approvals-seller-code-form'
import { createStoreApprovalsPageState, storeApprovalsPageReducer } from './store-approvals-model'
import {
  buildWorkforceRequestSummaries,
  deriveWorkforceSummary,
  isClosedWorkforceStatus,
} from './store-workforce-model'
import {
  PersonnelMobileCard,
  PersonnelTableRow,
  StoreWorkforceMetricCard,
  StoreWorkforcePanel,
  StoreWorkforceTh,
  StoreWorkforceTenureGrid,
  WorkforceBarRow,
} from './store-workforce-store-manager-presentation'
import {
  getPersonnelRowStatus,
  getRequestStatusClass,
  getWorkforceRequestStatusLabel,
  isPendingOffboardingApprovalStatus,
} from './store-workforce-store-manager-view-model'
import {
  StoreEmptyState,
  StoreErrorState,
  StoreSectionCard,
  StoreSurfaceHeader,
  StoreSurfacePage,
} from './store-surface-primitives'
import { RegionWorkforceView } from './store-workforce-region-view'

type WorkforceMode = 'region' | 'store'
type WorkforcePanel = 'personnel' | 'sellerCodeRequest' | 'offboardingRequest' | 'returnedRequests'

function resolveWorkforceMode(authSummary: AuthSessionSummary | null): WorkforceMode {
  const roles = authSummary?.user.roleCodes ?? []
  return roles.includes('REGION_MANAGER') ? 'region' : 'store'
}

export function StoreWorkforcePage(input: {
  authSummary: AuthSessionSummary | null
}) {
  const mode = resolveWorkforceMode(input.authSummary)

  if (mode === 'region') {
    return <RegionWorkforceView authSummary={input.authSummary} />
  }

  return <StoreManagerWorkforce authSummary={input.authSummary} />
}

function StoreManagerWorkforce(input: {
  authSummary: AuthSessionSummary | null
}) {
  const queryClient = useQueryClient()
  const { locale, t } = useLocalization()
  const [searchParams] = useSearchParams()
  const storeIds = getActionStoreIds(input.authSummary)
  const requestedStoreId = searchParams.get('storeId')?.trim() ?? ''
  const storeId = storeIds.includes(requestedStoreId) ? requestedStoreId : (storeIds[0] ?? '')
  const now = useMemo(() => new Date(), [])
  const loadedHandoffRef = useRef<string | null>(null)
  const [activePanel, setActivePanel] = useState<WorkforcePanel>('personnel')
  const [personnelSearch, setPersonnelSearch] = useState('')
  const [positionFilter, setPositionFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [state, dispatch] = useReducer(
    storeApprovalsPageReducer,
    {
      defaultTargetLabel: t('storeApprovals.targetLabelDefault'),
      initialPanel: 'sellerCodeRequest',
    },
    createStoreApprovalsPageState,
  )

  const scopeKey = [
    'store-workforce',
    (input.authSummary?.user.roleCodes ?? []).join('|'),
    storeIds.join('|'),
    storeId,
  ].join(':')
  const enabled = Boolean(storeId)
  const storeEmployeesQuery = useQuery({
    queryKey: ['workforce-store-employees', 'store-workforce', scopeKey],
    queryFn: () => getStoreEmployees(storeId),
    enabled,
  })
  const positionOptionsQuery = useQuery({
    queryKey: ['workforce-position-options', 'store-workforce', scopeKey],
    queryFn: () => getPositionOptions(storeId),
    enabled,
  })
  const sellerCodeRequestsQuery = useQuery({
    queryKey: ['seller-code-requests', 'store-workforce', scopeKey],
    queryFn: () => getSellerCodeRequests(),
    enabled,
  })
  const offboardingRequestsQuery = useQuery({
    queryKey: ['offboarding-requests', 'store-workforce', scopeKey],
    queryFn: () => getOffboardingRequests(),
    enabled,
  })

  const employees = useMemo(() => storeEmployeesQuery.data?.items ?? [], [storeEmployeesQuery.data?.items])
  const sellerCodeRequests = useMemo(
    () => sellerCodeRequestsQuery.data?.items.filter((item) => item.storeId === storeId) ?? [],
    [sellerCodeRequestsQuery.data?.items, storeId],
  )
  const offboardingRequests = useMemo(
    () => offboardingRequestsQuery.data?.items.filter((item) => item.storeId === storeId) ?? [],
    [offboardingRequestsQuery.data?.items, storeId],
  )
  const returnedSellerCodeRequests = sellerCodeRequests.filter((item) => item.status === 'rejected')
  const returnedOffboardingRequests = offboardingRequests.filter((item) => item.status === 'rejected')
  const requests = buildWorkforceRequestSummaries({
    offboardingRequests,
    sellerCodeRequests,
  })
  const openMovementCount = requests.filter((item) => !isClosedWorkforceStatus(item.status)).length
  const workforceSummary = deriveWorkforceSummary(employees, now, locale)
  const positionOptions = useMemo(
    () => Array.from(new Set(employees.map((item) => item.positionName).filter(Boolean))).sort(),
    [employees],
  )
  const openOffboardingEmployeeIds = useMemo(
    () =>
      new Set(
        offboardingRequests
          .filter((item) => isPendingOffboardingApprovalStatus(item.status) && item.employeeId)
          .map((item) => item.employeeId as string),
      ),
    [offboardingRequests],
  )
  const visibleEmployees = useMemo(() => {
    const normalizedSearch = personnelSearch.trim().toLocaleLowerCase('tr-TR')

    return employees.filter((employee) => {
      const haystack = [
        employee.displayName,
        employee.externalEmployeeRef ?? '',
        employee.positionName,
      ].join(' ').toLocaleLowerCase('tr-TR')
      const matchesSearch = normalizedSearch === '' || haystack.includes(normalizedSearch)
      const matchesPosition = positionFilter === 'all' || employee.positionName === positionFilter
      const status = getPersonnelRowStatus(employee, openOffboardingEmployeeIds)
      const matchesStatus = statusFilter === 'all' || status.kind === statusFilter

      return matchesSearch && matchesPosition && matchesStatus
    })
  }, [employees, openOffboardingEmployeeIds, personnelSearch, positionFilter, statusFilter])
  const sellerCodeMutation = useMutation({
    mutationFn: createSellerCodeRequest,
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ['seller-code-requests'] })
      dispatch({ type: 'resetSellerRequestSuccess', message: result.command.message })
    },
  })
  const resubmitSellerCodeMutation = useMutation({
    mutationFn: resubmitSellerCodeRequest,
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ['seller-code-requests'] })
      dispatch({ type: 'resetSellerRequestSuccess', message: result.command.message })
    },
  })
  const offboardingMutation = useMutation({
    mutationFn: createOffboardingRequest,
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ['offboarding-requests'] })
      void queryClient.invalidateQueries({ queryKey: ['workforce-store-employees'] })
      dispatch({ type: 'resetOffboardingRequestSuccess', message: result.command.message })
    },
  })
  const resubmitOffboardingMutation = useMutation({
    mutationFn: resubmitOffboardingRequest,
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ['offboarding-requests'] })
      void queryClient.invalidateQueries({ queryKey: ['workforce-store-employees'] })
      dispatch({ type: 'resetOffboardingRequestSuccess', message: result.command.message })
    },
  })
  const canSubmitSellerCodeRequest =
    Boolean(storeId) &&
    Boolean(state.sellerFirstName.trim()) &&
    Boolean(state.sellerLastName.trim()) &&
    /^[0-9]{11}$/.test(state.sellerNationalId.trim()) &&
    Boolean(state.sellerPhoneNumber.trim()) &&
    Boolean(state.sellerHireDate) &&
    Boolean(state.sellerPositionId.trim())
  const canSubmitOffboardingRequest =
    Boolean(storeId) &&
    Boolean(state.offboardingEmployeeId.trim()) &&
    Boolean(state.offboardingTerminationDate) &&
    Boolean(state.offboardingRequestReason.trim())
  const sellerRequestPending = sellerCodeMutation.isPending || resubmitSellerCodeMutation.isPending
  const offboardingRequestPending = offboardingMutation.isPending || resubmitOffboardingMutation.isPending

  const submitSellerCodeRequest = () => {
    const trimmedSellerRequestReason = state.sellerRequestReason.trim()
    const payload = {
      firstName: state.sellerFirstName.trim(),
      lastName: state.sellerLastName.trim(),
      nationalId: state.sellerNationalId.trim(),
      phoneNumber: state.sellerPhoneNumber.trim(),
      hireDate: state.sellerHireDate,
      requestedPositionId: state.sellerPositionId.trim(),
      employmentType: state.sellerEmploymentType,
      ...(trimmedSellerRequestReason ? { requestReason: trimmedSellerRequestReason } : {}),
    }

    if (state.editingSellerRequestId) {
      resubmitSellerCodeMutation.mutate({
        requestId: state.editingSellerRequestId,
        ...payload,
      })
      return
    }

    sellerCodeMutation.mutate({
      storeId,
      requestType: 'create_code',
      ...payload,
    })
  }
  const submitOffboardingRequest = () => {
    const requestReason = state.offboardingRequestReason.trim()
    const payload = {
      employeeId: state.offboardingEmployeeId,
      terminationDate: state.offboardingTerminationDate,
      terminationReason: requestReason.slice(0, 80),
      requestReason,
    }

    if (state.editingOffboardingRequestId) {
      resubmitOffboardingMutation.mutate({
        requestId: state.editingOffboardingRequestId,
        ...payload,
      })
      return
    }

    offboardingMutation.mutate({
      storeId,
      ...payload,
    })
  }
  const startEditingSellerRequest = (item: SellerCodeRequest) => {
    dispatch({
      type: 'loadSellerRequestEdit',
      item,
      notice: item.reviewNote
        ? t('storeApprovals.returnedSellerLoadedWithNote', { note: item.reviewNote })
        : t('storeApprovals.returnedSellerLoaded'),
    })
    setActivePanel('sellerCodeRequest')
  }
  const startEditingOffboardingRequest = (item: OffboardingRequest) => {
    dispatch({
      type: 'loadOffboardingRequestEdit',
      item,
      notice: item.reviewNote
        ? t('storeApprovals.returnedOffboardingLoadedWithNote', { note: item.reviewNote })
        : t('storeApprovals.returnedOffboardingLoaded'),
    })
    setActivePanel('offboardingRequest')
  }
  const handoffRequestType = searchParams.get('requestType')
  const handoffRequestId = searchParams.get('requestId')

  useEffect(() => {
    if (!handoffRequestType || !handoffRequestId) {
      return
    }

    const handoffKey = `${handoffRequestType}:${handoffRequestId}`

    if (loadedHandoffRef.current === handoffKey) {
      return
    }

    if (handoffRequestType === 'sellerCode') {
      const item = returnedSellerCodeRequests.find(
        (request) => request.requestId === handoffRequestId,
      )

      if (item) {
        loadedHandoffRef.current = handoffKey
        queueMicrotask(() => {
          dispatch({
            type: 'loadSellerRequestEdit',
            item,
            notice: item.reviewNote
              ? t('storeApprovals.returnedSellerLoadedWithNote', { note: item.reviewNote })
              : t('storeApprovals.returnedSellerLoaded'),
          })
          setActivePanel('sellerCodeRequest')
        })
        return
      }
    }

    if (handoffRequestType === 'offboarding') {
      const item = returnedOffboardingRequests.find(
        (request) => request.requestId === handoffRequestId,
      )

      if (item) {
        loadedHandoffRef.current = handoffKey
        queueMicrotask(() => {
          dispatch({
            type: 'loadOffboardingRequestEdit',
            item,
            notice: item.reviewNote
              ? t('storeApprovals.returnedOffboardingLoadedWithNote', { note: item.reviewNote })
              : t('storeApprovals.returnedOffboardingLoaded'),
          })
          setActivePanel('offboardingRequest')
        })
        return
      }
    }

    if (sellerCodeRequestsQuery.isFetched && offboardingRequestsQuery.isFetched) {
      loadedHandoffRef.current = handoffKey
      queueMicrotask(() => setActivePanel('returnedRequests'))
    }
  }, [
    handoffRequestId,
    handoffRequestType,
    offboardingRequestsQuery.isFetched,
    returnedOffboardingRequests,
    returnedSellerCodeRequests,
    sellerCodeRequestsQuery.isFetched,
    t,
  ])

  if (!storeId) {
    return (
      <StoreSurfacePage
        ariaLabel={t('storeWorkforce.title')}
        className="tw:mx-auto tw:w-full tw:max-w-7xl"
        testId="store-workforce-page"
      >
        <StoreSurfaceHeader
          eyebrow={t('storeWorkforce.eyebrow')}
          title={t('storeWorkforce.title')}
          description={t('storeWorkforce.missingActionStoreCopy')}
        />
        <StoreEmptyState
          title={t('storeWorkforce.missingActionStoreTitle')}
          titleAsHeading
          description={t('storeWorkforce.missingActionStoreCopy')}
        />
      </StoreSurfacePage>
    )
  }

  if (storeEmployeesQuery.isLoading && !storeEmployeesQuery.data) {
    return (
      <StoreSurfacePage
        ariaLabel={t('storeWorkforce.title')}
        className="tw:mx-auto tw:w-full tw:max-w-7xl"
        testId="store-workforce-page"
      >
        <StoreSurfaceHeader
          eyebrow={t('storeWorkforce.eyebrow')}
          title={t('storeWorkforce.title')}
          description={t('storeWorkforce.storeManagerDescription')}
        />
        <StoreSectionCard title={t('storeWorkforce.personnelLoadingTitle')}>
          <StoreRequestFeedback tone="success">
            {t('storeWorkforce.personnelLoadingCopy')}
          </StoreRequestFeedback>
        </StoreSectionCard>
      </StoreSurfacePage>
    )
  }

  return (
    <StoreSurfacePage
      ariaLabel={t('storeWorkforce.title')}
      ariaLabelledBy="store-workforce-title"
      className="tw:mx-auto tw:w-full tw:max-w-7xl"
      testId="store-workforce-page"
    >
      <div className="tw:flex tw:flex-col tw:gap-3 tw:md:flex-row tw:md:items-center tw:md:justify-between">
        <div className="tw:flex tw:min-w-0 tw:items-center tw:gap-3">
          <span className="tw:grid tw:size-11 tw:shrink-0 tw:place-items-center tw:rounded-2xl tw:bg-[#efe9ff] tw:text-[#6847ff]">
            <UsersRound className="tw:size-5" />
          </span>
          <div className="tw:min-w-0">
            <h1
              id="store-workforce-title"
              className="tw:text-[30px] tw:font-semibold tw:leading-none tw:tracking-normal tw:text-[#071333] tw:md:text-[34px]"
            >
              {t('storeWorkforce.title')}
            </h1>
            <p className="tw:mt-2 tw:max-w-3xl tw:text-sm tw:leading-5 tw:text-[#647194]">
              {t('storeWorkforce.storeManagerDescription')}
            </p>
          </div>
        </div>
      </div>

      <div
        className="tw:grid tw:gap-3 tw:md:grid-cols-2 tw:xl:grid-cols-4"
        aria-label={t('storeWorkforce.summaryAria')}
      >
        <StoreWorkforceMetricCard
          icon={<UsersRound className="tw:size-5" />}
          iconClassName="tw:bg-[#dffaff] tw:text-[#00aabd]"
          title={t('storeWorkforce.personnelScope')}
          value={formatNumber(employees.length, locale)}
          note={t('storeWorkforce.personnelScopeNote')}
        />
        <StoreWorkforceMetricCard
          icon={<Clock3 className="tw:size-5" />}
          iconClassName="tw:bg-[#efe9ff] tw:text-[#6847ff]"
          title={t('storeWorkforce.averageTenure')}
          value={workforceSummary.averageTenureLabel}
          note={workforceSummary.missingTenureCount > 0
            ? t('storeWorkforce.averageTenureMissing', {
              count: workforceSummary.missingTenureCount,
            })
            : t('storeWorkforce.averageTenureNote')}
        />
        <StoreWorkforceMetricCard
          icon={<BriefcaseBusiness className="tw:size-5" />}
          iconClassName="tw:bg-[#fff1d9] tw:text-[#f59e0b]"
          title={t('storeWorkforce.normActual')}
          value={t('storeWorkforce.valueNotConfigured')}
          note={t('storeWorkforce.normActualHonestNote')}
        />
        <StoreWorkforceMetricCard
          icon={<ClipboardList className="tw:size-5" />}
          iconClassName="tw:bg-[#ffe4ec] tw:text-[#f43f6d]"
          title={t('storeWorkforce.openMovements')}
          value={formatNumber(openMovementCount, locale)}
          note={t('storeWorkforce.openMovementsNote')}
        />
      </div>

      <div className="tw:grid tw:gap-4 tw:xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="tw:min-w-0">
          <div className="tw:mb-3 tw:grid tw:gap-2.5 tw:rounded-[1.25rem] tw:border tw:border-[#dfe6f3] tw:bg-white/80 tw:p-2.5 tw:shadow-[0_18px_48px_rgba(58,75,118,0.10)] tw:backdrop-blur tw:md:grid-cols-[minmax(220px,1fr)_190px_180px]">
            <label className="tw:flex tw:min-h-11 tw:items-center tw:gap-2 tw:rounded-2xl tw:border tw:border-[#dfe6f3] tw:bg-white/90 tw:px-3">
              <Search className="tw:size-4 tw:text-[#647194]" />
              <input
                className="tw:min-w-0 tw:flex-1 tw:border-0 tw:bg-transparent tw:text-sm tw:font-medium tw:text-[#071333] tw:outline-none tw:placeholder:text-[#7c88a6]"
                value={personnelSearch}
                aria-label="Personel ara"
                placeholder="Personel ara"
                onChange={(event) => setPersonnelSearch(event.target.value)}
              />
            </label>
            <label className="tw:flex tw:min-h-11 tw:items-center tw:gap-2 tw:rounded-2xl tw:border tw:border-[#dfe6f3] tw:bg-white/90 tw:px-3">
              <BriefcaseBusiness className="tw:size-4 tw:text-[#647194]" />
              <select
                className="tw:min-w-0 tw:flex-1 tw:border-0 tw:bg-transparent tw:text-sm tw:font-medium tw:text-[#071333] tw:outline-none"
                value={positionFilter}
                aria-label="Pozisyon filtresi"
                onChange={(event) => setPositionFilter(event.target.value)}
              >
                <option value="all">Tüm pozisyonlar</option>
                {positionOptions.map((position) => (
                  <option key={position} value={position}>{position}</option>
                ))}
              </select>
            </label>
            <label className="tw:flex tw:min-h-11 tw:items-center tw:gap-2 tw:rounded-2xl tw:border tw:border-[#dfe6f3] tw:bg-white/90 tw:px-3">
              <ClipboardList className="tw:size-4 tw:text-[#647194]" />
              <select
                className="tw:min-w-0 tw:flex-1 tw:border-0 tw:bg-transparent tw:text-sm tw:font-medium tw:text-[#071333] tw:outline-none"
                value={statusFilter}
                aria-label="Durum filtresi"
                onChange={(event) => setStatusFilter(event.target.value)}
              >
                <option value="all">Tüm durumlar</option>
                <option value="active">Aktif</option>
                <option value="codeWaiting">Kod bekliyor</option>
                <option value="offboarding">Çıkış talebi</option>
              </select>
            </label>
          </div>

          <section
            className="tw:overflow-hidden tw:rounded-[1.375rem] tw:border tw:border-[#dfe6f3] tw:bg-white/85 tw:shadow-[0_24px_70px_rgba(58,75,118,0.14)] tw:backdrop-blur"
            data-testid="store-workforce-personnel-list"
          >
            <div className="tw:flex tw:flex-col tw:gap-3 tw:border-b tw:border-[#dfe6f3] tw:px-4 tw:py-4 tw:md:flex-row tw:md:items-start tw:md:justify-between">
              <div>
                <h2 className="tw:text-[19px] tw:font-semibold tw:tracking-normal tw:text-[#071333]">
                  {t('storeWorkforce.personnelListTitle')}
                </h2>
                <p className="tw:mt-1 tw:text-sm tw:leading-5 tw:text-[#647194]">
                  {t('storeWorkforce.personnelListDescription')}
                </p>
              </div>
              <div className="tw:flex tw:flex-wrap tw:gap-2">
                <button
                  className="tw:inline-flex tw:h-9 tw:items-center tw:justify-center tw:gap-2 tw:rounded-[13px] tw:bg-gradient-to-br tw:from-[#6847ff] tw:to-[#355cff] tw:px-3 tw:text-sm tw:font-semibold tw:text-white tw:shadow-[0_12px_24px_rgba(104,71,255,0.22)]"
                  type="button"
                  onClick={() => setActivePanel('sellerCodeRequest')}
                >
                  <UserPlus className="tw:size-4" />
                  Yeni personel
                </button>
                <button
                  className="tw:inline-flex tw:h-9 tw:items-center tw:justify-center tw:gap-2 tw:rounded-[13px] tw:border tw:border-[#cfc5ff] tw:bg-white tw:px-3 tw:text-sm tw:font-semibold tw:text-[#5534e6]"
                  type="button"
                  onClick={() => setActivePanel('offboardingRequest')}
                >
                  <LogOut className="tw:size-4" />
                  Çıkış talebi
                </button>
              </div>
            </div>

            {storeEmployeesQuery.isError ? (
              <div className="tw:p-4">
                <StoreErrorState
                  title={t('storeWorkforce.personnelErrorTitle')}
                  description={getErrorMessage(storeEmployeesQuery.error)}
                />
              </div>
            ) : employees.length === 0 ? (
              <div className="tw:p-4">
                <StoreEmptyState
                  title={t('storeWorkforce.personnelEmptyTitle')}
                  titleAsHeading
                  description={t('storeWorkforce.personnelEmptyCopy')}
                />
              </div>
            ) : (
              <>
                <div className="tw:hidden tw:md:block">
                  <table className="tw:w-full tw:table-fixed tw:border-collapse">
                    <colgroup>
                      <col className="tw:w-[26%]" />
                      <col className="tw:w-[17%]" />
                      <col className="tw:w-[13%]" />
                      <col className="tw:w-[12%]" />
                      <col className="tw:w-[16%]" />
                      <col className="tw:w-[16%]" />
                    </colgroup>
                    <thead>
                      <tr className="tw:bg-[#f4f7fc]/90">
                        <StoreWorkforceTh>Personel</StoreWorkforceTh>
                        <StoreWorkforceTh>Pozisyon</StoreWorkforceTh>
                        <StoreWorkforceTh>Giriş tarihi</StoreWorkforceTh>
                        <StoreWorkforceTh>Kıdem</StoreWorkforceTh>
                        <StoreWorkforceTh>Kod durumu</StoreWorkforceTh>
                        <StoreWorkforceTh>Durum</StoreWorkforceTh>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleEmployees.map((employee) => (
                        <PersonnelTableRow
                          key={employee.employeeId}
                          employee={employee}
                          locale={locale}
                          now={now}
                          openOffboardingEmployeeIds={openOffboardingEmployeeIds}
                          t={t}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="tw:grid tw:gap-2.5 tw:p-3 tw:md:hidden">
                  {visibleEmployees.map((employee) => (
                    <PersonnelMobileCard
                      key={employee.employeeId}
                      employee={employee}
                      locale={locale}
                      now={now}
                      openOffboardingEmployeeIds={openOffboardingEmployeeIds}
                      t={t}
                    />
                  ))}
                </div>
              </>
            )}
          </section>
        </div>

        <div className="tw:flex tw:min-w-0 tw:flex-col tw:gap-4">
          <StoreWorkforcePanel
            title={t('storeWorkforce.positionDistributionTitle')}
            description={t('storeWorkforce.positionDistributionDescription')}
            badge={t('storeWorkforce.personnelListBadge', { count: employees.length })}
            badgeClassName="tw:rounded-full tw:bg-[#dffaff] tw:px-2.5 tw:py-1 tw:text-xs tw:font-semibold tw:text-[#00889b]"
          >
            {workforceSummary.positionRows.length === 0 ? (
              <StoreEmptyState
                title={t('storeWorkforce.positionDistributionEmptyTitle')}
                titleAsHeading
                description={t('storeWorkforce.positionDistributionEmptyCopy')}
              />
            ) : (
              <div className="tw:grid tw:gap-3">
                {workforceSummary.positionRows.map((row, index) => (
                  <WorkforceBarRow
                    key={row.label}
                    label={row.label}
                    value={row.count}
                    max={Math.max(1, employees.length)}
                    index={index}
                    locale={locale}
                  />
                ))}
              </div>
            )}
          </StoreWorkforcePanel>

          <StoreWorkforcePanel
            title={t('storeWorkforce.tenureBucketsTitle')}
            description={t('storeWorkforce.tenureBucketsDescription')}
            badge={workforceSummary.averageTenureLabel}
            badgeClassName="tw:rounded-full tw:bg-[#efe9ff] tw:px-2.5 tw:py-1 tw:text-xs tw:font-semibold tw:text-[#5534e6]"
          >
            <StoreWorkforceTenureGrid
              items={workforceSummary.tenureBuckets.map((bucket) => ({
                label: bucket.label,
                value: formatNumber(bucket.count, locale),
              }))}
            />
          </StoreWorkforcePanel>

          <StoreWorkforcePanel
            title={t('storeWorkforce.requestCenterTitle')}
            description={t('storeWorkforce.requestCenterDescription')}
            badge={t('storeWorkforce.requestCenterBadge', { count: openMovementCount })}
            badgeClassName={openMovementCount > 0
              ? 'tw:rounded-full tw:bg-[#fff1d9] tw:px-2.5 tw:py-1 tw:text-xs tw:font-semibold tw:text-[#a35a00]'
              : 'tw:rounded-full tw:bg-[#f4f7fc] tw:px-2.5 tw:py-1 tw:text-xs tw:font-semibold tw:text-[#465272]'}
          >
            {sellerCodeRequestsQuery.isError || offboardingRequestsQuery.isError ? (
              <div className="tw:flex tw:flex-col tw:gap-2">
                {sellerCodeRequestsQuery.isError ? (
                  <StoreRequestFeedback tone="error">
                    {getErrorMessage(sellerCodeRequestsQuery.error)}
                  </StoreRequestFeedback>
                ) : null}
                {offboardingRequestsQuery.isError ? (
                  <StoreRequestFeedback tone="error">
                    {getErrorMessage(offboardingRequestsQuery.error)}
                  </StoreRequestFeedback>
                ) : null}
              </div>
            ) : requests.length === 0 ? (
              <StoreEmptyState
                title={t('storeWorkforce.requestsEmptyTitle')}
                titleAsHeading
                description={t('storeWorkforce.requestsEmptyCopy')}
              />
            ) : (
              <div className="tw:grid tw:gap-2">
                {requests.slice(0, 6).map((request) => (
                  <article
                    key={request.key}
                    className="tw:rounded-2xl tw:border tw:border-[#e4eaf5] tw:bg-white/70 tw:p-2.5"
                  >
                    <div className="tw:flex tw:items-start tw:justify-between tw:gap-2">
                      <div className="tw:min-w-0">
                        <strong className="tw:block tw:truncate tw:text-sm tw:font-semibold tw:text-[#071333]">
                          {request.title}
                        </strong>
                        <span className="tw:mt-0.5 tw:block tw:truncate tw:text-xs tw:text-[#647194]">
                          {request.subtitle}
                        </span>
                      </div>
                      <span className={getRequestStatusClass(request.status)}>
                        <span className="tw:size-1.5 tw:rounded-full tw:bg-current" />
                        {getWorkforceRequestStatusLabel(request.status)}
                      </span>
                    </div>
                    <span className="tw:mt-2 tw:block tw:text-xs tw:font-medium tw:text-[#647194]">
                      {formatDateTime(request.updatedAt, locale)}
                    </span>
                  </article>
                ))}
              </div>
            )}
          </StoreWorkforcePanel>

          <StoreWorkforcePanel
            title={t('storeWorkforce.requestActionTitle')}
            description={t('storeWorkforce.requestActionDescription')}
            testId="store-workforce-request-workbench"
          >
            <ToggleGroup
              aria-label={t('storeWorkforce.requestActionAria')}
              className="store-approvals-action-tabs tw:mb-3"
              type="single"
              value={activePanel}
              onValueChange={(value) => {
                if (value) setActivePanel(value as WorkforcePanel)
              }}
            >
              <ToggleGroupItem
                className="store-approvals-action-tab"
                value="personnel"
                aria-label={t('storeWorkforce.openPersonnelPanel')}
              >
                {t('storeWorkforce.openPersonnelPanel')}
              </ToggleGroupItem>
              <ToggleGroupItem
                className="store-approvals-action-tab"
                value="sellerCodeRequest"
                aria-label={t('storeApprovals.openSellerCodeRequest')}
              >
                <UserPlus size={14} />
                {t('storeApprovals.openSellerCodeRequest')}
              </ToggleGroupItem>
              <ToggleGroupItem
                className="store-approvals-action-tab"
                value="offboardingRequest"
                aria-label={t('storeApprovals.openOffboardingRequest')}
              >
                <UserMinus size={14} />
                {t('storeApprovals.openOffboardingRequest')}
              </ToggleGroupItem>
              <ToggleGroupItem
                className="store-approvals-action-tab"
                value="returnedRequests"
                aria-label={t('storeApprovals.openReturnedRequests')}
              >
                <RotateCcw size={14} />
                {t('storeApprovals.openReturnedRequests')}
              </ToggleGroupItem>
            </ToggleGroup>

            {activePanel === 'personnel' ? (
              <StoreEmptyState
                title={t('storeWorkforce.personnelActionTitle')}
                titleAsHeading
                description={t('storeWorkforce.personnelActionCopy')}
              />
            ) : null}
            {activePanel === 'sellerCodeRequest' ? (
              <SellerCodeRequestForm
                access={{
                  createAllowed: enabled,
                  submitAllowed: canSubmitSellerCodeRequest,
                }}
                editingRequestId={state.editingSellerRequestId}
                errors={{
                  create: sellerCodeMutation.error,
                  createVisible: sellerCodeMutation.isError,
                  resubmit: resubmitSellerCodeMutation.error,
                  resubmitVisible: resubmitSellerCodeMutation.isError,
                }}
                onCancelEdit={() => dispatch({ type: 'cancelSellerRequestEdit' })}
                onEmploymentTypeChange={(value) =>
                  dispatch({ type: 'setSellerEmploymentType', value })
                }
                onFirstNameChange={(value) => dispatch({ type: 'setSellerFirstName', value })}
                onHireDateChange={(value) => dispatch({ type: 'setSellerHireDate', value })}
                onLastNameChange={(value) => dispatch({ type: 'setSellerLastName', value })}
                onNationalIdChange={(value) => dispatch({ type: 'setSellerNationalId', value })}
                onPhoneNumberChange={(value) => dispatch({ type: 'setSellerPhoneNumber', value })}
                onPositionIdChange={(value) => dispatch({ type: 'setSellerPositionId', value })}
                onRequestReasonChange={(value) =>
                  dispatch({ type: 'setSellerRequestReason', value })
                }
                onSubmit={submitSellerCodeRequest}
                positionOptionsQuery={positionOptionsQuery}
                sellerEmploymentType={state.sellerEmploymentType}
                sellerFirstName={state.sellerFirstName}
                sellerHireDate={state.sellerHireDate}
                sellerLastName={state.sellerLastName}
                sellerNationalId={state.sellerNationalId}
                sellerPhoneNumber={state.sellerPhoneNumber}
                sellerPositionId={state.sellerPositionId}
                sellerRequestReason={state.sellerRequestReason}
                submission={{
                  notice: state.sellerRequestNotice,
                  pending: sellerRequestPending,
                }}
                storeId={storeId}
                t={t}
              />
            ) : null}
            {activePanel === 'offboardingRequest' ? (
              <OffboardingRequestForm
                access={{
                  createAllowed: enabled,
                  submitAllowed: canSubmitOffboardingRequest,
                }}
                editingRequestId={state.editingOffboardingRequestId}
                errors={{
                  create: offboardingMutation.error,
                  createVisible: offboardingMutation.isError,
                  resubmit: resubmitOffboardingMutation.error,
                  resubmitVisible: resubmitOffboardingMutation.isError,
                }}
                offboardingEmployeeId={state.offboardingEmployeeId}
                offboardingRequestReason={state.offboardingRequestReason}
                offboardingTerminationDate={state.offboardingTerminationDate}
                onCancelEdit={() => dispatch({ type: 'cancelOffboardingRequestEdit' })}
                onEmployeeIdChange={(value) =>
                  dispatch({ type: 'setOffboardingEmployeeId', value })
                }
                onRequestReasonChange={(value) =>
                  dispatch({ type: 'setOffboardingRequestReason', value })
                }
                onSubmit={submitOffboardingRequest}
                onTerminationDateChange={(value) =>
                  dispatch({ type: 'setOffboardingTerminationDate', value })
                }
                submission={{
                  notice: state.offboardingNotice,
                  pending: offboardingRequestPending,
                }}
                storeEmployeesQuery={storeEmployeesQuery}
                t={t}
              />
            ) : null}
            {activePanel === 'returnedRequests' ? (
              <ReturnedRequestsPanel
                locale={locale}
                returnedOffboardingRequests={returnedOffboardingRequests}
                returnedSellerCodeRequests={returnedSellerCodeRequests}
                sellerCodeRequestsError={sellerCodeRequestsQuery.error}
                hasSellerCodeRequestsError={sellerCodeRequestsQuery.isError}
                offboardingRequestsError={offboardingRequestsQuery.error}
                hasOffboardingRequestsError={offboardingRequestsQuery.isError}
                onEditOffboardingRequest={startEditingOffboardingRequest}
                onEditSellerCodeRequest={startEditingSellerRequest}
                t={t}
              />
            ) : null}
          </StoreWorkforcePanel>
        </div>
      </div>
    </StoreSurfacePage>
  )
}
