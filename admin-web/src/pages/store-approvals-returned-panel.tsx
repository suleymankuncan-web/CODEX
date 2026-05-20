import { EmptyState, KeyValue, StatusPill } from '../components/dashboard-primitives'
import type { TranslateFunction } from '../features/localization/dictionary'
import type { OffboardingRequest, SellerCodeRequest } from '../features/workforce/api'
import { formatDate, formatDateTime, getErrorMessage } from '../lib/format'
import type { AppLocale } from '../lib/i18n'
import { formatApprovalStatus } from './store-approvals-model'
import { StoreRequestFeedback } from './store-approvals-atoms'

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
