import { actionToast, toastErrorFromUnknown } from '../../lib/action-toast'
import { formatPersonnelPhone, nationalPhoneDigits } from '../../lib/phone-number'
import { Pencil } from 'lucide-react'
import { useId, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { ApiGetResponse } from '../../lib/openapi-client'
import { fetchJson, sendJson } from '../../lib/api'
import { getUserFacingErrorMessage } from '../../lib/format'
import { Button } from '../../components/ui/button'
import { CalendarPicker } from '../../components/ui/calendar-picker'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select'
import { Textarea } from '../../components/ui/textarea'
import { Input } from '../../components/ui/input'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../../components/ui/dialog'

type Personnel = ApiGetResponse<'/api/workforce/personnel-corrections/personnel/{employeeId}/stores/{storeId}'>
type Values = Personnel['values']
type Correction = ApiGetResponse<'/api/workforce/personnel-corrections'>['items'][number]
const labels: Record<keyof Values, string> = { email: 'E-posta', nationalIdLast4: 'TC kimlik no (son 4 hane)', firstName: 'Ad', lastName: 'Soyad', phoneNumber: 'Telefon', hireDate: 'İşe giriş tarihi', employmentType: 'Çalışma türü', positionId: 'Pozisyon' }
const employment: Record<string, string> = { full_time: 'Tam zamanlı', part_time: 'Yarı zamanlı', temporary: 'Geçici' }
const status: Record<string, string> = { pending_hr_approval: 'İK onayı bekliyor', approved: 'Onaylandı', rejected: 'Reddedildi' }

export function PersonnelCorrectionButton(input: { employeeId: string; storeId: string; scopeKey: string }) {
  const [open, setOpen] = useState(false)
  return <><Button variant="secondary" size="sm" className="workforce-edit-button" onClick={() => setOpen(true)}><Pencil aria-hidden="true" />Düzenle</Button>
    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="workforce-request-dialog">
      <DialogHeader className="workforce-drawer-heading"><DialogTitle>Personel bilgilerini düzelt</DialogTitle><DialogDescription>Değişiklikler İK onayından sonra kaydedilir.</DialogDescription></DialogHeader>
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
  const [nationalId, setNationalId] = useState('')
  const nationalIdHintId = useId()
  const nationalIdIncomplete = nationalId.length > 0 && nationalId.length !== 11
  const [reason, setReason] = useState('')
  const complete = Boolean(values.firstName.trim() && values.lastName.trim() && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email?.trim() ?? '') && /^(?=(?:\D*\d){10,15}\D*$)[0-9+() -]{10,20}$/.test(values.phoneNumber) && /^[0-9]{11}$/.test(nationalId) && values.hireDate && values.employmentType && values.positionId && reason.trim())
  const client = useQueryClient()
  const mutation = useMutation({ mutationFn: () => sendJson('/workforce/personnel-corrections', { method: 'POST', body: {
    employeeId: input.employeeId, storeId: input.storeId, expectedRevision: input.personnel.revision, proposed: {
      firstName: values.firstName, lastName: values.lastName, phoneNumber: nationalPhoneDigits(values.phoneNumber),
      hireDate: values.hireDate, employmentType: values.employmentType, positionId: values.positionId,
      ...(values.email?.trim() ? { email: values.email.trim() } : {}), ...(nationalId ? { nationalId } : {}),
    }, reason,
  } }), onSuccess: async () => {
    actionToast.success('Talebiniz İK onayına gönderildi.')
    input.onDone()
    await client.invalidateQueries({ queryKey: ['personnel-corrections'] })
  }, onError: (error) => actionToast.error(error, 'Talep gönderilemedi. Bilgileri kontrol edip tekrar deneyin.') })
  return <form className="workforce-request-body workforce-correction-form" onSubmit={(event) => { event.preventDefault(); if (complete) mutation.mutate() }}>
    <p className="workforce-form-wide">Tüm alanlar zorunludur.</p>
    {(['firstName', 'lastName', 'email', 'phoneNumber'] as const).map((field) => <label key={field}>{labels[field]}
      <Input aria-label={labels[field]} type={field === 'email' ? 'email' : field === 'phoneNumber' ? 'tel' : 'text'} required maxLength={field === 'email' ? 254 : field === 'phoneNumber' ? 20 : 100}
        placeholder={field === 'phoneNumber' ? '(539) 123 45 67' : undefined}
        value={field === 'phoneNumber' ? formatPersonnelPhone(values[field] ?? '') : values[field] ?? ''} onChange={(event) => setValues({ ...values, [field]: field === 'phoneNumber' ? nationalPhoneDigits(event.target.value) : event.target.value })} />
      {field === 'phoneNumber' ? <small className="tw:text-muted-foreground">Başında 0 olmadan, 10 hane girin.</small> : null}</label>)}
    <label>TC kimlik no<Input aria-label="TC kimlik no" required inputMode="numeric" pattern="[0-9]{11}" maxLength={11} autoComplete="off" aria-invalid={nationalIdIncomplete} aria-describedby={nationalIdHintId}
      placeholder={values.nationalIdLast4 ? `•••••••${values.nationalIdLast4}` : '11 haneli TC kimlik no'} value={nationalId} onChange={(event) => setNationalId(event.target.value.replace(/\D/g, ''))} />
      <small id={nationalIdHintId} aria-live="polite" className={nationalIdIncomplete ? 'tw:text-destructive' : 'tw:text-muted-foreground'}>
        {nationalIdIncomplete ? `TC kimlik numarası 11 haneli olmalıdır. Şu anda ${nationalId.length} hane girdiniz.` : nationalId.length === 11 ? '11 hane girildi.' : 'TC kimlik numarasını 11 hane olarak girin.'}
      </small></label>
    <label>İşe giriş tarihi<CalendarPicker mode="single" ariaLabel="İşe giriş tarihi" value={values.hireDate} onValueChange={(hireDate) => setValues({ ...values, hireDate })} /></label>
    <label>Çalışma türü<Select value={values.employmentType} onValueChange={(value) => setValues({ ...values, employmentType: value as Values['employmentType'] })}>
      <SelectTrigger aria-label="Çalışma türü"><SelectValue /></SelectTrigger><SelectContent>{Object.entries(employment).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></label>
    <label>Pozisyon<Select value={values.positionId} onValueChange={(positionId) => setValues({ ...values, positionId })}>
      <SelectTrigger aria-label="Pozisyon"><SelectValue /></SelectTrigger><SelectContent>{input.personnel.positions.map((position) => <SelectItem key={position.positionId} value={position.positionId}>{position.positionName}</SelectItem>)}</SelectContent></Select></label>
    <label className="workforce-form-wide">Düzeltme gerekçesi<Textarea aria-label="Düzeltme gerekçesi" required maxLength={500} rows={2} value={reason} onChange={(event) => setReason(event.target.value)} /></label>
    {mutation.isError ? <p role="alert" className="workforce-form-wide">{toastErrorFromUnknown(mutation.error, 'Talep gönderilemedi. Bilgileri yenileyip tekrar deneyin.')}</p> : null}
    <footer className="workforce-form-wide"><Button type="submit" disabled={mutation.isPending || !complete}>{mutation.isPending ? 'Gönderiliyor…' : 'İK onayına gönder'}</Button></footer>
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
      {mutation.isError ? <p role="alert">{toastErrorFromUnknown(mutation.error, 'İşlem tamamlanamadı.')}</p> : null}</> : null}
  </article>
}

function displayCorrectionValue(item: Correction, key: keyof Values, proposed: boolean) {
  if (key === 'positionId') return (proposed ? item.proposed_position_name : item.previous_position_name) ?? 'Pozisyon bulunamadı'
  const value = (proposed ? item.proposed_values : item.previous_values)[key]
  return key === 'employmentType' ? employment[value ?? ''] ?? value : value || '—'
}
