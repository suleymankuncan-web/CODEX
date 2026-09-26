import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { AppLocale } from '@/lib/i18n'
import { normalizeMoneyInput, toMoneyInputBuffer } from '@/pages/store-incentives-money-input'
import { calculateRateProposal, hasIncentiveAmountChange, isBelowIncentiveThreshold, isEarnedAtIncentiveThreshold, sumMoney } from './model'
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
  onDirtyChange: (dirty: boolean) => void
  onPreviewTotalChange: (preview: { storeId: string; total: string | null }) => void
  footerTarget: HTMLDivElement | null
}) {
  const { store, locale } = input
  const tr = locale === 'tr'
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [onlyChanges, setOnlyChanges] = useState(false)
  const useDailyTracking = input.workspace.salesTracking?.status === 'complete' && Boolean(input.workspace.salesTracking.lastLoadedDate)
  const editable = !input.readOnly && store.capabilities.canCreateCorrection && store.review.periodCloseStatus === 'closed'
  const canComplete = !input.readOnly && store.capabilities.canMarkStoreReview && store.review.periodCloseStatus === 'closed' && Boolean(input.onComplete)
  const values = store.rows.map(row => {
    const key = incentiveRowKey(row)
    const amount = drafts[key] === undefined ? row.finalAmount : normalizeMoneyInput(drafts[key])
    const changed = drafts[key] !== undefined && hasIncentiveAmountChange(row.finalAmount, amount)
    const adjusted = hasIncentiveAmountChange(row.calculatedAmount, amount)
    // Keep pending resets and invalid edits visible while filtering; hiding a row must never discard a draft.
    return { row, key, amount, changed, adjusted, showChange: adjusted || changed || (drafts[key] !== undefined && amount === null) }
  })
  const adjustedPersonnel = new Set(values.filter(item => item.showChange).map(item => item.row.employeeId)).size
  const visibleValues = onlyChanges ? values.filter(item => item.showChange) : values
  const changes = values.filter(item => item.changed).map(item => ({ row: item.row, finalAmount: item.amount! }))
  const invalid = values.some(item => drafts[item.key] !== undefined && item.amount === null)
  const dirty = invalid || changes.length > 0
  const onDirtyChange = input.onDirtyChange
  useEffect(() => { onDirtyChange(dirty) }, [dirty, onDirtyChange])
  const notes = [...new Set(store.rows.map(row => row.correction?.reasonNote?.trim()).filter((text): text is string => Boolean(text)))]
  const setAmount = (key: string, value: string) => { setDrafts(current => ({ ...current, [key]: value })); setError(null) }
  const total = sumMoney(values.map(item => item.amount))
  const onPreviewTotalChange = input.onPreviewTotalChange
  useEffect(() => { onPreviewTotalChange({ storeId: store.storeId, total: invalid ? null : total }) }, [store.storeId, total, invalid, onPreviewTotalChange])
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
    <div className="incentive-personnel-review-tools">
      <span aria-live="polite">{adjustedPersonnel > 0 ? <><strong>{adjustedPersonnel}</strong> {tr ? 'personelde düzenleme var' : 'people with adjustments'}</> : (tr ? 'Personel tutarlarında düzenleme yok' : 'No personnel amount adjustments')}</span>
      {!input.readOnly ? <label htmlFor="incentive-only-changes"><Switch id="incentive-only-changes" checked={onlyChanges} onCheckedChange={setOnlyChanges} disabled={saving} /><span>{tr ? 'Sadece değişiklikleri göster' : 'Show adjustments only'}</span></label> : null}
    </div>
    <div role="table" aria-label={tr ? 'Personel prim dağılımı' : 'Personnel incentive breakdown'}>
    <div className="incentive-edit-columns" role="row"><span role="columnheader">{tr ? 'Personel' : 'Personnel'}</span><span role="columnheader">{tr ? 'Hedef' : 'Target'}</span><span role="columnheader">{useDailyTracking ? (tr ? 'Ay içi net satış' : 'Month-to-date net sales') : (tr ? 'Gerçekleşen' : 'Actual')}</span><span role="columnheader">{useDailyTracking ? (tr ? 'Ay içi HG%' : 'Month-to-date target %') : 'HG%'}</span><span role="columnheader">{tr ? 'Prim oranı' : 'Incentive rate'}</span><span role="columnheader">{tr ? 'Hesaplanan' : 'Calculated'}</span><span role="columnheader">{tr ? 'Final prim' : 'Final incentive'}</span></div>
    {visibleValues.map(({ row, key, amount, showChange }) => {
      const table = input.workspace.rateMetadata.tables.find(item => item.audience === (row.participantType === 'store_manager' ? 'manager' : 'personnel'))
      const rates = input.workspace.rateMetadata.status === 'resolved' ? [...new Set([...(table?.brackets.map(bracket => bracket.rate) ?? []), ...(row.rate !== null ? [row.rate] : [])])] : []
      const selectedRate = amount !== null && amount === row.calculatedAmount && row.rate !== null ? row.rate : (Number(row.actual) > 0 ? rates.find(rate => calculateRateProposal(row.actual, rate) === amount) : null) ?? 'manual'
      const difference = amount !== null && row.calculatedAmount !== null ? sumMoney([amount, `-${row.calculatedAmount}`]) : null
      const snapshotAchievementPct = row.actual !== null && Number(row.target) > 0 ? (Number(row.actual) / Number(row.target) * 100).toFixed(2) : null
      const actualDisplay = useDailyTracking ? row.dailyActualNetSales : row.actual
      const achievementDisplay = useDailyTracking ? row.dailyAchievementPct : snapshotAchievementPct
      const earned = isEarnedAtIncentiveThreshold(amount, snapshotAchievementPct)
      return <div role="row" className="incentive-edit-row" data-editable={editable} data-changed={showChange} key={key}>
        <div role="cell" className="incentive-edit-person"><strong>{row.displayName}</strong><small>{formatIncentivePosition(row.positionCode, locale)}</small></div>
        <div role="cell" data-label={tr ? 'Hedef' : 'Target'}><span>{formatIncentiveMoney(row.target, locale)}</span></div>
        <div role="cell" data-label={useDailyTracking ? (tr ? 'Ay içi net satış' : 'Month-to-date net sales') : (tr ? 'Gerçekleşen' : 'Actual')}><span>{formatIncentiveMoney(actualDisplay, locale)}</span></div>
        <div role="cell" data-label={useDailyTracking ? (tr ? 'Ay içi HG%' : 'Month-to-date target %') : 'HG%'}><span className={`incentive-value-tone${isBelowIncentiveThreshold(achievementDisplay) ? ' is-below-threshold' : ''}`}>{formatIncentivePercent(achievementDisplay, locale)}</span></div>
        <div role="cell" data-label={tr ? 'Prim oranı' : 'Incentive rate'}>{editable && rates.length > 0 ? <Select value={selectedRate} disabled={input.locked || saving || row.actual === null || row.finalAmount === null || row.calculatedAmount === null} onValueChange={rate => { if (rate !== 'manual') { const value = calculateRateProposal(row.actual, rate); if (value !== null) setAmount(key, toMoneyInputBuffer(value)) } }}>
          <SelectTrigger aria-label={`${row.displayName}: ${tr ? 'Prim oranı' : 'Incentive rate'}`}><SelectValue /></SelectTrigger>
          <SelectContent position="popper" align="start"><SelectItem value="manual">{tr ? 'Özel tutar' : 'Custom amount'}</SelectItem>{rates.map(rate => <SelectItem value={rate} key={rate}>{formatIncentiveRate(rate, locale)}</SelectItem>)}</SelectContent>
        </Select> : <span>{selectedRate === 'manual' ? (tr ? 'Özel tutar' : 'Custom amount') : formatIncentiveRate(selectedRate, locale)}</span>}</div>
        <div role="cell" data-label={tr ? 'Hesaplanan' : 'Calculated'}><span>{formatIncentiveMoney(row.calculatedAmount, locale)}</span></div>
        <div role="cell" className={`incentive-edit-final${earned ? ' is-earned' : ''}`} data-label={tr ? 'Final prim' : 'Final incentive'}>{editable ? <>
          <div className="incentive-edit-money"><span aria-hidden="true">₺</span><Input inputMode="decimal" aria-label={`${row.displayName}: ${tr ? 'Final prim tutarı' : 'Final incentive amount'}`} disabled={input.locked || saving || row.finalAmount === null || row.calculatedAmount === null} value={drafts[key] ?? toMoneyInputBuffer(row.finalAmount ?? '')} onChange={event => setAmount(key, event.target.value)} aria-invalid={drafts[key] !== undefined && amount === null} /></div>
          <small className="incentive-edit-difference" data-direction={Number(difference) > 0 ? 'increase' : Number(difference) < 0 ? 'decrease' : 'unchanged'} title={tr ? 'Hesaplanan prime göre fark' : 'Difference from the calculated incentive'}>{difference !== null && Number(difference) !== 0 ? `${tr ? 'Fark' : 'Difference'}: ${formatSignedIncentiveMoney(difference, locale)}` : null}</small>
        </> : <span className={`incentive-value-tone${earned ? ' is-earned' : ''}`}><IncentiveFinalAmount final={amount} calculated={row.calculatedAmount} locale={locale} /></span>}</div>
      </div>
    })}</div>
    {onlyChanges && visibleValues.length === 0 ? <div className="incentive-adjustments-empty" role="status"><p>{tr ? 'Bu mağazada gösterilecek tutar değişikliği yok.' : 'There are no amount adjustments to show for this store.'}</p><Button variant="outline" onClick={() => setOnlyChanges(false)}>{tr ? 'Tüm personeli göster' : 'Show all personnel'}</Button></div> : null}
    {notes.length ? <section className="incentive-store-notes" aria-label={tr ? 'Mağaza notu' : 'Store note'}><h4>{tr ? 'Bölge müdürü notu' : 'Regional manager note'}</h4>{notes.map(text => <p key={text}>{text}</p>)}</section> : null}
    {editable ? <div className="incentive-store-note-input"><label htmlFor="incentive-store-note">{tr ? 'Mağaza değişiklik notu' : 'Store change note'}</label><Textarea id="incentive-store-note" aria-describedby="incentive-store-note-hint" required={changes.length > 0} minLength={3} maxLength={1000} rows={3} disabled={saving || input.locked || changes.length === 0} value={note} onChange={event => setNote(event.target.value)} placeholder={tr ? 'Bu mağaza için yapılan düzenlemelerin gerekçesini yazın…' : 'Explain the store adjustments…'} /><small id="incentive-store-note-hint">{tr ? 'Oran veya tutar değiştiğinde zorunlu · Mağaza için tek not · En az 3 karakter' : 'Required for rate or amount changes · One store note · At least 3 characters'}</small></div> : null}
    {error ? <p className="incentive-editor-error" role="alert">{error}</p> : null}
    {canComplete && input.footerTarget ? createPortal(<footer className="incentive-store-completion"><span aria-live="polite">{changes.length ? `${changes.length} ${tr ? 'personelin tutarı değişti' : 'amounts changed'}` : store.review.status === 'reviewed' ? (tr ? 'Mağaza kontrolü tamamlandı.' : 'Store review completed.') : (tr ? 'Bölge paketi için mağaza kontrolü' : 'Store review for the regional package')}</span><div>{editable ? <Button variant="ghost" disabled={input.locked || saving || Object.keys(drafts).length === 0} onClick={() => { setDrafts({}); setNote(''); setError(null) }}><RotateCcw aria-hidden="true" />{tr ? 'Vazgeç' : 'Reset'}</Button> : null}<Button disabled={input.locked || saving || invalid || (changes.length > 0 && note.trim().length < 3) || (changes.length === 0 && store.review.status === 'reviewed')} onClick={() => void submit()}><Check aria-hidden="true" />{saving ? (tr ? 'Kaydediliyor…' : 'Saving…') : (tr ? 'Tamamla' : 'Complete')}</Button></div></footer>, input.footerTarget) : null}
  </section>
}
