import { useState } from 'react'
import { type UseMutationResult } from '@tanstack/react-query'
import { RotateCcw, Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Sheet,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Textarea } from '@/components/ui/textarea'
import {
  type SalesTargetIncentiveProjection,
  type SalesTargetIncentiveRow,
  type StoreSalesTargetIncentiveCorrectionResponse,
  type StoreSalesTargetIncentiveRegionCorrectionInput,
  type StoreSalesTargetIncentiveVoidCorrectionInput,
} from '../features/incentives/api'
import { useLocalization } from '../features/localization/useLocalization'
import { formatRateValue, getIncentivePositionLabel, toProgressPercent } from './store-incentives-model'
import {
  canReviewProjection,
  getCorrectionLabel,
  getCorrectionTone,
  getRegionEffectiveEarnedAmount,
  normalizeMoneyInput,
  type SelectedIncentiveRow,
} from './store-incentives-region-manager-model'
import {
  formatAchievementState,
  formatIncentiveMoneyValue,
  formatMoneyDisplayValue,
  formatSalesMoneyValue,
  formatTargetMoneyValue,
  getFinalChange,
  getFinalChangeFromAmounts,
  regionManagerPrimaryActionClass,
  toMoneyEditValue,
} from './store-incentives-region-manager-format'
import {
  StoreCommandSheetContent,
  StoreStatusBadge,
} from './store-surface-primitives'

export function IncentiveCorrectionSheet(input: {
  selectedRow: SelectedIncentiveRow | null
  locale: ReturnType<typeof useLocalization>['locale']
  period: string
  workflowLocked: boolean
  onOpenChange: (open: boolean) => void
  correctionMutation: UseMutationResult<
    StoreSalesTargetIncentiveCorrectionResponse,
    Error,
    StoreSalesTargetIncentiveRegionCorrectionInput
  >
  voidCorrectionMutation: UseMutationResult<
    StoreSalesTargetIncentiveCorrectionResponse,
    Error,
    StoreSalesTargetIncentiveVoidCorrectionInput
  >
}) {
  const row = input.selectedRow?.row ?? null
  const projection = input.selectedRow?.projection ?? null

  if (!row || !projection) {
    return <Sheet open={false} onOpenChange={input.onOpenChange} />
  }

  return (
    <Sheet open={Boolean(input.selectedRow)} onOpenChange={input.onOpenChange}>
      <IncentiveCorrectionSheetForm
        correctionMutation={input.correctionMutation}
        key={`${projection.storeId}:${row.employeeId}:${row.participantType}:${row.regionCorrection?.correctionId ?? 'base'}`}
        locale={input.locale}
        onOpenChange={input.onOpenChange}
        period={input.period}
        projection={projection}
        row={row}
        voidCorrectionMutation={input.voidCorrectionMutation}
        workflowLocked={input.workflowLocked}
      />
    </Sheet>
  )
}

function IncentiveCorrectionSheetForm(input: {
  row: SalesTargetIncentiveRow
  projection: SalesTargetIncentiveProjection
  locale: ReturnType<typeof useLocalization>['locale']
  period: string
  workflowLocked: boolean
  onOpenChange: (open: boolean) => void
  correctionMutation: UseMutationResult<
    StoreSalesTargetIncentiveCorrectionResponse,
    Error,
    StoreSalesTargetIncentiveRegionCorrectionInput
  >
  voidCorrectionMutation: UseMutationResult<
    StoreSalesTargetIncentiveCorrectionResponse,
    Error,
    StoreSalesTargetIncentiveVoidCorrectionInput
  >
}) {
  const { row, projection } = input
  const { t } = useLocalization()
  const [finalAmount, setFinalAmount] = useState(() =>
    formatMoneyDisplayValue(formatIncentiveMoneyValue(getRegionEffectiveEarnedAmount(row), input.locale)),
  )
  const [reasonNote, setReasonNote] = useState(row.regionCorrection?.reasonNote ?? '')
  const progress = toProgressPercent(row.achievementPct) ?? 0
  const projectionCanEdit = canReviewProjection(projection)
  const canEdit =
    projectionCanEdit &&
    !input.workflowLocked &&
    (!row.regionCorrection || row.regionCorrection.status === 'draft' || row.regionCorrection.status === 'admin_returned')
  const canVoid =
    projectionCanEdit &&
    !input.workflowLocked &&
    Boolean(row.regionCorrection) &&
    (row.regionCorrection?.status === 'draft' || row.regionCorrection?.status === 'admin_returned')
  const normalizedFinalAmount = normalizeMoneyInput(toMoneyEditValue(finalAmount))
  const amountIsValid = normalizedFinalAmount !== null
  const savedFinalChange = getFinalChange(row, input.locale)
  const finalChange = amountIsValid
    ? getFinalChangeFromAmounts(
        row.regionCorrection?.beforeAmount ?? row.payableAmount,
        normalizedFinalAmount,
        input.locale,
      )
    : savedFinalChange
  const noteIsValid = reasonNote.trim().length >= 3

  return (
    <StoreCommandSheetContent
      className="tw:flex tw:max-h-[calc(100dvh-28px)] tw:flex-col tw:overflow-hidden"
      closeLabel={t('storeIncentives.regionManagerClose')}
    >
      <SheetHeader className="tw:border-b tw:border-border tw:bg-gradient-to-br tw:from-primary/5 tw:via-card tw:to-accent/10 tw:p-4">
        <div className="tw:flex tw:items-start tw:justify-between tw:gap-4 tw:pr-8">
          <div className="tw:min-w-0">
            <SheetTitle className="tw:text-base tw:font-semibold tw:tracking-normal">{row.displayName}</SheetTitle>
            <SheetDescription className="tw:mt-1 tw:text-sm">
              {getIncentivePositionLabel(row.positionCode)}, {projection.storeName}
            </SheetDescription>
            <div className="tw:mt-3 tw:flex tw:flex-wrap tw:gap-2">
              {row.regionCorrection ? (
                <StoreStatusBadge tone={getCorrectionTone(row.regionCorrection)}>
                  {getCorrectionLabel(row.regionCorrection)}
                </StoreStatusBadge>
              ) : (
                <StoreStatusBadge tone="neutral">{t('storeIncentives.regionManagerNoCorrection')}</StoreStatusBadge>
              )}
              <StoreStatusBadge tone={progress >= 80 ? 'calm' : 'warning'}>
                {t('storeIncentives.regionManagerGoalBadge', {
                  value: formatAchievementState(row.achievementPct, row.target, row.actualPositiveSales, input.locale),
                })}
              </StoreStatusBadge>
            </div>
          </div>
        </div>
        <div className="tw:mt-4 tw:grid tw:grid-cols-3 tw:gap-2">
          <SheetStat
            label={t('storeIncentives.regionManagerAchievement')}
            value={formatAchievementState(row.achievementPct, row.target, row.actualPositiveSales, input.locale)}
          />
          <SheetStat
            label={t('storeIncentives.regionManagerFinalLine')}
            value={formatIncentiveMoneyValue(getRegionEffectiveEarnedAmount(row), input.locale)}
          />
          <SheetStat label="Değişim" value={finalChange.label} />
        </div>
      </SheetHeader>

      <ScrollArea className="tw:min-h-0 tw:flex-1">
        <div className="tw:flex tw:flex-col tw:gap-3 tw:px-4 tw:py-3">
          <section className="tw:rounded-2xl tw:border tw:border-primary/15 tw:bg-card/95 tw:p-3.5 tw:shadow-sm">
            <div className="tw:flex tw:items-center tw:justify-between tw:gap-3">
              <h3 className="tw:text-sm tw:font-semibold tw:text-foreground">{t('storeIncentives.regionManagerEarningSummaryTitle')}</h3>
              <span className="tw:text-sm tw:font-semibold tw:text-foreground">
                {formatAchievementState(row.achievementPct, row.target, row.actualPositiveSales, input.locale)}
              </span>
            </div>
            <Progress className="tw:mt-3" value={progress} />
            <div className="tw:mt-3 tw:grid tw:gap-2 tw:sm:grid-cols-2">
              <SheetStat label={t('storeIncentives.regionManagerTargetColumn')} value={formatTargetMoneyValue(row.target, input.locale)} />
              <SheetStat label={t('storeIncentives.regionManagerActualColumn')} value={formatSalesMoneyValue(row.actualPositiveSales, input.locale)} />
              <SheetStat label={t('storeIncentives.regionManagerRateLine')} value={formatRateValue(row.rate, input.locale)} />
              <SheetStat label={t('storeIncentives.regionManagerCalculatedLine')} value={formatIncentiveMoneyValue(row.payableAmount, input.locale)} />
            </div>
          </section>

          <section className="tw:rounded-2xl tw:border tw:border-border tw:bg-card/95 tw:p-3.5 tw:shadow-sm">
            <div className="tw:flex tw:items-center tw:justify-between tw:gap-3">
              <h3 className="tw:text-sm tw:font-semibold tw:text-foreground">{t('storeIncentives.regionManagerCorrectionSectionTitle')}</h3>
              <StoreStatusBadge tone={finalChange.tone}>{finalChange.label}</StoreStatusBadge>
            </div>
            <FieldGroup className="tw:mt-4 tw:gap-4">
              <Field>
                <FieldLabel htmlFor="region-final-incentive">
                  {t('storeIncentives.regionManagerFinalAmountField')}
                </FieldLabel>
                <Input
                  className="tw:h-11 tw:px-3 tw:text-base tw:font-semibold tw:tracking-normal"
                  disabled={!canEdit}
                  id="region-final-incentive"
                  inputMode="decimal"
                  onBlur={() => setFinalAmount(formatMoneyDisplayValue(finalAmount))}
                  onChange={(event) => setFinalAmount(event.target.value)}
                  onFocus={(event) => {
                    const inputElement = event.currentTarget
                    setFinalAmount(toMoneyEditValue(finalAmount))
                    window.requestAnimationFrame(() => inputElement.select())
                  }}
                  value={finalAmount}
                />
                <FieldDescription>Kaydedilen tutar admin onayına bu notla gider.</FieldDescription>
                {!amountIsValid ? (
                  <span className="tw:text-xs tw:text-destructive">{t('storeIncentives.regionManagerInvalidAmount')}</span>
                ) : null}
              </Field>
              <div className="tw:grid tw:gap-2 tw:sm:grid-cols-2">
                <SheetStat label={t('storeIncentives.regionManagerCalculatedLine')} value={formatIncentiveMoneyValue(row.payableAmount, input.locale)} />
                <SheetStat label="Değişim" value={finalChange.label} />
              </div>
              <Field>
                <FieldLabel htmlFor="region-correction-note">
                  {t('storeIncentives.regionManagerCorrectionNoteField')}
                </FieldLabel>
                <Textarea
                  className="tw:min-h-20 tw:resize-y"
                  disabled={!canEdit}
                  id="region-correction-note"
                  onChange={(event) => setReasonNote(event.target.value)}
                  placeholder={t('storeIncentives.regionManagerCorrectionNotePlaceholder')}
                  value={reasonNote}
                />
              </Field>
            </FieldGroup>
          </section>
        </div>
      </ScrollArea>

      <SheetFooter className="tw:mx-0 tw:mb-0 tw:border-t tw:border-border tw:bg-muted/25 tw:p-3">
        <div className="tw:flex tw:w-full tw:flex-row tw:items-center tw:justify-end tw:gap-2">
          <Button
            type="button"
            variant="secondary"
            disabled={!canVoid || input.voidCorrectionMutation.isPending}
            onClick={() => {
              const correctionId = row.regionCorrection?.correctionId
              if (!correctionId) {
                setFinalAmount(formatMoneyDisplayValue(formatIncentiveMoneyValue(row.payableAmount, input.locale)))
                setReasonNote('')
                return
              }
              input.voidCorrectionMutation.mutate({
                period: input.period,
                correctionId,
              })
              input.onOpenChange(false)
            }}
          >
            <RotateCcw data-icon="inline-start" />
            {t('storeIncentives.regionManagerRevert')}
          </Button>
          <Button type="button" variant="outline" onClick={() => input.onOpenChange(false)}>
            {t('storeIncentives.regionManagerCancel')}
          </Button>
          <Button
            className={regionManagerPrimaryActionClass}
            type="button"
            disabled={!canEdit || !amountIsValid || !noteIsValid || input.correctionMutation.isPending}
            onClick={() => {
              if (!normalizedFinalAmount) return
              input.correctionMutation.mutate({
                period: input.period,
                storeId: projection.storeId,
                employeeId: row.employeeId,
                participantType: row.participantType,
                finalAmount: normalizedFinalAmount,
                reasonNote: reasonNote.trim(),
              })
              input.onOpenChange(false)
            }}
          >
            <Save data-icon="inline-start" />
            {t('storeIncentives.regionManagerSave')}
          </Button>
        </div>
      </SheetFooter>
    </StoreCommandSheetContent>
  )
}

function SheetStat(input: { label: string; value: string }) {
  return (
    <div className="tw:min-w-0 tw:rounded-xl tw:border tw:border-border/80 tw:bg-background/70 tw:px-3 tw:py-2">
      <span className="tw:block tw:text-xs tw:font-medium tw:text-muted-foreground">{input.label}</span>
      <strong className="tw:mt-1 tw:block tw:truncate tw:text-sm tw:font-semibold tw:text-foreground">{input.value}</strong>
    </div>
  )
}
