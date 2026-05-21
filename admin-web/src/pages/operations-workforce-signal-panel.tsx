import { Activity } from 'lucide-react'
import { Link } from 'react-router-dom'
import {
  EmptyState,
  KeyValue,
  StatusPill,
  type Tone,
} from '../components/dashboard-primitives'
import type {
  OffboardingRequest,
  SellerCodeRequest,
} from '../features/workforce/api'
import type { TranslateFunction } from '../features/localization/dictionary'
import { getErrorMessage } from '../lib/format'
import type { WorkforcePressure } from './operations-workforce-signal-model'

type WorkforceQueuePreviewItem = {
  id: string
  meta: string
  reason: string
  status: string
  title: string
  tone: Tone
}

export function WorkforceSignalPanel(input: {
  error: unknown
  isError: boolean
  offboardingItems: OffboardingRequest[]
  pressure: WorkforcePressure
  sellerCodeItems: SellerCodeRequest[]
  t: TranslateFunction
}) {
  const previewItems = [
    ...input.sellerCodeItems.map((item): WorkforceQueuePreviewItem => ({
      id: item.requestId,
      meta: input.t('adminOperations.workforceSellerMeta', {
        store: item.storeName,
      }),
      reason: input.t('adminOperations.workforceSellerReason'),
      status: item.status.replaceAll('_', ' '),
      title: `${item.firstName} ${item.lastName}`,
      tone: 'warning',
    })),
    ...input.offboardingItems.map((item): WorkforceQueuePreviewItem => ({
      id: item.requestId,
      meta: input.t('adminOperations.workforceOffboardingMeta', {
        store: item.storeName,
      }),
      reason: input.t('adminOperations.workforceOffboardingReason'),
      status: item.status.replaceAll('_', ' '),
      title: item.displayName,
      tone: 'warning',
    })),
  ].slice(0, 4)

  return (
    <article className="panel">
      <div className="panel-heading panel-heading-spread">
        <div>
          <div className="eyebrow">{input.t('adminOperations.workforceEyebrow')}</div>
          <h3>{input.t('adminOperations.workforceTitle')}</h3>
          <p className="panel-copy">{input.t('adminOperations.workforceCopy')}</p>
        </div>
        <StatusPill tone={input.isError ? 'warning' : input.pressure.total > 0 ? 'warning' : 'calm'}>
          {input.isError
            ? input.t('adminOperations.unavailable')
            : input.pressure.total > 0
              ? input.t('adminOperations.needsAttention')
              : input.t('adminOperations.ready')}
        </StatusPill>
      </div>

      {input.isError ? (
        <div className="inline-state inline-state-warning">{getErrorMessage(input.error)}</div>
      ) : (
        <div className="key-grid">
          <KeyValue
            label={input.t('adminOperations.workforceSellerCode')}
            value={String(input.pressure.sellerCodeCount)}
          />
          <KeyValue
            label={input.t('adminOperations.workforceOffboarding')}
            value={String(input.pressure.offboardingCount)}
          />
          <KeyValue
            label={input.t('adminOperations.workforceTotal')}
            value={String(input.pressure.total)}
          />
        </div>
      )}

      <div className="queue-list">
        <div className="queue-row-head">
          <strong>{input.t('adminOperations.workforceQueueTitle')}</strong>
          <StatusPill tone={previewItems.length > 0 ? 'warning' : 'calm'}>
            {previewItems.length > 0
              ? input.t('adminOperations.queueHasItems', { count: previewItems.length })
              : input.t('adminOperations.queueClear')}
          </StatusPill>
        </div>
        {previewItems.length === 0 ? (
          <EmptyState copy={input.t('adminOperations.workforceQueueEmpty')} />
        ) : (
          previewItems.map((item) => (
            <div className="queue-row" key={item.id}>
              <div className="queue-row-head">
                <div>
                  <div className="queue-title">{item.title}</div>
                  <div className="queue-subtitle">{item.id}</div>
                </div>
                <StatusPill tone={item.tone}>{item.status}</StatusPill>
              </div>
              <p className="queue-reason">{item.reason}</p>
              <div className="queue-footer">
                <span>{item.meta}</span>
                <Activity size={16} />
              </div>
            </div>
          ))
        )}
      </div>

      <div className="toolbar-cluster">
        <Link className="back-link" to="/admin/inbox">
          <span>{input.t('adminOperations.openInbox')}</span>
        </Link>
      </div>
    </article>
  )
}
