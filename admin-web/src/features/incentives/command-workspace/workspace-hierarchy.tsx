import { useMemo, useRef, useState, type ReactNode } from 'react'
import { ArrowDown, ArrowUp, ArrowUpRight, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import type { useLocalization } from '@/features/localization/useLocalization'
import type { AppLocale } from '@/lib/i18n'
import { formatIncentiveMoney, formatIncentivePercent } from './format'
import { sumMoney } from './model'
import { IncentiveFinalAmount } from './final-amount'
import { IncentiveStoreDrawer } from './store-drawer'
import type { IncentiveStore, IncentiveWorkspace } from './types'
import type { CompleteStoreIncentiveReview } from './store-review-editor'

type SortKey = 'name' | 'personnel' | 'achievement' | 'calculated' | 'total'
type Translate = ReturnType<typeof useLocalization>['t']

export function IncentiveWorkspaceHierarchy(input: {
  workspace: IncentiveWorkspace; locale: AppLocale; t: Translate; readOnly: boolean; interactionLocked?: boolean
  onCompleteStore?: CompleteStoreIncentiveReview
  renderDecision?: (store: IncentiveStore) => ReactNode
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const lastOpenedId = useRef<string | null>(null)
  const storeButtons = useRef(new Map<string, HTMLButtonElement>())
  const [sort, setSort] = useState<{ key: SortKey; descending: boolean }>({ key: 'name', descending: false })
  const entries = useMemo(() => input.workspace.regions.flatMap(region => region.stores.map(store => ({ store, region }))).sort((a, b) => {
    if (sort.key === 'name') return a.store.storeName.localeCompare(b.store.storeName, input.locale) * (sort.descending ? -1 : 1)
    const left = sortValue(a.store, sort.key), right = sortValue(b.store, sort.key)
    if (left === null || right === null) return left === right ? 0 : left === null ? 1 : -1
    return (left - right) * (sort.descending ? -1 : 1)
  }), [input.workspace.regions, input.locale, sort])
  const tr = input.locale === 'tr'
  const columns = [['name', input.t('storeIncentives.command.storeColumn')], ['personnel', tr ? 'Personel' : 'People'], ['achievement', tr ? 'HG%' : 'Target %'], ['calculated', tr ? 'Hesaplanan' : 'Calculated'], ['total', tr ? 'Final Prim' : 'Final incentive']] as const
  const selected = entries.find(({ store }) => store.storeId === selectedId)?.store
  const trigger = (store: IncentiveStore, mobile = false) => <Button ref={node => { if (node) storeButtons.current.set(`${store.storeId}:${mobile}`, node); else storeButtons.current.delete(`${store.storeId}:${mobile}`) }} variant="link" className="incentive-store-name" aria-haspopup="dialog" onClick={() => { lastOpenedId.current = store.storeId; setSelectedId(store.storeId) }}><span>{store.storeName}</span><ArrowUpRight aria-hidden="true" /></Button>
  const status = (store: IncentiveStore) => {
    return <Badge variant="secondary" className={store.review.status === 'reviewed' ? 'incentive-badge-approved' : 'incentive-badge-pending'}>{store.review.status === 'reviewed' ? <Check aria-hidden="true" /> : null}{store.review.status === 'reviewed' ? (tr ? 'Tamamlandı' : 'Completed') : (tr ? 'Kontrol bekliyor' : 'Awaiting review')}</Badge>
  }
  const final = (store: IncentiveStore) => <IncentiveFinalAmount final={sumMoney(store.rows.map(row => row.finalAmount))} calculated={sumMoney(store.rows.map(row => row.calculatedAmount))} locale={input.locale} />
  return <>
    <div className="incentive-store-desktop"><Table className="incentive-store-ledger" aria-label={input.t('storeIncentives.regionManagerStoresAria')}>
      <TableHeader><TableRow>{columns.map(([key, label]) => <TableHead key={key} aria-sort={sort.key === key ? (sort.descending ? 'descending' : 'ascending') : 'none'}><Button size="sm" variant="ghost" onClick={() => setSort({ key, descending: sort.key === key ? !sort.descending : false })}>{label}{sort.key === key ? (sort.descending ? <ArrowDown aria-hidden="true" /> : <ArrowUp aria-hidden="true" />) : null}</Button></TableHead>)}<TableHead>{input.t('storeIncentives.command.reviewColumn')}</TableHead></TableRow></TableHeader>
      <TableBody>{entries.map(({ store, region }) => <TableRow key={store.storeId} className="incentive-store-summary-row"><TableCell>{trigger(store)}{input.readOnly ? <small className="incentive-store-manager-name">{region.regionManager.displayName || region.regionName}</small> : null}</TableCell>
        <TableCell>{store.rows.length}</TableCell><TableCell>{formatIncentivePercent(store.storeAchievementPct, input.locale)}</TableCell><TableCell>{formatIncentiveMoney(sumMoney(store.rows.map(row => row.calculatedAmount)), input.locale)}</TableCell><TableCell>{final(store)}</TableCell><TableCell>{status(store)}</TableCell>
      </TableRow>)}</TableBody>
    </Table></div>
    <div className="incentive-store-mobile">{entries.map(({ store, region }) => <article key={store.storeId}>
      <header><div>{trigger(store, true)}{input.readOnly ? <small className="incentive-store-manager-name">{region.regionManager.displayName || region.regionName}</small> : null}</div>{status(store)}</header>
      <dl><div><dt>{tr ? 'Personel' : 'People'}</dt><dd>{store.rows.length}</dd></div><div><dt>HG%</dt><dd>{formatIncentivePercent(store.storeAchievementPct, input.locale)}</dd></div><div><dt>{tr ? 'Hesaplanan prim' : 'Calculated incentive'}</dt><dd>{formatIncentiveMoney(sumMoney(store.rows.map(row => row.calculatedAmount)), input.locale)}</dd></div><div><dt>{tr ? 'Final prim' : 'Final incentive'}</dt><dd>{final(store)}</dd></div></dl>
    </article>)}</div>
    {entries.length === 0 ? <div className="incentive-command-empty">{input.t('storeIncentives.command.noMatch')}</div> : <footer className="incentive-list-footer"><span>{entries.length} {tr ? 'mağaza listeleniyor' : 'stores listed'}</span><span>{tr ? 'Toplam final prim' : 'Total final incentive'} <strong>{formatIncentiveMoney(sumMoney(entries.flatMap(({ store }) => store.rows.map(row => row.finalAmount))), input.locale)}</strong></span></footer>}
    <IncentiveStoreDrawer key={`${input.workspace.period}:${selected?.storeId ?? 'closed'}`} store={selected ?? null} workspace={input.workspace} locale={input.locale} readOnly={input.readOnly}
      interactionLocked={Boolean(input.interactionLocked)} onComplete={input.onCompleteStore}
      review={selected ? status(selected) : null} decision={selected ? input.renderDecision?.(selected) : null}
      onClose={() => setSelectedId(null)}
      returnFocus={() => { if (lastOpenedId.current) [false, true].map(mobile => storeButtons.current.get(`${lastOpenedId.current}:${mobile}`)).find(button => button?.getClientRects().length)?.focus() }} />
  </>

}

function sortValue(store: IncentiveStore, key: Exclude<SortKey, 'name'>) {
  const value = key === 'personnel' ? store.rows.length : key === 'achievement' ? store.storeAchievementPct : sumMoney(store.rows.map(row => key === 'calculated' ? row.calculatedAmount : row.finalAmount))
  return value === null ? null : Number(value)
}
