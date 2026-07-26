import { useState } from 'react'
import { ChevronDown, Store } from 'lucide-react'
import { CommandCanvasDataList, CommandCanvasSortableHeading } from '@/features/store-command-canvas/primitives'
import { useLocalization } from '@/features/localization/useLocalization'
import { getTargetCommandCopy } from './copy'
import { formatTargetMoney, formatTargetTimestamp, targetDistributed } from './format'
import { sortTargetStores } from './model'
import type { TargetCommandSortState, TargetCommandStore, TargetCommandWorkspace } from './types'
import { getTargetStatusMeta } from './status'

export function TargetWorkspaceHierarchy(input: {
  workspace: TargetCommandWorkspace
  sort: TargetCommandSortState
  onSort: (key: TargetCommandSortState['key']) => void
  onOpen: (store: TargetCommandStore, opener: HTMLButtonElement) => void
}) {
  const { locale } = useLocalization()
  const copy = getTargetCommandCopy(locale)
  const viewer = input.workspace.view === 'report_viewer'
  const regions = input.workspace.companies.flatMap((company) => company.regions.map((region) => ({ company, region })))
  const [openRegions, setOpenRegions] = useState<string[]>(() => regions.slice(0, 1).map(({ company, region }) => `${company.companyId}:${region.regionId}`))
  const list = (stores: TargetCommandStore[], ariaLabel: string) => (
    <CommandCanvasDataList ariaLabel={ariaLabel} className="target-command-list" header={<TargetListHeader copy={copy} sort={input.sort} onSort={input.onSort} />}>
      {sortTargetStores(stores, input.sort).map((store) => <TargetStoreRow key={store.storeId} store={store} locale={locale} onOpen={input.onOpen} />)}
    </CommandCanvasDataList>
  )
  if (!viewer) return <>{input.workspace.companies.flatMap((company) => company.regions.map((region) => <div key={region.regionId}>{list(region.stores, `${region.regionName ?? copy.regionFallback} · ${copy.totalStores}`)}</div>))}</>
  return <><div className="target-command-viewer-intro"><div><h2>{copy.regions}</h2><p>{copy.viewerHierarchyHint}</p></div><span>{regions.length} {copy.regionManagerCount}</span></div><div className="target-command-viewer-groups">{input.workspace.companies.map((company) => (
    <section className="target-command-company" key={company.companyId}>
      {company.regions.map((region) => {
        const key = `${company.companyId}:${region.regionId}`
        const open = openRegions.includes(key)
        const manager = region.regionManager.displayName ?? copy.managerFallback
        return <section className="target-command-region" key={key}><button className="target-command-region-head" aria-expanded={open} onClick={() => setOpenRegions((current) => open ? current.filter((id) => id !== key) : [...current, key])}><span className="target-command-avatar">{manager.split(' ').map((part) => part[0]).join('').slice(0, 2)}</span><span><strong>{manager}</strong><small>{company.companyName} · {region.regionName ?? copy.regionFallback}</small></span><span><strong>{region.stores.length}</strong><small>{copy.stores}</small></span><span><strong>{region.stores.filter((store) => store.status === 'pending').length}</strong><small>{copy.decisionWaiting}</small></span><ChevronDown size={17} /></button>{open ? list(region.stores, `${company.companyName} · ${manager} · ${copy.totalStores}`) : null}</section>
      })}
    </section>
  ))}</div></>
}

function TargetListHeader(input: { copy: ReturnType<typeof getTargetCommandCopy>; sort: TargetCommandSortState; onSort: (key: TargetCommandSortState['key']) => void }) {
  const heading = (key: TargetCommandSortState['key'], label: string) => <CommandCanvasSortableHeading label={label} direction={input.sort.key === key ? input.sort.direction : 'none'} onClick={() => input.onSort(key)} semantic={false} />
  return <>{heading('store', input.copy.store)}{heading('target', input.copy.target)}{heading('distributed', input.copy.distributed)}{heading('personnel', input.copy.personnel)}{heading('status', input.copy.state)}</>
}

function TargetStoreRow(input: { store: TargetCommandStore; locale: 'tr' | 'en'; onOpen: (store: TargetCommandStore, opener: HTMLButtonElement) => void }) {
  const store = input.store
  const copy = getTargetCommandCopy(input.locale)
  const status = getTargetStatusMeta(input.locale)[store.status]
  const person = store.request?.allocations[0]?.displayName ?? store.personnel[0]?.displayName
  return <button className="target-command-row" onClick={(event) => input.onOpen(store, event.currentTarget)} type="button"><span className="target-command-store"><span className="target-command-store-icon"><Store size={15} /></span><span><strong>{store.storeName}</strong></span></span><span data-label={copy.target}><strong>{formatTargetMoney(store.request?.totalTargetValue, input.locale)}</strong><small>{formatTargetTimestamp(store.request?.updatedAt, input.locale)}</small></span><span data-label={copy.distributed}><strong>{formatTargetMoney(targetDistributed(store), input.locale)}</strong><small>{store.request ? `%${Math.round((Number(targetDistributed(store) ?? 0) / Number(store.request.totalTargetValue || 1)) * 100)}` : '—'}</small></span><span data-label={copy.personnel}><strong>{store.request?.allocationCount ?? store.personnel.length}</strong><small>{person ?? '—'}</small></span><span data-label={copy.state}><span className="target-command-status" data-tone={status.tone}>{status.label}</span></span></button>
}
