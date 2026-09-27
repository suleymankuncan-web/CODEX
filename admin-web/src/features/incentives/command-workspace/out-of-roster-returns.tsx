import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import type { AppLocale } from '@/lib/i18n'
import { formatIncentiveMoney } from './format'
import type { IncentiveStore } from './types'

export function OutOfRosterReturnsDialog(input: { storeName: string; items: NonNullable<IncentiveStore['outOfRosterReturns']>; total: string | null; locale: AppLocale; open: boolean; onOpenChange: (open: boolean) => void; restoreFocus: () => void; available: boolean }) {
  const tr = input.locale === 'tr'
  const items = input.items
  return <Dialog open={input.open} onOpenChange={input.onOpenChange}>
    <DialogContent className="incentive-returns-dialog" closeLabel={tr ? 'İade detayını kapat' : 'Close return details'} onCloseAutoFocus={event => { event.preventDefault(); input.restoreFocus() }}>
      <DialogHeader><DialogTitle>{tr ? 'Mağazalar Arası İade' : 'Inter-store returns'}</DialogTitle><DialogDescription>
        {input.storeName} · {tr ? 'Yalnız iadesi görünen personel. Kaynak mağaza bilgisi olmadan mağazalar arası iade olduğu doğrulanamıyor. Tutarlar mağaza netine dahildir; tekrar eklenmez.' : 'Return-only personnel. Without the originating store, inter-store returns cannot be confirmed. Amounts are included in store net sales; they are not added again.'}
      </DialogDescription></DialogHeader>
      <dl className="incentive-return-total"><dt>{tr ? 'Toplam İade' : 'Total returns'}</dt><dd>{formatIncentiveMoney(input.total, input.locale)}</dd></dl>
      <div className="incentive-returns-scroll" tabIndex={0} role="region" aria-label={tr ? 'İade listesi' : 'Return list'}>
      {!input.available ? <p role="alert">{tr ? 'İade dökümü alınamadı. Liste boş kabul edilmemelidir.' : 'Return details are unavailable; this does not mean there are no returns.'}</p> : items.length === 0 ? <p>{tr ? 'Bu dönemde yalnız iadesi bulunan personel yok.' : 'No return-only personnel in this period.'}</p> : <>
        <div className="incentive-return-columns" aria-hidden="true"><span>{tr ? 'Personel / Sicil' : 'Personnel / Code'}</span><div>{(tr ? ['Satış', 'İade', 'Net'] : ['Sales', 'Returns', 'Net']).map(label => <span key={label}>{label}</span>)}</div></div>
        <ul className="incentive-return-items">{items.map((item, index) => <li key={`${item.employeeId ?? item.personnelCode}:${index}`}>
          <div className="incentive-return-person"><strong>{item.displayName}</strong><small>{tr ? 'Sicil' : 'Personnel code'}: {item.personnelCode ?? '—'}</small></div>
          <dl>{[[tr ? 'Toplam Satış' : 'Total sales', item.saleAmount], [tr ? 'Toplam İade' : 'Total returns', item.returnAmount], [tr ? 'Net Satış' : 'Net sales', item.netAmount]].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{formatIncentiveMoney(value, input.locale)}</dd></div>)}</dl>
        </li>)}</ul></>}
      </div>
    </DialogContent>
  </Dialog>
}
