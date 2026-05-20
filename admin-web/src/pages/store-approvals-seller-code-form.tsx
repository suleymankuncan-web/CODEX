import { EmptyState, StatusPill } from '../components/dashboard-primitives'
import type { TranslateFunction } from '../features/localization/dictionary'
import type { PositionOption, SellerEmploymentType } from '../features/workforce/api'
import { getErrorMessage } from '../lib/format'
import { StoreRequestFeedback } from './store-approvals-atoms'
import {
  formatEmploymentType,
  getStoreSellerPositionOptions,
  type ListQuerySnapshot,
  type RequestFormAccess,
  type RequestFormErrors,
  type RequestFormSubmission,
  type StringFieldSetter,
} from './store-approvals-model'

export function SellerCodeRequestForm(input: {
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
