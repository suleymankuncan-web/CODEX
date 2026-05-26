import { useMemo, useReducer } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, Clock3, ReceiptText, ShieldCheck } from 'lucide-react'
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
} from '../features/workforce/api'
import { getErrorMessage } from '../lib/format'
import {
  createStoreApprovalsPageState,
  resolveStoreApprovalsPersona,
  storeApprovalsPageReducer,
} from './store-approvals-model'
import { StoreApprovalsWorkbench } from './store-approvals-workbench'
import {
  StoreErrorState,
  StoreLoadingState,
  StoreMetricCard,
  StoreMetricGrid,
  StoreSurfaceHeader,
  StoreSurfacePage,
} from './store-surface-primitives'

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
      <StoreLoadingState
        title={t('storeApprovals.loadingTitle')}
        description={t('storeApprovals.loadingCopy')}
      />
    )
  }

  if (canListRequests && requestsQuery.isError) {
    return (
      <StoreSurfacePage ariaLabel={t('storeApprovals.ledgerTitle')}>
        <StoreErrorState
          title={t('storeApprovals.errorTitle')}
          description={getErrorMessage(requestsQuery.error)}
        />
      </StoreSurfacePage>
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
      ...(requestReason ? { requestReason } : {}),
      allocations: activeAllocations,
    })
  }
  const submitSellerCodeRequest = () => {
    const trimmedSellerRequestReason = sellerRequestReason.trim()
    const payload = {
      firstName: sellerFirstName.trim(),
      lastName: sellerLastName.trim(),
      nationalId: sellerNationalId.trim(),
      phoneNumber: sellerPhoneNumber.trim(),
      hireDate: sellerHireDate,
      requestedPositionId: sellerPositionId.trim(),
      employmentType: sellerEmploymentType,
      ...(trimmedSellerRequestReason ? { requestReason: trimmedSellerRequestReason } : {}),
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
      ...(approvalNotes[request.requestId] ? { approvalNote: approvalNotes[request.requestId] } : {}),
    })
  }

  return (
    <StoreSurfacePage
      ariaLabel={t('storeApprovals.ledgerTitle')}
      ariaLabelledBy="store-approvals-ledger-title"
      testId="store-approvals-ledger"
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
    </StoreSurfacePage>
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
    <StoreSurfaceHeader
      eyebrow={input.t('storeApprovals.ledgerEyebrow')}
      title={input.t('storeApprovals.ledgerTitle')}
      titleId="store-approvals-ledger-title"
      description={
        input.isRegionManagerLedger
          ? input.t('storeApprovals.regionManagerSubtitle')
          : input.isStoreManagerLedger
            ? input.t('storeApprovals.storeManagerSubtitle')
            : input.t('storeApprovals.readOnlySubtitle')
      }
    />
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
    <StoreMetricGrid ariaLabel={input.t('storeApprovals.ledgerMetrics')}>
      <StoreMetricCard
        icon={<ReceiptText data-icon="inline-start" />}
        title={input.t('storeApprovals.pendingApprovals')}
        note={input.t('storeApprovals.pendingApprovalsNote')}
        value={String(input.pendingCount)}
        tone={input.pendingCount > 0 ? 'warning' : 'calm'}
      />
      <StoreMetricCard
        icon={<ShieldCheck data-icon="inline-start" />}
        title={input.t('storeApprovals.approvalIntent')}
        note={
          input.showTargetApprovalQueue
            ? input.t('storeApprovals.targetApprovalQueueTitle')
            : input.t('storeApprovals.approvalIntentNote')
        }
        value={input.showTargetSubmission || input.showTargetApprovalQueue ? '1' : '0'}
        tone={input.showTargetSubmission || input.showTargetApprovalQueue ? 'accent' : 'neutral'}
      />
      <StoreMetricCard
        icon={<Clock3 data-icon="inline-start" />}
        title={input.t('storeApprovals.approvedRequests')}
        note={input.t('storeApprovals.approvedRequestsNote')}
        value={String(input.approvedCount)}
        tone={input.approvedCount > 0 ? 'calm' : 'neutral'}
      />
      <StoreMetricCard
        icon={<CheckCircle2 data-icon="inline-start" />}
        title={
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
        tone={input.returnedWorkforceCount > 0 ? 'warning' : 'neutral'}
      />
    </StoreMetricGrid>
  )
}
