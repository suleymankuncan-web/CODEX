import type { StoreReturnsLedger } from './api'
import { returnDate, returnMoney } from './format'

export function StoreReturnsCoverage({ ledger, locale }: { ledger: StoreReturnsLedger; locale: 'tr' | 'en' }) {
  const tr = locale === 'tr'
  const coverage = ledger.coverage
  if (coverage.status === 'complete' && coverage.unresolvedRows === 0) return null
  return <div role="status" className="tw:border-b tw:border-border tw:bg-muted/50 tw:px-4 tw:py-2 tw:text-xs">
    <p className="tw:m-0">{coverage.status === 'no_data'
      ? (tr ? 'Bu tarih aralığında günlük veri yok. İade toplamı henüz doğrulanamıyor.' : 'No daily data for this range. Return totals are unavailable.')
      : coverage.status === 'partial'
        ? (tr ? 'Bazı günlerin verisi eksik; toplamlar tamamlanmış değil.' : 'Some daily data is missing; totals are incomplete.')
        : null}</p>
    {coverage.missingDates.length > 0 ? <details className="tw:mt-1"><summary className="tw:cursor-pointer tw:py-1">{tr ? 'Eksik günler' : 'Missing days'} · {coverage.missingDates.length}</summary><p className="tw:break-words">{coverage.missingDates.map(date => returnDate(date, locale)).join(' · ')}</p></details> : null}
    {coverage.unresolvedRows > 0 ? <p className="tw:m-0 tw:mt-1">{tr ? `${coverage.unresolvedRows} iade kaydı kontrol bekliyor.` : `${coverage.unresolvedRows} return records require review.`}</p> : null}
  </div>
}

export function StoreReturnsTotals({ ledger, locale }: { ledger: StoreReturnsLedger | undefined; locale: 'tr' | 'en' }) {
  const tr = locale === 'tr'
  return <dl className="tw:m-0 tw:grid tw:grid-cols-2 tw:gap-4 tw:border-b tw:border-border tw:px-4 tw:py-3 tw:tabular-nums">
    <div><dt className="tw:text-xs tw:text-muted-foreground">{tr ? 'Alınan iadeler' : 'Received returns'}</dt><dd className="tw:m-0 tw:mt-1 tw:font-semibold">{returnMoney(ledger?.totals.receivedSignedAmount, locale)}</dd></div>
    <div><dt className="tw:text-xs tw:text-muted-foreground">{tr ? 'İade işlem sayısı' : 'Return transactions'}</dt><dd className="tw:m-0 tw:mt-1 tw:font-semibold">{ledger?.totals.receivedInvoiceCount ?? '—'}</dd></div>
  </dl>
}
