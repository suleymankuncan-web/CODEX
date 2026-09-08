import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { ApiGetResponse } from '../../lib/openapi-client'
import { fetchJson, sendJson } from '../../lib/api'
import { getUserFacingErrorMessage } from '../../lib/format'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../../components/ui/dialog'

type Personnel = ApiGetResponse<'/api/workforce/personnel-corrections/personnel/{employeeId}/stores/{storeId}'>
type Values = Personnel['values']
type Correction = ApiGetResponse<'/api/workforce/personnel-corrections'>['items'][number]
const labels: Record<keyof Values, string> = { firstName: 'Ad', lastName: 'Soyad', phoneNumber: 'Telefon', hireDate: 'İşe giriş tarihi', employmentType: 'Çalışma türü', positionId: 'Pozisyon' }
const employment: Record<string, string> = { full_time: 'Tam zamanlı', part_time: 'Yarı zamanlı', temporary: 'Geçici' }
const status: Record<string, string> = { pending_hr_approval: 'İK onayı bekliyor', approved: 'Onaylandı', rejected: 'Reddedildi' }

export function PersonnelCorrectionButton(input: { employeeId: string; storeId: string; scopeKey: string }) {
  const [open, setOpen] = useState(false)
  return <><Button variant="outline" size="sm" onClick={() => setOpen(true)}>Bilgileri düzenle</Button>
    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="tw:max-h-[90vh] tw:overflow-y-auto">
      <DialogHeader><DialogTitle>Personel bilgilerini düzelt</DialogTitle><DialogDescription>Değişiklikler İK onayından sonra kaydedilir.</DialogDescription></DialogHeader>
      {open ? <CorrectionEditor key={`${input.scopeKey}|${input.employeeId}`} {...input} onDone={() => setOpen(false)} /> : null}
    </DialogContent></Dialog></>
}

function CorrectionEditor(input: { employeeId: string; storeId: string; scopeKey: string; onDone: () => void }) {
  const query = useQuery({ queryKey: ['personnel-correction-values', input.scopeKey, input.storeId, input.employeeId],
    queryFn: () => fetchJson<Personnel>(`/workforce/personnel-corrections/personnel/${input.employeeId}/stores/${input.storeId}`), staleTime: 0 })
  if (query.isPending) return <p role="status">Personel bilgileri yükleniyor…</p>
  if (query.isError) return <p role="alert">{getUserFacingErrorMessage(query.error, 'Personel bilgileri alınamadı.')}</p>
  return <CorrectionForm key={query.data.revision} {...input} personnel={query.data} />
}

function CorrectionForm(input: { employeeId: string; storeId: string; scopeKey: string; onDone: () => void; personnel: Personnel }) {
  const [values, setValues] = useState(input.personnel.values)
  const [reason, setReason] = useState('')
  const client = useQueryClient()
  const mutation = useMutation({ mutationFn: () => sendJson('/workforce/personnel-corrections', { method: 'POST', body: {
    employeeId: input.employeeId, storeId: input.storeId, expectedRevision: input.personnel.revision, proposed: values, reason,
  } }), onSuccess: async () => { await client.invalidateQueries({ queryKey: ['personnel-corrections'] }); input.onDone() } })
  return <form className="tw:space-y-3" onSubmit={(event) => { event.preventDefault(); mutation.mutate() }}>
    {(['firstName', 'lastName', 'phoneNumber', 'hireDate'] as const).map((field) => <label className="tw:block" key={field}>{labels[field]}
      <Input aria-label={labels[field]} type={field === 'hireDate' ? 'date' : 'text'} required={field !== 'phoneNumber'} maxLength={field === 'phoneNumber' ? 20 : 100}
        value={values[field]} onChange={(event) => setValues({ ...values, [field]: event.target.value })} /></label>)}
    <label className="tw:block">Çalışma türü<select aria-label="Çalışma türü" className="tw:block tw:w-full tw:rounded tw:border tw:p-2" value={values.employmentType} onChange={(event) => setValues({ ...values, employmentType: event.target.value as Values['employmentType'] })}>
      {Object.entries(employment).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
    <label className="tw:block">Pozisyon<select aria-label="Pozisyon" className="tw:block tw:w-full tw:rounded tw:border tw:p-2" value={values.positionId} onChange={(event) => setValues({ ...values, positionId: event.target.value })}>
      {input.personnel.positions.map((position) => <option key={position.positionId} value={position.positionId}>{position.positionName}</option>)}</select></label>
    <label className="tw:block">Düzeltme gerekçesi<Input aria-label="Düzeltme gerekçesi" required maxLength={500} value={reason} onChange={(event) => setReason(event.target.value)} /></label>
    {mutation.isError ? <p role="alert">{getUserFacingErrorMessage(mutation.error, 'Talep gönderilemedi. Bilgileri yenileyip tekrar deneyin.')}</p> : null}
    <Button type="submit" disabled={mutation.isPending}>{mutation.isPending ? 'Gönderiliyor…' : 'İK onayına gönder'}</Button>
  </form>
}

export function PersonnelCorrectionQueue(input: { scopeKey: string; review?: boolean; storeId?: string }) {
  const [offset, setOffset] = useState(0)
  const query = useQuery({ queryKey: ['personnel-corrections', input.scopeKey, input.review ?? false, input.storeId ?? '', offset],
    queryFn: () => fetchJson<{ items: Correction[] }>(`/workforce/personnel-corrections?limit=20&offset=${offset}${input.review ? '&status=pending_hr_approval' : ''}${input.storeId ? `&storeId=${input.storeId}` : ''}`) })
  return <section aria-label="Personel düzeltme talepleri" className="tw:space-y-3 tw:rounded-xl tw:border tw:bg-white tw:p-4">
    <h2 className="tw:text-lg tw:font-semibold">Personel düzeltme talepleri</h2>
    {query.isPending ? <p role="status">Talepler yükleniyor…</p> : query.isError ? <p role="alert">{getUserFacingErrorMessage(query.error, 'Talepler alınamadı.')}</p> : <>
      {query.data.items.length === 0 ? <p>Bu sayfada talep bulunmuyor.</p> : query.data.items.map((item) => <CorrectionReview key={item.request_id} item={item} review={input.review ?? false} />)}
      <div className="tw:flex tw:gap-2"><Button variant="outline" disabled={offset === 0} onClick={() => setOffset(offset - 20)}>Önceki</Button>
        <Button variant="outline" disabled={query.data.items.length < 20} onClick={() => setOffset(offset + 20)}>Sonraki</Button></div>
    </>}
  </section>
}

function CorrectionReview({ item, review }: { item: Correction; review?: boolean }) {
  const [note, setNote] = useState('')
  const client = useQueryClient()
  const mutation = useMutation({ mutationFn: (decision: 'approve' | 'reject') => sendJson(`/workforce/personnel-corrections/${item.request_id}/review`, { method: 'PATCH', body: { decision, note } }),
    onSuccess: async () => { await client.invalidateQueries({ queryKey: ['personnel-corrections'] }); await client.invalidateQueries({ queryKey: ['store-workforce-command'] }) } })
  return <article className="tw:space-y-2 tw:rounded tw:border tw:p-3">
    <h3 className="tw:font-semibold">{item.previous_values.firstName} {item.previous_values.lastName} · {item.store_name}</h3>
    <p>{status[item.request_status] ?? item.request_status}</p><p>{item.request_reason}</p>
    <dl>{(Object.keys(labels) as Array<keyof Values>).filter((key) => item.previous_values[key] !== item.proposed_values[key]).map((key) => <div key={key}>
      <dt className="tw:font-medium">{labels[key]}</dt><dd>{displayCorrectionValue(item, key, false)} → {displayCorrectionValue(item, key, true)}</dd>
    </div>)}</dl>
    {item.review_note ? <p>İK notu: {item.review_note}</p> : null}
    {review && item.request_status === 'pending_hr_approval' ? <><label className="tw:block">İK değerlendirme notu<Input aria-label="İK değerlendirme notu" value={note} maxLength={500} onChange={(event) => setNote(event.target.value)} /></label>
      <div className="tw:flex tw:gap-2"><Button disabled={mutation.isPending || !note.trim()} onClick={() => mutation.mutate('approve')}>Onayla</Button>
        <Button variant="outline" disabled={mutation.isPending || !note.trim()} onClick={() => mutation.mutate('reject')}>Reddet</Button></div>
      {mutation.isError ? <p role="alert">{getUserFacingErrorMessage(mutation.error, 'İşlem tamamlanamadı.')}</p> : null}</> : null}
  </article>
}

function displayCorrectionValue(item: Correction, key: keyof Values, proposed: boolean) {
  if (key === 'positionId') return (proposed ? item.proposed_position_name : item.previous_position_name) ?? 'Pozisyon bulunamadı'
  const value = (proposed ? item.proposed_values : item.previous_values)[key]
  return key === 'employmentType' ? employment[value] ?? value : value || '—'
}
