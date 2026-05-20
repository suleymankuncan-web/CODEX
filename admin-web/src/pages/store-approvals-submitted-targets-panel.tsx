import { EmptyState, KeyValue, StatusPill } from '../components/dashboard-primitives'
import type { TranslateFunction } from '../features/localization/dictionary'
import type { TargetDistributionRequest } from '../features/targets/api'
import { formatDate, formatDateTime } from '../lib/format'
import type { AppLocale } from '../lib/i18n'
import { formatApprovalStatus } from './store-approvals-model'
import { TargetAllocationBreakdown } from './store-approvals-target-atoms'

export function SubmittedTargetRequestsPanel(input: {
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
              <TargetAllocationBreakdown
                allocations={item.allocations}
                locale={input.locale}
                totalTargetValue={item.totalTargetValue}
              />
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
