import { useId, useState } from 'react'
import { X, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Switch } from '@/components/ui/switch'
import { Skeleton } from '@/components/ui/skeleton'
import { useStoreReturns, isReturnsAccessError, type StoreReturnsRange } from './api'
import { useStoreReturnsScope } from './scope-context'
import { returnDate } from './format'
import { StoreReturnsCoverage, StoreReturnsTotals } from './coverage'
import { StoreReturnsRows } from './rows'

export function StoreReturnsDialog(input: StoreReturnsRange & { storeName: string; locale: 'tr' | 'en'; open: boolean; onOpenChange: (open: boolean) => void; restoreFocus: () => void }) {
  return <Dialog open={input.open} onOpenChange={input.onOpenChange}>{input.open ? <ReturnsContent {...input} key={`${input.storeId}:${input.periodStart}:${input.periodEnd}`} /> : null}</Dialog>
}

function ReturnsContent(input: StoreReturnsRange & { storeName: string; locale: 'tr' | 'en'; restoreFocus: () => void }) {
  const auth = useStoreReturnsScope()
  const [other, setOther] = useState(false)
  const [offset, setOffset] = useState(0)
  const switchId = useId()
  const tr = input.locale === 'tr'
  const query = useStoreReturns(auth, input, other ? 'other' : 'inside', offset)
  const totalsQuery = useStoreReturns(auth, input)
  const protectedError = isReturnsAccessError(query.error) || isReturnsAccessError(totalsQuery.error)
  const ledger = protectedError ? undefined : query.data?.data
  const totalsLedger = protectedError ? undefined : totalsQuery.data?.data
  const retry = <Button variant="outline" className="tw:min-h-11" onClick={() => { void query.refetch(); if (other || offset !== 0) void totalsQuery.refetch() }}><RotateCcw aria-hidden />{tr ? 'Yeniden dene' : 'Retry'}</Button>
  return <DialogContent showCloseButton={false} onCloseAutoFocus={event => { event.preventDefault(); input.restoreFocus() }} className="tw:flex tw:max-h-[calc(100dvh-24px)] tw:max-w-[calc(100%-24px)] tw:flex-col tw:gap-0 tw:overflow-hidden tw:rounded-2xl tw:p-0 tw:sm:max-w-[960px]">
    <DialogHeader className="tw:shrink-0 tw:border-b tw:border-border tw:p-4 tw:pr-16"><DialogTitle>{tr ? 'İadeler' : 'Returns'} · {input.storeName}</DialogTitle><DialogDescription>{returnDate(input.periodStart, input.locale)} – {returnDate(input.periodEnd, input.locale)}</DialogDescription><DialogClose asChild><Button variant="ghost" size="icon" className="tw:absolute tw:right-2 tw:top-2 tw:min-h-11 tw:min-w-11" aria-label={tr ? 'İadeleri kapat' : 'Close returns'}><X aria-hidden /></Button></DialogClose></DialogHeader>
    <StoreReturnsTotals ledger={totalsLedger} locale={input.locale} />
    {totalsQuery.isError && !protectedError && (other || offset !== 0) ? <div role="alert" className="tw:flex tw:items-center tw:justify-between tw:gap-2 tw:px-4 tw:text-xs"><span>{tr ? 'İade toplamı yenilenemedi.' : 'Could not refresh return totals.'}</span>{retry}</div> : null}
    <div className="tw:flex tw:shrink-0 tw:items-center tw:gap-3 tw:border-b tw:border-border tw:px-4 tw:py-2"><Switch id={switchId} checked={other} onCheckedChange={value => { setOther(value); setOffset(0) }} /><label htmlFor={switchId} className="tw:flex tw:min-h-11 tw:cursor-pointer tw:items-center tw:text-xs">{tr ? 'Mağaza dışı ve norm dışı iadeler' : 'Cross-store and outside-norm returns'}</label></div>
    <div className="tw:min-h-0 tw:overflow-y-auto tw:overscroll-contain" tabIndex={0} role="region" aria-label={tr ? 'İade listesi' : 'Return list'} aria-busy={query.isFetching}>
      {ledger ? <StoreReturnsCoverage ledger={ledger} locale={input.locale} /> : null}
      {query.isPending && auth?.authenticated ? <div className="tw:space-y-3 tw:p-4" role="status" aria-label={tr ? 'İadeler yükleniyor' : 'Loading returns'}>{[0, 1, 2].map(key => <Skeleton key={key} className="tw:h-14 tw:w-full" />)}</div>
        : protectedError || !auth?.authenticated ? <p role="alert" className="tw:p-4">{tr ? 'İadeleri görüntüleme yetkiniz yok.' : 'You cannot view these returns.'}</p>
          : query.isError && !ledger ? <div role="alert" className="tw:grid tw:gap-3 tw:p-4"><p>{tr ? 'İadeler alınamadı.' : 'Could not load returns.'}</p>{retry}</div>
            : ledger ? <>{query.isError ? <div role="alert" className="tw:p-4"><p>{tr ? 'Döküm yenilenemedi; son alınan kayıtlar gösteriliyor.' : 'Could not refresh; showing the last loaded records.'}</p>{retry}</div> : null}{ledger.rows.length ? <StoreReturnsRows rows={ledger.rows} locale={input.locale} /> : <p role="status" className="tw:p-6 tw:text-center tw:text-sm tw:text-muted-foreground">{tr ? 'Seçili grupta iade kaydı yok.' : 'No returns in this group.'}</p>}</> : null}
    </div>
    {ledger ? <nav aria-label={tr ? 'İade sayfaları' : 'Return pages'} className="tw:flex tw:shrink-0 tw:items-center tw:justify-between tw:gap-2 tw:border-t tw:border-border tw:p-3 tw:text-xs"><Button variant="outline" className="tw:min-h-11" disabled={offset === 0 || query.isFetching} onClick={() => setOffset(Math.max(0, offset - 50))}>{tr ? 'Önceki' : 'Previous'}</Button><span>{ledger.page.total && ledger.rows.length ? `${offset + 1}–${Math.min(offset + ledger.rows.length, ledger.page.total)} / ${ledger.page.total}` : `0 / ${ledger.page.total}`}</span><Button variant="outline" className="tw:min-h-11" disabled={offset + 50 >= ledger.page.total || offset + 50 > 100000 || query.isFetching} onClick={() => setOffset(offset + 50)}>{tr ? 'Sonraki' : 'Next'}</Button></nav> : null}
  </DialogContent>
}
