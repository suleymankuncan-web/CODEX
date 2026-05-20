import { useMemo, useReducer, type ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, Clock3, ReceiptText, ShieldCheck } from 'lucide-react'
import {
  EmptyState,
  KeyValue,
  ScreenState,
  StatusPill,
} from '../components/dashboard-primitives'
import type { AuthSessionSummary } from '../features/auth/api'
import {
  canApproveTargetDistributionRequest,
  canCreateTargetDistributionRequest,
  canListTargetDistributionRequests,
  getAssignedStoreIds,
  getReadStoreIds,
} from '../features/auth/authorization'
import type { TranslateFunction } from '../features/localization/dictionary'
import { useLocalization } from '../features/localization/useLocalization'
import {
  approveTargetDistributionRequest,
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
import { formatDate, formatDateTime, getErrorMessage } from '../lib/format'
import type { AppLocale } from '../lib/i18n'
import {
  createStoreApprovalsPageState,
  formatAllocationShare,
  formatApprovalStatus,
  formatEmploymentType,
  formatTargetNumber,
  getStoreSellerPositionOptions,
  ledgerActionLabelKeys,
  resolveStoreApprovalsPersona,
  storeApprovalsPageReducer,
  type ListQuerySnapshot,
  type RequestFormAccess,
  type RequestFormErrors,
  type RequestFormSubmission,
  type StoreApprovalsLedgerPanel,
  type StoreRequestFeedbackTone,
  type StringFieldSetter,
} from './store-approvals-model'

function useStoreApprovalsPageContent(input: {
  authSummary: AuthSessionSummary | null
}) {
  const queryClient = useQueryClient()
  const { locale, t } = useLocalization()
  const user = input.authSummary?.user
  const assignedStoreIds = getAssignedStoreIds(input.authSummary)
  const readStoreIds = getReadStoreIds(input.authSummary)
  const primaryStoreId = assignedStoreIds[0] ?? null
  const persona = resolveStoreApprovalsPersona(input.authSummary)
  const canListRequests = canListTargetDistributionRequests(input.authSummary)
  const initialStoreId = primaryStoreId || ''
  const initialCanCreateForStore = canCreateTargetDistributionRequest(input.authSummary, initialStoreId || null)
  const isStoreManagerLedger = persona === 'storeManager'
  const isRegionManagerLedger = persona === 'regionManager'
  const initialShowTargetSubmission = isStoreManagerLedger && initialCanCreateForStore
  const initialShowTargetApprovalQueue = isRegionManagerLedger && canListRequests
  const [state, dispatch] = useReducer(
    storeApprovalsPageReducer,
    {
      defaultTargetLabel: t('storeApprovals.targetLabelDefault'),
      initialPanel: initialShowTargetSubmission
        ? 'targetRequest'
        : initialShowTargetApprovalQueue
          ? 'targetApproval'
          : 'submittedTargets',
    },
    createStoreApprovalsPageState,
  )
  const {
    selectedStoreId,
    requestMonth,
    targetLabel,
    totalTargetValue,
    requestReason,
    submissionNotice,
    approvalNotes,
    approvalNotice,
    activeLedgerPanel,
    sellerFirstName,
    sellerLastName,
    sellerNationalId,
    sellerPhoneNumber,
    sellerHireDate,
    sellerPositionId,
    sellerEmploymentType,
    sellerRequestReason,
    sellerRequestNotice,
    editingSellerRequestId,
    offboardingEmployeeId,
    offboardingTerminationDate,
    offboardingRequestReason,
    offboardingNotice,
    editingOffboardingRequestId,
    allocations,
  } = state
  const storeId = selectedStoreId || primaryStoreId || ''
  const canCreateForStore = canCreateTargetDistributionRequest(input.authSummary, storeId || null)
  const showTargetSubmission = isStoreManagerLedger && canCreateForStore
  const showWorkforceHrQueues = isStoreManagerLedger && canCreateForStore
  const showTargetApprovalQueue = isRegionManagerLedger && canListRequests
  const scopeKey = [
    persona,
    (user?.roleCodes ?? []).join('|'),
    readStoreIds.join('|'),
    assignedStoreIds.join('|'),
    storeId,
  ].join(':')
  const requestsQuery = useQuery({
    queryKey: ['target-distribution-requests', 'store-approvals-ledger', scopeKey],
    queryFn: () => getTargetDistributionRequests(),
    enabled: canListRequests && persona !== 'readOnly',
  })
  const personnelQuery = useQuery({
    queryKey: ['store-targeting-personnel', 'store-approvals-ledger', scopeKey],
    queryFn: () => getStoreTargetingPersonnel(storeId),
    enabled: showTargetSubmission,
  })
  const positionOptionsQuery = useQuery({
    queryKey: ['workforce-position-options', 'store-approvals-ledger', scopeKey],
    queryFn: () => getPositionOptions(storeId),
    enabled: showWorkforceHrQueues,
  })
  const storeEmployeesQuery = useQuery({
    queryKey: ['workforce-store-employees', 'store-approvals-ledger', scopeKey],
    queryFn: () => getStoreEmployees(storeId),
    enabled: showWorkforceHrQueues,
  })
  const rejectedSellerCodeRequestsQuery = useQuery({
    queryKey: ['seller-code-requests', 'rejected', 'store-approvals-ledger', scopeKey],
    queryFn: () => getSellerCodeRequests({ status: 'rejected' }),
    enabled: showWorkforceHrQueues,
  })
  const rejectedOffboardingRequestsQuery = useQuery({
    queryKey: ['offboarding-requests', 'rejected', 'store-approvals-ledger', scopeKey],
    queryFn: () => getOffboardingRequests({ status: 'rejected' }),
    enabled: showWorkforceHrQueues,
  })

  const createMutation = useMutation({
    mutationFn: createTargetDistributionRequest,
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ['target-distribution-requests'] })
      dispatch({
        type: 'resetTargetRequestSuccess',
        defaultTargetLabel: t('storeApprovals.targetLabelDefault'),
        message: result.command.message,
      })
    },
  })

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
  const approveTargetMutation = useMutation({
    mutationFn: approveTargetDistributionRequest,
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ['target-distribution-requests'] })
      dispatch({ type: 'setApprovalNotice', message: result.command.message })
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

  const activeAllocations = useMemo(() => {
    const personnel = personnelQuery.data?.items ?? []
    if (personnel.length === 0) {
      return []
    }
    const allocationsByEmployeeId = new Map<string, TargetDistributionAllocation>()
    for (const item of allocations) {
      if (!item.employeeId.trim()) continue
      allocationsByEmployeeId.set(item.employeeId, item)
    }
    return personnel.map((person) => ({
      employeeId: person.employeeId,
      assigneeLabel: person.displayName,
      targetValue: allocationsByEmployeeId.get(person.employeeId)?.targetValue ?? 0,
      note: allocationsByEmployeeId.get(person.employeeId)?.note ?? '',
    }))
  }, [allocations, personnelQuery.data?.items])

  const returnedSellerCodeRequests = rejectedSellerCodeRequestsQuery.data?.items ?? []
  const returnedOffboardingRequests = rejectedOffboardingRequestsQuery.data?.items ?? []

  const startEditingSellerRequest = (item: SellerCodeRequest) => {
    dispatch({
      type: 'loadSellerRequestEdit',
      item,
      notice: item.reviewNote
        ? t('storeApprovals.returnedSellerLoadedWithNote', { note: item.reviewNote })
        : t('storeApprovals.returnedSellerLoaded'),
    })
  }

  const startEditingOffboardingRequest = (item: OffboardingRequest) => {
    dispatch({
      type: 'loadOffboardingRequestEdit',
      item,
      notice: item.reviewNote
        ? t('storeApprovals.returnedOffboardingLoadedWithNote', { note: item.reviewNote })
        : t('storeApprovals.returnedOffboardingLoaded'),
    })
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
  const pendingTargetRequests = requests.filter((item) => item.status === 'pending_region_approval')
  const submittedTargetRequests = showTargetApprovalQueue
    ? requests.filter((item) => item.status !== 'pending_region_approval')
    : requests
  const pendingCount = pendingTargetRequests.length
  const approvedCount = requests.filter((item) => item.status === 'approved').length
  const returnedWorkforceCount =
    returnedSellerCodeRequests.length + returnedOffboardingRequests.length
  const allocationTotal = activeAllocations.reduce((sum, item) => sum + Number(item.targetValue || 0), 0)
  const totalTargetNumber = Number(totalTargetValue || 0)
  const totalsAligned = allocationTotal === totalTargetNumber
  const canSubmit =
    showTargetSubmission &&
    Boolean(storeId) &&
    Boolean(targetLabel.trim()) &&
    totalTargetNumber > 0 &&
    totalsAligned &&
    activeAllocations.length > 0 &&
    activeAllocations.every(
      (item) => item.employeeId.trim() && item.assigneeLabel.trim() && Number(item.targetValue) > 0,
    )
  const canSubmitSellerCodeRequest =
    showWorkforceHrQueues &&
    Boolean(storeId) &&
    Boolean(sellerFirstName.trim()) &&
    Boolean(sellerLastName.trim()) &&
    /^[0-9]{11}$/.test(sellerNationalId.trim()) &&
    Boolean(sellerPhoneNumber.trim()) &&
    Boolean(sellerHireDate) &&
    Boolean(sellerPositionId.trim())
  const canSubmitOffboardingRequest =
    showWorkforceHrQueues &&
    Boolean(storeId) &&
    Boolean(offboardingEmployeeId.trim()) &&
    Boolean(offboardingTerminationDate) &&
    Boolean(offboardingRequestReason.trim())
  const sellerRequestPending = sellerCodeMutation.isPending || resubmitSellerCodeMutation.isPending
  const offboardingRequestPending = offboardingMutation.isPending || resubmitOffboardingMutation.isPending
  const updateTargetAllocationValue = (index: number, targetValue: number) => {
    dispatch({
      type: 'replaceAllocations',
      allocations: activeAllocations.map((item, itemIndex) =>
        itemIndex === index ? { ...item, targetValue } : item,
      ),
    })
  }
  const updateTargetAllocationNote = (index: number, note: string) => {
    dispatch({
      type: 'replaceAllocations',
      allocations: activeAllocations.map((item, itemIndex) =>
        itemIndex === index ? { ...item, note } : item,
      ),
    })
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
    dispatch({ type: 'cancelSellerRequestEdit' })
  }
  const submitOffboardingRequest = () => {
    const requestReason = offboardingRequestReason.trim()
    const payload = {
      employeeId: offboardingEmployeeId,
      terminationDate: offboardingTerminationDate,
      terminationReason: requestReason.slice(0, 80),
      requestReason,
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
    dispatch({ type: 'cancelOffboardingRequestEdit' })
  }
  const approveTargetRequest = (request: TargetDistributionRequest) => {
    const canApprove = canApproveTargetDistributionRequest(input.authSummary, request.storeId)

    if (!canApprove) {
      return
    }

    approveTargetMutation.mutate({
      requestId: request.requestId,
      approvalNote: approvalNotes[request.requestId] || undefined,
    })
  }

  return (
    <section
      className="store-approvals-ledger-page"
      aria-labelledby="store-approvals-ledger-title"
      data-testid="store-approvals-ledger"
    >
      <StoreApprovalsHeader
        isRegionManagerLedger={isRegionManagerLedger}
        isStoreManagerLedger={isStoreManagerLedger}
        t={t}
      />

      <StoreApprovalsMetrics
        approvedCount={approvedCount}
        pendingCount={pendingCount}
        personnelCount={personnelQuery.data?.items.length ?? 0}
        returnedWorkforceCount={returnedWorkforceCount}
        showTargetApprovalQueue={showTargetApprovalQueue}
        showTargetSubmission={showTargetSubmission}
        showWorkforceHrQueues={showWorkforceHrQueues}
        t={t}
      />

      <StoreApprovalsWorkbench
        activeLedgerPanel={activeLedgerPanel}
        approvals={{
          approvalNotes,
          approvalNotice,
          approvingRequestId: approveTargetMutation.variables?.requestId ?? null,
          pendingRequests: pendingTargetRequests,
          isApproving: approveTargetMutation.isPending,
        }}
        locale={locale}
        panels={{
          showTargetApprovalQueue,
          showTargetSubmission,
          showWorkforceHrQueues,
        }}
        returnedRequests={{
          hasOffboardingRequestsError: rejectedOffboardingRequestsQuery.isError,
          hasSellerCodeRequestsError: rejectedSellerCodeRequestsQuery.isError,
          offboardingRequestsError: rejectedOffboardingRequestsQuery.error,
          returnedOffboardingRequests,
          returnedSellerCodeRequests,
          sellerCodeRequestsError: rejectedSellerCodeRequestsQuery.error,
        }}
        sellerCodeRequest={{
          editingRequestId: editingSellerRequestId,
          errors: {
            create: sellerCodeMutation.error,
            createVisible: sellerCodeMutation.isError,
            resubmit: resubmitSellerCodeMutation.error,
            resubmitVisible: resubmitSellerCodeMutation.isError,
          },
          positionOptionsQuery,
          sellerEmploymentType,
          sellerFirstName,
          sellerHireDate,
          sellerLastName,
          sellerNationalId,
          sellerPhoneNumber,
          sellerPositionId,
          sellerRequestReason,
          submission: {
            notice: sellerRequestNotice,
            pending: sellerRequestPending,
          },
          submitAllowed: canSubmitSellerCodeRequest,
        }}
        offboardingRequest={{
          editingRequestId: editingOffboardingRequestId,
          errors: {
            create: offboardingMutation.error,
            createVisible: offboardingMutation.isError,
            resubmit: resubmitOffboardingMutation.error,
            resubmitVisible: resubmitOffboardingMutation.isError,
          },
          offboardingEmployeeId,
          offboardingRequestReason,
          offboardingTerminationDate,
          storeEmployeesQuery,
          submission: {
            notice: offboardingNotice,
            pending: offboardingRequestPending,
          },
          submitAllowed: canSubmitOffboardingRequest,
        }}
        submittedTargetRequests={submittedTargetRequests}
        targetRequest={{
          activeAllocations,
          allocationTotal,
          assignedStoreIds,
          errors: {
            create: createMutation.error,
            createVisible: createMutation.isError,
          },
          personnelQuery,
          primaryStoreId,
          requestMonth,
          requestReason,
          storeId,
          submission: {
            notice: submissionNotice,
            pending: createMutation.isPending,
          },
          submitAllowed: canSubmit,
          targetLabel,
          totalTargetValue,
          totalsAligned,
        }}
        t={t}
        onActivePanelChange={(panel) => dispatch({ type: 'setActiveLedgerPanel', panel })}
        onAllocationNoteChange={updateTargetAllocationNote}
        onAllocationValueChange={updateTargetAllocationValue}
        onApproveTargetRequest={approveTargetRequest}
        onApprovalNoteChange={(requestId, value) =>
          dispatch({ type: 'setApprovalNote', requestId, value })
        }
        onCancelOffboardingEdit={cancelOffboardingRequestEdit}
        onCancelSellerEdit={cancelSellerRequestEdit}
        onEditOffboardingRequest={startEditingOffboardingRequest}
        onEditSellerCodeRequest={startEditingSellerRequest}
        onOffboardingEmployeeIdChange={(value) =>
          dispatch({ type: 'setOffboardingEmployeeId', value })
        }
        onOffboardingRequestReasonChange={(value) =>
          dispatch({ type: 'setOffboardingRequestReason', value })
        }
        onOffboardingTerminationDateChange={(value) =>
          dispatch({ type: 'setOffboardingTerminationDate', value })
        }
        onRequestMonthChange={(value) => dispatch({ type: 'setRequestMonth', value })}
        onRequestReasonChange={(value) => dispatch({ type: 'setRequestReason', value })}
        onSellerEmploymentTypeChange={(value) =>
          dispatch({ type: 'setSellerEmploymentType', value })
        }
        onSellerFirstNameChange={(value) => dispatch({ type: 'setSellerFirstName', value })}
        onSellerHireDateChange={(value) => dispatch({ type: 'setSellerHireDate', value })}
        onSellerLastNameChange={(value) => dispatch({ type: 'setSellerLastName', value })}
        onSellerNationalIdChange={(value) => dispatch({ type: 'setSellerNationalId', value })}
        onSellerPhoneNumberChange={(value) => dispatch({ type: 'setSellerPhoneNumber', value })}
        onSellerPositionIdChange={(value) => dispatch({ type: 'setSellerPositionId', value })}
        onSellerRequestReasonChange={(value) =>
          dispatch({ type: 'setSellerRequestReason', value })
        }
        onStoreIdChange={(value) => dispatch({ type: 'setSelectedStoreId', value })}
        onSubmitOffboardingRequest={submitOffboardingRequest}
        onSubmitSellerCodeRequest={submitSellerCodeRequest}
        onSubmitTargetRequest={submitTargetDistributionRequest}
        onTargetLabelChange={(value) => dispatch({ type: 'setTargetLabel', value })}
        onTotalTargetValueChange={(value) => dispatch({ type: 'setTotalTargetValue', value })}
        canApproveRequest={(request) =>
          canApproveTargetDistributionRequest(input.authSummary, request.storeId)
        }
      />
    </section>
  )
}

export function StoreApprovalsPage(input: {
  authSummary: AuthSessionSummary | null
}) {
  return useStoreApprovalsPageContent(input)
}

function StoreApprovalsHeader(input: {
  isRegionManagerLedger: boolean
  isStoreManagerLedger: boolean
  t: TranslateFunction
}) {
  return (
    <header className="store-approvals-ledger-header">
      <div>
        <div className="store-approvals-ledger-eyebrow">
          {input.t('storeApprovals.ledgerEyebrow')}
        </div>
        <h2 id="store-approvals-ledger-title">
          {input.t('storeApprovals.ledgerTitle')}
        </h2>
        <p>
          {input.isRegionManagerLedger
            ? input.t('storeApprovals.regionManagerSubtitle')
            : input.isStoreManagerLedger
              ? input.t('storeApprovals.storeManagerSubtitle')
              : input.t('storeApprovals.readOnlySubtitle')}
        </p>
      </div>
    </header>
  )
}

function StoreApprovalsMetrics(input: {
  approvedCount: number
  pendingCount: number
  personnelCount: number
  returnedWorkforceCount: number
  showTargetApprovalQueue: boolean
  showTargetSubmission: boolean
  showWorkforceHrQueues: boolean
  t: TranslateFunction
}) {
  return (
    <section
      className="store-approvals-ledger-metrics"
      aria-label={input.t('storeApprovals.ledgerMetrics')}
    >
      <LedgerMetric
        icon={<ReceiptText size={18} />}
        label={input.t('storeApprovals.pendingApprovals')}
        note={input.t('storeApprovals.pendingApprovalsNote')}
        value={String(input.pendingCount)}
      />
      <LedgerMetric
        icon={<ShieldCheck size={18} />}
        label={input.t('storeApprovals.approvalIntent')}
        note={
          input.showTargetApprovalQueue
            ? input.t('storeApprovals.targetApprovalQueueTitle')
            : input.t('storeApprovals.approvalIntentNote')
        }
        value={input.showTargetSubmission || input.showTargetApprovalQueue ? '1' : '0'}
      />
      <LedgerMetric
        icon={<Clock3 size={18} />}
        label={input.t('storeApprovals.approvedRequests')}
        note={input.t('storeApprovals.approvedRequestsNote')}
        value={String(input.approvedCount)}
      />
      <LedgerMetric
        icon={<CheckCircle2 size={18} />}
        label={
          input.showWorkforceHrQueues
            ? input.t('storeApprovals.ledgerReturnedCorrections')
            : input.t('storeApprovals.storePersonnel')
        }
        note={
          input.showWorkforceHrQueues
            ? input.t('storeApprovals.workforceQueueTitle')
            : input.t('storeApprovals.regionReviewCopy')
        }
        value={
          input.showWorkforceHrQueues
            ? String(input.returnedWorkforceCount)
            : String(input.personnelCount)
        }
      />
    </section>
  )
}

type StoreApprovalsWorkbenchInput = {
  activeLedgerPanel: StoreApprovalsLedgerPanel
  approvals: {
    approvalNotes: Record<string, string>
    approvalNotice: string | null
    approvingRequestId: string | null
    isApproving: boolean
    pendingRequests: TargetDistributionRequest[]
  }
  canApproveRequest: (request: TargetDistributionRequest) => boolean
  locale: AppLocale
  panels: {
    showTargetApprovalQueue: boolean
    showTargetSubmission: boolean
    showWorkforceHrQueues: boolean
  }
  returnedRequests: {
    hasOffboardingRequestsError: boolean
    hasSellerCodeRequestsError: boolean
    offboardingRequestsError: unknown
    returnedOffboardingRequests: OffboardingRequest[]
    returnedSellerCodeRequests: SellerCodeRequest[]
    sellerCodeRequestsError: unknown
  }
  sellerCodeRequest: {
    editingRequestId: string | null
    errors: RequestFormErrors
    positionOptionsQuery: ListQuerySnapshot<PositionOption>
    sellerEmploymentType: SellerEmploymentType
    sellerFirstName: string
    sellerHireDate: string
    sellerLastName: string
    sellerNationalId: string
    sellerPhoneNumber: string
    sellerPositionId: string
    sellerRequestReason: string
    submission: RequestFormSubmission
    submitAllowed: boolean
  }
  offboardingRequest: {
    editingRequestId: string | null
    errors: RequestFormErrors
    offboardingEmployeeId: string
    offboardingRequestReason: string
    offboardingTerminationDate: string
    storeEmployeesQuery: ListQuerySnapshot<StoreEmployee>
    submission: RequestFormSubmission
    submitAllowed: boolean
  }
  submittedTargetRequests: TargetDistributionRequest[]
  targetRequest: {
    activeAllocations: TargetDistributionAllocation[]
    allocationTotal: number
    assignedStoreIds: string[]
    errors: RequestFormErrors
    personnelQuery: ListQuerySnapshot<StoreTargetingPerson>
    primaryStoreId: string | null
    requestMonth: string
    requestReason: string
    storeId: string
    submission: RequestFormSubmission
    submitAllowed: boolean
    targetLabel: string
    totalTargetValue: string
    totalsAligned: boolean
  }
  t: TranslateFunction
  onActivePanelChange: (panel: StoreApprovalsLedgerPanel) => void
  onAllocationNoteChange: (index: number, value: string) => void
  onAllocationValueChange: (index: number, targetValue: number) => void
  onApprovalNoteChange: (requestId: string, value: string) => void
  onApproveTargetRequest: (request: TargetDistributionRequest) => void
  onCancelOffboardingEdit: () => void
  onCancelSellerEdit: () => void
  onEditOffboardingRequest: (item: OffboardingRequest) => void
  onEditSellerCodeRequest: (item: SellerCodeRequest) => void
  onOffboardingEmployeeIdChange: StringFieldSetter
  onOffboardingRequestReasonChange: StringFieldSetter
  onOffboardingTerminationDateChange: StringFieldSetter
  onRequestMonthChange: StringFieldSetter
  onRequestReasonChange: StringFieldSetter
  onSellerEmploymentTypeChange: (value: SellerEmploymentType) => void
  onSellerFirstNameChange: StringFieldSetter
  onSellerHireDateChange: StringFieldSetter
  onSellerLastNameChange: StringFieldSetter
  onSellerNationalIdChange: StringFieldSetter
  onSellerPhoneNumberChange: StringFieldSetter
  onSellerPositionIdChange: StringFieldSetter
  onSellerRequestReasonChange: StringFieldSetter
  onStoreIdChange: StringFieldSetter
  onSubmitOffboardingRequest: () => void
  onSubmitSellerCodeRequest: () => void
  onSubmitTargetRequest: () => void
  onTargetLabelChange: StringFieldSetter
  onTotalTargetValueChange: StringFieldSetter
}

function StoreApprovalsWorkbench(input: StoreApprovalsWorkbenchInput) {
  const getLedgerActionButtonClass = (panel: StoreApprovalsLedgerPanel) =>
    input.activeLedgerPanel === panel
      ? 'store-approvals-action-tab store-approvals-action-tab-active'
      : 'store-approvals-action-tab'

  return (
    <section
      className="store-approvals-ledger-inspector"
      aria-label={input.t('storeApprovals.ledgerInspectorAria')}
    >
      <aside className="store-approvals-action-workbench">
        <div className="store-approvals-action-head">
          <div>
            <div className="store-approvals-ledger-eyebrow">
              {input.t('storeApprovals.liveRequestFlow')}
            </div>
            <strong className="store-approvals-action-title">
              {input.t(ledgerActionLabelKeys[input.activeLedgerPanel])}
            </strong>
          </div>
          <StatusPill tone="calm">
            {input.t('storeApprovals.ledgerDetailStatus')}
          </StatusPill>
        </div>

        <div className="store-approvals-action-tabs" aria-label={input.t('storeApprovals.ledgerInspectorAria')}>
          {input.panels.showTargetSubmission ? (
            <button
              className={getLedgerActionButtonClass('targetRequest')}
              type="button"
              aria-pressed={input.activeLedgerPanel === 'targetRequest'}
              onClick={() => input.onActivePanelChange('targetRequest')}
            >
              {input.t('storeApprovals.openTargetRequest')}
            </button>
          ) : null}
          {input.panels.showTargetApprovalQueue ? (
            <button
              className={getLedgerActionButtonClass('targetApproval')}
              type="button"
              aria-pressed={input.activeLedgerPanel === 'targetApproval'}
              onClick={() => input.onActivePanelChange('targetApproval')}
            >
              {input.t('storeApprovals.openTargetApprovalQueue')}
            </button>
          ) : null}
          <button
            className={getLedgerActionButtonClass('submittedTargets')}
            type="button"
            aria-pressed={input.activeLedgerPanel === 'submittedTargets'}
            onClick={() => input.onActivePanelChange('submittedTargets')}
          >
            {input.t('storeApprovals.openSubmittedTargets')}
          </button>
          {input.panels.showWorkforceHrQueues ? (
            <>
              <button
                className={getLedgerActionButtonClass('sellerCodeRequest')}
                type="button"
                aria-pressed={input.activeLedgerPanel === 'sellerCodeRequest'}
                onClick={() => input.onActivePanelChange('sellerCodeRequest')}
              >
                {input.t('storeApprovals.openSellerCodeRequest')}
              </button>
              <button
                className={getLedgerActionButtonClass('offboardingRequest')}
                type="button"
                aria-pressed={input.activeLedgerPanel === 'offboardingRequest'}
                onClick={() => input.onActivePanelChange('offboardingRequest')}
              >
                {input.t('storeApprovals.openOffboardingRequest')}
              </button>
              <button
                className={getLedgerActionButtonClass('returnedRequests')}
                type="button"
                aria-pressed={input.activeLedgerPanel === 'returnedRequests'}
                onClick={() => input.onActivePanelChange('returnedRequests')}
              >
                {input.t('storeApprovals.openReturnedRequests')}
              </button>
            </>
          ) : null}
        </div>

        <div className="store-approvals-action-panel">
          {input.activeLedgerPanel === 'targetRequest' && input.panels.showTargetSubmission ? (
            <TargetDistributionRequestForm
              access={{
                createAllowed: input.panels.showTargetSubmission,
                submitAllowed: input.targetRequest.submitAllowed,
              }}
              activeAllocations={input.targetRequest.activeAllocations}
              allocationTotal={input.targetRequest.allocationTotal}
              assignedStoreIds={input.targetRequest.assignedStoreIds}
              errors={input.targetRequest.errors}
              locale={input.locale}
              onAllocationNoteChange={input.onAllocationNoteChange}
              onAllocationValueChange={input.onAllocationValueChange}
              onRequestMonthChange={input.onRequestMonthChange}
              onRequestReasonChange={input.onRequestReasonChange}
              onStoreIdChange={input.onStoreIdChange}
              onSubmit={input.onSubmitTargetRequest}
              onTargetLabelChange={input.onTargetLabelChange}
              onTotalTargetValueChange={input.onTotalTargetValueChange}
              personnelQuery={input.targetRequest.personnelQuery}
              primaryStoreId={input.targetRequest.primaryStoreId}
              requestMonth={input.targetRequest.requestMonth}
              requestReason={input.targetRequest.requestReason}
              storeId={input.targetRequest.storeId}
              submission={input.targetRequest.submission}
              targetLabel={input.targetRequest.targetLabel}
              t={input.t}
              totalTargetValue={input.targetRequest.totalTargetValue}
              totalsAligned={input.targetRequest.totalsAligned}
            />
          ) : null}

          {input.activeLedgerPanel === 'targetApproval' && input.panels.showTargetApprovalQueue ? (
            <TargetApprovalLedger
              approvalNotes={input.approvals.approvalNotes}
              approvalNotice={input.approvals.approvalNotice}
              approvingRequestId={input.approvals.approvingRequestId}
              isApproving={input.approvals.isApproving}
              locale={input.locale}
              onApprovalNoteChange={input.onApprovalNoteChange}
              onApprove={input.onApproveTargetRequest}
              requests={input.approvals.pendingRequests}
              t={input.t}
              canApproveRequest={input.canApproveRequest}
            />
          ) : null}

          {input.activeLedgerPanel === 'submittedTargets' ? (
            <SubmittedTargetRequestsPanel
              locale={input.locale}
              requests={input.submittedTargetRequests}
              t={input.t}
            />
          ) : null}

          {input.activeLedgerPanel === 'returnedRequests' && input.panels.showWorkforceHrQueues ? (
            <ReturnedRequestsPanel
              locale={input.locale}
              returnedOffboardingRequests={input.returnedRequests.returnedOffboardingRequests}
              returnedSellerCodeRequests={input.returnedRequests.returnedSellerCodeRequests}
              sellerCodeRequestsError={input.returnedRequests.sellerCodeRequestsError}
              hasSellerCodeRequestsError={input.returnedRequests.hasSellerCodeRequestsError}
              offboardingRequestsError={input.returnedRequests.offboardingRequestsError}
              hasOffboardingRequestsError={input.returnedRequests.hasOffboardingRequestsError}
              onEditOffboardingRequest={input.onEditOffboardingRequest}
              onEditSellerCodeRequest={input.onEditSellerCodeRequest}
              t={input.t}
            />
          ) : null}

          {input.activeLedgerPanel === 'sellerCodeRequest' && input.panels.showWorkforceHrQueues ? (
            <SellerCodeRequestForm
              access={{
                createAllowed: input.panels.showWorkforceHrQueues,
                submitAllowed: input.sellerCodeRequest.submitAllowed,
              }}
              editingRequestId={input.sellerCodeRequest.editingRequestId}
              errors={input.sellerCodeRequest.errors}
              onCancelEdit={input.onCancelSellerEdit}
              onEmploymentTypeChange={input.onSellerEmploymentTypeChange}
              onFirstNameChange={input.onSellerFirstNameChange}
              onHireDateChange={input.onSellerHireDateChange}
              onLastNameChange={input.onSellerLastNameChange}
              onNationalIdChange={input.onSellerNationalIdChange}
              onPhoneNumberChange={input.onSellerPhoneNumberChange}
              onPositionIdChange={input.onSellerPositionIdChange}
              onRequestReasonChange={input.onSellerRequestReasonChange}
              onSubmit={input.onSubmitSellerCodeRequest}
              positionOptionsQuery={input.sellerCodeRequest.positionOptionsQuery}
              sellerEmploymentType={input.sellerCodeRequest.sellerEmploymentType}
              sellerFirstName={input.sellerCodeRequest.sellerFirstName}
              sellerHireDate={input.sellerCodeRequest.sellerHireDate}
              sellerLastName={input.sellerCodeRequest.sellerLastName}
              sellerNationalId={input.sellerCodeRequest.sellerNationalId}
              sellerPhoneNumber={input.sellerCodeRequest.sellerPhoneNumber}
              sellerPositionId={input.sellerCodeRequest.sellerPositionId}
              sellerRequestReason={input.sellerCodeRequest.sellerRequestReason}
              submission={input.sellerCodeRequest.submission}
              storeId={input.targetRequest.storeId}
              t={input.t}
            />
          ) : null}

          {input.activeLedgerPanel === 'offboardingRequest' && input.panels.showWorkforceHrQueues ? (
            <OffboardingRequestForm
              access={{
                createAllowed: input.panels.showWorkforceHrQueues,
                submitAllowed: input.offboardingRequest.submitAllowed,
              }}
              editingRequestId={input.offboardingRequest.editingRequestId}
              errors={input.offboardingRequest.errors}
              offboardingEmployeeId={input.offboardingRequest.offboardingEmployeeId}
              offboardingRequestReason={input.offboardingRequest.offboardingRequestReason}
              offboardingTerminationDate={input.offboardingRequest.offboardingTerminationDate}
              onCancelEdit={input.onCancelOffboardingEdit}
              onEmployeeIdChange={input.onOffboardingEmployeeIdChange}
              onRequestReasonChange={input.onOffboardingRequestReasonChange}
              onSubmit={input.onSubmitOffboardingRequest}
              onTerminationDateChange={input.onOffboardingTerminationDateChange}
              submission={input.offboardingRequest.submission}
              storeEmployeesQuery={input.offboardingRequest.storeEmployeesQuery}
              t={input.t}
            />
          ) : null}
        </div>
      </aside>
    </section>
  )
}

function LedgerMetric(input: {
  icon: ReactNode
  label: string
  note: string
  value: string
}) {
  return (
    <article className="store-approvals-ledger-metric">
      <span className="store-approvals-ledger-metric-icon">{input.icon}</span>
      <span>{input.label}</span>
      <strong>{input.value}</strong>
      <small>{input.note}</small>
    </article>
  )
}

function TargetApprovalLedger(input: {
  approvalNotes: Record<string, string>
  approvalNotice: string | null
  approvingRequestId: string | null
  canApproveRequest: (request: TargetDistributionRequest) => boolean
  isApproving: boolean
  locale: AppLocale
  onApprovalNoteChange: (requestId: string, value: string) => void
  onApprove: (request: TargetDistributionRequest) => void
  requests: TargetDistributionRequest[]
  t: TranslateFunction
}) {
  return (
    <section
      className="store-approvals-ledger-card"
      aria-label={input.t('storeApprovals.targetApprovalQueueTitle')}
    >
      <div className="store-approvals-ledger-card-head">
        <div>
          <div className="store-approvals-ledger-eyebrow">
            {input.t('storeApprovals.ledgerStatus')}
          </div>
          <h3>{input.t('storeApprovals.targetApprovalQueueTitle')}</h3>
        </div>
        <StatusPill tone={input.requests.length > 0 ? 'warning' : 'calm'}>
          {String(input.requests.length)}
        </StatusPill>
      </div>

      {input.requests.length === 0 ? (
        <EmptyState
          title={input.t('storeApprovals.targetApprovalEmptyTitle')}
          copy={input.t('storeApprovals.targetApprovalEmptyCopy')}
        />
      ) : (
        <div className="store-approvals-ledger-rows">
          {input.requests.map((item) => {
            const canApprove = input.canApproveRequest(item)

            return (
              <article className="store-approvals-ledger-row" key={item.requestId}>
                <div className="store-approvals-ledger-row-head">
                  <div>
                    <strong>{item.targetLabel}</strong>
                    <p className="store-approvals-ledger-row-note">
                      {input.t('storeApprovals.targetSummary', {
                        month: formatDate(item.requestMonth, input.locale),
                        storeName: item.storeName || item.storeId,
                        value: item.totalTargetValue,
                      })}
                    </p>
                  </div>
                  <StatusPill tone="warning">
                    {formatApprovalStatus(item.status, input.t)}
                  </StatusPill>
                </div>
                <div className="store-approvals-ledger-key-grid">
                  <KeyValue
                    label={input.t('storeApprovals.allocationCount')}
                    value={String(item.allocationCount)}
                  />
                  <KeyValue
                    label={input.t('storeApprovals.createdAt')}
                    value={formatDateTime(item.createdAt, input.locale)}
                  />
                  <KeyValue
                    label={input.t('storeApprovals.userId')}
                    value={item.submittedByUserId}
                  />
                  <KeyValue label={input.t('storeApprovals.requestId')} value={item.requestId} />
                </div>
                {item.requestReason ? (
                  <p className="store-approvals-ledger-row-note">
                    {input.t('storeApprovals.reasonPrefix', { reason: item.requestReason })}
                  </p>
                ) : null}
                <TargetAllocationBreakdown
                  allocations={item.allocations}
                  locale={input.locale}
                  totalTargetValue={item.totalTargetValue}
                />
                <label
                  className="store-approvals-ledger-label"
                  htmlFor={`store-approval-note-${item.requestId}`}
                >
                  {input.t('storeApprovals.approvalNote')}
                </label>
                <textarea
                  id={`store-approval-note-${item.requestId}`}
                  value={input.approvalNotes[item.requestId] ?? ''}
                  onChange={(event) =>
                    input.onApprovalNoteChange(item.requestId, event.target.value)
                  }
                  rows={3}
                  placeholder={input.t('storeApprovals.approvalNotePlaceholder')}
                  disabled={!canApprove}
                />
                <div className="store-approvals-ledger-actions">
                  <button
                    className="store-approvals-ledger-button"
                    type="button"
                    disabled={
                      !canApprove ||
                      (input.isApproving && input.approvingRequestId === item.requestId)
                    }
                    onClick={() => input.onApprove(item)}
                  >
                    {input.isApproving && input.approvingRequestId === item.requestId
                      ? input.t('storeApprovals.approving')
                      : input.t('storeApprovals.approveTargetRequest')}
                  </button>
                  {!canApprove ? (
                    <span className="store-approvals-ledger-row-note">
                      {input.t('storeApprovals.cannotApproveStore')}
                    </span>
                  ) : null}
                </div>
              </article>
            )
          })}
        </div>
      )}

      {input.approvalNotice ? (
        <StoreRequestFeedback tone="success" className="store-approvals-ledger-feedback">
          {input.approvalNotice}
        </StoreRequestFeedback>
      ) : null}
    </section>
  )
}

function TargetAllocationBreakdown(input: {
  allocations: TargetDistributionAllocation[]
  locale: AppLocale
  totalTargetValue: number
}) {
  if (!input.allocations.length) {
    return null
  }

  return (
    <div className="store-target-allocation-breakdown">
      {input.allocations.map((allocation) => {
        const targetValue = Number(allocation.targetValue || 0)

        return (
          <div
            className="store-target-allocation-breakdown-row"
            key={`${allocation.employeeId}-${allocation.assigneeLabel}`}
          >
            <strong>{allocation.assigneeLabel}</strong>
            <span>{formatTargetNumber(targetValue, input.locale)}</span>
            <span>{formatAllocationShare(targetValue, input.totalTargetValue, input.locale)}</span>
            {allocation.note ? <small>{allocation.note}</small> : null}
          </div>
        )
      })}
    </div>
  )
}

function StoreRequestFeedback(input: {
  children: ReactNode
  className?: string
  tone: StoreRequestFeedbackTone
}) {
  const role = input.tone === 'error' ? 'alert' : 'status'
  const ariaLive = input.tone === 'error' ? 'assertive' : 'polite'
  const className = [
    'store-request-feedback',
    `store-request-feedback-${input.tone}`,
    input.className,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <p className={className} role={role} aria-live={ariaLive}>
      {input.children}
    </p>
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
  const hasReturnedRequestError =
    input.hasSellerCodeRequestsError || input.hasOffboardingRequestsError

  return (
    <section
      className="store-approvals-ledger-card"
      aria-label={input.t('storeApprovals.returnedAria')}
    >
      <div className="store-approvals-ledger-card-head">
        <div>
          <div className="store-approvals-ledger-eyebrow">
            {input.t('storeApprovals.returnedEyebrow')}
          </div>
          <h3>{input.t('storeApprovals.returnedTitle')}</h3>
        </div>
        <StatusPill tone={returnedRequestCount > 0 ? 'warning' : 'calm'}>
          {String(returnedRequestCount)}
        </StatusPill>
      </div>

      {hasReturnedRequestError ? (
        <>
          {input.hasSellerCodeRequestsError ? (
            <StoreRequestFeedback tone="error" className="store-approvals-ledger-feedback">
              {getErrorMessage(input.sellerCodeRequestsError)}
            </StoreRequestFeedback>
          ) : null}
          {input.hasOffboardingRequestsError ? (
            <StoreRequestFeedback tone="error" className="store-approvals-ledger-feedback">
              {getErrorMessage(input.offboardingRequestsError)}
            </StoreRequestFeedback>
          ) : null}
        </>
      ) : returnedRequestCount === 0 ? (
        <EmptyState
          title={input.t('storeApprovals.returnedEmptyTitle')}
          copy={input.t('storeApprovals.returnedEmptyCopy')}
        />
      ) : (
        <div className="store-approvals-ledger-rows">
          {input.returnedSellerCodeRequests.map((item) => (
            <article className="store-approvals-ledger-row" key={item.requestId}>
              <div className="store-approvals-ledger-row-head">
                <div>
                  <strong>{`${item.firstName} ${item.lastName}`.trim()}</strong>
                  <p className="store-approvals-ledger-row-note">
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
              <div className="store-approvals-ledger-key-grid">
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
              <div className="store-approvals-ledger-actions">
                <button
                  className="store-approvals-ledger-button"
                  type="button"
                  onClick={() => input.onEditSellerCodeRequest(item)}
                >
                  {input.t('storeApprovals.editSellerCodeRequest')}
                </button>
              </div>
            </article>
          ))}

          {input.returnedOffboardingRequests.map((item) => (
            <article className="store-approvals-ledger-row" key={item.requestId}>
              <div className="store-approvals-ledger-row-head">
                <div>
                  <strong>{item.displayName}</strong>
                  <p className="store-approvals-ledger-row-note">
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
              <div className="store-approvals-ledger-key-grid">
                <KeyValue
                  label={input.t('storeApprovals.terminationDate')}
                  value={formatDate(item.terminationDate, input.locale)}
                />
                <KeyValue
                  label={input.t('storeApprovals.requestReason')}
                  value={item.requestReason ?? input.t('storeApprovals.noNote')}
                />
                <KeyValue
                  label={input.t('storeApprovals.reviewNote')}
                  value={item.reviewNote ?? input.t('storeApprovals.noNote')}
                />
                <KeyValue label={input.t('storeApprovals.requestId')} value={item.requestId} />
              </div>
              <div className="store-approvals-ledger-actions">
                <button
                  className="store-approvals-ledger-button"
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
  access: RequestFormAccess
  activeAllocations: TargetDistributionAllocation[]
  allocationTotal: number
  assignedStoreIds: string[]
  errors: RequestFormErrors
  locale: AppLocale
  onAllocationNoteChange: (index: number, value: string) => void
  onAllocationValueChange: (index: number, targetValue: number) => void
  onRequestMonthChange: StringFieldSetter
  onRequestReasonChange: StringFieldSetter
  onStoreIdChange: StringFieldSetter
  onSubmit: () => void
  onTargetLabelChange: StringFieldSetter
  onTotalTargetValueChange: StringFieldSetter
  personnelQuery: ListQuerySnapshot<StoreTargetingPerson>
  primaryStoreId: string | null
  requestMonth: string
  requestReason: string
  storeId: string
  submission: RequestFormSubmission
  targetLabel: string
  t: TranslateFunction
  totalTargetValue: string
  totalsAligned: boolean
}) {
  const totalTargetNumber = Number(input.totalTargetValue || 0)
  const remainingTargetValue = totalTargetNumber - input.allocationTotal
  const completionShare = formatAllocationShare(
    input.allocationTotal,
    totalTargetNumber,
    input.locale,
  )

  return (
    <article
      className="store-request-sheet"
      aria-label={input.t('storeApprovals.targetFormAria')}
    >
      <div className="store-request-sheet-head">
        <div>
          <div className="store-request-eyebrow">
            {input.t('storeApprovals.targetQueueTitle')}
          </div>
          <h3>{input.t('storeApprovals.targetTitle')}</h3>
        </div>
        <StatusPill tone="accent">{input.t('storeApprovals.writeFlow')}</StatusPill>
      </div>

      {!input.access.createAllowed ? (
        <EmptyState
          title={input.t('storeApprovals.assignedActionStoreRequired')}
          copy={input.t('storeApprovals.targetUnavailableCopy')}
        />
      ) : (
        <div className="store-request-grid">
          <div className="store-request-field">
            <label className="store-request-label" htmlFor="store-id">
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

          <div className="store-request-field">
            <label className="store-request-label" htmlFor="request-month">
              {input.t('storeApprovals.requestMonth')}
            </label>
            <input
              id="request-month"
              type="month"
              value={input.requestMonth}
              onChange={(event) => input.onRequestMonthChange(event.target.value)}
            />
          </div>

          <div className="store-request-field">
            <label className="store-request-label" htmlFor="target-label">
              {input.t('storeApprovals.targetLabel')}
            </label>
            <input
              id="target-label"
              value={input.targetLabel}
              onChange={(event) => input.onTargetLabelChange(event.target.value)}
              placeholder={input.t('storeApprovals.targetLabelPlaceholder')}
            />
          </div>

          <div className="store-request-field">
            <label className="store-request-label" htmlFor="total-target-value">
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

          <div className="store-request-field store-request-field-wide">
            <label className="store-request-label" htmlFor="request-reason">
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

          <div className="store-request-subsection store-request-field-wide">
            <div className="store-request-subsection-head">
              <strong>{input.t('storeApprovals.personTargetEntry')}</strong>
              <div className="store-request-allocation-summary">
                <span>
                  <small>{input.t('storeApprovals.allocatedTarget')}</small>
                  <strong>{formatTargetNumber(input.allocationTotal, input.locale)}</strong>
                </span>
                <span>
                  <small>{input.t('storeApprovals.remainingTarget')}</small>
                  <strong>{formatTargetNumber(remainingTargetValue, input.locale)}</strong>
                </span>
                <StatusPill tone={input.totalsAligned ? 'calm' : 'warning'}>
                  {completionShare}
                </StatusPill>
              </div>
            </div>
            {input.personnelQuery.isError ? (
              <p className="store-request-note">
                {getErrorMessage(input.personnelQuery.error)}
              </p>
            ) : null}
            {input.personnelQuery.isLoading ? (
              <p className="store-request-note">
                {input.t('storeApprovals.personnelLoading')}
              </p>
            ) : null}
            {!input.personnelQuery.isLoading && !input.personnelQuery.isError ? (
              <p className="store-request-note">
                {input.t('storeApprovals.personTargetCopy')}
              </p>
            ) : null}

            <div className="store-request-list">
              {input.activeAllocations.map((allocation, index) => {
                const targetValue = Number(allocation.targetValue || 0)

                return (
                  <div
                    className="store-request-allocation-row"
                    key={`allocation-${allocation.employeeId || index}`}
                  >
                    <div className="store-request-allocation-person">
                      <strong>{allocation.assigneeLabel || input.t('storeApprovals.unassigned')}</strong>
                    </div>
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
                    <div className="store-request-allocation-share">
                      <span>{input.t('storeApprovals.allocationShare')}</span>
                      <strong>{formatAllocationShare(targetValue, totalTargetNumber, input.locale)}</strong>
                    </div>
                    <input
                      value={allocation.note ?? ''}
                      onChange={(event) => input.onAllocationNoteChange(index, event.target.value)}
                      placeholder={input.t('storeApprovals.optionalNote')}
                    />
                  </div>
                )
              })}
            </div>

            {!input.totalsAligned ? (
              <p className="store-request-note">
                {input.t('storeApprovals.allocationMismatch')}
              </p>
            ) : null}

          </div>

          <div className="store-request-actions store-request-field-wide">
            <button
              className="store-request-button store-request-button-primary"
              type="button"
              disabled={!input.access.submitAllowed || input.submission.pending}
              onClick={input.onSubmit}
            >
              {input.submission.pending
                ? input.t('storeApprovals.submitting')
                : input.t('storeApprovals.submitTargetRequest')}
            </button>
          </div>

          {input.errors.createVisible ? (
            <StoreRequestFeedback tone="error">
              {getErrorMessage(input.errors.create)}
            </StoreRequestFeedback>
          ) : null}
          {input.submission.notice ? (
            <StoreRequestFeedback tone="success">
              {input.submission.notice}
            </StoreRequestFeedback>
          ) : null}
        </div>
      )}
    </article>
  )
}

function SellerCodeRequestForm(input: {
  access: RequestFormAccess
  editingRequestId: string | null
  errors: RequestFormErrors
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
  sellerEmploymentType: SellerEmploymentType
  sellerFirstName: string
  sellerHireDate: string
  sellerLastName: string
  sellerNationalId: string
  sellerPhoneNumber: string
  sellerPositionId: string
  sellerRequestReason: string
  submission: RequestFormSubmission
  storeId: string
  t: TranslateFunction
}) {
  const sellerPositionOptions = getStoreSellerPositionOptions(
    input.positionOptionsQuery.data?.items ?? [],
  )

  return (
    <article
      className="store-request-sheet"
      aria-label={input.t('storeApprovals.sellerFormAria')}
    >
      <div className="store-request-sheet-head">
        <div>
          <div className="store-request-eyebrow">
            {input.t('storeApprovals.workforceQueueTitle')}
          </div>
          <h3>{input.t('storeApprovals.sellerCodeTitle')}</h3>
        </div>
        <StatusPill tone="calm">{input.t('storeApprovals.hrQueue')}</StatusPill>
      </div>

      {!input.access.createAllowed ? (
        <EmptyState
          title={input.t('storeApprovals.assignedActionStoreRequired')}
          copy={input.t('storeApprovals.sellerUnavailableCopy')}
        />
      ) : (
        <div className="store-request-grid">
          <div className="store-request-field">
            <label className="store-request-label" htmlFor="seller-store-id">
              {input.t('storeApprovals.storeId')}
            </label>
            <input id="seller-store-id" value={input.storeId} readOnly />
          </div>

          <div className="store-request-field">
            <label className="store-request-label" htmlFor="seller-first-name">
              {input.t('storeApprovals.firstName')}
            </label>
            <input
              id="seller-first-name"
              value={input.sellerFirstName}
              onChange={(event) => input.onFirstNameChange(event.target.value)}
              placeholder={input.t('storeApprovals.firstNamePlaceholder')}
            />
          </div>

          <div className="store-request-field">
            <label className="store-request-label" htmlFor="seller-last-name">
              {input.t('storeApprovals.lastName')}
            </label>
            <input
              id="seller-last-name"
              value={input.sellerLastName}
              onChange={(event) => input.onLastNameChange(event.target.value)}
              placeholder={input.t('storeApprovals.lastNamePlaceholder')}
            />
          </div>

          <div className="store-request-field">
            <label className="store-request-label" htmlFor="seller-position-id">
              {input.t('storeApprovals.position')}
            </label>
            <select
              id="seller-position-id"
              value={input.sellerPositionId}
              disabled={input.positionOptionsQuery.isLoading || input.positionOptionsQuery.isError}
              onChange={(event) => input.onPositionIdChange(event.target.value)}
            >
              <option value="">{input.t('storeApprovals.selectPosition')}</option>
              {sellerPositionOptions.map(({ label, position }) => (
                <option key={position.positionId} value={position.positionId}>
                  {label}
                </option>
              ))}
            </select>
            {input.positionOptionsQuery.isLoading ? (
              <p className="store-request-note">
                {input.t('storeApprovals.positionsLoading')}
              </p>
            ) : null}
            {input.positionOptionsQuery.isError ? (
              <p className="store-request-note">
                {getErrorMessage(input.positionOptionsQuery.error)}
              </p>
            ) : null}
            {!input.positionOptionsQuery.isLoading &&
            !input.positionOptionsQuery.isError &&
            sellerPositionOptions.length === 0 ? (
              <p className="store-request-note">{input.t('storeApprovals.noPositions')}</p>
            ) : null}
          </div>

          <div className="store-request-field">
            <label className="store-request-label" htmlFor="seller-national-id">
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

          <div className="store-request-field">
            <label className="store-request-label" htmlFor="seller-phone-number">
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

          <div className="store-request-field">
            <label className="store-request-label" htmlFor="seller-hire-date">
              {input.t('storeApprovals.hireDate')}
            </label>
            <input
              id="seller-hire-date"
              type="date"
              value={input.sellerHireDate}
              onChange={(event) => input.onHireDateChange(event.target.value)}
            />
          </div>

          <div className="store-request-field">
            <label className="store-request-label" htmlFor="seller-employment-type">
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

          <div className="store-request-field store-request-field-wide">
            <label className="store-request-label" htmlFor="seller-request-reason">
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

          <div className="store-request-actions store-request-field-wide">
            <button
              className="store-request-button store-request-button-primary"
              type="button"
              disabled={!input.access.submitAllowed || input.submission.pending}
              onClick={input.onSubmit}
            >
              {input.submission.pending
                ? input.t('storeApprovals.submitting')
                : input.editingRequestId
                  ? input.t('storeApprovals.resubmitSellerCodeRequest')
                  : input.t('storeApprovals.submitSellerCodeRequest')}
            </button>
            {input.editingRequestId ? (
              <button
                className="store-request-button"
                type="button"
                disabled={input.submission.pending}
                onClick={input.onCancelEdit}
              >
                {input.t('storeApprovals.cancelEdit')}
              </button>
            ) : null}
          </div>

          {input.errors.createVisible ? (
            <StoreRequestFeedback tone="error">
              {getErrorMessage(input.errors.create)}
            </StoreRequestFeedback>
          ) : null}
          {input.errors.resubmitVisible ? (
            <StoreRequestFeedback tone="error">
              {getErrorMessage(input.errors.resubmit)}
            </StoreRequestFeedback>
          ) : null}
          {input.submission.notice ? (
            <StoreRequestFeedback tone="success">
              {input.submission.notice}
            </StoreRequestFeedback>
          ) : null}
        </div>
      )}
    </article>
  )
}

function OffboardingRequestForm(input: {
  access: RequestFormAccess
  editingRequestId: string | null
  errors: RequestFormErrors
  offboardingEmployeeId: string
  offboardingRequestReason: string
  offboardingTerminationDate: string
  onCancelEdit: () => void
  onEmployeeIdChange: StringFieldSetter
  onRequestReasonChange: StringFieldSetter
  onSubmit: () => void
  onTerminationDateChange: StringFieldSetter
  storeEmployeesQuery: ListQuerySnapshot<StoreEmployee>
  submission: RequestFormSubmission
  t: TranslateFunction
}) {
  return (
    <article
      className="store-request-sheet"
      aria-label={input.t('storeApprovals.offboardingFormAria')}
    >
      <div className="store-request-sheet-head">
        <div>
          <div className="store-request-eyebrow">
            {input.t('storeApprovals.workforceQueueTitle')}
          </div>
          <h3>{input.t('storeApprovals.offboardingTitle')}</h3>
        </div>
        <StatusPill tone="warning">{input.t('storeApprovals.hrQueue')}</StatusPill>
      </div>

      {!input.access.createAllowed ? (
        <EmptyState
          title={input.t('storeApprovals.assignedActionStoreRequired')}
          copy={input.t('storeApprovals.offboardingUnavailableCopy')}
        />
      ) : (
        <div className="store-request-grid">
          <div className="store-request-field store-request-field-wide">
            <label className="store-request-label" htmlFor="offboarding-employee-id">
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
              <p className="store-request-note">
                {input.t('storeApprovals.activePersonnelLoading')}
              </p>
            ) : null}
            {input.storeEmployeesQuery.isError ? (
              <p className="store-request-note">
                {getErrorMessage(input.storeEmployeesQuery.error)}
              </p>
            ) : null}
            {!input.storeEmployeesQuery.isLoading &&
            !input.storeEmployeesQuery.isError &&
            (input.storeEmployeesQuery.data?.items.length ?? 0) === 0 ? (
              <p className="store-request-note">{input.t('storeApprovals.noActivePersonnel')}</p>
            ) : null}
          </div>

          <div className="store-request-field">
            <label className="store-request-label" htmlFor="offboarding-termination-date">
              {input.t('storeApprovals.terminationDate')}
            </label>
            <input
              id="offboarding-termination-date"
              type="date"
              value={input.offboardingTerminationDate}
              onChange={(event) => input.onTerminationDateChange(event.target.value)}
            />
          </div>

          <div className="store-request-field store-request-field-wide">
            <label className="store-request-label" htmlFor="offboarding-request-reason">
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

          <div className="store-request-actions store-request-field-wide">
            <button
              className="store-request-button store-request-button-primary"
              type="button"
              disabled={!input.access.submitAllowed || input.submission.pending}
              onClick={input.onSubmit}
            >
              {input.submission.pending
                ? input.t('storeApprovals.submitting')
                : input.editingRequestId
                  ? input.t('storeApprovals.resubmitOffboardingRequest')
                  : input.t('storeApprovals.submitOffboardingRequest')}
            </button>
            {input.editingRequestId ? (
              <button
                className="store-request-button"
                type="button"
                disabled={input.submission.pending}
                onClick={input.onCancelEdit}
              >
                {input.t('storeApprovals.cancelEdit')}
              </button>
            ) : null}
          </div>

          {input.errors.createVisible ? (
            <StoreRequestFeedback tone="error">
              {getErrorMessage(input.errors.create)}
            </StoreRequestFeedback>
          ) : null}
          {input.errors.resubmitVisible ? (
            <StoreRequestFeedback tone="error">
              {getErrorMessage(input.errors.resubmit)}
            </StoreRequestFeedback>
          ) : null}
          {input.submission.notice ? (
            <StoreRequestFeedback tone="success">
              {input.submission.notice}
            </StoreRequestFeedback>
          ) : null}
        </div>
      )}
    </article>
  )
}

function SubmittedTargetRequestsPanel(input: {
  locale: AppLocale
  requests: TargetDistributionRequest[]
  t: TranslateFunction
}) {
  return (
    <section className="store-approvals-ledger-card">
      <div className="store-approvals-ledger-card-head">
        <div>
          <div className="store-approvals-ledger-eyebrow">
            {input.t('storeApprovals.submittedEyebrow')}
          </div>
          <h3>{input.t('storeApprovals.submittedTargetLedgerTitle')}</h3>
        </div>
      </div>

      {input.requests.length === 0 ? (
        <EmptyState
          title={input.t('storeApprovals.noSubmittedTitle')}
          copy={input.t('storeApprovals.noSubmittedCopy')}
        />
      ) : (
        <div className="store-approvals-ledger-rows">
          {input.requests.map((item) => (
            <article className="store-approvals-ledger-row" key={item.requestId}>
              <div className="store-approvals-ledger-row-head">
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
              <div className="store-approvals-ledger-key-grid">
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
                <p className="store-approvals-ledger-row-note">
                  {input.t('storeApprovals.reasonPrefix', { reason: item.requestReason })}
                </p>
              ) : null}
              <TargetAllocationBreakdown
                allocations={item.allocations}
                locale={input.locale}
                totalTargetValue={item.totalTargetValue}
              />
              {item.approvalNote ? (
                <p className="store-approvals-ledger-row-note">
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
