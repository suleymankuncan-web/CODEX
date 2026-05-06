import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, Clock3, ReceiptText, ShieldCheck } from 'lucide-react'
import { Link } from 'react-router-dom'
import {
  EmptyState,
  KeyValue,
  MetricAccent,
  MetricCard,
  ScreenState,
  StatusPill,
} from '../components/dashboard-primitives'
import type { AuthSessionSummary } from '../features/auth/api'
import {
  canCreateTargetDistributionRequest,
  canListTargetDistributionRequests,
  getAssignedStoreIds,
  getReadStoreIds,
} from '../features/auth/authorization'
import { getDisplayRoleCodes } from '../features/auth/display'
import type { TranslateFunction, TranslationKey } from '../features/localization/dictionary'
import { useLocalization } from '../features/localization/useLocalization'
import {
  createTargetDistributionRequest,
  getStoreTargetingPersonnel,
  getTargetDistributionRequests,
  type TargetDistributionAllocation,
} from '../features/targets/api'
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
  type SellerEmploymentType,
} from '../features/workforce/api'
import { formatDate, formatDateTime, formatNumber, formatState, getErrorMessage } from '../lib/format'

const approvalStatusLabelKeys = {
  approved: 'storeApprovals.status.approved',
  pending_hr_approval: 'storeApprovals.status.pending_hr_approval',
  pending_region_approval: 'storeApprovals.status.pending_region_approval',
  rejected: 'storeApprovals.status.rejected',
} as const satisfies Partial<Record<string, TranslationKey>>

const employmentTypeLabelKeys = {
  full_time: 'storeApprovals.employment.full_time',
  part_time: 'storeApprovals.employment.part_time',
  temporary: 'storeApprovals.employment.temporary',
} as const satisfies Record<SellerEmploymentType, TranslationKey>

const roleLabelKeys = {
  REGION_APPROVER: 'storeApprovals.role.REGION_APPROVER',
  REPORT_VIEWER: 'storeApprovals.role.REPORT_VIEWER',
  STORE_MANAGER: 'storeApprovals.role.STORE_MANAGER',
  STORE_PERSONNEL: 'storeApprovals.role.STORE_PERSONNEL',
  SUPER_ADMIN: 'storeApprovals.role.SUPER_ADMIN',
} as const satisfies Partial<Record<string, TranslationKey>>

function formatApprovalStatus(status: string, t: TranslateFunction) {
  const key = approvalStatusLabelKeys[status as keyof typeof approvalStatusLabelKeys]
  return key ? t(key) : formatState(status)
}

function formatEmploymentType(type: SellerEmploymentType, t: TranslateFunction) {
  return t(employmentTypeLabelKeys[type])
}

function formatRole(roleCode: string, t: TranslateFunction) {
  const key = roleLabelKeys[roleCode as keyof typeof roleLabelKeys]
  return key ? t(key) : formatState(roleCode)
}

function formatRoles(
  roleCodes: readonly string[] | null | undefined,
  t: TranslateFunction,
) {
  const displayRoles = getDisplayRoleCodes(roleCodes)
  return displayRoles.length > 0
    ? displayRoles.map((roleCode) => formatRole(roleCode, t)).join(', ')
    : t('storeApprovals.noResolvedRoles')
}

export function StoreApprovalsPage(input: {
  authSummary: AuthSessionSummary | null
}) {
  const queryClient = useQueryClient()
  const { locale, t } = useLocalization()
  const user = input.authSummary?.user
  const assignedStoreIds = getAssignedStoreIds(input.authSummary)
  const readStoreIds = getReadStoreIds(input.authSummary)
  const primaryStoreId = assignedStoreIds[0] ?? null
  const [selectedStoreId, setSelectedStoreId] = useState('')
  const storeId = selectedStoreId || primaryStoreId || ''
  const canListRequests = canListTargetDistributionRequests(input.authSummary)
  const canCreateForStore = canCreateTargetDistributionRequest(input.authSummary, storeId || null)
  const [requestMonth, setRequestMonth] = useState(new Date().toISOString().slice(0, 7))
  const [targetLabel, setTargetLabel] = useState(() => t('storeApprovals.targetLabelDefault'))
  const [totalTargetValue, setTotalTargetValue] = useState('0')
  const [requestReason, setRequestReason] = useState('')
  const [submissionNotice, setSubmissionNotice] = useState<string | null>(null)
  const [sellerFirstName, setSellerFirstName] = useState('')
  const [sellerLastName, setSellerLastName] = useState('')
  const [sellerNationalId, setSellerNationalId] = useState('')
  const [sellerPhoneNumber, setSellerPhoneNumber] = useState('')
  const [sellerHireDate, setSellerHireDate] = useState(new Date().toISOString().slice(0, 10))
  const [sellerPositionId, setSellerPositionId] = useState('')
  const [sellerEmploymentType, setSellerEmploymentType] =
    useState<SellerEmploymentType>('full_time')
  const [sellerRequestReason, setSellerRequestReason] = useState('')
  const [sellerRequestNotice, setSellerRequestNotice] = useState<string | null>(null)
  const [editingSellerRequestId, setEditingSellerRequestId] = useState<string | null>(null)
  const [offboardingEmployeeId, setOffboardingEmployeeId] = useState('')
  const [offboardingTerminationDate, setOffboardingTerminationDate] = useState(
    new Date().toISOString().slice(0, 10),
  )
  const [offboardingTerminationReason, setOffboardingTerminationReason] = useState('resignation')
  const [offboardingRequestReason, setOffboardingRequestReason] = useState('')
  const [offboardingNotice, setOffboardingNotice] = useState<string | null>(null)
  const [editingOffboardingRequestId, setEditingOffboardingRequestId] = useState<string | null>(null)
  const [allocations, setAllocations] = useState<Array<TargetDistributionAllocation>>([
    { employeeId: '', assigneeLabel: '', targetValue: 0, note: '' },
  ])

  const requestsQuery = useQuery({
    queryKey: ['target-distribution-requests', 'store-shell'],
    queryFn: () => getTargetDistributionRequests(),
    enabled: canListRequests,
  })
  const personnelQuery = useQuery({
    queryKey: ['store-targeting-personnel', storeId],
    queryFn: () => getStoreTargetingPersonnel(storeId),
    enabled: canCreateForStore,
  })
  const positionOptionsQuery = useQuery({
    queryKey: ['workforce-position-options', storeId],
    queryFn: () => getPositionOptions(storeId),
    enabled: canCreateForStore,
  })
  const storeEmployeesQuery = useQuery({
    queryKey: ['workforce-store-employees', storeId],
    queryFn: () => getStoreEmployees(storeId),
    enabled: canCreateForStore,
  })
  const rejectedSellerCodeRequestsQuery = useQuery({
    queryKey: ['seller-code-requests', 'rejected', storeId],
    queryFn: () => getSellerCodeRequests({ status: 'rejected' }),
    enabled: canCreateForStore,
  })
  const rejectedOffboardingRequestsQuery = useQuery({
    queryKey: ['offboarding-requests', 'rejected', storeId],
    queryFn: () => getOffboardingRequests({ status: 'rejected' }),
    enabled: canCreateForStore,
  })

  const createMutation = useMutation({
    mutationFn: createTargetDistributionRequest,
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ['target-distribution-requests'] })
      setTargetLabel(t('storeApprovals.targetLabelDefault'))
      setTotalTargetValue('0')
      setRequestReason('')
      setAllocations([{ employeeId: '', assigneeLabel: '', targetValue: 0, note: '' }])
      setSubmissionNotice(result.command.message)
    },
  })

  const sellerCodeMutation = useMutation({
    mutationFn: createSellerCodeRequest,
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ['seller-code-requests'] })
      setEditingSellerRequestId(null)
      setSellerFirstName('')
      setSellerLastName('')
      setSellerNationalId('')
      setSellerPhoneNumber('')
      setSellerHireDate(new Date().toISOString().slice(0, 10))
      setSellerPositionId('')
      setSellerEmploymentType('full_time')
      setSellerRequestReason('')
      setSellerRequestNotice(result.command.message)
    },
  })
  const resubmitSellerCodeMutation = useMutation({
    mutationFn: resubmitSellerCodeRequest,
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ['seller-code-requests'] })
      setEditingSellerRequestId(null)
      setSellerFirstName('')
      setSellerLastName('')
      setSellerNationalId('')
      setSellerPhoneNumber('')
      setSellerHireDate(new Date().toISOString().slice(0, 10))
      setSellerPositionId('')
      setSellerEmploymentType('full_time')
      setSellerRequestReason('')
      setSellerRequestNotice(result.command.message)
    },
  })
  const offboardingMutation = useMutation({
    mutationFn: createOffboardingRequest,
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ['offboarding-requests'] })
      void queryClient.invalidateQueries({ queryKey: ['workforce-store-employees'] })
      setEditingOffboardingRequestId(null)
      setOffboardingEmployeeId('')
      setOffboardingTerminationDate(new Date().toISOString().slice(0, 10))
      setOffboardingTerminationReason('resignation')
      setOffboardingRequestReason('')
      setOffboardingNotice(result.command.message)
    },
  })
  const resubmitOffboardingMutation = useMutation({
    mutationFn: resubmitOffboardingRequest,
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ['offboarding-requests'] })
      void queryClient.invalidateQueries({ queryKey: ['workforce-store-employees'] })
      setEditingOffboardingRequestId(null)
      setOffboardingEmployeeId('')
      setOffboardingTerminationDate(new Date().toISOString().slice(0, 10))
      setOffboardingTerminationReason('resignation')
      setOffboardingRequestReason('')
      setOffboardingNotice(result.command.message)
    },
  })

  const activeAllocations = useMemo(() => {
    const personnel = personnelQuery.data?.items ?? []
    const canHydrateFromPersonnel =
      personnel.length > 0 &&
      allocations.every(
        (item) =>
          !item.employeeId.trim() &&
          !item.assigneeLabel.trim() &&
          Number(item.targetValue) === 0 &&
          !(item.note ?? '').trim(),
      )

    if (!canHydrateFromPersonnel) {
      return allocations
    }

    return personnel.map((person) => ({
      employeeId: person.employeeId,
      assigneeLabel: person.displayName,
      targetValue: 0,
      note: '',
    }))
  }, [allocations, personnelQuery.data?.items])

  const personnelById = useMemo(
    () =>
      new Map(
        (personnelQuery.data?.items ?? []).map((person) => [person.employeeId, person] as const),
      ),
    [personnelQuery.data?.items],
  )
  const returnedSellerCodeRequests = rejectedSellerCodeRequestsQuery.data?.items ?? []
  const returnedOffboardingRequests = rejectedOffboardingRequestsQuery.data?.items ?? []

  const startEditingSellerRequest = (item: SellerCodeRequest) => {
    setEditingSellerRequestId(item.requestId)
    setSellerFirstName(item.firstName)
    setSellerLastName(item.lastName)
    setSellerNationalId('')
    setSellerPhoneNumber(item.phoneNumber)
    setSellerHireDate(item.hireDate)
    setSellerPositionId(item.requestedPositionId)
    setSellerEmploymentType(item.employmentType as SellerEmploymentType)
    setSellerRequestReason('')
    setSellerRequestNotice(
      item.reviewNote
        ? t('storeApprovals.returnedSellerLoadedWithNote', { note: item.reviewNote })
        : t('storeApprovals.returnedSellerLoaded'),
    )
  }

  const startEditingOffboardingRequest = (item: OffboardingRequest) => {
    setEditingOffboardingRequestId(item.requestId)
    setOffboardingEmployeeId(item.employeeId)
    setOffboardingTerminationDate(item.terminationDate)
    setOffboardingTerminationReason(item.terminationReason)
    setOffboardingRequestReason(item.requestReason ?? '')
    setOffboardingNotice(
      item.reviewNote
        ? t('storeApprovals.returnedOffboardingLoadedWithNote', { note: item.reviewNote })
        : t('storeApprovals.returnedOffboardingLoaded'),
    )
  }

  if (canListRequests && requestsQuery.isLoading && !requestsQuery.data) {
    return (
      <ScreenState
        title={t('storeApprovals.loadingTitle')}
        copy={t('storeApprovals.loadingCopy')}
      />
    )
  }

  if (canListRequests && requestsQuery.isError) {
    return (
      <ScreenState
        title={t('storeApprovals.errorTitle')}
        copy={getErrorMessage(requestsQuery.error)}
        tone="error"
      />
    )
  }

  const requests = requestsQuery.data?.items ?? []
  const pendingCount = requests.filter((item) => item.status === 'pending_region_approval').length
  const approvedCount = requests.filter((item) => item.status === 'approved').length
  const allocationTotal = activeAllocations.reduce((sum, item) => sum + Number(item.targetValue || 0), 0)
  const totalsAligned = allocationTotal === Number(totalTargetValue || 0)
  const canSubmit =
    canCreateForStore &&
    Boolean(storeId) &&
    Boolean(targetLabel.trim()) &&
    Number(totalTargetValue) > 0 &&
    totalsAligned &&
    activeAllocations.every(
      (item) => item.employeeId.trim() && item.assigneeLabel.trim() && Number(item.targetValue) > 0,
    )
  const canSubmitSellerCodeRequest =
    canCreateForStore &&
    Boolean(storeId) &&
    Boolean(sellerFirstName.trim()) &&
    Boolean(sellerLastName.trim()) &&
    /^[0-9]{11}$/.test(sellerNationalId.trim()) &&
    Boolean(sellerPhoneNumber.trim()) &&
    Boolean(sellerHireDate) &&
    Boolean(sellerPositionId.trim())
  const canSubmitOffboardingRequest =
    canCreateForStore &&
    Boolean(storeId) &&
    Boolean(offboardingEmployeeId.trim()) &&
    Boolean(offboardingTerminationDate) &&
    Boolean(offboardingTerminationReason.trim()) &&
    Boolean(offboardingRequestReason.trim())
  const sellerRequestPending = sellerCodeMutation.isPending || resubmitSellerCodeMutation.isPending
  const offboardingRequestPending = offboardingMutation.isPending || resubmitOffboardingMutation.isPending

  return (
    <section className="page-stack">
      <section className="hero-panel store-hero-panel">
        <div>
          <div className="eyebrow">{t('storeApprovals.heroEyebrow')}</div>
          <h2 className="hero-title">{t('storeApprovals.title')}</h2>
          <p className="hero-copy">{t('storeApprovals.heroCopy')}</p>
        </div>
        <div className="hero-metrics">
          <MetricAccent label={t('storeApprovals.route')} value="/store/approvals" />
          <MetricAccent
            label={t('storeApprovals.actionStore')}
            value={primaryStoreId ?? t('storeApprovals.noActionStore')}
          />
          <MetricAccent
            label={t('storeApprovals.state')}
            value={t('storeApprovals.liveRequestFlow')}
          />
        </div>
      </section>

      <section className="metric-grid store-metric-grid">
        <MetricCard
          title={t('storeApprovals.pendingApprovals')}
          value={pendingCount}
          note={t('storeApprovals.pendingApprovalsNote')}
          icon={<ReceiptText size={18} />}
          tone={pendingCount > 0 ? 'warning' : 'accent'}
        />
        <MetricCard
          title={t('storeApprovals.approvalIntent')}
          value={canCreateForStore ? 1 : 0}
          note={t('storeApprovals.approvalIntentNote')}
          icon={<ShieldCheck size={18} />}
          tone={canCreateForStore ? 'calm' : 'warning'}
        />
        <MetricCard
          title={t('storeApprovals.approvedRequests')}
          value={approvedCount}
          note={t('storeApprovals.approvedRequestsNote')}
          icon={<Clock3 size={18} />}
          tone="accent"
        />
        <MetricCard
          title={t('storeApprovals.storePersonnel')}
          value={personnelQuery.data?.items.length ?? 0}
          note={t('storeApprovals.storePersonnelNote')}
          icon={<CheckCircle2 size={18} />}
          tone="calm"
        />
      </section>

      <section className="panel" aria-label={t('storeApprovals.returnedAria')}>
        <div className="panel-heading">
          <div>
            <div className="eyebrow">{t('storeApprovals.returnedEyebrow')}</div>
            <h3>{t('storeApprovals.returnedTitle')}</h3>
          </div>
          <StatusPill
            tone={returnedSellerCodeRequests.length + returnedOffboardingRequests.length > 0 ? 'warning' : 'calm'}
          >
            {String(returnedSellerCodeRequests.length + returnedOffboardingRequests.length)}
          </StatusPill>
        </div>

        {rejectedSellerCodeRequestsQuery.isError || rejectedOffboardingRequestsQuery.isError ? (
          <div className="inline-state inline-state-danger">
            {getErrorMessage(rejectedSellerCodeRequestsQuery.error ?? rejectedOffboardingRequestsQuery.error)}
          </div>
        ) : returnedSellerCodeRequests.length + returnedOffboardingRequests.length === 0 ? (
          <EmptyState
            title={t('storeApprovals.returnedEmptyTitle')}
            copy={t('storeApprovals.returnedEmptyCopy')}
          />
        ) : (
          <div className="stacked-table">
            {returnedSellerCodeRequests.map((item) => (
              <article className="stacked-row" key={item.requestId}>
                <div className="stacked-row-head">
                  <div>
                    <strong>{`${item.firstName} ${item.lastName}`.trim()}</strong>
                    <p className="queue-subtitle">
                      {t('storeApprovals.sellerRequestSummary', {
                        last4: item.nationalIdLast4,
                        storeName: item.storeName,
                      })}
                    </p>
                  </div>
                  <StatusPill tone="warning">{formatApprovalStatus(item.status, t)}</StatusPill>
                </div>
                <div className="key-grid">
                  <KeyValue label={t('storeApprovals.position')} value={item.positionName} />
                  <KeyValue label={t('storeApprovals.reviewNote')} value={item.reviewNote ?? t('storeApprovals.noNote')} />
                  <KeyValue label={t('storeApprovals.updatedAt')} value={formatDateTime(item.updatedAt, locale)} />
                  <KeyValue label={t('storeApprovals.requestId')} value={item.requestId} />
                </div>
                <div className="action-cluster">
                  <button
                    className="control-button"
                    type="button"
                    onClick={() => startEditingSellerRequest(item)}
                  >
                    {t('storeApprovals.editSellerCodeRequest')}
                  </button>
                </div>
              </article>
            ))}

            {returnedOffboardingRequests.map((item) => (
              <article className="stacked-row" key={item.requestId}>
                <div className="stacked-row-head">
                  <div>
                    <strong>{item.displayName}</strong>
                    <p className="queue-subtitle">
                      {t('storeApprovals.offboardingRequestSummary', {
                        ref: item.externalEmployeeRef ?? t('storeApprovals.noSellerCode'),
                        storeName: item.storeName,
                      })}
                    </p>
                  </div>
                  <StatusPill tone="warning">{formatApprovalStatus(item.status, t)}</StatusPill>
                </div>
                <div className="key-grid">
                  <KeyValue label={t('storeApprovals.terminationDate')} value={formatDate(item.terminationDate, locale)} />
                  <KeyValue label={t('storeApprovals.terminationReason')} value={item.terminationReason} />
                  <KeyValue label={t('storeApprovals.reviewNote')} value={item.reviewNote ?? t('storeApprovals.noNote')} />
                  <KeyValue label={t('storeApprovals.requestId')} value={item.requestId} />
                </div>
                <div className="action-cluster">
                  <button
                    className="control-button"
                    type="button"
                    onClick={() => startEditingOffboardingRequest(item)}
                  >
                    {t('storeApprovals.editOffboardingRequest')}
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="two-up-grid">
        <article className="panel" aria-label={t('storeApprovals.targetFormAria')}>
          <div className="panel-heading">
            <div>
              <div className="eyebrow">{t('storeApprovals.futureInbox')}</div>
              <h3>{t('storeApprovals.targetTitle')}</h3>
            </div>
            <StatusPill tone="accent">{t('storeApprovals.writeFlow')}</StatusPill>
          </div>

          {!canCreateForStore ? (
            <EmptyState
              title={t('storeApprovals.assignedActionStoreRequired')}
              copy={t('storeApprovals.targetUnavailableCopy')}
            />
          ) : (
            <div className="stacked-table">
              <div className="stacked-row">
                <label className="eyebrow" htmlFor="store-id">
                  {t('storeApprovals.storeId')}
                </label>
                {assignedStoreIds.length > 1 ? (
                  <select
                    id="store-id"
                    value={storeId}
                    onChange={(event) => setSelectedStoreId(event.target.value)}
                  >
                    {assignedStoreIds.map((assignedStoreId) => (
                      <option key={assignedStoreId} value={assignedStoreId}>
                        {assignedStoreId}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    id="store-id"
                    value={storeId}
                    onChange={(event) => setSelectedStoreId(event.target.value)}
                    placeholder={t('storeApprovals.scopedStoreId')}
                    readOnly={Boolean(primaryStoreId)}
                  />
                )}
              </div>

              <div className="stacked-row">
                <label className="eyebrow" htmlFor="request-month">
                  {t('storeApprovals.requestMonth')}
                </label>
                <input
                  id="request-month"
                  type="month"
                  value={requestMonth}
                  onChange={(event) => {
                    setSubmissionNotice(null)
                    setRequestMonth(event.target.value)
                  }}
                />
              </div>

              <div className="stacked-row">
                <label className="eyebrow" htmlFor="target-label">
                  {t('storeApprovals.targetLabel')}
                </label>
                <input
                  id="target-label"
                  value={targetLabel}
                  onChange={(event) => {
                    setSubmissionNotice(null)
                    setTargetLabel(event.target.value)
                  }}
                  placeholder={t('storeApprovals.targetLabelPlaceholder')}
                />
              </div>

              <div className="stacked-row">
                <label className="eyebrow" htmlFor="total-target-value">
                  {t('storeApprovals.totalTargetValue')}
                </label>
                <input
                  id="total-target-value"
                  type="number"
                  min="0"
                  value={totalTargetValue}
                  onChange={(event) => {
                    setSubmissionNotice(null)
                    setTotalTargetValue(event.target.value)
                  }}
                />
              </div>

              <div className="stacked-row">
                <label className="eyebrow" htmlFor="request-reason">
                  {t('storeApprovals.requestReason')}
                </label>
                <textarea
                  id="request-reason"
                  rows={3}
                  value={requestReason}
                  onChange={(event) => {
                    setSubmissionNotice(null)
                    setRequestReason(event.target.value)
                  }}
                  placeholder={t('storeApprovals.regionNotePlaceholder')}
                />
              </div>

              <div className="stacked-row">
                <div className="stacked-row-head">
                  <strong>{t('storeApprovals.personTargetEntry')}</strong>
                  <StatusPill tone={totalsAligned ? 'calm' : 'warning'}>
                    {`${allocationTotal}/${Number(totalTargetValue || 0)}`}
                  </StatusPill>
                </div>
                {personnelQuery.isError ? (
                  <p className="queue-subtitle">{getErrorMessage(personnelQuery.error)}</p>
                ) : null}
                {personnelQuery.isLoading ? (
                  <p className="queue-subtitle">{t('storeApprovals.personnelLoading')}</p>
                ) : null}
                {!personnelQuery.isLoading && !personnelQuery.isError ? (
                  <p className="queue-subtitle">{t('storeApprovals.personTargetCopy')}</p>
                ) : null}

                <div className="stacked-table">
                  {activeAllocations.map((allocation, index) => {
                    const selectedPerson = personnelById.get(allocation.employeeId)

                    return (
                      <div className="stacked-row" key={`allocation-${allocation.employeeId || index}`}>
                        {selectedPerson ? (
                          <div className="key-grid">
                            <KeyValue
                              label={t('storeApprovals.personnel')}
                              value={allocation.assigneeLabel || t('storeApprovals.unassigned')}
                            />
                            <KeyValue
                              label={t('storeApprovals.currentSales')}
                              value={
                                selectedPerson.netSalesValue !== null &&
                                selectedPerson.netSalesValue !== undefined
                                  ? formatNumber(selectedPerson.netSalesValue, locale, {
                                      currency: 'TRY',
                                      maximumFractionDigits: 0,
                                      style: 'currency',
                                    })
                                  : t('storeApprovals.noData')
                              }
                            />
                          </div>
                        ) : (
                          <select
                            value={allocation.employeeId}
                            onChange={(event) => {
                              const selected = personnelById.get(event.target.value)
                              setSubmissionNotice(null)
                              setAllocations(
                                activeAllocations.map((item, itemIndex) =>
                                  itemIndex === index
                                    ? {
                                        ...item,
                                        employeeId: event.target.value,
                                        assigneeLabel: selected?.displayName ?? '',
                                      }
                                    : item,
                                ),
                              )
                            }}
                          >
                            <option value="">{t('storeApprovals.selectPersonnel')}</option>
                            {(personnelQuery.data?.items ?? []).map((person) => (
                              <option key={person.employeeId} value={person.employeeId}>
                                {person.displayName}
                              </option>
                            ))}
                          </select>
                        )}
                        <input
                          aria-label={t('storeApprovals.personTargetValue')}
                          type="number"
                          min="0"
                          value={allocation.targetValue}
                          onChange={(event) => {
                            setSubmissionNotice(null)
                            setAllocations(
                              activeAllocations.map((item, itemIndex) =>
                                itemIndex === index
                                  ? { ...item, targetValue: Number(event.target.value) }
                                  : item,
                              ),
                            )
                          }}
                          placeholder={t('storeApprovals.targetValuePlaceholder')}
                        />
                        <input
                          value={allocation.note ?? ''}
                          onChange={(event) => {
                            setSubmissionNotice(null)
                            setAllocations(
                              activeAllocations.map((item, itemIndex) =>
                                itemIndex === index ? { ...item, note: event.target.value } : item,
                              ),
                            )
                          }}
                          placeholder={t('storeApprovals.optionalNote')}
                        />
                        {activeAllocations.length > 1 ? (
                          <button
                            className="control-button"
                            type="button"
                            onClick={() =>
                              setAllocations(activeAllocations.filter((_, itemIndex) => itemIndex !== index))
                            }
                          >
                            {t('storeApprovals.remove')}
                          </button>
                        ) : null}
                      </div>
                    )
                  })}
                </div>

                {!totalsAligned ? (
                  <p className="queue-subtitle">{t('storeApprovals.allocationMismatch')}</p>
                ) : null}

              <div className="action-cluster">
                <button
                  className="control-button"
                  type="button"
                  disabled={!canCreateForStore}
                  onClick={() => {
                    setSubmissionNotice(null)
                    setAllocations([
                      ...activeAllocations,
                      { employeeId: '', assigneeLabel: '', targetValue: 0, note: '' },
                    ])
                  }}
                >
                  {t('storeApprovals.addAllocation')}
                </button>
              </div>
              </div>

              <div className="action-cluster">
                <button
                  className="control-button"
                  type="button"
                  disabled={!canSubmit || createMutation.isPending}
                  onClick={() =>
                    createMutation.mutate({
                      storeId,
                      requestMonth: `${requestMonth}-01`,
                      targetLabel,
                      totalTargetValue: Number(totalTargetValue),
                      requestReason: requestReason || undefined,
                      allocations: activeAllocations,
                    })
                  }
                >
                  {createMutation.isPending
                    ? t('storeApprovals.submitting')
                    : t('storeApprovals.submitTargetRequest')}
                </button>
              </div>

              {createMutation.isError ? (
                <p className="queue-subtitle">{getErrorMessage(createMutation.error)}</p>
              ) : null}
              {submissionNotice ? <p className="queue-subtitle">{submissionNotice}</p> : null}
            </div>
          )}
        </article>

        <article className="panel" aria-label={t('storeApprovals.sellerFormAria')}>
          <div className="panel-heading">
            <div>
              <div className="eyebrow">{t('storeApprovals.personnelRequest')}</div>
              <h3>{t('storeApprovals.sellerCodeTitle')}</h3>
            </div>
            <StatusPill tone="calm">{t('storeApprovals.hrQueue')}</StatusPill>
          </div>

          {!canCreateForStore ? (
            <EmptyState
              title={t('storeApprovals.assignedActionStoreRequired')}
              copy={t('storeApprovals.sellerUnavailableCopy')}
            />
          ) : (
            <div className="stacked-table">
              <div className="stacked-row">
                <label className="eyebrow" htmlFor="seller-store-id">
                  {t('storeApprovals.storeId')}
                </label>
                <input id="seller-store-id" value={storeId} readOnly />
              </div>

              <div className="stacked-row">
                <label className="eyebrow" htmlFor="seller-first-name">
                  {t('storeApprovals.firstName')}
                </label>
                <input
                  id="seller-first-name"
                  value={sellerFirstName}
                  onChange={(event) => {
                    setSellerRequestNotice(null)
                    setSellerFirstName(event.target.value)
                  }}
                  placeholder={t('storeApprovals.firstNamePlaceholder')}
                />
              </div>

              <div className="stacked-row">
                <label className="eyebrow" htmlFor="seller-last-name">
                  {t('storeApprovals.lastName')}
                </label>
                <input
                  id="seller-last-name"
                  value={sellerLastName}
                  onChange={(event) => {
                    setSellerRequestNotice(null)
                    setSellerLastName(event.target.value)
                  }}
                  placeholder={t('storeApprovals.lastNamePlaceholder')}
                />
              </div>

              <div className="stacked-row">
                <label className="eyebrow" htmlFor="seller-position-id">
                  {t('storeApprovals.position')}
                </label>
                <select
                  id="seller-position-id"
                  value={sellerPositionId}
                  disabled={positionOptionsQuery.isLoading || positionOptionsQuery.isError}
                  onChange={(event) => {
                    setSellerRequestNotice(null)
                    setSellerPositionId(event.target.value)
                  }}
                >
                  <option value="">{t('storeApprovals.selectPosition')}</option>
                  {(positionOptionsQuery.data?.items ?? []).map((position) => (
                    <option key={position.positionId} value={position.positionId}>
                      {position.positionName} ({position.positionCode})
                    </option>
                  ))}
                </select>
                {positionOptionsQuery.isLoading ? (
                  <p className="queue-subtitle">{t('storeApprovals.positionsLoading')}</p>
                ) : null}
                {positionOptionsQuery.isError ? (
                  <p className="queue-subtitle">{getErrorMessage(positionOptionsQuery.error)}</p>
                ) : null}
                {!positionOptionsQuery.isLoading &&
                !positionOptionsQuery.isError &&
                (positionOptionsQuery.data?.items.length ?? 0) === 0 ? (
                  <p className="queue-subtitle">{t('storeApprovals.noPositions')}</p>
                ) : null}
              </div>

              <div className="stacked-row">
                <label className="eyebrow" htmlFor="seller-national-id">
                  {t('storeApprovals.nationalId')}
                </label>
                <input
                  id="seller-national-id"
                  inputMode="numeric"
                  maxLength={11}
                  value={sellerNationalId}
                  onChange={(event) => {
                    setSellerRequestNotice(null)
                    setSellerNationalId(event.target.value.replace(/\D/g, '').slice(0, 11))
                  }}
                  placeholder="12345678901"
                />
              </div>

              <div className="stacked-row">
                <label className="eyebrow" htmlFor="seller-phone-number">
                  {t('storeApprovals.phoneNumber')}
                </label>
                <input
                  id="seller-phone-number"
                  type="tel"
                  value={sellerPhoneNumber}
                  onChange={(event) => {
                    setSellerRequestNotice(null)
                    setSellerPhoneNumber(event.target.value)
                  }}
                  placeholder="05551234567"
                />
              </div>

              <div className="stacked-row">
                <label className="eyebrow" htmlFor="seller-hire-date">
                  {t('storeApprovals.hireDate')}
                </label>
                <input
                  id="seller-hire-date"
                  type="date"
                  value={sellerHireDate}
                  onChange={(event) => {
                    setSellerRequestNotice(null)
                    setSellerHireDate(event.target.value)
                  }}
                />
              </div>

              <div className="stacked-row">
                <label className="eyebrow" htmlFor="seller-employment-type">
                  {t('storeApprovals.employmentType')}
                </label>
                <select
                  id="seller-employment-type"
                  value={sellerEmploymentType}
                  onChange={(event) => {
                    setSellerRequestNotice(null)
                    setSellerEmploymentType(event.target.value as SellerEmploymentType)
                  }}
                >
                  <option value="full_time">{formatEmploymentType('full_time', t)}</option>
                  <option value="part_time">{formatEmploymentType('part_time', t)}</option>
                  <option value="temporary">{formatEmploymentType('temporary', t)}</option>
                </select>
              </div>

              <div className="stacked-row">
                <label className="eyebrow" htmlFor="seller-request-reason">
                  {t('storeApprovals.requestReason')}
                </label>
                <textarea
                  id="seller-request-reason"
                  rows={3}
                  value={sellerRequestReason}
                  onChange={(event) => {
                    setSellerRequestNotice(null)
                    setSellerRequestReason(event.target.value)
                  }}
                  placeholder={t('storeApprovals.newPersonnelPlaceholder')}
                />
              </div>

              <div className="action-cluster">
                <button
                  className="control-button"
                  type="button"
                  disabled={!canSubmitSellerCodeRequest || sellerRequestPending}
                  onClick={() => {
                    const payload = {
                      firstName: sellerFirstName.trim(),
                      lastName: sellerLastName.trim(),
                      nationalId: sellerNationalId.trim(),
                      phoneNumber: sellerPhoneNumber.trim(),
                      hireDate: sellerHireDate,
                      requestedPositionId: sellerPositionId.trim(),
                      employmentType: sellerEmploymentType,
                      requestReason: sellerRequestReason.trim() || undefined,
                    }

                    if (editingSellerRequestId) {
                      resubmitSellerCodeMutation.mutate({
                        requestId: editingSellerRequestId,
                        ...payload,
                      })
                      return
                    }

                    sellerCodeMutation.mutate({
                      storeId,
                      requestType: 'create_code',
                      ...payload,
                    })
                  }}
                >
                  {sellerRequestPending
                    ? t('storeApprovals.submitting')
                    : editingSellerRequestId
                      ? t('storeApprovals.resubmitSellerCodeRequest')
                      : t('storeApprovals.submitSellerCodeRequest')}
                </button>
                {editingSellerRequestId ? (
                  <button
                    className="control-button"
                    type="button"
                    disabled={sellerRequestPending}
                    onClick={() => {
                      setEditingSellerRequestId(null)
                      setSellerFirstName('')
                      setSellerLastName('')
                      setSellerNationalId('')
                      setSellerPhoneNumber('')
                      setSellerHireDate(new Date().toISOString().slice(0, 10))
                      setSellerPositionId('')
                      setSellerEmploymentType('full_time')
                      setSellerRequestReason('')
                      setSellerRequestNotice(null)
                    }}
                  >
                    {t('storeApprovals.cancelEdit')}
                  </button>
                ) : null}
              </div>

              {sellerCodeMutation.isError ? (
                <p className="queue-subtitle">{getErrorMessage(sellerCodeMutation.error)}</p>
              ) : null}
              {resubmitSellerCodeMutation.isError ? (
                <p className="queue-subtitle">{getErrorMessage(resubmitSellerCodeMutation.error)}</p>
              ) : null}
              {sellerRequestNotice ? (
                <p className="queue-subtitle">{sellerRequestNotice}</p>
              ) : null}
            </div>
          )}
        </article>

        <article className="panel" aria-label={t('storeApprovals.offboardingFormAria')}>
          <div className="panel-heading">
            <div>
              <div className="eyebrow">{t('storeApprovals.personnelRequest')}</div>
              <h3>{t('storeApprovals.offboardingTitle')}</h3>
            </div>
            <StatusPill tone="warning">{t('storeApprovals.hrQueue')}</StatusPill>
          </div>

          {!canCreateForStore ? (
            <EmptyState
              title={t('storeApprovals.assignedActionStoreRequired')}
              copy={t('storeApprovals.offboardingUnavailableCopy')}
            />
          ) : (
            <div className="stacked-table">
              <div className="stacked-row">
                <label className="eyebrow" htmlFor="offboarding-employee-id">
                  {t('storeApprovals.employee')}
                </label>
                <select
                  id="offboarding-employee-id"
                  value={offboardingEmployeeId}
                  disabled={storeEmployeesQuery.isLoading || storeEmployeesQuery.isError}
                  onChange={(event) => {
                    setOffboardingNotice(null)
                    setOffboardingEmployeeId(event.target.value)
                  }}
                >
                  <option value="">{t('storeApprovals.selectEmployee')}</option>
                  {(storeEmployeesQuery.data?.items ?? []).map((employee) => (
                    <option key={employee.employeeId} value={employee.employeeId}>
                      {employee.displayName} ({employee.externalEmployeeRef ?? employee.positionName})
                    </option>
                  ))}
                </select>
                {storeEmployeesQuery.isLoading ? (
                  <p className="queue-subtitle">{t('storeApprovals.activePersonnelLoading')}</p>
                ) : null}
                {storeEmployeesQuery.isError ? (
                  <p className="queue-subtitle">{getErrorMessage(storeEmployeesQuery.error)}</p>
                ) : null}
                {!storeEmployeesQuery.isLoading &&
                !storeEmployeesQuery.isError &&
                (storeEmployeesQuery.data?.items.length ?? 0) === 0 ? (
                  <p className="queue-subtitle">{t('storeApprovals.noActivePersonnel')}</p>
                ) : null}
              </div>

              <div className="stacked-row">
                <label className="eyebrow" htmlFor="offboarding-termination-date">
                  {t('storeApprovals.terminationDate')}
                </label>
                <input
                  id="offboarding-termination-date"
                  type="date"
                  value={offboardingTerminationDate}
                  onChange={(event) => {
                    setOffboardingNotice(null)
                    setOffboardingTerminationDate(event.target.value)
                  }}
                />
              </div>

              <div className="stacked-row">
                <label className="eyebrow" htmlFor="offboarding-termination-reason">
                  {t('storeApprovals.terminationReason')}
                </label>
                <input
                  id="offboarding-termination-reason"
                  value={offboardingTerminationReason}
                  onChange={(event) => {
                    setOffboardingNotice(null)
                    setOffboardingTerminationReason(event.target.value)
                  }}
                  placeholder={t('storeApprovals.resignationPlaceholder')}
                />
              </div>

              <div className="stacked-row">
                <label className="eyebrow" htmlFor="offboarding-request-reason">
                  {t('storeApprovals.requestReason')}
                </label>
                <textarea
                  id="offboarding-request-reason"
                  rows={3}
                  value={offboardingRequestReason}
                  onChange={(event) => {
                    setOffboardingNotice(null)
                    setOffboardingRequestReason(event.target.value)
                  }}
                  placeholder={t('storeApprovals.offboardingReasonPlaceholder')}
                />
              </div>

              <div className="action-cluster">
                <button
                  className="control-button"
                  type="button"
                  disabled={!canSubmitOffboardingRequest || offboardingRequestPending}
                  onClick={() => {
                    const payload = {
                      employeeId: offboardingEmployeeId,
                      terminationDate: offboardingTerminationDate,
                      terminationReason: offboardingTerminationReason.trim(),
                      requestReason: offboardingRequestReason.trim(),
                    }

                    if (editingOffboardingRequestId) {
                      resubmitOffboardingMutation.mutate({
                        requestId: editingOffboardingRequestId,
                        ...payload,
                      })
                      return
                    }

                    offboardingMutation.mutate({
                      storeId,
                      ...payload,
                    })
                  }}
                >
                  {offboardingRequestPending
                    ? t('storeApprovals.submitting')
                    : editingOffboardingRequestId
                      ? t('storeApprovals.resubmitOffboardingRequest')
                      : t('storeApprovals.submitOffboardingRequest')}
                </button>
                {editingOffboardingRequestId ? (
                  <button
                    className="control-button"
                    type="button"
                    disabled={offboardingRequestPending}
                    onClick={() => {
                      setEditingOffboardingRequestId(null)
                      setOffboardingEmployeeId('')
                      setOffboardingTerminationDate(new Date().toISOString().slice(0, 10))
                      setOffboardingTerminationReason('resignation')
                      setOffboardingRequestReason('')
                      setOffboardingNotice(null)
                    }}
                  >
                    {t('storeApprovals.cancelEdit')}
                  </button>
                ) : null}
              </div>

              {offboardingMutation.isError ? (
                <p className="queue-subtitle">{getErrorMessage(offboardingMutation.error)}</p>
              ) : null}
              {resubmitOffboardingMutation.isError ? (
                <p className="queue-subtitle">{getErrorMessage(resubmitOffboardingMutation.error)}</p>
              ) : null}
              {offboardingNotice ? <p className="queue-subtitle">{offboardingNotice}</p> : null}
            </div>
          )}
        </article>

        <article className="panel">
          <div className="panel-heading">
            <div>
              <div className="eyebrow">{t('storeApprovals.resolvedSession')}</div>
              <h3>{t('storeApprovals.resolvedTitle')}</h3>
            </div>
          </div>

          <div className="key-grid">
            <KeyValue
              label={t('storeApprovals.userId')}
              value={user?.userId ?? t('storeApprovals.sessionNotResolved')}
            />
            <KeyValue label={t('storeApprovals.roles')} value={formatRoles(user?.roleCodes, t)} />
            <KeyValue
              label={t('storeApprovals.readStoreIds')}
              value={readStoreIds.join(', ') || t('storeApprovals.none')}
            />
            <KeyValue
              label={t('storeApprovals.actionStoreIds')}
              value={assignedStoreIds.join(', ') || t('storeApprovals.none')}
            />
            <KeyValue
              label={t('storeApprovals.approvalRouteFit')}
              value={
                canCreateForStore
                  ? t('storeApprovals.routeFitReady')
                  : t('storeApprovals.routeFitPending')
              }
            />
          </div>

          <div className="action-cluster">
            <Link className="control-button store-shell-link" to="/admin/targets">
              {t('storeApprovals.regionApprovalQueue')}
            </Link>
          </div>
        </article>
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <div className="eyebrow">{t('storeApprovals.submittedEyebrow')}</div>
            <h3>{t('storeApprovals.submittedTitle')}</h3>
          </div>
        </div>

        {requests.length === 0 ? (
          <EmptyState
            title={t('storeApprovals.noSubmittedTitle')}
            copy={t('storeApprovals.noSubmittedCopy')}
          />
        ) : (
          <div className="stacked-table">
            {requests.map((item) => (
              <article className="stacked-row" key={item.requestId}>
                <div className="stacked-row-head">
                  <strong>{item.targetLabel}</strong>
                  <StatusPill tone={item.status === 'approved' ? 'calm' : 'warning'}>
                    {formatApprovalStatus(item.status, t)}
                  </StatusPill>
                </div>
                <p>
                  {t('storeApprovals.targetSummary', {
                    month: formatDate(item.requestMonth, locale),
                    storeName: item.storeName || item.storeId,
                    value: item.totalTargetValue,
                  })}
                </p>
                <div className="key-grid">
                  <KeyValue
                    label={t('storeApprovals.allocationCount')}
                    value={String(item.allocationCount)}
                  />
                  <KeyValue
                    label={t('storeApprovals.createdAt')}
                    value={formatDateTime(item.createdAt, locale)}
                  />
                  <KeyValue
                    label={t('storeApprovals.approvedAt')}
                    value={
                      item.approvedAt
                        ? formatDateTime(item.approvedAt, locale)
                        : t('storeApprovals.pending')
                    }
                  />
                  <KeyValue label={t('storeApprovals.requestId')} value={item.requestId} />
                </div>
                {item.requestReason ? (
                  <p className="queue-subtitle">
                    {t('storeApprovals.reasonPrefix', { reason: item.requestReason })}
                  </p>
                ) : null}
                {item.approvalNote ? (
                  <p className="queue-subtitle">
                    {t('storeApprovals.approvalNotePrefix', { note: item.approvalNote })}
                  </p>
                ) : null}
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="two-up-grid">
        <article className="panel">
          <div className="panel-heading">
            <div>
              <div className="eyebrow">{t('storeApprovals.thisFlowNow')}</div>
              <h3>{t('storeApprovals.handlesTitle')}</h3>
            </div>
          </div>
          <div className="stacked-table">
            <div className="stacked-row">
              <div className="stacked-row-head">
                <strong>{t('storeApprovals.storeSubmission')}</strong>
                <CheckCircle2 size={16} />
              </div>
              <p>{t('storeApprovals.storeSubmissionCopy')}</p>
            </div>
            <div className="stacked-row">
              <div className="stacked-row-head">
                <strong>{t('storeApprovals.regionReview')}</strong>
                <CheckCircle2 size={16} />
              </div>
              <p>{t('storeApprovals.regionReviewCopy')}</p>
            </div>
          </div>
        </article>

        <article className="panel">
          <div className="panel-heading">
            <div>
              <div className="eyebrow">{t('storeApprovals.boundaryRule')}</div>
              <h3>{t('storeApprovals.boundaryTitle')}</h3>
            </div>
          </div>
          <div className="stacked-table">
            <div className="stacked-row">
              <div className="stacked-row-head">
                <strong>{t('storeApprovals.workflowGovernance')}</strong>
                <CheckCircle2 size={16} />
              </div>
              <p>{t('storeApprovals.workflowGovernanceCopy')}</p>
            </div>
            <div className="stacked-row">
              <div className="stacked-row-head">
                <strong>{t('storeApprovals.storeConsumption')}</strong>
                <CheckCircle2 size={16} />
              </div>
              <p>{t('storeApprovals.storeConsumptionCopy')}</p>
            </div>
          </div>
        </article>
      </section>

      <div className="action-cluster">
        <Link className="control-button store-shell-link" to="/store">
          {t('storeApprovals.backToStoreHome')}
        </Link>
        <Link className="control-button store-shell-link" to="/admin/targets">
          {t('storeApprovals.openRegionApprovalQueue')}
        </Link>
      </div>
    </section>
  )
}
