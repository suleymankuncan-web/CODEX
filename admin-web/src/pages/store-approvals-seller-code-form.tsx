import { formatPersonnelPhone, nationalPhoneDigits } from '../lib/phone-number'
import { CalendarPicker } from '../components/ui/calendar-picker'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import type { TranslateFunction } from '../features/localization/dictionary'
import type { PositionOption, SellerEmploymentType } from '../features/workforce/api'
import { getErrorMessage } from '../lib/format'
import {
  StoreApprovalEmptyState,
  StoreApprovalStatusBadge,
  StoreRequestFeedback,
} from './store-approvals-atoms'
import {
  formatEmploymentType,
  getStoreSellerPositionOptions,
  type ListQuerySnapshot,
  type RequestFormAccess,
  type RequestFormErrors,
  type RequestFormSubmission,
  type StringFieldSetter,
} from './store-approvals-model'

const UNSELECTED_POSITION_VALUE = '__unselected_position__'

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
  onUsernameChange: StringFieldSetter
  onEmailChange: StringFieldSetter
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
  sellerUsername: string
  sellerEmail: string
  sellerPositionId: string
  sellerRequestReason: string
  submission: RequestFormSubmission
  storeId: string
  storeLabel?: string
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
        <StoreApprovalStatusBadge tone="calm">{input.t('storeApprovals.hrQueue')}</StoreApprovalStatusBadge>
      </div>

      {!input.access.createAllowed ? (
        <StoreApprovalEmptyState
          title={input.t('storeApprovals.assignedActionStoreRequired')}
          copy={input.t('storeApprovals.sellerUnavailableCopy')}
        />
      ) : (
        <div className="store-request-grid"><p className="store-request-field-wide">Tüm alanlar zorunludur.</p>
          <div className="store-request-field">
            <label className="store-request-label" htmlFor="seller-store-id">
              {input.t('storeApprovals.storeId')}
            </label>
            <Input required
              id="seller-store-id"
              value={input.storeLabel ?? input.t('storeApprovals.unknownStore')}
              readOnly
            />
          </div>

          <div className="store-request-field">
            <label className="store-request-label" htmlFor="seller-first-name">
              {input.t('storeApprovals.firstName')}
            </label>
            <Input required
              id="seller-first-name"
              autoCapitalize="words"
              autoComplete="given-name"
              className="tw:normal-case"
              value={input.sellerFirstName}
              onChange={(event) => input.onFirstNameChange(event.target.value)}
              placeholder={input.t('storeApprovals.firstNamePlaceholder')}
            />
          </div>

          <div className="store-request-field">
            <label className="store-request-label" htmlFor="seller-last-name">
              {input.t('storeApprovals.lastName')}
            </label>
            <Input required
              id="seller-last-name"
              autoCapitalize="words"
              autoComplete="family-name"
              className="tw:normal-case"
              value={input.sellerLastName}
              onChange={(event) => input.onLastNameChange(event.target.value)}
              placeholder={input.t('storeApprovals.lastNamePlaceholder')}
            />
          </div>

          <div className="store-request-field">
            <label className="store-request-label" htmlFor="seller-position-id">
              {input.t('storeApprovals.position')}
            </label>
            <Select
              value={input.sellerPositionId || UNSELECTED_POSITION_VALUE}
              disabled={input.positionOptionsQuery.isLoading || input.positionOptionsQuery.isError}
              onValueChange={(value) =>
                input.onPositionIdChange(value === UNSELECTED_POSITION_VALUE ? '' : value)
              }
            >
              <SelectTrigger id="seller-position-id" className="tw:w-full">
                <SelectValue placeholder={input.t('storeApprovals.selectPosition')} />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value={UNSELECTED_POSITION_VALUE}>
                    {input.t('storeApprovals.selectPosition')}
                  </SelectItem>
                  {sellerPositionOptions.map(({ label, position }) => (
                    <SelectItem key={position.positionId} value={position.positionId}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
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
            <Input required
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
            <Input required
              id="seller-phone-number"
              type="tel"
              value={formatPersonnelPhone(input.sellerPhoneNumber)}
              onChange={(event) => input.onPhoneNumberChange(nationalPhoneDigits(event.target.value))}
              placeholder="(539) 123 45 67"
                aria-describedby="seller-phone-hint"
            />
          </div>

          <div className="store-request-field">
            <label className="store-request-label" htmlFor="seller-hire-date">
              {input.t('storeApprovals.hireDate')}
            </label>
            <CalendarPicker mode="single" ariaLabel={input.t('storeApprovals.hireDate')} value={input.sellerHireDate} onValueChange={input.onHireDateChange} />
          </div>

          <div className="store-request-field">
            <label className="store-request-label" htmlFor="seller-email">
              {input.t('storeApprovals.email')}
            </label>
            <Input required id="seller-email" type="email" autoComplete="email" value={input.sellerEmail} onChange={(event) => input.onEmailChange(event.target.value)} />
          </div>

          <div className="store-request-field">
            <label className="store-request-label" htmlFor="seller-employment-type">
              {input.t('storeApprovals.employmentType')}
            </label>
            <Select
              value={input.sellerEmploymentType}
              onValueChange={(value) => input.onEmploymentTypeChange(value as SellerEmploymentType)}
            >
              <SelectTrigger id="seller-employment-type" className="tw:w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="full_time">{formatEmploymentType('full_time', input.t)}</SelectItem>
                  <SelectItem value="part_time">{formatEmploymentType('part_time', input.t)}</SelectItem>
                  <SelectItem value="temporary">{formatEmploymentType('temporary', input.t)}</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>

          <div className="store-request-field store-request-field-wide">
            <label className="store-request-label" htmlFor="seller-request-reason">
              {input.t('storeApprovals.requestReason')}
            </label>
            <Textarea required
              id="seller-request-reason"
              rows={3}
              value={input.sellerRequestReason}
              onChange={(event) => input.onRequestReasonChange(event.target.value)}
              placeholder={input.t('storeApprovals.newPersonnelPlaceholder')}
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
                  ? input.t('storeApprovals.resubmitSellerCodeRequest')
                  : input.t('storeApprovals.submitSellerCodeRequest')}
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
