import { useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { approveTargetDistributionRequest } from '../api'
import { TargetCommandDrawer, type TargetApprovalInput } from './target-drawer'
import { TargetWorkspaceHierarchy } from './workspace-hierarchy'
import { TargetWorkspaceScaffold } from './workspace-scaffold'
import type { TargetCommandStore, TargetCommandWorkspace, TargetManagerSelection } from './types'

export function RegionManagerTargetCommand(input: {
  managerSelection: TargetManagerSelection;
  workspace: TargetCommandWorkspace; period: string; onPeriodChange: (period: string) => void
  isUpdating: boolean; backgroundError: Error | null; hasMore: boolean; isLoadingMore: boolean
  onLoadMore: () => void; onRetry: () => void; queryKey: readonly unknown[]
}) {
  const queryClient = useQueryClient()
  const [selected, setSelected] = useState<TargetCommandStore | null>(null)
  const [error, setError] = useState<string | null>(null)
  const opener = useRef<HTMLButtonElement | null>(null)
  const mutation = useMutation({
    mutationFn: (value: TargetApprovalInput) => approveTargetDistributionRequest(value),
    onSuccess: async () => { setSelected(null); requestAnimationFrame(() => opener.current?.focus()); await queryClient.invalidateQueries({ queryKey: input.queryKey }) },
    onError: () => setError('Hedef kararı kaydedilemedi. Lütfen dağılımı ve yetki kapsamını kontrol edin.'),
  })
  const writesReady = !input.isUpdating && input.period === input.workspace.period
  const close = () => { if (!mutation.isPending) { setSelected(null); setError(null); requestAnimationFrame(() => opener.current?.focus()) } }
  return <><TargetWorkspaceScaffold {...input} renderContent={({ workspace, sort, onSort }) => <TargetWorkspaceHierarchy workspace={workspace} sort={sort} onSort={onSort} onOpen={(store, button) => { opener.current = button; setSelected(store); setError(null) }} />} /><TargetCommandDrawer period={input.period} canReadBasis={true} key={`${input.period}:${selected?.request?.requestId ?? selected?.storeId ?? 'closed'}`} store={selected} editable={Boolean(writesReady && selected?.capabilities.canApproveRequest)} pending={mutation.isPending} error={error} onClose={close} onApprove={(value) => { if (writesReady) mutation.mutate(value) }} /></>
}
