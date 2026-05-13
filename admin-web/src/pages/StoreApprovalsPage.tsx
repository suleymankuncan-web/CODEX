import { useMemo, useState, type ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, Clock3, ReceiptText, ShieldCheck } from 'lucide-react'
import {
  EmptyState,
  KeyValue,
  ScreenState,
  StatusPill,
  type Tone,
} from '../components/dashboard-primitives'
import type { AuthSessionSummary } from '../features/auth/api'
import {
  canApproveTargetDistributionRequest,
  canCreateTargetDistributionRequest,
  canListTargetDistributionRequests,
  getAssignedStoreIds,
  getReadStoreIds,
  hasAnyRole,
} from '../features/auth/authorization'
import { getDisplayRoleCodes } from '../features/auth/display'
import type { TranslateFunction, TranslationKey } from '../features/localization/dictionary'
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

function mapApprovalStatusTone(status: string): Tone {
  if (status === 'approved') {
    return 'calm'
  }

  if (status === 'rejected') {
    return 'danger'
  }

  if (status === 'pending_hr_approval' || status === 'pending_region_approval') {
    return 'warning'
  }

  return 'neutral'
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
type StoreApprovalsPersona = 'storeManager' | 'regionManager' | 'readOnly'
type StoreApprovalsLedgerPanel =
  | 'overview'
  | 'targetRequest'
  | 'targetApproval'
  | 'submittedTargets'
  | 'returnedRequests'
  | 'sellerCodeRequest'
  | 'offboardingRequest'
type StoreApprovalsLedgerRow = {
  actionLabel: string
  detail: string
  id: string
  onAction?: () => void
  record: string
  scope: string
  source: string
  status: string
  statusTone: Tone
  type: string
  wait: string
}

const storeSellerPositionLabels = {
  cashierResponsible: 'Kasa Sorumlusu',
  salesConsultant: 'Satış Danışmanı',
  seniorSalesConsultant: 'Uzman Satış Danışmanı',
  storeAssistantManager: 'Mağaza Müdür Yardımcısı',
  storeManager: 'Mağaza Müdürü',
} as const
type StoreSellerPositionKey = keyof typeof storeSellerPositionLabels
type StoreSellerPositionOption = {
  key: StoreSellerPositionKey
  label: string
  position: PositionOption
}

const storeSellerPositionAliases = {
  cashierResponsible: [
    'CASH RESPONSIBLE',
    'CASH REGISTER RESPONSIBLE',
    'CASHIER',
    'CASHIER RESPONSIBLE',
    'CASHIER_RESPONSIBLE',
    'CASH_RESPONSIBLE',
    'CASH_REGISTER_RESPONSIBLE',
    'KASA',
    'KASA SORUMLUSU',
    'KASA_SORUMLUSU',
  ],
  salesConsultant: [
    'SALES',
    'SALES ADVISOR',
    'SALES ASSOCIATE',
    'SALES CONSULTANT',
    'SALES_ADVISOR',
    'SALES_ASSOCIATE',
    'SALES_CONSULTANT',
    'SATIS DANISMANI',
    'SATIS_DANISMANI',
    'SATIŞ DANIŞMANI',
    'SATIS',
  ],
  seniorSalesConsultant: [
    'EXPERT SALES CONSULTANT',
    'EXPERT_SALES_CONSULTANT',
    'SENIOR SALES CONSULTANT',
    'SENIOR_SALES_CONSULTANT',
    'UZMAN SATIS DANISMANI',
    'UZMAN SATIŞ DANIŞMANI',
    'UZMAN_SATIS_DANISMANI',
    'UZMAN_SATIS',
  ],
  storeAssistantManager: [
    'ASSISTANT MANAGER',
    'ASSISTANT STORE MANAGER',
    'ASSISTANT_MANAGER',
    'DEPUTY STORE MANAGER',
    'DEPUTY_STORE_MANAGER',
    'MAGAZA MUDUR YARD',
    'MAGAZA MUDUR YARDIMCISI',
    'MAGAZA MUDUR YRD',
    'MAGAZA_MUDUR_YARD',
    'MAGAZA_MUDUR_YARDIMCISI',
    'MAGAZA_MUDUR_YRD',
    'MAĞAZA MÜDÜR YARDIMCISI',
    'STORE DEPUTY MANAGER',
    'STORE ASSISTANT MANAGER',
    'STORE_ASSISTANT_MANAGER',
    'STORE_DEPUTY_MANAGER',
  ],
  storeManager: [
    'MAGAZA MUDURU',
    'MAGAZA_MUDURU',
    'MAĞAZA MÜDÜRÜ',
    'STORE MANAGER',
    'STORE_MANAGER',
  ],
} as const satisfies Record<StoreSellerPositionKey, readonly string[]>

const storeSellerPositionOrder: StoreSellerPositionKey[] = [
  'storeManager',
  'storeAssistantManager',
  'seniorSalesConsultant',
  'salesConsultant',
  'cashierResponsible',
]

const storeSellerCanonicalCodes = {
  cashierResponsible: 'CASHIER',
  salesConsultant: 'SALES_ASSOCIATE',
  seniorSalesConsultant: 'SENIOR_SALES_CONSULTANT',
  storeAssistantManager: 'ASSISTANT_MANAGER',
  storeManager: 'STORE_MANAGER',
} as const satisfies Record<StoreSellerPositionKey, string>

const storeSellerPositionLookup = new Map<string, StoreSellerPositionKey>(
  Object.entries(storeSellerPositionAliases).flatMap(([positionKey, aliases]) =>
    aliases.map((alias) => [
      normalizePositionLookup(alias),
      positionKey as StoreSellerPositionKey,
    ]),
  ),
)

const ledgerActionLabelKeys = {
  offboardingRequest: 'storeApprovals.openOffboardingRequest',
  overview: 'storeApprovals.ledgerDetailTitle',
  returnedRequests: 'storeApprovals.openReturnedRequests',
  sellerCodeRequest: 'storeApprovals.openSellerCodeRequest',
  submittedTargets: 'storeApprovals.openSubmittedTargets',
  targetApproval: 'storeApprovals.openTargetApprovalQueue',
  targetRequest: 'storeApprovals.openTargetRequest',
} as const satisfies Record<StoreApprovalsLedgerPanel, TranslationKey>

function normalizePositionLookup(value: string) {
  return value
    .trim()
    .toLocaleLowerCase('tr-TR')
    .replaceAll('ı', 'i')
    .replaceAll('ğ', 'g')
    .replaceAll('ü', 'u')
    .replaceAll('ş', 's')
    .replaceAll('ö', 'o')
    .replaceAll('ç', 'c')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

function resolveStoreSellerPositionKey(position: PositionOption) {
  return (
    storeSellerPositionLookup.get(normalizePositionLookup(position.positionCode)) ??
    storeSellerPositionLookup.get(normalizePositionLookup(position.positionName))
  )
}

function getStoreSellerPositionOptions(positions: readonly PositionOption[]) {
  const optionsByKey = new Map<StoreSellerPositionKey, StoreSellerPositionOption>()

  positions.forEach((position) => {
    const key = resolveStoreSellerPositionKey(position)
    if (!key) {
      return
    }

    const nextOption = {
      key,
      label: storeSellerPositionLabels[key],
      position,
    }
    const currentOption = optionsByKey.get(key)
    if (
      !currentOption ||
      normalizePositionLookup(position.positionCode) ===
        normalizePositionLookup(storeSellerCanonicalCodes[key])
    ) {
      optionsByKey.set(key, nextOption)
    }
  })

  return storeSellerPositionOrder.flatMap((key) => {
    const option = optionsByKey.get(key)
    return option ? [option] : []
  })
}

function resolveStoreApprovalsPersona(
  authSummary: AuthSessionSummary | null,
): StoreApprovalsPersona {
  if (hasAnyRole(authSummary, ['REGION_MANAGER', 'SUPER_ADMIN', 'REPORT_VIEWER'])) {
    return 'regionManager'
  }

  if (hasAnyRole(authSummary, ['STORE_MANAGER'])) {
    return 'storeManager'
  }

  return 'readOnly'
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
  const persona = resolveStoreApprovalsPersona(input.authSummary)
  const canListRequests = canListTargetDistributionRequests(input.authSummary)
  const canCreateForStore = canCreateTargetDistributionRequest(input.authSummary, storeId || null)
  const isStoreManagerLedger = persona === 'storeManager'
  const isRegionManagerLedger = persona === 'regionManager'
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
  const [requestMonth, setRequestMonth] = useState(() => new Date().toISOString().slice(0, 7))
  const [targetLabel, setTargetLabel] = useState(() => t('storeApprovals.targetLabelDefault'))
  const [totalTargetValue, setTotalTargetValue] = useState('0')
  const [requestReason, setRequestReason] = useState('')
  const [submissionNotice, setSubmissionNotice] = useState<string | null>(null)
  const [approvalNotes, setApprovalNotes] = useState<Record<string, string>>({})
  const [approvalNotice, setApprovalNotice] = useState<string | null>(null)
  const [ledgerSearch, setLedgerSearch] = useState('')
  const [ledgerTypeFilter, setLedgerTypeFilter] = useState('all')
  const [ledgerStatusFilter, setLedgerStatusFilter] = useState('all')
  const [activeLedgerPanel, setActiveLedgerPanel] =
    useState<StoreApprovalsLedgerPanel>('overview')
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
  const [offboardingRequestReason, setOffboardingRequestReason] = useState('')
  const [offboardingNotice, setOffboardingNotice] = useState<string | null>(null)
  const [editingOffboardingRequestId, setEditingOffboardingRequestId] = useState<string | null>(null)
  const [allocations, setAllocations] = useState<Array<TargetDistributionAllocation>>([
    { employeeId: '', assigneeLabel: '', targetValue: 0, note: '' },
  ])

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
      setOffboardingRequestReason('')
      setOffboardingNotice(result.command.message)
    },
  })
  const approveTargetMutation = useMutation({
    mutationFn: approveTargetDistributionRequest,
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ['target-distribution-requests'] })
      setApprovalNotice(result.command.message)
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
    setActiveLedgerPanel('sellerCodeRequest')
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
    setActiveLedgerPanel('offboardingRequest')
    setEditingOffboardingRequestId(item.requestId)
    setOffboardingEmployeeId(item.employeeId)
    setOffboardingTerminationDate(item.terminationDate)
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
  const pendingTargetRequests = requests.filter((item) => item.status === 'pending_region_approval')
  const submittedTargetRequests = showTargetApprovalQueue
    ? requests.filter((item) => item.status !== 'pending_region_approval')
    : requests
  const pendingCount = pendingTargetRequests.length
  const approvedCount = requests.filter((item) => item.status === 'approved').length
  const returnedWorkforceCount =
    returnedSellerCodeRequests.length + returnedOffboardingRequests.length
  const allocationTotal = activeAllocations.reduce((sum, item) => sum + Number(item.targetValue || 0), 0)
  const totalsAligned = allocationTotal === Number(totalTargetValue || 0)
  const canSubmit =
    showTargetSubmission &&
    Boolean(storeId) &&
    Boolean(targetLabel.trim()) &&
    Number(totalTargetValue) > 0 &&
    totalsAligned &&
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
  const ledgerRows: StoreApprovalsLedgerRow[] = [
    ...(showTargetSubmission
      ? [
          {
            actionLabel: t('storeApprovals.ledgerActionEdit'),
            detail: t('storeApprovals.targetQueueTitle'),
            id: 'target-distribution-form',
            onAction: () => setActiveLedgerPanel('targetRequest'),
            record: t('storeApprovals.targetTitle'),
            scope: storeId || t('storeApprovals.noActionStore'),
            source: t('storeApprovals.targetLedgerSource'),
            status: canSubmit
              ? t('storeApprovals.ledgerStatusReady')
              : t('storeApprovals.ledgerStatusDraft'),
            statusTone: canSubmit ? 'calm' : 'warning',
            type: t('storeApprovals.ledgerTypeTarget'),
            wait: t('storeApprovals.ledgerWaitLive'),
          } satisfies StoreApprovalsLedgerRow,
        ]
      : []),
    ...pendingTargetRequests.map((item) => ({
      actionLabel: showTargetApprovalQueue
        ? t('storeApprovals.ledgerActionReview')
        : t('storeApprovals.ledgerActionDetail'),
      detail: item.requestReason ?? t('storeApprovals.noNote'),
      id: `pending-target-${item.requestId}`,
      onAction: showTargetApprovalQueue ? () => setActiveLedgerPanel('targetApproval') : undefined,
      record: item.targetLabel,
      scope: item.storeName || item.storeId,
      source: t('storeApprovals.targetLedgerSource'),
      status: formatApprovalStatus(item.status, t),
      statusTone: 'warning' as const,
      type: t('storeApprovals.ledgerTypeTarget'),
      wait: formatDateTime(item.createdAt, locale),
    })),
    ...submittedTargetRequests.map((item) => ({
      actionLabel: t('storeApprovals.ledgerActionDetail'),
      detail: item.requestReason ?? t('storeApprovals.noNote'),
      id: `submitted-target-${item.requestId}`,
      onAction: () => setActiveLedgerPanel('submittedTargets'),
      record: item.targetLabel,
      scope: item.storeName || item.storeId,
      source: t('storeApprovals.targetLedgerSource'),
      status: formatApprovalStatus(item.status, t),
      statusTone: mapApprovalStatusTone(item.status),
      type: t('storeApprovals.ledgerTypeTarget'),
      wait: formatDateTime(item.updatedAt, locale),
    })),
    ...(showWorkforceHrQueues
      ? [
          {
            actionLabel: t('storeApprovals.ledgerActionCreate'),
            detail: t('storeApprovals.sellerCodeLedgerDetail'),
            id: 'seller-code-form',
            onAction: () => setActiveLedgerPanel('sellerCodeRequest'),
            record: t('storeApprovals.sellerCodeTitle'),
            scope: storeId || t('storeApprovals.noActionStore'),
            source: t('storeApprovals.hrQueue'),
            status: canSubmitSellerCodeRequest
              ? t('storeApprovals.ledgerStatusReady')
              : t('storeApprovals.ledgerStatusDraft'),
            statusTone: canSubmitSellerCodeRequest ? 'calm' : 'warning',
            type: t('storeApprovals.ledgerTypeSellerCode'),
            wait: t('storeApprovals.ledgerWaitLive'),
          } satisfies StoreApprovalsLedgerRow,
          {
            actionLabel: t('storeApprovals.ledgerActionCreate'),
            detail: t('storeApprovals.offboardingLedgerDetail'),
            id: 'offboarding-form',
            onAction: () => setActiveLedgerPanel('offboardingRequest'),
            record: t('storeApprovals.offboardingTitle'),
            scope: storeId || t('storeApprovals.noActionStore'),
            source: t('storeApprovals.hrQueue'),
            status: canSubmitOffboardingRequest
              ? t('storeApprovals.ledgerStatusReady')
              : t('storeApprovals.ledgerStatusDraft'),
            statusTone: canSubmitOffboardingRequest ? 'calm' : 'warning',
            type: t('storeApprovals.ledgerTypeOffboarding'),
            wait: t('storeApprovals.ledgerWaitLive'),
          } satisfies StoreApprovalsLedgerRow,
          ...returnedSellerCodeRequests.map((item) => ({
            actionLabel: t('storeApprovals.editSellerCodeRequest'),
            detail: item.reviewNote ?? t('storeApprovals.noNote'),
            id: `seller-returned-${item.requestId}`,
            onAction: () => startEditingSellerRequest(item),
            record: `${item.firstName} ${item.lastName}`.trim(),
            scope: item.storeName || item.storeId,
            source: t('storeApprovals.hrQueue'),
            status: formatApprovalStatus(item.status, t),
            statusTone: 'danger' as const,
            type: t('storeApprovals.ledgerTypeSellerCode'),
            wait: formatDateTime(item.updatedAt, locale),
          })),
          ...returnedOffboardingRequests.map((item) => ({
            actionLabel: t('storeApprovals.editOffboardingRequest'),
            detail: item.reviewNote ?? t('storeApprovals.noNote'),
            id: `offboarding-returned-${item.requestId}`,
            onAction: () => startEditingOffboardingRequest(item),
            record: item.displayName,
            scope: item.storeName || item.storeId,
            source: t('storeApprovals.hrQueue'),
            status: formatApprovalStatus(item.status, t),
            statusTone: 'danger' as const,
            type: t('storeApprovals.ledgerTypeOffboarding'),
            wait: formatDateTime(item.updatedAt, locale),
          })),
        ]
      : []),
  ]
  const ledgerTypeOptions = Array.from(new Set(ledgerRows.map((item) => item.type)))
  const ledgerStatusOptions = Array.from(new Set(ledgerRows.map((item) => item.status)))
  const normalizedLedgerSearch = ledgerSearch.trim().toLocaleLowerCase(locale)
  const visibleLedgerRows = ledgerRows.filter((item) => {
    const matchesType = ledgerTypeFilter === 'all' || item.type === ledgerTypeFilter
    const matchesStatus = ledgerStatusFilter === 'all' || item.status === ledgerStatusFilter
    const matchesSearch =
      !normalizedLedgerSearch ||
      [item.type, item.record, item.detail, item.scope, item.status, item.source]
        .join(' ')
        .toLocaleLowerCase(locale)
        .includes(normalizedLedgerSearch)

    return matchesType && matchesStatus && matchesSearch
  })
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
    setEditingOffboardingRequestId(null)
    setOffboardingEmployeeId('')
    setOffboardingTerminationDate(new Date().toISOString().slice(0, 10))
    setOffboardingRequestReason('')
    setOffboardingNotice(null)
  }
  const getLedgerActionButtonClass = (panel: StoreApprovalsLedgerPanel) =>
    activeLedgerPanel === panel
      ? 'store-approvals-action-tab store-approvals-action-tab-active'
      : 'store-approvals-action-tab'

  return (
    <section
      className="store-approvals-ledger-page"
      aria-labelledby="store-approvals-ledger-title"
      data-testid="store-approvals-ledger"
    >
      <header className="store-approvals-ledger-header">
        <div>
          <div className="store-approvals-ledger-eyebrow">
            {t('storeApprovals.ledgerEyebrow')}
          </div>
          <h2 id="store-approvals-ledger-title">
            {t('storeApprovals.ledgerTitle')}
          </h2>
          <p>
            {isRegionManagerLedger
              ? t('storeApprovals.regionManagerSubtitle')
              : isStoreManagerLedger
                ? t('storeApprovals.storeManagerSubtitle')
                : t('storeApprovals.readOnlySubtitle')}
          </p>
        </div>
        <div className="store-approvals-ledger-scope" aria-label={t('storeApprovals.ledgerScope')}>
          <span>
            <strong>{t('storeApprovals.roles')}</strong>
            {formatRoles(user?.roleCodes, t)}
          </span>
          <span>
            <strong>{t('storeApprovals.actionStore')}</strong>
            {primaryStoreId ?? t('storeApprovals.noActionStore')}
          </span>
          <span>
            <strong>{t('storeApprovals.readStoreIds')}</strong>
            {readStoreIds.length ? String(readStoreIds.length) : t('storeApprovals.none')}
          </span>
        </div>
      </header>

      <section
        className="store-approvals-ledger-metrics"
        aria-label={t('storeApprovals.ledgerMetrics')}
      >
        <LedgerMetric
          icon={<ReceiptText size={18} />}
          label={t('storeApprovals.pendingApprovals')}
          note={t('storeApprovals.pendingApprovalsNote')}
          value={String(pendingCount)}
        />
        <LedgerMetric
          icon={<ShieldCheck size={18} />}
          label={t('storeApprovals.approvalIntent')}
          note={
            showTargetApprovalQueue
              ? t('storeApprovals.targetApprovalQueueTitle')
              : t('storeApprovals.approvalIntentNote')
          }
          value={showTargetSubmission || showTargetApprovalQueue ? '1' : '0'}
        />
        <LedgerMetric
          icon={<Clock3 size={18} />}
          label={t('storeApprovals.approvedRequests')}
          note={t('storeApprovals.approvedRequestsNote')}
          value={String(approvedCount)}
        />
        <LedgerMetric
          icon={<CheckCircle2 size={18} />}
          label={
            showWorkforceHrQueues
              ? t('storeApprovals.ledgerReturnedCorrections')
              : t('storeApprovals.storePersonnel')
          }
          note={
            showWorkforceHrQueues
              ? t('storeApprovals.workforceQueueTitle')
              : t('storeApprovals.regionReviewCopy')
          }
          value={
            showWorkforceHrQueues
              ? String(returnedWorkforceCount)
              : String(personnelQuery.data?.items.length ?? 0)
          }
        />
      </section>

      <StoreApprovalsLedgerTable
        rows={visibleLedgerRows}
        searchValue={ledgerSearch}
        statusFilter={ledgerStatusFilter}
        statusOptions={ledgerStatusOptions}
        t={t}
        typeFilter={ledgerTypeFilter}
        typeOptions={ledgerTypeOptions}
        onPrimaryAction={() => {
          setLedgerTypeFilter('all')
          setLedgerStatusFilter('all')
          setLedgerSearch('')
        }}
        onSearchChange={setLedgerSearch}
        onStatusFilterChange={setLedgerStatusFilter}
        onTypeFilterChange={setLedgerTypeFilter}
      />

      <section
        className="store-approvals-ledger-inspector"
        aria-label={t('storeApprovals.ledgerInspectorAria')}
      >
        <aside className="store-approvals-action-workbench">
          <div className="store-approvals-action-head">
            <div>
              <div className="store-approvals-ledger-eyebrow">
                {t('storeApprovals.liveRequestFlow')}
              </div>
              <strong className="store-approvals-action-title">
                {t(ledgerActionLabelKeys[activeLedgerPanel])}
              </strong>
            </div>
            <StatusPill tone={activeLedgerPanel === 'overview' ? 'neutral' : 'calm'}>
              {t('storeApprovals.ledgerDetailStatus')}
            </StatusPill>
          </div>

          <div className="store-approvals-action-tabs" aria-label={t('storeApprovals.ledgerInspectorAria')}>
            {showTargetSubmission ? (
              <button
                className={getLedgerActionButtonClass('targetRequest')}
                type="button"
                aria-pressed={activeLedgerPanel === 'targetRequest'}
                onClick={() => setActiveLedgerPanel('targetRequest')}
              >
                {t('storeApprovals.openTargetRequest')}
              </button>
            ) : null}
            {showTargetApprovalQueue ? (
              <button
                className={getLedgerActionButtonClass('targetApproval')}
                type="button"
                aria-pressed={activeLedgerPanel === 'targetApproval'}
                onClick={() => setActiveLedgerPanel('targetApproval')}
              >
                {t('storeApprovals.openTargetApprovalQueue')}
              </button>
            ) : null}
            <button
              className={getLedgerActionButtonClass('submittedTargets')}
              type="button"
              aria-pressed={activeLedgerPanel === 'submittedTargets'}
              onClick={() => setActiveLedgerPanel('submittedTargets')}
            >
              {t('storeApprovals.openSubmittedTargets')}
            </button>
            {showWorkforceHrQueues ? (
              <>
                <button
                  className={getLedgerActionButtonClass('sellerCodeRequest')}
                  type="button"
                  aria-pressed={activeLedgerPanel === 'sellerCodeRequest'}
                  onClick={() => setActiveLedgerPanel('sellerCodeRequest')}
                >
                  {t('storeApprovals.openSellerCodeRequest')}
                </button>
                <button
                  className={getLedgerActionButtonClass('offboardingRequest')}
                  type="button"
                  aria-pressed={activeLedgerPanel === 'offboardingRequest'}
                  onClick={() => setActiveLedgerPanel('offboardingRequest')}
                >
                  {t('storeApprovals.openOffboardingRequest')}
                </button>
                <button
                  className={getLedgerActionButtonClass('returnedRequests')}
                  type="button"
                  aria-pressed={activeLedgerPanel === 'returnedRequests'}
                  onClick={() => setActiveLedgerPanel('returnedRequests')}
                >
                  {t('storeApprovals.openReturnedRequests')}
                </button>
              </>
            ) : null}
          </div>

          <div className="store-approvals-action-panel">
            {activeLedgerPanel === 'overview' ? (
              <EmptyState
                title={t('storeApprovals.ledgerDetailEmptyTitle')}
                copy={t('storeApprovals.ledgerDetailEmptyCopy')}
              />
            ) : null}

            {activeLedgerPanel === 'targetRequest' && showTargetSubmission ? (
              <TargetDistributionRequestForm
              activeAllocations={activeAllocations}
              allocationTotal={allocationTotal}
              assignedStoreIds={assignedStoreIds}
              canCreateForStore={showTargetSubmission}
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
            ) : null}

            {activeLedgerPanel === 'targetApproval' && showTargetApprovalQueue ? (
              <TargetApprovalLedger
              approvalNotes={approvalNotes}
              approvalNotice={approvalNotice}
              approvingRequestId={approveTargetMutation.variables?.requestId ?? null}
              isApproving={approveTargetMutation.isPending}
              locale={locale}
              onApprovalNoteChange={(requestId, value) =>
                setApprovalNotes((current) => ({ ...current, [requestId]: value }))
              }
              onApprove={(request) => {
                const canApprove = canApproveTargetDistributionRequest(
                  input.authSummary,
                  request.storeId,
                )

                if (!canApprove) {
                  return
                }

                approveTargetMutation.mutate({
                  requestId: request.requestId,
                  approvalNote: approvalNotes[request.requestId] || undefined,
                })
              }}
              requests={pendingTargetRequests}
              t={t}
              canApproveRequest={(request) =>
                canApproveTargetDistributionRequest(input.authSummary, request.storeId)
              }
              />
            ) : null}

            {activeLedgerPanel === 'submittedTargets' ? (
              <SubmittedTargetRequestsPanel locale={locale} requests={submittedTargetRequests} t={t} />
            ) : null}

            {activeLedgerPanel === 'returnedRequests' && showWorkforceHrQueues ? (
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
            ) : null}

            {activeLedgerPanel === 'sellerCodeRequest' && showWorkforceHrQueues ? (
              <SellerCodeRequestForm
              canCreateForStore={showWorkforceHrQueues}
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
            ) : null}

            {activeLedgerPanel === 'offboardingRequest' && showWorkforceHrQueues ? (
              <OffboardingRequestForm
              canCreateForStore={showWorkforceHrQueues}
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
              resubmitError={resubmitOffboardingMutation.error}
              storeEmployeesQuery={storeEmployeesQuery}
              t={t}
              />
            ) : null}
          </div>
        </aside>
      </section>
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

function StoreApprovalsLedgerTable(input: {
  onPrimaryAction: () => void
  onSearchChange: (value: string) => void
  onStatusFilterChange: (value: string) => void
  onTypeFilterChange: (value: string) => void
  rows: StoreApprovalsLedgerRow[]
  searchValue: string
  statusFilter: string
  statusOptions: string[]
  t: TranslateFunction
  typeFilter: string
  typeOptions: string[]
}) {
  return (
    <section className="store-approvals-ledger-workbench">
      <div className="store-approvals-ledger-toolbar">
        <div className="store-approvals-ledger-filters">
          <input
            aria-label={input.t('storeApprovals.ledgerSearchAria')}
            value={input.searchValue}
            onChange={(event) => input.onSearchChange(event.target.value)}
            placeholder={input.t('storeApprovals.ledgerSearchPlaceholder')}
          />
          <select
            aria-label={input.t('storeApprovals.ledgerTypeFilterAria')}
            value={input.typeFilter}
            onChange={(event) => input.onTypeFilterChange(event.target.value)}
          >
            <option value="all">{input.t('storeApprovals.ledgerAllTypes')}</option>
            {input.typeOptions.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
          <select
            aria-label={input.t('storeApprovals.ledgerStatusFilterAria')}
            value={input.statusFilter}
            onChange={(event) => input.onStatusFilterChange(event.target.value)}
          >
            <option value="all">{input.t('storeApprovals.ledgerAllStatuses')}</option>
            {input.statusOptions.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </div>
        <button
          className="store-approvals-ledger-button store-approvals-ledger-button-primary"
          type="button"
          onClick={input.onPrimaryAction}
        >
          {input.t('storeApprovals.ledgerResetFilters')}
        </button>
      </div>

      <div
        className="store-approvals-request-list"
        role="list"
        aria-label={input.t('storeApprovals.ledgerTableAria')}
      >
        {input.rows.length === 0 ? (
          <div className="store-approvals-request-empty" role="listitem">
            {input.t('storeApprovals.emptyQueue')}
          </div>
        ) : (
          input.rows.map((row) => (
            <article className="store-approvals-request-row" role="listitem" key={row.id}>
              <div className="store-approvals-request-main">
                <span className={`store-approvals-ledger-type store-approvals-ledger-type-${row.statusTone}`}>
                  {row.type}
                </span>
                <div className="store-approvals-request-copy">
                  <strong>{row.record}</strong>
                  <small>{row.detail}</small>
                </div>
              </div>
              <div className="store-approvals-request-meta">
                <span>{row.scope}</span>
                <span>{row.wait}</span>
                <span>{row.source}</span>
              </div>
              <StatusPill tone={row.statusTone}>{row.status}</StatusPill>
              <button
                className="store-approvals-request-action"
                type="button"
                onClick={row.onAction}
                disabled={!row.onAction}
              >
                {row.actionLabel}
              </button>
            </article>
          ))
        )}
      </div>
    </section>
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
        <p className="store-approvals-ledger-row-note">{input.approvalNotice}</p>
      ) : null}
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

      {input.hasSellerCodeRequestsError || input.hasOffboardingRequestsError ? (
        <div className="store-approvals-ledger-error">
          {getErrorMessage(input.sellerCodeRequestsError ?? input.offboardingRequestsError)}
        </div>
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

      {!input.canCreateForStore ? (
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
              <StatusPill tone={input.totalsAligned ? 'calm' : 'warning'}>
                {`${input.allocationTotal}/${Number(input.totalTargetValue || 0)}`}
              </StatusPill>
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
                const selectedPerson = input.personnelById.get(allocation.employeeId)

                return (
                  <div
                    className="store-request-allocation-row"
                    key={`allocation-${allocation.employeeId || index}`}
                  >
                    {selectedPerson ? (
                      <div className="store-request-allocation-person">
                        <strong>{allocation.assigneeLabel || input.t('storeApprovals.unassigned')}</strong>
                        <span>
                          {input.t('storeApprovals.currentSales')}: {
                            selectedPerson.netSalesValue !== null &&
                            selectedPerson.netSalesValue !== undefined
                              ? formatNumber(selectedPerson.netSalesValue, input.locale, {
                                  currency: 'TRY',
                                  maximumFractionDigits: 0,
                                  style: 'currency',
                                })
                              : input.t('storeApprovals.noData')
                          }
                        </span>
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
                        className="store-request-button"
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
              <p className="store-request-note">
                {input.t('storeApprovals.allocationMismatch')}
              </p>
            ) : null}

            <div className="store-request-actions">
              <button
                className="store-request-button"
                type="button"
                disabled={!input.canCreateForStore}
                onClick={input.onAddAllocation}
              >
                {input.t('storeApprovals.addAllocation')}
              </button>
            </div>
          </div>

          <div className="store-request-actions store-request-field-wide">
            <button
              className="store-request-button store-request-button-primary"
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
            <p className="store-request-note">{getErrorMessage(input.createError)}</p>
          ) : null}
          {input.submissionNotice ? (
            <p className="store-request-note">{input.submissionNotice}</p>
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

      {!input.canCreateForStore ? (
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
                className="store-request-button"
                type="button"
                disabled={input.isPending}
                onClick={input.onCancelEdit}
              >
                {input.t('storeApprovals.cancelEdit')}
              </button>
            ) : null}
          </div>

          {input.hasCreateError ? (
            <p className="store-request-note">{getErrorMessage(input.createError)}</p>
          ) : null}
          {input.hasResubmitError ? (
            <p className="store-request-note">{getErrorMessage(input.resubmitError)}</p>
          ) : null}
          {input.notice ? <p className="store-request-note">{input.notice}</p> : null}
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
  onCancelEdit: () => void
  onEmployeeIdChange: StringFieldSetter
  onRequestReasonChange: StringFieldSetter
  onSubmit: () => void
  onTerminationDateChange: StringFieldSetter
  resubmitError: unknown
  storeEmployeesQuery: ListQuerySnapshot<StoreEmployee>
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

      {!input.canCreateForStore ? (
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
                className="store-request-button"
                type="button"
                disabled={input.isPending}
                onClick={input.onCancelEdit}
              >
                {input.t('storeApprovals.cancelEdit')}
              </button>
            ) : null}
          </div>

          {input.hasCreateError ? (
            <p className="store-request-note">{getErrorMessage(input.createError)}</p>
          ) : null}
          {input.hasResubmitError ? (
            <p className="store-request-note">{getErrorMessage(input.resubmitError)}</p>
          ) : null}
          {input.notice ? <p className="store-request-note">{input.notice}</p> : null}
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
