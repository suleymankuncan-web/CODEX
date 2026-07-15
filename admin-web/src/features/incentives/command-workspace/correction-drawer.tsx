import { useMemo, useState } from 'react'
import { BadgeDollarSign, Check, RotateCcw } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
  const [amount, setAmount] = useState(() => toMoneyInputBuffer(row.finalAmount ?? row.calculatedAmount ?? ''))
  const [note, setNote] = useState(() => row.correction?.reasonNote ?? '')
  const [selectedRate, setSelectedRate] = useState<string | null>(() => row.rate)
  const audience = row.participantType === 'store_manager' ? 'manager' : 'personnel'
  const rateTable = useMemo(
    () => input.workspace.rateMetadata.tables.find((table) => table.audience === audience) ?? null,
    [audience, input.workspace.rateMetadata.tables],
  )
  const normalizedAmount = normalizeMoneyInput(amount)
  const signedDifference = subtractMoney(normalizedAmount, row.calculatedAmount)
  const changed = signedDifference !== null && Number(signedDifference) !== 0
  const achievement = calculateAchievement(row.target, row.actual)
  const canSave = Boolean(store.capabilities.canCreateCorrection && normalizedAmount && note.trim().length >= 3)

  return (
    <Sheet open onOpenChange={(open) => { if (!open && !input.pending) input.onClose() }}>
      <CommandCanvasOperationalDrawerContent>
        <SheetHeader className="incentive-drawer-header">
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
              <div><h3>{input.t('storeIncentives.command.adjustmentSection')}</h3><p>{input.t('storeIncentives.command.correctionCopy')}</p></div>
              <Badge variant={changed ? 'secondary' : 'outline'}>{input.t(changed ? 'storeIncentives.command.changePresent' : 'storeIncentives.command.noChange')}</Badge>
            </div>

            <fieldset className="incentive-rate-picker">
              <legend>{input.t('storeIncentives.command.rateColumn')}</legend>
              <div>
                {input.workspace.rateMetadata.status === 'resolved' && rateTable && row.actual !== null
                  ? rateTable.brackets.map((bracket) => {
                      const proposal = calculateRateProposal(row.actual, bracket.rate)
                      return (
                        <Button
                          aria-label={`${formatIncentiveRate(bracket.rate, input.locale)} · ${bracket.displayLabel}`}
                          aria-pressed={selectedRate === bracket.rate}
                          className="incentive-rate-option"
                          disabled={proposal === null}
                          key={`${rateTable.version}:${bracket.minAchievementPct ?? 'min'}:${bracket.maxAchievementPct ?? 'max'}:${bracket.rate}`}
                          onClick={() => { if (proposal) { setSelectedRate(bracket.rate); setAmount(toMoneyInputBuffer(proposal)) } }}
                          size="sm"
                          type="button"
                          variant={selectedRate === bracket.rate ? 'default' : 'outline'}
                        >
                          {formatIncentiveRate(bracket.rate, input.locale)}
                          <small>{bracket.displayLabel}</small>
                        </Button>
                      )
                    })
                  : <p>{input.t('storeIncentives.command.rateUnavailable')}</p>}
              </div>
            </fieldset>

            <div className={`incentive-impact-preview ${Number(signedDifference ?? 0) > 0 ? 'is-increase' : Number(signedDifference ?? 0) < 0 ? 'is-decrease' : 'is-neutral'}`} aria-live="polite">
              <span><small>{input.t('storeIncentives.command.afterCorrection')}</small><strong>{formatIncentiveMoney(normalizedAmount, input.locale)}</strong></span>
              <span><small>{input.t('storeIncentives.command.changeAmount')}</small><strong>{formatSignedIncentiveMoney(signedDifference, input.locale)}</strong></span>
            </div>

            <div className="incentive-form-field">
              <Label htmlFor="incentive-final-amount">{input.t('storeIncentives.command.finalAmount')}</Label>
              <div className="incentive-money-input">
                <Input id="incentive-final-amount" inputMode="decimal" onChange={(event) => { setAmount(event.target.value); setSelectedRate(null) }} value={amount} />
                <span>TL</span>
              </div>
            </div>
            <div className="incentive-form-field">
              <Label htmlFor="incentive-correction-note">{input.t('storeIncentives.command.correctionNote')}</Label>
              <Textarea id="incentive-correction-note" maxLength={1000} onChange={(event) => setNote(event.target.value)} placeholder={input.t('storeIncentives.command.notePlaceholder')} value={note} />
              <small>{note.trim().length}/1000</small>
            </div>
          </section>
        </div>

        <SheetFooter className="incentive-drawer-footer">
          {row.correction && store.capabilities.canVoidCorrection && (row.correction.status === 'draft' || row.correction.status === 'admin_returned') ? (
            <Button disabled={input.pending} onClick={() => input.onVoid({ store, row, correctionId: row.correction!.correctionId })} type="button" variant="ghost">
              <RotateCcw aria-hidden="true" data-icon="inline-start" />
              {input.t('storeIncentives.command.revert')}
            </Button>
          ) : <span />}
          <div>
            <Button disabled={input.pending} onClick={input.onClose} type="button" variant="outline">{input.t('storeIncentives.command.cancel')}</Button>
            <Button disabled={!canSave || input.pending || !normalizedAmount} onClick={() => { if (normalizedAmount) input.onSave({ store, row, finalAmount: normalizedAmount, reasonNote: note.trim() }) }} type="button">
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
