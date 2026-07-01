import type { TranslateFunction } from '../features/localization/dictionary'
import type { TargetDistributionRequest } from '../features/targets/api'
import { normalizeDisplayLabel } from '../lib/display-labels'
import { formatDate, formatDateTime } from '../lib/format'
import type { AppLocale } from '../lib/i18n'
import {
  StoreApprovalEmptyState,
  StoreApprovalKeyValue,
  StoreApprovalStatusBadge,
} from './store-approvals-atoms'
import { formatApprovalStatus } from './store-approvals-model'
import { TargetAllocationBreakdown } from './store-approvals-target-atoms'

export function SubmittedTargetRequestsPanel(input: {
  locale: AppLocale
  requests: TargetDistributionRequest[]
  t: TranslateFunction
}) {
  return (
    <section className="store-approvals-panel">
      <div className="store-approvals-panel-head">
        <div>
          <div className="store-approvals-ledger-eyebrow">
            {input.t('storeApprovals.submittedEyebrow')}
          </div>
          <h3>{input.t('storeApprovals.submittedTargetLedgerTitle')}</h3>
        </div>
      </div>

      {input.requests.length === 0 ? (
        <StoreApprovalEmptyState
          title={input.t('storeApprovals.noSubmittedTitle')}
          copy={input.t('storeApprovals.noSubmittedCopy')}
        />
      ) : (
        <div className="store-approvals-ledger-rows">
          {input.requests.map((item) => (
            <article className="store-approvals-ledger-row" key={item.requestId}>
              <div className="store-approvals-ledger-row-head">
                <strong>{item.targetLabel}</strong>
                <StoreApprovalStatusBadge tone={item.status === 'approved' ? 'calm' : 'warning'}>
                  {formatApprovalStatus(item.status, input.t)}
                </StoreApprovalStatusBadge>
              </div>
              <p>
                {input.t('storeApprovals.targetSummary', {
                  month: formatDate(item.requestMonth, input.locale),
                  storeName: normalizeDisplayLabel(item.storeName, input.t('storeApprovals.unknownStore')),
                  value: item.totalTargetValue,
                })}
              </p>
              <div className="store-approvals-ledger-key-grid">
                <StoreApprovalKeyValue
                  label={input.t('storeApprovals.allocationCount')}
                  value={String(item.allocationCount)}
                />
                <StoreApprovalKeyValue
                  label={input.t('storeApprovals.createdAt')}
                  value={formatDateTime(item.createdAt, input.locale)}
                />
                <StoreApprovalKeyValue
                  label={input.t('storeApprovals.approvedAt')}
                  value={
                    item.approvedAt
                      ? formatDateTime(item.approvedAt, input.locale)
                      : input.t('storeApprovals.pending')
                  }
                />
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
