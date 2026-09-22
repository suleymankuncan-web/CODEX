import { useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, Undo2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import type { AuthSessionSummary } from '@/features/auth/api'
import type { AppLocale } from '@/lib/i18n'
import { fetchOpenApiJson, sendOpenApiJson } from '@/lib/openapi-client'
import { actionToast } from '@/lib/action-toast'
import { transientQueryRetryOptions } from '@/lib/query-retry'
import { canApproveIncentives } from './final-incentive-approval-permission'
import type { IncentiveRegion } from './types'

export function StorePackageDecision(input: { region: IncentiveRegion; period: string; locale: AppLocale; auth: AuthSessionSummary | null; disabled: boolean }) {
  const tr = input.locale === 'tr'
  const client = useQueryClient()
  const [note, setNote] = useState('')
  const [decision, setDecision] = useState<'approve' | 'return' | null>(null)
  const running = useRef(false)
  const enabled = canApproveIncentives(input.auth)
  const query = useQuery({
    queryKey: ['incentive-final-approval', input.auth?.user.userId, input.auth?.user.authorizationContextVersion, input.period],
    queryFn: () => fetchOpenApiJson('/api/store/incentives/final-approval', { query: new URLSearchParams({ period: input.period }) }),
    enabled,
    ...transientQueryRetryOptions,
  })
  const item = query.data?.items.find(candidate => candidate.regionId === input.region.regionId)
  // Confirm the same submission that was displayed, never a replacement package after a refresh.
  const [confirmationVersion, setConfirmationVersion] = useState<string | null>(null)
  const version = item ? `${item.regionPackageId}:${item.submittedAt}` : null
  const eligible = enabled && item?.status === 'submitted' && Boolean(item.regionPackageId && item.submittedAt) && item.submittedByUserId !== input.auth?.user.userId
  const mutation = useMutation({
    retry: 0,
    mutationFn: async (value: 'approve' | 'return') => {
      if (!item?.regionPackageId || !item.submittedAt || !eligible || confirmationVersion !== version || (value === 'return' && !note.trim())) throw new Error('Package decision unavailable')
      return sendOpenApiJson('/api/store/incentives/final-approval', { method: 'POST', body: {
        period: input.period, regionId: item.regionId, regionPackageId: item.regionPackageId,
        submittedAt: item.submittedAt, decision: value, ...(note.trim() ? { reviewNote: note.trim() } : {}),
      } })
    },
    onSuccess: () => { setDecision(null); setNote(''); actionToast.success(tr ? 'Bölge paketi kararı kaydedildi.' : 'Regional package decision saved.') },
    onError: error => actionToast.error(error, tr ? 'Karar kaydedilemedi. Güncel paketi kontrol edin.' : 'Could not save. Review the refreshed package.'),
    onSettled: async () => {
      try { await client.invalidateQueries({ predicate: entry => entry.queryKey.some(key => typeof key === 'string' && key.includes('incentive')) }) } finally { running.current = false }
    },
  })
  if (!enabled) return null
  const blocked = input.disabled || query.isFetching || query.isError || mutation.isPending || !eligible
  const open = (value: 'approve' | 'return') => { setConfirmationVersion(version); setDecision(value) }
  return <section className="incentive-package-decision" aria-label={tr ? 'Bölge paketi kararı' : 'Regional package decision'}>
    <header><h3>{tr ? 'Bölge paketi onayı' : 'Regional package approval'}</h3><p>{input.region.regionManager.displayName ?? input.region.regionName} · {item?.submittedStoreCount ?? input.region.stores.length} {tr ? 'mağaza' : 'stores'}</p></header>
    <p>{tr ? 'Kabul veya ret kararı, bu mağazanın bulunduğu bölge paketinin tamamına uygulanır.' : 'This decision applies to the entire regional package containing this store.'}</p>
    {query.isPending ? <p role="status">{tr ? 'Paket bilgisi yükleniyor…' : 'Loading package details…'}</p> : query.isError ? <p role="alert">{tr ? 'Paket bilgisi alınamadı.' : 'Package could not be loaded.'}<Button variant="ghost" onClick={() => void query.refetch()}>{tr ? 'Tekrar dene' : 'Retry'}</Button></p> : eligible ? <>
      <label htmlFor="incentive-package-note">{tr ? 'Karar notu' : 'Decision note'}</label>
      <Textarea id="incentive-package-note" maxLength={1000} value={note} disabled={blocked} onChange={event => setNote(event.target.value)} placeholder={tr ? 'Ret işleminde gerekçe yazılması zorunludur.' : 'A reason is required when returning a package.'} />
      <footer><Button variant="outline" disabled={blocked || !note.trim()} onClick={() => open('return')}><Undo2 aria-hidden="true" />{tr ? 'Reddet' : 'Return'}</Button><Button disabled={blocked} onClick={() => open('approve')}><Check aria-hidden="true" />{tr ? 'Kabul et' : 'Accept'}</Button></footer>
    </> : <p role="status">{item?.status === 'admin_approved' ? (tr ? 'Bölge paketi kabul edildi.' : 'Package accepted.') : item?.status === 'admin_returned' ? (tr ? 'Bölge paketi düzeltme için iade edildi.' : 'Package returned for correction.') : item?.status === 'submitted' ? (tr ? 'Kendi gönderdiğiniz paketi onaylayamazsınız.' : 'You cannot approve your own submission.') : (tr ? 'Bölge müdürünün paketi göndermesi bekleniyor.' : 'Awaiting regional manager submission.')}</p>}
    <Dialog open={decision !== null} onOpenChange={open => { if (!open && !mutation.isPending) setDecision(null) }}><DialogContent className="incentive-package-confirmation" showCloseButton={!mutation.isPending} onEscapeKeyDown={event => { if (mutation.isPending) event.preventDefault() }} onPointerDownOutside={event => { if (mutation.isPending) event.preventDefault() }}>
      <DialogHeader><DialogTitle>{decision === 'return' ? (tr ? 'Bölge paketini reddet' : 'Return regional package') : (tr ? 'Bölge paketini kabul et' : 'Accept regional package')}</DialogTitle><DialogDescription>{input.period} · {input.region.regionManager.displayName ?? input.region.regionName} · {item?.submittedStoreCount} {tr ? 'mağazanın tamamı' : 'stores in the package'}</DialogDescription></DialogHeader>
      <p className="incentive-confirm-copy">{tr ? (decision === 'return' ? 'Paket bölge müdürüne düzeltme için geri gönderilir.' : 'Kabulden sonra bu paketteki primler bölge müdürü tarafından değiştirilemez.') : 'The decision applies to the entire submitted regional package.'}</p>
      {note.trim() ? <p className="incentive-confirm-copy">{note.trim()}</p> : null}
      {!mutation.isPending && confirmationVersion !== version ? <p role="alert">{tr ? 'Paket bilgileri değişti. Pencereyi kapatıp güncel paketi kontrol edin.' : 'Package details changed. Close this dialog and review the current package.'}</p> : null}
      <DialogFooter><Button variant="outline" disabled={mutation.isPending} onClick={() => setDecision(null)}>{tr ? 'Vazgeç' : 'Cancel'}</Button><Button disabled={blocked || confirmationVersion !== version} onClick={() => { if (!blocked && decision && confirmationVersion === version && !running.current) { running.current = true; mutation.mutate(decision) } }}>{mutation.isPending ? (tr ? 'Kaydediliyor…' : 'Saving…') : decision === 'return' ? (tr ? 'Paketi reddet' : 'Return package') : (tr ? 'Paketi kabul et' : 'Accept package')}</Button></DialogFooter>
    </DialogContent></Dialog>
  </section>
}
