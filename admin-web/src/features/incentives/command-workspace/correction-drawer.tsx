import { useMemo, useRef, useState } from 'react'
import { BadgeDollarSign, Check, RotateCcw } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Field, FieldLabel, FieldSet, FieldLegend } from '@/components/ui/field'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Sheet, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Textarea } from '@/components/ui/textarea'
import { CommandCanvasOperationalDrawerContent } from '@/features/store-command-canvas/primitives'
import type { useLocalization } from '@/features/localization/useLocalization'
import type { AppLocale } from '@/lib/i18n'
import { normalizeMoneyInput, toMoneyInputBuffer } from '@/pages/store-incentives-money-input'
import { formatIncentiveMoney, formatIncentivePercent, formatIncentiveRate, formatSignedIncentiveMoney } from './format'
import { calculateRateProposal } from './model'
import type { IncentiveRow, IncentiveStore, IncentiveWorkspace } from './types'

type Translate = ReturnType<typeof useLocalization>['t']

export function IncentiveCorrectionDrawer(input: {
  selection: { store: IncentiveStore; row: IncentiveRow }
  workspace: IncentiveWorkspace
  onClose: () => void
  onSave: (value: { store: IncentiveStore; row: IncentiveRow; finalAmount: string; reasonNote: string }) => void
  onVoid: (value: { store: IncentiveStore; row: IncentiveRow; correctionId: string }) => void
  pending: boolean
  locale: AppLocale
  t: Translate
}) {
  const row = input.selection.row
  const store = input.selection.store
  const headerRef = useRef<HTMLDivElement>(null)
  const [amount, setAmount] = useState(() => toMoneyInputBuffer(row.finalAmount ?? row.calculatedAmount ?? ''))
  const [note, setNote] = useState(() => row.correction?.reasonNote ?? '')
  const [selectedRate, setSelectedRate] = useState<string | null>(() => {
    if (!row.correction) return row.rate
    const table = input.workspace.rateMetadata.tables.find(candidate => candidate.audience === (row.participantType === 'store_manager' ? 'manager' : 'personnel'))
    return table?.brackets.find(bracket => subtractMoney(calculateRateProposal(row.actual, bracket.rate), row.finalAmount) === '0.00')?.rate ?? null
  })
  const audience = row.participantType === 'store_manager' ? 'manager' : 'personnel'
  const rateTable = useMemo(
    () => input.workspace.rateMetadata.tables.find((table) => table.audience === audience) ?? null,
    [audience, input.workspace.rateMetadata.tables],
  )
  const normalizedAmount = normalizeMoneyInput(amount)
  const rateOptions = useMemo(() => {
    const grouped = new Map<string, { rate: string; labels: string[] }>()
    for (const bracket of rateTable?.brackets ?? []) {
      const rate = Number(bracket.rate).toString()
      const option = grouped.get(rate) ?? { rate, labels: [] }
      const min = bracket.minAchievementPct === null ? null : Number(bracket.minAchievementPct).toLocaleString(input.locale)
      const max = bracket.maxAchievementPct === null ? null : Number(bracket.maxAchievementPct).toLocaleString(input.locale)
      option.labels.push(max === null ? `${min}% +` : min === null ? `< ${max}%` : `${min}% – < ${max}%`)
      grouped.set(rate, option)
    }
    return [...grouped.values()]
  }, [rateTable, input.locale])
  const signedDifference = subtractMoney(normalizedAmount, row.calculatedAmount)
  const changed = signedDifference !== null && Number(signedDifference) !== 0
  const achievement = calculateAchievement(row.target, row.actual)
  const currentDifference = subtractMoney(normalizedAmount, row.finalAmount ?? row.calculatedAmount)
  const canSave = Boolean(store.capabilities.canCreateCorrection && normalizedAmount && currentDifference !== null && currentDifference !== '0.00' && note.trim().length >= 3)

  return (
    <Sheet open onOpenChange={(open) => { if (!open && !input.pending) input.onClose() }}>
      <CommandCanvasOperationalDrawerContent onOpenAutoFocus={event => { event.preventDefault(); headerRef.current?.focus() }}>
        <SheetHeader ref={headerRef} tabIndex={-1} className="incentive-drawer-header">
          <span className="incentive-drawer-icon"><BadgeDollarSign aria-hidden="true" size={20} /></span>
          <div>
            <SheetTitle>{row.displayName}</SheetTitle>
            <SheetDescription>{input.t(audience === 'manager' ? 'storeIncentives.command.managerAudience' : 'storeIncentives.command.personnelAudience')} / {store.storeName}</SheetDescription>
          </div>
        </SheetHeader>

        <div className="incentive-drawer-body">
          <section className="incentive-earning-summary">
            <div className="incentive-achievement-line">
              <span>{input.t('storeIncentives.command.targetAchievement')}</span>
              <strong>{formatIncentivePercent(achievement, input.locale)}</strong>
            </div>
            <div className="incentive-mini-track"><span style={{ width: `${Math.min(Math.max(Number(achievement ?? 0), 0), 100)}%` }} /></div>
            <div className="incentive-stat-grid">
              <DrawerStat label={input.t('storeIncentives.command.targetColumn')} value={formatIncentiveMoney(row.target, input.locale)} />
              <DrawerStat label={input.t('storeIncentives.command.actualColumn')} value={formatIncentiveMoney(row.actual, input.locale)} />
              <DrawerStat label={input.t('storeIncentives.command.rateColumn')} value={formatIncentiveRate(row.rate, input.locale)} />
              <DrawerStat label={input.t('storeIncentives.command.calculatedColumn')} value={formatIncentiveMoney(row.calculatedAmount, input.locale)} />
            </div>
          </section>

          <section className="incentive-correction-editor">
            <div className="incentive-correction-section-heading">
              <div><h3>{input.locale === 'tr' ? 'Prim sistemi' : 'Incentive settings'}</h3><p>{input.locale === 'tr' ? 'Oranı seçin, güncellenen tutarı kontrol edin ve notunuzu ekleyin.' : 'Select a rate, review the updated amount and add your note.'}</p></div>
              <Badge variant={changed ? 'secondary' : 'outline'}>{input.t(changed ? 'storeIncentives.command.changePresent' : 'storeIncentives.command.noChange')}</Badge>
            </div>

            <FieldSet className="incentive-rate-picker">
              <FieldLegend>{input.t('storeIncentives.command.rateColumn')}</FieldLegend>
              <ToggleGroup type="single" variant="outline" value={selectedRate === null ? '' : Number(selectedRate).toString()} disabled={input.pending} aria-label={input.t('storeIncentives.command.rateColumn')} onValueChange={rate => { const proposal = rate ? calculateRateProposal(row.actual, rate) : null; if (proposal !== null) { setSelectedRate(rate); setAmount(toMoneyInputBuffer(proposal)) } }}>
                {input.workspace.rateMetadata.status === 'resolved' && rateTable && row.actual !== null
                  ? rateOptions.map((bracket) => {
                      const proposal = calculateRateProposal(row.actual, bracket.rate)
                      return (
                        <ToggleGroupItem
                          value={bracket.rate}
                          aria-label={`${formatIncentiveRate(bracket.rate, input.locale)} · ${bracket.labels.join(' / ')}`}
                          className="incentive-rate-option"
                          disabled={proposal === null}
                          key={bracket.rate}
                          size="sm"
                          type="button"
                        >
                          {formatIncentiveRate(bracket.rate, input.locale)}
                          <small>{bracket.labels.join(' / ')}</small>
                          <small>{formatIncentiveMoney(proposal, input.locale)}</small>
                        </ToggleGroupItem>
                      )
                    })
                  : <p>{input.t('storeIncentives.command.rateUnavailable')}</p>}
              </ToggleGroup>
            </FieldSet>

            <div className={`incentive-impact-preview ${Number(signedDifference ?? 0) > 0 ? 'is-increase' : Number(signedDifference ?? 0) < 0 ? 'is-decrease' : 'is-neutral'}`} aria-live="polite">
              <span><small>{input.t('storeIncentives.command.afterCorrection')}</small><strong>{formatIncentiveMoney(normalizedAmount, input.locale)}</strong></span>
              <span><small>{input.t('storeIncentives.command.changeAmount')}</small><strong>{formatSignedIncentiveMoney(signedDifference, input.locale)}</strong></span>
            </div>

            <Field className="incentive-form-field">
              <FieldLabel htmlFor="incentive-final-amount">{input.t('storeIncentives.command.finalAmount')}</FieldLabel>
              <div className="incentive-money-input">
                <Input id="incentive-final-amount" disabled={input.pending} inputMode="decimal" onChange={(event) => { setAmount(event.target.value); setSelectedRate(null) }} value={amount} />
                <span>TL</span>
              </div>
            </Field>
            <Field className="incentive-form-field incentive-note-field">
              <FieldLabel htmlFor="incentive-correction-note">{input.t('storeIncentives.command.correctionNote')}</FieldLabel>
              <Textarea id="incentive-correction-note" required disabled={input.pending} aria-describedby="incentive-note-help" maxLength={1000} onChange={(event) => setNote(event.target.value)} placeholder={input.t('storeIncentives.command.notePlaceholder')} value={note} />
              <small id="incentive-note-help">{input.locale === 'tr' ? 'Zorunlu · En az 3 karakter' : 'Required · At least 3 characters'} · {note.trim().length}/1000</small>
            </Field>
          </section>
        </div>

        <SheetFooter className="incentive-drawer-footer">
          {row.correction && store.capabilities.canVoidCorrection && (row.correction.status === 'draft' || row.correction.status === 'admin_returned') ? (
            <Button className="incentive-drawer-action incentive-drawer-action--revert" disabled={input.pending} onClick={() => input.onVoid({ store, row, correctionId: row.correction!.correctionId })} type="button" variant="ghost">
              <RotateCcw aria-hidden="true" data-icon="inline-start" />
              {input.t('storeIncentives.command.revert')}
            </Button>
          ) : <span />}
          <div>
            <Button className="incentive-drawer-action incentive-drawer-action--cancel" disabled={input.pending} onClick={input.onClose} type="button" variant="outline">{input.t('storeIncentives.command.cancel')}</Button>
            <Button className="incentive-drawer-action incentive-drawer-action--save" disabled={!canSave || input.pending || !normalizedAmount} onClick={() => { if (normalizedAmount) input.onSave({ store, row, finalAmount: normalizedAmount, reasonNote: note.trim() }) }} type="button">
              <Check aria-hidden="true" data-icon="inline-start" />
              {input.t('storeIncentives.command.save')}
            </Button>
          </div>
        </SheetFooter>
      </CommandCanvasOperationalDrawerContent>
    </Sheet>
  )
}

function DrawerStat(input: { label: string; value: string }) {
  return <div className="incentive-drawer-stat"><small>{input.label}</small><strong>{input.value}</strong></div>
}

function calculateAchievement(target: string | null, actual: string | null) {
  if (target === null || actual === null || Number(target) <= 0) return null
  return ((Number(actual) / Number(target)) * 100).toFixed(2)
}

function subtractMoney(left: string | null, right: string | null) {
  if (left === null || right === null) return null
  const leftCents = toCents(left)
  const rightCents = toCents(right)
  if (leftCents === null || rightCents === null) return null
  const value = leftCents - rightCents
  const sign = value < 0n ? '-' : ''
  const absolute = value < 0n ? -value : value
  return `${sign}${absolute / 100n}.${(absolute % 100n).toString().padStart(2, '0')}`
}

function toCents(value: string) {
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(value)
  if (!match) return null
  return BigInt(match[1] ?? '0') * 100n + BigInt((match[2] ?? '').padEnd(2, '0') || '0')
}
