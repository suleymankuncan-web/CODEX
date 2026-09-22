import { useEffect, useRef, useState } from 'react'
import { useMutation, useQueryClient, type QueryKey } from '@tanstack/react-query'
import { Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { useLocalization } from '@/features/localization/useLocalization'
import type { AuthSessionSummary } from '@/features/auth/api'
import type { AppLocale } from '@/lib/i18n'
import { actionToast } from '@/lib/action-toast'
import { createStoreSalesTargetIncentiveRegionCorrection, markStoreSalesTargetIncentiveReview, submitStoreSalesTargetIncentiveRegionPackage, voidStoreSalesTargetIncentiveRegionCorrection } from '../api'
import { IncentiveSubmitDialog } from './submit-dialog'
import type { IncentiveWorkspace } from './types'
import type { CompleteStoreIncentiveReview } from './store-review-editor'
import { IncentiveWorkspaceHierarchy } from './workspace-hierarchy'
import { IncentiveWorkspaceScaffold } from './workspace-scaffold'

export function RegionManagerIncentivesOwner(input: {
  workspace: IncentiveWorkspace; authSummary?: AuthSessionSummary | null; queryKey: QueryKey
  period: string; onPeriodChange: (period: string) => void; isUpdating: boolean
  backgroundError: Error | null; locale: AppLocale; t: ReturnType<typeof useLocalization>['t']
}) {
  const client = useQueryClient()
  const [submitOpen, setSubmitOpen] = useState(false)
  const [savingStore, setSavingStore] = useState<string | null>(null)
  const running = useRef(false)
  const mounted = useRef(true)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  const writesReady = !input.isUpdating && !input.backgroundError && input.period === input.workspace.period
  const invalidate = () => client.invalidateQueries({ queryKey: input.queryKey, exact: true })
  const complete: CompleteStoreIncentiveReview = async (store, changes, note) => {
    if (running.current || !writesReady || !store.capabilities.canMarkStoreReview || store.review.periodCloseStatus !== 'closed') throw new Error('Review unavailable')
    if (changes.length && (!store.capabilities.canCreateCorrection || note.trim().length < 3)) throw new Error('Correction unavailable')
    running.current = true; setSavingStore(store.storeId)
    try {
      // Existing per-person commands retain their audit trail; collect one shared store note.
      // Stop at the first failure. Never mark a partially saved store as completed.
      for (const change of changes) {
        if (!mounted.current) throw new Error('Review interrupted')
        if (change.row.correction && store.capabilities.canVoidCorrection && ['draft', 'admin_returned'].includes(change.row.correction.status) && Number(change.finalAmount) === Number(change.row.calculatedAmount)) {
          await voidStoreSalesTargetIncentiveRegionCorrection({ period: input.workspace.period, correctionId: change.row.correction.correctionId })
          continue
        }
        await createStoreSalesTargetIncentiveRegionCorrection({
        period: input.workspace.period, storeId: store.storeId, employeeId: change.row.employeeId,
        participantType: change.row.participantType, finalAmount: change.finalAmount, reasonNote: note.trim(),
        })
      }
      if (!mounted.current) throw new Error('Review interrupted')
      await markStoreSalesTargetIncentiveReview({ period: input.workspace.period, storeId: store.storeId, reviewStatus: 'reviewed' })
      actionToast.success(input.locale === 'tr' ? 'Mağaza kontrolü tamamlandı.' : 'Store review completed.')
    } finally {
      try { await invalidate() } finally { running.current = false; if (mounted.current) setSavingStore(null) }
    }
  }
  const submission = useMutation({
    mutationFn: submitStoreSalesTargetIncentiveRegionPackage, retry: 0,
    onError: error => actionToast.error(error, input.t('storeIncentives.command.submitError')),
    onSuccess: () => { setSubmitOpen(false); actionToast.success(input.t('storeIncentives.command.submitSaved')) },
    onSettled: invalidate,
  })
  return <>
    <IncentiveWorkspaceScaffold {...input}
      managerDirectory={input.authSummary ? [{ userId: input.authSummary.user.userId, displayName: input.authSummary.user.displayName?.trim() || input.workspace.regions[0]?.regionManager.displayName || input.t('storeIncentives.command.roleRegionManager'), storeIds: input.workspace.regions.flatMap(region => region.stores.map(store => store.storeId)) }] : []}
      actions={<Button disabled={!writesReady || Boolean(savingStore) || submission.isPending || !input.workspace.capabilities.canSubmitPackage} onClick={() => setSubmitOpen(true)}><Send aria-hidden="true" />{input.t('storeIncentives.regionManagerSubmit')}</Button>}
      renderContent={workspace => <IncentiveWorkspaceHierarchy workspace={workspace} locale={input.locale} t={input.t} readOnly={false} interactionLocked={!writesReady || Boolean(savingStore)} onCompleteStore={complete} />}
    />
    {submitOpen ? <IncentiveSubmitDialog locale={input.locale} onOpenChange={setSubmitOpen} onSubmit={value => { if (writesReady && !running.current) submission.mutate({ period: input.workspace.period, ...value }) }} open pending={submission.isPending} disabled={!writesReady || Boolean(savingStore)} t={input.t} workspace={input.workspace} /> : null}
  </>
}
