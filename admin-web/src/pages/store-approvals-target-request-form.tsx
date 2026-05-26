import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import type { TranslateFunction } from '../features/localization/dictionary'
import type {
  StoreTargetingPerson,
  TargetDistributionAllocation,
} from '../features/targets/api'
import { getErrorMessage } from '../lib/format'
import type { AppLocale } from '../lib/i18n'
import {
  StoreApprovalEmptyState,
  StoreApprovalStatusBadge,
  StoreRequestFeedback,
} from './store-approvals-atoms'
import {
  formatAllocationShare,
  formatTargetNumber,
  type ListQuerySnapshot,
  type RequestFormAccess,
  type RequestFormErrors,
  type RequestFormSubmission,
  type StringFieldSetter,
} from './store-approvals-model'

export function TargetDistributionRequestForm(input: {
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
        <StoreApprovalStatusBadge tone="accent">{input.t('storeApprovals.writeFlow')}</StoreApprovalStatusBadge>
      </div>

      {!input.access.createAllowed ? (
        <StoreApprovalEmptyState
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
              <Select
                value={input.storeId}
                onValueChange={input.onStoreIdChange}
              >
                <SelectTrigger id="store-id" className="tw:w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {input.assignedStoreIds.map((assignedStoreId) => (
                      <SelectItem key={assignedStoreId} value={assignedStoreId}>
                        {assignedStoreId}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            ) : (
              <Input
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
            <Input
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
            <Input
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
            <Input
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
            <Textarea
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
                <StoreApprovalStatusBadge tone={input.totalsAligned ? 'calm' : 'warning'}>
                  {completionShare}
                </StoreApprovalStatusBadge>
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
                    <Input
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
                    <Input
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
            <Button
              type="button"
              disabled={!input.access.submitAllowed || input.submission.pending}
              onClick={input.onSubmit}
            >
              {input.submission.pending
                ? input.t('storeApprovals.submitting')
                : input.t('storeApprovals.submitTargetRequest')}
            </Button>
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
