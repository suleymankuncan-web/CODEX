import { Link } from 'react-router-dom'
import { Button } from '../components/ui/button'
import type {
  OffboardingRequest,
  SellerCodeRequest,
} from '../features/workforce/api'
import type { TranslateFunction } from '../features/localization/dictionary'
import { getErrorMessage } from '../lib/format'
import type { WorkforcePressure } from './operations-workforce-signal-model'
import {
  OperationsInlineState,
  OperationsKeyValue,
  OperationsKeyValueGrid,
  OperationsPanel,
  OperationsQueueList,
  OperationsStatusBadge,
  type OperationsTone,
} from './operations-surface-primitives'

type WorkforceQueuePreviewItem = {
  id: string
  meta: string
  reason: string
  status: string
  title: string
  tone: OperationsTone
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
    <OperationsPanel
      eyebrow={input.t('adminOperations.workforceEyebrow')}
      title={input.t('adminOperations.workforceTitle')}
      description={input.t('adminOperations.workforceCopy')}
      testId="operations-workforce-signal"
      badge={
        <OperationsStatusBadge tone={input.isError ? 'warning' : input.pressure.total > 0 ? 'warning' : 'calm'}>
          {input.isError
            ? input.t('adminOperations.unavailable')
            : input.pressure.total > 0
              ? input.t('adminOperations.needsAttention')
              : input.t('adminOperations.ready')}
        </OperationsStatusBadge>
      }
      actions={
        <Button asChild size="sm" variant="outline">
          <Link to="/admin/inbox">{input.t('adminOperations.openInbox')}</Link>
        </Button>
      }
    >

      {input.isError ? (
        <OperationsInlineState tone="warning">{getErrorMessage(input.error)}</OperationsInlineState>
      ) : (
        <OperationsKeyValueGrid>
          <OperationsKeyValue
            label={input.t('adminOperations.workforceSellerCode')}
            value={String(input.pressure.sellerCodeCount)}
          />
          <OperationsKeyValue
            label={input.t('adminOperations.workforceOffboarding')}
            value={String(input.pressure.offboardingCount)}
          />
          <OperationsKeyValue
            label={input.t('adminOperations.workforceTotal')}
            value={String(input.pressure.total)}
          />
        </OperationsKeyValueGrid>
      )}

      <OperationsQueueList
        emptyCopy={input.t('adminOperations.workforceQueueEmpty')}
        header={input.t('adminOperations.workforceQueueTitle')}
        status={
          <OperationsStatusBadge tone={previewItems.length > 0 ? 'warning' : 'calm'}>
            {previewItems.length > 0
              ? input.t('adminOperations.queueHasItems', { count: previewItems.length })
              : input.t('adminOperations.queueClear')}
          </OperationsStatusBadge>
        }
        items={previewItems.map((item) => ({
          footer: item.meta,
          id: item.id,
          meta: item.id,
          reason: item.reason,
          status: item.status,
          title: item.title,
          tone: item.tone,
        }))}
      />
    </OperationsPanel>
  )
}
