import { useMemo, useState } from 'react'
import { ArrowDown, ArrowUp, ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Field, FieldLabel } from '@/components/ui/field'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import type { useLocalization } from '@/features/localization/useLocalization'
import type { AppLocale } from '@/lib/i18n'
import { formatIncentiveMoney, formatIncentivePercent } from './format'
import { sumMoney } from './model'
import { IncentiveFinalAmount } from './final-amount'
import { IncentivePersonnelList } from './personnel-list'
import type { IncentiveRow, IncentiveStore, IncentiveWorkspace } from './types'

type SortKey = 'name' | 'target' | 'actual' | 'achievement' | 'calculated' | 'total'
type Translate = ReturnType<typeof useLocalization>['t']

export function IncentiveWorkspaceHierarchy(input: {
  workspace: IncentiveWorkspace; locale: AppLocale; t: Translate; readOnly: boolean; interactionLocked?: boolean
  onOpenRow: (store: IncentiveStore, row: IncentiveRow, opener: HTMLButtonElement) => void
  onReviewStore?: (store: IncentiveStore) => void; pendingStoreIds?: ReadonlySet<string>
}) {
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set())
  const [sort, setSort] = useState<{ key: SortKey; descending: boolean }>({ key: 'name', descending: false })
  const entries = useMemo(() => input.workspace.regions.flatMap(region => region.stores.map(store => ({ store, region }))).sort((a, b) => {
    if (sort.key === 'name') return a.store.storeName.localeCompare(b.store.storeName, input.locale) * (sort.descending ? -1 : 1)
    const left = sortValue(a.store, sort.key), right = sortValue(b.store, sort.key)
    if (left === null || right === null) return left === right ? 0 : left === null ? 1 : -1
    return (left - right) * (sort.descending ? -1 : 1)
  }), [input.workspace.regions, input.locale, sort])
  const tr = input.locale === 'tr'
  const columns = [['name', input.t('storeIncentives.command.storeColumn')], ['target', input.t('storeIncentives.command.targetColumn')], ['actual', tr ? 'Net satış' : 'Net sales'], ['achievement', tr ? 'HG%' : 'Target %'], ['calculated', tr ? 'Hesaplanan prim' : 'Calculated incentive'], ['total', tr ? 'Final Prim' : 'Final incentive']] as const
  const toggle = (id: string, open: boolean) => setExpanded(current => { const next = new Set(current); if (open) next.add(id); else next.delete(id); return next })
  const trigger = (store: IncentiveStore) => <CollapsibleTrigger asChild><Button variant="link" className="incentive-store-name"><ChevronDown aria-hidden="true" data-icon="inline-start" /><span>{store.storeName}</span></Button></CollapsibleTrigger>
  const status = (store: IncentiveStore) => {
    const disabled = input.readOnly || !store.capabilities.canMarkStoreReview || store.review.periodCloseStatus !== 'closed' || input.interactionLocked || input.pendingStoreIds?.has(store.storeId) || !input.onReviewStore
    return <Field orientation="horizontal" className="incentive-store-review" data-disabled={disabled}><FieldLabel><Checkbox checked={store.review.status === 'reviewed'} disabled={disabled} aria-label={`${store.storeName}: ${tr ? 'Mağaza kontrol onayı' : 'Store review approval'}`} onCheckedChange={() => { if (!disabled) input.onReviewStore?.(store) }} /><span>{input.t(store.review.status === 'reviewed' ? 'storeIncentives.command.reviewed' : 'storeIncentives.command.pending')}</span></FieldLabel></Field>
  }
  const final = (store: IncentiveStore) => <IncentiveFinalAmount final={sumMoney(store.rows.map(row => row.finalAmount))} calculated={sumMoney(store.rows.map(row => row.calculatedAmount))} locale={input.locale} />
  const personnel = (store: IncentiveStore, mobile: boolean) => <IncentivePersonnelList store={store} mobile={mobile} locale={input.locale} t={input.t} interactionLocked={Boolean(input.interactionLocked || input.pendingStoreIds?.has(store.storeId))} onOpenRow={input.onOpenRow} />
  return <>
    <div className="incentive-store-desktop"><Table aria-label={input.t('storeIncentives.regionManagerStoresAria')}>
      <TableHeader><TableRow>{columns.map(([key, label]) => <TableHead key={key} aria-sort={sort.key === key ? (sort.descending ? 'descending' : 'ascending') : 'none'}><Button size="sm" variant="ghost" onClick={() => setSort({ key, descending: sort.key === key ? !sort.descending : false })}>{label}{sort.key === key ? (sort.descending ? <ArrowDown aria-hidden="true" /> : <ArrowUp aria-hidden="true" />) : null}</Button></TableHead>)}<TableHead>{input.t('storeIncentives.command.reviewColumn')}</TableHead></TableRow></TableHeader>
      {entries.map(({ store, region }) => <Collapsible key={store.storeId} asChild open={expanded.has(store.storeId)} onOpenChange={open => toggle(store.storeId, open)}><TableBody>
        <TableRow className="incentive-store-summary-row"><TableCell>{trigger(store)}{input.readOnly && input.workspace.regions.length > 1 ? <small className="incentive-store-manager-name">{region.regionManager.displayName || region.regionName}</small> : null}</TableCell>
          <TableCell>{formatIncentiveMoney(store.storeTarget, input.locale)}</TableCell><TableCell>{formatIncentiveMoney(store.storeActualNetSales, input.locale)}</TableCell><TableCell>{formatIncentivePercent(store.storeAchievementPct, input.locale)}</TableCell><TableCell>{formatIncentiveMoney(sumMoney(store.rows.map(row => row.calculatedAmount)), input.locale)}</TableCell><TableCell>{final(store)}</TableCell><TableCell>{status(store)}</TableCell>
        </TableRow>
        <CollapsibleContent asChild><TableRow className="incentive-store-expanded-row"><TableCell colSpan={7}>{personnel(store, false)}</TableCell></TableRow></CollapsibleContent>
      </TableBody></Collapsible>)}
    </Table></div>
    <div className="incentive-store-mobile">{entries.map(({ store }) => <Collapsible key={store.storeId} asChild open={expanded.has(store.storeId)} onOpenChange={open => toggle(store.storeId, open)}><article>
      <header>{trigger(store)}{status(store)}</header>
      <dl><div><dt>{tr ? 'Hedef' : 'Target'}</dt><dd>{formatIncentiveMoney(store.storeTarget, input.locale)}</dd></div><div><dt>{tr ? 'Net satış' : 'Net sales'}</dt><dd>{formatIncentiveMoney(store.storeActualNetSales, input.locale)}</dd></div><div><dt>HG%</dt><dd>{formatIncentivePercent(store.storeAchievementPct, input.locale)}</dd></div><div><dt>{tr ? 'Hesaplanan prim' : 'Calculated incentive'}</dt><dd>{formatIncentiveMoney(sumMoney(store.rows.map(row => row.calculatedAmount)), input.locale)}</dd></div><div><dt>{tr ? 'Final Prim' : 'Final incentive'}</dt><dd>{final(store)}</dd></div></dl>
      <CollapsibleContent>{personnel(store, true)}</CollapsibleContent>
    </article></Collapsible>)}</div>
    {entries.length === 0 ? <div className="incentive-command-empty">{input.t('storeIncentives.command.noMatch')}</div> : <footer className="incentive-list-footer"><span>{entries.length} {tr ? 'mağaza' : 'stores'}</span><span>{tr ? 'Listelenen final prim toplamı' : 'Listed final incentive total'} <strong>{formatIncentiveMoney(sumMoney(entries.flatMap(({ store }) => store.rows.map(row => row.finalAmount))), input.locale)}</strong></span></footer>}
  </>
}

function sortValue(store: IncentiveStore, key: Exclude<SortKey, 'name'>) {
  const value = key === 'target' ? store.storeTarget : key === 'actual' ? store.storeActualNetSales : key === 'achievement' ? store.storeAchievementPct : sumMoney(store.rows.map(row => key === 'calculated' ? row.calculatedAmount : row.finalAmount))
  return value === null ? null : Number(value)
}
