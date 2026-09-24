import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import type { AuthSessionSummary } from '@/features/auth/api'
import { fetchOpenApiJson, sendOpenApiJson, type ApiGetResponse } from '@/lib/openapi-client'
import type { AppLocale } from '@/lib/i18n'
import { transientQueryRetryOptions } from '@/lib/query-retry'
import { actionToast } from '@/lib/action-toast'
import { canApproveIncentives } from './final-incentive-approval-permission'
import { formatIncentiveMoney, formatIncentivePeriod } from './format'
import { sumMoney } from './model'
import { incentiveManagerGroupKey, incentivePackageKey } from './package-presentation'
import type { IncentiveWorkspace } from './types'

export type IncentiveApprovalPackage = ApiGetResponse<'/api/store/incentives/final-approval'>['items'][number]
type PackageDecision = 'approve' | 'return'
type BatchResult = { completed: string[]; decision: PackageDecision; failed: string | null; remaining: number }

export type IncentiveApprovalControls = {
  enabled: boolean
  items: IncentiveApprovalPackage[]
  eligible: IncentiveApprovalPackage[]
  chosen: IncentiveApprovalPackage[]
  busy: boolean
  loading: boolean
  error: boolean
  canAct: boolean
  result: BatchResult | null
  retry: () => void
  resetSelection: () => void
  toggle: (item: IncentiveApprovalPackage, checked: boolean) => void
  toggleAll: () => void
  approve: (items: IncentiveApprovalPackage[]) => void
  reject: (item: IncentiveApprovalPackage) => void
}

// Owns financial writes and confirmation; the workspace renders controls in each package's store list.
export function FinalIncentiveApproval(input: {
  authSummary?: AuthSessionSummary | null
  workspace: IncentiveWorkspace
  period: string
  locale: AppLocale
  disabled?: boolean
  managerGroupKeys: string[]
  statusFilter: 'all' | IncentiveApprovalPackage['status']
  children: (controls: IncentiveApprovalControls) => ReactNode
}) {
  const enabled = canApproveIncentives(input.authSummary)
  const tr = input.locale === 'tr'
  const client = useQueryClient()
  const [selected, setSelected] = useState<Set<string>>(() => new Set())
  const [confirmation, setConfirmation] = useState<IncentiveApprovalPackage[] | null>(null)
  const [decision, setDecision] = useState<PackageDecision>('approve')
  const [reviewNote, setReviewNote] = useState('')
  const [result, setResult] = useState<BatchResult | null>(null)
  const [progress, setProgress] = useState(0)
  const mounted = useRef(true)
  const running = useRef(false)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  const query = useQuery({
    queryKey: ['incentive-final-approval', input.authSummary?.user.userId, input.authSummary?.user.authorizationContextVersion, input.period],
    queryFn: () => fetchOpenApiJson('/api/store/incentives/final-approval', { query: new URLSearchParams({ period: input.period }) }),
    enabled,
    ...transientQueryRetryOptions,
  })
  const items = enabled && !query.isError ? query.data?.items ?? [] : []
  const eligible = items.filter(item => input.managerGroupKeys.includes(`${item.companyId}:${item.managerUserId}`) && (input.statusFilter === 'all' || item.status === input.statusFilter) && item.status === 'submitted' && Boolean(item.regionPackageId && item.submittedAt) && item.submittedByUserId !== input.authSummary?.user.userId)
  const chosen = eligible.filter(item => selected.has(incentivePackageKey(item)))
  const mutation = useMutation({
    retry: 0,
    mutationFn: async ({ packages, decision, reviewNote }: { packages: IncentiveApprovalPackage[]; decision: PackageDecision; reviewNote: string }): Promise<BatchResult> => {
      const completed: string[] = []
      for (const item of packages) {
        // Stop after navigation or an uncertain response; never replay financial writes automatically.
        if (!mounted.current) return { completed, decision, failed: null, remaining: packages.length - completed.length }
        try {
          await sendOpenApiJson('/api/store/incentives/final-approval', {
            method: 'POST', body: { period: input.period, regionPackageId: item.regionPackageId!, submittedAt: item.submittedAt!, decision, ...(reviewNote ? { reviewNote } : {}) },
          })
          completed.push(item.managerName || (tr ? 'Bölge müdürü' : 'Regional manager'))
          if (mounted.current) setProgress(completed.length)
        } catch {
          return { completed, decision, failed: item.managerName || (tr ? 'Bölge müdürü' : 'Regional manager'), remaining: packages.length - completed.length - 1 }
        }
      }
      return { completed, decision, failed: null, remaining: 0 }
    },
    onSuccess: async outcome => {
      if (mounted.current) {
        setResult(outcome); setSelected(new Set()); setConfirmation(null); setReviewNote('')
        if (outcome.failed) actionToast.error(null, tr ? `${outcome.failed}: Karar doğrulanamadı. Güncel paketi kontrol edip yeniden deneyin.` : `${outcome.failed}: Decision could not be confirmed. Review the current package and try again.`)
        else if (outcome.completed.length) actionToast.success(tr ? (outcome.decision === 'return' ? 'Paket reddedildi ve bölge müdürüne düzeltme için geri gönderildi.' : 'Bölge paketi onaylandı.') : (outcome.decision === 'return' ? 'Package returned to the regional manager for correction.' : 'Regional package approved.'))
      }
      await client.invalidateQueries({ predicate: entry => entry.queryKey.some(key => typeof key === 'string' && key.includes('incentive')) })
    },
    onSettled: () => { running.current = false },
  })
  const canAct = enabled && !input.disabled && !query.isFetching && !query.isError && !mutation.isPending
  const confirmationCurrent = Boolean(confirmation?.length && confirmation.every(item => eligible.some(current => incentivePackageKey(current) === incentivePackageKey(item))))
  const noteValid = decision === 'approve' || Boolean(reviewNote.trim())
  const confirm = () => {
    if (!canAct || !confirmationCurrent || !confirmation || !noteValid || running.current) return
    running.current = true
    setProgress(0); setResult(null)
    mutation.mutate({ packages: confirmation, decision, reviewNote: reviewNote.trim() })
  }
  const confirmationGroups = input.workspace.managerGroups.filter(group => confirmation?.some(item => incentiveManagerGroupKey(group) === `${item.companyId}:${item.managerUserId}`))
  const completeTotal = confirmation?.every(item => confirmationGroups.find(group => incentiveManagerGroupKey(group) === `${item.companyId}:${item.managerUserId}`)?.stores.length === item.submittedStoreCount)
  return <>
    {input.children({
      enabled, items, eligible, chosen, busy: mutation.isPending, canAct, result,
      loading: enabled && query.isPending, error: enabled && query.isError,
      retry: () => { void query.refetch() },
      resetSelection: () => { setSelected(new Set()); setConfirmation(null) },
      toggle: (item, checked) => setSelected(current => { const next = new Set(current); if (checked) next.add(incentivePackageKey(item)); else next.delete(incentivePackageKey(item)); return next }),
      toggleAll: () => setSelected(chosen.length === eligible.length ? new Set() : new Set(eligible.map(incentivePackageKey))),
      approve: packages => { if (canAct && packages.length) { setDecision('approve'); setReviewNote(''); setConfirmation(packages) } },
      reject: item => { if (canAct) { setDecision('return'); setReviewNote(''); setConfirmation([item]) } },
    })}
    <Dialog open={Boolean(confirmation)} onOpenChange={open => { if (!open && !mutation.isPending) setConfirmation(null) }}>
      <DialogContent className="incentive-package-confirmation" showCloseButton={!mutation.isPending} closeLabel={tr ? 'Kapat' : 'Close'} onEscapeKeyDown={event => { if (mutation.isPending) event.preventDefault() }} onPointerDownOutside={event => { if (mutation.isPending) event.preventDefault() }}>
        <DialogHeader><DialogTitle>{decision === 'return' ? (tr ? 'Bölge paketini reddet' : 'Return regional package') : (tr ? 'Prim final onayı' : 'Final incentive approval')}</DialogTitle><DialogDescription>{formatIncentivePeriod(input.period, input.locale)} · {confirmation?.length} {tr ? 'bölge paketi. Karar, seçili paketlerin tüm mağazalarını kapsar.' : 'regional packages. This decision includes every store in the selected packages.'}</DialogDescription></DialogHeader>
        <ul className="incentive-confirm-packages">{confirmation?.map(item => <li key={incentivePackageKey(item)}><span><strong>{item.managerName}</strong></span><Badge variant="secondary">{item.submittedStoreCount} {tr ? 'mağaza' : 'stores'}</Badge></li>)}</ul>
        {completeTotal ? <p className="incentive-confirm-copy">{tr ? 'Toplam prim' : 'Total incentive'}: <strong>{formatIncentiveMoney(sumMoney(confirmationGroups.flatMap(group => group.stores.flatMap(store => store.rows.map(row => row.finalAmount)))), input.locale)}</strong></p> : <p className="incentive-confirm-copy">{tr ? 'Paketlerin bazı mağazaları bu listede yer almıyor. Karar, yukarıdaki mağaza sayısının tamamını kapsar.' : 'Some package stores are absent from this list. The decision covers the entire store count shown above.'}</p>}
        <p className="incentive-confirm-copy">{decision === 'return' ? (tr ? 'Paket, gerekçenizle birlikte bölge müdürüne düzeltme için geri gönderilir.' : 'The package and your reason will be returned to the regional manager for correction.') : (tr ? 'Onaydan sonra bölge müdürü paketi değiştiremez. Bir onay başarısız olursa kalan paketlere işlem yapılmaz.' : 'Approved packages cannot be edited by the regional manager. Processing stops if an approval fails.')}</p>
        {decision === 'return' ? <div className="incentive-package-rejection-note"><label htmlFor="incentive-package-rejection-note">{tr ? 'Ret gerekçesi' : 'Reason for return'}</label><Textarea id="incentive-package-rejection-note" value={reviewNote} maxLength={1000} required disabled={mutation.isPending} onChange={event => setReviewNote(event.target.value)} placeholder={tr ? 'Düzeltilmesini istediğiniz noktaları yazın.' : 'Describe what needs to be corrected.'} /></div> : null}
        {mutation.isPending ? <p role="status">{tr ? 'Kaydediliyor' : 'Saving'}: {progress}/{confirmation?.length}</p> : confirmationCurrent ? null : <p role="alert">{tr ? 'Paket bilgileri değişti. Pencereyi kapatıp güncel paketleri seçin.' : 'Package details changed. Close this dialog and select the current packages.'}</p>}
        <DialogFooter><Button variant="outline" disabled={mutation.isPending} onClick={() => setConfirmation(null)}>{tr ? 'Vazgeç' : 'Cancel'}</Button><Button variant={decision === 'return' ? 'destructive' : 'default'} disabled={!canAct || !confirmationCurrent || !noteValid} onClick={confirm}>{mutation.isPending ? (tr ? 'Kaydediliyor' : 'Saving') : decision === 'return' ? (tr ? 'Paketi reddet' : 'Return package') : (tr ? 'Final onayı ver' : 'Confirm final approval')}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  </>
}
