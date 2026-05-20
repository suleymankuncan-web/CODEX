import { StatusPill } from '../components/dashboard-primitives'
import type { TranslateFunction } from '../features/localization/dictionary'
import type {
  StoreTargetingPerson,
  TargetDistributionAllocation,
  TargetDistributionRequest,
} from '../features/targets/api'
import type {
  OffboardingRequest,
  PositionOption,
  SellerCodeRequest,
  SellerEmploymentType,
  StoreEmployee,
} from '../features/workforce/api'
import type { AppLocale } from '../lib/i18n'
import {
  ledgerActionLabelKeys,
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

export function StoreApprovalsWorkbench(input: StoreApprovalsWorkbenchInput) {
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
