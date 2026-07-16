import { useRef, useState } from 'react'
import { TargetCommandDrawer } from './target-drawer'
import { TargetWorkspaceHierarchy } from './workspace-hierarchy'
import { TargetWorkspaceScaffold } from './workspace-scaffold'
import type { TargetCommandStore, TargetCommandWorkspace } from './types'

export function ReportViewerTargetCommand(input: {
  workspace: TargetCommandWorkspace; period: string; onPeriodChange: (period: string) => void
  isUpdating: boolean; backgroundError: Error | null; hasMore: boolean; isLoadingMore: boolean
  onLoadMore: () => void; onRetry: () => void
}) {
  const [selected, setSelected] = useState<TargetCommandStore | null>(null)
  const opener = useRef<HTMLButtonElement | null>(null)
  const close = () => { setSelected(null); requestAnimationFrame(() => opener.current?.focus()) }
  return <><TargetWorkspaceScaffold {...input} renderContent={({ workspace, sort, onSort }) => <TargetWorkspaceHierarchy workspace={workspace} sort={sort} onSort={onSort} onOpen={(store, button) => { opener.current = button; setSelected(store) }} />} /><TargetCommandDrawer key={selected?.storeId ?? 'closed'} store={selected} editable={false} onClose={close} /></>
}
