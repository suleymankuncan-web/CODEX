import { Badge } from '@/components/ui/badge'
import { CommandCanvasDataList, CommandCanvasSortableHeading } from '@/features/store-command-canvas/primitives'
import { useLocalization } from '@/features/localization/useLocalization'
import { getTargetCommandCopy } from './copy'
import { formatTargetMoney, formatTargetTimestamp, targetDistributed } from './format'
import { flattenTargetStores, sortTargetStores } from './model'
import type { TargetCommandSortState, TargetCommandStore, TargetCommandWorkspace } from './types'
import { getTargetStatusMeta } from './status'

export function TargetWorkspaceHierarchy(input: {
  page?: number | undefined
  workspace: TargetCommandWorkspace
  sort: TargetCommandSortState
  onSort: (key: TargetCommandSortState['key']) => void
  onOpen: (store: TargetCommandStore, opener: HTMLButtonElement) => void
}) {
  const { locale } = useLocalization()
  const copy = getTargetCommandCopy(locale)
  return <CommandCanvasDataList ariaLabel={copy.totalStores} className="target-command-list" header={<TargetListHeader copy={copy} sort={input.sort} onSort={input.onSort} />}>
    {sortTargetStores(flattenTargetStores(input.workspace).map(({ store }) => store), input.sort).slice(input.page === undefined ? 0 : input.page * 50, input.page === undefined ? undefined : (input.page + 1) * 50).map(store => <TargetStoreRow key={store.storeId} store={store} locale={locale} onOpen={input.onOpen} />)}
  </CommandCanvasDataList>
}

function TargetListHeader(input: { copy: ReturnType<typeof getTargetCommandCopy>; sort: TargetCommandSortState; onSort: (key: TargetCommandSortState['key']) => void }) {
  const heading = (key: TargetCommandSortState['key'], label: string) => <CommandCanvasSortableHeading label={label} direction={input.sort.key === key ? input.sort.direction : 'none'} onClick={() => input.onSort(key)} semantic={false} />
  return <>{heading('store', input.copy.store)}{heading('target', input.copy.target)}{heading('distributed', input.copy.distributed)}{heading('personnel', input.copy.personnel)}{heading('status', input.copy.state)}</>
}

function TargetStoreRow(input: { store: TargetCommandStore; locale: 'tr' | 'en'; onOpen: (store: TargetCommandStore, opener: HTMLButtonElement) => void }) {
  const store = input.store
  const copy = getTargetCommandCopy(input.locale)
  const status = getTargetStatusMeta(input.locale)[store.status]
  return <button className="target-command-row" onClick={(event) => input.onOpen(store, event.currentTarget)} type="button"><span className="target-command-store"><span><strong>{store.storeName}</strong></span></span><span data-label={copy.target}><strong>{formatTargetMoney(store.request?.totalTargetValue, input.locale)}</strong><small>{formatTargetTimestamp(store.request?.updatedAt, input.locale)}</small></span><span data-label={copy.distributed}><strong>{formatTargetMoney(targetDistributed(store), input.locale)}</strong><small>{store.request ? `%${Math.round((Number(targetDistributed(store) ?? 0) / Number(store.request.totalTargetValue || 1)) * 100)}` : '—'}</small></span><span data-label={copy.personnel}><strong>{store.request?.allocationCount ?? store.personnel.length}</strong></span><span data-label={copy.state}><Badge variant="secondary" className="target-command-status" data-tone={status.tone}>{status.label}</Badge></span></button>
}
