import { ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { TranslateFunction } from '../features/localization/dictionary'
import type { OffboardingRequest, SellerCodeRequest } from '../features/workforce/api'
import { formatDateTime, getErrorMessage } from '../lib/format'
import type { AppLocale } from '../lib/i18n'

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
  const items = [
    ...input.returnedSellerCodeRequests.map(item => ({ id: item.requestId, name: `${item.firstName} ${item.lastName}`, detail: `${item.positionName} · ${item.storeName}`, reviewNote: item.reviewNote, updatedAt: item.updatedAt, edit: () => input.onEditSellerCodeRequest(item) })),
    ...input.returnedOffboardingRequests.map(item => ({ id: item.requestId, name: item.displayName, detail: `İşten ayrılma talebi · ${item.storeName}`, reviewNote: item.reviewNote, updatedAt: item.updatedAt, edit: () => input.onEditOffboardingRequest(item) })),
  ]
  if (input.hasSellerCodeRequestsError || input.hasOffboardingRequestsError) return <p role="alert">{getErrorMessage(input.sellerCodeRequestsError ?? input.offboardingRequestsError)}</p>
  return <section aria-label={input.t('storeApprovals.returnedAria')} className="workforce-returned-list">
    {!items.length ? <p>{input.t('storeApprovals.returnedEmptyTitle')}</p> : items.map(item => <article className="workforce-returned-row" key={item.id}>
      <div><strong>{item.name}</strong><p>{item.detail}</p>{item.reviewNote ? <p><b>{input.t('storeApprovals.reviewNote')}:</b> {item.reviewNote}</p> : null}<p>{formatDateTime(item.updatedAt, input.locale)}</p></div>
      <Button size="sm" onClick={item.edit}>Düzenle<ArrowRight aria-hidden="true" /></Button>
    </article>)}
  </section>
}
