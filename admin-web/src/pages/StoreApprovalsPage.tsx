import { useMemo, useReducer, type ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, Clock3, ReceiptText, ShieldCheck } from 'lucide-react'
import {
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
import { getErrorMessage } from '../lib/format'
import type { AppLocale } from '../lib/i18n'
import {
  createStoreApprovalsPageState,
  ledgerActionLabelKeys,
  resolveStoreApprovalsPersona,
  storeApprovalsPageReducer,
  type ListQuerySnapshot,
  type RequestFormErrors,
  type RequestFormSubmission,
  type StoreApprovalsLedgerPanel,
  type StringFieldSetter,
} from './store-approvals-model'
import { OffboardingRequestForm } from './store-approvals-offboarding-form'
import { ReturnedRequestsPanel } from './store-approvals-returned-panel'
import { SellerCodeRequestForm } from './store-approvals-seller-code-form'
import { SubmittedTargetRequestsPanel } from './store-approvals-submitted-targets-panel'
import { TargetApprovalLedger } from './store-approvals-target-approval-ledger'
import { TargetDistributionRequestForm } from './store-approvals-target-request-form'

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
