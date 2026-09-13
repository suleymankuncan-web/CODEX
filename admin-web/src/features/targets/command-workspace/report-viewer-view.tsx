import { useRef, useState } from 'react'
import { TargetCommandDrawer } from './target-drawer'
import { TargetWorkspaceHierarchy } from './workspace-hierarchy'
import { TargetWorkspaceScaffold } from './workspace-scaffold'
import type { TargetCommandStore, TargetCommandWorkspace, TargetManagerSelection } from './types'

export function ReportViewerTargetCommand(input: {
  pagination?: { page: number; onPageChange: (page: number) => void; disabled: boolean }
  managerSelection: TargetManagerSelection;
  workspace: TargetCommandWorkspace; period: string; onPeriodChange: (period: string) => void
  isUpdating: boolean; backgroundError: Error | null; hasMore: boolean; isLoadingMore: boolean
  onLoadMore: () => void; onRetry: () => void
}) {
  const [selected, setSelected] = useState<TargetCommandStore | null>(null)
  const opener = useRef<HTMLButtonElement | null>(null)
  const close = () => { setSelected(null); requestAnimationFrame(() => opener.current?.focus()) }
  return <><TargetWorkspaceScaffold {...input} renderContent={({ workspace, sort, onSort, page }) => <TargetWorkspaceHierarchy page={page} workspace={workspace} sort={sort} onSort={onSort} onOpen={(store, button) => { opener.current = button; setSelected(store) }} />} /><TargetCommandDrawer period={input.period} canReadBasis={false} key={`${input.period}:${selected?.request?.requestId ?? selected?.storeId ?? 'closed'}`} store={selected} editable={false} onClose={close} /></>
}
