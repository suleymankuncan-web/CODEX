import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, FileSpreadsheet, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import type { AuthSessionSummary } from '@/features/auth/api'
import type { AppLocale } from '@/lib/i18n'
import { fetchOpenApiJson, sendOpenApiJson } from '@/lib/openapi-client'
import { actionToast } from '@/lib/action-toast'
import { canApproveIncentives } from './final-incentive-approval-permission'
import { formatIncentiveMoney, formatIncentivePeriod } from './format'
import { sumMoney } from './model'
import type { IncentiveApprovalPackage } from './final-incentive-approval'

export function IncentiveHrHandoff(input: {
  packages: IncentiveApprovalPackage[]; auth: AuthSessionSummary | null
  period: string; locale: AppLocale; disabled: boolean; onBusyChange: (busy: boolean) => void
}) {
  const [open, setOpen] = useState(false)
  const running = useRef(false)
  const client = useQueryClient()
  const tr = input.locale === 'tr'
  const allApproved = input.packages.length > 0 && input.packages.every(item => item.status === 'admin_approved')
  const queryKey = ['incentive-hr-handoff', input.auth?.user.userId, input.auth?.user.authorizationContextVersion, input.period]
  const query = useQuery({ queryKey, queryFn: () => fetchOpenApiJson('/api/store/incentives/hr-handoff', { query: new URLSearchParams({ period: input.period }) }), enabled: allApproved && canApproveIncentives(input.auth), refetchOnWindowFocus: false, retry: false })
  const mutation = useMutation({
    mutationFn: (version: string) => sendOpenApiJson('/api/store/incentives/hr-handoff', { method: 'POST', body: { period: input.period, version } }), retry: false,
    onSuccess: data => { client.setQueryData(queryKey, data); actionToast.success(tr ? 'Excel dosyası e-posta sunucusuna teslim edildi.' : 'The Excel attachment was accepted by the mail server.') },
    onError: error => actionToast.error(error, tr ? 'E-posta gönderimi doğrulanamadı. Gönderim durumunu kontrol edin.' : 'Email delivery could not be confirmed. Check its status.'),
    onSettled: async () => { try { await query.refetch() } finally { running.current = false } },
  })
  const onBusyChange = input.onBusyChange
  useEffect(() => { onBusyChange(mutation.isPending); return () => onBusyChange(false) }, [mutation.isPending, onBusyChange])
  const data = query.data
  const sent = Boolean(data?.companies.length && data.companies.every(company => company.status === 'sent'))
  const uncertain = data?.companies.some(company => company.status === 'uncertain' || company.status === 'sending')
  const canSend = !input.disabled && allApproved && !query.isFetching && !query.isError && data?.canSend && !mutation.isPending
  return <div className="incentive-hr-action">
    <Button className="incentive-primary-action" disabled={input.disabled || !allApproved || mutation.isPending} title={!allApproved ? (tr ? 'Önce tüm bölge paketlerini onaylayın.' : 'Approve every regional package first.') : undefined} onClick={() => { setOpen(true); void query.refetch() }}>{sent ? <Check aria-hidden="true" /> : <Send aria-hidden="true" />}{sent ? (tr ? 'İK’ya gönderildi' : 'Sent to HR') : (tr ? 'İK’ya gönder' : 'Send to HR')}</Button>
    <Dialog open={open} onOpenChange={value => { if (!mutation.isPending) setOpen(value) }}>
      <DialogContent className="incentive-package-confirmation" showCloseButton={!mutation.isPending} onEscapeKeyDown={event => { if (mutation.isPending) event.preventDefault() }} onPointerDownOutside={event => { if (mutation.isPending) event.preventDefault() }}>
        <DialogHeader><DialogTitle>{tr ? 'İK’ya gönderim özeti' : 'HR delivery summary'}</DialogTitle><DialogDescription>{formatIncentivePeriod(input.period, input.locale)} · {tr ? 'Tüm onaylı müdür paketleri Excel olarak gönderilir.' : 'Every approved manager package is included in the Excel delivery.'}</DialogDescription></DialogHeader>
        {query.isPending ? <p role="status">{tr ? 'Gönderim özeti hazırlanıyor…' : 'Preparing delivery summary…'}</p> : query.isError ? <div role="alert"><p>{tr ? 'Gönderim özeti alınamadı.' : 'Could not load delivery summary.'}</p><Button variant="outline" onClick={() => void query.refetch()}>{tr ? 'Tekrar dene' : 'Retry'}</Button></div> : data ? <>
          <dl className="incentive-hr-summary"><div><dt>{tr ? 'Müdür paketi' : 'Manager packages'}</dt><dd>{data.companies.reduce((total, company) => total + company.managerPackageCount, 0)}</dd></div><div><dt>{tr ? 'Mağaza' : 'Stores'}</dt><dd>{data.companies.reduce((total, company) => total + company.storeCount, 0)}</dd></div><div><dt>{tr ? 'Personel' : 'People'}</dt><dd>{data.companies.reduce((total, company) => total + company.personnelCount, 0)}</dd></div><div><dt>{tr ? 'Toplam prim' : 'Total incentive'}</dt><dd>{formatIncentiveMoney(sumMoney(data.companies.map(company => company.totalAmount)), input.locale)}</dd></div></dl>
          <p className="incentive-confirm-copy"><FileSpreadsheet size={16} aria-hidden="true" /> {tr ? 'Müdür özeti ve personel primleri · Excel (.xlsx)' : 'Manager summary and personnel incentives · Excel (.xlsx)'}</p>
          <div className="incentive-hr-recipients">{data.companies.map(company => <div key={company.companyId}><strong>{company.companyName} · {tr ? 'Alıcılar' : 'Recipients'}</strong>{company.recipients.length ? <ul>{company.recipients.map(email => <li key={email}>{email}</li>)}</ul> : <p>{tr ? 'İK alıcı adresleri henüz tanımlanmadı.' : 'HR recipient addresses are not configured yet.'}</p>}{company.status === 'sent' ? <p>{tr ? 'E-posta sunucusuna teslim edildi.' : 'Accepted by the mail server.'}</p> : null}</div>)}</div>
          {!data.allApproved ? <p role="alert">{tr ? 'Onaylanmamış veya güncelliği değişmiş paket var. Gönderimden önce paketleri kontrol edin.' : 'Some packages are unapproved or stale. Review them before sending.'}</p> : null}
          {!data.mailConfigured ? <p role="status">{tr ? 'E-posta ayarları tamamlandığında gönderim açılacak.' : 'Sending will be available after email settings are configured.'}</p> : null}
          {uncertain ? <p role="alert">{tr ? 'Bu dönem için gönderim başlatılmış. Tekrar göndermeden önce posta sunucusu kayıtları kontrol edilmeli.' : 'Delivery has already been initiated. Check the mail server records before sending again.'}</p> : null}
        </> : null}
        <DialogFooter><Button variant="outline" disabled={mutation.isPending} onClick={() => setOpen(false)}>{sent ? (tr ? 'Kapat' : 'Close') : (tr ? 'Vazgeç' : 'Cancel')}</Button>{!sent ? <Button disabled={!canSend} onClick={() => { if (canSend && data && !running.current) { running.current = true; mutation.mutate(data.version) } }}>{mutation.isPending ? (tr ? 'Gönderiliyor…' : 'Sending…') : (tr ? 'Onayla' : 'Confirm')}</Button> : null}</DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
}
