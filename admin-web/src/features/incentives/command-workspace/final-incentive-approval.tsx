import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import type { AuthSessionSummary } from '@/features/auth/api'
import { fetchOpenApiJson, sendOpenApiJson, type ApiGetResponse } from '@/lib/openapi-client'
import type { AppLocale } from '@/lib/i18n'
import { transientQueryRetryOptions } from '@/lib/query-retry'
import { canApproveIncentives } from './final-incentive-approval-permission'

type Package = ApiGetResponse<'/api/store/incentives/final-approval'>['items'][number]
type BatchResult = { approved: string[]; failed: string | null; remaining: number }
const packageKey = (item: Package) => `${item.regionId}:${item.regionPackageId}:${item.submittedAt}`

export function FinalIncentiveApproval(input: {
  authSummary?: AuthSessionSummary | null
  period: string
  locale: AppLocale
  disabled?: boolean
  regionIds?: string[] | undefined
  onBusyChange?: (busy: boolean) => void
}) {
  const enabled = canApproveIncentives(input.authSummary)
  const tr = input.locale === 'tr'
  const client = useQueryClient()
  const [selected, setSelected] = useState<Set<string>>(() => new Set())
  const [confirmation, setConfirmation] = useState<Package[] | null>(null)
  const [result, setResult] = useState<BatchResult | null>(null)
  const [progress, setProgress] = useState(0)
  const [filter, setFilter] = useState<'all' | 'submitted' | 'admin_approved'>('all')
  const mounted = useRef(true)
  const running = useRef(false)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  const query = useQuery({
    queryKey: ['incentive-final-approval', input.authSummary?.user.userId, input.authSummary?.user.authorizationContextVersion, input.period],
    queryFn: () => fetchOpenApiJson('/api/store/incentives/final-approval', { query: new URLSearchParams({ period: input.period }) }),
    enabled,
    ...transientQueryRetryOptions,
  })
  const isEligible = (item: Package) => item.status === 'submitted' && Boolean(item.regionPackageId && item.submittedAt) && item.submittedByUserId !== input.authSummary?.user.userId
  const items = (query.isError ? [] : query.data?.items ?? []).filter(item => !input.regionIds || input.regionIds.includes(item.regionId))
  const visible = items.filter(item => filter === 'all' || item.status === filter)
  const eligible = visible.filter(isEligible)
  const chosen = eligible.filter(item => selected.has(packageKey(item)))
  const mutation = useMutation({
    retry: false,
    mutationFn: async (packages: Package[]): Promise<BatchResult> => {
      const approved: string[] = []
      for (const item of packages) {
        // Do not start another financial write after navigation or a failed/uncertain response.
        if (!mounted.current) return { approved, failed: null, remaining: packages.length - approved.length }
        try {
          await sendOpenApiJson('/api/store/incentives/final-approval', {
            method: 'POST', body: { period: input.period, regionId: item.regionId, regionPackageId: item.regionPackageId!, submittedAt: item.submittedAt! },
          })
          approved.push(item.regionName ?? (tr ? 'Bölge' : 'Region'))
          if (mounted.current) setProgress(approved.length)
        } catch {
          return { approved, failed: item.regionName ?? (tr ? 'Bölge' : 'Region'), remaining: packages.length - approved.length - 1 }
        }
      }
      return { approved, failed: null, remaining: 0 }
    },
    onSuccess: async outcome => {
      if (mounted.current) { setResult(outcome); setSelected(new Set()); setConfirmation(null) }
      await client.invalidateQueries({ predicate: entry => entry.queryKey.some(key => typeof key === 'string' && key.includes('incentive')) })
    },
    onSettled: () => { running.current = false },
  })
  const onBusyChange = input.onBusyChange
  useEffect(() => {
    onBusyChange?.(mutation.isPending)
    return () => onBusyChange?.(false)
  }, [mutation.isPending, onBusyChange])
  if (!enabled) return null
  const canAct = !input.disabled && !query.isFetching && !query.isError && !mutation.isPending
  const confirmationCurrent = Boolean(confirmation?.length && confirmation.every(item => eligible.some(current => packageKey(current) === packageKey(item))))
  const selectAll = () => setSelected(chosen.length === eligible.length ? new Set() : new Set(eligible.map(packageKey)))
  const confirm = () => {
    if (!canAct || !confirmationCurrent || !confirmation || running.current) return
    running.current = true
    setProgress(0); setResult(null)
    mutation.mutate(confirmation)
  }
  const statusLabel = (item: Package) => item.status === 'admin_approved' ? (tr ? 'Final onaylandı' : 'Approved') : item.status === 'admin_returned' ? (tr ? 'Bölgeye iade edildi' : 'Returned') : item.status === 'submitted' ? (tr ? 'Onay bekliyor' : 'Awaiting approval') : (tr ? 'Bölge onayı bekleniyor' : 'Awaiting submission')
  return <>
    <section className="incentive-approval" aria-label={tr ? 'Prim Onayı' : 'Final incentive approval'} aria-busy={mutation.isPending}>
      <header className="incentive-approval-heading">
        <div className="incentive-section-heading"><div><h2>{tr ? 'Prim Onayı' : 'Final incentive approval'}</h2><p>{tr ? 'Gönderilen bölge paketlerini tek tek veya toplu onaylayın.' : 'Approve submitted regional packages individually or together.'}</p></div></div>
        <Badge variant="secondary">{items.filter(item => item.status === 'submitted').length} {tr ? 'bekleyen paket' : 'pending packages'}</Badge>
      </header>
      {query.isPending ? <div className="incentive-approval-loading"><Skeleton className="tw:h-24 tw:w-full" /></div> : query.isError ? <div className="incentive-approval-notice" role="alert"><p>{tr ? 'Onay paketleri alınamadı veya yetkiniz kaldırıldı.' : 'Could not load approval packages, or your permission was revoked.'}</p><Button variant="outline" onClick={() => void query.refetch()}>{tr ? 'Yeniden dene' : 'Retry'}</Button></div> : <>
        <div className="incentive-approval-tools">
          <div className="incentive-approval-filters" role="group" aria-label={tr ? 'Paket durumu' : 'Package status'}>
            {(['all', 'submitted', 'admin_approved'] as const).map(value => <Button key={value} variant="ghost" size="sm" aria-pressed={filter === value} disabled={mutation.isPending} onClick={() => { setFilter(value); setSelected(new Set()); setConfirmation(null) }}>{value === 'all' ? (tr ? 'Tümü' : 'All') : value === 'submitted' ? (tr ? 'Onay bekleyen' : 'Pending') : (tr ? 'Onaylanan' : 'Approved')}</Button>)}
          </div>
          <label className="incentive-approval-select"><Checkbox aria-label={tr ? 'Onaylanabilir paketlerin tümünü seç' : 'Select all eligible packages'} disabled={!canAct || !eligible.length} checked={chosen.length > 0 && chosen.length === eligible.length ? true : chosen.length > 0 ? 'indeterminate' : false} onCheckedChange={selectAll} /><span>{tr ? 'Tümünü seç' : 'Select all'}</span></label>
        </div>
        <div className="incentive-package-list">
          {visible.map(item => <div key={packageKey(item)} className="incentive-package" data-selected={selected.has(packageKey(item)) && isEligible(item)}>
            <label className="incentive-package-identity"><Checkbox aria-label={`${item.regionName ?? 'Bölge'}: ${tr ? 'Paketi seç' : 'Select package'}`} disabled={!canAct || !isEligible(item)} checked={selected.has(packageKey(item)) && isEligible(item)} onCheckedChange={checked => setSelected(current => { const next = new Set(current); if (checked) next.add(packageKey(item)); else next.delete(packageKey(item)); return next })} /><span><strong>{item.submittedByName ?? item.regionManagerName ?? (tr ? 'Bölge paketi' : 'Regional package')}</strong><small>{item.regionName ?? (tr ? 'Bölge' : 'Region')} · {item.submittedStoreCount}/{item.storeCount} {tr ? 'mağaza' : 'stores'}</small></span></label>
            <Badge className={item.status === 'admin_approved' ? 'incentive-badge-approved' : ''} variant="secondary">{item.status === 'admin_approved' ? <Check aria-hidden="true" /> : null}{statusLabel(item)}</Badge>
            {isEligible(item) ? <Button size="sm" variant="outline" disabled={!canAct} onClick={() => setConfirmation([item])}>{tr ? 'Final onay ver' : 'Give final approval'}</Button> : item.status === 'submitted' ? <small className="incentive-package-reason">{tr ? 'Başka bir yetkili onaylamalı' : 'Another approver is required'}</small> : null}
          </div>)}
          {visible.length === 0 ? <p className="incentive-command-empty">{tr ? 'Bu seçimde prim paketi bulunamadı.' : 'No incentive packages match this selection.'}</p> : null}
        </div>
        {chosen.length > 0 ? <footer className="incentive-approval-footer">
          <div><strong>{chosen.length} {tr ? 'paket seçildi' : 'packages selected'}</strong><small>{tr ? 'Final onaydan sonra bölge paketi değiştirilemez.' : 'The regional package is locked after final approval.'}</small></div>
          <Button disabled={!canAct || !chosen.length} onClick={() => setConfirmation(chosen)}><ShieldCheck aria-hidden="true" />{tr ? 'Seçilenleri onayla' : 'Approve selected'}{chosen.length ? ` (${chosen.length})` : ''}</Button>
        </footer> : <p className="incentive-approval-hint">{tr ? 'Toplu onay için listeden paket seçin.' : 'Select packages from the list to approve them together.'}</p>}
      </>}
      {result ? <div className="incentive-approval-notice" role={result.failed ? 'alert' : 'status'}><strong>{result.approved.length} {tr ? 'paket onaylandı.' : 'packages approved.'}</strong>{result.approved.length ? <p>{result.approved.join(', ')}</p> : null}{result.failed ? <p>{tr ? `${result.failed} için onay doğrulanamadı; işlem durduruldu. ${result.remaining} pakete işlem yapılmadı. Güncel durumu kontrol edip yeniden seçin.` : `Approval could not be confirmed for ${result.failed}; processing stopped. ${result.remaining} packages were not attempted. Review the refreshed state before selecting again.`}</p> : null}</div> : null}
    </section>
    <Dialog open={Boolean(confirmation)} onOpenChange={open => { if (!open && !mutation.isPending) setConfirmation(null) }}>
      <DialogContent closeLabel={tr ? 'Kapat' : 'Close'} onEscapeKeyDown={event => { if (mutation.isPending) event.preventDefault() }} onPointerDownOutside={event => { if (mutation.isPending) event.preventDefault() }}>
        <DialogHeader><DialogTitle>{tr ? 'Prim final onayı' : 'Final incentive approval'}</DialogTitle><DialogDescription>{input.period} · {confirmation?.length} {tr ? 'bölge paketi. Onaydan sonra bölge müdürü bu paketleri değiştiremez.' : 'regional packages. The regional manager cannot edit approved packages.'}</DialogDescription></DialogHeader>
        <ul className="incentive-confirm-packages">{confirmation?.map(item => <li key={packageKey(item)}><span><strong>{item.regionName}</strong><small>{item.submittedByName ?? item.regionManagerName}</small></span><Badge variant="secondary">{item.submittedStoreCount} {tr ? 'mağaza' : 'stores'}</Badge></li>)}</ul>
        <p className="incentive-confirm-copy">{tr ? 'Paketler sırayla onaylanır. Bir işlem başarısız olursa sonraki paketlere geçilmez; tamamlanan onaylar korunur.' : 'Packages are approved in order. Processing stops on a failure; completed approvals are retained.'}</p>
        {mutation.isPending ? <p role="status">{tr ? 'Onaylanıyor' : 'Approving'}: {progress}/{confirmation?.length}</p> : confirmationCurrent ? null : <p role="alert">{tr ? 'Paket bilgileri değişti. Pencereyi kapatıp güncel paketleri seçin.' : 'Package details changed. Close this dialog and select the current packages.'}</p>}
        <DialogFooter><Button variant="outline" disabled={mutation.isPending} onClick={() => setConfirmation(null)}>{tr ? 'Vazgeç' : 'Cancel'}</Button><Button disabled={!canAct || !confirmationCurrent} onClick={confirm}>{mutation.isPending ? (tr ? 'Onaylanıyor' : 'Approving') : (tr ? 'Final onayı ver' : 'Confirm final approval')}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  </>
}
