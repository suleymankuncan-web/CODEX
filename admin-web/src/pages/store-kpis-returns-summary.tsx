import { useRef, useState } from 'react'
import { ReceiptText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { StoreReturnsDialog } from '@/features/returns/dialog'
import { StoreReturnsScopeProvider } from '@/features/returns/scope'
import { isReturnsAccessError, useStoreReturns } from '@/features/returns/api'
import { StoreReturnsCoverage } from '@/features/returns/coverage'
import { returnMoney } from '@/features/returns/format'
import type { StoreKpiHighlightsPageModel } from './store-kpi-highlights-model'

export function StoreKpisReturnsSummary({ model }: { model: StoreKpiHighlightsPageModel }) {
  const closed = model.viewMode === 'closed'
  const period = closed ? model.rows.find(row => row.storeId === model.effectiveStoreId) : model.liveSummary?.period
  const frozenNet = model.rows.find(row => row.kpiCode === 'NET_SALES' && row.storeId === model.effectiveStoreId && row.periodStart === period?.periodStart && row.periodEnd === period.periodEnd)
  const range = { storeId: model.effectiveStoreId ?? '', periodStart: period?.periodStart.slice(0, 10) ?? '', periodEnd: period?.periodEnd.slice(0, 10) ?? '' }
  const query = useStoreReturns(model.authSummary, range)
  const protectedError = isReturnsAccessError(query.error)
  const ledger = protectedError ? undefined : query.data?.data
  const net = closed ? frozenNet?.actualValue : ledger?.totals.netSales
  const [open, setOpen] = useState(false)
  const trigger = useRef<HTMLButtonElement>(null)
  const tr = model.locale === 'tr'
  if (!range.storeId || !range.periodStart || !range.periodEnd) return null
  return <StoreReturnsScopeProvider authSummary={model.authSummary}>
    <section aria-label={tr ? 'İadeler sonrası satış özeti' : 'Sales after returns summary'} className="tw:mb-4 tw:overflow-hidden tw:rounded-xl tw:border tw:border-border">
      <div className="tw:flex tw:flex-wrap tw:items-center tw:justify-between tw:gap-3 tw:p-4">
        <div className="tw:flex tw:min-w-0 tw:items-center tw:gap-3"><ReceiptText aria-hidden className="tw:size-5 tw:shrink-0 tw:text-muted-foreground" /><div><h3 className="tw:m-0 tw:text-sm tw:font-semibold">{tr ? 'İadeler Sonrası Net Satış' : 'Net Sales After Returns'}</h3><p className="tw:m-0 tw:mt-1 tw:text-xs tw:text-muted-foreground">{closed ? (tr ? 'Kayıtlı dönem tutarı' : 'Recorded period amount') : (tr ? 'Seçili dönem' : 'Selected period')}</p></div></div>
        <strong className="tw:text-lg tw:tabular-nums">{returnMoney(net == null ? null : String(net), model.locale)}</strong>
      </div>
      <div className="tw:flex tw:flex-wrap tw:items-center tw:justify-between tw:gap-3 tw:border-t tw:border-border tw:bg-muted/35 tw:px-4 tw:py-3"><dl className="tw:m-0 tw:flex tw:flex-wrap tw:gap-x-6 tw:gap-y-2 tw:text-xs tw:tabular-nums"><div><dt className="tw:text-muted-foreground">{tr ? 'Alınan iadeler' : 'Received returns'}</dt><dd className="tw:m-0 tw:mt-1 tw:font-semibold">{returnMoney(ledger?.totals.receivedSignedAmount, model.locale)}</dd></div><div><dt className="tw:text-muted-foreground">{tr ? 'İade işlem sayısı' : 'Return transactions'}</dt><dd className="tw:m-0 tw:mt-1 tw:font-semibold">{ledger?.totals.receivedInvoiceCount ?? '—'}</dd></div></dl><Button ref={trigger} variant="outline" className="tw:min-h-11" disabled={protectedError} onClick={() => setOpen(true)}>{tr ? 'İadeler' : 'Returns'}</Button></div>
      {closed ? <p className="tw:m-0 tw:border-t tw:border-border tw:px-4 tw:py-2 tw:text-xs tw:text-muted-foreground">{tr ? 'İade dökümü güncel kayıtlardır; kayıtlı dönem tutarı korunur.' : 'Return details show current records; the recorded period amount is retained.'}</p> : null}
      {query.isPending ? <p role="status" className="tw:m-0 tw:px-4 tw:py-2 tw:text-xs">{tr ? 'İade özeti yükleniyor…' : 'Loading return summary…'}</p> : null}
      {query.isError ? <div role="alert" className="tw:flex tw:flex-wrap tw:items-center tw:justify-between tw:gap-2 tw:px-4 tw:py-2 tw:text-xs"><span>{protectedError ? (tr ? 'İade özeti görüntülenemiyor.' : 'You cannot view the return summary.') : (tr ? 'İade özeti yenilenemedi.' : 'Could not refresh the return summary.')}</span>{!protectedError ? <Button variant="ghost" className="tw:min-h-11" onClick={() => void query.refetch()}>{tr ? 'Yeniden dene' : 'Retry'}</Button> : null}</div> : null}
      {ledger ? <StoreReturnsCoverage ledger={ledger} locale={model.locale} /> : null}
    </section>
    <StoreReturnsDialog {...range} storeName={model.activeStoreName} locale={model.locale} open={open} onOpenChange={setOpen} restoreFocus={() => trigger.current?.focus()} />
  </StoreReturnsScopeProvider>
}
