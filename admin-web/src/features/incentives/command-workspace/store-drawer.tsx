import { useRef, useState, type ReactNode } from 'react'
import { Store, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from '@/components/ui/sheet'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { CommandCanvasOperationalDrawerContent } from '@/features/store-command-canvas/primitives'
import type { AppLocale } from '@/lib/i18n'
import { formatIncentiveMoney, formatIncentivePercent } from './format'
import { isBelowIncentiveThreshold, isEarnedAtIncentiveThreshold, sumMoney } from './model'
import { StoreReviewEditor, type CompleteStoreIncentiveReview } from './store-review-editor'
import type { IncentiveStore, IncentiveWorkspace } from './types'

export function IncentiveStoreDrawer(input: {
  store: IncentiveStore | null; workspace: IncentiveWorkspace; locale: AppLocale
  interactionLocked: boolean; readOnly: boolean
  review: ReactNode; onClose: () => void; returnFocus: () => void
  onComplete?: CompleteStoreIncentiveReview | undefined
}) {
  const titleRef = useRef<HTMLHeadingElement>(null)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [discardOpen, setDiscardOpen] = useState(false)
  const [footerTarget, setFooterTarget] = useState<HTMLDivElement | null>(null)
  const [previewTotal, setPreviewTotal] = useState<{ storeId: string; total: string | null } | null>(null)
  const close = () => { if (saving) return; if (dirty) setDiscardOpen(true); else input.onClose() }
  const tr = input.locale === 'tr'
  const store = input.store
  const useDailyTracking = input.workspace.salesTracking?.status === 'complete' && Boolean(input.workspace.salesTracking.lastLoadedDate)
  const actualDisplay = store ? (useDailyTracking ? store.dailyActualNetSales : store.storeActualNetSales) : null
  const achievementDisplay = store ? (useDailyTracking ? store.dailyAchievementPct : store.storeAchievementPct) : null
  const finalAmount = store && previewTotal?.storeId === store.storeId
    ? previewTotal.total
    : store ? sumMoney(store.rows.map(row => row.finalAmount)) : null
  const packageNote = input.workspace.managerGroups.find(region => region.stores.some(item => item.storeId === store?.storeId))?.package.reviewNote
  const periodLabel = new Intl.DateTimeFormat(tr ? 'tr-TR' : 'en-GB', { month: 'long', year: 'numeric', timeZone: 'Europe/Istanbul' }).format(new Date(`${input.workspace.period}-01T00:00:00Z`))
  return <Sheet open={Boolean(store)} onOpenChange={open => { if (!open) close() }}>
    <CommandCanvasOperationalDrawerContent className={`incentive-store-sheet${input.readOnly ? '' : ' incentive-store-sheet--editable'}`} showCloseButton={false}
      onOpenAutoFocus={event => { event.preventDefault(); titleRef.current?.focus() }}
      onCloseAutoFocus={event => { event.preventDefault(); input.returnFocus() }}>
      <SheetHeader className="incentive-store-sheet-header">
        <span className="incentive-heading-icon"><Store aria-hidden="true" /></span>
        <div><small>{tr ? 'MAĞAZA PRİMLERİ' : 'STORE INCENTIVES'}</small><SheetTitle ref={titleRef} tabIndex={-1}>{store?.storeName}</SheetTitle><SheetDescription>{periodLabel} · {tr ? 'Personel hakedişleri ve prim oranları' : 'Personnel entitlements and rates'}</SheetDescription></div>
        <Button size="icon" variant="ghost" disabled={saving} aria-label={tr ? 'Mağaza detayını kapat' : 'Close store details'} onClick={close}><X aria-hidden="true" /></Button>
      </SheetHeader>
      {store ? <div className="incentive-store-sheet-body">
        <dl className="incentive-detail-totals">
          <div><dt>{tr ? 'Mağaza hedefi' : 'Store target'}</dt><dd>{formatIncentiveMoney(store.storeTarget, input.locale)}</dd></div>
          <div><dt>{tr ? (useDailyTracking ? 'Ay içi net satış' : 'Net satış') : (useDailyTracking ? 'Month-to-date net sales' : 'Net sales')}</dt><dd>{formatIncentiveMoney(actualDisplay, input.locale)}</dd></div>
          <div><dt>{useDailyTracking ? (tr ? 'Ay içi HG%' : 'Month-to-date target %') : 'HG%'}</dt><dd><span className={`incentive-value-tone${isBelowIncentiveThreshold(achievementDisplay) ? ' is-below-threshold' : ''}`}>{formatIncentivePercent(achievementDisplay, input.locale)}</span></dd></div>
          <div><dt>{tr ? 'Mağaza toplamı' : 'Store total'}</dt><dd><span className={`incentive-value-tone${isEarnedAtIncentiveThreshold(finalAmount, store.storeAchievementPct) ? ' is-earned' : ''}`}>{formatIncentiveMoney(finalAmount, input.locale)}</span></dd></div>
        </dl>
        {packageNote ? <section className="incentive-store-notes"><h4>{tr ? 'Paket karar notu' : 'Package decision note'}</h4><p>{packageNote}</p></section> : null}
        {store.review.periodCloseStatus !== 'closed' ? <p className="incentive-store-period-notice">{tr ? 'Dönem henüz kapanmadı. Kontrol ve düzeltme dönem kapandığında açılır.' : 'Review and corrections become available after period close.'}</p> : null}
        <StoreReviewEditor store={store} workspace={input.workspace} locale={input.locale} readOnly={input.readOnly} locked={input.interactionLocked} onComplete={input.onComplete} onPendingChange={setSaving} onDirtyChange={setDirty} onPreviewTotalChange={setPreviewTotal} footerTarget={footerTarget} />
      </div> : null}
      {!input.readOnly ? <SheetFooter className="incentive-store-sheet-footer"><div ref={setFooterTarget} className="incentive-completion-slot" />{input.review}</SheetFooter> : null}
      <Dialog open={discardOpen} onOpenChange={setDiscardOpen}><DialogContent><DialogHeader><DialogTitle>{tr ? 'Kaydedilmemiş değişiklikler var' : 'Unsaved changes'}</DialogTitle><DialogDescription>{tr ? 'Tutar düzenlemelerini bırakıp mağaza listesini açmak istiyor musunuz?' : 'Discard the amount edits and return to the store list?'}</DialogDescription></DialogHeader><DialogFooter><Button variant="outline" onClick={() => setDiscardOpen(false)}>{tr ? 'Düzenlemeye dön' : 'Keep editing'}</Button><Button onClick={() => { setDiscardOpen(false); input.onClose() }}>{tr ? 'Değişiklikleri bırak' : 'Discard changes'}</Button></DialogFooter></DialogContent></Dialog>
    </CommandCanvasOperationalDrawerContent>
  </Sheet>
}
