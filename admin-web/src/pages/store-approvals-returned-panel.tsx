import { Button } from '@/components/ui/button'
import type { TranslateFunction } from '../features/localization/dictionary'
import type { OffboardingRequest, SellerCodeRequest } from '../features/workforce/api'
import { formatDate, formatDateTime, getErrorMessage } from '../lib/format'
import type { AppLocale } from '../lib/i18n'
import { formatApprovalStatus } from './store-approvals-model'
import {
  StoreApprovalEmptyState,
  StoreApprovalKeyValue,
  StoreApprovalStatusBadge,
  StoreRequestFeedback,
} from './store-approvals-atoms'

export function ReturnedRequestsPanel(input: {
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
      className="store-approvals-panel"
      aria-label={input.t('storeApprovals.returnedAria')}
    >
      <div className="store-approvals-panel-head">
        <div>
          <div className="store-approvals-ledger-eyebrow">
            {input.t('storeApprovals.returnedEyebrow')}
          </div>
          <h3>{input.t('storeApprovals.returnedTitle')}</h3>
        </div>
        <StoreApprovalStatusBadge tone={returnedRequestCount > 0 ? 'warning' : 'calm'}>
          {String(returnedRequestCount)}
        </StoreApprovalStatusBadge>
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
        <StoreApprovalEmptyState
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
                <StoreApprovalStatusBadge tone="warning">
                  {formatApprovalStatus(item.status, input.t)}
                </StoreApprovalStatusBadge>
              </div>
              <div className="store-approvals-ledger-key-grid">
                <StoreApprovalKeyValue label={input.t('storeApprovals.position')} value={item.positionName} />
                <StoreApprovalKeyValue
                  label={input.t('storeApprovals.reviewNote')}
                  value={item.reviewNote ?? input.t('storeApprovals.noNote')}
                />
                <StoreApprovalKeyValue
                  label={input.t('storeApprovals.updatedAt')}
                  value={formatDateTime(item.updatedAt, input.locale)}
                />
              </div>
              <div className="store-approvals-ledger-actions">
                <Button
                  type="button"
                  onClick={() => input.onEditSellerCodeRequest(item)}
                >
                  {input.t('storeApprovals.editSellerCodeRequest')}
                </Button>
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
                <StoreApprovalStatusBadge tone="warning">
                  {formatApprovalStatus(item.status, input.t)}
                </StoreApprovalStatusBadge>
              </div>
              <div className="store-approvals-ledger-key-grid">
                <StoreApprovalKeyValue
                  label={input.t('storeApprovals.terminationDate')}
                  value={formatDate(item.terminationDate, input.locale)}
                />
                <StoreApprovalKeyValue
                  label={input.t('storeApprovals.requestReason')}
                  value={item.requestReason ?? input.t('storeApprovals.noNote')}
                />
                <StoreApprovalKeyValue
                  label={input.t('storeApprovals.reviewNote')}
                  value={item.reviewNote ?? input.t('storeApprovals.noNote')}
                />
              </div>
              <div className="store-approvals-ledger-actions">
                <Button
                  type="button"
                  onClick={() => input.onEditOffboardingRequest(item)}
                >
                  {input.t('storeApprovals.editOffboardingRequest')}
                </Button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}
