import { useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { ArrowDown, ArrowUp, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import type { useLocalization } from '@/features/localization/useLocalization'
import type { AppLocale } from '@/lib/i18n'
import { formatIncentiveMoney, formatIncentivePercent } from './format'
import { storeSalesDisplay } from './sales-display'
import { isBelowIncentiveThreshold, isEarnedAtIncentiveThreshold, sumMoney } from './model'
import { IncentiveFinalAmount } from './final-amount'
import { IncentiveStoreDrawer } from './store-drawer'
import type { IncentiveStore, IncentiveWorkspace } from './types'
import type { CompleteStoreIncentiveReview } from './store-review-editor'

type SortKey = 'name' | 'manager' | 'target' | 'sale' | 'returns' | 'actual' | 'achievement' | 'total'
type Translate = ReturnType<typeof useLocalization>['t']

export function IncentiveWorkspaceHierarchy(input: {
  workspace: IncentiveWorkspace; locale: AppLocale; t: Translate; readOnly: boolean; interactionLocked?: boolean
  onCompleteStore?: CompleteStoreIncentiveReview
  showRegionManager?: boolean
  pageSize?: number
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [page, setPage] = useState(0)
  const lastOpenedId = useRef<string | null>(null)
  const storeRows = useRef(new Map<string, HTMLElement>())
  const lastOpenedMobile = useRef(false)
  const [sort, setSort] = useState<{ key: SortKey; descending: boolean }>({ key: 'name', descending: false })
  const entries = useMemo(() => input.workspace.managerGroups.flatMap(region => region.stores.map(store => ({ store, region }))).sort((a, b) => {
    if (sort.key === 'name') return a.store.storeName.localeCompare(b.store.storeName, input.locale) * (sort.descending ? -1 : 1)
    if (sort.key === 'manager') return managerName(a.region).localeCompare(managerName(b.region), input.locale) * (sort.descending ? -1 : 1)
    const left = sortValue(a.store, sort.key, input.workspace), right = sortValue(b.store, sort.key, input.workspace)
    if (left === null || right === null) return left === right ? 0 : left === null ? 1 : -1
    return (left - right) * (sort.descending ? -1 : 1)
  }), [input.workspace, input.locale, sort])
  const tr = input.locale === 'tr'
  const displayedActual = (store: IncentiveStore) => storeSalesDisplay(store, input.workspace).net
  const displayedAchievement = (store: IncentiveStore) => storeSalesDisplay(store, input.workspace).achievement
  const columns: Array<[SortKey, string]> = [['name', input.t('storeIncentives.command.storeColumn')], ...(input.showRegionManager ? [['manager', tr ? 'Bölge Müdürü' : 'Regional manager'] as [SortKey, string]] : []), ['target', tr ? 'Hedef' : 'Target'], ['sale', tr ? 'Toplam Satış' : 'Total sales'], ['returns', tr ? 'Toplam İade' : 'Total returns'], ['actual', tr ? 'Net Satış' : 'Net sales'], ['achievement', tr ? 'HG%' : 'Target %'], ['total', tr ? 'Final Prim' : 'Final incentive']]
  const pageCount = input.pageSize ? Math.max(1, Math.ceil(entries.length / input.pageSize)) : 1
  const safePage = Math.min(page, pageCount - 1)
  const visibleEntries = input.pageSize ? entries.slice(safePage * input.pageSize, (safePage + 1) * input.pageSize) : entries
  const selectedEntry = entries.find(({ store }) => store.storeId === selectedId)
  const selected = selectedEntry?.store
  const openStore = (store: IncentiveStore, mobile: boolean) => {
    if (input.interactionLocked) return
    lastOpenedId.current = store.storeId
    lastOpenedMobile.current = mobile
    setSelectedId(store.storeId)
  }
  const openStoreOnKeyboard = (event: KeyboardEvent<HTMLElement>, store: IncentiveStore, mobile: boolean) => {
    if (event.key !== 'Enter' && event.key !== ' ') return
    event.preventDefault()
    openStore(store, mobile)
  }
  const status = (store: IncentiveStore) => {
    return <Badge variant="secondary" className={store.review.status === 'reviewed' ? 'incentive-badge-approved' : 'incentive-badge-pending'}>{store.review.status === 'reviewed' ? <Check aria-hidden="true" /> : null}{store.review.status === 'reviewed' ? (tr ? 'Tamamlandı' : 'Completed') : (tr ? 'Kontrol bekliyor' : 'Awaiting review')}</Badge>
  }
  const finalAmount = (store: IncentiveStore) => sumMoney(store.rows.map(row => row.finalAmount))
  const final = (store: IncentiveStore) => <IncentiveFinalAmount final={finalAmount(store)} calculated={sumMoney(store.rows.map(row => row.calculatedAmount))} locale={input.locale} />
  const achievementTone = (store: IncentiveStore) => `incentive-value-tone${isBelowIncentiveThreshold(displayedAchievement(store)) ? ' is-below-threshold' : ''}`
  const finalTone = (store: IncentiveStore) => `incentive-value-tone${isEarnedAtIncentiveThreshold(finalAmount(store), store.storeAchievementPct) ? ' is-earned' : ''}`
  return <>
    <div className="incentive-store-desktop"><Table className={`incentive-store-ledger${input.showRegionManager ? ' incentive-store-ledger--with-manager' : ''}`} aria-label={input.t('storeIncentives.regionManagerStoresAria')}>
      <TableHeader><TableRow>{columns.map(([key, label]) => <TableHead key={key} aria-sort={sort.key === key ? (sort.descending ? 'descending' : 'ascending') : 'none'}><Button size="sm" variant="ghost" onClick={() => { setPage(0); setSort({ key, descending: sort.key === key ? !sort.descending : false }) }}>{label}{sort.key === key ? (sort.descending ? <ArrowDown aria-hidden="true" /> : <ArrowUp aria-hidden="true" />) : null}</Button></TableHead>)}<TableHead>{input.t('storeIncentives.command.reviewColumn')}</TableHead></TableRow></TableHeader>
      <TableBody>{visibleEntries.map(({ store, region }) => <TableRow key={store.storeId} className="incentive-store-summary-row" aria-label={`${store.storeName}: ${tr ? 'Prim ayrıntılarını aç' : 'Open incentive details'}`} onClick={() => openStore(store, false)}><TableCell><button type="button" ref={node => { if (node) storeRows.current.set(`${store.storeId}:false`, node); else storeRows.current.delete(`${store.storeId}:false`) }} className="incentive-store-name" disabled={input.interactionLocked} aria-haspopup="dialog" aria-expanded={selectedId === store.storeId}>{store.storeName}</button></TableCell>
        {input.showRegionManager ? <TableCell className="incentive-region-manager-cell">{managerName(region)}</TableCell> : null}
        <TableCell className="incentive-store-money">{formatIncentiveMoney(store.storeTarget, input.locale)}</TableCell>
        <TableCell className="incentive-store-money">{formatIncentiveMoney(store.trackedSaleAmount, input.locale)}</TableCell>
        <TableCell className="incentive-store-money">{formatIncentiveMoney(store.trackedReturnAmount, input.locale)}</TableCell>
        <TableCell className="incentive-store-money">{formatIncentiveMoney(displayedActual(store), input.locale)}</TableCell>
        <TableCell><span className={achievementTone(store)}>{formatIncentivePercent(displayedAchievement(store), input.locale)}</span></TableCell>
        <TableCell><span className={finalTone(store)}>{final(store)}</span></TableCell><TableCell>{status(store)}</TableCell>
      </TableRow>)}</TableBody>
    </Table></div>
    <div className="incentive-store-mobile">{visibleEntries.map(({ store, region }) => <div key={store.storeId} ref={node => { if (node) storeRows.current.set(`${store.storeId}:true`, node); else storeRows.current.delete(`${store.storeId}:true`) }} className="incentive-store-mobile-row" role="button" tabIndex={input.interactionLocked ? -1 : 0} aria-disabled={input.interactionLocked || undefined} aria-label={`${store.storeName}: ${tr ? 'Prim ayrıntılarını aç' : 'Open incentive details'}`} aria-haspopup="dialog" aria-expanded={selectedId === store.storeId} onClick={() => openStore(store, true)} onKeyDown={event => openStoreOnKeyboard(event, store, true)}>
      <header><div><span className="incentive-store-name">{store.storeName}</span>{input.showRegionManager ? <small className="incentive-store-manager-name">{managerName(region)}</small> : null}</div>{status(store)}</header>
      <dl><div><dt>{tr ? 'Hedef' : 'Target'}</dt><dd>{formatIncentiveMoney(store.storeTarget, input.locale)}</dd></div>
        <div><dt>{tr ? 'Toplam Satış' : 'Total sales'}</dt><dd>{formatIncentiveMoney(store.trackedSaleAmount, input.locale)}</dd></div>
        <div><dt>{tr ? 'Toplam İade' : 'Total returns'}</dt><dd>{formatIncentiveMoney(store.trackedReturnAmount, input.locale)}</dd></div>
        <div><dt>{tr ? 'Net Satış' : 'Net sales'}</dt><dd>{formatIncentiveMoney(displayedActual(store), input.locale)}</dd></div>
        <div><dt>HG%</dt><dd><span className={achievementTone(store)}>{formatIncentivePercent(displayedAchievement(store), input.locale)}</span></dd></div>
        <div><dt>{tr ? 'Final Prim' : 'Final incentive'}</dt><dd><span className={finalTone(store)}>{final(store)}</span></dd></div></dl>
    </div>)}</div>
    {entries.length === 0 ? <div className="incentive-command-empty">{input.t('storeIncentives.command.noMatch')}</div> : <footer className="incentive-list-footer"><span>{input.pageSize ? `${safePage * input.pageSize + 1}–${Math.min((safePage + 1) * input.pageSize, entries.length)} / ${entries.length}` : entries.length} {tr ? 'mağaza' : 'stores'}</span><span>{tr ? 'Toplam final prim' : 'Total final incentive'} <strong>{formatIncentiveMoney(sumMoney(entries.flatMap(({ store }) => store.rows.map(row => row.finalAmount))), input.locale)}</strong></span>{input.pageSize && pageCount > 1 ? <nav className="incentive-list-pagination" aria-label={tr ? 'Mağaza sayfaları' : 'Store pages'}><Button size="sm" variant="outline" disabled={safePage === 0} onClick={() => setPage(safePage - 1)}>{tr ? 'Önceki' : 'Previous'}</Button><span>{safePage + 1} / {pageCount}</span><Button size="sm" variant="outline" disabled={safePage + 1 >= pageCount} onClick={() => setPage(safePage + 1)}>{tr ? 'Sonraki' : 'Next'}</Button></nav> : null}</footer>}
    <IncentiveStoreDrawer key={`${input.workspace.period}:${selected?.storeId ?? 'closed'}`} store={selected ?? null} workspace={input.workspace} locale={input.locale} readOnly={input.readOnly}
      interactionLocked={Boolean(input.interactionLocked)} onComplete={input.onCompleteStore}
      review={selected ? status(selected) : null}
      onClose={() => setSelectedId(null)}
      returnFocus={() => { if (lastOpenedId.current) storeRows.current.get(`${lastOpenedId.current}:${lastOpenedMobile.current}`)?.focus() }} />
  </>

}

function managerName(region: IncentiveWorkspace['managerGroups'][number]) {
  return region.managerName || '—'
}

function sortValue(store: IncentiveStore, key: Exclude<SortKey, 'name' | 'manager'>, workspace: IncentiveWorkspace) {
  const sales = storeSalesDisplay(store, workspace)
  const value = key === 'target' ? store.storeTarget : key === 'sale' ? sales.sale : key === 'returns' ? sales.returns : key === 'actual' ? sales.net : key === 'achievement' ? sales.achievement : sumMoney(store.rows.map(row => row.finalAmount))
  return value === null || value === undefined ? null : Number(value)
}
