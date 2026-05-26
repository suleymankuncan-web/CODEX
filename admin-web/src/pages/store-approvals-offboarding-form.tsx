import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import type { TranslateFunction } from '../features/localization/dictionary'
import type { StoreEmployee } from '../features/workforce/api'
import { getErrorMessage } from '../lib/format'
import {
  StoreApprovalEmptyState,
  StoreApprovalStatusBadge,
  StoreRequestFeedback,
} from './store-approvals-atoms'
import {
  type ListQuerySnapshot,
  type RequestFormAccess,
  type RequestFormErrors,
  type RequestFormSubmission,
  type StringFieldSetter,
} from './store-approvals-model'

const UNSELECTED_EMPLOYEE_VALUE = '__unselected_employee__'

export function OffboardingRequestForm(input: {
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
        <StoreApprovalStatusBadge tone="warning">{input.t('storeApprovals.hrQueue')}</StoreApprovalStatusBadge>
      </div>

      {!input.access.createAllowed ? (
        <StoreApprovalEmptyState
          title={input.t('storeApprovals.assignedActionStoreRequired')}
          copy={input.t('storeApprovals.offboardingUnavailableCopy')}
        />
      ) : (
        <div className="store-request-grid">
          <div className="store-request-field store-request-field-wide">
            <label className="store-request-label" htmlFor="offboarding-employee-id">
              {input.t('storeApprovals.employee')}
            </label>
            <Select
              value={input.offboardingEmployeeId || UNSELECTED_EMPLOYEE_VALUE}
              disabled={input.storeEmployeesQuery.isLoading || input.storeEmployeesQuery.isError}
              onValueChange={(value) =>
                input.onEmployeeIdChange(value === UNSELECTED_EMPLOYEE_VALUE ? '' : value)
              }
            >
              <SelectTrigger id="offboarding-employee-id" className="tw:w-full">
                <SelectValue placeholder={input.t('storeApprovals.selectEmployee')} />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value={UNSELECTED_EMPLOYEE_VALUE}>
                    {input.t('storeApprovals.selectEmployee')}
                  </SelectItem>
                  {(input.storeEmployeesQuery.data?.items ?? []).map((employee) => (
                    <SelectItem key={employee.employeeId} value={employee.employeeId}>
                      {employee.displayName} ({employee.externalEmployeeRef ?? employee.positionName})
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
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
            <Input
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
            <Textarea
              id="offboarding-request-reason"
              rows={3}
              value={input.offboardingRequestReason}
              onChange={(event) => input.onRequestReasonChange(event.target.value)}
              placeholder={input.t('storeApprovals.offboardingReasonPlaceholder')}
            />
          </div>

          <div className="store-request-actions store-request-field-wide">
            <Button
              type="button"
              disabled={!input.access.submitAllowed || input.submission.pending}
              onClick={input.onSubmit}
            >
              {input.submission.pending
                ? input.t('storeApprovals.submitting')
                : input.editingRequestId
                  ? input.t('storeApprovals.resubmitOffboardingRequest')
                  : input.t('storeApprovals.submitOffboardingRequest')}
            </Button>
            {input.editingRequestId ? (
              <Button
                variant="outline"
                type="button"
                disabled={input.submission.pending}
                onClick={input.onCancelEdit}
              >
                {input.t('storeApprovals.cancelEdit')}
              </Button>
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
