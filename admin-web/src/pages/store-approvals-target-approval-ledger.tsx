import { EmptyState, KeyValue, StatusPill } from '../components/dashboard-primitives'
import type { TranslateFunction } from '../features/localization/dictionary'
import type { TargetDistributionRequest } from '../features/targets/api'
import { formatDate, formatDateTime } from '../lib/format'
import type { AppLocale } from '../lib/i18n'
import { StoreRequestFeedback } from './store-approvals-atoms'
import { formatApprovalStatus } from './store-approvals-model'
import { TargetAllocationBreakdown } from './store-approvals-target-atoms'

export function TargetApprovalLedger(input: {
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
                <TargetAllocationBreakdown
                  allocations={item.allocations}
                  locale={input.locale}
                  totalTargetValue={item.totalTargetValue}
                />
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
        <StoreRequestFeedback tone="success" className="store-approvals-ledger-feedback">
          {input.approvalNotice}
        </StoreRequestFeedback>
      ) : null}
    </section>
  )
}
