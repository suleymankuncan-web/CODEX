import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, Clock3, ReceiptText, ShieldCheck } from 'lucide-react'
import { Link } from 'react-router-dom'
import {
  EmptyState,
  KeyValue,
  MetricAccent,
  MetricCard,
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
  type TargetDistributionRequest,
  type StoreTargetingPerson,
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
  type PositionOption,
  type SellerCodeRequest,
  type SellerEmploymentType,
  type StoreEmployee,
} from '../features/workforce/api'
import { formatDate, formatDateTime, formatNumber, formatState, getErrorMessage } from '../lib/format'
import type { AppLocale } from '../lib/i18n'

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

type ListQuerySnapshot<T> = {
  data?: {
    items: T[]
  }
  error: unknown
  isError: boolean
  isLoading: boolean
}

type StringFieldSetter = (value: string) => void

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
  const [requestMonth, setRequestMonth] = useState(() => new Date().toISOString().slice(0, 7))
  const [targetLabel, setTargetLabel] = useState(() => t('storeApprovals.targetLabelDefault'))
  const [totalTargetValue, setTotalTargetValue] = useState('0')
  const [requestReason, setRequestReason] = useState('')
  const [submissionNotice, setSubmissionNotice] = useState<string | null>(null)
  const [sellerFirstName, setSellerFirstName] = useState('')
  const [sellerLastName, setSellerLastName] = useState('')
  const [sellerNationalId, setSellerNationalId] = useState('')
  const [sellerPhoneNumber, setSellerPhoneNumber] = useState('')
  const [sellerHireDate, setSellerHireDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [sellerPositionId, setSellerPositionId] = useState('')
  const [sellerEmploymentType, setSellerEmploymentType] =
    useState<SellerEmploymentType>('full_time')
  const [sellerRequestReason, setSellerRequestReason] = useState('')
  const [sellerRequestNotice, setSellerRequestNotice] = useState<string | null>(null)
  const [editingSellerRequestId, setEditingSellerRequestId] = useState<string | null>(null)
  const [offboardingEmployeeId, setOffboardingEmployeeId] = useState('')
  const [offboardingTerminationDate, setOffboardingTerminationDate] = useState(() =>
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
  const addTargetAllocation = () => {
    setSubmissionNotice(null)
    setAllocations([
      ...activeAllocations,
      { employeeId: '', assigneeLabel: '', targetValue: 0, note: '' },
    ])
  }
  const updateTargetAllocationPerson = (
    index: number,
    employeeId: string,
    assigneeLabel: string,
  ) => {
    setSubmissionNotice(null)
    setAllocations(
      activeAllocations.map((item, itemIndex) =>
        itemIndex === index
          ? {
              ...item,
              employeeId,
              assigneeLabel,
            }
          : item,
      ),
    )
  }
  const updateTargetAllocationValue = (index: number, targetValue: number) => {
    setSubmissionNotice(null)
    setAllocations(
      activeAllocations.map((item, itemIndex) =>
        itemIndex === index ? { ...item, targetValue } : item,
      ),
    )
  }
  const updateTargetAllocationNote = (index: number, note: string) => {
    setSubmissionNotice(null)
    setAllocations(
      activeAllocations.map((item, itemIndex) =>
        itemIndex === index ? { ...item, note } : item,
      ),
    )
  }
  const removeTargetAllocation = (index: number) => {
    setSubmissionNotice(null)
    setAllocations(activeAllocations.filter((_, itemIndex) => itemIndex !== index))
  }
  const submitTargetDistributionRequest = () => {
    createMutation.mutate({
      storeId,
      requestMonth: `${requestMonth}-01`,
      targetLabel,
      totalTargetValue: Number(totalTargetValue),
      requestReason: requestReason || undefined,
      allocations: activeAllocations,
    })
  }
  const submitSellerCodeRequest = () => {
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
  }
  const cancelSellerRequestEdit = () => {
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
  }
  const submitOffboardingRequest = () => {
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
  }
  const cancelOffboardingRequestEdit = () => {
    setEditingOffboardingRequestId(null)
    setOffboardingEmployeeId('')
    setOffboardingTerminationDate(new Date().toISOString().slice(0, 10))
    setOffboardingTerminationReason('resignation')
    setOffboardingRequestReason('')
    setOffboardingNotice(null)
  }

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

      <ReturnedRequestsPanel
        locale={locale}
        returnedOffboardingRequests={returnedOffboardingRequests}
        returnedSellerCodeRequests={returnedSellerCodeRequests}
        sellerCodeRequestsError={rejectedSellerCodeRequestsQuery.error}
        hasSellerCodeRequestsError={rejectedSellerCodeRequestsQuery.isError}
        offboardingRequestsError={rejectedOffboardingRequestsQuery.error}
        hasOffboardingRequestsError={rejectedOffboardingRequestsQuery.isError}
        onEditOffboardingRequest={startEditingOffboardingRequest}
        onEditSellerCodeRequest={startEditingSellerRequest}
        t={t}
      />

      <section className="two-up-grid">
        <TargetDistributionRequestForm
          activeAllocations={activeAllocations}
          allocationTotal={allocationTotal}
          assignedStoreIds={assignedStoreIds}
          canCreateForStore={canCreateForStore}
          canSubmit={canSubmit}
          createError={createMutation.error}
          hasCreateError={createMutation.isError}
          isSubmitting={createMutation.isPending}
          locale={locale}
          onAddAllocation={addTargetAllocation}
          onAllocationNoteChange={updateTargetAllocationNote}
          onAllocationPersonChange={updateTargetAllocationPerson}
          onAllocationValueChange={updateTargetAllocationValue}
          onRemoveAllocation={removeTargetAllocation}
          onRequestMonthChange={(value) => {
            setSubmissionNotice(null)
            setRequestMonth(value)
          }}
          onRequestReasonChange={(value) => {
            setSubmissionNotice(null)
            setRequestReason(value)
          }}
          onStoreIdChange={setSelectedStoreId}
          onSubmit={submitTargetDistributionRequest}
          onTargetLabelChange={(value) => {
            setSubmissionNotice(null)
            setTargetLabel(value)
          }}
          onTotalTargetValueChange={(value) => {
            setSubmissionNotice(null)
            setTotalTargetValue(value)
          }}
          personnelById={personnelById}
          personnelQuery={personnelQuery}
          primaryStoreId={primaryStoreId}
          requestMonth={requestMonth}
          requestReason={requestReason}
          storeId={storeId}
          submissionNotice={submissionNotice}
          targetLabel={targetLabel}
          t={t}
          totalTargetValue={totalTargetValue}
          totalsAligned={totalsAligned}
        />

        <SellerCodeRequestForm
          canCreateForStore={canCreateForStore}
          canSubmit={canSubmitSellerCodeRequest}
          editingRequestId={editingSellerRequestId}
          hasCreateError={sellerCodeMutation.isError}
          hasResubmitError={resubmitSellerCodeMutation.isError}
          isPending={sellerRequestPending}
          notice={sellerRequestNotice}
          onCancelEdit={cancelSellerRequestEdit}
          onEmploymentTypeChange={(value) => {
            setSellerRequestNotice(null)
            setSellerEmploymentType(value)
          }}
          onFirstNameChange={(value) => {
            setSellerRequestNotice(null)
            setSellerFirstName(value)
          }}
          onHireDateChange={(value) => {
            setSellerRequestNotice(null)
            setSellerHireDate(value)
          }}
          onLastNameChange={(value) => {
            setSellerRequestNotice(null)
            setSellerLastName(value)
          }}
          onNationalIdChange={(value) => {
            setSellerRequestNotice(null)
            setSellerNationalId(value.replace(/\D/g, '').slice(0, 11))
          }}
          onPhoneNumberChange={(value) => {
            setSellerRequestNotice(null)
            setSellerPhoneNumber(value)
          }}
          onPositionIdChange={(value) => {
            setSellerRequestNotice(null)
            setSellerPositionId(value)
          }}
          onRequestReasonChange={(value) => {
            setSellerRequestNotice(null)
            setSellerRequestReason(value)
          }}
          onSubmit={submitSellerCodeRequest}
          positionOptionsQuery={positionOptionsQuery}
          createError={sellerCodeMutation.error}
          resubmitError={resubmitSellerCodeMutation.error}
          sellerEmploymentType={sellerEmploymentType}
          sellerFirstName={sellerFirstName}
          sellerHireDate={sellerHireDate}
          sellerLastName={sellerLastName}
          sellerNationalId={sellerNationalId}
          sellerPhoneNumber={sellerPhoneNumber}
          sellerPositionId={sellerPositionId}
          sellerRequestReason={sellerRequestReason}
          storeId={storeId}
          t={t}
        />

        <OffboardingRequestForm
          canCreateForStore={canCreateForStore}
          canSubmit={canSubmitOffboardingRequest}
          createError={offboardingMutation.error}
          editingRequestId={editingOffboardingRequestId}
          hasCreateError={offboardingMutation.isError}
          hasResubmitError={resubmitOffboardingMutation.isError}
          isPending={offboardingRequestPending}
          notice={offboardingNotice}
          offboardingEmployeeId={offboardingEmployeeId}
          offboardingRequestReason={offboardingRequestReason}
          offboardingTerminationDate={offboardingTerminationDate}
          offboardingTerminationReason={offboardingTerminationReason}
          onCancelEdit={cancelOffboardingRequestEdit}
          onEmployeeIdChange={(value) => {
            setOffboardingNotice(null)
            setOffboardingEmployeeId(value)
          }}
          onRequestReasonChange={(value) => {
            setOffboardingNotice(null)
            setOffboardingRequestReason(value)
          }}
          onSubmit={submitOffboardingRequest}
          onTerminationDateChange={(value) => {
            setOffboardingNotice(null)
            setOffboardingTerminationDate(value)
          }}
          onTerminationReasonChange={(value) => {
            setOffboardingNotice(null)
            setOffboardingTerminationReason(value)
          }}
          resubmitError={resubmitOffboardingMutation.error}
          storeEmployeesQuery={storeEmployeesQuery}
          t={t}
        />

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

      <SubmittedTargetRequestsPanel
        error={requestsQuery.error}
        isError={requestsQuery.isError}
        isLoading={requestsQuery.isLoading}
        locale={locale}
        onRetry={() => void requestsQuery.refetch()}
        requests={requests}
        t={t}
      />

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

function ReturnedRequestsPanel(input: {
  locale: AppLocale
  returnedOffboardingRequests: OffboardingRequest[]
  returnedSellerCodeRequests: SellerCodeRequest[]
  sellerCodeRequestsError: unknown
  hasSellerCodeRequestsError: boolean
  offboardingRequestsError: unknown
  hasOffboardingRequestsError: boolean
  onEditOffboardingRequest: (item: OffboardingRequest) => void
  onEditSellerCodeRequest: (item: SellerCodeRequest) => void
  t: TranslateFunction
}) {
  const returnedRequestCount =
    input.returnedSellerCodeRequests.length + input.returnedOffboardingRequests.length

  return (
    <section className="panel" aria-label={input.t('storeApprovals.returnedAria')}>
      <div className="panel-heading">
        <div>
          <div className="eyebrow">{input.t('storeApprovals.returnedEyebrow')}</div>
          <h3>{input.t('storeApprovals.returnedTitle')}</h3>
        </div>
        <StatusPill tone={returnedRequestCount > 0 ? 'warning' : 'calm'}>
          {String(returnedRequestCount)}
        </StatusPill>
      </div>

      {input.hasSellerCodeRequestsError || input.hasOffboardingRequestsError ? (
        <div className="inline-state inline-state-danger">
          {getErrorMessage(input.sellerCodeRequestsError ?? input.offboardingRequestsError)}
        </div>
      ) : returnedRequestCount === 0 ? (
        <EmptyState
          title={input.t('storeApprovals.returnedEmptyTitle')}
          copy={input.t('storeApprovals.returnedEmptyCopy')}
        />
      ) : (
        <div className="stacked-table">
          {input.returnedSellerCodeRequests.map((item) => (
            <article className="stacked-row" key={item.requestId}>
              <div className="stacked-row-head">
                <div>
                  <strong>{`${item.firstName} ${item.lastName}`.trim()}</strong>
                  <p className="queue-subtitle">
                    {input.t('storeApprovals.sellerRequestSummary', {
                      last4: item.nationalIdLast4,
                      storeName: item.storeName,
                    })}
                  </p>
                </div>
                <StatusPill tone="warning">
                  {formatApprovalStatus(item.status, input.t)}
                </StatusPill>
              </div>
              <div className="key-grid">
                <KeyValue label={input.t('storeApprovals.position')} value={item.positionName} />
                <KeyValue
                  label={input.t('storeApprovals.reviewNote')}
                  value={item.reviewNote ?? input.t('storeApprovals.noNote')}
                />
                <KeyValue
                  label={input.t('storeApprovals.updatedAt')}
                  value={formatDateTime(item.updatedAt, input.locale)}
                />
                <KeyValue label={input.t('storeApprovals.requestId')} value={item.requestId} />
              </div>
              <div className="action-cluster">
                <button
                  className="control-button"
                  type="button"
                  onClick={() => input.onEditSellerCodeRequest(item)}
                >
                  {input.t('storeApprovals.editSellerCodeRequest')}
                </button>
              </div>
            </article>
          ))}

          {input.returnedOffboardingRequests.map((item) => (
            <article className="stacked-row" key={item.requestId}>
              <div className="stacked-row-head">
                <div>
                  <strong>{item.displayName}</strong>
                  <p className="queue-subtitle">
                    {input.t('storeApprovals.offboardingRequestSummary', {
                      ref: item.externalEmployeeRef ?? input.t('storeApprovals.noSellerCode'),
                      storeName: item.storeName,
                    })}
                  </p>
                </div>
                <StatusPill tone="warning">
                  {formatApprovalStatus(item.status, input.t)}
                </StatusPill>
              </div>
              <div className="key-grid">
                <KeyValue
                  label={input.t('storeApprovals.terminationDate')}
                  value={formatDate(item.terminationDate, input.locale)}
                />
                <KeyValue
                  label={input.t('storeApprovals.terminationReason')}
                  value={item.terminationReason}
                />
                <KeyValue
                  label={input.t('storeApprovals.reviewNote')}
                  value={item.reviewNote ?? input.t('storeApprovals.noNote')}
                />
                <KeyValue label={input.t('storeApprovals.requestId')} value={item.requestId} />
              </div>
              <div className="action-cluster">
                <button
                  className="control-button"
                  type="button"
                  onClick={() => input.onEditOffboardingRequest(item)}
                >
                  {input.t('storeApprovals.editOffboardingRequest')}
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}

function TargetDistributionRequestForm(input: {
  activeAllocations: TargetDistributionAllocation[]
  allocationTotal: number
  assignedStoreIds: string[]
  canCreateForStore: boolean
  canSubmit: boolean
  createError: unknown
  hasCreateError: boolean
  isSubmitting: boolean
  locale: AppLocale
  onAddAllocation: () => void
  onAllocationNoteChange: (index: number, value: string) => void
  onAllocationPersonChange: (index: number, employeeId: string, assigneeLabel: string) => void
  onAllocationValueChange: (index: number, targetValue: number) => void
  onRemoveAllocation: (index: number) => void
  onRequestMonthChange: StringFieldSetter
  onRequestReasonChange: StringFieldSetter
  onStoreIdChange: StringFieldSetter
  onSubmit: () => void
  onTargetLabelChange: StringFieldSetter
  onTotalTargetValueChange: StringFieldSetter
  personnelById: ReadonlyMap<string, StoreTargetingPerson>
  personnelQuery: ListQuerySnapshot<StoreTargetingPerson>
  primaryStoreId: string | null
  requestMonth: string
  requestReason: string
  storeId: string
  submissionNotice: string | null
  targetLabel: string
  t: TranslateFunction
  totalTargetValue: string
  totalsAligned: boolean
}) {
  return (
    <article className="panel" aria-label={input.t('storeApprovals.targetFormAria')}>
      <div className="panel-heading">
        <div>
          <div className="eyebrow">{input.t('storeApprovals.futureInbox')}</div>
          <h3>{input.t('storeApprovals.targetTitle')}</h3>
        </div>
        <StatusPill tone="accent">{input.t('storeApprovals.writeFlow')}</StatusPill>
      </div>

      {!input.canCreateForStore ? (
        <EmptyState
          title={input.t('storeApprovals.assignedActionStoreRequired')}
          copy={input.t('storeApprovals.targetUnavailableCopy')}
        />
      ) : (
        <div className="stacked-table">
          <div className="stacked-row">
            <label className="eyebrow" htmlFor="store-id">
              {input.t('storeApprovals.storeId')}
            </label>
            {input.assignedStoreIds.length > 1 ? (
              <select
                id="store-id"
                value={input.storeId}
                onChange={(event) => input.onStoreIdChange(event.target.value)}
              >
                {input.assignedStoreIds.map((assignedStoreId) => (
                  <option key={assignedStoreId} value={assignedStoreId}>
                    {assignedStoreId}
                  </option>
                ))}
              </select>
            ) : (
              <input
                id="store-id"
                value={input.storeId}
                onChange={(event) => input.onStoreIdChange(event.target.value)}
                placeholder={input.t('storeApprovals.scopedStoreId')}
                readOnly={Boolean(input.primaryStoreId)}
              />
            )}
          </div>

          <div className="stacked-row">
            <label className="eyebrow" htmlFor="request-month">
              {input.t('storeApprovals.requestMonth')}
            </label>
            <input
              id="request-month"
              type="month"
              value={input.requestMonth}
              onChange={(event) => input.onRequestMonthChange(event.target.value)}
            />
          </div>

          <div className="stacked-row">
            <label className="eyebrow" htmlFor="target-label">
              {input.t('storeApprovals.targetLabel')}
            </label>
            <input
              id="target-label"
              value={input.targetLabel}
              onChange={(event) => input.onTargetLabelChange(event.target.value)}
              placeholder={input.t('storeApprovals.targetLabelPlaceholder')}
            />
          </div>

          <div className="stacked-row">
            <label className="eyebrow" htmlFor="total-target-value">
              {input.t('storeApprovals.totalTargetValue')}
            </label>
            <input
              id="total-target-value"
              type="number"
              min="0"
              value={input.totalTargetValue}
              onChange={(event) => input.onTotalTargetValueChange(event.target.value)}
            />
          </div>

          <div className="stacked-row">
            <label className="eyebrow" htmlFor="request-reason">
              {input.t('storeApprovals.requestReason')}
            </label>
            <textarea
              id="request-reason"
              rows={3}
              value={input.requestReason}
              onChange={(event) => input.onRequestReasonChange(event.target.value)}
              placeholder={input.t('storeApprovals.regionNotePlaceholder')}
            />
          </div>

          <div className="stacked-row">
            <div className="stacked-row-head">
              <strong>{input.t('storeApprovals.personTargetEntry')}</strong>
              <StatusPill tone={input.totalsAligned ? 'calm' : 'warning'}>
                {`${input.allocationTotal}/${Number(input.totalTargetValue || 0)}`}
              </StatusPill>
            </div>
            {input.personnelQuery.isError ? (
              <p className="queue-subtitle">
                {getErrorMessage(input.personnelQuery.error)}
              </p>
            ) : null}
            {input.personnelQuery.isLoading ? (
              <p className="queue-subtitle">
                {input.t('storeApprovals.personnelLoading')}
              </p>
            ) : null}
            {!input.personnelQuery.isLoading && !input.personnelQuery.isError ? (
              <p className="queue-subtitle">
                {input.t('storeApprovals.personTargetCopy')}
              </p>
            ) : null}

            <div className="stacked-table">
              {input.activeAllocations.map((allocation, index) => {
                const selectedPerson = input.personnelById.get(allocation.employeeId)

                return (
                  <div className="stacked-row" key={`allocation-${allocation.employeeId || index}`}>
                    {selectedPerson ? (
                      <div className="key-grid">
                        <KeyValue
                          label={input.t('storeApprovals.personnel')}
                          value={allocation.assigneeLabel || input.t('storeApprovals.unassigned')}
                        />
                        <KeyValue
                          label={input.t('storeApprovals.currentSales')}
                          value={
                            selectedPerson.netSalesValue !== null &&
                            selectedPerson.netSalesValue !== undefined
                              ? formatNumber(selectedPerson.netSalesValue, input.locale, {
                                  currency: 'TRY',
                                  maximumFractionDigits: 0,
                                  style: 'currency',
                                })
                              : input.t('storeApprovals.noData')
                          }
                        />
                      </div>
                    ) : (
                      <select
                        value={allocation.employeeId}
                        onChange={(event) => {
                          const selected = input.personnelById.get(event.target.value)
                          input.onAllocationPersonChange(
                            index,
                            event.target.value,
                            selected?.displayName ?? '',
                          )
                        }}
                      >
                        <option value="">{input.t('storeApprovals.selectPersonnel')}</option>
                        {(input.personnelQuery.data?.items ?? []).map((person) => (
                          <option key={person.employeeId} value={person.employeeId}>
                            {person.displayName}
                          </option>
                        ))}
                      </select>
                    )}
                    <input
                      aria-label={input.t('storeApprovals.personTargetValue')}
                      type="number"
                      min="0"
                      value={allocation.targetValue}
                      onChange={(event) =>
                        input.onAllocationValueChange(index, Number(event.target.value))
                      }
                      placeholder={input.t('storeApprovals.targetValuePlaceholder')}
                    />
                    <input
                      value={allocation.note ?? ''}
                      onChange={(event) => input.onAllocationNoteChange(index, event.target.value)}
                      placeholder={input.t('storeApprovals.optionalNote')}
                    />
                    {input.activeAllocations.length > 1 ? (
                      <button
                        className="control-button"
                        type="button"
                        onClick={() => input.onRemoveAllocation(index)}
                      >
                        {input.t('storeApprovals.remove')}
                      </button>
                    ) : null}
                  </div>
                )
              })}
            </div>

            {!input.totalsAligned ? (
              <p className="queue-subtitle">
                {input.t('storeApprovals.allocationMismatch')}
              </p>
            ) : null}

            <div className="action-cluster">
              <button
                className="control-button"
                type="button"
                disabled={!input.canCreateForStore}
                onClick={input.onAddAllocation}
              >
                {input.t('storeApprovals.addAllocation')}
              </button>
            </div>
          </div>

          <div className="action-cluster">
            <button
              className="control-button"
              type="button"
              disabled={!input.canSubmit || input.isSubmitting}
              onClick={input.onSubmit}
            >
              {input.isSubmitting
                ? input.t('storeApprovals.submitting')
                : input.t('storeApprovals.submitTargetRequest')}
            </button>
          </div>

          {input.hasCreateError ? (
            <p className="queue-subtitle">{getErrorMessage(input.createError)}</p>
          ) : null}
          {input.submissionNotice ? (
            <p className="queue-subtitle">{input.submissionNotice}</p>
          ) : null}
        </div>
      )}
    </article>
  )
}

function SellerCodeRequestForm(input: {
  canCreateForStore: boolean
  canSubmit: boolean
  createError: unknown
  editingRequestId: string | null
  hasCreateError: boolean
  hasResubmitError: boolean
  isPending: boolean
  notice: string | null
  onCancelEdit: () => void
  onEmploymentTypeChange: (value: SellerEmploymentType) => void
  onFirstNameChange: StringFieldSetter
  onHireDateChange: StringFieldSetter
  onLastNameChange: StringFieldSetter
  onNationalIdChange: StringFieldSetter
  onPhoneNumberChange: StringFieldSetter
  onPositionIdChange: StringFieldSetter
  onRequestReasonChange: StringFieldSetter
  onSubmit: () => void
  positionOptionsQuery: ListQuerySnapshot<PositionOption>
  resubmitError: unknown
  sellerEmploymentType: SellerEmploymentType
  sellerFirstName: string
  sellerHireDate: string
  sellerLastName: string
  sellerNationalId: string
  sellerPhoneNumber: string
  sellerPositionId: string
  sellerRequestReason: string
  storeId: string
  t: TranslateFunction
}) {
  return (
    <article className="panel" aria-label={input.t('storeApprovals.sellerFormAria')}>
      <div className="panel-heading">
        <div>
          <div className="eyebrow">{input.t('storeApprovals.personnelRequest')}</div>
          <h3>{input.t('storeApprovals.sellerCodeTitle')}</h3>
        </div>
        <StatusPill tone="calm">{input.t('storeApprovals.hrQueue')}</StatusPill>
      </div>

      {!input.canCreateForStore ? (
        <EmptyState
          title={input.t('storeApprovals.assignedActionStoreRequired')}
          copy={input.t('storeApprovals.sellerUnavailableCopy')}
        />
      ) : (
        <div className="stacked-table">
          <div className="stacked-row">
            <label className="eyebrow" htmlFor="seller-store-id">
              {input.t('storeApprovals.storeId')}
            </label>
            <input id="seller-store-id" value={input.storeId} readOnly />
          </div>

          <div className="stacked-row">
            <label className="eyebrow" htmlFor="seller-first-name">
              {input.t('storeApprovals.firstName')}
            </label>
            <input
              id="seller-first-name"
              value={input.sellerFirstName}
              onChange={(event) => input.onFirstNameChange(event.target.value)}
              placeholder={input.t('storeApprovals.firstNamePlaceholder')}
            />
          </div>

          <div className="stacked-row">
            <label className="eyebrow" htmlFor="seller-last-name">
              {input.t('storeApprovals.lastName')}
            </label>
            <input
              id="seller-last-name"
              value={input.sellerLastName}
              onChange={(event) => input.onLastNameChange(event.target.value)}
              placeholder={input.t('storeApprovals.lastNamePlaceholder')}
            />
          </div>

          <div className="stacked-row">
            <label className="eyebrow" htmlFor="seller-position-id">
              {input.t('storeApprovals.position')}
            </label>
            <select
              id="seller-position-id"
              value={input.sellerPositionId}
              disabled={input.positionOptionsQuery.isLoading || input.positionOptionsQuery.isError}
              onChange={(event) => input.onPositionIdChange(event.target.value)}
            >
              <option value="">{input.t('storeApprovals.selectPosition')}</option>
              {(input.positionOptionsQuery.data?.items ?? []).map((position) => (
                <option key={position.positionId} value={position.positionId}>
                  {position.positionName} ({position.positionCode})
                </option>
              ))}
            </select>
            {input.positionOptionsQuery.isLoading ? (
              <p className="queue-subtitle">
                {input.t('storeApprovals.positionsLoading')}
              </p>
            ) : null}
            {input.positionOptionsQuery.isError ? (
              <p className="queue-subtitle">
                {getErrorMessage(input.positionOptionsQuery.error)}
              </p>
            ) : null}
            {!input.positionOptionsQuery.isLoading &&
            !input.positionOptionsQuery.isError &&
            (input.positionOptionsQuery.data?.items.length ?? 0) === 0 ? (
              <p className="queue-subtitle">{input.t('storeApprovals.noPositions')}</p>
            ) : null}
          </div>

          <div className="stacked-row">
            <label className="eyebrow" htmlFor="seller-national-id">
              {input.t('storeApprovals.nationalId')}
            </label>
            <input
              id="seller-national-id"
              inputMode="numeric"
              maxLength={11}
              value={input.sellerNationalId}
              onChange={(event) => input.onNationalIdChange(event.target.value)}
              placeholder="12345678901"
            />
          </div>

          <div className="stacked-row">
            <label className="eyebrow" htmlFor="seller-phone-number">
              {input.t('storeApprovals.phoneNumber')}
            </label>
            <input
              id="seller-phone-number"
              type="tel"
              value={input.sellerPhoneNumber}
              onChange={(event) => input.onPhoneNumberChange(event.target.value)}
              placeholder="05551234567"
            />
          </div>

          <div className="stacked-row">
            <label className="eyebrow" htmlFor="seller-hire-date">
              {input.t('storeApprovals.hireDate')}
            </label>
            <input
              id="seller-hire-date"
              type="date"
              value={input.sellerHireDate}
              onChange={(event) => input.onHireDateChange(event.target.value)}
            />
          </div>

          <div className="stacked-row">
            <label className="eyebrow" htmlFor="seller-employment-type">
              {input.t('storeApprovals.employmentType')}
            </label>
            <select
              id="seller-employment-type"
              value={input.sellerEmploymentType}
              onChange={(event) =>
                input.onEmploymentTypeChange(event.target.value as SellerEmploymentType)
              }
            >
              <option value="full_time">{formatEmploymentType('full_time', input.t)}</option>
              <option value="part_time">{formatEmploymentType('part_time', input.t)}</option>
              <option value="temporary">{formatEmploymentType('temporary', input.t)}</option>
            </select>
          </div>

          <div className="stacked-row">
            <label className="eyebrow" htmlFor="seller-request-reason">
              {input.t('storeApprovals.requestReason')}
            </label>
            <textarea
              id="seller-request-reason"
              rows={3}
              value={input.sellerRequestReason}
              onChange={(event) => input.onRequestReasonChange(event.target.value)}
              placeholder={input.t('storeApprovals.newPersonnelPlaceholder')}
            />
          </div>

          <div className="action-cluster">
            <button
              className="control-button"
              type="button"
              disabled={!input.canSubmit || input.isPending}
              onClick={input.onSubmit}
            >
              {input.isPending
                ? input.t('storeApprovals.submitting')
                : input.editingRequestId
                  ? input.t('storeApprovals.resubmitSellerCodeRequest')
                  : input.t('storeApprovals.submitSellerCodeRequest')}
            </button>
            {input.editingRequestId ? (
              <button
                className="control-button"
                type="button"
                disabled={input.isPending}
                onClick={input.onCancelEdit}
              >
                {input.t('storeApprovals.cancelEdit')}
              </button>
            ) : null}
          </div>

          {input.hasCreateError ? (
            <p className="queue-subtitle">{getErrorMessage(input.createError)}</p>
          ) : null}
          {input.hasResubmitError ? (
            <p className="queue-subtitle">{getErrorMessage(input.resubmitError)}</p>
          ) : null}
          {input.notice ? <p className="queue-subtitle">{input.notice}</p> : null}
        </div>
      )}
    </article>
  )
}

function OffboardingRequestForm(input: {
  canCreateForStore: boolean
  canSubmit: boolean
  createError: unknown
  editingRequestId: string | null
  hasCreateError: boolean
  hasResubmitError: boolean
  isPending: boolean
  notice: string | null
  offboardingEmployeeId: string
  offboardingRequestReason: string
  offboardingTerminationDate: string
  offboardingTerminationReason: string
  onCancelEdit: () => void
  onEmployeeIdChange: StringFieldSetter
  onRequestReasonChange: StringFieldSetter
  onSubmit: () => void
  onTerminationDateChange: StringFieldSetter
  onTerminationReasonChange: StringFieldSetter
  resubmitError: unknown
  storeEmployeesQuery: ListQuerySnapshot<StoreEmployee>
  t: TranslateFunction
}) {
  return (
    <article className="panel" aria-label={input.t('storeApprovals.offboardingFormAria')}>
      <div className="panel-heading">
        <div>
          <div className="eyebrow">{input.t('storeApprovals.personnelRequest')}</div>
          <h3>{input.t('storeApprovals.offboardingTitle')}</h3>
        </div>
        <StatusPill tone="warning">{input.t('storeApprovals.hrQueue')}</StatusPill>
      </div>

      {!input.canCreateForStore ? (
        <EmptyState
          title={input.t('storeApprovals.assignedActionStoreRequired')}
          copy={input.t('storeApprovals.offboardingUnavailableCopy')}
        />
      ) : (
        <div className="stacked-table">
          <div className="stacked-row">
            <label className="eyebrow" htmlFor="offboarding-employee-id">
              {input.t('storeApprovals.employee')}
            </label>
            <select
              id="offboarding-employee-id"
              value={input.offboardingEmployeeId}
              disabled={input.storeEmployeesQuery.isLoading || input.storeEmployeesQuery.isError}
              onChange={(event) => input.onEmployeeIdChange(event.target.value)}
            >
              <option value="">{input.t('storeApprovals.selectEmployee')}</option>
              {(input.storeEmployeesQuery.data?.items ?? []).map((employee) => (
                <option key={employee.employeeId} value={employee.employeeId}>
                  {employee.displayName} ({employee.externalEmployeeRef ?? employee.positionName})
                </option>
              ))}
            </select>
            {input.storeEmployeesQuery.isLoading ? (
              <p className="queue-subtitle">
                {input.t('storeApprovals.activePersonnelLoading')}
              </p>
            ) : null}
            {input.storeEmployeesQuery.isError ? (
              <p className="queue-subtitle">
                {getErrorMessage(input.storeEmployeesQuery.error)}
              </p>
            ) : null}
            {!input.storeEmployeesQuery.isLoading &&
            !input.storeEmployeesQuery.isError &&
            (input.storeEmployeesQuery.data?.items.length ?? 0) === 0 ? (
              <p className="queue-subtitle">{input.t('storeApprovals.noActivePersonnel')}</p>
            ) : null}
          </div>

          <div className="stacked-row">
            <label className="eyebrow" htmlFor="offboarding-termination-date">
              {input.t('storeApprovals.terminationDate')}
            </label>
            <input
              id="offboarding-termination-date"
              type="date"
              value={input.offboardingTerminationDate}
              onChange={(event) => input.onTerminationDateChange(event.target.value)}
            />
          </div>

          <div className="stacked-row">
            <label className="eyebrow" htmlFor="offboarding-termination-reason">
              {input.t('storeApprovals.terminationReason')}
            </label>
            <input
              id="offboarding-termination-reason"
              value={input.offboardingTerminationReason}
              onChange={(event) => input.onTerminationReasonChange(event.target.value)}
              placeholder={input.t('storeApprovals.resignationPlaceholder')}
            />
          </div>

          <div className="stacked-row">
            <label className="eyebrow" htmlFor="offboarding-request-reason">
              {input.t('storeApprovals.requestReason')}
            </label>
            <textarea
              id="offboarding-request-reason"
              rows={3}
              value={input.offboardingRequestReason}
              onChange={(event) => input.onRequestReasonChange(event.target.value)}
              placeholder={input.t('storeApprovals.offboardingReasonPlaceholder')}
            />
          </div>

          <div className="action-cluster">
            <button
              className="control-button"
              type="button"
              disabled={!input.canSubmit || input.isPending}
              onClick={input.onSubmit}
            >
              {input.isPending
                ? input.t('storeApprovals.submitting')
                : input.editingRequestId
                  ? input.t('storeApprovals.resubmitOffboardingRequest')
                  : input.t('storeApprovals.submitOffboardingRequest')}
            </button>
            {input.editingRequestId ? (
              <button
                className="control-button"
                type="button"
                disabled={input.isPending}
                onClick={input.onCancelEdit}
              >
                {input.t('storeApprovals.cancelEdit')}
              </button>
            ) : null}
          </div>

          {input.hasCreateError ? (
            <p className="queue-subtitle">{getErrorMessage(input.createError)}</p>
          ) : null}
          {input.hasResubmitError ? (
            <p className="queue-subtitle">{getErrorMessage(input.resubmitError)}</p>
          ) : null}
          {input.notice ? <p className="queue-subtitle">{input.notice}</p> : null}
        </div>
      )}
    </article>
  )
}

function SubmittedTargetRequestsPanel(input: {
  error: unknown
  isError: boolean
  isLoading: boolean
  locale: AppLocale
  onRetry: () => void
  requests: TargetDistributionRequest[]
  t: TranslateFunction
}) {
  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <div className="eyebrow">{input.t('storeApprovals.submittedEyebrow')}</div>
          <h3>{input.t('storeApprovals.submittedTitle')}</h3>
        </div>
      </div>

      {input.isLoading ? (
        <EmptyState
          title={input.t('storeApprovals.submittedLoadingTitle')}
          copy={input.t('storeApprovals.submittedLoadingCopy')}
        />
      ) : input.isError ? (
        <div className="empty-card">
          <strong>{input.t('storeApprovals.submittedUnavailableTitle')}</strong>
          <p>{getErrorMessage(input.error)}</p>
          <button className="control-button" type="button" onClick={input.onRetry}>
            {input.t('common.retryAction')}
          </button>
        </div>
      ) : input.requests.length === 0 ? (
        <EmptyState
          title={input.t('storeApprovals.noSubmittedTitle')}
          copy={input.t('storeApprovals.noSubmittedCopy')}
        />
      ) : (
        <div className="stacked-table">
          {input.requests.map((item) => (
            <article className="stacked-row" key={item.requestId}>
              <div className="stacked-row-head">
                <strong>{item.targetLabel}</strong>
                <StatusPill tone={item.status === 'approved' ? 'calm' : 'warning'}>
                  {formatApprovalStatus(item.status, input.t)}
                </StatusPill>
              </div>
              <p>
                {input.t('storeApprovals.targetSummary', {
                  month: formatDate(item.requestMonth, input.locale),
                  storeName: item.storeName || item.storeId,
                  value: item.totalTargetValue,
                })}
              </p>
              <div className="key-grid">
                <KeyValue
                  label={input.t('storeApprovals.allocationCount')}
                  value={String(item.allocationCount)}
                />
                <KeyValue
                  label={input.t('storeApprovals.createdAt')}
                  value={formatDateTime(item.createdAt, input.locale)}
                />
                <KeyValue
                  label={input.t('storeApprovals.approvedAt')}
                  value={
                    item.approvedAt
                      ? formatDateTime(item.approvedAt, input.locale)
                      : input.t('storeApprovals.pending')
                  }
                />
                <KeyValue label={input.t('storeApprovals.requestId')} value={item.requestId} />
              </div>
              {item.requestReason ? (
                <p className="queue-subtitle">
                  {input.t('storeApprovals.reasonPrefix', { reason: item.requestReason })}
                </p>
              ) : null}
              {item.approvalNote ? (
                <p className="queue-subtitle">
                  {input.t('storeApprovals.approvalNotePrefix', { note: item.approvalNote })}
                </p>
              ) : null}
            </article>
          ))}
        </div>
      )}
    </section>
  )
}
