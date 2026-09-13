import { Info } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { useLocalization } from '@/features/localization/useLocalization'
import type { AppLocale } from '@/lib/i18n'
import { formatIncentiveMoney, formatIncentivePercent, formatIncentiveRate } from './format'
import { IncentiveFinalAmount } from './final-amount'
import type { IncentiveRow, IncentiveStore } from './types'

export function IncentivePersonnelList(input: {
  store: IncentiveStore; mobile: boolean; locale: AppLocale; t: ReturnType<typeof useLocalization>['t']; interactionLocked?: boolean
  onOpenRow: (store: IncentiveStore, row: IncentiveRow, opener: HTMLButtonElement) => void
}) {
  const tr = input.locale === 'tr'
  const labels = tr ? ['Personel', 'Hedef', 'Net satış', 'HG%', 'Hesaplama oranı', 'Hesaplanan prim', 'Final Prim'] : ['Personnel', 'Target', 'Net sales', 'Target %', 'Calculation rate', 'Calculated incentive', 'Final incentive']
  const name = (row: IncentiveRow) => <Button variant="link" className="incentive-person-name" disabled={input.interactionLocked} onClick={event => input.onOpenRow(input.store, row, event.currentTarget)}>{row.displayName}</Button>
  const achievement = (row: IncentiveRow) => formatIncentivePercent(row.target && Number(row.target) > 0 && row.actual !== null ? (Number(row.actual) / Number(row.target) * 100).toFixed(2) : null, input.locale)
  const final = (row: IncentiveRow) => <IncentiveFinalAmount final={row.finalAmount} calculated={row.calculatedAmount} locale={input.locale} />
  return <section className="incentive-personnel-panel" aria-label={`${input.store.storeName}: ${tr ? 'Personel primleri' : 'Personnel incentives'}`}>
    <h3>{tr ? 'Personel primleri' : 'Personnel incentives'} <small>{input.store.rows.length}</small></h3>
    {input.store.review.periodCloseStatus !== 'closed' ? <Alert><Info aria-hidden="true" /><AlertDescription>{tr ? 'Dönem henüz kapanmadı. Primleri inceleyebilirsiniz; kontrol ve düzeltme dönem kapandığında açılır.' : 'This period is still open. Review and corrections become available after closing.'}</AlertDescription></Alert> : null}
    {input.store.rows.length === 0 ? <p>{input.t('storeIncentives.regionManagerNoRows')}</p> : input.mobile ? <div className="incentive-personnel-mobile">{input.store.rows.map(row => <div className="incentive-personnel-entry" key={`${row.employeeId}:${row.participantType}`}>
      {name(row)}<dl><div><dt>{labels[1]}</dt><dd>{formatIncentiveMoney(row.target, input.locale)}</dd></div><div><dt>{labels[2]}</dt><dd>{formatIncentiveMoney(row.actual, input.locale)}</dd></div><div><dt>HG%</dt><dd>{achievement(row)}</dd></div><div><dt>{labels[4]}</dt><dd>{formatIncentiveRate(row.rate, input.locale)}</dd></div><div><dt>{labels[5]}</dt><dd>{formatIncentiveMoney(row.calculatedAmount, input.locale)}</dd></div><div><dt>{labels[6]}</dt><dd>{final(row)}</dd></div></dl>
    </div>)}</div> : <Table className="incentive-personnel-table" aria-label={`${input.store.storeName}: ${tr ? 'Personel primleri' : 'Personnel incentives'}`}><TableHeader><TableRow>{labels.map(label => <TableHead key={label}>{label}</TableHead>)}</TableRow></TableHeader><TableBody>{input.store.rows.map(row => <TableRow className="incentive-personnel-entry-row" key={`${row.employeeId}:${row.participantType}`}>
      <TableCell>{name(row)}</TableCell><TableCell>{formatIncentiveMoney(row.target, input.locale)}</TableCell><TableCell>{formatIncentiveMoney(row.actual, input.locale)}</TableCell><TableCell>{achievement(row)}</TableCell><TableCell>{formatIncentiveRate(row.rate, input.locale)}</TableCell><TableCell>{formatIncentiveMoney(row.calculatedAmount, input.locale)}</TableCell><TableCell>{final(row)}</TableCell>
    </TableRow>)}</TableBody></Table>}
  </section>
}
