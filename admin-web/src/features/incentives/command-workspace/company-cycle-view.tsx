import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, Download, RefreshCw, Undo2, WalletCards } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CalendarPicker } from '@/components/ui/calendar-picker'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { CommandCanvasPage } from '@/features/store-command-canvas/primitives'
import { StoreOperationsHeader } from '@/pages/store-operations-layout'
import type { AuthSessionSummary } from '@/features/auth/api'
import type { AppLocale } from '@/lib/i18n'
import { fetchOpenApiJson, sendOpenApiJson, type ApiGetResponse } from '@/lib/openapi-client'
import { actionToast } from '@/lib/action-toast'
import { companyStageCompanies, type CompanyStage } from './company-cycle-permission'
import { formatIncentiveMoney } from './format'
import { IncentiveHrHandoff } from './hr-handoff'
import './workspace.css'
import './report-viewer.css'

type Detail = ApiGetResponse<'/api/store/incentives/company-cycle'>['items'][number]
type ArchivedPayload = {
  companyName: string; total: string;
  roster: Array<{ store_id: string; employee_id: string; display_name: string; position_code: string; included: boolean; reason_note: string | null }>
  stores: Array<{ store_id: string; store_name: string }>
  rows: Array<{ store_id: string; employee_id: string; participant_type: string; target_amount: string | null; payable_amount: string; raw_baseline: string; proposed_amount: string; effective_contribution: string }>
  proposals: Array<{ store_id: string; employee_id: string; reason_note: string }>
}
const labels = { preparation: 'Bölge hazırlığı', sales_director: 'Satış Direktörü', hr: 'İK', general_manager: 'Genel Müdür', final: 'Final onaylandı' }

export function CompanyIncentiveCycleView(input: { auth: AuthSessionSummary | null; period: string; onPeriodChange: (period: string) => void; locale: AppLocale }) {
  const tr = input.locale === 'tr'
  const stageLabels = tr ? labels : { preparation: 'Regional Preparation', sales_director: 'Sales Director', hr: 'HR', general_manager: 'General Manager', final: 'Final Approved' }
  const client = useQueryClient()
  const [confirmation, setConfirmation] = useState<{ item: Detail; decision: 'approve' | 'return' } | null>(null)
  const [note, setNote] = useState('')
  const [sending, setSending] = useState(false)
  const queryKey = ['incentive-company-cycle', input.auth?.user.userId, input.auth?.user.authorizationContextVersion, input.period]
  const query = useQuery({ queryKey, queryFn: () => fetchOpenApiJson('/api/store/incentives/company-cycle', { query: new URLSearchParams({ period: input.period }) }), refetchOnWindowFocus: true })
  const refresh = useMutation({ mutationFn: async (value: { item: Detail; decision: 'approve' | 'return' }) => {
    const current = await query.refetch()
    const fresh = current.data?.items.find(item => item.companyId === value.item.companyId)
    if (current.error || !fresh || JSON.stringify(fresh) !== JSON.stringify(value.item)) throw new Error('Onay bilgileri değişti. Güncel özeti kontrol edin.')
    return { item: fresh, decision: value.decision }
  }, retry: 0, onSuccess: value => { setNote(''); setConfirmation(value) }, onError: () => actionToast.error(null, tr ? 'Onay özeti alınamadı. Güncel listeyi kontrol edin.' : 'Approval summary could not be verified. Review the current list.') })
  const command = useMutation({ mutationFn: async (value: { item: Detail; action: 'seal' | 'approve' | 'return'; note?: string }) => {
    if (value.action === 'seal') return sendOpenApiJson('/api/store/incentives/company-cycle/seal', { method: 'POST', body: { companyId: value.item.companyId, period: input.period, expectedRevision: value.item.cycle?.current_revision ?? 0 } })
    const cycle = value.item.cycle
    const revision = value.item.revisions.find(r => r.revision_no === cycle?.current_revision)
    if (!cycle || !revision || !['sales_director', 'hr', 'general_manager'].includes(cycle.stage)) throw new Error('Onay aşaması değişti.')
    return sendOpenApiJson('/api/store/incentives/company-cycle/decisions', { method: 'POST', body: { companyId: value.item.companyId, period: input.period, cycleId: cycle.cycle_id,
      revision: revision.revision_no, stage: cycle.stage as 'sales_director' | 'hr' | 'general_manager', sealHash: revision.seal_hash, decision: value.action, ...(value.note ? { reasonNote: value.note } : {}) } })
  }, retry: 0, onSuccess: () => { setConfirmation(null); actionToast.success('Prim onay durumu güncellendi.') }, onError: () => { setConfirmation(null); actionToast.error(null, tr ? 'Karar doğrulanamadı. Güncel durumu kontrol edin; işlem tekrarlanmadı.' : 'The decision could not be verified. Review the current status; the action was not retried.') },
  onSettled: async () => { await client.invalidateQueries({ queryKey: ['incentive-hr-handoff'] }); await query.refetch() } })
  const busy = command.isPending || refresh.isPending || sending
  const shown = confirmation?.item.revisions.find(r => r.revision_no === confirmation.item.cycle?.current_revision)
  const stale = Boolean(confirmation && (!query.data?.items.some(item => JSON.stringify(item) === JSON.stringify(confirmation.item)) || query.isError))
  const payroll = companyStageCompanies(input.auth, 'payroll').length > 0
  return <CommandCanvasPage ariaLabelledBy="store-incentives-command-title" className="incentive-performance incentive-viewer-workspace">
    <StoreOperationsHeader titleId="store-incentives-command-title" icon={WalletCards} eyebrow={tr ? 'Prim yönetimi' : 'Incentive Management'} title={tr ? 'Primler' : 'Incentives'} description={tr ? 'Şirket dönemi onayları.' : 'Company-period approvals.'}
      actions={<><CalendarPicker mode="month" value={input.period} locale={input.locale} disabled={busy} onValueChange={input.onPeriodChange} ariaLabel="Prim dönemi" />
        {payroll ? <IncentiveHrHandoff packages={[]} auth={input.auth} period={input.period} locale={input.locale} disabled={busy} onBusyChange={setSending} companyCycle /> : null}</>} />
    {query.isPending ? <p role="status">{tr ? 'Onay bilgileri yükleniyor...' : 'Loading approval information...'}</p> : query.isError ? <div role="alert"><p>{tr ? 'Onay bilgileri alınamadı veya yetkiniz kaldırıldı.' : 'Approval information could not be loaded or your capability was revoked.'}</p><Button variant="outline" onClick={() => void query.refetch()}>{tr ? 'Yeniden dene' : 'Retry'}</Button></div> : null}
    {!query.isError && query.data?.items.map(item => {
      const stage = item.cycle?.stage ?? 'preparation'
      const revision = item.revisions.find(r => r.revision_no === item.cycle?.current_revision)
      const payload = revision?.payload as ArchivedPayload | undefined
      const canAct = stage === 'preparation' ? companyStageCompanies(input.auth, 'sales_director').includes(item.companyId)
        : stage !== 'final' && companyStageCompanies(input.auth, stage as CompanyStage).includes(item.companyId)
      return <section key={item.companyId} className="incentive-region-package tw:p-4 tw:space-y-4" aria-label={payload?.companyName ?? 'Şirket onay dönemi'}>
        <header className="tw:flex tw:flex-wrap tw:items-center tw:justify-between tw:gap-3"><div><h2>{payload?.companyName ?? item.companyName}</h2><p>{stageLabels[stage as keyof typeof labels]} {revision ? `· ${tr ? 'Revizyon' : 'Revision'} ${revision.revision_no} · ${formatIncentiveMoney(payload?.total, input.locale)}` : ''}</p></div>
          <div className="tw:flex tw:flex-wrap tw:gap-2"><Button variant="outline" disabled={busy || query.isFetching} onClick={() => void query.refetch()}><RefreshCw aria-hidden="true" />{tr ? 'Yenile' : 'Refresh'}</Button>
            {revision ? <Button variant="outline" disabled={busy} onClick={() => exportSeal(item)}><Download aria-hidden="true" />{tr ? 'Onay listesini indir' : 'Download Approved Source'}</Button> : null}
            {canAct && stage === 'preparation' ? <Button disabled={busy || query.isFetching} onClick={() => command.mutate({ item, action: 'seal' })}>{tr ? 'Şirket listesini mühürle' : 'Seal Company List'}</Button> : canAct ? <><Button variant="outline" disabled={busy || query.isFetching} onClick={() => refresh.mutate({ item, decision: 'return' })}><Undo2 aria-hidden="true" />{tr ? 'İade et' : 'Return'}</Button><Button disabled={busy || query.isFetching} onClick={() => refresh.mutate({ item, decision: 'approve' })}><Check aria-hidden="true" />{tr ? 'Aşamayı onayla' : 'Approve Stage'}</Button></> : null}</div></header>
        {payload ? <ArchivedCompanyPersonnel payload={payload} locale={input.locale} /> : <p>{tr ? 'Tüm sorumlu müdürlerin mağazaları kapatılmış, incelenmiş ve gönderilmiş olmalıdır.' : 'Every responsible manager store must be closed, reviewed and submitted.'}</p>}
        {item.decisions.length ? <details><summary>{tr ? 'Onay geçmişi' : 'Approval History'}</summary><ul>{item.decisions.map(d => <li key={d.decision_id}>{tr ? 'Revizyon' : 'Revision'} {d.revision_no} · {stageLabels[d.stage as keyof typeof labels]} · {d.decision === 'approve' ? (tr ? 'Onaylandı' : 'Approved') : (tr ? 'İade edildi' : 'Returned')} {d.reason_note ? `· ${d.reason_note}` : ''}</li>)}</ul></details> : null}
      </section>
    })}
    <Dialog open={Boolean(confirmation)} onOpenChange={open => { if (!busy && !open) setConfirmation(null) }}>
      <DialogContent className="incentive-package-confirmation" showCloseButton={!busy} onEscapeKeyDown={e => { if (busy) e.preventDefault() }} onPointerDownOutside={e => { if (busy) e.preventDefault() }}>
        <DialogHeader><DialogTitle>{confirmation?.decision === 'return' ? (tr ? 'Şirket listesini iade et' : 'Return Company List') : (tr ? 'Şirket aşamasını onayla' : 'Approve Company Stage')}</DialogTitle><DialogDescription>{tr ? 'Revizyon' : 'Revision'} {shown?.revision_no} · {formatIncentiveMoney((shown?.payload as ArchivedPayload | undefined)?.total, input.locale)}. {confirmation?.item.cycle?.stage === 'general_manager' ? (tr ? 'Final onayında mühürlü tutar düzeltmeleri uygulanır.' : 'Final approval applies the sealed amount proposals.') : (tr ? 'Bu aşamada tutar düzeltmeleri uygulanmaz.' : 'This stage does not apply amount proposals.')}</DialogDescription></DialogHeader>
        {confirmation?.decision === 'return' ? <><label htmlFor="company-return-note">{tr ? 'İade gerekçesi' : 'Return Reason'}</label><Textarea id="company-return-note" maxLength={1000} value={note} disabled={busy} onChange={e => setNote(e.target.value)} /></> : null}
        {stale ? <p role="alert">{tr ? 'Onay bilgileri değişti. Özeti kapatıp güncel listeyi kontrol edin.' : 'Approval information changed. Close the summary and review the current list.'}</p> : null}
        <DialogFooter><Button variant="outline" disabled={busy} onClick={() => setConfirmation(null)}>{tr ? 'Vazgeç' : 'Cancel'}</Button><Button disabled={busy || stale || query.isFetching || (confirmation?.decision === 'return' && !note.trim())} onClick={() => { if (confirmation && !busy && !stale) command.mutate({ item: confirmation.item, action: confirmation.decision, note: note.trim() }) }}>{tr ? 'Onayla' : 'Confirm'}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  </CommandCanvasPage>
}

function ArchivedCompanyPersonnel({ payload, locale }: { payload: ArchivedPayload; locale: AppLocale }) {
  const tr = locale === 'tr'
  const columns = tr ? ['Mağaza', 'Personel', 'Katılım', 'Hedef', 'Hesaplanan', 'Mevcut', 'Onay tutarı', 'Gerekçe'] : ['Store', 'Person', 'Participation', 'Target', 'Calculated', 'Current', 'Approved Amount', 'Reason']
  return <div className="tw:overflow-x-auto"><table className="tw:block tw:w-full tw:text-sm tw:sm:table"><thead className="tw:hidden tw:sm:table-header-group"><tr>{columns.map(label => <th key={label}>{label}</th>)}</tr></thead><tbody className="tw:block tw:sm:table-row-group">{payload.roster.map(person => {
    const rows = payload.rows.filter(r => r.store_id === person.store_id && r.employee_id === person.employee_id)
    const reasons = [person.reason_note, ...(payload.proposals ?? []).filter(p => p.store_id === person.store_id && p.employee_id === person.employee_id).map(p => p.reason_note)].filter(Boolean)
    const values = [payload.stores.find(s => s.store_id === person.store_id)?.store_name, person.display_name,
      person.included ? (tr ? 'Dahil' : 'Included') : (tr ? 'Prime dahil değildir' : 'Not Included'),
      rows.length ? rows.map(r => formatIncentiveMoney(r.target_amount, locale)).join(' / ') : '-',
      rows.length ? rows.map(r => formatIncentiveMoney(r.payable_amount, locale)).join(' / ') : (tr ? 'Hedef / nihai prim satırı yok' : 'No Target / Final Incentive Row'),
      rows.length ? rows.map(r => formatIncentiveMoney(r.raw_baseline, locale)).join(' / ') : '-',
      rows.length ? rows.map(r => formatIncentiveMoney(r.effective_contribution, locale)).join(' / ') : '-', reasons.join(' / ')]
    return <tr key={`${person.store_id}:${person.employee_id}`} className="tw:grid tw:grid-cols-2 tw:gap-3 tw:border-b tw:py-4 tw:sm:table-row">{values.map((value, index) => <td key={columns[index]} className="tw:h-auto! tw:w-auto! tw:min-w-0 tw:border-0! tw:p-0! tw:text-left! tw:break-words tw:align-top tw:sm:p-3!"><span className="tw:mb-1 tw:block tw:text-xs tw:text-muted-foreground tw:sm:hidden">{columns[index]}</span>{value}</td>)}</tr>
  })}</tbody></table></div>
}

function exportSeal(item: Detail) {
  const revision = item.revisions.find(r => r.revision_no === item.cycle?.current_revision)
  if (!revision) return
  const url = URL.createObjectURL(new Blob([JSON.stringify({ companyId: item.companyId, period: item.period, revision: revision.revision_no, sealHash: revision.seal_hash, payload: revision.payload }, null, 2)], { type: 'application/json' }))
  const link = document.createElement('a'); link.href = url; link.download = `Primler-${item.period}-v${revision.revision_no}.json`; link.click(); URL.revokeObjectURL(url)
}
