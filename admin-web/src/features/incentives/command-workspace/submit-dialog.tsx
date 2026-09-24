import { useMemo, useState } from 'react'
import { Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { CommandCanvasConfirmationContent } from '@/features/store-command-canvas/primitives'
import type { useLocalization } from '@/features/localization/useLocalization'
import type { AppLocale } from '@/lib/i18n'
import { formatIncentiveMoney, formatIncentivePeriod } from './format'
import { getSubmitManagerOptions, isIncentiveManagerGroupSubmitReady, sumMoney } from './model'
import type { IncentiveWorkspace } from './types'

type Translate = ReturnType<typeof useLocalization>['t']

export function IncentiveSubmitDialog(input: {
  open: boolean
  onOpenChange: (open: boolean) => void
  workspace: IncentiveWorkspace
  onSubmit: (input: { companyId: string; submissionNote?: string }) => void
  pending: boolean
  disabled?: boolean
  locale: AppLocale
  t: Translate
}) {
  const options = useMemo(() => getSubmitManagerOptions(input.workspace), [input.workspace])
  const [companyId, setCompanyId] = useState(() => options.length === 1 ? options[0]?.companyId ?? '' : '')
  const [note, setNote] = useState('')
  const region = input.workspace.managerGroups.find((item) => item.companyId === companyId && item.managerUserId === options.find(option => option.companyId === companyId)?.managerUserId)
  const regionStores = region?.stores ?? []
  const ready = isIncentiveManagerGroupSubmitReady(region)
  const regionRows = regionStores.flatMap((store) => store.rows)
  const total = sumMoney(regionRows.map((row) => row.finalAmount))
  const correctionCount = regionRows.filter((row) => row.correction !== null).length
  const reviewedCount = regionStores.filter((store) => store.review.status === 'reviewed').length

  const submit = () => {
    if (!companyId || !ready || input.pending || input.disabled) return
    input.onSubmit({ companyId, ...(note.trim() ? { submissionNote: note.trim() } : {}) })
  }

  return (
    <Dialog open={input.open} onOpenChange={(open) => { if (!input.pending) input.onOpenChange(open) }}>
      <CommandCanvasConfirmationContent>
        <DialogHeader className="incentive-confirm-header">
          <span className="incentive-drawer-icon"><Send aria-hidden="true" size={19} /></span>
          <div>
            <DialogTitle>{input.t('storeIncentives.command.submitTitle', { period: formatIncentivePeriod(input.workspace.period, input.locale) })}</DialogTitle>
            <DialogDescription>{input.t('storeIncentives.command.submitCopy')}</DialogDescription>
          </div>
        </DialogHeader>
        <div className="incentive-confirm-body">
          <div className="incentive-confirm-total"><span>{input.t('storeIncentives.command.totalEntitlement')}</span><strong>{formatIncentiveMoney(total, input.locale)}</strong></div>
          <div className="incentive-stat-grid incentive-confirm-grid">
            <ConfirmStat label={input.t('storeIncentives.command.storeReview')} value={`${reviewedCount}/${regionStores.length}`} />
            <ConfirmStat label={input.t('storeIncentives.command.corrections')} value={String(correctionCount)} />
            <ConfirmStat label={input.t('storeIncentives.command.packageStatus')} value={input.t(ready ? 'storeIncentives.command.readyToSubmit' : 'storeIncentives.command.notReadyToSubmit')} />
            <ConfirmStat label={input.t('storeIncentives.command.submissionType')} value={input.t('storeIncentives.command.periodPackage')} />
          </div>
          <div className="incentive-submit-form">
            {options.length > 1 ? (
              <div className="incentive-form-field">
                <Label htmlFor="incentive-submit-region">{input.locale === 'tr' ? 'Şirket paketi' : 'Company package'}</Label>
                <Select value={companyId} onValueChange={setCompanyId}>
                  <SelectTrigger id="incentive-submit-region"><SelectValue placeholder={input.locale === 'tr' ? 'Şirket seçin' : 'Select company'} /></SelectTrigger>
                  <SelectContent>{options.map((option) => <SelectItem key={option.companyId} value={option.companyId}>{option.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            ) : null}
            <div className="incentive-submit-readiness"><span>{input.t('storeIncentives.regionManagerReviewedStores')}</span><strong>{reviewedCount}/{regionStores.length}</strong></div>
            <div className="incentive-form-field">
              <Label htmlFor="incentive-submission-note">{input.t('storeIncentives.command.submissionNote')}</Label>
              <Textarea id="incentive-submission-note" maxLength={1000} onChange={(event) => setNote(event.target.value)} value={note} />
            </div>
          </div>
        </div>
        <DialogFooter className="incentive-confirm-footer">
          <Button disabled={input.pending} onClick={() => input.onOpenChange(false)} variant="outline">{input.t('storeIncentives.command.cancel')}</Button>
          <Button disabled={!companyId || !ready || input.pending || input.disabled} onClick={submit}>
            <Send aria-hidden="true" data-icon="inline-start" />
            {input.t('storeIncentives.command.submitConfirm')}
          </Button>
        </DialogFooter>
      </CommandCanvasConfirmationContent>
    </Dialog>
  )
}

function ConfirmStat(input: { label: string; value: string }) {
  return <div className="incentive-drawer-stat"><small>{input.label}</small><strong>{input.value}</strong></div>
}
