import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { AppLocale } from '@/lib/i18n'
import { normalizeMoneyInput, toMoneyInputBuffer } from '@/pages/store-incentives-money-input'
import { calculateRateProposal, sumMoney } from './model'
import { formatIncentiveMoney, formatIncentivePercent, formatIncentivePosition, formatIncentiveRate, formatSignedIncentiveMoney } from './format'
import { IncentiveFinalAmount } from './final-amount'
import type { IncentiveRow, IncentiveStore, IncentiveWorkspace } from './types'

export type StoreIncentiveChange = { row: IncentiveRow; finalAmount: string }
export type CompleteStoreIncentiveReview = (store: IncentiveStore, changes: StoreIncentiveChange[], note: string) => Promise<void>
const incentiveRowKey = (row: IncentiveRow) => `${row.employeeId}:${row.participantType}`

export function StoreReviewEditor(input: {
  store: IncentiveStore; workspace: IncentiveWorkspace; locale: AppLocale; readOnly: boolean
  locked: boolean; onComplete?: CompleteStoreIncentiveReview | undefined
  onPendingChange: (pending: boolean) => void
  onDirtyChange: (dirty: boolean) => void; footerTarget: HTMLDivElement | null
}) {
  const { store, locale } = input
  const tr = locale === 'tr'
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const editable = !input.readOnly && store.capabilities.canCreateCorrection && store.review.periodCloseStatus === 'closed'
  const canComplete = !input.readOnly && store.capabilities.canMarkStoreReview && store.review.periodCloseStatus === 'closed' && Boolean(input.onComplete)
  const values = store.rows.map(row => {
    const key = incentiveRowKey(row)
    const amount = drafts[key] === undefined ? row.finalAmount : normalizeMoneyInput(drafts[key])
    return { row, key, amount, changed: drafts[key] !== undefined && amount !== null && row.finalAmount !== null && sumMoney([amount, `-${row.finalAmount}`]) !== '0.00' }
  })
  const changes = values.filter(item => item.changed).map(item => ({ row: item.row, finalAmount: item.amount! }))
  const invalid = values.some(item => drafts[item.key] !== undefined && item.amount === null)
  const dirty = invalid || changes.length > 0
  const onDirtyChange = input.onDirtyChange
  useEffect(() => { onDirtyChange(dirty) }, [dirty, onDirtyChange])
  const notes = [...new Set(store.rows.map(row => row.correction?.reasonNote?.trim()).filter((text): text is string => Boolean(text)))]
  const setAmount = (key: string, value: string) => { setDrafts(current => ({ ...current, [key]: value })); setError(null) }
  const total = sumMoney(values.map(item => item.amount))
  const submit = async () => {
    if (!input.onComplete || !canComplete || input.locked || saving || invalid || (changes.length > 0 && note.trim().length < 3)) return
    setSaving(true); input.onPendingChange(true); setError(null)
    try {
      await input.onComplete(store, changes, note.trim())
      setDrafts({}); setNote('')
    } catch {
      setError(tr ? 'İşlem tamamlanamadı. Kaydedilen değişiklikler korundu; güncel tutarları kontrol ederek tekrar deneyin.' : 'Could not complete. Saved changes were retained; review the refreshed amounts before retrying.')
    } finally { setSaving(false); input.onPendingChange(false) }
  }
  return <section className="incentive-store-editor" aria-label={`${store.storeName}: ${tr ? 'Personel primleri' : 'Personnel incentives'}`}>
    <header><h3>{tr ? 'Personel primleri' : 'Personnel incentives'} <small>{store.rows.length}</small></h3><p>{editable ? (tr ? 'Oran seçin veya tutarı düzenleyin. Değişiklikleri mağaza için tek notla tamamlayın.' : 'Select rates or edit amounts, then complete with one store note.') : (tr ? 'Hesaplanan tutarlar ve bölge müdürünün düzenlemeleri.' : 'Calculated amounts and regional manager changes.')}</p></header>
    <div role="table" aria-label={tr ? 'Personel prim dağılımı' : 'Personnel incentive breakdown'}>
    <div className="incentive-edit-columns" role="row"><span role="columnheader">{tr ? 'Personel' : 'Personnel'}</span><span role="columnheader">{tr ? 'Net satış / HG%' : 'Net sales / Target %'}</span><span role="columnheader">{tr ? 'Hesaplanan' : 'Calculated'}</span><span role="columnheader">{tr ? 'Prim oranı' : 'Incentive rate'}</span><span role="columnheader">{tr ? 'Final prim' : 'Final incentive'}</span></div>
    {values.map(({ row, key, amount, changed }) => {
      const table = input.workspace.rateMetadata.tables.find(item => item.audience === (row.participantType === 'store_manager' ? 'manager' : 'personnel'))
      const rates = input.workspace.rateMetadata.status === 'resolved' ? [...new Set([...(table?.brackets.map(bracket => bracket.rate) ?? []), ...(row.rate !== null ? [row.rate] : [])])] : []
      const selectedRate = amount !== null && amount === row.calculatedAmount && row.rate !== null ? row.rate : (Number(row.actual) > 0 ? rates.find(rate => calculateRateProposal(row.actual, rate) === amount) : null) ?? 'manual'
      const difference = amount !== null && row.calculatedAmount !== null ? sumMoney([amount, `-${row.calculatedAmount}`]) : null
      return <div role="row" className="incentive-edit-row" data-editable={editable} data-changed={changed || Number(row.finalAmount) !== Number(row.calculatedAmount)} key={key}>
        <div role="cell" className="incentive-edit-person"><strong>{row.displayName}</strong><small>{formatIncentivePosition(row.positionCode, locale)}</small></div>
        <div role="cell" data-label={tr ? 'Net satış / HG%' : 'Net sales / Target %'}><span>{formatIncentiveMoney(row.actual, locale)}</span><small>{formatIncentivePercent(row.actual !== null && Number(row.target) > 0 ? (Number(row.actual) / Number(row.target) * 100).toFixed(2) : null, locale)}</small></div>
        <div role="cell" data-label={tr ? 'Hesaplanan' : 'Calculated'}><span>{formatIncentiveMoney(row.calculatedAmount, locale)}</span><small>{formatIncentiveRate(row.rate, locale)}</small></div>
        <div role="cell" data-label={tr ? 'Prim oranı' : 'Incentive rate'}>{editable && rates.length > 0 ? <Select value={selectedRate} disabled={input.locked || saving || row.actual === null || row.finalAmount === null || row.calculatedAmount === null} onValueChange={rate => { if (rate !== 'manual') { const value = calculateRateProposal(row.actual, rate); if (value !== null) setAmount(key, toMoneyInputBuffer(value)) } }}>
          <SelectTrigger aria-label={`${row.displayName}: ${tr ? 'Prim oranı' : 'Incentive rate'}`}><SelectValue /></SelectTrigger>
          <SelectContent position="popper" align="start"><SelectItem value="manual">{tr ? 'Özel tutar' : 'Custom amount'}</SelectItem>{rates.map(rate => <SelectItem value={rate} key={rate}>{formatIncentiveRate(rate, locale)}</SelectItem>)}</SelectContent>
        </Select> : <span>{selectedRate === 'manual' ? (tr ? 'Özel tutar' : 'Custom amount') : formatIncentiveRate(selectedRate, locale)}</span>}</div>
        <div role="cell" className="incentive-edit-final" data-label={tr ? 'Final prim' : 'Final incentive'}>{editable ? <>
          <div className="incentive-edit-money"><span aria-hidden="true">₺</span><Input inputMode="decimal" aria-label={`${row.displayName}: ${tr ? 'Final prim tutarı' : 'Final incentive amount'}`} disabled={input.locked || saving || row.finalAmount === null || row.calculatedAmount === null} value={drafts[key] ?? toMoneyInputBuffer(row.finalAmount ?? '')} onChange={event => setAmount(key, event.target.value)} aria-invalid={drafts[key] !== undefined && amount === null} /></div>
          <small className="incentive-edit-difference" data-direction={Number(difference) > 0 ? 'increase' : Number(difference) < 0 ? 'decrease' : 'unchanged'} title={tr ? 'Hesaplanan prime göre fark' : 'Difference from the calculated incentive'}>{difference === null ? '—' : Number(difference) === 0 ? (tr ? 'Hesaplananla aynı' : 'Same as calculated') : `${tr ? 'Fark' : 'Difference'}: ${formatSignedIncentiveMoney(difference, locale)}`}</small>
        </> : <IncentiveFinalAmount final={amount} calculated={row.calculatedAmount} locale={locale} />}</div>
      </div>
    })}</div>
    <div className="incentive-store-editor-total"><span>{tr ? 'Mağaza toplamı' : 'Store total'}</span><IncentiveFinalAmount final={invalid ? null : total} calculated={sumMoney(store.rows.map(row => row.calculatedAmount))} locale={locale} /></div>
    {notes.length ? <section className="incentive-store-notes" aria-label={tr ? 'Mağaza notu' : 'Store note'}><h4>{tr ? 'Bölge müdürü notu' : 'Regional manager note'}</h4>{notes.map(text => <p key={text}>{text}</p>)}</section> : null}
    {editable ? <div className="incentive-store-note-input"><label htmlFor="incentive-store-note">{tr ? 'Mağaza değişiklik notu' : 'Store change note'}</label><Textarea id="incentive-store-note" aria-describedby="incentive-store-note-hint" required={changes.length > 0} minLength={3} maxLength={1000} rows={3} disabled={saving || input.locked || changes.length === 0} value={note} onChange={event => setNote(event.target.value)} placeholder={tr ? 'Bu mağaza için yapılan düzenlemelerin gerekçesini yazın…' : 'Explain the store adjustments…'} /><small id="incentive-store-note-hint">{tr ? 'Oran veya tutar değiştiğinde zorunlu · Mağaza için tek not · En az 3 karakter' : 'Required for rate or amount changes · One store note · At least 3 characters'}</small></div> : null}
    {error ? <p className="incentive-editor-error" role="alert">{error}</p> : null}
    {canComplete && input.footerTarget ? createPortal(<footer className="incentive-store-completion"><span aria-live="polite">{changes.length ? `${changes.length} ${tr ? 'personelin tutarı değişti' : 'amounts changed'}` : store.review.status === 'reviewed' ? (tr ? 'Mağaza kontrolü tamamlandı.' : 'Store review completed.') : (tr ? 'Bölge paketi için mağaza kontrolü' : 'Store review for the regional package')}</span><div>{editable ? <Button variant="ghost" disabled={input.locked || saving || Object.keys(drafts).length === 0} onClick={() => { setDrafts({}); setNote(''); setError(null) }}><RotateCcw aria-hidden="true" />{tr ? 'Vazgeç' : 'Reset'}</Button> : null}<Button disabled={input.locked || saving || invalid || (changes.length > 0 && note.trim().length < 3) || (changes.length === 0 && store.review.status === 'reviewed')} onClick={() => void submit()}><Check aria-hidden="true" />{saving ? (tr ? 'Kaydediliyor…' : 'Saving…') : (tr ? 'Tamamla' : 'Complete')}</Button></div></footer>, input.footerTarget) : null}
  </section>
}
