import type { AuthSessionSummary } from '../features/auth/api'
import { hasAnyRole } from '../features/auth/authorization'
import type { TranslateFunction, TranslationKey } from '../features/localization/dictionary'
import type { TargetDistributionAllocation } from '../features/targets/api'
import type {
  OffboardingRequest,
  PositionOption,
  SellerCodeRequest,
  SellerEmploymentType,
} from '../features/workforce/api'
import { formatNumber, formatState } from '../lib/format'
import { getBusinessDateInputValue } from '../lib/business-date'
import { createStoreApprovalsDateDefaults } from './business-date-defaults'
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

export function formatApprovalStatus(status: string, t: TranslateFunction) {
  const key = approvalStatusLabelKeys[status as keyof typeof approvalStatusLabelKeys]
  return key ? t(key) : formatState(status)
}

export function formatTargetNumber(value: number, locale: AppLocale) {
  return formatNumber(value, locale, {
    maximumFractionDigits: 0,
  })
}

export function formatAllocationShare(
  targetValue: number,
  totalTargetValue: number,
  locale: AppLocale,
) {
  if (totalTargetValue <= 0) {
    return '0%'
  }

  return `${formatNumber((targetValue / totalTargetValue) * 100, locale, {
    maximumFractionDigits: 1,
  })}%`
}

export function formatEmploymentType(type: SellerEmploymentType, t: TranslateFunction) {
  return t(employmentTypeLabelKeys[type])
}

export type ListQuerySnapshot<T> = {
  data: {
    items: T[]
  } | undefined
  error: unknown
  isError: boolean
  isLoading: boolean
}

export type StringFieldSetter = (value: string) => void
export type RequestFormAccess = {
  createAllowed: boolean
  submitAllowed: boolean
}
export type RequestFormSubmission = {
  notice: string | null
  pending: boolean
}
export type RequestFormErrors = {
  create: unknown
  createVisible: boolean
  resubmit?: unknown
  resubmitVisible?: boolean
}
export type StoreRequestFeedbackTone = 'error' | 'success'
export type StoreApprovalsPersona = 'storeManager' | 'regionManager' | 'readOnly'
export type StoreApprovalsLedgerPanel =
  | 'targetRequest'
  | 'targetApproval'
  | 'submittedTargets'
  | 'returnedRequests'
  | 'sellerCodeRequest'
  | 'offboardingRequest'

export type StoreApprovalsPageState = {
  selectedStoreId: string
  requestMonth: string
  targetLabel: string
  totalTargetValue: string
  requestReason: string
  submissionNotice: string | null
  approvalNotes: Record<string, string>
  approvalNotice: string | null
  activeLedgerPanel: StoreApprovalsLedgerPanel
  sellerFirstName: string
  sellerLastName: string
  sellerNationalId: string
  sellerPhoneNumber: string
  sellerHireDate: string
  sellerPositionId: string
  sellerEmploymentType: SellerEmploymentType
  sellerRequestReason: string
  sellerRequestNotice: string | null
  editingSellerRequestId: string | null
  offboardingEmployeeId: string
  offboardingTerminationDate: string
  offboardingRequestReason: string
  offboardingNotice: string | null
  editingOffboardingRequestId: string | null
  allocations: Array<TargetDistributionAllocation>
}

type StoreApprovalsPageStateInput = {
  defaultTargetLabel: string
  initialPanel: StoreApprovalsLedgerPanel
}

export type StoreApprovalsPageAction =
  | { type: 'setSelectedStoreId'; value: string }
  | { type: 'setActiveLedgerPanel'; panel: StoreApprovalsLedgerPanel }
  | { type: 'resetTargetRequestSuccess'; message: string; defaultTargetLabel: string }
  | { type: 'setRequestMonth'; value: string }
  | { type: 'setTargetLabel'; value: string }
  | { type: 'setTotalTargetValue'; value: string }
  | { type: 'setRequestReason'; value: string }
  | { type: 'replaceAllocations'; allocations: Array<TargetDistributionAllocation> }
  | { type: 'setApprovalNote'; requestId: string; value: string }
  | { type: 'setApprovalNotice'; message: string }
  | { type: 'resetSellerRequestSuccess'; message: string }
  | { type: 'loadSellerRequestEdit'; item: SellerCodeRequest; notice: string }
  | { type: 'cancelSellerRequestEdit' }
  | { type: 'setSellerEmploymentType'; value: SellerEmploymentType }
  | { type: 'setSellerFirstName'; value: string }
  | { type: 'setSellerHireDate'; value: string }
  | { type: 'setSellerLastName'; value: string }
  | { type: 'setSellerNationalId'; value: string }
  | { type: 'setSellerPhoneNumber'; value: string }
  | { type: 'setSellerPositionId'; value: string }
  | { type: 'setSellerRequestReason'; value: string }
  | { type: 'resetOffboardingRequestSuccess'; message: string }
  | { type: 'loadOffboardingRequestEdit'; item: OffboardingRequest; notice: string }
  | { type: 'cancelOffboardingRequestEdit' }
  | { type: 'setOffboardingEmployeeId'; value: string }
  | { type: 'setOffboardingRequestReason'; value: string }
  | { type: 'setOffboardingTerminationDate'; value: string }

function getEmptyTargetAllocations(): Array<TargetDistributionAllocation> {
  return [{ employeeId: '', assigneeLabel: '', targetValue: 0, note: '' }]
}

export function createStoreApprovalsPageState(
  input: StoreApprovalsPageStateInput,
  now: Date = new Date(),
): StoreApprovalsPageState {
  const defaults = createStoreApprovalsDateDefaults(now)
  return {
    selectedStoreId: '',
    requestMonth: defaults.month,
    targetLabel: input.defaultTargetLabel,
    totalTargetValue: '0',
    requestReason: '',
    submissionNotice: null,
    approvalNotes: {},
    approvalNotice: null,
    activeLedgerPanel: input.initialPanel,
    sellerFirstName: '',
    sellerLastName: '',
    sellerNationalId: '',
    sellerPhoneNumber: '',
    sellerHireDate: defaults.date,
    sellerPositionId: '',
    sellerEmploymentType: 'full_time',
    sellerRequestReason: '',
    sellerRequestNotice: null,
    editingSellerRequestId: null,
    offboardingEmployeeId: '',
    offboardingTerminationDate: defaults.date,
    offboardingRequestReason: '',
    offboardingNotice: null,
    editingOffboardingRequestId: null,
    allocations: getEmptyTargetAllocations(),
  }
}

function resetSellerRequestState(state: StoreApprovalsPageState, notice: string | null): StoreApprovalsPageState {
  return {
    ...state,
    editingSellerRequestId: null,
    sellerFirstName: '',
    sellerLastName: '',
    sellerNationalId: '',
    sellerPhoneNumber: '',
    sellerHireDate: getBusinessDateInputValue(),
    sellerPositionId: '',
    sellerEmploymentType: 'full_time',
    sellerRequestReason: '',
    sellerRequestNotice: notice,
  }
}

function resetOffboardingRequestState(state: StoreApprovalsPageState, notice: string | null): StoreApprovalsPageState {
  return {
    ...state,
    editingOffboardingRequestId: null,
    offboardingEmployeeId: '',
    offboardingTerminationDate: getBusinessDateInputValue(),
    offboardingRequestReason: '',
    offboardingNotice: notice,
  }
}

export function storeApprovalsPageReducer(
  state: StoreApprovalsPageState,
  action: StoreApprovalsPageAction,
): StoreApprovalsPageState {
  switch (action.type) {
    case 'setSelectedStoreId':
      return { ...state, selectedStoreId: action.value }
    case 'setActiveLedgerPanel':
      return { ...state, activeLedgerPanel: action.panel }
    case 'resetTargetRequestSuccess':
      return {
        ...state,
        targetLabel: action.defaultTargetLabel,
        totalTargetValue: '0',
        requestReason: '',
        allocations: [],
        submissionNotice: action.message,
      }
    case 'setRequestMonth':
      return { ...state, requestMonth: action.value, submissionNotice: null }
    case 'setTargetLabel':
      return { ...state, targetLabel: action.value, submissionNotice: null }
    case 'setTotalTargetValue':
      return { ...state, totalTargetValue: action.value, submissionNotice: null }
    case 'setRequestReason':
      return { ...state, requestReason: action.value, submissionNotice: null }
    case 'replaceAllocations':
      return { ...state, allocations: action.allocations, submissionNotice: null }
    case 'setApprovalNote':
      return {
        ...state,
        approvalNotes: { ...state.approvalNotes, [action.requestId]: action.value },
      }
    case 'setApprovalNotice':
      return { ...state, approvalNotice: action.message }
    case 'resetSellerRequestSuccess':
      return resetSellerRequestState(state, action.message)
    case 'loadSellerRequestEdit':
      return {
        ...state,
        activeLedgerPanel: 'sellerCodeRequest',
        editingSellerRequestId: action.item.requestId,
        sellerFirstName: action.item.firstName,
        sellerLastName: action.item.lastName,
        sellerNationalId: '',
        sellerPhoneNumber: action.item.phoneNumber,
        sellerHireDate: action.item.hireDate,
        sellerPositionId: action.item.requestedPositionId,
        sellerEmploymentType: action.item.employmentType as SellerEmploymentType,
        sellerRequestReason: '',
        sellerRequestNotice: action.notice,
      }
    case 'cancelSellerRequestEdit':
      return resetSellerRequestState(state, null)
    case 'setSellerEmploymentType':
      return { ...state, sellerEmploymentType: action.value, sellerRequestNotice: null }
    case 'setSellerFirstName':
      return { ...state, sellerFirstName: action.value, sellerRequestNotice: null }
    case 'setSellerHireDate':
      return { ...state, sellerHireDate: action.value, sellerRequestNotice: null }
    case 'setSellerLastName':
      return { ...state, sellerLastName: action.value, sellerRequestNotice: null }
    case 'setSellerNationalId':
      return { ...state, sellerNationalId: action.value.replace(/\D/g, '').slice(0, 11), sellerRequestNotice: null }
    case 'setSellerPhoneNumber':
      return { ...state, sellerPhoneNumber: action.value, sellerRequestNotice: null }
    case 'setSellerPositionId':
      return { ...state, sellerPositionId: action.value, sellerRequestNotice: null }
    case 'setSellerRequestReason':
      return { ...state, sellerRequestReason: action.value, sellerRequestNotice: null }
    case 'resetOffboardingRequestSuccess':
      return resetOffboardingRequestState(state, action.message)
    case 'loadOffboardingRequestEdit':
      return {
        ...state,
        activeLedgerPanel: 'offboardingRequest',
        editingOffboardingRequestId: action.item.requestId,
        offboardingEmployeeId: action.item.employeeId,
        offboardingTerminationDate: action.item.terminationDate,
        offboardingRequestReason: action.item.requestReason ?? '',
        offboardingNotice: action.notice,
      }
    case 'cancelOffboardingRequestEdit':
      return resetOffboardingRequestState(state, null)
    case 'setOffboardingEmployeeId':
      return { ...state, offboardingEmployeeId: action.value, offboardingNotice: null }
    case 'setOffboardingRequestReason':
      return { ...state, offboardingRequestReason: action.value, offboardingNotice: null }
    case 'setOffboardingTerminationDate':
      return { ...state, offboardingTerminationDate: action.value, offboardingNotice: null }
    default:
      return state
  }
}

const storeSellerPositionLabels = {
  cashierResponsible: 'Kasa Sorumlusu',
  salesConsultant: 'Satış Danışmanı',
  seniorSalesConsultant: 'Uzman Satış Danışmanı',
  storeAssistantManager: 'Mağaza Müdür Yardımcısı',
  storeManager: 'Mağaza Müdürü',
} as const
type StoreSellerPositionKey = keyof typeof storeSellerPositionLabels
export type StoreSellerPositionOption = {
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

export const ledgerActionLabelKeys = {
  offboardingRequest: 'storeApprovals.openOffboardingRequest',
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

export function getStoreSellerPositionOptions(positions: readonly PositionOption[]) {
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

export function resolveStoreApprovalsPersona(
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
